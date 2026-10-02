# Especificação Funcional e Técnica — Fase A: Domínio Geográfico e Pousadas Modulares

> **Identificador Normativo:** `FASEA-DOMINIO-GEOGRAFICO-POUSADAS`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Status:** `READY` (Autorizado formalmente por Rodrigo em 01/10/2026 às 18:20)<br/>
> **Data de Entrada em READY:** 01/10/2026<br/>
> **Responsável Humano:** Rodrigo<br/>
> **Nota do Responsável Humano:** "Perfeuti, comece"<br/>
> **Origem / Backlog:** [ESPECIFICACAO_SISTEMA_OPERACIONAL_MODULAR.md](../../backlog/ESPECIFICACAO_SISTEMA_OPERACIONAL_MODULAR.md) (Pilares 1 e 2)

---

## 1. Contexto e Problema

O sistema atual da Expedição Piraíba possui o Rio Araguaia e seu catálogo de peixes definidos de maneira plana e tácita. Além disso, as pousadas parceiras (`Lodge`) armazenam suas comodidades em um array solto de strings (`amenities = ["Wi-Fi", "Piscina", ...]`) que no painel administrativo é editado como texto livre separado por vírgulas.

Isso gera problemas operacionais concretos:
1. **Falta de granularidade nas comodidades:** Pousadas diferentes têm estruturas distintas (ex.: a Pousada Solar das Águas tem piscina; a Pousada Canaã não tem; algumas possuem fábrica de gelo própria, enquanto outras recebem gelo ensacado). A falta de padronização induz erros e expectativas irreais para os pescadores.
2. **Impossibilidade de expansão geográfica:** Se o organizador quiser lançar expedições em outros rios da bacia amazônica ou do Araguaia (ex.: Rio Cristalino, Rio das Mortes, Rio Teles Pires), as espécies do rio ficavam misturadas no mesmo catálogo global.
3. **Falta de especificação náutica:** Pescadores precisam saber a motorização e os barcos utilizados (ex.: barcos plataformados de 6m com motor 40/50HP c/ trim e rádio VHF).

---

## 2. Escopo e Não-Objetivos

### 2.1. O que ESTÁ no escopo (MUST)

1. **Entidade `River` (Rios e Bacias Hidrográficas):**
   - Modelagem de rios com `id` (UUID), `name`, `slug`, `basin` (`TOCANTINS_ARAGUAIA`, `AMAZONICA`, `PRATA`, `SAO_FRANCISCO`), `states` (lista de UFs), `description`, `regulations` (cota zero, exigências de licença) e `active`.
2. **Entidade `RiverSpecies` (Catálogo de Peixes do Rio):**
   - Vínculo estruturado entre `River` e `TargetSpecies`, com flags `is_native`, `is_trophy` (peixe troféu, ex.: Piraíba > 2m) e `best_season` (época ideal, ex.: "Julho a Outubro").
3. **Entidade `Amenity` (Comodidades Estruturadas):**
   - Catálogo mestre categorizado:
     - `FISHING_STRUCTURE`: Estrutura Náutica e Pesca (motores com trim, rádio VHF, trapiche seguro, viveiro de iscas, fábrica de gelo própria opcional);
     - `ROOM_COMFORT`: Acomodação e Conforto (ar split, quartos privativos, chuveiro quente);
     - `LEISURE`: Lazer e Convivência (piscina, quiosque);
     - `GASTRONOMY`: Culinária e Apoio (restaurante regional, petiscaria no rio);
     - `CONNECTIVITY`: Conectividade e Logística (Wi-Fi Starlink, gerador de energia 24h, pista de pouso).
4. **Evolução de `Lodge`:**
   - Vínculo com `River` (`ForeignKey`);
   - Vínculo Many-to-Many com `Amenity` (`amenities_structured`);
   - Campo textual `boat_fleet_details` para detalhamento da frota de barcos e motores;
   - Propriedade de retrocompatibilidade para que `lodge.amenities` continue retornando a lista de strings para clientes legados sem quebras.
