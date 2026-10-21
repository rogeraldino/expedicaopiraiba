# Estágio 2 — Identidade e venda real completas

**Versão:** 0.2 — 21/10/2026  
**Classificação de Risco:** HIGH (Constituição §§ 3, 4, 5)  
**Status do Ciclo:** IN_PROGRESS — READY formal declarado por Rodrigo em 21/10/2026 («concordo com todos os pontos, ready e começa»)  
**Responsável pelo Produto:** Rodrigo  
**Incremento Integrante:** [Entrega Operacional do MVP](../ENTREGA_OPERACIONAL_MVP.md)  
**Achados Mitigados:** AUTH-01, AUTH-02, AUTH-03, PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, CAP-01, GUEST-01, MSG-01  
**Decisões Humanas Incorporadas (21/10/2026):**  
1. Endereço condicional no checkout para Boleto Bancário (BACEN/Mercado Pago); Pix e Cartão permanecem com checkout enxuto.  
2. Contingência do Canal de OTP: E-mail (Gmail SMTP autenticado) ativo imediatamente no fluxo; adaptador Meta WhatsApp implementado e preparado para ativação imediata pós-aprovação do template/faturamento na Meta.  
3. Vencimento do Boleto Bancário de 3 dias e emissão permitida no máximo até 1 semana (7 dias) antes do embarque (`expedition.starts_at - 7 dias`). Se a expedição ocorrer em menos de 7 dias, a opção de boleto fica indisponível.

---

## 1. Escopo e Não-Objetivos

### 1.1. No Escopo (MUST)
1. **Identidade e Verificação OTP Confiáveis:**
   - Envio de código de 6 dígitos via canal de contingência validado (E-mail SMTP Gmail) e suporte ao adaptador Meta WhatsApp Cloud API.
   - Remoção completa de `dev_code` das respostas de API em ambientes comerciais/sandbox.
   - Preservação estrita dos contatos de cliente pré-existente no banco antes da validação do desafio de posse do canal.
   - Correção atômica da contagem de tentativas erradas (persistência durável do incremento sem rollback por `ValidationError`).
   - Bloqueio após 5 tentativas incorretas ou expiração de 5 minutos.
2. **Reacesso e Sessão do Comprador:**
   - Substituição do bypass de login por CPF + telefone legado (E04) por desafio OTP com envio ao contato já verificado do cliente.
   - Emissão de sessão autenticada de longa duração (30 dias) após validação OTP bem-sucedida.
   - Limitação de taxa (rate limit) de requisições de código para mitigar ataques de enumeração ou negação de serviço.
3. **Isolamento e Versionamento do Link de Convidado:**
   - Inclusão de versão de acesso (`token_version`) no participante. Substituição manual de participante invalida instantaneamente tokens emitidos anteriormente.
4. **Matemática Financeira e Ocupação Corretas:**
   - Multiplicação do sinal (`expedition.deposit_cents * participant_count`) nas opções de pagamento do backend e espelhamento na interface.
   - Cálculo de ocupação sem join cartesiano com a tabela de pagamentos (`expeditions_with_occupancy` e validação de concorrência em `create_hold`).
   - Garantia transacional com `select_for_update` no PostgreSQL 17 contra overbooking na última vaga.
5. **Gateway de Pagamento Mercado Pago Completo (Pix, Cartão e Boleto):**
   - **PIX:** Chave de idempotência determinística vinculada à reserva/tentativa; QR Code base64 e código copia e cola persistidos; acompanhamento do status sem botão simulado.
   - **Cartão de Crédito:** Tokenização de cartão com suporte a parcelamento, captura e resposta síncrona com tratamento de recusa ou aprovação.
   - **Boleto Bancário:** Coleta condicional de endereço do pagador (CEP, logradouro, número, complemento, bairro, cidade, UF) exigido pelo BACEN; retorno de linha digitável e link do boleto para impressão/pagamento.
   - **Isolamento de Simuladores:** Endpoints e botões de simulação de confirmação (`/simulate-confirmation/`, `confirm/`) restritos estritamente ao ambiente local mock/testes, rejeitados com HTTP 403/404 em produção e sandbox.
