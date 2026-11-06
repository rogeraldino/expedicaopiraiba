# Expiração de expedições e cards de ofertas

**Estado:** IN_PROGRESS · **Responsável:** Rodrigo · **Data:** 2026-11-06

**READY de produto:** Rodrigo determinou nesta conversa em 06/11/2026 que a expedição seja encerrada depois de seu último dia e autorizou publicação direta. Revisão Grill independente em 06/11 apontou `SOLD_OUT`, vagas esgotadas e testes; esses pontos foram incorporados antes da promoção.

## Problema e resultado

A viagem encerrada em 31/10/2026 continuava pública em novembro. O catálogo público deve conter apenas expedições publicadas cujo último dia ainda não terminou em `America/Sao_Paulo`. Os cards devem mostrar datas e valor por pessoa em tamanho legível e destacar a ação de reserva sem anunciar desconto inexistente.

## Escopo e não objetivos

- A lista e o detalhe públicos deixam de expor a viagem no primeiro dia depois de `ends_at`.
- O job existente de expiração de reservas marca expedições `PUBLISHED` ou `SOLD_OUT` vencidas como `CLOSED`, de forma idempotente e com lock por registro.
- A viagem permanece visível no último dia. Histórico de reservas e acesso administrativo permanecem disponíveis.
- O card mantém preço integral e identifica a viagem fictícia de R$ 1 como teste.
- Não altera pagamento, política de reembolso, calendário da viagem, nem preços.

## Semântica, falhas e migração

`ends_at` é data inclusiva. O corte usa `timezone.localdate()` configurado em São Paulo. O filtro público atua mesmo se o job falhar; na próxima execução, o job regulariza o status. Execuções repetidas não voltam a mudar o registro. Não há migração de esquema. A expedição de 31/10/2026 foi encerrada uma vez em produção pelo serviço de transição existente. Esta spec autoriza exclusivamente o job a fechar uma viagem `SOLD_OUT` após o último dia; a transição geral `SOLD_OUT -> CLOSED` continua proibida.

## Matriz de conformidade

| Requisito | Implementação | Prova |
| --- | --- | --- |
| Último dia ainda público | `expeditions/views.py` | `test_trip_disappears_after_last_day_and_is_closed_by_job` |
| Dia seguinte oculto na lista e detalhe | `expeditions/views.py` | mesmo teste |
| Fechamento durável e idempotente de `PUBLISHED` e `SOLD_OUT` | `expeditions/services.py`, `expire_holds.py` | testes de expiração publicada e esgotada |
| Preço, datas e CTA legíveis | `expedition-card.tsx`, `globals.css` | build e inspeção visual pós-deploy |

## Evidências pendentes

Revisão independente, teste no PostgreSQL, inspeção visual e verificação em produção após release.
