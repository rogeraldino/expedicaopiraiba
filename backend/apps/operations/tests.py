from datetime import date, timedelta

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from django.utils import timezone

from apps.customers.models import Customer, CustomerProfile
from apps.customers.services import create_guest_participant_token
from apps.expeditions.models import (
    AllInclusivePackage,
    Amenity,
    BeveragePackage,
    BeveragePackageItem,
    Expedition,
    ExpeditionProduct,
    FishingGearProduct,
    GearCategory,
    Lodge,
    Product,
    River,
    RiverSpecies,
    TargetSpecies,
    WaterBasin,
)
from apps.payments.models import Payment
from apps.reservations.models import ParticipantProductChoice, Reservation, ReservationGearAddon, ReservationParticipant


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

    def test_river_crud_and_relational_protection(self):
        auth = self.login()
        # 1. Cria Rio
        res = self.client.post("/api/operations/rivers/", {
            "name": "Rio Teles Pires",
            "basin": WaterBasin.AMAZONICA,
            "states": ["MT", "PA"],
            "description": "Famoso por grandes Jaús e Cachorras largas.",
            "regulations": "Cota zero para espécies de couro e escama.",
            "active": True,
        }, format="json", **auth)
        self.assertEqual(res.status_code, 201)
        river_id = res.data["id"]
        self.assertEqual(res.data["slug"], "rio-teles-pires")
        self.assertEqual(res.data["basin_display"], "Bacia Amazônica")

        # 2. Filtra por Bacia
        basin_res = self.client.get(f"/api/operations/rivers/?basin={WaterBasin.AMAZONICA}", **auth)
        self.assertEqual(basin_res.status_code, 200)
        self.assertTrue(any(r["id"] == river_id for r in basin_res.data))

        # 3. Cria Pousada vinculada ao Rio
        lodge = Lodge.objects.create(
            name="Pousada Teles Pires Lodge",
            slug="teles-pires-lodge",
            city="Alta Floresta",
            state="MT",
            river=River.objects.get(id=river_id),
            river_section="Médio Teles Pires",
        )

        # 4. Tenta deletar rio com pousada vinculada -> deve falhar com 400
        del_res = self.client.delete(f"/api/operations/rivers/{river_id}/", **auth)
        self.assertEqual(del_res.status_code, 400)
        self.assertIn("Não é possível excluir rio com pousadas associadas", del_res.data["detail"])

        # 5. Remove a pousada e deleta o rio -> sucesso 204
        lodge.delete()
        del_success = self.client.delete(f"/api/operations/rivers/{river_id}/", **auth)
        self.assertEqual(del_success.status_code, 204)
        self.assertFalse(River.objects.filter(id=river_id).exists())

    def test_river_species_association(self):
        auth = self.login()
        river = River.objects.create(
            name="Rio Xingu",
            basin=WaterBasin.AMAZONICA,
            states=["PA"],
        )
        species = TargetSpecies.objects.create(
            slug="tucunare-fogo",
            common_name="Tucunaré Fogo",
            scientific_name="Cichla mirianae",
            category="ESCAMA",
        )

        # 1. Associa espécie ao rio
        assoc_res = self.client.post(f"/api/operations/rivers/{river.id}/species/", {
            "species_slug": "tucunare-fogo",
            "is_trophy": True,
            "is_native": True,
            "best_season": "Setembro a Novembro",
        }, format="json", **auth)
        self.assertEqual(assoc_res.status_code, 201)
        self.assertEqual(assoc_res.data["species_name"], "Tucunaré Fogo")
        self.assertTrue(assoc_res.data["is_trophy"])

        # 2. Lista espécies do rio
        list_res = self.client.get(f"/api/operations/rivers/{river.id}/species/", **auth)
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.data), 1)
        self.assertEqual(list_res.data[0]["best_season"], "Setembro a Novembro")

        # 3. Remove espécie do rio
        del_res = self.client.delete(f"/api/operations/rivers/{river.id}/species/?species_slug=tucunare-fogo", **auth)
        self.assertEqual(del_res.status_code, 204)
        self.assertEqual(RiverSpecies.objects.filter(river=river).count(), 0)

    def test_amenities_list_and_lodge_sync(self):
        auth = self.login()
        # 1. Lista Comodidades
        amenity_res = self.client.get("/api/operations/amenities/", **auth)
        self.assertEqual(amenity_res.status_code, 200)
        self.assertTrue(len(amenity_res.data) >= 1)

        # Garante duas comodidades conhecidas
        a1, _ = Amenity.objects.get_or_create(
            name="Piscina Panorâmica",
            defaults={"category": "LEISURE", "icon_key": "pool", "display_order": 1},
        )
        a2, _ = Amenity.objects.get_or_create(
            name="Wi-Fi Starlink",
            defaults={"category": "CONNECTIVITY", "icon_key": "wifi", "display_order": 2},
        )

        river, _ = River.objects.get_or_create(
            name="Rio Araguaia",
            defaults={"basin": WaterBasin.TOCANTINS_ARAGUAIA, "states": ["GO", "MT", "TO"]},
        )

        # 2. Cria Pousada com amenity_ids e river_id
        create_res = self.client.post("/api/operations/lodges/", {
            "name": "Pousada Modular Teste",
            "city": "Luiz Alves",
            "state": "GO",
            "river_id": str(river.id),
            "river_section": "Alto Araguaia",
            "amenity_ids": [str(a1.id), str(a2.id)],
            "boat_fleet_details": "6 barcos de 6 metros com motor 40HP 4 tempos",
        }, format="json", **auth)
        self.assertEqual(create_res.status_code, 201)
        lodge_id = create_res.data["id"]
        self.assertEqual(create_res.data["river"]["name"], "Rio Araguaia")
        self.assertEqual(len(create_res.data["amenities_detailed"]), 2)
        # Retrocompatibilidade: amenities deve conter a lista com os nomes
        self.assertIn("Piscina Panorâmica", create_res.data["amenities"])
        self.assertIn("Wi-Fi Starlink", create_res.data["amenities"])
        self.assertEqual(create_res.data["boat_fleet_details"], "6 barcos de 6 metros com motor 40HP 4 tempos")

        # 3. Atualiza Pousada alterando comodidades via PATCH
        patch_res = self.client.patch(f"/api/operations/lodges/{lodge_id}/", {
            "amenity_ids": [str(a1.id)],
        }, format="json", **auth)
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(len(patch_res.data["amenities_detailed"]), 1)
        self.assertEqual(patch_res.data["amenities_detailed"][0]["name"], "Piscina Panorâmica")

    def test_all_inclusive_package_crud_and_conflict(self):
        auth = self.login()
        # 1. Cria AllInclusivePackage
        create_res = self.client.post("/api/operations/all-inclusive-packages/", {
            "name": "Pacote VIP Teste",
            "description": "Descrição do pacote vip",
            "inclusions": ["Hospedagem 100% climatizada", "Barco com piloteiro nativo", "Iscas vivas"],
        }, format="json", **auth)
        self.assertEqual(create_res.status_code, 201)
        pkg_id = create_res.data["id"]
        self.assertEqual(create_res.data["name"], "Pacote VIP Teste")
        self.assertEqual(len(create_res.data["inclusions"]), 3)

        # 2. Atualiza via PATCH
        patch_res = self.client.patch(f"/api/operations/all-inclusive-packages/{pkg_id}/", {
            "description": "Descrição atualizada",
        }, format="json", **auth)
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.data["description"], "Descrição atualizada")

        # 3. Vincula a uma expedição e tenta deletar (deve retornar 409 Conflict)
        self.expedition.all_inclusive_package_id = pkg_id
        self.expedition.save()

        del_conflict = self.client.delete(f"/api/operations/all-inclusive-packages/{pkg_id}/", **auth)
        self.assertEqual(del_conflict.status_code, 409)

        # Desvincula e deleta com sucesso
        self.expedition.all_inclusive_package = None
        self.expedition.save()
        del_ok = self.client.delete(f"/api/operations/all-inclusive-packages/{pkg_id}/", **auth)
        self.assertEqual(del_ok.status_code, 204)

    def test_beverage_package_crud_and_items_sync(self):
        auth = self.login()
        prod1, _ = Product.objects.get_or_create(
            name="Cerveja Teste Stella", defaults={"category": "BEBIDA", "unit": "lata", "active": True}
        )
        prod2, _ = Product.objects.get_or_create(
            name="Refrigerante Teste Cola", defaults={"category": "BEBIDA", "unit": "lata", "active": True}
        )

        # 1. Cria BeveragePackage com items_payload
        create_res = self.client.post("/api/operations/beverage-packages/", {
            "name": "Barco Premium Teste",
            "description": "Pacote com cerveja e refri",
            "items_payload": [
                {"product_id": str(prod1.id), "standard_quantity_per_participant": 18, "display_order": 1, "note": "Gelada"},
                {"product_id": str(prod2.id), "standard_quantity_per_participant": 12, "display_order": 2, "note": "Com gelo"},
            ],
        }, format="json", **auth)
        self.assertEqual(create_res.status_code, 201)
        bev_id = create_res.data["id"]
        self.assertEqual(len(create_res.data["items"]), 2)

        # 2. Testa item view para adicionar mais um produto
        prod3, _ = Product.objects.get_or_create(
            name="Água Teste Mineral", defaults={"category": "BEBIDA", "unit": "garrafa", "active": True}
        )
        item_res = self.client.post(f"/api/operations/beverage-packages/{bev_id}/items/", {
            "product_id": str(prod3.id),
            "standard_quantity_per_participant": 24,
            "display_order": 3,
            "note": "Sem gás",
        }, format="json", **auth)
        self.assertEqual(item_res.status_code, 201)

        # 3. Vincula a uma expedição e verifica 409 no DELETE
        self.expedition.beverage_package_id = bev_id
        self.expedition.save()

        del_conflict = self.client.delete(f"/api/operations/beverage-packages/{bev_id}/", **auth)
        self.assertEqual(del_conflict.status_code, 409)

        # Desvincula e deleta
        self.expedition.beverage_package = None
        self.expedition.save()
        del_ok = self.client.delete(f"/api/operations/beverage-packages/{bev_id}/", **auth)
        self.assertEqual(del_ok.status_code, 204)

    def test_expedition_wizard_creation_with_packages_and_deposit_validation(self):
        auth = self.login()
        # 1. Validação de sinal de 20%: Preço 5.000,00 -> 20% é 1.000,00 (100.000 cents). Se sinal for 500,00 (50.000 cents), falha.
        fail_res = self.client.post("/api/operations/expeditions/", {
            "name": "Expedição Sinal Inválido",
            "destination": "Araguaia",
            "starts_at": "2026-11-01",
            "ends_at": "2026-11-05",
            "capacity": 10,
            "price_per_person_cents": 500000,
            "deposit_cents": 50000,  # 10% apenas -> deve falhar
        }, format="json", **auth)
        self.assertEqual(fail_res.status_code, 400)
        self.assertIn("deposit_cents", fail_res.data)

        # 2. Cria com sinal válido (>= 20%) e vinculando pacotes
        pkg_ai, _ = AllInclusivePackage.objects.get_or_create(
            name="Template All Inclusive Teste",
            defaults={"inclusions": ["Inclusão 1", "Inclusão 2"]}
        )
        prod, _ = Product.objects.get_or_create(
            name="Cerveja Wizard Teste", defaults={"category": "BEBIDA", "unit": "lata", "active": True}
        )
        pkg_bev, _ = BeveragePackage.objects.get_or_create(name="Template Bebidas Teste")
        BeveragePackageItem.objects.get_or_create(
            package=pkg_bev,
            product=prod,
            defaults={"standard_quantity_per_participant": 20, "display_order": 1}
        )

        ok_res = self.client.post("/api/operations/expeditions/", {
            "name": "Expedição Wizard Sucesso",
            "destination": "São Félix do Araguaia",
            "starts_at": "2026-11-10",
            "ends_at": "2026-11-14",
            "capacity": 12,
            "price_per_person_cents": 500000,
            "deposit_cents": 100000,  # exatamente 20%
            "all_inclusive_package_id": str(pkg_ai.id),
            "beverage_package_id": str(pkg_bev.id),
            "inclusions": ["Inclusão 1", "Inclusão 2", "Inclusão Personalizada"],
        }, format="json", **auth)
        self.assertEqual(ok_res.status_code, 201)
        exp_id = ok_res.data["id"]
        self.assertEqual(ok_res.data["all_inclusive_package"]["name"], "Template All Inclusive Teste")
        self.assertEqual(ok_res.data["beverage_package"]["name"], "Template Bebidas Teste")
        self.assertEqual(len(ok_res.data["inclusions"]), 3)

        # 3. Verifica se sincronizou com ExpeditionProduct
        created_exp = Expedition.objects.get(id=exp_id)
        offers = created_exp.product_offers.filter(product=prod)
        self.assertTrue(offers.exists())
        self.assertEqual(offers.first().standard_quantity_per_participant, 20)

    def test_fishing_gear_product_crud_and_filters(self):
        auth = self.login()
        # Create product
        res = self.client.post("/api/operations/gear-products/", {
            "name": "Carretilha Shimano Tranx 400 Piraíba",
            "category": "HEAVY_ROD_REEL",
            "modality": "BOTH",
            "inventory_quantity": 5,
            "rental_price_cents": 12000,
            "sale_price_cents": 280000,
            "technical_specs": {"drag": "10kg", "ratio": "5.8:1"},
        }, format="json", **auth)
        self.assertEqual(res.status_code, 201)
        prod_id = res.data["id"]
        self.assertEqual(res.data["category_display"], "Conjunto Pesado (Piraíba / Grandes Bagres)")
        self.assertEqual(res.data["inventory_quantity"], 5)

        # Filter by category
        cat_res = self.client.get("/api/operations/gear-products/?category=HEAVY_ROD_REEL", **auth)
        self.assertEqual(cat_res.status_code, 200)
        self.assertTrue(any(p["id"] == prod_id for p in cat_res.data))

        # Search by target fish
        search_res = self.client.get("/api/operations/gear-products/?q=Piraíba", **auth)
        self.assertEqual(search_res.status_code, 200)
        self.assertTrue(any(p["id"] == prod_id for p in search_res.data))

        # Update product
        patch_res = self.client.patch(f"/api/operations/gear-products/{prod_id}/", {
            "inventory_quantity": 8,
            "description": "Excelente carretilha para piraíba.",
        }, format="json", **auth)
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.data["inventory_quantity"], 8)
        self.assertEqual(patch_res.data["description"], "Excelente carretilha para piraíba.")

    def test_fishing_gear_product_delete_protection_with_active_reservations(self):
        auth = self.login()
        gear = FishingGearProduct.objects.create(
            name="Vara Pesada Protegida 100lb",
            category="HEAVY_ROD_REEL",
            modality="RENTAL",
            rental_price_cents=9000,
            inventory_quantity=3,
        )
        customer = Customer.objects.create(cpf="11122233344", full_name="Carlos Pescador", email="carlos@example.com")
        reservation = Reservation.objects.create(
            customer=customer,
            expedition=self.expedition,
            participant_count=1,
            unit_price_cents=249000,
            total_price_cents=249000,
            deposit_cents=50000,
            status=Reservation.Status.CONFIRMED,
        )
        participant = ReservationParticipant.objects.create(reservation=reservation, full_name="Carlos Pescador")
        ReservationGearAddon.objects.create(
            reservation=reservation,
            participant=participant,
            gear_product=gear,
            modality="RENTAL",
            quantity=1,
            unit_price_cents=9000,
            total_price_cents=9000,
        )

        # Deleting should return 409 Conflict
        del_res = self.client.delete(f"/api/operations/gear-products/{gear.id}/", **auth)
        self.assertEqual(del_res.status_code, 409)
        self.assertIn("reservas ativas", del_res.data["detail"])

        # Deactivating should succeed
        patch_res = self.client.patch(f"/api/operations/gear-products/{gear.id}/", {"active": False}, format="json", **auth)
        self.assertEqual(patch_res.status_code, 200)
        self.assertFalse(patch_res.data["active"])

    def test_reservation_gear_addon_stock_and_concurrency(self):
        auth = self.login()
        gear = FishingGearProduct.objects.create(
            name="Kit Tralha Rara Limitada",
            category="HEAVY_ROD_REEL",
            modality="RENTAL",
            rental_price_cents=15000,
            inventory_quantity=2,
        )
        customer = Customer.objects.create(cpf="22233344455", full_name="Ana Pesca", email="ana@example.com")
        reservation = Reservation.objects.create(
            customer=customer,
            expedition=self.expedition,
            participant_count=1,
            unit_price_cents=249000,
            total_price_cents=249000,
            deposit_cents=50000,
            status=Reservation.Status.CONFIRMED,
        )

        # 1. Add 1 item -> Stock drops from 2 to 1
        res1 = self.client.post(f"/api/operations/reservations/{reservation.id}/gear-addons/", {
            "gear_product_id": str(gear.id),
            "modality": "RENTAL",
            "quantity": 1,
            "rental_days": 4,
        }, format="json", **auth)
        self.assertEqual(res1.status_code, 201)
        addon_id = res1.data["id"]
        gear.refresh_from_db()
        self.assertEqual(gear.inventory_quantity, 1)

        # 2. Try to add 2 items -> Should fail with 400 (only 1 available)
        res_fail = self.client.post(f"/api/operations/reservations/{reservation.id}/gear-addons/", {
            "gear_product_id": str(gear.id),
            "modality": "RENTAL",
            "quantity": 2,
        }, format="json", **auth)
        self.assertEqual(res_fail.status_code, 400)
        self.assertIn("Estoque insuficiente", res_fail.data["detail"])

        # 3. Delete the addon -> Stock restored to 2
        del_res = self.client.delete(f"/api/operations/reservations/{reservation.id}/gear-addons/{addon_id}/", **auth)
        self.assertEqual(del_res.status_code, 204)
        gear.refresh_from_db()
        self.assertEqual(gear.inventory_quantity, 2)

    def test_reservation_gear_addon_financial_recalculation_and_state_transition(self):
        auth = self.login()
        gear = FishingGearProduct.objects.create(
            name="Camisa UV 50+",
            category="APPAREL",
            modality="SALE",
            sale_price_cents=35000,
            inventory_quantity=10,
        )
        customer = Customer.objects.create(cpf="33344455566", full_name="Marcos Silva", email="marcos@example.com")
        reservation = Reservation.objects.create(
            customer=customer,
            expedition=self.expedition,
            participant_count=1,
            unit_price_cents=200000,
            total_price_cents=200000,
            deposit_cents=40000,
            status=Reservation.Status.CONFIRMED,
        )
        # Pay the trip 100%
        Payment.objects.create(
            reservation=reservation,
            amount_cents=200000,
            status=Payment.Status.PAID,
            provider="ADMIN",
            method="PIX",
            external_id="pay-test-full-100",
        )
        # Transition reservation to PAID
        reservation.status = Reservation.Status.PAID
        reservation.save()

        self.assertEqual(reservation.status, Reservation.Status.PAID)
        self.assertEqual(reservation.remaining_balance_cents, 0)

        # Add gear addon (Camisa R$ 350,00)
        add_res = self.client.post(f"/api/operations/reservations/{reservation.id}/gear-addons/", {
            "gear_product_id": str(gear.id),
            "modality": "SALE",
            "quantity": 1,
        }, format="json", **auth)
        self.assertEqual(add_res.status_code, 201)
        addon_id = add_res.data["id"]

        reservation.refresh_from_db()
        # Total should now be 2.350,00 (235000 cents)
        self.assertEqual(reservation.total_price_cents, 235000)
        # Remaining balance is now 350,00
        self.assertEqual(reservation.remaining_balance_cents, 35000)
        # Status MUST transition cleanly back to CONFIRMED!
        self.assertEqual(reservation.status, Reservation.Status.CONFIRMED)

        # Now remove the gear addon
        del_res = self.client.delete(f"/api/operations/reservations/{reservation.id}/gear-addons/{addon_id}/", **auth)
        self.assertEqual(del_res.status_code, 204)

        reservation.refresh_from_db()
        # Total returns to 2.000,00
        self.assertEqual(reservation.total_price_cents, 200000)
        self.assertEqual(reservation.remaining_balance_cents, 0)
        # Status MUST transition back to PAID!
        self.assertEqual(reservation.status, Reservation.Status.PAID)

    def test_reservation_cancellation_restores_gear_stock(self):
        auth = self.login()
        gear = FishingGearProduct.objects.create(
            name="Kit Anzóis e Encastoados",
            category="TERMINAL_TACKLE",
            modality="SALE",
            sale_price_cents=12000,
            inventory_quantity=10,
        )
        customer = Customer.objects.create(cpf="44455566677", full_name="Roberto Cancelamento", email="roberto@example.com")
        reservation = Reservation.objects.create(
            customer=customer,
            expedition=self.expedition,
            participant_count=1,
            unit_price_cents=249000,
            total_price_cents=249000,
            deposit_cents=50000,
            status=Reservation.Status.CONFIRMED,
        )
        # Add 2 items -> Stock drops to 8
        self.client.post(f"/api/operations/reservations/{reservation.id}/gear-addons/", {
            "gear_product_id": str(gear.id),
            "modality": "SALE",
            "quantity": 2,
        }, format="json", **auth)
        gear.refresh_from_db()
        self.assertEqual(gear.inventory_quantity, 8)

        # Cancel reservation
        cancel_res = self.client.post(f"/api/operations/reservations/{reservation.id}/cancel/", {
            "reason": "Desistência por motivos pessoais do cliente",
        }, format="json", **auth)
        self.assertEqual(cancel_res.status_code, 200)

        # Stock should be restored to 10
        gear.refresh_from_db()
        self.assertEqual(gear.inventory_quantity, 10)

    def test_crm_customer_list_metrics_and_detail_patch(self):
        auth = self.login()
        customer = Customer.objects.create(
            cpf="55566677788",
            full_name="Pescador CRM Teste",
            email="crm_teste@example.com",
            phone="62988887777",
        )
        res = Reservation.objects.create(
            customer=customer,
            expedition=self.expedition,
            participant_count=2,
            unit_price_cents=250000,
            total_price_cents=500000,
            deposit_cents=100000,
            status=Reservation.Status.PAID,
        )
        Payment.objects.create(
            reservation=res,
            amount_cents=500000,
            status=Payment.Status.PAID,
            provider="ADMIN",
            method="PIX",
            external_id="crm-test-pay-1",
        )

        # List customers
        list_res = self.client.get(f"/api/operations/customers/?q={customer.cpf}", **auth)
        self.assertEqual(list_res.status_code, 200)
        self.assertTrue(len(list_res.data) >= 1)
        cust_data = next(c for c in list_res.data if c["id"] == str(customer.id))
        self.assertEqual(cust_data["lifetime_value_cents"], 500000)
        self.assertEqual(cust_data["total_reservations"], 1)

        # Update profile with RGP license and internal notes
        patch_res = self.client.patch(f"/api/operations/customers/{customer.id}/", {
            "profile": {
                "fishing_license_number": "RGP-GO-987654",
                "fishing_license_expiry": "2027-12-31",
                "internal_admin_notes": "Anotação sigilosa: prefere pescar na popa do barco.",
                "city": "Goiânia",
                "state": "GO",
            }
        }, format="json", **auth)
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.data["profile"]["fishing_license_number"], "RGP-GO-987654")
        self.assertTrue(patch_res.data["profile"]["has_valid_license"])
        self.assertEqual(patch_res.data["profile"]["internal_admin_notes"], "Anotação sigilosa: prefere pescar na popa do barco.")

    def test_crm_internal_admin_notes_privacy_never_leaks_to_guest_or_public(self):
        auth = self.login()
        customer = Customer.objects.create(
            cpf="66677788899",
            full_name="Pescador Sigiloso",
            email="sigilo@example.com",
            phone="62977776666",
        )
        profile, _ = CustomerProfile.objects.get_or_create(
            customer=customer,
            defaults={"internal_admin_notes": "SEGREDO DE ESTADO OPERACIONAL: NÃO EXIBIR AO CLIENTE!"}
        )
        reservation = Reservation.objects.create(
            customer=customer,
            expedition=self.expedition,
            participant_count=1,
            unit_price_cents=249000,
            total_price_cents=249000,
            deposit_cents=50000,
            status=Reservation.Status.CONFIRMED,
        )
        participant = ReservationParticipant.objects.create(reservation=reservation, full_name="Pescador Sigiloso")

        # 1. Admin endpoint has the notes
        admin_res = self.client.get(f"/api/operations/customers/{customer.id}/", **auth)
        self.assertEqual(admin_res.status_code, 200)
        self.assertEqual(admin_res.data["profile"]["internal_admin_notes"], "SEGREDO DE ESTADO OPERACIONAL: NÃO EXIBIR AO CLIENTE!")

        # 2. Guest / Public participant onboarding endpoint should NEVER leak internal_admin_notes
        token = create_guest_participant_token(participant)
        guest_res = self.client.get(f"/api/me/guest/{token}/")
        self.assertEqual(guest_res.status_code, 200)
        guest_payload_str = str(guest_res.data)
        self.assertNotIn("internal_admin_notes", guest_payload_str)
        self.assertNotIn("SEGREDO DE ESTADO", guest_payload_str)

    def test_expedition_manifest_includes_gear_addons_and_lodge_summary(self):
        auth = self.login()
        gear = FishingGearProduct.objects.create(
            name="Conjunto Carretilha Pesada 100lb",
            category="HEAVY_ROD_REEL",
            modality="RENTAL",
            rental_price_cents=15000,
            inventory_quantity=5,
        )
        customer = Customer.objects.create(cpf="77788899900", full_name="Pescador Manifesto", email="manifesto@example.com")
        reservation = Reservation.objects.create(
            customer=customer,
            expedition=self.expedition,
            participant_count=1,
            unit_price_cents=249000,
            total_price_cents=249000,
            deposit_cents=50000,
            status=Reservation.Status.CONFIRMED,
        )
        participant = ReservationParticipant.objects.create(reservation=reservation, full_name="Pescador Manifesto")
        ReservationGearAddon.objects.create(
            reservation=reservation,
            participant=participant,
            gear_product=gear,
            modality="RENTAL",
            quantity=2,
            unit_price_cents=60000,
            total_price_cents=120000,
            delivered=True,
        )

        # JSON manifest
        manifest_res = self.client.get(f"/api/operations/expeditions/{self.expedition.id}/manifest/", **auth)
        self.assertEqual(manifest_res.status_code, 200)
        self.assertIn("gear_summary", manifest_res.data)
        summary = manifest_res.data["gear_summary"]
        self.assertTrue(len(summary) >= 1)
        self.assertEqual(summary[0]["name"], "Conjunto Carretilha Pesada 100lb")
        self.assertEqual(summary[0]["total_quantity"], 2)
        self.assertEqual(summary[0]["delivered_quantity"], 2)

        # Passenger gear list
        passenger = manifest_res.data["passengers"][0]
        self.assertIn("gear_addons", passenger)
        self.assertEqual(passenger["gear_addons"][0]["gear_name"], "Conjunto Carretilha Pesada 100lb")

        # CSV manifest
        csv_res = self.client.get(f"/api/operations/expeditions/{self.expedition.id}/manifest.csv", **auth)
        self.assertEqual(csv_res.status_code, 200)
        csv_content = csv_res.content.decode("utf-8")
        self.assertIn("Tralhas / Equipamentos", csv_content)
        self.assertIn("2x Conjunto Carretilha Pesada 100lb (RENTAL)", csv_content)
