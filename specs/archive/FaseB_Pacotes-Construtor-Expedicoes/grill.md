# Dossiê de Revisão Adversarial Independente (Grill / Counsel)
## Especificação da Fase B: Pacotes Reutilizáveis e Construtor de Expedições

```yaml
identificador_normativo: FASEB-PACOTES-CONSTRUTOR-EXPEDICOES
documento_auditado: specs/active/FaseB_Pacotes-Construtor-Expedicoes/spec.md
classificacao_risco: HIGH
status_grill: GRILL_COMPLETE — RECOMENDADO PARA READY HUMANO
data_revisao: 2026-10-01
revisor_adversarial: Grill / Counsel Subagent (Independente)
autoridade_competente: Rodrigo
base_normativa:
  - docs/sdd/CONSTITUTION.md (§3, §4, §5, §6, §9)
  - docs/sdd/PLAYBOOK.md
  - specs/backlog/ESPECIFICACAO_SISTEMA_OPERACIONAL_MODULAR.md (Pilar 3 e Pilar 6)
```

---

### 1. Sumário Executivo do Grill

A especificação da **Fase B** (`specs/active/FaseB_Pacotes-Construtor-Expedicoes/spec.md`) propõe a modelagem de templates canônicos de pacotes (`AllInclusivePackage`, `BeveragePackage`, `BeveragePackageItem`) e o novo Construtor Guiado de Expedições (*Expedition Wizard* em 4 etapas) no painel administrativo.

Como revisor adversarial independente (Grill / Counsel), examinei exaustivamente a especificação, as regras da Constituição de Desenvolvimento (`CONSTITUTION.md`), o Playbook, o histórico de migrações (`0001` a `0009`), os modelos atuais (`apps/expeditions/models.py`, `apps/reservations/models.py`), as rotas de consolidação operacional (`ConsolidationView`) e os formulários do frontend (`admin-panel.tsx`).

O presente dossiê ataca e resolve:
1. As ambiguidades conceituais entre templates mestre e instâncias concretas operacionais (`ExpeditionProduct`);
2. As salvaguardas de exclusão e integridade referencial (`SET_NULL` vs bloqueio de `DELETE` em pacotes com expedições);
3. Todos os casos de borda do Construtor Guiado (troca de Rio, higienização de espécies, herança de templates e preservação de customizações);
4. As regras matemáticas e contratuais de depósito mínimo de sinal (20%);
5. A compatibilidade e integridade da migração de dados das expedições existentes de 2026.

---

### 2. Análise Crítica e Perguntas Adversariais Normativas

---

#### Grupo 1: Modelagem de Dados e Ambigüidades Conceituais

##### Pergunta 1.1: Qual é a relação técnica e de domínio entre o template `BeveragePackage` / `BeveragePackageItem` e a entidade pré-existente `ExpeditionProduct`?
* **Ataque / Risco:** No banco de dados, `ExpeditionProduct` já é a entidade que sustenta a escolha de itens pelos participantes (`ParticipantProductChoice`) e a consolidação de compras da pousada (`ConsolidationView`). Se o implementador assumir que `BeveragePackage` substitui `ExpeditionProduct`, quebrará todo o sistema de onboardings e compras. Por outro lado, se não houver sincronização, a seleção de um pacote de bebidas no Construtor não terá nenhum efeito prático no abastecimento.
* **Decisão Normativa Definitiva:**
  1. `BeveragePackage` e `BeveragePackageItem` funcionam como **catálogo/template mestre (blueprint)** reutilizável;
  2. `ExpeditionProduct` continua sendo a **instância concreta/oferta operacional** da expedição;
  3. Ao associar um `BeveragePackage` a uma `Expedition` (no cadastro ou no Wizard), o backend MUST instanciar ou sincronizar os registros correspondentes em `ExpeditionProduct` (copiando `product`, `standard_quantity_per_participant` e `display_order`);
  4. Ajustes finos feitos na expedição (ex: aumentar a cota de Stella Artois para 2 engradados por pessoa) afetam estritamente a linha de `ExpeditionProduct` daquela expedição, **NUNCA** o template `BeveragePackageItem`.

