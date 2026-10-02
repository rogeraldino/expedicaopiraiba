# HANDOFF — Expedição Piraíba (MVP Operacional & Comercial)

> **Estado do Sistema:**
> - Épica E01 Concluída e Aceita (`ACCEPTED` / Arquivada em `specs/archive/E01_P0-Closure/`);
> - Épica E02 Concluída e Aceita (`ACCEPTED` / Arquivada em `specs/archive/E02_Customizacao-Expedicoes/`);
> - Épica E03 Concluída e Aceita (`ACCEPTED` / Arquivada em `specs/archive/E03_Venda-Direta-Manifesto/`);
> - Épica E04 Concluída e Aceita (`ACCEPTED` / Arquivada em `specs/archive/E04_Portal-Cliente-Ficha/`);
> - **Frente 1 Operacional & Comercial:** Concluída (Inativação do Jaú, Stella Artois no lugar de Amstel, remoção de tuviras, distinção real de comodidades das pousadas, desacoplamento de All Inclusive nas viagens regulares mantendo em Casais, e nova seção de FAQ na Home);<br/>
> - **Fase A — Domínio Geográfico e Pousadas Modulares (`FASEA-DOMINIO-GEOGRAFICO-POUSADAS`):** Concluída, `ACCEPTED` e arquivada em `specs/archive/FaseA_Dominio-Geografico-Pousadas/`;<br/>
> - **Fase B — Pacotes Reutilizáveis e Construtor de Expedições (`FASEB-PACOTES-CONSTRUTOR-EXPEDICOES`):** Concluída, `ACCEPTED` por Rodrigo e arquivada em `specs/archive/FaseB_Pacotes-Construtor-Expedicoes/`;<br/>
> - **Fase C — Locação/Venda de Tralhas e CRM de Pescadores (`FASEC-TRALHAS-CRM-PESCADORES`):** Concluída, `ACCEPTED` por Rodrigo e arquivada em `specs/archive/FaseC_Tralhas-CRM-Pescadores/`;<br/>
> - **Refinamento de UX & Simplificação do Painel do Administrador:** Concluído e testado (Pousadas com cidades-polo e comodidades padrão em 1 clique, pacotes com tags interativas, Wizard em 3 etapas com herança direta de peixes da pousada, cálculo automático de sinal de 20%, sugestão de nomes e publicação direta, e kits prontos de tralhas).<br/>
> - **Desafio Piraíba 2026:** implementação e validação local concluídas, Ponytail PASS e ACCEPTED por Rodrigo; dossiê arquivado em `specs/archive/Desafio_Piraiba_2026/`.<br/>
> **Última Atualização:** 02/10/2026 (Desafio Piraíba publicado no Docker local)

---

## Correção LOW — carregamento do painel administrativo (02/10/2026)

- **Problema:** callbacks anônimos passados a `useData` mudavam de identidade a cada renderização de alguns formulários. Como eram dependência da busca, cada resposta podia disparar uma nova requisição, mantendo abas em carregamento e sobrecarregando a API.
- **Mudança:** a busca passa a depender apenas do caminho e do token; o callback de sessão é atualizado por referência. Requisições antigas são canceladas ou ignoradas, consultas acima de 15 segundos mostram erro, e as listas oferecem nova tentativa. Contratos da API e comportamento de domínio permanecem preservados.
- **Validação:** `npx tsc --noEmit`, `npm run build` e `make check-docs` passaram. `npm run lint` ainda falha em regras `react-hooks/set-state-in-effect` de componentes preexistentes; o trecho alterado não apresenta erro novo. Publicação em produção pendente.

---

## 🎯 1. O que está 100% Funcional e Alimentado com Dados Reais

