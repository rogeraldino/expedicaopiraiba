# Taxas no checkout e cadastro simplificado de produtos

**Estado:** IN_PROGRESS · READY humano em 06/11/2026 · **Solicitante:** Rodrigo · **Declaração humana:** “Sim, READY em 06/11/2026” na conversa de 06/11/2026, após Grill independente sem bloqueios semânticos internos.

## Objetivo

Permitir definir o preço-base da expedição e apresentar ao cliente o total calculado de acordo com meio de pagamento e parcelamento. Simplificar cadastro de produto para nome, foto, categoria e descrição.

## Fluxo de preço e taxa

1. O preço que a operação cadastra é o preço-base em reais; o serviço de checkout calcula o total em centavos.
2. O checkout consulta o Mercado Pago para meios e opções de parcelas permitidos pelo cartão/BIN, com o valor da cobrança quando conhecido. Nenhuma credencial privada vai ao navegador. Essa consulta não é fonte da tarifa contratual do vendedor.
3. A tarifa do vendedor vem de tabela editável no admin. Cada linha possui meio, número de parcelas, taxa percentual, valor fixo opcional, vigência, origem, data da conferência, operador responsável, indicação **estimativa/confirmada** e estado ativo/inativo. Uma única linha ativa deve corresponder a cada método/parcelas em determinado instante. Sem linha válida, a opção fica indisponível; não é permitido preço calculado com taxa zero implícita. O responsável autorizou em 06/11/2026 trabalhar inicialmente com estimativas públicas editáveis. A operação vê que são estimativas e compara a tarifa efetiva após cada transação; cliente vê o acréscimo exato cobrado, sem promessa de que equivale ao custo real do vendedor.
4. Para tarifa percentual `p` sobre o bruto e tarifa fixa `f`, o total cobrado é `ceil((base + f) / (1 - p))`, em centavos, com Decimal e arredondamento para cima. A taxa exibida é `total - base`. O total enviado ao provedor é o mesmo total exibido. Cada pagamento guarda snapshot da base, tarifa, origem e total para auditoria e reembolso.
5. Mercado Pago pode devolver custo de financiamento do comprador, diferente da tarifa do vendedor. A cotação deve distinguir esse valor e não somá-lo duas vezes. Se o checkout do provedor cobrar custo adicional ao comprador fora do valor enviado pela aplicação, o cliente deve visualizar esse total antes de autorizar; se a aplicação não puder validar o total, desabilita a parcela.
6. A tarifa do vendedor será repassada em Pix, boleto e cartão, inclusive parcelas, conforme decisão do responsável em 06/11/2026. Os meios mostram apenas valor + taxas + total, sem detalhamento técnico. Todas as taxas e o total são visíveis antes de confirmar o pagamento.
7. A cotação é emitida pelo servidor após OTP e antes de criar o hold. Tem identificador aleatório, cliente verificado, expedição, nomes/quantidade de participantes, plano, versão da tabela, base, método, parcelas, tarifa, total e validade de 10 minutos. Mudanças em qualquer campo vinculado ou cartão/BIN invalidam a cotação. Edição normal da tabela não invalida cotações emitidas: elas são honradas até expirar. O admin pode revogar explicitamente uma versão por erro material, invalidando suas cotações ainda abertas. No envio, o servidor verifica sob bloqueio transacional cliente, dados da cotação, prazo, revogação e uso único, cria ou reutiliza hold compatível e vincula a cotação ao ID da reserva na mesma transação. Falha do provedor não reutiliza a cotação para nova cobrança; uma nova cotação pode aproveitar o hold válido. Repetição da mesma requisição retorna o mesmo resultado por chave de idempotência, sem cobrar novamente. Diferença gera nova cotação e exige nova confirmação; nunca há cobrança silenciosa maior.
8. O preço-base da reserva, o sinal-base e o saldo-base permanecem separados das taxas. A tarifa fixa é aplicada uma vez por cobrança agregada, e o percentual sobre o total agregado, sem arredondar por participante. Cada cobrança inicial ou de saldo tem sua própria tarifa e snapshot. Pagamento manual não recebe taxa automática. `paid_amount_cents` e `remaining_balance_cents` devem considerar somente a parte da cobrança atribuída ao serviço; recibo, painel e e-mails mostram base, taxa e bruto. Estornos usam o valor bruto efetivamente capturado, sujeitos à política contratual aplicável.
9. Cartão: ao mudar BIN ou parcelas, atualizar cotação e valor do formulário do Mercado Pago antes da tokenização. Na confirmação, se o valor apresentado pelo CardForm/MP divergir do total cotado, bloquear e pedir nova confirmação. Pix e boleto: cotar antes de emitir o QR/boleto; um instrumento emitido mantém seu valor e validade, mesmo se a tabela mudar depois.

## Cadastro de produto