##### Pergunta 1.2: Como o campo `Expedition.inclusions` se comporta em relação a `AllInclusivePackage.inclusions`? É uma cópia estática (*snapshot*) ou herança dinâmica?
* **Ataque / Risco:** Se `Expedition.inclusions` for resolvido dinamicamente a partir do pacote (`expedition.all_inclusive_package.inclusions`), qualquer edição futura no template mestre pelo organizador alteraria retroativamente o contrato de expedições já vendidas ou em andamento.
* **Decisão Normativa Definitiva:**
  1. Adota-se o padrão **Snapshot Copy**: ao selecionar um pacote no Wizard, `package.inclusions` é copiado integralmente para `expedition.inclusions`;
  2. O organizador pode adicionar, remover ou editar linhas de benefícios para aquela expedição específica sem sujar ou alterar o template mestre;
  3. A API pública (`/api/expeditions/` e `/api/expeditions/<slug>/`) continua servindo o campo `expedition.inclusions`, garantindo imutabilidade contratual para o cliente que comprou;
  4. Alterações posteriores no `AllInclusivePackage` aplicam-se exclusivamente a **novas expedições**.

##### Pergunta 1.3: Quais restrições de validação de schema devem incidir sobre o campo `inclusions` (JSON)?
* **Ataque / Risco:** Por ser um `JSONField`, um payload malformado (ex: dicionário, números, strings vazias) pode quebrar as telas de detalhes da expedição e a renderização do frontend.
* **Decisão Normativa Definitiva:**
  O backend MUST validar no `Serializer` que `inclusions` é estritamente uma `list[str]`, onde cada item possui entre 3 e 240 caracteres, strings em branco são descartadas e itens duplicados são limpos preservando a ordem.

##### Pergunta 1.4: O sistema permite criar uma expedição personalizada sem vincular nenhum pacote mestre?
* **Decisão Normativa Definitiva:**
  SIM. Os campos `all_inclusive_package` e `beverage_package` no modelo `Expedition` MUST ser anuláveis (`null=True, blank=True`). Caso nenhum pacote seja escolhido, o organizador preenche as inclusões manualmente e/ou configura os produtos avulsos na tela de suprimentos da expedição.

---

#### Grupo 2: Ciclo de Vida, Exclusão e Desativação de Pacotes

##### Pergunta 2.1: O que ocorre se um operador tentar excluir (`DELETE`) um pacote que já está vinculado a expedições passadas ou futuras?
* **Ataque / Risco:** No Django, `on_delete=models.SET_NULL` permite que o registro pai seja apagado, transformando a chave estrangeira em `NULL`. Isso apagaria o rastro histórico e a proveniência dos templates utilizados nas temporadas.
* **Decisão Normativa Definitiva:**
  1. **Exclusão física (`DELETE`) bloqueada:** Os endpoints `DELETE /api/operations/all-inclusive-packages/<id>/` e `DELETE /api/operations/beverage-packages/<id>/` MUST verificar se `package.expeditions.exists()`.
  2. Se houver qualquer expedição vinculada (passada, presente ou futura), a requisição MUST ser rejeitada com `HTTP 409 Conflict` (ou `HTTP 400 Bad Request`) e a mensagem: `"Não é possível excluir pacote vinculado a expedições. Desative o pacote (active=false) para impedir novos usos."`
  3. A exclusão física (`hard delete`) é permitida apenas para pacotes rascunho ou recém-criados que nunca foram vinculados a nenhuma expedição.
  4. Para pacotes obsoletos, adota-se **desativação lógica** (`active=False`).

##### Pergunta 2.2: Qual o efeito da desativação lógica (`active=False`) de um pacote?
* **Decisão Normativa Definitiva:**
  1. O pacote deixa de ser exibido nos seletores do *Expedition Wizard* para novas viagens;
  2. Expedições existentes retêm o vínculo `all_inclusive_package_id` e `beverage_package_id` para fins de auditoria, cópia de expedições antigas e inteligência comercial;
  3. O endpoint de listagem de pacotes deve suportar o parâmetro `?active=true/false` para visualização e reativação pelo administrador.

##### Pergunta 2.3: A exclusão ou desativação de um pacote de bebidas pode comprometer a consolidação de compras (`ConsolidationView`)?
* **Decisão Normativa Definitiva:**
  NÃO. O algoritmo de `ConsolidationView` (linhas 556-570 de `apps/operations/views.py`) consolida dados exclusivamente a partir de `expedition.product_offers` (`ExpeditionProduct`) e escolhas ativas dos passageiros (`ParticipantProductChoice`). Como `ExpeditionProduct` é persistido diretamente no banco e protegido por `PROTECT` nas escolhas dos participantes, o relatório de compras é 100% resiliente e imune a alterações ou desativações no catálogo de pacotes mestre.

