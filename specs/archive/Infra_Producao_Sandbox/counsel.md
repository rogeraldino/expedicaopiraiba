# Counsel independente — infraestrutura produção/sandbox

Data: 18/10/2026. Revisão somente de leitura do runtime e código; nenhuma implantação realizada pelo revisor. Escopo: spec 0.1 DRAFT. Resultado: **CHANGES REQUIRED antes de READY**.

## Conflito concreto de autenticação

O frontend envia `Authorization: Bearer` em `frontend/src/app/admin/admin-panel.tsx`, `frontend/src/app/minha-reserva/page.tsx` e `frontend/src/components/customer/customer-journey.tsx`. O backend lê esse mesmo cabeçalho em `backend/apps/operations/authentication.py` e `backend/apps/reservations/customer_views.py`. Basic Auth aplicado a todas as requisições rejeita essas chamadas: um único cabeçalho não transporta simultaneamente Basic e Bearer. Proteger só páginas e deixar API sem proteção não atende ao isolamento solicitado.

Recomendação: substituir Basic global por barreira de cookie, independente da autenticação da aplicação. Serviço de borda exclusivo do sandbox, acessível somente por loopback, validado via `forward_auth` do Caddy. Um formulário de acesso aceita usuário `rodrigo` e senha aleatória; após validação emite cookie assinado, host-only, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, sem `Domain`, com expiração absoluta de 12 horas. Segredo de assinatura exclusivo e credencial armazenados root 0600; verificação de senha com hash próprio para senha; assinatura comparada em tempo constante. Cookie expirado, inválido ou ausente nunca autoriza upstream. Alteração do segredo revoga todos os acessos. Não alterar sessões/tokens do produto.

A spec revisada deve fixar: rotas reservadas de login/logout; GET do formulário, POST de credenciais sem segredo em query/log; logout POST que remove cookie; limite de corpo e tentativas (sugestão: 8 KiB e 10 tentativas por IP em 10 minutos); não aceitar redirecionamento externo; retorno fixo ao `/`; `Cache-Control: no-store`; validação de Origin no POST. Todo o restante, incluindo estáticos, API e admin, passa pela verificação de cookie. O proxy preserva Authorization Bearer, não encaminha credenciais de borda e remove cabeçalhos internos de identidade fornecidos pelo cliente. Sem cookie retorna 401, sem redirecionar API para HTML de login. Exceções públicas apenas formulário/POST de login, sem conteúdo de aplicação. Estas decisões precisam substituir explicitamente o critério Basic da spec.

Gates essenciais: cookie adulterado/expirado e senha errada retornam 401; senha correta produz cookie com os atributos acima; Bearer válido + cookie válido funciona; Bearer válido sem cookie falha na borda; cookie válido sem Bearer não concede autorização de produto; chamadas cliente/admin reais funcionam no navegador. Verificar rotas após normalização e toda a política de proxy, não apenas `/`.

## Snapshot e capacidade

Há alterações locais rastreadas em HANDOFF e PROVIDER_PREP e spec não rastreada. Usar snapshot dos arquivos efetivos com SHA base, diff e SHA256 do artefato; não anunciar imagem como reprodução exata do SHA base. Não copiar `.git`, caches, `.env` e segredos inadvertidamente para contexto de build. Imagens devem registrar digest/ID real, além da tag. Instalações de dependências devem seguir lockfiles.

Os caps da proposta somam aproximadamente 3,94 GiB, antes do legado, host, build e serviço de borda. São plausíveis para 7,7 GiB, mas não provam capacidade. A soma de CPU excede 2 vCPUs intencionalmente: caps não são reservas. Manter builds serializados, medir memória disponível e OOM/reinícios durante build e restauração. Incluir gateway de borda no orçamento (sugestão: 64 MiB, 0,1 CPU, pids 64). Não prometer disponibilidade durante builds sem observação real. Sandbox/produção vazios não permitem inferir capacidade sob tráfego.

## Backup existente e compatibilidade

`/root/infra/backups/baixar-backup.py` aceita apenas prefixo `piraiba-development-`, extensão `.tar.gz.age` e manifesto raiz com `database_restore_check=PASS`. Preservar esses contratos permite usar cliente já instalado; o nome legado deve ser explicado pelo manifesto multiambiente. `create-backup.py` atual cobre somente banco de desenvolvimento e usa override Compose em `/tmp`; ele precisa ser incluído na recuperação ou movido com compatibilidade documentada.

Backup ampliado deve falhar se qualquer um dos três dumps/restores falhar; PASS agregado não pode ocultar um banco ausente. Registrar por ambiente nome lógico, SHA/artefato, versão PostgreSQL e resultado da restauração, sem segredos no manifesto público retornado via SSH. Artefato e checksum devem ser publicados atomicamente antes de retornar metadados. Incluir snapshots efetivamente implantados e gateway/cookie signing secret. Excluir chave SSH privada e credenciais do Codex. Medir espaço de dumps + banco temporário + tar + cifra, não somente tamanho do arquivo final. Restauração de dump é prova do banco; não é prova de reconstrução completa da infraestrutura.

