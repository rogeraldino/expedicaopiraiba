# Evidência da implantação — 18/10/2026

Spec v0.1 READY por Rodrigo; validação local concluída e gate externo PASS (confirmado por Rodrigo em 18/10/2026).

- Aplicação base Git: fc0482621e34 (working tree incluída, não commit limpo).
- Snapshot aplicação SHA256: 70602e65ca371815c07393972edd29c1065b63c81db621f2fe525c3393761ad0.
- Artefato infraestrutura SHA256: b2ec1eeeee57a751057e733f5af1edc2f81ee0aaaddb1045ce6fd2d91b6f7252.
- Mapeamento exato de arquivos e fontes: /etc/piraiba/infra-release.json e release.json; segredos nesses diretórios privados não entram nesta evidência.

| Critério | Resultado / evidência |
|---|---|
| Builds/TypeScript | produção e sandbox PASS; reconstruídos após normalização de diretórios para0755 |
| Django/migrations | check e migrate --check PASS nos dois novos ambientes |
| HTTP/HTTPS/Auth/isolamento/limites | 70 checks integrados PASS em /root/infra/piraiba/evidence.json |
| Certificados | Let's Encrypt emitidos para apex/www/sb; clientes verificam TLS sem -k |
| Gateway unit/integration | 6 testes PASS |
| Backup falha/atomicidade/dispatcher | 4 testes PASS |
| Reinício/persistência | PASS nos dois ambientes; marcadores sintéticos removidos; persistence-evidence.json |
| Fail-closed | Gateway parado → sandbox API502, sem acesso upstream; gateway restaurado saudável |
| Revisão independente |26 checks HTTP reais PASS; ponytail-http-evidence.json e ponytail.md |
| Backups | v2 gerado/restaurado localmente para development/production/sandbox; cópia externa ampliada PASS (confirmada pelo responsável no WSL/Windows via baixar-backup.py em 18/10/2026) |
| Desenvolvimento preservado | API200; volume antigo intacto; nenhum dado comercial copiado |
| Documentação | make check-docs11 owners PASS; git diff --check PASS |

## Limitações explícitas

- Produção503 manutenção. Sandbox exige senha de borda mais autenticação do produto.
- Nenhuma API real de mensagens/pagamentos habilitada nos novos ambientes.
- Auditoria npm:9high/1critical, incluindo runtime Next.js e sharp; correção/triagem antes de abrir produção ou ampliar acesso ao sandbox. Não resolvidas nesta entrega.
- Uma VM, sem alta disponibilidade ou teste de carga comercial. Capacidade inicial com aproximadamente6GiB disponíveis observados após subida, sem OOM.
- Primeiro backup ampliado tem cerca de900MB. Sem retenção automática nem alerta remoto nesta fase. Cópia externa e descriptografia foram validadas pelo responsável no WSL/Windows em 18/10/2026.
- Gate externo cumprido e ACCEPTED humano concedido por Rodrigo em 18/10/2026.
