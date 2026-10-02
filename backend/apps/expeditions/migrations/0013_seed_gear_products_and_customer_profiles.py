from django.db import migrations
from django.utils.text import slugify


def seed_gear_and_profiles(apps, schema_editor):
    FishingGearProduct = apps.get_model("expeditions", "FishingGearProduct")
    Customer = apps.get_model("customers", "Customer")
    CustomerProfile = apps.get_model("customers", "CustomerProfile")

    # 1. Seed canonical gear products
    products_data = [
        {
            "name": "Conjunto Pesado Piraíba Bruta 100-120 lb",
            "category": "HEAVY_ROD_REEL",
            "modality": "RENTAL",
            "technical_specs": {
                "vara": "Carbono tubular 100-120 lb inteiriça 1.80m",
                "carretilha": "Perfil Alto Penn Squall 50 / Shimano Torium 30",
                "linha": "Multifilamento 0.85mm 8 fios 300m",
                "chicote": "Aço 150 lb c/ girador marítimo",
            },
            "rental_price_cents": 35000,
            "sale_price_cents": 0,
            "inventory_quantity": 12,
            "description": "Equipamento profissional para enfrentar as lendárias Piraíbas gigantes acima de 2 metros. Montado e revisado na base.",
            "active": True,
        },
        {
            "name": "Conjunto Médio Pesado Pirarara & Bagres 60-80 lb",
            "category": "MEDIUM_ROD_REEL",
            "modality": "RENTAL",
            "technical_specs": {
                "vara": "Fibra mista 60-80 lb 1.90m",
                "carretilha": "Perfil Alto/Médio Shimano Tranx / Daiwa Lexa 400",
                "linha": "Multifilamento 0.50mm c/ líder fluorocarbono 80 lb",
            },
            "rental_price_cents": 25000,
            "sale_price_cents": 0,
            "inventory_quantity": 14,
            "description": "Conjunto ideal para pesca de fundo de Pirararas, Jaús de médio porte e grandes Barbados em poços e remansos.",
            "active": True,
        },
        {
            "name": "Kit Terminal de Aço para Piraíba & Anzóis Circulares",
            "category": "TERMINAL_TACKLE",
            "modality": "SALE",
            "technical_specs": {
                "anzois": "6 anzóis circulares forjados 10/0 e 12/0",
                "encastoado": "Cabo de aço flexível 150 lb revestido",
                "giradores": "Giradores marítimos blindados",
            },
            "rental_price_cents": 0,
            "sale_price_cents": 12000,
            "inventory_quantity": 40,
            "description": "Kit completo de terminais reforçados para iscas vivas grandes (traíras e piaus), evitando que dentes de peixes de couro cortem a linha.",
            "active": True,
        },
        {
            "name": "Camisa UV 50+ Oficial Expedição Piraíba",
            "category": "APPAREL",
            "modality": "SALE",
            "technical_specs": {
                "protecao": "Fator FPU 50+ permanente",
                "tecido": "Dry-fit respirável e antibacteriano c/ gola alta",
            },
            "rental_price_cents": 0,
            "sale_price_cents": 18000,
            "inventory_quantity": 30,
            "description": "Vestuário técnico oficial para proteção contra sol escaldante e reflexo das águas do Araguaia.",
            "active": True,
        },
    ]

    for pdata in products_data:
        slug = slugify(pdata["name"])
        FishingGearProduct.objects.update_or_create(
            name=pdata["name"],
            defaults={
                "slug": slug,
                "category": pdata["category"],
                "modality": pdata["modality"],
                "technical_specs": pdata["technical_specs"],
                "rental_price_cents": pdata["rental_price_cents"],
                "sale_price_cents": pdata["sale_price_cents"],
                "inventory_quantity": pdata["inventory_quantity"],
                "description": pdata["description"],
                "active": pdata["active"],
            },
        )

    # 2. Ensure CustomerProfile exists for all existing customers
    for customer in Customer.objects.all():
        CustomerProfile.objects.get_or_create(
            customer=customer,
            defaults={
                "city": "Goiânia",
                "state": "GO",
                "default_vest_size": "G",
                "internal_admin_notes": "Cliente cadastrado na plataforma Expedição Piraíba.",
            },
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("expeditions", "0012_fishinggearproduct"),
        ("customers", "0003_customerprofile"),
        ("reservations", "0010_reservationgearaddon"),
    ]

    operations = [
        migrations.RunPython(seed_gear_and_profiles, reverse_code=noop),
    ]
