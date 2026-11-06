from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("expeditions", "0016_update_target_species_catalog")]

    operations = [
        migrations.AddField(model_name="product", name="description", field=models.TextField(blank=True)),
        migrations.AddField(model_name="product", name="image_url", field=models.CharField(blank=True, max_length=500)),
    ]
