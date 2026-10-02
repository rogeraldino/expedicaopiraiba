from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.expeditions.models import (
    AllInclusivePackage,
    Amenity,
    BeveragePackage,
    BeveragePackageItem,
    Expedition,
    ExpeditionProduct,
    ExpeditionSpecies,
    Lodge,
    Product,
    River,
    TargetSpecies,
)
from apps.expeditions.services import transition_expedition


EXPEDITION_SLUG = "desafio-piraiba-rio-araguaia"
START = date(2026, 10, 28)
END = date(2026, 10, 31)
DESTINATION = "São Félix do Araguaia/MT"
GALLERY = [
    "/gallery/captura-dupla.jpg",
    "/gallery/barco-araguaia.jpg",
    "/gallery/ponte-sao-felix.jpg",
    "/gallery/pescaria-barco.jpg",
]
COVER = "/gallery/piraiba-rio.jpg"
BEERS = ("Cerveja Heineken", "Cerveja Stella Artois", "Cerveja Original")
REGULAR_INCLUSIONS = [
    "Hospedagem completa com café, almoço e jantar",
    "Combustível 100% incluso para todos os dias de pesca",
    "Guias nativos profissionais em barcos equipados com rádio VHF",
    "Iscas vivas e naturais inclusas",
    "Kit Sashimi & Ceviche preparado no rio",
    "Refrigerantes, água mineral e gelo à vontade",
    "Torneio esportivo entre duplas com troféus oficiais",
]


