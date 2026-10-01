# Especificação Técnica e Funcional — Plataforma Operacional Modular

> **Identificador:** `BACKLOG-OPERACIONAL-MODULAR`  
> **Status:** `DRAFT / BACKLOG SPECIFICATION`  
> **Data de Criação:** 01/10/2026  
> **Objetivo:** Guia completo de arquitetura, modelagem e telas para implementação da autonomia operacional completa do Administrador e do Domínio de Clientes em nova sessão/agente.

---

## 1. Visão Geral e Princípio de Projeto

O sistema atual da **Expedição Piraíba** possui regras transacionais sólidas (travas pessimistas contra overbooking, hold de 15 minutos, manifesto com sanitização CSV e consolidação de bebidas). No entanto, o painel administrativo opera com dados rígidos e formulários planos baseados em textos livres e listas estáticas.

O objetivo desta especificação é **tornar a plataforma 100% autônoma e modular do ponto de vista do Administrador**, antes de qualquer integração externa (como gateways de pagamento reais ou APIs de mensageria).

```text
Rio / Bacia Hidrográfica ──► Catálogo de Peixes do Rio
Pousada Parceira         ──► Comodidades Estruturadas & Barcos
Pacotes Templates        ──► All Inclusive & Bebidas Reutilizáveis
Loja de Tralhas          ──► Venda & Locação de Itens de Pesca
Perfil do Pescador       ──► CRM de Clientes (RGP, Histórico, Notas)
                                  │
                                  ▼
               CONSTRUTOR MODULAR DE EXPEDIÇÕES
               (Expedition Builder / Wizard Admin)
```

---

## 2. Pilar 1: Rios, Bacias Hidrográficas e Catálogo de Peixes por Rio

### 2.1. Problema Atual
A tabela `TargetSpecies` é plana e global. Todas as espécies cadastradas pertencem tacitamente ao Rio Araguaia. Se o organizador criar uma expedição em outro rio (ex: Rio Teles Pires, Rio Guaporé, Rio Trombetas), ele não consegue segmentar as espécies nativas correspondentes.

### 2.2. Modelagem de Dados (Backend Django)

```python
# apps/expeditions/models.py

class WaterBasin(models.TextChoices):
    TOCANTINS_ARAGUAIA = "TOCANTINS_ARAGUAIA", "Bacia Tocantins-Araguaia"
    AMAZONICA = "AMAZONICA", "Bacia Amazônica"
    PRATA = "PRATA", "Bacia do Prata / Paraguai"
    SAO_FRANCISCO = "SAO_FRANCISCO", "Bacia do São Francisco"


class River(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)  # Ex: "Rio Araguaia"
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    basin = models.CharField(max_length=40, choices=WaterBasin.choices, default=WaterBasin.TOCANTINS_ARAGUAIA)
    states = models.JSONField(default=list)  # Ex: ["MT", "GO", "TO"]
    description = models.TextField(blank=True)
    regulations = models.TextField(blank=True)  # Regras de cota zero, licenças estaduais exigidas
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class TargetSpecies(models.Model):
    class Category(models.TextChoices):
        COURO = "COURO", "Peixe de Couro"
        ESCAMA = "ESCAMA", "Peixe de Escama"

    slug = models.SlugField(max_length=60, primary_key=True)
    common_name = models.CharField(max_length=100)
    scientific_name = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.COURO)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)


class RiverSpecies(models.Model):
    river = models.ForeignKey(River, on_delete=models.CASCADE, related_name="river_species")
    species = models.ForeignKey(TargetSpecies, on_delete=models.PROTECT, related_name="rivers")
    is_native = models.BooleanField(default=True)
    is_trophy = models.BooleanField(default=False)  # Peixe troféu da região (ex: Piraíba > 2m)
    best_season = models.CharField(max_length=100, blank=True)  # Ex: "Junho a Outubro (águas baixas)"

    class Meta:
        constraints = [models.UniqueConstraint(fields=("river", "species"), name="unique_river_species")]
```

