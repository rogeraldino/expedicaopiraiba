from datetime import date

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.expeditions.models import Expedition
from apps.reservations.models import Reservation
from apps.customers.services import create_customer_session_token

from .models import Payment, PaymentTransaction


@override_settings(DEBUG=True, FAKE_WEBHOOK_SECRET="test-secret", PAYMENT_GATEWAY="FAKE")
class PaymentApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expedition = Expedition.objects.create(
            name="Rio Araguaia", destination="Luiz Alves/GO",
            starts_at=date(2026, 10, 18), ends_at=date(2026, 10, 22),
            capacity=8, price_per_person_cents=249000, deposit_cents=120000,
            status=Expedition.Status.PUBLISHED,
        )
        identity = {"cpf": "529.982.247-25", "full_name": "João da Silva", "email": "joao@example.com", "phone": "(62) 99999-9999"}
        identified = self.client.post("/api/checkout/identify/", identity, format="json")
        verified = self.client.post("/api/checkout/verify/", {"challenge_id": identified.data["challenge_id"], "code": identified.data["dev_code"]}, format="json")
        self.token = verified.data["verification_token"]

    def create_hold_and_payment(self, plan="DEPOSIT"):
        hold = self.client.post("/api/checkout/hold/", {"verification_token": self.token, "expedition_slug": self.expedition.slug, "participant_names": ["João", "Pedro"], "payment_plan": plan}, format="json")
        payment = self.client.post("/api/payments/", {"verification_token": self.token, "reservation_id": hold.data["reservation_id"]}, format="json")
        return hold, payment

    def test_creates_pix_and_simulation_confirms_reservation(self):
        hold, payment = self.create_hold_and_payment()
        self.assertEqual(payment.status_code, 201)
        self.assertEqual(payment.data["amount_cents"], 240000)
        self.assertIn("FAKEPIX", payment.data["pix_copy_paste"])
        confirmed = self.client.post(f"/api/payments/{payment.data['payment_id']}/simulate-confirmation/", {"verification_token": self.token}, format="json")
        self.assertEqual(confirmed.status_code, 200)
        self.assertTrue(confirmed.data["customer_session_token"])
        self.assertEqual(confirmed.data["reservation_id"], hold.data["reservation_id"])
        reservation = Reservation.objects.get(id=hold.data["reservation_id"])
        self.assertEqual(reservation.status, Reservation.Status.CONFIRMED)
        self.assertEqual(reservation.paid_amount_cents, 240000)
        self.assertEqual(reservation.remaining_balance_cents, 258000)
        self.assertTrue(reservation.events.filter(event_type="PAYMENT_CONFIRMED").exists())

    def test_webhook_is_authenticated_and_idempotent(self):
        _, created = self.create_hold_and_payment()
        payment = Payment.objects.get(id=created.data["payment_id"])
        payload = {"event_id": "evt-001", "external_payment_id": payment.external_id, "status": "PAID"}
        denied = self.client.post("/api/payments/webhooks/fake/", payload, format="json")
        self.assertEqual(denied.status_code, 401)
        first = self.client.post("/api/payments/webhooks/fake/", payload, format="json", HTTP_X_FAKE_WEBHOOK_SECRET="test-secret")
        second = self.client.post("/api/payments/webhooks/fake/", payload, format="json", HTTP_X_FAKE_WEBHOOK_SECRET="test-secret")
        self.assertTrue(first.data["processed"])
        self.assertFalse(second.data["processed"])
        self.assertEqual(PaymentTransaction.objects.filter(external_event_id="evt-001").count(), 1)

    def test_full_payment_marks_reservation_paid(self):
        hold, payment = self.create_hold_and_payment("FULL")
        self.client.post(f"/api/payments/{payment.data['payment_id']}/simulate-confirmation/", {"verification_token": self.token}, format="json")
        self.assertEqual(Reservation.objects.get(id=hold.data["reservation_id"]).status, Reservation.Status.PAID)

    def test_balance_payment_is_exact_reused_and_completes_reservation(self):
        hold, created = self.create_hold_and_payment()
        self.client.post(f"/api/payments/{created.data['payment_id']}/simulate-confirmation/", {"verification_token": self.token}, format="json")
        reservation = Reservation.objects.get(id=hold.data["reservation_id"])
        auth = {"HTTP_AUTHORIZATION": f"Bearer {create_customer_session_token(reservation.customer)}"}
        url = f"/api/me/reservations/{reservation.id}/balance-payment/"
        first = self.client.post(url, format="json", **auth)
        second = self.client.post(url, format="json", **auth)
        self.assertEqual(first.data["payment_id"], second.data["payment_id"])
        self.assertEqual(first.data["amount_cents"], reservation.remaining_balance_cents)
        confirmed = self.client.post(url + "confirm/", format="json", **auth)
        self.assertEqual(confirmed.data["reservation_status"], Reservation.Status.PAID)

    def test_balance_payment_of_another_customer_is_hidden_as_404(self):
        hold, _ = self.create_hold_and_payment()
        from apps.customers.models import Customer
        other = Customer.objects.create(cpf="11144477735", full_name="Outro", email="other@example.com", phone="62988887777")
        auth = {"HTTP_AUTHORIZATION": f"Bearer {create_customer_session_token(other)}"}
        self.assertEqual(self.client.post(f"/api/me/reservations/{hold.data['reservation_id']}/balance-payment/", format="json", **auth).status_code, 404)

    def test_mercadopago_gateway_create_pix(self):
        import json
        from unittest.mock import patch, MagicMock
        from .gateways import MercadoPagoPaymentGateway

        data = {
            "id": 999888777,
            "status": "pending",
            "date_of_expiration": "2026-10-19T18:00:00.000-03:00",
            "point_of_interaction": {
                "transaction_data": {
                    "qr_code": "00020126510014br.gov.bcb.pix...",
                    "qr_code_base64": "base64png...",
                    "ticket_url": "https://mercadopago.com/ticket",
                }
            },
        }
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_resp.read.return_value = json.dumps(data).encode("utf-8")

        mock_cm = MagicMock()
        mock_cm.__enter__.return_value = mock_resp
        mock_cm.__exit__.return_value = False

        with patch("urllib.request.urlopen", return_value=mock_cm) as mock_urlopen:
            gateway = MercadoPagoPaymentGateway(access_token="test-mp-token")
            customer = MagicMock()
            customer.email = "test@example.com"
            customer.full_name = "Cliente Teste"
            customer.cpf = "12345678909"

            payment = gateway.create_pix(
                reservation_id="res-123",
                amount_cents=150000,
                customer=customer,
            )
            self.assertEqual(payment.external_id, "999888777")
            self.assertEqual(payment.provider, "MERCADOPAGO")
            self.assertEqual(payment.pix_copy_paste, "00020126510014br.gov.bcb.pix...")
            self.assertEqual(payment.qr_code_base64, "base64png...")
            self.assertEqual(payment.ticket_url, "https://mercadopago.com/ticket")
            mock_urlopen.assert_called_once()

    @override_settings(MERCADOPAGO_ACCESS_TOKEN="test-token")
    def test_payment_status_view_active_auto_heal(self):
        import json
        from unittest.mock import patch, MagicMock

        hold, created = self.create_hold_and_payment()
        payment = Payment.objects.get(id=created.data["payment_id"])
        payment.provider = "MERCADOPAGO"
        payment.external_id = "mp_pay_99999"
        payment.pix_qr_code_base64 = ""
        payment.save()

        payment_data = {
            "id": "mp_pay_99999",
            "status": "approved",
            "point_of_interaction": {
                "transaction_data": {
                    "qr_code_base64": "auto_heal_qr_base64_png"
                }
            }
        }

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(payment_data).encode("utf-8")
        mock_cm = MagicMock()
        mock_cm.__enter__.return_value = mock_resp
        mock_cm.__exit__.return_value = False

        with patch("urllib.request.urlopen", return_value=mock_cm):
            resp = self.client.get(f"/api/payments/{payment.id}/status/")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.data["status"], "PAID")
            self.assertEqual(resp.data["reservation_status"], "CONFIRMED")
            self.assertEqual(resp.data["pix_qr_code_base64"], "auto_heal_qr_base64_png")

            payment.refresh_from_db()
            self.assertEqual(payment.status, Payment.Status.PAID)
            self.assertEqual(payment.pix_qr_code_base64, "auto_heal_qr_base64_png")
            reservation = Reservation.objects.get(id=hold.data["reservation_id"])
            self.assertEqual(reservation.status, Reservation.Status.CONFIRMED)

    @override_settings(MERCADOPAGO_ACCESS_TOKEN="test-token", MERCADOPAGO_WEBHOOK_SECRET="secret123")
    def test_mercadopago_webhook_without_signature_authenticates_direct(self):
        import json
        from unittest.mock import patch, MagicMock

        hold, created = self.create_hold_and_payment()
        payment = Payment.objects.get(id=created.data["payment_id"])

        payment_data = {
            "id": payment.external_id,
            "status": "approved",
            "currency_id": "BRL",
            "transaction_amount": payment.amount_cents / 100.0,
            "external_reference": str(hold.data["reservation_id"]),
        }

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(payment_data).encode("utf-8")
        mock_cm = MagicMock()
        mock_cm.__enter__.return_value = mock_resp
        mock_cm.__exit__.return_value = False

        with patch("urllib.request.urlopen", return_value=mock_cm):
            payload = {"type": "payment", "data": {"id": payment.external_id}}
            resp = self.client.post("/api/webhooks/mercadopago/", payload, format="json")
            self.assertEqual(resp.status_code, 200)

            payment.refresh_from_db()
            self.assertEqual(payment.status, Payment.Status.PAID)

    @override_settings(MERCADOPAGO_ACCESS_TOKEN="test-token", MERCADOPAGO_WEBHOOK_SECRET="secret123")
    def test_mercadopago_webhook_approves_payment(self):
        import json
        from unittest.mock import patch, MagicMock
        import hashlib, hmac

        hold, created = self.create_hold_and_payment()
        payment = Payment.objects.get(id=created.data["payment_id"])

        payment_data = {
            "id": payment.external_id,
            "status": "approved",
            "currency_id": "BRL",
            "transaction_amount": payment.amount_cents / 100.0,
            "external_reference": str(hold.data["reservation_id"]),
        }

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(payment_data).encode("utf-8")
        mock_cm = MagicMock()
        mock_cm.__enter__.return_value = mock_resp
        mock_cm.__exit__.return_value = False

        # Build valid signature
        data_id = payment.external_id
        req_id = "req-test-uuid"
        ts = "1792361000"
        canonical = f"id:{data_id};request-id:{req_id};ts:{ts};"
        v1 = hmac.new(b"secret123", canonical.encode("utf-8"), hashlib.sha256).hexdigest()
        sig_header = f"ts={ts},v1={v1}"

        with patch("urllib.request.urlopen", return_value=mock_cm):
            payload = {"type": "payment", "data": {"id": data_id}}
            resp = self.client.post(
                "/api/webhooks/mercadopago/",
                payload,
                format="json",
                HTTP_X_SIGNATURE=sig_header,
                HTTP_X_REQUEST_ID=req_id,
            )
            self.assertEqual(resp.status_code, 200)

            payment.refresh_from_db()
            self.assertEqual(payment.status, Payment.Status.PAID)
            reservation = Reservation.objects.get(id=hold.data["reservation_id"])
            self.assertEqual(reservation.status, Reservation.Status.CONFIRMED)
