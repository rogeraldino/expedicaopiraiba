# Revisão Adversarial Pré-Implementação (Grill) — Épica E03

> **Spec Alvo:** `specs/active/E03_Venda-Direta-Manifesto/spec.md` (v0.1)<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Data:** 19/09/2026<br/>
> **Objetivo:** Identificar vulnerabilidades em concorrência, omissões semânticas, inconsistências cadastrais e brechas operacionais antes do aceite de READY humano.

---

## 1. Ataque à Especificação e Resoluções Adversariais

### Pergunta 1: Concorrência entre Venda Manual no Admin e Checkout Público Simultâneo
- **Ataque:** O que acontece se houver 1 vaga restante na expedição e, no exato milissegundo em que o cliente clica "Gerar PIX" no site público, o administrador clica "Criar Reserva Manual"?
- **Resolução Normativa:**
  - Ambas as operações MUST utilizar `transaction.atomic()` com `Expedition.objects.select_for_update().get(id=expedition_id)`.
  - A primeira transação a obter o lock valida e consome a vaga. A segunda transação é bloqueada até o commit da primeira e, ao avaliar `available_spots`, falha com erro semântico claro (`HTTP 409 Conflict` ou `ValidationError: Não há vagas disponíveis suficientes`).
  - Impossibilidade matemática de overbooking garantida no nível do banco de dados PostgreSQL.

### Pergunta 2: Status Inicial `HELD` vs `CONFIRMED` na Criação Manual
- **Ataque:** Se o admin criar a reserva manual como `HELD`, qual deve ser a expiração do hold? Os 15 minutos do checkout online ou mais tempo? E se for `CONFIRMED` sem pagamento informado?
- **Resolução Normativa:**
  - Para vendas manuais (WhatsApp/balcão), um hold de 15 minutos é inviável, pois o cliente pode estar dirigindo ou aguardando o expediente bancário.
  - Para `status = HELD`, o payload aceitará `hold_hours` (inteiro entre 1 e 72 horas, com padrão de 24 horas). O worker existente de `expire_holds` continuará expirando a reserva automaticamente caso o cliente não pague até `hold_expires_at`.
  - Para `status = CONFIRMED`, o admin DEVE selecionar `payment_type`:
    - `FULL`: Gera `Payment` confirmado com 100% do valor total da reserva.
    - `DEPOSIT`: Gera `Payment` confirmado com 20% do valor (sinal à vista da expedição), deixando os 80% restantes calculados em `balance_amount` e data de vencimento calculada automaticamente (`balance_due_at`).
    - Uma reserva manual NÃO pode ser marcada como `CONFIRMED` sem registro atômico de pagamento (seja total ou sinal).

### Pergunta 3: Substituição de Participante e Preferências Existentes
- **Ataque:** Se um participante for substituído por outro pescador, o que acontece com as preferências de bebidas e restrições alimentares que ele já havia selecionado?
- **Resolução Normativa:**
  - Quando a substituição formal for executada (`is_substitution=True`), o sistema registrará no histórico de auditoria o nome do titular anterior e o motivo.
  - O status de cadastro do participante substituído volta para `onboarding_status = 'PENDING'`, suas restrições alimentares são limpas (para evitar servir comida errada para a nova pessoa) e suas preferências de bebidas são resetadas para o padrão neutro da expedição até que a nova pessoa confirme seus dados.

### Pergunta 4: Neutralização de Injeção em CSV do Manifesto de Embarque
- **Ataque:** Se um pescador ou comprador tiver um nome ou telefone começando com `=CMD(...)` ou `@SUM(...)`, a exportação do Manifesto em CSV pode executar comandos maliciosos no Excel do operador da pousada.
- **Resolução Normativa:**
  - Idêntico ao padrão blindado de lista de compras da E01/E02: qualquer campo de texto exportado no CSV que comece com `=`, `+`, `-`, `@` ou caracteres de controle deve ser prefixado com apóstrofo (`'`) ou aspas sanitizadas antes da escrita.

### Pergunta 5: Privacidade e LGPD no Manifesto de Embarque
- **Ataque:** O manifesto de embarque contém dados sensíveis (CPF, RG, alergias, contato de emergência). Quem tem permissão de visualizar e exportar?
- **Resolução Normativa:**
  - O endpoint `/api/operations/expeditions/{id}/manifest/` é de uso exclusivo do painel administrativo autenticado (`IsAuthenticated` / staff).
  - O manifesto público não existe; o link do participante só enxerga os próprios dados.

### Pergunta 6: Validação de CPF e Telefone na Reserva Manual
- **Ataque:** O admin pode digitar um telefone sem DDD ou CPF com dígitos repetidos inválidos, gerando inconsistências cadastrais e quebrando envio de WhatsApp.
- **Resolução Normativa:**
  - O serializer administrativo valida formato de CPF com algoritmo canônico e normaliza números de WhatsApp para o padrão E.164 / formato nacional com DDD.

---

## 2. Veredito do Grill

- Concorrência e prevenção de overbooking: **BLINDADO COM LOCK PESSIMISTA**
- Prazos de hold flexíveis para negociação comercial: **RESOLVIDO (1 a 72h)**
- Substituição de participantes com histórico auditado: **ESPECIFICADO**
- Segurança de injeção em planilhas (CSV Injection): **SANITIZAÇÃO OBRIGATÓRIA**
- Veredito da Revisão Adversarial: **PASS — Apto para declaração formal de READY pelo responsável humano.**
