# Revisão Adversarial (Grill) — Fase A: Domínio Geográfico e Pousadas Modulares

> **Data da Revisão:** 01/10/2026<br/>
> **Objetivo:** Identificar lacunas semânticas, ambiguidades, riscos de regressão e inconsistências contratuais antes da autorização de READY.

---

### 1. Retrocompatibilidade da API Pública de Pousadas
* **Ponto de Ataque:** Atualmente, a página pública `/expedicoes/[slug]` consome `expedition.lodge.amenities` esperando uma lista de strings (`string[]`). Se o modelo for migrado para ManyToMany estruturado, uma mudança no formato do payload quebrará as páginas existentes em produção?
* **Resolução Obrigatória:** O serializer público de `Lodge` DEVE manter o campo `amenities` retornando uma lista de strings (`list[str]`), extraídas diretamente das comodidades ativas vinculadas (`[a.name for a in lodge.amenities_structured.filter(active=True)]`). Adicionalmente, expõe o campo `amenities_detailed` para componentes modernos que queiram agrupar por categoria e renderizar ícones.

---

### 2. Exclusão e Integridade Relacional de Rios (`River`)
* **Ponto de Ataque:** O que acontece se o administrador tentar excluir um rio que já possui pousadas associadas ou expedições publicadas?
* **Resolução Obrigatória:** A chave estrangeira `Lodge.river` DEVE utilizar `on_delete=models.PROTECT`. O endpoint administrativo de exclusão (`DELETE /api/operations/rivers/<id>/`) DEVE retornar `409 Conflict` ou `400 Bad Request` com mensagem clara caso existam pousadas ou expedições vinculadas, impedindo órfãos e quebras de histórico.

---

### 3. Diferenciação Real de Comodidades (Piscina e Fábrica de Gelo)
* **Ponto de Ataque:** As pousadas do Araguaia possuem perfis muito diferentes. Como garantir que o sistema não presuma atributos fixos?
* **Resolução Obrigatória:**
  1. No seed da migração:
     - `Pousada Solar das Águas`: recebe comodidades de Piscina, Wi-Fi, Ar Climatizado, Quartos confortáveis, Restaurante regional, Barcos 40/50HP. Não recebe fábrica de gelo.
     - `Pousada Canaã`: recebe Wi-Fi, Ar Climatizado, Quartos privativos, Restaurante completo, Barcos c/ rádio VHF, Deck de embarque. Não recebe piscina nem fábrica de gelo.
  2. A garantia de gelo para os barcos permanece na entidade `Expedition.inclusions` (*"Refrigerantes, água mineral e gelo à vontade"*), e não como uma promessa de fábrica industrial fixa na pousada.

---

### 4. Permissões e Autorização por Objeto
* **Ponto de Ataque:** Quaisquer usuários autenticados ou clientes podem criar/editar rios e comodidades?
* **Resolução Obrigatória:** Os endpoints em `apps/operations/` (`/rivers/`, `/amenities/`) são restritos estritamente ao organizador autenticado com credenciais administrativas (`IsAdminUser` / token de operação). A API pública de leitura permanece apenas em `/api/expeditions/`.

---

### 5. Impacto nas Travas Pessimistas de Concorrência
* **Ponto de Ataque:** A introdução de `River` e `Amenity` afeta as travas `select_for_update()` contra overbooking em reservas?
* **Resolução Obrigatória:** Nenhuma alteração é feita no fluxo transacional de reservas ou no cálculo de vagas em `apps/reservations/`. Os 38 testes de concorrência e integridade existentes devem continuar executando e passando integralmente.

---

### 6. Conclusão do Grill
Todas as lacunas foram mapeadas com resoluções determinísticas. A especificação está pronta para receber a autorização formal de **READY** pelo responsável humano para início da implementação.
