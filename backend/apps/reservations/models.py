import uuid

from django.db import models
from django.db.models import Sum


class Reservation(models.Model):
    class PaymentPlan(models.TextChoices):
        DEPOSIT = "DEPOSIT", "Sinal"
        FULL = "FULL", "Integral"

    class Status(models.TextChoices):
        HELD = "HELD", "Vagas protegidas"
        AWAITING_PAYMENT = "AWAITING_PAYMENT", "Aguardando pagamento"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Parcialmente paga"
        CONFIRMED = "CONFIRMED", "Confirmada"
        PAID = "PAID", "Paga"
        EXPIRED = "EXPIRED", "Expirada"
        CANCELLED = "CANCELLED", "Cancelada"
        REFUNDED = "REFUNDED", "Reembolsada"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="reservations")
    expedition = models.ForeignKey("expeditions.Expedition", on_delete=models.PROTECT, related_name="reservations")
    participant_count = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.HELD)
    held_until = models.DateTimeField(null=True, blank=True)
    unit_price_cents = models.PositiveIntegerField()
    total_price_cents = models.PositiveIntegerField()
    deposit_cents = models.PositiveIntegerField()
    payment_plan = models.CharField(max_length=12, choices=PaymentPlan.choices, default=PaymentPlan.DEPOSIT)
    balance_due_at = models.DateField(null=True, blank=True)
    beverage_preferences = models.JSONField(default=dict, blank=True)
    legacy_preferences_review_required = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=("expedition", "status", "held_until"))]

    def __str__(self):
        return f"{self.expedition} — {self.customer}"

    @property
    def paid_amount_cents(self):
        prefetched = getattr(self, "_prefetched_objects_cache", {}).get("payments")
        if prefetched is not None:
            return sum(payment.amount_cents for payment in prefetched if payment.status == "PAID")
        return self.payments.filter(status="PAID").aggregate(total=Sum("amount_cents"))["total"] or 0

    @property
    def remaining_balance_cents(self):
        return max(self.total_price_cents - self.paid_amount_cents, 0)


class ReservationParticipant(models.Model):
    class OnboardingStatus(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        IN_PROGRESS = "IN_PROGRESS", "Em preenchimento"
        COMPLETED = "COMPLETED", "Completo"

    class VestSize(models.TextChoices):
        P = "P", "P"
        M = "M", "M"
        G = "G", "G"
        GG = "GG", "GG"
        XG = "XG", "XG"
        EXG = "EXG", "EXG"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name="participants")
    full_name = models.CharField(max_length=160)
    cpf = models.CharField(max_length=11, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    emergency_contact_name = models.CharField(max_length=160, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    vest_size = models.CharField(max_length=10, choices=VestSize.choices, default=VestSize.G, blank=True)
    health_notes = models.TextField(blank=True)
    operational_notes = models.TextField(blank=True)
    onboarding_status = models.CharField(max_length=20, choices=OnboardingStatus.choices, default=OnboardingStatus.PENDING)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    product_choices_confirmed_at = models.DateTimeField(null=True, blank=True)
    dietary_confirmed_at = models.DateTimeField(null=True, blank=True)
    dietary_details = models.TextField(blank=True)

    def __str__(self):
        return self.full_name


class DietaryRestriction(models.Model):
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    requires_details = models.BooleanField(default=False)
    is_none = models.BooleanField(default=False)
    active = models.BooleanField(default=True)


class ParticipantProductChoice(models.Model):
    participant = models.ForeignKey(ReservationParticipant, on_delete=models.CASCADE, related_name="product_choices")
    expedition_product = models.ForeignKey("expeditions.ExpeditionProduct", on_delete=models.PROTECT, related_name="participant_choices")
    selected = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("participant", "expedition_product"), name="unique_participant_product_choice")]


class ParticipantDietaryRestriction(models.Model):
    participant = models.ForeignKey(ReservationParticipant, on_delete=models.CASCADE, related_name="dietary_restrictions")
    restriction = models.ForeignKey(DietaryRestriction, on_delete=models.PROTECT, related_name="participant_links")

    class Meta:
        constraints = [models.UniqueConstraint(fields=("participant", "restriction"), name="unique_participant_dietary_restriction")]


class ParticipantChecklistCompletion(models.Model):
    participant = models.ForeignKey(ReservationParticipant, on_delete=models.CASCADE, related_name="checklist_completions")
    item = models.ForeignKey("expeditions.ChecklistItem", on_delete=models.PROTECT, related_name="participant_completions")
    completed = models.BooleanField(default=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("participant", "item"), name="unique_participant_checklist_completion")]


class ReservationEvent(models.Model):
    class ActorType(models.TextChoices):
        SYSTEM = "SYSTEM", "Sistema"
        CUSTOMER = "CUSTOMER", "Cliente"
        ADMIN = "ADMIN", "Administrador"
        PROVIDER = "PROVIDER", "Provedor"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=60)
    actor_type = models.CharField(max_length=20, choices=ActorType.choices, default=ActorType.SYSTEM)
    actor_identifier = models.CharField(max_length=160, blank=True)
    previous_status = models.CharField(max_length=24, blank=True)
    new_status = models.CharField(max_length=24, blank=True)
    reason = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [models.Index(fields=("reservation", "created_at"))]
