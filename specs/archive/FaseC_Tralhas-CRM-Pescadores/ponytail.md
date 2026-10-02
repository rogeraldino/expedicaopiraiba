# Dossiê de Auditoria Adversarial Independente (Ponytail)
## Fase C: Locação/Venda de Tralhas e CRM de Pescadores

```yaml
identificador_normativo: FASEC-TRALHAS-CRM-PESCADORES
documento_auditado: specs/active/FaseC_Tralhas-CRM-Pescadores/spec.md
grill_previo: specs/active/FaseC_Tralhas-CRM-Pescadores/grill.md
classificacao_risco: HIGH
status_ponytail: PASS — RECOMENDADO PARA ACEITE HUMANO (ACCEPTED)
data_auditoria: 2026-10-01
auditor_adversarial: Ponytail Auditor Subagent (Independente)
autoridade_competente: Rodrigo
base_normativa:
  - docs/sdd/CONSTITUTION.md (§1, §2, §3, §4, §5, §6, §8, §9)
  - docs/sdd/PLAYBOOK.md
  - specs/backlog/ESPECIFICACAO_SISTEMA_OPERACIONAL_MODULAR.md (Pilares 4 e 5)
  - specs/archive/FaseA_Dominio-Geografico-Pousadas/spec.md
  - specs/archive/FaseB_Pacotes-Construtor-Expedicoes/spec.md
```

---

### 1. Resumo Executivo e Escopo Auditado

Como Auditor Adversarial Independente (Ponytail), realizei uma auditoria exaustiva e rigorosa da implementação da **Fase C: Locação/Venda de Tralhas e CRM de Pescadores** (`FASEC-TRALHAS-CRM-PESCADORES`), confrontando o código entregue com as exigências normativas da especificação (`spec.md`), as decisões vinculantes do Grill adversarial prévio (`grill.md`) e a Constituição de Desenvolvimento (`CONSTITUTION.md`).

O escopo auditado compreende:
1. **Domínio e Modelagem de Dados:**
   - Modelo `FishingGearProduct` em `backend/apps/expeditions/models.py` com suporte a 5 categorias técnicas, 3 modalidades operacionais (`RENTAL`, `SALE`, `BOTH`), especificações técnicas em JSON e `CheckConstraint(condition=models.Q(inventory_quantity__gte=0), name="gear_inventory_non_negative")`;
   - Modelo `ReservationGearAddon` em `backend/apps/reservations/models.py` com chaves estrangeiras para reserva, participante opcional e produto de tralha, controle de modalidade, preços unitário e total, flag de entrega e notas;
   - Modelo `CustomerProfile` em `backend/apps/customers/models.py` vinculado 1:1 a `Customer`, com campos de RG, validade de licença RGP (`fishing_license_expiry`), propriedade calculada `has_valid_license`, tamanhos de colete, notas médicas/alimentares e observações internas confidenciais (`internal_admin_notes`).
2. **Migrações e Dados Oficiais Canônicos:**
   - Migração `customers/0003_customerprofile.py`;
   - Migração `expeditions/0012_fishinggearproduct.py`;
   - Migração `reservations/0010_reservationgearaddon.py`;
   - Migração de dados `expeditions/0013_seed_gear_products_and_customer_profiles.py` semeando os 4 produtos canônicos e populando profiles para clientes existentes.
3. **Serviços de Concorrência e Integridade Financeira:**
   - `backend/apps/reservations/services.py`:
     - Expansão da máquina de estados permitindo transição bidirecional `PAID <-> CONFIRMED`;
     - Função `recalculate_reservation_financials` com recálculo atômico imediato de `total_price_cents`, ajuste de `remaining_balance_cents`, transição de status de reserva e emissão de eventos auditados (`GEAR_ADDON_ADDED`, `GEAR_ADDON_REMOVED`);
     - Restituição de estoque e emissão do evento auditável `GEAR_INVENTORY_RESTORED` no cancelamento de reserva (`cancel_reservation`).
4. **API Operacional e Endpoints:**
   - `FishingGearProductListCreateView` e `DetailView` com salvaguarda `HTTP 409 Conflict` contra exclusão de produto com reservas ativas;
   - `ReservationGearAddonView` e `DetailView` com bloqueio pessimista `select_for_update`, validação estrita de estoque físico, decremento atômico e endpoint de entrega `PATCH` e remoção `DELETE` com devolução de estoque;
   - `CustomerListView` e `DetailView` com cálculo matemático exato de LTV e total de viagens via Subqueries SQL, busca multifatorial e isolamento de campos;
   - `ExpeditionManifestView` e `ExpeditionManifestCsvView` enriquecidos com resumo agregado de tralhas para a pousada (`gear_summary`) e detalhamento nominal por participante.
