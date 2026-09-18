# Playbook de Desenvolvimento — Expedição Piraíba

Versão 0.1 — 18/09/2026. A [Constituição](CONSTITUTION.md) prevalece em conflitos.

## Fluxos por risco

**LOW:** tarefa → implementação → checks → registro.

**MEDIUM:** spec curta → critérios → READY → implementação → testes → conformidade → aceite.

**HIGH:** grounding no código → spec → Grill independente → Counsel independente → decisões humanas → READY humano → implementação → validação → Ponytail independente → gate real quando aplicável → ACCEPTED humano → arquivo/retrospectiva.

## Papéis dos agentes

- **Implementador:** altera código e produz evidência; não se autoavalia como Ponytail em HIGH.
- **Grill:** ataca a completude da spec antes de READY.
- **Counsel:** confronta alternativas usando owners existentes; não inventa política.
- **Ponytail:** tenta provar desconformidade depois da implementação e registra findings com severidade e disposição.

Agentes trabalham com escopo explícito e não editam o mesmo conjunto de arquivos em paralelo. O agente principal integra resultados e mantém a autoridade documental.

## Escalonamento

| Classe | Tratamento |
|---|---|
| AUTONOMOUS | Estrutura técnica dentro do contrato aprovado |
| COUNSELLED | Interpretação independente a partir dos owners |
| HUMAN AUTHORITY | Novo comportamento de produto, autoridade, estado, trade-off real e gates HIGH |
| INSUFFICIENT EVIDENCE | Coletar evidência; não converter desconhecido em PASS |

Não solicitar novamente uma autoridade já concedida para o mesmo escopo. Feedback ou teste não substitui decisão normativa.

## Checkpoints de validação

Agrupar implementação antes de testar. Executar um checkpoint definitivo; se houver correções, executar um segundo checkpoint final cobrindo regressões afetadas. Para este projeto, considerar conforme o escopo:

```bash
cd backend && TEST_SQLITE=true .venv/bin/python manage.py test
cd backend && TEST_SQLITE=true .venv/bin/python manage.py makemigrations --check
cd frontend && npm run lint && npx tsc --noEmit && npm run build
make check-docs
git diff --check
```

Concorrência baseada em locks MUST ser verificada em PostgreSQL; SQLite não é evidência suficiente.

## Fechamento do repositório

1. Confirmar aceite e escopo exatos.
2. Mover somente dossiês ACCEPTED para `specs/archive/`.
3. Preservar trabalho excluído em backlog com links.
4. Atualizar índice, documentação, runbooks e handoff.
5. Preservar findings históricos; nunca transformar FAIL antigo em PASS por edição.
6. Registrar SHA, validações e pendências reais.

