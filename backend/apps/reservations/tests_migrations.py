import importlib
from datetime import date

from django.apps import apps
from django.test import TransactionTestCase

from apps.customers.models import Customer
from apps.expeditions.models import Expedition
from .models import ParticipantProductChoice, Reservation, ReservationParticipant


class LegacyPreferencesMigratorTests(TransactionTestCase):
    def test_single_multi_unknown_and_reexecution_are_conservative(self):
        expedition = Expedition.objects.create(name="Legado", destination="GO", starts_at=date(2027, 8, 1), ends_at=date(2027, 8, 2), capacity=8, price_per_person_cents=1000, deposit_cents=300)
        customer = Customer.objects.create(cpf="52998224725", full_name="Legado", email="legacy@example.com", phone="62999999999")
        def reservation(preferences, participants):
            item = Reservation.objects.create(customer=customer, expedition=expedition, participant_count=participants, unit_price_cents=1000, total_price_cents=1000 * participants, deposit_cents=300, beverage_preferences=preferences)
            for index in range(participants): ReservationParticipant.objects.create(reservation=item, full_name=f"Pessoa {index}")
            return item
        single = reservation({"beverages": {"heineken": 12}}, 1)
        multi = reservation({"beverages": {"heineken": 12}}, 2)
        unknown = reservation({"beverages": {"produto_desconhecido": 2}}, 1)
        migration = importlib.import_module("apps.reservations.migrations.0007_seed_catalog_and_migrate_legacy_preferences")
        marker = importlib.import_module("apps.reservations.migrations.0008_reservation_legacy_preferences_review_required")
        migration.forwards(apps, None); migration.forwards(apps, None)
        marker.mark_ambiguous_legacy(apps, None); marker.mark_ambiguous_legacy(apps, None)
        self.assertEqual(ParticipantProductChoice.objects.filter(participant__reservation=single, selected=True).count(), 1)
        self.assertEqual(ParticipantProductChoice.objects.filter(participant__reservation=multi).count(), 0)
        multi.refresh_from_db(); unknown.refresh_from_db()
        self.assertTrue(multi.legacy_preferences_review_required)
        self.assertTrue(unknown.legacy_preferences_review_required)
