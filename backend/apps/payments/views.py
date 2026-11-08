import hashlib
import hmac
import json
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import urllib.error
import urllib.request

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.http import HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment, PaymentIntent, PaymentTransaction
from .pricing import create_balance_quote, create_fee_quote, quote_payload
from .serializers import (
    CreatePaymentSerializer,
    CreatePixSerializer,
    FakeWebhookSerializer,
    SimulateConfirmationSerializer,
    payment_payload,
)
from .services import create_balance_payment, process_paid_event, simulate_paid_event
from apps.customers.services import customer_from_session_token, customer_from_token
from apps.reservations.customer_views import authenticated_customer, reservation_payload
from apps.reservations.models import Reservation

logger = logging.getLogger(__name__)


def _money_cents(value):
    try:
        return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _store_provider_financials(payment, data):
    details = data.get("transaction_details") or {}
    net = _money_cents(details.get("net_received_amount"))
    fee = max(payment.amount_cents - net, 0) if net is not None else None
    if fee is None and isinstance(data.get("fee_details"), list):
        pieces = [_money_cents(item.get("amount")) for item in data["fee_details"] if isinstance(item, dict)]
        if pieces and all(piece is not None for piece in pieces):
            fee = sum(pieces)
    changes = []
    if net is not None and payment.provider_net_received_cents != net:
        payment.provider_net_received_cents = net
        changes.append("provider_net_received_cents")
    if fee is not None and payment.provider_fee_cents != fee:
        payment.provider_fee_cents = fee
        changes.append("provider_fee_cents")
    if changes:
        payment.save(update_fields=[*changes, "updated_at"])


def _recover_unknown_intent(data_id, data):
    reference = str(data.get("external_reference") or "")
    with transaction.atomic():
        try:
            candidate = PaymentIntent.objects.filter(id=reference).values("reservation_id").first() if reference else None
        except (ValueError, DjangoValidationError):
            candidate = None
        if not candidate:
            return None
        Reservation.objects.select_for_update().get(id=candidate["reservation_id"])
        intent = PaymentIntent.objects.select_for_update().filter(id=reference).first()
        if not intent:
            return None
        if data.get("currency_id") != "BRL" or _money_cents(data.get("transaction_amount")) != intent.amount_cents:
            logger.error("Payment intent %s has mismatched provider amount or currency", intent.id)
            return None
        if intent.payment_id:
            return Payment.objects.select_related("reservation__expedition").get(id=intent.payment_id)
        if intent.status not in ("SUBMITTING", "UNKNOWN"):
            return None
        poi = (data.get("point_of_interaction") or {}).get("transaction_data") or {}
        details = data.get("transaction_details") or {}
        card = data.get("card") or {}
        expiration = None
        if data.get("date_of_expiration"):
            try:
                expiration = datetime.fromisoformat(data["date_of_expiration"])
                if timezone.is_naive(expiration):
                    expiration = timezone.make_aware(expiration)
            except (ValueError, TypeError):
                expiration = None
        payment = Payment.objects.create(
            reservation=intent.reservation, provider="MERCADOPAGO", external_id=str(data_id),
            method=intent.method, purpose=intent.quote.purpose if intent.quote_id else Payment.Purpose.INITIAL,
            amount_cents=intent.amount_cents,
            base_amount_cents=intent.base_amount_cents, fee_amount_cents=intent.fee_amount_cents,
            fee_snapshot=intent.fee_snapshot, installments=intent.installments,
            idempotency_key=intent.idempotency_key, status=Payment.Status.PENDING,
            pix_copy_paste=poi.get("qr_code") or "", pix_qr_code_base64=poi.get("qr_code_base64") or "",
            boleto_url=details.get("external_resource_url") or poi.get("ticket_url") or "",
            card_brand=data.get("payment_method_id") or "", card_last_four=card.get("last_four_digits") or "",
            expires_at=expiration,
        )
        intent.payment = payment
        intent.status = "COMPLETE"
        intent.save(update_fields=["payment", "status", "updated_at"])
        if intent.quote_id:
            intent.quote.used_at = intent.quote.used_at or timezone.now()
            intent.quote.save(update_fields=["used_at"])
        reservation = intent.reservation
        if reservation.status == Reservation.Status.HELD:
            previous_status = reservation.status
            reservation.status = Reservation.Status.AWAITING_PAYMENT
            if expiration and intent.method == Payment.Method.BOLETO:
                reservation.held_until = expiration
            reservation.save(update_fields=["status", "held_until", "updated_at"])
            from apps.reservations.services import record_reservation_event
            record_reservation_event(reservation=reservation, event_type="PAYMENT_RECOVERED",
                previous_status=previous_status, new_status=reservation.status,
                payload={"payment_id": str(payment.id), "intent_id": str(intent.id)})
        return payment


