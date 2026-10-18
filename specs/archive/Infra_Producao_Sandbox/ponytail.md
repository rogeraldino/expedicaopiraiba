# Ponytail independente — infraestrutura produção/sandbox

Data: 2026-10-18. Revisor: infra_grill, independente da implementação. Referência normativa: spec v0.1. Revisão sobre árvore e runtime estáveis apresentados pelo implementador; SHA de encerramento deverá ser registrado no dossiê final.

## Resultado

**PASS técnico no escopo inspecionado; nenhum blocker de implementação encontrado. ACCEPTED permanece bloqueado pelo gate externo e pelo aceite humano sobre SHA final.** Isso não comprova alta disponibilidade nem isolamento do agente root.

## Evidência produzida pelo revisor

`/root/infra/piraiba/ponytail-http-evidence.json`: 26 verificações HTTP/HTTPS reais PASS, sem ignorar TLS e sem registrar segredos:

- Sem cookie: API normal e variantes codificadas (%61pi, %2f, dupla codificação), barras duplicadas e dot segments retornaram 401.
- Headers forjados X-Real-IP/X-Forwarded-Method/X-Forwarded-Uri/X-Sandbox-User não concederam acesso.
- /check e /health não expuseram o gateway; retornaram redirecionamento à entrada protegida.
- HEAD/OPTIONS/POST/PUT/DELETE na API sem sessão retornaram 401.
- Esses mesmos métodos em caminho codificado de produção retornaram manutenção 503.
- Login correto emitiu sessão; cookie permitiu acesso a frontend, admin e health API com 200.
- Cookie genuinamente assinado mas emitido há mais de 12 horas foi rejeitado com 401.

Primeira tentativa de login coincidiu com teste de indisponibilidade do gateway pelo implementador; não foi classificada como defeito. Reexecução após restabelecimento passou. Nenhum container foi parado pelo revisor.

Inspeção real `docker ps` e `ss -lnt`: desenvolvimento 3000/8000, produção 3001/8001, sandbox 3002/8002 e gateway 8090 publicados exclusivamente em 127.0.0.1. Nenhuma porta de banco publicada; nenhum binding IPv6 wildcard desses upstreams. Portas públicas do host continuam 22, 80 e 443; não se inferiu firewall externo.

Executados independentemente: 6 testes de gateway PASS; 4 testes de backup PASS. Estes últimos cobrem falha de dump/restore sem publicação/PASS, cleanup temporário, rejeição de leitura incompleta, traversal e comandos arbitrários.

## Código e evidência confrontados

Lidos compose.yaml, access.compose.yaml, gateway.py, Caddyfile, prepare.py (snapshot/preflight), build.sh, verify.py, backend/config/hosted.py e criador/dispatcher/testes de backup. Confrontados evidence.json, runtime-evidence.json, persistence-evidence.json e failclosed-evidence.json.

- Caddy não possui proxy de produção: manutenção catch-all evita exposição de caminhos fake/checkout. Apex redireciona ao www.
- Cookie host-only, assinado com host, 12h, Secure/HttpOnly/Strict; autenticação separada de Bearer. forward_auth preserva Authorization do produto e sobrescreve contexto confiável. Basic de borda não é repassado ao produto. Caminhos internos do gateway não têm proxy público direto.
- Runtime de indisponibilidade fornecido pelo implementador registrou 502 e acesso ao upstream BLOCKED: fail closed.
- Redes e volumes distintos por ambiente, API/frontend/jobs não-root e read-only, sem Docker socket; PostgreSQL possui somente capacidades explicitamente necessárias. Jobs limitados a expire_holds. Limites, PIDs, reinício e rotação registrados por inspect, sem OOM observado.
- Backup usa três dumps/restaurações separados, manifesto agregado compatível com cliente antigo, metadados de código/versão PostgreSQL, preflight para discos/volumes e lock exclusivo. Dispatcher exige checksum e marcador final; prefixo legado não representa cobertura. Arquivo externo anterior preservado.
- Segurança de credenciais revisada sem reproduzir valores; não há inclusão de credenciais reais dos provedores nos novos ambientes.