5. **Auditoria de Privacidade e Segurança:**
   - Segregação de serializers garantindo que `internal_admin_notes` jamais seja exposto a clientes ou convidados;
   - Verificação de ausência de vazamento nas rotas do Portal do Cliente e link de convidado (`/api/me/guest/<token>/`).
6. **Interface do Painel Administrativo:**
   - Abas *"Tralhas & Loja"* (`GearPanel`/`GearModal`) e *"CRM Pescadores"* (`CustomersPanel`/`CustomerModal`) em `frontend/src/app/admin/admin-panel.tsx`;
   - Box de tralhas com toggle de entrega no `ReservationDrawer`;
   - Modal `AddGearAddonModal` com cálculo em tempo real e aviso de impacto financeiro;
   - ManifestPanel com card consolidado de tralhas e coluna na prancha de embarque.
7. **Validação Automatizada de Testes:**
   - 52 testes executados contra PostgreSQL real em contêineres Docker, todos aprovados com 100% de sucesso (0 erros, 0 falhas).

---

### 2. Matriz de Verificação de Requisitos e Evidências Técnicas

| Requisito | Descrição Normativa | Evidência Técnica Auditada | Avaliação Ponytail |
|---|---|---|---|
| **REQ-C01** | Modelagem `FishingGearProduct` | `backend/apps/expeditions/models.py:344-381`<br/>Suporte a `GearCategory` (5 escolhas), `Modality` (RENTAL, SALE, BOTH), `technical_specs` (JSONField), `rental_price_cents`, `sale_price_cents`, `inventory_quantity` com `CheckConstraint(inventory_quantity__gte=0)`. | **CONFORME** |
| **REQ-C02** | Seed de Equipamentos Oficiais | `backend/apps/expeditions/migrations/0013_seed_gear_products_and_customer_profiles.py`<br/>Criação canônica dos 4 itens (Conjunto Pesado 100-120 lb R$ 350, Conjunto Médio 60-80 lb R$ 250, Kit Terminal Aço R$ 120, Camisa UV R$ 180) e criação de profiles para clientes existentes. | **CONFORME** |
| **REQ-C03** | Modelagem `ReservationGearAddon` | `backend/apps/reservations/models.py:153-175`<br/>FK para reserva (CASCADE), FK opcional para participante (SET_NULL), FK para produto (PROTECT), `modality`, `quantity`, `unit_price_cents`, `total_price_cents`, `delivered`. Recálculo atômico em `services.py`. | **CONFORME** |
| **REQ-C04** | Modelagem `CustomerProfile` | `backend/apps/customers/models.py:43-76`<br/>1:1 com `Customer`, campos civis, RGP, `fishing_license_expiry`, propriedade `has_valid_license` comparando com `timezone.localdate()`, vest size, notas de saúde e `internal_admin_notes`. | **CONFORME** |
| **REQ-C05** | Endpoints de Tralhas e Estoque | `backend/apps/operations/views.py:957-1155`<br/>CRUD completo, validação pessimista `select_for_update()`, verificação de saldo de estoque, decremento e incremento atômicos, retorno `HTTP 409 Conflict` na tentativa de exclusão com reservas ativas. | **CONFORME** |
| **REQ-C06** | Endpoints de CRM de Clientes | `backend/apps/operations/views.py:1157-1281`<br/>Listagem com Subquery de LTV somando pagamentos `PAID` de reservas não-canceladas, contagem de expedições, busca textual, filtro `has_license` e PATCH atômico do perfil e anotações. | **CONFORME** |
| **REQ-C07** | Seção "Tralhas & Loja" no Admin | `frontend/src/app/admin/admin-panel.tsx:3872-4308`<br/>`GearPanel` com KPIs de estoque, busca, filtros de categoria e modalidade, badges coloridos de estoque (crítico/baixo/normal) e `GearModal` com validação de JSON e valores monetários. | **CONFORME** |
| **REQ-C08** | Seção "CRM de Pescadores" no Admin | `frontend/src/app/admin/admin-panel.tsx:4309-4828`<br/>`CustomersPanel` com métricas consolidadas (LTV médio, % RGP válida), tabela detalhada e `CustomerModal` completo com 4 seções estruturadas e anotações internas protegidas. | **CONFORME** |
| **REQ-C09** | Integração no Manifesto e Drawer | `frontend/src/app/admin/admin-panel.tsx:392-453, 3761-3850, 4830-5047`<br/>Card `gear_summary` para a pousada, coluna "Tralhas & Loja" no manifesto com indicação de entrega, e box com toggle e botão de aluguel/venda no drawer de reserva. | **CONFORME** |
| **REQ-C10** | Dossiês Grill e Ponytail | `specs/active/FaseC_Tralhas-CRM-Pescadores/grill.md` e `ponytail.md`<br/>Grill independente com parecer formal `PASS` pré-código e Ponytail independente com auditoria adversarial exaustiva pós-código. | **CONFORME** |

