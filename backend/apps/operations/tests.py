from datetime import date

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.expeditions.models import Expedition
from apps.reservations.models import Reservation


@override_settings(DEBUG=True, ADMIN_EMAIL="admin@example.com", ADMIN_PASSWORD="safe-test-password")
class OperationsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expedition = Expedition.objects.create(name="Rio Araguaia", destination="Luiz Alves/GO", starts_at=date(2026, 10, 18), ends_at=date(2026, 10, 22), capacity=12, price_per_person_cents=249000, deposit_cents=120000, status=Expedition.Status.PUBLISHED)

    def login(self):
        response = self.client.post("/api/operations/login/", {"email": "admin@example.com", "password": "safe-test-password"}, format="json")
        self.assertEqual(response.status_code, 200)
        return {"HTTP_AUTHORIZATION": f"Bearer {response.data['token']}"}

    def test_private_endpoints_require_login(self):
        self.assertEqual(self.client.get("/api/operations/overview/").status_code, 403)
        self.assertEqual(self.client.get("/api/operations/reservations/").status_code, 403)

    def test_overview_and_expedition_management(self):
        auth = self.login()
        overview = self.client.get("/api/operations/overview/", **auth)
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(len(overview.data["upcoming_expeditions"]), 1)
        created = self.client.post("/api/operations/expeditions/", {"name": "Rio Cristalino", "destination": "GO", "starts_at": "2027-05-01", "ends_at": "2027-05-04", "capacity": 8, "price_per_person_cents": 300000, "deposit_cents": 100000, "status": "DRAFT"}, format="json", **auth)
        self.assertEqual(created.status_code, 201)
        updated = self.client.patch(f"/api/operations/expeditions/{created.data['id']}/", {"status": "PUBLISHED"}, format="json", **auth)
        self.assertEqual(updated.data["status"], "PUBLISHED")

    def test_development_cleanup_preserves_expeditions(self):
        customer = Customer.objects.create(cpf="52998224725", full_name="João", email="joao@example.com", phone="62999999999")
        Reservation.objects.create(customer=customer, expedition=self.expedition, participant_count=1, unit_price_cents=249000, total_price_cents=249000, deposit_cents=120000)
        response = self.client.post("/api/operations/dev/clear-data/", format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Customer.objects.count(), 0)
        self.assertEqual(Reservation.objects.count(), 0)
        self.assertEqual(Expedition.objects.count(), 1)
