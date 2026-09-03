# HANDOFF — Expedição Piraíba (MVP Operacional & Comercial)

> **Estado do Sistema:** Pronto para Demonstração ao Stakeholder com Dados Reais Oficiais  
> **Última Atualização:** 03/09/2026 (Integração dos Encartes Comerciais 2026/2027 + Tela 05 de Bebidas & Preferências)

---

## 🎯 1. O que está 100% Funcional e Alimentado com Dados Reais

1. **Home & Vitrine Oficial (`/`):**
   - **Branding Real:** *"Há mais de 20 anos mostrando o que existe de melhor na pesca esportiva de gigantes"*.
   - **Os 4 Pilares da Marca:** Enfrentar Gigantes, Batalhas Inesquecíveis, Gastronomia no Rio, Torneio com Troféus.
   - **Grade 2026 Completa (4 Expedições Oficiais):**
     1. `São Félix do Araguaia — 01 a 04 Out` (Pousada Solar das Águas) — R$ 5.600/pessoa
     2. `Bandeirantes — 15 a 18 Out` (Pousada Canaã) — R$ 5.100/pessoa
     3. `Pescaria de Casais — 22 a 24 Out` (Pousada Canaã) — R$ 8.400/casal
     4. `São Félix do Araguaia — 28 a 31 Out` (Pousada Solar das Águas) — R$ 5.600/pessoa
   - **Detalhamento All Inclusive:** Hospedagem, combustível 100% incluso, guias nativos, iscas, kit ceviche/sashimi, open bar (Heineken, Original, Amstel), rádio VHF e torneio entre duplas.
   - **Grade 2027 (São Félix do Araguaia):** 8 datas confirmadas de Abril a Outubro com botão de lista de espera.
   - **Contatos Oficiais:** WhatsApp `(62) 9 8161-2128` e Instagram `@expedicaopiraiba`.

2. **Detalhes Dinâmicos da Expedição (`/expedicoes/[slug]`):**
   - Carregamento da expedição selecionada direto da API (preço real, datas, pousada parceira, inclusões All Inclusive).

3. **Checkout Rápido & Conversão sem Senha (`/expedicoes/[slug]/checkout`):**
   - Identificação com CPF, Nome, E-mail e WhatsApp com máscara automática.
   - Hold transacional de 15 minutos e simulação instantânea de PIX.

4. **Tela de Confirmação & Onboarding Completo (`/expedicoes/[slug]/confirmacao/[id]`):**
   - Step 1: Voucher `#EXP-...` gerado.
   - Step 2: Dados dos participantes com validação telefônica flexível e contato de emergência.
   - Step 3: Modal de Bebidas e Preferências com os rótulos oficiais (Heineken, Original, Amstel, Spaten, Corona, destilados e restrições alimentares).
   - Step 4: Checklist operacional da viagem.

5. **Painel Administrativo do Organizador (`/admin`):**
   - Gestão de ocupação, participantes e **Lista de Compras de Bebidas/Preferências** consolidada para a equipe de bordo.

---

## 🚀 2. Roteiro Recomendado para a Apresentação (2 Minutos)

1. Abra a **Home** (`http://localhost:3000`) e mostre a vitrine com o calendário oficial de 2026 e a prévia de 2027.
2. Clique em **"Ver detalhes e reservar"** na expedição de São Félix ou Bandeirantes.
3. No checkout, selecione os participantes, preencha os dados e valide com o código em tela.
4. Clique em **"Pagar com PIX"** ➔ Acesse a tela de **Confirmação e Onboarding**.
5. Abra o modal **"Bebidas e Preferências"** (Step 3), selecione os rótulos (Heineken, Antarctica Original, Amstel), informe restrições alimentares e salve.
6. Abra o **Painel do Organizador** (`http://localhost:3000/admin`), vá em Reservas e mostre a **Lista de Compras** gerada em tempo real para o barco-hotel.

---

## ⚙️ 3. Comandos de Execução Local & Produção

### Local (Desenvolvimento / Testes)
```bash
# Subir toda a stack com Docker Compose
docker compose up -d --build

# Popular/atualizar as 4 expedições oficiais de 2026
docker compose exec backend python manage.py seed_demo
```

### Produção na VPS (com Caddy & Domínio alvor.lat)
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

