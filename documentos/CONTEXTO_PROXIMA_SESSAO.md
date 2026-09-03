# Contexto para a próxima sessão — Expedição Piraíba

> Atualizado em 26/08/2026 após a conclusão da Fase 2 do SDD Parte 2.

## 1. Objetivo do projeto

Construir o MVP operacional da Expedição Piraíba, substituindo controles dispersos em WhatsApp e planilhas por um fluxo estruturado de:

```text
Site → Expedição → Checkout → Pagamento → Onboarding
→ Preferências → Minha Expedição → Dashboard → Lista de compras
```

Provedores reais de pagamento, WhatsApp e e-mail serão escolhidos e integrados somente depois das regras de negócio e features principais.

## 2. Documentos que devem ser lidos primeiro

1. `documentos/sdd/base_conhecimento_mvp_expedicao_piraiba.md`
2. `documentos/sdd/SDD_parte_2.md`
3. Este documento.
4. Mockup da próxima tela: `documentos/sdd/imgs/tela-05-bebidas-preferencias.png`.

Os mockups em `documentos/sdd/imgs` são a referência visual oficial.

## 3. Stack definida

- Frontend: Next.js 16.3.3, React 19, TypeScript e Tailwind CSS.
- Backend: Python, Django 6.0.8 e Django REST Framework.
- Banco: PostgreSQL 17.
- Ícones: `lucide-react`.
- Ambiente local: Docker Compose.
- Hospedagem futura: VM Hostinger.
- Domínio futuro: `www.expedicaopiraiba.com.br`.

Antes de editar o frontend, ler `frontend/AGENTS.md` e os documentos relevantes em `frontend/node_modules/next/dist/docs`.

## 4. Ambiente local

Serviços previstos no `compose.yaml`:

- `db`: PostgreSQL.
- `backend`: Django em `http://localhost:8000`.
- `frontend`: Next.js em `http://localhost:3000`.
- `jobs`: executa a expiração de holds a cada 60 segundos.

Comandos principais:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 jobs
```

Health check:

```text
http://localhost:8000/api/health/
```

## 5. Credenciais locais

Painel:

```text
URL: http://localhost:3000/admin
E-mail: admin@expedicaopiraiba.com.br
Senha: admin-local-2026
```

Essas credenciais são apenas para desenvolvimento. Antes da produção, substituir por usuários administrativos reais e senhas com hash seguro.

## 6. Funcionalidades concluídas

### Site público

- Home baseada no mockup.
- Cards de próximas expedições.
- Galeria com fotos reais.
- Detalhes da Expedição Rio Araguaia.
- Checkout responsivo.

### Identificação e checkout

- Cadastro progressivo sem senha.
- CPF, nome, e-mail e celular.
- Verificação OTP simulada.
- Proteção contra CPF inválido.
- Participantes básicos.
- Reserva temporária por 15 minutos.
- Controle transacional de capacidade.
- Snapshot financeiro.
- Modalidade sinal ou integral.

### Pagamentos

- Gateway falso desacoplado do domínio.
- PIX copia e cola simulado.
- Webhook falso autenticado e idempotente.
- Confirmação do sinal ou pagamento integral.
- Múltiplas entidades de pagamento suportadas pelo modelo.
- Valor pago e saldo restante derivados dos pagamentos confirmados.

### Reservas e operação

- Estados explícitos.
- Serviços de transição controlada.
- Transições inválidas rejeitadas.
- Vencimento do saldo configurável por expedição; padrão de 30 dias antes.
- Histórico auditável da reserva.
- Eventos de hold, cobrança, confirmação, participante e expiração.
- Job idempotente de expiração automática.

### Tela 04 — Confirmação e onboarding

- Rota dinâmica:

```text
/expedicoes/[slug]/confirmacao/[reservationId]
```

- Acesso por sessão local assinada do cliente, válida por até 30 dias.
- UUID isolado não concede acesso.
- Resumo da reserva e da expedição.
- Valor total, pago, saldo e vencimento.
- Progresso das cinco etapas calculado pelo backend.
- Cadastro complementar por participante.
- Celular e contato de emergência obrigatórios para concluir o cadastro.
- CPF e data de nascimento opcionais.
- Retomada dos dados persistidos.
- Etapas futuras exibidas como indisponíveis.

### Painel administrativo

- Login administrativo local.
- Valor vendido, recebido e saldo pendente.
- Reservas confirmadas e cadastros pendentes.
- Próximas expedições e ocupação.
- Busca de reservas por nome, CPF, telefone ou e-mail.
- Participantes e estado do cadastro.
- Pagamentos e saldo.
- Histórico da reserva.
- Cadastro de expedições.
- Transições controladas de status.
- Botão vermelho `Limpar dados` no header público.

O botão de limpeza:

- funciona somente com `DEBUG=true`;
- exige confirmação;
- apaga clientes, verificações, reservas, participantes, pagamentos e transações;
- preserva expedições e conteúdo institucional.

## 7. Principais rotas da API

### Públicas e checkout

```text
GET  /api/health/
GET  /api/expeditions/
GET  /api/expeditions/{slug}/
POST /api/checkout/identify/
POST /api/checkout/verify/
POST /api/checkout/hold/
POST /api/payments/
POST /api/payments/{payment_id}/simulate-confirmation/
POST /api/payments/webhooks/fake/
```

### Área do cliente

```text
GET   /api/me/reservations/{reservation_id}/
PATCH /api/me/reservations/{reservation_id}/participants/{participant_id}/
```

Usar header:

```text
Authorization: Bearer {customer_session_token}
```

### Operação administrativa

```text
POST  /api/operations/login/
GET   /api/operations/overview/
GET   /api/operations/reservations/
GET   /api/operations/expeditions/
POST  /api/operations/expeditions/
PATCH /api/operations/expeditions/{id}/
POST  /api/operations/dev/clear-data/
```

## 8. Modelos atuais

- `Customer`
- `VerificationChallenge`
- `Expedition`
- `Reservation`
- `ReservationParticipant`
- `ReservationEvent`
- `Payment`
- `PaymentTransaction`

Migrações mais recentes:

```text
expeditions/0002_expedition_balance_due_days_before.py
reservations/0003_reservation_balance_due_at_reservation_payment_plan_and_more.py
reservations/0004_reservationparticipant_birth_date_and_more.py
```

## 9. Estado da validação

Na última rodada:

- 18 testes de backend passaram.
- `makemigrations --check` não encontrou alterações pendentes.
- ESLint passou.
- TypeScript passou.
- Build de produção do Next.js passou no Docker.
- Migração `reservations.0004` foi aplicada no PostgreSQL local.
- Health check retornou sucesso.

Comandos de validação:

```bash
cd backend
TEST_SQLITE=true .venv/bin/python manage.py test
TEST_SQLITE=true .venv/bin/python manage.py makemigrations --check