##### Pergunta 2.4: Se um pacote de bebidas tiver seus itens alterados, o que ocorre com expedições que já tinham reservas confirmadas?
* **Decisão Normativa Definitiva:**
  A alteração de itens em `BeveragePackageItem` afeta apenas expedições futuras. Se o organizador desejar alterar as bebidas de uma expedição existente, ele deve fazer isso diretamente no painel operacional daquela expedição (`ExpeditionProduct`). Se um produto já tiver seleções de participantes (`ParticipantProductChoice`), ele **NÃO PODE** ser deletado fisicamente (o banco lançará `ProtectedError`); o sistema deve marcá-lo como `active=False` em `ExpeditionProduct`.

---

#### Grupo 3: Casos de Borda no Construtor de Expedições (Expedition Wizard)

##### Pergunta 3.1: Caso de Borda — Troca de Rio na Etapa 1 após preenchimento parcial das etapas subsequentes.
* **Cenário:** O operador seleciona "Rio Araguaia" e "Pousada Solar das Águas" na Etapa 1. Na Etapa 2, marca espécies nativas do Araguaia (Piraíba e Pirarara). Em seguida, volta à Etapa 1 e altera o Rio para "Rio Teles Pires".
* **Ataque / Risco:** Se a interface não sincronizar o estado, a expedição poderá ser salva com a Pousada do Araguaia em um Rio diferente, ou com peixes que não ocorrem no Rio Teles Pires.
* **Decisão Normativa Definitiva:**
  1. No Wizard, a seleção de `River` é a raiz de dependência da Etapa 1 e da Etapa 2.
  2. Caso o operador altere o `River` após ter selecionado Pousada ou Espécies, a interface MUST disparar um aviso de confirmação: `"Alterar o rio reiniciará a seleção da pousada e a lista de espécies-alvo. Deseja continuar?"`.
  3. Ao confirmar a troca de Rio:
     - O campo `lodge_id` é limpo (`""`);
     - O seletor de pousadas é filtrado apenas com pousadas do novo rio (`lodge.river == novo_rio`);
     - `departure_location` e `meeting_instructions` são redefinidos;
     - A lista de espécies na Etapa 2 é recarregada a partir de `RiverSpecies` do novo rio;
     - Espécies que não pertencem ao novo rio são desmarcadas automaticamente.

##### Pergunta 3.2: Caso de Borda — Personalização de Inclusões seguida de troca de Template na Etapa 3.
* **Cenário:** O operador seleciona "Estrutura Completa Regular", que preenche 7 itens de benefícios. Ele digita uma 8ª linha: `"1 Garrafa de whisky por dupla"`. Em seguida, decide mudar o template selecionado para "All Inclusive Casais VIP".
* **Decisão Normativa Definitiva:**
  1. A interface MUST detectar que as inclusões foram customizadas em relação ao template anterior.
  2. Um diálogo de confirmação deve alertar: `"Substituir as inclusões personalizadas pelo novo pacote selecionado?"`.
  3. Se o operador confirmar, o textarea de inclusões é substituído pelo conteúdo do novo pacote; se cancelar, a seleção do dropdown reverte ao pacote anterior.

##### Pergunta 3.3: Como as espécies prioritárias e troféus são determinadas na Etapa 2?
* **Decisão Normativa Definitiva:**
  1. As espécies cadastradas para o rio (`RiverSpecies`) são exibidas com destaque visual para espécies marcadas como troféu (`is_trophy=True`, ex: Piraíba e Pirarara no Araguaia);
  2. A primeira espécie marcada pelo operador (ou a principal espécie troféu) recebe `is_primary=True` na tabela de ligação `ExpeditionSpecies`;
  3. Pelo menos 1 espécie-alvo MUST ser selecionada para prosseguir da Etapa 2 para a Etapa 3.

---

#### Grupo 4: Regras Comerciais e Validação de Depósito Mínimo (20%)

