# Ambientes na VM Hostinger

Infraestrutura compartilhada em `/root/infra/piraiba`. Segredos root-only em
`/etc/piraiba`; nunca adicionar esses arquivos ao Git. Há um administrador da
VM. O acesso root/YOLO permanece global; Compose não restringe o agente.

| Ambiente | Projeto Compose | Frontend/API loopback | Dados |
|---|---|---|---|
| Desenvolvimento legado | expedicaopiraiba | 3000 / 8000 | volume anterior preservado |
| Produção | piraiba-production | 3001 / 8001 | PostgreSQL e volume exclusivos |
| Sandbox | piraiba-sandbox | 3002 / 8002 | PostgreSQL e volume exclusivos |
| Acesso sandbox | piraiba-access | gateway 8090 | sem banco; cookie HMAC |

`www.expedicaopiraiba.com.br` responde manutenção 503 para todos os caminhos e
métodos. O domínio sem www redireciona ao www. HTTPS é gerido pelo Caddy.
Não remover manutenção antes da entrega de autenticação e provedores aprovada.

`sb.expedicaopiraiba.com.br` exige a senha de borda e depois a autenticação
normal da aplicação. Login da borda em `/__sandbox/login`: navegador solicita
HTTP Basic, gateway emite cookie host-only Secure/HttpOnly/Strict por 12h.
`Authorization: Bearer` da aplicação permanece independente. Senha de acesso
em `/etc/piraiba/sandbox-access.json`; credencial administrativa da aplicação
em `/etc/piraiba/sandbox.env`. Valores nunca entram em logs/evidências.
Navegadores podem guardar Basic e renovar acesso automaticamente; não há
logout individual nesta fase. Revogar todos: gerar nova senha/hash e segredo
do gateway, recriar seu serviço e entregar nova senha ao responsável.
Não alterar env manualmente sem preservar formato scrypt entre aspas simples.

Nenhuma exceção pública de webhook foi ativada. Gmail/Meta/Mercado Pago reais
não estão configurados nos novos ambientes. Os simuladores existem somente
dentro da aplicação protegida. Bases novas não recebem seed comercial ou
dados pessoais do desenvolvimento.

## Operação

```bash
docker compose -p piraiba-production --env-file /etc/piraiba/production.env -f /root/infra/piraiba/compose.yaml ps
docker compose -p piraiba-sandbox --env-file /etc/piraiba/sandbox.env -f /root/infra/piraiba/compose.yaml ps
docker compose -p piraiba-access --env-file /etc/piraiba/access-compose.env -f /root/infra/piraiba/access.compose.yaml ps
python3 /root/infra/piraiba/verify.py
```

Não executar `compose config` sem sanitização em logs compartilhados: ele
expande segredos. Não usar `down -v`, `prune` ou trocar `.env` entre ambientes.
Docker DB não publica portas. As redes de dados são internas; frontend só
alcança sua API pela rede própria. Restart unless-stopped e rotação 3x10MB.

Backups: `/etc/vm-backup/environments.json` lista os três ambientes. Comando
privado `python3 /root/infra/backups/create-backup.py`; comando SSH restrito
do cliente continua `backup-create`. Nome legado `piraiba-development-*`
permanece por compatibilidade; manifesto v2 enumera a cobertura real.
Cada dump é restaurado em base temporária antes do PASS agregado. Nenhuma
exclusão automática. Confirmar a primeira cópia externa ampliada no WSL;
geração na VM não prova cópia externa. Ver `/root/infra/backups/README.md`.

## Snapshots e reversão

`/etc/piraiba/release.json` registra SHA Git base, dirty flag, hash do arquivo
e fontes implantadas em `/srv/piraiba/<ambiente>/releases/<release>`.
Este primeiro snapshot inclui alterações locais e não é anunciado como
commit limpo. Diretórios de código normalizados para 0755 para o usuário
sem privilégios do contêiner; diretórios externos do host permanecem privados.
As imagens reais são registradas por ID no relatório da implantação.

Antes da troca, guardar cópia datada de `/etc/caddy/Caddyfile`. Validar com
`caddy validate --config ...` antes de reload. Falha de gateway deve bloquear
o sandbox. Se necessário, restaurar configuração anterior e parar SOMENTE os
projetos novos sem remover volumes; a instância anterior continua intacta.

CI/CD completo, retenção automatizada, alertas externos e homologação de
pagamentos/mensagens pertencem às próximas entregas. Uma VM não oferece alta
disponibilidade. Os limites atuais são iniciais, sem prova de carga comercial.
