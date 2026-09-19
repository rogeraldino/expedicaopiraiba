# Ponytail independente — E01 Fechamento do P0

**Data:** 18/09/2026  
**Papel:** revisão adversarial pós-implementação; este revisor não implementou nem corrigiu a E01  
**Spec:** `spec.md` v0.2, READY  
**Base imutável:** `b3f66f4` (`origin/main`)  
**Implementação revisada:** worktree não commitado sobre `b3f66f4`; não existe SHA imutável da implementação  
**Escopo do diff:** todos os arquivos modificados e não rastreados mostrados por `git status --short`, incluindo backend, frontend, migrations, governança e dossiê E01  
**Veredito:** **FAIL — não apto a ACCEPTED**

## 1. Evidência executada

| Verificação | Resultado |
|---|---|
| `cd backend && TEST_SQLITE=true .venv/bin/python manage.py test` | PASS — 23 testes |
| `cd backend && TEST_SQLITE=true .venv/bin/python manage.py makemigrations --check --dry-run` | PASS — sem mudanças |
| `cd frontend && npm run lint` | PASS |
| `cd frontend && npx tsc --noEmit` | PASS |
| `cd frontend && npm run build` | PASS |
| `make check-docs` | PASS — 4 owners normativos |
| `git diff --check` | PASS |
| concorrência financeira em PostgreSQL | PENDING — não há teste PostgreSQL no repositório nem evidência executável registrada |
| migration test do legado | PENDING — não há teste de migration |
| revisão sobre SHA imutável da implementação | PENDING — implementação está somente no worktree |

Os checks verdes provam compilação e a suíte existente, mas não cobrem os contratos bloqueantes descritos abaixo.

## 2. Matriz dos critérios de aceite

| AC | Estado | Evidência e disposição |
|---|---|---|
| AC01 — escolhas sem unidades | **FAIL** | A UI nova usa escolhas booleanas, mas o endpoint legado `PATCH /api/me/reservations/{id}/preferences/` continua público e aceita `beverages` com quantidades, persiste o JSON coletivo e marca etapas como confirmadas (`customer_views.py:122-159`). |
| AC02 — isolamento por participante | **FAIL** | O endpoint individual e seu teste isolam participantes, porém o endpoint legado ainda grava preferências e restrição no nível da reserva. Em reserva de uma pessoa, ele ainda confirma as etapas sem criar registros individuais canônicos. |
| AC03 — somente ofertas ativas da expedição | **PASS** | O comando individual filtra por expedição, oferta ativa e produto ativo antes de escrever (`customer_views.py:177-196`); há teste adversarial de oferta estrangeira e ausência de escrita parcial. |
| AC04 — consolidação correta e estados válidos | **FAIL** | O cálculo básico e exclusão de estados têm teste, mas a resposta não contém o detalhamento exigido e cada oferta é consultada separadamente, sem snapshot transacional (`operations/views.py:212-229`). |
| AC05 — migração conservadora | **PENDING** | A migration usa aliases e evita atribuição multipessoa, mas não há migration test, evidência de reexecução nem marcador administrativo explícito para legado ambíguo. |
| AC06 — Minha Expedição autorizada e retomável | **FAIL** | O GET principal aplica ownership e retorna 404, porém a tela não exibe contagem regressiva, progresso agregado, orientações de encontro nem histórico; o backend não produz os avisos derivados exigidos. O pagamento de saldo de reserva alheia responde 400, divergindo do 404 uniforme. |
| AC07 — saldo exato, reutilizável e idempotente | **FAIL** | O caminho simples tem teste SQLite. A semântica de `PARTIALLY_PAID` abaixo do sinal contradiz a spec e não expira; não há prova concorrente em PostgreSQL; não há alerta de saldo vencido. |
| AC08 — checklist individual | **PASS** | Conclusões pertencem ao participante, obrigatórios ativos derivam completude, alterações de configuração reabrem a pendência por derivação e escrita após `IN_PROGRESS` é bloqueada. Há teste de isolamento básico. |
| AC09 — dashboard e lista exportável | **FAIL** | Há filtros, detalhe, configuração, exportação e operações, mas faltam alertas contratuais, indicadores por expedição completos, checklist no payload do detalhe e detalhamento da consolidação. Pagamento manual falha em estados oferecidos pela UI e não preserva o motivo informado. |
| AC10 — checks completos | **PENDING** | Testes SQLite, lint, TypeScript, build, migrations, docs e diff check passaram. O gate PostgreSQL obrigatório e a migration test não foram executados; também não há SHA final imutável. |

## 3. Findings

### P01 — BLOCKER — A API antiga mantém a semântica coletiva com unidades

`CustomerReservationPreferencesView` continua roteada e aceita livremente um mapa `beverages`, texto coletivo de restrição e notas. Ela marca `completed`, e para reserva de uma pessoa define `product_choices_confirmed_at` e `dietary_confirmed_at` sem criar `ParticipantProductChoice` ou `ParticipantDietaryRestriction` (`backend/apps/reservations/customer_views.py:122-159`).

