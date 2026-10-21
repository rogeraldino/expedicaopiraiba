import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [migrations.CreateModel(
        name="MediaAsset",
        fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("original_name", models.CharField(max_length=255)),
            ("width", models.PositiveIntegerField()),
            ("height", models.PositiveIntegerField()),
            ("byte_size", models.PositiveIntegerField()),
            ("created_by", models.EmailField(max_length=254)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
        ],
        options={"ordering": ("-created_at", "-id")},
    )]
