# E01 — Grill adversarial pré-READY

**Spec revisada:** `spec.md` versão 0.1, 18/09/2026  
**Revisor:** agente Grill independente da implementação  
**Data:** 18/09/2026  
**Resultado:** **NOT READY**

## 1. Escopo da revisão

Este Grill confrontou a proposta com a Constituição, o Playbook, os owners `PRODUCT-MVP` e `DELIVERY-PLAN` e o estado relevante da implementação. A revisão procurou termos que permitam duas implementações observavelmente diferentes, com ênfase em autorização, migração, estados, pagamentos, checklist, dashboard e consolidação.

O resultado `NOT READY` não rejeita o objetivo da épica. Ele indica que ainda existem decisões capazes de alterar comportamento, estado, autoridade ou segurança, o que impede READY conforme a Constituição §5.

## 2. Findings bloqueantes

### G01 — Não existe definição verificável de “preferências concluídas”

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY

A spec define envio como substituição idempotente do conjunto e afirma que vazio mantém a etapa de restrições pendente. Ela não define como distinguir:

- participante que ainda não respondeu sobre bebidas;
- participante que respondeu explicitamente que não quer nenhuma bebida;
- ausência de linha `selected=false` causada pela representação esparsa;
- participante que salvou bebidas, mas não confirmou restrições, ou o inverso.

Dois implementadores podem usar “existe alguma escolha positiva”, “existe qualquer linha”, um marcador de confirmação ou timestamps diferentes. Isso muda onboarding, alertas e AC01/AC08/AC09.

**Disposição proposta:** a autoridade humana deve decidir se “nenhuma bebida” é uma resposta válida e explícita. A spec deve definir um marcador/estado durável de submissão por participante para bebidas e restrições, ou definir outra regra observável equivalente. Deve também definir se salvar uma seção conclui apenas essa seção e se uma nova oferta reabre escolhas já concluídas.

### G02 — Alterações e desativação de catálogo/oferta não têm semântica definida

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY

A quantidade padrão é consultada ao vivo e sua alteração recalcula o total retroativamente, mas não há regra para:

- desativar `Product` ou `ExpeditionProduct` com escolhas existentes;
- remover uma oferta, alterar sua unidade ou substituir seu produto;
- incluir escolhas históricas de oferta atualmente inativa na consolidação;
- reabrir pendência quando uma nova opção é oferecida;
- editar ofertas depois do início/conclusão da expedição;
- excluir entidades referenciadas versus apenas arquivá-las.

“Apenas produtos ativos e habilitados” pode significar somente visibilidade/escrita ou também elegibilidade para consolidação. As alternativas produzem listas de compras distintas.

**Disposição proposta:** definir ciclo de vida da oferta (`active/available`), efeito sobre escolhas existentes, consolidação e completude, limites temporais de edição e política de deleção. A decisão sobre recálculo retroativo da quantidade padrão deve ser confirmada explicitamente junto às decisões humanas já listadas.

### G03 — O contrato de substituição das escolhas é ambíguo

**Severidade:** BLOCKER  
**Classe:** COUNSELLED, com decisão humana se houver trade-off de produto

“Substituição do conjunto” não determina o payload nem o efeito de itens omitidos: apagar linhas, gravar `selected=false` ou manter estado anterior. Também não define controle contra duas abas/requests concorrentes, se um conjunto parcialmente inválido é rejeitado por inteiro, nem a resposta canônica após salvar.

**Disposição proposta:** especificar comando e resposta completos. Exemplo normativo possível: lista integral de IDs selecionados; itens omitidos tornam-se não selecionados; validação integral precede escrita atômica; repetição resulta no mesmo conjunto; concorrência adota last-write-wins e devolve o estado persistido. Isso é apenas uma alternativa e não deve ser adotado sem disposição no owner.

### G04 — Migração do JSON legado não é executável a partir das regras atuais

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY para tratamento dos dados; AUTONOMOUS apenas para mecanismo após decisão

Não há catálogo inicial, aliases de correspondência, unidade ou regra de normalização definidos. O JSON atual aceita chaves livres e restrição em texto livre. “Correspondência inequívoca” e “marcar pendente” não informam:

- quais chaves conhecidas mapeiam para quais produtos;
- se valor booleano, string numérica, zero, negativo ou estrutura inesperada é aceito;
- onde o legado auditável permanece e por quanto tempo;
- qual estado/marcador representa revisão administrativa;
- se o JSON antigo continua sendo escrito/lido após a migração;
- ordem entre criação/seed do catálogo e migração de dados;
- resultado de rollback e proteção equivalente à reexecução.