### 2.3. Endpoints da API de Operações
* `GET, POST /api/operations/rivers/` — Listar e criar rios.
* `GET, PATCH, DELETE /api/operations/rivers/<uuid:id>/` — Detalhes, atualização e exclusão lógica.
* `GET, POST /api/operations/rivers/<uuid:id>/species/` — Gerenciar catálogo de espécies do rio selecionado.

---

## 3. Pilar 2: Pousadas e Comodidades Modulares

### 3.1. Problema Atual
As comodidades da pousada são salvas em um array de strings editado via campo de texto livre separado por vírgulas. Não há padronização, ícones nem categorias de infraestrutura náutica e de hospedagem.

### 3.2. Modelagem de Dados

```python
# apps/expeditions/models.py

class AmenityCategory(models.TextChoices):
    FISHING_STRUCTURE = "FISHING_STRUCTURE", "Estrutura Náutica e Pesca"
    ROOM_COMFORT = "ROOM_COMFORT", "Acomodação e Conforto"
    LEISURE = "LEISURE", "Lazer e Bem-estar"
    GASTRONOMY = "GASTRONOMY", "Gastronomia e Bar"
    CONNECTIVITY = "CONNECTIVITY", "Conectividade e Apoio"


class Amenity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=30, choices=AmenityCategory.choices)
    icon_key = models.CharField(max_length=50, blank=True)  # Ex: "wifi", "snowflake", "ship", "waves"
    description = models.CharField(max_length=200, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("category", "name")


class Lodge(models.Model):
    # Campos existentes mantidos com vínculos estruturados:
    river = models.ForeignKey(River, on_delete=models.PROTECT, related_name="lodges", null=True, blank=True)
    amenities_structured = models.ManyToManyField(Amenity, through="LodgeAmenityLink", related_name="lodges", blank=True)
    boat_fleet_details = models.TextField(blank=True)  # Ex: "10 barcos de 6m com motor 40/50HP Mercury, cadeiras giratórias e rádio VHF"
    # ... demais campos: city, state, meeting_point, directions, cover_image_url
```

### 3.3. Catálogo Inicial de Comodidades Mestres (Seed)
* **Estrutura Náutica:** Barcos 6m Plataformados, Motores 40/50HP c/ Trim, Rádio VHF Integrado, Guias Nativos Homologados, Sala/Fábrica de Gelo Própria, Viveiro Climatizado de Iscas Vivas, Trapiche/Deck de Embarque Seguro.
* **Acomodação:** Suítes 100% Climatizadas (Ar Split), Chuveiro com Aquecimento Solar/Elétrico, Quartos Exclusivos para Casais, Camas Box, Limpeza e Arrumação Diária.
* **Conectividade & Apoio:** Starlink / Wi-Fi Alta Velocidade, Gerador de Energia de Emergência 24h, Pista de Pouso Homologada / Próxima, Transfer Próprio.
* **Lazer & Gastronomia:** Piscina c/ Cascata e Bar, Cozinha Regional Araguaiana, Kit Petiscaria e Ceviche no Rio.

---

## 4. Pilar 3: Pacotes Reutilizáveis (All Inclusive e Bebidas)

### 4.1. Problema Atual
Toda expedição nova exige que o administrador redigite as inclusões All Inclusive linha a linha e refaça a seleção das bebidas e quantidades padrão individualmente.

### 4.2. Modelagem de Dados

```python
# apps/expeditions/models.py

class AllInclusivePackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140, unique=True)  # Ex: "All Inclusive Padrão Araguaia", "VIP Casais"
    description = models.TextField(blank=True)
    inclusions = models.JSONField(default=list)  # Lista de strings oficiais de benefícios
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class BeveragePackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140, unique=True)  # Ex: "Open Bar Premium Cervejas & Refri", "Mix Sem Álcool"
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class BeveragePackageItem(models.Model):
    package = models.ForeignKey(BeveragePackage, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("expeditions.Product", on_delete=models.PROTECT, related_name="package_links")
    standard_quantity_per_participant = models.PositiveSmallIntegerField(default=1)
    display_order = models.PositiveSmallIntegerField(default=0)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("package", "product"), name="unique_package_product")]
```

### 4.3. Aplicação na Expedição
Ao criar ou editar uma `Expedition`:
* O administrador seleciona o `all_inclusive_package_id` e o `beverage_package_id`.
* O sistema pré-carrega as opções como base, permitindo que a expedição customize adições ou remoções sem alterar o template mestre.

