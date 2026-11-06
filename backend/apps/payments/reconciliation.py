"""Read-only Mercado Pago lookups that settle interrupted local payment writes."""
import json
import logging
from datetime import datetime
from datetime import timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from apps.reservations.models import Reservation

from .models import Payment, PaymentIntent

logger = logging.getLogger(__name__)


def _get(path):
    token = getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "")
    if not token:
        raise RuntimeError("Mercado Pago token unavailable")
    request = Request("https://api.mercadopago.com" + path,
                      headers={"Authorization": f"Bearer {token}"})
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def refresh_pending_balance_payment(reservation):
    """Release an old balance Pix only after the provider confirms terminal status."""
    if getattr(settings, "PAYMENT_GATEWAY", "FAKE") != "MERCADOPAGO":
        return
    for payment in reservation.payments.filter(
        purpose=Payment.Purpose.BALANCE,
        status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING),
    ):
        if not payment.expires_at or payment.expires_at > timezone.now():
            continue
        try:
            data = _get(f"/v1/payments/{payment.external_id}")
            if str(data.get("id")) != payment.external_id or str(data.get("external_reference")) not in (
                str(reservation.id), str(payment.paymentintent.id) if hasattr(payment, "paymentintent") else "",
            ):
                continue
            status = data.get("status")
            if status == "approved":
                from .services import process_paid_event
                process_paid_event(external_event_id=f"reconciled_{payment.external_id}_approved",
                    external_payment_id=payment.external_id, payload=data)
            elif status in ("cancelled", "rejected"):
                payment.status = Payment.Status.CANCELLED if status == "cancelled" else Payment.Status.FAILED
                payment.save(update_fields=["status", "updated_at"])
        except Exception as error:
            logger.warning("Could not refresh balance Pix %s: %s", payment.id, error)


def reconcile_unknown_intents():
    """Find provider payments by the durable external reference after a lost response."""
    if getattr(settings, "PAYMENT_GATEWAY", "FAKE") != "MERCADOPAGO":
        return 0
    from .views import _recover_unknown_intent
    from .services import process_paid_event
    count = 0
    cutoff = timezone.now() - timedelta(seconds=30)
    intents = PaymentIntent.objects.filter(status__in=("SUBMITTING", "UNKNOWN"), created_at__lt=cutoff).order_by("created_at")[:100]
    for intent in intents:
        params = urlencode({"external_reference": str(intent.id), "sort": "date_created", "criteria": "desc", "limit": 10})
        try:
            result = _get(f"/v1/payments/search?{params}")
            rows = [row for row in result.get("results", []) if str(row.get("external_reference")) == str(intent.id)]
            if len(rows) > 1:
                logger.error("Multiple provider payments for intent %s", intent.id)
                continue
            if rows:
                provider_id = rows[0]["id"]
            elif intent.method in (Payment.Method.PIX, Payment.Method.BOLETO):
                with transaction.atomic():
                    reservation = Reservation.objects.select_for_update().select_related("customer").get(id=intent.reservation_id)
                    locked = PaymentIntent.objects.select_for_update().get(id=intent.id)
                    if locked.status not in ("SUBMITTING", "UNKNOWN"):
                        continue
                    if reservation.status not in (Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT) or not reservation.held_until or reservation.held_until <= timezone.now():
                        logger.warning("Intent %s has no provider result and its hold ended; operator review required", intent.id)
                        continue
                    # Hold the reservation lock through POST: expiration cannot
                    # race between the check and creation of the instrument.
                    from .gateways import get_payment_gateway
                    gateway = get_payment_gateway()
                    arguments = dict(reservation_id=intent.reservation_id, amount_cents=intent.amount_cents,
                        customer=reservation.customer, idempotency_key=intent.idempotency_key,
                        external_reference=str(intent.id))
                    if intent.method == Payment.Method.PIX:
                        provider_id = gateway.create_pix(**arguments).external_id
                    else:
                        expiry = datetime.fromisoformat(intent.request_data["expires_at"])
                        if expiry <= timezone.now():
                            continue
                        provider_id = gateway.create_boleto(**arguments,
                            address_data=intent.request_data["address"], expires_at=expiry).external_id
            else:
                logger.warning("Card intent %s has no provider result; operator review required", intent.id)
                continue
            row = _get(f"/v1/payments/{provider_id}")
            payment = _recover_unknown_intent(row["id"], row)
            if not payment:
                continue
            if row.get("status") == "approved":
                process_paid_event(external_event_id=f"reconciled_{payment.external_id}_approved",
                    external_payment_id=payment.external_id, payload=row)
            elif row.get("status") in ("rejected", "cancelled") and payment.status not in (Payment.Status.PAID, Payment.Status.REFUNDED):
                payment.status = Payment.Status.FAILED if row["status"] == "rejected" else Payment.Status.CANCELLED
                payment.save(update_fields=["status", "updated_at"])
            count += 1
        except Exception as error:
            logger.warning("Could not reconcile intent %s: %s", intent.id, error)
    return count
