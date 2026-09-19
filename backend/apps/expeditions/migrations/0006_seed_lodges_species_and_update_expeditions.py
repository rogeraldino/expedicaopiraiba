from django.db import migrations


LODGES = [
    {
        "slug": "pousada-solar-das-aguas",
        "name": "Pousada Solar das Águas",
        "city": "São Félix do Araguaia",
        "state": "MT",
        "river_section": "Rio Araguaia",
        "description": "Estrutura de ponta às margens do Rio Araguaia com apartamentos climatizados, restaurante típico e barcos rápidos.",
        "amenities": ["Wi-Fi", "Ar-condicionado", "Piscina", "Quartos duplos e triplos", "Fábrica de gelo", "Restaurante regional", "Barcos com motor 40/50HP"],
        "meeting_point": "São Félix do Araguaia / MT",
        "directions": "Acesso via voo regional até São Félix do Araguaia ou transfer rodoviário a partir de Palmas/TO ou Confresa/MT. Encontro oficial na recepção às 16h.",
        "cover_image_url": "/expeditions/ponte-sao-felix.jpg",
    },
    {
        "slug": "pousada-canaa",
        "name": "Pousada Canaã",
        "city": "Bandeirantes",
        "state": "GO",
        "river_section": "Rio Araguaia",
        "description": "Base estratégica no coração do Vale do Araguaia com tradição na pescaria de grandes bagres de couro e excelente conforto.",
        "amenities": ["Wi-Fi", "Ar-condicionado", "Piscina", "Quartos privativos", "Restaurante completo", "Barcos equipados com rádio VHF", "Fábrica de gelo"],
        "meeting_point": "Bandeirantes / GO",
        "directions": "Acesso asfaltado a partir de Goiânia (aprox. 440 km) ou transfer contratado. Encontro oficial na Pousada Canaã até as 17h para jantar de boas-vindas.",
        "cover_image_url": "/expeditions/bandeirantes-piraiba.jpg",
    },
]

SPECIES = [
    {"slug": "piraiba", "common_name": "Piraíba", "scientific_name": "Brachyplatystoma filamentosum", "category": "COURO"},
    {"slug": "pirarara", "common_name": "Pirarara", "scientific_name": "Phractocephalus hemioliopterus", "category": "COURO"},
    {"slug": "filhote_bargada", "common_name": "Filhote / Bargada", "scientific_name": "Brachyplatystoma rousseauxii", "category": "COURO"},
    {"slug": "barbado", "common_name": "Barbado", "scientific_name": "Pinirampus pirinampu", "category": "COURO"},
    {"slug": "jau", "common_name": "Jaú", "scientific_name": "Paulicea luetkeni", "category": "COURO"},
    {"slug": "tucunare", "common_name": "Tucunaré", "scientific_name": "Cichla spp.", "category": "ESCAMA"},
    {"slug": "apapa", "common_name": "Apapá", "scientific_name": "Pellona castelnaeana", "category": "ESCAMA"},
    {"slug": "bicuda", "common_name": "Bicuda", "scientific_name": "Boulengerella cuvieri", "category": "ESCAMA"},
]

CANONICAL_PRODUCTS = [
    ("Cerveja Heineken", "lata", 12, ["heineken", "cerveja_heineken"]),
    ("Cerveja Original", "lata", 12, ["original", "cerveja_original"]),
    ("Cerveja Amstel", "lata", 12, ["amstel", "cerveja_amstel"]),
    ("Cerveja sem álcool", "lata", 12, ["cerveja_sem_alcool", "heineken_zero", "sem_alcool"]),
    ("Refrigerante Coca-Cola", "lata", 12, ["coca", "coca_cola", "refrigerante"]),
    ("Refrigerante Coca-Cola Zero", "lata", 12, ["coca_zero", "coca_cola_zero"]),
    ("Refrigerante Guaraná Antarctica", "lata", 12, ["guarana", "guarana_antarctica"]),
    ("Refrigerante Guaraná Zero", "lata", 12, ["guarana_zero"]),
    ("Água sem gás", "garrafa", 12, ["agua_sem_gas", "agua"]),
    ("Água com gás", "garrafa", 12, ["agua_com_gas"]),
]

