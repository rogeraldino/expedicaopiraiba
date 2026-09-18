from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.customers.services import create_customer_session_token, customer_from_token

from .models import Payment
from .services import create_pix_payment, simulate_paid_event


def payment_payload(payment):
    return {
        "payment_id": str(payment.id),
        "status": payment.status,
        "method": payment.method,
        "amount_cents": payment.amount_cents,
        "pix_copy_paste": payment.pix_copy_paste,
        "expires_at": payment.expires_at,
        "reservation_status": payment.reservation.status,
        "purpose": payment.purpose,
    }


class CreatePixSerializer(serializers.Serializer):
    verification_token = serializers.CharField()
    reservation_id = serializers.UUIDField()

    def create(self, validated_data):
        try:
            customer = customer_from_token(validated_data["verification_token"])
            payment = create_pix_payment(customer=customer, reservation_id=validated_data["reservation_id"])
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        return payment_payload(payment)


class SimulateConfirmationSerializer(serializers.Serializer):
    verification_token = serializers.CharField()

    def create(self, validated_data):
        try:
            customer = customer_from_token(validated_data["verification_token"])
            payment = Payment.objects.select_related("reservation").get(
                id=self.context["payment_id"], reservation__customer=customer
            )
            payment, _ = simulate_paid_event(payment)
            payment.refresh_from_db()
            payment.reservation.refresh_from_db()
        except (DjangoValidationError, Payment.DoesNotExist) as error:
            messages = getattr(error, "messages", ["Pagamento não encontrado."])
            raise serializers.ValidationError(messages)
        result = payment_payload(payment)
        result["customer_session_token"] = create_customer_session_token(customer)
        result["reservation_id"] = str(payment.reservation_id)
        return result


class FakeWebhookSerializer(serializers.Serializer):
    event_id = serializers.CharField(max_length=120)
    external_payment_id = serializers.CharField(max_length=100)
    status = serializers.ChoiceField(choices=("PAID",))
