# Auditoria operacional — Expedição Piraíba

Data: 21/10/2026. Base: `ad84eed57db10743f17c9ab5ba84351bdffd1d8d`.
Natureza: diagnóstico técnico e planejamento; não é aceite de produção.

## Resultado

O sistema já possui grande parte da operação administrativa e da jornada do
cliente. Ainda não está pronto para abertura comercial: faltam concluir a
autenticação por canal, fechar os pagamentos reais com segurança, conectar
algumas telas aos dados operacionais e homologar a versão publicada.

A [épica de entrega em três estágios](../specs/active/ENTREGA_OPERACIONAL_MVP.md)
concentra o trabalho necessário, preservando o escopo comercial registrado.

## Cobertura e método

Inventário completo dos 437 arquivos versionados existentes no início da
análise: 214 textuais e 223 binários. A revisão percorreu arquitetura, modelos,
serviços, endpoints, serializers, rotas e ações do frontend, migrações, comandos
de carga, testes, documentação normativa, backlog e implantação.

| Área | Arquivos textuais inventariados | Foco da revisão |
|---|---:|---|
| Backend | 103 | Clientes, expedições, reservas, pagamentos e operações |
| Frontend | 52 | Vitrine, checkout, portal, convidado, admin e configuração |
| Especificações | 38 | Escopo aprovado, supersessões, aceite e pendências |
| Documentação/configuração restante | 21 | Infraestrutura, dependências, deploy e continuidade |

Além do Git, foram inspecionados os containers, contagens e migrações dos
bancos de sandbox/produção, o gateway em `/root/infra/piraiba/gateway.py` e o
Caddyfile efetivo em `/etc/caddy/Caddyfile`. Credenciais foram utilizadas
apenas em memória para o acesso autorizado ao sandbox; seus valores não
fazem parte desta evidência.

Limites: inventário de binários não equivale a inspeção visual de cada foto;
não houve sessão visual em navegador, novo build/lint/TypeScript, nova
auditoria de dependências, teste de carga, envio de mensagens ou cobrança no
provedor. Os resultados históricos desses itens não foram convertidos em
validação atual. As reproduções adicionais de domínio usaram SQLite em memória
e não comprovam concorrência; a suíte existente foi executada em PostgreSQL.

## 1. Por que as imagens do sandbox falham

**Causa confirmada: roteamento do gateway quando a URL contém query string.**

O Next.js entrega imagens otimizadas por URLs como
`/_next/image?url=%2Fhome%2Fhero-desktop.webp&w=640&q=75`.
O `forward_auth` do Caddy reescreve o caminho para `/check`, mantendo os
parâmetros. O gateway compara `self.path` integralmente com `/check`; portanto,
`/check?url=...` cai no retorno 404 antes de encaminhar a requisição ao frontend.

Reproduções autenticadas pelo domínio HTTPS:

| Requisição | Resultado |
|---|---|
| `/home/hero-desktop.webp` | 200, `image/webp`, 253.628 bytes |
| `/home/hero-desktop.webp?v=1` | 404, corpo vazio |
| `/_next/image?url=%2Fhome%2Fhero-desktop.webp&w=640&q=75` | 404, corpo vazio |
| `/api/expeditions/` | 200, lista vazia |
| `/api/expeditions/?page=1` | 404, corpo vazio |

No acesso interno ao frontend, o arquivo original e o otimizador responderam
200. Diretamente no gateway, `/check` sem cookie respondeu 401 e
`/check?url=...` respondeu 404. Home e galeria foram percorridas via HTML e
requisições de imagem, reproduzindo a falha nas variantes otimizadas.

Não é uma falta geral de arquivos: as 33 referências literais locais de imagem
identificadas no código têm arquivo correspondente em `frontend/public`.

**Correção indicada:** separar o caminho dos parâmetros antes de selecionar a
rota do gateway, mantendo a validação do cookie e o tratamento de APIs.
Validar acesso autorizado e rejeição sem cookie para URLs com e sem parâmetros,
incluindo métodos de escrita. Não abrir uma exceção pública para imagens.
A infraestrutura efetiva também precisa de fonte versionada e identificação
de release, pois o gateway atualmente fica fora deste repositório.

Esta auditoria não alterou o gateway nem publicou uma correção.

