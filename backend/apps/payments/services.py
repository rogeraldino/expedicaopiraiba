from datetime import timedelta
import logging
import hashlib
import time
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.reservations.models import Reservation, ReservationEvent
from apps.reservations.services import record_reservation_event, transition_locked_reservation

from .gateways import FakePaymentGateway, GatewayUncertainError, MercadoPagoPaymentGateway, get_payment_gateway
from .models import FeeQuote, Payment, PaymentIntent, PaymentTransaction
from .pricing import verify_quote_for_payment

logger = logging.getLogger(__name__)


class PaymentInFlight(Exception):
    def __init__(self, intent_id):
        self.intent_id = intent_id


def _await_inflight_payment(intent_id):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        intent = PaymentIntent.objects.get(id=intent_id)
        if intent.status == "COMPLETE" and intent.payment_id:
            return intent.payment
        if intent.status in ("FAILED", "UNKNOWN"):
            break
        time.sleep(0.1)
    raise ValidationError("A cobrança anterior está em verificação. Aguarde antes de tentar novamente.")


def _same_intent_request(intent, *, quote_id, method, installments, amount_cents,
                         card_token=None, payment_method_id="", issuer_id="", address_data=None):
    if not intent or str(intent.quote_id or "") != str(quote_id or "") or intent.method != method or intent.installments != installments or intent.amount_cents != amount_cents:
        return False
    if method == Payment.Method.CREDIT_CARD:
        digest = hashlib.sha256((card_token or "").encode("utf-8")).hexdigest()
        return (intent.request_data.get("card_token_digest") == digest
                and intent.request_data.get("payment_method_id") == payment_method_id
                and intent.request_data.get("issuer_id", "") == issuer_id)
    if method == Payment.Method.BOLETO:
        return intent.request_data.get("address") == address_data
    return True


def _finish_intent(intent, payment):
    intent.payment = payment
    intent.status = "COMPLETE"
    intent.save(update_fields=["payment", "status", "updated_at"])


def create_reservation_payment(
    *,
    customer,
    reservation_id,
    method=Payment.Method.PIX,
    card_token=None,
    installments=1,
    payment_method_id="visa",
    issuer_id="",
    address_data=None,
    quote_id=None,
    contract_accepted=False,
):
    try:
        return _create_reservation_payment_with_intent(
            customer=customer, reservation_id=reservation_id, method=method,
            card_token=card_token, installments=installments,
            payment_method_id=payment_method_id, issuer_id=issuer_id,
            address_data=address_data, quote_id=quote_id,
            contract_accepted=contract_accepted,
        )
    except PaymentInFlight as inflight:
        return _await_inflight_payment(inflight.intent_id)


