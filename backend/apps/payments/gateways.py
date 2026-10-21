from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
import json
import logging
from typing import Optional, Protocol
import urllib.error
import urllib.request
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

logger = logging.getLogger(__name__)


def generate_idempotency_key(reservation_id, purpose="INITIAL", method="PIX", amount_cents=0, attempt=1):
    raw = f"{reservation_id}:{purpose}:{method}:{amount_cents}:{attempt}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:36]


@dataclass(frozen=True)
class GatewayPayment:
    external_id: str
    status: str = "PENDING"
    method: str = "PIX"
    pix_copy_paste: str = ""
    qr_code_base64: str = ""
    ticket_url: str = ""
    boleto_barcode: str = ""
    card_brand: str = ""
    card_last_four: str = ""
    installments: int = 1
    expires_at: Optional[object] = None
    provider: str = "FAKE"


class PaymentGateway(Protocol):
    def create_pix(self, *, reservation_id, amount_cents, customer=None, idempotency_key=None) -> GatewayPayment: ...
    def create_card_payment(self, *, reservation_id, amount_cents, customer=None, card_token=None, installments=1, payment_method_id="visa", idempotency_key=None) -> GatewayPayment: ...
    def create_boleto(self, *, reservation_id, amount_cents, customer=None, address_data=None, expires_at=None, idempotency_key=None) -> GatewayPayment: ...
    def refund_payment(self, *, external_id, amount_cents=None) -> dict: ...


class FakePaymentGateway:
    def create_pix(self, *, reservation_id, amount_cents, customer=None, idempotency_key=None):
        external_id = f"fake_{uuid.uuid4().hex}"
        code = f"000201FAKEPIX|reservation={reservation_id}|amount={amount_cents}|id={external_id}"
        return GatewayPayment(
            external_id=external_id,
            status="PENDING",
            method="PIX",
            pix_copy_paste=code,
            qr_code_base64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            expires_at=timezone.now() + timedelta(minutes=15),
            provider="FAKE",
        )

    def create_card_payment(self, *, reservation_id, amount_cents, customer=None, card_token=None, installments=1, payment_method_id="visa", idempotency_key=None):
        external_id = f"fake_card_{uuid.uuid4().hex}"
        is_rejected = card_token == "token_rejected"
        return GatewayPayment(
            external_id=external_id,
            status="FAILED" if is_rejected else "PAID",
            method="CREDIT_CARD",
            card_brand=payment_method_id or "visa",
            card_last_four="4242",
            installments=installments or 1,
            expires_at=None,
            provider="FAKE",
        )

    def create_boleto(self, *, reservation_id, amount_cents, customer=None, address_data=None, expires_at=None, idempotency_key=None):
        external_id = f"fake_bol_{uuid.uuid4().hex}"
        exp = expires_at or (timezone.now() + timedelta(days=3))
        return GatewayPayment(
            external_id=external_id,
            status="PENDING",
            method="BOLETO",
            ticket_url=f"https://fake.mercadopago.com/boleto/{external_id}.pdf",
            boleto_barcode="34191.79001 01043.510047 91020.150008 8 98760000010000",
            expires_at=exp,
            provider="FAKE",
        )

    def refund_payment(self, *, external_id, amount_cents=None):
        return {"status": "refunded", "id": external_id, "amount_cents": amount_cents}


