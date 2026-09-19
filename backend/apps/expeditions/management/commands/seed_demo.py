from datetime import date

from django.core.management.base import BaseCommand

from apps.expeditions.models import Expedition, ExpeditionSpecies, Lodge, TargetSpecies


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


class Command(BaseCommand):
    help = "Cria as pousadas, espécies e expedições reais de 2026 com personalização completa."

    def handle(self, *args, **options):
        lodges_map = {}
        for data in LODGES:
            lodge, _ = Lodge.objects.update_or_create(slug=data["slug"], defaults=data)
            lodges_map[data["slug"]] = lodge

        species_map = {}
        for data in SPECIES:
            sp, _ = TargetSpecies.objects.update_or_create(slug=data["slug"], defaults=data)
            species_map[data["slug"]] = sp

        expeditions_data = [
            {
                "slug": "sao-felix-01-out",
                "name": "São Félix do Araguaia — 01 a 04 Out",
                "destination": "São Félix do Araguaia/MT (Pousada Solar das Águas)",
                "departure_location": "São Félix do Araguaia/MT",
                "starts_at": date(2026, 10, 1),
                "ends_at": date(2026, 10, 4),
                "capacity": 12,
                "price_per_person_cents": 560000,
                "deposit_cents": 250000,
                "status": Expedition.Status.PUBLISHED,
                "summary": "4 dias completos de pescaria All Inclusive no Rio Araguaia na Pousada Solar das Águas. Guias, barcos, combustível, iscas, kit ceviche/sashimi e open bar premium.",
                "lodge": lodges_map["pousada-solar-das-aguas"],
                "cover_image_url": "/expeditions/ponte-sao-felix.jpg",
                "inclusions": DEFAULT_INCLUSIONS,
                "species": ["piraiba", "pirarara", "filhote_bargada"],
            },
            {
                "slug": "bandeirantes-15-out",
                "name": "Bandeirantes — 15 a 18 Out",
                "destination": "Bandeirantes/GO (Pousada Canaã)",
                "departure_location": "Bandeirantes/GO",
                "starts_at": date(2026, 10, 15),
                "ends_at": date(2026, 10, 18),
                "capacity": 12,
                "price_per_person_cents": 510000,
                "deposit_cents": 250000,
                "status": Expedition.Status.PUBLISHED,
                "summary": "4 dias de pescaria de gigantes All Inclusive no Rio Araguaia na Pousada Canaã. Barcos equipados, combustível incluso, torneio entre duplas e open bar.",
                "lodge": lodges_map["pousada-canaa"],
                "cover_image_url": "/expeditions/bandeirantes-piraiba.jpg",
                "inclusions": DEFAULT_INCLUSIONS,
                "species": ["piraiba", "pirarara", "filhote_bargada"],
            },
            {
                "slug": "bandeirantes-casais-22-out",
                "name": "Pescaria de Casais — 22 a 24 Out",
                "destination": "Bandeirantes/GO (Pousada Canaã)",
                "departure_location": "Bandeirantes/GO",
                "starts_at": date(2026, 10, 22),
                "ends_at": date(2026, 10, 24),
                "capacity": 12,
                "price_per_person_cents": 420000,
                "deposit_cents": 200000,
                "status": Expedition.Status.PUBLISHED,
                "summary": "Grandes rios, boas companhias, melhores histórias! 4 noites e 3 dias de pesca All Inclusive com gastronomia especial e torneio entre os casais (R$ 8.400 por casal).",
                "lodge": lodges_map["pousada-canaa"],
                "cover_image_url": "/expeditions/casais-pesca.jpg",
                "inclusions": DEFAULT_INCLUSIONS,
                "species": ["pirarara", "tucunare", "apapa"],
            },
            {
                "slug": "sao-felix-28-out",
                "name": "São Félix do Araguaia — 28 a 31 Out",
                "destination": "São Félix do Araguaia/MT (Pousada Solar das Águas)",
                "departure_location": "São Félix do Araguaia/MT",
                "starts_at": date(2026, 10, 28),
                "ends_at": date(2026, 10, 31),
                "capacity": 12,
                "price_per_person_cents": 560000,
                "deposit_cents": 250000,
                "status": Expedition.Status.PUBLISHED,
                "summary": "Fechamento de temporada 2026 com chave de ouro em São Félix do Araguaia. Pescaria intensiva de Piraíba e Pirarara com estrutura de ponta.",
                "lodge": lodges_map["pousada-solar-das-aguas"],
                "cover_image_url": "/expeditions/por-do-sol-araguaia.jpg",
                "inclusions": DEFAULT_INCLUSIONS,
                "species": ["piraiba", "pirarara", "filhote_bargada"],
            },
            {
                "slug": "rio-araguaia",
                "name": "Rio Araguaia — Temporada 2026",
                "destination": "São Félix do Araguaia & Bandeirantes",
                "departure_location": "Araguaia / GO & MT",
                "starts_at": date(2026, 10, 1),
                "ends_at": date(2026, 10, 31),
                "capacity": 12,
                "price_per_person_cents": 510000,
                "deposit_cents": 250000,
                "status": Expedition.Status.PUBLISHED,
                "summary": "Expedições completas All Inclusive no Rio Araguaia com guias nativos, combustível incluso e torneio entre as duplas.",
                "lodge": lodges_map["pousada-solar-das-aguas"],
                "cover_image_url": "/expeditions/barco-araguaia.jpg",
                "inclusions": DEFAULT_INCLUSIONS,
                "species": ["piraiba", "pirarara"],
            },
        ]

        for item in expeditions_data:
            slug = item.pop("slug")
            species_keys = item.pop("species", [])
            expedition, created = Expedition.objects.update_or_create(slug=slug, defaults=item)
            for idx, sp_key in enumerate(species_keys):
                sp = species_map.get(sp_key)
                if sp:
                    ExpeditionSpecies.objects.update_or_create(
                        expedition=expedition,
                        species=sp,
                        defaults={"is_primary": idx == 0, "display_order": idx},
                    )
            self.stdout.write(self.style.SUCCESS(f"Expedição {expedition.slug}: {'criada' if created else 'atualizada'}."))
