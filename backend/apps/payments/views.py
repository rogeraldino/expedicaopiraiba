import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment, PaymentTransaction
from .serializers import (
    CreatePaymentSerializer,
    CreatePixSerializer,
    FakeWebhookSerializer,
    SimulateConfirmationSerializer,
    payment_payload,
)
from .services import create_balance_payment, process_paid_event, simulate_paid_event
from apps.customers.services import customer_from_session_token
from apps.reservations.customer_views import authenticated_customer, reservation_payload
from apps.reservations.models import Reservation

logger = logging.getLogger(__name__)


class CreatePixView(APIView):
    def post(self, request):
        # Support both multi-method CreatePaymentSerializer and backward-compatible CreatePixSerializer
        if "method" in request.data:
            serializer = CreatePaymentSerializer(data=request.data)
        else:
            serializer = CreatePixSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.create(serializer.validated_data), status=status.HTTP_201_CREATED)


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
            payment = create_balance_payment(customer=customer, reservation_id=reservation_id)
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
                                logger.warning("Payment with external_id %s not found in DB.", data_id)
                                return JsonResponse({"status": "ignored_unknown_payment"}, status=200)

                            # Reconcile currency, external_reference and amount (PAY-03)
                            if (
                                currency != "BRL"
                                or ext_ref != str(payment.reservation_id)
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
                                    return JsonResponse({"status": "overbooking_requires_refund"}, status=200)

                            logger.info("Mercado Pago payment %s approved. Processing...", data_id)
                            process_paid_event(
                                external_event_id=f"mp_{data_id}_{status_name}",
                                external_payment_id=str(data_id),
                                payload=payment_data,
                            )
                        else:
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