DEFAULT_INCLUSIONS = [
    "Hospedagem completa com café, almoço e jantar",
    "Combustível 100% incluso para todos os dias de pesca",
    "Guias nativos profissionais em barcos equipados com rádio VHF",
    "Iscas vivas (tuviras) e naturais inclusas",
    "Kit Sashimi & Ceviche preparado no rio",
    "Open Bar de cervejas premium (Heineken, Original, Amstel)",
    "Refrigerantes, água mineral e gelo à vontade",
    "Torneio esportivo entre duplas com troféus oficiais",
]


def forwards(apps, schema_editor):
    Lodge = apps.get_model("expeditions", "Lodge")
    TargetSpecies = apps.get_model("expeditions", "TargetSpecies")
    ExpeditionSpecies = apps.get_model("expeditions", "ExpeditionSpecies")
    Expedition = apps.get_model("expeditions", "Expedition")
    Product = apps.get_model("expeditions", "Product")
    ExpeditionProduct = apps.get_model("expeditions", "ExpeditionProduct")

    # 1. Lodges
    lodges_map = {}
    for data in LODGES:
        lodge, _ = Lodge.objects.update_or_create(slug=data["slug"], defaults=data)
        lodges_map[data["slug"]] = lodge

    # 2. Species
    species_map = {}
    for data in SPECIES:
        sp, _ = TargetSpecies.objects.update_or_create(slug=data["slug"], defaults=data)
        species_map[data["slug"]] = sp

    # 3. Canonical Products
    canonical_names = set()
    for name, unit, package_size, aliases in CANONICAL_PRODUCTS:
        canonical_names.add(name)
        Product.objects.update_or_create(
            name=name,
            defaults={"unit": unit, "package_size": package_size, "aliases": aliases, "active": True},
        )
    # Desativa produtos fora do cardápio mestre
    Product.objects.exclude(name__in=canonical_names).update(active=False)

    # 4. Atualiza Expedições existentes
    covers = {
        "sao-felix-01-out": ("/expeditions/ponte-sao-felix.jpg", "pousada-solar-das-aguas", ["piraiba", "pirarara", "filhote_bargada"]),
        "bandeirantes-15-out": ("/expeditions/bandeirantes-piraiba.jpg", "pousada-canaa", ["piraiba", "pirarara", "filhote_bargada"]),
        "bandeirantes-casais-22-out": ("/expeditions/casais-pesca.jpg", "pousada-canaa", ["pirarara", "tucunare", "apapa"]),
        "sao-felix-28-out": ("/expeditions/por-do-sol-araguaia.jpg", "pousada-solar-das-aguas", ["piraiba", "pirarara", "filhote_bargada"]),
        "rio-araguaia": ("/expeditions/barco-araguaia.jpg", "pousada-solar-das-aguas", ["piraiba", "pirarara"]),
    }

    for exp in Expedition.objects.all():
        data = covers.get(exp.slug)
        if data:
            cover_url, lodge_slug, target_keys = data
            exp.cover_image_url = cover_url
            exp.lodge = lodges_map.get(lodge_slug)
            exp.inclusions = DEFAULT_INCLUSIONS
            exp.save()
            for index, sp_slug in enumerate(target_keys):
                sp = species_map.get(sp_slug)
                if sp:
                    ExpeditionSpecies.objects.get_or_create(
                        expedition=exp,
                        species=sp,
                        defaults={"is_primary": index == 0, "display_order": index},
                    )
        elif not exp.inclusions:
            exp.inclusions = DEFAULT_INCLUSIONS
            exp.save()

        # Garante que os novos produtos canônicos possuam ExpeditionProduct
        for index, name in enumerate(canonical_names):
            prod = Product.objects.filter(name=name, active=True).first()
            if prod:
                ExpeditionProduct.objects.get_or_create(
                    expedition=exp,
                    product=prod,
                    defaults={"standard_quantity_per_participant": 1, "display_order": index, "active": True},
                )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("expeditions", "0005_lodge_targetspecies_expedition_cover_image_url_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
