# Dossiê de Revisão Adversarial Independente (Grill / Counsel)
## Especificação da Fase C: Locação/Venda de Tralhas e CRM de Pescadores

```yaml
identificador_normativo: FASEC-TRALHAS-CRM-PESCADORES
documento_auditado: specs/active/FaseC_Tralhas-CRM-Pescadores/spec.md
classificacao_risco: HIGH
status_grill: GRILL_COMPLETE — RECOMENDADO PARA READY HUMANO
data_revisao: 2026-10-01
revisor_adversarial: Grill / Counsel Subagent (Independente)
autoridade_competente: Rodrigo
base_normativa:
  - docs/sdd/CONSTITUTION.md (§1, §2, §3, §4, §5, §6, §8, §9)
  - docs/sdd/PLAYBOOK.md
  - specs/backlog/ESPECIFICACAO_SISTEMA_OPERACIONAL_MODULAR.md (Pilares 4 e 5)
  - specs/archive/FaseA_Dominio-Geografico-Pousadas/spec.md
  - specs/archive/FaseB_Pacotes-Construtor-Expedicoes/spec.md
```

---

### 1. Sumário Executivo do Grill

A especificação da **Fase C** (`specs/active/FaseC_Tralhas-CRM-Pescadores/spec.md`) propõe a implantação de duas frentes operacionais e comerciais de alto impacto para a Expedição Piraíba:
1. **Locação e Venda de Tralhas Pesadas (`FishingGearProduct` e `ReservationGearAddon`):** Catálogo de equipamentos para pesca de gigantes (conjuntos pesados de 100-120 lb, médios para pirarara, vestuário UV e kits de aço com anzóis circulares) e vinculação transacional e auditada às reservas;
2. **CRM e Perfil Estruturado do Pescador (`CustomerProfile`):** Centralização de dados civis, Registro Geral de Pesca (RGP), tamanhos de colete, histórico médico/alimentar, métricas de LTV (Lifetime Value) e anotações operacionais confidenciais do organizador Rodrigo.

Como revisor adversarial independente (Grill / Counsel), examinei rigorosamente a especificação técnica, os modelos de domínio existentes (`apps/expeditions/models.py`, `apps/reservations/models.py`, `apps/customers/models.py`, `apps/payments/models.py`), a máquina de estados e serviços financeiros (`apps/reservations/services.py`, `apps/payments/services.py`), a proteção de privacidade e segurança no Portal do Cliente e link de convidados (`apps/reservations/customer_views.py`), os relatórios operacionais do Manifesto de Embarque (`apps/operations/views.py`) e a suíte completa de 44 testes em execução.

O presente dossiê estabelece **decisões normativas vinculantes** que sanam todas as lacunas técnicas e de concorrência antes da autorização de codificação (`READY`).

---

### 2. Análise Crítica e Perguntas Adversariais Normativas

---

#### Grupo 1: Concorrência e Integridade Financeira dos Addons de Tralha (`ReservationGearAddon`)

##### Pergunta 1.1: O que acontece se a reserva já tiver sido 100% paga (`status == PAID`)? Como o saldo remanescente e o status da reserva reagem?
* **Ataque / Risco:** No código atual (`backend/apps/reservations/services.py`), a tabela de transições permitidas estabelece:
  ```python
  ALLOWED_TRANSITIONS[Reservation.Status.PAID] = {
      Reservation.Status.CANCELLED,
      Reservation.Status.REFUNDED,
  }
  ```
  Se uma reserva quitada (R$ 5.000 pagos em um total de R$ 5.000) receber um addon de tralha no valor de R$ 350, o `total_price_cents` sobe para R$ 5.350. Como resultado:
  - `paid_amount_cents` = R$ 5.000;
  - `remaining_balance_cents` = R$ 350.
  Se o status permanecer `PAID`, há uma incoerência financeira grave (uma reserva que deve R$ 350 figura como "Paga" nos relatórios). Pior: se o cliente tentar pagar esse saldo via PIX (`create_balance_payment`) e o webhook de confirmação disparar `process_paid_event()`, este tentará transicionar a reserva para `CONFIRMED` (pois `paid_amount_cents < total_price_cents`), disparando uma exceção fatal:
  `ValidationError("Transição de PAID para CONFIRMED não permitida.")`.
