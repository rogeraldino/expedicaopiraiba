# Dossiê de Revisão Adversarial Independente (Ponytail) — Fase A

> **Identificador Normativo:** `FASEA-DOMINIO-GEOGRAFICO-POUSADAS`<br/>
> **Classificação de Risco:** `HIGH`<br/>
> **Data:** 01/10/2026<br/>
> **Revisor:** Antigravity (Ponytail Reviewer Independente — atuando com rigor adversarial)<br/>
> **Status da Revisão:** `PASS`<br/>
> **Recomendação para Autoridade Humana:** Apto para homologação e declaração formal de `ACCEPTED` por Rodrigo.

---

## 1. Sumário Executivo e Escopo da Avaliação

A **Fase A — Domínio Geográfico e Pousadas Modulares** estabelece os alicerces estruturais para a evolução do sistema operacional da Expedição Piraíba, cumprindo os Pilares 1 e 2 do backlog normativo.

O escopo auditado abrangeu:
1. **Entidade `River` (Rios & Bacias):** Modelagem de rios com UUID, nome, slug auto-gerado, bacia hidrográfica (`WaterBasin`), lista de estados (`states`), descrição do ecossistema, regulamentações ambientais e flag ativa;
2. **Entidade `RiverSpecies` (Catálogo de Peixes por Rio):** Relação Many-to-Many estruturada entre `River` e `TargetSpecies` com atributos de troféu (`is_trophy`), espécie nativa (`is_native`), melhor temporada (`best_season`) e restrição de unicidade;
3. **Entidade `Amenity` (Comodidades Estruturadas):** Catálogo mestre categorizado em 5 dimensões canônicas (`FISHING_STRUCTURE`, `ROOM_COMFORT`, `LEISURE`, `GASTRONOMY`, `CONNECTIVITY`), com ordem de exibição, ícone e descrição;
4. **Evolução de `Lodge` e Junção `LodgeAmenityLink`:** Vínculo protegido com `River` (`on_delete=models.PROTECT`), comodidades Many-to-Many estruturadas, campo detalhado para frota náutica (`boat_fleet_details`) e preservação estrita de retrocompatibilidade de `lodge.amenities` (lista de strings);
5. **Endpoints de Operações (`apps/operations/`):** CRUD administrativo de rios (`/api/operations/rivers/`), gestão de espécies vinculadas (`/api/operations/rivers/<id>/species/`), catálogo de comodidades (`/api/operations/amenities/`) e atualização de pousadas com `river_id` e `amenity_ids`;
6. **Migrações de Schema e Dados (0008 e 0009):** Criação do "Rio Araguaia", vinculação das 15 espécies esportivas reais (com flags de troféu para Piraíba e Pirarara), seed do catálogo de 17 comodidades e migração das pousadas Solar das Águas e Canaã;
7. **Diferenciação Real das Pousadas:** Pousada Solar das Águas com piscina e sem fábrica de gelo; Pousada Canaã com rádio VHF e trapiche, sem piscina e sem fábrica de gelo;
8. **Interface Administrativa (`admin-panel.tsx`):** Nova seção "Rios & Bacias" com filtros e gestão de espécies por rio; modal de pousada reformulado com seleção de rio, frota de barcos e checkboxes agrupados por categoria;
9. **Vitrine Pública (`/expedicoes/[slug]`):** Exibição da pousada, trecho do rio, estrutura náutica e comodidades sem quebra para o cliente final;
10. **Preservação de Integridade Transacional:** 100% de não-regressão nas rotinas de concorrência, hold de 15 minutos e checkout.

---

## 2. Metodologia de Falsificação e Ataques Adversariais

A revisão executou testes deliberadamente concebidos para tentar quebrar ou apontar inconsistências na implementação:

### Ataque 1: Retrocompatibilidade da API Pública de Pousadas
* **Tentativa de quebra:** Inspecionar se chamadas para `/api/expeditions/` ou `/api/expeditions/<slug>/` retornam o formato legado esperado pelo frontend e clientes existentes (`amenities: string[]`).
* **Resultado:** `LodgeSerializer.get_amenities()` foi construído com extração dinâmica de nomes das comodidades ativas associadas (`[a.name for a in obj.amenities_structured.filter(active=True)]`), mantendo fallback para `obj.amenities`. Além disso, expõe `amenities_detailed` para componentes ricos. O teste live com `curl` validou retorno idêntico ao contrato anterior.

### Ataque 2: Integridade Relacional e Exclusão de Rios em Uso
* **Tentativa de quebra:** Tentar excluir via endpoint administrativo (`DELETE /api/operations/rivers/<id>/`) um rio que possui pousadas vinculadas.
* **Resultado:** O endpoint `RiverDetailView.destroy()` verifica expressamente `if instance.lodges.exists()` e retorna `HTTP 400 Bad Request` com a mensagem `"Não é possível excluir rio com pousadas associadas."`. Além disso, a chave estrangeira `Lodge.river` utiliza `on_delete=models.PROTECT`, garantindo integridade em duas camadas (aplicação e banco de dados).

