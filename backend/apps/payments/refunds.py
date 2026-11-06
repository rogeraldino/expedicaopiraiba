from decimal import Decimal, ROUND_FLOOR, InvalidOperation
from datetime import timedelta
import uuid

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.reservations.models import Reservation, ReservationEvent
from apps.reservations.services import record_reservation_event, transition_locked_reservation

from .gateways import get_payment_gateway
from .models import Payment, RefundEvent, RefundRequest


RESERVED = (RefundRequest.Status.REQUESTED, RefundRequest.Status.SUBMITTED, RefundRequest.Status.UNKNOWN, RefundRequest.Status.MANUAL_PENDING, RefundRequest.Status.CONFIRMED)


def _matching_provider_refund(record, refund):
    """Only a provider refund for the exact payment and amount may settle a request."""
    try:
        cents = int((Decimal(str(record.get("amount"))) * 100).quantize(Decimal("1")))
    except (InvalidOperation, TypeError, ValueError):
        return False
    payment_id = record.get("payment_id")
    return (bool(record.get("id")) and cents == refund.amount_cents
            and (payment_id is None or str(payment_id) == refund.payment.external_id))


def refund_payload(refund):
    return {
        "id": str(refund.id), "payment_id": str(refund.payment_id),
        "amount_cents": refund.amount_cents, "service_refund_cents": refund.service_refund_cents,
        "fee_refund_cents": refund.fee_refund_cents, "status": refund.status,
        "basis": refund.basis, "reason": refund.reason, "calculation": refund.calculation,
        "provider_refund_id": refund.provider_refund_id,
        "proof_reference": refund.proof_reference, "created_at": refund.created_at,
        "confirmed_at": refund.confirmed_at,
    }


def _transition(refund, status, *, actor, payload=None):
    previous = refund.status
    refund.status = status
    if status == RefundRequest.Status.CONFIRMED:
        refund.confirmed_at = timezone.now()
    refund.save(update_fields=["status", "confirmed_at", "updated_at"])
    RefundEvent.objects.create(refund=refund, previous_status=previous, new_status=status, actor=actor, payload=payload or {})


@transaction.atomic
def request_refund(*, payment_id, amount_cents, basis, reason, calculation, actor):
    try:
        payment = Payment.objects.select_for_update().select_related("reservation").get(id=payment_id)
    except Payment.DoesNotExist:
        raise ValidationError("Pagamento não encontrado.")
    overpayment = payment.transactions.filter(new_status="REJECTED_OVERPAYMENT").exists()
    if payment.status != Payment.Status.PAID or (payment.reservation.status != Reservation.Status.CANCELLED and not (basis == "OVERPAYMENT" and overpayment)):
        raise ValidationError("Cancele a reserva antes de solicitar reembolso de um pagamento confirmado.")
    if basis not in {"ARREPENDIMENTO", "ORGANIZADOR", "DESISTENCIA", "OVERPAYMENT"}:
        raise ValidationError("Fundamento do reembolso inválido.")
    if basis == "OVERPAYMENT" and not overpayment:
        raise ValidationError("Este pagamento não foi identificado como cobrança excedente.")
    if basis == "DESISTENCIA" and payment.reservation.created_at + timedelta(days=7) >= timezone.now():
        raise ValidationError("Dentro do prazo legal de arrependimento, faça a restituição integral.")
    if not reason.strip():
        raise ValidationError("Motivo obrigatório.")
    reserved = payment.refund_requests.filter(status__in=RESERVED).aggregate(total=Sum("amount_cents"))["total"] or 0
    available = payment.amount_cents - reserved
    if amount_cents <= 0 or amount_cents > available:
        raise ValidationError("Valor superior ao disponível para reembolso.")
    if basis in {"ARREPENDIMENTO", "ORGANIZADOR", "OVERPAYMENT"} and amount_cents != available:
        raise ValidationError("Este fundamento exige reembolso integral do pagamento.")
    if basis == "DESISTENCIA" and amount_cents < available and not calculation.strip():
        raise ValidationError("Informe a memória de cálculo da retenção.")
    prior_fee = payment.refund_requests.filter(status=RefundRequest.Status.CONFIRMED).aggregate(total=Sum("fee_refund_cents"))["total"] or 0
    confirmed_amount = payment.refund_requests.filter(status=RefundRequest.Status.CONFIRMED).aggregate(total=Sum("amount_cents"))["total"] or 0
    if amount_cents == available and reserved == confirmed_amount:
        fee_refund = payment.fee_amount_cents - prior_fee
    else:
        fee_refund = int((Decimal(amount_cents) * Decimal(payment.fee_amount_cents) / Decimal(payment.amount_cents)).to_integral_value(rounding=ROUND_FLOOR))
    service_refund = amount_cents - fee_refund
    refund = RefundRequest.objects.create(
        payment=payment, amount_cents=amount_cents, service_refund_cents=service_refund,
        fee_refund_cents=fee_refund, basis=basis, reason=reason.strip(),
        calculation=calculation.strip(), idempotency_key=str(uuid.uuid4()), requested_by=actor,
        status=RefundRequest.Status.MANUAL_PENDING if payment.provider == "ADMIN" or payment.method == Payment.Method.BOLETO else RefundRequest.Status.REQUESTED,
    )
    RefundEvent.objects.create(refund=refund, new_status=refund.status, actor=actor, payload={"amount_cents": amount_cents})
    record_reservation_event(reservation=payment.reservation, event_type="REFUND_REQUESTED", actor_type=ReservationEvent.ActorType.ADMIN, actor_identifier=actor, reason=reason, payload={"refund_id": str(refund.id), "payment_id": str(payment.id), "amount_cents": amount_cents})
    return refund


