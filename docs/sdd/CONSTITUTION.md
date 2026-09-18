# Constituição de Desenvolvimento — Expedição Piraíba

**Versão:** 0.2-pilot  
**Status:** PILOT  
**Origem:** adaptada do processo ALVOR/Aurora por solicitação do responsável pelo produto em 18/09/2026.

## 1. Escopo e autoridade

Esta Constituição governa como o produto é alterado. Conhecimento durável pertence ao repositório, não a uma conversa ou agente.

Ordem de autoridade:

```text
Constituição → Produto/MVP → Regras de domínio → Arquitetura
→ Especificação da feature → Implementação → Evidência → Handoff
```

Uma camada inferior MUST NOT redefinir silenciosamente uma superior. Cada conceito normativo MUST possuir um único owner atual no Índice Normativo. Material histórico e `HANDOFF.md` são evidência, não autoridade de produto.

## 2. Linguagem normativa

- **MUST:** obrigatório.
- **MUST NOT:** proibido.
- **SHOULD:** esperado, salvo justificativa registrada.
- **MAY:** opcional.

Termos que permitam duas implementações semanticamente diferentes MUST ser definidos antes de READY.

## 3. Risco

- **LOW:** não altera semântica observável ou contrato relevante. Exige registro da mudança e validação proporcional.
- **MEDIUM:** altera comportamento dentro de limites estabelecidos. Exige spec, escopo, critérios, evidência e conformidade.
- **HIGH:** afeta fronteira de produto, estado do domínio, autenticação/autorização, privacidade, concorrência, idempotência, eventos duráveis, segurança, destruição ou ação externa.

HIGH exige spec, Grill, READY humano, implementação, validação, Ponytail independente e ACCEPTED humano.

## 4. Especificação e semântica

MEDIUM/HIGH MUST ser especificada antes da implementação semântica. A spec define problema, resultado, escopo, não objetivos, owners, estados, falhas, duplicidade/retry, migração e prova de aceite.

Ação de interface que muda estado MUST mapear ação → comando → efeito de domínio → reversibilidade → auditoria. Algoritmos que criam, alteram, rejeitam, consolidam ou determinam elegibilidade são normativos.

## 5. Grill e READY

Grill é revisão adversarial pré-implementação. Procura termos indefinidos, decisões escondidas, estados ausentes, casos temporais, duplicidade, falhas, conflitos de autorização e divergência entre implementadores.

READY significa que nenhuma questão aberta pode alterar comportamento, escopo, estado, autoridade ou segurança. HIGH só recebe READY com Grill registrado e declaração explícita do responsável humano, contendo data e versão.

## 6. Autoridade de implementação

Depois de READY, o agente decide estrutura interna, queries, helpers, migrations e fixtures que preservem a spec. Nova lacuna semântica é `SPEC GAP`; trabalho não afetado pode continuar.

## 7. Ciclo de vida

```text
DRAFT → READY → IN_PROGRESS → VALIDATED → ACCEPTED → ARCHIVED
```

`IMPLEMENTED ≠ VALIDATED` e `VALIDATED ≠ ACCEPTED`.

## 8. Evidência e Ponytail

Testes passando, isoladamente, não provam aceite. Evidência distingue testes unitários, integração, contrato, concorrência, interface e ambiente real.

Ponytail é revisão adversarial pós-implementação que tenta falsificar conformidade entre spec, código, testes e evidências. Em HIGH, o revisor MUST ser independente da implementação. Mudanças após a revisão exigem delta review.

Dependências de provedor, PostgreSQL nativo ou runtime de VM exigem verificação no ambiente real e Ponytail desse gate; mocks não provam provedor real.

## 9. Matriz e aceite

MEDIUM/HIGH MUST manter matriz mínima requisito → implementação → teste/evidência. Critério obrigatório `MISSING`, `FAIL`, `TODO` ou `DOCUMENTED ONLY` bloqueia ACCEPTED.

HIGH só recebe ACCEPTED por autoridade humana após Ponytail PASS, registrando data, versão, SHA e evidências. Revisão final ocorre sobre SHA imutável.

## 10. Supersessão e migração

Mudança normativa declara owner anterior, novo owner, escopo, precedência, retroatividade e tratamento dos dados existentes. Documentos históricos permanecem disponíveis sem autoridade sobre o trecho supersedido.

## 11. Segurança assíncrona e incidentes

Mudanças assíncronas descrevem trigger, estado durável, idempotência, retry, ownership, falha parcial, replay e reconciliação. Incidente semântico exige correção normativa e teste de regressão; incidente operacional pode gerar runbook ou correção de infraestrutura.

## 12. Organização e rastreabilidade

- `specs/backlog/`: trabalho futuro ou diferido.
- `specs/active/`: refinamento e execução selecionados.
- `specs/archive/`: dossiês ACCEPTED e handoffs históricos.

Requisitos MEDIUM/HIGH devem ser rastreáveis até implementação, teste, evidência e aceite. Encerramento atualiza índice, referências, handoff e executa `make check-docs` e `git diff --check`.

## 13. Independência de ferramentas e agentes

Nenhuma regra depende de um modelo, IDE ou fornecedor. Ferramentas executam o processo; não o definem. Agentes são substituíveis. Contexto deve ser seletivo: Constituição → spec ativa → owners → arquitetura → código/testes → handoff.

## 14. Definition of Done

Uma feature MEDIUM/HIGH termina somente quando respeita o escopo, possui semântica completa, implementação e migrations aplicadas, testes exigidos passando, matriz preenchida, Ponytail obrigatório em PASS, nenhuma lacuna bloqueante e aceite da autoridade competente.

