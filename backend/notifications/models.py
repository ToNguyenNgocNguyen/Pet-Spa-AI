from django.conf import settings
from django.db import models


class Notification(models.Model):
    """Thông báo trong ứng dụng (SPA-21, 29). Không có kênh SMS/Zalo."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=40)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    ref_type = models.CharField(max_length=40, blank=True)
    ref_id = models.PositiveIntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Thông báo'
        verbose_name_plural = 'Thông báo'
        ordering = ['-created_at', '-id']


def notify(users, kind, title, body='', ref_type='', ref_id=None):
    """Tạo thông báo cho danh sách người dùng (bỏ trùng, bỏ None)."""
    seen = {u.pk: u for u in users if u is not None}
    Notification.objects.bulk_create([
        Notification(user=u, kind=kind, title=title, body=body, ref_type=ref_type, ref_id=ref_id)
        for u in seen.values()
    ])
