from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.customers.models import Customer
from apps.expeditions.models import Expedition
from apps.reservations.models import Reservation
from apps.reservations.services import create_hold, transition_reservation

from .gateways import GatewayUncertainError
from .models import FeeRate, Payment, PaymentIntent, RefundRequest
from .pricing import create_fee_quote, gross_for_fee
from .refunds import request_refund, submit_refund
from .services import create_reservation_payment, process_paid_event, simulate_paid_event


@override_settings(PAYMENT_GATEWAY="FAKE", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class FeeAndRefundTests(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(cpf="52998224725", full_name="Cliente Teste", email="cliente@example.com", phone="62999999999")
        self.expedition = Expedition.objects.create(
            name="Teste taxas", destination="Goiânia/GO", starts_at=timezone.localdate() + timedelta(days=30),
            ends_at=timezone.localdate() + timedelta(days=33), capacity=4,
            price_per_person_cents=200000, deposit_cents=50000, status=Expedition.Status.PUBLISHED,
        )

    def test_gross_up_and_quote_snapshot(self):
        self.assertEqual(gross_for_fee(200000, Decimal("4.98"), 0), 210483)
        self.assertEqual(gross_for_fee(200000, Decimal("0.99"), 0), 202000)
        rate = FeeRate.objects.get(method="CREDIT_CARD", installments=2)
        quote = create_fee_quote(
            customer=self.customer, expedition_slug=self.expedition.slug, participant_names=["Pescador Teste"],
            payment_plan="FULL", method="CREDIT_CARD", installments=2,
        )
        self.assertEqual(quote.base_cents, 200000)
        self.assertEqual(quote.total_cents, gross_for_fee(200000, rate.percent, 0))
        rate.percent = Decimal("8.0000")
        rate.version += 1
        rate.save()
        self.assertEqual(quote.rate_snapshot["percent"], "7.5100")

    def test_timeout_keeps_durable_intent_and_recovers_pending_pix(self):
        quote = create_fee_quote(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", method="PIX")
        reservation = create_hold(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", quote_id=quote.id, contract_accepted=True)
        with patch("apps.payments.services.get_payment_gateway") as gateway:
            gateway.return_value.create_pix.side_effect = GatewayUncertainError("timeout")
            with self.assertRaises(GatewayUncertainError):
                create_reservation_payment(customer=self.customer, reservation_id=reservation.id, quote_id=quote.id)
        intent = PaymentIntent.objects.get(reservation=reservation)
        self.assertEqual(intent.status, "UNKNOWN")
        with self.assertRaises(ValidationError):
            create_reservation_payment(customer=self.customer, reservation_id=reservation.id, quote_id=quote.id)
        from .views import _recover_unknown_intent
        payment = _recover_unknown_intent("987654321", {
            "id": 987654321, "external_reference": str(intent.id), "currency_id": "BRL",
            "transaction_amount": quote.total_cents / 100, "status": "pending",
            "point_of_interaction": {"transaction_data": {"qr_code": "PIX-RECOVERED"}},
        })
        self.assertIsNotNone(payment)
        self.assertEqual(payment.pix_copy_paste, "PIX-RECOVERED")
        self.assertEqual(PaymentIntent.objects.get(id=intent.id).status, "COMPLETE")
        self.assertEqual(create_reservation_payment(customer=self.customer, reservation_id=reservation.id,
            quote_id=quote.id).id, payment.id)

    def test_rejected_request_releases_intent_for_fresh_quote(self):
        quote = create_fee_quote(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", method="PIX")
        reservation = create_hold(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", quote_id=quote.id, contract_accepted=True)
        with patch("apps.payments.services.get_payment_gateway") as gateway:
            gateway.return_value.create_pix.side_effect = ValidationError("rejected")
            with self.assertRaises(ValidationError):
                create_reservation_payment(customer=self.customer, reservation_id=reservation.id, quote_id=quote.id)
        self.assertEqual(PaymentIntent.objects.get(reservation=reservation).status, "FAILED")
        fresh = create_fee_quote(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", method="PIX",
            reservation_id=reservation.id)
        self.assertEqual(fresh.reservation_id, reservation.id)

    def test_same_amount_with_different_quote_does_not_reuse_pix(self):
        first_quote = create_fee_quote(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", method="PIX")
        reservation = create_hold(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", quote_id=first_quote.id, contract_accepted=True)
        second_quote = create_fee_quote(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", method="PIX",
            reservation_id=reservation.id)
        self.assertEqual(first_quote.total_cents, second_quote.total_cents)
        payment = create_reservation_payment(customer=self.customer, reservation_id=reservation.id,
            quote_id=first_quote.id)
        self.assertEqual(create_reservation_payment(customer=self.customer, reservation_id=reservation.id,
            quote_id=first_quote.id).id, payment.id)
        with self.assertRaises(ValidationError):
            create_reservation_payment(customer=self.customer, reservation_id=reservation.id,
                quote_id=second_quote.id)

    def test_reconcile_lost_provider_response_while_pix_is_pending(self):
        quote = create_fee_quote(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", method="PIX")
        reservation = create_hold(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", quote_id=quote.id, contract_accepted=True)
        intent = PaymentIntent.objects.create(reservation=reservation, quote=quote, method="PIX",
            amount_cents=quote.total_cents, base_amount_cents=quote.base_cents,
            fee_amount_cents=quote.fee_cents, fee_snapshot=quote.rate_snapshot,
            idempotency_key="pending-intent-test", created_at=timezone.now() - timedelta(minutes=2))
        PaymentIntent.objects.filter(id=intent.id).update(created_at=timezone.now() - timedelta(minutes=2))
        row = {"id": 12345, "external_reference": str(intent.id), "currency_id": "BRL",
            "transaction_amount": quote.total_cents / 100, "status": "pending",
            "point_of_interaction": {"transaction_data": {"qr_code": "PIX-FROM-MP"}}}
        from .reconciliation import reconcile_unknown_intents
        with override_settings(PAYMENT_GATEWAY="MERCADOPAGO"):
            with patch("apps.payments.reconciliation._get", side_effect=[{"results": [row]}, row]):
                self.assertEqual(reconcile_unknown_intents(), 1)
        intent.refresh_from_db(); reservation.refresh_from_db()
        self.assertEqual(intent.status, "COMPLETE")
        self.assertEqual(intent.payment.pix_copy_paste, "PIX-FROM-MP")
        self.assertEqual(reservation.status, Reservation.Status.AWAITING_PAYMENT)

    def test_expired_balance_pix_requires_provider_terminal_status(self):
        reservation = create_hold(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="DEPOSIT")
        reservation.status = Reservation.Status.CONFIRMED
        reservation.save(update_fields=["status"])
        old = Payment.objects.create(reservation=reservation, purpose=Payment.Purpose.BALANCE,
            method=Payment.Method.PIX, provider="MERCADOPAGO", external_id="old-pix-123",
            amount_cents=10000, base_amount_cents=9900,
            expires_at=timezone.now() - timedelta(minutes=1))
        from .reconciliation import refresh_pending_balance_payment
        with override_settings(PAYMENT_GATEWAY="MERCADOPAGO"):
            with patch("apps.payments.reconciliation._get", return_value={
                "id": "old-pix-123", "external_reference": str(reservation.id), "status": "pending",
            }):
                refresh_pending_balance_payment(reservation)
            old.refresh_from_db()
            self.assertEqual(old.status, Payment.Status.PENDING)
            with patch("apps.payments.reconciliation._get", return_value={
                "id": "old-pix-123", "external_reference": str(reservation.id), "status": "cancelled",
            }):
                refresh_pending_balance_payment(reservation)
        old.refresh_from_db()
        self.assertEqual(old.status, Payment.Status.CANCELLED)

    def test_late_approved_payment_is_recorded_and_can_be_refunded(self):
        quote = create_fee_quote(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", method="PIX")
        reservation = create_hold(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", quote_id=quote.id, contract_accepted=True)
        payment = create_reservation_payment(customer=self.customer, reservation_id=reservation.id, quote_id=quote.id)
        transition_reservation(reservation_id=reservation.id, target_status=Reservation.Status.EXPIRED)
        simulate_paid_event(payment)
        payment.refresh_from_db(); reservation.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)
        self.assertEqual(reservation.status, Reservation.Status.EXPIRED)
        transition_reservation(reservation_id=reservation.id, target_status=Reservation.Status.CANCELLED)
        refund = request_refund(payment_id=payment.id, amount_cents=payment.amount_cents,
            basis="ORGANIZADOR", reason="Pagamento após expiração", calculation="", actor="admin-test")
        self.assertEqual(refund.status, RefundRequest.Status.REQUESTED)

    def test_approved_excess_is_in_ledger_and_refundable_without_cancelling_booking(self):
        quote = create_fee_quote(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", method="PIX")
        reservation = create_hold(customer=self.customer, expedition_slug=self.expedition.slug,
            participant_names=["Pescador Teste"], payment_plan="FULL", quote_id=quote.id, contract_accepted=True)
        first = create_reservation_payment(customer=self.customer, reservation_id=reservation.id, quote_id=quote.id)
        simulate_paid_event(first)
        excess = Payment.objects.create(reservation=reservation, provider="FAKE", external_id="excess-approved-1",
            method=Payment.Method.PIX, amount_cents=10000, base_amount_cents=9900,
            fee_amount_cents=100)
        process_paid_event(external_event_id="excess-event-1", external_payment_id=excess.external_id,
            payload={"status": "approved"})
        excess.refresh_from_db(); reservation.refresh_from_db()
        self.assertEqual(excess.status, Payment.Status.PAID)
        self.assertEqual(reservation.paid_amount_cents, reservation.total_price_cents)
        self.assertEqual(reservation.status, Reservation.Status.PAID)
        refund = request_refund(payment_id=excess.id, amount_cents=excess.amount_cents,
            basis="OVERPAYMENT", reason="Cobrança excedente", calculation="", actor="admin-test")
        self.assertEqual(submit_refund(refund.id).status, RefundRequest.Status.CONFIRMED)
        reservation.refresh_from_db()
        self.assertEqual(reservation.paid_amount_cents, reservation.total_price_cents)
        self.assertEqual(reservation.status, Reservation.Status.PAID)

    def test_partial_then_full_refund_counts_service_once(self):
        quote = create_fee_quote(
            customer=self.customer, expedition_slug=self.expedition.slug, participant_names=["Pescador Teste"],
            payment_plan="FULL", method="CREDIT_CARD", installments=1,
        )
        reservation = create_hold(
            customer=self.customer, expedition_slug=self.expedition.slug, participant_names=["Pescador Teste"],
            payment_plan="FULL", quote_id=quote.id, contract_accepted=True,
        )
        self.assertEqual(reservation.contract_version, "1.0")
        self.assertEqual(reservation.accepted_quote_snapshot["total_cents"], quote.total_cents)
        payment = create_reservation_payment(
            customer=self.customer, reservation_id=reservation.id, method=Payment.Method.CREDIT_CARD,
            card_token="fake-token", payment_method_id="visa", quote_id=quote.id,
        )
        reservation.refresh_from_db()
        self.assertEqual(payment.amount_cents, quote.total_cents)
        self.assertEqual(payment.base_amount_cents, 200000)
        self.assertEqual(reservation.paid_amount_cents, 200000)
        Reservation.objects.filter(id=reservation.id).update(created_at=timezone.now() - timedelta(days=8))
        transition_reservation(reservation_id=reservation.id, target_status=Reservation.Status.CANCELLED)
        first = request_refund(
            payment_id=payment.id, amount_cents=10000, basis="DESISTENCIA",
            reason="Desistência", calculation="Custos demonstrados", actor="admin-test",
        )
        first = submit_refund(first.id)
        self.assertEqual(first.status, RefundRequest.Status.CONFIRMED)
        payment.refresh_from_db(); reservation.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)
        self.assertEqual(reservation.paid_amount_cents, 200000 - first.service_refund_cents)
        self.assertEqual(reservation.remaining_balance_cents, 0)
        remaining = payment.amount_cents - first.amount_cents
        second = request_refund(
            payment_id=payment.id, amount_cents=remaining, basis="ARREPENDIMENTO",
            reason="Dentro do prazo legal", calculation="", actor="admin-test",
        )
        second = submit_refund(second.id)
        self.assertEqual(second.status, RefundRequest.Status.CONFIRMED)
        self.assertEqual(submit_refund(second.id).status, RefundRequest.Status.CONFIRMED)
        payment.refresh_from_db(); reservation.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.REFUNDED)
        self.assertEqual(reservation.status, Reservation.Status.REFUNDED)
        self.assertEqual(reservation.paid_amount_cents, 0)
        with self.assertRaises(ValidationError):
            request_refund(payment_id=payment.id, amount_cents=1, basis="ARREPENDIMENTO", reason="Duplicado", calculation="", actor="admin-test")
