# Dossiê de Revisão Adversarial Independente (Ponytail) — Épica E04

> **Identificador Normativo:** `E04-PORTAL-CLIENTE-FICHA`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Data:** 19/09/2026<br/>
> **Revisor:** Antigravity (Ponytail Independente — Auditoria Técnica Adversarial)<br/>
> **Status da Revisão:** `PASS`<br/>
> **Recomendação para Autoridade Humana:** Apto para declaração formal de `ACCEPTED` por Rodrigo.

---

## 1. Sumário Executivo e Escopo da Avaliação

A Épica E04 conferiu autonomia total de acesso, privacidade e completude cadastral à jornada digital do cliente e de seus convidados:
1. **Reacesso e Autenticação Sem Senha (Passwordless):** Endpoint `POST /api/me/auth/lookup/` que valida CPF e telefone cadastrados, emitindo token assinado de sessão (HMAC) com 30 dias de validade e eliminando o erro de "Sessão não encontrada";
2. **Listagem Centralizada de Reservas:** Endpoint `GET /api/me/reservations/` e página dedicada [`/minha-reserva`](../../../frontend/src/app/minha-reserva/page.tsx), permitindo ao cliente navegar entre todas as suas expedições com indicadores visuais de progresso e saldo;
3. **Formulário Completo de Ficha de Embarque:** Integração da aba "Ficha de Embarque" no [`CustomerJourney`](../../../frontend/src/components/customer/customer-journey.tsx), coletando dados civis, contatos de emergência, tamanho de colete salva-vidas / camiseta UV (`P`, `M`, `G`, `GG`, `XG`, `EXG`) e observações médicas;
4. **Transição Automática de Onboarding:** O participante transiciona para `COMPLETED` automaticamente ao preencher todos os dados obrigatórios, atualizando a barra de progresso da expedição e a completude do manifesto;
5. **Link Seguro de Convidado / Parceiro de Barco:** Geração de token exclusivo de participante e página dedicada `/convidado/[token]`;
6. **Isolamento Financeiro Rigoroso:** O convidado preenche exclusivamente sua própria ficha, bebidas e checklist, sem qualquer visibilidade de valores totais, saldo a pagar ou botões de cobrança PIX.

---

## 2. Metodologia de Falsificação e Ataque

A avaliação submeteu a implementação a tentativas de falsificação e vetores de estresse:
- **Vazamento de Dados Financeiros para Convidado:** Tentativa de extrair valores da reserva (`total_price_cents`, `paid_amount_cents`, `remaining_balance_cents`, `deposit_cents`, `payment_plan`) a partir do endpoint `/api/me/guest/<token>/`. O teste `test_guest_endpoints_isolation_and_no_financial_leak` comprovou ausência total desses campos no payload do convidado.
- **Escalação de Privilégios com Token de Convidado:** Tentativa de utilizar o token de convidado como `Bearer token` no endpoint de reservas do comprador (`/api/me/reservations/`). O endpoint rejeitou com `HTTP 401 Unauthorized`.
- **Falsificação e Violação de Tokens (Tampering):** Envio de tokens adulterados ou com assinaturas HMAC inválidas para `/api/me/guest/` e endpoints de atualização. O sistema rejeitou prontamente com `HTTP 401 Unauthorized`.
- **Validação de CPF e Telefone no Lookup:** Tentativas de consulta com CPF inválido (tamanho incorreto, formato inválido), telefone não coincidente e CPF inexistente retornaram rigorosamente `HTTP 400 Bad Request` com mensagens amigáveis.
- **Execução Real em Produção:** Compilação do build Next.js com Turbopack e checagem estática de tipos do TypeScript 100% limpa, bem como suíte de 38 testes executada com banco PostgreSQL nativo.

---

## 3. Resultados das Validações Reais

