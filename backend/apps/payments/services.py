from datetime import timedelta
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.reservations.models import Reservation, ReservationEvent
from apps.reservations.services import record_reservation_event, transition_locked_reservation

from .gateways import FakePaymentGateway, get_payment_gateway
from .models import Payment, PaymentTransaction


def create_reservation_payment(
    *,
    customer,
    reservation_id,
    method=Payment.Method.PIX,
    card_token=None,
    installments=1,
    payment_method_id="visa",
    address_data=None,
):
    with transaction.atomic():
        try:
            reservation = (
                Reservation.objects.select_for_update()
                .select_related("expedition")
                .get(id=reservation_id, customer=customer)
            )
        except Reservation.DoesNotExist:
            raise ValidationError("Reserva não encontrada.")

        if reservation.status not in (Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT):
            raise ValidationError("Esta reserva não aceita um novo pagamento.")

        now = timezone.now()
        if not reservation.held_until or reservation.held_until <= now:
            transition_locked_reservation(
                reservation=reservation,
                target_status=Reservation.Status.EXPIRED,
                event_type="RESERVATION_EXPIRED",
                reason="Prazo para pagamento encerrado.",
            )
            raise ValidationError("O tempo para pagamento expirou.")

        expedition = reservation.expedition

        if method == Payment.Method.BOLETO:
            # Rule: only allowed more than 7 days before departure!
            today = timezone.localdate()
            if expedition.starts_at - today <= timedelta(days=7):
                raise ValidationError(
                    "Boleto bancário disponível apenas para compras com mais de 7 dias de antecedência do embarque."
                )

            if (
                not address_data
                or not address_data.get("street_name")
                or not address_data.get("zip_code")
                or not address_data.get("city")
                or not address_data.get("federal_unit")
            ):
                raise ValidationError(
                    "Endereço completo (CEP, rua, número, bairro, cidade e estado) é obrigatório para emissão de boleto."
                )

            # Persist address to CustomerProfile
            from apps.customers.models import CustomerProfile

            profile, _ = CustomerProfile.objects.get_or_create(customer=customer)
            profile.street_name = address_data.get("street_name", "")
            profile.street_number = address_data.get("street_number", "")
            profile.complement = address_data.get("complement", "")
            profile.neighborhood = address_data.get("neighborhood", "")
            profile.city = address_data.get("city", "")
            profile.state = address_data.get("federal_unit", "")
            profile.zip_code = address_data.get("zip_code", "")
            profile.save()

            # Boleto expiry: 3 days, capped at 1 week (7 days) before departure
            from datetime import datetime
            starts_dt = timezone.make_aware(datetime.combine(expedition.starts_at, datetime.min.time()))
            boleto_expiry = min(now + timedelta(days=3), starts_dt - timedelta(days=7))

            gateway_payment = get_payment_gateway().create_boleto(
                reservation_id=reservation.id,
                amount_cents=reservation.deposit_cents,
                customer=customer,
                address_data=address_data,
                expires_at=boleto_expiry,
            )

            payment = Payment.objects.create(
                reservation=reservation,
                provider=gateway_payment.provider,
                external_id=gateway_payment.external_id,
                method=Payment.Method.BOLETO,
                amount_cents=reservation.deposit_cents,
                boleto_url=gateway_payment.ticket_url,
                boleto_barcode=gateway_payment.boleto_barcode,
                expires_at=gateway_payment.expires_at,
                status=Payment.Status.PENDING,
            )

            # Extend reservation held_until to match boleto expiry (G-01)
            reservation.held_until = gateway_payment.expires_at
            reservation.save(update_fields=["held_until", "updated_at"])

            transition_locked_reservation(
                reservation=reservation,
                target_status=Reservation.Status.AWAITING_PAYMENT,
                event_type="BOLETO_ISSUED",
                actor_type=ReservationEvent.ActorType.CUSTOMER,
                actor_identifier=str(customer.id),
                payload={"payment_id": str(payment.id), "expires_at": gateway_payment.expires_at.isoformat()},
            )
            return payment

        elif method == Payment.Method.CREDIT_CARD:
            gateway_payment = get_payment_gateway().create_card_payment(
                reservation_id=reservation.id,
                amount_cents=reservation.deposit_cents,
                customer=customer,
                card_token=card_token,
                installments=installments,
                payment_method_id=payment_method_id,
            )

            is_paid = gateway_payment.status == "PAID"
            is_failed = gateway_payment.status == "FAILED"

            payment = Payment.objects.create(
                reservation=reservation,
                provider=gateway_payment.provider,
                external_id=gateway_payment.external_id,
                method=Payment.Method.CREDIT_CARD,
                amount_cents=reservation.deposit_cents,
                card_brand=gateway_payment.card_brand,
                card_last_four=gateway_payment.card_last_four,
                installments=gateway_payment.installments,
                status=Payment.Status.PAID if is_paid else Payment.Status.FAILED if is_failed else Payment.Status.PROCESSING,
                paid_at=timezone.now() if is_paid else None,
            )

            if reservation.status == Reservation.Status.HELD:
                transition_locked_reservation(
                    reservation=reservation,
                    target_status=Reservation.Status.AWAITING_PAYMENT,
                    event_type="PAYMENT_AWAITING",
                    actor_type=ReservationEvent.ActorType.CUSTOMER,
                    actor_identifier=str(customer.id),
                )

            if is_paid:
                process_paid_event(
                    external_event_id=f"card_{payment.external_id}",
                    external_payment_id=payment.external_id,
                    payload={"source": "card_direct", "status": "approved"},
                )
                payment.refresh_from_db()
                reservation.refresh_from_db()
            elif is_failed:
                record_reservation_event(
                    reservation=reservation,
                    event_type="PAYMENT_FAILED",
                    actor_type=ReservationEvent.ActorType.PROVIDER,
                    actor_identifier=payment.provider,
                    payload={"payment_id": str(payment.id), "reason": "Cartão recusado pelo emissor."},
                )
            return payment

        else:  # PIX
            payment = reservation.payments.filter(
                method=Payment.Method.PIX, status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING)
            ).first()
            if not payment:
                gateway_payment = get_payment_gateway().create_pix(
                    reservation_id=reservation.id,
                    amount_cents=reservation.deposit_cents,
                    customer=customer,
                )
                payment = Payment.objects.create(
                    reservation=reservation,
                    provider=gateway_payment.provider,
                    external_id=gateway_payment.external_id,
                    method=Payment.Method.PIX,
                    amount_cents=reservation.deposit_cents,
                    pix_copy_paste=gateway_payment.pix_copy_paste,
                    pix_qr_code_base64=gateway_payment.qr_code_base64,
                    expires_at=gateway_payment.expires_at,
                )
                record_reservation_event(
                    reservation=reservation,
                    event_type="PAYMENT_CREATED",
                    actor_type=ReservationEvent.ActorType.CUSTOMER,
                    actor_identifier=str(customer.id),
                    payload={
                        "payment_id": str(payment.id),
                        "amount_cents": payment.amount_cents,
                        "method": payment.method,
                    },
                )
            transition_locked_reservation(
                reservation=reservation,
                target_status=Reservation.Status.AWAITING_PAYMENT,
                event_type="PAYMENT_AWAITING",
                actor_type=ReservationEvent.ActorType.CUSTOMER,
                actor_identifier=str(customer.id),
            )
            return payment


