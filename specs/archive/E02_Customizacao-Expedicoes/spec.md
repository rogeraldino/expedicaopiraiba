# Especificação Funcional e Técnica — Épica E02: Customização de Expedições & Cardápio Mestre

> **Identificador Normativo:** `E02-CUSTOMIZACAO-EXPEDICOES`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Status:** `ACCEPTED` (Aprovado formalmente por Rodrigo em 19/09/2026 às 16:06)<br/>
> **Data de Entrada em READY:** 19/09/2026<br/>
> **Data de Homologação / ACCEPTED:** 19/09/2026<br/>
> **Responsável Humano:** Rodrigo<br/>
> **Nota do Responsável Humano:** "Tralha está postergado mas também não é para ser desativado, apenas deixe-o como está. Pode dar ready e ir pro próximo passo." / Aceite formal: "aceito, faça o push de tudo pra continuarmos o trabalho em outra mauqina"

---

## 1. Contexto e Problema

O MVP Base (E01) garantiu a integridade transacional de vagas, pagamentos e compras consolidadas, porém a criação de expedições dependia de campos meramente textuais e o frontend consumia dados estáticos (fotos mapeadas por slug hardcoded, inclusões em texto fixo, destinos não estruturados).

Para que o stakeholder organize e publique expedições com autonomia no mundo real da pesca esportiva no Rio Araguaia, o sistema necessita desacoplar o destino em **Pousadas/Bases de Apoio reais**, associar as **espécies-alvo** da viagem, customizar as ofertas a partir de um **Cardápio Mestre de Bebidas** enxuto e gerenciar **mídias e fotos** dinamicamente.

---

## 2. Escopo e Não-Objetivos

### 2.1. O que ESTÁ no escopo (MUST)
1. **Entidade `Lodge` (Pousadas / Bases de Apoio):**
   - Cadastro estruturado de pousadas parceiras com nome, cidade/UF, trecho do rio, infraestrutura (Wi-Fi, piscina, ar-condicionado, quartos), ponto de encontro oficial e orientações de trajeto.
   - Vinculação da expedição a uma pousada/base ativa.
2. **Entidade `TargetSpecies` (Espécies-Alvo do Bioma):**
   - Catálogo das espécies nativas da bacia do Araguaia: Piraíba, Pirarara, Filhote/Bargada, Barbado, Jaú, Tucunaré Azul/Amarelo, Apapá e Bicuda.
   - Associação das espécies em destaque para cada expedição (com flag de espécie principal).
3. **Cardápio Mestre de Bebidas (Cervejas e Refrigerantes Pré-dispostos):**
   - Catálogo mestre no banco restrito exclusivamente às marcas oficiais acordadas:
     - Cervejas: Heineken, Original, Amstel e Heineken 0.0 (sem álcool).
     - Refrigerantes & Hidratação: Coca-Cola (normal e zero), Guaraná Antarctica (normal e zero), Água mineral sem gás e Água com gás.
   - O stakeholder ativa quais dessas bebidas serão oferecidas na expedição e define a alocação padrão (`standard_quantity_per_participant`).
4. **Mídia e Imagens Dinâmicas da Expedição:**
   - Campos no modelo `Expedition` para imagem de capa (`cover_image_url`) e galeria de fotos (`gallery_image_urls`).
   - Fim do mapa estático `expeditionImages[slug]` no frontend. Novas expedições renderizam sua própria imagem e galeria.
5. **Inclusões e Diferenciais Comerciais:**
   - Lista estruturada de itens inclusos (ex.: Combustível 100% incluso, Iscas vivas, Piloteiro nativo, Kit Sashimi, Open Bar, Torneio com troféus).
6. **Interface Administrativa (`/admin`):**
   - Gestão de Pousadas (criar, listar, editar).
   - Modal de Expedição atualizado com seleção de Pousada, espécies em destaque, URLs de mídia e inclusões.
7. **Integração no Frontend Público:**
   - Home (`/`) e Detalhes (`/expedicoes/[slug]`) consumindo dinamicamente a pousada, peixes, fotos e benefícios retornados pela API.

