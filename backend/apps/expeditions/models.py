import uuid

from django.db import models
from django.utils.text import slugify


class Expedition(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Rascunho"
        PUBLISHED = "PUBLISHED", "Publicada"
        SOLD_OUT = "SOLD_OUT", "Esgotada"
        CLOSED = "CLOSED", "Encerrada"
        IN_PROGRESS = "IN_PROGRESS", "Em andamento"
        COMPLETED = "COMPLETED", "Concluída"
        CANCELLED = "CANCELLED", "Cancelada"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    destination = models.CharField(max_length=160)
    departure_location = models.CharField(max_length=160, blank=True)
    starts_at = models.DateField()
    ends_at = models.DateField()
    capacity = models.PositiveSmallIntegerField()
    price_per_person_cents = models.PositiveIntegerField()
    deposit_cents = models.PositiveIntegerField()
    balance_due_days_before = models.PositiveSmallIntegerField(default=30)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("starts_at",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def duration_days(self):
        return (self.ends_at - self.starts_at).days + 1

    def __str__(self):
        return self.name
