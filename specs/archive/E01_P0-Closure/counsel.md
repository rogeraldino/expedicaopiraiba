# Counsel independente — E01 Fechamento do P0

**Data:** 18/09/2026  
**Spec analisada:** `spec.md`, versão 0.1, lifecycle DRAFT  
**Papel:** Counsel pré-READY, sem participação na implementação  
**Conclusão:** **NOT READY** até que as decisões humanas abaixo sejam incorporadas à spec e o Grill seja considerado.

## 1. Grounding e precedência

Foram confrontados a Constituição, o Playbook, o Índice Normativo, a spec E01, o produto/MVP, o plano incremental e a implementação atual. A E01 pode substituir a regra anterior de quantidades informadas pelo participante, mas a supersessão ainda é apenas proposta. Até a declaração humana de READY, o código não deve materializar a nova semântica.

Os owners anteriores deixam claros quatro invariantes que a E01 deve preservar:

- preferências e restrições pertencem a cada participante;
- somente ofertas da expedição podem ser escolhidas;
- consolidação é derivada dos registros individuais e considera apenas reservas comercialmente válidas;
- saldo deriva exclusivamente de pagamentos confirmados, aceita múltiplos pagamentos, não admite valor acima do saldo e preserva idempotência/auditoria.

O código atual ainda usa um JSON coletivo em `Reservation`, marca etapas coletivamente e só cria PIX inicial para reservas em hold/aguardando pagamento. Portanto, ele é evidência do ponto de partida, não resposta normativa para as lacunas da E01.

## 2. Escolhas de bebida sem unidades

### Alternativa A — escolha booleana independente por oferta

Cada bebida habilitada é uma escolha `quero/não quero`; cada escolha positiva aplica integralmente o padrão daquela oferta. É a leitura literal da versão 0.1 e a implementação mais simples. Porém, uma pessoa que marque cerveja, água e refrigerante gera três alocações completas. Isso pode inflar compras se “quantidade padrão” significar a cota total de bebidas por pessoa, em vez de uma cota por rótulo.

### Alternativa B — uma escolha exclusiva por categoria

O participante escolhe no máximo uma opção dentro de grupos como cerveja ou refrigerante. Evita multiplicar cotas, mas cria grupos e exclusividade que nenhum owner atual define. Não pode ser adotada sem decisão humana.

### Alternativa C — várias escolhas dividem uma cota

O participante pode escolher várias opções e a operação divide uma cota total. A divisão exige algoritmo de rateio, arredondamento e precedência. Esses conceitos não existem nos owners e também exigem decisão humana.

### Recomendação

Adotar a Alternativa A somente se Rodrigo confirmar expressamente que **cada rótulo escolhido recebe sua própria alocação completa**, mesmo quando várias opções forem marcadas. É a única alternativa já formulada na spec e não exige inventar rateio ou exclusividade. A UI deve comunicar o efeito observável da seleção para evitar que uma escolha aparentemente qualitativa produza uma quantidade operacional inesperada.

Persistir somente escolhas positivas é tecnicamente suficiente para a consolidação, mas não prova que o participante revisou e recusou todas as opções. Recomenda-se separar o estado de conclusão da etapa das linhas selecionadas, por participante. A escolha negativa pode ser representada pela ausência da linha desde que exista confirmação explícita da etapa; persistir `selected=false` é aceitável, porém aumenta estados equivalentes e deve ter uma regra canônica.

## 3. Configuração da quantidade padrão

Há três modelos relevantes:

1. **Dinâmico por oferta:** a consolidação sempre usa o padrão atual. É o que a spec 0.1 descreve. Facilita correções operacionais, mas uma edição muda retroativamente a lista de compras sem alterar escolhas nem produzir necessariamente um evento por participante.
2. **Snapshot na escolha:** a escolha guarda o padrão vigente quando foi confirmada. Preserva o resultado histórico, mas participantes idênticos podem gerar quantidades diferentes e uma correção administrativa exige reconfirmação ou migração.
3. **Versão da oferta:** alterações criam uma nova versão e regras explícitas decidem quais escolhas migram. Oferece melhor rastreabilidade, com custo desproporcional ao MVP.

Recomenda-se o modelo dinâmico para o MVP **se** a quantidade for entendida como planejamento operacional atual, e não promessa individual. Para cumprir auditoria, a alteração administrativa da oferta deve registrar valor anterior, valor novo, ator e data. A lista deve exibir o padrão vigente e sua última atualização. Caso o padrão seja promessa ao cliente, o owner humano deve escolher snapshot ou versionamento; a decisão não é técnica.

A unidade precisa ser inequívoca. `standard_quantity_per_participant` só pode ser inteiro positivo quando a unidade operacional também estiver definida (por exemplo, lata/unidade, garrafa ou saco). `package_size` é conversão comercial e não substitui a unidade operacional. O nome atual sugere quantidade, mas o usuário pediu escolhas; a UI do cliente não deve expor controle de unidades.

## 4. Migração do JSON legado

### Alternativas comparadas

- **Distribuir a preferência coletiva entre todos os participantes:** cria autoria e intenção inexistentes. Rejeitada.
- **Atribuir ao comprador/primeiro participante:** também inventa autoria. Rejeitada.
- **Converter apenas reserva com um participante e preservar casos ambíguos:** mantém informação sem fabricar semântica. Recomendada e alinhada à spec.
- **Não converter nenhum dado:** é conservadora, mas perde uma conversão inequívoca útil nas reservas com um participante.

Para a alternativa recomendada ser executável, a spec deve definir correspondência entre chaves legadas e produtos. Correspondência por nome aproximado não é inequívoca. Recomenda-se uma tabela explícita de aliases no seed/migration e preservação integral do JSON original. Chaves desconhecidas, valores inválidos e produtos sem oferta devem permanecer como legado e gerar pendência administrativa, não ser descartados.