1. **Home & Vitrine Oficial (`/`):**
   - **Branding Real:** *"Há mais de 20 anos mostrando o que existe de melhor na pesca esportiva de gigantes"*.
   - **Os 4 Pilares da Marca:** Enfrentar Gigantes, Batalhas Inesquecíveis, Culinária no Rio, Torneio com Troféus.
   - **Grade 2026 Completa (4 Expedições Oficiais) com Pousadas e Espécies Dinâmicas:**
     1. `São Félix do Araguaia — 01 a 04 Out` (Pousada Solar das Águas) — R$ 5.600/pessoa (Estrutura Completa)
     2. `Bandeirantes — 15 a 18 Out` (Pousada Canaã) — R$ 5.100/pessoa (Estrutura Completa)
     3. `Pescaria de Casais — 22 a 24 Out` (Pousada Canaã) — R$ 8.400/casal (Tudo All Inclusive)
     4. `São Félix do Araguaia — 28 a 31 Out` (Pousada Solar das Águas) — R$ 5.600/pessoa (Estrutura Completa)
   - **Imagens e Mídia Dinâmicas:** Renderização da capa definida no banco de dados (`cover_image_url`) com segurança contra domínios externos via `remotePatterns` e `unoptimized`.
   - **Espécies em Destaque:** Badges visuais das espécies-alvo prioritárias (Piraíba, Pirarara, Bargada) sem Jaú.
   - **Seção de Perguntas Frequentes (FAQ):** 6 tópicos essenciais sobre licença de pesca (RGP), o que está incluso, sinal de 20%, duplas de barco, logística de chegada e equipamentos recomendados.
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
   - **Gestão de Reservas & Venda Direta (`ManualReservationModal`):**
     - Criação manual de reservas com auto-vínculo de cliente por CPF/e-mail;
     - Regra de negócio estrita de **sinal de 20% à vista** ou quitação integral (100%);
     - Trava pessimista `select_for_update()` com prevenção absoluta de overbooking;
     - Instanciação imediata de participantes com dados preliminares.
   - **Ações Rápidas & Cobrança Comercial:**
     - "Copiar Link do Cliente" direto para onboarding/pagamento;
     - "Cobrança via WhatsApp" com mensagem formatada contendo dados da expedição, passageiros, valores e chave PIX.
   - **Edição & Substituição Formal de Participantes (`ParticipantModal`):**
     - Atualização cadastral de passageiros (CPF, telefone, nascimento, emergência, notas);
     - Substituição formal com registro em auditoria (`PARTICIPANT_SUBSTITUTED`) e reset de status (`PENDING`) e preferências/restrições, evitando dados obsoletos.
   - **Manifesto Oficial de Embarque (`ManifestPanel`):**
     - Visualização tabular completa de passageiros confirmados, emergência, saúde, colete e dados da pousada;
     - Exportação em CSV com sanitização sistemática contra Formula Injection (`safe_csv`) e UTF-8 BOM para Excel;
     - Botão de impressão formatada direta para prancheta de campo.
   - **Operações Financeiras Auditadas:** Registro de pagamento manual simulado com justificativa obrigatória e cancelamento auditado.
   - **Lista de Compras Consolidada:** Cálculo atômico baseado em snapshot transacional (`participantes_que_escolheram × quantidade_padrão`), conversão em caixas/fardos (`package_size`) com sobra, breakdown nominal por produto e exportação em CSV (com neutralização contra injeção de fórmulas) e texto puro.

6. **Portal do Cliente, Reacesso & Link Seguro de Convidado (`/minha-reserva` e `/convidado/[token]`):**
   - **Login Passwordless por CPF e Telefone (`POST /api/me/auth/lookup/`):** Modal de acesso no cabeçalho e página dedicada para recuperar o acesso às reservas com persistência resiliente em `localStorage` (30 dias).
   - **Listagem Centralizada de Expedições (`GET /api/me/reservations/`):** Visão consolidada de todas as viagens do cliente com status de onboarding e saldo devedor.
   - **Formulário Completo de Ficha de Embarque:** Coleta na web de dados civis, contatos de emergência, tamanho de colete salva-vidas / camiseta UV (`P`, `M`, `G`, `GG`, `XG`, `EXG`) e observações médicas. Transição automática de `onboarding_status` para `COMPLETED`.
   - **Link de Convidado / Parceiro de Barco:** Geração de URL com token assinado (`/convidado/[token]`) permitindo à dupla preencher sua própria ficha, bebidas e checklist sob **isolamento financeiro rigoroso** (sem exposição de valores ou botões de cobrança PIX).

---

### 2. Validação Integrada e Confiabilidade (Checkpoints E04)

Toda a suíte e os gates da Constituição estão 100% validados:

```bash
# 1. Testes do Backend com PostgreSQL real (38 testes com locks de concorrência e isolamento de convidados)
docker compose -f compose.production.yaml exec -T backend python manage.py test
# Resultado: Ran 38 tests in 34.835s — OK (0 falhas, 0 erros)

# 2. Verificação de integridade de migrações Django
docker compose -f compose.production.yaml exec -T backend python manage.py makemigrations --check
# Resultado: No changes detected (migração 0009 aplicada)

# 3. Build de produção do frontend (Next.js Turbopack + TypeScript typecheck)
docker compose -f compose.production.yaml build frontend
# Resultado: Image built successfully, 0 erros de tipagem, 0 falhas

# 4. Integridade documental e owners normativos
python3 scripts/check_docs.py
# Resultado: documentação válida: 7 owners normativos

# 5. Higiene do Git
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

---

### Home editorial inspirada no mockup (2026-09-19)

Mudança visual LOW na vitrine: hero com tipografia editorial, cards compactos das expedições com rolagem horizontal no mobile, faixa de estrutura com imagem, seção de histórias com fotografia real, galeria reduzida e calendário 2027. A home foi separada em `src/components/home/*`, `src/lib/api/expeditions.ts` e `src/lib/home-content.ts`. Header e footer acompanham a nova paleta; o header ganhou menu móvel e links que funcionam também fora da home. Fontes Manrope e Cormorant Garamond são servidas pelo `next/font`. As imagens principais e o logo têm variantes WebP otimizadas em `public/home/`. O conteúdo comercial continua vindo de `getExpeditions()` e os links de detalhe continuam apontando para a expedição correspondente. Não houve alteração de API, estoque, preços ou checkout. A seção de histórias não atribui citações fictícias a clientes.

Validação: `npm run build` passou (incluindo TypeScript), ESLint dos arquivos alterados passou, `make check-docs` e `git diff --check` passaram. A home foi inspecionada visualmente em Chrome desktop (1440 px) e largura móvel (500 px), incluindo uma captura da versão de produção. O lint completo ainda acusa quatro erros preexistentes de `react-hooks/set-state-in-effect` fora do redesign.

---

### Resolução de Proxy de API no Frontend (Admin Login & Checkout) (2026-10-01)

- **Causa Raiz Identificada:** O build do frontend inlinava `NEXT_PUBLIC_API_URL="/api"`. Requisições do cliente no navegador chamavam `http://localhost:3000/api/...`, mas o Next.js não possuía rota de proxy e removia trailing slashes por padrão, gerando 308/404 no login do `/admin` e no checkout (`POST /api/checkout/identify/`). Além disso, o Django retornava `RuntimeError` para POST sem trailing slash (`APPEND_SLASH=True`).
- **Correção Implementada:**
  1. Criação do Route Handler dinâmico em `frontend/src/app/api/[[...path]]/route.ts` que encaminha requisições preservando query string, headers, streaming do body e a trailing slash original do Django;
  2. Adição de `skipTrailingSlashRedirect: true` no `next.config.ts`;
  3. Adição de `ARG API_URL` e `NEXT_PUBLIC_API_URL` no `Dockerfile` e sincronização no `compose.yaml`;
  4. Adição de `http://127.0.0.1:3000` em `CORS_ALLOWED_ORIGINS` no `compose.yaml`.
- **Validação:** Login de admin autenticado via token JWT com status 200 OK. Fluxo completo de checkout testado diretamente na porta 3000 (Identify -> Verify -> Hold -> Payment -> Simulate Confirmation) retornando 200 OK com status `PAID`. Todos os 41 testes de backend aprovados.

---

### Fase B — Pacotes Reutilizáveis e Construtor de Expedições (2026-10-01)

- **Identificador Normativo:** `FASEB-PACOTES-CONSTRUTOR-EXPEDICOES` (HIGH, aprovado com `READY` por Rodrigo).
- **Backend & Modelos:**
  1. Criação das entidades `AllInclusivePackage`, `BeveragePackage` e `BeveragePackageItem` com constraint de unicidade e proteção `PROTECT` nos produtos;
  2. Adição de chaves estrangeiras opcionais `all_inclusive_package` e `beverage_package` em `Expedition` com `on_delete=models.SET_NULL, null=True, blank=True`;
  3. Migrações `0010_add_packages_and_expedition_links.py` e `0011_seed_packages_and_link_expeditions.py` aplicadas sem quebra das expedições de 2026;
  4. Validação estrita de sinal mínimo de 20% do valor total por pessoa ($\lceil \text{price} \times 0.20 \rceil$) no `OperationsExpeditionSerializer`;
  5. Sincronização atômica de cotas de bebidas para `ExpeditionProduct` sem efeitos colaterais em reservas passadas;
  6. Proteção contra exclusão física de pacotes com expedições associadas (`HTTP 409 Conflict`).
- **Frontend & Painel Operacional:**
  1. Nova seção *"Pacotes & Cardápios"* (`PackagesPanel`) no painel administrativo com sub-abas para All Inclusive e Bebidas, contadores e modais dedicados (`AllInclusivePackageModal` e `BeveragePackageModal`);
  2. Construtor Guiado de Expedições em 4 etapas (`ExpeditionWizardModal`):
     - Etapa 1 (Destino & Pousada): filtro dinâmico de pousadas por rio, alerta preventivo e preview completo de estrutura/barcos/ponto de encontro;
     - Etapa 2 (Espécies do Rio): carregamento das espécies da bacia, badge 🏆 Troféu e seleção da espécie principal;
     - Etapa 3 (Pacotes & Cardápio): snapshot editável de benefícios do All Inclusive e preview de cotas de bebidas;
     - Etapa 4 (Comercial & Vagas): cálculo automático de duração, alerta visual em tempo real e botão de ajuste automático para sinal mínimo de 20%, e resumo executivo pré-submissão.
- **Validação e Auditoria:**
  1. 44 testes automatizados executados e passando (`Ran 44 tests in 19.037s ... OK`);
  2. Build do frontend Next.js 100% limpo com compilação standalone concluída;
  3. Dossiê Ponytail (`specs/active/FaseB_Pacotes-Construtor-Expedicoes/ponytail.md`) emitido com veredito **PASS**;
  4. `python3 scripts/check_docs.py` -> 9 owners normativos válidos;
  5. `git diff --check` -> limpo.

---

### Fase C — Locação/Venda de Tralhas e CRM de Pescadores (2026-10-01)

- **Identificador Normativo:** `FASEC-TRALHAS-CRM-PESCADORES` (HIGH, aprovado com `READY` por Rodrigo).
- **Backend & Modelos:**
  1. Criação da entidade `FishingGearProduct` (`apps/expeditions/models.py`) com 5 categorias técnicas, modalidades (`RENTAL`, `SALE`, `BOTH`), especificações técnicas em JSON e `CheckConstraint` garantindo `inventory_quantity >= 0` em banco de dados;
  2. Criação da entidade `ReservationGearAddon` (`apps/reservations/models.py`) vinculando reserva, participante opcional e equipamento, com campos de preço unitário e total, quantidade, flags de entrega (`delivered`, `delivered_at`) e observações operacionais;
  3. Criação da entidade `CustomerProfile` (`apps/customers/models.py`) vinculada 1:1 ao cliente, com campos de RG, validade de licença RGP (`fishing_license_expiry`), propriedade calculada `has_valid_license`, tamanhos de colete, notas médicas/alimentares e observações internas estritamente confidenciais (`internal_admin_notes`);
  4. Migrações `customers.0003`, `expeditions.0012`, `reservations.0010` e `expeditions.0013` aplicadas (semeando os 4 equipamentos canônicos oficiais e inicializando os profiles dos clientes existentes);
  5. Concorrência e integridade financeira em `apps/reservations/services.py`:
     - Máquina de estados expandida para suportar a transição bidirecional `PAID <-> CONFIRMED`;
     - Função `recalculate_reservation_financials` com recálculo atômico e persistência imediata de `total_price_cents`, reajuste do saldo restante e transição automática `PAID -> CONFIRMED` (ao adicionar addon) ou `CONFIRMED -> PAID` (ao remover addon e quitar o saldo), com auditoria formal via eventos (`GEAR_ADDON_ADDED`, `GEAR_ADDON_REMOVED`);
     - Restituição automática de estoque e auditoria (`GEAR_INVENTORY_RESTORED`) no cancelamento de reservas;
  6. Endpoints em `apps/operations/views.py`:
     - `gear-products/`: CRUD de equipamentos com trava de segurança `HTTP 409 Conflict` impedindo exclusão de produto com reservas ativas;
     - `reservations/<id>/gear-addons/`: adição atômica com trava pessimista `select_for_update()`, verificação estrita de estoque e recálculo financeiro;
     - `reservations/<id>/gear-addons/<addon_id>/`: `PATCH` para alternar entrega e `DELETE` para devolução atômica de estoque e recálculo contábil;
     - `customers/`: CRM consolidado com Subqueries SQL de LTV e contagem de viagens, busca multifatorial, filtro de licença RGP e `PATCH` de dados de perfil com isolamento de notas internas;
     - `expeditions/<id>/manifest/` e `.csv`: enriquecimento com card consolidado de tralhas para a pousada (`gear_summary`) e detalhamento nominal por passageiro com sanitização anti-Formula Injection (`safe_csv`).
  7. Privacidade e Segurança:
     - Segregação rigorosa em serializers: `internal_admin_notes` nunca é enviado para APIs públicas, portal do cliente ou link de convidado (`/api/me/guest/<token>/`).
- **Frontend & Painel Operacional:**
  1. Seção *"Tralhas & Loja"* (`GearPanel` e `GearModal`) no `/admin`: catálogo de itens, filtros por categoria e modalidade, badges coloridos de criticidade de estoque (crítico/baixo/normal) e edição com parsing seguro de JSON;
  2. Seção *"CRM Pescadores"* (`CustomersPanel` e `CustomerModal`) no `/admin`: KPIs de clientes e taxa de licença válida, LTV médio, busca e modal com 4 blocos (Documentos/RGP, Saúde/Emergência, Histórico de Viagens e Notas Internas Confidenciais com aviso visual);
  3. Box *"Tralhas & Equipamentos Alugados / Comprados"* no `ReservationDrawer`: lista de itens com participante vinculado, toggle de entrega na base, remoção com recálculo e modal de adição `AddGearAddonModal` com cálculo em tempo real de impacto financeiro e trava de estoque;
  4. Manifesto de Embarque (`ManifestPanel`): card consolidado de tralhas para o piloteiro/pousada e coluna dedicada na prancheta de passageiros com indicação visual de entrega.
- **Validação e Auditoria Ponytail:**
  1. 52 testes automatizados executados e passando (`Ran 52 tests in 33.264s ... OK`);
  2. Teste negativo de privacidade `test_crm_internal_admin_notes_privacy_never_leaks_to_guest_or_public` validado com sucesso;
  3. Compilação do contêiner Docker `frontend` completada com sucesso (`✔ Image expedicaopiraiba-frontend Built 58.1s`, 0 erros TypeScript);
  4. Dossiê Ponytail (`specs/active/FaseC_Tralhas-CRM-Pescadores/ponytail.md`) emitido com veredito **PASS**;
  5. `python3 scripts/check_docs.py` -> 10 owners normativos válidos;
  6. `git diff --check` -> limpo.

### Desafio Piraíba — Rio Araguaia (2026-10-02)

- Spec HIGH v1.0 em `specs/archive/Desafio_Piraiba_2026/`; Grill e Counsel registrados, Rodrigo declarou READY e ACCEPTED nesta sessão em 02/10/2026 após Ponytail PASS. SHA aceito: `d57b037c1e0275563917b1579482520d5effdf57`.
- Carga dedicada `create_desafio_piraiba_2026` executada no PostgreSQL do Docker local. Expedição `cbab883e-48c7-4aa3-9c4a-7a902db21363` publicada com 12 vagas, 28–31/10, São Félix do Araguaia/MT, origem Goiânia/GO, R$ 5.600, sinal R$ 1.120 e saldo 7 dias antes. Pousada, novo Pacote da Expedição, cardápio com Heineken/Stella/Original (18 unidades por opção escolhida) e 16 espécies vinculados; nenhuma reserva criada. Equipamentos não foram criados. Reexecutar o comando sem reservas reconcilia os dados aprovados e sobrescreve edições posteriores feitas no admin.
- Capa e quatro fotos usam arquivos existentes de `frontend/public/gallery`; wizard permite escolha visual de capa e galeria, com persistência por endpoints existentes. Hero exibe a próxima expedição publicada com vagas e CTA para checkout. Dados demonstrativos foram retirados dos fallbacks públicos.
- As 17 comodidades pedidas já existiam no catálogo, sem duplicação. O comando verifica sua presença e impede alterar uma expedição com reservas. A segunda execução manteve o mesmo ID.
- Validação local: API pública retornou os dados corretos; 31 testes backend e 2 testes da seleção hero passaram; a home local mostrou nome/capa/CTA corretos, detalhe e checkout retornaram 200, slug ausente retornou 404. Build Next.js/TypeScript, Django check, migrações sem alterações, `make check-docs` e `git diff --check` passaram. Lint geral ainda acusa 9 erros React preexistentes. Ponytail independente concluiu PASS; produção remota não foi alterada nesta sessão.
