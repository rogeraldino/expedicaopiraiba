# Generated manually for pix_qr_code_base64

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0003_payment_boleto_barcode_payment_boleto_url_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='pix_qr_code_base64',
            field=models.TextField(blank=True),
        ),
    ]