**Disposição proposta:** anexar inventário do formato legado real, catálogo/aliases iniciais e tabela entrada → resultado. Preservar o campo bruto ou snapshot imutável até aceite da migração. Para múltiplos participantes, especificar exatamente os marcadores de pendência de bebidas e restrições. AC05 deve cobrir dados desconhecidos e reexecução/proteção.

### G05 — Criação e confirmação do pagamento de saldo permitem divergência e excesso sob concorrência

**Severidade:** BLOCKER  
**Classe:** COUNSELLED

“Cobrança pendente existente para o saldo é reutilizada” não define propósito da cobrança, validade, valor divergente, status `PROCESSING`, cobrança expirada ou uma cobrança pendente do checkout inicial. Também não define o que ocorre quando:

- dois requests criam saldo simultaneamente;
- outro pagamento é confirmado entre cálculo e criação;
- duas cobranças diferentes são confirmadas e juntas excedem o saldo;
- chega webhook tardio de cobrança expirada/cancelada;
- o saldo já é zero no retry.

A regra “valor acima do saldo é rejeitado” precisa dizer se a transação financeira fica rejeitada, se o evento é auditado e como reconciliar um provedor que já marcou pago. O código atual soma pagamentos e aceita `>= total`, portanto AC07 exige contrato mais forte do que o existente.

**Disposição proposta:** definir uma finalidade durável da cobrança (`INITIAL`/`BALANCE` ou equivalente), lock da reserva, unicidade lógica de cobrança ativa, tratamento de expiração e regra do webhook tardio. Especificar o resultado HTTP/estado do retry com saldo zero e a reconciliação de pagamento externo que exceda o saldo. Adicionar prova concorrente em PostgreSQL.

### G06 — Elegibilidade e estados da reserva divergem entre saldo, ocupação e consolidação

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY

A spec autoriza saldo para `CONFIRMED` ou `PARTIALLY_PAID`, mas o domínio atual usa `PARTIALLY_PAID` para pagamento abaixo do sinal e ainda conta todo esse estado como ocupação. A consolidação inclui `PARTIALLY_PAID que ocupa vaga`, sem existir flag ou condição que diferencie o caso. `PAID` não é citado como elegível para criar saldo, corretamente se saldo zero, mas o comportamento de retry não está definido.

Também falta declarar se `CONFIRMED` sempre significa sinal mínimo atingido e se toda `PARTIALLY_PAID` preserva vaga indefinidamente, inclusive após `held_until` ser limpo ou vencido.

**Disposição proposta:** definir invariante de cada estado financeiro/operacional, quando `PARTIALLY_PAID` ocupa vaga, expiração aplicável e predicado único usado por capacidade e consolidação. Se a separação de estados continuar fora do P0, a regra combinada precisa ser inequívoca.

### G07 — “Dashboard operacional completo para este P0” não possui fronteira

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY

O owner anterior exige registrar pagamento manual simulado, confirmar/cancelar, motivo, iniciar reembolso simulado, editar todos os campos da expedição, configurar encontro, ofertas, checklist e imagens. A spec cita visão, filtros e consolidação, mas não inclui nem exclui explicitamente essas ações; “gestão avançada de reembolso” não resolve se o reembolso simulado básico continua no escopo.

Dois implementadores podem entregar dashboards substancialmente diferentes e ambos alegar AC09.

**Disposição proposta:** criar tabela de capacidades administrativas `IN/OUT`, incluindo todas as ações das seções 8.2–8.4 do `DELIVERY-PLAN`. Para cada mutação incluída, mapear ação → comando → efeito → reversibilidade → auditoria. Mover exclusões explícitas ao backlog com referência.

### G08 — Minha Expedição depende de dados e comportamentos inexistentes na spec

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY

Ponto/horário de encontro, avisos operacionais e origem do WhatsApp não têm owner/modelo definidos nesta épica. A contagem regressiva não define comportamento no dia, durante ou depois da viagem. “Histórico resumido” não define quais eventos e payloads podem aparecer ao cliente. Não há regra de visibilidade para reservas `HELD`, `EXPIRED`, `CANCELLED` ou `REFUNDED`.

“Operações sensíveis exigem verificação recente” permanece no owner anterior, mas esta spec não determina quais operações nem a janela; pagamento de saldo e alteração de dados são candidatas.