def _create_reservation_payment_with_intent(
    *, customer, reservation_id, method, card_token, installments,
    payment_method_id, issuer_id, address_data, quote_id, contract_accepted,
):
    # Commit the intent before calling the provider. If the call times out, the
    # unresolved intent blocks another charge until its webhook is reconciled.
    with transaction.atomic():
        if getattr(settings, "PAYMENT_GATEWAY", "FAKE") == "MERCADOPAGO" and not getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", ""):
            raise ValidationError("Pagamento temporariamente indisponível.")
        reservation = Reservation.objects.select_for_update().get(id=reservation_id, customer=customer)
        quote = FeeQuote.objects.filter(id=quote_id, customer=customer, reservation=reservation).first() if quote_id else None
        amount = quote.total_cents if quote else reservation.deposit_cents
        if reservation.status not in (Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT) or not reservation.held_until or reservation.held_until <= timezone.now():
            raise ValidationError("Esta reserva não aceita um novo pagamento.")
        existing = reservation.payments.filter(status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING, Payment.Status.PAID)).order_by("-created_at").first()
        if existing:
            original_intent = PaymentIntent.objects.filter(payment=existing).first()
            if existing.status in (Payment.Status.PENDING, Payment.Status.PROCESSING) and _same_intent_request(original_intent,
                    quote_id=quote_id, method=method, installments=installments, amount_cents=amount,
                    card_token=card_token, payment_method_id=payment_method_id, issuer_id=issuer_id,
                    address_data=address_data):
                return existing
            raise ValidationError("Já existe uma cobrança para esta reserva. Consulte o status antes de tentar novamente.")
        existing_intent = reservation.payment_intents.filter(status__in=("SUBMITTING", "UNKNOWN")).order_by("-created_at").first()
        if existing_intent and existing_intent.status == "SUBMITTING" and _same_intent_request(existing_intent,
                quote_id=quote_id, method=method, installments=installments, amount_cents=amount,
                card_token=card_token, payment_method_id=payment_method_id, issuer_id=issuer_id,
                address_data=address_data):
            raise PaymentInFlight(existing_intent.id)
        if existing_intent:
            raise ValidationError("A cobrança anterior está em verificação. Aguarde a confirmação antes de tentar novamente.")
        if getattr(settings, "PAYMENT_GATEWAY", "FAKE") == "MERCADOPAGO" and not quote:
            raise ValidationError("Confirme o valor e as taxas antes de pagar.")
        if quote:
            verify_quote_for_payment(quote_id=quote_id, customer=customer, reservation=reservation, method=method, installments=installments)
            if reservation.accepted_quote_snapshot.get("quote_id") != str(quote.id):
                if not contract_accepted:
                    raise ValidationError("Aceite novamente o contrato e o valor atualizado antes de pagar.")
                reservation.accepted_quote_snapshot = {
                    "quote_id": str(quote.id), "base_cents": quote.base_cents,
                    "fee_cents": quote.fee_cents, "total_cents": quote.total_cents,
                    "method": quote.method, "installments": quote.installments, "rate": quote.rate_snapshot,
                }
                reservation.contract_accepted_at = timezone.now()
                reservation.save(update_fields=["accepted_quote_snapshot", "contract_accepted_at", "updated_at"])
        if method == Payment.Method.CREDIT_CARD and not card_token:
            raise ValidationError("Informe os dados do cartão.")
        gateway = get_payment_gateway()
        if method == Payment.Method.CREDIT_CARD and isinstance(gateway, MercadoPagoPaymentGateway):
            card_bin = gateway.verify_card_installments(
                card_token=card_token, payment_method_id=payment_method_id,
                issuer_id=issuer_id, installments=installments, amount_cents=amount,
            )
            if quote.card_bin and not (quote.card_bin.startswith(card_bin) or card_bin.startswith(quote.card_bin)):
                raise ValidationError("O cartão mudou. Confirme novamente o valor e as parcelas.")
            quote.card_bin = card_bin
            quote.save(update_fields=["card_bin"])
        if method == Payment.Method.BOLETO:
            if reservation.expedition.starts_at - timezone.localdate() <= timedelta(days=7):
                raise ValidationError("Boleto bancário disponível apenas para compras com mais de 7 dias de antecedência do embarque.")
            if not address_data or any(not address_data.get(field) for field in ("street_name", "zip_code", "city", "federal_unit")):
                raise ValidationError("Endereço completo (CEP, rua, número, bairro, cidade e estado) é obrigatório para emissão de boleto.")
            from datetime import datetime
            starts_dt = timezone.make_aware(datetime.combine(reservation.expedition.starts_at, datetime.min.time()))
            boleto_expiry = min(timezone.now() + timedelta(days=3), starts_dt - timedelta(days=7))
            request_data = {"address": address_data, "expires_at": boleto_expiry.isoformat()}
        elif method == Payment.Method.CREDIT_CARD:
            request_data = {"card_token_digest": hashlib.sha256(card_token.encode("utf-8")).hexdigest(),
                            "payment_method_id": payment_method_id, "issuer_id": issuer_id}
        else:
            request_data = {}
        intent = PaymentIntent.objects.create(
            reservation=reservation, quote=quote, method=method, installments=installments,
            amount_cents=amount, base_amount_cents=reservation.deposit_cents,
            fee_amount_cents=quote.fee_cents if quote else 0,
            fee_snapshot=quote.rate_snapshot if quote else {}, request_data=request_data,
            idempotency_key=str(uuid.uuid4()),
        )
    try:
        payment = _create_reservation_payment(
            customer=customer, reservation_id=reservation_id, method=method,
            card_token=card_token, installments=installments, payment_method_id=payment_method_id,
            issuer_id=issuer_id, address_data=address_data, quote_id=quote_id, intent=intent,
        )
    except ValidationError as error:
        if not isinstance(error, GatewayUncertainError):
            PaymentIntent.objects.filter(id=intent.id, status="SUBMITTING").update(status="FAILED")
            raise
        PaymentIntent.objects.filter(id=intent.id, status="SUBMITTING").update(status="UNKNOWN")
        raise
    except Exception:
        PaymentIntent.objects.filter(id=intent.id, status="SUBMITTING").update(status="UNKNOWN")
        raise
    PaymentIntent.objects.filter(id=intent.id).update(status="COMPLETE", payment=payment)
    return payment