def submit_refund(refund_id):
    refund = RefundRequest.objects.select_related("payment").get(id=refund_id)
    if refund.status not in (RefundRequest.Status.REQUESTED, RefundRequest.Status.UNKNOWN):
        return refund
    if refund.payment.provider == "ADMIN" or refund.payment.method == Payment.Method.BOLETO:
        return refund
    with transaction.atomic():
        locked = RefundRequest.objects.select_for_update().get(id=refund_id)
        if locked.status == RefundRequest.Status.REQUESTED:
            _transition(locked, RefundRequest.Status.SUBMITTED, actor="system")
    try:
        response = get_payment_gateway().refund_payment(
            external_id=refund.payment.external_id, amount_cents=refund.amount_cents,
            idempotency_key=refund.idempotency_key,
        )
    except Exception as error:
        with transaction.atomic():
            locked = RefundRequest.objects.select_for_update().get(id=refund_id)
            _transition(locked, RefundRequest.Status.UNKNOWN, actor="provider", payload={"error": str(error)[:300]})
        return RefundRequest.objects.get(id=refund_id)
    with transaction.atomic():
        locked = RefundRequest.objects.select_for_update().select_related("payment__reservation").get(id=refund_id)
        locked.provider_response = {k: response.get(k) for k in ("id", "status", "amount", "reason")}
        locked.provider_refund_id = str(response.get("id") or "")
        locked.save(update_fields=["provider_response", "provider_refund_id", "updated_at"])
        if response.get("status") in ("approved", "refunded") and _matching_provider_refund(response, locked):
            confirm_refund_locked(locked, actor="provider")
        elif response.get("status") in ("approved", "refunded"):
            _transition(locked, RefundRequest.Status.UNKNOWN, actor="provider", payload={"reason": "provider_amount_or_payment_mismatch"})
        elif response.get("status") in ("rejected", "cancelled"):
            _transition(locked, RefundRequest.Status.FAILED, actor="provider", payload=locked.provider_response)
        else:
            _transition(locked, RefundRequest.Status.SUBMITTED, actor="provider", payload=locked.provider_response)
        return locked


def confirm_refund_locked(refund, *, actor):
    if refund.status == RefundRequest.Status.CONFIRMED:
        return
    _transition(refund, RefundRequest.Status.CONFIRMED, actor=actor, payload={"provider_refund_id": refund.provider_refund_id})
    payment = Payment.objects.select_for_update().get(id=refund.payment_id)
    returned = payment.refund_requests.filter(status=RefundRequest.Status.CONFIRMED).aggregate(total=Sum("amount_cents"))["total"] or 0
    if returned >= payment.amount_cents:
        payment.status = Payment.Status.REFUNDED
        payment.save(update_fields=["status", "updated_at"])
    reservation = Reservation.objects.select_for_update().get(id=payment.reservation_id)
    if reservation.status == Reservation.Status.CANCELLED:
        paid_payments = reservation.payments.filter(status__in=(Payment.Status.PAID, Payment.Status.REFUNDED))
        if paid_payments.exists() and not paid_payments.exclude(status=Payment.Status.REFUNDED).exists():
            transition_locked_reservation(reservation=reservation, target_status=Reservation.Status.REFUNDED, event_type="RESERVATION_REFUNDED", actor_type=ReservationEvent.ActorType.PROVIDER, actor_identifier=actor)
    record_reservation_event(reservation=reservation, event_type="REFUND_CONFIRMED", actor_type=ReservationEvent.ActorType.PROVIDER, actor_identifier=actor, payload={"refund_id": str(refund.id), "amount_cents": refund.amount_cents})


@transaction.atomic
def confirm_manual_refund(*, refund_id, proof_reference, actor):
    refund = RefundRequest.objects.select_for_update().select_related("payment").get(id=refund_id)
    if refund.status != RefundRequest.Status.MANUAL_PENDING or not proof_reference.strip():
        raise ValidationError("Informe o comprovante da transferência pendente.")
    refund.proof_reference = proof_reference.strip()
    refund.save(update_fields=["proof_reference", "updated_at"])
    confirm_refund_locked(refund, actor=actor)
    return refund


def reconcile_refund(refund_id):
    refund = RefundRequest.objects.select_related("payment").get(id=refund_id)
    if refund.status not in (RefundRequest.Status.UNKNOWN, RefundRequest.Status.SUBMITTED):
        return refund
    records = get_payment_gateway().get_refunds(external_id=refund.payment.external_id)
    candidates = [record for record in records if _matching_provider_refund(record, refund)]
    if refund.provider_refund_id:
        candidates = [record for record in candidates if str(record.get("id")) == refund.provider_refund_id]
    else:
        assigned = set(RefundRequest.objects.filter(payment=refund.payment).exclude(id=refund.id).exclude(provider_refund_id="").values_list("provider_refund_id", flat=True))
        candidates = [record for record in candidates if str(record.get("id")) not in assigned]
    # An unknown request may be matched by amount only when the match is unique.
    if len(candidates) != 1:
        return refund
    for record in candidates:
        with transaction.atomic():
            locked = RefundRequest.objects.select_for_update().select_related("payment").get(id=refund_id)
            locked.provider_refund_id = str(record["id"])
            locked.provider_response = {k: record.get(k) for k in ("id", "status", "amount", "payment_id")}
            locked.save(update_fields=["provider_refund_id", "provider_response", "updated_at"])
            if record.get("status") == "approved":
                confirm_refund_locked(locked, actor="provider-reconciliation")
            elif record.get("status") in ("rejected", "cancelled"):
                _transition(locked, RefundRequest.Status.FAILED, actor="provider-reconciliation")
            return locked
    return refund
