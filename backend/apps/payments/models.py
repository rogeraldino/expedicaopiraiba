import uuid
from decimal import Decimal

from django.db import models


class Payment(models.Model):
    class Purpose(models.TextChoices):
        INITIAL = "INITIAL", "Pagamento inicial"
        BALANCE = "BALANCE", "Saldo"
        MANUAL = "MANUAL", "Manual"
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        PROCESSING = "PROCESSING", "Processando"
        PAID = "PAID", "Pago"
        FAILED = "FAILED", "Falhou"
        CANCELLED = "CANCELLED", "Cancelado"
        REFUNDED = "REFUNDED", "Reembolsado"
    class Method(models.TextChoices):
        PIX = "PIX", "PIX"
        CREDIT_CARD = "CREDIT_CARD", "Cartão de Crédito"
        BOLETO = "BOLETO", "Boleto Bancário"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.ForeignKey("reservations.Reservation", on_delete=models.PROTECT, related_name="payments")
    provider = models.CharField(max_length=30, default="FAKE")
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.PIX)
    purpose = models.CharField(max_length=20, choices=Purpose.choices, default=Purpose.INITIAL)
    external_id = models.CharField(max_length=100, unique=True)
    amount_cents = models.PositiveIntegerField()
    base_amount_cents = models.PositiveIntegerField(default=0)
    fee_amount_cents = models.PositiveIntegerField(default=0)
    fee_snapshot = models.JSONField(default=dict, blank=True)
    provider_fee_cents = models.PositiveIntegerField(null=True, blank=True)
    provider_net_received_cents = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    pix_copy_paste = models.TextField(blank=True)
    pix_qr_code_base64 = models.TextField(blank=True)
    boleto_url = models.URLField(max_length=500, blank=True)
    boleto_barcode = models.CharField(max_length=100, blank=True)
    card_brand = models.CharField(max_length=30, blank=True)
    card_last_four = models.CharField(max_length=4, blank=True)
    installments = models.PositiveSmallIntegerField(default=1)
    idempotency_key = models.CharField(max_length=128, blank=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class PaymentTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="transactions")
    external_event_id = models.CharField(max_length=120, unique=True)
    event_type = models.CharField(max_length=50)
    previous_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class PaymentIntent(models.Model):
    """Durable local record before any external charge is attempted."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.ForeignKey("reservations.Reservation", on_delete=models.PROTECT, related_name="payment_intents")
    quote = models.OneToOneField("payments.FeeQuote", on_delete=models.PROTECT, null=True, blank=True)
    payment = models.OneToOneField(Payment, on_delete=models.PROTECT, null=True, blank=True)
    method = models.CharField(max_length=20, choices=Payment.Method.choices)
    installments = models.PositiveSmallIntegerField(default=1)
    amount_cents = models.PositiveIntegerField()
    base_amount_cents = models.PositiveIntegerField()
    fee_amount_cents = models.PositiveIntegerField(default=0)
    fee_snapshot = models.JSONField(default=dict)
    request_data = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=20, default="SUBMITTING")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class FeeRate(models.Model):
    """Current merchant fee estimate for one method/installment combination."""
    method = models.CharField(max_length=20, choices=Payment.Method.choices)
    installments = models.PositiveSmallIntegerField(default=1)
    percent = models.DecimalField(max_digits=7, decimal_places=4, default=Decimal("0"))
    fixed_cents = models.PositiveIntegerField(default=0)
    source = models.URLField(max_length=500, blank=True)
    source_checked_at = models.DateTimeField(null=True, blank=True)
    estimated = models.BooleanField(default=True)
    active = models.BooleanField(default=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)
    revoked_versions = models.JSONField(default=list, blank=True)
    updated_by = models.CharField(max_length=160, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("method", "installments"), name="unique_current_payment_fee_rate"),
            models.CheckConstraint(condition=models.Q(percent__gte=0, percent__lt=100), name="fee_rate_percent_valid"),
        ]


class FeeRateAudit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rate = models.ForeignKey(FeeRate, on_delete=models.PROTECT, related_name="audit_records")
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    actor = models.CharField(max_length=160)
    created_at = models.DateTimeField(auto_now_add=True)


class FeeQuote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT)
    reservation = models.ForeignKey("reservations.Reservation", on_delete=models.PROTECT, null=True, blank=True)
    expedition = models.ForeignKey("expeditions.Expedition", on_delete=models.PROTECT)
    participant_names = models.JSONField(default=list)
    payment_plan = models.CharField(max_length=12)
    purpose = models.CharField(max_length=20, default=Payment.Purpose.INITIAL)
    method = models.CharField(max_length=20, choices=Payment.Method.choices)
    installments = models.PositiveSmallIntegerField(default=1)
    card_bin = models.CharField(max_length=8, blank=True)
    base_cents = models.PositiveIntegerField()
    fee_cents = models.PositiveIntegerField()
    total_cents = models.PositiveIntegerField()
    rate_snapshot = models.JSONField(default=dict)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RefundRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Solicitado"
        SUBMITTED = "SUBMITTED", "Enviado ao provedor"
        UNKNOWN = "UNKNOWN", "Aguardando reconciliação"
        CONFIRMED = "CONFIRMED", "Confirmado"
        FAILED = "FAILED", "Falhou"
        MANUAL_PENDING = "MANUAL_PENDING", "Transferência pendente"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refund_requests")
    amount_cents = models.PositiveIntegerField()
    service_refund_cents = models.PositiveIntegerField()
    fee_refund_cents = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    basis = models.CharField(max_length=30)
    reason = models.TextField()
    calculation = models.TextField(blank=True)
    idempotency_key = models.CharField(max_length=128, unique=True)
    provider_refund_id = models.CharField(max_length=100, blank=True)
    provider_response = models.JSONField(default=dict, blank=True)
    proof_reference = models.CharField(max_length=500, blank=True)
    requested_by = models.CharField(max_length=160)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)


class RefundEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    refund = models.ForeignKey(RefundRequest, on_delete=models.PROTECT, related_name="events")
    previous_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20)
    actor = models.CharField(max_length=160)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