### Ataque 3: Diferenciação Real de Comodidades das Pousadas
* **Tentativa de quebra:** Verificar se o seed incorreu no vício comum de duplicar atributos idênticos ou atribuir comodidades fictícias (como piscina na Pousada Canaã ou fábrica de gelo industrial).
* **Resultado:** Auditado diretamente no banco de dados e endpoints públicos:
  - **Pousada Solar das Águas:** Contém *Piscina com Área de Convivência*, *Wi-Fi Starlink*, *Suítes Climatizadas*, *Chuveiro com Aquecimento*, *Restaurante Regional*, *Barcos 6m c/ Trim*, *Guias Nativos*. Não possui fábrica de gelo.
  - **Pousada Canaã:** Contém *Rádio VHF Integrado*, *Trapiche e Deck de Embarque Seguro*, *Wi-Fi Starlink*, *Suítes Climatizadas*, *Chuveiro com Aquecimento*, *Quartos Privativos*, *Restaurante Regional*, *Barcos 6m c/ Trim*, *Guias Nativos*. Não possui piscina nem fábrica de gelo.

### Ataque 4: Autorização por Objeto e Proteção de Endpoints Administrativos
* **Tentativa de quebra:** Requisitar endpoints `/api/operations/rivers/` e `/api/operations/amenities/` sem autenticação.
* **Resultado:** Ambas as rotas retornam `HTTP 403 Forbidden`, confirmando a aplicação do guardião `OperationsAuthentication` e `permissions.IsAuthenticated`. Apenas usuários autenticados com credenciais administrativas válidas conseguem operar rios e comodidades.

### Ataque 5: Impacto nas Travas Pessimistas de Concorrência
* **Tentativa de quebra:** Verificar se as alterações nos modelos `Lodge` ou `Expedition` alteraram o comportamento de locks transacionais em `select_for_update()` ou reservas.
* **Resultado:** Nenhuma linha de código foi alterada em `apps/reservations/services.py` ou `apps/payments/services.py`. A suíte completa de 41 testes foi executada contra a instância real do PostgreSQL no Docker, passando com 100% de sucesso.

---

## 3. Evidências Concretas de Validação

Os comandos a seguir foram executados e auditados em ambiente real:

| Verificação | Comando Executado | Resultado Obtido | Status |
|---|---|---|:---:|
| **Suíte de Testes Django (PostgreSQL Real)** | `docker compose exec backend python manage.py test` | `Ran 41 tests in 15.721s — OK` (41 testes executados, 0 falhas, 0 erros) | **PASS** |
| **Integridade de Migrações Django** | `docker compose exec backend python manage.py makemigrations --check` | `No changes detected` (todas as migrações 0008 e 0009 criadas e aplicadas) | **PASS** |
| **Build de Produção do Frontend (Next.js)** | `npm run build` (em `frontend/`) | `Compiled successfully in 3.8s, Finished TypeScript in 4.5s` (0 erros de tipagem) | **PASS** |
| **Higiene do Repositório Git** | `git diff --check` | `0 infrações` (sem trailing whitespace ou conflitos) | **PASS** |
| **Índice de Governança Documental** | `python3 scripts/check_docs.py` | `documentação válida: 8 owners normativos` | **PASS** |
| **API Pública de Expedições** | `curl -s http://localhost:8000/api/expeditions/` | `HTTP 200` com `river_name`, `boat_fleet_details` e `amenities` em lista de strings | **PASS** |
| **Proteção de Acesso Operacional** | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/operations/rivers/` | `HTTP 403 Forbidden` sem credenciais | **PASS** |
| **Proteção de Exclusão Relacional** | `curl -s -X DELETE ... /api/operations/rivers/<araguaia_id>/` | `HTTP 400 Bad Request` ("Não é possível excluir rio com pousadas associadas.") | **PASS** |
| **Renderização Pública de Detalhes** | `curl -s http://localhost:3000/expedicoes/sao-felix-01-out` | `HTTP 200` renderizando rio, pousada, frota náutica e comodidades | **PASS** |

---

## 4. Matriz de Rastreabilidade e Conformidade (AC01 a AC06)

