# Preparação dos provedores — 18/10/2026

Este documento registra requisitos técnicos das documentações oficiais para preparar a integração. Não altera regras de produto nem autoriza cobrança ou envio em produção. As credenciais devem ficar no `.env` da VM, fora do Git.

## Definições confirmadas pelo organizador — 18/10/2026

- Sequência confirmada por Rodrigo: organizar Gmail e WhatsApp primeiro; decisões e integração de Mercado Pago serão retomadas depois.
- E-mail: Gmail pessoal `expedicaopiraiba@gmail.com`. Método de autenticação ainda a selecionar e homologar; nenhuma credencial recebida.
- WhatsApp: API oficial Meta. Segundo Rodrigo, o portfólio empresarial existe, ele possui acesso de desenvolvedor e falta adicionar o método de cobrança. Número, permissões, token e templates ainda precisam de verificação técnica.
- Mercado Pago: a primeira entrega inclui Pix, cartão e boleto, checkout, cancelamentos e devoluções. Isso amplia o escopo anterior; não reduzir a entrega a Pix.
- Políticas comerciais ainda a especificar: parcelamento e juros, validade do boleto, ocupação de vagas durante compensação, pagamento após expiração, cancelamento, reembolso total/parcial e tratamento de contestações. Não inferir políticas a partir da capacidade da API.
- Domínio: configuração adiada pelo organizador por aproximadamente duas horas; nome final ainda não confirmado.
- Estado: definições de escopo, sem READY para implementação semântica. Mensagens recebidas, eventos e destinatários de notificações continuam pendentes.

## Objetivo e estado para o próximo agente

Rodrigo quer colocar a Expedição Piraíba em uma VM com domínio próprio e ativar envio de e-mail pelo Google, envio/recepção pela API do WhatsApp e cobrança pelo Mercado Pago. A pesquisa dos provedores foi feita em 18/10/2026. **Nenhuma integração real foi implementada ou testada com credenciais.** O repositório continua com pagamentos e OTP simulados. Não interpretar este documento como READY ou ACCEPTED.

Ordem de execução sugerida:

1. Confirmar sistema operacional/arquitetura da VM, domínio final e método de deploy. `compose.production.yaml`, `deploy/Caddyfile`, `.env.production.example` e `deploy/PRODUCTION_RUNBOOK.md` já existem, mas contêm `piraiba.alvor.lat` e dependem de homologação na VM. Preparar DNS, HTTPS, segredos e backup/restauração do PostgreSQL.
2. Resolver as decisões abertas abaixo e escrever spec HIGH em `specs/active/`, usando os owners de `docs/sdd/NORMATIVE_INDEX.json`; executar Grill/Counsel e obter READY humano antes de mudanças semânticas.
3. Fechar a autenticação do checkout: `backend/apps/reservations/serializers.py` devolve `dev_code` publicamente; `backend/apps/customers/services.py` atualiza contato de CPF existente antes da verificação; o acesso posterior por CPF+telefone está em `customer_lookup` e precisa ser confrontado com as regras de verificação do produto.
4. Implementar adaptadores de envio e recepção, armazenamento auditável das tentativas e tratamento de falhas. OTP via WhatsApp é prioritário; e-mail é alternativa, conforme o owner do MVP. Definir explicitamente o que acontece com mensagens recebidas.
5. Integrar Pix real no backend e trocar o checkout para aguardar confirmação confiável. `backend/apps/payments/services.py` usa `FakePaymentGateway`; `backend/apps/payments/urls.py` e `backend/apps/payments/views.py` expõem confirmação simulada, inclusive do saldo. A UI chama esses endpoints. Antes de habilitar cobrança real, impedir esses caminhos de marcar pagamento como pago.
6. Testar contratos com respostas simuladas, duplicidade/retry, concorrência em PostgreSQL e fluxos de erro; depois testar credenciais de homologação e webhooks no domínio HTTPS. O teste Pix sandbox de criação não comprova pagamento aprovado. Executar a revisão Ponytail e o gate real previstos na Constituição.

