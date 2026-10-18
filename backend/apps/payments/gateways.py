from dataclasses import dataclass
from datetime import datetime, timedelta
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


@dataclass(frozen=True)
class GatewayPayment:
    external_id: str
    pix_copy_paste: str
    expires_at: object
    provider: str = "FAKE"
    qr_code_base64: str = ""
    ticket_url: str = ""


class PaymentGateway(Protocol):
    def create_pix(self, *, reservation_id, amount_cents, customer=None) -> GatewayPayment: ...


class FakePaymentGateway:
    def create_pix(self, *, reservation_id, amount_cents, customer=None):
        external_id = f"fake_{uuid.uuid4().hex}"
        code = f"000201FAKEPIX|reservation={reservation_id}|amount={amount_cents}|id={external_id}"
        return GatewayPayment(
            external_id=external_id,
            pix_copy_paste=code,
            expires_at=timezone.now() + timedelta(minutes=15),
            provider="FAKE",
        )


class MercadoPagoPaymentGateway:
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "")

    def create_pix(self, *, reservation_id, amount_cents, customer=None) -> GatewayPayment:
        if not self.access_token:
            logger.warning("Mercado Pago access token not configured, falling back to FakePaymentGateway")
            return FakePaymentGateway().create_pix(reservation_id=reservation_id, amount_cents=amount_cents, customer=customer)

        amount_decimal = round(amount_cents / 100.0, 2)
        email = customer.email if customer and getattr(customer, "email", None) else "contato@expedicaopiraiba.com.br"
        full_name = (customer.full_name or "Cliente").strip().split(" ", 1) if customer else ["Cliente", ""]
        first_name = full_name[0]
        last_name = full_name[1] if len(full_name) > 1 else first_name
        cpf = "".join(filter(str.isdigit, customer.cpf)) if customer and getattr(customer, "cpf", None) else ""

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
        if cpf:
            payload["payer"]["identification"] = {
                "type": "CPF",
                "number": cpf,
            }

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": str(uuid.uuid4()),
        }

        req = urllib.request.Request(
            "https://api.mercadopago.com/v1/payments",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            logger.error("Mercado Pago payment creation error [%s]: %s", e.code, err_body)
            raise ValidationError("Não foi possível gerar a cobrança PIX no Mercado Pago.")
        except urllib.error.URLError as e:
            logger.error("Mercado Pago connection error: %s", e)
            raise ValidationError("Erro de conexão com o Mercado Pago. Tente novamente.")

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
            pix_copy_paste=qr_code,
            expires_at=expires_at,
            provider="MERCADOPAGO",
            qr_code_base64=qr_code_base64,
            ticket_url=ticket_url,
        )


def get_payment_gateway() -> PaymentGateway:
    gateway_name = getattr(
        settings,
        "PAYMENT_GATEWAY",
        "MERCADOPAGO" if getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "") else "FAKE",
    )
    if gateway_name == "MERCADOPAGO" and getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", ""):
        return MercadoPagoPaymentGateway()
    return FakePaymentGateway()
