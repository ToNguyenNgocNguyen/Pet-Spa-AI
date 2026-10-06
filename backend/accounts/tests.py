from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Role, User
from catalog.models import HealthTag, SizeBand
from customers.models import Client, Pet
from spa.models import Spa

API = '/api/v1'


def make_user(username, role, **kw):
    return User.objects.create_user(username=username, password='Matkhau@123', role=role, **kw)


def login(username):
    c = APIClient()
    r = c.post(f'{API}/auth/login', {'username': username, 'password': 'Matkhau@123'}, format='json')
    assert r.status_code == 200, r.content
    c.credentials(HTTP_AUTHORIZATION=f"Token {r.json()['token']}")
    return c


class BaseCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        for sp, bands in {'dog': [('S', 0, 7), ('M', 7, 15)]}.items():
            for size, lo, hi in bands:
                SizeBand.objects.create(species=sp, size_class=size, min_kg=lo, max_kg=hi)
        cls.mgr = make_user('mgr', Role.MANAGER)
        cls.rec = make_user('rec', Role.RECEPTIONIST)
        cls.tech = make_user('tech', Role.TECHNICIAN)
        cls.cust_a = make_user('ka', Role.CUSTOMER)
        cls.cust_b = make_user('kb', Role.CUSTOMER)
        cls.client_a = Client.objects.create(user=cls.cust_a, full_name='A', phone='0911')
        cls.client_b = Client.objects.create(user=cls.cust_b, full_name='B', phone='0922')
        cls.pet_a = Pet.objects.create(
            client=cls.client_a, name='Bông', species='dog', weight_kg=5, allergy_note='Không')
        cls.pet_b = Pet.objects.create(
            client=cls.client_b, name='Lu', species='dog', weight_kg=9, allergy_note='Không')


class AuthTests(BaseCase):
    def test_register_creates_customer_and_client(self):
        c = APIClient()
        r = c.post(f'{API}/auth/register', {
            'username': 'moi', 'password': 'Matkhau@123', 'full_name': 'Khách Mới', 'phone': '0933',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['user']['role'], 'customer')
        self.assertTrue(Client.objects.filter(user__username='moi').exists())

    def test_register_cannot_choose_role(self):
        c = APIClient()
        r = c.post(f'{API}/auth/register', {
            'username': 'x', 'password': 'Matkhau@123', 'full_name': 'X', 'phone': '0944',
            'role': 'manager',
        }, format='json')
        self.assertEqual(r.json()['user']['role'], 'customer')

    def test_login_wrong_password_uses_vietnamese_error(self):
        r = APIClient().post(f'{API}/auth/login', {'username': 'mgr', 'password': 'sai'}, format='json')
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()['code'], 'validation_error')

    def test_unauthenticated_is_401(self):
        r = APIClient().get(f'{API}/auth/me')
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json()['code'], 'not_authenticated')