def create_pix_payment(*, customer, reservation_id):
    return create_reservation_payment(customer=customer, reservation_id=reservation_id, method=Payment.Method.PIX)


def create_balance_payment(*, customer, reservation_id):
    with transaction.atomic():
        try:
            reservation = Reservation.objects.select_for_update().get(id=reservation_id, customer=customer)
        except Reservation.DoesNotExist:
            raise
        if reservation.status not in (
            Reservation.Status.CONFIRMED,
            Reservation.Status.PARTIALLY_PAID,
            Reservation.Status.PAID,
        ):
            raise ValidationError("Esta reserva não aceita pagamento de saldo.")
        remaining = reservation.remaining_balance_cents
        if remaining == 0:
            return None
        active = reservation.payments.filter(
            purpose=Payment.Purpose.BALANCE, status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING)
        )
        payment = active.filter(amount_cents=remaining).first()
        active.exclude(amount_cents=remaining).update(status=Payment.Status.CANCELLED)
        if payment:
            return payment
        gateway_payment = get_payment_gateway().create_pix(
            reservation_id=reservation.id, amount_cents=remaining, customer=customer
        )
        payment = Payment.objects.create(
            reservation=reservation,
            purpose=Payment.Purpose.BALANCE,
            provider=gateway_payment.provider,
            external_id=gateway_payment.external_id,
            amount_cents=remaining,
            pix_copy_paste=gateway_payment.pix_copy_paste,
            pix_qr_code_base64=gateway_payment.qr_code_base64,
            expires_at=gateway_payment.expires_at,
        )
        record_reservation_event(
            reservation=reservation,
            event_type="BALANCE_PAYMENT_CREATED",
            actor_type=ReservationEvent.ActorType.CUSTOMER,
            actor_identifier=str(customer.id),
            payload={"payment_id": str(payment.id), "amount_cents": remaining},
        )
        return payment


