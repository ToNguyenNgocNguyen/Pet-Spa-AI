from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role


class HasRole(BasePermission):
    """Dùng: permission_classes = [HasRole.of(Role.MANAGER, Role.RECEPTIONIST)]"""

    roles = ()

    @classmethod
    def of(cls, *roles):
        return type('HasRole_' + '_'.join(roles), (cls,), {'roles': tuple(roles)})

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in self.roles)


IsManager = HasRole.of(Role.MANAGER)
IsStaffRole = HasRole.of(Role.RECEPTIONIST, Role.TECHNICIAN, Role.MANAGER)
IsFrontDesk = HasRole.of(Role.RECEPTIONIST, Role.MANAGER)


class ReadAnyWriteManager(BasePermission):
    """Mọi người xem (kể cả chưa đăng nhập), chỉ Quản lý được ghi."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        u = request.user
        return bool(u and u.is_authenticated and u.role == Role.MANAGER)
