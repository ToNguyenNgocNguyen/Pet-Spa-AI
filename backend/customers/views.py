from django.db.models import Q
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsFrontDesk

from .models import Client, Pet, PetVaccination
from .serializers import (
    ClientSelfSerializer, ClientSerializer, PetSerializer, VaccinationSerializer,
)


class ClientViewSet(viewsets.ModelViewSet):
    """clients — Lễ tân/Quản lý. Xóa mềm bằng is_active=false."""

    serializer_class = ClientSerializer
    permission_classes = [IsFrontDesk]

    def get_queryset(self):
        qs = Client.objects.prefetch_related('pets')
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(full_name__icontains=q) | Q(phone__icontains=q))
        if self.request.query_params.get('include_inactive') != '1':
            qs = qs.filter(is_active=True)
        return qs

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class MyClientView(APIView):
    """clients/me — khách xem/sửa hồ sơ khách của mình."""

    permission_classes = [IsAuthenticated]

    def _client(self, request):
        client = getattr(request.user, 'client', None)
        if request.user.role != Role.CUSTOMER or client is None:
            raise NotFound('Tài khoản này không có hồ sơ khách hàng.')
        return client

    def get(self, request):
        return Response(ClientSelfSerializer(self._client(request)).data)

    def patch(self, request):
        s = ClientSelfSerializer(self._client(request), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class PetViewSet(viewsets.ModelViewSet):
    """pets — Khách: thú của mình. Lễ tân/Quản lý: tất cả.
    Kỹ thuật viên: chỉ xem và sửa (safety_note, health_tags, allergy_note)."""

    serializer_class = PetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        qs = Pet.objects.select_related('client').prefetch_related('health_tags', 'vaccinations')
        if u.role == Role.CUSTOMER:
            qs = qs.filter(client__user=u)
        elif u.role == Role.TECHNICIAN:
            # Kỹ thuật viên chỉ thấy thú thuộc lịch được giao cho mình (chưa kết thúc).
            qs = qs.filter(
                bookings__staff__user=u,
                bookings__status__in=['confirmed', 'checked_in', 'in_progress', 'completed'],
            ).distinct()
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(client__full_name__icontains=q))
        client_id = self.request.query_params.get('client')
        if client_id and u.role != Role.CUSTOMER:
            qs = qs.filter(client_id=client_id)
        if self.request.query_params.get('include_inactive') != '1':
            qs = qs.filter(is_active=True)
        return qs

    def _forbid_technician(self, request):
        if request.user.role == Role.TECHNICIAN:
            raise PermissionDenied()

    def create(self, request, *args, **kwargs):
        self._forbid_technician(request)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._forbid_technician(request)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        u = self.request.user
        if u.role == Role.CUSTOMER:
            client = getattr(u, 'client', None)
            if client is None:
                raise NotFound('Tài khoản này không có hồ sơ khách hàng.')
            serializer.save(client=client)
        else:
            if not serializer.validated_data.get('client'):
                raise serializers.ValidationError({'client': 'Bắt buộc chọn khách hàng.'})
            serializer.save()

    def perform_update(self, serializer):
        # Khách không được chuyển thú sang khách khác
        if self.request.user.role == Role.CUSTOMER:
            serializer.save(client=serializer.instance.client)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

    @action(detail=True, methods=['get', 'post'], url_path='vaccinations')
    def vaccinations(self, request, pk=None):
        pet = self.get_object()
        if request.method == 'GET':
            return Response(VaccinationSerializer(pet.vaccinations.all(), many=True).data)
        self._forbid_technician(request)
        s = VaccinationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if PetVaccination.objects.filter(
            pet=pet, vaccine_name=s.validated_data['vaccine_name'],
            date_given=s.validated_data['date_given'],
        ).exists():
            raise serializers.ValidationError({'vaccine_name': 'Mũi tiêm này đã được ghi nhận.'})
        s.save(pet=pet)
        return Response(s.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'vaccinations/(?P<vid>\d+)')
    def delete_vaccination(self, request, pk=None, vid=None):
        pet = self.get_object()
        self._forbid_technician(request)
        deleted, _ = PetVaccination.objects.filter(pet=pet, pk=vid).delete()
        if not deleted:
            raise NotFound()
        return Response(status=status.HTTP_204_NO_CONTENT)
