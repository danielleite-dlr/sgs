#!/usr/bin/env bash
# ─── SGS — deploy do staging ──────────────────────────────────────────────────
# Roda na VPS. Ciclo completo: atualiza código, reconstrói imagens, aplica
# migrations e sobe os serviços. Idempotente — pode rodar quantas vezes quiser.
#
#   ./scripts/deploy-staging.sh            # usa o código já presente
#   ./scripts/deploy-staging.sh --pull     # git pull antes de construir
#   SKIP_APK=1 ./scripts/deploy-staging.sh # não publica o APK Android no fim
#
# No fim publica o APK Android mais recente (scripts/publish-apk.sh). Falha
# nesse passo só gera aviso; o deploy segue.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.staging.yml --env-file .env.staging"
URL="https://sgs.jessicaseixasmakeup.com.br"

if [[ ! -f .env.staging ]]; then
  echo "ERRO: .env.staging não encontrado. Copie de .env.staging.example e preencha." >&2
  exit 1
fi

if [[ "${1:-}" == "--pull" ]]; then
  echo "▸ Atualizando código…"
  git pull --ff-only
fi

echo "▸ Construindo imagens…"
$COMPOSE --profile tools build

echo "▸ Subindo infraestrutura (postgres, valkey, meilisearch)…"
$COMPOSE up -d postgres pgbouncer valkey meilisearch

echo "▸ Aplicando migrations…"
$COMPOSE --profile tools run --rm migrate

echo "▸ Subindo backend e frontend…"
$COMPOSE up -d backend frontend

echo "▸ Aguardando o backend responder…"
for i in $(seq 1 30); do
  if curl -fsS -m 3 "http://127.0.0.1:${STG_BACKEND_PORT:-3010}/graphql" \
       -H 'content-type: application/json' \
       -d '{"query":"{__typename}"}' >/dev/null 2>&1; then
    echo "  backend OK"
    break
  fi
  [[ $i -eq 30 ]] && { echo "  backend não respondeu em 60s — veja: $COMPOSE logs backend" >&2; exit 1; }
  sleep 2
done

echo "▸ Conferindo o frontend…"
curl -fsS -m 5 -o /dev/null "http://127.0.0.1:${STG_FRONTEND_PORT:-8090}/" && echo "  frontend OK"

echo "▸ Publicando o APK Android mais recente…"
if [[ "${SKIP_APK:-}" == "1" ]]; then
  echo "  pulado (SKIP_APK=1)"
elif ! ./scripts/publish-apk.sh; then
  echo "  aviso: não deu para publicar o APK; o deploy segue. Rode ./scripts/publish-apk.sh depois." >&2
fi

echo
echo "✓ Deploy concluído — $URL"
$COMPOSE ps --format 'table {{.Service}}\t{{.Status}}'
