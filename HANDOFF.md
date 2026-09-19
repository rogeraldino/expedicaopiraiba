# HANDOFF — Expedição Piraíba (MVP Operacional & Comercial)

> **Estado do Sistema:** MVP Operacional P0 Concluído e Validado (`VALIDATED` — Ponytail Delta PASS)<br/>
> **Última Atualização:** 18/09/2026 (Fechamento da Épica E01 — Escolhas Individuais, Minha Expedição, Saldo, Dashboard e Consolidação)

---

## 🎯 1. O que está 100% Funcional e Alimentado com Dados Reais

1. **Home & Vitrine Oficial (`/`):**
   - **Branding Real:** *"Há mais de 20 anos mostrando o que existe de melhor na pesca esportiva de gigantes"*.
   - **Os 4 Pilares da Marca:** Enfrentar Gigantes, Batalhas Inesquecíveis, Gastronomia no Rio, Torneio com Troféus.
   - **Grade 2026 Oficial:**
     1. `Pescaria de Casais — 22 a 24 Out` (Pousada Canoa) — R$ 8.400/casal
     2. `São Félix do Araguaia — 28 a 31 Out` (Pousada Solar das Águas) — R$ 5.600/pessoa
   - **Detalhamento All Inclusive:** Hospedagem, combustível 100% incluso, guias nativos, iscas, kit ceviche/sashimi, open bar (Heineken, Original, Amstel), rádio VHF e torneio entre duplas.
   - **Grade 2027 (São Félix do Araguaia):** 8 datas confirmadas de Abril a Outubro com botão de lista de espera.
   - **Contatos Oficiais:** WhatsApp `(62) 9 8161-2128` e Instagram `@expedicaopiraiba`.

2. **Detalhes Dinâmicos da Expedição (`/expedicoes/[slug]`):**
   - Carregamento da expedição selecionada direto da API (preço real, datas, pousada parceira, inclusões All Inclusive).

3. **Checkout Rápido & Conversão sem Senha (`/expedicoes/[slug]/checkout`):**
   - Identificação com CPF, Nome, E-mail e WhatsApp com máscara automática.
   - Hold transacional de 15 minutos e simulação instantânea de PIX.

4. **Confirmação e Minha Expedição (`/expedicoes/[slug]/minha-expedicao/[id]`):**
   - Autenticação e autorização por objeto (sessão dona com 404 estrito para reservas de terceiros).
   - **Contagem Regressiva e Estado Temporal:** Dias restantes até o embarque, aviso de viagem em andamento ou encerrada.
   - **Orientações de Encontro:** Local e instruções operacionais da expedição.
   - **Preparação Individual por Participante:**
     - **Bebidas:** Escolha booleana por produto oferecido ativo da expedição (sem inserção manual de unidades).
     - **Restrições Alimentares:** Seleção estruturada com suporte a "Sem restrições" (mutuamente exclusivo) e campo de detalhes.
     - **Checklist Individual:** Controle por item (obrigatórios e recomendados).
   - **Pagamento de Saldo Restante:** Cobrança PIX simulada pelo valor exato restante, reutilizável e idempotente sob concorrência.
   - **Histórico e Avisos Operacionais:** Linha do tempo de eventos auditáveis e avisos automáticos de saldo pendente, vencimento e proximidade da viagem.
   - **Atendimento Oficial:** CTA conectado ao WhatsApp da operação configurado no domínio.

5. **Painel Administrativo do Organizador (`/admin`):**
   - **Visão Geral:** Indicadores consolidados de receita, reservas, pendências, alertas operacionais (saldo vencido, restrições) e métricas por expedição (vagas confirmadas, holds, saldo a receber).
   - **Gestão de Expedições e Configuração Operacional:** Criação e edição de expedições, instruções de encontro, catálogo de produtos, quantidades padrão por participante (`standard_quantity_per_participant`) e itens de checklist.
   - **Gestão de Reservas:** Filtro por expedição, status e busca textual (nome, CPF, telefone), detalhamento nominal com status de cadastro, preferências, restrições e checklist de cada participante.
   - **Operações Financeiras Auditadas:** Registro de pagamento manual simulado com justificativa obrigatória e cancelamento auditado.
   - **Lista de Compras Consolidada:** Cálculo atômico baseado em snapshot transacional (`participantes_que_escolheram × quantidade_padrão`), conversão em caixas/fardos (`package_size`) com sobra, breakdown nominal por produto e exportação em CSV (com neutralização contra injeção de fórmulas) e texto puro.

---

### 2. Validação Integrada e Confiabilidade

Toda a suíte e os gates da Constituição estão 100% validados:

```bash
# 1. Testes do Backend com PostgreSQL real (inclui testes de concorrência e migração)
cd backend && POSTGRES_HOST=172.19.0.2 .venv/bin/python manage.py test
# Resultado: 29 testes OK (0 falhas, 0 erros, 0 skips)

# 2. Verificação de integridade de migrações
cd backend && TEST_SQLITE=true .venv/bin/python manage.py makemigrations --check --dry-run
# Resultado: No changes detected

# 3. Qualidade e tipos do frontend
cd frontend && npm run lint
cd frontend && npx tsc --noEmit

# 4. Build de produção do frontend (Next.js Turbopack)
cd frontend && npm run build

# 5. Integridade documental e owners normativos
make check-docs
# Resultado: 4 owners normativos válidos
```

---

### 3. Comandos de Execução Local & Produção

#### Local (Docker Compose)
```bash
# Subir toda a stack com Docker Compose
docker compose up -d --build

# Executar migrações e popular expedições oficiais de 2026
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo
```

#### Produção na VPS (com Caddy & Domínio alvor.lat)
```bash
# 1. Configurar o .env de produção
cp .env.production.example .env && chmod 600 .env

# 2. Subir com isolamento e Gunicorn
docker compose -f compose.production.yaml up -d --build

# 3. Popular dados e migrações
docker compose -f compose.production.yaml exec backend python manage.py migrate
docker compose -f compose.production.yaml exec backend python manage.py seed_demo

# Runbook completo: deploy/PRODUCTION_RUNBOOK.md
```