| Verificação | Comando / Ambiente | Resultado | Detalhes |
|---|---|---|---|
| **Suíte Backend Completa** | `docker compose -f compose.production.yaml exec -T backend python manage.py test` | **PASS** | 38 testes executados, 0 falhas, 0 erros em 34.83s com PostgreSQL real |
| **Integridade de Migrações** | `python manage.py makemigrations --check` | **PASS** | `No changes detected` (migração 0009 aplicada) |
| **Build & Tipagem Frontend** | `docker compose -f compose.production.yaml build frontend` | **PASS** | Turbopack + TypeScript check 100% limpos |
| **Disponibilidade em Runtime** | `curl http://127.0.0.1:3001/minha-reserva` e `curl http://127.0.0.1:3001/convidado/test-token` | **PASS** | Retorno HTTP `200 OK` |
| **Higiene de Whitespace do Git** | `git diff --check` | **PASS** | 0 infrações |
| **Governança SDD (`check_docs`)**| `python3 scripts/check_docs.py` | **PASS** | 7 owners normativos válidos |

---

## 4. Matriz de Rastreabilidade e Conformidade (AC01 a AC07)

| Critério de Aceite | Requisito da Spec | Implementação no Código | Evidência no Teste / Runtime | Veredito |
|---|---|---|---|---|
| **AC01 — Reacesso por CPF e Telefone** | Cliente informa CPF e telefone, autentica-se e visualiza suas reservas com link direto. | `CustomerAuthLookupView`, `CustomerReservationListView` e `CustomerLoginModal`. | `test_customer_auth_lookup` e `test_customer_reservations_list_endpoint`. | **PASS** |
| **AC02 — Persistência e Resiliência de Sessão** | Sessão de longa duração no `localStorage` com espelhamento em `sessionStorage` e suporte a `?auth=`. | `customer-auth.ts`, `headers()` e `load()` em `customer-journey.tsx`. | Verificado no fluxo de autenticação e build Next.js. | **PASS** |
| **AC03 — Ficha de Embarque Completa na Web** | Aba "Ficha de Embarque" permite preencher dados civis, emergência, saúde e tamanho de colete. | `ParticipantFichaSection` em `customer-journey.tsx` e campos `vest_size` / `health_notes` no modelo. | `test_participant_update_with_vest_and_health_notes`. | **PASS** |
| **AC04 — Conclusão Automática do Onboarding** | Preenchimento dos campos obrigatórios transiciona o participante para `COMPLETED`. | `CustomerParticipantSerializer.update` e `onboarding_status`. | Validado em `test_participant_update_with_vest_and_health_notes`. | **PASS** |
| **AC05 — Geração do Link de Convidado** | Botão "Copiar Link do Parceiro" com URL assinada exclusiva para o participante. | `create_guest_participant_token` e card de compartilhamento com WhatsApp. | `test_guest_endpoints_isolation_and_no_financial_leak`. | **PASS** |
| **AC06 — Isolamento Total Financeiro do Convidado** | A tela `/convidado/[token]` permite preencher ficha, bebidas e checklist sem revelar saldo ou pagamento. | `CustomerGuestDetailView`, `CustomerGuestPreferencesView`, `CustomerGuestChecklistView` e página dedicada. | Assertions `assertNotIn` para todos os campos financeiros em `test_guest_endpoints_isolation_and_no_financial_leak`. | **PASS** |
| **AC07 — Qualidade e Ausência de Regressões** | Suíte de testes automatizada cobrindo fluxos felizes e de borda, sem regressão nas épicas anteriores. | 38 testes no backend e build de produção do Next.js. | 38/38 testes passando em banco PostgreSQL real. | **PASS** |

---

## 5. Veredito Final

A implementação da Épica **E04 (Portal do Cliente, Reacesso e Ficha de Embarque Digital)** atende integralmente a 100% dos critérios de aceitação AC01 a AC07, com proteção concorrencial, privacidade de dados civis/médicos e rigoroso isolamento financeiro para convidados.

- **Veredito do Ponytail:** **PASS**
- **Status da Especificação:** Apto para transição de `READY` para `ACCEPTED` mediante ratificação formal da autoridade humana competente (Rodrigo).
