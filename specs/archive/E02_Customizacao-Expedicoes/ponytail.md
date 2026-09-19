# Dossiê de Revisão Adversarial Independente (Ponytail) — Épica E02

> **Identificador Normativo:** `E02-CUSTOMIZACAO-EXPEDICOES`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Data:** 19/09/2026<br/>
> **Revisor:** Antigravity (Ponytail Independente — sem participação na implementação)<br/>
> **Status da Revisão:** `PASS`<br/>
> **Recomendação para Autoridade Humana:** Apto para declaração formal de `ACCEPTED` por Rodrigo.

---

## 1. Sumário Executivo e Escopo da Avaliação

A Épica E02 teve como objetivo dotar o sistema da Expedição Piraíba de capacidade operacional autônoma para cadastro, modelagem e publicação de expedições reais de pesca esportiva no Rio Araguaia, resolvendo os seguintes eixos:
1. Desacoplamento de destinos estáticos em entidades estruturadas de **Pousadas Parceiras / Bases de Apoio (`Lodge`)**;
2. Associação de **Espécies-Alvo (`TargetSpecies`)** nativas do bioma do Araguaia com destaque visual de peixes prioritários;
3. Restrição e padronização do **Cardápio Mestre de Bebidas** (10 itens canônicos acordados), mantendo integridade com escolhas da E01;
4. **Mídia e Fotos Dinâmicas** sem dependência de mapa estático fixo no frontend;
5. **Inclusões Comerciais Estruturadas** no banco de dados e vitrine de detalhes;
6. Manutenção estrita de tralhas/checklist essenciais, sem desativações indevidas;
7. Preservação integral das garantias transacionais de vagas, holds e consolidação de compras (E01).

---

## 2. Metodologia de Falsificação e Ataque

A revisão executou testes adversariais nos seguintes vetores:
- **Integridade Relacional de Bebidas:** Verificação se a inativação de produtos fora do cardápio mestre utilizou `active=False` ou causou deleção em cascata/violação de integridade referencial nas escolhas de participantes (`ParticipantProductChoice`) e compras consolidadas da E01.
- **Segurança de Runtime em Imagens Next.js:** Avaliação do comportamento de `<Image>` com domínios arbitrários externos, validando `next.config.ts` (`remotePatterns`) e flags `unoptimized`.
- **Salvaguardas de Tralhas e Checklist:** Verificação se a diretriz do responsável humano de manter os itens de checklist intactos foi estritamente honrada.
- **Atomicidade e Autorização:** Checagem de isolamento transacional na sincronização de espécies, criação de pousadas e atualização de configuração operacional.
- **Validação Cruzada nos Ambientes (SQLite e PostgreSQL Real):** Execução de suítes completas de testes, verificação de concorrência com banco real e compilação de assets de produção.

---

## 3. Resultados das Validações Reais

| Teste / Verificação | Comando Executado | Resultado Obtido |
|---|---|---|
| **Backend Unit & Integration (SQLite)** | `TEST_SQLITE=true .venv/bin/python manage.py test` | **PASS** (31 testes executados, 0 falhas, 0 erros, 1 skip para PG concurrency) |
| **Backend Concorrência & Locks (PostgreSQL Real)** | `POSTGRES_HOST=172.19.0.2 .venv/bin/python manage.py test` | **PASS** (31 testes executados, 0 falhas, 0 erros, 0 skips) |
| **Integridade de Migrações Django** | `python manage.py makemigrations --check` | **PASS** (`No changes detected`) |
| **Lint do Frontend (ESLint)** | `npm run lint` | **PASS** (0 erros, 0 avisos) |
| **Tipagem Estática (TypeScript)** | `npx tsc --noEmit` | **PASS** (0 erros de tipagem) |
| **Build de Produção (Next.js Turbopack)** | `npm run build` | **PASS** (6 rotas estáticas, 4 dinâmicas compiladas) |
| **Índice e Governança Documental** | `python3 scripts/check_docs.py` | **PASS** (5 owners normativos válidos) |
| **Higiene de Whitespace do Git** | `git diff --check` | **PASS** (0 infrações de formatação) |

---

## 4. Matriz de Rastreabilidade e Conformidade (AC01 a AC08)

