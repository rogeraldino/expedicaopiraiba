# Handoff para continuidade no Antigravity

## Ponto de retomada mais recente — 21/10/2026

**Ler primeiro o [HANDOFF.md](HANDOFF.md).** O Estágio 1 foi concluído tecnicamente,
validado com Ponytail PASS independente e implantado no sandbox em HTTPS real (`sb.expedicaopiraiba.com.br`).
Mídia persistente ativa em `/srv/piraiba/sandbox/media`, migrações aplicadas, build do Next.js
concluído e testes de upload e vinculação de capas bem-sucedidos. Produção permanece intacta em manutenção.

Atualizado em 18/10/2026. Este documento descreve o estado observado ao preparar a passagem. Ele não autoriza cobranças reais, mensagens a clientes nem publicação comercial.

## Comece por aqui

1. Leia `AGENTS.md`, `docs/sdd/CONSTITUTION.md`, `docs/sdd/PLAYBOOK.md` e `docs/sdd/NORMATIVE_INDEX.json`.
2. Leia `specs/archive/Infra_Producao_Sandbox/spec.md`, `evidence.md`, `ponytail.md`, `grill.md` e `counsel.md`. A spec HIGH v0.1 recebeu READY («Perfeito, execute») e, após validação do backup externo no WSL/Windows em 18/10/2026, recebeu ACCEPTED por Rodrigo, estando arquivada em conformidade com a Constituição.
3. Leia `HANDOFF.md`, `deploy/ENVIRONMENTS.md`, `docs/PROVIDER_PREP.md` e `/root/infra/PLAN.md` na VM.
4. Confira `git status`: há alterações locais intencionais, ainda sem commit ou push. A base observada era `fc0482621e34`; o snapshot implantado contém o working tree e está identificado por SHA256 no dossiê e em `/etc/piraiba/release.json`. Não assuma que a cópia implantada é um commit limpo.

## O que foi implantado na VM

- Ubuntu na VM Hostinger, Docker/Compose e Caddy instalados e habilitados. DNS para `expedicaopiraiba.com.br`, `www.expedicaopiraiba.com.br` e `sb.expedicaopiraiba.com.br` apontou para `187.77.56.156`; Caddy emitiu certificados Let's Encrypt e os testes HTTPS passaram sem ignorar validação TLS.
- `www.expedicaopiraiba.com.br` fica em manutenção HTTP 503 para todos os caminhos, inclusive API/admin. O apex redireciona para `www`; HTTP redireciona para HTTPS.
- `sb.expedicaopiraiba.com.br` serve sandbox atrás de senha de borda e também da autenticação normal da aplicação. O login da borda fica em `/__sandbox/login`, usa cookie seguro por 12h e limita tentativas. Credenciais privadas ficam em `/etc/piraiba`; para exibi-las, execute **no terminal da VM** `python3 /root/infra/piraiba/show-sandbox-access.py`. Nunca copie a saída para Git, chat ou logs.
- Compose separados: `piraiba-production` e `piraiba-sandbox`, com bancos PostgreSQL 17, redes, volumes e segredos próprios. Novas portas escutam apenas em loopback: produção 3001/8001, sandbox 3002/8002, gateway 8090. O desenvolvimento antigo continua em loopback 3000/8000 e seu banco/volume foram preservados. Detalhes e comandos estão em `deploy/ENVIRONMENTS.md`.
- Limites iniciais de memória, CPU, processos e logs aplicados; serviços de aplicação não rodam como root e não recebem o socket Docker. Jobs só expiram holds localmente, sem provedores externos.
- A nova configuração de backup cobre desenvolvimento, produção e sandbox. Cada dump é restaurado em banco temporário para validação; o pacote é cifrado com age antes de poder ser lido pela chave de backup. A chave privada permanece no WSL do responsável. Não há retenção automática nem alerta externo.
- Último arquivo ampliado observado na VM: `piraiba-development-20261018T200300405748Z.tar.gz.age`, 899.433.924 bytes, com `.sha256` e `.ready`. A criação e as restaurações locais passaram. A cópia/descriptografia deste arquivo no computador e no SSD externo ainda precisa de confirmação explícita; o backup anterior de aproximadamente 278 MB foi validado no Windows e o agendamento diário às 20h/ao logon foi configurado pelo responsável.
- Evidências locais: `/root/infra/piraiba/evidence.json`, `runtime-evidence.json`, `persistence-evidence.json`, `failclosed-evidence.json`, `ponytail-http-evidence.json`, `dependency-audit.json` e `verify-last.log`. O artefato compartilhado está identificado em `/etc/piraiba/infra-release.json`. Não edite arquivos de `/root/infra` sem atualizar o hash e a revisão do artefato.

