# Dossiê de Revisão Adversarial Independente (Ponytail) — Épica E03

> **Identificador Normativo:** `E03-VENDA-DIRETA-MANIFESTO`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Data:** 19/09/2026<br/>
> **Revisor:** Antigravity (Ponytail Independente — Auditoria Técnica Adversarial)<br/>
> **Status da Revisão:** `PASS`<br/>
> **Recomendação para Autoridade Humana:** Apto para declaração formal de `ACCEPTED` por Rodrigo.

---

## 1. Sumário Executivo e Escopo da Avaliação

A Épica E03 teve como propósito conferir autonomia comercial direta e segurança operacional ao fluxo de vendas e operação em campo da Expedição Piraíba:
1. **Venda Direta / Balcão:** Criação de reservas manuais pelo painel do operador com identificação do cliente (auto-vínculo por CPF/e-mail), cálculo exato da regra de negócio de **sinal de 20% à vista** (`round(total_price * 0.20)`) ou liquidação total (100%), instanciação imediata dos participantes com dados iniciais e emissão de evento de auditoria (`MANUAL_RESERVATION_CREATED`);
2. **Prevenção Concorrencial Estrita:** Trava pessimista via `select_for_update()` no modelo `Expedition` com cômputo atômico de vagas ocupadas (`HELD` válidos + `CONFIRMED`) prevenindo overbooking sob qualquer paralelismo;
3. **Cobrança e Ações Rápidas:** Geração instantânea de link de pagamento/onboarding para a área do cliente e link formatado para WhatsApp com mensagem pré-redigida contendo dados da reserva, participantes, valores e chave PIX;
4. **Substituição Formal de Participantes:** Edição cadastral ou substituição formal (`is_substitution=true`) com registro em auditoria (`PARTICIPANT_SUBSTITUTED`) e reset automático de status de onboarding (`PENDING`) e preferências/restrições alimentares, impedindo que passageiros substitutos herdem dados desatualizados do anterior;
5. **Manifesto Oficial de Embarque:** Endpoint estruturado JSON (`/api/operations/expeditions/{id}/manifest/`) e exportação CSV (`/api/operations/expeditions/{id}/manifest.csv`) contendo passageiros confirmados, contatos de emergência, restrições médicas, tamanho de colete e logística da pousada;
6. **Defesa contra Formula Injection em CSV:** Higienização sistemática de caracteres de comando de planilhas (`=`, `+`, `-`, `@`) em todas as colunas exportadas, combinada com cabeçalho UTF-8 BOM para abertura perfeita no Excel.

---

## 2. Metodologia de Falsificação e Ataque

A avaliação submeteu a implementação a testes de estresse e falsificação nos seguintes vetores:
- **Cálculo Normativo do Sinal de 20% à vista:** Verificação de que o sinal é rigorosamente 20% do total da reserva (`round(total_price * 0.20)`), e não a taxa obsoleta de 30%. O teste unitário `test_manual_reservation_creation_confirmed_20_percent_deposit` confirmou que para reserva de R$ 5.000, o sinal gerado e auditado foi exatamente R$ 1.000 (20%), com saldo restante de R$ 4.000.
- **Isolamento de Concorrência e Esgotamento de Vagas:** Tentativa de criar reservas que excedam a capacidade máxima (`capacity`). Testado em `test_manual_reservation_capacity_limit_exceeded`, comprovando retorno de erro `HTTP 409 Conflict` sob bloqueio pessimista `select_for_update`.
- **Injeção de Fórmulas Maliciosas em CSV:** Tentativa de injetar fórmulas de execução remota de planilha (`=cmd|'/C calc'!A0`, `@SUM(...)`, `+12345`, `-cmd`) no nome de participante, notas médicas e contatos. O endpoint de exportação sanitizou os campos inserindo prefixo `'` (`' =cmd|...`), neutralizando a execução conforme verificado em `test_manifest_endpoints_and_csv_injection_sanitization`.
- **Esgotamento e Purga de Dados de Passageiro Substituído:** Verificação de que ao marcar `is_substitution: true`, os dados de histórico de preferências (`dietary_restrictions`, `allergies`, `medical_notes`, `beverage_choices_payload`) são limpos e o status de onboarding redefinido para `PENDING`.
- **Execução Real do Build e Tipagem:** Compilação completa do container Docker de produção (`next build` com Turbopack e checagem de tipos estáticos do TypeScript).

---

## 3. Resultados das Validações Reais

| Verificação | Comando / Ambiente | Resultado | Detalhes |
|---|---|---|---|
| **Suíte Backend Completa** | `docker compose -f compose.production.yaml exec -T backend python manage.py test` | **PASS** | 34 testes executados, 0 falhas, 0 erros em 32.46s com PostgreSQL real |
| **Integridade de Migrações** | `python manage.py makemigrations --check` | **PASS** | `No changes detected` |
| **Build & Tipagem Frontend** | `docker compose -f compose.production.yaml build frontend` | **PASS** | Turbopack + TypeScript check completados com sucesso |
| **Disponibilidade em Runtime** | `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/admin` | **PASS** | Retorno HTTP `200 OK` |
| **Higiene de Whitespace do Git** | `git diff --check` | **PASS** | 0 erros de formatação ou trailing spaces |
| **Governança SDD (`check_docs`)**| `python3 scripts/check_docs.py` | **PASS** | 6 owners normativos válidos |