* **Decisão Normativa Definitiva:**
  1. **Expansão da Máquina de Estados:** `ALLOWED_TRANSITIONS[Reservation.Status.PAID]` DEVE incluir explicitamente `Reservation.Status.CONFIRMED`.
  2. **Transição Automática ao Acrescentar Tralhas:** Ao adicionar ou atualizar um `ReservationGearAddon` em uma reserva com status `PAID`, se o novo `remaining_balance_cents > 0`, a reserva DEVE transicionar de `PAID` para `CONFIRMED`, registrando um `ReservationEvent`:
     - `event_type = "GEAR_ADDON_ADDED"`
     - `previous_status = "PAID"`
     - `new_status = "CONFIRMED"`
     - `reason = "Acréscimo de tralhas com saldo em aberto."`
     - `payload = {"addon_id": str(addon.id), "total_price_cents": reservation.total_price_cents, "remaining_balance_cents": reservation.remaining_balance_cents}`.
  3. **Transição Automática ao Remover Tralhas:** Ao excluir um `ReservationGearAddon`, se `paid_amount_cents >= total_price_cents` e a reserva estiver com status `CONFIRMED`, ela DEVE transicionar atômica e imediatamente para `PAID`, registrando `ReservationEvent(event_type="GEAR_ADDON_REMOVED", previous_status="CONFIRMED", new_status="PAID")`.
  4. **Preservação do Sinal (`deposit_cents`):** O acréscimo de tralhas altera estritamente `total_price_cents` e `remaining_balance_cents`. O valor de `deposit_cents` (que representa a caução contratual mínima de vagas calculada no ato da reserva) **NÃO DEVE** ser recalculado retroativamente.
  5. **Bloqueio de Estados Mortos:** É expressamente proibido (`HTTP 409 Conflict`) adicionar tralhas a reservas com status `CANCELLED`, `EXPIRED` ou `REFUNDED`.

##### Pergunta 1.2: Como é garantido que o estoque físico (`inventory_quantity`) não fique negativo sob concorrência e condições de corrida?
* **Ataque / Risco:** Suponha que existam apenas 2 conjuntos pesados de Piraíba disponíveis na base (`inventory_quantity = 2`). Dois operadores simultâneos no `/admin` (ou um operador e um fluxo automatizado) tentam alugar 2 conjuntos para reservas distintas no mesmo milissegundo. Sem travas adequadas, ambos leem estoque 2, debitam 2, e o estoque atinge -2, gerando overbooking de equipamentos e conflito insolúvel na beira do rio.
* **Decisão Normativa Definitiva:**
  1. **Row-Level Locking Pessimista:** Toda mutação de estoque em `FishingGearProduct` DEVE ocorrer dentro de bloco `@transaction.atomic` com trava de linha:
     ```python
     gear = FishingGearProduct.objects.select_for_update().get(id=gear_product_id)
     ```
  2. **Validação Estrita:** Antes de debitar:
     ```python
     if gear.inventory_quantity < requested_quantity:
         raise ValidationError(f"Estoque insuficiente para o produto {gear.name}. Disponível: {gear.inventory_quantity}.")
     ```
  3. **Constraint no Nível de Banco de Dados:** O modelo `FishingGearProduct` DEVE possuir uma `CheckConstraint` relacional nativa:
     ```python
     CheckConstraint(
         check=models.Q(inventory_quantity__gte=0),
         name="gear_inventory_non_negative"
     )
     ```
     Essa restrição garante que, mesmo sob falhas de aplicação ou scripts manuais, o banco de dados rejeitará qualquer operação que resulte em estoque negativo.
  4. **Atualização Atômica:** O decremento deve utilizar `gear.inventory_quantity = F("inventory_quantity") - requested_quantity` (ou decremento em memória logo após `select_for_update`) seguido de persistência imediata.

