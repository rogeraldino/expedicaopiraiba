from django.db import migrations


CANONICAL_BEVERAGES = [
    # Cervejas
    ("Cerveja Heineken", "BEBIDA", "lata", 12, ["heineken", "cerveja_heineken"]),
    ("Cerveja Stella Artois", "BEBIDA", "lata", 12, ["stella", "stella_artois", "cerveja_stella"]),
    ("Cerveja Original", "BEBIDA", "lata", 12, ["original", "cerveja_original"]),
    ("Cerveja Amstel", "BEBIDA", "lata", 12, ["amstel", "cerveja_amstel"]),
    ("Cerveja Corona", "BEBIDA", "garrafa", 6, ["corona", "cerveja_corona"]),
    ("Cerveja Spaten", "BEBIDA", "lata", 12, ["spaten", "cerveja_spaten"]),
    ("Cerveja sem álcool", "BEBIDA", "lata", 12, ["cerveja_sem_alcool", "heineken_zero", "sem_alcool"]),
    # Refrigerantes
    ("Refrigerante Coca-Cola", "BEBIDA", "lata", 12, ["coca", "coca_cola", "refrigerante"]),
    ("Refrigerante Coca-Cola Zero", "BEBIDA", "lata", 12, ["coca_zero", "coca_cola_zero"]),
    ("Refrigerante Guaraná Antarctica", "BEBIDA", "lata", 12, ["guarana", "guarana_antarctica"]),
    ("Refrigerante Guaraná Zero", "BEBIDA", "lata", 12, ["guarana_zero"]),
    ("Água Tônica", "BEBIDA", "lata", 12, ["agua_tonica", "tonica"]),
    # Águas & Não Alcoólicos
    ("Água sem gás", "BEBIDA", "garrafa", 12, ["agua_sem_gas", "agua"]),
    ("Água com gás", "BEBIDA", "garrafa", 12, ["agua_com_gas"]),
    ("Sucos Naturais e Polpas", "BEBIDA", "unidade", 1, ["suco", "sucos"]),
    ("Gelo Filtrado & Copos Térmicos para Destilados Próprios", "BEBIDA", "unidade", 1, ["destilados_proprios", "gelo"]),
]


def forwards(apps, schema_editor):
    Product = apps.get_model("expeditions", "Product")
    for name, category, unit, package_size, aliases in CANONICAL_BEVERAGES:
        Product.objects.update_or_create(
            name=name,
            defaults={
                "category": category,
                "unit": unit,
                "package_size": package_size,
                "aliases": aliases,
                "active": True,
            },
        )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('expeditions', '0014_lodge_target_species_alter_lodge_river_section'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