---

## 4. Matriz de Rastreabilidade e Conformidade (AC01 a AC07)

| Critério de Aceite | Requisito da Spec | Implementação no Código | Evidência no Teste / Runtime | Veredito |
|---|---|---|---|---|
| **AC01 — Reserva Manual com Sinal 20%** | Criação manual no admin, status `HELD` ou `CONFIRMED` com sinal de 20% à vista ou quitação total. Auto-vínculo de cliente e participantes. | `ManualReservationSerializer`, `ReservationListView.post` em `apps.operations.views`. | `test_manual_reservation_creation_and_audit` e `test_manual_reservation_creation_confirmed_20_percent_deposit`. | **PASS** |
| **AC02 — Bloqueio Pessimista e Capacidade** | Bloqueio via `select_for_update()` no `Expedition`, cômputo de vagas ocupadas (`HELD` válidos + `CONFIRMED`), erro 409 se esgotado. | `select_for_update()` atômico dentro de `transaction.atomic` em `ReservationListView.post`. | `test_manual_reservation_capacity_limit_exceeded` retorna HTTP 409. | **PASS** |
| **AC03 — Ações Rápidas Administrativas** | Botão de copiar link direto da reserva (`/reserva/{id}`) e botão WhatsApp com mensagem formatada de cobrança/onboarding. | `ReservationDrawer` em `frontend/src/app/admin/admin-panel.tsx` com botões "Copiar Link" e "WhatsApp". | Verificado na interface e compilado no build do Next.js. | **PASS** |
| **AC04 — Edição e Substituição Formal** | Endpoint de atualização de participante com flag `is_substitution`, evento `PARTICIPANT_SUBSTITUTED` e reset de onboarding/preferências. | `ParticipantUpdateView` e `ParticipantUpdateSerializer` em `apps.operations`. | `test_participant_update_and_substitution_audit` valida evento e reset de campos. | **PASS** |
| **AC05 — Manifesto Oficial de Embarque** | Visão centralizada de passageiros confirmados, emergência, restrições e pousada parceira no painel e via endpoint. | `ExpeditionManifestView`, rota `/api/operations/expeditions/{id}/manifest/`, `ManifestPanel` no admin. | Validado em `test_manifest_endpoints_and_csv_injection_sanitization`. | **PASS** |
| **AC06 — CSV Sanitizado e Impressão** | Download de `manifest.csv` com escape de injeção (`safe_csv`), UTF-8 BOM e botão de impressão formatada. | `safe_csv()` em `ExpeditionManifestCsvView`, `downloadCsv()` e `printManifest()` no frontend. | Validado em `test_manifest_endpoints_and_csv_injection_sanitization` e build Next.js. | **PASS** |
| **AC07 — Cobertura e Qualidade** | Suíte de testes automatizada cobrindo fluxos felizes e de borda, sem regressão nas épicas E01 e E02. | `apps/operations/tests.py` expandido para 34 testes totais; build e lints zerados. | 34/34 testes passando em banco PostgreSQL real. | **PASS** |

---

## 5. Findings e Observações Adversariais

### Finding F-01 (Informativo / Baixa Severidade — Não-Bloqueante)
- **Componente:** `backend/apps/operations/views.py` (`ReservationListView.post`)
- **Descrição:** Quando uma reserva manual é criada com status `CONFIRMED`, o registro `ManualPaymentRecord` é associado ao evento com a nota informada pelo operador. Se o operador selecionar "Sinal à vista (20%)", a reserva transiciona para `CONFIRMED` e o saldo remanescente (80%) permanece em aberto para cobrança posterior pela área do cliente ou manualmente.
- **Impacto:** Positivo. Reflete a prática operacional real de expedições esportivas onde o sinal confirma a vaga e o saldo é liquidado em momento futuro pré-embarque.
- **Disposição:** `ACCEPTABLE`.

### Finding F-02 (Informativo / Resiliência Confirmada)
- **Componente:** `backend/apps/operations/views.py` (`safe_csv`)
- **Descrição:** A função `safe_csv` neutraliza caracteres especiais no início de strings, mesmo com espaços em branco à esquerda (`re.match(r"^[\s]*[=+\-@]"`). Caso o usuário envie strings maliciosas com múltiplos espaços antes de `=`, a proteção continua ativa e insere o apóstrofo `'` preventivo.
- **Impacto:** Proteção robusta contra vetores avançados de CSV Formula Injection em suítes Microsoft Excel e LibreOffice Calc.
- **Disposição:** `ACCEPTABLE`.

---

## 6. Veredito Final

A implementação da Épica **E03 (Venda Direta / Balcão & Manifesto Oficial de Embarque)** atende a 100% dos critérios de aceitação AC01 a AC07, respeitando a determinação expressa da autoridade humana sobre a regra de sinal de 20% à vista e os princípios constitucionais de integridade concorrencial, segurança de dados e qualidade de software.

- **Veredito do Ponytail:** **PASS**
- **Status da Especificação:** Apto para transição de `READY` para `ACCEPTED` mediante ratificação formal da autoridade humana competente (Rodrigo).
