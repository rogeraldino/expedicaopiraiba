# Parecer Ponytail Independente e Adversarial — Estágio 2 (Identidade e Venda Real)

**Data da Revisão:** 21/10/2026  
**Revisor Independente:** Agente Ponytail (Constituição § 8)  
**Documento Normativo:** `docs/sdd/CONSTITUTION.md` (v0.2-pilot) e `specs/active/Estagio2_Identidade_Pagamentos/spec.md` (v0.2)  
**Veredito:** **PASS**

---

## 1. Resumo Executivo e Veredito

A implementação do **Estágio 2 (Identidade e Venda Real Completas)** foi submetida à auditoria adversarial exaustiva conforme determinado pela Constituição (§§ 8, 9 e 14).

Todos os 10 critérios de aceitação (**AC01 a AC10**) foram auditados contra o código-fonte, a suíte de testes automatizados com PostgreSQL 17 real, o processo de compilação estática do Next.js e as chamadas reais contra o gateway bancário Mercado Pago no ambiente de Sandbox (`sb.expedicaopiraiba.com.br`).

Todas as defesas contra vulnerabilidades críticas identificadas na auditoria (AUTH-01 a 03, PAY-01 a 07, CAP-01, GUEST-01, MSG-01 e os findings do Grill G-01 a G-04) foram formalmente atestadas e comprovadas.

**Veredito Oficial:** **PASS**

---

## 2. Matriz de Conformidade dos Critérios de Aceite (AC01–AC10)

| ID | Requisito Normativo | Prova Esperada | Evidência Automatizada & Código | Status |
|---|---|---|---|:---:|
| **AC01** | OTP Real sem Vazamento de `dev_code` | `/api/checkout/identify/` omite `dev_code` fora de debug; e-mail enviado via SMTP; incremento atômico de tentativas erradas bloqueia no 5º erro. | `apps/customers/services.py` (`start_verification`, `verify_challenge`); `apps/payments/tests_stage2.py` (`test_wrong_otp_attempts_durably_incremented`). | **CONFORME** |
| **AC02** | Proteção de Dados de Cliente Existente | Submeter CPF existente com e-mail/telefone divergentes não altera `Customer` antes de OTP comprovado. | `apps/customers/services.py` (`start_verification` grava em `pending_*` no `VerificationChallenge`); `test_existing_customer_contact_preserved_before_verification`. | **CONFORME** |
| **AC03** | Reacesso com Posse de Canal | `/api/me/auth/` exige código OTP; emite `customer-session-token` de 30 dias; rate-limit ativo contra enumeração (G-04). | `apps/customers/services.py` (`start_portal_reaccess`, `verify_portal_reaccess`); `apps/reservations/customer_views.py`; `test_portal_reaccess_flow`. | **CONFORME** |
| **AC04** | Revogação de Link de Convidado | Substituição de passageiro incrementa `token_version` e invalida imediatamente tokens legados com HTTP 401. | `apps/reservations/models.py` (`token_version`); `apps/customers/services.py` (`participant_from_guest_token`); `test_guest_token_versioning_and_revocation`. | **CONFORME** |
| **AC05** | Cálculo Uniforme do Sinal | Sinal multiplicado pelo número de vagas (`deposit_cents * participant_count`) no backend e interface. | `apps/reservations/services.py` (`create_hold`); `apps/payments/services.py`; `test_deposit_calculation_multiplied_by_participants`. | **CONFORME** |
| **AC06** | Ocupação sem Duplicação | Pagamento em 2 parcelas (sinal + saldo) não infla vagas em join cartesiano. | `apps/operations/views.py` (`expeditions_with_occupancy` usando agregação limpa `distinct`); `test_occupancy_not_duplicated_after_balance_payment`. | **CONFORME** |
| **AC07** | PIX Mercado Pago com Idempotência | PIX dinâmico com QR Code, Copia-e-Cola e `X-Idempotency-Key` determinística. | `apps/payments/gateways.py` (`generate_idempotency_key`, `create_pix`); teste ao vivo no sandbox gerando cobrança real (`external_id: 1354028975`). | **CONFORME** |
| **AC08** | Cartão de Crédito e Recusa/Aprovação | Aprovação transiciona reserva para `CONFIRMED`; recusa marca `FAILED` mas preserva `HELD` para retentativa (G-02). | `apps/payments/services.py` (`create_reservation_payment`); `apps/payments/gateways.py`; `test_card_payment_approval_and_rejection`. | **CONFORME** |
| **AC09** | Boleto Bancário com Endereço Condicional | Endereço exigido (BACEN) para boleto; bloqueio a menos de 7 dias do embarque (G-01); held estendido até vencimento. | `apps/payments/services.py`; `apps/payments/gateways.py` (`date_of_expiration` formatada); `test_boleto_issuance_with_address_and_extended_hold`. | **CONFORME** |
| **AC10** | Webhook Criptográfico e Reconciliação | Ausência de HMAC retorna 401; divergência de valor/moeda rejeita sem confirmar; evento repetido idempotente; dispara e-mail de compra. | `apps/payments/views.py` (`MercadoPagoWebhookView`); `apps/payments/services.py` (`process_paid_event`); `test_mercadopago_webhook_signature_and_reconciliation`. | **CONFORME** |

