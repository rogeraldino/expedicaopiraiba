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

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name="participants")
    full_name = models.CharField(max_length=160)
    cpf = models.CharField(max_length=11, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    emergency_contact_name = models.CharField(max_length=160, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    operational_notes = models.TextField(blank=True)
    onboarding_status = models.CharField(max_length=20, choices=OnboardingStatus.choices, default=OnboardingStatus.PENDING)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


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