def _create_reservation_payment(
    *, customer, reservation_id, method, card_token, installments,
    payment_method_id, issuer_id, address_data, quote_id, intent,
):
    with transaction.atomic():
        PaymentIntent.objects.select_for_update().get(id=intent.id)
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
        quote = None
        if quote_id:
            quote = verify_quote_for_payment(
                quote_id=quote_id, customer=customer, reservation=reservation,
                method=method, installments=installments,
            )
        elif getattr(settings, "PAYMENT_GATEWAY", "FAKE") == "MERCADOPAGO":
            raise ValidationError("Confirme o valor e as taxas antes de pagar.")
        charge_cents = quote.total_cents if quote else reservation.deposit_cents
        fee_cents = quote.fee_cents if quote else 0
        fee_snapshot = quote.rate_snapshot if quote else {}

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

            # Keep the same expiry in every idempotent replay.
            from datetime import datetime
            boleto_expiry = datetime.fromisoformat(intent.request_data["expires_at"])

            gateway_payment = get_payment_gateway().create_boleto(
                reservation_id=reservation.id,
                amount_cents=charge_cents,
                customer=customer,
                address_data=address_data,
                expires_at=boleto_expiry,
                idempotency_key=intent.idempotency_key,
                external_reference=str(intent.id),
            )

            payment = Payment.objects.create(
                reservation=reservation,
                provider=gateway_payment.provider,
                external_id=gateway_payment.external_id,
                method=Payment.Method.BOLETO,
                amount_cents=charge_cents,
                base_amount_cents=reservation.deposit_cents,
                fee_amount_cents=fee_cents,
                fee_snapshot=fee_snapshot,
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
            if quote:
                quote.reservation = reservation
                quote.used_at = timezone.now()
                quote.save(update_fields=["reservation", "used_at"])
            _finish_intent(intent, payment)
            return payment

        elif method == Payment.Method.CREDIT_CARD:
            gateway_payment = get_payment_gateway().create_card_payment(
                reservation_id=reservation.id,
                amount_cents=charge_cents,
                customer=customer,
                card_token=card_token,
                installments=installments,
                payment_method_id=payment_method_id,
                issuer_id=issuer_id,
                idempotency_key=intent.idempotency_key,
                external_reference=str(intent.id),
            )

            is_paid = gateway_payment.status == "PAID"
            is_failed = gateway_payment.status == "FAILED"

            payment = Payment.objects.create(
                reservation=reservation,
                provider=gateway_payment.provider,
                external_id=gateway_payment.external_id,
                method=Payment.Method.CREDIT_CARD,
                amount_cents=charge_cents,
                base_amount_cents=reservation.deposit_cents,
                fee_amount_cents=fee_cents,
                fee_snapshot=fee_snapshot,
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
            if quote:
                quote.reservation = reservation
                quote.used_at = timezone.now()
                quote.save(update_fields=["reservation", "used_at"])
            _finish_intent(intent, payment)
            return payment

        else:  # PIX
            payment = reservation.payments.filter(
                method=Payment.Method.PIX, amount_cents=charge_cents,
                status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING)
            ).first()
            if not payment:
                gateway_payment = get_payment_gateway().create_pix(
                    reservation_id=reservation.id,
                    amount_cents=charge_cents,
                    customer=customer,
                    idempotency_key=intent.idempotency_key,
                    external_reference=str(intent.id),
                )
                payment = Payment.objects.create(
                    reservation=reservation,
                    provider=gateway_payment.provider,
                    external_id=gateway_payment.external_id,
                    method=Payment.Method.PIX,
                    amount_cents=charge_cents,
                    base_amount_cents=reservation.deposit_cents,
                    fee_amount_cents=fee_cents,
                    fee_snapshot=fee_snapshot,
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
            if quote:
                quote.reservation = reservation
                quote.used_at = timezone.now()
                quote.save(update_fields=["reservation", "used_at"])
            _finish_intent(intent, payment)
            return payment


def create_pix_payment(*, customer, reservation_id):
    return create_reservation_payment(customer=customer, reservation_id=reservation_id, method=Payment.Method.PIX)


def create_balance_payment(*, customer, reservation_id, quote_id=None):
    try:
        return _create_balance_payment(customer=customer, reservation_id=reservation_id, quote_id=quote_id)
    except PaymentInFlight as inflight:
        return _await_inflight_payment(inflight.intent_id)


def _create_balance_payment(*, customer, reservation_id, quote_id=None):
    if getattr(settings, "PAYMENT_GATEWAY", "FAKE") == "MERCADOPAGO" and not getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", ""):
        raise ValidationError("Pagamento temporariamente indisponível.")
    from .reconciliation import refresh_pending_balance_payment
    existing_reservation = Reservation.objects.get(id=reservation_id, customer=customer)
    refresh_pending_balance_payment(existing_reservation)
    with transaction.atomic():
        reservation = Reservation.objects.select_for_update().get(id=reservation_id, customer=customer)
        if reservation.status not in (Reservation.Status.CONFIRMED, Reservation.Status.PARTIALLY_PAID, Reservation.Status.PAID):
            raise ValidationError("Esta reserva não aceita pagamento de saldo.")
        remaining = reservation.remaining_balance_cents
        if remaining == 0:
            return None
        if quote_id:
            prior_intent = PaymentIntent.objects.select_related("payment").filter(
                reservation=reservation, quote_id=quote_id, method=Payment.Method.PIX,
                payment__status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING),
            ).first()
            if prior_intent:
                return prior_intent.payment
        if quote_id:
            quote = verify_quote_for_payment(
                quote_id=quote_id, customer=customer, reservation=reservation,
                method=Payment.Method.PIX, installments=1,
                purpose=Payment.Purpose.BALANCE, expected_base=remaining,
            )
        elif getattr(settings, "PAYMENT_GATEWAY", "FAKE") == "MERCADOPAGO":
            raise ValidationError("Confirme o valor e as taxas do saldo antes de pagar.")
        else:
            quote = None
        charge_cents = quote.total_cents if quote else remaining
        active = reservation.payments.filter(purpose=Payment.Purpose.BALANCE,
            status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING))
        if active.exclude(amount_cents=charge_cents).exists():
            raise ValidationError("Há um Pix de saldo ainda ativo. Aguarde a expiração ou contate o suporte antes de gerar outra cobrança.")
        payment = active.filter(amount_cents=charge_cents).first()
        if payment:
            original_intent = PaymentIntent.objects.filter(payment=payment).first()
            if _same_intent_request(original_intent, quote_id=quote_id,
                                    method=Payment.Method.PIX, installments=1, amount_cents=charge_cents):
                return payment
            raise ValidationError("Já existe um Pix de saldo ativo com condições anteriores. Consulte a cobrança existente.")
        existing_intent = reservation.payment_intents.filter(status__in=("SUBMITTING", "UNKNOWN")).order_by("-created_at").first()
        if existing_intent:
            if existing_intent.status == "SUBMITTING" and _same_intent_request(existing_intent,
                    quote_id=quote_id, method=Payment.Method.PIX, installments=1, amount_cents=charge_cents):
                raise PaymentInFlight(existing_intent.id)
            raise ValidationError("A cobrança anterior está em verificação. Aguarde a confirmação antes de tentar novamente.")
        intent = PaymentIntent.objects.create(
            reservation=reservation, quote=quote, method=Payment.Method.PIX,
            amount_cents=charge_cents, base_amount_cents=remaining,
            fee_amount_cents=quote.fee_cents if quote else 0,
            fee_snapshot=quote.rate_snapshot if quote else {}, idempotency_key=str(uuid.uuid4()),
        )
    try:
        with transaction.atomic():
            locked_intent = PaymentIntent.objects.select_for_update().get(id=intent.id)
            gateway_payment = get_payment_gateway().create_pix(
                reservation_id=reservation.id, amount_cents=charge_cents, customer=customer,
                idempotency_key=intent.idempotency_key, external_reference=str(intent.id),
            )
            if locked_intent.payment_id:
                return locked_intent.payment
            payment = Payment.objects.create(
                reservation=reservation, purpose=Payment.Purpose.BALANCE,
                provider=gateway_payment.provider, external_id=gateway_payment.external_id,
                method=Payment.Method.PIX, amount_cents=charge_cents,
                base_amount_cents=remaining, fee_amount_cents=intent.fee_amount_cents,
                fee_snapshot=intent.fee_snapshot, idempotency_key=intent.idempotency_key,
                pix_copy_paste=gateway_payment.pix_copy_paste,
                pix_qr_code_base64=gateway_payment.qr_code_base64,
                expires_at=gateway_payment.expires_at,
            )
            locked_intent.payment = payment
            locked_intent.status = "COMPLETE"
            locked_intent.save(update_fields=["payment", "status", "updated_at"])
            if quote:
                quote.used_at = timezone.now()
                quote.save(update_fields=["used_at"])
            record_reservation_event(
                reservation=reservation, event_type="BALANCE_PAYMENT_CREATED",
                actor_type=ReservationEvent.ActorType.CUSTOMER,
                actor_identifier=str(customer.id),
                payload={"payment_id": str(payment.id), "amount_cents": remaining},
            )
            return payment
    except ValidationError as error:
        if not isinstance(error, GatewayUncertainError):
            PaymentIntent.objects.filter(id=intent.id, status="SUBMITTING").update(status="FAILED")
            raise
        PaymentIntent.objects.filter(id=intent.id, status="SUBMITTING").update(status="UNKNOWN")
        raise
    except Exception:
        PaymentIntent.objects.filter(id=intent.id, status="SUBMITTING").update(status="UNKNOWN")
        raise


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

    already_paid = reservation.paid_amount_cents
    if payment.status != Payment.Status.PAID and already_paid + payment.base_amount_cents > reservation.total_price_cents:
        payment.status = Payment.Status.PAID
        payment.paid_at = timezone.now()
        payment.save(update_fields=("status", "paid_at", "updated_at"))
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

    if reservation.status in (Reservation.Status.EXPIRED, Reservation.Status.CANCELLED, Reservation.Status.REFUNDED):
        record_reservation_event(
            reservation=reservation, event_type="PAYMENT_AFTER_CANCELLATION",
            actor_type=ReservationEvent.ActorType.PROVIDER, actor_identifier=payment.provider,
            payload={"payment_id": str(payment.id), "amount_cents": payment.amount_cents},
        )
        return payment, True

    paid_total = reservation.paid_amount_cents
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
