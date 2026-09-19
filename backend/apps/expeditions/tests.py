from datetime import date, timedelta

from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.reservations.models import Reservation

from .models import Expedition
from .services import transition_expedition


class PublishedExpeditionApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expedition = Expedition.objects.create(
            name="Rio Araguaia",
            destination="Luiz Alves/GO",
            starts_at=date(2026, 10, 18),
            ends_at=date(2026, 10, 22),
            capacity=5,
            price_per_person_cents=249000,
            deposit_cents=120000,
            status=Expedition.Status.PUBLISHED,
        )
        self.customer = Customer.objects.create(
            cpf="12345678901",
            full_name="Cliente Teste",
            email="cliente@example.com",
            phone="5562999999999",
        )

    def reservation(self, *, status, participants, held_until=None):
        return Reservation.objects.create(
            customer=self.customer,
            expedition=self.expedition,
            participant_count=participants,
            status=status,
            held_until=held_until,
            unit_price_cents=249000,
            total_price_cents=249000 * participants,
            deposit_cents=120000,
        )

    def test_returns_only_published_expeditions(self):
        Expedition.objects.create(
            name="Expedição em preparação",
            destination="Aruanã/GO",
            starts_at=date(2027, 1, 10),
            ends_at=date(2027, 1, 12),
            capacity=8,
            price_per_person_cents=200000,
            deposit_cents=50000,
        )
        response = self.client.get("/api/expeditions/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_availability_counts_confirmed_and_active_holds(self):
        self.reservation(status=Reservation.Status.CONFIRMED, participants=2)
        self.reservation(status=Reservation.Status.HELD, participants=1, held_until=timezone.now() + timedelta(minutes=10))
        response = self.client.get("/api/expeditions/")
        self.assertEqual(response.json()[0]["available_slots"], 2)

    def test_availability_ignores_expired_holds(self):
        self.reservation(status=Reservation.Status.HELD, participants=3, held_until=timezone.now() - timedelta(minutes=1))
        response = self.client.get("/api/expeditions/")
        self.assertEqual(response.json()[0]["available_slots"], 5)

    def test_only_allows_valid_status_transitions(self):
        transition_expedition(expedition_id=self.expedition.id, target_status=Expedition.Status.CLOSED)
        self.expedition.refresh_from_db()
        self.assertEqual(self.expedition.status, Expedition.Status.CLOSED)
        with self.assertRaises(ValidationError):
            transition_expedition(expedition_id=self.expedition.id, target_status=Expedition.Status.COMPLETED)

    def test_returns_lodge_species_and_media_in_public_endpoints(self):
        from .models import Lodge, TargetSpecies, ExpeditionSpecies
        lodge = Lodge.objects.create(
            name="Pousada das Águas Teste",
            city="São Félix",
            state="MT",
            river_section="Rio Araguaia",
            amenities=["Wi-Fi", "Piscina"],
            meeting_point="Aeroporto",
            directions="Siga a rota",
            cover_image_url="/test-lodge.jpg"
        )
        species1 = TargetSpecies.objects.create(slug="piraiba_teste", common_name="Piraíba Teste", category="COURO")
        species2 = TargetSpecies.objects.create(slug="tucunare_teste", common_name="Tucunaré Teste", category="ESCAMA")
        self.expedition.lodge = lodge
        self.expedition.cover_image_url = "/test-cover.jpg"
        self.expedition.gallery_image_urls = ["/test-1.jpg", "/test-2.jpg"]
        self.expedition.inclusions = ["All Inclusive Teste"]
        self.expedition.save()
        ExpeditionSpecies.objects.create(expedition=self.expedition, species=species1, is_primary=True, display_order=0)
        ExpeditionSpecies.objects.create(expedition=self.expedition, species=species2, is_primary=False, display_order=1)

        # 1. /api/expeditions/
        res = self.client.get("/api/expeditions/")
        self.assertEqual(res.status_code, 200)
        data = res.json()[0]
        self.assertEqual(data["cover_image_url"], "/test-cover.jpg")
        self.assertEqual(data["inclusions"], ["All Inclusive Teste"])
        self.assertEqual(data["lodge"]["name"], "Pousada das Águas Teste")
        self.assertEqual(len(data["target_species"]), 2)
        self.assertTrue(data["target_species"][0]["is_primary"])
        self.assertEqual(data["target_species"][0]["slug"], "piraiba_teste")

        # 2. /api/expeditions/{slug}/
        res_detail = self.client.get(f"/api/expeditions/{self.expedition.slug}/")
        self.assertEqual(res_detail.status_code, 200)
        self.assertEqual(res_detail.json()["lodge"]["city"], "São Félix")

        # 3. /api/lodges/
        res_lodges = self.client.get("/api/lodges/")
        self.assertEqual(res_lodges.status_code, 200)
        self.assertTrue(any(l["slug"] == lodge.slug for l in res_lodges.json()))

        # 4. /api/species/
        res_species = self.client.get("/api/species/")
        self.assertEqual(res_species.status_code, 200)
        self.assertTrue(any(s["slug"] == "piraiba_teste" for s in res_species.json()))
