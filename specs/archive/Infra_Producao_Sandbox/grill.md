# Grill independente — Infra_Producao_Sandbox

Data: 2026-10-18. Revisor: agente independente infra_grill. Objeto: spec v0.1 DRAFT. Resultado: **CHANGES REQUIRED antes de READY**. Nenhum runtime alterado.

## G1 — BLOCKER: Basic Auth e Bearer disputam Authorization

A spec deixa escolha de mecanismo em aberto após registrar HTTP Basic obrigatório. O conflito existe: frontend/src/app/admin/admin-panel.tsx, customer-journey.tsx e minha-reserva/page.tsx enviam Authorization: Bearer; backend exige o mesmo cabeçalho. Não é possível enviar Basic e Bearer independentes no mesmo cabeçalho padrão. A cláusula “se houver conflito” já está acionada e duas implementações teriam semânticas distintas.

Resolução concreta proposta: autenticação de borda por cookie independente, com página de entrada exclusiva do sandbox. Definir antes de READY: caminho reservado, POST com senha sem URL/logs, comparação de hash, cookie host-only Secure HttpOnly SameSite=Lax Path=/ e validade absoluta de 12h, sessão inválida/ausente retorna 401 inclusive API, logout revoga cookie; segredo de assinatura e senha fora do Git. Authorization passa intacto ao app. Alternativa sem novo serviço de autenticação: acesso somente por túnel SSH, mas muda decisão pública do sandbox e exige revisão de escopo. Não escolher automaticamente após READY. Evitar cookie Domain=.expedicaopiraiba.com.br.

## G2 — BLOCKER: prontidão e critério de aceite de backup externo

A spec exige evidência Windows do novo formato e diz que ausência fica pendente, porém inclui Externo entre critérios obrigatórios. Pela Constituição, não pode encerrar ACCEPTED com isso pendente. Definir gate: implementação e validação local podem terminar; estado fica VALIDATED parcial/PENDING até Rodrigo baixar e descriptografar o novo arquivo. Não pedir aprovação final sem distinguir esse gate.

Compatibilidade observada: cliente exige prefixo piraiba-development-, manifest.json na raiz e database_restore_check=PASS; chave forçada aceita regex do mesmo prefixo. Preservar esses três contratos e só emitir PASS agregado quando TODOS os dumps/restauros passarem. Acrescentar environments com resultado individual e versão de esquema, mantendo campos antigos. Metadados SSH também devem manter file, bytes e database_restore. Essa resolução evita atualização imediata do Windows.

## G3 — BLOCKER: tarefa de jobs com bancos vazios não possui intenção definida

A spec manda subir jobs após migrações/API pronta, mas não define se jobs de produção devem rodar durante manutenção e sem provedores. Isso pode acionar efeitos externos ou mutações ao passar a conter dados. Definir inventário dos comandos periódicos e autorizar apenas manutenção interna idempotente sem chamadas externas; se inventário não comprovar segurança, manter jobs desativados nesta fase e ajustar critérios. Não assumir que banco inicialmente vazio basta.

## G4 — MAJOR: lacunas de limites/pressão e do teste de persistência

Caps de memória somam aproximadamente 3,95 GiB, além do desenvolvimento, host, Caddy e builds. Especificar orçamento operacional, máximo um build por lock global e política de falha por pressão (abortar implantação sem desligar legado). Definir PIDs concretos ou faixa justificada; “onde compatível” precisa resultar em inventário das exceções a capacidades/usuário. Jobs podem ficar sem healthcheck, mas validar processo e execução explicitamente. Healthcheck de API só prova liveness se não consultar banco.

Resolução: estabelecer pids_limit inicial por serviço com evidência real, validar OOMKilled=false e margem medida antes/depois, bloquear build com memória/disco insuficientes. Teste de persistência deve usar entidade temporária sem identidade real e remoção explícita; critério de “bancos vazios” significa sem dados comerciais, não necessariamente sem Django migrations/admin.