@transaction.atomic
def process_paid_event(*, external_event_id, external_payment_id, payload):
    try:
        payment = Payment.objects.select_for_update().select_related("reservation__customer", "reservation__expedition").get(external_id=external_payment_id)
    except Payment.DoesNotExist:
        raise ValidationError("Pagamento não encontrado.")

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

    already_paid = (
        reservation.payments.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount_cents"))["total"] or 0
    )
    if payment.status != Payment.Status.PAID and already_paid + payment.amount_cents > reservation.total_price_cents:
        transaction_record.new_status = "REJECTED_OVERPAYMENT"
        transaction_record.save(update_fields=("new_status",))
        record_reservation_event(
            reservation=reservation,
            event_type="PAYMENT_RECONCILIATION_REQUIRED",
            actor_type=ReservationEvent.ActorType.PROVIDER,
            actor_identifier=payment.provider,
            payload={"payment_id": str(payment.id), "external_event_id": external_event_id},
        )
        return payment, False

    if payment.status != Payment.Status.PAID:
        payment.status = Payment.Status.PAID
        payment.paid_at = timezone.now()
        payment.save(update_fields=("status", "paid_at", "updated_at"))

    paid_total = (
        reservation.payments.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount_cents"))["total"] or 0
    )
    target_status = (
        Reservation.Status.PAID
        if paid_total >= reservation.total_price_cents
        else Reservation.Status.CONFIRMED
        if paid_total >= reservation.deposit_cents
        else Reservation.Status.PARTIALLY_PAID
    )
    transition_locked_reservation(
        reservation=reservation,
        target_status=target_status,
        event_type="PAYMENT_CONFIRMED",
        actor_type=ReservationEvent.ActorType.PROVIDER,
        actor_identifier=payment.provider,
        payload={
            "payment_id": str(payment.id),
            "amount_cents": payment.amount_cents,
            "paid_total_cents": paid_total,
            "external_event_id": external_event_id,
        },
    )

    # Dispatch order confirmation email
    try:
        from apps.customers.notifications import send_order_confirmation_email

        send_order_confirmation_email(reservation=reservation, payment=payment)
        record_reservation_event(
            reservation=reservation,
            event_type="ORDER_CONFIRMATION_SENT",
            actor_type=ReservationEvent.ActorType.SYSTEM,
            actor_identifier="email",
            payload={"recipient": reservation.customer.email if reservation.customer else ""},
        )
    except Exception as err:
        logger.warning("Order confirmation email failed: %s", err)

    return payment, True


def simulate_paid_event(payment):
    gateway = getattr(settings, "PAYMENT_GATEWAY", "FAKE")
    allowed = getattr(settings, "ALLOW_SIMULATED_PAYMENTS", False)
    if gateway != "FAKE" and not allowed:
        raise ValidationError("Simulação de pagamentos desativada neste ambiente.")
    return process_paid_event(
        external_event_id=f"fake_event_{uuid.uuid4().hex}",
        external_payment_id=payment.external_id,
        payload={"source": "checkout_simulator", "status": "PAID"},
    )
