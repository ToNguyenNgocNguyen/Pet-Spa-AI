from django.conf import settings
from django.db import models
from django.db.models import F, Q


class BookingStatus(models.TextChoices):
    PENDING = 'pending', 'Chờ duyệt'
    CONFIRMED = 'confirmed', 'Đã xác nhận'
    CHECKED_IN = 'checked_in', 'Đã nhận thú'
    IN_PROGRESS = 'in_progress', 'Đang thực hiện'
    COMPLETED = 'completed', 'Hoàn tất'
    CANCELLED = 'cancelled', 'Đã hủy'


# Lịch còn chiếm chỗ (tài nguyên, thợ, thú, giờ)
ACTIVE_STATUSES = (
    BookingStatus.PENDING, BookingStatus.CONFIRMED,
    BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS,
)


class Booking(models.Model):
    """Lịch hẹn (SPA-09 đến 12, 15). Máy trạng thái ở scheduling/services.py."""

    class Channel(models.TextChoices):
        ONLINE = 'online', 'Khách đặt online'
        COUNTER = 'counter', 'Đặt hộ tại quầy'
        WALK_IN = 'walk_in', 'Khách vãng lai'

    class CancelCode(models.TextChoices):
        REJECTED = 'rejected', 'Spa từ chối'
        CUSTOMER = 'customer_cancelled', 'Khách hủy'
        NO_SHOW = 'no_show', 'Khách không đến'
        OTHER = 'other', 'Khác'

    client = models.ForeignKey('customers.Client', on_delete=models.PROTECT, related_name='bookings')
    pet = models.ForeignKey('customers.Pet', on_delete=models.PROTECT, related_name='bookings')
    package = models.ForeignKey('catalog.Package', null=True, blank=True, on_delete=models.SET_NULL,
                                related_name='bookings')
    staff = models.ForeignKey('spa.StaffProfile', null=True, blank=True, on_delete=models.SET_NULL,
                              related_name='bookings')
    status = models.CharField(max_length=20, choices=BookingStatus.choices, default=BookingStatus.PENDING)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.ONLINE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
                                   related_name='+')
    note_internal = models.TextField('Ghi chú nội bộ', blank=True)
    customer_note = models.TextField('Ghi chú của khách', blank=True)
    cancel_reason = models.TextField(blank=True)
    cancel_reason_code = models.CharField(max_length=20, choices=CancelCode.choices, blank=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    checked_out_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    safety_override_reason = models.TextField(blank=True)
    safety_overridden_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                             on_delete=models.SET_NULL, related_name='+')
    total_price = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Lịch hẹn'
        verbose_name_plural = 'Lịch hẹn'
        ordering = ['start_at']
        constraints = [
            models.CheckConstraint(condition=Q(end_at__gt=F('start_at')), name='booking_end_gt_start'),
            models.CheckConstraint(
                condition=~Q(status='cancelled') | ~Q(cancel_reason=''), name='booking_cancel_needs_reason'),
        ]
        indexes = [models.Index(fields=['start_at', 'status'])]

    def __str__(self):
        return f'#{self.pk} {self.pet_id} {self.start_at:%Y-%m-%d %H:%M} [{self.status}]'


class BookingItem(models.Model):
    """Một dịch vụ trong lịch. Các item của một lịch chạy tuần tự."""

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='items')
    service = models.ForeignKey('catalog.Service', on_delete=models.PROTECT, related_name='+')
    position = models.PositiveSmallIntegerField(default=0)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    resource_type = models.CharField(max_length=20)
    resource = models.ForeignKey('spa.Resource', null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name='booking_items')
    unit_price = models.DecimalField(max_digits=12, decimal_places=0)

    class Meta:
        ordering = ['position']
        constraints = [models.CheckConstraint(condition=Q(end_at__gt=F('start_at')), name='bookingitem_end_gt_start')]
        indexes = [models.Index(fields=['resource_type', 'start_at', 'end_at'])]


class BookingStatusLog(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='logs')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    changed_at = models.DateTimeField(auto_now_add=True)
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ['changed_at', 'id']
