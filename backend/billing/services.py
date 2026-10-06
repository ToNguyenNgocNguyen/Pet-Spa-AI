from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.errors import Conflict

from .models import Invoice, InvoiceLine


def _next_invoice_no():
    today = timezone.localdate()
    prefix = f'HD-{today:%Y%m%d}-'
    n = Invoice.objects.filter(invoice_no__startswith=prefix).count() + 1
    while Invoice.objects.filter(invoice_no=f'{prefix}{n:03d}').exists():
        n += 1
    return f'{prefix}{n:03d}'


def create_invoice(booking):
    """Sinh hóa đơn unpaid từ lịch đã hoàn tất; dòng sao chép từ BookingItem (giá đã chốt lúc đặt)."""
    if booking.status != 'completed':
        raise Conflict('invalid_transition', 'Chỉ lập hóa đơn cho lịch đã hoàn tất.')
    if hasattr(booking, 'invoice'):
        return booking.invoice
    items = list(booking.items.select_related('service'))
    subtotal = sum(i.unit_price for i in items)
    inv = Invoice.objects.create(
        invoice_no=_next_invoice_no(), booking=booking, subtotal=subtotal, total=subtotal)
    InvoiceLine.objects.bulk_create([
        InvoiceLine(invoice=inv, description=i.service.name, quantity=1,
                    unit_price=i.unit_price, amount=i.unit_price) for i in items])
    return inv


@transaction.atomic
def pay(invoice, user, method):
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != Invoice.Status.UNPAID:
        raise Conflict('invalid_invoice_state', 'Chỉ thu được hóa đơn chưa thu.')
    if method not in Invoice.Method.values:
        raise ValidationError({'payment_method': 'Hình thức thanh toán không hợp lệ.'})
    invoice.status, invoice.payment_method = Invoice.Status.PAID, method
    invoice.paid_at, invoice.received_by = timezone.now(), user
    invoice.save()
    return invoice


@transaction.atomic
def void(invoice, user, reason):
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status == Invoice.Status.VOID:
        raise Conflict('invalid_invoice_state', 'Hóa đơn đã hủy.')
    if not (reason or '').strip():
        raise ValidationError({'reason': 'Bắt buộc nhập lý do hủy.'})
    invoice.status, invoice.void_reason = Invoice.Status.VOID, reason
    invoice.save()
    return invoice