### 2.2. Não-Objetivos Explícitos (MUST NOT)
- **Tralhas e Equipamentos de Pesca:** Postergado formalmente. Não haverá cadastro, venda ou locação de varas, carretilhas ou iscas nesta épica (o checklist de viagem permanece focado apenas nos itens pessoais essenciais: documentos, licença de pesca embarcada, remédios, camisa UV, protetor solar).
- **Destilados e Insumos Extras:** Destilados, energéticos, vinhos e itens de churrasco permanecem descartados do catálogo de bebidas.
- **Venda Direta / Reserva Manual e Manifesto:** Reservado para a Épica E03.
- **Portal do Cliente e Login com CPF:** Reservado para a Épica E04.

---

## 3. Modelagem de Dados e Arquitetura

### 3.1. Modelo `Lodge` (`apps.expeditions.models`)
```python
class Lodge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160, unique=True)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)  # GO, MT, TO
    river_section = models.CharField(max_length=120)  # ex: Rio Araguaia, Rio das Mortes
    description = models.TextField(blank=True)
    amenities = models.JSONField(default=list, blank=True)  # ["Wi-Fi", "Piscina", "Ar-condicionado"]
    meeting_point = models.CharField(max_length=200, blank=True)
    directions = models.TextField(blank=True)
    cover_image_url = models.URLField(max_length=500, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 3.2. Modelo `TargetSpecies` (`apps.expeditions.models`)
```python
class TargetSpecies(models.Model):
    class Category(models.TextChoices):
        COURO = "COURO", "Peixe de Couro"
        ESCAMA = "ESCAMA", "Peixe de Escama"

    slug = models.SlugField(max_length=60, primary_key=True)
    common_name = models.CharField(max_length=100)
    scientific_name = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.COURO)
    active = models.BooleanField(default=True)
```

### 3.3. Modelo `ExpeditionSpecies` (`apps.expeditions.models`)
```python
class ExpeditionSpecies(models.Model):
    expedition = models.ForeignKey(Expedition, on_delete=models.CASCADE, related_name="expedition_species")
    species = models.ForeignKey(TargetSpecies, on_delete=models.PROTECT, related_name="expeditions")
    is_primary = models.BooleanField(default=False)
    display_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("expedition", "species"), name="unique_expedition_species")]
        ordering = ("-is_primary", "display_order")