## Pendências para encerramento

1. **PENDING EXTERNAL:** responsável precisa baixar e descriptografar o backup multiambiente novo no Windows/WSL. Teste local e backup anterior não substituem essa prova.
2. Registrar SHA final imutável e hash dos artefatos de infraestrutura fora do Git, vinculando-os ao dossiê. Se código/runtime revisados mudarem, executar delta review proporcional antes de aceite.
3. ACCEPTED depende da declaração humana após as evidências obrigatórias, conforme Constituição. Este parecer não promove produção nem autoriza integrações futuras.

Nenhuma correção de implementação ou alteração de runtime realizada pelo revisor.

## Delta final — dependências e override durável (2026-10-18)

Auditoria adicional fornecida em `/root/infra/piraiba/dependency-audit.json`: npm reporta 10 ocorrências (1 crítica e 9 altas), incluindo Next no runtime (versão implantada informada 16.3.3; auditoria indica correção disponível em 16.4.2) e sharp com severidade alta; outras ocorrências se concentram na toolchain. O resumo não contém todos os detalhes dos advisories e não prova explorabilidade nem ausência de exploração. Nenhuma atualização de dependência foi realizada nesta entrega.

**Parecer:** não constitui novo bloqueio técnico da separação de infraestrutura atual, pois produção continua sem proxy para a aplicação (503) e o sandbox exige autenticação de borda em todos os caminhos antes do runtime Next. Essa redução de exposição não corrige as vulnerabilidades. Corrigir dependências e repetir auditoria, build e regressões é gate explícito antes de abrir produção pública; também antes de remover a barreira ou ampliar o acesso do sandbox. Risco residual permanece para conteúdo/processamento acessível ao administrador autenticado e para a toolchain durante builds. Não interpretar PASS desta infraestrutura como aceite de segurança das dependências do produto.

Registry de backup conferido: desenvolvimento agora referencia `/root/infra/piraiba/development.override.yaml`, com bindings loopback 8000/3000, arquivo durável incluído em infra no backup. Alteração elimina dependência operacional de /tmp sem alterar runtime ou isolamento. Sem novo blocker identificado. Artefato final e backup final devem incluir este delta e os hashes correspondentes; gate externo e aceite humano continuam pendentes.

## Congelamento de infraestrutura — verificação independente final

**PASS técnico final** para o artefato `/srv/piraiba/artifacts/infra-20261018T200223Z.tar.gz`, SHA256 `b2ec1eeeee57a751057e733f5af1edc2f81ee0aaaddb1045ce6fd2d91b6f7252`. Verificados independentemente o SHA256 integral do arquivo e todos os 25 hashes do manifesto `/etc/piraiba/infra-release.json`, tanto nos arquivos atuais quanto no conteúdo arquivado. Nenhum arquivo de infraestrutura ou runtime alterado nesta verificação.

O PASS está vinculado a esse artefato imutável; o SHA do repositório/dossiê será registrado pelo responsável no fechamento. **PENDING EXTERNAL** permanece obrigatório: cópia e descriptografia do backup multiambiente final no Windows/WSL. ACCEPTED requer essa evidência e declaração humana. Gate de atualização das dependências antes de exposição pública continua vigente.

## Adendo de encerramento — resolução de gate externo (2026-10-18)

Em 18/10/2026, Rodrigo confirmou a execução e validação de integridade/descriptografia do backup multiambiente ampliado através do script `baixar-backup.py` executado no WSL/Windows do responsável. Com isso, o requisito **PENDING EXTERNAL** foi integralmente satisfeito e o aceite humano **ACCEPTED** foi concedido formalmente por Rodrigo («Executei o passo 1, enquanto isso feche o 2 e comece o 3»).