## Situação de provedores

- Gmail pessoal `expedicaopiraiba@gmail.com`: senha de app guardada no arquivo privado `/root/.config/expedicaopiraiba/providers.env` e teste de autenticação SMTP STARTTLS bem-sucedido. O modelo `VerificationChallenge` já suporta o canal `EMAIL` e o Gmail está pronto para envio de OTPs.
- WhatsApp (Meta Cloud API / Coexistence) — **PAUSADO EM 18/10/2026**:
  - **Identificadores e Ativos:**
    - Meta App ID: `1641019714739355` (`expedicao-app`), App Secret configurado.
    - WABA ID: `449201538285349` (`Wender B Oliveira`), aprovada pela Meta. Portfólio proprietário original: `Wender Borges de Oliveira` (ID: `250965102120466`). No portfólio `Expedição Piraíba`, o ativo foi vinculado como Conta de Mensagem.
    - Phone Number ID: `549576938228871` (`+55 62 8161-2128`, nome verificado `Wender B Oliveira`). Status na API: **`CONNECTED`** (platform_type: `ON_PREMISE`, account_mode: `LIVE`).
    - Zero-Downtime mantido: número segue ativo no WhatsApp Business móvel e veiculando anúncios Click-to-WhatsApp (CTWA).
  - **Credenciais e Inscrição:**
    - Usuário do Sistema criado no portfólio: `Rodrigo Dev` (ID: `122095931055520208`).
    - Token do Usuário do Sistema Permanente gerado com escopos `whatsapp_business_messaging`, `whatsapp_business_management`, `public_profile`, sem expiração (`expires_at: 0`).
    - Token gravado de forma restrita (`chmod 0600`) em `/etc/piraiba/production.env` e `/root/.config/expedicaopiraiba/providers.env`.
    - Inscrição da aplicação na WABA realizada via API (`POST /449201538285349/subscribed_apps` -> `success: True`).
  - **Webhooks:**
    - Endpoints implementados em `backend/apps/operations/whatsapp.py`: `WhatsAppWebhookView` (`/api/webhooks/whatsapp/`) com handshake `hub.challenge` e verificação de assinatura HMAC `X-Hub-Signature-256`, e `WhatsAppOAuthCallbackView` (`/api/webhooks/whatsapp/oauth/`). Testes unitários em `backend/apps/operations/test_whatsapp.py`.
    - Roteamento configurado no Caddy para `www.expedicaopiraiba.com.br/api/webhooks/whatsapp/*` apontando para porta 8001 (produção).
    - Webhook verificado e ativo no painel de desenvolvedores da Meta com campos: `messages`, `smb_message_echoes`, `account_update`.
  - **Ponto de Pausa & Pendência (Meta):**
    - Submissão do template de verificação `codigo_verificacao` (`AUTHENTICATION`) retornou erro da Meta `OAuthException 100`, subcódigo `2494160` (*"Esta conta do WhatsApp Business não tem permissão para criar ou atualizar modelos"*).
    - Causa: falta de método de pagamento (cartão de crédito) vinculado diretamente à Conta do WhatsApp / WABA `449201538285349`. No portfólio da Expedição Piraíba, o acesso a pagamentos da conta retornou bloqueio de permissão de Administrador Financeiro.
    - Como retomar: após o responsável pelo portfólio proprietário (Wender) vincular o cartão à WABA ou conceder permissão de Administrador Financeiro ao Rodrigo, a criação de modelos é destravada imediatamente.
