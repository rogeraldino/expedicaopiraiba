# Plano de publicação — preço integral no Pix e total final no checkout

**Escopo desta mudança:** exibição pública de preços. O preço-base cadastrado, a tabela editável de tarifas, a cotação, o valor enviado ao Mercado Pago, os snapshots aceitos e o fluxo de reembolso não mudam.

## Resultado implementado para o sandbox

1. Card, destaque da página inicial e detalhe mostram o preço integral com tarifa Pix para uma pessoa, identificado como `pagamento integral no Pix`. A página de casal calcula duas pessoas em uma só cobrança. Se a tarifa Pix estiver ausente/inativa/inválida, mostra `Consulte o valor final`.
2. Na etapa de pagamento, o cliente escolhe sinal ou quitação, meio e parcelas. O resumo mostra apenas o total final dessa cobrança. No cartão parcelado, também mostra quantidade e valor das parcelas; antes de informar o cartão, pede os dados para calcular o total.
3. O botão final e o aceite continuam vinculados à cotação do servidor. A discriminação interna de serviço, taxas e financiamento permanece nos snapshots e na auditoria.

## Validação proporcional desta mudança

- Teste da API pública confirma o preço Pix de R$ 2.020 para base de R$ 2.000, atualização ao editar tarifa, agregação correta de tarifa fixa para duas pessoas e ausência de preço quando Pix está inativo.
- Build e TypeScript do frontend, verificação de migrações, `make check-docs` e `git diff --check`.
- Após publicação no sandbox: resposta da API, HTML do card/detalhe, resumo do checkout sem discriminação e saúde dos containers. Não criar cobranças nem executar testes de transação nesta etapa, conforme pedido do responsável.

## Antes de promover a versão completa à produção

1. Resolver o `SPEC GAP` sobre devolução dos juros cobrados pelo Mercado Pago ao comprador no cartão parcelado. A resposta deve definir se o estorno integral da transação devolve também esse financiamento e, se não, qual compensação e registro serão usados. Sem isso, não habilitar crédito parcelado comercial na versão completa.
2. Como o branch `main` contém também mudanças financeiras, de contrato, verificação e reembolso, cumprir o gate da versão **inteira**: suíte automatizada exigida pela cerimônia, build, migrações, revisão Ponytail independente e evidência de comportamento do provedor. O pedido atual dispensa novos testes de transação; logo, não declarar esse gate cumprido por testes de cotação ou saúde. Se a restrição continuar, preparar e revisar uma liberação que deixe o crédito parcelado indisponível até a validação do provedor.
3. Conferir os dados contratuais e o canal de cancelamento, além da tarifa de boleto e eventual valor fixo não confirmados. As linhas hoje identificadas como estimativas não devem ser comunicadas como tarifas contratuais comprovadas.
4. Com gate técnico e sem lacunas bloqueantes, apresentar ao responsável o SHA imutável, a versão proposta e as evidências para `ACCEPTED` explícito. O READY anterior autorizou implementação, mas a Constituição e `AGENTS.md` exigem aceite final do SHA antes da promoção.
5. Antes da troca em produção, criar backup consistente do PostgreSQL e **testar restauração**. O script `deploy/scripts/promote-to-prod.sh` atual não executa esse backup, apesar da descrição em `docs/RELEASE_CEREMONIES.md`; adicionar o passo ao runbook/script antes do release. Promover `main` para `production` somente por fast-forward, criar tag semântica anotada (proposta: `v0.3.0`) e executar o deploy oficial.
6. Verificar saúde, API pública, preços de card/detalhe, cotação sem cobrança, admin e contrato em HTTPS. Monitorar erros e intents pendentes. Rollback de aplicação usa a imagem anterior; restauração de banco exige decisão separada para preservar transações surgidas após a promoção.

**Estado:** mudança visual destinada ao sandbox; plano de produção condicionado aos itens acima. Nenhuma autorização de produção é inferida deste documento.
