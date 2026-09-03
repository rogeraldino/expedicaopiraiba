from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import serializers

from apps.reservations.models import Reservation

from .models import Expedition


class ExpeditionSerializer(serializers.ModelSerializer):
    available_slots = serializers.SerializerMethodField()
    duration_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = Expedition
        fields = (
            "id",
            "name",
            "slug",
            "destination",
            "departure_location",
            "starts_at",
            "ends_at",
            "duration_days",
            "capacity",
            "available_slots",
            "price_per_person_cents",
            "deposit_cents",
            "summary",
        )

    def get_available_slots(self, expedition):
        active = Q(status__in=(Reservation.Status.PARTIALLY_PAID, Reservation.Status.CONFIRMED, Reservation.Status.PAID))
        held = Q(status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), held_until__gt=timezone.now())
        occupied = expedition.reservations.filter(active | held).aggregate(total=Sum("participant_count"))["total"] or 0
        return max(expedition.capacity - occupied, 0)
