# SDD Parte 2 — Plano de conclusão do MVP Expedição Piraíba

> Continuação operacional de `base_conhecimento_mvp_expedicao_piraiba.md`.
>
> Este documento registra somente o que ainda falta, o comportamento esperado e a ordem recomendada de implementação. Em caso de conflito, as regras críticas e os princípios do documento original continuam válidos.

---

## 1. Decisão de execução

As integrações com provedores externos serão implementadas por último.

Até essa fase, o desenvolvimento deve usar adaptadores locais ou simuladores para:

- pagamentos;
- envio de código por WhatsApp;
- envio de código por e-mail;
- notificações por WhatsApp;
- e-mails transacionais.

As regras de negócio não podem depender diretamente de um provedor. Reserva, pagamento, verificação e notificação devem possuir contratos internos que permitam trocar o simulador por uma integração real sem reescrever o domínio.

---

## 2. Estado atual resumido

### 2.1. Implementado

- Home com identidade visual, expedições, diferenciais e galeria.
- Detalhes da expedição.
- Checkout sem cadastro tradicional.
- Coleta de CPF, nome, e-mail e celular.
- Verificação temporária simulada.
- Participantes básicos vinculados à reserva.
- Reserva temporária de vagas por 15 minutos.
- Controle transacional de capacidade.
- Snapshot de preço.
- Pagamento PIX simulado.
- Webhook simulado e idempotente.
- Confirmação da reserva após pagamento.
- Dashboard administrativo inicial.
- Consulta de clientes, participantes, reservas e pagamentos.
- Cadastro de expedições e alteração básica de status.
- Ferramenta local para limpar dados transacionais de teste.

### 2.2. Parcialmente implementado

- Confirmação de compra existe dentro do checkout, mas ainda não é a Tela 04 completa.
- Participantes possuem somente nome, sem onboarding individual completo.
- Dashboard mostra indicadores básicos, mas ainda não fornece toda a visão operacional prevista.
- Holds vencidos deixam de ocupar vagas nas consultas, mas ainda falta expiração automática e auditável.
- Modalidades de sinal e pagamento integral existem, mas falta cobrança posterior do saldo.
- Estados existem, mas suas transições ainda não são validadas por uma máquina de estados do domínio.

---

# 3. Fase 1 — Base de domínio e consistência operacional

Esta fase deve ser concluída antes das novas telas, pois será a fonte de verdade do onboarding, preferências e dashboard.

## 3.1. Estado financeiro da reserva

### Requisitos

- Calcular `paid_amount` pela soma de pagamentos confirmados.
- Calcular `remaining_balance = total_price - paid_amount`.
- Nunca armazenar um saldo manual divergente dos pagamentos.
- Permitir múltiplos pagamentos para a mesma reserva.
- Impedir pagamento que ultrapasse o saldo, salvo regra explícita de crédito/reembolso.
- Registrar vencimento do saldo quando a compra for realizada por sinal.
- Considerar a reserva:
  - `CONFIRMED` quando o sinal mínimo estiver pago;
  - `PAID` quando o total estiver quitado;
  - `PARTIALLY_PAID` quando houver pagamento confirmado inferior ao mínimo necessário para confirmação, caso esse cenário seja permitido;
  - `REFUNDED` quando todos os valores confirmados forem devolvidos.

### Critérios de aceitação

```gherkin
Dado uma reserva de R$ 4.980
E pagamentos confirmados de R$ 1.200
Quando consulto a reserva
Então o valor pago deve ser R$ 1.200
E o saldo restante deve ser R$ 3.780
```

## 3.2. Transições válidas de estado

Criar serviços de domínio para impedir alterações arbitrárias.

### Expedition

```text
DRAFT → PUBLISHED
PUBLISHED → SOLD_OUT | CLOSED | CANCELLED
SOLD_OUT → IN_PROGRESS | CANCELLED
CLOSED → IN_PROGRESS | CANCELLED
IN_PROGRESS → COMPLETED
```

### Reservation

