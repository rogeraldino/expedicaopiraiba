# Runbook de Deploy em Produção — Expedição Piraíba

Este guia detalha o passo a passo para colocar a **Expedição Piraíba** no ar na sua VPS com **HTTPS automático (SSL Let's Encrypt)** via **Caddy**, utilizando o domínio `alvor.lat` (ou subdomínio `piraiba.alvor.lat`).

---

## 🏗️ 1. Arquitetura na VPS

- **Caddy (Proxy Reverso):** Escuta as portas públicas `80` e `443`, gerencia certificados SSL automaticamente e roteia tráfego para os containers locais.
- **Frontend (Next.js 16):** Roda internamente em `127.0.0.1:3001`.
- **Backend (Django + Gunicorn):** Roda internamente em `127.0.0.1:8001`.
- **Banco de Dados (PostgreSQL 17):** Roda isolado na rede Docker interna `piraiba_net` sem expor portas públicas.
- **Worker (Jobs):** Processa expiração de holds a cada 60 segundos.

---

## 🌐 2. Configuração de DNS (No Cloudflare / Registro de Domínio)

Crie um registro **Tipo A** apontando para o IP da sua VPS:

| Tipo | Nome / Host | Conteúdo / IP | Proxy Status |
|---|---|---|---|
| **A** | `piraiba` (ou `@`) | `IP_DA_SUA_VPS` | DNS Only (ou Proxied) |

---

## 🚀 3. Passo a Passo de Execução na VPS

### Passo 1: Clonar ou Enviar os Arquivos para a VPS
Na VPS, crie a pasta do projeto (ex: `/home/ubuntu/expedicaopiraiba` ou `/root/expedicaopiraiba`):
```bash
cd /home/ubuntu/expedicaopiraiba
```

### Passo 2: Criar o arquivo `.env` de Produção
Copie o template e preencha as senhas seguras:
```bash
cp .env.production.example .env
chmod 600 .env
nano .env
```

> **Dica para gerar senhas fortes:**
> ```bash
> openssl rand -hex 24
> ```

### Passo 3: Subir os Containers em Produção
```bash
# Constrói e inicializa os containers com o arquivo de produção
docker compose -f compose.production.yaml up -d --build
```

### Passo 4: Popular o Banco de Dados com os Dados Oficiais
```bash
# Roda as migrações e cadastra as 4 expedições reais de 2026
docker compose -f compose.production.yaml exec backend python manage.py migrate
docker compose -f compose.production.yaml exec backend python manage.py seed_demo
```

### Passo 5: Configurar o Caddy na VPS
Abra o Caddyfile da VPS (geralmente em `/etc/caddy/Caddyfile`):
```bash
sudo nano /etc/caddy/Caddyfile
```

Adicione o bloco da Expedição Piraíba:
```caddy
piraiba.alvor.lat {
	encode zstd gzip

	@backend path /api/* /admin-django/* /static/*
	reverse_proxy @backend 127.0.0.1:8001 {
		header_up X-Forwarded-Proto https
		header_up Host {host}
	}

	reverse_proxy 127.0.0.1:3001
}
```

Recarregue o Caddy:
```bash
sudo systemctl reload caddy
# ou: sudo caddy reload --config /etc/caddy/Caddyfile
```

---

## ✅ 4. Verificação & Smoke Test

Abra no navegador ou via curl:
- **API Health:** `curl -fsS https://piraiba.alvor.lat/api/health/` ➔ `{"status": "ok"}`
- **Site:** Acesse `https://piraiba.alvor.lat` no seu navegador e valide o cadeado HTTPS 🔒.
- **Painel Admin:** Acesse `https://piraiba.alvor.lat/admin` e faça login com as credenciais configuradas em `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

---

## 🔄 5. Atualizações Futuras
Para atualizar o código na VPS:
```bash
git pull
docker compose -f compose.production.yaml up -d --build
```
