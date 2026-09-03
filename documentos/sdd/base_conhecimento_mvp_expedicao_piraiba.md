# Base de Conhecimento — MVP Expedição Piraíba

> Documento de especificação funcional inicial para apoiar desenvolvimento orientado a especificações (SDD — Spec-Driven Development) do MVP da plataforma **Expedição Piraíba**.

---

## 1. Visão do produto

A plataforma Expedição Piraíba tem como objetivo transformar a operação atual, baseada em Instagram, WhatsApp e planilhas manuais, em um fluxo digital estruturado para:

- divulgação das expedições;
- reserva de vagas;
- pagamento de sinal ou valor integral;
- cadastro de participantes;
- coleta de preferências de bebidas e alimentação;
- acompanhamento da viagem;
- gestão administrativa das reservas;
- consolidação operacional das demandas da expedição.

A proposta do MVP não é substituir completamente o WhatsApp. O WhatsApp continua como canal de relacionamento, enquanto a plataforma passa a ser a **fonte oficial de dados da operação**.

---

## 2. Personas

### 2.1. Visitante
Pessoa que conhece a Expedição Piraíba por Instagram, indicação, WhatsApp, anúncio ou busca.

**Objetivo principal:** entender a proposta, confiar no serviço e encontrar uma expedição adequada.

### 2.2. Comprador / Responsável pela reserva
Pessoa que realiza a reserva para si e, eventualmente, para outros participantes.

**Objetivo principal:** garantir as vagas e realizar o pagamento com pouca fricção.

### 2.3. Participante
Pessoa vinculada a uma reserva.

**Objetivo principal:** informar seus dados e preferências para que a expedição seja preparada corretamente.

### 2.4. Organizador / Administrador
Responsável pela Expedição Piraíba.

**Objetivo principal:** acompanhar vendas, pagamentos, participantes e necessidades operacionais sem depender de planilhas manuais.

---

## 3. Princípios de produto do MVP

1. **Conversão antes de cadastro:** o usuário não deve ser obrigado a criar conta antes de iniciar a compra.
2. **Dados estruturados no lugar de mensagens livres:** bebidas, participantes e pagamentos devem existir como dados do sistema.
3. **WhatsApp como apoio, não como banco de dados.**
4. **Pagamento confirmado apenas pelo backend/webhook do provedor.**
5. **Vagas devem possuir controle de concorrência e reserva temporária.**
6. **Toda reserva deve ter estado explícito.**
7. **Toda expedição deve ter capacidade máxima conhecida.**
8. **A área administrativa deve fornecer visão operacional, não apenas comercial.**
9. **Fluxos incompletos devem ser retomáveis.**
10. **O MVP deve priorizar simplicidade operacional e confiabilidade.**

---

# 4. Fluxo principal do pescador

```text
Instagram / WhatsApp / Google
        ↓
Home
        ↓
Detalhes da Expedição
        ↓
Checkout
        ↓
Pagamento
        ↓
Confirmação
        ↓
Onboarding
        ↓
Bebidas e Preferências
        ↓
Minha Expedição
```

## 4.1. Catálogo de referências visuais

Os mockups abaixo são referências de produto e interface para as telas públicas e para a jornada do pescador. Eles não substituem as regras funcionais, os critérios de aceitação ou os requisitos de acessibilidade descritos neste documento.

| Tela | Referência visual | Arquivo |
|---|---|---|
| 01 — Home / Landing Page | [Abrir mockup](imgs/tela-01-home-landing-page.png) | `tela-01-home-landing-page.png` |
| 02 — Detalhes da Expedição | [Abrir mockup](imgs/tela-02-detalhes-expedicao.png) | `tela-02-detalhes-expedicao.png` |
| 03 — Checkout / Finalizar Reserva | [Abrir mockup](imgs/tela-03-checkout-finalizar-reserva.png) | `tela-03-checkout-finalizar-reserva.png` |
| 04 — Confirmação + Onboarding | [Abrir mockup](imgs/tela-04-confirmacao-onboarding.png) | `tela-04-confirmacao-onboarding.png` |
| 05 — Bebidas e Preferências | [Abrir mockup](imgs/tela-05-bebidas-preferencias.png) | `tela-05-bebidas-preferencias.png` |
| 06 — Minha Expedição | [Abrir mockup](imgs/tela-06-minha-expedicao.png) | `tela-06-minha-expedicao.png` |

> A Tela 07 — Dashboard Administrativo ainda não possui mockup nesta pasta.

---

# 5. Tela 01 — Home / Landing Page

> **Referência visual:** [mockup da Home / Landing Page](imgs/tela-01-home-landing-page.png)

## 5.1. Objetivo

Apresentar a marca, comunicar o principal diferencial da Expedição Piraíba e direcionar o visitante para as próximas expedições.

Mensagem central:

> **Você pesca. A gente organiza o resto.**