6. **Webhook Transacional Seguro e Reconciliação:**
   - Validação criptográfica obrigatória do cabeçalho `x-signature` (HMAC SHA-256). Ausência de assinatura com segredo configurado retorna 401 Unauthorized imediatamente.
   - Reconciliação estrita: consulta do pagamento no Mercado Pago conferindo se `transaction_amount` confere exatamente com o valor esperado, moeda é `BRL` e `external_reference` corresponde à reserva.
   - Idempotência durável via `PaymentTransaction`: registro auditável antes do processamento e confirmação; proteção contra pagamentos duplicados ou tardios após cancelamento/expiração da reserva.
7. **Notificações Transacionais:**
   - Disparo automático de e-mail de confirmação de compra após aprovação do pagamento, contendo identificador da reserva, resumo da expedição, valor pago e link seguro de gerenciamento (`minha-expedicao`).

### 1.2. Não-Objetivos (MUST NOT)
- Cobranças financeiras reais de cartões de clientes em homologação (utilizar exclusivamente credenciais de teste do Mercado Pago com cartões de teste oficiais).
- Disparo de mensagens ativas WhatsApp em produção sem template aprovado pela Meta.
- Alocação de estoque ou reserva comercial via dados salvos no `localStorage` do navegador.

---

## 2. Contrato de Identidade, OTP e Canais de Notificação

### 2.1. Fluxo de Identificação e Geração de Código
1. Endpoint `POST /api/checkout/identify/`:
   - Entrada: `{ "cpf": str, "full_name": str, "email": str, "phone": str }`.
   - Normalização: CPF para 11 dígitos, telefone para formato E.164 (`+55...`), e-mail em minúsculas sanitizado.
   - Se o cliente já existir com o CPF informado:
     - Os dados gravados no banco **NÃO SÃO MODIFICADOS**.
     - O destinatário do OTP é selecionado a partir do contato cadastrado e validado do cliente (ou o e-mail cadastrado).
   - Se o cliente for novo:
     - O registro do cliente é criado ou preparado em estado preliminar, gravando os dados fornecidos.
   - Um novo `VerificationChallenge` é gerado com código numérico criptograficamente aleatório de 6 dígitos (`secrets.randbelow(1_000_000)`), digest seguro com PBKDF2 (`make_password`), 5 tentativas permitidas e expiração em 5 minutos.
   - O código é enviado imediatamente via adaptador de e-mail (Gmail SMTP). O adaptador de WhatsApp é acionado em contingência/preparo quando configurado e com template disponível.
   - Retorno da API: `{ "challenge_id": str, "masked_destination": str, "channel": "EMAIL" }`.
   - **Regra de Segurança Estrita:** O campo `dev_code` **NUNCA** é retornado na resposta da API quando `settings.DEBUG` for `False` ou em ambiente de sandbox/produção.

### 2.2. Verificação Atômica e Tratamento de Tentativas Incorretas
1. Endpoint `POST /api/checkout/verify/`:
   - Entrada: `{ "challenge_id": str, "code": str }`.
   - O incremento de `attempts` no `VerificationChallenge` é gravado de forma durável antes de qualquer validação de código ou lançamento de erro.
   - Se `challenge.attempts >= 5` ou `challenge.expires_at <= timezone.now()` ou `challenge.verified_at is not None`:
     - Retorna HTTP 400 com erro específico: `"Código expirado ou limite de tentativas excedido. Solicite um novo código."`
   - Se o código não conferir (`check_password` falso):
     - O desafio grava `attempts` atualizado no banco em transação autônoma.
     - Retorna HTTP 400: `"Código de verificação incorreto."`
   - Se o código conferir:
     - Marca `verified_at = timezone.now()` e `consumed_at = timezone.now()`.
     - Atualiza os contatos do cliente com os dados confirmados nesta sessão (`email_verified_at = timezone.now()` se o canal foi e-mail).
     - Retorna `{ "verification_token": str, "customer_session_token": str }` assinados criptograficamente.

