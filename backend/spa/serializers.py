from rest_framework import serializers

from .models import Spa


class SpaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spa
        fields = [
            'name', 'phone', 'email', 'address', 'logo', 'open_time', 'close_time',
            'open_weekdays', 'slot_minutes', 'cancel_cutoff_hours', 'timezone',
        ]

    def validate_open_weekdays(self, value):
        if not isinstance(value, list) or any(not isinstance(d, int) or d < 0 or d > 6 for d in value):
            raise serializers.ValidationError('Ngày mở cửa phải là danh sách số từ 0 đến 6.')
        return sorted(set(value))

    def validate(self, attrs):
        open_t = attrs.get('open_time', getattr(self.instance, 'open_time', None))
        close_t = attrs.get('close_time', getattr(self.instance, 'close_time', None))
        if open_t and close_t and close_t <= open_t:
            raise serializers.ValidationError({'close_time': 'Giờ đóng cửa phải sau giờ mở cửa.'})
        return attrs