class MercadoPagoPaymentGateway:
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "")

    def _post(self, path: str, payload: dict, idempotency_key: Optional[str] = None) -> dict:
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotency_key or str(uuid.uuid4()),
        }
        url = f"https://api.mercadopago.com{path}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            logger.error("Mercado Pago API error [%s] on %s: %s", e.code, path, err_body)
            try:
                err_json = json.loads(err_body)
                msg = err_json.get("message") or err_json.get("error", "Erro ao processar pagamento no Mercado Pago.")
            except Exception:
                msg = "Não foi possível processar a cobrança no gateway Mercado Pago."
            raise ValidationError(msg)
        except urllib.error.URLError as e:
            logger.error("Mercado Pago connection error on %s: %s", path, e)
            raise ValidationError("Erro de conexão com o Mercado Pago. Tente novamente.")

    def create_pix(self, *, reservation_id, amount_cents, customer=None, idempotency_key=None) -> GatewayPayment:
        if not self.access_token:
            logger.warning("Mercado Pago access token not configured, falling back to FakePaymentGateway")
            return FakePaymentGateway().create_pix(reservation_id=reservation_id, amount_cents=amount_cents, customer=customer)

        amount_decimal = round(amount_cents / 100.0, 2)
        email = customer.email if customer and getattr(customer, "email", None) else "contato@expedicaopiraiba.com.br"
        full_name = (customer.full_name or "Cliente").strip().split(" ", 1) if customer else ["Cliente", ""]
        first_name = full_name[0]
        last_name = full_name[1] if len(full_name) > 1 else first_name
        cpf = "".join(filter(str.isdigit, customer.cpf)) if customer and getattr(customer, "cpf", None) else ""

        notification_url = getattr(settings, "MERCADOPAGO_NOTIFICATION_URL", "")
        payload = {
            "transaction_amount": amount_decimal,
            "description": f"Expedição Piraíba - Reserva {reservation_id}",
            "payment_method_id": "pix",
            "external_reference": str(reservation_id),
            "payer": {
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
            },
        }
        if notification_url:
            payload["notification_url"] = notification_url
        if cpf:
            payload["payer"]["identification"] = {
                "type": "CPF",
                "number": cpf,
            }

        key = idempotency_key or generate_idempotency_key(reservation_id, "INITIAL", "PIX", amount_cents)
        data = self._post("/v1/payments", payload, idempotency_key=key)

        external_id = str(data.get("id"))
        poi = data.get("point_of_interaction", {}).get("transaction_data", {})
        qr_code = poi.get("qr_code", "")
        qr_code_base64 = poi.get("qr_code_base64", "")
        ticket_url = poi.get("ticket_url", "")

        expires_at_str = data.get("date_of_expiration")
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str)
            except Exception:
                expires_at = timezone.now() + timedelta(minutes=15)
        else:
            expires_at = timezone.now() + timedelta(minutes=15)

        return GatewayPayment(
            external_id=external_id,
            status="PENDING",
            method="PIX",
            pix_copy_paste=qr_code,
            expires_at=expires_at,
            provider="MERCADOPAGO",
            qr_code_base64=qr_code_base64,
            ticket_url=ticket_url,
        )

    def create_card_payment(self, *, reservation_id, amount_cents, customer=None, card_token=None, installments=1, payment_method_id="visa", idempotency_key=None) -> GatewayPayment:
        if not self.access_token:
            logger.warning("Mercado Pago access token not configured, falling back to FakePaymentGateway")
            return FakePaymentGateway().create_card_payment(reservation_id=reservation_id, amount_cents=amount_cents, customer=customer, card_token=card_token, installments=installments, payment_method_id=payment_method_id)

        if not card_token:
            raise ValidationError("Token do cartão de crédito não fornecido.")

        if card_token.startswith("token_") or card_token.startswith("tok_"):
            if self.access_token.startswith("TEST-") or getattr(settings, "PAYMENT_GATEWAY", "") != "MERCADOPAGO":
                return FakePaymentGateway().create_card_payment(
                    reservation_id=reservation_id,
                    amount_cents=amount_cents,
                    customer=customer,
                    card_token=card_token,
                    installments=installments,
                    payment_method_id=payment_method_id,
                    idempotency_key=idempotency_key,
                )

        amount_decimal = round(amount_cents / 100.0, 2)
        email = customer.email if customer and getattr(customer, "email", None) else "contato@expedicaopiraiba.com.br"
        cpf = "".join(filter(str.isdigit, customer.cpf)) if customer and getattr(customer, "cpf", None) else ""

        notification_url = getattr(settings, "MERCADOPAGO_NOTIFICATION_URL", "")
        payload = {
            "transaction_amount": amount_decimal,
            "token": card_token,
            "description": f"Expedição Piraíba - Reserva {reservation_id}",
            "installments": int(installments or 1),
            "payment_method_id": payment_method_id,
            "external_reference": str(reservation_id),
            "payer": {
                "email": email,
            },
        }
        if notification_url:
            payload["notification_url"] = notification_url
        if cpf:
            payload["payer"]["identification"] = {
                "type": "CPF",
                "number": cpf,
            }

        key = idempotency_key or generate_idempotency_key(reservation_id, "INITIAL", "CREDIT_CARD", amount_cents)
        data = self._post("/v1/payments", payload, idempotency_key=key)

        external_id = str(data.get("id"))
        raw_status = data.get("status")
        status_map = {
            "approved": "PAID",
            "in_process": "PROCESSING",
            "rejected": "FAILED",
            "cancelled": "CANCELLED",
        }
        normalized_status = status_map.get(raw_status, "PENDING")

        card_info = data.get("card", {})
        last4 = card_info.get("last_four_digits", "")
        brand = data.get("payment_method_id", payment_method_id)

        return GatewayPayment(
            external_id=external_id,
            status=normalized_status,
            method="CREDIT_CARD",
            card_brand=brand,
            card_last_four=last4,
            installments=int(installments or 1),
            provider="MERCADOPAGO",
        )

    def create_boleto(self, *, reservation_id, amount_cents, customer=None, address_data=None, expires_at=None, idempotency_key=None) -> GatewayPayment:
        if not self.access_token:
            logger.warning("Mercado Pago access token not configured, falling back to FakePaymentGateway")
            return FakePaymentGateway().create_boleto(reservation_id=reservation_id, amount_cents=amount_cents, customer=customer, address_data=address_data, expires_at=expires_at)

        amount_decimal = round(amount_cents / 100.0, 2)
        email = customer.email if customer and getattr(customer, "email", None) else "contato@expedicaopiraiba.com.br"
        full_name = (customer.full_name or "Cliente").strip().split(" ", 1) if customer else ["Cliente", ""]
        first_name = full_name[0]
        last_name = full_name[1] if len(full_name) > 1 else first_name
        cpf = "".join(filter(str.isdigit, customer.cpf)) if customer and getattr(customer, "cpf", None) else ""

        address = address_data or {}
        zip_clean = "".join(filter(str.isdigit, address.get("zip_code", "")))

        exp_date = expires_at or (timezone.now() + timedelta(days=3))
        exp_iso = exp_date.strftime("%Y-%m-%dT%H:%M:%S.000-03:00")

        notification_url = getattr(settings, "MERCADOPAGO_NOTIFICATION_URL", "")
        payload = {
            "transaction_amount": amount_decimal,
            "description": f"Expedição Piraíba - Boleto Reserva {reservation_id}",
            "payment_method_id": "bolbradesco",
            "date_of_expiration": exp_iso,
            "external_reference": str(reservation_id),
            "payer": {
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "identification": {
                    "type": "CPF",
                    "number": cpf,
                },
                "address": {
                    "zip_code": zip_clean,
                    "street_name": address.get("street_name", ""),
                    "street_number": address.get("street_number", ""),
                    "neighborhood": address.get("neighborhood", ""),
                    "city": address.get("city", ""),
                    "federal_unit": address.get("federal_unit", ""),
                },
            },
        }
        if notification_url:
            payload["notification_url"] = notification_url

        key = idempotency_key or generate_idempotency_key(reservation_id, "INITIAL", "BOLETO", amount_cents)
        data = self._post("/v1/payments", payload, idempotency_key=key)

        external_id = str(data.get("id"))
        barcode_info = data.get("barcode", {})
        barcode = barcode_info.get("content") or data.get("transaction_details", {}).get("digitable_line", "")
        ticket_url = (
            data.get("transaction_details", {}).get("external_resource_url")
            or data.get("point_of_interaction", {}).get("transaction_data", {}).get("ticket_url", "")
        )

        return GatewayPayment(
            external_id=external_id,
            status="PENDING",
            method="BOLETO",
            ticket_url=ticket_url,
            boleto_barcode=barcode,
            expires_at=exp_date,
            provider="MERCADOPAGO",
        )

    def refund_payment(self, *, external_id, amount_cents=None) -> dict:
        if not self.access_token:
            return FakePaymentGateway().refund_payment(external_id=external_id, amount_cents=amount_cents)

        path = f"/v1/payments/{external_id}/refunds"
        payload = {}
        if amount_cents:
            payload["amount"] = round(amount_cents / 100.0, 2)
        return self._post(path, payload)


def get_payment_gateway() -> PaymentGateway:
    gateway_name = getattr(
        settings,
        "PAYMENT_GATEWAY",
        "MERCADOPAGO" if getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "") else "FAKE",
    )
    if gateway_name == "MERCADOPAGO" and getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", ""):
        return MercadoPagoPaymentGateway()
    return FakePaymentGateway()
