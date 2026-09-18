import uuid

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.reservations.models import Reservation, ReservationEvent
from apps.reservations.services import record_reservation_event, transition_locked_reservation

from .gateways import FakePaymentGateway
from .models import Payment, PaymentTransaction


def create_pix_payment(*, customer, reservation_id):
    expired = False
    payment = None
    with transaction.atomic():
        try:
            reservation = Reservation.objects.select_for_update().get(id=reservation_id, customer=customer)
        except Reservation.DoesNotExist:
            raise ValidationError("Reserva não encontrada.")
        if reservation.status not in (Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT):
            raise ValidationError("Esta reserva não aceita um novo pagamento.")
        if not reservation.held_until or reservation.held_until <= timezone.now():
            transition_locked_reservation(reservation=reservation, target_status=Reservation.Status.EXPIRED, event_type="RESERVATION_EXPIRED", reason="Prazo para pagamento encerrado.")
            expired = True
        else:
            payment = reservation.payments.filter(status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING)).first()
            if not payment:
                gateway_payment = FakePaymentGateway().create_pix(reservation_id=reservation.id, amount_cents=reservation.deposit_cents)
                payment = Payment.objects.create(reservation=reservation, external_id=gateway_payment.external_id, amount_cents=reservation.deposit_cents, pix_copy_paste=gateway_payment.pix_copy_paste, expires_at=gateway_payment.expires_at)
                record_reservation_event(reservation=reservation, event_type="PAYMENT_CREATED", actor_type=ReservationEvent.ActorType.CUSTOMER, actor_identifier=str(customer.id), payload={"payment_id": str(payment.id), "amount_cents": payment.amount_cents, "method": payment.method})
            transition_locked_reservation(reservation=reservation, target_status=Reservation.Status.AWAITING_PAYMENT, event_type="PAYMENT_AWAITING", actor_type=ReservationEvent.ActorType.CUSTOMER, actor_identifier=str(customer.id))
    if expired:
        raise ValidationError("O tempo para pagamento expirou.")
    return payment


def create_balance_payment(*, customer, reservation_id):
    with transaction.atomic():
        try:
            reservation = Reservation.objects.select_for_update().get(id=reservation_id, customer=customer)
        except Reservation.DoesNotExist:
            raise
        if reservation.status not in (Reservation.Status.CONFIRMED, Reservation.Status.PARTIALLY_PAID, Reservation.Status.PAID):
            raise ValidationError("Esta reserva não aceita pagamento de saldo.")
        remaining = reservation.remaining_balance_cents
        if remaining == 0:
            return None
        active = reservation.payments.filter(purpose=Payment.Purpose.BALANCE, status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING))
        payment = active.filter(amount_cents=remaining).first()
        active.exclude(amount_cents=remaining).update(status=Payment.Status.CANCELLED)
        if payment:
            return payment
        gateway_payment = FakePaymentGateway().create_pix(reservation_id=reservation.id, amount_cents=remaining)
        payment = Payment.objects.create(reservation=reservation, purpose=Payment.Purpose.BALANCE, external_id=gateway_payment.external_id, amount_cents=remaining, pix_copy_paste=gateway_payment.pix_copy_paste, expires_at=gateway_payment.expires_at)
        record_reservation_event(reservation=reservation, event_type="BALANCE_PAYMENT_CREATED", actor_type=ReservationEvent.ActorType.CUSTOMER, actor_identifier=str(customer.id), payload={"payment_id": str(payment.id), "amount_cents": remaining})
        return payment


@transaction.atomic
def process_paid_event(*, external_event_id, external_payment_id, payload):
    try:
        payment = Payment.objects.select_for_update().select_related("reservation").get(external_id=external_payment_id)
    except Payment.DoesNotExist:
        raise ValidationError("Pagamento não encontrado.")
    # Different payment rows can be confirmed concurrently for the same
    # reservation. Lock the shared financial aggregate before calculating it.
    reservation = Reservation.objects.select_for_update().get(id=payment.reservation_id)
    transaction_record, created = PaymentTransaction.objects.get_or_create(
        external_event_id=external_event_id,
        defaults={
            "payment": payment,
            "event_type": "PAYMENT_PAID",
            "previous_status": payment.status,
            "new_status": Payment.Status.PAID,
            "payload": payload,
        },
    )
    if not created:
        return payment, False
    already_paid = reservation.payments.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount_cents"))["total"] or 0
    if payment.status != Payment.Status.PAID and already_paid + payment.amount_cents > reservation.total_price_cents:
        transaction_record.new_status = "REJECTED_OVERPAYMENT"
        transaction_record.save(update_fields=("new_status",))
        record_reservation_event(reservation=reservation, event_type="PAYMENT_RECONCILIATION_REQUIRED", actor_type=ReservationEvent.ActorType.PROVIDER, actor_identifier=payment.provider, payload={"payment_id": str(payment.id), "external_event_id": external_event_id})
        return payment, False
    if payment.status != Payment.Status.PAID:
        payment.status = Payment.Status.PAID
        payment.paid_at = timezone.now()
        payment.save(update_fields=("status", "paid_at", "updated_at"))
    paid_total = reservation.payments.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount_cents"))["total"] or 0
    target_status = Reservation.Status.PAID if paid_total >= reservation.total_price_cents else Reservation.Status.CONFIRMED if paid_total >= reservation.deposit_cents else Reservation.Status.PARTIALLY_PAID
    transition_locked_reservation(reservation=reservation, target_status=target_status, event_type="PAYMENT_CONFIRMED", actor_type=ReservationEvent.ActorType.PROVIDER, actor_identifier=payment.provider, payload={"payment_id": str(payment.id), "amount_cents": payment.amount_cents, "paid_total_cents": paid_total, "external_event_id": external_event_id})
    return payment, True


def simulate_paid_event(payment):
    return process_paid_event(
        external_event_id=f"fake_event_{uuid.uuid4().hex}",
        external_payment_id=payment.external_id,
        payload={"source": "checkout_simulator", "status": "PAID"},
    )