### 2.3. Adaptador de Mensagens e Notificações
1. Módulo `apps.notifications.services` (ou extensão em `apps.operations`):
   - `EmailNotificationService`: utiliza `django.core.mail.backends.smtp.EmailBackend` com as credenciais autenticadas de `expedicaopiraiba@gmail.com`.
   - Timeout de conexão e transmissão SMTP estritamente configurado em 5 segundos (`EMAIL_TIMEOUT = 5`). A criação do registro de desafio (`VerificationChallenge`) ocorre antes da tentativa de envio para garantir persistência. Em caso de indisponibilidade transitória do servidor SMTP, a API retorna mensagem tratada para retentativa em 30 segundos, sem vazar tracebacks de infraestrutura.
   - `WhatsAppNotificationService`: mantém o cliente Meta Cloud API preparado com o endpoint `/v21.0/{phone_number_id}/messages`. Se a chamada retornar código de template ausente/faturamento pendente, o serviço faz fallback silencioso garantindo que o e-mail transacional foi entregue e registrando o log operacional.

---

## 3. Reacesso Seguro ao Portal do Cliente (Portal Login)

### 3.1. Substituição do Endpoint Inseguro E04
1. O endpoint `POST /api/me/auth/lookup/` deixa de aceitar simplesmente CPF e telefone para emitir o token de sessão do comprador.
2. Novo fluxo de login no Portal:
   - Passo 1: `POST /api/me/auth/lookup/`:
     - Entrada: `{ "cpf": str }` (ou `{ "identifier": str }`).
     - Normalização do CPF.
     - Resposta padronizada anti-enumeração: quer o CPF possua ou não reservas cadastradas, o endpoint responde com HTTP 200:
       `{ "status": "CHALLENGE_CREATED", "message": "Se houver uma reserva cadastrada para este CPF, um código de verificação foi enviado aos seus canais cadastrados." }`.
     - Caso o cliente exista, localiza o registro, cria o `VerificationChallenge` e dispara o OTP para o e-mail cadastrado (e WhatsApp).
     - Proteção contra força bruta: rate limit de no máximo 5 requisições de lookup por IP/CPF a cada 15 minutos.
   - Passo 2: `POST /api/me/auth/verify/`:
     - Entrada: `{ "challenge_id": str, "code": str }`.
     - Valida o desafio sob as mesmas regras do § 2.2.
     - Retorna `{ "customer_session_token": str, "reservations_count": int }`.

---

## 4. Isolamento e Versionamento de Links de Convidados (Guest Tokens)

### 4.1. Invalidação Imediata na Substituição
1. Adição do campo `token_version` (inteiro positivo, default 1) no modelo `ReservationParticipant`.
2. O payload assinado do `guest_token` passa a conter:
   `{ "participant_id": str, "reservation_id": str, "token_version": int }`.
3. Ao resolver o convidado via `participant_from_guest_token(token)`:
   - Se `payload["token_version"] != participant.token_version`:
     - Rejeita com `ValidationError("Este link de convidado foi revogado ou substituído.")` -> HTTP 401.
4. Quando o organizador ou titular substitui o passageiro (`operations/views.py` ou endpoint de participante), o backend incrementa `participant.token_version += 1`, invalidando qualquer link em posse do convidado anterior.

---

## 5. Matemática Financeira, Vagas e Concorrência

### 5.1. Cálculo do Sinal e Valores da Reserva
1. O valor do sinal exigido para bloqueio inicial da reserva (`deposit_cents`) no caso de plano `DEPOSIT` é:
   $$\text{amount\_due} = \text{expedition.deposit\_cents} \times \text{participant\_count}$$
2. O valor total da reserva é:
   $$\text{total\_price\_cents} = \text{expedition.price\_per\_person\_cents} \times \text{participant\_count}$$
3. O saldo restante para quitação posterior é:
   $$\text{remaining\_balance\_cents} = \max(\text{total\_price\_cents} - \text{paid\_amount\_cents}, 0)$$
4. A interface de checkout e o backend devem apresentar e cobrar rigorosamente os mesmos centavos para 1, 2, 4 ou mais participantes.