1. Admin cria/edita produto com nome, imagem pública da biblioteca de mídia, categoria e descrição.
2. Unidade, tamanho de pacote e aliases continuam como dados operacionais existentes, com defaults/valores legados preservados; não são necessários no formulário básico e não podem ser apagados ao editar.
3. Formulários de cardápio e consolidação continuam lendo esses campos operacionais.
4. Upload usa Media Picker e URLs públicas da biblioteca existente. Produtos antigos continuam válidos sem foto/descrição.

## Falhas, atualização e auditoria

- Consulta de parcelas do provedor com erro bloqueia apenas as parcelas afetadas. Se faltar tarifa ativa, desabilita a forma de pagamento/parcelamento afetado e apresenta aviso, sem inventar valor.
- Tabela pode ser editada no admin, cada alteração é auditável e só vale para novas cotações; pagamentos e instrumentos já emitidos mantêm o snapshot aplicado.
- Percentual deve estar entre 0 (inclusive) e 100% (exclusive), valor fixo não negativo, e o acréscimo total limitado a 30% da base por cotação. Taxa zero é permitida apenas por linha explícita. O banco deve rejeitar linhas ativas com vigências sobrepostas para o mesmo meio e número de parcelas; edições concorrentes são serializadas.
- Endpoint não recebe valores calculados confiáveis do browser: servidor revalida total, meio, parcelas e taxa escolhida antes de criar cobrança.
- Não há alteração de cobrança já aprovada. Reembolso considera o total realmente capturado e segue a política de cancelamento vigente.

## Pontos de bloqueio semântico

- A API de opções de parcelas não fornece, por si, toda a tarifa contratual do vendedor. As estimativas públicas podem ser ativadas por decisão do responsável, com origem e data explícitas; não provam a tarifa contratual nem garantem recebimento líquido igual ao preço-base.
- A tela administrativa deve oferecer correção/conferência das tarifas reais da conta e diferença de conciliação após transação.
- Revisar textos de diferenciação de preço, juros e eventuais acréscimos com assessoria jurídica antes da publicação comercial.

## Contrato, reembolso e verificação

- O contrato de serviço publicado deve identificar a prestadora com os dados fornecidos em 06/11/2026 e ter versão e hash imutáveis. Na primeira etapa, o cliente vê o link do contrato e a oferta. No botão final da etapa de pagamento, após escolher meio/parcelas e obter cotação exata, marca aceite explícito. O comando final registra, antes de chamar o provedor, versão/hash do contrato, cotação exibida (base/taxa/bruto/meio/parcelas), snapshot integral da oferta (expedição, destino, datas, inclusões, exclusões, preço-base, sinal, participantes, regras de cancelamento e saldo) e data/cliente na mesma transação do hold. Recibo e área da reserva permitem consultar os snapshots aceitos. Qualquer alteração da cotação ou oferta após o aceite limpa a marca e exige novo aceite. Correções posteriores geram nova versão, sem alterar aceites anteriores.
- Código de verificação aparece em modal na primeira etapa, abaixo dos dados complementares, antes das escolhas de pagamento. Antes de confirmar o código, a resposta pública e o texto são uniformes: “Se os dados puderem ser verificados, você receberá um código no contato cadastrado”; não revelam destino mascarado nem se CPF existe. O backend continua enviando ao contato antigo quando CPF já cadastrado, sem sobrescrevê-lo antes da verificação. **Somente após código válido** o servidor informa `EXISTING` ou `NEW` a partir do desafio, e a interface mostra o resultado. Fechar o modal conserva o formulário. Ao trocar CPF, o frontend limpa desafio e token; o backend vincula cada desafio e token ao cliente e rejeita uso com dados de outro cliente/reserva. Sessões antigas não são revogadas globalmente por simples edição local. Após verificar, o pagamento é a segunda e última etapa.
- Cancelar reserva no admin não altera automaticamente o estado financeiro do pagamento. Nesta entrega, a ação de reembolso no admin incide sobre a **reserva inteira**; cancelamento de um único participante exige processo manual separado e não altera os demais automaticamente. O admin solicita reembolso por pagamento, informa motivo, valor bruto em centavos e base legal/contratual; visualiza total já devolvido e máximo disponível. Direito de arrependimento válido e cancelamento pela prestadora exigem restituição integral do valor pago; após o prazo, a retenção deve ter justificativa e memória de cálculo. Reembolso parcial mantém o pagamento PAID com ledger de devoluções; total marca REFUNDED somente após confirmação do provedor. Falha ou resposta incerta mantém estado pendente para reconciliação.
- Cada pedido de devolução contém `amount_cents`, `fee_refund_cents` e `service_refund_cents`. Para estorno parcial, a fração da taxa devolvida é `floor(valor_bruto_devolvido × taxa_original / bruto_original)`; no último estorno, ajusta-se o resíduo para que os totais fechem exatamente. `paid_amount_cents = soma(base_cents dos pagamentos PAID ou REFUNDED) − soma(service_refund_cents dos pedidos CONFIRMED)`, sem excluir pagamento totalmente estornado antes da subtração. Para reserva ativa, `remaining_balance_cents = max(total_price_cents − paid_amount_cents, 0)`. Para reserva cancelada/reembolsada, o saldo exigível é zero e nenhuma nova cobrança é permitida, mesmo que `paid_amount_cents` diminua após devolução. O painel mostra bruto pago, bruto devolvido, base retida e taxa retida separadamente.
- Captura aprovada pelo provedor após expiração ou cancelamento entra no ledger como PAID e exige análise para devolução; não reabre a vaga automaticamente. Captura excedente também entra no ledger, mas é excluída do saldo-base da reserva e pode ser reembolsada integralmente sem cancelar a reserva válida. Uma tentativa sem resposta do cartão permanece bloqueada para consulta operacional; Pix/boleto podem repetir somente a mesma chave de idempotência enquanto o hold estiver válido.
- Pedido de reembolso segue `REQUESTED → SUBMITTED → CONFIRMED` ou `FAILED`; timeout/resposta ambígua muda para `UNKNOWN`. Pedidos `SUBMITTED`/`UNKNOWN` reservam seu valor e bloqueiam novo pedido acima do saldo. Reconciliação consulta `GET /v1/payments/{id}/refunds` e o pagamento original. `UNKNOWN` vai a `CONFIRMED` se o provedor informar devolução aprovada correspondente; vai a `FAILED` apenas com rejeição terminal inequívoca. Se a consulta não resolver, permanece `UNKNOWN` e só permite reenvio da **mesma** requisição com a **mesma** `X-Idempotency-Key`, que o Mercado Pago documenta para repetição segura. Nunca gera segunda chave para resolver incerteza. Webhook e consulta são idempotentes pelo identificador da devolução e guardam eventos. Mercado Pago usa o identificador do pagamento original, registra pedido/resposta sem segredos e só confirma devolução após resposta inequívoca do provedor. Pix/cartão seguem o meio original quando suportado. Boleto e pagamento manual exigem fluxo de transferência verificada ao titular com comprovante, sem simular sucesso do provedor. Auditoria registra operador, horário, motivo, valores e transições.

