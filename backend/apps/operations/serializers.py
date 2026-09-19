from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.expeditions.models import Expedition, ExpeditionSpecies, Lodge, TargetSpecies
from apps.expeditions.services import transition_expedition
from apps.payments.models import Payment
from apps.reservations.models import Reservation, ReservationEvent


class OperationsLodgeSerializer(serializers.ModelSerializer):
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
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")


class OperationsExpeditionSerializer(serializers.ModelSerializer):
    occupied_slots = serializers.IntegerField(read_only=True)
    available_slots = serializers.SerializerMethodField()
    duration_days = serializers.IntegerField(read_only=True)
    lodge = OperationsLodgeSerializer(read_only=True)
    lodge_id = serializers.PrimaryKeyRelatedField(
        queryset=Lodge.objects.all(), source="lodge", required=False, allow_null=True
    )
    target_species = serializers.SerializerMethodField()
    species_slugs = serializers.ListField(child=serializers.CharField(), required=False, write_only=True)

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
            "occupied_slots",
            "available_slots",
            "price_per_person_cents",
            "deposit_cents",
            "balance_due_days_before",
            "status",
            "summary",
            "cover_image_url",
            "gallery_image_urls",
            "inclusions",
            "lodge",
            "lodge_id",
            "target_species",
            "species_slugs",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "occupied_slots", "available_slots", "duration_days", "created_at", "updated_at")

    def get_available_slots(self, obj):
        return max(obj.capacity - getattr(obj, "occupied_slots", 0), 0)

    def get_target_species(self, obj):
        links = obj.expedition_species.select_related("species").order_by("-is_primary", "display_order")
        return [
            {
                "slug": link.species.slug,
                "common_name": link.species.common_name,
                "category": link.species.category,
                "is_primary": link.is_primary,
            }
            for link in links
            if link.species.active
        ]

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        price = attrs.get("price_per_person_cents", getattr(self.instance, "price_per_person_cents", 0))
        deposit = attrs.get("deposit_cents", getattr(self.instance, "deposit_cents", 0))
        if starts_at and ends_at and ends_at < starts_at:
            raise serializers.ValidationError({"ends_at": "A data final deve ser posterior à inicial."})
        if deposit > price:
            raise serializers.ValidationError({"deposit_cents": "O sinal não pode superar o valor por pessoa."})
        return attrs

    def _sync_species(self, expedition, slugs):
        ExpeditionSpecies.objects.filter(expedition=expedition).delete()
        for index, slug in enumerate(slugs):
            sp = TargetSpecies.objects.filter(slug=slug, active=True).first()
            if sp:
                ExpeditionSpecies.objects.create(
                    expedition=expedition,
                    species=sp,
                    is_primary=index == 0,
                    display_order=index,
                )

    @transaction.atomic
    def create(self, validated_data):
        species_slugs = validated_data.pop("species_slugs", None)
        instance = super().create(validated_data)
        if species_slugs is not None:
            self._sync_species(instance, species_slugs)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        species_slugs = validated_data.pop("species_slugs", None)
        target_status = validated_data.pop("status", instance.status)
        instance = super().update(instance, validated_data)
        if target_status != instance.status:
            instance = transition_expedition(expedition_id=instance.id, target_status=target_status)
        if species_slugs is not None:
            self._sync_species(instance, species_slugs)
        return instance


class OperationsPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("id", "method", "provider", "amount_cents", "status", "paid_at", "created_at")


class OperationsReservationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservationEvent
        fields = ("id", "event_type", "actor_type", "actor_identifier", "previous_status", "new_status", "reason", "payload", "created_at")


class OperationsReservationSerializer(serializers.ModelSerializer):
    customer = serializers.SerializerMethodField()
    expedition = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    payments = OperationsPaymentSerializer(many=True, read_only=True)
    events = OperationsReservationEventSerializer(many=True, read_only=True)
    paid_amount_cents = serializers.IntegerField(read_only=True)
    remaining_balance_cents = serializers.IntegerField(read_only=True)
    alerts = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = ("id", "status", "participant_count", "unit_price_cents", "total_price_cents", "deposit_cents", "payment_plan", "paid_amount_cents", "remaining_balance_cents", "balance_due_at", "held_until", "beverage_preferences", "created_at", "customer", "expedition", "participants", "payments", "events", "alerts")

    def get_customer(self, obj):
        return {"id": str(obj.customer_id), "name": obj.customer.full_name, "cpf": obj.customer.cpf, "email": obj.customer.email, "phone": obj.customer.phone}

    def get_expedition(self, obj):
        return {"id": str(obj.expedition_id), "name": obj.expedition.name, "slug": obj.expedition.slug, "starts_at": obj.expedition.starts_at}

    def get_participants(self, obj):
        required = set(obj.expedition.checklist_items.filter(active=True, required=True).values_list("id", flat=True))
        return [{"id": str(item.id), "name": item.full_name, "phone": item.phone, "onboarding_status": item.onboarding_status, "preferences_confirmed": bool(item.product_choices_confirmed_at), "dietary_confirmed": bool(item.dietary_confirmed_at), "checklist_completed": required.issubset(set(item.checklist_completions.filter(completed=True).values_list("item_id", flat=True))), "selected_offers": [{"id": str(c.expedition_product_id), "name": c.expedition_product.product.name} for c in item.product_choices.all() if c.selected], "dietary_restrictions": [x.restriction.name for x in item.dietary_restrictions.all()], "dietary_details": item.dietary_details} for item in obj.participants.all()]

    def get_alerts(self, obj):
        participants = list(obj.participants.all())
        alerts = []
        if any(not p.product_choices_confirmed_at or not p.dietary_confirmed_at for p in participants): alerts.append("Há preferências pendentes.")
        if any(p.dietary_restrictions.exclude(restriction__is_none=True).exists() for p in participants): alerts.append("Há restrições alimentares para revisão.")
        if obj.remaining_balance_cents and obj.balance_due_at and obj.balance_due_at < timezone.localdate(): alerts.append("Saldo vencido.")
        required = set(obj.expedition.checklist_items.filter(active=True, required=True).values_list("id", flat=True))
        if required and any(not required.issubset(set(p.checklist_completions.filter(completed=True).values_list("item_id", flat=True))) for p in participants): alerts.append("Há checklist obrigatório pendente.")
        return alerts