---

## 5. Pilar 4: Módulo Comercial de Itens de Pesca (Venda e Locação de Tralhas)

### 5.1. Necessidade Operacional
Pescadores frequentemente enfrentam restrições de peso em voos para destinos remotos ou não possuem equipamentos de grande porte (como varas de 100 lb e carretilhas pesadas para peixes de mais de 2 metros). A locação de conjuntos e a venda de acessórios de apoio geram receita extra e solucionam atritos de viagem.

### 5.2. Modelagem de Dados

```python
# apps/expeditions/models.py

class GearCategory(models.TextChoices):
    HEAVY_ROD_REEL = "HEAVY_ROD_REEL", "Conjunto Pesado (Piraíba / Grandes Bagres)"
    MEDIUM_ROD_REEL = "MEDIUM_ROD_REEL", "Conjunto Médio (Pirarara / Tucunaré)"
    TERMINAL_TACKLE = "TERMINAL_TACKLE", "Acessórios e Terminais (Anzóis, Encastoados, Chumbadas)"
    APPAREL = "APPAREL", "Vestuário UV, Bonés e Proteção"
    SPECIALTY_BAIT = "SPECIALTY_BAIT", "Iscas Especiais e Atrativos"


class FishingGearProduct(models.Model):
    class Modality(models.TextChoices):
        RENTAL = "RENTAL", "Locação por Expedição"
        SALE = "SALE", "Venda Direta"
        BOTH = "BOTH", "Venda ou Locação"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)  # Ex: "Conjunto Piraíba Bruta 100-120 lb + Carretilha Penn/Shimano"
    category = models.CharField(max_length=30, choices=GearCategory.choices)
    modality = models.CharField(max_length=10, choices=Modality.choices, default=Modality.RENTAL)
    technical_specs = models.JSONField(default=dict, blank=True)  # {"libragem": "100-120 lb", "linha": "0.85mm 8 fios", "carretilha": "Perfil Alto"}
    rental_price_cents = models.PositiveIntegerField(default=0)  # Preço de locação para a viagem inteira
    sale_price_cents = models.PositiveIntegerField(default=0)    # Preço de venda definitiva
    inventory_quantity = models.PositiveSmallIntegerField(default=0)  # Estoque físico disponível na base
    image_url = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)


class ReservationGearAddon(models.Model):
    reservation = models.ForeignKey("reservations.Reservation", on_delete=models.CASCADE, related_name="gear_addons")
    participant = models.ForeignKey("reservations.ReservationParticipant", on_delete=models.CASCADE, related_name="gear_addons", null=True, blank=True)
    gear_product = models.ForeignKey(FishingGearProduct, on_delete=models.PROTECT, related_name="order_items")
    modality = models.CharField(max_length=10, choices=FishingGearProduct.Modality.choices)
    quantity = models.PositiveSmallIntegerField(default=1)
    unit_price_cents = models.PositiveIntegerField()
    total_price_cents = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### 5.3. Integração com a Operação
* **No Painel do Cliente / Ficha:** O pescador visualiza a seção *"Equipamentos de Pesca"* e pode adicionar conjuntos ou kits. O valor é somado ao total da reserva.
* **No Manifesto de Embarque:** Coluna ou seção dedicada com os equipamentos locados por participante para que a pousada e o piloteiro recebam os conjuntos revisados e montados no barco.

---

## 6. Pilar 5: Usuários Clientes Reais (Conta, Perfil e CRM)

### 6.1. Problema Atual
O cliente hoje é tratado de forma efêmera: existe apenas como uma chave estrangeira em `Reservation`. O administrador não possui uma tela no painel para listar clientes, buscar por histórico ou consultar dados salvos de licença de pesca.

### 6.2. Estrutura de Domínio Aprimorada

```python
# apps/customers/models.py