```

### 3.4. Alterações no Modelo `Expedition`
```python
# Adicionar campos:
lodge = models.ForeignKey(Lodge, on_delete=models.PROTECT, related_name="expeditions", null=True, blank=True)
target_species = models.ManyToManyField(TargetSpecies, through=ExpeditionSpecies, related_name="expedition_targets")
cover_image_url = models.CharField(max_length=500, blank=True)
gallery_image_urls = models.JSONField(default=list, blank=True)
inclusions = models.JSONField(default=list, blank=True)
```

### 3.5. Cardápio Mestre Oficial no Modelo `Product`
A tabela `Product` será populada conservadoramente apenas com:
1. `Cerveja Heineken` (lata)
2. `Cerveja Original` (lata)
3. `Cerveja Amstel` (lata)
4. `Cerveja sem álcool (Heineken 0.0)` (lata)
5. `Refrigerante Coca-Cola` (lata)
6. `Refrigerante Coca-Cola Zero` (lata)
7. `Refrigerante Guaraná Antarctica` (lata)
8. `Refrigerante Guaraná Zero` (lata)
9. `Água sem gás` (garrafa)
10. `Água com gás` (garrafa)

Produtos obsoletos ou descontinuados fora dessa lista serão inativados (`active=False`).

---

## 4. Endpoints e Contratos de API

### 4.1. Endpoints Públicos
- `GET /api/expeditions/`:
  - Retorna a lista de expedições publicadas com dados da pousada vinculada (`lodge: { name, city, state }`), espécies em destaque (`target_species: [{ slug, common_name, is_primary }]`), `cover_image_url`, `gallery_image_urls` e `inclusions`.
- `GET /api/expeditions/{slug}/`:
  - Retorna o detalhe da expedição com todas as inclusões estruturadas, galeria de fotos completa e orientações de encontro da pousada.
- `GET /api/lodges/`:
  - Lista pousadas ativas com infraestrutura para exibição institucional.
- `GET /api/species/`:
  - Lista catálogo de espécies do bioma.

### 4.2. Endpoints Administrativos (`/api/operations/`)
- `GET, POST /api/operations/lodges/`:
  - Listagem e criação de pousadas parceiras.
- `GET, PATCH /api/operations/lodges/{id}/`:
  - Visualização e edição dos dados da pousada.
- `GET, POST /api/operations/expeditions/`:
  - Criação de expedição aceitando `lodge_id`, `species_slugs`, `cover_image_url`, `gallery_image_urls` e `inclusions`.
- `PATCH /api/operations/expeditions/{id}/`:
  - Atualização dos novos campos da expedição.
- `GET, PUT /api/operations/expeditions/{id}/configuration/`:
  - Seleção das bebidas ativas a partir do Cardápio Mestre e quantidade padrão por pessoa.

---

## 5. Critérios de Aceite (AC)

- **AC01 — Pousadas Estruturadas:** O stakeholder consegue criar e editar pousadas parceiras com cidade, UF, trecho do rio e amenidades no painel administrativo.
- **AC02 — Vínculo de Pousada:** Uma expedição pode ser vinculada a uma pousada parceira; ao salvar, as orientações de encontro e local de partida são preenchidos automaticamente se omitidos.
- **AC03 — Espécies-Alvo Selecionáveis:** O stakeholder pode escolher quais peixes do bioma são alvo da expedição e marcar quais são as espécies principais (destaque visual).
- **AC04 — Cardápio Mestre Enxuto:** O catálogo mestre de bebidas contém apenas as cervejas oficiais e refrigerantes pré-dispostos; a interface administrativa permite ativar/desativar cada bebida para a expedição e definir a cota padrão.
- **AC05 — Mídia Dinâmica sem Fallback Fixo:** Ao definir uma URL de imagem de capa na expedição, ela é renderizada na vitrine da Home e na página de detalhes, sem recorrer ao mapa estático hardcoded.
- **AC06 — Inclusões Comerciais Estruturadas:** A expedição exibe os itens inclusos configurados no banco de dados na página de detalhes.
- **AC07 — Migração e Compatibilidade com E01:** As expedições existentes de 2026 mantêm-se íntegras, com relacionamento criado para as pousadas Solar das Águas e Canaã e espécies associadas via migração de dados.
- **AC08 — Qualidade e Suíte de Testes:** Testes automatizados cobrindo os novos models, serializers, endpoints e checks do repositório (`lint`, `tsc`, `test`, `check-docs`).

---

## 6. Prova de Aceite e Matriz de Rastreabilidade

| Critério | Implementação Planejada | Teste Planejado |
|---|---|---|
| AC01 | `apps.expeditions.models.Lodge`, `OperationsLodgeView` | Teste CRUD de pousadas e restrições |
| AC02 | `Expedition.lodge`, `OperationsExpeditionSerializer` | Teste de vinculação e herança de instruções |
| AC03 | `apps.expeditions.models.TargetSpecies`, `ExpeditionSpecies` | Teste de associação e ordenação primária |
| AC04 | Refatoração de `Product`, `ExpeditionProduct` | Teste de filtragem do cardápio mestre e cálculo de compras |
| AC05 | `cover_image_url` em `Expedition` e componentes Next.js | Teste de serialização e build do frontend |
| AC06 | `inclusions` em `Expedition` e `expedicoes/[slug]/page.tsx` | Teste de renderização dinâmica |
| AC07 | Django Data Migration com seed das pousadas reais | `tests_migrations.py` e teste de integridade |
| AC08 | Suíte backend + checks de build | `make check-docs` e `python manage.py test` |
