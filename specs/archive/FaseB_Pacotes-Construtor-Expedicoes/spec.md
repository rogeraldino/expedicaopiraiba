# Especificação Normativa — Fase B: Pacotes Reutilizáveis e Construtor de Expedições

> **Identificador Normativo:** `FASEB-PACOTES-CONSTRUTOR-EXPEDICOES`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Status:** `READY / IN_PROGRESS`<br/>
> **Data de Criação:** 01/10/2026<br/>
> **Aprovação de READY:** 01/10/2026 (Rodrigo)<br/>
> **Owner:** `specs/active/FaseB_Pacotes-Construtor-Expedicoes/spec.md`<br/>
> **Autoridade Competente:** Rodrigo<br/>
> **Base Normativa:** `docs/sdd/CONSTITUTION.md` §3, §4, §5, §6, §9; `specs/backlog/ESPECIFICACAO_SISTEMA_OPERACIONAL_MODULAR.md` (Pilar 3 e Pilar 6).

---

## 1. Visão Geral e Contexto do Negócio

Na Fase A, estruturou-se o domínio geográfico com `River`, `RiverSpecies`, `Amenity` e o desacoplamento das comodidades de `Lodge`.

Atualmente, ao cadastrar ou customizar uma expedição:
1. O organizador precisa redigitar manualmente a lista de inclusões (benefícios *All Inclusive* ou estrutura inclusa) linha a linha em campos de texto livre;
2. As bebidas oferecidas e as cotas padrão por participante precisam ser configuradas manualmente para cada viagem, sem templates reutilizáveis;
3. A criação de expedições no painel administrativo opera em um formulário monolítico e plano, desconectado do catálogo de peixes do rio e sem validação guiada de regras comerciais (ex: cálculo de sinal mínimo de 20%);
4. Viagens regulares (ex: turmas de pesca pesada) não devem ser engessadas em "All Inclusive com open bar de cerveja" obrigatório — apenas viagens de casais mantêm o formato 100% All Inclusive padrão, enquanto expedições normais devem permitir formatos onde bebidas podem ser personalizadas ou faturadas à parte.

A **Fase B** resolve esse atrito criando **templates canônicos de pacotes** e implementando o **Construtor Guiado de Expedições (*Expedition Wizard*)** em 4 etapas lógicas e validadas.

---

## 2. Escopo Normativo

1. **Modelagem de Pacotes All Inclusive Reutilizáveis:**
   - Criação da entidade `AllInclusivePackage` no backend (`apps/expeditions/models.py`);
   - Suporte a lista padronizada de inclusões em JSON (`inclusions: string[]`);
   - Controle de ativação/desativação e histórico.

2. **Modelagem de Pacotes de Bebidas e Cotas Padrão:**
   - Criação das entidades `BeveragePackage` e `BeveragePackageItem` com vínculo aos produtos de bebidas oficiais (`Product`);
   - Definição de quantidade padrão por pessoa (`standard_quantity_per_participant`) e ordenação;
   - Restrição de unicidade por produto dentro de cada pacote.

3. **Vínculo Opcional na Expedição (`Expedition`):**
   - Chaves estrangeiras opcionais `all_inclusive_package` e `beverage_package` em `Expedition` (`on_delete=models.SET_NULL`);
   - Herança de template: ao selecionar um pacote no Construtor, as inclusões e bebidas são pré-populadas como base na expedição, permitindo ajustes específicos sem contaminar o template mestre;
   - Preservação estrita das expedições existentes de 2026.

4. **APIs Operacionais Administrativas (`apps/operations/`):**
   - CRUD para pacotes All Inclusive (`/api/operations/all-inclusive-packages/`);
   - CRUD para pacotes de bebidas e itens (`/api/operations/beverage-packages/` e sub-recursos);
   - Endpoint de expedições integrado com os novos relacionamentos.

