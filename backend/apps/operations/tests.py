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

    def test_manual_reservation_creation_held_and_confirmed_with_20_percent_deposit(self):
        auth = self.login()
        # 1. Criação Manual HELD
        held_payload = {
            "expedition_id": str(self.expedition.id),
            "customer_name": "Carlos Silveira",
            "customer_cpf": "52998224725",
            "customer_email": "carlos@example.com",
            "customer_phone": "(62) 99123-4567",
            "spots_count": 2,
            "status": "HELD",
            "hold_hours": 36,
            "participant_names": ["Carlos Silveira", "Marcos Lima"],
            "reason": "Venda via WhatsApp - aguardando TED"
        }
        held_res = self.client.post("/api/operations/reservations/", held_payload, format="json", **auth)
        self.assertEqual(held_res.status_code, 201)
        self.assertEqual(held_res.data["status"], "HELD")
        self.assertEqual(held_res.data["participant_count"], 2)
        # Total = 2 * 249000 = 498000. 20% à vista = 99600
        self.assertEqual(held_res.data["total_price_cents"], 498000)
        self.assertEqual(held_res.data["deposit_cents"], 99600)
        self.assertEqual(len(held_res.data["participants"]), 2)
        self.assertEqual(held_res.data["participants"][1]["name"], "Marcos Lima")

        # 2. Criação Manual CONFIRMED com sinal de 20% à vista
        confirmed_payload = {
            "expedition_id": str(self.expedition.id),
            "customer_name": "Roberto Alves",
            "customer_cpf": "11144477735",
            "customer_email": "roberto@example.com",
            "customer_phone": "(62) 98888-1111",
            "spots_count": 1,
            "status": "CONFIRMED",
            "payment_type": "DEPOSIT",
            "reason": "Sinal pago via PIX direto na conta física"
        }
        conf_res = self.client.post("/api/operations/reservations/", confirmed_payload, format="json", **auth)
        self.assertEqual(conf_res.status_code, 201)
        self.assertEqual(conf_res.data["status"], "CONFIRMED")
        # Preço 249000 -> sinal de 20% = 49800
        self.assertEqual(conf_res.data["deposit_cents"], 49800)
        self.assertEqual(conf_res.data["paid_amount_cents"], 49800)
        self.assertEqual(conf_res.data["remaining_balance_cents"], 199200)

        # 3. Tentativa de ultrapassar a capacidade (restam 12 - 3 = 9 vagas)
        over_res = self.client.post("/api/operations/reservations/", {
            **confirmed_payload,
            "spots_count": 10,
        }, format="json", **auth)
        self.assertEqual(over_res.status_code, 409)

    def test_participant_update_and_substitution_audit(self):
        auth = self.login()
        # Cria reserva
        res = self.client.post("/api/operations/reservations/", {
            "expedition_id": str(self.expedition.id),
            "customer_name": "Pescador Titular",
            "customer_cpf": "52998224725",
            "customer_email": "titular@example.com",
            "customer_phone": "(62) 99999-0000",
            "spots_count": 2,
            "status": "CONFIRMED",
            "payment_type": "FULL",
            "participant_names": ["Pescador 1", "Pescador Desistente"],
            "reason": "Pagamento integral confirmado"
        }, format="json", **auth)
        self.assertEqual(res.status_code, 201)
        res_id = res.data["id"]
        pax_id = res.data["participants"][1]["id"]

        # Atualiza dados cadastrais normais
        patch_res = self.client.patch(f"/api/operations/reservations/{res_id}/participants/{pax_id}/", {
            "phone": "(62) 97777-6666",
            "emergency_contact_name": "Esposa Ana",
            "emergency_contact_phone": "(62) 97777-5555"
        }, format="json", **auth)
        self.assertEqual(patch_res.status_code, 200)
        updated_pax = next(p for p in patch_res.data["participants"] if p["id"] == pax_id)
        self.assertEqual(updated_pax["phone"], "(62) 97777-6666")
        self.assertEqual(updated_pax["emergency_contact_name"], "Esposa Ana")

        # Substitui participante por outro pescador
        sub_res = self.client.patch(f"/api/operations/reservations/{res_id}/participants/{pax_id}/", {
            "full_name": "Novo Pescador Amigo",
            "phone": "(62) 98888-3333",
            "is_substitution": True,
            "substitution_reason": "Substituição por motivo de cirurgia do titular anterior"
        }, format="json", **auth)
        self.assertEqual(sub_res.status_code, 200)
        subbed_pax = next(p for p in sub_res.data["participants"] if p["id"] == pax_id)
        self.assertEqual(subbed_pax["name"], "Novo Pescador Amigo")
        self.assertEqual(subbed_pax["onboarding_status"], "PENDING")

        # Verifica evento gravado
        reservation = Reservation.objects.get(id=res_id)
        sub_event = reservation.events.filter(event_type="PARTICIPANT_SUBSTITUTED").first()
        self.assertIsNotNone(sub_event)
        self.assertEqual(sub_event.payload["previous_name"], "Pescador Desistente")
        self.assertEqual(sub_event.payload["new_name"], "Novo Pescador Amigo")

    def test_expedition_manifest_json_and_csv_safe(self):
        auth = self.login()
        # Cria reserva com participante com nome contendo tentativa de injeção de fórmula
        self.client.post("/api/operations/reservations/", {
            "expedition_id": str(self.expedition.id),
            "customer_name": "=CMD('calc')",
            "customer_cpf": "52998224725",
            "customer_email": "injection@example.com",
            "customer_phone": "(62) 99999-8888",
            "spots_count": 1,
            "status": "CONFIRMED",
            "payment_type": "DEPOSIT",
            "reason": "Teste de segurança CSV"
        }, format="json", **auth)

        # 1. Manifest JSON
        json_res = self.client.get(f"/api/operations/expeditions/{self.expedition.id}/manifest/", **auth)
        self.assertEqual(json_res.status_code, 200)
        self.assertEqual(json_res.data["expedition"]["name"], "Rio Araguaia")
        self.assertTrue(len(json_res.data["passengers"]) >= 1)

        # 2. Manifest CSV
        csv_res = self.client.get(f"/api/operations/expeditions/{self.expedition.id}/manifest.csv", **auth)
        self.assertEqual(csv_res.status_code, 200)
        self.assertTrue(csv_res["Content-Type"].startswith("text/csv"))
        content = csv_res.content.decode("utf-8")
        self.assertTrue(content.startswith("\ufeff"))  # UTF-8 BOM
        self.assertIn("Nome Completo", content)
        # Verifica se o valor com = foi neutralizado com aspas/apóstrofo
        self.assertIn("'=CMD('calc')", content)