**Disposição proposta:** definir fontes e edição de encontro, avisos e WhatsApp; estados visíveis; semântica temporal da contagem; allowlist do histórico público; operações que exigem reautenticação e duração da recência. Se aviso configurável não for P0, definir os avisos derivados exatos.

### G09 — Autoridade do comprador sobre participantes não está explicitada

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY

A API é autorizada pela sessão do comprador, enquanto a redação alterna “comprador” e “participante”. Não está declarado se o comprador pode editar escolhas, restrições e checklist de todos os participantes, inclusive dados sensíveis de saúde/alergia, nem se um participante terá identidade própria no P0.

**Disposição proposta:** declarar principal autorizado e matriz objeto/ação. Se somente o comprador possui sessão no P0, registrar explicitamente sua autoridade sobre todos os participantes da própria reserva e a ausência de acesso direto de participantes convidados. Definir quais dados aparecem em histórico e dashboard para evitar exposição desnecessária.

### G10 — Checklist não define criação, conclusão e efeito das edições

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY

O texto permite `Checklist` por expedição sem cardinalidade; não define se há um ou vários, como o participante confirma item desmarcado, nem se “finalizar checklist” é um comando separado ou cálculo derivado. Também faltam regras para item obrigatório adicionado depois da conclusão, item desativado, mudança de recomendado para obrigatório e edição após a viagem.

**Disposição proposta:** definir cardinalidade, estado de submissão, algoritmo de completude e retroatividade das alterações. Especificar se adicionar/reativar obrigatório reabre a pendência e se conclusões de itens desativados permanecem como histórico.

### G11 — Restrições estruturadas ainda admitem modelos incompatíveis

**Severidade:** BLOCKER  
**Classe:** HUMAN AUTHORITY

Não está definido se detalhes livres são por restrição ou por participante, se “outros” exige texto, se múltiplas restrições podem coexistir, nem o que significa “restrição que exige atenção” no dashboard. O owner anterior menciona nível de atenção apenas se aprovado, e a spec não o aprova.

**Disposição proposta:** definir cardinalidade, códigos estáveis, regra de “sem restrições”, validação de “outros”, localização do texto livre e predicado do alerta operacional. Não inferir severidade médica a partir de texto livre.

### G12 — Progresso e `onboarding_status` têm duas possíveis fontes de verdade

**Severidade:** BLOCKER  
**Classe:** COUNSELLED

Hoje `ReservationParticipant.onboarding_status` representa cadastro pessoal, enquanto o progresso agregado usa flags no JSON da reserva. A spec diz que progresso inclui preferências e checklist, mas não determina se o status existente muda de significado, se surgem estados por etapa ou se tudo é derivado. Isso afeta dashboard, retomada e migração.

**Disposição proposta:** preservar o significado do status de cadastro ou supersedi-lo explicitamente. Definir etapas, fonte durável/derivada, denominador do progresso, comportamento quando uma etapa não tem configuração e regra agregada da reserva.

## 3. Findings importantes não bloqueantes isoladamente

### G13 — Unidade operacional e conversão de embalagem perderam definição

**Severidade:** MAJOR  
**Classe:** HUMAN AUTHORITY

`standard_quantity_per_participant` é inteiro, mas “unidade operacional” pode ser unidade, litro, lata, garrafa, pacote ou saco. O owner anterior pede `package_size` e conversão; a spec pede CSV/texto, mas não inclui nem exclui conversão em embalagens. Quantidades inteiras não suportam litros fracionários.

**Disposição proposta:** definir unidade por produto, catálogo inicial e se conversão em embalagem pertence ao P0. Se excluída, registrar supersessão e backlog; se incluída, definir arredondamento e exibição.

### G14 — A consolidação não define consistência do snapshot de leitura

**Severidade:** MAJOR  
**Classe:** AUTONOMOUS após contrato

Escolhas, estados de reservas e quantidade padrão podem mudar durante consulta/exportação. Sem uma leitura consistente, totais e detalhamento podem discordar dentro da mesma resposta.

**Disposição proposta:** exigir que total, detalhamento e timestamp de uma consulta/exportação sejam derivados do mesmo snapshot transacional. Definir timezone e significado de “última atualização”.

### G15 — Exportação CSV/texto carece de contrato mínimo e proteção

**Severidade:** MAJOR  
**Classe:** COUNSELLED

Não há colunas, ordenação, encoding, separador, nome do arquivo, escopo dos detalhes nem tratamento de campos iniciados por caracteres de fórmula. O texto copiável também não tem formato verificável.

