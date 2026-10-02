from django.db import migrations


def forwards(apps, schema_editor):
    Lodge = apps.get_model("expeditions", "Lodge")
    TargetSpecies = apps.get_model("expeditions", "TargetSpecies")
    ExpeditionSpecies = apps.get_model("expeditions", "ExpeditionSpecies")
    Expedition = apps.get_model("expeditions", "Expedition")
    Product = apps.get_model("expeditions", "Product")
    ExpeditionProduct = apps.get_model("expeditions", "ExpeditionProduct")

    # 1. Desativar Jaú e remover dos alvos de expedições
    TargetSpecies.objects.filter(slug="jau").update(active=False)
    ExpeditionSpecies.objects.filter(species__slug="jau").delete()

    # 2. Desativar Amstel e registrar Stella Artois
    Product.objects.filter(name__icontains="Amstel").update(active=False)
    stella, _ = Product.objects.update_or_create(
        name="Cerveja Stella Artois",
        defaults={
            "unit": "lata",
            "package_size": 12,
            "aliases": ["stella", "stella_artois", "cerveja_stella"],
            "active": True,
        },
    )

    # Garante ExpeditionProduct de Stella Artois para as expedições
    for exp in Expedition.objects.all():
        ExpeditionProduct.objects.get_or_create(
            expedition=exp,
            product=stella,
            defaults={"standard_quantity_per_participant": 1, "active": True},
        )

    # 3. Atualizar Comodidades das Pousadas (diferenciando piscina e retirando fábrica de gelo genérica)
    Lodge.objects.filter(slug="pousada-solar-das-aguas").update(
        amenities=["Wi-Fi", "Ar-condicionado", "Piscina", "Quartos confortáveis", "Restaurante regional", "Barcos com motor 40/50HP"]
    )
    Lodge.objects.filter(slug="pousada-canaa").update(
        amenities=["Wi-Fi", "Ar-condicionado", "Quartos privativos", "Restaurante completo", "Barcos com rádio VHF", "Deck de embarque"]
    )

    # 4. Atualizar Inclusões e Resumos
    standard_inclusions = [
        "Hospedagem completa com café, almoço e jantar",
        "Combustível 100% incluso para todos os dias de pesca",
        "Guias nativos profissionais em barcos equipados com rádio VHF",
        "Iscas vivas e naturais inclusas",
        "Kit Sashimi & Ceviche preparado no rio",
        "Refrigerantes, água mineral e gelo à vontade",
        "Torneio esportivo entre duplas com troféus oficiais",
    ]

    couples_inclusions = [
        "Hospedagem completa com café, almoço e jantar",
        "Combustível 100% incluso para todos os dias de pesca",
        "Guias nativos profissionais em barcos equipados com rádio VHF",
        "Iscas vivas e naturais inclusas",
        "Kit Sashimi & Ceviche preparado no rio",
        "Open Bar de cervejas premium (Heineken, Original, Stella Artois)",
        "Refrigerantes, água mineral e gelo à vontade",
        "Torneio esportivo entre duplas com troféus oficiais",
    ]

    for exp in Expedition.objects.all():
        if "casais" in exp.slug:
            exp.inclusions = couples_inclusions
            if "gastronomia" in exp.summary.lower() or "alta gastronomia" in exp.summary.lower():
                exp.summary = (
                    "Grandes rios, boas companhias, melhores histórias! 4 noites e 3 dias de pesca All Inclusive "
                    "com culinária típica no rio e na pousada e torneio entre os casais (R$ 8.400 por casal)."
                )
        else:
            exp.inclusions = standard_inclusions
            # Remove menções a All Inclusive dos resumos das expedições regulares
            if "all inclusive" in exp.summary.lower():
                if "sao-felix-01-out" in exp.slug:
                    exp.summary = "4 dias completos de pescaria no Rio Araguaia na Pousada Solar das Águas. Guias nativos, barcos rápidos, combustível livre, iscas, kit ceviche/sashimi e gelo à vontade."
                elif "bandeirantes-15-out" in exp.slug:
                    exp.summary = "4 dias de pescaria de gigantes no Rio Araguaia na Pousada Canaã. Barcos equipados, combustível incluso, iscas e torneio entre duplas."
                elif "sao-felix-28-out" in exp.slug:
                    exp.summary = "Fechamento de temporada 2026 com chave de ouro em São Félix do Araguaia. Pescaria intensiva de Piraíba e Pirarara com estrutura completa."
                elif "rio-araguaia" in exp.slug:
                    exp.summary = "Expedições completas de pesca esportiva no Rio Araguaia com guias nativos, combustível incluso e torneio entre as duplas."
        exp.save()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('expeditions', '0006_seed_lodges_species_and_update_expeditions'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
