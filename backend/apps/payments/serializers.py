from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.customers.services import create_customer_session_token, customer_from_token

from .models import Payment
from .services import create_pix_payment, create_reservation_payment, simulate_paid_event


def payment_payload(payment):
    payload = {
        "payment_id": str(payment.id),
        "status": payment.status,
        "method": payment.method,
        "amount_cents": payment.amount_cents,
        "pix_copy_paste": payment.pix_copy_paste,
        "ticket_url": payment.boleto_url,
        "boleto_barcode": payment.boleto_barcode,
        "card_brand": payment.card_brand,
        "card_last_four": payment.card_last_four,
        "installments": payment.installments,
        "expires_at": payment.expires_at,
        "reservation_status": payment.reservation.status,
        "reservation_id": str(payment.reservation_id),
        "purpose": payment.purpose,
    }
    if payment.reservation.status in ("CONFIRMED", "PAID"):
        payload["customer_session_token"] = create_customer_session_token(payment.reservation.customer)
    return payload


class AddressSerializer(serializers.Serializer):
    zip_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    street_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    street_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    complement = serializers.CharField(max_length=100, required=False, allow_blank=True)
    neighborhood = serializers.CharField(max_length=100, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    federal_unit = serializers.CharField(max_length=2, required=False, allow_blank=True)


class CreatePaymentSerializer(serializers.Serializer):
    verification_token = serializers.CharField()
    reservation_id = serializers.UUIDField()
    method = serializers.ChoiceField(choices=Payment.Method.choices, default=Payment.Method.PIX)
    card_token = serializers.CharField(required=False, allow_blank=True)
    installments = serializers.IntegerField(required=False, default=1, min_value=1, max_value=12)
    payment_method_id = serializers.CharField(required=False, default="visa", allow_blank=True)
    address = AddressSerializer(required=False)

    def create(self, validated_data):
        try:
            customer = customer_from_token(validated_data["verification_token"])
            payment = create_reservation_payment(
                customer=customer,
                reservation_id=validated_data["reservation_id"],
                method=validated_data.get("method", Payment.Method.PIX),
                card_token=validated_data.get("card_token"),
                installments=validated_data.get("installments", 1),
                payment_method_id=validated_data.get("payment_method_id", "visa"),
                address_data=validated_data.get("address"),
            )
        except DjangoValidationError as error:
            messages = getattr(error, "messages", [str(error)])
            raise serializers.ValidationError(messages)
        return payment_payload(payment)


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
