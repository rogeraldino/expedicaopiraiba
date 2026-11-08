from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("expeditions", "0017_product_description_product_image_url")]

    operations = [
        migrations.AlterField(
            model_name="fishinggearproduct",
            name="category",
            field=models.CharField(
                choices=[
                    ("HEAVY_ROD_REEL", "Varas e carretilhas pesadas"),
                    ("MEDIUM_ROD_REEL", "Varas e carretilhas leves e médias"),
                    ("TERMINAL_TACKLE", "Acessórios de pesca"),
                    ("APPAREL", "Roupas e proteção"),
                    ("SPECIALTY_BAIT", "Iscas e atrativos"),
                ],
                max_length=30,
            ),
        ),
    ]
