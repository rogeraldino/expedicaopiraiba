from datetime import date, timedelta
import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer, CustomerProfile, VerificationChallenge
from apps.customers.services import (
    create_customer_session_token,
    create_guest_participant_token,
    participant_from_guest_token,
    start_portal_reaccess,
    verify_challenge,
    verify_portal_reaccess,
)
from apps.expeditions.models import Expedition
from apps.operations.views import expeditions_with_occupancy
from apps.payments.models import Payment, PaymentTransaction
from apps.reservations.models import Reservation, ReservationParticipant


@override_settings(DEBUG=True, EXPOSE_DEV_CODE=True, PAYMENT_GATEWAY="FAKE")
class Stage2IdentidadePagamentosTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expedition = Expedition.objects.create(
            name="Expedição Piraíba Araguaia",
            destination="Luiz Alves - GO",
            starts_at=timezone.localdate() + timedelta(days=20),
            ends_at=timezone.localdate() + timedelta(days=25),
            capacity=6,
            price_per_person_cents=250000,
            deposit_cents=50000,
            status=Expedition.Status.PUBLISHED,
        )
        self.customer = Customer.objects.create(
            cpf="12345678909",
            full_name="Pescador Original",
            email="pescador@original.com",
            phone="62981612128",
        )

    def test_existing_customer_contact_preserved_before_verification(self):
        """
        AUTH-01: Submitting new details for existing CPF must not overwrite
        customer contact info before OTP is successfully verified.
        """
        payload = {
            "cpf": "123.456.789-09",
            "full_name": "Hacker Impostor",
            "email": "hacker@attack.com",
            "phone": "(11) 99999-8888",
        }
        res = self.client.post("/api/checkout/identify/", payload, format="json")
        self.assertEqual(res.status_code, 201)

        # Existing customer record must remain untouched
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.full_name, "Pescador Original")
        self.assertEqual(self.customer.email, "pescador@original.com")
        self.assertEqual(self.customer.phone, "62981612128")

        # Pending details stored on challenge
        challenge = VerificationChallenge.objects.get(id=res.data["challenge_id"])
        self.assertEqual(challenge.pending_full_name, "Hacker Impostor")
        self.assertEqual(challenge.pending_email, "hacker@attack.com")

    def test_wrong_otp_attempts_durably_incremented(self):
        """
        AUTH-02: Incorrect OTP attempts must be persisted without transaction rollback bug.
        After 5 attempts, challenge must be permanently blocked.
        """
        payload = {
            "cpf": "98765432100",
            "full_name": "Novo Pescador",
            "email": "novo@pescador.com",
            "phone": "(62) 99999-0000",
        }
        res = self.client.post("/api/checkout/identify/", payload, format="json")
        self.assertEqual(res.status_code, 201)
        cid = res.data["challenge_id"]

        # 5 wrong attempts
        for attempt in range(1, 6):
            wrong = self.client.post("/api/checkout/verify/", {"challenge_id": cid, "code": "000000"}, format="json")
            self.assertEqual(wrong.status_code, 400)
            ch = VerificationChallenge.objects.get(id=cid)
            self.assertEqual(ch.attempts, attempt)

        # 6th attempt even with correct code must be blocked
        dev_code = res.data.get("dev_code", "123456")
        blocked = self.client.post("/api/checkout/verify/", {"challenge_id": cid, "code": dev_code}, format="json")
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("limite de tentativas excedido", str(blocked.data))

    def test_guest_token_versioning_and_revocation(self):
        """
        GUEST-01: Replacing a participant must increment token_version
        and revoke access for previous guest token holder.
        """
        res = Reservation.objects.create(
            customer=self.customer,
            expedition=self.expedition,
            participant_count=2,
            status=Reservation.Status.CONFIRMED,
            unit_price_cents=250000,
            total_price_cents=500000,
            deposit_cents=100000,
        )
        pax = ReservationParticipant.objects.create(
            reservation=res,
            full_name="Convidado 1",
            token_version=1,
        )
        token_v1 = create_guest_participant_token(pax)

        # Valid token access
        resolved = participant_from_guest_token(token_v1)
        self.assertEqual(resolved.id, pax.id)

        # Participant is replaced -> token_version bumped
        pax.token_version = 2
        pax.full_name = "Convidado Substituto"
        pax.save(update_fields=["token_version", "full_name"])

        # Token v1 must be rejected
        with self.assertRaises(ValidationError):
            participant_from_guest_token(token_v1)

        # Token v2 works
        token_v2 = create_guest_participant_token(pax)
        self.assertEqual(participant_from_guest_token(token_v2).full_name, "Convidado Substituto")

    def test_deposit_math_for_multiple_participants(self):
        """
        PAY-05: Deposit cents must be multiplied by participant count.
        """
        # Identify and verify
        ident = self.client.post("/api/checkout/identify/", {
            "cpf": "12345678909", "full_name": "Pescador Original",
            "email": "pescador@original.com", "phone": "62981612128"
        }, format="json")
        vtoken = self.client.post("/api/checkout/verify/", {
            "challenge_id": ident.data["challenge_id"], "code": ident.data["dev_code"]
        }, format="json").data["verification_token"]

        # Hold for 3 participants: deposit is 3 * 50000 = 150000
        hold = self.client.post("/api/checkout/hold/", {
            "verification_token": vtoken,
            "expedition_slug": self.expedition.slug,
            "participant_names": ["Pescador 1", "Pescador 2", "Pescador 3"],
            "payment_plan": "DEPOSIT",
        }, format="json")
        self.assertEqual(hold.status_code, 201)

        reservation = Reservation.objects.get(id=hold.data["reservation_id"])
        self.assertEqual(reservation.participant_count, 3)
        self.assertEqual(reservation.total_price_cents, 750000)
        self.assertEqual(reservation.deposit_cents, 150000)
        self.assertEqual(reservation.remaining_balance_cents, 750000)

    def test_occupancy_not_duplicated_by_multiple_payments(self):
        """
        CAP-01: A reservation paying both initial deposit and balance payment
        must NOT inflate occupied slots in expeditions_with_occupancy.
        """
        reservation = Reservation.objects.create(
            customer=self.customer,
            expedition=self.expedition,
            participant_count=2,
            status=Reservation.Status.CONFIRMED,
            unit_price_cents=250000,
            total_price_cents=500000,
            deposit_cents=100000,
        )
        # Payment 1: deposit
        Payment.objects.create(
            reservation=reservation,
            provider="FAKE",
            method=Payment.Method.PIX,
            purpose=Payment.Purpose.INITIAL,
            external_id="p1",
            amount_cents=100000,
            status=Payment.Status.PAID,
            paid_at=timezone.now(),
        )
        # Check occupancy with 1 payment: should be 2
        exp = expeditions_with_occupancy().get(id=self.expedition.id)
        self.assertEqual(exp.occupied_slots, 2)

        # Payment 2: balance payment
        Payment.objects.create(
            reservation=reservation,
            provider="FAKE",
            method=Payment.Method.PIX,
            purpose=Payment.Purpose.BALANCE,
            external_id="p2",
            amount_cents=400000,
            status=Payment.Status.PAID,
            paid_at=timezone.now(),
        )
        reservation.status = Reservation.Status.PAID
        reservation.save(update_fields=["status"])

        # Check occupancy with 2 payments: must STILL be 2, not 4!
        exp_after = expeditions_with_occupancy().get(id=self.expedition.id)
        self.assertEqual(exp_after.occupied_slots, 2)

    def test_card_payment_approval_and_rejection(self):
        """
        PAY-06, G-02: Card approval transitions reservation to CONFIRMED/PAID immediately.
        Card rejection marks payment FAILED but keeps reservation in HELD for retrying.
        """
        ident = self.client.post("/api/checkout/identify/", {
            "cpf": "12345678909", "full_name": "Pescador Original",
            "email": "pescador@original.com", "phone": "62981612128"
        }, format="json")
        vtoken = self.client.post("/api/checkout/verify/", {
            "challenge_id": ident.data["challenge_id"], "code": ident.data["dev_code"]
        }, format="json").data["verification_token"]

        hold = self.client.post("/api/checkout/hold/", {
            "verification_token": vtoken,
            "expedition_slug": self.expedition.slug,
            "participant_names": ["Pescador 1"],
            "payment_plan": "DEPOSIT",
        }, format="json")
        rid = hold.data["reservation_id"]

        # 1. Rejected card
        pay_reject = self.client.post("/api/payments/", {
            "verification_token": vtoken,
            "reservation_id": rid,
            "method": "CREDIT_CARD",
            "card_token": "token_rejected",
            "installments": 1,
            "payment_method_id": "visa",
        }, format="json")
        self.assertEqual(pay_reject.status_code, 201)
        self.assertEqual(pay_reject.data["status"], "FAILED")

        # Reservation MUST still be active in hold for retry (G-02)
        res = Reservation.objects.get(id=rid)
        self.assertIn(res.status, (Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT))
        self.assertGreater(res.held_until, timezone.now())

        # 2. Approved card
        pay_ok = self.client.post("/api/payments/", {
            "verification_token": vtoken,
            "reservation_id": rid,
            "method": "CREDIT_CARD",
            "card_token": "valid_token",
            "installments": 3,
            "payment_method_id": "master",
        }, format="json")
        self.assertEqual(pay_ok.status_code, 201)
        self.assertEqual(pay_ok.data["status"], "PAID")

        res.refresh_from_db()
        self.assertEqual(res.status, Reservation.Status.CONFIRMED)

    def test_boleto_with_conditional_address_and_hold_extension(self):
        """
        PAY-06, G-01: Boleto bancário saves address to CustomerProfile,
        sets reservation to AWAITING_PAYMENT, and extends held_until to 3 days.
        """
        ident = self.client.post("/api/checkout/identify/", {
            "cpf": "12345678909", "full_name": "Pescador Original",
            "email": "pescador@original.com", "phone": "62981612128"
        }, format="json")
        vtoken = self.client.post("/api/checkout/verify/", {
            "challenge_id": ident.data["challenge_id"], "code": ident.data["dev_code"]
        }, format="json").data["verification_token"]

        hold = self.client.post("/api/checkout/hold/", {
            "verification_token": vtoken,
            "expedition_slug": self.expedition.slug,
            "participant_names": ["Pescador 1"],
            "payment_plan": "DEPOSIT",
        }, format="json")
        rid = hold.data["reservation_id"]

        # Missing address must fail
        bad_boleto = self.client.post("/api/payments/", {
            "verification_token": vtoken,
            "reservation_id": rid,
            "method": "BOLETO",
        }, format="json")
        self.assertEqual(bad_boleto.status_code, 400)

        # Valid boleto with address
        addr = {
            "zip_code": "74000-000",
            "street_name": "Avenida Goiás",
            "street_number": "100",
            "neighborhood": "Central",
            "city": "Goiânia",
            "federal_unit": "GO",
            "complement": "Apto 101",
        }
        boleto = self.client.post("/api/payments/", {
            "verification_token": vtoken,
            "reservation_id": rid,
            "method": "BOLETO",
            "address": addr,
        }, format="json")
        self.assertEqual(boleto.status_code, 201)
        self.assertEqual(boleto.data["method"], "BOLETO")
        self.assertTrue(boleto.data["ticket_url"])
        self.assertTrue(boleto.data["boleto_barcode"])

        # Address saved to CustomerProfile
        profile = CustomerProfile.objects.get(customer=self.customer)
        self.assertEqual(profile.street_name, "Avenida Goiás")
        self.assertEqual(profile.city, "Goiânia")
        self.assertEqual(profile.state, "GO")

        # Reservation status is AWAITING_PAYMENT and held_until extended
        res = Reservation.objects.get(id=rid)
        self.assertEqual(res.status, Reservation.Status.AWAITING_PAYMENT)
        self.assertGreater(res.held_until, timezone.now() + timedelta(days=2))
        self.assertLessEqual(res.held_until, timezone.now() + timedelta(days=3, minutes=1))

    def test_boleto_rejected_within_7_days_of_departure(self):
        """
        Boleto rule: boletos can only be issued more than 7 days before departure.
        """
        near_exp = Expedition.objects.create(
            name="Expedição Próxima",
            destination="Araguaia",
            starts_at=timezone.localdate() + timedelta(days=4), # 4 days away!
            ends_at=timezone.localdate() + timedelta(days=8),
            capacity=4,
            price_per_person_cents=200000,
            deposit_cents=50000,
            status=Expedition.Status.PUBLISHED,
        )
        ident = self.client.post("/api/checkout/identify/", {
            "cpf": "12345678909", "full_name": "Pescador Original",
            "email": "pescador@original.com", "phone": "62981612128"
        }, format="json")
        vtoken = self.client.post("/api/checkout/verify/", {
            "challenge_id": ident.data["challenge_id"], "code": ident.data["dev_code"]
        }, format="json").data["verification_token"]

        hold = self.client.post("/api/checkout/hold/", {
            "verification_token": vtoken,
            "expedition_slug": near_exp.slug,
            "participant_names": ["Pescador 1"],
            "payment_plan": "DEPOSIT",
        }, format="json")

        addr = {
            "zip_code": "74000-000", "street_name": "Rua 1", "street_number": "10",
            "neighborhood": "Centro", "city": "Goiânia", "federal_unit": "GO"
        }
        res = self.client.post("/api/payments/", {
            "verification_token": vtoken,
            "reservation_id": hold.data["reservation_id"],
            "method": "BOLETO",
            "address": addr,
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("7 dias de antecedência", res.data["detail"] if "detail" in res.data else str(res.data))

    def test_payment_status_polling_endpoint(self):
        """
        GET /api/payments/<id>/status/ returns current payment status and metadata.
        """
        res = Reservation.objects.create(
            customer=self.customer,
            expedition=self.expedition,
            participant_count=1,
            status=Reservation.Status.AWAITING_PAYMENT,
            unit_price_cents=250000,
            total_price_cents=250000,
            deposit_cents=50000,
        )
        payment = Payment.objects.create(
            reservation=res,
            provider="FAKE",
            method=Payment.Method.PIX,
            external_id="fake_poll_1",
            amount_cents=50000,
            pix_copy_paste="000201FAKEPIX",
            status=Payment.Status.PENDING,
        )

        resp = self.client.get(f"/api/payments/{payment.id}/status/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["payment_id"], str(payment.id))
        self.assertEqual(resp.data["status"], "PENDING")
        self.assertEqual(resp.data["pix_copy_paste"], "000201FAKEPIX")

    def test_portal_reaccess_flow(self):
        """
        AUTH-03: Reaccess via OTP verification challenge.
        """
        # Step 1: Request OTP for registered CPF
        lookup = self.client.post("/api/me/auth/lookup/", {"cpf": "123.456.789-09"}, format="json")
        self.assertEqual(lookup.status_code, 200)
        self.assertEqual(lookup.data["status"], "CHALLENGE_CREATED")
        cid = lookup.data["challenge_id"]

        # Retrieve generated challenge
        challenge = VerificationChallenge.objects.get(id=cid)
        # Emulate entering wrong code
        bad = self.client.post("/api/me/auth/verify/", {"challenge_id": cid, "code": "999999"}, format="json")
        self.assertEqual(bad.status_code, 400)

        # Create known code to test verification
        from django.contrib.auth.hashers import make_password
        challenge.code_digest = make_password("654321")
        challenge.save(update_fields=["code_digest"])

        good = self.client.post("/api/me/auth/verify/", {"challenge_id": cid, "code": "654321"}, format="json")
        self.assertEqual(good.status_code, 200)
        self.assertTrue(good.data["token"])
        self.assertEqual(good.data["customer"]["email"], "pescador@original.com")
