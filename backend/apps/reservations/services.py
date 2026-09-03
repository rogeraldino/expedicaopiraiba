from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.expeditions.models import Expedition

from .models import Reservation, ReservationEvent, ReservationParticipant


ALLOWED_TRANSITIONS = {
    Reservation.Status.HELD: {Reservation.Status.AWAITING_PAYMENT, Reservation.Status.EXPIRED, Reservation.Status.CANCELLED},
    Reservation.Status.AWAITING_PAYMENT: {Reservation.Status.PARTIALLY_PAID, Reservation.Status.CONFIRMED, Reservation.Status.PAID, Reservation.Status.EXPIRED, Reservation.Status.CANCELLED},
    Reservation.Status.PARTIALLY_PAID: {Reservation.Status.CONFIRMED, Reservation.Status.PAID, Reservation.Status.CANCELLED, Reservation.Status.REFUNDED},
    Reservation.Status.CONFIRMED: {Reservation.Status.PAID, Reservation.Status.CANCELLED, Reservation.Status.REFUNDED},
    Reservation.Status.PAID: {Reservation.Status.CANCELLED, Reservation.Status.REFUNDED},
    Reservation.Status.EXPIRED: set(),
    Reservation.Status.CANCELLED: {Reservation.Status.REFUNDED},
    Reservation.Status.REFUNDED: set(),
}


def record_reservation_event(*, reservation, event_type, actor_type=ReservationEvent.ActorType.SYSTEM, actor_identifier="", previous_status="", new_status="", reason="", payload=None):
    return ReservationEvent.objects.create(reservation=reservation, event_type=event_type, actor_type=actor_type, actor_identifier=actor_identifier, previous_status=previous_status, new_status=new_status, reason=reason, payload=payload or {})


def transition_locked_reservation(*, reservation, target_status, event_type, actor_type=ReservationEvent.ActorType.SYSTEM, actor_identifier="", reason="", payload=None):
    previous_status = reservation.status
    if target_status == previous_status:
        return reservation, False
    if target_status not in ALLOWED_TRANSITIONS.get(previous_status, set()):
        raise ValidationError(f"Transição de {previous_status} para {target_status} não permitida.")
    reservation.status = target_status
    update_fields = ["status", "updated_at"]
    if target_status in (Reservation.Status.CONFIRMED, Reservation.Status.PAID, Reservation.Status.EXPIRED, Reservation.Status.CANCELLED):
        reservation.held_until = None
        update_fields.append("held_until")
    reservation.save(update_fields=update_fields)
    record_reservation_event(reservation=reservation, event_type=event_type, actor_type=actor_type, actor_identifier=actor_identifier, previous_status=previous_status, new_status=target_status, reason=reason, payload=payload)
    return reservation, True


@transaction.atomic
def transition_reservation(*, reservation_id, target_status, event_type="STATUS_CHANGED", actor_type=ReservationEvent.ActorType.SYSTEM, actor_identifier="", reason="", payload=None):
    reservation = Reservation.objects.select_for_update().get(id=reservation_id)
    return transition_locked_reservation(reservation=reservation, target_status=target_status, event_type=event_type, actor_type=actor_type, actor_identifier=actor_identifier, reason=reason, payload=payload)[0]


@transaction.atomic
def expire_holds(*, now=None):
    cutoff = now or timezone.now()
    reservations = list(Reservation.objects.select_for_update().filter(status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), held_until__lte=cutoff))
    expired = 0
    for reservation in reservations:
        _, changed = transition_locked_reservation(reservation=reservation, target_status=Reservation.Status.EXPIRED, event_type="RESERVATION_EXPIRED", reason="Prazo para pagamento encerrado.", payload={"expired_at": cutoff.isoformat()})
        expired += int(changed)
    return expired


@transaction.atomic
def create_hold(*, customer, expedition_slug, participant_names, payment_plan):
    try:
        expedition = Expedition.objects.select_for_update().get(slug=expedition_slug, status=Expedition.Status.PUBLISHED)
    except Expedition.DoesNotExist:
        raise ValidationError("Expedição indisponível para reserva.")
    names = [name.strip() for name in participant_names if name and name.strip()]
    if not 1 <= len(names) <= 12:
        raise ValidationError("Informe entre 1 e 12 participantes.")
    active = Q(status__in=(Reservation.Status.PARTIALLY_PAID, Reservation.Status.CONFIRMED, Reservation.Status.PAID))
    held = Q(status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), held_until__gt=timezone.now())
    occupied = Reservation.objects.filter(Q(expedition=expedition) & (active | held)).aggregate(total=Sum("participant_count"))["total"] or 0
    if occupied + len(names) > expedition.capacity:
        raise ValidationError("Não há vagas suficientes para esta reserva.")
    total = expedition.price_per_person_cents * len(names)
    amount_due = expedition.deposit_cents if payment_plan == "DEPOSIT" else total
    balance_due_at = expedition.starts_at - timedelta(days=expedition.balance_due_days_before) if payment_plan == "DEPOSIT" and amount_due < total else None
    reservation = Reservation.objects.create(
        customer=customer,
        expedition=expedition,
        participant_count=len(names),
        status=Reservation.Status.HELD,
        held_until=timezone.now() + timedelta(minutes=15),
        unit_price_cents=expedition.price_per_person_cents,
        total_price_cents=total,
        deposit_cents=amount_due,
        payment_plan=payment_plan,
        balance_due_at=balance_due_at,
    )
    ReservationParticipant.objects.bulk_create([ReservationParticipant(reservation=reservation, full_name=name) for name in names])
    record_reservation_event(reservation=reservation, event_type="RESERVATION_HELD", actor_type=ReservationEvent.ActorType.CUSTOMER, actor_identifier=str(customer.id), new_status=Reservation.Status.HELD, payload={"participant_count": len(names), "payment_plan": payment_plan, "held_until": reservation.held_until.isoformat()})
    return reservation