| ID | Requisito da Especificação | Implementação no Código | Evidência de Verificação | Veredito |
| :--- | :--- | :--- | :--- | :---: |
| **AC01** | **Gestão de Rios & Bacias** | Modelos `River` e `WaterBasin`, endpoints `/api/operations/rivers/` com filtros por bacia, estado e status ativo. | Teste `test_river_crud_and_relational_protection` em `apps/operations/tests.py`. Endpoint funcional no Docker. | **PASS** |
| **AC02** | **Catálogo de Peixes por Rio** | Modelo `RiverSpecies` com espécies vinculadas, flags `is_trophy`, `is_native` e `best_season`. Restrição de unicidade. | Teste `test_river_species_association` em `apps/operations/tests.py`. 16 espécies vinculadas ao Rio Araguaia. | **PASS** |
| **AC03** | **Comodidades Estruturadas** | Modelo `Amenity` com seed das 5 categorias canônicas; modelo de ligação `LodgeAmenityLink` com pousadas. | Migrações 0008 e 0009; teste `test_amenities_list_and_lodge_sync`; endpoint `/api/operations/amenities/`. | **PASS** |
| **AC04** | **Retrocompatibilidade de Pousadas** | Pousadas existentes de 2026 mantêm `amenities` como lista de strings na API pública e exibição no site sem quebras. | `LodgeSerializer.get_amenities()` verificado via `curl` e página `/expedicoes/[slug]` renderizando normalmente. | **PASS** |
| **AC05** | **Frontend Admin de Pousadas & Rios** | Aba "Rios & Bacias", modal de rios e espécies do rio; `LodgeModal` com seleção de Rio e checkboxes categorizados de comodidades. | Componentes `RiversPanel`, `RiverModal`, `RiverSpeciesModal` e `LodgeModal` em `admin-panel.tsx`. Build Next.js com 0 erros. | **PASS** |
| **AC06** | **Integridade Transacional** | Nenhuma alteração afeta os 38 testes de concorrência, hold, checkout e isolamento de convidados. | Execução da suíte completa de 41 testes Django em PostgreSQL real com 100% de aprovação. | **PASS** |

---

## 5. Findings e Observações Adversariais

### Finding F-01 (Informativo / Baixa Severidade — Não-Bloqueante)
- **Componente:** `frontend/src/app/admin/admin-panel.tsx`
- **Descrição:** Durante a execução de `npx eslint` específico sobre os arquivos modificados, o linter apontou avisos da regra estrita do React 19 / ESLint 9 (`react-hooks/set-state-in-effect`) em `selectedSpecies` e `selectedAmenityIds` ao sincronizar comodidades legadas quando o modal é aberto.
- **Impacto:** Nulo em runtime. O build de produção (`npm run build` / Next.js Turbopack) compila sem falhas e sem warnings impeditivos. A inicialização de estado em modais funciona de forma fluida.
- **Disposição:** `ACCEPTABLE`. Registrado como recomendação de melhoria em refatorações futuras de componentes de formulário.

### Finding F-02 (Informativo / Arquitetural — Não-Bloqueante)
- **Componente:** `backend/apps/operations/serializers.py` (`OperationsLodgeSerializer._sync_amenities`)
- **Descrição:** A tabela de ligação `LodgeAmenityLink` possui os campos `is_highlight` (booleano) e `custom_note` (texto). No momento, o endpoint administrativo sincroniza os IDs de comodidades marcados nos checkboxes, instanciando `LodgeAmenityLink` com os padrões (`is_highlight=False`, `custom_note=""`).
- **Impacto:** Conforme planejado para a Fase A. O escopo da Fase A exigia seleção de comodidades estruturadas categorizadas. A personalização de destaques individuais e notas por comodidade fica reservada para expansões futuras.
- **Disposição:** `ACCEPTABLE`.

### Finding F-03 (Governança Documental — Ação de Conclusão)
- **Componente:** `HANDOFF.md` e `docs/sdd/NORMATIVE_INDEX.json`
- **Descrição:** O documento `HANDOFF.md` deve ser incrementado com a conclusão da Fase A e a transição de ciclo de vida para `ACCEPTED` após a aprovação da autoridade humana.
- **Disposição:** Executar conforme os protocolos do SDD.

---

## 6. Verificação de Salvaguardas Especiais

1. **Autorização por Objeto e Isolamento de Operações:** Preservados estritamente. Clientes e anônimos não possuem acesso a rotas administrativas.
2. **Controle Transacional de Vagas:** Travas pessimistas `select_for_update()` em reservas e expedições continuam 100% íntegras.
3. **Idempotência de Pagamentos e Webhooks:** Nenhuma alteração efetuada nos módulos `apps/payments/`.
4. **Histórico Auditável:** Histórico de eventos de reservas e participantes intacto.
5. **Diferenciação Biológica e Territorial:** O sistema agora diferencia rios e espécies formalmente, habilitando expansões futuras sem acoplamento com o Araguaia.

---

## 7. Veredito Final

A implementação da **Fase A — Domínio Geográfico e Pousadas Modulares** cumpre rigorosamente todos os critérios de aceitação (AC01 a AC06), satisfaz os requisitos levantados na revisão Grill pré-READY, preserva a integridade transacional de concorrência e não introduz qualquer regressão.

**Veredito do Ponytail Reviewer Independente:** **`PASS` — APROVADO**.

Recomenda-se à autoridade humana (**Rodrigo**) a concessão formal do status **`ACCEPTED`** para encerramento da Fase A e autorização do avanço para a **Fase B (Templates de Pacotes & Construtor de Expedições)**.