---

### 3. Avaliação de Concorrência, Integridade Financeira e Salvaguardas Normativas

#### 3.1. Transição Bidirecional da Máquina de Estados (`PAID <-> CONFIRMED`)
* **Verificação no Código (`backend/apps/reservations/services.py:18`):**
  O mapeamento `ALLOWED_TRANSITIONS` agora inclui expressamente `Reservation.Status.CONFIRMED` dentro do conjunto de transições de `Reservation.Status.PAID`:
  ```python
  Reservation.Status.PAID: {Reservation.Status.CONFIRMED, Reservation.Status.CANCELLED, Reservation.Status.REFUNDED}
  ```
* **Recálculo Financeiro Atômico (`services.py:61-110`):**
  A função `recalculate_reservation_financials`:
  1. Soma o valor dos addons ativos (`addons_total = reservation.gear_addons.aggregate(total=Sum("total_price_cents"))["total"] or 0`);
  2. Atualiza `reservation.total_price_cents = (unit_price_cents * participant_count) + addons_total`;
  3. Ao detectar `reservation.status == PAID` e `remaining_balance_cents > 0`, transiciona automaticamente para `CONFIRMED`, gerando o evento `GEAR_ADDON_ADDED`;
  4. Ao detectar `reservation.status == CONFIRMED` e `remaining_balance_cents == 0` (após exclusão de addon), transiciona de volta para `PAID`, gerando o evento `GEAR_ADDON_REMOVED`.
* **Validação em Teste:** O teste automatizado `test_reservation_gear_addon_financial_recalculation_and_state_transition` comprova na prática o ciclo de transição `PAID -> CONFIRMED -> PAID` sem erros ou descompassos contábeis.

#### 3.2. Prevenção de Estoque Negativo e Travas de Linha
* **Trava Pessimista em Banco:** Tanto na adição (`ReservationGearAddonView.post`) quanto na exclusão (`ReservationGearAddonDetailView.delete`), a linha do produto de tralha é bloqueada via:
  ```python
  gear_product = FishingGearProduct.objects.select_for_update().get(id=gear_product_id)
  ```
* **Constraint Relacional:** No modelo `FishingGearProduct`, a restrição `CheckConstraint(condition=models.Q(inventory_quantity__gte=0), name="gear_inventory_non_negative")` impede no nível de motor SQL que qualquer anomalia de aplicação cause overbooking ou estoque negativo.
* **Validação em Teste:** O teste `test_reservation_gear_addon_stock_and_concurrency` verifica o decremento de estoque, a rejeição com `HTTP 400 Bad Request` quando o pedido excede o disponível e a restituição instantânea após cancelamento/exclusão.

#### 3.3. Restituição de Estoque no Cancelamento da Reserva
* **Verificação no Código (`backend/apps/reservations/services.py:43-56`):**
  Na rotina `transition_locked_reservation`, quando a reserva transiciona para `CANCELLED`, o sistema itera sobre `reservation.gear_addons.select_related("gear_product")`, incrementa o estoque via `F("inventory_quantity") + addon.quantity` e emite um `ReservationEvent` com `event_type="GEAR_INVENTORY_RESTORED"`.
* **Validação em Teste:** O teste `test_reservation_cancellation_restores_gear_stock` comprova que a anulação da reserva devolve 100% das tralhas ao inventário.

---

### 4. Auditoria de Privacidade e Segurança (Isolamento de `internal_admin_notes`)

* **Análise de Serializers Públicos:**
  Os serializers do Portal do Cliente e link de convidado (`CustomerParticipantSerializer` em `backend/apps/reservations/customer_serializers.py`) operam estritamente sobre os campos civis de `ReservationParticipant` (`full_name`, `cpf`, `birth_date`, `phone`, `emergency_contact_name`, `emergency_contact_phone`, `vest_size`, `health_notes`, `operational_notes`).
* **Análise de Serializers Administrativos:**
  O campo `internal_admin_notes` está presente **estrita e exclusivamente** em `CustomerProfileSerializer` (`backend/apps/operations/serializers.py`), consumido unicamente por administradores autenticados via token de operação.
* **Teste Negativo de Não-Vazamento:**
  O teste `test_crm_internal_admin_notes_privacy_never_leaks_to_guest_or_public` foi inspecionado e executado:
  1. Cria um cliente com `internal_admin_notes = "SEGREDO DE ESTADO OPERACIONAL: NÃO EXIBIR AO CLIENTE!"`;
  2. Consulta a view administrativa `/api/operations/customers/<id>/` e valida a presença da nota;
  3. Gera um token assinado de convidado (`create_guest_participant_token`) e consulta o endpoint público `/api/me/guest/<token>/`;
  4. Executa asserções negativas explícitas:
     - `self.assertNotIn("internal_admin_notes", guest_payload_str)`
     - `self.assertNotIn("SEGREDO DE ESTADO", guest_payload_str)`.
