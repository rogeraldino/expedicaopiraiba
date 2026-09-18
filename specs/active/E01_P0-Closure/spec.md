# E01 — Fechamento do P0 operacional

**Versão:** 0.3 — 18/09/2026  
**Lifecycle:** VALIDATED  
**Risco:** HIGH — altera dados e semântica por participante, pagamentos posteriores, autorização e consolidação operacional.  
**Autoridade de produto:** Rodrigo  
**READY:** aprovado por Rodrigo em 18/09/2026 após `grill.md` e `counsel.md`.  
**VALIDATED:** validado após resolução integral dos findings P01–P11 e Ponytail delta PASS em 18/09/2026.

## 1. Resultado

O comprador poderá concluir a preparação de todos os participantes, escolher bebidas oferecidas sem informar quantidades, revisar e pagar saldo, acompanhar a viagem em “Minha Expedição” e completar checklist. O organizador terá painel por expedição e lista consolidada de compras baseada em quantidades padrão configuradas.

## 2. Owners e supersessão proposta

- Governança: `docs/sdd/CONSTITUTION.md`.
- Produto original: `documentos/sdd/base_conhecimento_mvp_expedicao_piraiba.md`.
- Plano anterior: `documentos/sdd/SDD_parte_2.md`.

Esta spec substitui somente a semântica em que o participante informa unidades de bebida. A nova regra é escolha booleana por produto oferecido; a quantidade operacional pertence à configuração da oferta. Os demais requisitos continuam válidos.

## 3. Escopo

1. Catálogo estruturado de bebidas e ofertas por expedição.
2. Escolhas e restrições alimentares individualizadas por participante.
3. Migração do JSON atual sem inventar autoria quando houver vários participantes.
4. Consolidação e lista de compras por expedição.
5. Página “Minha Expedição”.
6. Cobrança simulada do saldo restante.
7. Checklist configurável e conclusão individual.
8. Dashboard operacional completo para este P0.
9. Autorização por objeto, auditoria e testes correspondentes.

## 4. Não objetivos

- Cartão, PIX real, WhatsApp/e-mail real, fornecedores, estoque, PDF/XLSX e app móvel.
- Seleção de pratos ou cardápio.
- Gestão avançada de reembolso e conciliação.
- Provar deploy em VM ou provedor real nesta entrega local.

## 5. Bebidas: contrato observável proposto

### 5.1 Catálogo e oferta

`Product` representa uma opção escolhível, com nome, categoria, unidade operacional e estado ativo. `ExpeditionProduct` habilita o produto para uma expedição e define `standard_quantity_per_participant`, inteiro positivo, além de ordem e observação.

O participante vê apenas produtos ativos e habilitados para sua expedição. Ele escolhe **quero/não quero** cada opção. A interface MUST NOT pedir unidades.

### 5.2 Quantidade operacional

Para cada produto:

```text
total_operacional = participantes_que_escolheram × quantidade_padrão_por_participante
```

Selecionar mais de uma bebida aplica a quantidade padrão completa a cada bebida selecionada. O padrão é planejamento operacional dinâmico: alterá-lo muda a consolidação futura, preservando a escolha. Toda alteração registra valor anterior, novo, ator e data; a lista exibe o padrão vigente e sua atualização.

Quantidade padrão é responsabilidade do organizador. Participante não a altera nem necessariamente precisa vê-la.

### 5.3 Escolhas individuais

`ParticipantProductChoice(participant, expedition_product, selected, updated_at)` é única pelo par participante/oferta. Envio é substituição idempotente do conjunto daquele participante. Produto ausente da oferta, inativo ou de outra expedição é rejeitado.

O comando recebe a lista integral de ofertas selecionadas; omitidas tornam-se não selecionadas. Toda validação ocorre antes da escrita atômica, a repetição preserva o estado e, em concorrência, prevalece o último salvamento confirmado. A resposta devolve o estado canônico. Um marcador durável permite confirmar explicitamente que nenhuma opção é desejada. Nova oferta ativa não desfaz a confirmação anterior; aparece como não selecionada.

Participantes da mesma reserva nunca compartilham escolhas ou restrições. Navegar entre participantes preserva os dados persistidos.

