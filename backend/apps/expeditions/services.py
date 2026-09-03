from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Expedition


ALLOWED_TRANSITIONS = {
    Expedition.Status.DRAFT: {Expedition.Status.PUBLISHED, Expedition.Status.CANCELLED},
    Expedition.Status.PUBLISHED: {Expedition.Status.SOLD_OUT, Expedition.Status.CLOSED, Expedition.Status.CANCELLED},
    Expedition.Status.SOLD_OUT: {Expedition.Status.IN_PROGRESS, Expedition.Status.CANCELLED},
    Expedition.Status.CLOSED: {Expedition.Status.IN_PROGRESS, Expedition.Status.CANCELLED},
    Expedition.Status.IN_PROGRESS: {Expedition.Status.COMPLETED},
    Expedition.Status.COMPLETED: set(),
    Expedition.Status.CANCELLED: set(),
}


@transaction.atomic
def transition_expedition(*, expedition_id, target_status):
    expedition = Expedition.objects.select_for_update().get(id=expedition_id)
    if target_status == expedition.status:
        return expedition
    if target_status not in ALLOWED_TRANSITIONS.get(expedition.status, set()):
        raise ValidationError(f"Transição de {expedition.status} para {target_status} não permitida.")
    expedition.status = target_status
    expedition.save(update_fields=("status", "updated_at"))
    return expedition
