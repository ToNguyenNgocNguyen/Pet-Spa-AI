from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import Role
from scheduling.models import Booking, BookingStatus

from . import services
from .models import Invoice, InvoiceLine


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = ['id', 'description', 'quantity', 'unit_price', 'amount']


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source='booking.client.full_name', read_only=True)
    client_phone = serializers.CharField(source='booking.client.phone', read_only=True)
    pet_name = serializers.CharField(source='booking.pet.name', read_only=True)
    booking_start_at = serializers.DateTimeField(source='booking.start_at', read_only=True)
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = ['id', 'invoice_no', 'booking', 'client_name', 'client_phone', 'pet_name', 'booking_start_at',
                  'subtotal', 'total', 'status', 'payment_method', 'paid_at', 'received_by_name',
                  'void_reason', 'created_at', 'lines']

    def get_received_by_name(self, inv):
        u = inv.received_by
        return (u.full_name or u.username) if u else None


class InvoiceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """invoices — Khách xem hóa đơn của mình. Lễ tân/Quản lý xem, tạo và thu. Chỉ Quản lý hủy."""

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if u.role == Role.TECHNICIAN:
            return Invoice.objects.none()
        qs = Invoice.objects.select_related('booking__client', 'booking__pet', 'received_by').prefetch_related('lines')
        if u.role == Role.CUSTOMER:
            qs = qs.filter(booking__client__user=u)
        p = self.request.query_params
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('q'):
            qs = qs.filter(Q(invoice_no__icontains=p['q']) | Q(booking__client__full_name__icontains=p['q'])
                           | Q(booking__pet__name__icontains=p['q']))
        return qs

    def create(self, request, *args, **kwargs):
        if request.user.role not in (Role.RECEPTIONIST, Role.MANAGER):
            raise PermissionDenied('Chỉ Lễ tân hoặc Quản lý mới được tạo hóa đơn.')

        booking_id = request.data.get('booking') or request.data.get('booking_id')
        if booking_id:
            try:
                booking = Booking.objects.get(pk=booking_id)
            except Booking.DoesNotExist:
                raise ValidationError({'booking': 'Không tìm thấy lịch hẹn tương ứng.'})
            if hasattr(booking, 'invoice'):
                return Response(InvoiceSerializer(booking.invoice).data, status=status.HTTP_200_OK)
            inv = services.create_invoice(booking)
            if request.data.get('is_paid') and request.data.get('payment_method'):
                inv = services.pay(inv, request.user, request.data.get('payment_method'))
            return Response(InvoiceSerializer(inv).data, status=status.HTTP_201_CREATED)

        # Lập hóa đơn trực tiếp tại quầy (walk-in)
        pet_id = request.data.get('pet') or request.data.get('pet_id')
        if not pet_id:
            raise ValidationError({'booking': 'Vui lòng chọn lịch hẹn đã hoàn tất hoặc thú cưng tại quầy.'})

        from customers.models import Pet
        from catalog.models import Package, Service
        from scheduling.models import BookingItem
        from django.utils import timezone

        try:
            pet = Pet.objects.get(pk=pet_id)
        except Pet.DoesNotExist:
            raise ValidationError({'pet': 'Không tìm thấy hồ sơ thú cưng.'})

        now = timezone.now()
        start_time = now - timezone.timedelta(minutes=30)
        end_time = now
        package_id = request.data.get('package') or request.data.get('package_id')
        raw_services = request.data.get('services') or request.data.get('service_ids') or []
        service_ids = [raw_services] if isinstance(raw_services, int) else list(raw_services)

        booking = Booking.objects.create(
            client=pet.client,
            pet=pet,
            package_id=package_id,
            status=BookingStatus.COMPLETED,
            start_at=start_time,
            end_at=end_time,
            completed_at=end_time,
            channel=Booking.Channel.WALK_IN,
            customer_note=request.data.get('note', 'Lập hóa đơn trực tiếp tại quầy'),
            total_price=0,
        )

        items_to_create = []
        total_price = 0
        if package_id:
            pkg = Package.objects.prefetch_related('items__service', 'prices').get(pk=package_id)
            pkg_price = pkg.prices.filter(size_class=pet.size_class).first()
            p_price = pkg_price.price if pkg_price else 0
            for idx, pi in enumerate(pkg.items.all()):
                items_to_create.append(BookingItem(
                    booking=booking,
                    service=pi.service,
                    position=idx + 1,
                    unit_price=p_price if idx == 0 else 0,
                    start_at=start_time,
                    end_at=end_time,
                ))
            total_price = p_price
        elif service_ids:
            svcs = Service.objects.prefetch_related('prices').filter(id__in=service_ids)
            for idx, s in enumerate(svcs):
                sp = s.prices.filter(size_class=pet.size_class).first()
                price = sp.price if sp else 0
                items_to_create.append(BookingItem(
                    booking=booking,
                    service=s,
                    position=idx + 1,
                    unit_price=price,
                    start_at=start_time,
                    end_at=end_time,
                ))
                total_price += price
        else:
            raise ValidationError({'services': 'Vui lòng chọn ít nhất 1 dịch vụ hoặc gói combo.'})

        BookingItem.objects.bulk_create(items_to_create)
        booking.total_price = total_price
        booking.save(update_fields=['total_price'])

        inv = services.create_invoice(booking)
        if request.data.get('is_paid') and request.data.get('payment_method'):
            inv = services.pay(inv, request.user, request.data.get('payment_method'))

        return Response(InvoiceSerializer(inv).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='unbilled-bookings')
    def unbilled_bookings(self, request):
        if request.user.role not in (Role.RECEPTIONIST, Role.MANAGER):
            raise PermissionDenied()
        qs = Booking.objects.filter(status=BookingStatus.COMPLETED, invoice__isnull=True).select_related('client', 'pet', 'package')
        data = [{
            'id': b.id,
            'client_name': b.client.full_name,
            'client_phone': b.client.phone,
            'pet_name': b.pet.name,
            'pet_species': b.pet.species,
            'pet_size': b.pet.size_class,
            'package_name': b.package.name if b.package else 'Dịch vụ lẻ',
            'start_at': b.start_at,
            'completed_at': b.completed_at,
            'total_price': b.total_price,
        } for b in qs[:30]]
        return Response(data)

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        if request.user.role not in (Role.RECEPTIONIST, Role.MANAGER):
            raise PermissionDenied()
        inv = services.pay(self.get_object(), request.user, request.data.get('payment_method'))
        return Response(InvoiceSerializer(inv).data)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        if request.user.role != Role.MANAGER:
            raise PermissionDenied()
        inv = services.void(self.get_object(), request.user, request.data.get('reason'))
        return Response(InvoiceSerializer(inv).data)