class CreatePixView(APIView):
    def post(self, request):
        # Support both multi-method CreatePaymentSerializer and backward-compatible CreatePixSerializer
        if "method" in request.data:
            serializer = CreatePaymentSerializer(data=request.data)
        else:
            serializer = CreatePixSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.create(serializer.validated_data), status=status.HTTP_201_CREATED)


class PaymentPublicConfigView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({
            "mercadopago_public_key": settings.MERCADOPAGO_PUBLIC_KEY
            if settings.PAYMENT_GATEWAY == "MERCADOPAGO" else "",
        })


class FeeQuoteView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        from .serializers import FeeQuoteSerializer
        serializer = FeeQuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            customer = customer_from_token(serializer.validated_data["verification_token"])
            quote = create_fee_quote(
                customer=customer,
                expedition_slug=serializer.validated_data["expedition_slug"],
                participant_names=serializer.validated_data["participant_names"],
                payment_plan=serializer.validated_data["payment_plan"],
                method=serializer.validated_data["method"],
                installments=serializer.validated_data["installments"],
                reservation_id=serializer.validated_data.get("reservation_id"),
                card_bin=serializer.validated_data.get("card_bin", ""),
                issuer_id=serializer.validated_data.get("issuer_id", ""),
            )
        except DjangoValidationError as error:
            return Response({"detail": error.messages}, status=400)
        return Response(quote_payload(quote), status=201)


class BalanceFeeQuoteView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, reservation_id):
        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=401)
        try:
            reservation = Reservation.objects.get(id=reservation_id, customer=customer)
            from .reconciliation import refresh_pending_balance_payment
            refresh_pending_balance_payment(reservation)
            active = reservation.payments.filter(purpose=Payment.Purpose.BALANCE,
                status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING)).order_by("-created_at").first()
            if active:
                return Response({"existing_payment": payment_payload(active)})
            return Response(quote_payload(create_balance_quote(customer=customer, reservation_id=reservation_id)), status=201)
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=404)
        except DjangoValidationError as error:
            return Response({"detail": error.messages}, status=400)