5. **Endpoints Administrativos de Operações (`apps/operations/`):**
   - CRUD de Rios: `GET, POST /api/operations/rivers/` e `GET, PATCH, DELETE /api/operations/rivers/<id>/`;
   - Gestão de espécies do rio: `GET, POST /api/operations/rivers/<id>/species/`;
   - Catálogo de comodidades: `GET /api/operations/amenities/`;
   - Atualização de `Lodge` aceitando `river_id` e lista de `amenity_ids`.
6. **Interface Administrativa (`/admin`):**
   - Nova aba/gestão de **Rios & Bacias** no painel;
   - Reformulação do `LodgeModal`: substituição da caixa de texto livre por seleção em checkboxes agrupados por categoria de comodidade, seleção do Rio e campo de frota náutica.
7. **Migração de Dados e Retrocompatibilidade Absoluta:**
   - Criação automática do `River` "Rio Araguaia";
   - Vinculação das 15 espécies reais do Araguaia ao Rio Araguaia via `RiverSpecies`;
   - Migração das comodidades em texto das pousadas existentes para as entidades estruturadas em `Amenity`;
   - Vinculação das pousadas existentes (Solar das Águas e Canaã) e das 4 expedições de 2026 ao Rio Araguaia.

### 2.2. O que NÃO ESTÁ no escopo (MUST NOT)

- **Templates de Pacotes de Bebidas e Construtor de Expedições (Wizard):** Reservado para a **Fase B**.
- **Loja e Locação de Tralhas de Pesca:** Reservado para a **Fase C**.
- **CRM e Perfil de Clientes:** Reservado para a **Fase C**.
- **Alteração nos fluxos de checkout, pagamento ou concorrência de reservas:** Preservados estritamente.

---

## 3. Modelagem de Dados Detalhada (Backend Django)

### 3.1. Modelo `River` e `WaterBasin` (`apps.expeditions.models`)
```python
class WaterBasin(models.TextChoices):
    TOCANTINS_ARAGUAIA = "TOCANTINS_ARAGUAIA", "Bacia Tocantins-Araguaia"
    AMAZONICA = "AMAZONICA", "Bacia Amazônica"
    PRATA = "PRATA", "Bacia do Prata / Pantanal"
    SAO_FRANCISCO = "SAO_FRANCISCO", "Bacia do São Francisco"


class River(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    basin = models.CharField(max_length=40, choices=WaterBasin.choices, default=WaterBasin.TOCANTINS_ARAGUAIA)
    states = models.JSONField(default=list, blank=True)  # Ex: ["MT", "GO", "TO"]
    description = models.TextField(blank=True)
    regulations = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
```

### 3.2. Modelo `RiverSpecies` (`apps.expeditions.models`)
```python
class RiverSpecies(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    river = models.ForeignKey(River, on_delete=models.CASCADE, related_name="river_species")
    species = models.ForeignKey(TargetSpecies, on_delete=models.PROTECT, related_name="rivers")
    is_native = models.BooleanField(default=True)
    is_trophy = models.BooleanField(default=False)
    best_season = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("river", "species"), name="unique_river_species")
        ]
        ordering = ("species__category", "species__common_name")
```

### 3.3. Modelo `Amenity` e `LodgeAmenityLink` (`apps.expeditions.models`)
```python
class AmenityCategory(models.TextChoices):
    FISHING_STRUCTURE = "FISHING_STRUCTURE", "Estrutura Náutica e Pesca"
    ROOM_COMFORT = "ROOM_COMFORT", "Acomodação e Conforto"
    LEISURE = "LEISURE", "Lazer e Bem-estar"
    GASTRONOMY = "GASTRONOMY", "Culinária e Bar"
    CONNECTIVITY = "CONNECTIVITY", "Conectividade e Apoio"


class Amenity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=30, choices=AmenityCategory.choices)
    icon_key = models.CharField(max_length=50, blank=True)
    description = models.CharField(max_length=200, blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("category", "display_order", "name")

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class LodgeAmenityLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lodge = models.ForeignKey(Lodge, on_delete=models.CASCADE, related_name="amenity_links")
    amenity = models.ForeignKey(Amenity, on_delete=models.CASCADE, related_name="lodge_links")
    is_highlight = models.BooleanField(default=False)
    custom_note = models.CharField(max_length=140, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("lodge", "amenity"), name="unique_lodge_amenity")
        ]
```