class Command(BaseCommand):
    help = "Cadastra uma única expedição Desafio Piraíba 2026 com os dados aprovados."

    @transaction.atomic
    def handle(self, *args, **options):
        candidates = list(
            Expedition.objects.select_for_update().filter(starts_at=START, ends_at=END)
        )
        by_slug = Expedition.objects.select_for_update().filter(slug=EXPEDITION_SLUG).first()
        if by_slug and by_slug not in candidates:
            raise CommandError("O slug aprovado já pertence a uma expedição de outras datas.")
        if len(candidates) > 1 or (candidates and candidates[0].destination != DESTINATION):
            raise CommandError("Há expedição ambígua ou de destino diferente nas datas aprovadas.")
        existing = by_slug or (candidates[0] if candidates else None)
        if existing and existing.reservations.exists():
            raise CommandError("A expedição nas datas aprovadas possui reservas; revisão humana necessária.")
        if existing and existing.status not in (Expedition.Status.DRAFT, Expedition.Status.PUBLISHED):
            raise CommandError("O estado da expedição existente impede esta carga.")

        river = River.objects.filter(slug="rio-araguaia", active=True).first()
        source_package = AllInclusivePackage.objects.filter(slug="estrutura-completa-regular", active=True).first()
        species = list(TargetSpecies.objects.filter(active=True))
        piraiba = next((item for item in species if item.slug == "piraiba"), None)
        products = [Product.objects.filter(name=name, active=True).first() for name in BEERS]
        required_amenities = {
            "Barcos 6m com motor 40/50HP c/ Trim", "Rádio VHF Integrado",
            "Guias Nativos Homologados", "Trapiche e Deck de Embarque Seguro",
            "Viveiro Climatizado de Iscas", "Fábrica de Gelo Própria",
            "Suítes Climatizadas (Ar Split)", "Chuveiro com Aquecimento",
            "Quartos Privativos para Casais e Duplas", "Limpeza e Arrumação Diária",
            "Piscina com Área de Convivência", "Quiosque e Área de Descontração",
            "Restaurante com Culinária Regional", "Petiscaria e Ceviche no Rio",
            "Wi-Fi Starlink de Alta Velocidade", "Gerador de Energia de Emergência 24h",
            "Pista de Pouso Homologada / Próxima",
        }
        if not river or not piraiba or any(p is None for p in products):
            raise CommandError("Faltam rio, Piraíba ou cervejas ativas no catálogo.")
        if source_package and source_package.inclusions != REGULAR_INCLUSIONS:
            raise CommandError("As inclusões do pacote regular divergem da migração aprovada.")
        if set(Amenity.objects.filter(active=True, name__in=required_amenities).values_list("name", flat=True)) != required_amenities:
            raise CommandError("Uma ou mais comodidades solicitadas não estão disponíveis no catálogo.")
        lodge = Lodge.objects.select_for_update().filter(name="Pousada Solar das Águas").first()
        if lodge and (lodge.city != "São Félix do Araguaia" or lodge.state != "MT" or lodge.directions):
            raise CommandError("A pousada existente conflita com a localização ou traz instruções de encontro não aprovadas.")
        if lodge and lodge.slug != "pousada-solar-das-aguas":
            raise CommandError("A pousada existente usa um slug inesperado.")
        if not lodge and Lodge.objects.filter(slug="pousada-solar-das-aguas").exists():
            raise CommandError("O slug da pousada pertence a outro cadastro.")

        lodge = lodge or Lodge.objects.create(
            name="Pousada Solar das Águas", slug="pousada-solar-das-aguas",
            city="São Félix do Araguaia", state="MT", river=river,
        )
        ordered_species = [piraiba, *[item for item in species if item.slug != "piraiba"]]
        lodge.target_species.set(ordered_species)
        package, _ = AllInclusivePackage.objects.update_or_create(
            slug="pacote-desafio-piraiba-2026",
            defaults={"name": "Pacote da Expedição — Desafio Piraíba", "inclusions": REGULAR_INCLUSIONS.copy(), "active": True},
        )
        beverage_package, _ = BeveragePackage.objects.update_or_create(
            slug="bebidas-desafio-piraiba-2026",
            defaults={"name": "Bebidas — Desafio Piraíba", "description": "Opções para escolha do participante; 18 unidades por pessoa da opção escolhida como padrão operacional de compra.", "active": True},
        )
        if package.expeditions.exclude(pk=existing.pk if existing else None).exists() or beverage_package.expeditions.exclude(pk=existing.pk if existing else None).exists():
            raise CommandError("O pacote dedicado já está vinculado a outra expedição.")
        BeveragePackageItem.objects.filter(package=beverage_package).exclude(product__in=products).delete()
        for order, product in enumerate(products):
            BeveragePackageItem.objects.update_or_create(
                package=beverage_package, product=product,
                defaults={"standard_quantity_per_participant": 18, "display_order": order},
            )

        values = dict(
            name="Desafio Piraíba — Rio Araguaia", destination=DESTINATION,
            departure_location="Goiânia/GO", meeting_instructions="",
            starts_at=START, ends_at=END, capacity=12,
            price_per_person_cents=560000, deposit_cents=112000,
            balance_due_days_before=7, lodge=lodge,
            all_inclusive_package=package, beverage_package=beverage_package,
            summary="Expedição de pesca esportiva no Rio Araguaia, com Piraíba como espécie principal.",
            cover_image_url=COVER, gallery_image_urls=GALLERY,
            inclusions=package.inclusions.copy(),
        )
        if existing:
            for key, value in values.items():
                setattr(existing, key, value)
            existing.save()
            expedition = existing
        else:
            expedition = Expedition.objects.create(slug=EXPEDITION_SLUG, status=Expedition.Status.DRAFT, **values)
        ExpeditionSpecies.objects.filter(expedition=expedition).delete()
        for order, item in enumerate(ordered_species):
            ExpeditionSpecies.objects.create(expedition=expedition, species=item, is_primary=order == 0, display_order=order)
        for order, product in enumerate(products):
            ExpeditionProduct.objects.update_or_create(
                expedition=expedition, product=product,
                defaults={"standard_quantity_per_participant": 18, "display_order": order, "active": True},
            )
        ExpeditionProduct.objects.filter(expedition=expedition).exclude(product__in=products).delete()
        expedition = transition_expedition(expedition_id=expedition.id, target_status=Expedition.Status.PUBLISHED)
        self.stdout.write(self.style.SUCCESS(f"Expedição publicada: {expedition.id} ({expedition.slug})."))