```text
HELD → AWAITING_PAYMENT | EXPIRED | CANCELLED
AWAITING_PAYMENT → CONFIRMED | PAID | EXPIRED | CANCELLED
CONFIRMED → PAID | CANCELLED | REFUNDED
PARTIALLY_PAID → CONFIRMED | PAID | CANCELLED | REFUNDED
PAID → CANCELLED | REFUNDED
```

- Uma transição inválida deve retornar erro de domínio.
- Toda mudança administrativa deve registrar autor, data, estado anterior, estado novo e motivo opcional.
- Status de expedição `SOLD_OUT` pode ser derivado da ocupação, mas a estratégia definitiva deve ser única e documentada.

## 3.3. Expiração automática de holds

- Criar comando/job idempotente para localizar holds vencidos.
- Alterar `HELD` e `AWAITING_PAYMENT` vencidos para `EXPIRED` quando nenhum pagamento suficiente tiver sido confirmado.
- Não apagar a reserva, o cliente nem o histórico.
- Liberar as vagas imediatamente nos cálculos de disponibilidade.
- Permitir reexecução segura do job.
- Registrar quantidade de reservas expiradas e falhas.

## 3.4. Histórico da reserva

Criar uma trilha operacional contendo, no mínimo:

- reserva criada;
- hold iniciado;
- pagamento criado;
- pagamento confirmado ou rejeitado;
- reserva confirmada;
- saldo pago;
- dados dos participantes atualizados;
- preferências atualizadas;
- reserva expirada;
- cancelamento;
- reembolso;
- mudança administrativa.

---

# 4. Fase 2 — Participantes e onboarding

## 4.1. Dados complementares do participante

Cada participante deve poder possuir:

- nome completo;
- CPF, quando operacionalmente necessário;
- data de nascimento, caso aprovada pelo cliente;
- celular;
- contato de emergência;
- telefone do contato de emergência;
- observações operacionais;
- estado do cadastro: `PENDING`, `IN_PROGRESS`, `COMPLETED`.

CPF e data de nascimento não devem ser tornados obrigatórios sem confirmação da necessidade pelo cliente. A modelagem pode suportá-los como opcionais.

## 4.2. Responsabilidade pelo preenchimento

- O comprador pode preencher os dados de todos os participantes.
- A arquitetura deve permitir futuramente enviar um link individual seguro a cada participante.
- Um participante só pode pertencer a uma reserva.
- Alterações devem ser autorizadas pelo comprador daquela reserva ou por administrador.
- O progresso deve ser salvo por etapa.

## 4.3. Tela 04 — Confirmação e onboarding

Implementar de acordo com `imgs/tela-04-confirmacao-onboarding.png`.

### Conteúdo obrigatório

- confirmação clara da reserva;
- número ou referência amigável da reserva;
- expedição, datas e quantidade de vagas;
- valor total;
- valor pago;
- saldo restante;
- vencimento, quando existir;
- progresso do onboarding;
- etapas pendentes e concluídas;
- CTA para continuar agora;
- possibilidade de continuar depois;
- acesso à área Minha Expedição.

### Etapas iniciais

1. Pagamento inicial.
2. Dados dos participantes.
3. Bebidas e preferências.
4. Restrições alimentares.
5. Checklist da viagem.

---

# 5. Fase 3 — Bebidas, alimentação e preferências

Implementar de acordo com `imgs/tela-05-bebidas-preferencias.png`.

## 5.1. Limite atual do escopo alimentar

O SDD original não define escolha de cardápio ou pratos. Para o MVP:

- bebidas e gelo são produtos selecionáveis;
- alimentação é representada por restrições, alergias e observações;
- refeições específicas, cardápios e quantidades de alimentos não fazem parte do escopo até nova decisão do cliente.

## 5.2. Modelos necessários

### Product

- nome;
- categoria: `BEER`, `WATER`, `SOFT_DRINK`, `JUICE`, `ICE`, `OTHER`;
- unidade de medida;
- tamanho de embalagem opcional;
- ativo/inativo;
- ordem de exibição.

### ExpeditionProduct

- expedição;
- produto;
- disponível ou indisponível;
- quantidade máxima opcional por participante;
- observação operacional opcional.

