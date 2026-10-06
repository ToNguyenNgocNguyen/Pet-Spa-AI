"""Dịch vụ AI Assistant: Rule engine (R1-R7), Gợi ý KTV, Nhắc tái spa, Chatbot tri thức (05_quy_trinh.md, 07_kien_truc.md).

RÀNG BUỘC CỐT LÕI: Module này KHÔNG import các hàm ghi/sửa Booking và Invoice.
Mọi đề xuất chỉ lưu vào AiSuggestion / RebookReminder; người dùng là người xác nhận cuối cùng.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
import re
import time

from django.db import transaction
from django.utils import timezone

from accounts.models import Role
from catalog.models import Package, PackagePrice, ServiceContraindication
from customers.models import Pet
from notifications.models import notify
from scheduling.models import Booking
from spa.models import StaffProfile, TimeOff

from .models import AiLog, AiSuggestion, KnowledgeChunk, KnowledgeDoc, RebookReminder, RebookRule


# ---------------------------------------------------------------- GỢI Ý GÓI (R1 - R7)

def suggest_packages(pet, user=None):
    """Gợi ý tối đa 3 gói phù hợp nhất với hồ sơ thú cưng bằng bộ luật R1-R7."""
    start_time = time.time()
    if not pet.size_class:
        raise ValueError('Thú cưng chưa có cân nặng/size hợp lệ để báo giá và gợi ý gói.')

    packages = list(Package.objects.filter(is_active=True).prefetch_related('items__service'))
    health_tags = list(pet.health_tags.all())
    tag_ids = [t.id for t in health_tags]

    # Lấy lịch sử đặt dịch vụ gần nhất của bé
    last_booking = Booking.objects.filter(
        pet=pet, status='completed').order_by('-end_at').first()

    scored_packages = []

    for pkg in packages:
        # Kiểm tra xem gói có giá cho size của thú không
        has_price = PackagePrice.objects.filter(package=pkg, size_class=pet.size_class).exists()
        if not has_price:
            continue

        # R1: Loài
        if pkg.species_scope not in ('both', pet.species):
            continue

        # R2: Tuổi tối thiểu
        age_m = pet.age_months or 0
        if pkg.min_age_months > 0 and age_m < pkg.min_age_months:
            continue

        # R3 & R4: Chống chỉ định hóa chất / da liễu theo từng dịch vụ trong gói
        services = [it.service for it in pkg.items.all()]
        service_ids = [s.id for s in services]
        contras = ServiceContraindication.objects.filter(
            service_id__in=service_ids, health_tag_id__in=tag_ids).select_related('service', 'health_tag')

        blocked = False
        block_reasons = []
        warnings = []

        for c in contras:
            if c.severity == ServiceContraindication.Severity.BLOCK:
                blocked = True
                block_reasons.append(f'Dịch vụ "{c.service.name}" bị chặn do thú có thẻ "{c.health_tag.name_vi}": {c.reason_vi}')
            else:
                warnings.append({
                    'severity': 'warn',
                    'health_tag': c.health_tag.name_vi,
                    'service': c.service.name,
                    'reason': c.reason_vi,
                })

        # R3: Bị chặn đỏ -> Loại ngay
        if blocked:
            continue

        # Chấm điểm xuất phát
        score = Decimal(50)
        evidence = []

        # R4: Cảnh báo vàng -> Trừ điểm
        if warnings:
            score -= Decimal(15 * len(warnings))
            evidence.append({
                'rule': 'R4',
                'fact': f'Cần lưu ý chăm sóc đặc biệt do bé có {len(warnings)} cảnh báo da/dị ứng nhẹ.',
            })

        # R5: Phù hợp loại lông
        if pkg.coat_types:
            if pet.coat_type in pkg.coat_types:
                score += Decimal(25)
                evidence.append({
                    'rule': 'R5',
                    'fact': f'Liệu trình được thiết kế chuyên biệt cho chất lông {pet.get_coat_type_display()}.',
                })
            else:
                score -= Decimal(10)
        else:
            score += Decimal(10)

        # R6: Chu kỳ nhắc tái spa khớp
        if last_booking:
            days_since = (timezone.localdate() - timezone.localtime(last_booking.end_at).date()).days
            rule = RebookRule.objects.filter(package=pkg).first()
            if rule and days_since >= rule.interval_days:
                score += Decimal(25)
                evidence.append({
                    'rule': 'R6',
                    'fact': f'Đã {days_since} ngày kể từ lần spa gần nhất, đúng chu kỳ vệ sinh & tạo kiểu {rule.interval_days} ngày.',
                })

        # R7: Thú từng dùng gói này ở lần hoàn tất gần đây
        if last_booking and last_booking.package_id == pkg.id:
            score += Decimal(15)
            evidence.append({
                'rule': 'R7',
                'fact': 'Bé đã quen và thích nghi tốt với gói dịch vụ này ở lần trước.',
            })

        # Sinh lý do đề xuất
        reason_parts = [f'Phù hợp với bé {pet.name} ({pet.breed or pet.get_species_display()}, size {pet.size_class}).']
        for ev in evidence:
            reason_parts.append(ev['fact'])
        if warnings:
            reason_parts.append(f'Lưu ý an toàn: {warnings[0]["reason"]}')

        reason_text = ' '.join(reason_parts)
        confidence = min(Decimal('0.98'), max(Decimal('0.60'), (score / Decimal(100)).quantize(Decimal('0.01'))))

        scored_packages.append({
            'package': pkg,
            'score': score,
            'confidence': confidence,
            'evidence': evidence,
            'warnings': warnings,
            'reason_text': reason_text,
        })

    # Xếp hạng lấy top 3
    scored_packages.sort(key=lambda x: x['score'], reverse=True)
    top3 = scored_packages[:3]

    latency = int((time.time() - start_time) * 1000)

    # Ghi AiLog
    log = AiLog.objects.create(
        kind=AiLog.Kind.SUGGEST_PACKAGE,
        user=user,
        pet=pet,
        input_text=f'Pet: {pet.name}, Breed: {pet.breed}, Coat: {pet.coat_type}, Weight: {pet.weight_kg}kg, Tags: {[t.name_vi for t in health_tags]}',
        output_text=f'Đề xuất {len(top3)} gói: {[x["package"].name for x in top3]}',
        context_refs={'rules_triggered': ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']},
        status=AiLog.Status.OK if top3 else AiLog.Status.REFUSED,
        latency_ms=latency,
    )

    # Ghi AiSuggestion
    suggestions = []
    for rank, item in enumerate(top3, 1):
        sug = AiSuggestion.objects.create(
            suggestion_type=AiSuggestion.Type.PACKAGE,
            pet=pet,
            package=item['package'],
            rank=rank,
            score=item['score'],
            confidence=item['confidence'],
            reason_text=item['reason_text'],
            evidence=item['evidence'],
            warnings=item['warnings'],
            status=AiSuggestion.Status.PROPOSED,
            requested_by=user,
            ai_log=log,
        )
        suggestions.append(sug)

    return suggestions


# ---------------------------------------------------------------- GỢI Ý KỸ THUẬT VIÊN (SUGGEST STAFF)

def suggest_staff(booking, user=None):
    """Gợi ý KTV rảnh, đúng chuyên môn cho lịch hẹn (SPA-30)."""
    start_time = time.time()
    techs = StaffProfile.objects.select_related('user').prefetch_related('specialties').filter(
        user__role=Role.TECHNICIAN, is_active=True)

    items = list(booking.items.select_related('service'))
    needed_spec_ids = {it.service.required_specialty_id for it in items if it.service.required_specialty_id}

    target_date = timezone.localtime(booking.start_at).date()
    target_start_time = timezone.localtime(booking.start_at).time()
    target_end_time = timezone.localtime(booking.end_at).time()

    scored_staff = []

    for st in techs:
        # Kiểm tra ngày nghỉ phép
        if TimeOff.objects.filter(staff=st, date_from__lte=target_date, date_to__gte=target_date).exists():
            continue

        # Kiểm tra ca làm việc
        shift_match = st.shifts.filter(
            weekday=target_date.weekday(),
            start_time__lte=target_start_time,
            end_time__gte=target_end_time).exists()
        if not shift_match:
            continue

        # Kiểm tra trùng lịch hẹn khác
        overlap = Booking.objects.filter(
            staff=st,
            status__in=['pending', 'confirmed', 'checked_in', 'in_progress'],
            start_at__lt=booking.end_at,
            end_at__gt=booking.start_at,
        ).exclude(pk=booking.pk).exists()
        if overlap:
            continue

        # Chấm điểm
        score = Decimal(50)
        evidence = []
        have_spec_ids = set(st.specialties.values_list('id', flat=True))

        if needed_spec_ids:
            if needed_spec_ids.issubset(have_spec_ids):
                score += Decimal(30)
                spec_names = [s.name_vi for s in st.specialties.filter(id__in=needed_spec_ids)]
                evidence.append(f'Thành thạo chuyên môn yêu cầu: {", ".join(spec_names)}.')
            else:
                score -= Decimal(15)

        # Lịch sử từng làm cho bé này
        past_handled = Booking.objects.filter(pet=booking.pet, staff=st, status='completed').count()
        if past_handled > 0:
            score += Decimal(20)
            evidence.append(f'Đã từng chăm sóc bé {booking.pet.name} chu đáo {past_handled} lần trước đây.')

        reason_text = f'{st.user.full_name or st.user.username} có ca làm việc phù hợp khung giờ. ' + ' '.join(evidence)
        confidence = min(Decimal('0.98'), max(Decimal('0.65'), (score / Decimal(100)).quantize(Decimal('0.01'))))

        scored_staff.append({
            'staff': st,
            'score': score,
            'confidence': confidence,
            'evidence': evidence,
            'reason_text': reason_text,
        })

    scored_staff.sort(key=lambda x: x['score'], reverse=True)
    top = scored_staff[:3]

    latency = int((time.time() - start_time) * 1000)

    log = AiLog.objects.create(
        kind=AiLog.Kind.SUGGEST_STAFF,
        user=user,
        pet=booking.pet,
        input_text=f'Booking #{booking.id}, Time: {booking.start_at}, Services: {[i.service.name for i in items]}',
        output_text=f'Đề xuất {len(top)} thợ: {[x["staff"].user.username for x in top]}',
        status=AiLog.Status.OK if top else AiLog.Status.REFUSED,
        latency_ms=latency,
    )

    suggestions = []
    for rank, item in enumerate(top, 1):
        sug = AiSuggestion.objects.create(
            suggestion_type=AiSuggestion.Type.STAFF,
            pet=booking.pet,
            staff=item['staff'],
            target_start_at=booking.start_at,
            rank=rank,
            score=item['score'],
            confidence=item['confidence'],
            reason_text=item['reason_text'],
            evidence=item['evidence'],
            status=AiSuggestion.Status.PROPOSED,
            requested_by=user,
            booking=booking,
            ai_log=log,
        )
        suggestions.append(sug)

    return suggestions


# ---------------------------------------------------------------- NHẮC TÁI SPA (REBOOK REMINDERS)

@transaction.atomic
def generate_rebook_reminders():
    """Tác vụ quét và sinh danh sách nhắc tái spa khi đến hạn (SPA-28)."""
    rules = list(RebookRule.objects.select_related('package'))
    if not rules:
        return []

    # Lấy danh sách thú cưng đang hoạt động và chủ cho phép nhận nhắc
    pets = Pet.objects.filter(is_active=True, client__allow_reminders=True, client__is_active=True).select_related('client')
    today = timezone.localdate()
    created_reminders = []

    for pet in pets:
        # Kiểm tra thú đã có lịch tương lai chưa
        has_future_booking = Booking.objects.filter(
            pet=pet,
            status__in=['pending', 'confirmed', 'checked_in', 'in_progress'],
            start_at__gte=timezone.now(),
        ).exists()
        if has_future_booking:
            continue

        # Lấy lịch hoàn tất gần nhất
        last_b = Booking.objects.filter(pet=pet, status='completed').order_by('-end_at').first()
        if not last_b:
            continue

        # Kiểm tra đã sinh nhắc cho lần này chưa (ràng buộc 1 nhắc / 1 lần hoàn tất)
        if hasattr(last_b, 'rebook_reminder'):
            continue

        last_date = timezone.localtime(last_b.end_at).date()

        # Tìm rule phù hợp
        matching_rule = None
        for r in rules:
            if last_b.package_id and r.package_id == last_b.package_id:
                matching_rule = r
                break
            if r.species and r.species == pet.species:
                matching_rule = r
                break

        if not matching_rule:
            continue

        due_date = last_date + timedelta(days=matching_rule.interval_days)
        if today >= due_date:
            overdue_days = (today - due_date).days
            reason = (
                f'Bé {pet.name} đã hoàn tất {last_b.package.name if last_b.package else "dịch vụ"} '
                f'vào ngày {last_date.strftime("%d/%m/%Y")} ({matching_rule.interval_days} ngày trước). '
                f'Đã đến chu kỳ chăm sóc lông da định kỳ ({matching_rule.note_vi or "định kỳ"}).'
            )
            reminder = RebookReminder.objects.create(
                client=pet.client,
                pet=pet,
                last_booking=last_b,
                rule=matching_rule,
                due_date=due_date,
                overdue_days=overdue_days,
                reason_text=reason,
                status=RebookReminder.Status.SUGGESTED,
            )
            created_reminders.append(reminder)

    return created_reminders


def approve_reminder(reminder, user):
    """Quản lý duyệt gửi thông báo nhắc cho khách (SPA-29)."""
    reminder.status = RebookReminder.Status.SENT
    reminder.approved_by = user
    reminder.approved_at = timezone.now()
    reminder.sent_at = timezone.now()
    reminder.save()

    # Gửi thông báo trong app cho khách
    if reminder.client.user_id:
        notify(
            [reminder.client.user],
            kind='rebook_reminder',
            title=f'🐾 Đã đến lịch chăm sóc định kỳ cho bé {reminder.pet.name}',
            body=reminder.reason_text,
            ref_type='rebook',
            ref_id=reminder.id,
        )
    return reminder


# ---------------------------------------------------------------- CHATBOT TRI THỨC (KNOWLEDGE RETRIEVAL)

def query_knowledge_chat(question, user=None, pet_id=None):
    """Chatbot trả lời dựa trên trích xuất tài liệu SOP & bảng giá (SPA-23)."""
    start_time = time.time()
    clean_q = question.strip()
    words = [w.lower() for w in re.findall(r'\w+', clean_q) if len(w) > 1]

    # Kiểm tra câu hỏi y tế khẩn cấp / chẩn đoán thuốc
    medical_keywords = {'uống thuốc', 'kháng sinh', 'chữa bệnh', 'gãy xương', 'co giật', 'nôn ra máu', 'tiêu chảy nặng'}
    if any(k in clean_q.lower() for k in medical_keywords):
        output = (
            '⚠️ Cảnh báo an toàn sức khỏe thú y: Pet Spa AI chỉ cung cấp dịch vụ tắm, cắt tỉa và chăm sóc vệ sinh thẩm mỹ. '
            'Với các dấu hiệu bệnh lý, cấp cứu hoặc cần dùng thuốc điều trị, vui lòng đưa bé ngay đến bác sĩ thú y hoặc bệnh viện thú y gần nhất!'
        )
        AiLog.objects.create(
            kind=AiLog.Kind.CHAT,
            user=user,
            input_text=clean_q,
            output_text=output,
            status=AiLog.Status.REFUSED,
            latency_ms=int((time.time() - start_time) * 1000),
        )
        return {
            'answer': output,
            'sources': [],
            'warning': 'medical_referral',
        }

    # Tìm kiếm đoạn tri thức phù hợp từ KnowledgeChunk
    chunks = KnowledgeChunk.objects.filter(doc__is_active=True).select_related('doc')
    matched = []

    for c in chunks:
        text_lower = (c.heading + ' ' + c.text).lower()
        score = sum(1 for w in words if w in text_lower)
        if score > 0:
            matched.append((score, c))

    matched.sort(key=lambda x: x[0], reverse=True)
    top_chunks = [c for _, c in matched[:2]]

    if top_chunks:
        excerpt = '\n'.join([f'• {c.heading}: {c.text}' for c in top_chunks])
        answer = f'Dựa theo tài liệu hướng dẫn và quy định của Spa:\n{excerpt}\n\nQuý khách có thể đặt lịch hẹn trước trên hệ thống để được phục vụ chu đáo nhất!'
        sources = [{'doc_title': c.doc.title, 'heading': c.heading} for c in top_chunks]
        status = AiLog.Status.OK
    else:
        answer = (
            'Hiện tại trong tài liệu hướng dẫn chuẩn (SOP) của Spa chưa có thông tin chi tiết về câu hỏi này. '
            'Quý khách vui lòng liên hệ trực tiếp hotline hoặc trao đổi với nhân viên quầy lễ tân để được hỗ trợ cụ thể nhé!'
        )
        sources = []
        status = AiLog.Status.REFUSED

    latency = int((time.time() - start_time) * 1000)

    AiLog.objects.create(
        kind=AiLog.Kind.CHAT,
        user=user,
        input_text=clean_q,
        output_text=answer,
        context_refs={'sources': sources},
        status=status,
        latency_ms=latency,
    )

    return {
        'answer': answer,
        'sources': sources,
    }