## 2. Existe upload de imagens hoje?

**Não existe upload de arquivos pela aplicação.**

- `GalleryPickerModal`, em `frontend/src/app/admin/admin-panel.tsx`, escolhe
  entre 22 fotos previamente enumeradas em `GALLERY_PHOTOS`.
- Expedições e pousadas aceitam `cover_image_url`; expedições também aceitam
  `gallery_image_urls`; equipamentos aceitam `image_url`.
- Os campos guardam caminhos/URLs, não arquivos. Não foram encontrados
  endpoint de upload, seletor de arquivo, fluxo multipart, modelo de mídia
  ou configuração de armazenamento persistente para uploads.
- A galeria pública em `frontend/src/app/galeria/page.tsx` possui seu próprio
  catálogo estático. Selecionar uma imagem da expedição não cadastra uma foto
  nova nessa galeria.

Para adicionar uma foto própria hoje é necessário hospedar o arquivo e informar
sua URL nos campos disponíveis, ou incluí-lo em `frontend/public` e publicar
uma nova versão. Copiar um arquivo para dentro do container não é uma solução
durável; os containers hospedados usam filesystem somente leitura.

O upload proposto deve permitir envio pelo admin, biblioteca reutilizável,
validação do conteúdo/tamanho/dimensões, armazenamento fora da imagem Docker,
miniaturas, associação a capa/galeria e recuperação em backup. O acervo atual
deve continuar utilizável.

## 3. O que já existe e deve ser aproveitado

| Capacidade | Estado observado |
|---|---|
| Vitrine e detalhes | Páginas implementadas, com conteúdo comercial vindo da API |
| Rios, pousadas, espécies e comodidades | Modelos, catálogos e gestão administrativa |
| Expedições | Construtor, datas, capacidade, valores, pacotes e mídia por URL |
| Reservas | Hold, participantes, histórico e controle transacional de vagas |
| Operação administrativa | Venda direta, pagamento manual auditado e cancelamento |
| Cliente/convidado | Portal, ficha, preferências, checklist e isolamento financeiro |
| Compras e embarque | Consolidação de bebidas, CSV/TXT e manifesto com CSV/impressão |
| CRM e equipamentos | Cadastros e gestão de adicionais pelo administrador |
| Mercado Pago | Adaptador Pix, consulta de pagamento e endpoint de webhook |
| Infraestrutura | HTTPS, isolamento de ambientes, jobs e mecanismo de backup |

Essas capacidades têm limitações detalhadas abaixo. Não é necessário
reimplementar todos os módulos para entregar o projeto.

## 4. Bloqueadores da entrega

`P0` impede abertura comercial confiável; `P1` impede autonomia ou completude
operacional; `P2` pode ser incrementado após o aceite do escopo inicial.

