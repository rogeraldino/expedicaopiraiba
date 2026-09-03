import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Protocol

from django.utils import timezone


@dataclass(frozen=True)
class GatewayPayment:
    external_id: str
    pix_copy_paste: str
    expires_at: object


class PaymentGateway(Protocol):
    def create_pix(self, *, reservation_id, amount_cents) -> GatewayPayment: ...


class FakePaymentGateway:
    def create_pix(self, *, reservation_id, amount_cents):
        external_id = f"fake_{uuid.uuid4().hex}"
        code = f"000201FAKEPIX|reservation={reservation_id}|amount={amount_cents}|id={external_id}"
        return GatewayPayment(external_id=external_id, pix_copy_paste=code, expires_at=timezone.now() + timedelta(minutes=15))