##### Pergunta 1.3: Como cancelamentos de reservas ou remoções de addons lidam com a devolução de estoque e auditoria (`ReservationEvent`)?
* **Ataque / Risco:** Se um operador remover um addon ou cancelar uma reserva inteira e a rotina não devolver o estoque à base, cria-se um déficit artificial ("estoque fantasma retido"). Além disso, se o equipamento já tiver sido fisicamente entregue ao pescador na pousada (`delivered=True`), uma exclusão no sistema sem conferência física pode ocultar extravio de tralhas de alto valor.
* **Decisão Normativa Definitiva:**
  1. **Remoção de Addon Individual (`DELETE /api/operations/reservations/<id>/gear-addons/<addon_id>/`):**
     - Trava a reserva, o addon e o `FishingGearProduct` com `select_for_update()`;
     - Incrementa o estoque do produto: `product.inventory_quantity += addon.quantity`;
     - Subtrai o valor do addon de `reservation.total_price_cents`;
     - Ajusta a máquina de estados (`CONFIRMED -> PAID` se quitado);
     - Apaga o registro de `ReservationGearAddon`;
     - Registra em `ReservationEvent`:
       `event_type = "GEAR_ADDON_REMOVED"` com payload contendo `addon_id`, `product_id`, `product_name`, `quantity` e `restored_inventory`.
  2. **Cancelamento da Reserva Inteira (`CANCELLED`):**
     - O serviço de transição/cancelamento de reservas (`transition_locked_reservation`) DEVE ser auditado e adaptado: ao transicionar para `CANCELLED`, ele DEVE verificar se a reserva possui `gear_addons.all()`.
     - Para cada addon ativo, efetua `select_for_update()` no respectivo `FishingGearProduct`, devolve a quantidade ao estoque (`product.inventory_quantity += addon.quantity`) e registra o rastro de devolução no histórico de auditoria `ReservationEvent(event_type="GEAR_INVENTORY_RESTORED")`.
  3. **Salvaguarda de Tralhas Já Entregues (`delivered=True`):**
     - Se `addon.delivered == True`, o endpoint de exclusão DEVE exigir um parâmetro explícito `confirm_delivered_return=True` ou rejeitar a requisição com `HTTP 409 Conflict`, instruindo o operador: *"O equipamento já foi marcado como entregue na base. Confirme o recolhimento físico antes da remoção contábil."*

---

#### Grupo 2: Isolamento de Privacidade e Segurança no CRM (`CustomerProfile`)

##### Pergunta 2.1: Como garantir que as anotações operacionais internas (`internal_admin_notes`) NUNCA vazem para a API pública, Portal do Cliente ou link de convidado?
* **Ataque / Risco:** O campo `internal_admin_notes` destina-se a observações confidenciais do organizador Rodrigo sobre o comportamento e histórico de pescadores (ex.: *"Pescador agressivo com piloteiro"*, *"Consome muita bebida alcoólica"*, *"Amigo íntimo do proprietário da pousada — conceder barco novo"*). O vazamento acidental dessas notas no endpoint `/api/me/`, na ficha web do convidado ou no checkout destruiria a reputação da Expedição Piraíba e violaria frontalmente a LGPD (Lei 13.709/2018).
* **Decisão Normativa Definitiva:**
  1. **Segregação Estrita de Serializers:**
     - O campo `internal_admin_notes` DEVE constar **EXCLUSIVAMENTE** em serializers do painel administrativo (`apps/operations/serializers.py`), especificamente em `AdminCustomerProfileSerializer` e `AdminCustomerDetailSerializer`.
     - Os serializers públicos e voltados ao cliente (`CustomerParticipantSerializer`, `CustomerReservationSerializer`, `CustomerGuestSerializer` em `apps/reservations/customer_serializers.py`) **NÃO DEVEM** conter o campo `internal_admin_notes` nem importar o `CustomerProfile` irrestrito.
  2. **Controle de Autorização nas Views:**
     - O endpoint `GET/PATCH /api/operations/customers/<id>/` DEVE ser protegido por `OperationsAuthentication` com checagem de token de administrador ativo.
  3. **Teste Adversarial de Não-Vazamento:**
     - A suíte de testes DEVE conter um teste negativo obrigatório (`test_internal_admin_notes_never_leak_to_customer_or_guest`) que simula login no Portal do Cliente e acesso ao link de convidado, realizando asserções estritas de que a chave `internal_admin_notes` não existe em nenhum nó do payload JSON retornado.