### 5.2. Ocupação e Concorrência sem Overbooking
1. Correção de `expeditions_with_occupancy()`:
   - A agregação de vagas ocupadas não pode duplicar reservas que possuem múltiplos pagamentos (`Payment`).
   - Implementação via subquery de reservas ativas agrupadas ou anotação sem junção cartesiana na tabela de pagamentos.
2. Bloqueio transacional em `create_hold`:
   - Utilização de `Expedition.objects.select_for_update().get(...)` no início da transação atômica.
   - Cálculo das vagas em hold ativas (`held_until > now()`) somadas às vagas confirmadas/pagas.
   - Se `occupied + len(names) > expedition.capacity`:
     - Lança `ValidationError("Não há vagas suficientes para esta reserva.")` -> HTTP 400.

---

## 6. Gateway Mercado Pago — PIX, Cartão e Boleto Bancário

### 6.1. Protocolo e Implementação do Gateway
O contrato do gateway `backend/apps/payments/gateways.py` é expandido para cobrir os três métodos aprovados:

```python
class PaymentGateway(Protocol):
    def create_pix(self, *, reservation, amount_cents, customer, idempotency_key) -> GatewayPayment: ...
    def create_card_payment(self, *, reservation, amount_cents, customer, card_token, installments, payment_method_id, idempotency_key) -> GatewayPayment: ...
    def create_boleto(self, *, reservation, amount_cents, customer, address_data, idempotency_key) -> GatewayPayment: ...
    def refund_payment(self, *, external_id, amount_cents) -> dict: ...
```

### 6.2. Chave de Idempotência Determinística
Para mitigar retries de rede e cobranças duplicadas (PAY-04), o cabeçalho `X-Idempotency-Key` enviado ao Mercado Pago é construído a partir de:
$$\text{idempotency\_key} = \text{hash}(\text{reservation.id} + ":" + \text{purpose} + ":" + \text{method} + ":" + \text{amount\_cents} + ":" + \text{attempt})$$
Isso garante que uma retentativa de envio da mesma cobrança não gere múltiplos pagamentos no gateway.

### 6.3. Especificações por Método de Pagamento

#### A) PIX Instantâneo
- `payment_method_id = "pix"`.
- Validade: 15 minutos (sincronizada com o `held_until` da reserva).
- Retorno: `pix_copy_paste` (QR Code texto) e `qr_code_base64` para renderização imediata na tela do checkout.
- Acompanhamento: o checkout realiza polling suave a cada 4 segundos em `GET /api/payments/{payment_id}/status/` para detectar confirmação sem depender de botão manual de simulação.

#### B) Cartão de Crédito
- Token gerado de forma segura no frontend via SDK Mercado Pago JS (`mp.fields.createCardToken(...)`). O backend **NÃO RECEBE** número de cartão, validade ou CVV (PCI-DSS compliance).
- O backend recebe `token`, `installments`, `payment_method_id` e dados do comprador.
- Status retornados pela API do Mercado Pago:
  - `approved`: o pagamento é imediatamente transicionado para `PAID`, a reserva para `CONFIRMED`/`PAID`, e o cliente avança para sucesso.
  - `in_process`: fica em `PROCESSING`; aguarda resolução via Webhook.
  - `rejected`: o pagamento é marcado como `FAILED`. A reserva **permanece em HELD** até o término do tempo de 15 minutos, permitindo que o cliente submeta imediatamente outro cartão de crédito ou troque para a opção PIX sem perder as vagas reservadas.

#### C) Boleto Bancário
- Exibição de campos de endereço na interface de checkout acionada **exclusivamente** quando a aba Boleto Bancário estiver selecionada:
  - CEP (`zip_code`)
  - Logradouro / Rua (`street_name`)
  - Número (`street_number`)
  - Complemento (`complement`, opcional)
  - Bairro (`neighborhood`)
  - Cidade (`city`)
  - Estado / UF (`federal_unit`, 2 letras)
- Os dados do endereço são persistidos no `CustomerProfile` do cliente.
- A requisição para a API do Mercado Pago inclui o bloco `payer.address`:
  ```json
  "payer": {
    "email": "...",
    "first_name": "...",
    "last_name": "...",
    "identification": { "type": "CPF", "number": "..." },
    "address": {
      "zip_code": "...",
      "street_name": "...",
      "street_number": "...",
      "neighborhood": "...",
      "city": "...",
      "federal_unit": "..."
    }
  }
  ```
