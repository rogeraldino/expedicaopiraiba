from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import serializers

from apps.reservations.models import Reservation

from .models import Expedition, Lodge, TargetSpecies


class LodgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lodge
        fields = (
            "id",
            "name",
            "slug",
            "city",
            "state",
            "river_section",
            "description",
            "amenities",
            "meeting_point",
            "directions",
            "cover_image_url",
            "active",
        )


class TargetSpeciesSerializer(serializers.ModelSerializer):
    class Meta:
        model = TargetSpecies
        fields = ("slug", "common_name", "scientific_name", "category")


class ExpeditionSerializer(serializers.ModelSerializer):
    available_slots = serializers.SerializerMethodField()
    duration_days = serializers.IntegerField(read_only=True)
    lodge = LodgeSerializer(read_only=True)
    target_species = serializers.SerializerMethodField()

    class Meta:
        model = Expedition
        fields = (
            "id",
            "name",
            "slug",
            "destination",
            "departure_location",
            "meeting_instructions",
            "starts_at",
            "ends_at",
            "duration_days",
            "capacity",
            "available_slots",
            "price_per_person_cents",
            "deposit_cents",
            "summary",
            "cover_image_url",
            "gallery_image_urls",
            "inclusions",
            "lodge",
            "target_species",
        )

    def get_available_slots(self, expedition):
        active = Q(status__in=(Reservation.Status.PARTIALLY_PAID, Reservation.Status.CONFIRMED, Reservation.Status.PAID))
        held = Q(status__in=(Reservation.Status.HELD, Reservation.Status.AWAITING_PAYMENT), held_until__gt=timezone.now())
        occupied = expedition.reservations.filter(active | held).aggregate(total=Sum("participant_count"))["total"] or 0
        return max(expedition.capacity - occupied, 0)

    def get_target_species(self, expedition):
        links = expedition.expedition_species.select_related("species").order_by("-is_primary", "display_order")
        return [
            {
                "slug": link.species.slug,
                "common_name": link.species.common_name,
                "scientific_name": link.species.scientific_name,
                "category": link.species.category,
                "is_primary": link.is_primary,
            }
            for link in links
            if link.species.active
        ]
