from datetime import date

from django.core.management.base import BaseCommand

from apps.expeditions.models import Expedition


class Command(BaseCommand):
    help = "Cria as expedições reais de 2026 extraídas dos encartes oficiais."

    def handle(self, *args, **options):
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
            },
            {
                "slug": "bandeirantes-15-out",
                "name": "Bandeirantes — 15 a 18 Out",
                "destination": "Bandeirantes/GO (Pousada Canoa)",
                "departure_location": "Bandeirantes/GO",
                "starts_at": date(2026, 10, 15),
                "ends_at": date(2026, 10, 18),
                "capacity": 12,
                "price_per_person_cents": 510000,
                "deposit_cents": 250000,
                "status": Expedition.Status.PUBLISHED,
                "summary": "4 dias de pescaria de gigantes All Inclusive no Rio Araguaia na Pousada Canoa. Barcos equipados, combustível incluso, torneio entre duplas e open bar.",
            },
            {
                "slug": "bandeirantes-casais-22-out",
                "name": "Pescaria de Casais — 22 a 24 Out",
                "destination": "Bandeirantes/GO (Pousada Canoa)",
                "departure_location": "Bandeirantes/GO",
                "starts_at": date(2026, 10, 22),
                "ends_at": date(2026, 10, 24),
                "capacity": 12,
                "price_per_person_cents": 420000,
                "deposit_cents": 200000,
                "status": Expedition.Status.PUBLISHED,
                "summary": "Grandes rios, boas companhias, melhores histórias! 4 noites e 3 dias de pesca All Inclusive com gastronomia especial e torneio entre os casais (R$ 8.400 por casal).",
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
            },
        ]

        for item in expeditions_data:
            slug = item.pop("slug")
            expedition, created = Expedition.objects.update_or_create(slug=slug, defaults=item)
            self.stdout.write(self.style.SUCCESS(f"Expedição {expedition.slug}: {'criada' if created else 'atualizada'}."))
