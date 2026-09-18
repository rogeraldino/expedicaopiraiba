from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
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