### 5.4 Migração do JSON legado

- Reserva com um participante: chaves legadas com valor positivo são convertidas em escolhas quando houver correspondência inequívoca com o catálogo.
- Reserva com vários participantes: não atribuir escolhas coletivas a indivíduos. Preservar o JSON como legado auditável e marcar preferências individuais pendentes.
- Texto de restrição legado com um participante migra para observação individual; com vários, permanece legado para revisão administrativa.
- A migration MUST ser reexecutável de forma segura ou ter proteção equivalente.

## 6. Restrições alimentares

Cada participante pode selecionar várias restrições estruturadas e fornecer detalhes livres por participante. “Sem restrições” é mutuamente exclusivo com outras opções; “outros” exige detalhes. Salvar vazio mantém etapa pendente; confirmação explícita de “sem restrições” conclui a etapa. O sistema não infere gravidade médica; qualquer restrição diferente de “sem restrições” gera alerta operacional.

## 7. Minha Expedição

Rota autorizada pela sessão do cliente, sem concessão por UUID isolado. Exibe contagem regressiva, status, datas/local, participantes, progresso, financeiro, vencimento, preferências por participante, checklist, avisos operacionais, histórico resumido e WhatsApp.

Dados já concluídos são retomados sem nova solicitação. Reserva de terceiro retorna 404 depois da autenticação para reduzir enumeração.

## 8. Pagamento de saldo

Reserva `CONFIRMED` ou `PARTIALLY_PAID` com saldo positivo pode criar nova cobrança PIX simulada exatamente pelo saldo atual. Cobrança pendente existente para o saldo é reutilizada. Confirmação idempotente soma pagamentos e leva a `PAID` quando atingir o total. Valor acima do saldo é rejeitado.

`CONFIRMED` significa sinal mínimo atingido. `PARTIALLY_PAID` abaixo do sinal não garante vaga e continua sujeito ao vencimento do hold; somente reservas que garantem vaga entram na consolidação. A criação da cobrança trava a reserva e reutiliza apenas cobrança `BALANCE` ativa com valor exato; incompatíveis são canceladas. Saldo zero retorna o estado pago sem criar cobrança. Pagamento após o vencimento do saldo continua permitido no simulador, com alerta administrativo. Webhook tardio ou confirmação que excederia o saldo é registrado para reconciliação e rejeitado sem alterar o total confirmado. Corridas são provadas em PostgreSQL.

## 9. Checklist

Checklist pertence à expedição; itens possuem ordem e obrigatoriedade. Cada participante tem conclusão própria. Item recomendado pendente não bloqueia a etapa; todos os itens obrigatórios ativos devem estar concluídos para finalizar checklist daquele participante. Progresso da reserva exige todos os participantes completos.

Há um checklist ativo por expedição. Adicionar ou tornar obrigatório um item reabre a pendência; desativar um item o remove do cálculo preservando histórico. Edições após `IN_PROGRESS` são bloqueadas. O estado de cadastro pessoal existente mantém seu significado; preferências, restrições e checklist possuem confirmações próprias e o progresso agregado é derivado dessas fontes.

## 10. Dashboard e consolidação

O painel permite filtrar por expedição/status, abrir detalhes, ver saldos, vencimentos, cadastros, escolhas, restrições, checklist e histórico. Indicadores por expedição incluem capacidade, hold, confirmação, disponibilidade, financeiro e pendências.

Entram no P0: criar/editar expedições; configurar encontro, ofertas e checklist; filtrar e detalhar reservas; pagamento manual simulado; cancelamento com motivo; alertas; consolidação; CSV/texto; conversão em embalagens. Reembolso, imagens administráveis e usuários administrativos individuais ficam no backlog de produção.

A consolidação inclui somente `CONFIRMED` e `PAID`; `PARTIALLY_PAID` só entra se o sinal mínimo tiver sido atingido, caso em que deve transicionar para `CONFIRMED`. Exclui `HELD`, `AWAITING_PAYMENT`, demais `PARTIALLY_PAID`, `EXPIRED`, `CANCELLED` e `REFUNDED`. Exibe produto, unidade, pessoas que escolheram, padrão vigente, total, caixas completas e sobra quando `package_size` existir, detalhamento e última atualização do mesmo snapshot transacional. Exportação mínima: CSV UTF-8 neutralizado contra fórmulas e texto copiável, ambos com ordenação determinística e autorização administrativa.