A Home deve reduzir a dependência do Instagram como único canal de apresentação do produto.

## 5.2. Conteúdo principal

- identidade visual da Expedição Piraíba;
- navegação principal;
- hero da marca;
- CTA para próximas expedições;
- CTA para WhatsApp;
- próximas expedições;
- datas;
- preços iniciais;
- quantidade de vagas disponíveis;
- diferenciais;
- galeria;
- provas sociais;
- formas de contato.

## 5.3. Histórias de usuário

### US-HOME-001 — Visualizar proposta da empresa

**Como** visitante  
**Quero** entender rapidamente o que a Expedição Piraíba oferece  
**Para** decidir se o serviço faz sentido para mim.

#### Critérios de aceitação

```gherkin
Dado que acesso a página inicial
Quando a página terminar de carregar
Então devo visualizar a proposta principal da empresa
E devo visualizar chamadas para as próximas expedições
E devo conseguir acessar o WhatsApp da empresa
```

### US-HOME-002 — Visualizar próximas expedições

**Como** visitante  
**Quero** visualizar as próximas expedições disponíveis  
**Para** escolher uma viagem que corresponda às minhas datas.

#### Critérios de aceitação

```gherkin
Dado que existem expedições publicadas
Quando acesso a Home
Então devo visualizar as próximas expedições
E cada expedição deve apresentar ao menos:
  - nome
  - destino
  - período
  - preço inicial
  - vagas disponíveis
```

### US-HOME-003 — Acessar detalhes da expedição

**Como** visitante  
**Quero** selecionar uma expedição  
**Para** visualizar informações completas antes de realizar uma reserva.

#### Critérios de aceitação

```gherkin
Dado que estou visualizando uma expedição na Home
Quando seleciono "Ver expedição"
Então devo ser direcionado para a página da expedição correspondente
```

## 5.4. Regras de negócio

- somente expedições com status `PUBLISHED` devem aparecer;
- expedições encerradas não devem aparecer como disponíveis;
- quantidade de vagas exibida deve ser derivada do backend;
- preço apresentado deve utilizar o menor preço comercial ativo da expedição;
- a Home não deve possuir regra própria para cálculo de estoque.

---

# 6. Tela 02 — Detalhes da Expedição

> **Referência visual:** [mockup de Detalhes da Expedição](imgs/tela-02-detalhes-expedicao.png)

## 6.1. Objetivo

Transformar interesse em intenção de compra.

A página deve concentrar as informações que atualmente seriam explicadas manualmente no WhatsApp.

## 6.2. Conteúdo principal

- nome da expedição;
- destino;
- data inicial e final;
- duração;
- quantidade máxima de pescadores;
- vagas disponíveis;
- preço;
- galeria;
- descrição;
- estrutura;
- o que está incluído;
- roteiro;
- espécies encontradas;
- localização aproximada;
- CTA "Reservar minha vaga";
- contato pelo WhatsApp.

## 6.3. Histórias de usuário

### US-EXP-001 — Consultar disponibilidade

**Como** visitante  
**Quero** saber quantas vagas ainda estão disponíveis  
**Para** decidir se preciso realizar a reserva imediatamente.

#### Critérios de aceitação

```gherkin
Dado que acesso uma expedição publicada
Quando seus dados forem carregados
Então devo visualizar a capacidade total
E devo visualizar a quantidade de vagas disponíveis
```

### US-EXP-002 — Consultar itens incluídos

**Como** visitante  
**Quero** visualizar o que está incluído no pacote  
**Para** entender o valor da experiência oferecida.

#### Critérios de aceitação

A interface deve permitir apresentar itens como:

- barco e piloteiro;
- combustível;
- hospedagem;
- refeições;
- gelo;
- carvão;
- bebidas básicas;
- suporte da equipe.

### US-EXP-003 — Iniciar reserva

**Como** visitante  
**Quero** reservar vagas para uma expedição  
**Para** garantir minha participação.

#### Critérios de aceitação

```gherkin
Dado que a expedição possui vagas disponíveis
Quando seleciono "Reservar minha vaga"
Então devo iniciar o fluxo de checkout dessa expedição
```

### US-EXP-004 — Impedir reserva sem disponibilidade

```gherkin
Dado que a expedição não possui vagas disponíveis
Quando acesso sua página
Então o sistema não deve permitir iniciar uma nova reserva
E deve apresentar a expedição como esgotada
```

## 6.4. Regras de negócio

```text
available_slots =
capacity
- confirmed_participants
- active_held_slots
```

- não confiar em quantidade de vagas calculada no frontend;
- expedições `SOLD_OUT`, `CLOSED`, `IN_PROGRESS`, `COMPLETED` ou `CANCELLED` não podem aceitar novas reservas;
- dados históricos da expedição devem permanecer disponíveis mesmo após encerramento, quando configurado pelo administrador.

---

# 7. Tela 03 — Checkout / Finalizar Reserva

