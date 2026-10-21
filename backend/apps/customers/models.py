import uuid

from django.db import models


class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cpf = models.CharField(max_length=11, unique=True)
    full_name = models.CharField(max_length=160)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("full_name",)

    def __str__(self):
        return self.full_name


class VerificationChallenge(models.Model):
    class Channel(models.TextChoices):
        WHATSAPP = "WHATSAPP", "WhatsApp"
        EMAIL = "EMAIL", "E-mail"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="verification_challenges")
    channel = models.CharField(max_length=10, choices=Channel.choices)
    code_digest = models.CharField(max_length=128)
    attempts = models.PositiveSmallIntegerField(default=0)
    pending_email = models.EmailField(blank=True)
    pending_phone = models.CharField(max_length=20, blank=True)
    pending_full_name = models.CharField(max_length=160, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=("customer", "channel", "created_at"))]


class CustomerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name="profile")
    rg = models.CharField(max_length=20, blank=True)
    rg_issuer = models.CharField(max_length=20, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    street_name = models.CharField(max_length=150, blank=True)
    street_number = models.CharField(max_length=20, blank=True)
    complement = models.CharField(max_length=100, blank=True)
    neighborhood = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    zip_code = models.CharField(max_length=10, blank=True)
    fishing_license_number = models.CharField(max_length=50, blank=True)
    fishing_license_expiry = models.DateField(null=True, blank=True)
    default_vest_size = models.CharField(max_length=10, blank=True)
    dietary_notes = models.TextField(blank=True)
    medical_notes = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=160, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    internal_admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("customer__full_name",)

    def __str__(self):
        return f"Perfil de {self.customer.full_name}"

    @property
    def has_valid_license(self):
        if not self.fishing_license_number:
            return False
        if not self.fishing_license_expiry:
            return True
        from django.utils import timezone
        return self.fishing_license_expiry >= timezone.localdate()


class WhatsAppContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=30, unique=True, db_index=True)
    wa_id = models.CharField(max_length=64, blank=True, db_index=True)
    profile_name = models.CharField(max_length=160, blank=True)
    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="whatsapp_contacts",
    )
    total_messages_count = models.PositiveIntegerField(default=0)
    ai_summary = models.TextField(blank=True, help_text="Resumo passivo de interesses e perfil do lead via IA")
    ai_tags = models.JSONField(default=list, blank=True, help_text="Tags semânticas identificadas por IA")
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-last_message_at",)

    def __str__(self):
        return f"{self.profile_name or self.phone} ({self.phone})"


class WhatsAppMessage(models.Model):
    class Direction(models.TextChoices):
        INBOUND = "INBOUND", "Recebida (Cliente -> Expedição)"
        OUTBOUND = "OUTBOUND", "Enviada (Expedição -> Cliente)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(
        WhatsAppContact,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    wamid = models.CharField(max_length=128, unique=True, db_index=True)
    direction = models.CharField(max_length=10, choices=Direction.choices, default=Direction.INBOUND)
    message_type = models.CharField(max_length=30, default="text")
    body = models.TextField(blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    ai_intent = models.CharField(max_length=64, blank=True, db_index=True)
    ai_sentiment = models.CharField(max_length=32, blank=True)
    ai_metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("contact", "direction", "created_at")),
            models.Index(fields=("wamid",)),
        ]

    def __str__(self):
        return f"[{self.direction}] {self.contact.phone}: {self.body[:40]}"
