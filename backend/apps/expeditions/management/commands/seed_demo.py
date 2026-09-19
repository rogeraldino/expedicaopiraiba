from datetime import date

from django.core.management.base import BaseCommand

from apps.expeditions.models import ChecklistItem, Expedition, ExpeditionProduct, Product


class Command(BaseCommand):
    help = "Cria as expedições reais de 2026 extraídas dos encartes oficiais."

    def handle(self, *args, **options):
        # Remove ou despublica as duas primeiras expedições descontinuadas
        for legacy_slug in ["sao-felix-01-out", "bandeirantes-15-out"]:
            legacy_exp = Expedition.objects.filter(slug=legacy_slug).first()
            if legacy_exp:
                legacy_exp.status = Expedition.Status.CANCELLED
                legacy_exp.save(update_fields=["status"])
                try:
                    legacy_exp.product_offers.all().delete()
                    legacy_exp.checklist_items.all().delete()
                    legacy_exp.configuration_events.all().delete()
                    legacy_exp.delete()
                except Exception:
                    pass

        expeditions_data = [
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
                "status": Expedition.Status.DRAFT,
                "summary": "Expedições completas All Inclusive no Rio Araguaia com guias nativos, combustível incluso e torneio entre as duplas.",
            },
        ]

        active_expeditions = []
        for item in expeditions_data:
            slug = item.pop("slug")
            expedition, created = Expedition.objects.update_or_create(slug=slug, defaults=item)
            active_expeditions.append(expedition)
            self.stdout.write(self.style.SUCCESS(f"Expedição {expedition.slug}: {'criada' if created else 'atualizada'}."))

        # 1. Catálogo Completo de Bebidas Oficiais All Inclusive
        beverages_catalog = [
            ("Cerveja Heineken", "lata", ["heineken", "cerveja_heineken"], "Cerveja Premium All Inclusive (Lata 350ml)"),
            ("Cerveja Original", "lata", ["original", "cerveja_original"], "Cerveja Tradicional All Inclusive (Lata 350ml)"),
            ("Cerveja Stella Artois", "lata", ["stella", "stella_artois"], "Cerveja Puro Malte All Inclusive (Lata 350ml)"),
            ("Cerveja Heineken 0.0 (Sem Álcool)", "lata", ["cerveja_sem_alcool", "heineken_zero"], "Opção Sem Álcool All Inclusive (Lata 350ml)"),
            ("Coca-Cola Tradicional", "lata", ["coca_cola", "refrigerante"], "Refrigerante All Inclusive (Lata 350ml)"),
            ("Coca-Cola Sem Açúcar", "lata", ["coca_zero"], "Refrigerante Zero Açúcar All Inclusive (Lata 350ml)"),
            ("Guaraná Antarctica", "lata", ["guarana", "guarana_antarctica"], "Refrigerante All Inclusive (Lata 350ml)"),
            ("Guaraná Antarctica Zero", "lata", ["guarana_zero"], "Refrigerante Zero Açúcar All Inclusive (Lata 350ml)"),
            ("Água Mineral sem Gás", "garrafa", ["agua_sem_gas", "agua"], "Água mineral gelada em abundância no barco e pousada"),
            ("Água Mineral com Gás", "garrafa", ["agua_com_gas"], "Água mineral com gás gelada"),
            ("Água Tônica", "lata", ["agua_tonica", "tonica"], "Água tônica gelada para drinks e refrescância"),
            ("Sucos Naturais e Polpas", "unidade", ["suco", "sucos"], "Sucos de frutas servidos nas refeições e barco"),
            ("Gelo Filtrado & Copos Térmicos para Destilados Próprios", "unidade", ["destilados_proprios"], "Estrutura completa caso deseje levar whisky, gin ou cachaça especial"),
        ]

        products = []
        for index, (name, unit, keys, note) in enumerate(beverages_catalog):
            product, _ = Product.objects.update_or_create(
                name=name,
                defaults={"category": "BEBIDA", "unit": unit, "aliases": keys, "active": True}
            )
            products.append((product, note))

        # Vincula as bebidas All Inclusive a todas as expedições ativas
        for expedition in active_expeditions:
            for index, (product, note) in enumerate(products):
                ExpeditionProduct.objects.update_or_create(
                    expedition=expedition,
                    product=product,
                    defaults={
                        "standard_quantity_per_participant": 1,
                        "display_order": index,
                        "note": note,
                        "active": True
                    }
                )

        # 2. Checklist Oficial do Pescador
        checklist_catalog = [
            ("Licença de Pesca Amadora / Esportiva (Federal MPA ou Estadual GO/MT)", "Obrigatória para pescar legalmente. Pode ser apresentada digitalmente no celular.", True, 1),
            ("Documento Oficial com Foto (RG ou CNH)", "Obrigatório para identificação na pousada e eventuais fiscalizações náuticas.", True, 2),
            ("Protetor Solar FPS 50+ & Repelente de Insetos", "Essencial para as jornadas de 8h a 10h diárias no rio sob sol do Centro-Oeste.", False, 3),
            ("Roupas com Proteção UV50+ & Óculos Polarizado", "Camisa manga longa de pesca, buff de pescoço e óculos com lente polarizada.", False, 4),
            ("Medicamentos de Uso Pessoal Contínuo", "Traga medicamentos prescritos suficientes para toda a estadia, além de itens básicos.", False, 5),
        ]

        for expedition in active_expeditions:
            for title, desc, req, order in checklist_catalog:
                ChecklistItem.objects.update_or_create(
                    expedition=expedition,
                    title=title,
                    defaults={
                        "description": desc,
                        "required": req,
                        "display_order": order,
                        "active": True
                    }
                )

        self.stdout.write(self.style.SUCCESS("Catálogo de bebidas All Inclusive e Checklist atualizados com sucesso."))
