from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("customers", "0005_whatsappcontact_whatsappmessage")]

    operations = [
        migrations.AddField(
            model_name="verificationchallenge",
            name="is_existing_customer",
            field=models.BooleanField(default=False),
        ),
    ]
