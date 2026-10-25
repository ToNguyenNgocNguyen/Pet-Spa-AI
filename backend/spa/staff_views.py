from datetime import datetime, time, timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from accounts.models import Role, User
from accounts.permissions import IsStaffRole
from catalog.models import ResourceType, Specialty
from scheduling.models import BookingItem, BookingStatus

from .models import Resource, StaffProfile, TimeOff, WorkShift

STAFF_ROLES = (Role.RECEPTIONIST, Role.TECHNICIAN)


class StaffSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username')
    full_name = serializers.CharField(source='user.full_name')
    phone = serializers.CharField(source='user.phone', required=False, allow_blank=True)
    email = serializers.EmailField(source='user.email', required=False, allow_blank=True)
    role = serializers.ChoiceField(source='user.role', choices=STAFF_ROLES)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    specialties = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Specialty.objects.all(), required=False)

    class Meta:
        model = StaffProfile
        fields = ['id', 'user_id', 'username', 'full_name', 'phone', 'email', 'role', 'password',
                  'specialties', 'is_active']

    def validate_username(self, v):
        qs = User.objects.filter(username__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.user_id)
        if qs.exists():
            raise serializers.ValidationError('Tên đăng nhập đã tồn tại.')
        return v

    def validate(self, attrs):
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'Bắt buộc nhập mật khẩu khi tạo tài khoản.'})
        return attrs

    @transaction.atomic
    def create(self, validated):
        u = validated.pop('user')
        password = validated.pop('password')
        specialties = validated.pop('specialties', [])
        user = User(username=u['username'], full_name=u['full_name'], phone=u.get('phone', ''),
                    email=u.get('email', ''), role=u['role'])
        user.set_password(password)
        user.save()
        profile = StaffProfile.objects.create(user=user, **validated)
        profile.specialties.set(specialties)
        return profile

    @transaction.atomic
    def update(self, instance, validated):
        u = validated.pop('user', {})
        password = validated.pop('password', None)
        specialties = validated.pop('specialties', None)
        user = instance.user
        for k, v in u.items():
            setattr(user, k, v)
        if password:
            user.set_password(password)
        if 'is_active' in validated:
            user.is_active = validated['is_active']
        user.save()
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if specialties is not None:
            instance.specialties.set(specialties)
        return instance


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkShift
        fields = ['id', 'weekday', 'start_time', 'end_time']

    def validate(self, a):
        if a['end_time'] <= a['start_time']:
            raise serializers.ValidationError({'end_time': 'Giờ kết thúc phải sau giờ bắt đầu.'})
        if a['weekday'] > 6:
            raise serializers.ValidationError({'weekday': 'Thứ phải từ 0 đến 6.'})
        return a


class TimeOffSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeOff
        fields = ['id', 'date_from', 'date_to', 'reason']

    def validate(self, a):
        if a['date_to'] < a['date_from']:
            raise serializers.ValidationError({'date_to': 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'})
        return a


class StaffWritePermission(BasePermission):
    """Đọc: mọi nhân sự. Ghi hồ sơ: Quản lý. Ca/nghỉ: Quản lý hoặc chính chủ (kiểm ở view)."""

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated and u.is_staff_role):
            return False
        if request.method in SAFE_METHODS or view.action in ('shifts', 'time_off', 'delete_time_off'):
            return True
        return u.role == Role.MANAGER


class StaffViewSet(viewsets.ModelViewSet):
    """staff — quản lý nhân sự (UC-04, SPA-13). Khóa tài khoản bằng is_active=false, không xóa cứng."""

    serializer_class = StaffSerializer
    permission_classes = [StaffWritePermission]

    def get_queryset(self):
        qs = StaffProfile.objects.select_related('user').prefetch_related('specialties')
        p = self.request.query_params
        if p.get('role'):
            qs = qs.filter(user__role=p['role'])
        if p.get('include_inactive') != '1':
            qs = qs.filter(is_active=True)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.user.is_active = False
        instance.user.save(update_fields=['is_active'])
        instance.save(update_fields=['is_active'])

    def _own_or_manager(self, request, staff):
        if request.user.role != Role.MANAGER and staff.user_id != request.user.id:
            raise PermissionDenied()

    @action(detail=True, methods=['get', 'put'], url_path='shifts')
    def shifts(self, request, pk=None):
        staff = self.get_object()
        if request.method == 'GET':
            return Response(ShiftSerializer(staff.shifts.all(), many=True).data)
        self._own_or_manager(request, staff)
        s = ShiftSerializer(data=request.data, many=True)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            staff.shifts.all().delete()
            WorkShift.objects.bulk_create([WorkShift(staff=staff, **d) for d in s.validated_data])
        return Response(ShiftSerializer(staff.shifts.all(), many=True).data)

    @action(detail=True, methods=['get', 'post'], url_path='time-off')
    def time_off(self, request, pk=None):
        staff = self.get_object()
        if request.method == 'GET':
            return Response(TimeOffSerializer(staff.time_off.all(), many=True).data)
        self._own_or_manager(request, staff)
        s = TimeOffSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(staff=staff)
        return Response(s.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'time-off/(?P<tid>\d+)')
    def delete_time_off(self, request, pk=None, tid=None):
        staff = self.get_object()
        self._own_or_manager(request, staff)
        deleted, _ = TimeOff.objects.filter(staff=staff, pk=tid).delete()
        if not deleted:
            raise NotFound()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = ['id', 'name', 'resource_type', 'is_active']


class ResourceViewSet(viewsets.ModelViewSet):
    """resources — danh mục bồn/bàn/chuồng/phòng (SPA-16, 17). Đọc: nhân sự. Ghi: Quản lý."""

    serializer_class = ResourceSerializer

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [IsStaffRole()]
        from accounts.permissions import IsManager
        return [IsManager()]

    def get_queryset(self):
        qs = Resource.objects.all()
        if self.request.query_params.get('include_inactive') != '1':
            qs = qs.filter(is_active=True)
        t = self.request.query_params.get('resource_type')
        return qs.filter(resource_type=t) if t else qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    @action(detail=False, methods=['get'])
    def occupancy(self, request):
        """Sơ đồ chiếm dụng tài nguyên thời gian thực & theo ngày (SPA-16, SPA-17)."""
        day_str = request.query_params.get('date')
        target_day = parse_date(day_str) if day_str else timezone.localdate()
        if not target_day:
            target_day = timezone.localdate()

        day_start = timezone.make_aware(datetime.combine(target_day, time(0, 0, 0)))
        day_end = day_start + timedelta(days=1)
        is_today = (target_day == timezone.localdate())

        resources = list(self.get_queryset().order_by('resource_type', 'name'))
        res_ids = [r.id for r in resources]

        # Lấy tất cả BookingItem của ngày này
        day_items = (BookingItem.objects
                     .filter(resource_id__in=res_ids, start_at__gte=day_start, start_at__lt=day_end)
                     .exclude(booking__status=BookingStatus.CANCELLED)
                     .select_related('booking', 'booking__pet', 'booking__staff', 'booking__client', 'service')
                     .order_by('start_at'))

        # Lấy các BookingItem đang chiếm dụng thực tế (checked_in hoặc in_progress)
        currently_busy_items = (BookingItem.objects
                                .filter(resource_id__in=res_ids,
                                        booking__status__in=(BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS))
                                .select_related('booking', 'booking__pet', 'booking__staff', 'booking__client', 'service'))
        busy_by_res = {item.resource_id: item for item in currently_busy_items}

        # Gom danh sách lịch theo resource
        items_by_res = {}
        for it in day_items:
            items_by_res.setdefault(it.resource_id, []).append(it)

        resource_data = []
        for r in resources:
            cur_item = busy_by_res.get(r.id) if is_today else None
            is_occupied = cur_item is not None

            cur_info = None
            if cur_item:
                cur_info = {
                    'booking_id': cur_item.booking_id,
                    'booking_status': cur_item.booking.status,
                    'pet_id': cur_item.booking.pet_id,
                    'pet_name': cur_item.booking.pet.name,
                    'pet_species': cur_item.booking.pet.species,
                    'pet_breed': cur_item.booking.pet.breed,
                    'client_name': cur_item.booking.client.full_name if cur_item.booking.client else None,
                    'client_phone': cur_item.booking.client.phone if cur_item.booking.client else None,
                    'staff_name': str(cur_item.booking.staff) if cur_item.booking.staff else None,
                    'service_name': cur_item.service.name,
                    'start_at': cur_item.start_at.isoformat(),
                    'end_at': cur_item.end_at.isoformat(),
                    'checked_in_at': cur_item.booking.checked_in_at.isoformat() if cur_item.booking.checked_in_at else None,
                }

            schedule = []
            for it in items_by_res.get(r.id, []):
                schedule.append({
                    'item_id': it.id,
                    'booking_id': it.booking_id,
                    'booking_status': it.booking.status,
                    'pet_name': it.booking.pet.name,
                    'service_name': it.service.name,
                    'staff_name': str(it.booking.staff) if it.booking.staff else None,
                    'start_at': it.start_at.isoformat(),
                    'end_at': it.end_at.isoformat(),
                })

            resource_data.append({
                'id': r.id,
                'name': r.name,
                'resource_type': r.resource_type,
                'is_active': r.is_active,
                'is_occupied': is_occupied,
                'current': cur_info,
                'schedule': schedule,
            })

        total_count = len(resource_data)
        occupied_count = sum(1 for r in resource_data if r['is_occupied'])
        free_count = total_count - occupied_count
        rate = round((occupied_count / total_count * 100), 1) if total_count > 0 else 0

        by_type = {}
        for rtype, label in ResourceType.choices:
            type_res = [r for r in resource_data if r['resource_type'] == rtype]
            t_total = len(type_res)
            t_occ = sum(1 for r in type_res if r['is_occupied'])
            by_type[rtype] = {
                'label': label,
                'total': t_total,
                'occupied': t_occ,
                'free': max(0, t_total - t_occ),
                'rate': round((t_occ / t_total * 100), 1) if t_total > 0 else 0,
            }

        return Response({
            'date': target_day.isoformat(),
            'is_today': is_today,
            'summary': {
                'total': total_count,
                'occupied': occupied_count,
                'free': free_count,
                'rate': rate,
                'by_type': by_type,
            },
            'resources': resource_data,
        })
