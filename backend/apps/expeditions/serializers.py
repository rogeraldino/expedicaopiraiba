from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import serializers

from apps.reservations.models import Reservation

from .models import Expedition, Lodge, TargetSpecies


class LodgeSerializer(serializers.ModelSerializer):
    river_name = serializers.CharField(source="river.name", read_only=True, default=None)
    amenities = serializers.SerializerMethodField()
    amenities_detailed = serializers.SerializerMethodField()

    class Meta:
        model = Lodge
        fields = (
            "id",
            "name",
            "slug",
            "city",
            "state",
            "river_section",
            "river_name",
            "description",
            "boat_fleet_details",
            "amenities",
            "amenities_detailed",
            "meeting_point",
            "directions",
            "cover_image_url",
            "active",
        )

    def get_amenities(self, obj):
        structured = list(obj.amenities_structured.filter(active=True).values_list("name", flat=True))
        if structured:
            return structured
        return obj.amenities or []

    def get_amenities_detailed(self, obj):
        return [
            {
                "id": str(a.id),
                "name": a.name,
                "category": a.category,
                "category_display": a.get_category_display(),
                "icon_key": a.icon_key,
                "description": a.description,
            }
            for a in obj.amenities_structured.filter(active=True)
        ]


class TargetSpeciesSerializer(serializers.ModelSerializer):
    class Meta:
        model = TargetSpecies
        fields = ("slug", "common_name", "scientific_name", "category")


class ExpeditionSerializer(serializers.ModelSerializer):
    available_slots = serializers.SerializerMethodField()
    duration_days = serializers.IntegerField(read_only=True)
    lodge = LodgeSerializer(read_only=True)
    all_inclusive_package_name = serializers.CharField(source="all_inclusive_package.name", read_only=True, default=None)
    beverage_package_name = serializers.CharField(source="beverage_package.name", read_only=True, default=None)
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
            "all_inclusive_package_name",
            "beverage_package_name",
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
