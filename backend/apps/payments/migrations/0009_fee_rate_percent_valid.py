from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("payments", "0008_payment_provider_financials_and_intent")]

    operations = [
        migrations.AddConstraint(
            model_name="feerate",
            constraint=models.CheckConstraint(
                condition=models.Q(percent__gte=0, percent__lt=100),
                name="fee_rate_percent_valid",
            ),
        ),
    ]