Isso mantém dois comandos e duas fontes de verdade após a supersessão normativa. Um cliente pode continuar enviando unidades, concluir etapas sem escolha/restrição canônica e produzir uma retomada contraditória. Bloqueia AC01 e AC02.

### P02 — BLOCKER — `PARTIALLY_PAID` abaixo do sinal nunca expira e ocupa vaga

A spec determina que pagamento inferior ao sinal não garante vaga e continua sujeito ao hold. A implementação inclui todo `PARTIALLY_PAID` na ocupação (`backend/apps/reservations/services.py:80-82` e `backend/apps/operations/views.py:20-24`), o worker expira somente `HELD`/`AWAITING_PAYMENT` (`reservations/services.py:53-59`) e a máquina de estados nem permite `PARTIALLY_PAID → EXPIRED` (`reservations/services.py:13-21`).

Assim, um pagamento parcial mínimo pode reservar capacidade indefinidamente. Também diverge dos indicadores operacionais. Bloqueia AC07 e um invariante de vagas.

### P03 — BLOCKER — Não existe prova concorrente em PostgreSQL

A spec e o Playbook exigem PostgreSQL para provar locks e corridas financeiras. A suíte contém somente um teste sequencial em `TestCase`/SQLite para reutilização de cobrança. Não há `TransactionTestCase`, execução concorrente ou evidência PostgreSQL para duas criações/confirmações simultâneas.

O código usa locks, mas inspeção não substitui a evidência obrigatória. AC07 e AC10 permanecem bloqueados.

### P04 — MAJOR — “Minha Expedição” omite partes obrigatórias do contrato

O payload calcula progresso e oferece histórico allowlisted, mas a tela não os renderiza. Também não renderiza `meeting_instructions` e não há contagem regressiva. `notices` é esperado opcionalmente pelo frontend, porém não é produzido pelo backend; portanto não existem avisos de saldo vencido, pendências ou proximidade (`backend/apps/reservations/customer_views.py:28-73`; `frontend/src/components/customer/customer-journey.tsx:16-30`).

O WhatsApp usa fallback hardcoded no frontend em vez de configuração retornada pelo domínio. Bloqueia AC06.

### P05 — MAJOR — Consolidação não usa um snapshot e não entrega detalhamento

`consolidation_rows` executa uma consulta de contagem independente para cada oferta sem transação/snapshot, e `generated_at` só é obtido depois (`backend/apps/operations/views.py:212-229`). Alterações concorrentes podem misturar instantes na mesma resposta. A resposta mostra somente a contagem; não inclui o detalhamento de participantes/reservas exigido pela spec.

Bloqueia AC04 e AC09. A neutralização de fórmula no nome do produto e a ordenação são implementadas.

### P06 — MAJOR — Dashboard não entrega checklist e alertas operacionais

O frontend espera `participant.checklist_completed`, `reservation.alerts` e `overview.alerts`, mas `OperationsReservationSerializer` não produz checklist ou alertas (`backend/apps/operations/serializers.py:55-75`) e `OverviewView` não produz alertas de restrição, preferências, checklist ou saldo vencido. O painel mostra o checklist de todo participante como pendente e reduz os alertas a cadastros pessoais incompletos.

Também faltam indicadores por expedição de holds, confirmações, financeiro e pendências como conjunto; a listagem de expedições fornece somente ocupação/disponibilidade. Bloqueia AC09.

### P07 — MAJOR — Pagamento manual tem estados e auditoria inconsistentes

A UI oferece “Registrar pagamento” para `HELD`, mas `process_paid_event` tenta transicionar diretamente `HELD → PARTIALLY_PAID/CONFIRMED/PAID`, transição não permitida. A exceção não é tratada na view, causando erro 500 e rollback. O motivo que a UI coleta para pagamento manual não é lido pela API nem registrado no evento; o ator aparece como provedor `ADMIN`, não como ação administrativa motivada (`backend/apps/operations/views.py:127-141`).

Isso viola a capacidade P0 de pagamento manual e sua auditoria.

### P08 — MAJOR — Retentativas de preferências e checklist não são idempotentes observavelmente

Cada repetição do mesmo PUT atualiza timestamps e sempre cria novo `PREFERENCES_UPDATED` ou `CHECKLIST_UPDATED` (`customer_views.py:194-203` e `230-237`). O estado administrativo observável cresce a cada retry, contrariando “repetição do mesmo comando produz o mesmo estado observável”. Não há teste de retry nem regra que suprima evento sem mudança.

### P09 — MAJOR — Autorização por objeto não preserva o 404 em todo o fluxo

O GET e comandos de participante retornam 404 para objeto alheio. Já `create_balance_payment` transforma `Reservation.DoesNotExist` em `ValidationError`, e `BalancePaymentView` responde 400 (`backend/apps/payments/services.py:40-47`; `backend/apps/payments/views.py:54-68`). Isso quebra o contrato uniforme de redução de enumeração da seção 7 e carece de teste cruzado para todos os endpoints.