A migration deve ser segura contra reexecução por restrição única e criação idempotente. Também deve registrar contagens de convertidos, ambíguos e ignorados como evidência. Falta definir se reservas históricas em estados excluídos também são migradas ou apenas preservadas; a opção mais conservadora é preservar todos os JSONs e criar escolhas somente onde a conversão for inequívoca, sem confundir migração com elegibilidade para consolidação.

## 5. Pagamento posterior do saldo

### Alternativas comparadas

- **Criar sempre uma nova cobrança pelo saldo:** produz cobranças pendentes concorrentes e permite confirmação tardia acima do saldo. Rejeitada.
- **Reutilizar qualquer cobrança pendente:** pode reutilizar valor antigo que não corresponde mais ao saldo. Rejeitada.
- **Sob lock da reserva, reutilizar somente cobrança ativa cujo valor seja exatamente o saldo; expirar/cancelar as incompatíveis e criar uma única cobrança nova:** recomendada.

A confirmação deve novamente travar a reserva, recalcular o total pago e rejeitar ou reconciliar uma confirmação que faria o total ultrapassar o preço. A idempotência por `external_event_id` existente protege replay do mesmo evento, mas não resolve duas cobranças diferentes confirmadas para o mesmo saldo. É necessário um invariant de concorrência e teste em PostgreSQL.

A spec diz que `CONFIRMED` ou `PARTIALLY_PAID` pode pagar saldo, mas precisa decidir:

- se `PARTIALLY_PAID` ocupa vaga neste produto e em quais condições; o plano anterior a condiciona a “se ainda garantir vaga”;
- o que acontece com cobranças pendentes de saldo quando outra é paga ou quando o saldo muda;
- se saldo vencido ainda pode ser pago pelo mesmo fluxo;
- validade da cobrança PIX de saldo e efeito de sua expiração;
- se `PAID` é o único destino quando saldo chega a zero e como uma confirmação excedente é tratada operacionalmente.

Essas decisões afetam estado, concorrência e dinheiro e são HUMAN AUTHORITY, não detalhes de implementação.

## 6. Tamanho e fronteira da épica

A E01 reúne pelo menos seis domínios observáveis: preferências/restrições, migração, checklist, hub do cliente, pagamentos e operação administrativa/consolidação. Como dossiê de fechamento do P0, uma única épica é defensável; como unidade de implementação e validação, é grande demais para um único salto.

Recomenda-se manter E01 como dossiê HIGH agregador e dividir a execução em incrementos rastreáveis, cada um com critérios e matriz próprios:

1. catálogo/ofertas, escolhas, restrições e migração;
2. consolidação e exportação;
3. checklist e cálculo de progresso;
4. Minha Expedição e autorização por objeto;
5. cobrança de saldo e concorrência financeira;
6. dashboard e operações administrativas incluídas no P0.

Isso não reduz o gate HIGH nem permite aceite parcial da E01. Reduz o risco de misturar falhas e permite evidência por domínio. Mudança semântica em um incremento continua sujeita a delta review.

Há divergência de escopo: o plano owner inclui pagamento manual simulado, cancelamento, reembolso, transições de expedição, edição de campos, configuração de ponto de encontro/produtos/checklist e alertas específicos. A spec usa “dashboard operacional completo para este P0”, mas AC09 cobre apenas indicadores, pendências e lista exportável. Rodrigo precisa declarar quais itens do plano estão dentro da E01 e mover os excluídos explicitamente para backlog; “completo” não pode permanecer interpretável.

## 7. Decisões humanas necessárias antes de READY

Além das três decisões já listadas na spec, são necessárias decisões ou definições incorporadas ao owner:

1. **Múltiplas bebidas:** cada opção selecionada recebe padrão completo, existe exclusividade por grupo ou há rateio?
2. **Natureza do padrão:** planejamento operacional dinâmico ou promessa com snapshot? Alterações afetam escolhas existentes?
3. **Conclusão sem escolhas:** o participante pode confirmar “não quero nenhuma das opções” e concluir a etapa?
4. **Migração:** aprovar a tabela explícita de aliases e o tratamento de chaves desconhecidas/produtos indisponíveis.
5. **Saldo e concorrência:** definir confirmação tardia/excedente, cobranças incompatíveis, expiração e pagamento após vencimento.
6. **`PARTIALLY_PAID`:** definir precisamente quando garante vaga e entra em consolidação.
7. **Dashboard P0:** enumerar quais operações do plano original entram nesta entrega e quais vão para backlog.
8. **Restrições:** confirmar a taxonomia inicial e se detalhes livres são exigidos para “outros”.
9. **Checklist inicial:** definir se haverá seed normativo, quem pode alterar itens após participantes começarem e o efeito de ativar/desativar um obrigatório.

Também devem ser transformados em critérios verificáveis: 404 para acesso autenticado a reserva alheia, ausência de atualização parcial, idempotência de substituição de escolhas, auditoria sem conteúdo alimentar sensível desnecessário e teste PostgreSQL das corridas financeiras.

## 8. Parecer

A direção central da E01 é coerente com o pedido: o participante escolhe opções e a operação controla unidades padrão. A recomendação é preservar essa separação, usar escolhas individuais booleanas com confirmação explícita da etapa, quantidade padrão dinâmica por oferta com auditoria e migração conservadora sem atribuição ambígua.

O dossiê permanece **NOT READY** porque escolhas semanticamente distintas ainda cabem no texto atual, especialmente em múltiplas bebidas, retroatividade, cobrança concorrente e fronteira do dashboard. Depois das decisões humanas e da incorporação dos findings do Grill, a spec deve subir de versão e receber declaração READY explícita com data e versão, conforme a Constituição.