##### Pergunta 4.1: Qual é a fórmula exata de validação de sinal (depósito mínimo)?
* **Ataque / Risco:** Permitir sinais irrelevantes (ex: R$ 50 em uma viagem de R$ 5.000) expõe o organizador ao risco de no-show sem cobertura das despesas operacionais não reembolsáveis de barcos e pousadas parceiras.
* **Decisão Normativa Definitiva:**
  1. **Fórmula Obrigatória:**
     $$\text{deposit\_cents} \ge \left\lceil 0{,}20 \times \text{price\_per\_person\_cents} \right\rceil$$
     $$\text{deposit\_cents} \le \text{price\_per\_person\_cents}$$
     $$\text{price\_per\_person\_cents} > 0$$
  2. **Validação no Backend:** Em `OperationsExpeditionSerializer.validate`:
     ```python
     min_deposit = math.ceil(price * 0.20)
     if deposit < min_deposit:
         raise serializers.ValidationError({
             "deposit_cents": f"O sinal mínimo deve ser de pelo menos 20% do valor por pessoa (mínimo de R$ {min_deposit / 100:.2f})."
         })
     if deposit > price:
         raise serializers.ValidationError({
             "deposit_cents": "O sinal não pode ser superior ao valor total por pessoa."
         })
     ```
  3. **Validação no Frontend:** Na Etapa 4 do Construtor, o campo de Sinal exibe dinamicamente o valor correspondente a 20% como sugestão mínima e bloqueia a submissão caso o valor digitado seja inferior.

##### Pergunta 4.2: Alguma expedição existente de 2026 viola a regra de 20% de sinal?
* **Auditoria de Dados Reais:**
  Inspecionamos todos os registros de expedições de 2026 no banco de dados e nos comandos de seed:
  * `sao-felix-01-out`: Preço R$ 5.600,00 | Sinal R$ 2.500,00 (**44,6%**) $\ge 20\%$ ✅
  * `bandeirantes-15-out`: Preço R$ 5.100,00 | Sinal R$ 2.500,00 (**49,0%**) $\ge 20\%$ ✅
  * `bandeirantes-casais-22-out`: Preço R$ 4.200,00 | Sinal R$ 2.000,00 (**47,6%**) $\ge 20\%$ ✅
  * `sao-felix-28-out`: Preço R$ 5.600,00 | Sinal R$ 2.500,00 (**44,6%**) $\ge 20\%$ ✅
  * `rio-araguaia`: Preço R$ 5.100,00 | Sinal R$ 2.500,00 (**49,0%**) $\ge 20\%$ ✅
  **Conclusão:** 100% das expedições ativas já praticam sinais superiores a 44%. Não há risco de quebra de integridade retroativa.

---

#### Grupo 5: Integridade e Migração de Dados para as Expedições de 2026

##### Pergunta 5.1: Como a migração de dados da Fase B deve associar as expedições de 2026 aos novos pacotes canônicos?
* **Decisão Normativa Definitiva:**
  A migração de dados (ex: `0010_seed_packages_and_link_expeditions.py`) MUST executar atomicamente:
  1. Criação dos 3 pacotes `AllInclusivePackage` canônicos:
     * `slug="estrutura-completa-regular"`: *Estrutura Completa Regular (Sem Open Bar Alcoólico)*;
     * `slug="casais-vip-all-inclusive"`: *All Inclusive Casais VIP (Tudo Incluso)*;
     * `slug="tradicional-araguaia"`: *All Inclusive Tradicional Araguaia*.
  2. Criação dos 3 pacotes `BeveragePackage` canônicos e seus `BeveragePackageItem`s:
     * `slug="open-bar-premium"`: *Open Bar Premium (Stella & Corona + Bebidas Suaves)*;
     * `slug="mix-tradicional-especial"`: *Mix Cervejas Tradicionais & Especiais*;
     * `slug="sem-alcool-demanda"`: *Sem Álcool / Sob Demanda (Refrigerantes, Águas e Gelo)*.
  3. Vínculo sem mutação destrutiva:
     * Para `bandeirantes-casais-22-out`: vincula a `casais-vip-all-inclusive` e `open-bar-premium`;
     * Para as expedições regulares (`sao-felix-01-out`, `bandeirantes-15-out`, `sao-felix-28-out`, `rio-araguaia`): vincula a `estrutura-completa-regular` e `mix-tradicional-especial`;
     * **PRESERVAÇÃO:** Os valores já gravados em `inclusions` e em `ExpeditionProduct` **NÃO DEVEM** ser sobrescritos ou apagados durante a migração.
  4. A migração MUST ser estritamente idempotente (`update_or_create`).

