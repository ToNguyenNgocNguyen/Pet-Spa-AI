from django.db import transaction
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from accounts.models import Role, User
from accounts.permissions import IsStaffRole
from catalog.models import Specialty

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
