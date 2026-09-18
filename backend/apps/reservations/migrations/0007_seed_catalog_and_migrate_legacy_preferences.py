from django.db import migrations
from django.utils import timezone


PRODUCTS = (
    ("Cerveja Heineken", "lata", ["heineken", "cerveja_heineken"]),
    ("Cerveja sem álcool", "lata", ["cerveja_sem_alcool", "heineken_zero"]),
    ("Água sem gás", "garrafa", ["agua_sem_gas", "agua"]),
    ("Água com gás", "garrafa", ["agua_com_gas"]),
    ("Refrigerante", "lata", ["refrigerante", "refri"]),
    ("Suco", "unidade", ["suco"]),
)


def forwards(apps, schema_editor):
    Product = apps.get_model("expeditions", "Product")
    Expedition = apps.get_model("expeditions", "Expedition")
    Offer = apps.get_model("expeditions", "ExpeditionProduct")
    Restriction = apps.get_model("reservations", "DietaryRestriction")
    Choice = apps.get_model("reservations", "ParticipantProductChoice")
    ParticipantRestriction = apps.get_model("reservations", "ParticipantDietaryRestriction")
    Reservation = apps.get_model("reservations", "Reservation")
    aliases = {}
    products = []
    for index, (name, unit, keys) in enumerate(PRODUCTS):
        product, _ = Product.objects.get_or_create(name=name, defaults={"unit": unit, "aliases": keys})
        products.append(product)
        for key in keys:
            aliases[key] = product
    no_restriction, _ = Restriction.objects.get_or_create(code="none", defaults={"name": "Sem restrições", "is_none": True})
    other, _ = Restriction.objects.get_or_create(code="other", defaults={"name": "Outros", "requires_details": True})
    for code, name in (("gluten", "Glúten"), ("lactose", "Lactose"), ("vegetarian", "Vegetariano"), ("vegan", "Vegano"), ("allergy", "Alergia alimentar")):
        Restriction.objects.get_or_create(code=code, defaults={"name": name})
    for expedition in Expedition.objects.all():
        for index, product in enumerate(products):
            Offer.objects.get_or_create(expedition=expedition, product=product, defaults={"standard_quantity_per_participant": 1, "display_order": index})
    for reservation in Reservation.objects.exclude(beverage_preferences={}):
        participants = list(reservation.participants.all())
        if len(participants) != 1:
            continue
        participant = participants[0]
        legacy = reservation.beverage_preferences or {}
        beverages = legacy.get("beverages", {})
        migrated = False
        for key, value in beverages.items():
            if key in aliases and isinstance(value, (int, float)) and value > 0:
                offer = Offer.objects.filter(expedition=reservation.expedition, product=aliases[key]).first()
                if offer:
                    Choice.objects.get_or_create(participant=participant, expedition_product=offer, defaults={"selected": True})
                    migrated = True
        restriction_text = str(legacy.get("dietary_restrictions", "")).strip()
        if restriction_text:
            ParticipantRestriction.objects.get_or_create(participant=participant, restriction=other)
            participant.dietary_details = restriction_text
            participant.dietary_confirmed_at = timezone.now()
        if migrated or legacy.get("completed"):
            participant.product_choices_confirmed_at = timezone.now()
        participant.save(update_fields=("dietary_details", "dietary_confirmed_at", "product_choices_confirmed_at"))


class Migration(migrations.Migration):
    dependencies = [("reservations", "0006_dietaryrestriction_and_more"), ("expeditions", "0003_product_expedition_meeting_instructions_and_more")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
