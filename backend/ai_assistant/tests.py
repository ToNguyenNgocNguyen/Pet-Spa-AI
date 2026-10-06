from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from customers.models import Pet
from notifications.models import Notification
from scheduling.models import Booking

from .models import AiLog, AiSuggestion, KnowledgeDoc, RebookReminder

API = '/api/v1'


class AiAssistantTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_demo', verbosity=0)
        cls.users = {u.username: u for u in User.objects.all()}
        cls.bong = Pet.objects.get(name='Bông')  # Poodle dị ứng hương liệu
        cls.lu = Pet.objects.get(name='Lu')      # Poodle hoàn tất cách đây 56 ngày

    def as_user(self, username):
        c = APIClient()
        c.force_authenticate(self.users[username])
        return c

    def test_suggest_packages_blocks_contraindicated_scented_bath(self):
        # Bông có thẻ fragrance_allergy -> Gói VIP có bath_scented bị BLOCK
        r = self.as_user('khach1').post(f'{API}/ai/suggest-packages', {'pet': self.bong.id}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        pkg_names = [s['package_name'] for s in r.data]
        self.assertNotIn('Gói VIP', pkg_names)
        self.assertIn('Gói cơ bản', pkg_names)
        self.assertTrue(AiLog.objects.filter(kind='suggest_package').exists())
        self.assertTrue(AiSuggestion.objects.filter(pet=self.bong, suggestion_type='package').exists())

    def test_suggest_packages_for_dog_does_not_suggest_cat_care(self):
        r = self.as_user('khach1').post(f'{API}/ai/suggest-packages', {'pet': self.bong.id}, format='json')
        self.assertEqual(r.status_code, 200)
        pkg_names = [s['package_name'] for s in r.data]
        self.assertNotIn('Gói chăm sóc mèo', pkg_names)

    def test_suggest_staff_recommends_qualified_available_technician(self):
        b = Booking.objects.filter(status='pending').first()
        r = self.as_user('letan').post(f'{API}/ai/suggest-staff', {'booking': b.id}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(len(r.data) > 0)
        self.assertTrue(all(s['staff_name'] for s in r.data))

    def test_rebook_reminders_generated_and_approved_by_manager(self):
        # Lu hoàn tất 56 ngày trước (> 45 ngày) -> có RebookReminder
        reminders = RebookReminder.objects.filter(pet=self.lu)
        self.assertTrue(reminders.exists())
        rem = reminders.first()
        self.assertEqual(rem.status, 'suggested')

        # Quản lý duyệt nhắc -> gửi Notification trong app cho chủ
        r = self.as_user('quanly').post(f'{API}/rebook-reminders/{rem.id}/approve')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['status'], 'sent')
        if rem.client.user:
            self.assertTrue(Notification.objects.filter(user=rem.client.user, kind='rebook_reminder').exists())

    def test_knowledge_chatbot_answers_from_sop(self):
        c = APIClient()  # Chatbot công khai không cần đăng nhập
        r = c.post(f'{API}/ai/chat', {'question': 'Quy định an toàn bàn cắt tỉa như thế nào?'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('bàn cắt tỉa', r.data['answer'].lower())
        self.assertTrue(len(r.data['sources']) > 0)

    def test_knowledge_chatbot_refuses_medical_prescription(self):
        c = APIClient()
        r = c.post(f'{API}/ai/chat', {'question': 'Chó bị nôn ra máu uống thuốc kháng sinh gì?'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('bác sĩ thú y', r.data['answer'])
        self.assertEqual(r.data.get('warning'), 'medical_referral')