* **Resultado:** Aprovação inequívoca. Risco de vazamento de anotações internas classificado como **ZERO**.

---

### 5. Auditoria de Frontend (Painel do Organizador `/admin`)

1. **Aba "Tralhas & Loja" (`GearPanel` e `GearModal`):**
   - KPI Cards com total de itens, estoque geral, produtos de locação e produtos de venda;
   - Filtros dinâmicos por categoria técnica e modalidade comercial;
   - Tabela com formatação de moeda em Real (R$), indicadores visuais de criticidade de estoque (vermelho para esgotado, amarelo para <= 3, verde para adequado) e botões de ação com confirmação;
   - Modal com parsing seguro de JSON para especificações técnicas e conversão instantânea de Reais para centavos inteiros.
2. **Aba "CRM Pescadores" (`CustomersPanel` e `CustomerModal`):**
   - KPI Cards exibindo quantidade de pescadores, percentual com licença RGP válida e LTV médio;
   - Tabela com busca em tempo real por CPF, telefone, e-mail e cidade;
   - Modal detalhado estruturado em 4 blocos visuais distintos:
     - Documentos & RGP (com campo de data e número com máscara monoespaçada);
     - Saúde & Emergência (restrições alimentares e notas médicas);
     - Histórico de Reservas (expedição, datas, quantidade de tralhas, valor total e status);
     - Anotações Internas da Operação em caixa destacada com borda âmbar, ícone de escudo e aviso de confidencialidade estrita.
3. **Box de Tralhas no Drawer de Reservas (`ReservationDrawer` & `AddGearAddonModal`):**
   - Exibição de tralhas contratadas com vínculo nominal de participante;
   - Botão para alternância do status de entrega na pousada (`Entregue` vs `Pendente`);
   - Botão de exclusão com restauração de estoque e recálculo do saldo em aberto;
   - Modal de adição com seletor de produto ativo, modalidade, cálculo em tempo real do acréscimo financeiro e aviso explicativo sobre o impacto contábil.
4. **Manifesto Oficial de Embarque (`ManifestPanel`):**
   - Card superior consolidado de tralhas (`gear_summary`) pronto para impressão e envio ao piloteiro da pousada;
   - Coluna dedicada "Tralhas & Loja" na prancheta de passageiros com checkmark visual verde para equipamentos conferidos e entregues na base;
   - Sanitização no CSV contra Formula Injection mantida através de `safe_csv()`.
5. **Tipagem e Build:** Compilação do contêiner Docker `frontend` completada com sucesso (Next.js standalone build sem erros de TypeScript).

---

### 6. Execução e Evidências dos Gates de Validação

Todos os checkpoints do Playbook e da Constituição foram executados com sucesso:

```bash
# 1. Suíte Completa de Testes do Backend (PostgreSQL real)
docker compose exec backend python manage.py test
# Resultado: Ran 52 tests in 33.264s — OK (0 falhas, 0 erros)

# 2. Verificação de Migrações Django Pendentes
docker compose exec backend python manage.py makemigrations --check
# Resultado: No changes detected

# 3. Verificação de Build do Frontend (Next.js & TypeScript)
docker compose build frontend
# Resultado: ✔ Image expedicaopiraiba-frontend Built 58.1s (0 erros)

# 4. Verificação de Governança Documental
python3 scripts/check_docs.py
# Resultado: documentação válida: 10 owners normativos

# 5. Verificação de Git Whitespace e Diffs
git diff --check
# Resultado: 0 erros, saída limpa
```

---

### 7. Veredito Final Ponytail

> **VEREDITO DO AUDITOR PONYTAIL:** **PASS**
>
> A implementação da **Fase C: Locação/Venda de Tralhas e CRM de Pescadores** (`FASEC-TRALHAS-CRM-PESCADORES`) cumpre integralmente os requisitos da especificação, todas as decisões vinculantes do Grill adversarial e as cláusulas pétreas da Constituição de Desenvolvimento.
>
> Não foram detectadas regressões financeiras, vulnerabilidades de privacidade nas anotações internas de pescadores, riscos de concorrência ou fragilidades de estoque físico.
>
> O sistema encontra-se formalmente apto e recomendado para o **ACEITE HUMANO (`ACCEPTED`) por Rodrigo**.

---
*Dossiê emitido pelo Auditor Adversarial Independente (Ponytail) em 01/10/2026.*