##### Pergunta 2.2: Como é a sincronização entre a ficha de embarque preenchida pelo participante (`ReservationParticipant`) e o perfil central do cliente (`CustomerProfile`)?
* **Ataque / Risco:** Em uma pescaria esportiva, um titular reserva um barco para 2 ou 3 amigos. O link de convidado assinado (`/convidado/[token]`) permite que o amigo preencha seus dados de forma autônoma. Se esse convidado digitar um CPF de outro cliente cadastrado ou se dados incorretos sobrescreverem o cadastro do titular, haverá contaminação cruzada de dados cadastrais.
* **Decisão Normativa Definitiva:**
  1. **Fluxo do Titular da Reserva:**
     - Quando o titular preenche a ficha do participante cujo CPF coincide com o CPF da reserva (`participant.cpf == reservation.customer.cpf`), a persistência sincroniza com autoridade máxima o `CustomerProfile` associado a `reservation.customer`:
       - `birth_date`
       - `default_vest_size` (recebe `participant.vest_size`)
       - `emergency_contact_name`
       - `emergency_contact_phone`
       - `medical_notes` (recebe `participant.health_notes`)
       - `dietary_notes` (recebe `participant.dietary_details`).
  2. **Fluxo do Convidado / Parceiro de Barco (`participant.cpf != reservation.customer.cpf`):**
     - O preenchimento da ficha de convidado atualiza o registro local de `ReservationParticipant`.
     - Caso o convidado informe um CPF válido:
       - Se já existir um `Customer` correspondente a esse CPF: o sistema sincroniza os dados complementares de saúde e colete no `CustomerProfile` apenas se os campos centrais estiverem vazios, **NUNCA** alterando e-mail ou telefone primário do cliente existente sem confirmação OTP.
       - Se não existir `Customer` prévio com esse CPF: o sistema mantém os dados na entidade de bordo `ReservationParticipant`. A instanciação formal de um `Customer` com `CustomerProfile` ocorrerá quando esse pescador realizar uma reserva direta ou for promovido manualmente pelo administrador.
  3. **Imutabilidade Externa de Anotações Internas:** Em nenhuma circunstância o preenchimento da ficha web (pelo titular ou pelo convidado) pode ter permissão de escrita sobre o campo `internal_admin_notes`. Esse campo só é alterado por chamadas autenticadas de administradores no endpoint operacional.

##### Pergunta 2.3: Como o LTV (`lifetime_value_cents`) e as métricas do CRM são calculados com precisão matemática?
* **Ataque / Risco:** Erros comuns em relatórios de CRM incluem somar cobranças pendentes ou canceladas, duplicar valores quando há pagamentos parciais ou desconsiderar pagamentos de tralhas adicionais.
* **Decisão Normativa Definitiva:**
  1. **Fórmula Exata de LTV:**
     $$\text{LTV} = \sum_{\text{payment} \in \text{PAID}} \text{payment.amount\_cents}$$
     A soma considera exclusivamente transações `Payment` com `status == Payment.Status.PAID` vinculadas a reservas do cliente que **NÃO** estejam com `status == CANCELLED` ou `REFUNDED`.
  2. **Total de Expedições Concluídas/Confirmadas:** Contagem distinta de reservas do cliente com `status IN (CONFIRMED, PAID, COMPLETED)`.
  3. **Indicador de Licença de Pesca Ativa:** Propriedade booleana calculada:
     ```python
     @property
     def has_valid_license(self):
         if not self.fishing_license_number:
             return False
         if not self.fishing_license_expiry:
             return True
         return self.fishing_license_expiry >= timezone.localdate()
     ```

---

#### Grupo 3: Integração com o Manifesto de Embarque e Logística de Campo

