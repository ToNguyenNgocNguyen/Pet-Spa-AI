from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


import re

from customers.models import Client


class UserSerializer(serializers.ModelSerializer):
    allow_reminders = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'phone', 'email', 'role', 'allow_reminders']
        read_only_fields = ['id', 'username', 'role']

    def get_allow_reminders(self, obj):
        client = getattr(obj, 'client', None)
        return client.allow_reminders if client else None


class MeUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, required=False)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    allow_reminders = serializers.BooleanField(required=False)


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    full_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Tên đăng nhập đã được sử dụng.')
        return value

    def validate_phone(self, value):
        cleaned = re.sub(r'[\s.-]', '', str(value).strip())
        if cleaned.startswith('+84'):
            cleaned = '0' + cleaned[3:]
        if not re.match(r'^[0-9+]{4,15}$', cleaned):
            raise serializers.ValidationError('Số điện thoại không hợp lệ.')
        if User.objects.filter(phone=cleaned).exists():
            raise serializers.ValidationError('Số điện thoại này đã được đăng ký tài khoản. Vui lòng đăng nhập.')
        existing_client = Client.objects.filter(phone=cleaned, is_active=True).first()
        if existing_client and existing_client.user_id:
            raise serializers.ValidationError('Số điện thoại này đã được đăng ký tài khoản. Vui lòng đăng nhập.')
        return cleaned

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        identifier = attrs['username'].strip()
        password = attrs['password']

        # 1. Tìm theo username
        target_user = User.objects.filter(username__iexact=identifier).first()

        # 2. Nếu không tìm thấy, chuẩn hóa và tìm theo số điện thoại
        if not target_user:
            clean_phone = re.sub(r'[\s.-]', '', identifier)
            if clean_phone.startswith('+84'):
                clean_phone = '0' + clean_phone[3:]
            target_user = User.objects.filter(phone=clean_phone).first()
            if not target_user:
                client = Client.objects.filter(
                    phone=clean_phone, is_active=True, user__isnull=False
                ).select_related('user').first()
                if client:
                    target_user = client.user

        # 3. Nếu không tìm thấy và có @, tìm theo email
        if not target_user and '@' in identifier:
            target_user = User.objects.filter(email__iexact=identifier).first()

        auth_username = target_user.username if target_user else identifier
        user = authenticate(username=auth_username, password=password)
        if not user or not user.is_active:
            raise serializers.ValidationError('Tên đăng nhập hoặc mật khẩu không đúng.')
        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField()

    def validate_new_password(self, value):
        try:
            validate_password(value, self.context['request'].user)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate_old_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Mật khẩu hiện tại không đúng.')
        return value


def normalize_phone_number(raw_phone):
    cleaned = re.sub(r'[\s.-]', '', str(raw_phone).strip())
    if cleaned.startswith('+84'):
        cleaned = '0' + cleaned[3:]
    return cleaned


def find_user_by_phone(raw_phone):
    cleaned = normalize_phone_number(raw_phone)
    user = User.objects.filter(phone=cleaned, is_active=True).first()
    if not user:
        client = Client.objects.filter(phone=cleaned, is_active=True, user__isnull=False).select_related('user').first()
        if client:
            user = client.user
    return user, cleaned


class RequestResetOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        user, cleaned = find_user_by_phone(value)
        if not user:
            raise serializers.ValidationError('Số điện thoại này chưa được đăng ký tài khoản trong hệ thống.')
        self.context['target_user'] = user
        self.context['cleaned_phone'] = cleaned
        return cleaned


class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    otp_code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        from .models import PasswordResetOTP

        phone = normalize_phone_number(attrs['phone'])
        otp_code = attrs['otp_code'].strip()

        otp_record = (
            PasswordResetOTP.objects.filter(phone=phone, otp_code=otp_code, is_used=False)
            .order_by('-created_at')
            .first()
        )
        if not otp_record:
            raise serializers.ValidationError({'otp_code': 'Mã OTP không chính xác.'})
        if otp_record.is_expired:
            raise serializers.ValidationError({'otp_code': 'Mã OTP đã hết hạn (chỉ có hiệu lực trong 5 phút).'})

        attrs['otp_record'] = otp_record
        attrs['phone'] = phone
        return attrs


class ResetPasswordWithOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    otp_code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from .models import PasswordResetOTP

        phone = normalize_phone_number(attrs['phone'])
        otp_code = attrs['otp_code'].strip()
        new_password = attrs['new_password']
        confirm_password = attrs['confirm_password']

        if new_password != confirm_password:
            raise serializers.ValidationError({'confirm_password': 'Mật khẩu xác nhận không khớp.'})

        try:
            validate_password(new_password)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})

        otp_record = (
            PasswordResetOTP.objects.filter(phone=phone, otp_code=otp_code, is_used=False)
            .order_by('-created_at')
            .first()
        )
        if not otp_record:
            raise serializers.ValidationError({'otp_code': 'Mã OTP không hợp lệ hoặc đã được sử dụng.'})
        if otp_record.is_expired:
            raise serializers.ValidationError({'otp_code': 'Mã OTP đã hết hạn.'})

        user, _ = find_user_by_phone(phone)
        if not user:
            raise serializers.ValidationError({'phone': 'Không tìm thấy tài khoản người dùng tương ứng.'})

        attrs['user'] = user
        attrs['otp_record'] = otp_record
        return attrs

