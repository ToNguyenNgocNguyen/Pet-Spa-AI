from django.db import transaction
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from customers.models import Client

from .models import Role, User
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)


def _auth_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {'token': token.key, 'user': UserSerializer(user).data}


class RegisterView(APIView):
    """POST auth/register — khách tự đăng ký (tạo User role customer + Client)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        user = User.objects.create_user(
            username=d['username'], password=d['password'], email=d.get('email', ''),
            full_name=d['full_name'], phone=d['phone'], role=Role.CUSTOMER,
        )
        Client.objects.create(
            user=user, full_name=d['full_name'], phone=d['phone'],
            email=d.get('email', ''), source=Client.Source.ONLINE,
        )
        return Response(_auth_payload(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(_auth_payload(s.validated_data['user']))


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @transaction.atomic
    def patch(self, request):
        s = MeUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        allow = d.pop('allow_reminders', None)
        user = request.user
        for k, v in d.items():
            setattr(user, k, v)
        user.save()
        client = getattr(user, 'client', None)
        if client:
            for k in ('full_name', 'phone', 'email'):
                if k in d:
                    setattr(client, k, d[k])
            if allow is not None:
                client.allow_reminders = allow
            client.save()
        return Response(UserSerializer(user).data)


class ChangePasswordView(APIView):
    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        request.user.set_password(s.validated_data['new_password'])
        request.user.save()
        Token.objects.filter(user=request.user).delete()
        return Response(_auth_payload(request.user))
