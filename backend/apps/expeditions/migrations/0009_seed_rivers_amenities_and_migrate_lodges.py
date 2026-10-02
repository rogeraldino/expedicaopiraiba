from django.db import migrations


AMENITIES_CATALOG = [
    # ESTRUTURA NÁUTICA
    ("Barcos 6m com motor 40/50HP c/ Trim", "FISHING_STRUCTURE", "ship", "Barcos plataformados velozes e confortáveis com comando a distância e trim elétrico", 1),
    ("Rádio VHF Integrado", "FISHING_STRUCTURE", "radio", "Comunicação por rádio nos barcos conectada à pousada e equipe de apoio", 2),
    ("Guias Nativos Homologados", "FISHING_STRUCTURE", "users", "Piloteiros nascidos e criados no rio, com domínio absoluto dos poços e corredeiras", 3),
    ("Trapiche e Deck de Embarque Seguro", "FISHING_STRUCTURE", "anchor", "Acesso fácil e seguro às embarcações com rampa e iluminação noturna", 4),
    ("Viveiro Climatizado de Iscas", "FISHING_STRUCTURE", "fish", "Tanques de oxigenação para conservação de iscas vivas em excelente estado", 5),
    ("Fábrica de Gelo Própria", "FISHING_STRUCTURE", "snowflake", "Produção local de gelo filtrado para abastecimento das caixas térmicas", 6),

    # ACOMODAÇÃO E CONFORTO
    ("Suítes Climatizadas (Ar Split)", "ROOM_COMFORT", "wind", "Apartamentos com ar-condicionado silencioso e camas box", 10),
    ("Chuveiro com Aquecimento", "ROOM_COMFORT", "flame", "Banho com aquecimento elétrico ou solar após a jornada de pesca", 11),
    ("Quartos Privativos para Casais e Duplas", "ROOM_COMFORT", "bed-double", "Acomodações privativas com privacidade total e banheiro exclusivo", 12),
    ("Limpeza e Arrumação Diária", "ROOM_COMFORT", "sparkles", "Serviço de quarto e troca de roupas de cama diária", 13),

    # LAZER
    ("Piscina com Área de Convivência", "LEISURE", "waves", "Piscina tratada com bar e cadeiras de descanso para relaxar no fim da tarde", 20),
    ("Quiosque e Área de Descontração", "LEISURE", "sun", "Área social para confraternização, troca de fotos e resenha dos pescadores", 21),

    # CULINÁRIA
    ("Restaurante com Culinária Regional", "GASTRONOMY", "utensils", "Buffet regional completo com pratos típicos e cafés fartos", 30),
    ("Petiscaria e Ceviche no Rio", "GASTRONOMY", "chef-hat", "Preparo de peixes frescos e petiscos barranqueiros na praia", 31),

    # CONECTIVIDADE E LOGÍSTICA
    ("Wi-Fi Starlink de Alta Velocidade", "CONNECTIVITY", "wifi", "Internet via satélite rápida para chamadas e envio de fotos", 40),
    ("Gerador de Energia de Emergência 24h", "CONNECTIVITY", "zap", "Fornecimento contínuo de energia elétrica sem interrupções", 41),
    ("Pista de Pouso Homologada / Próxima", "CONNECTIVITY", "plane", "Acesso aéreo direto para aeronaves fretadas ou particulares", 42),
]


def forwards(apps, schema_editor):
    River = apps.get_model("expeditions", "River")
    RiverSpecies = apps.get_model("expeditions", "RiverSpecies")
    TargetSpecies = apps.get_model("expeditions", "TargetSpecies")
    Amenity = apps.get_model("expeditions", "Amenity")
    Lodge = apps.get_model("expeditions", "Lodge")
    LodgeAmenityLink = apps.get_model("expeditions", "LodgeAmenityLink")

    # 1. Cria o Rio Araguaia
    araguaia, _ = River.objects.update_or_create(
        slug="rio-araguaia",
        defaults={
            "name": "Rio Araguaia",
            "basin": "TOCANTINS_ARAGUAIA",
            "states": ["MT", "GO", "TO"],
            "description": "Um dos maiores santuários da pesca esportiva mundial, berço dos gigantes de couro (Piraíba e Pirarara) e praias paradisíacas.",
            "regulations": "Cota zero para transporte de peixes (pesque e solte obrigatório para espécies esportivas). Licença de Pesca Amadora embarcada obrigatória (Federal MPA e Estadual de MT/GO).",
            "active": True,
        },
    )

    # 2. Vincula espécies ativas do Araguaia ao RiverSpecies
    for sp in TargetSpecies.objects.filter(active=True):
        is_trophy = sp.slug in ["piraiba", "pirarara"]
        best_season = "Junho a Outubro (águas baixas)" if is_trophy else "Ano todo / Temporada de seca"
        RiverSpecies.objects.update_or_create(
            river=araguaia,
            species=sp,
            defaults={
                "is_native": True,
                "is_trophy": is_trophy,
                "best_season": best_season,
            },
        )

    # 3. Cria o catálogo de Comodidades
    amenity_map = {}
    for name, category, icon_key, desc, order in AMENITIES_CATALOG:
        am, _ = Amenity.objects.update_or_create(
            name=name,
            defaults={
                "category": category,
                "icon_key": icon_key,
                "description": desc,
                "display_order": order,
                "active": True,
            },
        )
        amenity_map[name] = am

    # 4. Vincula as pousadas existentes ao Rio Araguaia e associa comodidades
    solar = Lodge.objects.filter(slug="pousada-solar-das-aguas").first()
    if solar:
        solar.river = araguaia
        solar.boat_fleet_details = "Barcos plataformados de 6m com motores Mercury 40/50HP c/ Trim, cadeiras giratórias acolchoadas e caixas térmicas."
        solar.save()

        solar_amenities = [
            "Suítes Climatizadas (Ar Split)",
            "Chuveiro com Aquecimento",
            "Wi-Fi Starlink de Alta Velocidade",
            "Piscina com Área de Convivência",
            "Restaurante com Culinária Regional",
            "Barcos 6m com motor 40/50HP c/ Trim",
            "Guias Nativos Homologados",
        ]
        LodgeAmenityLink.objects.filter(lodge=solar).delete()
        for name in solar_amenities:
            am = amenity_map.get(name)
            if am:
                LodgeAmenityLink.objects.create(lodge=solar, amenity=am, is_highlight=True)

    canaa = Lodge.objects.filter(slug="pousada-canaa").first()
    if canaa:
        canaa.river = araguaia
        canaa.boat_fleet_details = "Barcos de 6m equipados com motor 40/50HP, rádio comunicador VHF integrado para segurança náutica e piloteiros experientes."
        canaa.save()

        canaa_amenities = [
            "Suítes Climatizadas (Ar Split)",
            "Chuveiro com Aquecimento",
            "Quartos Privativos para Casais e Duplas",
            "Wi-Fi Starlink de Alta Velocidade",
            "Restaurante com Culinária Regional",
            "Barcos 6m com motor 40/50HP c/ Trim",
            "Rádio VHF Integrado",
            "Trapiche e Deck de Embarque Seguro",
            "Guias Nativos Homologados",
        ]
        LodgeAmenityLink.objects.filter(lodge=canaa).delete()
        for name in canaa_amenities:
            am = amenity_map.get(name)
            if am:
                LodgeAmenityLink.objects.create(lodge=canaa, amenity=am, is_highlight=True)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('expeditions', '0008_amenity_river_lodge_boat_fleet_details_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
