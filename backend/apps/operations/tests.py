from datetime import date, timedelta

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from django.utils import timezone

from apps.customers.models import Customer
from apps.expeditions.models import Expedition, ExpeditionProduct, Product
from apps.reservations.models import ParticipantProductChoice, Reservation, ReservationParticipant


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

    def test_consolidation_counts_only_eligible_reservations_and_exports(self):
        auth = self.login()
        product = Product.objects.create(name="Água operacional", unit="garrafa", package_size=6)
        offer = ExpeditionProduct.objects.create(expedition=self.expedition, product=product, standard_quantity_per_participant=2)
        customer = Customer.objects.create(cpf="52998224725", full_name="João", email="ops@example.com", phone="62999999999")
        valid = Reservation.objects.create(customer=customer, expedition=self.expedition, participant_count=1, status=Reservation.Status.CONFIRMED, unit_price_cents=1, total_price_cents=1, deposit_cents=1)
        excluded = Reservation.objects.create(customer=customer, expedition=self.expedition, participant_count=1, status=Reservation.Status.HELD, unit_price_cents=1, total_price_cents=1, deposit_cents=1)
        for reservation in (valid, excluded):
            participant = ReservationParticipant.objects.create(reservation=reservation, full_name="Pessoa")
            ParticipantProductChoice.objects.create(participant=participant, expedition_product=offer, selected=True)
        base = f"/api/operations/expeditions/{self.expedition.id}/consolidation"
        response = self.client.get(base + "/", **auth)
        self.assertEqual(response.data["items"][0]["people"], 1)
        self.assertEqual(response.data["items"][0]["total"], 2)
        self.assertEqual(response.data["items"][0]["details"][0]["customer_name"], "João")
        self.assertEqual(self.client.get(base + ".csv", **auth).status_code, 200)

    def test_configuration_invalid_command_is_atomic_and_manual_payment_is_audited(self):
        auth = self.login()
        original = self.expedition.departure_location
        invalid = self.client.put(f"/api/operations/expeditions/{self.expedition.id}/configuration/", {"departure_location": "Mudaria", "offers": [{"product_id": "00000000-0000-0000-0000-000000000000", "standard_quantity_per_participant": 0}]}, format="json", **auth)
        self.assertEqual(invalid.status_code, 400)
        self.expedition.refresh_from_db()
        self.assertEqual(self.expedition.departure_location, original)
        customer = Customer.objects.create(cpf="52998224725", full_name="João", email="manual@example.com", phone="62999999999")
        reservation = Reservation.objects.create(customer=customer, expedition=self.expedition, participant_count=1, status=Reservation.Status.HELD, held_until=timezone.now()+timedelta(minutes=5), unit_price_cents=1000, total_price_cents=1000, deposit_cents=300)
        paid = self.client.post(f"/api/operations/reservations/{reservation.id}/manual-payment/", {"amount_cents": 300, "reason": "Comprovante conferido"}, format="json", **auth)
        self.assertEqual(paid.status_code, 201)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.CONFIRMED)
        event = reservation.events.get(event_type="MANUAL_PAYMENT_RECORDED")
        self.assertEqual(event.actor_type, "ADMIN")
        self.assertEqual(event.reason, "Comprovante conferido")

    def test_operations_lodge_species_and_custom_expedition(self):
        auth = self.login()
        # 1. Cria Pousada
        lodge_res = self.client.post("/api/operations/lodges/", {
            "name": "Pousada Nova Era",
            "city": "São Félix",
            "state": "MT",
            "river_section": "Rio Araguaia",
            "amenities": ["Wi-Fi", "Piscina"],
            "meeting_point": "Hotel em Palmas",
            "directions": "Transfer terrestre",
            "cover_image_url": "/nova-era.jpg"
        }, format="json", **auth)
        self.assertEqual(lodge_res.status_code, 201)
        lodge_id = lodge_res.data["id"]

        # 2. Lista Espécies
        species_res = self.client.get("/api/operations/species/", **auth)
        self.assertEqual(species_res.status_code, 200)
        self.assertTrue(len(species_res.data) >= 1)
        target_slug = species_res.data[0]["slug"]

        # 3. Cria Expedição Customizada
        exp_res = self.client.post("/api/operations/expeditions/", {
            "name": "Expedição Gigantes do Araguaia 2027",
            "destination": "São Félix/MT",
            "starts_at": "2027-09-01",
            "ends_at": "2027-09-05",
            "capacity": 10,
            "price_per_person_cents": 580000,
            "deposit_cents": 250000,
            "lodge_id": lodge_id,
            "species_slugs": [target_slug],
            "cover_image_url": "/capa-gigantes.jpg",
            "inclusions": ["Combustível 100% incluso", "Kit Ceviche"],
            "status": "DRAFT"
        }, format="json", **auth)
        self.assertEqual(exp_res.status_code, 201)
        created_id = exp_res.data["id"]
        self.assertEqual(exp_res.data["cover_image_url"], "/capa-gigantes.jpg")
        self.assertEqual(exp_res.data["lodge"]["name"], "Pousada Nova Era")
        self.assertEqual(exp_res.data["target_species"][0]["slug"], target_slug)

        # 4. Atualiza Expedição
        patch_res = self.client.patch(f"/api/operations/expeditions/{created_id}/", {
            "inclusions": ["Combustível 100% incluso", "Kit Ceviche", "Open Bar Heineken"]
        }, format="json", **auth)
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(len(patch_res.data["inclusions"]), 3)