##### Pergunta 3.1: Como os conjuntos de tralhas alugados são exibidos para a pousada e o guia piloteiro (ex: indicação do barco/participante)?
* **Ataque / Risco:** Na pousada parceira (ex.: Pousada Solar das Águas em São Félix do Araguaia), os piloteiros preparam os barcos na escuridão às 5h da manhã. Se o manifesto apenas informar que a "Reserva X tem 2 varas", os piloteiros não saberão em qual barco colocar cada conjunto nem qual pescador é responsável por cada vara de 120 lb.
* **Decisão Normativa Definitiva:**
  1. **Associação Nominal:** O modelo `ReservationGearAddon` já prevê `participant = ForeignKey(ReservationParticipant, null=True, blank=True)`.
     - Quando atribuído a um participante, o equipamento pertence àquele pescador específico;
     - Quando `participant` for nulo, a interface e os relatórios devem identificar como *"Tralha Geral da Reserva — Titular: [Nome do Comprador]"*.
  2. **Payload JSON do Manifesto (`ExpeditionManifestView`):**
     - O endpoint `GET /api/operations/expeditions/<id>/manifest/` DEVE enriquecer o objeto de cada passageiro (`passengers`) com:
       ```json
       "gear_addons": [
           {
               "id": "uuid",
               "product_name": "Conjunto Pesado Piraíba Bruta 100-120 lb",
               "modality": "RENTAL",
               "quantity": 1,
               "notes": "Carretilha manivela direita",
               "delivered": false
           }
       ]
       ```
     - Adicionalmente, o manifesto DEVE incluir no cabeçalho um sumário consolidado de suprimentos para o armazém da pousada:
       ```json
       "gear_summary": [
           {"product_name": "Conjunto Pesado Piraíba Bruta 100-120 lb", "modality": "RENTAL", "total_quantity": 6},
           {"product_name": "Kit Terminal de Aço para Piraíba", "modality": "SALE", "total_quantity": 4}
       ]
       ```
  3. **Exportação CSV (`ExpeditionManifestCsvView`):**
     - Incluir uma coluna dedicada: `"Tralhas e Equipamentos (Locação/Venda)"`;
     - Conteúdo formatado: ex.: `"Conjunto Pesado 120 lb (1x); Kit Terminal (2x)"`;
     - Higienização obrigatória com a função `safe_csv()` já existente para imunização contra Formula Injection no Microsoft Excel.
  4. **Frontend (`ManifestPanel`):**
     - Exibição de chips visuais (🎣) ao lado do nome do passageiro na tabela de embarque;
     - Card de conferência de equipamentos no topo da tela do Manifesto com botão de conferência de entrega (`Marcar como entregue na base`).

---

#### Grupo 4: Retrocompatibilidade e Imunidade de Regressão das 44 Suítes de Testes

##### Pergunta 4.1: Qual é o impacto da Fase C nos checkouts correntes, webhooks do simulador e testes existentes?
* **Ataque / Risco:** O acréscimo de novas tabelas e regras na máquina de estados pode quebrar os fluxos consolidados nas fases anteriores (Fase A, Fase B, E01 a E04) ou quebrar as 44 suítes de testes que sustentam o produto.
* **Decisão Normativa Definitiva:**
  1. **Transparência Relacional:** As adições de `FishingGearProduct` e `ReservationGearAddon` são totalmente aditivas. Reservas criadas via checkout público continuam operando normalmente sem a obrigatoriedade de inclusão de tralhas.
  2. **Isolamento de `CustomerProfile`:** O modelo `CustomerProfile` possui relacionamento `OneToOneField(Customer, on_delete=CASCADE, related_name="profile")`. O modelo central `Customer` não perde nenhum campo existente e não exige `CustomerProfile` para existir (criação automática ou sob demanda via `get_or_create`).
  3. **Preservação de Cálculos Financeiros:** A propriedade delegada `remaining_balance_cents` calcula `max(self.total_price_cents - self.paid_amount_cents, 0)`. Como os novos addons alteram `total_price_cents` de forma direta e consistente, todo o fluxo existente de geração de pagamentos de saldo (`create_balance_payment`) e concorrência pessimista de webhooks (`process_paid_event`) continua íntegro e inalterado.
  4. **Metragem de Testes:** As 44 suítes existentes DEVEM continuar com 100% de aprovação (PASS). Os novos testes da Fase C (CRUD de tralhas, concorrência de estoque, recálculo de status `PAID -> CONFIRMED`, proteção de `internal_admin_notes` e manifesto com tralhas) serão adicionados de forma complementar em `apps/operations/tests.py` e `apps/reservations/tests.py`.

---

### 3. Avaliação de Conformidade com a Constituição e Playbook