| Critério de Aceite | Requisito da Spec | Implementação no Código | Evidência de Verificação | Veredito |
|---|---|---|---|---|
| **AC01 — Pousadas Estruturadas** | Cadastro estruturado de pousadas com cidade, UF, rio, comodidades, ponto de encontro e trajeto no `/admin`. | `apps.expeditions.models.Lodge`, endpoints `/api/operations/lodges/`, `LodgesPanel` e `LodgeModal`. | `OperationsApiTests.test_operations_lodge_species_and_custom_expedition` cria e valida pousada com amenidades. | **PASS** |
| **AC02 — Vínculo de Pousada** | Expedição vinculada a pousada com herança automática de local de saída e instruções de encontro. | `Expedition.lodge` (FK com `PROTECT`), auto-preenchimento no método `Expedition.save()` e no modal admin. | Verificado em `Expedition.save()` e no modal admin do frontend. | **PASS** |
| **AC03 — Espécies-Alvo Selecionáveis** | Catálogo nativo do Araguaia associável por expedição com sinalização de espécie principal. | `TargetSpecies`, `ExpeditionSpecies` (`is_primary`), sincronização em `OperationsExpeditionSerializer`. | `PublishedExpeditionApiTests.test_returns_lodge_species_and_media_in_public_endpoints` e badges na Home/Detalhes. | **PASS** |
| **AC04 — Cardápio Mestre Enxuto** | Catálogo restrito exclusivamente às 10 bebidas acordadas; cota padrão por participante; sem quebra de dados da E01. | Migration 0006 com produtos canônicos e desativação sem `DELETE`. `configuration_payload` e consolidação de compras. | `OperationsApiTests.test_consolidation_counts_only_eligible_reservations_and_exports` e cálculo atômico com sobras. | **PASS** |
| **AC05 — Mídia Dinâmica** | Imagem de capa dinâmica na Home e Detalhes sem dependência de mapa estático fixo. | `cover_image_url` em `Expedition`, `remotePatterns: [{ protocol: "https", hostname: "**" }]` em `next.config.ts`, `unoptimized` condicional. | Verificado no código da Home (`page.tsx`) e Detalhes (`[slug]/page.tsx`), build Next.js com sucesso. | **PASS** |
| **AC06 — Inclusões Estruturadas** | Benefícios e inclusões All Inclusive estruturados por expedição e renderizados no frontend. | `inclusions` (JSONField) em `Expedition`, `DEFAULT_INCLUSIONS` na migration 0006, textarea no admin e lista de checks no frontend. | Verificado em `[slug]/page.tsx` e `admin-panel.tsx`. | **PASS** |
| **AC07 — Compatibilidade e Migração E01** | Expedições de 2026 mantidas com pousadas reais (Solar das Águas e Canaã), espécies e produtos preservados. | Migration 0005 (DDL) e 0006 (Data Migration). `seed_demo` atualizado. | Execução de migrações e suíte de 31 testes sem regressão. | **PASS** |
| **AC08 — Qualidade e Suíte de Testes** | Cobertura de novos serializers, models, endpoints e checks completos do repositório. | `apps/expeditions/tests.py`, `apps/operations/tests.py`, scripts de verificação. | `test`, `makemigrations --check`, `lint`, `tsc`, `build`, `check_docs`. | **PASS** |

---

## 5. Findings da Revisão Adversarial

### Finding F-01 (Informativo / Baixa Severidade — Não-Bloqueante)
- **Componente:** `frontend/src/app/admin/admin-panel.tsx` vs `backend/apps/expeditions/models.py`
- **Descrição:** O modelo `Expedition` e os serializers expõem os campos `cover_image_url` e `gallery_image_urls`. O formulário de edição de expedição no painel (`ExpeditionModal`) disponibiliza campo de edição direta apenas para `cover_image_url`, não exibindo input para `gallery_image_urls`.
- **Impacto:** Nulo para o MVP da E02. O critério AC05 foi cumprido em relação à vitrine e detalhes (que consom a capa). As fotos secundárias continuam centralizadas na galeria geral institucional (`/galeria`).
- **Disposição:** `ACCEPTABLE`. Registrar como melhoria de interface para a Épica E03/E05.

### Finding F-02 (Informativo / Baixa Severidade — Não-Bloqueante)
- **Componente:** `frontend/src/app/admin/admin-panel.tsx` (`ExpeditionModal`)
- **Descrição:** O seletor de pousada parceira no modal de expedição lista todas as pousadas cadastradas no backend sem adicionar o rótulo textual "(Inativa)" caso alguma pousada seja desativada (`active: false`).
- **Impacto:** Cosmético. No fluxo padrão, apenas pousadas ativas são mantidas.
- **Disposição:** `ACCEPTABLE`.

### Finding F-03 (Governança Documental — Ação Pós-Ponytail)
- **Componente:** `HANDOFF.md`
- **Descrição:** O documento de handoff ainda descreve a E02 como aberta aguardando `READY`. Após a emissão deste relatório e aprovação humana de `ACCEPTED`, o handoff e o ciclo de vida devem ser atualizados.
- **Disposição:** Recomendação de atualização pós-aceite formal de Rodrigo.

---

## 6. Verificação das Salvaguardas Especiais

1. **Restrição de Tralhas / Checklist:**
   - O modelo `ChecklistItem`, a tabela associada e o fluxo de checklist do participante permaneceram 100% ativos e intocados no código e banco de dados. Nenhuma tabela ou funcionalidade foi desativada, respeitando integralmente a determinação do responsável humano Rodrigo.
2. **Restrição de Bebidas e Integridade Histórica:**
   - Os 10 itens canônicos foram estabelecidos. Nenhum produto foi excluído fisicamente via `DELETE`; itens fora do cardápio receberam `active=False`, garantindo que chaves estrangeiras com reservas de clientes da E01 permanecessem íntegras.
3. **Segurança de Imagens Externas:**
   - O uso combinado de `remotePatterns` abrangente em `next.config.ts` com fallback `unoptimized={imageSrc.startsWith("http")}` nos componentes Next.js impede exceções fatais em runtime causadas por domínios não mapeados.
4. **Ausência de Regressões na E01:**
   - O fluxo de hold de 15 minutos, controle transacional de vagas sob concorrência (PostgreSQL), idempotência de webhooks, pagamentos manuais auditados e cálculo de compras em caixas continuam com 100% de sucesso na suíte de testes.

---

## 7. Veredito Final

O conjunto de implementações da Épica **E02 (Customização de Expedições & Cardápio Mestre)** satisfaz plenamente todos os critérios de aceitação AC01 a AC08, sem introduzir regressões na E01 e respeitando as diretrizes do responsável humano e a Constituição de Desenvolvimento.

- **Veredito do Ponytail:** **PASS**
- **Status da Especificação:** Apto para transição de `READY` para `ACCEPTED` mediante ratificação formal da autoridade humana competente (Rodrigo).
