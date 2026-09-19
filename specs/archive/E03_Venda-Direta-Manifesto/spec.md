# Especificação Funcional e Técnica — Épica E03: Venda Direta, Gestão de Reservas e Manifesto de Embarque

> **Identificador Normativo:** `E03-VENDA-DIRETA-MANIFESTO`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Status:** `ACCEPTED` (Aprovado formalmente por Rodrigo em 19/09/2026)<br/>
> **Data de Entrada em READY:** 19/09/2026<br/>
> **Data de Homologação / ACCEPTED:** 19/09/2026<br/>
> **Responsável Humano:** Rodrigo<br/>
> **Nota do Responsável Humano:** "o sinal é de 20% a vista nao 30%, altere isso, de ready e comece a implementar" / Aceite formal: "Sim por favor"<br/>
> **Governança:** docs/sdd/CONSTITUTION.md e docs/sdd/NORMATIVE_INDEX.json

---

## 1. Contexto e Problema

Com a conclusão das Épicas E01 (garantias transacionais, hold e compras) e E02 (customização de expedições, pousadas e cardápio mestre), o sistema possui uma base sólida e auditada. No entanto, o fluxo operacional diário do stakeholder ainda enfrenta lacunas críticas:

1. **Vendas Manuais Fora do Site:** Grande parte das negociações de pesca esportiva de grandes bagres no Araguaia ocorre por WhatsApp, telefone ou indicações diretas. Hoje, o organizador é obrigado a simular uma compra na vitrine pública ou não consegue lançar a reserva no sistema.
2. **Substituição e Troca de Pescadores:** Em viagens em grupo e pescarias em duplas, desistências e substituições de amigos são frequentes. O administrador precisa alterar o nome e contatos do passageiro, com histórico auditado para segurança jurídica.
3. **Manifesto Oficial de Embarque:** Exigência legal e regulatória inegociável da Capitania dos Portos (Marinha), órgãos ambientais (ICMBio, SEMA-MT/GO) e das próprias Pousadas parceiras. O organizador precisa emitir e imprimir o manifesto de passageiros da expedição antes do embarque, contendo dados civis, contatos de emergência e restrições de saúde/alimentares.
4. **Agilidade no Atendimento:** Falta de atalhos no painel para copiar o link direto da reserva (`Minha Expedição`) e disparar cobranças formatadas para o WhatsApp do cliente.

---

## 2. Escopo e Não-Objetivos

### 2.1. O que ESTÁ no escopo (MUST)

1. **Criação Manual de Reservas pelo Organizador (`/admin`):**
   - Endpoint `POST /api/operations/reservations/` permitindo cadastro direto com:
     - Expedição selecionada.
     - Quantidade de vagas (1 a 12).
     - Dados do comprador principal (Nome, CPF com validação, E-mail, WhatsApp com máscara).
     - Status inicial:
       - `HELD`: Vaga reservada provisoriamente com prazo de expiração customizável (padrão 24h ou horas definidas pelo admin) para o cliente efetuar o pagamento.
       - `CONFIRMED`: Reserva concluída e garantida (opção de registrar pagamento integral ou sinal/depósito de 20% à vista já recebido fora do sistema).
     - Nomes preliminares dos participantes.
     - Justificativa obrigatória (`reason`) registrada no log de auditoria `ReservationEvent`.
   - **Garantia de Concorrência e Vagas:** A criação manual MUST executar sob o mesmo lock transacional estrito (`select_for_update`) da E01 para impossibilitar overbooking.

2. **Gestão e Substituição de Participantes:**
   - Endpoint `PATCH /api/operations/reservations/{reservation_id}/participants/{participant_id}/`:
     - Edição de dados do passageiro: nome completo, telefone, CPF, data de nascimento, contato de emergência.
     - Ação de substituição formal de participante (troca de pescador), com registro de evento de auditoria `PARTICIPANT_SUBSTITUTED` contendo o nome anterior, o novo nome e o operador responsável.

3. **Manifesto de Embarque Estruturado:**
   - Endpoint `GET /api/operations/expeditions/{id}/manifest/`:
     - Retorno dos passageiros de todas as reservas confirmadas da expedição.
     - Campos: Nome completo, CPF, RG/Documento, Data de Nascimento, Telefone, Contato de Emergência (Nome, Telefone, Parentesco), Restrições Alimentares / Alergias, Status da Ficha e Titular da Reserva.
     - Exportação em CSV limpo com neutralização contra injeção de fórmulas (`=`, `+`, `-`, `@`).
     - Visualização / Modal no `/admin` formatada para impressão/PDF com cabeçalho oficial, dados da Pousada parceira e espaço para assinatura dos pescadores.

4. **Atalhos de Compartilhamento no Painel Admin:**
   - Botão de um clique: *"Copiar Link do Cliente (Minha Expedição)"*.
   - Botão *"Enviar Cobrança via WhatsApp"*: Gera link `https://wa.me/...` com mensagem padronizada contendo valor pendente, chave PIX e link da viagem.

### 2.2. Não-Objetivos Explícitos (MUST NOT)

- **Portal do Cliente e Login por CPF:** Pertence à Épica E04.
- **Formulário de Ficha de Embarque preenchido pelo cliente na web:** Pertence à Épica E04.
- **Disparo automatizado de e-mails/SMS via cron:** A mensageria automática em background pertence à Épica E05.
- **Alteração no Cardápio Mestre ou Checklist Base:** O catálogo enxuto de 10 bebidas (E02) e o checklist essencial (E01) permanecem inalterados.

