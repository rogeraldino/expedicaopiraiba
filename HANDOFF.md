# HANDOFF — Expedição Piraíba (MVP Operacional & Comercial)

> **Estado do Sistema:**
> - Épica E01 Concluída e Aceita (`ACCEPTED` / Arquivada em `specs/archive/E01_P0-Closure/`);
> - Épica E02 Concluída e Aceita (`ACCEPTED` / Arquivada em `specs/archive/E02_Customizacao-Expedicoes/`);
> - Próximo Trabalho Selecionável no Backlog: `specs/backlog/REQUISITOS_E_GAPS_PROXIMAS_EPICAS.md` (Épica E03 — Venda Direta / Reserva Manual e Manifesto).<br/>
> **Última Atualização:** 19/09/2026 (Aceite formal por Rodrigo e arquivamento de E02)

---

## 🎯 1. O que está 100% Funcional e Alimentado com Dados Reais

1. **Home & Vitrine Oficial (`/`):**
   - **Branding Real:** *"Há mais de 20 anos mostrando o que existe de melhor na pesca esportiva de gigantes"*.
   - **Os 4 Pilares da Marca:** Enfrentar Gigantes, Batalhas Inesquecíveis, Gastronomia no Rio, Torneio com Troféus.
   - **Grade 2026 Completa (4 Expedições Oficiais) com Pousadas e Espécies Dinâmicas:**
     1. `São Félix do Araguaia — 01 a 04 Out` (Pousada Solar das Águas) — R$ 5.600/pessoa
     2. `Bandeirantes — 15 a 18 Out` (Pousada Canaã) — R$ 5.100/pessoa
     3. `Pescaria de Casais — 22 a 24 Out` (Pousada Canaã) — R$ 8.400/casal
     4. `São Félix do Araguaia — 28 a 31 Out` (Pousada Solar das Águas) — R$ 5.600/pessoa
   - **Imagens e Mídia Dinâmicas:** Renderização da capa definida no banco de dados (`cover_image_url`) com segurança contra domínios externos via `remotePatterns` e `unoptimized`.
   - **Espécies em Destaque:** Badges visuais das espécies-alvo prioritárias (Piraíba, Pirarara, Bargada).
   - **Detalhamento All Inclusive:** Hospedagem, combustível 100% incluso, guias nativos, iscas, kit ceviche/sashimi, open bar de cervejas e refrigerantes, rádio VHF e torneio entre duplas.
   - **Grade 2027 (São Félix do Araguaia):** 8 datas confirmadas de Abril a Outubro com botão de lista de espera.
   - **Contatos Oficiais:** WhatsApp `(62) 9 8161-2128` e Instagram `@expedicaopiraiba`.

2. **Detalhes Dinâmicos da Expedição (`/expedicoes/[slug]`):**
   - Carregamento da expedição selecionada direto da API com foto hero dinâmica, datas, capacidade e vagas restantes.
   - **Pousada Parceira Estruturada:** Nome da pousada, cidade/UF, trecho do rio, descrição, lista de comodidades (Wi-Fi, piscina, ar-condicionado) e ponto de encontro oficial.
   - **Espécies-Alvo da Viagem:** Vitrine das espécies nativas com nome científico e badge de espécie principal.
   - **Inclusões All Inclusive Estruturadas:** Lista personalizada de benefícios configurada no banco de dados.

3. **Checkout Rápido & Conversão sem Senha (`/expedicoes/[slug]/checkout`):**
   - Identificação com CPF, Nome, E-mail e WhatsApp com máscara automática.
   - Hold transacional de 15 minutos e simulação instantânea de PIX.

