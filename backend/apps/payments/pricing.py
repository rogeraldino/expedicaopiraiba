from datetime import timedelta
from decimal import Decimal, ROUND_CEILING

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.expeditions.models import Expedition
from apps.reservations.models import Reservation

from .models import FeeQuote, FeeRate, Payment


def gross_for_fee(base_cents, percent, fixed_cents):
    """Return gross cents that cover an estimated percent-on-gross plus fixed fee."""
    p = Decimal(str(percent)) / Decimal(100)
    if base_cents <= 0 or p < 0 or p >= 1 or fixed_cents < 0:
        raise ValidationError("Configuração de taxa inválida.")
    gross = (Decimal(base_cents + fixed_cents) / (Decimal(1) - p)).to_integral_value(rounding=ROUND_CEILING)
    if gross - base_cents > Decimal(base_cents) * Decimal("0.30"):
        raise ValidationError("Taxa acima do limite configurado.")
    return int(gross)


def rate_payload(rate):
    return {
        "method": rate.method,
        "installments": rate.installments,
        "percent": str(rate.percent),
        "fixed_cents": rate.fixed_cents,
        "version": rate.version,
        "source": rate.source,
        "source_checked_at": rate.source_checked_at.isoformat() if rate.source_checked_at else None,
        "estimated": rate.estimated,
    }


def quote_payload(quote):
    buyer_total = quote.rate_snapshot.get("buyer_total_cents", quote.total_cents if quote.method != Payment.Method.CREDIT_CARD else None)
    return {
        "quote_id": str(quote.id),
        "base_cents": quote.base_cents,
        "fee_cents": quote.fee_cents,
        "total_cents": quote.total_cents,
        "buyer_total_cents": buyer_total,
        "buyer_financing_cents": buyer_total - quote.total_cents if buyer_total is not None else None,
        "buyer_installment_cents": quote.rate_snapshot.get("buyer_installment_cents"),
        "method": quote.method,
        "installments": quote.installments,
        "card_bin": quote.card_bin,
        "estimated": quote.rate_snapshot.get("estimated", True),
        "expires_at": quote.expires_at,
    }


