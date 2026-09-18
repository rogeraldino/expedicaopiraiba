# Expedição Piraíba — Adaptador do Processo de Desenvolvimento

Este arquivo aplica operacionalmente a [Constituição de Desenvolvimento](docs/sdd/CONSTITUTION.md). Ele não define regras de produto, domínio ou arquitetura.

O fluxo diário está no [Playbook](docs/sdd/PLAYBOOK.md). Em caso de conflito, a Constituição prevalece.

## Contexto autoritativo

Leia somente o necessário, nesta ordem:

1. `docs/sdd/CONSTITUTION.md`;
2. especificação ativa em `specs/active/`;
3. owners referenciados em `docs/sdd/NORMATIVE_INDEX.json`;
4. documentação funcional e arquitetura relevante;
5. código e testes afetados;
6. `HANDOFF.md` como estado operacional;
7. material histórico apenas como evidência.

`HANDOFF.md`, código e testes não criam comportamento normativo por conta própria.

## Fluxo de mudança

- **LOW:** registrar mudança, comportamento preservado e validação.
- **MEDIUM:** criar especificação ativa com escopo, não objetivos, comportamento, critérios e evidências.
- **HIGH:** cumprir MEDIUM, executar Grill, obter READY humano, implementar, validar, executar Ponytail independente e obter ACCEPTED humano.

Use os gatilhos concretos da Constituição §5. Para MEDIUM/HIGH, mantenha matriz mínima de conformidade.

## Autoridade dos agentes

Agentes podem escolher estrutura técnica depois de READY, desde que preservem a semântica especificada. Não podem inventar comportamento de produto, transições, autorização, privacidade ou escopo. Lacunas são registradas como `SPEC GAP` sem bloquear trabalho independente.

Use agentes independentes para Grill/Counsel antes de HIGH READY e Ponytail depois da implementação. O agente que implementa ou corrige findings não pode ser o único a encerrar a revisão adversarial.

Trabalho futuro fica em `specs/backlog/`; trabalho selecionado em `specs/active/`; dossiês ACCEPTED em `specs/archive/`. Não apague evidências nem reescreva resultados históricos.

## Salvaguardas

Preserve autorização por objeto, controle transacional de vagas, idempotência de pagamentos/webhooks, histórico auditável e limites entre simuladores e provedores. Execute testes relevantes, lint, TypeScript, migrações e `make check-docs`. Atualize o `HANDOFF.md` ao final de mudanças significativas.

