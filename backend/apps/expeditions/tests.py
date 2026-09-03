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
