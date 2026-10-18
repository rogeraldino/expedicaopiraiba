# Infraestrutura Piraíba: produção e sandbox

Versão: 0.1 — 18/10/2026. Risco HIGH. Status ACCEPTED — 18/10/2026.

## Resultado e autorização

Selecionado por Rodrigo: fechar separação de ambientes, HTTPS, proteção do sandbox, recursos e inclusão em backups. Um administrador e uma VM, sem novos usuários por projeto. Não desenvolver integrações nem mudar políticas comerciais nesta entrega. Aplicação atual ainda é desenvolvimento e deve ser preservada.

Owners: docs/sdd/CONSTITUTION.md (governança); produto e autenticação conforme docs/sdd/NORMATIVE_INDEX.json; esta spec governa apenas implantação, rotas de borda e proteção dos ambientes. Não supersede estados de reserva, políticas de pagamentos ou identidade.

## Escopo

- Caddy compartilhado para domínio principal, www e sb. Certificados públicos válidos com renovação pelo serviço. HTTP redireciona a HTTPS. Domínio sem www redireciona ao www.
- Compose independente para piraiba-production e piraiba-sandbox. Sem container_name, volumes ou redes com nomes compartilhados entre ambientes.
- Código de cada implantação em snapshot independente, sem bind mount do diretório de desenvolvimento. Registrar SHA, alterações locais incluídas e hash de artefato. Não declarar um snapshot sujo como um commit imutável. Imagens versionadas localmente; construção serializada. Pipeline CI/CD completo é próxima entrega.
- PostgreSQL 17 por ambiente; bancos inicialmente vazios após migrations. Não copiar clientes, reservas, dados financeiros nem segredos de desenvolvimento. Não executar seed_demo nem carga comercial sem seleção posterior. Instância antiga continua privada nas portas 3000/8000 e seu volume não será apagado.
- Novos upstreams ligados somente a 127.0.0.1: produção frontend 3001/API 8001; sandbox frontend 3002/API 8002. Banco sem porta publicada.
- DEBUG=false; SECRET_KEY, senha do banco, credencial administrativa e segredo de simulador independentes por ambiente, gerados e armazenados em arquivo root 0600 fora do Git. Nenhuma credencial real de Gmail/Meta/Mercado Pago será instalada nesses ambientes nesta entrega. Sessões de aplicação não são transferíveis entre eles.
- Produção pública continua em manutenção 503, incluindo /api e /admin, até entrega futura autorizada. Upstreams privados podem ser verificados por loopback. HTTPS e redirecionamentos funcionam durante manutenção. Não expor dev_code, confirmação fake ou checkout público.
- Sandbox inteiro protegido por gateway local de sessão, separado dos containers da aplicação. Rota exclusiva /__sandbox/login aceita GET com HTTP Basic (usuário rodrigo, senha aleatória, hash scrypt ou equivalente em arquivo privado) e emite cookie __Host-piraiba_sandbox host-only, Secure, HttpOnly, SameSite=Strict, Path=/, validade absoluta de 12h, assinado HMAC-SHA256 com segredo independente. Cookie não usa Domain e não é aceito na produção. Falhas de login sem diferença entre usuário inexistente e senha incorreta; tamanho de headers limitado e autenticação com limitação de tentativas em memória (5 falhas/minuto por IP confiável e 60/minuto globais). Sem registrar Authorization, cookie ou query. Gateway só escuta loopback, reinício automático e limite de 128 MiB/0,15 CPU/64 processos.
- Caddy encaminha somente /__sandbox/login ao gateway; nos demais caminhos, forward_auth chama /check no gateway e preserva o Authorization original da aplicação. IP do cliente enviado pelo Caddy substitui qualquer header fornecido pelo visitante. Requisições sem cookie válido: páginas GET/HEAD fora de /api redirecionam para a rota fixa de login; /api, /api/* e métodos mutantes retornam 401 sem tocar nos upstreams. Cookie adulterado/expirado rejeitado. Login bem-sucedido redireciona apenas à raiz do sandbox, sem parâmetro de retorno. Demais paths internos do gateway nunca são públicos. Falha do gateway bloqueia acesso (fail closed). Rotacionar o segredo revoga todas as sessões; reiniciar preserva sessões quando o segredo é o mesmo. Não há rota de logout nesta entrega. Após 12h é necessário autenticar novamente; navegadores podem reenviar Basic armazenado e obter novo cookie automaticamente. Para encerrar acesso no computador, fechar o perfil/navegador ou apagar credenciais de autenticação; para revogar efetivamente, rotacionar senha e segredo. Respostas do gateway têm Cache-Control: no-store e não encaminham Basic ao produto. Senha não é copiada para imagens, logs ou documentação; acesso entregue ao responsável por arquivo privado via SSH.
- Sandbox envia X-Robots-Tag noindex, nofollow, noarchive. Sem exclusões públicas para webhook nesta fase: endpoint não existe e a integração fica para etapa seguinte, com assinatura e rotas exatas revisadas.
- Jobs de ambos os ambientes só executam o comando expire_holds a cada 60s: expiração idempotente de holds e auditoria local, sem envio ou chamadas externas. Permitido durante manutenção; qualquer novo job exige autorização posterior.
- Reinício automático unless-stopped para novos serviços. Healthchecks para PostgreSQL e API; jobs só inicia após migrações/API pronta. Frontend pronto após chamada HTTP de verificação.
- Limites iniciais por ambiente (hard caps): produção DB 768 MiB, API 768 MiB, frontend 768 MiB, jobs 192 MiB; sandbox DB 384 MiB, API 512 MiB, frontend 512 MiB, jobs 128 MiB. CPU máxima por serviço: produção DB/API/frontend 0,75 cada, jobs 0,15; sandbox DB/API/frontend 0,4 cada, jobs 0,1. Caps de CPU não são reservas exclusivas; validar soma de pressão real. Reservar margem para host e instância antiga, sem construir dois frontends em paralelo. Ajustes somente com evidência de uso/erro e documentação.
- PIDs iniciais: PostgreSQL 128, API 128, frontend 128, jobs 64. Drop de capacidades e no-new-privileges para API/frontend/jobs; inventariar exceções exigidas pelo entrypoint PostgreSQL, sem privilegiado ou socket Docker. Preflight build: pelo menos 2 GiB disponíveis e 8 GiB de disco, lock único para builds; abortar sem desligar legado se insuficiente. Confirmar OOMKilled=false e margem operacional de memória observada após subida.
- Logs json-file com max-size 10m, max-file 3 por novo serviço. Limitar processos e remover privilégios/capacidades onde compatível, sem socket Docker ou montagem de diretórios de outro ambiente em containers.

## Backups e recuperação

- Evoluir formato do backup existente de forma compatível com cliente instalado no WSL e chave SSH restrita. Conservar prefixo/manifesto legado exigidos pelo cliente ou entregar atualização coordenada antes da troca. Nome de arquivo legado não representa cobertura; manifesto lista todos os ambientes.
- Incluir dump consistente separado dos três bancos (desenvolvimento, sandbox, produção), snapshots/código, configurações de infraestrutura, env privados e configuração Caddy necessários à recuperação. Excluir autenticação do Codex, chaves privadas SSH e imagens reconstruíveis. Chave pública age já recebida; privada somente no computador do responsável.
- Verificar cada dump por restauração em base temporária do respectivo serviço; remover apenas base temporária criada pelo teste. Teste não deve modificar banco da aplicação. Dumps por banco são consistentes individualmente; não prometer snapshot atômico entre ambientes.
- Criptografar antes de permitir leitura pela chave de backup. Downloads somente de arquivos completos e checksums; nenhuma leitura de env ou scripts por essa chave. Preservar backup externo validado anterior.
- Windows/WSL diário às 20h e login conforme confirmação do usuário. Não podemos comprovar execução Windows daqui: primeira cópia do novo formato e descriptografia devem ser evidenciadas pelo usuário. Não declarar cobertura externa nova enquanto pendente.
- Novo backup mantém prefixo legado piraiba-development-, manifesto raiz database_restore_check=PASS, metadados file/bytes/database_restore. Adiciona schema_version e environments com cobertura e restauração individual; PASS agregado só após os três testes. Lock exclusivo cobre toda criação; concorrência retorna falha limpa. Ler arquivo via chave restrita só se o par age/checksum estiver completo; publicar ambos via renomeação de diretório de geração ou marcador final validado pelo dispatcher antes de retornar metadados.
- Pré-cálculo de espaço no filesystem dos backups e de cada volume DB: tamanho pg_database_size somado para dumps/restaurações, tamanho dos snapshots/arquivos e margem conservadora de 3 GiB; exigir no filesystem compartilhado pelo menos 3 vezes o total dos bancos mais 3 vezes arquivos selecionados mais 3 GiB, antes de iniciar. Reavaliar se fontes crescerem durante operação.
- Sem exclusão automática nesta fase; verificar espaço antes de criar backup e antes do download. Recusar nova geração se < 3 GiB livres na VM ou se temporários estimados não couberem; não apagar cópias para liberar espaço. Retenção/alertas externos são próximos itens.
- Restaurar isoladamente com PostgreSQL 17, segredos recuperados e imagens reconstruídas. Não restaurar dados sobre produção ativa automaticamente.

## Falha e reversão

- Backup antes da alteração. Se build, migrations, prontidão ou HTTPS falharem, não promover proxy para app e conservar desenvolvimento intacto. Arquivos de proxy/config existentes têm cópia anterior.
- Caddy validate antes de reload; reload somente com upstreams verificados. Certificado com falha não equivale a HTTPS pronto; não ignorar validação TLS nos critérios de aceite.
- Reverter Caddy e parar apenas novos projetos se necessário; não usar down -v, docker prune ou apagar volumes. Migrações ocorrem somente em bancos novos, logo não alteram o banco legado.
- Confirmar bindings reais do legado e dos novos ambientes em IPv4/IPv6; não há exposição de banco. Caso legado deixe de estar em loopback, remapear apenas binding preservando volume e dados.
- Não mudar SSH, contas, firewall externo ou o padrão YOLO nesta entrega. Isolamento de containers não limita o agente root nem elimina ponto único de falha da VM.

## Critérios e evidência obrigatória

| Requisito | Evidência esperada |
|---|---|
| Isolamento | Compose config sanitizado; inspect de redes, mounts, env comparados sem revelar valores; marcadores de dados e tokens não cruzam ambientes |
| Persistência | Reiniciar serviços novos e confirmar marcador de teste permanece; remover marcador de teste ao final |
| HTTPS | curl sem -k nos três nomes; certificado válido; HTTP e apex redirecionam corretamente |
| Manutenção produção | /, /admin, /api/health e endpoints fake públicos não atingem app e retornam 503 |
| Proteção sandbox | redirecionamento de páginas e 401 de API sem sessão; 401 no login sem senha/em senha errada; 200 com cookie válido; cookie expirado/adulterado negado; login admin e API com token da aplicação funcionam sob a barreira |
| Saúde | Todos novos serviços saudáveis; migrations --check e Django check; rotas de site e API internas retornam sucesso |
| Recursos | Docker inspect comprova memória, CPU, pids, reinício e rotação de logs |
| Backup | Restauração dos três dumps PASS; manifesto enumera ambientes; checksum do arquivo criptografado; cliente antigo compatível ou atualização validada |
| Externo | Usuário confirma cópia/descriptografia do novo backup; caso pendente registrar sem afirmar proteção externa atualizada |
| Regressão | Desenvolvimento responde como antes; git diff --check e make check-docs passam |

Grill/Counsel independentes antes de READY humano (versão/data). Implementar depois de READY; Ponytail independente e gate real antes de ACCEPTED, conforme Constituição. Registrar evidências e HANDOFF; não arquivar enquanto houver critério obrigatório pendente.

## Gate externo e aceite

A evidência local permite status VALIDATED somente para os critérios locais. A cópia/descriptografia multiambiente no Windows é obrigatória antes de ACCEPTED; ausência fica PENDING e não é dispensada. Revisão e READY não significam aceite final.

## Resolução de revisão inicial

G1: cookie isolado com login Basic exclusivo e comportamento de expiração/cache explicitado. G2: gate externo bloqueia ACCEPTED. G3: inventário fechado de jobs expire_holds sem provedores. G4: caps/PIDs/preflight e observação de OOM. G5: testar IPv4/IPv6, todos caminhos/métodos na manutenção. G6: estimativa de pico de espaço e pares completos antes da leitura. Findings históricos permanecem nos pareceres.

## READY humano

Rodrigo declarou «Perfeito, execute» em 18/10/2026 após apresentação da v0.1 e Grill/Counsel PASS. READY v0.1 registrado nesta data; implementação autorizada.

## ACCEPTED humano

Rodrigo declarou «Executei o passo 1, enquanto isso feche o 2 e comece o 3» em 18/10/2026 após confirmação da execução e verificação do backup externo no WSL/Windows. Status ACCEPTED v0.1 registrado nesta data; dossiê arquivado em conformidade com a Constituição. Snapshot de aplicação: `70602e65ca371815c07393972edd29c1065b63c81db621f2fe525c3393761ad0`; artefato de infraestrutura: `b2ec1eeeee57a751057e733f5af1edc2f81ee0aaaddb1045ce6fd2d91b6f7252`.