> **Referência visual:** [mockup do Checkout / Finalizar Reserva](imgs/tela-03-checkout-finalizar-reserva.png)

## 7.1. Objetivo

Converter a intenção do usuário em reserva financeira.

O checkout deve possuir baixa fricção e não exigir cadastro prévio.

## 7.2. Dados esperados

### Comprador

- nome completo;
- e-mail;
- WhatsApp;
- CPF.

### Reserva

- expedição;
- quantidade de participantes;
- nomes básicos dos participantes;
- modalidade de pagamento;
- método de pagamento.

### Modalidades

- sinal da reserva;
- pagamento integral.

### Métodos iniciais

- PIX;
- cartão de crédito.

## 7.3. Histórias de usuário

### US-CHECKOUT-001 — Selecionar quantidade de participantes

**Como** comprador  
**Quero** informar quantas pessoas participarão  
**Para** reservar a quantidade correta de vagas.

#### Critérios de aceitação

```gherkin
Dado que existem 5 vagas disponíveis
Quando tento reservar 2 participantes
Então a operação deve ser permitida

Dado que existem 2 vagas disponíveis
Quando tento reservar 3 participantes
Então a operação deve ser rejeitada
```

### US-CHECKOUT-002 — Criar reserva temporária

**Como** comprador  
**Quero** que minhas vagas sejam protegidas enquanto realizo o pagamento  
**Para** evitar que sejam vendidas para outra pessoa durante o checkout.

#### Critérios de aceitação

```gherkin
Dado que inicio um checkout válido
Quando a reserva temporária for criada
Então as vagas devem ficar em estado HELD
E devem possuir horário de expiração
```

Sugestão inicial:

```text
hold_duration = 15 minutos
```

### US-CHECKOUT-003 — Escolher pagamento por sinal

**Como** comprador  
**Quero** pagar apenas um sinal inicialmente  
**Para** garantir a reserva sem pagar o valor total naquele momento.

#### Critérios de aceitação

```gherkin
Dado uma reserva de R$ 4.980
E um sinal configurado de R$ 1.200
Quando escolho "Sinal da reserva"
Então devo pagar R$ 1.200
E o sistema deve registrar R$ 3.780 como saldo restante
```

### US-CHECKOUT-004 — Pagar integralmente

**Como** comprador  
**Quero** pagar o valor completo da expedição  
**Para** não possuir saldo futuro.

### US-CHECKOUT-005 — Confirmar pagamento por webhook

**Como** sistema  
**Quero** confirmar pagamentos a partir de eventos confiáveis do provedor  
**Para** evitar confirmações falsas originadas pelo frontend.

#### Critérios de aceitação

```gherkin
Dado que o usuário inicia um pagamento
Quando o gateway confirmar o pagamento via webhook válido
Então o pagamento deve ser registrado como confirmado
E a reserva deve ser atualizada adequadamente
```

O redirecionamento do navegador **não é evidência suficiente** para confirmação financeira.

### US-CHECKOUT-006 — Expirar reserva não paga

```gherkin
Dado que uma reserva está em HELD
E o pagamento não foi confirmado
Quando o período de hold expirar
Então a reserva deve mudar para EXPIRED
E as vagas devem ser liberadas
```

### US-CHECKOUT-007 — Comprar sem cadastro prévio

**Como** comprador de primeira viagem  
**Quero** informar apenas os dados necessários durante o checkout  
**Para** reservar sem passar por um cadastro tradicional.

#### Critérios de aceitação

```gherkin
Dado que não possuo conta na plataforma
Quando informo CPF, nome completo, celular e e-mail no checkout
Então o sistema deve localizar ou criar minha identidade de cliente
E não deve exigir a criação de senha
E não deve me direcionar para uma tela separada de cadastro
```

### US-CHECKOUT-008 — Verificar canal de contato

**Como** comprador  
**Quero** confirmar meu celular ou e-mail com um código temporário  
**Para** proteger minha reserva e receber acesso posteriormente.

#### Critérios de aceitação

```gherkin
Dado que preenchi os dados do comprador
Quando solicito continuar para o pagamento
Então devo receber um código temporário prioritariamente pelo WhatsApp
E devo poder utilizar o e-mail como canal alternativo
E somente após validar um dos canais devo iniciar o pagamento
```

### US-CHECKOUT-009 — Reconhecer cliente recorrente

**Como** cliente recorrente  
**Quero** recuperar meus dados após confirmar minha identidade  
**Para** realizar uma nova reserva com menos preenchimento.

#### Critérios de aceitação

```gherkin
Dado que meu CPF já está cadastrado
Quando informo meu CPF no checkout
Então o sistema pode exibir apenas celular e e-mail mascarados
E não deve revelar dados pessoais completos

Quando valido o código enviado para um canal já verificado
Então o sistema deve preencher meus dados existentes
E deve permitir que eu continue a nova reserva
```

