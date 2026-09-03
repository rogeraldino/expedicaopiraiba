from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.customers.services import customer_from_token, start_verification, verify_challenge

from .services import create_hold


class IdentifySerializer(serializers.Serializer):
    cpf = serializers.CharField(max_length=18)
    full_name = serializers.CharField(max_length=160)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)

    def create(self, validated_data):
        try:
            challenge, code = start_verification(**validated_data)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        result = {
            "challenge_id": str(challenge.id),
            "masked_destination": f"WhatsApp terminado em {challenge.customer.phone[-4:]}",
            "expires_in_seconds": settings.OTP_EXPIRY_MINUTES * 60,
        }
        if settings.DEBUG:
            result["dev_code"] = code
        return result


class VerifySerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(r"^\d{6}$")

    def create(self, validated_data):
        try:
            return {"verification_token": verify_challenge(**validated_data)}
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)


class HoldSerializer(serializers.Serializer):
    verification_token = serializers.CharField()
    expedition_slug = serializers.SlugField()
    participant_names = serializers.ListField(child=serializers.CharField(max_length=160), min_length=1, max_length=12)
    payment_plan = serializers.ChoiceField(choices=("DEPOSIT", "FULL"))

    def create(self, validated_data):
        try:
            customer = customer_from_token(validated_data.pop("verification_token"))
            reservation = create_hold(customer=customer, **validated_data)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        return {
            "reservation_id": str(reservation.id),
            "status": reservation.status,
            "held_until": reservation.held_until,
            "participant_count": reservation.participant_count,
            "total_price_cents": reservation.total_price_cents,
            "amount_due_cents": reservation.deposit_cents,
            "payment_plan": reservation.payment_plan,
            "balance_due_at": reservation.balance_due_at,
            "paid_amount_cents": reservation.paid_amount_cents,
            "remaining_balance_cents": reservation.remaining_balance_cents,
        }
