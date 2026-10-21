# Revisão Adversarial (Grill) — Estágio 2 v0.1

**Data:** 21/10/2026  
**Revisor:** Agente Revisor Independente (SDD Grill/Constituição §5)  
**Alvo da Revisão:** [specs/active/Estagio2_Identidade_Pagamentos/spec.md](spec.md)  
**Classificação de Risco:** HIGH  

---

## 1. Resumo Executivo e Veredito

O Grill executou análise adversarial sistemática sobre a especificação do Estágio 2, confrontando os fluxos contra ataques de força bruta, duplicidade de pagamentos, assimetrias temporais entre provedores (Pix vs. Cartão vs. Boleto), vazamento de dados pessoais e consistência em concorrência PostgreSQL.

**Veredito:** **PROSSEGUIR COM 4 AJUSTES NORMATIVOS INCORPORADOS (PASS WITH REMARKS)**.  
Não foram identificadas novas decisões de produto bloqueantes; as lacunas detectadas foram devidamente sanadas e incorporadas como regras estritas na especificação.

---

## 2. Findings Adversariais e Resoluções

### G-01: Disparidade Temporal do Boleto Bancário vs. Janela de Hold (15 minutos)
- **Ataque / Vetor:** O hold de reserva padrão expira em 15 minutos. Um boleto bancário emitido pelo Mercado Pago tem vencimento de 2 a 3 dias úteis para compensação pelo BACEN. Se o hold expirar em 15 minutos, o cliente pagará o boleto no dia seguinte e a reserva já estará `EXPIRED`, gerando conflito de vagas e devoluções forçadas.
- **Resolução Normativa (Aprovada por Rodrigo em 21/10/2026):**
  1. O vencimento do boleto bancário é fixado em **3 dias**.
  2. Boletos bancários só podem ser emitidos no máximo até **1 semana antes do embarque** (`expedition.starts_at - 7 dias`). Se faltarem 7 dias ou menos para a viagem, a opção de boleto é bloqueada.
  3. Quando o método de pagamento selecionado for `BOLETO`, a reserva transiciona de `HELD` para `AWAITING_PAYMENT`, e o campo `held_until` é estendido para a data de vencimento do boleto (respeitando o teto de 7 dias antes do embarque).
  4. Se o boleto não for compensado até o vencimento estendido, o cron job de expiração marca a reserva como `EXPIRED` e libera a vaga.

### G-02: Retentativa após Recusa de Cartão de Crédito
- **Ataque / Vetor:** Se o cartão de crédito for rejeitado pelo gateway (`rejected` por saldo insuficiente ou recusa do emissor), marcar a reserva como `CANCELLED` imediatamente impede o cliente de tentar um segundo cartão ou pagar via PIX, gerando abandono forçado de carrinho.
- **Resolução Normativa:** A transação do cartão que for recusada atualiza o `Payment` correspondente para `FAILED`. A reserva **permanece em HELD** até o término do tempo de 15 minutos da sessão, permitindo que o frontend exiba a mensagem amigável de recusa e ofereça imediatamente a opção de submeter outro cartão ou chave PIX.

### G-03: Timeout e Resiliência do Disparo de E-mail SMTP (Gmail)
- **Ataque / Vetor:** Chamadas síncronas de envio de e-mail SMTP ao servidor do Google (`smtp.gmail.com:587`) sujeitas a instabilidade de rede ou rate limit poderiam travar a resposta HTTP do endpoint `/api/checkout/identify/`, resultando em timeout 504 no cliente ou repetição inadvertida de cliques.
- **Resolução Normativa:**
  1. O timeout de conexão e leitura do backend SMTP deve ser configurado explicitamente em 5 segundos (`EMAIL_TIMEOUT = 5`).
  2. A persistência do `VerificationChallenge` e a geração do código ocorrem **antes** da tentativa de envio.
  3. Se o SMTP falhar temporariamente, o desafio é mantido, o log operacional registra o erro com severidade WARNING, e a API retorna mensagem tratada orientando o reenvio após 30 segundos, sem vazar tracebacks de infraestrutura.

### G-04: Proteção contra Enumeração de CPFs no Reacesso (`/api/me/auth/lookup/`)
- **Ataque / Vetor:** Atacantes poderiam submeter lotes de CPFs no portal do cliente para identificar quais cidadãos possuem reserva contratada na expedição.
- **Resolução Normativa:**
  1. A resposta do endpoint `/api/me/auth/lookup/` retorna resposta com mesmo status HTTP e estrutura padronizada, independentemente de o CPF ter ou não reservas cadastradas:  
     `{ "status": "CHALLENGE_CREATED", "message": "Se houver uma reserva cadastrada para este CPF, um código de verificação foi enviado aos seus canais cadastrados." }`.
  2. Aplicação de limitação de taxa (rate limit) de no máximo 5 requisições de lookup por IP/CPF a cada 15 minutos.

---

## 3. Conformidade com a Constituição (§ 5)

A revisão adversarial confirma que:
1. Todos os fluxos de pagamento (PIX, Cartão, Boleto) possuem transições de estado bem definidas e reversíveis.
2. A autorização por objeto e o isolamento de dados pessoais foram preservados.
3. Não há dependência de dados voláteis de cliente (`localStorage` ou `dev_code`).
4. Os achados G-01 a G-04 foram incorporados aos requisitos normativos do Estágio 2.