5. **Templates Canônicos Oficiais (Seed Inicial):**
   - **All Inclusive:**
     - *Estrutura Completa Regular (Sem Open Bar Alcoólico)*: foco em pesca de gigantes, pensão completa, combustível, iscas, sashimi no rio, água/refri/gelo, troféus;
     - *All Inclusive Casais VIP (Tudo Incluso)*: suíte casal, pensão completa regional, open bar premium (Stella e Corona), drinks, barco exclusivo e kit pôr do sol;
     - *All Inclusive Tradicional Araguaia*: pacote completo com open bar padrão de cervejas nacionais.
   - **Bebidas:**
     - *Open Bar Premium (Stella & Corona + Bebidas Suaves)*;
     - *Mix Cervejas Tradicionais & Especiais (Stella, Heineken, Original, Antarctica)*;
     - *Sem Álcool / Sob Demanda (Refrigerantes, Águas e Gelo)*.

6. **Construtor Guiado de Expedições (*Expedition Wizard*):**
   - Substituição do `ExpeditionModal` por modal em etapas no painel administrativo (`admin-panel.tsx`):
     - **Etapa 1: Destino & Pousada** (Seleção de Rio -> Pousadas do Rio; preenchimento automático de ponto de encontro e instruções; exibição de comodidades e barcos);
     - **Etapa 2: Espécies-Alvo do Rio** (Carregamento das espécies cadastradas no Rio selecionado; marcação das espécies presentes e flag prioritária/troféu);
     - **Etapa 3: Pacotes & Cardápio** (Seleção de template All Inclusive e Pacote de Bebidas com pré-carregamento editável);
     - **Etapa 4: Comercial & Vagas** (Nome da expedição, datas início/fim com validação de período, capacidade de vagas, preço total, validação de sinal mínimo de 20%, capa e resumo).

---

## 3. Não-Objetivos (Fora de Escopo)

1. Não alterar a tabela `Reservation`, algoritmo de hold concorrente de 15 minutos ou transações de checkout;
2. Não alterar a tabela `Payment` nem a idempotência de pagamentos/webhooks;
3. Não quebrar o contrato da API pública (`/api/expeditions/` e `/api/expeditions/<slug>/`), mantendo `inclusions` acessível;
4. Não implementar a gestão de locação/venda de tralhas de pesca nem o CRM de clientes (pertencentes à Fase C).

---

## 4. Modelagem de Dados Detalhada (Backend Django)

```python
# apps/expeditions/models.py

class AllInclusivePackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140, unique=True)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    description = models.TextField(blank=True)
    inclusions = models.JSONField(default=list)  # Lista de strings oficiais de benefícios
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


class BeveragePackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140, unique=True)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    description = models.TextField(blank=True)
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


class BeveragePackageItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    package = models.ForeignKey(BeveragePackage, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("expeditions.Product", on_delete=models.PROTECT, related_name="beverage_package_items")
    standard_quantity_per_participant = models.PositiveSmallIntegerField(default=1)
    display_order = models.PositiveSmallIntegerField(default=0)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ("display_order", "product__name")
        constraints = [
            models.UniqueConstraint(fields=("package", "product"), name="unique_beverage_package_product")
        ]

    def __str__(self):
        return f"{self.package.name} - {self.product.name} ({self.standard_quantity_per_participant}/pessoa)"
```

### Alterações no Modelo `Expedition`:
- Adição de `all_inclusive_package = models.ForeignKey(AllInclusivePackage, on_delete=models.SET_NULL, null=True, blank=True, related_name="expeditions")`;
- Adição de `beverage_package = models.ForeignKey(BeveragePackage, on_delete=models.SET_NULL, null=True, blank=True, related_name="expeditions")`;
- Preservação de `inclusions = models.JSONField(default=list)` para conter a lista real de benefícios ativos para a expedição.

---

## 5. Endpoints Operacionais

