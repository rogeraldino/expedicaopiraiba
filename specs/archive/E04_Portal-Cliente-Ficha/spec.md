# Especificação Funcional e Técnica — Épica E04: Portal do Cliente, Reacesso e Ficha de Embarque Digital

> **Identificador Normativo:** `E04-PORTAL-CLIENTE-FICHA`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Status:** `ACCEPTED` (Aprovado formalmente por Rodrigo em 19/09/2026)<br/>
> **Data de Criação:** 19/09/2026<br/>
> **Data de Entrada em READY:** 19/09/2026<br/>
> **Data de Homologação / ACCEPTED:** 19/09/2026<br/>
> **Responsável Humano:** Rodrigo<br/>
> **Nota do Responsável Humano:** "Sim, marque como ready e continue" / Aceite formal: "aceito, e qual a proxima?"<br/>
> **Governança:** docs/sdd/CONSTITUTION.md e docs/sdd/NORMATIVE_INDEX.json

---

## 1. Contexto e Problema

Com as Épicas E01, E02 e E03 concluídas, o organizador tem controle total da vitrine, pousadas, cardápio mestre, vendas manuais e emissão de manifesto. Entretanto, a jornada digital do cliente e de seus convidados ainda possui fricções críticas:

1. **Perda de Sessão e Falta de Reacesso:** A autenticação do comprador no checkout é mantida apenas em `sessionStorage`. Se o cliente fechar a aba, mudar de navegador ou abrir o link em outro dispositivo, o acesso a `/minha-expedicao/` é rejeitado como 401 ("Sessão não encontrada"). Não existe botão ou modal no cabeçalho do site para reautenticação.
2. **Ausência da Ficha Cadastral no Frontend:** Embora a API já valide campos como CPF, telefone, nascimento e emergência, o frontend `CustomerJourney` exibe apenas preferências de bebidas, checklist e tralhas. Não há formulário para preenchimento dos dados pessoais dos passageiros, o que mantém o status `onboarding_status` travado em `PENDING` e prejudica a completude do manifesto oficial de embarque.
3. **Privacidade e Isolamento da Dupla (Link de Convidado):** Em pescarias de duplas ou quartetos, o titular frequentemente paga o pacote integral ou sinal e precisa que seu companheiro de barco preencha seus próprios dados, bebidas e restrições. No entanto, o titular não deseja compartilhar o acesso que expõe saldo financeiro e botão de pagamento PIX com o parceiro.
4. **Links de Cobrança sem Autenticação Automática:** Quando o administrador compartilha o link da reserva gerado pelo painel (E03), o cliente precisa autenticar-se de forma transparente, sem burocracia de senhas ou códigos esquecidos.

---

## 2. Escopo e Não-Objetivos

### 2.1. O que ESTÁ no escopo (MUST)

1. **Reacesso e Login Simplificado do Cliente (Passwordless):**
   - Botão **"Minha Reserva"** no cabeçalho do site (`SiteHeader`), acessível em desktop e dispositivos móveis.
   - Modal/Página de acesso onde o cliente informa seu CPF e WhatsApp/Telefone cadastrados.
   - Endpoint `POST /api/me/auth/lookup/` que valida o CPF e telefone do cliente, retornando um token assinado de sessão de longa duração (`customer-session-token`) com validade de 30 dias.
   - Persistência com fallback seguro (`localStorage` com espelhamento em `sessionStorage`).
   - Endpoint `GET /api/me/reservations/` que lista todas as expedições ativas e históricas associadas ao cliente, com link direto para cada reserva.

2. **Acesso Direto com Token Criptografado (Magic Links):**
   - Suporte na rota de reserva para receber token assinado via query param ou rota direta (`/expedicoes/[slug]/minha-expedicao/[id]?auth=<token>` ou `/reserva/<token>`), autenticando o comprador imediatamente.

3. **Formulário Completo de Ficha de Embarque (`CustomerJourney`):**
   - Nova aba ou bloco de destaque no painel do viajante: **"Ficha de Embarque"** para cada participante da reserva.
   - Coleta e validação estruturada dos seguintes campos:
     - Nome Completo (obrigatório);
     - CPF (obrigatório, com validação de 11 dígitos e máscara);
     - Data de Nascimento (obrigatório);
     - Telefone / WhatsApp do participante (obrigatório);
     - Contato de Emergência: Nome Completo (obrigatório) e Telefone (obrigatório);
     - Tamanho de Colete Salva-Vidas / Camiseta UV (P, M, G, GG, XG, EXG);
     - Observações Médicas e de Saúde (alergias a medicamentos, condições crônicas, cuidados especiais).
   - Ao salvar com dados válidos:
     - Atualização do participante via API;
     - Transição do `onboarding_status` para `COMPLETED` quando todos os campos obrigatórios estiverem preenchidos;
     - Atualização instantânea da barra de progresso da expedição ("Participantes cadastrados").

4. **Link de Convidado / Companheiro de Barco (Isolamento Financeiro):**
   - Geração de token assinado específico para cada participante (`participant_access_token`).
   - Botão na interface do titular: *"Copiar Link do Parceiro de Barco"* com mensagem pronta para envio.
   - Rota e tela dedicada de Convidado (`/convidado/[token]`):
     - Exibe detalhes operacionais da viagem (nome da expedição, pousada parceira, datas e ponto de encontro);
     - Permite que o convidado preencha exclusivamente a **sua** ficha de embarque, **suas** preferências de bebidas e restrições alimentares, e **seu** checklist;
     - **Regra de Segurança Estrita:** O convidado **NÃO visualiza** valores totais da reserva, valores já pagos, saldo devedor nem botões de cobrança/pagamento PIX.