class PaymentStatusView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, payment_id):
        try:
            payment = Payment.objects.select_related("reservation__customer", "reservation__expedition").get(
                id=payment_id
            )
        except Payment.DoesNotExist:
            return Response({"detail": "Pagamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        customer = None
        verification_token = request.headers.get("X-Verification-Token", "")
        bearer = request.headers.get("Authorization", "")
        try:
            if verification_token:
                customer = customer_from_token(verification_token)
            elif bearer.startswith("Bearer "):
                customer = customer_from_session_token(bearer[7:])
        except DjangoValidationError:
            pass
        if not customer or customer.id != payment.reservation.customer_id:
            return Response({"detail": "Pagamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        # Active auto-heal reconciliation during polling: check gateway directly if still pending
        if (
            payment.status in (Payment.Status.PENDING, Payment.Status.PROCESSING)
            and payment.external_id
            and not payment.external_id.startswith("fake_")
        ):
            access_token = getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "")
            if payment.provider == "MERCADOPAGO" and access_token:
                try:
                    req = urllib.request.Request(
                        f"https://api.mercadopago.com/v1/payments/{payment.external_id}",
                        headers={"Authorization": f"Bearer {access_token}"},
                        method="GET",
                    )
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        if resp.status == 200:
                            data = json.loads(resp.read().decode("utf-8"))
                            mp_status = data.get("status")
                            _store_provider_financials(payment, data)

                            # Backfill qr_code_base64 if missing on model
                            poi = data.get("point_of_interaction", {}).get("transaction_data", {})
                            qr_b64 = poi.get("qr_code_base64", "")
                            if qr_b64 and not payment.pix_qr_code_base64:
                                payment.pix_qr_code_base64 = qr_b64
                                payment.save(update_fields=["pix_qr_code_base64", "updated_at"])

                            if mp_status == "approved":
                                logger.info(
                                    "Active reconciliation detected approved payment for %s (MP id: %s)",
                                    payment.id,
                                    payment.external_id,
                                )
                                process_paid_event(
                                    external_event_id=f"auto_heal_{payment.external_id}",
                                    external_payment_id=str(payment.external_id),
                                    payload=data,
                                )
                                payment.refresh_from_db()
                                payment.reservation.refresh_from_db()
                except Exception as e:
                    logger.debug("Active reconciliation poll exception for payment %s: %s", payment.id, e)

        return Response(payment_payload(payment))


class SimulateConfirmationView(APIView):
    def post(self, request, payment_id):
        gateway = getattr(settings, "PAYMENT_GATEWAY", "FAKE")
        allowed = getattr(settings, "ALLOW_SIMULATED_PAYMENTS", False)
        if gateway != "FAKE" and not allowed:
            return Response(
                {"detail": "Simulação de pagamento desativada neste ambiente."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SimulateConfirmationSerializer(data=request.data, context={"payment_id": payment_id})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.create(serializer.validated_data))


class FakeWebhookView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        if request.headers.get("X-Fake-Webhook-Secret") != settings.FAKE_WEBHOOK_SECRET:
            return Response({"detail": "Assinatura inválida."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = FakeWebhookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment, processed = process_paid_event(
                external_event_id=serializer.validated_data["event_id"],
                external_payment_id=serializer.validated_data["external_payment_id"],
                payload=request.data,
            )
            payment.refresh_from_db()
            payment.reservation.refresh_from_db()
        except DjangoValidationError as error:
            return Response({"detail": error.messages}, status=status.HTTP_400_BAD_REQUEST)
        result = payment_payload(payment)
        result["processed"] = processed
        return Response(result)


class BalancePaymentView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, reservation_id):
        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=401)
        try:
            payment = create_balance_payment(customer=customer, reservation_id=reservation_id, quote_id=request.data.get("quote_id"))
        except Reservation.DoesNotExist:
            return Response({"detail": "Reserva não encontrada."}, status=404)
        except DjangoValidationError as error:
            return Response({"detail": error.messages}, status=400)
        if payment is None:
            return Response({"reservation_status": Reservation.Status.PAID, "remaining_balance_cents": 0})
        return Response(payment_payload(payment), status=201)


class BalancePaymentConfirmView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, reservation_id):
        gateway = getattr(settings, "PAYMENT_GATEWAY", "FAKE")
        allowed = getattr(settings, "ALLOW_SIMULATED_PAYMENTS", False)
        if gateway != "FAKE" and not allowed:
            return Response(
                {"detail": "Simulação de pagamento desativada neste ambiente."},
                status=status.HTTP_403_FORBIDDEN,
            )

        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=401)
        try:
            payment = (
                Payment.objects.select_related("reservation")
                .filter(
                    reservation_id=reservation_id,
                    reservation__customer=customer,
                    purpose=Payment.Purpose.BALANCE,
                    status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING),
                )
                .latest("created_at")
            )
            payment, _ = simulate_paid_event(payment)
            payment.refresh_from_db()
            payment.reservation.refresh_from_db()
        except Payment.DoesNotExist:
            return Response({"detail": "Cobrança de saldo não encontrada."}, status=404)
        reservation = (
            Reservation.objects.select_related("expedition")
            .prefetch_related(
                "participants__product_choices",
                "participants__dietary_restrictions__restriction",
                "participants__checklist_completions",
                "payments",
                "events",
                "expedition__checklist_items",
            )
            .get(id=reservation_id, customer=customer)
        )
        return Response(reservation_payload(reservation))


@method_decorator(csrf_exempt, name="dispatch")
class MercadoPagoWebhookView(View):
    def get(self, request, *args, **kwargs):
        return self.post(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        secret = getattr(settings, "MERCADOPAGO_WEBHOOK_SECRET", "")
        signature_header = request.headers.get("x-signature") or request.headers.get("X-Signature", "")
        request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-Id", "")

        try:
            body = json.loads(request.body.decode("utf-8")) if request.body else {}
        except Exception:
            body = {}

        data_id = (
            body.get("data", {}).get("id")
            or request.GET.get("data.id")
            or request.GET.get("id")
            or body.get("id")
        )

        # Enforce HMAC SHA-256 signature verification when signature is present (PAY-02)
        if secret and signature_header:
            if not request_id:
                logger.warning("Mercado Pago webhook rejected: missing request-id header.")
                return HttpResponse("Missing request-id", status=401)

            try:
                parts = dict(part.strip().split("=", 1) for part in signature_header.split(","))
                ts = parts.get("ts")
                v1 = parts.get("v1")
                if not ts or not v1:
                    return HttpResponse("Invalid signature header format", status=401)

                canonical = f"id:{data_id};request-id:{request_id};ts:{ts};"
                expected_sig = hmac.new(
                    secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256
                ).hexdigest()
                if not hmac.compare_digest(expected_sig, v1):
                    logger.warning("Mercado Pago webhook signature mismatch.")
                    return HttpResponse("Invalid signature", status=401)
            except Exception as e:
                logger.error("Error parsing Mercado Pago webhook signature: %s", e)
                return HttpResponse("Invalid signature format", status=400)
        elif not signature_header:
            logger.info("Mercado Pago webhook received without x-signature header (IPN). Direct API authentication will be performed.")

        event_type = (
            body.get("type")
            or request.GET.get("type")
            or request.GET.get("topic")
            or body.get("action")
        )

        if not data_id:
            return JsonResponse({"status": "ignored_no_id"}, status=200)

        if event_type in ("payment", "payment.updated", "payment.created", None):
            access_token = getattr(settings, "MERCADOPAGO_ACCESS_TOKEN", "")
            if not access_token:
                logger.error("MERCADOPAGO_ACCESS_TOKEN is not configured.")
                return JsonResponse({"status": "token_missing"}, status=500)

            req = urllib.request.Request(
                f"https://api.mercadopago.com/v1/payments/{data_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                method="GET",
            )
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status == 200:
                        payment_data = json.loads(resp.read().decode("utf-8"))
                        status_name = payment_data.get("status")
                        if status_name == "approved":
                            currency = payment_data.get("currency_id")
                            amount = payment_data.get("transaction_amount")
                            ext_ref = payment_data.get("external_reference")

                            try:
                                payment = Payment.objects.select_related("reservation__expedition").get(
                                    external_id=str(data_id)
                                )
                            except Payment.DoesNotExist:
                                payment = _recover_unknown_intent(data_id, payment_data)
                                if not payment:
                                    logger.warning("Payment with external_id %s not reconciled yet.", data_id)
                                    return JsonResponse({"status": "awaiting_local_reconciliation"}, status=503)
                            _store_provider_financials(payment, payment_data)

                            # Reconcile currency, external_reference and amount (PAY-03)
                            if (
                                currency != "BRL"
                                or ext_ref not in (str(payment.reservation_id), str(payment.paymentintent.id) if hasattr(payment, "paymentintent") else "")
                                or round(amount, 2) != round(payment.amount_cents / 100.0, 2)
                            ):
                                logger.error(
                                    "Payment reconciliation mismatch for payment %s: currency=%s, ext_ref=%s, amount=%s",
                                    data_id,
                                    currency,
                                    ext_ref,
                                    amount,
                                )
                                PaymentTransaction.objects.get_or_create(
                                    external_event_id=f"mp_{data_id}_mismatch",
                                    defaults={
                                        "payment": payment,
                                        "event_type": "PAYMENT_RECONCILIATION_FAILED",
                                        "previous_status": payment.status,
                                        "new_status": "REJECTED_MISMATCH",
                                        "payload": payment_data,
                                    },
                                )
                                return JsonResponse({"status": "rejected_mismatch"}, status=200)

                            # Check for late payment / expired reservation
                            reservation = payment.reservation
                            if reservation.status in (Reservation.Status.EXPIRED, Reservation.Status.CANCELLED):
                                from apps.operations.views import expeditions_with_occupancy

                                exp_with_occ = (
                                    expeditions_with_occupancy().filter(id=reservation.expedition_id).first()
                                )
                                available = (
                                    max(exp_with_occ.capacity - exp_with_occ.occupied_slots, 0) if exp_with_occ else 0
                                )
                                if available < reservation.participant_count:
                                    logger.warning(
                                        "Overbooking prevented on late payment for reservation %s", reservation.id
                                    )
                                    PaymentTransaction.objects.get_or_create(
                                        external_event_id=f"mp_{data_id}_overbooking_prevented",
                                        defaults={
                                            "payment": payment,
                                            "event_type": "LATE_PAYMENT_OVERBOOKING_PREVENTED",
                                            "previous_status": payment.status,
                                            "new_status": "REQUIRES_REFUND",
                                            "payload": payment_data,
                                        },
                                    )
                                    # Keep the money in the ledger even when the seat
                                    # cannot be restored; operations must refund it.

                            logger.info("Mercado Pago payment %s approved. Processing...", data_id)
                            process_paid_event(
                                external_event_id=f"mp_{data_id}_{status_name}",
                                external_payment_id=str(data_id),
                                payload=payment_data,
                            )
                        else:
                            payment = Payment.objects.filter(external_id=str(data_id)).first()
                            if not payment:
                                payment = _recover_unknown_intent(data_id, payment_data)
                            if not payment:
                                return JsonResponse({"status": "awaiting_local_reconciliation"}, status=503)
                            if status_name in ("rejected", "cancelled") and payment.status not in (Payment.Status.PAID, Payment.Status.REFUNDED):
                                payment.status = Payment.Status.FAILED if status_name == "rejected" else Payment.Status.CANCELLED
                                payment.save(update_fields=["status", "updated_at"])
                            logger.info(
                                "Mercado Pago payment %s status is %s (not approved).",
                                data_id,
                                status_name,
                            )
                    else:
                        logger.warning(
                            "Could not fetch payment %s from Mercado Pago (HTTP %s).",
                            data_id,
                            resp.status,
                        )
            except urllib.error.HTTPError as e:
                logger.warning(
                    "Could not fetch payment %s from Mercado Pago (HTTP %s): %s",
                    data_id,
                    e.code,
                    e.read().decode("utf-8", errors="replace"),
                )
            except Exception as e:
                logger.error("Error processing Mercado Pago payment %s: %s", data_id, e)

        return JsonResponse({"status": "received"}, status=200)