As escolhas de conta e provedores estão registradas acima. Permanecem abertas as políticas financeiras, o método de autenticação do Gmail e o destino das mensagens recebidas (registro, painel ou automação). Evitar preencher essas lacunas com suposições.

## Meta WhatsApp Business Platform (Cloud API)

Fonte: [coleção oficial da Meta](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

- Criar ou vincular um portfólio empresarial, uma WhatsApp Business Account (WABA), um número de telefone e um aplicativo Meta.
- Guardar ID do número, ID da WABA, versão da Graph API escolhida e token com permissão `whatsapp_business_messaging`; `whatsapp_business_management` é necessária para operações de gestão.
- Envio: `POST https://graph.facebook.com/{version}/{phone-number-id}/messages` com Bearer token. Para iniciar uma conversa fora da janela de atendimento, usar template aprovado; a coleção oficial mostra mensagem de teste `hello_world`.
- Recepção: cadastrar callback HTTPS, verificar `hub.verify_token` e responder `hub.challenge` no GET; conferir `X-Hub-Signature-256` do POST com o App Secret antes de processar o corpo. Registrar o ID da mensagem para evitar duplicidade.
- Dados necessários para homologação: token de teste, ID do número de teste, número destinatário autorizado, App Secret, Verify Token definido por nós e nome/idioma do template aprovado.

## Mercado Pago — Checkout Transparente Pix

Fontes: [Orders API](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/overview), [Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix), [webhooks de orders](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications) e [teste Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix).

- A documentação atual recomenda Orders API para novas integrações. `POST /v1/orders` recebe Bearer Access Token e `X-Idempotency-Key`. A resposta Pix oferece `qr_code` para copia e cola e `ticket_url`.
- Cadastrar webhook HTTPS para o tópico `orders`. Validar `x-signature` com o segredo da aplicação, `x-request-id` e `data.id`; consultar `GET /v1/orders/{id}` antes de consolidar o estado local. O corpo recebido sozinho não é prova de pagamento.
- Guardar Access Token de teste, Access Token de produção e segredos de webhook em ambientes separados. Configurar chave Pix na conta vendedora.
- O teste Pix com credenciais de teste verifica a criação e a consulta da order por valores definidos pelo Mercado Pago; a documentação informa que ele não simula uma compra concluída. A confirmação real precisa de homologação separada, inclusive webhook e reconciliação.

## Google para envio de e-mail

Fontes: [SMTP relay do Google Workspace](https://support.google.com/a/answer/176600), [senhas de app](https://support.google.com/accounts/answer/185833) e [Gmail API `messages.send`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send).

- Se a conta for Google Workspace, o serviço recomendado pelo Google para aplicações é o SMTP relay `smtp-relay.gmail.com`; a configuração é feita no Admin Console e pode autenticar pela IP da VM ou pelo método permitido na organização.
- Se for Gmail pessoal e SMTP, uma senha de app exige verificação em duas etapas e pode não estar disponível em algumas contas. A senha normal da conta não deve ser usada pela aplicação.
- A alternativa OAuth é a Gmail API `users.messages.send`, com o escopo mínimo `gmail.send`; requer projeto e consentimento OAuth.
- Para testar entregabilidade com domínio próprio, configurar SPF, DKIM e DMARC no DNS conforme o método escolhido e verificar recebimento, rejeição e falha temporária.

## Pendências para a integração no repositório

- Selecionar e homologar autenticação do Gmail pessoal confirmado; definir eventos de envio e destinatários.
- Definir o escopo de mensagens recebidas pelo WhatsApp: registro, painel de atendimento ou automação.
- Especificar Pix, cartão e boleto no primeiro incremento, incluindo estados, parcelamento, expiração, cancelamentos, devoluções e contestações.
- Criar especificação HIGH e revisar os efeitos sobre autenticação, estados de reserva, idempotência, conciliação e privacidade antes da implementação semântica, conforme `docs/sdd/CONSTITUTION.md`.
- Remover o retorno público de `dev_code` e desabilitar todos os caminhos de confirmação simulada antes de habilitar cobrança real.