cd ../frontend
npm run lint
npx tsc --noEmit
```

## 10. Estado do Git

O repositório ainda não possui commit inicial. Todos os arquivos aparecem como não rastreados no `git status`.

Não apagar ou recriar o projeto por causa disso. O estado atual está integralmente no workspace e deve ser preservado.

Antes de criar o primeiro commit, revisar `.gitignore`, arquivos de ambiente e possíveis segredos.

## 11. Próxima fase aprovada

Implementar a **Fase 3 — Bebidas, alimentação e preferências**, baseada no mockup:

```text
documentos/sdd/imgs/tela-05-bebidas-preferencias.png
```

### Ordem recomendada

1. Inspecionar o mockup visual completo.
2. Criar app/domínio de preferências.
3. Criar `Product`.
4. Criar `ExpeditionProduct`.
5. Criar `ParticipantProductPreference`.
6. Criar `DietaryRestriction`.
7. Criar `ParticipantDietaryRestriction`.
8. Criar seed do catálogo local.
9. Criar APIs autorizadas por reserva e participante.
10. Construir a Tela 05.
11. Ativar etapas 3 e 4 no progresso do onboarding.
12. Exibir preferências e restrições no painel administrativo.
13. Criar consolidação inicial por expedição.
14. Adicionar testes de isolamento entre participantes e autorização.
15. Atualizar o SDD Parte 2 e reconstruir o Docker.

## 12. Regras essenciais da próxima fase

- Preferências pertencem ao participante, não ao comprador.
- Participantes da mesma reserva não compartilham quantidades.
- Apenas produtos habilitados para a expedição podem ser selecionados.
- Quantidades devem ser inteiras e não negativas.
- Limite por participante, quando configurado, deve ser validado no backend.
- Alimentação no MVP significa restrições, alergias e observações.
- Não existe ainda seleção de cardápio ou pratos.
- Restrições devem aparecer destacadas no painel.
- Consolidação deve considerar somente reservas comercialmente válidas.
- Nenhuma regra crítica pode existir apenas no frontend.

## 13. Pontos de atenção

- O frontend ainda possui vários dados visuais da Rio Araguaia fixos; a migração para mídia e conteúdo totalmente dinâmicos está prevista em fase posterior.
- O OTP aparece na interface quando `DEBUG=true`; isso é intencional para testes locais.
- Pagamento, e-mail e WhatsApp continuam simulados por decisão do projeto.
- A sessão do cliente é armazenada em `sessionStorage` no frontend e assinada pelo backend.
- Clientes que concluíram fluxos antes da criação da sessão de 30 dias devem refazer um checkout de teste.
- O botão `Limpar dados` deve permanecer indisponível em produção.
- O worker atual com loop de 60 segundos é adequado ao ambiente local; a produção deverá usar um agendador apropriado.

## 14. Critério para encerrar a próxima sessão

A Fase 3 estará concluída quando:

- produtos puderem ser configurados por expedição;
- cada participante puder salvar quantidades próprias;
- restrições alimentares puderem ser salvas separadamente;
- a Tela 05 seguir o mockup e funcionar de ponta a ponta;
- o progresso do onboarding refletir os dados persistidos;
- o administrador visualizar totais e pendências;
- autorização e regras estiverem cobertas por testes;
- lint, TypeScript, testes e build passarem;
- o ambiente Docker estiver atualizado e rodando.