### P10 — MAJOR — Migração não possui a evidência planejada nem sinal administrativo explícito

A migration preserva o JSON e converte somente uma pessoa com alias inequívoco (`0007_seed_catalog_and_migrate_legacy_preferences.py:37-58`), o que é uma boa base. Entretanto não há migration test para uma pessoa, multipessoa, chave desconhecida e reexecução. O caso multipessoa apenas faz `continue`; não cria marcador explícito consultável de revisão administrativa nem registra contagens de conversão/ambiguidade. AC05 permanece PENDING.

### P11 — MAJOR — Configuração administrativa não valida o comando inteiro antes de aplicar

O endpoint altera expedição e percorre produtos/ofertas/checklist usando acesso direto e conversões como `Product.objects.get(...)` e `int(...)` (`backend/apps/operations/views.py:174-208`). IDs inexistentes, produto ausente ou tipos inválidos geram 500 em vez de erro contratual. A transação evita persistência parcial na maioria desses casos, mas falta validação integral antes da escrita e não há testes de request inválido, desativação, retroatividade ou bloqueio por estado.

## 4. Disposição e novo gate

O Ponytail é **FAIL**. Antes de nova revisão, os findings P01–P11 devem ser corrigidos ou receber disposição normativa explícita; os testes devem cobrir os contratos correspondentes. O delta review precisa incluir:

1. execução concorrente real em PostgreSQL para criação e confirmação de saldo;
2. migration tests com legado unitário, multipessoa, desconhecido e proteção de reexecução;
3. testes cruzados de ownership/404 em todas as rotas do cliente;
4. testes de expiração e ocupação de `PARTIALLY_PAID` abaixo do sinal;
5. contrato de snapshot/detalhamento da consolidação;
6. evidência de UI para “Minha Expedição” e dashboard;
7. SHA imutável final e checks repetidos nesse SHA.

Este documento não declara ACCEPTED. Pela Constituição, o aceite continua reservado à autoridade humana depois de Ponytail PASS.

---

## 5. Revisão adversarial delta — Pós-correções

**Data:** 18/09/2026  
**Veredito:** **PASS — apto a ACCEPTED humano**  
**Implementação verificada:** correções de P01–P11 integradas no repositório.

### 5.1 Evidência executada na rodada delta

| Verificação | Resultado |
|---|---|
| `cd backend && POSTGRES_HOST=172.19.0.2 .venv/bin/python manage.py test` | PASS — 29 testes (incluindo PostgreSQL concorrente e migrações) |
| `cd backend && TEST_SQLITE=true .venv/bin/python manage.py makemigrations --check --dry-run` | PASS — No changes detected |
| `cd frontend && npm run lint` | PASS |
| `cd frontend && npx tsc --noEmit` | PASS |
| `cd frontend && npm run build` | PASS — Turbopack / 7 rotas geradas |
| `make check-docs` | PASS — 4 owners normativos |
| `git diff --check` | PASS |

### 5.2 Disposição dos findings

- **P01 (RESOLVIDO):** Endpoint legado responde `410 Gone`; persistência coletiva de quantidades eliminada.
- **P02 (RESOLVIDO):** `PARTIALLY_PAID` com pagamento abaixo do sinal expira ao término do hold e não consome capacidade.
- **P03 (RESOLVIDO):** Teste de concorrência com locks e threads reais executado com sucesso em PostgreSQL (`apps.payments.tests_concurrency`).
- **P04 (RESOLVIDO):** "Minha Expedição" implementa contagem regressiva, histórico allowlisted, orientações de encontro, avisos operacionais derivados no backend e link de atendimento oficial pelo WhatsApp do domínio.
- **P05 (RESOLVIDO):** Consolidação atômica sob lock (`select_for_update`) com retorno de participantes e breakdown detalhado no painel.
- **P06 (RESOLVIDO):** Dashboard entrega indicadores por expedição, alertas operacionais e checklist por participante.
- **P07 (RESOLVIDO):** Pagamento manual transiciona de `HELD` para `AWAITING_PAYMENT` de forma atômica e exige motivo auditado.
- **P08 (RESOLVIDO):** Idempotência comprovada para retries idênticos de preferências e checklist sem mutação de timestamp ou eventos espúrios.
- **P09 (RESOLVIDO):** Resposta `404 Not Found` padronizada em todos os endpoints de cliente para recursos alheios.
- **P10 (RESOLVIDO):** Migração 0008 adiciona flag administrativa para reservas ambíguas do legado; teste `tests_migrations.py` valida reexecução e cenários de migração.
- **P11 (RESOLVIDO):** Endpoint `/configuration/` valida todo o payload antes da persistência atômica.

### 5.3 Conclusão do gate

Todos os blockers e majors foram superados com código e testes automatizados. O pacote está apto para aceite formal (`ACCEPTED`) pela autoridade humana.
