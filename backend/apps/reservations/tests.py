from datetime import date, timedelta
from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient
from apps.customers.models import VerificationChallenge
from apps.customers.services import create_customer_session_token
from apps.expeditions.models import Expedition
from .models import Reservation, ReservationEvent
from .services import expire_holds, transition_reservation

@override_settings(DEBUG=True)
class CheckoutApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expedition = Expedition.objects.create(name="Rio Araguaia", destination="Luiz Alves/GO", starts_at=date(2026, 10, 18), ends_at=date(2026, 10, 22), capacity=3, price_per_person_cents=249000, deposit_cents=120000, status=Expedition.Status.PUBLISHED)
        self.identity = {"cpf": "529.982.247-25", "full_name": "João da Silva", "email": "joao@example.com", "phone": "(62) 99999-9999"}

    def identify_and_verify(self):
        identified = self.client.post("/api/checkout/identify/", self.identity, format="json")
        self.assertEqual(identified.status_code, 201)
        verified = self.client.post("/api/checkout/verify/", {"challenge_id": identified.data["challenge_id"], "code": identified.data["dev_code"]}, format="json")
        self.assertEqual(verified.status_code, 201)
        return verified.data["verification_token"]

    def test_rejects_invalid_cpf(self):
        response = self.client.post("/api/checkout/identify/", {**self.identity, "cpf": "111.111.111-11"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_invalid_and_expired_codes(self):
        identified = self.client.post("/api/checkout/identify/", self.identity, format="json")
        invalid = self.client.post("/api/checkout/verify/", {"challenge_id": identified.data["challenge_id"], "code": "000000"}, format="json")
        self.assertEqual(invalid.status_code, 400)
        VerificationChallenge.objects.filter(id=identified.data["challenge_id"]).update(expires_at=timezone.now() - timedelta(seconds=1))
        expired = self.client.post("/api/checkout/verify/", {"challenge_id": identified.data["challenge_id"], "code": identified.data["dev_code"]}, format="json")
        self.assertEqual(expired.status_code, 400)

    def test_verified_customer_creates_hold_with_snapshot_and_participants(self):
        token = self.identify_and_verify()
        response = self.client.post("/api/checkout/hold/", {"verification_token": token, "expedition_slug": self.expedition.slug, "participant_names": ["João", "Pedro"], "payment_plan": "DEPOSIT"}, format="json")
        self.assertEqual(response.status_code, 201)
        reservation = Reservation.objects.get(id=response.data["reservation_id"])
        self.assertEqual(reservation.status, Reservation.Status.HELD)
        self.assertEqual(reservation.total_price_cents, 498000)
        self.assertEqual(reservation.deposit_cents, 120000)
        self.assertEqual(reservation.payment_plan, Reservation.PaymentPlan.DEPOSIT)
        self.assertEqual(reservation.balance_due_at, self.expedition.starts_at - timedelta(days=30))
        self.assertEqual(reservation.participants.count(), 2)
        self.assertEqual(reservation.events.filter(event_type="RESERVATION_HELD").count(), 1)
        self.assertGreater(reservation.held_until, timezone.now())

    def test_hold_rejects_more_participants_than_available_slots(self):
        token = self.identify_and_verify()
        first = self.client.post("/api/checkout/hold/", {"verification_token": token, "expedition_slug": self.expedition.slug, "participant_names": ["João", "Pedro"], "payment_plan": "FULL"}, format="json")
        self.assertEqual(first.status_code, 201)
        second = self.client.post("/api/checkout/hold/", {"verification_token": token, "expedition_slug": self.expedition.slug, "participant_names": ["Ana", "Bia"], "payment_plan": "FULL"}, format="json")
        self.assertEqual(second.status_code, 400)

    def test_expire_holds_is_idempotent_and_audited(self):
        token = self.identify_and_verify()
        response = self.client.post("/api/checkout/hold/", {"verification_token": token, "expedition_slug": self.expedition.slug, "participant_names": ["João"], "payment_plan": "DEPOSIT"}, format="json")
        reservation = Reservation.objects.get(id=response.data["reservation_id"])
        Reservation.objects.filter(id=reservation.id).update(held_until=timezone.now() - timedelta(seconds=1))
        self.assertEqual(expire_holds(), 1)
        self.assertEqual(expire_holds(), 0)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.EXPIRED)
        self.assertIsNone(reservation.held_until)
        self.assertEqual(reservation.events.filter(event_type="RESERVATION_EXPIRED").count(), 1)

    def test_rejects_invalid_status_transition(self):
        token = self.identify_and_verify()
        response = self.client.post("/api/checkout/hold/", {"verification_token": token, "expedition_slug": self.expedition.slug, "participant_names": ["João"], "payment_plan": "DEPOSIT"}, format="json")
        with self.assertRaises(ValidationError):
            transition_reservation(reservation_id=response.data["reservation_id"], target_status=Reservation.Status.PAID)
        self.assertEqual(ReservationEvent.objects.filter(reservation_id=response.data["reservation_id"]).count(), 1)

    def test_customer_session_only_accesses_and_updates_own_participants(self):
        verification_token = self.identify_and_verify()
        hold = self.client.post("/api/checkout/hold/", {"verification_token": verification_token, "expedition_slug": self.expedition.slug, "participant_names": ["João"], "payment_plan": "DEPOSIT"}, format="json")
        reservation = Reservation.objects.get(id=hold.data["reservation_id"])
        participant = reservation.participants.get()
        session_token = create_customer_session_token(reservation.customer)
        auth = {"HTTP_AUTHORIZATION": f"Bearer {session_token}"}
        detail = self.client.get(f"/api/me/reservations/{reservation.id}/", **auth)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["onboarding"]["completed"], 0)
        updated = self.client.patch(f"/api/me/reservations/{reservation.id}/participants/{participant.id}/", {"phone": "(62) 99999-9999", "emergency_contact_name": "Maria", "emergency_contact_phone": "(62) 98888-7777"}, format="json", **auth)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["participants"][0]["onboarding_status"], "COMPLETED")
        self.assertTrue(reservation.events.filter(event_type="PARTICIPANT_UPDATED").exists())

    def test_customer_cannot_access_reservation_without_valid_session(self):
        verification_token = self.identify_and_verify()
        hold = self.client.post("/api/checkout/hold/", {"verification_token": verification_token, "expedition_slug": self.expedition.slug, "participant_names": ["João"], "payment_plan": "DEPOSIT"}, format="json")
        response = self.client.get(f"/api/me/reservations/{hold.data['reservation_id']}/")
        self.assertEqual(response.status_code, 401)

    def test_customer_can_update_beverage_preferences_and_checklist(self):
        verification_token = self.identify_and_verify()
        hold = self.client.post("/api/checkout/hold/", {"verification_token": verification_token, "expedition_slug": self.expedition.slug, "participant_names": ["João"], "payment_plan": "DEPOSIT"}, format="json")
        reservation = Reservation.objects.get(id=hold.data["reservation_id"])
        session_token = create_customer_session_token(reservation.customer)
        auth = {"HTTP_AUTHORIZATION": f"Bearer {session_token}"}
        
        pref_payload = {
            "beverages": {"heineken": 24, "agua_sem_gas": 12},
            "dietary_restrictions": "Sem glúten",
            "notes": "Prefiro gelo filtrado no barco",
        }
        res = self.client.patch(f"/api/me/reservations/{reservation.id}/preferences/", pref_payload, format="json", **auth)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["onboarding"]["steps"]["preferences"])
        self.assertTrue(res.data["onboarding"]["steps"]["dietary_restrictions"])
        self.assertEqual(res.data["preferences"]["beverages"]["heineken"], 24)
        self.assertTrue(reservation.events.filter(event_type="PREFERENCES_UPDATED").exists())

