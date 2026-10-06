from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsFrontDesk, IsManager
from catalog.models import Package, Service, ServiceContraindication
from customers.models import Pet
from scheduling.models import Booking

from . import services
from .models import AiLog, AiSuggestion, KnowledgeChunk, KnowledgeDoc, RebookReminder, RebookRule


# ---------------------------------------------------------------- SERIALIZERS

class AiSuggestionSerializer(serializers.ModelSerializer):
    package_name = serializers.CharField(source='package.name', read_only=True, default=None)
    staff_name = serializers.SerializerMethodField()
    package_info = serializers.SerializerMethodField()

    class Meta:
        model = AiSuggestion
        fields = ['id', 'suggestion_type', 'pet', 'package', 'package_name', 'package_info',
                  'staff', 'staff_name', 'rank', 'score', 'confidence', 'reason_text',
                  'evidence', 'warnings', 'status', 'created_at']

    def get_staff_name(self, s):
        return str(s.staff) if s.staff_id else None

    def get_package_info(self, s):
        if not s.package:
            return None
        return {
            'id': s.package.id,
            'name': s.package.name,
            'description': s.package.description,
            'items': [it.service.name for it in s.package.items.select_related('service')],
            'prices': s.package.prices.values('size_class', 'price'),
        }


class RebookReminderSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_phone = serializers.CharField(source='client.phone', read_only=True)
    pet_name = serializers.CharField(source='pet.name', read_only=True)
    package_name = serializers.SerializerMethodField()

    class Meta:
        model = RebookReminder
        fields = ['id', 'client', 'client_name', 'client_phone', 'pet', 'pet_name', 'last_booking',
                  'package_name', 'due_date', 'overdue_days', 'reason_text', 'status', 'approved_at', 'sent_at']

    def get_package_name(self, r):
        return r.last_booking.package.name if r.last_booking.package_id else 'Dịch vụ lẻ'


class AiLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    pet_name = serializers.CharField(source='pet.name', read_only=True, default=None)

    class Meta:
        model = AiLog
        fields = ['id', 'kind', 'session_id', 'user', 'user_name', 'pet', 'pet_name',
                  'input_text', 'output_text', 'context_refs', 'engine', 'status', 'latency_ms', 'created_at']

    def get_user_name(self, lg):
        if not lg.user:
            return 'Khách vãng lai'
        return lg.user.full_name or lg.user.username


class KnowledgeChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeChunk
        fields = ['id', 'position', 'heading', 'text']


class KnowledgeDocSerializer(serializers.ModelSerializer):
    chunks = KnowledgeChunkSerializer(many=True, read_only=True)

    class Meta:
        model = KnowledgeDoc
        fields = ['id', 'title', 'doc_type', 'file', 'text_content', 'version', 'is_active', 'created_at', 'chunks']


class ServiceContraindicationSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)
    health_tag_name = serializers.CharField(source='health_tag.name_vi', read_only=True)

    class Meta:
        model = ServiceContraindication
        fields = ['id', 'service', 'service_name', 'health_tag', 'health_tag_name', 'severity', 'reason_vi']


# ---------------------------------------------------------------- VIEWS

import json
from django.utils import timezone


def get_request_data(request):
    data = request.data
    if isinstance(data, str):
        try:
            return json.loads(data)
        except Exception:
            return {}
    return data if isinstance(data, dict) else {}


class AiPackageSuggestionView(APIView):
    """POST /ai/suggest-packages: Gợi ý tối đa 3 gói cho thú cưng bằng bộ luật R1-R7 (SPA-25, 26)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = get_request_data(request)
        pet_id = data.get('pet') or data.get('pet_id')
        if not pet_id:
            raise ValidationError({'pet': 'Bắt buộc truyền mã thú cưng.'})
        try:
            pet = Pet.objects.get(pk=pet_id)
        except Pet.DoesNotExist:
            raise NotFound('Không tìm thấy thú cưng.')

        if request.user.role == Role.CUSTOMER and pet.client.user_id != request.user.id:
            raise NotFound('Không tìm thấy thú cưng.')

        try:
            suggestions = services.suggest_packages(pet, request.user)
            return Response(AiSuggestionSerializer(suggestions, many=True).data)
        except ValueError as e:
            raise ValidationError({'pet': str(e)})


class AiStaffSuggestionView(APIView):
    """POST /ai/suggest-staff: Gợi ý KTV phù hợp cho lịch hẹn (SPA-30)."""

    permission_classes = [IsFrontDesk]

    def post(self, request):
        data = get_request_data(request)
        booking_id = data.get('booking') or data.get('booking_id')
        if not booking_id:
            raise ValidationError({'booking': 'Bắt buộc truyền mã lịch hẹn.'})
        try:
            booking = Booking.objects.get(pk=booking_id)
        except Booking.DoesNotExist:
            raise NotFound('Không tìm thấy lịch hẹn.')

        suggestions = services.suggest_staff(booking, request.user)
        return Response(AiSuggestionSerializer(suggestions, many=True).data)


class AiSuggestionDecideView(APIView):
    """POST /ai/suggestions/{id}/decide: Người dùng bấm Chấp nhận hoặc Từ chối gợi ý."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        try:
            sug = AiSuggestion.objects.get(pk=pk)
        except AiSuggestion.DoesNotExist:
            raise NotFound()

        data = get_request_data(request)
        action = data.get('action')
        if action is None and 'accepted' in data:
            action = 'accept' if data['accepted'] else 'reject'

        if action not in ('accept', 'reject'):
            raise ValidationError({'action': 'Hành động phải là accept hoặc reject.'})

        sug.status = AiSuggestion.Status.ACCEPTED if action == 'accept' else AiSuggestion.Status.REJECTED
        sug.decided_by = request.user
        sug.decided_at = timezone.now()
        sug.save()
        return Response(AiSuggestionSerializer(sug).data)