class CustomerProfile(models.Model):
    customer = models.OneToOneField("customers.Customer", on_delete=models.CASCADE, related_name="profile")
    rg = models.CharField(max_length=20, blank=True)
    rg_issuer = models.CharField(max_length=20, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    fishing_license_number = models.CharField(max_length=50, blank=True)  # Registro Geral de Pesca (RGP)
    fishing_license_expiry = models.DateField(null=True, blank=True)
    default_vest_size = models.CharField(max_length=10, blank=True)
    dietary_notes = models.TextField(blank=True)
    medical_notes = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=160, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    internal_admin_notes = models.TextField(blank=True)  # Anotações exclusivas do organizador
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 6.3. Painel do Administrador (`CustomersPanel` / CRM)
* **Lista Completa de Pescadores:** Tabela com busca por Nome, CPF, WhatsApp e Cidade.
* **Métricas por Cliente:** Total de viagens realizadas, valor acumulado pago (LTV), última viagem e status de cadastro de licença de pesca.
* **Gaveta de Detalhe do Cliente:** Histórico de todas as reservas passadas e futuras, duplas habituais de barco e anotações operacionais internas.

---

## 7. Pilar 6: O Novo Construtor Modular de Expedições (*Expedition Wizard*)

Ao cadastrar uma expedição no painel administrativo, o formulário simples atual é substituído por um fluxo guiado modular de 5 etapas:

```text
[ Etapa 1: Destino ] ──► Seleciona Rio (ex: Rio Araguaia) e Pousada (ex: Solar das Águas).
                         O sistema preenche automaticamente comodidades, coordenadas e direções.

[ Etapa 2: Espécies ] ──► O sistema carrega o Catálogo do Rio selecionado.
                         O admin apenas marca as espécies-alvo em destaque na data.

[ Etapa 3: Pacotes ] ──► Seleciona template All Inclusive (ex: Padrão Araguaia)
                         e Pacote de Bebidas (ex: Cervejas Premium).

[ Etapa 4: Tralhas ] ──► Vincula quais conjuntos de pesca estão disponíveis para locação.

[ Etapa 5: Vagas ]   ──► Define datas, capacidade total (ex: 12 vagas), preço e sinal (20%).
```

---

## 8. Roteiro Fatiado de Implementação (Roadmap para Próximo Agente)

Para executar a evolução sem regressões, o trabalho deve ser estruturado em 3 fases bem delimitadas:

### Fase A — Domínio Geográfico e Estrutural (Rios, Catálogo de Peixes e Pousadas Modulares)
1. Criar modelos `River` e `RiverSpecies` com migração de dados mantendo os 16 peixes do Araguaia vinculados ao primeiro rio.
2. Criar modelo `Amenity` com seed das comodidades mestres e migração de strings existentes de `Lodge.amenities`.
3. Criar endpoints administrativos correspondentes em `apps/operations/`.
4. Construir painel de gestão de Rios e remodelar `LodgesPanel` no frontend com seleção modular de comodidades.

### Fase B — Pacotes Reutilizáveis e Construtor de Expedições
1. Criar modelos `AllInclusivePackage`, `BeveragePackage` e `BeveragePackageItem`.
2. Criar telas no Admin para gerenciar esses templates de pacotes.
3. Refatorar `ExpeditionModal` para o **Expedition Builder Wizard**, conectando Rio, Pousada, Catálogo de Peixes e Pacotes.

### Fase C — Itens de Pesca (Tralhas) e CRM de Clientes
1. Criar modelos `FishingGearProduct` e `ReservationGearAddon`.
2. Adicionar aba *"Loja & Tralhas"* no painel do administrador para gestão de inventário de equipamentos.
3. Implementar `CustomerProfile` e criar o `CustomersPanel` (CRM de Pescadores) no Admin.
4. Integrar seleção de tralhas na jornada do cliente (`/minha-expedicao/`) e no Manifesto de Embarque.

---

## 9. Garantia de Retrocompatibilidade

* **Dados Atuais:** Nenhuma expedição existente de 2026 terá seus dados quebrados. A migração criará automaticamente o `River` "Rio Araguaia" e vinculará as 4 expedições oficiais de 2026 a ele.
* **Integridade Normativa:** Todos os testes unitários de concorrência e integridade existentes (`backend/apps/reservations/tests.py` e `backend/apps/payments/tests_concurrency.py`) devem continuar passando a cada fase.