## 7.4. Regras financeiras

```text
total_price = expedition_price_per_person * participant_count

remaining_balance =
total_price - confirmed_payments
```

- valores monetários devem ser representados em centavos ou Decimal;
- nunca utilizar `float` para cálculo financeiro;
- preço final da reserva deve ser armazenado no momento da compra;
- alterações futuras no preço da expedição não devem alterar reservas anteriores.

## 7.5. Identificação progressiva e acesso sem senha

### RN-AUTH-001 — Cadastro progressivo

O checkout deve criar ou vincular a identidade do comprador sem exigir cadastro prévio, senha ou uma página separada de criação de conta.

### RN-AUTH-002 — Dados mínimos do comprador

Antes do pagamento, devem ser coletados:

- CPF;
- nome completo;
- celular/WhatsApp;
- e-mail.

O formulário deve priorizar uma única etapa e o menor número possível de interações.

### RN-AUTH-003 — CPF não é autenticação

O CPF identifica a pessoa e auxilia na prevenção de duplicidades, mas não concede acesso isoladamente.

```text
CPF conhecido + canal verificado = acesso
CPF conhecido sem verificação = nenhum acesso
```

### RN-AUTH-004 — Identidade única

- cada CPF deve representar uma única pessoa no sistema;
- um CPF existente deve reutilizar o cliente, não criar duplicidade;
- nome, celular e e-mail só podem ser atualizados após verificação;
- alterações relevantes de identidade devem ser auditáveis.

### RN-AUTH-005 — Verificação mínima

Ao menos um canal deve ser verificado antes de iniciar o pagamento:

```text
celular verificado OU e-mail verificado
```

O celular/WhatsApp é o canal prioritário e o e-mail é a alternativa. O código deve ser temporário, de uso único e limitado contra tentativas e reenvios abusivos.

### RN-AUTH-006 — Comprador e participantes

Somente o comprador precisa verificar sua identidade no checkout. Para os demais participantes, o checkout exige inicialmente apenas o nome; CPF, dados completos e preferências podem ser coletados no onboarding.

### RN-AUTH-007 — Acesso posterior sem senha

Após a compra, o comprador deve receber um link seguro por canal verificado. Se a sessão ainda for válida, o link pode abrir diretamente a área `Minha Expedição`; caso contrário, o sistema deve solicitar um novo código temporário.

### RN-AUTH-008 — Retomada do checkout

- dados já confirmados devem permitir a retomada do fluxo;
- o hold de vagas continua limitado ao prazo configurado;
- a expiração do hold libera as vagas, sem apagar automaticamente a identidade do cliente;
- nenhum link de retomada pode, sozinho, expor dados de outra pessoa.

### RN-AUTH-009 — Sessão e reautenticação

A sessão do comprador pode permanecer válida no dispositivo por até 30 dias. Alteração de dados pessoais, reembolso e outras operações sensíveis devem exigir verificação recente.

### RN-AUTH-010 — Proteção contra enumeração

Antes da verificação, respostas para CPF existente e inexistente devem evitar revelar a existência de cadastro. Celular e e-mail, quando exibidos para reconhecimento, devem permanecer mascarados.

---

# 8. Tela 04 — Confirmação + Onboarding

> **Referência visual:** [mockup de Confirmação + Onboarding](imgs/tela-04-confirmacao-onboarding.png)

## 8.1. Objetivo

Confirmar a compra e transformar tarefas operacionais posteriores em um fluxo guiado.

A confirmação não é o fim do processo. Ela inicia a preparação da viagem.

## 8.2. Etapas do onboarding

1. pagamento inicial;
2. cadastro dos participantes;
3. bebidas e preferências;
4. restrições alimentares;
5. checklist da viagem.

## 8.3. Histórias de usuário

### US-ONBOARD-001 — Visualizar confirmação

**Como** comprador  
**Quero** receber uma confirmação clara da reserva  
**Para** ter certeza de que minhas vagas foram garantidas.

### US-ONBOARD-002 — Visualizar resumo financeiro

**Como** comprador  
**Quero** visualizar quanto já paguei e quanto ainda devo  
**Para** acompanhar minha obrigação financeira.

### US-ONBOARD-003 — Visualizar progresso de preparação

**Como** comprador  
**Quero** visualizar quais informações ainda preciso fornecer  
**Para** concluir a preparação da viagem.

### US-ONBOARD-004 — Continuar onboarding posteriormente

**Como** comprador  
**Quero** interromper o preenchimento e continuar mais tarde  
**Para** não precisar completar todas as etapas imediatamente.

#### Critério

As etapas concluídas devem ser persistidas individualmente.

### US-ONBOARD-005 — Receber confirmação externa

**Como** comprador  
**Quero** receber a confirmação por e-mail e/ou WhatsApp  
**Para** possuir acesso ao resumo da minha reserva fora da plataforma.

---

