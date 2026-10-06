from django.conf import settings
from django.db import models
from django.db.models import Q


class Invoice(models.Model):
    """Hóa đơn (SPA-19). Chỉ sinh khi lịch hoàn tất; Pha 1–2: total = subtotal."""

    class Status(models.TextChoices):
        UNPAID = 'unpaid', 'Chưa thu'
        PAID = 'paid', 'Đã thu'
        VOID = 'void', 'Đã hủy'

    class Method(models.TextChoices):
        CASH = 'cash', 'Tiền mặt'
        TRANSFER = 'transfer', 'Chuyển khoản'

    invoice_no = models.CharField(max_length=30, unique=True)
    booking = models.OneToOneField('scheduling.Booking', on_delete=models.PROTECT, related_name='invoice')
    subtotal = models.DecimalField(max_digits=12, decimal_places=0)
    total = models.DecimalField(max_digits=12, decimal_places=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UNPAID)
    payment_method = models.CharField(max_length=10, choices=Method.choices, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='+')
    void_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Hóa đơn'
        verbose_name_plural = 'Hóa đơn'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=~Q(status='paid') | (~Q(payment_method='') & Q(paid_at__isnull=False)
                                               & Q(received_by__isnull=False)),
                name='invoice_paid_needs_payment_info'),
        ]

    def __str__(self):
        return self.invoice_no


class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='lines')
    description = models.CharField(max_length=200)
    quantity = models.PositiveSmallIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=0)
    amount = models.DecimalField(max_digits=12, decimal_places=0)

    class Meta:
        ordering = ['id']
