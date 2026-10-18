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

from .serializers import CreatePixSerializer, FakeWebhookSerializer, SimulateConfirmationSerializer, payment_payload
from .services import process_paid_event
from .services import create_balance_payment, simulate_paid_event
from .models import Payment
from apps.customers.services import customer_from_session_token
from apps.reservations.customer_views import authenticated_customer, reservation_payload
from apps.reservations.models import Reservation

logger = logging.getLogger(__name__)


class CreatePixView(APIView):
    def post(self, request):
        serializer = CreatePixSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.create(serializer.validated_data), status=status.HTTP_201_CREATED)


class SimulateConfirmationView(APIView):
    def post(self, request, payment_id):
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
        customer = authenticated_customer(request)
        if not customer:
            return Response({"detail": "Sessão inválida ou expirada."}, status=401)
        try:
            payment = Payment.objects.select_related("reservation").filter(reservation_id=reservation_id, reservation__customer=customer, purpose=Payment.Purpose.BALANCE, status__in=(Payment.Status.PENDING, Payment.Status.PROCESSING)).latest("created_at")
            payment, _ = simulate_paid_event(payment)
            payment.refresh_from_db(); payment.reservation.refresh_from_db()
        except Payment.DoesNotExist:
            return Response({"detail": "Cobrança de saldo não encontrada."}, status=404)
        reservation = Reservation.objects.select_related("expedition").prefetch_related(
            "participants__product_choices",
            "participants__dietary_restrictions__restriction",
            "participants__checklist_completions",
            "payments",
            "events",
            "expedition__checklist_items",
        ).get(id=reservation_id, customer=customer)
        return Response(reservation_payload(reservation))


@method_decorator(csrf_exempt, name="dispatch")
class MercadoPagoWebhookView(View):
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

        if secret and signature_header and request_id and data_id:
            try:
                parts = dict(part.strip().split("=", 1) for part in signature_header.split(","))
                ts = parts.get("ts")
                v1 = parts.get("v1")
                if ts and v1:
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
