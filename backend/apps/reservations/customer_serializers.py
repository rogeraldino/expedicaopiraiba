from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.customers.validators import normalize_phone, validate_cpf

from .models import ReservationEvent, ReservationParticipant
from .services import record_reservation_event


class CustomerParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservationParticipant
        fields = ("id", "full_name", "cpf", "birth_date", "phone", "emergency_contact_name", "emergency_contact_phone", "vest_size", "health_notes", "operational_notes", "onboarding_status", "completed_at")
        read_only_fields = ("id", "onboarding_status", "completed_at")

    def validate_cpf(self, value):
        if not value:
            return ""
        try:
            return validate_cpf(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)

    def validate_phone(self, value):
        if not value:
            return ""
        try:
            return normalize_phone(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)

    def validate_emergency_contact_phone(self, value):
        if not value:
            return ""
        try:
            return normalize_phone(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)

    @transaction.atomic
    def update(self, instance, validated_data):
        participant = ReservationParticipant.objects.select_for_update().get(id=instance.id)
        for field, value in validated_data.items():
            setattr(participant, field, value)
        required = (participant.full_name, participant.phone, participant.emergency_contact_name, participant.emergency_contact_phone)
        participant.onboarding_status = ReservationParticipant.OnboardingStatus.COMPLETED if all(required) else ReservationParticipant.OnboardingStatus.IN_PROGRESS
        participant.completed_at = timezone.now() if participant.onboarding_status == ReservationParticipant.OnboardingStatus.COMPLETED else None
        participant.save()
        record_reservation_event(reservation=participant.reservation, event_type="PARTICIPANT_UPDATED", actor_type=ReservationEvent.ActorType.CUSTOMER, actor_identifier=str(participant.reservation.customer_id), payload={"participant_id": str(participant.id), "onboarding_status": participant.onboarding_status})
        return participant