### ParticipantProductPreference

- participante;
- produto disponível na expedição;
- quantidade inteira não negativa;
- data de atualização.

### DietaryRestriction

Opções iniciais:

- sem restrições;
- vegetariano;
- intolerância à lactose;
- alergia a frutos do mar;
- outros.

### ParticipantDietaryRestriction

- participante;
- restrição;
- detalhes complementares;
- nível de atenção opcional, caso posteriormente aprovado.

## 5.3. Regras de negócio

- Preferências pertencem ao participante, nunca diretamente ao comprador.
- Apenas produtos habilitados para a expedição podem ser solicitados.
- `quantity >= 0`.
- Quantidade zero remove ou neutraliza a preferência.
- Limites configurados por participante devem ser respeitados no backend.
- Preferências de participantes diferentes nunca podem ser sobrescritas entre si.
- Alterações devem atualizar o progresso do onboarding.
- Restrições alimentares devem aparecer destacadas no painel administrativo.
- Observação livre complementa os dados estruturados e não os substitui.

## 5.4. Tela 05 — Bebidas e preferências

### Conteúdo obrigatório

- identificação da expedição;
- progresso do onboarding;
- seleção do participante;
- lista de produtos disponíveis;
- controles de aumentar e reduzir quantidade;
- quantidade atual claramente visível;
- gelo adicional;
- restrições alimentares;
- campo de observações;
- salvar e avançar;
- confirmação visual de dados salvos;
- navegação entre participantes sem perda de dados.

### Critérios de aceitação essenciais

```gherkin
Dado que João e Pedro pertencem à mesma reserva
Quando registro 24 Heineken para João
Então Pedro deve continuar com quantidade zero

Dado que Heineken não está habilitada para a expedição
Quando tento enviar uma preferência por API
Então a operação deve ser rejeitada
```

---

# 6. Fase 4 — Minha Expedição

Implementar de acordo com `imgs/tela-06-minha-expedicao.png`.

## 6.1. Acesso

- CPF ou ID da reserva isoladamente não concedem acesso.
- Durante o desenvolvimento, usar sessão simulada emitida após a verificação já existente.
- A sessão deve autorizar somente reservas do cliente verificado.
- Preparar o contrato para links seguros e códigos reais na fase de provedores.
- Operações sensíveis devem exigir verificação recente.

## 6.2. Conteúdo obrigatório

- dias restantes para a viagem;
- estado da reserva;
- resumo da expedição;
- datas e ponto de encontro;
- participantes;
- progresso do onboarding;
- valor total, pago e saldo restante;
- data de vencimento;
- CTA para pagar saldo;
- preferências cadastradas;
- checklist;
- avisos operacionais;
- CTA para WhatsApp;
- histórico resumido da reserva.

## 6.3. Retomada

- O cliente pode interromper o onboarding e continuar posteriormente.
- Dados concluídos não devem ser solicitados novamente.
- Links não podem revelar dados antes da autorização.
- O progresso deve ser calculado a partir das etapas realmente concluídas.

---

# 7. Fase 5 — Checklist da viagem

## 7.1. Modelos

### Checklist

- expedição;
- título;
- prazo opcional;
- estado ativo/inativo.

### ChecklistItem

- checklist;
- título;
- descrição opcional;
- obrigatório ou recomendado;
- ordem.

### ParticipantChecklistItem

- participante;
- item;
- concluído;
- data de conclusão.

## 7.2. Itens iniciais sugeridos

- documento pessoal;
- protetor solar;
- repelente;
- roupa UV;
- boné;
- óculos;
- equipamentos de pesca;
- medicamentos pessoais.

## 7.3. Regras

- O administrador configura o checklist da expedição.
- Cada participante possui seu próprio estado de conclusão.
- Itens recomendados não bloqueiam o onboarding.
- Itens obrigatórios pendentes geram alerta operacional.

---

# 8. Fase 6 — Dashboard administrativo completo

O dashboard atual deve ser expandido, preservando sua identidade visual.

## 8.1. Indicadores por expedição