A confirmação anterior do Windows cobre somente formato antigo. Novo backup externo e descriptografia permanecem gate humano pendente, sem impedir tarefas independentes. Ausência de retenção foi decisão explícita; avisar insuficiência sem excluir arquivos.

## Gates e bloqueios

1. **SPEC GAP bloqueante:** Basic global conflita com Authorization Bearer. Incorporar solução precisa acima ou equivalente antes de READY.
2. **READY HIGH:** Constituição exige versão/data e declaração humana explícita após Grill/Counsel. Autorização genérica para executar trabalho antecede a spec e não documenta por si só aprovação dos detalhes de segurança refinados. O implementador deve resolver a precedência com a autorização explícita atual do usuário, sem inventar aprovação histórica.
3. **Evidência externa:** confirmação de cópia/descriptografia do novo formato deve continuar pendente até demonstração pelo responsável; bloqueia ACCEPTED conforme tabela atual, não builds/configuração independentes.
4. **Ponytail:** revisão independente sobre diff final e runtime real; mudanças corretivas exigem delta review. Não marcar ACCEPTED só porque HTTPS responde.

Verificações finais adicionais: sem `-k`; apex/HTTP redirecionam sem contornar manutenção; produção responde 503 para API/admin/fake; nenhum banco ou novo upstream escuta em IP público; development preservado; env não aparece em evidências; token de uma implantação falha na outra; reinício preserva dados; healthcheck não depende de autenticação pública; marcador de persistência é sintético e removido; sem seed comercial; `make check-docs` e `git diff --check`.

Parecer: desenho geral adequado ao escopo e à VM; manter produção em manutenção é a decisão correta enquanto autenticação e simuladores permanecem. A implantação fica tecnicamente pronta após especificar e validar a barreira por cookie, sem alegar alta disponibilidade nem recuperação externa ainda não comprovada.

## Delta Counsel: variante Basic em rota exclusiva

O implementador propôs Basic apenas em `GET /__sandbox/login`, com emissão de cookie após Caddy autenticar essa rota. Variante aprovada conceitualmente e mais simples que formulário próprio: mantém Basic fora da validação de `/api`, onde Bearer continua soberano. Gateway somente loopback, cabeçalho interno de identidade removido/sobrescrito pelo Caddy e nenhum endpoint público de emissão direta. Caddy Basic não inclui limitador de tentativas por padrão; registrar estratégia ou justificativa explícita para omissão com senha de alta entropia nesta barreira de um único administrador. Cookie mantém atributos/expiração recomendados acima. GET/HEAD de páginas sem cookie pode redirecionar ao login; API e métodos mutantes devem responder 401; a spec deve registrar essa distinção. Emissão responde `Cache-Control: no-store`, volta apenas à raiz, não aceita query de retorno arbitrária. Logout não é requisito desta variante até ser especificado, mas rotação do segredo deve revogar o acesso. Esta variante supersede a recomendação de formulário, sem alterar os demais gates. Revisar implementação real e possíveis cabeçalhos de bypass no Ponytail.

## Delta final pré-READY — spec 0.1 revisada

Releitura independente da revisão recebida em 18/10/2026: **PASS para submissão ao READY humano**, sem blocker semântico remanescente identificado nesta revisão. Não representa READY humano nem autorização de aceite final.

A spec agora fecha o conflito Bearer/Basic por gateway que valida Basic diretamente somente no login, assina cookie e preserva Authorization no restante. Estão definidos atributos, duração, comportamento de cache Basic do navegador, revogação, limites de tentativa, IP confiável, fail closed e métodos/caminhos protegidos. Portanto não se exige adicionar formulário, logout ou outro mecanismo fora do escopo aprovado.

Também atendidos os deltas de capacidade (gateway com cap, PIDs e preflight), jobs limitados a expire_holds, inventário explícito de formatos legados de backup, PASS agregado dos três bancos, publicação do par completo e orçamento conservador de espaço. A spec distingue evidência local de confirmação externa obrigatória antes de ACCEPTED e preserva a exigência de revisão independente final.

Cuidados de implementação que não bloqueiam READY: respostas de limitação devem ser fail closed, preferencialmente 429; testes devem rejeitar `/api` e suas variantes normalizadas sem cookie; HEAD para a rota de login não pode emitir sessão indevidamente; gateway não deve confiar em header de cliente sem sobrescrita pelo Caddy. O teste de navegador deve demonstrar simultaneamente cookie de borda e Bearer de produto. O preflight conservador não substitui observação de OOM/disco nem prova estabilidade sob tráfego. Todo o parecer histórico acima permanece como rastreabilidade.
