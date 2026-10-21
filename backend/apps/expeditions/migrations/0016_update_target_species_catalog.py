from django.db import migrations

SPECIES_DATA = [
    {
        "slug": "piraiba",
        "common_name": "Piraíba (+2m)",
        "scientific_name": "Brachyplatystoma filamentosum",
        "category": "COURO",
        "active": True,
        "is_native": True,
        "is_trophy": True,
        "best_season": "Junho a Outubro (águas baixas)",
    },
    {
        "slug": "pirarara",
        "common_name": "Pirarara Lendária",
        "scientific_name": "Phractocephalus hemioliopterus",
        "category": "COURO",
        "active": True,
        "is_native": True,
        "is_trophy": True,
        "best_season": "Junho a Outubro (águas baixas)",
    },
    {
        "slug": "barbado",
        "common_name": "Barbado",
        "scientific_name": "Pinirampus pirinampu",
        "category": "COURO",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "bargada",
        "common_name": "Bargada",
        "scientific_name": "Brachyplatystoma rousseauxii",
        "category": "COURO",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "cachara",
        "common_name": "Cachara",
        "scientific_name": "Pseudoplatystoma fasciatum",
        "category": "COURO",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "dourada",
        "common_name": "Dourada",
        "scientific_name": "Brachyplatystoma flavicans",
        "category": "COURO",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "mandube",
        "common_name": "Mandubé",
        "scientific_name": "Ageneiosus inermis",
        "category": "COURO",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "pintado",
        "common_name": "Pintado",
        "scientific_name": "Pseudoplatystoma corruscans",
        "category": "COURO",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "tucunare",
        "common_name": "Tucunaré Azul",
        "scientific_name": "Cichla piquiti",
        "category": "ESCAMA",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "apapa",
        "common_name": "Apapá",
        "scientific_name": "Pellona castelnaeana",
        "category": "ESCAMA",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "aruana",
        "common_name": "Aruanã",
        "scientific_name": "Osteoglossum bicirrhosum",
        "category": "ESCAMA",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "bicuda",
        "common_name": "Bicuda",
        "scientific_name": "Boulengerella cuvieri",
        "category": "ESCAMA",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "cachorra",
        "common_name": "Cachorra",
        "scientific_name": "Hydrolycus armatus",
        "category": "ESCAMA",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "corvina",
        "common_name": "Corvina",
        "scientific_name": "Plagioscion squamosissimus",
        "category": "ESCAMA",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
    {
        "slug": "tambaqui",
        "common_name": "Tambaqui",
        "scientific_name": "Colossoma macropomum",
        "category": "ESCAMA",
        "active": True,
        "is_native": True,
        "is_trophy": False,
        "best_season": "Ano todo / Temporada de seca",
    },
]


def update_species_and_lodges(apps, schema_editor):
    TargetSpecies = apps.get_model("expeditions", "TargetSpecies")
    Lodge = apps.get_model("expeditions", "Lodge")
    River = apps.get_model("expeditions", "River")
    RiverSpecies = apps.get_model("expeditions", "RiverSpecies")

    species_objects = []
    for item in SPECIES_DATA:
        obj, _ = TargetSpecies.objects.update_or_create(
            slug=item["slug"],
            defaults={
                "common_name": item["common_name"],
                "scientific_name": item["scientific_name"],
                "category": item["category"],
                "active": item["active"],
            },
        )
        species_objects.append((obj, item))

    # Link to all rivers
    rivers = list(River.objects.all())
    for river in rivers:
        for obj, item in species_objects:
            RiverSpecies.objects.update_or_create(
                river=river,
                species=obj,
                defaults={
                    "is_native": item["is_native"],
                    "is_trophy": item["is_trophy"],
                    "best_season": item["best_season"],
                },
            )

    # Link to all lodges
    lodges = list(Lodge.objects.all())
    for lodge in lodges:
        for obj, _ in species_objects:
            lodge.target_species.add(obj)


class Migration(migrations.Migration):

    dependencies = [
        ("expeditions", "0015_restore_beverage_catalog"),
    ]

    operations = [
        migrations.RunPython(update_species_and_lodges, migrations.RunPython.noop),
    ]