Ofertas e produtos referenciados não são apagados: são desativados. Escolhas históricas permanecem visíveis, mas ofertas inativas saem da consolidação corrente. Ofertas não podem ser modificadas depois que a expedição entra em andamento.

## 11. Autorização, auditoria e falhas

- Toda API do cliente resolve a reserva pelo cliente autenticado.
- Atualizações de participante verificam pertencimento à reserva.
- Operações administrativas exigem token administrativo válido.
- Mudanças de escolha, restrição, checklist e pagamento geram evento auditável sem registrar dados sensíveis desnecessários.
- Requests inválidos não produzem atualização parcial.
- Repetição do mesmo comando produz o mesmo estado observável.

## 12. Critérios de aceite

| ID | Resultado obrigatório | Evidência executada | Estado |
|---|---|---|---|
| AC01 | Participantes escolhem opções sem informar unidades | `CustomerReservationPreferencesView` (410) + UI booleana | PASSED |
| AC02 | Escolhas e restrições são isoladas por participante | `P0ParticipantPreferencesTests` em `reservations/tests.py` | PASSED |
| AC03 | Somente ofertas ativas da expedição são aceitas | Teste adversarial de oferta de outra expedição rejeitada (400) | PASSED |
| AC04 | Consolidação usa escolhas × padrão e exclui estados inválidos | `OperationsApiTests.test_consolidation...` + snapshot atômico | PASSED |
| AC05 | Migração preserva legado sem atribuição ambígua | `LegacyPreferencesMigratorTests` em `tests_migrations.py` | PASSED |
| AC06 | Minha Expedição exige sessão dona e retoma estado | `CustomerReservationDetailView` + ownership 404 + UI | PASSED |
| AC07 | Saldo gera cobrança exata, reutilizável e idempotente | `BalancePaymentConcurrencyTests` em PostgreSQL real | PASSED |
| AC08 | Checklist é individual e obrigatórios controlam conclusão | Checklist individual + bloqueio em `IN_PROGRESS` (409) | PASSED |
| AC09 | Dashboard apresenta indicadores, pendências e lista exportável | Overview com indicadores, alertas e lista com CSV/TXT/detalhes | PASSED |
| AC10 | Testes, lint, TypeScript, build, migrations e docs passam | 29 testes PostgreSQL, migrations dry-run, lint, tsc, build, docs | PASSED |

## 13. Plano incremental

1. Modelos, migrations, seed e migração do legado.
2. APIs individuais de escolhas/restrições e consolidação.
3. Tela de preferências por participante.
4. Checklist e progresso.
5. Minha Expedição e pagamento de saldo.
6. Dashboard, filtros e exportações.
7. Validação, correções, Ponytail e pacote de aceite.

## 14. Decisões e limites registrados no READY

- O comprador autenticado pode editar todos os participantes de sua própria reserva; participantes convidados não possuem sessão própria no P0.
- Produtos usam unidade operacional inteira (`unidade`, `lata`, `garrafa`, `pacote` ou `saco`) e embalagem opcional inteira.
- A migração usa aliases explícitos do catálogo; valores positivos significam escolha. Chaves desconhecidas e reservas multipessoa permanecem no legado com pendência administrativa.
- “Minha Expedição” é visível ao dono para todos os estados, com mensagens adequadas; histórico público usa allowlist sem payload sensível. Encontro vem da expedição, WhatsApp da configuração e avisos são derivados de saldo vencido, pendências e proximidade.
- Preferências podem ser alteradas até a expedição entrar em andamento. Participantes, ofertas e checklist seguem o mesmo limite operacional.
- O aceite desta épica é local e não autoriza publicação com credencial administrativa compartilhada.

Não há integração externa nova nesta versão; o gate de VM/provedor real fica fora do aceite local e no backlog de produção.
