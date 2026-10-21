# Cerimônias de Release e Gestão de Ambientes (Sandbox & Produção)

**Versão:** 1.0 — 21/10/2026  
**Público-alvo:** Agentes Autônomos, Engenheiros e Administradores da Expedição Piraíba  
**Autoridade:** SDD Constitution § 3, 4, 8, 14 e Pareceres Ponytail  

---

## 1. Visão Geral da Arquitetura de Ambientes

A infraestrutura na VPS Hostinger (`187.77.56.156`) opera com **dois ambientes isolados por Docker Compose**, além do desenvolvimento legado:

| Ambiente | Domínio Público / HTTPS | Portas Loopback | Projeto Compose | Banco PostgreSQL 17 | Finalidade |
|---|---|---|---|---|---|
| **Sandbox** | `https://sb.expedicaopiraiba.com.br` | Front: `3002`<br>API: `8002`<br>Gateway: `8090` | `piraiba-sandbox` | `piraiba_sandbox` | Homologação contínua, testes de integração reais (Mercado Pago, e-mails, webhooks), validação visual protegida por senha de borda (`/__sandbox/login`). |
| **Produção** | `https://www.expedicaopiraiba.com.br` | Front: `3001`<br>API: `8001` | `piraiba-production` | `piraiba_production` | Tráfego comercial ao vivo, checkout de participantes, cobranças reais e painel de embarque oficial. |

Ambos os ambientes possuem redes Docker internas isoladas, volumes persistentes de dados e mídia (`/srv/piraiba/<ambiente>/media`), e arquivos de variáveis de ambiente com permissão restrita `0600` em `/etc/piraiba/`.

---

## 2. O Modelo de Branches (Trunk-Based com Produção Protegida)

Adotamos a estratégia **Trunk-Based com Branch de Produção Protegida (`main` + `production`)**:

```
[ Nova Feature / Correção / Teste ]
                 │
                 ▼
               main  ────────────────► Deploy no Sandbox (`sb.expedicaopiraiba.com.br`)
                 │                     (Testes automatizados + Validação visual + Homologação)
                 │
   [ Gate de Aceite: Ponytail PASS + Aceite Humano do Rodrigo ]
                 │
                 ▼ (Fast-Forward Merge + Git Tag)
            production ──────────────► Deploy em Produção (`www.expedicaopiraiba.com.br`)
```

### Regras Estritas das Branches:

1. **Branch `main` (Sandbox)**:
   * É o tronco principal de desenvolvimento e integração contínua.
   * Todos os commits e PRs são integrados aqui.
   * A cada atualização aprovada, o código é publicado no **Sandbox**.
   * O banco de dados do Sandbox recebe as novas migrações primeiro.
   * Nenhuma cobrança real de clientes ou alteração comercial ao vivo ocorre na `main`.

2. **Branch `production` (Produção Oficial)**:
   * **PROIBIDO commits diretos.** A branch `production` nunca deve receber um `git commit` feito manualmente nela.
   * Só recebe código vindo de `main` através de **Fast-Forward Merge** (`git merge main --ff-only`).
   * Toda promoção para `production` deve obrigatoriamente receber uma Git Tag semântica anotada (ex.: `v0.2.0`, `v1.0.0`).
   * O código de `production` é o espelho exato do container em execução em `www.expedicaopiraiba.com.br`.

---

## 3. As 4 Cerimônias de Promoção para Produção

Nenhum agente ou engenheiro pode publicar em produção sem cumprir os 4 passos obrigatórios:

### Passo 1: Gate de Qualidade no Sandbox (Pré-Requisitos Técnicos)
Antes de qualquer promoção, o Sandbox deve estar verde:
1. **Suíte de Testes Automatizados:** 100% dos testes Django passando no PostgreSQL 17 real (`python manage.py test`).
2. **Build do Frontend:** Compilação Turbopack standalone concluída com 0 erros de TypeScript (`next typegen && tsc --noEmit`).
3. **Migrações:** `python manage.py makemigrations --check --dry-run` retornando `No changes detected`.
4. **Ponytail Independente:** Parecer **PASS** registrado formalmente na spec ativa.

### Passo 2: Aceite Humano Formal
Conforme a Constituição (§§ 3 e 14), somente o responsável pelo produto (**Rodrigo**) pode autorizar a abertura e promoção para produção. O aceite deve constar nos registros da conversa ou no dossiê de handoff.

### Passo 3: Mesclagem e Versionamento no Git
Com a autorização concedida:
```bash
git checkout production
git pull origin production
git merge main --ff-only
git tag -a v0.2.0 -m "Release v0.2.0: Estágios 1 e 2 aprovados (Mídia persistente, Mercado Pago, Resend, WhatsApp)"
git push origin production --tags
git checkout main
```

### Passo 4: Execução do Deploy na VM
Na VM, executar o script oficial de promoção idempotente:
```bash
bash /root/expedicaopiraiba/deploy/scripts/promote-to-prod.sh
```
O script executa automaticamente:
1. Pré-checagem de disco (mínimo 8 GB) e memória (mínimo 2 GB).
2. Backup consistente dos bancos com validação de restore local (`create-backup.py`).
3. Criação de snapshot imutável em `/srv/piraiba/production/releases/<release-tag>`.
4. Build das imagens Docker de produção com tags imutáveis.
5. Execução segura das migrações pendentes no banco `piraiba_production`.
6. Reinicialização graciosa dos containers de produção com healthcheck ativo.
7. Verificação de status HTTP (200 OK no endpoint de saúde).

---

## 4. Política de Rollback Emergencial (< 1 Minuto)

Se após a promoção ocorrer qualquer falha grave ou indisponibilidade:

1. **Rollback de Aplicação (Instantâneo):**
   Para reverter a aplicação para a release estável anterior sem tocar no banco de dados:
   ```bash
   bash /root/expedicaopiraiba/deploy/scripts/rollback-prod.sh
   ```
   * O script atualiza o `/etc/piraiba/production.env` para a tag de imagem anterior e recria os containers imediatamente.
2. **Rollback de Banco de Dados:**
   * NUNCA faça restore de banco sem autorização expressa, pois isso pode apagar transações financeiras reais criadas no intervalo.
   * As migrações devem ser sempre **aditivas e retrocompatíveis** (novas colunas devem aceitar `null=True` ou `default`, novos modelos não devem quebrar o código anterior).

---

## 5. Gestão de Segredos e Credenciais

* **Regra Fundamental:** Nunca inclua credenciais, chaves de API, senhas ou tokens no Git (`.env`, código fonte ou markdown).
* Arquivos de credenciais vivem exclusivamente em `/etc/piraiba/`:
  * `/etc/piraiba/production.env` (chmod 0600)
  * `/etc/piraiba/sandbox.env` (chmod 0600)
* Resend SMTP: `smtp.resend.com:587`, usuário `resend`, senha em variável de ambiente.
* Mercado Pago: credenciais de produção começam com `APP_USR-`, credenciais de teste com `TEST-`.

---

## 6. Checklist de Handoff para o Próximo Agente

Ao assumir o projeto:
1. Execute `git status` e verifique em qual branch você está.
2. Não altere arquivos em produção diretamente.
3. Todo trabalho novo começa na branch `main`.
4. Atualize sempre os arquivos [`HANDOFF.md`](../HANDOFF.md) e [`specs/active/`](../specs/active/) ao concluir tarefas críticas.