# 9. Tela 05 — Bebidas e Preferências

> **Referência visual:** [mockup de Bebidas e Preferências](imgs/tela-05-bebidas-preferencias.png)

## 9.1. Objetivo

Converter informações que hoje ficam dispersas no WhatsApp em dados estruturados capazes de alimentar automaticamente a operação.

Essa é uma das funcionalidades centrais do MVP.

## 9.2. Estrutura funcional

As preferências são registradas por participante.

Exemplo:

```text
Reserva
 ├── João
 │    ├── 24 Heineken
 │    ├── 12 águas
 │    └── 2 sacos de gelo
 │
 └── Pedro
      ├── 12 Heineken
      └── 6 Coca-Cola
```

## 9.3. Histórias de usuário

### US-PREF-001 — Selecionar participante

**Como** responsável pela reserva  
**Quero** configurar as preferências de cada participante separadamente  
**Para** que a equipe saiba o consumo individual esperado.

### US-PREF-002 — Selecionar bebidas

**Como** participante  
**Quero** informar quais bebidas desejo consumir e suas quantidades  
**Para** que elas sejam consideradas nas compras da expedição.

#### Critérios de aceitação

```gherkin
Dado que Heineken está disponível para a expedição
Quando seleciono quantidade 24
Então o sistema deve registrar:
participant_id
product_id
quantity = 24
```

### US-PREF-003 — Alterar quantidade

**Como** participante  
**Quero** aumentar ou reduzir a quantidade de um produto  
**Para** ajustar minha solicitação.

Regra mínima:

```text
quantity >= 0
```

### US-PREF-004 — Informar restrição alimentar

**Como** participante  
**Quero** informar restrições ou alergias alimentares  
**Para** permitir que a equipe prepare refeições adequadas.

Opções iniciais:

- sem restrições;
- vegetariano;
- intolerância à lactose;
- alergia a frutos do mar;
- outros.

### US-PREF-005 — Informar observações

**Como** participante  
**Quero** fornecer observações adicionais  
**Para** registrar necessidades que não estejam contempladas pelas opções estruturadas.

O campo livre deve complementar os dados estruturados, não substituí-los.

### US-PREF-006 — Solicitar gelo adicional

**Como** participante  
**Quero** informar necessidade de gelo adicional  
**Para** que a operação considere essa demanda.

### US-PREF-007 — Persistir preferências por participante

```gherkin
Dado que existem dois participantes na reserva
Quando salvo as preferências do participante 1
Então essas preferências não devem ser atribuídas ao participante 2
```

---

# 10. Tela 06 — Minha Expedição

> **Referência visual:** [mockup de Minha Expedição](imgs/tela-06-minha-expedicao.png)

## 10.1. Objetivo

Centralizar tudo que o cliente precisa acompanhar depois da compra.

Essa página é o principal hub do cliente.

## 10.2. Informações principais

- dias restantes;
- participantes;
- status da reserva;
- valor restante;
- resumo da viagem;
- progresso do onboarding;
- resumo financeiro;
- checklist;
- avisos;
- vencimentos;
- ponto de encontro;
- CTA para pagamento;
- CTA para WhatsApp.

## 10.3. Histórias de usuário

### US-MYTRIP-001 — Consultar status da reserva

**Como** comprador  
**Quero** visualizar o status atual da minha reserva  
**Para** saber se minha participação está garantida.

### US-MYTRIP-002 — Consultar saldo restante

**Como** comprador  
**Quero** visualizar o saldo restante e sua data de vencimento  
**Para** realizar o pagamento no prazo correto.

### US-MYTRIP-003 — Pagar saldo

**Como** comprador  
**Quero** pagar o saldo pendente  
**Para** quitar minha expedição.

### US-MYTRIP-004 — Consultar ponto de encontro

**Como** participante  
**Quero** visualizar o ponto e horário de encontro  
**Para** conseguir chegar corretamente no início da viagem.

### US-MYTRIP-005 — Consultar checklist

**Como** participante  
**Quero** visualizar o que preciso levar  
**Para** me preparar adequadamente.

Exemplos:

- documento pessoal;
- protetor solar;
- repelente;
- roupa UV;
- boné;
- óculos;
- equipamentos;
- medicamentos pessoais.

### US-MYTRIP-006 — Visualizar avisos

**Como** participante  
**Quero** visualizar orientações e pendências importantes  
**Para** evitar problemas antes da viagem.

## 10.4. Regras de negócio

O acesso à área "Minha Expedição" só deve ser permitido a usuários autorizados naquela reserva.

Uma URL ou ID de reserva não deve ser suficiente para conceder acesso.

---

# 11. Tela 07 — Dashboard Administrativo

## 11.1. Objetivo

Substituir grande parte do controle operacional feito atualmente em planilhas e conversas.

O dashboard deve responder rapidamente:

