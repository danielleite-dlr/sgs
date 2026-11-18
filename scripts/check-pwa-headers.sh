#!/usr/bin/env bash
# Confere os headers do app instalável (fase 8, D-11).
# Uso: ./scripts/check-pwa-headers.sh <url-base>   ex.: http://127.0.0.1:8099
set -euo pipefail

BASE="${1:?Uso: $0 <url-base>}"
BASE="${BASE%/}"

falha() {
  echo "✗ $*" >&2
  exit 1
}

# cabecalhos <caminho>: imprime status + headers em minúsculas (CRLF removido).
cabecalhos() {
  curl -fsS -o /dev/null -D - "$BASE$1" | tr -d '\r' | tr 'A-Z' 'a-z'
}

checar() {
  local caminho="$1" tipo="$2" sem_cache="$3" h
  h="$(cabecalhos "$caminho")" || falha "$caminho: não respondeu 200"
  echo "$h" | head -n1 | grep -q ' 200' || falha "$caminho: status diferente de 200"
  echo "$h" | grep -q "^content-type:.*$tipo" || falha "$caminho: content-type sem '$tipo'"
  echo "$h" | grep -q '^x-content-type-options: nosniff' || falha "$caminho: falta x-content-type-options: nosniff"
  if [ "$sem_cache" = "sim" ]; then
    echo "$h" | grep -q '^cache-control:.*no-cache' || falha "$caminho: falta cache-control no-cache"
    if echo "$h" | grep -Eq '^cache-control:.*(immutable|max-age=31536000)'; then
      falha "$caminho: cache longo (immutable/max-age=31536000) não pode"
    fi
  fi
}

checar /sw.js 'javascript' sim
checar /manifest.webmanifest 'application/manifest+json' sim
checar /icons/apple-touch-icon-180.png 'image/png' nao
checar /icons/icon-192.png 'image/png' nao
checar / 'text/html' sim

echo "✓ Headers do app instalável OK em $BASE"