- capacidade;
- vagas em hold;
- vagas confirmadas;
- vagas disponíveis;
- valor vendido;
- valor recebido;
- saldo pendente;
- quantidade de reservas;
- quantidade de participantes;
- cadastros incompletos;
- preferências pendentes;
- checklists pendentes.

## 8.2. Gestão de reservas

- filtrar por expedição;
- filtrar por estado;
- pesquisar por nome, CPF, e-mail ou telefone;
- abrir página individual da reserva;
- visualizar histórico;
- visualizar pagamentos;
- registrar pagamento manual simulado;
- confirmar ou cancelar conforme transições permitidas;
- registrar motivo de cancelamento;
- iniciar reembolso simulado;
- visualizar saldo e vencimento;
- visualizar participantes e completude cadastral.

Nenhuma ação administrativa deve alterar diretamente o estado sem passar pelo serviço de domínio correspondente.

## 8.3. Gestão de expedições

- criar;
- editar todos os campos comerciais;
- publicar;
- encerrar vendas;
- marcar como esgotada;
- iniciar;
- concluir;
- cancelar;
- configurar ponto e horário de encontro;
- configurar vencimento padrão do saldo;
- configurar produtos disponíveis;
- configurar checklist;
- associar imagens.

## 8.4. Alertas operacionais

Exibir, no mínimo:

- saldo vencido;
- pagamento aguardando confirmação;
- cadastro de participante incompleto;
- preferências não preenchidas;
- restrição alimentar que exige atenção;
- checklist obrigatório pendente;
- expedição próxima sem dados operacionais completos.

## 8.5. Segurança administrativa

- Manter o login local atual somente durante desenvolvimento.
- Antes da publicação, substituir credencial compartilhada por usuários administrativos reais.
- Senhas devem utilizar hash seguro.
- Ações sensíveis devem registrar o administrador responsável.
- Permissões devem ser validadas no backend.

---

# 9. Fase 7 — Consolidação e lista de compras

## 9.1. Consolidação

```text
total_product_quantity(expedition, product) =
SUM(preferences.quantity)
```

Considerar apenas reservas operacionalmente válidas:

- `CONFIRMED`;
- `PARTIALLY_PAID`, se ainda garantir vaga;
- `PAID`.

Reservas `HELD`, `EXPIRED`, `CANCELLED` ou `REFUNDED` não entram na consolidação definitiva.

## 9.2. Visões necessárias

- total por produto;
- detalhamento por participante;
- detalhamento por reserva;
- restrições alimentares consolidadas;
- participantes sem preferências preenchidas;
- última atualização dos dados.

## 9.3. Conversão em embalagens

- Preservar o total em unidades.
- Quando `package_size` estiver definido, calcular caixas completas e unidades adicionais.

Exemplo:

```text
170 unidades / caixa de 24 = 7 caixas + 2 unidades
```

## 9.4. Exportação

Ordem recomendada:

1. CSV.
2. Texto copiável para WhatsApp.
3. PDF.
4. XLSX.

---

# 10. Fase 8 — Galeria e mídia das expedições

## 10.1. ExpeditionMedia

- expedição;
- arquivo ou URL;
- texto alternativo;
- legenda opcional;
- tipo de uso: capa, galeria, detalhe;
- ordem;
- ativo/inativo.

## 10.2. Regras

- Não depender de nomes fixos de arquivos no frontend.
- Cada expedição deve poder selecionar sua capa e galeria.
- Imagens sem autorização de uso não devem ser publicadas.
- Gerar variações adequadas para capa, card e galeria.
- Preservar originais fora da pasta pública otimizada.

As 58 imagens de `documentos/ims-pesca` serão classificadas quando esta fase começar.

---

# 11. Fase 9 — Notificações simuladas e eventos internos

Antes dos provedores reais, implementar o comportamento e registrar notificações em banco/log.

## 11.1. Eventos

- `ReservationHeld`;
- `ReservationExpired`;
- `PaymentCreated`;
- `PaymentConfirmed`;
- `ReservationConfirmed`;
- `ParticipantAdded`;
- `PreferencesUpdated`;
- `BalanceDueSoon`;
- `BalancePaid`;
- `ExpeditionSoldOut`.