## G5 — MAJOR: exposição exige teste externo, inclusive IPv6 e legado

127.0.0.1 dos novos serviços não garante que o desenvolvimento esteja privado; confirmar bindings reais IPv4 e IPv6 e ausência de published DB de todos os projetos. Listar portas que já estão expostas e não declarar proteção se legado continuar em 0.0.0.0/::.

Resolução: se necessário remapear legado exclusivamente para loopback sem apagar dados, com autorização explícita na spec para essa alteração operacional. Produção: rotas de manutenção catch-all antes de qualquer proxy, todos os métodos e caminhos, sem exclusão implícita /api ou /admin; somente ACME e redirecionamentos necessários. Testar públicos HTTPS/apex/HTTP, Host alternativo, /api/payments/fake/... e /admin, sem permitir conteúdo upstream. Não testar apenas GET /.

## G6 — MAJOR: espaço, publicação atômica e recuperação de backup

“Temporários estimados” não define cálculo. O processo atual materializa dump + tar.gz + age e restaura outra base dentro do volume PostgreSQL. Verificar espaço dos dois filesystems (arquivo e volume DB), estimando pico de restauração, não só /var/backups. Final .age pode aparecer antes do checksum: exigir marcador/metadados apenas após ambos completos e listagem/leitura restrita a conjuntos finalizados. Lock exclusivo cobre criação inteira; concorrência deve falhar com mensagem limpa sem JSON parcial.

Resolução: preflight conservador documentado baseado em tamanho dos bancos, snapshots e margem; nenhuma exclusão automática. Testar falha de um dos três dumps e garantir nenhum PASS agregado nem arquivo final publicável. Runbook de restauração precisa paths e mapeamento de ambiente, código/snapshot e segredo, sem copiar configurações de produção sobre sandbox por padrão.

## Limites e decisões já adequadas

Produção em manutenção até autorização posterior; ausência de credenciais reais nos novos ambientes; não copiar dados comerciais; preservar desenvolvimento e volumes; PostgreSQL 17 e restauração real; sem webhook público prematuro; aceite humano e Ponytail independentes. Manter esses limites.

## Critérios para nova revisão

G1–G3 resolvidos normativamente; G4–G6 incorporados em requisitos/testes inequívocos. Registrar versão revisada e decisão humana READY com data. Este Grill não é READY nem aceite de implementação.

## Delta review independente — 2026-10-18

Objeto: v0.1 DRAFT revisada após os findings acima, incluindo seções Gate externo e aceite e Resolução de revisão inicial.

Resultado: **PASS para Grill pré-READY; nenhum blocker concreto remanescente identificado neste delta.**

- G1 resolvido: cookie host-only independente de Authorization; Basic limitado ao login; rotas, expiração, limitação de tentativas, cache Basic, revogação por rotação, fail closed e ausência de logout explícitos. Escolha não altera identidade do produto. Validar de verdade o encadeamento forward_auth, preservação de Bearer e códigos públicos no gate de runtime.
- G2 resolvido: confirmação de cópia/descriptografia multiambiente no Windows bloqueia ACCEPTED, mesmo com validação local concluída.
- G3 resolvido: único job permitido é expire_holds, com periodicidade e efeitos internos definidos; não há autorização genérica para provedores.
- G4 resolvido: PIDs, lock de build, preflight, exceções de capacidades e observação de OOM definidos. Os limites devem ser provados no runtime, não apenas em YAML.
- G5 resolvido: verificação IPv4/IPv6 e remapeamento seguro do legado autorizados; cobertura de métodos/caminhos de manutenção explicitada.
- G6 resolvido: contratos legados, PASS agregado, espaço de bancos/temporários, lock e barreira de publicação de pares completos definidos.

Este PASS não é declaração humana READY, não prova implementação e não dispensa Ponytail, evidências reais ou aceite humano. Nenhum runtime alterado pelo revisor.
