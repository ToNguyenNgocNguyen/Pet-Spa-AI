from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    CUSTOMER = 'customer', 'Khách hàng'
    RECEPTIONIST = 'receptionist', 'Lễ tân'
    TECHNICIAN = 'technician', 'Kỹ thuật viên'
    MANAGER = 'manager', 'Quản lý'


class User(AbstractUser):
    """Tài khoản đăng nhập. Mỗi tài khoản đúng một vai trò (SPA-02)."""

    full_name = models.CharField('Họ tên', max_length=150, blank=True)
    phone = models.CharField('Số điện thoại', max_length=20, blank=True)
    role = models.CharField('Vai trò', max_length=20, choices=Role.choices, default=Role.CUSTOMER)

    class Meta:
        verbose_name = 'Tài khoản'
        verbose_name_plural = 'Tài khoản'

    @property
    def is_staff_role(self):
        return self.role in (Role.RECEPTIONIST, Role.TECHNICIAN, Role.MANAGER)

    def __str__(self):
        return f'{self.username} ({self.role})'