### All Inclusive Packages:
- `GET /api/operations/all-inclusive-packages/`: Lista todos os pacotes All Inclusive com filtro `active`;
- `POST /api/operations/all-inclusive-packages/`: Cria novo pacote;
- `GET /api/operations/all-inclusive-packages/<id>/`: Detalhes do pacote;
- `PATCH /api/operations/all-inclusive-packages/<id>/`: Atualização parcial;
- `DELETE /api/operations/all-inclusive-packages/<id>/`: Desativação lógica ou remoção se sem expedições associadas.

### Beverage Packages:
- `GET /api/operations/beverage-packages/`: Lista todos os pacotes de bebidas com contagem de itens e lista expandida;
- `POST /api/operations/beverage-packages/`: Cria novo pacote de bebidas com seus itens;
- `GET /api/operations/beverage-packages/<id>/`: Detalhes com itens e produtos;
- `PATCH /api/operations/beverage-packages/<id>/`: Atualização parcial do pacote e dos itens;
- `DELETE /api/operations/beverage-packages/<id>/`: Desativação lógica ou remoção.

### Expeditions Builder Support:
- `POST /api/operations/expeditions/`: Suporta os novos campos `all_inclusive_package_id`, `beverage_package_id`, e criação transacional de espécies associadas a partir do catálogo do rio;
- `PATCH /api/operations/expeditions/<id>/`: Atualização atômica dos dados da expedição no Wizard.

---

## 6. Matriz de Rastreabilidade e Critérios de Aceite

| ID Requisito | Descrição | Implementação Alvo | Critério de Aceite / Teste |
|---|---|---|---|
| **REQ-B01** | Modelagem de `AllInclusivePackage` | `backend/apps/expeditions/models.py` | Migração aplicada, CRUD de pacotes All Inclusive funcionando via API. |
| **REQ-B02** | Modelagem de `BeveragePackage` e `BeveragePackageItem` | `backend/apps/expeditions/models.py` | Relação e constraint de unicidade testadas; CRUD com produtos associados. |
| **REQ-B03** | Associação opcional em `Expedition` | `backend/apps/expeditions/models.py` | FKs criadas com `SET_NULL`, retrocompatibilidade 100% preservada para dados existentes. |
| **REQ-B04** | Seed de Templates Canônicos | Migração de dados / comando Django | 3 pacotes All Inclusive e 3 pacotes de bebidas criados e validados no banco de dados. |
| **REQ-B05** | Endpoints de Operações | `backend/apps/operations/views.py` | Suporte a autenticação Bearer, validações de payload e resposta estruturada. |
| **REQ-B06** | Seção "Pacotes & Bebidas" no Admin | `frontend/src/app/admin/admin-panel.tsx` | Visualização e gerenciamento dos pacotes All Inclusive e de bebidas. |
| **REQ-B07** | Construtor Wizard de Expedições | `frontend/src/app/admin/admin-panel.tsx` | Fluxo guiado em 4 etapas com pré-carregamento inteligente a partir de Rio, Pousada e Templates. |
| **REQ-B08** | Validação Comercial de Sinal | `admin-panel.tsx` / `serializers.py` | Sinal mínimo de 20% do valor total por pessoa exigido tanto no frontend quanto no backend. |
| **REQ-B09** | Não-Regressão Transacional | Testes de concorrência e checkout | 41+ testes automatizados passando; concorrência de hold inalterada. |
| **REQ-B10** | Dossiê Ponytail Independente | `specs/active/FaseB_Pacotes-Construtor-Expedicoes/ponytail.md` | Veredito PASS emitido por agente independente antes de ACCEPTED humano. |

---

## 7. Critérios de Conclusão (Definition of Done)

1. Modelos, migrações de schema e migrações de dados executadas com sucesso;
2. Testes de backend para pacotes All Inclusive, pacotes de bebidas e Expedition Wizard implementados e passando;
3. `make check-docs` e `git diff --check` sem erros;
4. Interface administrativa atualizada e testada ponta a ponta na porta 3000;
5. Grill adversarial executado e aprovado com status `READY` por Rodrigo;
6. Implementação finalizada e auditada por Ponytail independente com status `PASS`.
