from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsFrontDesk
from billing.models import Invoice
from customers.models import Pet

from . import services
from .models import ACTIVE_STATUSES, Booking, BookingItem, BookingStatus

FRONT_DESK = (Role.RECEPTIONIST, Role.MANAGER)


def _day_start(d):
    return timezone.make_aware(datetime.combine(d, datetime.min.time()), timezone.get_current_timezone())


class BookingItemSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)
    resource_name = serializers.CharField(source='resource.name', read_only=True, default=None)

    class Meta:
        model = BookingItem
        fields = ['id', 'service', 'service_name', 'position', 'start_at', 'end_at', 'resource_type',
                  'resource', 'resource_name', 'unit_price']


class BookingSerializer(serializers.ModelSerializer):
    """Khách không thấy ghi chú nội bộ và ghi chú an toàn của thú."""

    client_info = serializers.SerializerMethodField()
    pet_info = serializers.SerializerMethodField()
    package_name = serializers.CharField(source='package.name', read_only=True, default=None)
    staff_name = serializers.SerializerMethodField()
    items = BookingItemSerializer(many=True, read_only=True)
    invoice = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ['id', 'client', 'client_info', 'pet', 'pet_info', 'package', 'package_name', 'staff',
                  'staff_name', 'status', 'start_at', 'end_at', 'channel', 'note_internal', 'customer_note',
                  'cancel_reason', 'cancel_reason_code', 'checked_in_at', 'checked_out_at', 'completed_at',
                  'total_price', 'items', 'invoice', 'created_at']

    def _is_staff(self):
        return self.context['request'].user.role != Role.CUSTOMER

    def get_client_info(self, b):
        return {'id': b.client_id, 'full_name': b.client.full_name, 'phone': b.client.phone}

    def get_pet_info(self, b):
        p = b.pet
        info = {'id': p.pk, 'name': p.name, 'species': p.species, 'breed': p.breed, 'size_class': p.size_class,
                'coat_type': p.coat_type, 'allergy_note': p.allergy_note,
                'health_tags': [t.name_vi for t in p.health_tags.all()]}
        if self._is_staff():
            info['safety_note'] = p.safety_note
            info['behavior_flags'] = [t.name_vi for t in p.health_tags.all() if t.kind == 'behavior']
        return info

    def get_staff_name(self, b):
        return str(b.staff) if b.staff_id else None

    def get_invoice(self, b):
        inv = getattr(b, 'invoice', None)
        return {'id': inv.pk, 'invoice_no': inv.invoice_no, 'status': inv.status, 'total': inv.total} if inv else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self._is_staff():
            data.pop('note_internal', None)
        return data


class BookingDetailSerializer(BookingSerializer):
    logs = serializers.SerializerMethodField()

    class Meta(BookingSerializer.Meta):
        fields = BookingSerializer.Meta.fields + ['logs']

    def get_logs(self, b):
        return [{'from_status': lg.from_status, 'to_status': lg.to_status, 'reason': lg.reason,
                 'changed_at': lg.changed_at,
                 'changed_by': (lg.changed_by.full_name or lg.changed_by.username) if lg.changed_by else None}
                for lg in b.logs.select_related('changed_by')]


class BookingInputSerializer(serializers.Serializer):
    pet = serializers.PrimaryKeyRelatedField(queryset=Pet.objects.select_related('client'))
    package = serializers.IntegerField(required=False, allow_null=True)
    services = serializers.ListField(child=serializers.IntegerField(), required=False)
    start_at = serializers.DateTimeField()
    staff = serializers.IntegerField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default='')
    customer_note = serializers.CharField(required=False, allow_blank=True, default='')
    channel = serializers.ChoiceField(choices=['counter', 'walk_in'], required=False)
    confirm = serializers.BooleanField(required=False, default=True)
    exclude_id = serializers.IntegerField(required=False, allow_null=True)


class BookingUpdateSerializer(serializers.Serializer):
    pet = serializers.PrimaryKeyRelatedField(queryset=Pet.objects.select_related('client'), required=False)
    package = serializers.IntegerField(required=False, allow_null=True)
    services = serializers.ListField(child=serializers.IntegerField(), required=False)
    start_at = serializers.DateTimeField(required=False)
    staff = serializers.IntegerField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)
    customer_note = serializers.CharField(required=False, allow_blank=True)


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')
    code = serializers.ChoiceField(choices=Booking.CancelCode.values, required=False, default='')