- qual é a próxima expedição?
- quantas vagas foram vendidas?
- quanto foi vendido?
- quanto foi recebido?
- quanto falta receber?
- quem está pendente?
- quem ainda não completou seus dados?
- quais bebidas já foram solicitadas?

## 11.2. Histórias de usuário

### US-ADMIN-001 — Visualizar resumo da próxima expedição

**Como** organizador  
**Quero** visualizar os principais indicadores da próxima expedição  
**Para** entender rapidamente a situação operacional.

Indicadores iniciais:

- vagas vendidas;
- capacidade;
- valor vendido;
- valor recebido;
- saldo pendente.

### US-ADMIN-002 — Listar reservas

**Como** organizador  
**Quero** visualizar todas as reservas de uma expedição  
**Para** acompanhar clientes e participantes.

Informações mínimas:

- cliente;
- quantidade de participantes;
- estado do pagamento;
- estado do cadastro;
- estado da reserva.

### US-ADMIN-003 — Identificar pagamentos pendentes

**Como** organizador  
**Quero** visualizar clientes com saldo pendente  
**Para** realizar cobranças antes da expedição.

### US-ADMIN-004 — Identificar cadastros incompletos

**Como** organizador  
**Quero** identificar participantes com dados incompletos  
**Para** solicitar o preenchimento antes da viagem.

### US-ADMIN-005 — Visualizar bebidas solicitadas

**Como** organizador  
**Quero** visualizar o total consolidado de bebidas solicitadas  
**Para** planejar as compras da expedição.

Exemplo:

```text
Heineken: 168 un
Água: 180 un
Coca-Cola: 48 un
```

O valor deve ser calculado a partir dos registros individuais dos participantes.

### US-ADMIN-006 — Consultar vencimentos

**Como** organizador  
**Quero** visualizar os próximos vencimentos financeiros  
**Para** antecipar cobranças.

### US-ADMIN-007 — Visualizar alertas operacionais

**Como** organizador  
**Quero** receber alertas sobre pendências importantes  
**Para** não depender de verificações manuais.

Exemplos:

- saldo pendente;
- cadastro incompleto;
- checklist ainda não enviado;
- preferências não preenchidas.

---

# 12. Tela futura — Lista Automática de Compras

> Recomendada para o MVP operacional, mesmo ainda não estando representada nos mockups atuais.

## 12.1. Objetivo

Transformar as preferências individuais em uma lista de compras pronta para execução.

## 12.2. História principal

### US-PURCHASE-001 — Consolidar demanda

**Como** organizador  
**Quero** consolidar automaticamente todos os itens solicitados pelos participantes  
**Para** comprar a quantidade correta sem somar pedidos manualmente.

### Exemplo

Entradas:

```text
João → 24 Heineken
Pedro → 24 Heineken
Carlos → 12 Heineken
```

Saída:

```text
Heineken → 60 unidades
```

### US-PURCHASE-002 — Converter unidades em embalagens

**Como** organizador  
**Quero** converter unidades em caixas ou pacotes  
**Para** comprar produtos no formato comercial utilizado pelos fornecedores.

Exemplo:

```text
168 unidades
package_size = 24

168 / 24 = 7 caixas
```

O sistema deve preservar também a quantidade total em unidades.

### US-PURCHASE-003 — Exportar lista

**Como** organizador  
**Quero** exportar a lista consolidada  
**Para** utilizá-la durante as compras ou enviá-la para fornecedores.

Formatos desejáveis:

- PDF;
- XLSX;
- CSV;
- texto compartilhável por WhatsApp.

---

# 13. Estados do domínio

## 13.1. ExpeditionStatus

```text
DRAFT
PUBLISHED
SOLD_OUT
CLOSED
IN_PROGRESS
COMPLETED
CANCELLED
```

### Transições principais

```text
DRAFT → PUBLISHED
PUBLISHED → SOLD_OUT
PUBLISHED → CLOSED
PUBLISHED → CANCELLED
SOLD_OUT → IN_PROGRESS
CLOSED → IN_PROGRESS
IN_PROGRESS → COMPLETED
```

Transições devem ser validadas no domínio.

## 13.2. ReservationStatus

Sugestão:

```text
HELD
AWAITING_PAYMENT
PARTIALLY_PAID
CONFIRMED
PAID
EXPIRED
CANCELLED
REFUNDED
```

Observação importante:

Estado financeiro e estado operacional podem ser separados em versões posteriores caso a complexidade aumente.

## 13.3. PaymentStatus

```text
PENDING
PROCESSING
PAID
FAILED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 14. Modelo de domínio inicial

```text
User
Customer
Expedition
ExpeditionMedia
Reservation
ReservationParticipant
Payment
PaymentTransaction
Product
ExpeditionProduct
ParticipantProductPreference
DietaryRestriction
ParticipantDietaryRestriction
Checklist
ChecklistItem
ParticipantChecklistItem
Notification
```

## 14.1. Relações principais

```text
Expedition
 ├── ExpeditionMedia
 ├── ExpeditionProduct
 ├── Reservation
 │    ├── Payment
 │    └── ReservationParticipant
 │          ├── ParticipantProductPreference
 │          ├── ParticipantDietaryRestriction
 │          └── ParticipantChecklistItem
 └── Checklist
