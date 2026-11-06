import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0007_feequote_purpose"),
        ("reservations", "0012_reservation_accepted_offer_snapshot_and_more"),
    ]

    operations = [
        migrations.AddField(model_name="payment", name="provider_fee_cents", field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="payment", name="provider_net_received_cents", field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.CreateModel(
            name="PaymentIntent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("method", models.CharField(choices=[("PIX", "PIX"), ("CREDIT_CARD", "Cartão de Crédito"), ("BOLETO", "Boleto Bancário")], max_length=20)),
                ("installments", models.PositiveSmallIntegerField(default=1)),
                ("amount_cents", models.PositiveIntegerField()),
                ("base_amount_cents", models.PositiveIntegerField()),
                ("fee_amount_cents", models.PositiveIntegerField(default=0)),
                ("fee_snapshot", models.JSONField(default=dict)),
                ("request_data", models.JSONField(blank=True, default=dict)),
                ("idempotency_key", models.CharField(max_length=128, unique=True)),
                ("status", models.CharField(default="SUBMITTING", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("payment", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to="payments.payment")),
                ("quote", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to="payments.feequote")),
                ("reservation", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payment_intents", to="reservations.reservation")),
            ],
        ),
    ]