| Artigo Constitucional | Exigência | Avaliação de Conformidade |
|---|---|---|
| **§1 Autoridade** | Repositório como autoridade; respeito aos owners normativos | Conforme. Alinhado com o `NORMATIVE_INDEX.json` (`FASEC-TRALHAS-CRM-PESCADORES`). |
| **§2 Linguagem** | Uso estrito de MUST, MUST NOT, SHOULD | Conforme. Todas as ambiguidades foram eliminadas com regras normativas expressas. |
| **§3 Risco HIGH** | Exige spec, Grill, READY humano, Ponytail independente e ACCEPTED | Conforme. Procedimento adversarial cumprido de forma independente. |
| **§4 Especificação** | Estados, concorrência, reversibilidade e auditoria detalhados | Conforme. Transições de estados de reservas com tralhas e concorrência de estoque equacionadas. |
| **§5 Grill e READY** | Nenhuma questão aberta que possa alterar comportamento ou segurança | Conforme. Todos os 4 grupos contenciosos foram normatizados e blindados. |
| **§8 e §9 Evidências** | Matriz de rastreabilidade (REQ-C01 a REQ-C10) e evidência objetiva | Conforme. Matriz mantida com critérios de validação unitária e de concorrência. |
| **Playbook §Checkpoints** | `TEST_SQLITE=true python manage.py test`, linters e `make check-docs` | Conforme. Testes existentes executados e verificados com 100% de sucesso. |

---

### 4. Salvaguardas Mandatórias para a Implementação

1. **Máquina de Estados de Reservas (`backend/apps/reservations/services.py`):**
   * Adicionar `Reservation.Status.CONFIRMED` ao conjunto `ALLOWED_TRANSITIONS[Reservation.Status.PAID]`;
   * Criar helper `recalculate_reservation_financials(reservation_id)` que recalcula `total_price_cents` a partir do preço base da expedição somado aos addons de tralha, ajustando o status atômico (`PAID <-> CONFIRMED`) e registrando o `ReservationEvent` apropriado.
2. **Concorrência e Estoque de Equipamentos (`backend/apps/expeditions/models.py`):**
   * Definir `inventory_quantity` como `PositiveSmallIntegerField(default=0)`;
   * Adicionar `CheckConstraint(check=models.Q(inventory_quantity__gte=0), name="gear_inventory_non_negative")`;
   * Nos endpoints de adição e exclusão de addons, exigir `select_for_update()` no produto.
3. **Privacidade e CRM de Pescadores (`backend/apps/customers/models.py` e `backend/apps/operations/serializers.py`):**
   * Modelar `CustomerProfile` com `internal_admin_notes = models.TextField(blank=True)`;
   * Garantir que `internal_admin_notes` **JAMAIS** seja exposto em serializers públicos (`CustomerParticipantSerializer` ou endpoints do portal do cliente);
   * Implementar testes automatizados específicos para validar que o campo de notas internas não vaza para clientes.
4. **Manifesto Operacional de Embarque (`backend/apps/operations/views.py`):**
   * Atualizar `ExpeditionManifestView` e `ExpeditionManifestCsvView` para incluir a lista de tralhas alugadas/compradas por participante e o sumário total de tralhas da expedição;
   * Sanitizar a nova coluna CSV com `safe_csv()`.
5. **Painel do Administrador (`frontend/src/app/admin/admin-panel.tsx`):**
   * Adicionar as abas `"gear"` (*"Tralhas & Loja"*) e `"customers"` (*"CRM de Pescadores"*);
   * Integrar a conferência de tralhas na aba de Manifesto de Embarque (`ManifestPanel`).

---

### 5. Veredito Final do Grill

> **VEREDITO DO GRILL:** **PASS / RECOMENDADO PARA READY HUMANO**
>
> A especificação da Fase C (`FASEC-TRALHAS-CRM-PESCADORES`), complementada pelas decisões normativas e salvaguardas estabelecidas neste dossiê adversarial, apresenta completude matemática, segurança de concorrência e integridade financeira rigorosa.
>
> Não restam ambiguidades operacionais sobre o comportamento de reservas quitadas, proteção contra estoque negativo, sigilo de anotações internas do CRM ou apresentação de tralhas no Manifesto de Embarque.
>
> O projeto encontra-se **pronto para a concessão formal do status `READY` pelo responsável humano (Rodrigo)**, autorizando o início da implementação técnica conforme a Constituição e o Playbook.

---
*Dossiê emitido pelo Revisor Adversarial Independente (Grill / Counsel) em 01/10/2026.*
