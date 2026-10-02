# Especificação — Refinamento UX: Pousadas, Comodidades e Simplificação do Construtor de Expedições

```yaml
identificador_normativo: REFINAMENTO-POUSADAS-WIZARD
classificacao_risco: MEDIUM
modulo: operacoes_pousadas_wizard
status_documento: ACTIVE
data_criacao: 2026-10-02
autor: Rodrigo (Organizador) & Equipe de Arquitetura Expedição Piraíba
base_normativa:
  - docs/sdd/CONSTITUTION.md (§1, §2, §3, §4, §5)
  - docs/sdd/PLAYBOOK.md
  - specs/archive/FaseA_Dominio-Geografico-Pousadas/spec.md
  - specs/archive/FaseB_Pacotes-Construtor-Expedicoes/spec.md
  - specs/archive/FaseC_Tralhas-CRM-Pescadores/spec.md
```

---

## 1. Visão Geral e Contexto de Negócio

Durante os testes de usabilidade e configuração do sistema pelo organizador Rodrigo, foram identificadas fricções operacionais e excesso de burocracia desnecessária no fluxo de criação de expedições:

1. **Desacoplamento de Rios & Bacias:** Não há necessidade operacional de exigir que o administrador configure Rios e Bacias Hidrográficas como entidades pré-requisito antes de cadastrar uma pousada. O que importa comercial e operacionalmente é saber **quais peixes estão disponíveis naquela pousada**.
2. **Simplificação do Cadastro de Pousada (`LodgeModal`):**
   - Eliminação de campos redundantes ou técnicos: remoção de "Rio de atuação", "Trecho do rio", "Slug identificador" e "Estrutura da frota de barcos".
   - Solução para imagens: administradores não devem ser obrigados a saber URLs; o sistema deve disponibilizar um **Seletor de Imagens da Galeria** com fotos reais pré-carregadas.
   - Gestão dinâmica de comodidades: possibilidade de criar comodidades não previstas e editar comodidades existentes diretamente na tela da pousada.
   - Associação direta de peixes: seleção das espécies de peixes disponíveis na pousada diretamente no seu cadastro.
3. **Simplificação do Construtor de Expedições (`ExpeditionWizardModal`):**
   - Como a pousada já possui suas espécies associadas, a Etapa 2 ("Espécies-Alvo do Rio") torna-se redundante. O Wizard é reduzido de 4 para **3 etapas**.
   - Ajuste de terminologia: substituição do texto *"Pacote All Inclusive Base"* por **"Pacote da Expedição"**.

---

## 2. Escopo e Requisitos Funcionais

| ID | Requisito | Detalhamento |
|---|---|---|
| **REQ-R01** | Vínculo de Peixes na Pousada | Adicionar relacionamento ManyToMany entre `Lodge` e `TargetSpecies`. Permitir selecionar as espécies disponíveis na pousada no `LodgeModal`. Tornar `river` e `river_section` totalmente opcionais no backend. |
| **REQ-R02** | Simplificação do `LodgeModal` | Remover campos: "Rio de atuação", "Trecho do rio", "Slug" e "Estrutura da frota de barcos". Gerar slug automaticamente via `slugify(name)`. |
| **REQ-R03** | Seletor de Galeria de Fotos | Criar modal/seletor visual com miniaturas das fotos reais do projeto (`/gallery/*`, `/expeditions/*`, etc.) para seleção com 1 clique tanto no cadastro da pousada quanto na foto de capa da expedição. |
| **REQ-R04** | CRUD Dinâmico de Comodidades | Expandir endpoints de `Amenity` para permitir criar (`POST /api/operations/amenities/`) e editar (`PATCH /api/operations/amenities/<id>/`). Adicionar interface inline/modal no `LodgeModal` para cadastrar novas e editar existentes. |
| **REQ-R05** | Simplificação do Wizard (3 etapas) | Reduzir o Construtor de Expedições de 4 para 3 etapas: 1) Destino & Pousada; 2) Pacotes & Cardápio; 3) Comercial, Vagas & Publicação. A expedição herda automaticamente os peixes da pousada selecionada. |
| **REQ-R06** | Ajuste Textual de Pacote | Na etapa de pacotes do Wizard, alterar o título de "Pacote All Inclusive Base" para "Pacote da Expedição". |
| **REQ-R07** | Ocultação de "Rios & Bacias" no Menu | Remover o item "Rios & Bacias" da barra de navegação principal do admin para reduzir sobrecarga cognitiva do organizador. |

---

## 3. Não-Objetivos (Out of Scope)
- Não destruir o modelo `River` no banco para não gerar quebras de migração históricas irreversíveis; apenas torná-lo opcional e desacoplá-lo da interface primária.
- Não alterar a lógica de sinal mínimo de 20% nem a reserva concorrente de tralhas.

---

## 4. Critérios de Aceite e Validação
1. É possível cadastrar uma pousada informando apenas Nome, Cidade, Estado, Ponto de Encontro, Como Chegar, Imagem da Galeria, Comodidades e Peixes Disponíveis.
2. É possível criar uma nova comodidade diretamente na tela da pousada e vê-la selecionada imediatamente.
3. É possível editar o nome de uma comodidade existente na mesma tela.
4. O Wizard de Expedições apresenta apenas 3 etapas funcionais, herdando os peixes da pousada.
5. O texto "Pacote da Expedição" é exibido na seleção do pacote.
6. A suite de testes continua com 100% de aprovação.
7. `scripts/check_docs.py` e `git diff --check` passam sem erros.
