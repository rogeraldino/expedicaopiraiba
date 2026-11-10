# Cancelamento de reserva com reembolso fora do site

**Estado:** VALIDATED no sandbox · READY humano em 09/11/2026 · **Versão:** 1.1 · **Risco:** HIGH · **Solicitante:** Rodrigo · **Data:** 09/11/2026 · **Declaração:** “Sim, READY em 09/11/2026” na conversa.

## Decisão

No site, o administrador apenas cancela a reserva, com motivo obrigatório. O cancelamento libera as vagas e repõe o estoque de tralhas, sem enviar pedido de estorno ao Mercado Pago e sem cancelar automaticamente Pix/boleto emitido. O administrador fará e acompanhará qualquer devolução diretamente no Mercado Pago, ou por meio adequado quando o Mercado Pago não oferecer a devolução. O registro e a conciliação de reembolsos no admin ficam para desenvolvimento futuro, por decisão expressa do solicitante em 09/11/2026: “Depois fazemos esse registro seguro... não temos dados suficientes para implementar isso agora”.

## Comportamento desta versão

1. A interface de cancelamento informa antes da confirmação que não devolve dinheiro. O motivo fica no histórico da reserva. Cancelar não marca o pagamento nem a reserva como `REFUNDED`.
2. Remover do painel os formulários de solicitação, reenvio, confirmação e conciliação de reembolso. Os endpoints anteriores de mutação de reembolso retornam `410 Gone`, inclusive para chamadas diretas; nenhum caminho de interface pode chamar `POST /v1/payments/{id}/refunds`.
3. Preservar pagamentos, pedidos de reembolso e eventos antigos sem apagar dados. Antes da publicação, conferir se existem pedidos legados `REQUESTED`, `SUBMITTED`, `UNKNOWN` ou `MANUAL_PENDING`. Se houver algum, a promoção fica suspensa para tratamento individual; no levantamento de 09/11/2026, o sandbox tinha zero pedidos e produção ainda não tinha a tabela.
4. O painel mostra o identificador do pagamento no Mercado Pago e deixa claro que `PAID` significa captura conhecida pelo site, não saldo líquido após eventual estorno externo. Pagamento aprovado após cancelamento continua ligado à reserva cancelada, sem reabrir vaga, e gera alerta operacional. Pix/boleto pendentes são atualizados por webhook e pelo reconciliador de tentativas incertas já existente. Enquanto o status local não chegar a terminal, o painel mantém o alerta; o admin confere o estado no Mercado Pago diariamente e pode cancelar o instrumento lá quando possível. Sem confirmação do provedor, o alerta não é encerrado por presunção.
5. Cartão de 2x a 10x permanece disponível. O painel mostra o total do comprador salvo na cotação, o bruto enviado ao Mercado Pago e a diferença de financiamento. O site não presume que um estorno da transação devolve juros cobrados do comprador fora dela. A operação compara esses valores com o estorno no Mercado Pago e, se necessário, com a fatura/comprovante do cliente; compensa manualmente eventual diferença devida fora do site, conforme decisão do solicitante. Sem comprovante externo, o site não afirma que a restituição integral foi concluída.
6. O contrato vigente e os aceites antigos não são alterados nesta versão. Os pedidos de cancelamento seguem o canal informado no contrato e os direitos de restituição permanecem aplicáveis. Cancelamento de apenas um participante de reserva múltipla continua sendo tratado operacionalmente; a ação do painel cancela a reserva inteira.

## Precedência e limites

Esta versão substitui a execução de reembolso por API e pelo admin descrita em `specs/active/taxas-checkout-e-cadastro-produtos.md` apenas para a publicação atual. O livro financeiro detalhado de devoluções, a compensação de juros e a conciliação do provedor serão especificados em trabalho futuro. A ausência desse registro significa que saldos e recibos internos não comprovam a devolução feita fora do site; a interface deve dizer isso explicitamente.

## Grill e READY

A versão 1.0 recebeu Grill independente sem bloqueios semânticos e READY humano explícito em 09/11/2026, mas o solicitante reduziu o escopo antes da publicação. Esta versão 1.1 registra a redução. O delta Grill independente em 09/11/2026 não encontrou bloqueio HIGH, com as duas precisões operacionais incorporadas acima. Requer declaração humana READY da versão 1.1 antes de finalizar implementação HIGH, conforme `AGENTS.md` e Constituição §5.

## Critérios de validação

- Cancelar reserva registra motivo, libera vaga, repõe tralha e não envia POST de estorno.
- API antiga de reembolso retorna 410; painel não oferece essas ações.
- Pagamentos pendentes/capturados e seus IDs aparecem para conferência externa, inclusive após cancelamento.
- Suíte Django no PostgreSQL, build/TypeScript, migrações sem lacuna, sandbox HTTPS e Ponytail independente em PASS.
- Backup com restauração testada, ensaio de migrações em cópia da produção e `ACCEPTED` humano do SHA final precedem a promoção à produção.

## Matriz de conformidade

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Cancelamento sem estorno | `operations/views.py`, `reservations/services.py` | teste de API sem `RefundRequest` nem chamada ao provedor; 116 testes PostgreSQL verdes |
| Ações antigas indisponíveis | `operations/views.py`, painel admin | POST antigo retorna 410; build frontend e TypeScript verdes |
| Conferência externa | serializer de pagamento e painel admin | teste de ID, total do comprador e aviso; revisão Ponytail PASS |
| Publicação segura | script de promoção, backup e ensaio | backup criptografado `20261109T162555160040Z` com restore testado e SHA válido; ensaio final em cópia da produção: 4 reservas, 3 pagamentos, 500 centavos recebidos antes/depois; sandbox saudável |

## Ponytail independente

Em 09/11/2026, `/root/grill` revisou a implementação reduzida: **PASS de código**, sem bloqueio HIGH. Confirmou ausência de POST de estorno na ação, 410 nas mutações antigas, exibição de ID e total do comprador e aviso antes de cancelar. Registrou risco operacional de Pix/boleto localmente pendente quando webhook não chega; o admin confere diariamente no Mercado Pago como previsto acima. PASS de código não equivale a ACCEPTED ou publicação.

## Validação operacional

- Sandbox: release `20261109T162226Z-1497a187a8f1`, backend/frontend saudáveis; `/api/health/`, `/admin` e `/contrato` retornaram 200 nas portas internas. A borda HTTPS manteve a autenticação própria do sandbox (`302`/`401`). Migrações aplicadas e nenhum `RefundRequest` pendente.
- Backup selecionado de produção e sandbox em 09/11/2026: `create-backup.py` gerou arquivo criptografado com `.ready` depois de testar `pg_restore` em banco temporário; SHA conferido em 10/11/2026. O desenvolvimento legado estava desligado e foi excluído apenas do backup desta release.
- Ensaio em 10/11/2026: `pg_dump` da produção, `pg_restore` em banco descartável e migrações até `payments.0010`/`expeditions.0018` passaram. Antes/depois: 4 reservas, 3 pagamentos, soma de `paid_amount_cents` igual a 500 centavos, zero pedidos de reembolso. Banco descartável removido.
- Ainda faltam aceite humano do SHA final, backup novo imediatamente antes da troca e verificação HTTP em produção.