---

### 2.2. O que NÃO está no escopo (NON-GOALS)

- Criação de sistema tradicional de login com senha alfanumérica fixa ou recuperação de senha por e-mail (a autenticação do MVP é estritamente passwordless via CPF + Telefone e tokens assinados HMAC).
- Aluguel/comercialização detalhada de tralhas e varas de pesca (mantido como postergado conforme decisão formal do stakeholder).
- Fluxo de despesas financeiras operacionais internas (combustível, pousada, guias), reservado para o backlog financeiro.

---

## 3. Modelagem de Dados e Contratos de API

### 3.1. Campos no Modelo `ReservationParticipant`

Para atender a todos os requisitos de segurança e logística marítima/fluvial:
- `cpf` (CharField 11, já existente);
- `birth_date` (DateField, já existente);
- `phone` (CharField 20, já existente);
- `emergency_contact_name` (CharField 160, já existente);
- `emergency_contact_phone` (CharField 20, já existente);
- `vest_size` (CharField 10, escolhas: `P`, `M`, `G`, `GG`, `XG`, `EXG`, default `G`);
- `health_notes` (TextField, para alergias medicamentosas e cuidados especiais);
- `guest_token_secret` (UUID/CharField para revogação/identificação de tokens de convidado).

### 3.2. Novos Endpoints de API

1. **`POST /api/me/auth/lookup/`**
   - *Payload:* `{"cpf": "12345678901", "phone": "62981612128"}`
   - *Comportamento:* Busca o `Customer` correspondente normalizando dígitos. Caso encontre e valide os dados, gera token assinado `customer-session-token` (validade de 30 dias).
   - *Retorno:* `{"token": "<signed_token>", "customer": {"id": "...", "full_name": "...", "email": "..."}}`

2. **`GET /api/me/reservations/`**
   - *Header:* `Authorization: Bearer <customer-session-token>`
   - *Comportamento:* Retorna todas as reservas do cliente com dados resumidos da expedição, status, datas, link direto e status de preenchimento.

3. **`GET /api/me/guest/<signed_token>/`**
   - *Comportamento:* Valida o token do participante. Retorna payload do convidado contendo dados operacionais da expedição, dados cadastrais do participante, bebidas e checklist, **sem nenhuma propriedade de valores, preços, pagamentos ou PIX**.

4. **`PATCH /api/me/guest/<signed_token>/`**
   - *Payload:* Atualização de dados pessoais (`full_name`, `cpf`, `birth_date`, `phone`, `emergency_contact_name`, `emergency_contact_phone`, `vest_size`, `health_notes`).
   - *Comportamento:* Atualiza o participante e marca `onboarding_status = COMPLETED` quando completo.

5. **`PUT /api/me/guest/<signed_token>/preferences/` & `checklist/`**
   - *Comportamento:* Permite que o convidado configure suas próprias bebidas All Inclusive e marque seus itens de checklist.

---

## 4. Regras de Negócio e Invariantes Críticas

1. **Proteção Financeira do Convidado:**
   - O payload do endpoint `guest` MUST NOT conter campos monetários (`total_price_cents`, `paid_amount_cents`, `remaining_balance_cents`, `deposit_cents`).
   - Requisições autenticadas com token de convidado MUST NOT ter permissão para gerar cobranças ou alterar status de pagamentos.
2. **Idempotência e Segurança Criptográfica dos Tokens:**
   - Tokens de cliente e de participante são gerados usando `django.core.signing` com `salt` dedicado e verificação de assinatura HMAC-SHA256.
   - Qualquer manipulação de payload ou expiração do token retorna `HTTP 401 Unauthorized` amigável.
3. **Conclusão do Onboarding:**
   - O participante só transiciona para `onboarding_status = 'COMPLETED'` quando possuir:
     - `full_name` preenchido;
     - `cpf` válido com 11 dígitos;
     - `birth_date` preenchida;
     - `phone` preenchido;
     - `emergency_contact_name` e `emergency_contact_phone` preenchidos;
     - `vest_size` selecionado.

---

## 5. Matriz de Rastreabilidade e Critérios de Aceite

| Critério de Aceite | Descrição do Comportamento |
|---|---|
| **AC01 — Reacesso por CPF e Telefone** | Cliente acessa modal "Minha Reserva" no site, informa CPF e telefone, recebe token de sessão e visualiza suas reservas com link direto. |
| **AC02 — Persistência e Resiliência de Sessão** | Ao fechar a aba ou recarregar a página, o token é recuperado do `localStorage` mantendo o cliente logado por 30 dias. |
| **AC03 — Ficha de Embarque Completa na Web** | Aba "Ficha de Embarque" permite preencher todos os dados civis, emergência, saúde e tamanho de colete para cada passageiro. |
| **AC04 — Conclusão Automática do Onboarding** | Ao preencher os campos obrigatórios da ficha, o participante passa para `COMPLETED` e a barra de progresso avança. |
| **AC05 — Geração do Link de Convidado** | O titular encontra no painel o botão "Copiar Link do Parceiro" com URL assinada exclusiva para o participante. |
| **AC06 — Isolamento Total Financeiro do Convidado** | A tela `/convidado/[token]` permite preencher ficha, bebidas e checklist sem revelar saldo ou opções de pagamento. |
| **AC07 — Qualidade e Ausência de Regressões** | Suíte de testes automatizados com PostgreSQL validando lookup de cliente, tokens de convidados, bloqueio financeiro e build do frontend sem erros. |
