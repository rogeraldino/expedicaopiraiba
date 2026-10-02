import uuid

from django.db import models
from django.utils.text import slugify


class WaterBasin(models.TextChoices):
    TOCANTINS_ARAGUAIA = "TOCANTINS_ARAGUAIA", "Bacia Tocantins-Araguaia"
    AMAZONICA = "AMAZONICA", "Bacia Amazônica"
    PRATA = "PRATA", "Bacia do Prata / Pantanal"
    SAO_FRANCISCO = "SAO_FRANCISCO", "Bacia do São Francisco"


class River(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    basin = models.CharField(max_length=40, choices=WaterBasin.choices, default=WaterBasin.TOCANTINS_ARAGUAIA)
    states = models.JSONField(default=list, blank=True)
    description = models.TextField(blank=True)
    regulations = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class AmenityCategory(models.TextChoices):
    FISHING_STRUCTURE = "FISHING_STRUCTURE", "Estrutura Náutica e Pesca"
    ROOM_COMFORT = "ROOM_COMFORT", "Acomodação e Conforto"
    LEISURE = "LEISURE", "Lazer e Bem-estar"
    GASTRONOMY = "GASTRONOMY", "Culinária e Bar"
    CONNECTIVITY = "CONNECTIVITY", "Conectividade e Apoio"


class Amenity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=30, choices=AmenityCategory.choices)
    icon_key = models.CharField(max_length=50, blank=True)
    description = models.CharField(max_length=200, blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("category", "display_order", "name")

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class LodgeAmenityLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lodge = models.ForeignKey("Lodge", on_delete=models.CASCADE, related_name="amenity_links")
    amenity = models.ForeignKey(Amenity, on_delete=models.CASCADE, related_name="lodge_links")
    is_highlight = models.BooleanField(default=False)
    custom_note = models.CharField(max_length=140, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("lodge", "amenity"), name="unique_lodge_amenity")
        ]

    def __str__(self):
        return f"{self.lodge.name} — {self.amenity.name}"


class Lodge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    river = models.ForeignKey(River, on_delete=models.PROTECT, related_name="lodges", null=True, blank=True)
    name = models.CharField(max_length=160, unique=True)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    river_section = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    amenities = models.JSONField(default=list, blank=True)
    amenities_structured = models.ManyToManyField(Amenity, through=LodgeAmenityLink, related_name="lodges", blank=True)
    boat_fleet_details = models.TextField(blank=True)
    meeting_point = models.CharField(max_length=200, blank=True)
    directions = models.TextField(blank=True)
    cover_image_url = models.CharField(max_length=500, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.city}/{self.state})"


class TargetSpecies(models.Model):
    class Category(models.TextChoices):
        COURO = "COURO", "Peixe de Couro"
        ESCAMA = "ESCAMA", "Peixe de Escama"

    slug = models.SlugField(max_length=60, primary_key=True)
    common_name = models.CharField(max_length=100)
    scientific_name = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.COURO)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("category", "common_name")

    def __str__(self):
        return self.common_name


class RiverSpecies(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    river = models.ForeignKey(River, on_delete=models.CASCADE, related_name="river_species")
    species = models.ForeignKey(TargetSpecies, on_delete=models.PROTECT, related_name="rivers")
    is_native = models.BooleanField(default=True)
    is_trophy = models.BooleanField(default=False)
    best_season = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("river", "species"), name="unique_river_species")
        ]
        ordering = ("species__category", "species__common_name")

    def __str__(self):
        return f"{self.species.common_name} ({self.river.name})"


class Expedition(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Rascunho"
        PUBLISHED = "PUBLISHED", "Publicada"
        SOLD_OUT = "SOLD_OUT", "Esgotada"
        CLOSED = "CLOSED", "Encerrada"
        IN_PROGRESS = "IN_PROGRESS", "Em andamento"
        COMPLETED = "COMPLETED", "Concluída"
        CANCELLED = "CANCELLED", "Cancelada"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    lodge = models.ForeignKey(Lodge, on_delete=models.PROTECT, related_name="expeditions", null=True, blank=True)
    all_inclusive_package = models.ForeignKey("AllInclusivePackage", on_delete=models.SET_NULL, null=True, blank=True, related_name="expeditions")
    beverage_package = models.ForeignKey("BeveragePackage", on_delete=models.SET_NULL, null=True, blank=True, related_name="expeditions")
    target_species = models.ManyToManyField(TargetSpecies, through="ExpeditionSpecies", related_name="expedition_targets", blank=True)
    destination = models.CharField(max_length=160)
    departure_location = models.CharField(max_length=160, blank=True)
    meeting_instructions = models.TextField(blank=True)
    starts_at = models.DateField()
    ends_at = models.DateField()
    capacity = models.PositiveSmallIntegerField()
    price_per_person_cents = models.PositiveIntegerField()
    deposit_cents = models.PositiveIntegerField()
    balance_due_days_before = models.PositiveSmallIntegerField(default=30)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    summary = models.TextField(blank=True)
    cover_image_url = models.CharField(max_length=500, blank=True)
    gallery_image_urls = models.JSONField(default=list, blank=True)
    inclusions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("starts_at",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        if self.lodge and not self.departure_location:
            self.departure_location = f"{self.lodge.city}/{self.lodge.state}"
        if self.lodge and not self.meeting_instructions and self.lodge.directions:
            self.meeting_instructions = self.lodge.directions
        super().save(*args, **kwargs)

    @property
    def duration_days(self):
        return (self.ends_at - self.starts_at).days + 1

    def __str__(self):
        return self.name


class ExpeditionSpecies(models.Model):
    expedition = models.ForeignKey(Expedition, on_delete=models.CASCADE, related_name="expedition_species")
    species = models.ForeignKey(TargetSpecies, on_delete=models.PROTECT, related_name="expeditions")
    is_primary = models.BooleanField(default=False)
    display_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("expedition", "species"), name="unique_expedition_species")]
        ordering = ("-is_primary", "display_order", "species__common_name")

    def __str__(self):
        return f"{self.expedition.name} - {self.species.common_name}"