4. **Confirmação e Minha Expedição (`/expedicoes/[slug]/minha-expedicao/[id]`):**
   - Autenticação e autorização por objeto (sessão dona com 404 estrito para reservas de terceiros).
   - **Contagem Regressiva e Estado Temporal:** Dias restantes até o embarque, aviso de viagem em andamento ou encerrada.
   - **Orientações de Encontro:** Local e instruções operacionais da expedição.
   - **Preparação Individual por Participante:**
     - **Bebidas:** Escolha booleana por produto oferecido ativo da expedição (Cardápio Mestre canônico, sem inserção manual de unidades).
     - **Restrições Alimentares:** Seleção estruturada com suporte a "Sem restrições" (mutuamente exclusivo) e campo de detalhes.
     - **Checklist Individual:** Controle por item (obrigatórios e recomendados).
   - **Pagamento de Saldo Restante:** Cobrança PIX simulada pelo valor exato restante, reutilizável e idempotente sob concorrência.
   - **Histórico e Avisos Operacionais:** Linha do tempo de eventos auditáveis e avisos automáticos de saldo pendente, vencimento e proximidade da viagem.
   - **Atendimento Oficial:** CTA conectado ao WhatsApp da operação configurado no domínio.

5. **Painel Administrativo do Organizador (`/admin`):**
   - **Visão Geral:** Indicadores consolidados de receita, reservas, pendências, alertas operacionais (saldo vencido, restrições) e métricas por expedição (vagas confirmadas, holds, saldo a receber).
   - **Gestão de Pousadas e Estruturas (`LodgesPanel` / `LodgeModal`):** Cadastro e edição completa de pousadas parceiras (cidade, UF, rio, comodidades, ponto de encontro, direções de viagem e status ativo/inativo).
   - **Gestão de Expedições (`ExpeditionsPanel` / `ExpeditionModal`):** Criação e edição com vinculação de pousada parceira (auto-preenchimento de local de saída e instruções), espécies-alvo com flag prioritária, URL da imagem de capa e inclusões All Inclusive linha a linha.
   - **Configuração Operacional & Cardápio Mestre:** Seleção das bebidas ativas para cada expedição a partir do catálogo mestre enxuto (10 itens oficiais) e quantidade padrão por pessoa (`standard_quantity_per_participant`).
   - **Gestão de Reservas:** Filtro por expedição, status e busca textual (nome, CPF, telefone), detalhamento nominal com status de cadastro, preferências, restrições e checklist de cada participante.
   - **Operações Financeiras Auditadas:** Registro de pagamento manual simulado com justificativa obrigatória e cancelamento auditado.
   - **Lista de Compras Consolidada:** Cálculo atômico baseado em snapshot transacional (`participantes_que_escolheram × quantidade_padrão`), conversão em caixas/fardos (`package_size`) com sobra, breakdown nominal por produto e exportação em CSV (com neutralização contra injeção de fórmulas) e texto puro.

---

### 2. Validação Integrada e Confiabilidade (Checkpoints E02)

Toda a suíte e os gates da Constituição estão 100% validados:

```bash
# 1. Testes do Backend com PostgreSQL real (31 testes com locks de concorrência)
cd backend && POSTGRES_HOST=172.19.0.2 .venv/bin/python manage.py test
# Resultado: 31 testes OK (0 falhas, 0 erros, 0 skips)

# 2. Testes do Backend com SQLite
cd backend && TEST_SQLITE=true .venv/bin/python manage.py test
# Resultado: 31 testes OK (0 falhas, 0 erros, 1 skip para PG concurrency)

# 3. Verificação de integridade de migrações Django
cd backend && TEST_SQLITE=true .venv/bin/python manage.py makemigrations --check
# Resultado: No changes detected

# 4. Qualidade e tipos do frontend
cd frontend && npm run lint
# Resultado: 0 erros, 0 avisos
cd frontend && npx tsc --noEmit
# Resultado: 0 erros

# 5. Build de produção do frontend (Next.js Turbopack)
cd frontend && npm run build
# Resultado: Compiled successfully (6 páginas estáticas, 4 dinâmicas)

# 6. Integridade documental e owners normativos
python3 scripts/check_docs.py
# Resultado: documentação válida: 5 owners normativos

# 7. Higiene do Git
git diff --check
# Resultado: limpo (0 infrações)
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