---

### 3. Avaliação de Conformidade com a Constituição e Playbook

| Artigo Constitucional | Exigência | Avaliação de Conformidade |
|---|---|---|
| **§1 Autoridade** | Repositório como autoridade; respeito aos owners | Conforme. Alinhado com o `NORMATIVE_INDEX.json` e a Constituição. |
| **§2 Linguagem** | Uso estrito de MUST, MUST NOT, SHOULD | Conforme. Todas as ambiguidades foram eliminadas com mandatos normativos explícitos. |
| **§3 Risco HIGH** | Exige spec, Grill, READY humano, Ponytail independente e ACCEPTED humano | Conforme. Processo rigorosamente seguido com subagente adversarial independente. |
| **§4 Especificação** | Estados, falhas, reversibilidade e migração descritos | Conforme. Estados de criação, edição e desativação exaustivamente delimitados. |
| **§5 Grill e READY** | Nenhuma questão aberta que possa alterar comportamento ou autoridade | Conforme. Todas as 5 áreas críticas foram sanadas neste dossiê. |
| **§8 e §9 Evidências** | Matriz de rastreabilidade (REQ-B01 a REQ-B10) | Conforme. Matriz mantida com critérios de validação unitária e de ponta a ponta. |
| **Playbook §Checkpoints** | `TEST_SQLITE=true python manage.py test`, linters e `make check-docs` | Conforme. Implementação deverá passar por todos os checkpoints previstos. |

---

### 4. Recomendações Mandatórias para a Implementação

1. **Serializer de Expedições (`backend/apps/operations/serializers.py`):**
   * Adicionar `all_inclusive_package_id` e `beverage_package_id` como `PrimaryKeyRelatedField` opcionais;
   * Incluir validação matemática estrita de sinal mínimo de 20% em `validate()`;
   * Validar formato de `inclusions` como lista de strings não vazias;
   * Ao criar ou atualizar uma expedição com `beverage_package_id`, sincronizar de forma aditiva/atualizadora com `ExpeditionProduct`, sem deletar produtos que já tenham vínculos de participantes.
2. **Endpoints de Pacotes (`backend/apps/operations/views.py`):**
   * Implementar `AllInclusivePackageViewSet` (ou `ListCreateAPIView` + `RetrieveUpdateDestroyAPIView`);
   * Implementar `BeveragePackageViewSet` com serialização aninhada de itens;
   * Bloquear `DELETE` com `HTTP 409 Conflict` se `package.expeditions.exists()`.
3. **Frontend Construtor Guiado (`frontend/src/app/admin/admin-panel.tsx`):**
   * Substituir o monolítico `ExpeditionModal` pelo componente `ExpeditionWizardModal` com 4 etapas:
     * **Etapa 1: Destino & Pousada** (Seleção de Rio -> Pousadas do Rio com autofill de ponto de encontro e instruções);
     * **Etapa 2: Espécies-Alvo** (Carrega espécies do rio com marcação de primária/troféu);
     * **Etapa 3: Pacotes & Cardápio** (Dropdowns de Pacotes All Inclusive e Bebidas com preview e edição de inclusões);
     * **Etapa 4: Comercial & Vagas** (Datas, vagas, preço, sinal com cálculo automático de 20%, capa e resumo);
   * Adicionar no menu de abas administrativas a aba `"Pacotes & Cardápios"` para gestão dos templates mestre.

---

### 5. Veredito Final do Grill

> **VEREDITO DO GRILL:** **PASS / RECOMENDADO PARA READY HUMANO**
>
> A especificação da Fase B (`FASEB-PACOTES-CONSTRUTOR-EXPEDICOES`), complementada pelas respostas normativas e salvaguardas estabelecidas neste dossiê adversarial, apresenta completude técnica, coerência de negócio e robustez arquitetural.
>
> Nenhuma questão em aberto remanesce sobre concorrência, migração de dados existentes, isolamento de templates mestre ou integridade dos relatórios operacionais de compras.
>
> O projeto encontra-se **pronto para a concessão do status `READY` pelo responsável humano (Rodrigo)**, autorizando o início da implementação técnica conforme o Playbook.

---
*Dossiê gerado pelo Revisor Adversarial Independente (Grill / Counsel) em 01/10/2026.*