```

---

# 15. Regras críticas de negócio

## RB-001 — Capacidade

Uma reserva jamais pode ultrapassar a capacidade restante da expedição.

## RB-002 — Concorrência de vagas

A confirmação de vagas deve ser atômica.

Duas requisições concorrentes não podem vender a mesma última vaga.

Preferências técnicas possíveis:

- transação de banco;
- lock pessimista;
- update condicional;
- constraint + retry.

## RB-003 — Reserva temporária

Vagas em checkout devem possuir expiração automática.

```text
HELD → EXPIRED
```

## RB-004 — Idempotência de webhook

Eventos do gateway podem ser entregues múltiplas vezes.

O processamento deve ser idempotente.

Uma transação financeira não pode ser duplicada porque o mesmo webhook foi recebido novamente.

## RB-005 — Snapshot de preço

A reserva deve guardar:

- preço unitário;
- quantidade;
- total;
- valor do sinal;
- condições comerciais.

Esses dados não podem depender do preço atual da expedição depois da compra.

## RB-006 — Consolidação de produtos

```text
total_product_quantity(expedition, product) =
SUM(participant_product_preferences.quantity)
```

Considerar apenas reservas em estados comercialmente válidos.

## RB-007 — Segurança

Um cliente só pode acessar:

- suas reservas;
- seus participantes;
- seus pagamentos;
- suas preferências.

Administrador possui acesso ao tenant/operação autorizado.

## RB-008 — Auditoria financeira

Mudanças financeiras relevantes devem possuir rastreabilidade.

No mínimo:

- gateway transaction ID;
- external event ID;
- valor;
- status anterior;
- novo status;
- timestamp.

---

# 16. Requisitos não funcionais mínimos

## Segurança

- HTTPS obrigatório;
- senhas com hash seguro;
- tokens com expiração;
- validação de autorização no backend;
- dados do gateway nunca devem ser confiados diretamente ao frontend;
- secrets somente por variáveis seguras;
- proteção contra enumeração previsível de reservas.

## Disponibilidade

Para o MVP não é necessária arquitetura altamente distribuída, porém:

- aplicação deve tolerar retries de webhooks;
- operações financeiras devem ser idempotentes;
- jobs de expiração devem poder ser reexecutados.

## Observabilidade

Registrar:

- criação de reserva;
- alteração de estado;
- criação de pagamento;
- webhook recebido;
- webhook rejeitado;
- expiração de hold;
- falhas na consolidação;
- erros de integração.

## Performance

Objetivos iniciais recomendados:

```text
GET endpoints comuns: p95 < 500 ms
operações internas sem integração externa: p95 < 800 ms
```

Não utilizar esses números como SLA contratual inicial.

---

# 17. Escopo recomendado do MVP

## P0 — Essencial para lançamento

- Home;
- listagem de expedições;
- detalhes da expedição;
- controle de vagas;
- checkout sem cadastro prévio;
- reserva temporária;
- PIX;
- webhook de pagamento;
- confirmação de reserva;
- participantes;
- bebidas;
- preferências alimentares;
- Minha Expedição;
- dashboard administrativo;
- reservas;
- saldos;
- consolidação de bebidas.

## P1 — Muito importante

- cartão de crédito;
- pagamento de saldo;
- notificações por WhatsApp;
- e-mail transacional;
- checklist;
- exportação da lista de compras;
- alertas administrativos.

## P2 — Pós-MVP

- fornecedores;
- cupons;
- programa de indicação;
- CRM;
- remarketing;
- múltiplos operadores;
- relatórios financeiros avançados;
- conciliação;
- aplicações mobile;
- multi-tenant SaaS completo.

---

# 18. Fora do escopo inicial

Para evitar overengineering:

- marketplace de operadores;
- aplicativo nativo;
- sistema contábil;
- ERP completo;
- gestão de estoque físico;
- integração direta com distribuidores;
- inteligência artificial;
- recomendação automática de consumo;
- precificação dinâmica;
- programa de fidelidade.

---

# 19. Eventos de domínio úteis

Mesmo que o MVP não utilize event-driven architecture completa, vale definir semanticamente os eventos:

```text
ExpeditionPublished
ReservationHeld
ReservationExpired
PaymentCreated
PaymentConfirmed
ReservationConfirmed
ParticipantAdded
PreferencesUpdated
BalancePaid
ExpeditionSoldOut
```

Eles podem inicialmente disparar serviços internamente e futuramente alimentar filas.

---

# 20. Cenário end-to-end principal

```gherkin
Dado que a Expedição Rio Araguaia possui 5 vagas disponíveis
Quando João acessa a página
E seleciona 2 participantes
E informa seus dados
E escolhe pagamento por sinal
Então o sistema cria um hold de 2 vagas