| ID | Prioridade | Achado e impacto | Evidência/local |
|---|---|---|---|
| IMG-01 | P0 sandbox | Query strings causam 404 no gateway; quebram imagens, filtros e buscas | Reprodução HTTPS; gateway `do_GET` |
| CAT-01 | P0 | Sandbox e produção possuem zero expedições; não há oferta comprável | Contagens em ambos os bancos; API pública `[]` |
| AUTH-01 | P0 | OTP devolvido como `dev_code`, sem envio real; nome/e-mail/telefone de CPF existente são alterados antes da verificação | `reservations/serializers.py`, `customers/services.py:start_verification` |
| AUTH-02 | P0 | Tentativa errada de OTP faz rollback do contador; seis erros deixam `attempts=0` | Reprodução isolada; `verify_challenge` usa `transaction.atomic` e lança exceção após salvar |
| AUTH-03 | P0 | Reacesso aceita CPF e parte do telefone, inclusive de participante, sem comprovar posse do canal; não há limitação de tentativas da aplicação configurada | `customer_lookup`, `CustomerAuthLookupView`, settings |
| PAY-01 | P0 | Confirmação simulada de sinal e saldo permanece ativa no backend e na UI, sem exigir provedor FAKE/ambiente de teste | `payments/urls.py`, `views.py`, `serializers.py`; checkout e `CustomerJourney.Payment` |
| PAY-02 | P0 | Webhook Mercado Pago só valida assinatura se todos os campos estiverem presentes; ausência de assinatura não é rejeitada | `payments/views.py:MercadoPagoWebhookView` |
| PAY-03 | P0 | Reconciliação não confere valor, moeda ou referência da reserva; falhas de consulta/processamento podem receber 200 sem conclusão durável | Mesmo webhook e `payments/services.py:process_paid_event` |
| PAY-04 | P0 | Chave de idempotência do provedor é aleatória em cada chamada; cobranças pendentes podem ser reutilizadas mesmo vencidas; expiração/pagamento tardio não estão fechados | `gateways.py:create_pix`, serviços financeiros e estados terminais da reserva |
| PAY-05 | P0 | Para duas pessoas a UI mostra R$ 2.240 de sinal, mas o backend pede R$ 1.120 no mesmo exemplo | Reprodução isolada; `create_hold` não multiplica `expedition.deposit_cents` |
| PAY-06 | P0 | Cartão, boleto, cancelamento no provedor e devoluções não estão implementados; constam do escopo registrado de 18/10 | `docs/PROVIDER_PREP.md`; gateway só cria Pix e UI desabilita demais métodos |
| PAY-07 | P0 | Checkout só chega ao sucesso pelo botão de simulação; não acompanha confirmação real. Tela de saldo não apresenta o Pix recebido | `checkout-form.tsx`, `CustomerJourney.Payment` |
| CAP-01 | P0 | Ocupação administrativa soma a mesma reserva uma vez por pagamento; duas vagas viram quatro com sinal+saldo | Reprodução isolada; `operations/views.py:expeditions_with_occupancy` e venda manual |
| GUEST-01 | P0 | Token antigo continua acessando o registro após substituição do participante; falta revogação/versionamento | Reprodução isolada; assinatura usa apenas IDs; substituição reutiliza o registro |
| MSG-01 | P0 | Gmail tem configuração histórica externa, mas não há adaptador de envio no fluxo; WhatsApp só recebe/valida webhook e aguarda dependência externa registrada | `customers/services.py`, `operations/whatsapp.py`, handoffs |
| MEDIA-01 | P1 | Upload e biblioteca dinâmica de fotos inexistem | Modelos, endpoints e seletor estático descritos acima |
| GEAR-01 | P1 | Cliente seleciona catálogo fixo diferente do admin; itens ficam no localStorage e apenas resumo vai a `operational_notes` | `customer-journey.tsx:GearSection`, `gear-catalog.ts` |
| BOARD-01 | P1 | Ficha pode ser marcada completa sem CPF/nascimento; manifesto não inclui `health_notes`/`vest_size` nem todos os dados coletados | `CustomerParticipantSerializer.update`, `ExpeditionManifestView`; confrontar owner E04 |
| FLOW-01 | P1 | Listagem pública/hold não verificam datas; nova expedição pelo wizard não recebe checklist automaticamente | `PublishedExpeditionList`, `create_hold`, serializer do wizard; revisão de datas e configuração antes da publicação |
| OPS-01 | P1 | Deploy atual depende de artefatos externos ao Git; documentação mistura estados antigos e atuais; falta gate de release reproduzível | Compose real, Caddy real, `HANDOFF.md`, runbooks e ausência de pipeline no repositório |
| LEGAL-01 | P1 | Checkbox de termos é apenas estado da UI; não há páginas de termos/política nessa árvore de rotas nem registro de versão/aceite no comando de reserva | `CheckoutForm`, `HoldSerializer`, modelo da reserva |

### Evidências adicionais de domínio

As reproduções usaram dados sintéticos em SQLite `:memory:` dentro de um
processo separado do container de desenvolvimento. Nenhum dado do sandbox ou
produção foi criado ou alterado. A chamada de provedor foi substituída por mock.

| Cenário | Resultado atual |
|---|---|
| Sinal de 2 participantes, R$ 5.600/pessoa, sinal R$ 1.120/pessoa | UI calcula 224.000 centavos; reserva grava 112.000 |
| Reserva de 2 participantes com 2 pagamentos | Admin conta 4; API pública mantém 10 de 12 vagas livres |
| 6 OTPs errados no mesmo desafio | Contador persistido permanece 0 |
| Token de convidado emitido antes da troca de nome no mesmo registro | Resolve o registro do substituto |
| Webhook sem assinatura; mock de consulta devolve aprovado de R$ 0,01, referência divergente | HTTP 200 e pagamento local de R$ 1.120 marcado `PAID` |