## Dados e decisões registrados

1. Razão social, CNPJ e endereço foram fornecidos pelo solicitante em 06/11/2026. O canal contratual usa o número informado pelo solicitante; a divergência do registro Meta foi comunicada como questão operacional separada.
2. O solicitante declarou READY em 06/11/2026. A publicação exige Ponytail PASS e ACCEPTED humano para o SHA final, conforme a Constituição.

## Pesquisa inicial de estimativas

A [página pública do checkout Mercado Pago](https://www.mercadopago.com.br/ferramentas-para-vender/check-out) consultada em 06/11/2026 mostra Pix 0,99%, crédito à vista 4,98% para liberação imediata e boleto R$ 3,49. Outra variante da mesma página exibe boleto R$ 3,99 e tabela de parcelamento; portanto o seed deve registrar fonte, data e incerteza, e o admin deve poder corrigir antes/depois da ativação. A tarifa contratual depende da configuração da conta. Para 2–10 parcelas, a [tabela pública de parcelamento](https://www.mercadopago.com.br/ferramentas-para-vender/check-out?code=7NRWQ&device=35) mostra custos adicionais estimados de 2,53%, 4,62%, 6,69%, 8,66%, 9,96%, 11,24%, 12,50%, 13,73% e 14,93%, respectivamente; só se aplica quando essa modalidade é custo do vendedor, evitando repetir custo que o provedor já cobra do comprador.

## Não objetivos

- Não alterar preços-base de expedições existentes.
- Não prometer correspondência da tabela genérica com cobranças reais da conta sem fonte verificada.
- Não mudar o cálculo de disponibilidade nem a composição dos pacotes/cardápios.

## Matriz de conformidade

| Requisito | Código | Evidência |
| --- | --- | --- |
| Consulta MP e fallback controlado | `payments/gateways.py`, `payments/pricing.py`, CardForm | Validação de BIN/parcelas, bloqueio de total divergente; build frontend passou |
| Preço/encargo/total validados no servidor | `payments/pricing.py`, `payments/services.py` | `tests_fees_refunds.py`: gross-up, cotação e recusa de quote diferente |
| Snapshot financeiro imutável da reserva/pagamento | `reservations/services.py`, `payments/models.py` | `tests_fees_refunds.py`: snapshot, reembolso parcial e total; cliente consulta oferta e contrato |
| Cadastro produto com foto/categoria/descrição | `operations/views.py`, `expeditions/models.py`, painel admin | `operations/tests.py`: criação/edição e validação da biblioteca de mídia |
| Campos operacionais legados preservados | `operations/views.py`, painel admin | Suíte Django completa no PostgreSQL sandbox: 109 testes verdes |
| Recuperação de cobrança, reembolso e excesso | `payments/reconciliation.py`, `payments/refunds.py`, `payments/services.py` | Testes de timeout, captura tardia, excesso e concorrência no PostgreSQL; Ponytail incremental PASS antes do commit |