---

## 3. Verificação de Evidências Automatizadas

| Evidência | Comando / Ambiente | Resultado | Detalhes |
|---|---|---|---|
| **Suíte Backend Django** | `docker exec expedicaopiraiba-backend-1 python manage.py test` (PostgreSQL 17) | **86 PASS** (15.96s) | 76 testes baseline + 10 testes dedicados do Estágio 2 com concorrência real e PostgreSQL 17. |
| **Schema & Migrations** | `python manage.py makemigrations --check --dry-run` | **PASS** (0 pendências) | Esquema de dados sincronizado e migrations aplicadas no Sandbox (`customers.0004`, `payments.0003`, `reservations.0011`). |
| **Edge Gateway Sandbox** | `python3 deploy/sandbox/test_gateway.py` | **7 PASS** (5.46s) | Autenticação por cookie HMAC, isolamento de APIs públicas/protegidas e sanitização de query parameters. |
| **Next.js Production Build** | `docker build ... piraiba-frontend-sandbox:20261021T195335Z-ad84eed57db1` | **PASS** (0 erros) | Compilação Turbopack standalone, rotas tipadas via TypeScript e zero erros de lint. |
| **Gateway MP (PIX Real)** | Chamada de API live no Sandbox via `MercadoPagoPaymentGateway.create_pix` | **PASS** (HTTP 201) | External ID `1354028975`, QR Code copia e cola persistido e status `AWAITING_PAYMENT`. |
| **Gateway MP (Boleto Real)** | Chamada de API live no Sandbox via `MercadoPagoPaymentGateway.create_boleto` | **PASS** (HTTP 201) | External ID `1354027019`, linha digitável gerada e ticket PDF emitido pelo Mercado Pago. |

---

## 4. Análise Adversarial de Riscos e Casos de Borda

1. **Tentativas de OTP e Rollback de Transação (AUTH-02):**  
   O bug histórico em que falhas de OTP eram revertidas pelo rollback de `ValidationError` foi eliminado. O contador `challenge.attempts` é persistido de forma durável e atômica. No 5º erro incorreto, o desafio é bloqueado de forma irrevogável.

2. **Seqüestro de Identidade por Substituição de Contato (AUTH-01):**  
   Se um terceiro malicioso tentar submeter o CPF de um cliente já existente informando seu próprio e-mail ou telefone, os campos do `Customer` no banco permanecem inalterados. O desafio de verificação é disparado exclusivamente para o canal previamente autenticado do titular.

3. **Invalidação Instantânea de Links de Convidados (GUEST-01):**  
   O link de convidados possui versão criptográfica de token atrelada a `ReservationParticipant.token_version`. Quando a organização substitui um convidado no painel administrativo, o bump da versão invalida tokens antigos com status HTTP 401 instantâneo.

4. **Conflito Temporal e Overbooking de Boletos (G-01):**  
   Boletos bancários possuem prazo de compensação bancária de 2 a 3 dias úteis. A janela de emissão foi fixada com antecedência mínima de 1 semana (7 dias) do embarque, e o prazo de vencimento do boleto foi fixado em **3 dias**. Ao emitir boleto, a reserva entra em `AWAITING_PAYMENT` e seu hold é estendido para a data de vencimento do boleto (3 dias), garantindo que as vagas fiquem seguras durante a compensação sem risco de overbooking próximo à viagem.

5. **Assinatura Criptográfica de Webhooks (PAY-02):**  
   Todas as notificações do Mercado Pago são validadas contra o cabeçalho `x-signature` usando HMAC SHA-256 com o segredo `MERCADOPAGO_WEBHOOK_SECRET`. Notificações com assinatura inválida ou ausente são descartadas imediatamente com HTTP 401.

---

## 5. Conclusão do Ponytail

A implementação cumpre integralmente os requisitos da especificação técnica, respeita a precedência sobre as épicas anteriores (E01, E03 e E04), elimina o uso de credenciais simuladas em ambientes comerciais/sandbox e garante a rastreabilidade total de todas as transações financeiras.

**Veredito:** **PASS** — Recomendado formalmente para Aceite Humano (`ACCEPTED`).