**Disposição proposta:** definir contrato mínimo estável, UTF-8, ordenação determinística e neutralização de CSV injection para campos livres. Restringir exportação ao token administrativo.

### G16 — Auditoria está enunciada, mas os eventos e dados permitidos não

**Severidade:** MAJOR  
**Classe:** COUNSELLED

“Evento auditável sem dados sensíveis desnecessários” permite registrar desde apenas IDs até texto de alergias. Também não há eventos mínimos, ator para sessão simulada, estado anterior/novo de conjuntos ou correlação de requests.

**Disposição proposta:** listar eventos mínimos e payload allowlist. Para restrições, registrar que houve alteração e identificadores/códigos estritamente necessários, evitando texto livre no evento. Definir se submissão idempotente sem mudança cria novo evento; recomenda-se que não, mas isso precisa constar no contrato.

### G17 — Semântica de falha atômica não cobre comandos compostos

**Severidade:** MAJOR  
**Classe:** COUNSELLED

“Requests inválidos não produzem atualização parcial” não informa se bebidas e restrições são um comando único ou endpoints separados, nem como a UI lida com sucesso parcial entre requests.

**Disposição proposta:** mapear endpoints/comandos às fronteiras transacionais e definir UX de retry. Um comando composto deve ser atômico; comandos separados devem expor progresso independente.

### G18 — Credencial administrativa compartilhada versus “token válido”

**Severidade:** MAJOR  
**Classe:** HUMAN AUTHORITY

O owner permite login local compartilhado apenas durante desenvolvimento e exige usuários individuais antes da publicação. A spec exclui prova de deploy, mas não declara se o aceite P0 é estritamente ambiente local. O ator administrativo auditável não é individual com o token atual.

**Disposição proposta:** declarar explicitamente que ACCEPTED desta épica não autoriza publicação com credencial compartilhada e registrar autenticação administrativa individual como gate de produção no backlog. Eventos locais devem identificar o principal disponível sem alegar identidade individual.

### G19 — ACs não provam vários invariantes declarados

**Severidade:** MAJOR  
**Classe:** AUTONOMOUS

Faltam critérios/evidências explícitos para: autorização cruzada de participante e exportação; atomicidade de request inválido; auditoria; recálculo retroativo; edição/desativação de oferta/checklist; concorrência de saldo em PostgreSQL; reserva parcialmente paga que ocupa vaga; histórico público; CSV seguro.

**Disposição proposta:** expandir a matriz depois das decisões, mantendo um requisito por comportamento falsificável e nomeando ambiente PostgreSQL onde locks/concorrência forem parte da prova.

## 4. Decisões humanas mínimas antes de READY

As três decisões já listadas na spec são necessárias, mas insuficientes. A autoridade de produto deve também decidir e registrar:

1. se “não quero nenhuma bebida” é resposta válida e como fica distinguida de pendência;
2. efeito de criar, editar, desativar e remover ofertas sobre escolhas, completude e consolidação;
3. autoridade do comprador sobre dados e ações de todos os participantes;
4. regra operacional de `PARTIALLY_PAID`, ocupação e expiração;
5. capacidades administrativas exatas incluídas no “dashboard completo”;
6. fontes e escopo P0 de encontro, avisos, WhatsApp e histórico público;
7. cardinalidade/retroatividade do checklist;
8. estrutura e alerta das restrições alimentares;
9. catálogo e aliases usados na migração legada;
10. inclusão ou exclusão da conversão em embalagens no P0;
11. limite temporal para alteração de preferências, participantes, ofertas e checklist, pendência já reconhecida pelo owner anterior;
12. tratamento de webhook tardio ou pagamento externo acima do saldo, ainda que o provedor desta entrega seja simulado.

## 5. Condições propostas para novo Grill / READY

- Incorporar as disposições dos blockers G01–G12 no owner normativo, sem deixar escolhas de produto para a implementação.
- Transformar o escopo administrativo em lista fechada de capacidades incluídas e excluídas.
- Adicionar contratos de estado/comando para escolhas, restrições, checklist e saldo.
- Anexar plano de migração com catálogo/aliases e casos de dados inválidos ou ambíguos.
- Expandir critérios e matriz para autorização, concorrência PostgreSQL, auditoria, migração e exportação.
- Executar delta Grill independente sobre a nova versão.
- Somente então obter declaração humana explícita de READY com data e versão.