---

## 3. Arquitetura e Modelagem de Dados

### 3.1. Reutilização de Modelos Existentes
Os modelos `Reservation`, `ReservationParticipant`, `Payment` e `ReservationEvent` já possuem suporte estrutural a:
- `ReservationEvent.event_type`: adicionar escolhas `MANUAL_RESERVATION_CREATED`, `PARTICIPANT_SUBSTITUTED`.
- `ReservationParticipant`: já possui campos `cpf`, `phone`, `birth_date`, `emergency_contact_name`, `emergency_contact_phone`, `dietary_restrictions_notes`.
- `Payment.method`: já suporta `MANUAL` com justificativa auditada.

### 3.2. Regras de Transação e Concorrência
```python
# A criação manual de reserva DEVE usar a mesma garantia atômica:
with transaction.atomic():
    expedition = Expedition.objects.select_for_update().get(id=expedition_id)
    # Valida capacidade máxima:
    # vagas_ocupadas = confirmed_spots + active_held_spots
    # se vagas_ocupadas + spots_count > expedition.capacity:
    #     raise ValidationError("Capacidade da expedição excedida.")
```

---

## 4. Endpoints e Contratos de API

### 4.1. `POST /api/operations/reservations/` (Criar Reserva Manual)
- **Request Body:**
  ```json
  {
    "expedition_id": "uuid",
    "customer_name": "João da Silva",
    "customer_cpf": "123.456.789-00",
    "customer_email": "joao@email.com",
    "customer_phone": "(62) 98888-7777",
    "spots_count": 2,
    "status": "CONFIRMED", // ou "HELD"
    "hold_hours": 24, // opcional, default 24 se status == HELD
    "payment_type": "DEPOSIT", // "FULL", "DEPOSIT" ou "NONE" (apenas se HELD)
    "payment_amount": "2240.00", // opcional, se omitido calcula 20% à vista ou 100%
    "reason": "Venda fechada via WhatsApp pelo organizador Rodrigo",
    "participant_names": ["João da Silva", "Pedro Santos"]
  }
  ```
- **Response HTTP 201 Created:** Objeto completo da reserva criada com participantes e eventos.

### 4.2. `PATCH /api/operations/reservations/{reservation_id}/participants/{participant_id}/`
- **Request Body:**
  ```json
  {
    "full_name": "Pedro Santos Alterado",
    "phone": "(62) 99999-1111",
    "cpf": "987.654.321-00",
    "birth_date": "1985-06-15",
    "emergency_contact_name": "Maria Santos",
    "emergency_contact_phone": "(62) 98888-2222",
    "is_substitution": true,
    "substitution_reason": "Substituição de amigo que teve imprevisto de trabalho"
  }
  ```
- **Response HTTP 200 OK:** Objeto do participante atualizado e evento gravado.

### 4.3. `GET /api/operations/expeditions/{id}/manifest/`
- **Query Params:** `?format=json` (default) ou `?format=csv`
- **Response:**
  - JSON: Dados completos e consolidados dos passageiros.
  - CSV: Arquivo com cabeçalho limpo `attachment; filename=manifesto_{slug}.csv`.

---

## 5. Critérios de Aceite (AC)

- **AC01 — Reserva Manual Segura:** O organizador consegue criar uma reserva manual diretamente no `/admin` escolhendo status `HELD` ou `CONFIRMED`, com auditoria obrigatória.
- **AC02 — Blindagem contra Overbooking:** A criação manual respeita rigorosamente a capacidade da expedição e concorrência com o checkout público.
- **AC03 — Pagamento Manual Vinculado:** Se status for `CONFIRMED`, o sistema permite registrar o pagamento (sinal de 20% à vista ou 100%) gerando comprovante auditado em `Payment`.
- **AC04 — Edição e Substituição de Participantes:** O organizador pode alterar dados de passageiros e executar substituição formal com registro do participante anterior.
- **AC05 — Manifesto de Embarque (Visual & CSV):** O painel `/admin` exibe tela para visualização e impressão do manifesto oficial com dados de emergência e restrições, além de botão para exportação em CSV sem injeção de fórmulas.
- **AC06 — Links de Compartilhamento:** Botões de copiar link do cliente e mensagem WhatsApp funcionais no drawer da reserva.
- **AC07 — Qualidade e Suíte de Testes:** Testes automatizados no backend cobrindo criação manual, concorrência, edição de participantes e exportação do manifesto. Frontend passando em build, lint e tsc.

---

## 6. Prova de Aceite e Matriz de Rastreabilidade

| Critério | Implementação Planejada | Teste Planejado |
|---|---|---|
| AC01 | `OperationsReservationCreateView` / `ManualReservationSerializer` | Teste criação manual HELD e CONFIRMED |
| AC02 | Lock `select_for_update` em `Expedition` na criação manual | Teste de limite de capacidade e concorrência |
| AC03 | Criação atômica de `Payment` (MANUAL) associado à reserva | Teste de saldo restante e evento de pagamento |
| AC04 | `OperationsParticipantUpdateView` com flag de substituição | Teste de substituição e trilha de auditoria |
| AC05 | `ExpeditionManifestView` (JSON & CSV) + Componente no Admin | Teste de geração de manifesto e higienização CSV |
| AC06 | Botões no `ReservationDetailDrawer` no Next.js | Validação de cópia e formato de mensagem WhatsApp |
| AC07 | Suíte Django (PG & SQLite) + ESLint/TSC | Execução de `manage.py test` e `npm run build` |