O último caso comprova ausência das validações locais. Não afirma que o
provedor aprovaria um pagamento inexistente: a consulta ao provedor continua
existindo, mas seu resultado não é confrontado com os invariantes locais.

### Conflitos que precisam de decisão explícita

- O owner E04 aprova reacesso por CPF+telefone, enquanto o MVP exige canal
  verificado. O reforço precisa declarar a supersessão e a migração das sessões;
  não tratar o comportamento atualmente aprovado como uma mudança já autorizada.
- Os testes atuais fixam o sinal único mesmo para dois passageiros; UI,
  configuração por pessoa e venda manual têm semânticas divergentes. A correção
  deve definir a regra e o destino de reservas/cobranças existentes.
- Pagamento após vencimento do hold, prazo do boleto, parcelamento/juros,
  cancelamento e devolução precisam de políticas fechadas antes de READY.
- O escopo registrado inclui Pix, cartão, boleto, cancelamentos e devoluções.
  Entregar apenas Pix seria uma redução de escopo a decidir pelo responsável.
- As condições atuais de aprovação/faturamento da Meta não foram consultadas
  novamente no provedor. O bloqueio externo é histórico, não uma nova verificação.

## 5. Estado dos ambientes

- Containers de sandbox e produção estavam saudáveis; bancos separados e sem
  migrações pendentes, com zero clientes, reservas, pagamentos e expedições.
- Os catálogos de referência já existem: 1 rio, 2 pousadas, 17 comodidades,
  23 produtos, 3 pacotes de cada tipo e 4 equipamentos em cada ambiente.
- Ambos os backends possuem variáveis Mercado Pago preenchidas. Isso não
  comprova validade das credenciais, modo de teste ou homologação de pagamento.
  Como a seleção do gateway depende da presença do token, não se deve assumir
  que toda ação dentro do sandbox será automaticamente simulada.
- Os nove arquivos de serviços/views/serializers críticos comparados têm hashes
  iguais aos implantados nos dois ambientes. `config/settings.py` diverge nas
  atribuições de `META_APP_ID` e `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; essa diferença
  precisa ser reconciliada na preparação de release, sem copiar segredos para Git.
- Produção permanece em manutenção conforme infraestrutura, com exceções
  públicas de webhook no Caddy efetivo. `deploy/ENVIRONMENTS.md` ainda declara
  que essas exceções e provedores não existem: atualizar a documentação.
- Backups multiambiente e aceite externo têm evidência histórica no dossiê de
  infraestrutura. Não foi executada nova restauração ou cópia externa nesta
  auditoria; sua atualização entra na homologação.

## 6. Validação executada nesta análise

| Verificação | Resultado | Alcance |
|---|---|---|
| Suíte backend: `docker exec expedicaopiraiba-backend-1 python manage.py test --noinput` | 64 testes, 7,306 s, OK | Banco temporário PostgreSQL; inclui teste de concorrência de saldo |
| Frontend: `node --test src/lib/api/next-expedition.test.mjs` em Node 24 | 2 testes, OK | Seleção da próxima expedição |
| HTTP interno e HTTPS autenticado | Falha de query strings reproduzida | Home, galeria, ativos e API |
| Referências literais de imagens locais | 33 existentes, nenhuma ausente | Não cobre toda URL dinâmica do banco |
| Contagens e plano de migrações | Consultas concluídas; zero pendências | Sandbox e produção, somente leitura |
| Reproduções isoladas | 5 divergências confirmadas | Domínio sem efeitos externos; sem prova adicional de concorrência |

Os 64 testes passando demonstram o comportamento coberto atualmente. Os
cenários acima mostram por que esse resultado ainda não é aceite comercial.

## 7. Melhorias posteriores ao fechamento inicial

Paginação das listas hoje limitadas a 100 reservas/150 clientes, otimização de
consultas do dashboard, usuários administrativos individuais se necessários,
extração gradual dos componentes administrativos, PDF/XLSX adicionais,
retenção avançada, automações de atendimento e alta disponibilidade.

Uma refatoração ampla do painel não é pré-requisito para resolver os
bloqueadores identificados. As correções devem se concentrar nos fluxos de
compra, preparação e operação diária.
