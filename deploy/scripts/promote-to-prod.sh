#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Expedição Piraíba — Promoção Automatizada para Produção
# ==============================================================================

echo "==> [1/7] Pré-checagem de Recursos e Ambiente..."
awk '/MemAvailable:/ {exit !($2 >= 1572864)}' /proc/meminfo || { echo "ERRO: Memória RAM disponível menor que 1.5GB." >&2; exit 1; }
[[ $(df --output=avail -B1 / | tail -1) -ge 5368709120 ]] || { echo "ERRO: Espaço em disco menor que 5GB." >&2; exit 1; }

REPO="/root/expedicaopiraiba"
PROD_ENV="/etc/piraiba/production.env"
COMPOSE_FILE="/root/infra/piraiba/compose.yaml"

if [ ! -f "$PROD_ENV" ]; then
    echo "ERRO: Arquivo $PROD_ENV não encontrado!" >&2
    exit 1
fi

# Ensure production media directory exists
mkdir -p /srv/piraiba/production/media
chown -R 1000:1000 /srv/piraiba/production/media

echo "==> [2/7] Gerando Identificador Imutável de Release..."
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
COMMIT_SHA=$(git -C "$REPO" rev-parse HEAD | cut -c1-12)
RELEASE="${STAMP}-${COMMIT_SHA}"
ARTIFACT_DIR="/srv/piraiba/artifacts"
mkdir -p "$ARTIFACT_DIR"
ARTIFACT="${ARTIFACT_DIR}/${RELEASE}.tar.gz"

echo "Release ID: $RELEASE"

echo "==> [3/7] Empacotando Snapshot do Código via Git Archive..."
git -C "$REPO" archive --format=tar.gz -o "$ARTIFACT" HEAD
CHECKSUM=$(sha256sum "$ARTIFACT" | cut -d' ' -f1)

TARGET_DIR="/srv/piraiba/production/releases/${RELEASE}"
mkdir -p "$TARGET_DIR"
tar -xzf "$ARTIFACT" -C "$TARGET_DIR"
find "$TARGET_DIR" -type d -exec chmod 755 {} +
find "$TARGET_DIR" -type f -exec chmod 644 {} +

echo "==> [4/7] Compilando Imagens Docker de Produção..."
docker build \
    --label "piraiba.snapshot=$CHECKSUM" \
    --label "piraiba.release=$RELEASE" \
    -t "piraiba-backend:$RELEASE" \
    "$TARGET_DIR/backend"

docker build \
    --label "piraiba.snapshot=$CHECKSUM" \
    --label "piraiba.release=$RELEASE" \
    --build-arg NEXT_PUBLIC_ENABLE_DEV_TOOLS="false" \
    --build-arg NEXT_PUBLIC_API_URL="/api" \
    --build-arg API_URL="http://backend:8000/api" \
    -t "piraiba-frontend-production:$RELEASE" \
    "$TARGET_DIR/frontend"

echo "==> [5/7] Atualizando Variáveis de Ambiente em $PROD_ENV..."
sed -i "s|^RELEASE=.*|RELEASE=$RELEASE|" "$PROD_ENV"
sed -i "s|^SNAPSHOT_SHA256=.*|SNAPSHOT_SHA256=$CHECKSUM|" "$PROD_ENV"
sed -i "s|^SOURCE_DIR=.*|SOURCE_DIR=$TARGET_DIR|" "$PROD_ENV"
sed -i "s|^BACKEND_IMAGE=.*|BACKEND_IMAGE=piraiba-backend:$RELEASE|" "$PROD_ENV"
sed -i "s|^FRONTEND_IMAGE=.*|FRONTEND_IMAGE=piraiba-frontend-production:$RELEASE|" "$PROD_ENV"

# Ensure MEDIA_HOST_DIR is set
if ! grep -q "^MEDIA_HOST_DIR=" "$PROD_ENV"; then
    echo "MEDIA_HOST_DIR=/srv/piraiba/production/media" >> "$PROD_ENV"
fi

echo "==> [6/7] Reiniciando Containers de Produção e Aplicando Migrações..."
docker compose -p piraiba-production --env-file "$PROD_ENV" -f "$COMPOSE_FILE" up -d --remove-orphans

echo "==> [7/7] Aguardando Inicialização e Saúde dos Serviços..."
for i in {1..30}; do
    if docker compose -p piraiba-production --env-file "$PROD_ENV" -f "$COMPOSE_FILE" ps | grep -q "(healthy)"; then
        echo "Containers de produção estão saudáveis!"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "=========================================================================="
echo "PROMOÇÃO PARA PRODUÇÃO CONCLUÍDA COM SUCESSO!"
echo "Release ativa: $RELEASE"
echo "URL Oficial: https://www.expedicaopiraiba.com.br"
echo "=========================================================================="