def _pet_for(user, pet):
    """Khách chỉ thao tác trên thú của mình; không để lộ sự tồn tại thú người khác."""
    if user.role == Role.CUSTOMER and pet.client.user_id != user.id:
        raise NotFound()
    return pet


class BookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = BookingSerializer

    def get_serializer_class(self):
        return BookingDetailSerializer if self.action == 'retrieve' else BookingSerializer

    def get_queryset(self):
        u = self.request.user
        qs = Booking.objects.select_related(
            'client', 'pet', 'package', 'staff__user', 'invoice').prefetch_related(
            'items__service', 'items__resource', 'pet__health_tags', 'logs')
        if u.role == Role.CUSTOMER:
            qs = qs.filter(client__user=u)
        elif u.role == Role.TECHNICIAN:
            qs = qs.filter(staff__user=u)
        p = self.request.query_params
        if p.get('date'):
            d = parse_date(p['date'])
            if not d:
                raise ValidationError({'date': 'Ngày không hợp lệ (YYYY-MM-DD).'})
            qs = qs.filter(start_at__gte=_day_start(d), start_at__lt=_day_start(d + timedelta(days=1)))
        if parse_date(p.get('date_from', '')):
            qs = qs.filter(start_at__gte=_day_start(parse_date(p['date_from'])))
        if parse_date(p.get('date_to', '')):
            qs = qs.filter(start_at__lt=_day_start(parse_date(p['date_to']) + timedelta(days=1)))
        if p.get('status'):
            qs = qs.filter(status__in=p['status'].split(','))
        for key in ('pet', 'staff', 'client'):
            if p.get(key):
                qs = qs.filter(**{f'{key}_id': p[key]})
        if p.get('q') and u.role != Role.CUSTOMER:
            qs = qs.filter(Q(pet__name__icontains=p['q']) | Q(client__full_name__icontains=p['q'])
                           | Q(client__phone__icontains=p['q']))
        return qs.order_by('start_at')

    # --- Đọc
    @action(detail=False, methods=['post'], url_path='quote')
    def quote(self, request):
        s = BookingInputSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        pet = _pet_for(request.user, d['pet'])
        staff = d.get('staff') if request.user.role != Role.CUSTOMER else None
        return Response(services.quote(pet, d.get('package'), d.get('services'), d['start_at'], staff, exclude_id=d.get('exclude_id')))

    @action(detail=False, methods=['get'], url_path='availability')
    def availability(self, request):
        p = request.query_params
        day = parse_date(p.get('date', ''))
        if not day:
            raise ValidationError({'date': 'Bắt buộc, dạng YYYY-MM-DD.'})
        try:
            pet = Pet.objects.select_related('client').get(pk=p.get('pet'))
        except (Pet.DoesNotExist, ValueError, TypeError):
            raise ValidationError({'pet': 'Bắt buộc chọn thú hợp lệ.'})
        _pet_for(request.user, pet)
        svc = [int(x) for x in p['services'].split(',') if x] if p.get('services') else None
        staff = p.get('staff') if request.user.role != Role.CUSTOMER else None
        return Response(services.availability(pet, p.get('package') or None, svc, day, staff))

    # --- Ghi
    def create(self, request):
        if request.user.role == Role.TECHNICIAN:
            raise PermissionDenied()
        s = BookingInputSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        pet = _pet_for(request.user, d['pet'])
        b = services.create_booking(
            request.user, pet, d.get('package'), d.get('services'), d['start_at'], d.get('staff'),
            d['note'], d['customer_note'], d.get('channel'), d['confirm'])
        return Response(self._out(b, request), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        return self.partial_update(request, pk)

    def partial_update(self, request, pk=None):
        if request.user.role == Role.TECHNICIAN:
            raise PermissionDenied()
        booking = self.get_object()
        s = BookingUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        pet = None
        if 'pet' in d:
            pet = _pet_for(request.user, d['pet'])
        b = services.update_booking(
            booking=booking,
            user=request.user,
            pet=pet,
            package_id=d.get('package'),
            service_ids=d.get('services'),
            start_at=d.get('start_at'),
            staff_id=d.get('staff'),
            note=d.get('note'),
            customer_note=d.get('customer_note'),
        )
        return Response(self._out(b, request))

    def _out(self, booking, request):
        booking = self.get_queryset().get(pk=booking.pk) if request.user.role != Role.TECHNICIAN else \
            Booking.objects.get(pk=booking.pk)
        return BookingDetailSerializer(booking, context={'request': request}).data

    def _front_desk_only(self, request):
        if request.user.role not in FRONT_DESK:
            raise PermissionDenied()

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        self._front_desk_only(request)
        return Response(self._out(services.confirm(self.get_object(), request.user), request))

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        self._front_desk_only(request)
        s = CancelSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        b = services.cancel(self.get_object(), request.user, s.validated_data['reason'], code='rejected')
        return Response(self._out(b, request))

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        p = request.query_params
        d_from = parse_date(p.get('from') or p.get('date_from', ''))
        d_to = parse_date(p.get('to') or p.get('date_to', ''))
        qs = self.get_queryset()
        if d_from:
            qs = qs.filter(start_at__gte=_day_start(d_from))
        if d_to:
            qs = qs.filter(start_at__lt=_day_start(d_to + timedelta(days=1)))
        return Response([self._out(b, request) for b in qs])

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        if request.user.role == Role.TECHNICIAN:
            raise PermissionDenied()
        s = CancelSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        b = services.cancel(self.get_object(), request.user, s.validated_data['reason'], s.validated_data['code'])
        return Response(self._out(b, request))

    @action(detail=True, methods=['post'], url_path='assign-staff')
    def assign_staff(self, request, pk=None):
        self._front_desk_only(request)
        b = services.assign_staff(self.get_object(), request.data.get('staff'), request.user)
        return Response(self._out(b, request))

    @action(detail=True, methods=['post'], url_path='check-in')
    def check_in(self, request, pk=None):
        self._front_desk_only(request)
        raw = request.data.get('resources') or {}
        try:
            assignments = {int(k): int(v) for k, v in raw.items()}
        except (ValueError, TypeError, AttributeError):
            raise ValidationError({'resources': 'Dạng {mã_dòng: mã_tài_nguyên}.'})
        return Response(self._out(services.check_in(self.get_object(), request.user, assignments), request))

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        if request.user.role not in (Role.TECHNICIAN, Role.MANAGER):
            raise PermissionDenied()
        return Response(self._out(services.start(self.get_object(), request.user), request))

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        if request.user.role not in (Role.TECHNICIAN, Role.MANAGER):
            raise PermissionDenied()
        return Response(self._out(services.complete(self.get_object(), request.user), request))

    @action(detail=True, methods=['post'], url_path='check-out')
    def check_out(self, request, pk=None):
        self._front_desk_only(request)
        b = services.check_out(self.get_object(), request.user)
        out = self._out(b, request)
        inv = out.get('invoice')
        out['warnings'] = [] if (inv and inv['status'] == 'paid') else [
            {'severity': 'warn', 'code': 'unpaid', 'detail': 'Hóa đơn chưa được thu tiền.'}]
        return Response(out)


class DashboardView(APIView):
    """dashboard/today — tổng quan ngày cho Lễ tân/Quản lý (SPA-20). Doanh thu chỉ cộng hóa đơn đã thu."""

    permission_classes = [IsFrontDesk]

    def get(self, request):
        day = parse_date(request.query_params.get('date', '')) or timezone.localdate()
        lo, hi = _day_start(day), _day_start(day + timedelta(days=1))
        today = Booking.objects.filter(start_at__gte=lo, start_at__lt=hi)
        counts = {s.value: today.filter(status=s).count() for s in BookingStatus}
        paid = Invoice.objects.filter(status=Invoice.Status.PAID, paid_at__gte=lo, paid_at__lt=hi)
        revenue = sum(i.total for i in paid)
        now = timezone.now()
        attention = Booking.objects.filter(status=BookingStatus.PENDING).filter(
            Q(created_at__lt=now - timedelta(hours=24)) | Q(start_at__lt=now))
        unpaid = Invoice.objects.filter(status=Invoice.Status.UNPAID)
        by_staff = {}
        active_or_done = tuple(ACTIVE_STATUSES) + (BookingStatus.COMPLETED,)
        for b in today.filter(status__in=active_or_done).select_related('staff__user'):
            key = str(b.staff) if b.staff_id else 'Chưa giao'
            by_staff[key] = by_staff.get(key, 0) + 1
        return Response({
            'date': day, 'counts': counts, 'total_bookings': sum(counts.values()),
            'revenue': revenue, 'paid_invoices': paid.count(),
            'unpaid_count': unpaid.count(), 'unpaid_total': sum(i.total for i in unpaid),
            'needs_attention': [{'id': b.pk, 'pet': b.pet.name, 'start_at': b.start_at, 'created_at': b.created_at}
                                for b in attention.select_related('pet')[:20]],
            'by_staff': [{'staff': k, 'count': v} for k, v in by_staff.items()],
        })
