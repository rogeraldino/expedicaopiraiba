from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import CreatePixSerializer, FakeWebhookSerializer, SimulateConfirmationSerializer, payment_payload
from .services import process_paid_event


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