class RebookReminderViewSet(viewsets.ModelViewSet):
    """rebook-reminders: Danh sách và duyệt nhắc tái spa (SPA-28, 29)."""

    serializer_class = RebookReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        qs = RebookReminder.objects.select_related('client', 'pet', 'last_booking__package')
        if u.role == Role.CUSTOMER:
            return qs.filter(client__user=u, status=RebookReminder.Status.SENT)
        st = self.request.query_params.get('status')
        if st:
            qs = qs.filter(status=st)
        return qs

    @action(detail=False, methods=['post'], url_path='refresh')
    def refresh_reminders(self, request):
        if request.user.role not in (Role.RECEPTIONIST, Role.MANAGER):
            raise PermissionDenied()
        created = services.generate_rebook_reminders()
        return Response({'message': f'Đã quét và đề xuất {len(created)} lượt nhắc tái spa mới.', 'created_count': len(created)})

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_reminders(self, request):
        return self.refresh_reminders(request)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.user.role not in (Role.RECEPTIONIST, Role.MANAGER):
            raise PermissionDenied()
        reminder = services.approve_reminder(self.get_object(), request.user)
        return Response(RebookReminderSerializer(reminder).data)

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        if request.user.role not in (Role.RECEPTIONIST, Role.MANAGER):
            raise PermissionDenied()
        reminder = self.get_object()
        reminder.status = RebookReminder.Status.DISMISSED
        reminder.save()
        return Response(RebookReminderSerializer(reminder).data)


class AiChatView(APIView):
    """POST /ai/chat: Chatbot tư vấn dựa trên trích xuất tri thức (SPA-23)."""

    permission_classes = [AllowAny]

    def post(self, request):
        data = get_request_data(request)
        question = data.get('question', '').strip()
        if not question:
            raise ValidationError({'question': 'Nội dung câu hỏi không được để trống.'})

        user = request.user if request.user.is_authenticated else None
        res = services.query_knowledge_chat(question, user)
        return Response(res)


class AiLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """ai/logs: Nhật ký hoạt động của AI (SPA-31). Dành cho Quản lý."""

    serializer_class = AiLogSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        qs = AiLog.objects.select_related('user', 'pet')
        k = self.request.query_params.get('kind')
        if k:
            qs = qs.filter(kind=k)
        return qs


class KnowledgeDocViewSet(viewsets.ModelViewSet):
    """ai/knowledge-docs: Quản lý tài liệu SOP & Bảng giá (SPA-24)."""

    serializer_class = KnowledgeDocSerializer
    permission_classes = [IsManager]
    queryset = KnowledgeDoc.objects.prefetch_related('chunks').all()

    def perform_create(self, serializer):
        doc = serializer.save(uploaded_by=self.request.user)
        # Tự động tách đoạn nếu có text_content
        if doc.text_content:
            paragraphs = [p.strip() for p in doc.text_content.split('\n\n') if p.strip()]
            KnowledgeChunk.objects.bulk_create([
                KnowledgeChunk(doc=doc, position=i, heading=p.split('\n')[0][:100], text=p)
                for i, p in enumerate(paragraphs)
            ])


class ServiceContraindicationViewSet(viewsets.ModelViewSet):
    """service-contraindications: Ma trận dịch vụ - chống chỉ định (SPA-27)."""

    serializer_class = ServiceContraindicationSerializer
    queryset = ServiceContraindication.objects.select_related('service', 'health_tag').all()

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsManager()]
