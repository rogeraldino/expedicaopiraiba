import math

from django.db import models, transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from apps.customers.models import Customer, CustomerProfile
from apps.expeditions.models import (
    AllInclusivePackage,
    Amenity,
    BeveragePackage,
    BeveragePackageItem,
    Expedition,
    ExpeditionProduct,
    ExpeditionSpecies,
    FishingGearProduct,
    GearCategory,
    Lodge,
    LodgeAmenityLink,
    Product,
    River,
    RiverSpecies,
    TargetSpecies,
)
from apps.expeditions.services import transition_expedition
from apps.payments.models import Payment
from apps.reservations.models import Reservation, ReservationEvent, ReservationGearAddon, ReservationParticipant


class OperationsSpeciesSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(max_length=60, required=False)

    class Meta:
        model = TargetSpecies
        fields = ("slug", "common_name", "scientific_name", "category", "active")

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = slugify(validated_data.get("common_name", ""))
        else:
            validated_data["slug"] = slugify(validated_data["slug"])
        return super().create(validated_data)


class AmenitySerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = Amenity
        fields = (
            "id",
            "name",
            "category",
            "category_display",
            "icon_key",
            "description",
            "display_order",
            "active",
        )


class RiverSpeciesSerializer(serializers.ModelSerializer):
    species_name = serializers.CharField(source="species.common_name", read_only=True)
    species_slug = serializers.CharField(source="species.slug", read_only=True)
    scientific_name = serializers.CharField(source="species.scientific_name", read_only=True)
    category = serializers.CharField(source="species.category", read_only=True)

    class Meta:
        model = RiverSpecies
        fields = (
            "id",
            "species",
            "species_name",
            "species_slug",
            "scientific_name",
            "category",
            "is_native",
            "is_trophy",
            "best_season",
        )