---

## 4. Matriz de Requisitos e Critérios de Aceite (DoD)

| ID | Requisito | Implementação Esperada | Prova / Evidência | Status |
| :--- | :--- | :--- | :--- | :---: |
| **AC01** | **Gestão de Rios** | Modelo `River`, endpoints `GET, POST, PATCH /api/operations/rivers/` com filtros por bacia e estado. | `test_river_crud_and_relational_protection` em `apps/operations/tests.py` + curl verificado. | `PASS` |
| **AC02** | **Catálogo de Peixes por Rio** | Modelo `RiverSpecies` com espécies vinculadas ao rio e flags `is_trophy`. | `test_river_species_association` em `apps/operations/tests.py` + 16 espécies vinculadas ao Araguaia. | `PASS` |
| **AC03** | **Comodidades Estruturadas** | Modelo `Amenity` com seed das categorias e vínculos em `Lodge`. | Migração 0008/0009 + `test_amenities_list_and_lodge_sync` + endpoint `/api/operations/amenities/`. | `PASS` |
| **AC04** | **Retrocompatibilidade de Pousadas** | Pousadas existentes de 2026 mantêm suas comodidades funcionando no frontend público sem quebra. | `curl /api/expeditions/` retorna `amenities` (lista de strings) e `amenities_detailed`; renderização validada em `/expedicoes/[slug]`. | `PASS` |
| **AC05** | **Frontend Admin de Pousadas** | Modal de pousada permite selecionar o Rio e marcar checkboxes categorizados de comodidades. | `RiversPanel` e `LodgeModal` em `admin-panel.tsx` + `next build` OK sem erros de compilação. | `PASS` |
| **AC06** | **Integridade Transacional** | Nenhuma alteração afeta os 38 testes de concorrência, hold e checkout. | Suíte completa executada: `Ran 41 tests in 15.721s — OK` em banco PostgreSQL real. | `PASS` |

---

## 5. Roteiro de Execução da Fase A

1. **Passo 1 (Backend - Modelos & Migrações):**
   - Criar `River`, `RiverSpecies`, `Amenity`, `LodgeAmenityLink` em `apps/expeditions/models.py`;
   - Criar migração de schema e migração de dados que cria o "Rio Araguaia", vincula as 15 espécies reais e migra as comodidades das pousadas Solar das Águas e Canaã;
   - Adicionar seed de comodidades canônicas no `seed_demo.py`.
2. **Passo 2 (Backend - Endpoints Administrativos):**
   - Criar serializers e views em `apps/operations/` para Rios e Comodidades;
   - Atualizar `LodgeSerializer` e endpoints de pousadas para expor e receber comodidades estruturadas e `river_id`.
3. **Passo 3 (Frontend - Painel Administrativo):**
   - Atualizar `LodgesPanel` e `LodgeModal` em `frontend/src/app/admin/admin-panel.tsx` com seleção do Rio e checkboxes categorizados;
   - Criar aba/seção de gerenciamento de Rios no Admin.
4. **Passo 4 (Frontend - Detalhes da Viagem & Vitrine):**
   - Exibir na página `/expedicoes/[slug]` o trecho/rio e as comodidades categorizadas com ícones.
5. **Passo 5 (Validação e Checkpoints):**
   - Executar suíte de testes Django, TypeScript, ESLint, `check_docs.py` e `git diff --check`.