- O Mercado Pago retorna a URL do boleto gerado (`ticket_url` ou `external_resource_url`), a linha digitável do código de barras (`barcode`) e a data de vencimento (`date_of_expiration`).
- Ambos são salvos no modelo `Payment` e exibidos ao cliente com botão de copiar código de barras e link para abrir/imprimir o boleto.
- **Tratamento Temporal do Boleto:**
  - A emissão de boleto bancário é permitida exclusivamente para expedições cuja data de início esteja a **mais de 7 dias** da data atual (`starts_at - now() > 7 dias`). Se faltar 7 dias ou menos para o embarque, a opção de boleto é desabilitada na interface e rejeitada pelo backend.
  - A data de vencimento do boleto bancário é fixada em **3 dias** a partir da emissão (respeitando o teto de 7 dias antes do embarque).
  - A emissão do boleto transiciona a reserva de `HELD` para `AWAITING_PAYMENT` e estende o `held_until` da reserva para coincidir com a data de vencimento do boleto. Caso o boleto não seja compensado até essa data, o job de expiração cancela o hold e libera a vaga.

### 6.4. Isolamento dos Simuladores (Anti-Bypass)
- Os endpoints de simulação (`SimulateConfirmationView`, `BalancePaymentConfirmView` com método simulado) são desabilitados se o ambiente for comercial ou se `settings.PAYMENT_GATEWAY != "FAKE"`.
- Em produção e sandbox, qualquer requisição para endpoints de confirmação simulada retorna HTTP 403 Forbidden.

---

## 7. Webhook Transacional, Reconciliação e Pagamentos Tardios

### 7.1. Validação Criptográfica Obrigatória (HMAC SHA-256)
No endpoint `POST /api/webhooks/mercadopago/`:
1. Se `settings.MERCADOPAGO_WEBHOOK_SECRET` estiver configurado e o cabeçalho `x-signature` ou `x-request-id` estiver ausente:
   - Retorna imediatamente **HTTP 401 Unauthorized**.
2. O cálculo da assinatura segue o algoritmo canônico da documentação oficial:
   $$v1 = \text{HMAC-SHA256}(\text{secret}, \text{"id:"} + data\_id + \text{";request-id:"} + request\_id + \text{";ts:"} + ts + \text{";"})$$
3. Se a assinatura não bater com `v1`, retorna **HTTP 401 Unauthorized**.

### 7.2. Reconciliação Estrita contra a API
1. O backend consulta o pagamento diretamente na API do Mercado Pago via `GET https://api.mercadopago.com/v1/payments/{data_id}`.
2. Validações obrigatórias antes de qualquer alteração de estado:
   - A moeda (`currency_id`) deve ser obrigatoriamente `"BRL"`.
   - O identificador da reserva informado em `external_reference` deve coincidir exatamente com `payment.reservation_id`.
   - O valor retornado (`transaction_amount`) deve coincidir com `payment.amount_cents / 100.0` (tolerância zero).
3. Se qualquer validação divergir:
   - O evento é registrado em `PaymentTransaction` com status `REJECTED_MISMATCH`.
   - Um alerta operacional `PAYMENT_RECONCILIATION_REQUIRED` é gerado na reserva.
   - Retorna HTTP 200 (para parar o retry do webhook no provedor), mas o pagamento NÃO é confirmado.

### 7.3. Pagamento Tardio e Overbooking
1. Se o webhook notificar `approved` para uma reserva cujo status seja `EXPIRED` ou `CANCELLED`:
   - Se as vagas ainda estiverem disponíveis na expedição: o sistema reativa a reserva para `CONFIRMED` e aloca as vagas.
   - Se a expedição já estiver com capacidade esgotada (overbooking evitado):
     - A reserva **NÃO** é confirmada.
     - O pagamento é marcado com flag `REQUIRES_REFUND`.
     - Um evento de auditoria `LATE_PAYMENT_OVERBOOKING_PREVENTED` é registrado.
     - A coordenação é notificada para estorno imediato no painel do Mercado Pago.