## 11.2. Notificações previstas

- código de verificação;
- reserva criada;
- pagamento confirmado;
- onboarding pendente;
- saldo próximo do vencimento;
- saldo vencido;
- lembrete da expedição;
- alteração operacional relevante;
- cancelamento.

Cada tentativa deve registrar canal, destinatário, evento, conteúdo/template, estado e horário, mesmo quando o envio for apenas simulado.

---

# 12. Fase 10 — Provedores externos

Esta fase só começa após as regras e fluxos anteriores estarem estáveis.

## 12.1. Pagamento

- escolher provedor;
- mapear PIX e cartão;
- validar assinatura de webhook;
- reconciliação;
- estorno e reembolso;
- idempotência por evento externo;
- ambiente sandbox e produção separados.

## 12.2. WhatsApp

- escolher API oficial ou parceiro homologado;
- envio de OTP;
- templates aprovados;
- confirmações e lembretes;
- fallback e registro de falhas.

## 12.3. E-mail

- escolher serviço transacional;
- verificação alternativa;
- confirmação de reserva;
- recibos e lembretes;
- política de bounce e falhas.

Segredos de provedores nunca devem ser enviados ao frontend ou versionados no repositório.

---

# 13. Pendências transversais

## 13.1. Regras e dados

- Definir vencimento padrão do saldo.
- Definir política definitiva de cancelamento.
- Definir regras de reembolso parcial e integral.
- Definir até quando preferências podem ser alteradas.
- Definir até quando participantes podem ser substituídos.
- Confirmar quais dados complementares dos participantes são realmente necessários.
- Confirmar catálogo inicial de bebidas, unidades e tamanhos de embalagem.
- Confirmar se gelo pertence ao consumo individual ou à reserva.
- Confirmar se haverá seleção de refeições/cardápio em versão futura.
- Definir quem pode alterar uma reserva depois da confirmação.

## 13.2. Segurança

- HTTPS em produção.
- Autorização por objeto em todas as APIs do cliente.
- Proteção contra enumeração de CPF e reservas.
- Rate limiting para login e códigos.
- Rotação e expiração de tokens.
- Credenciais administrativas individuais.
- Auditoria de ações sensíveis.
- Política de retenção e exclusão de dados pessoais.
- Adequação mínima à LGPD.

## 13.3. Observabilidade

- logs estruturados;
- correlação entre reserva, pagamento e webhook;
- registro de jobs executados;
- captura de exceções;
- métricas de conversão;
- monitoramento de disponibilidade;
- alerta para falha recorrente de job ou webhook.

## 13.4. API e documentação

- documentar contratos da API;
- documentar códigos de erro;
- documentar autenticação do cliente e administrador;
- documentar webhooks;
- manter exemplos de payload;
- gerar ou manter especificação OpenAPI.

## 13.5. Infraestrutura

- configuração de produção na VM Hostinger;
- proxy reverso;
- domínio `www.expedicaopiraiba.com.br`;
- HTTPS;
- banco PostgreSQL com volume persistente;
- backups automáticos e teste de restauração;
- variáveis secretas fora do repositório;
- servidor de aplicação apropriado, sem servidor de desenvolvimento;
- rotina de deploy e rollback;
- ambientes local, homologação e produção separados.

---

# 14. Testes obrigatórios ainda pendentes

## 14.1. Domínio

- todas as transições válidas e inválidas;
- cálculo de saldo com múltiplos pagamentos;
- expiração idempotente de hold;
- concorrência na última vaga;
- cancelamento liberando vagas;
- reembolso preservando auditoria;
- consolidação excluindo reservas inválidas;
- separação de preferências por participante;
- limites de produto;
- cálculo de progresso do onboarding.

## 14.2. Autorização

- cliente não acessa reserva de terceiro;
- participante não altera outro participante sem autorização;
- URL ou UUID isolado não concede acesso;
- administrador não autenticado não acessa dados pessoais;
- ferramenta de limpar dados inexiste fora de desenvolvimento.

