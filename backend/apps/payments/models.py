import uuid

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
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    pix_copy_paste = models.TextField(blank=True)
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