class Product(models.Model):
    class Unit(models.TextChoices):
        UNIT = "unidade", "Unidade"
        CAN = "lata", "Lata"
        BOTTLE = "garrafa", "Garrafa"
        PACKAGE = "pacote", "Pacote"
        BAG = "saco", "Saco"

    name = models.CharField(max_length=120, unique=True)
    category = models.CharField(max_length=60, default="BEBIDA")
    unit = models.CharField(max_length=20, choices=Unit.choices)
    package_size = models.PositiveIntegerField(null=True, blank=True)
    aliases = models.JSONField(default=list, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ExpeditionProduct(models.Model):
    expedition = models.ForeignKey(Expedition, on_delete=models.PROTECT, related_name="product_offers")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="expedition_offers")
    standard_quantity_per_participant = models.PositiveIntegerField(default=1)
    display_order = models.PositiveSmallIntegerField(default=0)
    note = models.CharField(max_length=240, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("expedition", "product"), name="unique_expedition_product")]
        ordering = ("display_order", "product__name")


class AllInclusivePackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140, unique=True)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    description = models.TextField(blank=True)
    inclusions = models.JSONField(default=list, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class BeveragePackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140, unique=True)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class BeveragePackageItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    package = models.ForeignKey(BeveragePackage, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="package_items")
    standard_quantity_per_participant = models.PositiveSmallIntegerField(default=1)
    display_order = models.PositiveSmallIntegerField(default=0)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("package", "product"), name="unique_beverage_package_product")
        ]
        ordering = ("display_order", "product__name")

    def __str__(self):
        return f"{self.package.name} - {self.product.name} ({self.standard_quantity_per_participant}/pessoa)"


class ChecklistItem(models.Model):
    expedition = models.ForeignKey(Expedition, on_delete=models.PROTECT, related_name="checklist_items")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    required = models.BooleanField(default=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("display_order", "created_at")


class ExpeditionConfigurationEvent(models.Model):
    expedition = models.ForeignKey(Expedition, on_delete=models.PROTECT, related_name="configuration_events")
    event_type = models.CharField(max_length=60)
    actor_identifier = models.CharField(max_length=160, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)


class GearCategory(models.TextChoices):
    HEAVY_ROD_REEL = "HEAVY_ROD_REEL", "Conjunto Pesado (Piraíba / Grandes Bagres)"
    MEDIUM_ROD_REEL = "MEDIUM_ROD_REEL", "Conjunto Médio (Pirarara / Tucunaré)"
    TERMINAL_TACKLE = "TERMINAL_TACKLE", "Acessórios e Terminais (Anzóis, Encastoados, Chumbadas)"
    APPAREL = "APPAREL", "Vestuário UV, Bonés e Proteção"
    SPECIALTY_BAIT = "SPECIALTY_BAIT", "Iscas Especiais e Atrativos"


class FishingGearProduct(models.Model):
    class Modality(models.TextChoices):
        RENTAL = "RENTAL", "Locação por Expedição"
        SALE = "SALE", "Venda Direta"
        BOTH = "BOTH", "Venda ou Locação"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160, unique=True)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    category = models.CharField(max_length=30, choices=GearCategory.choices)
    modality = models.CharField(max_length=10, choices=Modality.choices, default=Modality.RENTAL)
    technical_specs = models.JSONField(default=dict, blank=True)
    rental_price_cents = models.PositiveIntegerField(default=0)
    sale_price_cents = models.PositiveIntegerField(default=0)
    inventory_quantity = models.PositiveSmallIntegerField(default=0)
    image_url = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("category", "name")
        constraints = [
            models.CheckConstraint(
                condition=models.Q(inventory_quantity__gte=0),
                name="gear_inventory_non_negative",
            )
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.get_modality_display()})"