- Mercado Pago — **INTEGRADO E VALIDADO EM 18/10/2026**:
  - **Credenciais e Aplicação:**
    - Aplicação: `Expedição Piraíba` (ID `3855226698945154`, owner `88566949`, titular `Wender Borges de Oliveira`).
    - Chaves de Produção e Teste configuradas com permissão `0600` em `/etc/piraiba/production.env`, `/etc/piraiba/sandbox.env` e `/root/.config/expedicaopiraiba/providers.env`.
    - Chave secreta de assinatura do Webhook (`MERCADOPAGO_WEBHOOK_SECRET`) configurada e validada criptograficamente via HMAC SHA-256 (`x-signature`).
  - **Gateway e Checkout PIX:**
    - Gateway oficial `MercadoPagoPaymentGateway` implementado em `backend/apps/payments/gateways.py` usando `urllib.request` (zero dependências extras).
    - Teste real de criação de PIX na API do Mercado Pago executado com sucesso (`201 Created`, QR code copia e cola e base64 gerados) e em seguida cancelado (`200 Cancelled`).
    - Integração no fluxo transacional em `backend/apps/payments/services.py` com suporte à alternância segura via `get_payment_gateway()`.
  - **Webhook Oficial HTTPS:**
    - Endpoint `/api/webhooks/mercadopago/` implementado em `backend/apps/payments/views.py` e roteado no Caddy (`www.expedicaopiraiba.com.br` e `sb.expedicaopiraiba.com.br`).
    - Rejeição de assinaturas inválidas (401) e processamento seguro com consulta ativa na API e idempotência via `process_paid_event`.
    - Todos os 64 testes do backend passando com 100% de sucesso.
- A aplicação ainda contém fluxos simulados. Nunca habilite pagamentos reais enquanto `dev_code`/confirmações simuladas e transições financeiras não tiverem revisão e proteção adequada.

## Próximos passos recomendados
1. **[CONCLUÍDO] Cópia externa do backup.** Executado e validado por Rodrigo no WSL/Windows em 18/10/2026 (`baixar-backup.py`).
2. **[CONCLUÍDO] Fechamento do dossiê HIGH de infraestrutura.** Evidências registradas, status ACCEPTED humano formalizado por Rodrigo em 18/10/2026 e dossiê arquivado em `specs/archive/Infra_Producao_Sandbox/` com índice normativo atualizado.
3. **[CONCLUÍDO NO SANDBOX] Corrigir vulnerabilidades do frontend antes de abrir produção.** Vulnerabilidades Next.js 16.4.2 e dependências sanadas no sandbox.
4. **[CONCLUÍDO NO BACKEND] Provedores — Mercado Pago (PIX & Webhook Transacional):**
   - Chaves de sandbox e produção integradas com permissão restrita.
   - Webhook seguro `/api/webhooks/mercadopago/` validado com HMAC SHA-256 e liberado no Caddy sob HTTPS.
   - Gateway de geração de PIX dinâmico (QR code + copia e cola) testado na API ao vivo e integrado ao checkout.
5. **Completar Checkout — Cartão de Crédito e Boleto:**
   - Adicionar tokenização de cartão no frontend e geração de boleto via Mercado Pago conforme aprovado.
6. **Definir o ciclo de publicação resistente a falhas.** Conforme proposto em `/root/infra/PLAN.md`.
7. **Retomar Meta WhatsApp:** Vincular faturamento na WABA, criar template `codigo_verificacao` e parear coexistência.

## Limites e avisos operacionais

- Uma única VM é ponto único de falha; não há alta disponibilidade nem teste de carga comercial.
- Produção permanece inacessível em manutenção. Sandbox não é ambiente de pagamentos reais.
- Contêineres isolados não limitam o agente root do host.
- Antes de qualquer comando destrutivo ou mudança de proxy/volumes, confira o backup externo mais recente e os comandos do runbook. Nunca usar `docker compose down -v`, `docker system prune` ou apagar volumes como limpeza.
- As evidências registram condições do momento da execução em 18/10/2026. Revalidar saúde, DNS, TLS, espaço, limites e vulnerabilidades antes de promover uma versão.