class RiverSerializer(serializers.ModelSerializer):
    basin_display = serializers.CharField(source="get_basin_display", read_only=True)
    species_count = serializers.IntegerField(source="river_species.count", read_only=True)
    lodges_count = serializers.IntegerField(source="lodges.count", read_only=True)

    class Meta:
        model = River
        fields = (
            "id",
            "name",
            "slug",
            "basin",
            "basin_display",
            "states",
            "description",
            "regulations",
            "active",
            "species_count",
            "lodges_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = slugify(validated_data.get("name", ""))
        else:
            validated_data["slug"] = slugify(validated_data["slug"])
        return super().create(validated_data)


class OperationsLodgeSerializer(serializers.ModelSerializer):
    river = RiverSerializer(read_only=True)
    river_id = serializers.PrimaryKeyRelatedField(
        queryset=River.objects.all(), source="river", required=False, allow_null=True
    )
    river_section = serializers.CharField(required=False, allow_blank=True, default="")
    amenity_ids = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    amenities_detailed = serializers.SerializerMethodField()
    target_species = OperationsSpeciesSerializer(many=True, read_only=True)
    species_slugs = serializers.ListField(child=serializers.CharField(), required=False, write_only=True)

    class Meta:
        model = Lodge
        fields = (
            "id",
            "name",
            "slug",
            "city",
            "state",
            "river_section",
            "river",
            "river_id",
            "description",
            "boat_fleet_details",
            "amenities",
            "amenity_ids",
            "amenities_detailed",
            "target_species",
            "species_slugs",
            "meeting_point",
            "directions",
            "cover_image_url",
            "active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")

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

    def create(self, validated_data):
        amenity_ids = validated_data.pop("amenity_ids", None)
        species_slugs = validated_data.pop("species_slugs", None)
        lodge = super().create(validated_data)
        if amenity_ids is not None:
            self._sync_amenities(lodge, amenity_ids)
        if species_slugs is not None:
            lodge.target_species.set(TargetSpecies.objects.filter(slug__in=species_slugs, active=True))
        return lodge

    def update(self, instance, validated_data):
        amenity_ids = validated_data.pop("amenity_ids", None)
        species_slugs = validated_data.pop("species_slugs", None)
        lodge = super().update(instance, validated_data)
        if amenity_ids is not None:
            self._sync_amenities(lodge, amenity_ids)
        if species_slugs is not None:
            lodge.target_species.set(TargetSpecies.objects.filter(slug__in=species_slugs, active=True))
        return lodge

    def _sync_amenities(self, lodge, amenity_ids):
        amenities = list(Amenity.objects.filter(id__in=amenity_ids, active=True))
        LodgeAmenityLink.objects.filter(lodge=lodge).delete()
        for am in amenities:
            LodgeAmenityLink.objects.create(lodge=lodge, amenity=am)
        lodge.amenities = [am.name for am in amenities]
        lodge.save(update_fields=["amenities"])


class AllInclusivePackageSerializer(serializers.ModelSerializer):
    expeditions_count = serializers.IntegerField(source="expeditions.count", read_only=True)

    class Meta:
        model = AllInclusivePackage
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "inclusions",
            "active",
            "expeditions_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "expeditions_count", "created_at", "updated_at")

    def validate_inclusions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("As inclusões devem ser fornecidas como uma lista de textos.")
        cleaned = [item.strip() for item in value if isinstance(item, str) and item.strip()]
        return cleaned


class BeveragePackageItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_category = serializers.CharField(source="product.category", read_only=True)
    product_unit = serializers.CharField(source="product.unit", read_only=True)

    class Meta:
        model = BeveragePackageItem
        fields = (
            "id",
            "product",
            "product_name",
            "product_category",
            "product_unit",
            "standard_quantity_per_participant",
            "display_order",
            "note",
        )


class BeveragePackageSerializer(serializers.ModelSerializer):
    items = BeveragePackageItemSerializer(many=True, read_only=True)
    items_payload = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    expeditions_count = serializers.IntegerField(source="expeditions.count", read_only=True)

    class Meta:
        model = BeveragePackage
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "active",
            "items",
            "items_payload",
            "expeditions_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "items", "expeditions_count", "created_at", "updated_at")

    @transaction.atomic
    def create(self, validated_data):
        items_payload = validated_data.pop("items_payload", None)
        instance = super().create(validated_data)
        if items_payload:
            self._sync_items(instance, items_payload)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        items_payload = validated_data.pop("items_payload", None)
        instance = super().update(instance, validated_data)
        if items_payload is not None:
            self._sync_items(instance, items_payload)
        return instance

    def _sync_items(self, package, items_data):
        package.items.all().delete()
        for idx, item_data in enumerate(items_data):
            product_id = item_data.get("product_id") or item_data.get("product")
            product = Product.objects.filter(id=product_id, active=True).first()
            if product:
                BeveragePackageItem.objects.create(
                    package=package,
                    product=product,
                    standard_quantity_per_participant=item_data.get("standard_quantity_per_participant", 1),
                    display_order=item_data.get("display_order", idx),
                    note=item_data.get("note", ""),
                )


class OperationsExpeditionSerializer(serializers.ModelSerializer):
    occupied_slots = serializers.IntegerField(read_only=True)
    available_slots = serializers.SerializerMethodField()
    duration_days = serializers.IntegerField(read_only=True)
    lodge = OperationsLodgeSerializer(read_only=True)
    lodge_id = serializers.PrimaryKeyRelatedField(
        queryset=Lodge.objects.all(), source="lodge", required=False, allow_null=True
    )
    all_inclusive_package = serializers.SerializerMethodField()
    all_inclusive_package_id = serializers.PrimaryKeyRelatedField(
        queryset=AllInclusivePackage.objects.all(), source="all_inclusive_package", required=False, allow_null=True
    )
    beverage_package = serializers.SerializerMethodField()
    beverage_package_id = serializers.PrimaryKeyRelatedField(
        queryset=BeveragePackage.objects.all(), source="beverage_package", required=False, allow_null=True
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
            "all_inclusive_package",
            "all_inclusive_package_id",
            "beverage_package",
            "beverage_package_id",
            "target_species",
            "species_slugs",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "occupied_slots", "available_slots", "duration_days", "created_at", "updated_at")

    def get_available_slots(self, obj):
        return max(obj.capacity - getattr(obj, "occupied_slots", 0), 0)

    def get_all_inclusive_package(self, obj):
        if obj.all_inclusive_package:
            return {
                "id": str(obj.all_inclusive_package.id),
                "name": obj.all_inclusive_package.name,
                "slug": obj.all_inclusive_package.slug,
            }
        return None

    def get_beverage_package(self, obj):
        if obj.beverage_package:
            return {
                "id": str(obj.beverage_package.id),
                "name": obj.beverage_package.name,
                "slug": obj.beverage_package.slug,
            }
        return None

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
        if price and price > 0:
            min_deposit = math.ceil(price * 0.20)
            if deposit < min_deposit:
                raise serializers.ValidationError({
                    "deposit_cents": f"O sinal mínimo deve ser de pelo menos 20% do valor por pessoa (mínimo de R$ {min_deposit / 100:.2f})."
                })
        if deposit > price:
            raise serializers.ValidationError({"deposit_cents": "O sinal não pode superar o valor por pessoa."})

        inclusions = attrs.get("inclusions", getattr(self.instance, "inclusions", None))
        if inclusions is not None:
            if not isinstance(inclusions, list):
                raise serializers.ValidationError({"inclusions": "As inclusões devem ser fornecidas como uma lista de textos."})
            attrs["inclusions"] = [item.strip() for item in inclusions if isinstance(item, str) and item.strip()]

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

    def _sync_beverage_package(self, expedition, beverage_package):
        if not beverage_package:
            return
        for item in beverage_package.items.filter(product__active=True):
            ExpeditionProduct.objects.update_or_create(
                expedition=expedition,
                product=item.product,
                defaults={
                    "standard_quantity_per_participant": item.standard_quantity_per_participant,
                    "display_order": item.display_order,
                    "note": item.note,
                    "active": True,
                },
            )

    @transaction.atomic
    def create(self, validated_data):
        species_slugs = validated_data.pop("species_slugs", None)
        instance = super().create(validated_data)
        if species_slugs is not None and len(species_slugs) > 0:
            self._sync_species(instance, species_slugs)
        elif instance.lodge and instance.lodge.target_species.exists():
            lodge_slugs = list(instance.lodge.target_species.values_list("slug", flat=True))
            self._sync_species(instance, lodge_slugs)
        else:
            default_slugs = list(TargetSpecies.objects.filter(active=True).values_list("slug", flat=True))
            if default_slugs:
                self._sync_species(instance, default_slugs)
        if instance.beverage_package:
            self._sync_beverage_package(instance, instance.beverage_package)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        species_slugs = validated_data.pop("species_slugs", None)
        target_status = validated_data.pop("status", instance.status)
        old_bev_package_id = instance.beverage_package_id
        instance = super().update(instance, validated_data)
        if target_status != instance.status:
            instance = transition_expedition(expedition_id=instance.id, target_status=target_status)
        if species_slugs is not None:
            self._sync_species(instance, species_slugs)
        if instance.beverage_package and instance.beverage_package_id != old_bev_package_id:
            self._sync_beverage_package(instance, instance.beverage_package)
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
    gear_addons = serializers.SerializerMethodField()
    alerts = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = ("id", "status", "participant_count", "unit_price_cents", "total_price_cents", "deposit_cents", "payment_plan", "paid_amount_cents", "remaining_balance_cents", "balance_due_at", "held_until", "beverage_preferences", "created_at", "customer", "expedition", "participants", "gear_addons", "payments", "events", "alerts")

    def get_gear_addons(self, obj):
        return [
            {
                "id": str(addon.id),
                "gear_product_id": str(addon.gear_product_id),
                "gear_product_name": addon.gear_product.name,
                "gear_product_category": addon.gear_product.category,
                "gear_product_category_display": addon.gear_product.get_category_display(),
                "participant_id": str(addon.participant_id) if addon.participant_id else None,
                "participant_name": addon.participant.full_name if addon.participant else None,
                "modality": addon.modality,
                "quantity": addon.quantity,
                "unit_price_cents": addon.unit_price_cents,
                "total_price_cents": addon.total_price_cents,
                "delivered": addon.delivered,
                "notes": addon.notes,
                "created_at": addon.created_at.isoformat() if addon.created_at else None,
            }
            for addon in obj.gear_addons.select_related("gear_product", "participant").all()
        ]

    def get_customer(self, obj):
        return {"id": str(obj.customer_id), "name": obj.customer.full_name, "cpf": obj.customer.cpf, "email": obj.customer.email, "phone": obj.customer.phone}

    def get_expedition(self, obj):
        return {"id": str(obj.expedition_id), "name": obj.expedition.name, "slug": obj.expedition.slug, "starts_at": obj.expedition.starts_at}

    def get_participants(self, obj):
        required = set(obj.expedition.checklist_items.filter(active=True, required=True).values_list("id", flat=True))
        return [
            {
                "id": str(item.id),
                "name": item.full_name,
                "cpf": item.cpf,
                "phone": item.phone,
                "birth_date": item.birth_date,
                "emergency_contact_name": item.emergency_contact_name,
                "emergency_contact_phone": item.emergency_contact_phone,
                "operational_notes": item.operational_notes,
                "onboarding_status": item.onboarding_status,
                "preferences_confirmed": bool(item.product_choices_confirmed_at),
                "dietary_confirmed": bool(item.dietary_confirmed_at),
                "checklist_completed": required.issubset(set(item.checklist_completions.filter(completed=True).values_list("item_id", flat=True))),
                "selected_offers": [{"id": str(c.expedition_product_id), "name": c.expedition_product.product.name} for c in item.product_choices.all() if c.selected],
                "dietary_restrictions": [x.restriction.name for x in item.dietary_restrictions.all()],
                "dietary_details": item.dietary_details,
            }
            for item in obj.participants.all()
        ]

    def get_alerts(self, obj):
        participants = list(obj.participants.all())
        alerts = []
        if any(not p.product_choices_confirmed_at or not p.dietary_confirmed_at for p in participants): alerts.append("Há preferências pendentes.")
        if any(p.dietary_restrictions.exclude(restriction__is_none=True).exists() for p in participants): alerts.append("Há restrições alimentares para revisão.")
        if obj.remaining_balance_cents and obj.balance_due_at and obj.balance_due_at < timezone.localdate(): alerts.append("Saldo vencido.")
        required = set(obj.expedition.checklist_items.filter(active=True, required=True).values_list("id", flat=True))
        if required and any(not required.issubset(set(p.checklist_completions.filter(completed=True).values_list("item_id", flat=True))) for p in participants): alerts.append("Há checklist obrigatório pendente.")
        return alerts


class ManualReservationSerializer(serializers.Serializer):
    expedition_id = serializers.UUIDField()
    customer_name = serializers.CharField(max_length=160)
    customer_cpf = serializers.CharField(max_length=20)
    customer_email = serializers.EmailField()
    customer_phone = serializers.CharField(max_length=30)
    spots_count = serializers.IntegerField(min_value=1, max_value=12)
    status = serializers.ChoiceField(choices=["HELD", "CONFIRMED"], default="CONFIRMED")
    hold_hours = serializers.IntegerField(min_value=1, max_value=72, default=24, required=False)
    payment_type = serializers.ChoiceField(choices=["FULL", "DEPOSIT", "NONE"], default="DEPOSIT", required=False)
    payment_amount_cents = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    participant_names = serializers.ListField(child=serializers.CharField(max_length=160), required=False, default=list)
    reason = serializers.CharField(max_length=500)

    def validate_customer_cpf(self, value):
        digits = "".join(c for c in value if c.isdigit())
        if len(digits) != 11:
            raise serializers.ValidationError("O CPF deve conter exatamente 11 dígitos numéricos.")
        if len(set(digits)) == 1:
            raise serializers.ValidationError("CPF inválido.")
        return digits

    def validate(self, attrs):
        status = attrs.get("status", "CONFIRMED")
        payment_type = attrs.get("payment_type", "DEPOSIT")
        if status == "CONFIRMED" and payment_type == "NONE":
            raise serializers.ValidationError({"payment_type": "Reservas manuais confirmadas exigem registro de pagamento (DEPOSIT ou FULL)."})
        if status == "HELD":
            attrs["payment_type"] = "NONE"
        return attrs


class ParticipantUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=160, required=False)
    cpf = serializers.CharField(max_length=20, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    birth_date = serializers.DateField(required=False, allow_null=True)
    emergency_contact_name = serializers.CharField(max_length=160, required=False, allow_blank=True)
    emergency_contact_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    operational_notes = serializers.CharField(required=False, allow_blank=True)
    onboarding_status = serializers.ChoiceField(choices=["PENDING", "IN_PROGRESS", "COMPLETED"], required=False)
    is_substitution = serializers.BooleanField(default=False)
    substitution_reason = serializers.CharField(max_length=500, required=False, allow_blank=True)


class FishingGearProductSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    modality_display = serializers.CharField(source="get_modality_display", read_only=True)
    addons_count = serializers.IntegerField(source="addons.count", read_only=True)

    class Meta:
        model = FishingGearProduct
        fields = (
            "id",
            "name",
            "slug",
            "category",
            "category_display",
            "modality",
            "modality_display",
            "technical_specs",
            "rental_price_cents",
            "sale_price_cents",
            "inventory_quantity",
            "image_url",
            "description",
            "active",
            "addons_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "addons_count", "created_at", "updated_at")

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = slugify(validated_data.get("name", ""))
        else:
            validated_data["slug"] = slugify(validated_data["slug"])
        return super().create(validated_data)


class ReservationGearAddonSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source="participant.full_name", read_only=True, default=None)
    gear_product_name = serializers.CharField(source="gear_product.name", read_only=True)
    gear_product_category = serializers.CharField(source="gear_product.category", read_only=True)
    gear_product_category_display = serializers.CharField(source="gear_product.get_category_display", read_only=True)

    class Meta:
        model = ReservationGearAddon
        fields = (
            "id",
            "reservation",
            "participant",
            "participant_name",
            "gear_product",
            "gear_product_name",
            "gear_product_category",
            "gear_product_category_display",
            "modality",
            "quantity",
            "unit_price_cents",
            "total_price_cents",
            "notes",
            "delivered",
            "created_at",
        )
        read_only_fields = ("id", "unit_price_cents", "total_price_cents", "created_at")


class CustomerProfileSerializer(serializers.ModelSerializer):
    has_valid_license = serializers.BooleanField(read_only=True)

    class Meta:
        model = CustomerProfile
        fields = (
            "id",
            "rg",
            "rg_issuer",
            "birth_date",
            "city",
            "state",
            "fishing_license_number",
            "fishing_license_expiry",
            "has_valid_license",
            "default_vest_size",
            "dietary_notes",
            "medical_notes",
            "emergency_contact_name",
            "emergency_contact_phone",
            "internal_admin_notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "has_valid_license", "created_at", "updated_at")


class AdminCustomerListSerializer(serializers.ModelSerializer):
    city = serializers.CharField(source="profile.city", read_only=True, default="")
    state = serializers.CharField(source="profile.state", read_only=True, default="")
    has_valid_license = serializers.BooleanField(source="profile.has_valid_license", read_only=True, default=False)
    total_reservations = serializers.IntegerField(read_only=True, default=0)
    lifetime_value_cents = serializers.IntegerField(read_only=True, default=0)
    last_expedition_name = serializers.CharField(read_only=True, default="")
    last_expedition_date = serializers.CharField(read_only=True, default="")

    class Meta:
        model = Customer
        fields = (
            "id",
            "cpf",
            "full_name",
            "email",
            "phone",
            "city",
            "state",
            "has_valid_license",
            "total_reservations",
            "lifetime_value_cents",
            "last_expedition_name",
            "last_expedition_date",
            "created_at",
        )


class AdminCustomerDetailSerializer(serializers.ModelSerializer):
    profile = CustomerProfileSerializer(read_only=True)
    lifetime_value_cents = serializers.SerializerMethodField()
    total_reservations = serializers.SerializerMethodField()
    reservations = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = (
            "id",
            "cpf",
            "full_name",
            "email",
            "phone",
            "profile",
            "lifetime_value_cents",
            "total_reservations",
            "reservations",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "cpf", "created_at", "updated_at")

    def get_lifetime_value_cents(self, obj):
        valid_res_ids = obj.reservations.exclude(status__in=["CANCELLED", "REFUNDED"]).values_list("id", flat=True)
        return Payment.objects.filter(reservation_id__in=valid_res_ids, status="PAID").aggregate(total=models.Sum("amount_cents"))["total"] or 0

    def get_total_reservations(self, obj):
        return obj.reservations.exclude(status__in=["CANCELLED", "REFUNDED"]).count()

    def get_reservations(self, obj):
        return [
            {
                "id": str(r.id),
                "expedition_name": r.expedition.name,
                "starts_at": r.expedition.starts_at,
                "status": r.status,
                "participant_count": r.participant_count,
                "total_price_cents": r.total_price_cents,
                "paid_amount_cents": r.paid_amount_cents,
                "remaining_balance_cents": r.remaining_balance_cents,
                "gear_addons_count": r.gear_addons.count(),
                "created_at": r.created_at.isoformat(),
            }
            for r in obj.reservations.select_related("expedition").prefetch_related("gear_addons", "payments").order_by("-created_at")
        ]