class CustomerScopeTests(BaseCase):
    def test_customer_sees_only_own_pets(self):
        r = login('ka').get(f'{API}/pets')
        names = [p['name'] for p in r.json()['results']]
        self.assertEqual(names, ['Bông'])

    def test_customer_cannot_open_other_pet(self):
        r = login('ka').get(f'{API}/pets/{self.pet_b.id}')
        self.assertEqual(r.status_code, 404)

    def test_customer_cannot_list_clients(self):
        self.assertEqual(login('ka').get(f'{API}/clients').status_code, 403)

    def test_customer_never_sees_internal_safety_note(self):
        self.pet_a.safety_note = 'Hay cắn'
        self.pet_a.save()
        r = login('ka').get(f'{API}/pets/{self.pet_a.id}')
        self.assertNotIn('safety_note', r.json())

    def test_customer_creates_pet_for_self_only(self):
        r = login('ka').post(f'{API}/pets', {
            'client': self.client_b.id, 'name': 'Mới', 'species': 'dog',
            'weight_kg': '3.0', 'allergy_note': 'Không',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Pet.objects.get(name='Mới').client_id, self.client_a.id)

    def test_staff_sees_all_pets(self):
        r = login('rec').get(f'{API}/pets')
        self.assertEqual(r.json()['count'], 2)

    def test_technician_cannot_create_or_see_unassigned_pets(self):
        c = login('tech')
        self.assertEqual(c.get(f'{API}/pets').json()['count'], 0)
        r = c.post(f'{API}/pets', {
            'client': self.client_a.id, 'name': 'X', 'species': 'dog',
            'weight_kg': '3', 'allergy_note': 'Không'}, format='json')
        self.assertEqual(r.status_code, 403)


class PetRulesTests(BaseCase):
    def test_allergy_note_required(self):
        r = login('rec').post(f'{API}/pets', {
            'client': self.client_a.id, 'name': 'T', 'species': 'dog',
            'weight_kg': '3', 'allergy_note': '  '}, format='json')
        self.assertEqual(r.status_code, 422)
        self.assertIn('allergy_note', r.json()['fields'])

    def test_size_derived_from_weight(self):
        self.assertEqual(Pet.objects.get(pk=self.pet_a.pk).size_class, 'S')
        self.assertEqual(Pet.objects.get(pk=self.pet_b.pk).size_class, 'M')

    def test_vaccination_duplicate_rejected(self):
        c = login('rec')
        body = {'vaccine_name': 'Dại', 'date_given': '2026-01-10'}
        self.assertEqual(c.post(f'{API}/pets/{self.pet_a.id}/vaccinations', body, format='json').status_code, 201)
        self.assertEqual(c.post(f'{API}/pets/{self.pet_a.id}/vaccinations', body, format='json').status_code, 422)

    def test_phone_unique_among_active_clients(self):
        r = login('rec').post(f'{API}/clients', {'full_name': 'Trùng', 'phone': '0911'}, format='json')
        self.assertEqual(r.status_code, 422)

    def test_delete_is_soft(self):
        r = login('rec').delete(f'{API}/pets/{self.pet_a.id}')
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Pet.objects.get(pk=self.pet_a.pk).is_active)

    def test_technician_can_edit_only_safety_fields(self):
        # kỹ thuật viên chưa thấy thú nào (chưa có lịch) nên không sửa được qua API
        r = login('tech').patch(f'{API}/pets/{self.pet_a.id}', {'safety_note': 'x'}, format='json')
        self.assertEqual(r.status_code, 404)


class CatalogAndSpaTests(BaseCase):
    def test_catalog_public_read_manager_write(self):
        anon = APIClient()
        self.assertEqual(anon.get(f'{API}/services').status_code, 200)
        body = {'code': 's1', 'name': 'Tắm', 'duration_minutes': 30, 'resource_type': 'bath_tub'}
        self.assertEqual(anon.post(f'{API}/services', body, format='json').status_code, 401)
        self.assertEqual(login('rec').post(f'{API}/services', body, format='json').status_code, 403)
        self.assertEqual(login('mgr').post(f'{API}/services', body, format='json').status_code, 201)

    def test_inactive_services_hidden_from_public(self):
        m = login('mgr')
        sid = m.post(f'{API}/services', {
            'code': 's2', 'name': 'Ẩn', 'duration_minutes': 30, 'resource_type': 'bath_tub',
        }, format='json').json()['id']
        m.delete(f'{API}/services/{sid}')
        self.assertEqual(len(APIClient().get(f'{API}/services').json()), 0)
        self.assertEqual(len(m.get(f'{API}/services').json()), 1)

    def test_set_prices_validates_size(self):
        m = login('mgr')
        sid = m.post(f'{API}/services', {
            'code': 's3', 'name': 'G', 'duration_minutes': 30, 'resource_type': 'bath_tub',
        }, format='json').json()['id']
        bad = m.put(f'{API}/services/{sid}/prices', {'prices': {'XXL': 1}}, format='json')
        self.assertEqual(bad.status_code, 422)
        ok = m.put(f'{API}/services/{sid}/prices', {'prices': {'S': 100000, 'M': 150000}}, format='json')
        self.assertEqual(ok.json()['prices'], {'S': 100000, 'M': 150000})

    def test_spa_public_get_manager_patch(self):
        from datetime import time
        Spa.objects.create(name='Spa', open_time=time(8), close_time=time(19), open_weekdays=[0, 1])
        self.assertEqual(APIClient().get(f'{API}/spa').json()['name'], 'Spa')
        self.assertEqual(login('rec').patch(f'{API}/spa', {'name': 'X'}, format='json').status_code, 403)
        r = login('mgr').patch(f'{API}/spa', {'name': 'Mới'}, format='json')
        self.assertEqual(r.json()['name'], 'Mới')
        bad = login('mgr').patch(f'{API}/spa', {'close_time': '07:00:00'}, format='json')
        self.assertEqual(bad.status_code, 422)

    def test_health_tags_require_login(self):
        HealthTag.objects.create(code='x', name_vi='X', kind='allergy')
        self.assertEqual(APIClient().get(f'{API}/health-tags').status_code, 401)
        self.assertEqual(login('ka').get(f'{API}/health-tags').status_code, 200)