---

## 8. Notificações Transacionais e Confirmação de Compra

1. Imediatamente após a confirmação transacional do pagamento (`process_paid_event`):
   - O sistema dispara o e-mail de confirmação de compra para o comprador contendo:
     - Nome da expedição, data de embarque e ponto de encontro.
     - Quantidade de participantes e plano pago (sinal ou integral).
     - Comprovante financeiro com valor e método.
     - Link direto com token seguro para acesso imediato a `Minha Reserva` e preenchimento da ficha de embarque / bebidas.
   - Registro de evento de histórico `ORDER_CONFIRMATION_SENT` na reserva.

---

## 9. Precedência Normativa e Supersessões

1. **Precedência sobre E04:** A Seção 3 desta especificação supersede formalmente o mecanismo de autenticação por CPF + telefone previsto na Seção 2.1 da Épica E04 (`specs/archive/E04_Portal-Cliente-Ficha/spec.md`). A autenticação passwordless no portal do cliente exige obrigatoriamente a comprovação de posse do canal via desafio OTP.
2. **Precedência sobre E01 e E03:** A fórmula de cálculo do sinal desta especificação (Seção 5.1) supersede qualquer interpretação anterior de sinal único por reserva, estabelecendo a regra uniforme de sinal por participante.

---

## 10. Matriz Mínima de Aceite (Gating Criteria)

| ID | Requisito | Evidência Necessária | Prova Esperada |
|---|---|---|---|
| **AC01** | OTP Real sem Vazamento de `dev_code` | Teste automatizado de API e inspeção de payload em modo não-debug | Requisição `/api/checkout/identify/` retorna `masked_destination` sem chave `dev_code`; e-mail real chega via SMTP; código incorreto incrementa tentativas de forma durável (6 falhas bloqueiam o desafio). |
| **AC02** | Proteção de Dados de Cliente Existente | Teste de unidade e integração | Submeter CPF de cliente já cadastrado com e-mail/telefone diferentes não altera a tabela `Customer` antes da validação do OTP com sucesso. |
| **AC03** | Reacesso com Posse de Canal | Teste funcional no `/api/me/auth/` | Tentativa de reacesso sem código OTP falha; validação correta emite `customer-session-token` válido por 30 dias com rate-limit ativo. |
| **AC04** | Revogação de Link de Convidado | Teste de substituição de passageiro | Convidado A acessa via token versão 1; admin substitui por passageiro B (bump `token_version` para 2); link de A passa a retornar 401 Unauthorized imediatamente. |
| **AC05** | Cálculo Uniforme do Sinal (1, 2 e 4 vagas) | Teste de cálculo e concorrência PostgreSQL | Checkout para 2 participantes calcula `2 * expedition.deposit_cents`; vitrine, checkout e backend solicitam o mesmo valor de sinal e saldo restante. |
| **AC06** | Ocupação Consistente sem Duplicação | Teste com reserva paga em duas parcelas (sinal + saldo) | `expeditions_with_occupancy()` conta exatamente os participantes da reserva uma única vez, sem inflar vagas ocupadas após o segundo pagamento. |
| **AC07** | PIX Dinâmico Mercado Pago com Idempotência | Teste com chaves de teste Mercado Pago | Cobrança PIX gerada com QR Code e Copia-e-Cola; `X-Idempotency-Key` determinística comprovada em retries de rede. |
| **AC08** | Cartão de Crédito e Recusa/Aprovação | Teste com token de cartão de homologação MP | Transação com cartão aprovado transiciona reserva imediatamente; cartão recusado preserva hold para troca de forma de pagamento. |
| **AC09** | Boleto Bancário com Endereço Condicional | Teste de contrato e UI de checkout | Seleção de Boleto exibe campos de endereço; payload ao MP inclui `payer.address`; resposta devolve linha digitável e link do boleto. |
| **AC10** | Webhook Criptográfico e Reconciliação | Teste de webhook com e sem assinatura / divergência | Ausência de assinatura HMAC retorna 401; divergência de valor/moeda rejeita sem confirmar; evento repetido é idempotente; confirmação dispara e-mail transacional. |
