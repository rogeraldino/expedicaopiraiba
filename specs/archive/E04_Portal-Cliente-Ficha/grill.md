# Revisão Pré-Código Adversarial (Grill) — Épica E04

> **Identificador Normativo:** `E04-PORTAL-CLIENTE-FICHA`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Data:** 19/09/2026<br/>
> **Revisor:** Antigravity (Auditoria Técnica Pré-Implementação)<br/>
> **Status:** `RECOMMENDED FOR READY` (Aguardando autorização de Rodrigo)

---

## 1. Análise de Ambiguidade e Termos Ocultos

### G01: O que acontece se o comprador tiver mais de um número de telefone registrado no passado?
- **Desafio Adversarial:** O cliente pode ter informado um telefone com DDD diferente ou mudado de número no WhatsApp.
- **Resolução Normativa:** A busca no endpoint `POST /api/me/auth/lookup/` normaliza apenas os 11 dígitos numéricos do CPF e compara os últimos 8/9 dígitos do telefone informado com os telefones cadastrados no `Customer` ou no histórico de participantes. Em caso de divergência, informa mensagem clara para contato com o suporte oficial via WhatsApp.

### G02: O que acontece se o token de convidado for interceptado por terceiros?
- **Desafio Adversarial:** Alguém pode vazar o link do convidado e acessar a reserva inteira ou realizar pagamentos indevidos.
- **Resolução Normativa:** O token assinado de convidado (`django.core.signing`) com `salt="guest-participant-token"` carrega explicitamente apenas o `participant_id` e uma assinatura HMAC baseada no `SECRET_KEY`. O endpoint de convidado (`/api/me/guest/`) NÃO possui acesso nem expõe campos de saldo, PIX ou dados de outros participantes da reserva.

### G03: O que acontece se o cliente tentar preencher a ficha após a viagem ter começado ou terminado?
- **Desafio Adversarial:** Alterações retrospectivas no manifesto oficial de embarque durante ou após a expedição violam os requisitos da Capitania e órgãos ambientais.
- **Resolução Normativa:** O backend já implementa a regra invariante em que se `expedition.status` for `IN_PROGRESS` ou `COMPLETED`, qualquer tentativa de edição cadastral retorna `HTTP 409 Conflict` com a mensagem `"Cadastro bloqueado após o início da expedição"`. Essa trava continuará ativa no endpoint do convidado e do titular.

### G04: O que acontece se o titular tentar preencher a ficha de um participante que já foi substituído?
- **Desafio Adversarial:** Na E03, adicionamos a substituição formal de participantes. Se o antigo participante tentar acessar o token antigo, pode sobrescrever dados do novo pescador.
- **Resolução Normativa:** Ao substituir um participante, a E03 já cria uma nova instância ou altera os dados. Se usarmos um `guest_token_version` ou o próprio UUID do participante, tokens antigos vinculados a IDs removidos retornarão `HTTP 404 Not Found` automaticamente.

---

## 2. Invariantes de Segurança e Concorrência

1. **Separação de Privilégios (Comprador Titular vs. Convidado):**
   - Comprador Titular: Acesso via `customer-session-token` → Visualiza todas as suas reservas, saldo a pagar, pagamentos realizados e todos os passageiros.
   - Convidado: Acesso via `guest-participant-token` → Acesso restrito a 1 único participante, sem visibilidade de dados financeiros da reserva ou dos demais passageiros.
2. **Resiliência do Token no Navegador:**
   - O token do comprador é salvo em `localStorage` com espelhamento em `sessionStorage`.
   - Ao carregar qualquer página, o frontend verifica se há token em `localStorage`. Caso afirmativo, carrega a sessão sem exigir novo login.
3. **Validação de Formatos:**
   - CPF é validado estritamente por algoritmo de dígitos verificadores (módulo 11) e rejeita sequências repetidas (ex.: `111.111.111-11`).
   - Telefones são normalizados para o formato nacional `+55...` com DDD.

---

## 3. Recomendações e Decisões Prontas

- [x] O modelo `ReservationParticipant` receberá os campos auxiliares `vest_size` (tamanho de colete) e `health_notes` (observações médicas) com migração Django limpa.
- [x] O cabeçalho `SiteHeader` receberá o botão "Minha Reserva" com modal interativo de login por CPF e Telefone.
- [x] A tela `CustomerJourney` receberá a aba "Ficha de Embarque" com formulário visual completo e validação reativa.
- [x] O sistema gerará link seguro de convidado `/convidado/[token]` para preenchimento independente pelo parceiro de pesca.

---

## 4. Declaração para Autoridade Humana

A especificação está livre de lacunas semânticas bloqueantes e pronta para receber a declaração formal de **`READY`** por Rodrigo.