Quando João realiza o PIX
E o provedor confirma o pagamento por webhook
Então o sistema registra o pagamento
E confirma a reserva
E associa 2 participantes à reserva
E reduz a disponibilidade efetiva da expedição
E disponibiliza o onboarding

Quando João informa as preferências de bebidas dos participantes
Então essas preferências ficam associadas individualmente

Quando o administrador acessa o dashboard
Então deve visualizar:
  - as 2 vagas vendidas
  - o valor recebido
  - o saldo restante
  - os participantes
  - as quantidades consolidadas de bebidas
```

---

# 21. Definition of Done funcional do MVP

Uma feature só deve ser considerada concluída quando:

- comportamento esperado estiver documentado;
- regras de negócio estiverem implementadas no backend;
- validações do frontend não forem a única proteção;
- estados inválidos forem rejeitados;
- testes cobrirem caminho feliz e principais erros;
- logs relevantes existirem;
- permissões tiverem sido testadas;
- valores financeiros forem determinísticos;
- operações críticas forem idempotentes quando necessário;
- documentação da API estiver atualizada.

---

# 22. Sugestão de estrutura para SDD

Uma organização útil para o repositório:

```text
/specs
  /00-product
    vision.md
    glossary.md
    personas.md

  /01-domain
    expedition.md
    reservation.md
    payment.md
    participant.md
    preferences.md

  /02-features
    home.md
    expedition-details.md
    checkout.md
    onboarding.md
    preferences.md
    my-expedition.md
    admin-dashboard.md
    purchase-list.md

  /03-api
    public-api.md
    customer-api.md
    admin-api.md
    webhooks.md

  /04-architecture
    architecture.md
    data-model.md
    state-machines.md
    security.md

  /05-tests
    acceptance-scenarios.md
```

A recomendação é que implementação, testes e contratos de API sejam derivados dessas especificações e atualizados junto com qualquer alteração de regra.

---

# 23. Glossário

**Expedição**  
Viagem de pesca comercializada pela plataforma.

**Reserva**  
Intenção comercial de participação em uma expedição vinculada a um comprador.

**Participante**  
Pessoa que efetivamente participará da viagem.

**Comprador**  
Pessoa responsável por criar e pagar a reserva.

**Hold**  
Bloqueio temporário de vagas durante o processo de checkout.

**Sinal**  
Valor inicial pago para garantir a reserva.

**Saldo**  
Valor restante depois dos pagamentos confirmados.

**Preferência**  
Solicitação operacional individual de um participante.

**Produto**  
Item estruturado disponibilizado para seleção, como bebida ou gelo.

**Lista de compras**  
Consolidação das necessidades de todos os participantes de uma expedição.

---

# 24. Decisões de arquitetura que a especificação já implica

A especificação sugere algumas decisões importantes, independentemente da stack escolhida:

1. O backend é a fonte de verdade.
2. Reserva e estoque de vagas precisam de consistência transacional.
3. Webhooks precisam de idempotência.
4. Pagamentos e reservas são entidades distintas.
5. Preferências pertencem a participantes, não diretamente ao comprador.
6. Valores financeiros precisam ser persistidos como snapshot.
7. Estados de domínio devem ser explícitos.
8. Jobs assíncronos são úteis para:
   - expiração de holds;
   - lembretes;
   - notificações;
   - reconciliação.
9. A consolidação operacional deve ser derivada dos dados transacionais, não mantida manualmente.
10. O desenho deve permitir futuramente transformar a solução em SaaS multi-tenant sem exigir isso no primeiro MVP.

---

# 25. Resultado esperado do MVP

Ao final do MVP, o fluxo operacional desejado é:

```text
ANTES

Instagram
   ↓
WhatsApp
   ↓
Conversa manual
   ↓
PIX manual
   ↓
Planilha
   ↓
Mensagens de bebidas
   ↓
Contagem manual
   ↓
Compras


DEPOIS

Instagram
   ↓
Site
   ↓
Expedição
   ↓
Reserva
   ↓
Pagamento
   ↓
Onboarding
   ↓
Preferências estruturadas
   ↓
Dashboard
   ↓
Lista consolidada
   ↓
Compras
```

A métrica principal de sucesso do produto não deve ser apenas quantidade de acessos ao site.

O MVP deve reduzir trabalho manual e aumentar a previsibilidade da operação.

Indicadores recomendados:

- % de reservas realizadas sem intervenção manual;
- % de pagamentos identificados automaticamente;
- % de participantes com onboarding completo;
- tempo gasto para consolidar lista de compras;
- número de interações manuais necessárias por reserva;
- taxa de conversão visita → reserva;
- valor total vendido por expedição.