## 14.3. Fluxos de interface

- checkout completo;
- confirmação e retomada do onboarding;
- preferências de múltiplos participantes;
- Minha Expedição;
- pagamento de saldo simulado;
- filtros e ações administrativas;
- responsividade das telas 04, 05, 06 e dashboard;
- acessibilidade por teclado e estados de foco;
- mensagens de erro e carregamento.

---

# 15. Definition of Done para as próximas rodadas

Uma funcionalidade só pode ser marcada como concluída quando:

- possui regra de negócio documentada;
- backend é a fonte de verdade;
- autorização é validada no backend;
- estados inválidos são rejeitados;
- caminho feliz e principais erros possuem testes;
- interface segue o mockup correspondente e é responsiva;
- estados de carregamento, vazio, erro e sucesso existem;
- operação crítica é transacional e/ou idempotente quando necessário;
- eventos e alterações relevantes são auditáveis;
- API e SDD são atualizados junto com a implementação;
- build de produção é validado;
- fluxo é testável usando os simuladores locais.

---

# 16. Ordem recomendada de implementação

```text
1. Saldo, vencimentos, transições e histórico
2. Expiração automática de holds
3. Dados completos dos participantes
4. Tela 04 — Confirmação e Onboarding
5. Produtos, bebidas e restrições alimentares
6. Tela 05 — Bebidas e Preferências
7. Autorização e Tela 06 — Minha Expedição
8. Checklist da viagem
9. Dashboard operacional completo
10. Consolidação e lista de compras
11. Mídia dinâmica das expedições
12. Eventos e notificações simuladas
13. Revisão visual, responsiva, segurança e observabilidade
14. Provedores de pagamento, WhatsApp e e-mail
15. Homologação e produção
```

---

# 17. Próxima rodada aprovada

A próxima rodada deve implementar:

1. cálculo de valor pago e saldo restante;
2. vencimento de saldo;
3. serviços de transição de reserva e expedição;
4. histórico auditável da reserva;
5. job idempotente de expiração de holds;
6. testes de domínio correspondentes.

Após essa fundação, iniciar a Tela 04 — Confirmação e Onboarding.

## 17.1. Progresso da rodada

Implementado em 26/08/2026:

- [x] cálculo derivado de valor pago e saldo restante;
- [x] modalidade de pagamento persistida na reserva;
- [x] vencimento de saldo configurável por expedição, inicialmente 30 dias antes;
- [x] serviços de transição de reserva e expedição;
- [x] rejeição de transições inválidas;
- [x] histórico auditável da reserva;
- [x] eventos de criação, cobrança, confirmação e expiração;
- [x] comando idempotente de expiração de holds;
- [x] processo local executando a expiração periodicamente;
- [x] saldo, vencimento e histórico expostos no painel administrativo;
- [x] indicadores de valor vendido, recebido e pendente;
- [x] testes de domínio correspondentes.

Próxima rodada: **Fase 2 — Participantes e onboarding**, começando pela Tela 04.

## 17.2. Progresso da Fase 2

Implementado em 26/08/2026:

- [x] dados complementares opcionais do participante;
- [x] celular e contato de emergência;
- [x] estado individual `PENDING`, `IN_PROGRESS` ou `COMPLETED`;
- [x] progresso do onboarding calculado pelo backend;
- [x] atualização autorizada somente para o cliente responsável pela reserva;
- [x] sessão local assinada do cliente com validade de até 30 dias;
- [x] Tela 04 baseada no mockup oficial;
- [x] resumo financeiro, período, participantes e vencimento;
- [x] cadastro sequencial dos participantes;
- [x] retomada dos dados já persistidos durante a sessão;
- [x] histórico de atualização dos participantes;
- [x] indicador administrativo de cadastros pendentes;
- [x] checkout direcionando para a preparação da viagem após a confirmação.

As etapas de bebidas, restrições e checklist aparecem no progresso, mas permanecem indisponíveis até seus respectivos domínios serem implementados.

Próxima rodada: **Fase 3 — Bebidas, alimentação e preferências**, baseada na Tela 05.