def create_fee_quote(*, customer, expedition_slug, participant_names, payment_plan, method, installments=1, reservation_id=None, card_bin=""):
    expedition = Expedition.objects.filter(slug=expedition_slug, status__in=(Expedition.Status.PUBLISHED, Expedition.Status.SOLD_OUT)).first()
    if not expedition or expedition.ends_at < timezone.localdate():
        raise ValidationError("Expedição indisponível.")
    names = [str(name).strip() for name in participant_names]
    if not names or len(names) > 12 or any(not name for name in names):
        raise ValidationError("Informe os participantes.")
    if payment_plan not in Reservation.PaymentPlan.values or method not in Payment.Method.values:
        raise ValidationError("Opção de pagamento inválida.")
    if not isinstance(installments, int) or installments < 1 or installments > 10 or (method != Payment.Method.CREDIT_CARD and installments != 1):
        raise ValidationError("Parcelamento inválido.")
    if card_bin and (not card_bin.isdigit() or len(card_bin) not in (6, 7, 8)):
        raise ValidationError("Cartão inválido para consulta de parcelas.")
    rate = FeeRate.objects.filter(method=method, installments=installments, active=True).first()
    if not rate or (rate.valid_until and rate.valid_until <= timezone.now()):
        raise ValidationError("Forma de pagamento temporariamente indisponível.")
    base = (expedition.deposit_cents if payment_plan == Reservation.PaymentPlan.DEPOSIT else expedition.price_per_person_cents) * len(names)
    reservation = None
    if reservation_id:
        reservation = Reservation.objects.filter(id=reservation_id, customer=customer, expedition=expedition,
            status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), held_until__gt=timezone.now()).first()
        if not reservation or reservation.payment_plan != payment_plan or reservation.deposit_cents != base or list(reservation.participants.order_by("created_at").values_list("full_name", flat=True)) != names:
            raise ValidationError("Reserva alterada ou expirada. Recomece o pagamento.")
        if reservation.payments.filter(status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING, Payment.Status.PAID)).exists():
            raise ValidationError("Já existe uma cobrança para esta reserva. Consulte seu status antes de gerar outra.")
        if reservation.payment_intents.filter(status__in=("SUBMITTING", "UNKNOWN")).exists():
            raise ValidationError("Uma cobrança anterior ainda está em verificação.")
    gross = gross_for_fee(base, rate.percent, rate.fixed_cents)
    rate_snapshot = rate_payload(rate)
    if method == Payment.Method.CREDIT_CARD and getattr(settings, "PAYMENT_GATEWAY", "FAKE") != "MERCADOPAGO":
        rate_snapshot.update({"buyer_total_cents": gross, "buyer_financing_cents": 0, "buyer_installment_cents": gross // installments})
    if method == Payment.Method.CREDIT_CARD and card_bin and getattr(settings, "PAYMENT_GATEWAY", "FAKE") == "MERCADOPAGO":
        from .gateways import MercadoPagoPaymentGateway
        terms = MercadoPagoPaymentGateway().verify_quote_installments(
            bin_digits=card_bin, installments=installments, amount_cents=gross,
        )
        rate_snapshot["buyer_total_cents"] = terms["buyer_total_cents"]
        rate_snapshot["buyer_financing_cents"] = terms["buyer_total_cents"] - gross
        rate_snapshot["buyer_installment_cents"] = terms["buyer_installment_cents"]
        rate_snapshot["payment_method_id"] = terms["payment_method_id"]
        rate_snapshot["issuer_id"] = terms["issuer_id"]
    quote = FeeQuote.objects.create(
        customer=customer,
        reservation=reservation,
        expedition=expedition,
        participant_names=names,
        payment_plan=payment_plan,
        method=method,
        installments=installments,
        card_bin=card_bin if method == Payment.Method.CREDIT_CARD else "",
        base_cents=base,
        fee_cents=gross-base,
        total_cents=gross,
        rate_snapshot=rate_snapshot,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    return quote


def create_balance_quote(*, customer, reservation_id):
    try:
        reservation = Reservation.objects.select_related("expedition").get(id=reservation_id, customer=customer)
    except Reservation.DoesNotExist:
        raise ValidationError("Reserva não encontrada.")
    from .reconciliation import refresh_pending_balance_payment
    refresh_pending_balance_payment(reservation)
    if reservation.status not in (Reservation.Status.CONFIRMED, Reservation.Status.PARTIALLY_PAID, Reservation.Status.PAID):
        raise ValidationError("Esta reserva não aceita pagamento de saldo.")
    base = reservation.remaining_balance_cents
    if base <= 0:
        raise ValidationError("Não há saldo pendente.")
    rate = FeeRate.objects.filter(method=Payment.Method.PIX, installments=1, active=True).first()
    if not rate or (rate.valid_until and rate.valid_until <= timezone.now()):
        raise ValidationError("Pix temporariamente indisponível.")
    gross = gross_for_fee(base, rate.percent, rate.fixed_cents)
    return FeeQuote.objects.create(
        customer=customer, reservation=reservation, expedition=reservation.expedition,
        participant_names=list(reservation.participants.order_by("created_at").values_list("full_name", flat=True)),
        payment_plan=reservation.payment_plan, purpose=Payment.Purpose.BALANCE,
        method=Payment.Method.PIX, installments=1, base_cents=base,
        fee_cents=gross-base, total_cents=gross, rate_snapshot=rate_payload(rate),
        expires_at=timezone.now() + timedelta(minutes=10),
    )


def verify_quote_for_payment(*, quote_id, customer, reservation, method, installments, purpose=Payment.Purpose.INITIAL, expected_base=None):
    with transaction.atomic():
        try:
            quote = FeeQuote.objects.select_for_update().get(id=quote_id, customer=customer)
        except FeeQuote.DoesNotExist:
            raise ValidationError("Cotação não encontrada.")
        if quote.used_at or quote.expires_at <= timezone.now():
            raise ValidationError("Cotação expirada. Confirme o valor novamente.")
        if quote.reservation_id != reservation.id:
            raise ValidationError("Cotação não pertence a esta reserva.")
        if quote.expedition_id != reservation.expedition_id or quote.payment_plan != reservation.payment_plan or quote.method != method or quote.installments != installments or quote.purpose != purpose:
            raise ValidationError("Cotação diferente da forma de pagamento escolhida.")
        names = list(reservation.participants.order_by("created_at").values_list("full_name", flat=True))
        if quote.participant_names != names or quote.base_cents != (reservation.deposit_cents if expected_base is None else expected_base):
            raise ValidationError("Dados da reserva mudaram. Confirme o valor novamente.")
        rate = FeeRate.objects.filter(method=method, installments=installments).first()
        if not rate or quote.rate_snapshot["version"] in rate.revoked_versions:
            raise ValidationError("Cotação revogada. Confirme o valor novamente.")
        return quote
