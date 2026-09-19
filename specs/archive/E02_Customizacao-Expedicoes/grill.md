# Revisão Adversarial Pré-Implementação (Grill) — Épica E02

> **Spec Alvo:** `specs/active/E02_Customizacao-Expedicoes/spec.md` (v0.1)<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Data:** 19/09/2026<br/>
> **Objetivo:** Identificar omissões semânticas, ambiguidades, riscos de regressão na E01 e restrições técnicas antes de obter o READY humano.

---

## 1. Ataque à Especificação e Resoluções

### Pergunta 1: Imagens e Next.js `<Image>` (Risco de Quebra em Runtime)
- **Ataque:** No Next.js, se `cover_image_url` for uma URL externa (ex: `https://imgur.com/...` ou `https://meubucket...`), o componente `<Image>` do Next.js disparará um erro de compilação/runtime fatal se o domínio não estiver previamente declarado em `images.remotePatterns` no `next.config.ts`.
- **Resolução Normativa:**
  - O campo `cover_image_url` aceitará tanto caminhos relativos locais do projeto (ex.: `/expeditions/bandeirantes-piraiba.jpg`) quanto URLs completas.
  - No frontend, para evitar quebras por domínios não mapeados no `next.config.ts`, a imagem de capa usará uma tag `<img>` sem restrição de otimizador externo, ou o `next.config.ts` terá suporte a domínios comuns e fallback seguro com `unoptimized={true}` no `<Image>`.

### Pergunta 2: Pousada Obrigatória vs Opcional (Integridade de Dados)
- **Ataque:** A criação de expedição no admin deve exigir uma pousada obrigatoriamente ou pode ser nula? E como ficam as expedições legadas de 2026?
- **Resolução Normativa:**
  - O campo `lodge` no modelo `Expedition` terá `null=True, blank=True` e `on_delete=models.PROTECT`.
  - Na migração de dados, as 4 expedições oficiais de 2026 serão vinculadas automaticamente às pousadas reais criadas na migration (`Pousada Solar das Águas` e `Pousada Canaã`).
  - No formulário do painel `/admin`, a seleção de pousada será obrigatória para novas expedições publicadas (`PUBLISHED`).

### Pergunta 3: Exclusão e Desativação de Pousadas
- **Ataque:** O que acontece se o stakeholder tentar excluir uma pousada que já possui expedições associadas com reservas ativas?
- **Resolução Normativa:**
  - A chave estrangeira utiliza `on_delete=models.PROTECT`, impedindo deleção no banco e retornando `HTTP 409 Conflict` com mensagem amigável no painel administrativo.
  - Pousadas descontinuadas devem ser marcadas como `active=False`, sumindo da seleção de novas viagens sem apagar o histórico.

### Pergunta 4: Cardápio Mestre e Retrocompatibilidade com a E01
- **Ataque:** Ao restringir o catálogo de produtos no banco às 10 bebidas oficiais acordadas, o que acontece com as preferências já salvas pelos clientes nas reservas da E01?
- **Resolução Normativa:**
  - A tabela `Product` não terá registros apagados com `DELETE` (o que violaria chaves estrangeiras protegidas).
  - A migração atualizará os nomes, marcas e categorias para o catálogo canônico e marcará qualquer produto fora da lista oficial como `active=False`.
  - As escolhas anteriores de clientes continuarão associadas ao histórico de forma auditável, mas apenas os produtos com `active=True` e ofertas ativas serão renderizados na tela para novas confirmações.

### Pergunta 5: Espécies-Alvo e Renderização na Vitrine
- **Ataque:** Se uma expedição não tiver nenhuma espécie associada, ou tiver 10 espécies, como a vitrine da Home se comporta?
- **Resolução Normativa:**
  - A relação `ExpeditionSpecies` possui o campo booleano `is_primary`.
  - Na Home (`/`), serão exibidos até 3 badges prioritários (ex.: `[Piraíba]`, `[Pirarara]`, `[Filhote]`), priorizando `is_primary=True`.
  - Na página de detalhes (`/expedicoes/[slug]`), todas as espécies vinculadas àquela data são listadas com seus nomes populares.

### Pergunta 6: Inclusões Comerciais (Estrutura do JSON)
- **Ataque:** O campo `inclusions` pode receber formatos despadronizados se for um JSON arbitrário.
- **Resolução Normativa:**
  - `inclusions` será estritamente uma lista de strings simples (`list[str]`), ex.: `["Combustível 100% incluso", "Iscas vivas (tuviras)", "Piloteiro nativo", "Kit Sashimi & Ceviche", "Open bar nos barcos e pousada", "Torneio com troféus"]`.
  - Se o campo estiver vazio, a página de detalhes utiliza as inclusões padrão da expedição All Inclusive.

---

## 2. Veredito do Grill

- Termos indefinidos: **ELIMINADOS**
- Riscos de regressão na E01: **MITIGADOS COM `PROTECT` E MIGRAÇÃO CONSERVADORA**
- Riscos técnicos de Next.js: **RESOLVIDOS COM ESTRATÉGIA SEGURA DE IMAGEM**
- Veredito da Revisão: **PASS — Apto para declaração formal de READY pelo responsável humano.**
