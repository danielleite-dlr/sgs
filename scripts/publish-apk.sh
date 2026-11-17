#!/usr/bin/env bash
# ─── SGS — publicar o APK Android no staging ──────────────────────────────────
# Roda na VPS. Baixa o APK assinado mais recente do GitHub Actions (artifact
# gestor-beauty-release do workflow android.yml) e publica em
# /var/www/gb-apk/gestor-beauty.apk, servido pelo nginx em
# /download/gestor-beauty.apk (link "Baixar app Android" da tela de login).
# Atômico (cópia temporária no mesmo diretório + mv) e idempotente.
#
#   ./scripts/publish-apk.sh                 # último release válido do GitHub
#   ./scripts/publish-apk.sh --file <apk>    # publica um APK local
#   ./scripts/publish-apk.sh --help
#
# Variáveis (para testar sem tocar no destino real):
#   GB_REPO       repositório no GitHub      (padrão danielleite-dlr/sgs)
#   GB_APK_STORE  onde guardar os downloads  (padrão /root/gestor-beauty-apks)
#   GB_APK_DEST   arquivo publicado          (padrão /var/www/gb-apk/gestor-beauty.apk)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="${GB_REPO:-danielleite-dlr/sgs}"
STORE="${GB_APK_STORE:-/root/gestor-beauty-apks}"
DEST="${GB_APK_DEST:-/var/www/gb-apk/gestor-beauty.apk}"
ARTIFACT=gestor-beauty-release

# Temporários removidos se o script sair no meio.
LIMPAR=()
limpar() {
  local f
  for f in "${LIMPAR[@]+"${LIMPAR[@]}"}"; do
    rm -rf -- "$f"
  done
}
trap limpar EXIT

erro() {
  echo "ERRO: $*" >&2
  exit 1
}

uso() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
}

validar_apk() {
  local arq="$1"
  [[ -f "$arq" ]] || erro "APK não encontrado: $arq"
  local tam
  tam=$(stat -c %s "$arq")
  (( tam > 1048576 )) || erro "APK pequeno demais ($tam bytes): $arq"
  [[ "$(head -c 2 "$arq")" == "PK" ]] || erro "não parece um APK (zip): $arq"
}

publicar() {
  local arq="$1" descricao="$2"
  validar_apk "$arq"
  local sha
  sha=$(sha256sum "$arq" | cut -d' ' -f1)
  if [[ -f "$DEST" ]] && [[ "$(sha256sum "$DEST" | cut -d' ' -f1)" == "$sha" ]]; then
    echo "  já publicado ($sha) em $DEST"
    return 0
  fi
  mkdir -p "$(dirname "$DEST")"
  local tmp="$DEST.tmp.$$"
  LIMPAR+=("$tmp")
  install -m 0644 "$arq" "$tmp"
  mv -f "$tmp" "$DEST"
  echo "✓ APK publicado"
  echo "  origem:  $descricao"
  echo "  tamanho: $(stat -c %s "$DEST") bytes"
  echo "  sha256:  $sha"
  echo "  destino: $DEST"
}

do_github() {
  command -v gh >/dev/null 2>&1 || erro "gh (GitHub CLI) não encontrado"

  local candidatos
  candidatos=$(gh api "repos/$REPO/actions/artifacts?name=$ARTIFACT&per_page=100" --jq '
    [.artifacts[]
      | select(.expired == false)
      | select(.workflow_run.head_branch == "master"
               or (.workflow_run.head_branch // "" | startswith("android-v")))]
    | sort_by(.created_at) | reverse | .[]
    | "\(.workflow_run.id) \(.created_at) \(.workflow_run.head_branch)"')

  local run="" created="" branch="" run_number="" r c b
  while read -r r c b; do
    [[ -n "$r" ]] || continue
    local info
    info=$(gh api "repos/$REPO/actions/runs/$r" --jq '"\(.conclusion) \(.run_number)"') || continue
    if [[ "${info%% *}" == "success" ]]; then
      run="$r" created="$c" branch="$b" run_number="${info#* }"
      break
    fi
  done <<< "$candidatos"

  [[ -n "$run" ]] || erro "nenhum $ARTIFACT válido (rode: gh workflow run android.yml --ref master)"

  echo "▸ Release: run $run (versionCode $((1000 + run_number)), $branch, $created)"
  local dir
  dir="$STORE/release-$(date -u -d "$created" +%Y%m%d)-run$run"
  if compgen -G "$dir/apk/release/*.apk" >/dev/null; then
    echo "  run $run já baixado em $dir"
  else
    local part="$dir.part.$$"
    LIMPAR+=("$part")
    mkdir -p "$STORE"
    echo "  baixando para $dir…"
    gh run download "$run" -R "$REPO" -n "$ARTIFACT" -D "$part"
    rm -rf -- "$dir"
    mv "$part" "$dir"
  fi

  local apk="$dir/apk/release/app-release.apk"
  if [[ ! -f "$apk" ]]; then
    apk=$(compgen -G "$dir/apk/release/*.apk" | head -n 1 || true)
    [[ -n "$apk" ]] || erro "nenhum .apk em $dir/apk/release/"
  fi

  publicar "$apk" "run $run, versionCode $((1000 + run_number)), $branch, $created"
}

case "${1:-}" in
  "")
    do_github
    ;;
  --file)
    [[ -n "${2:-}" ]] || { echo "uso: $0 --file <apk>" >&2; exit 2; }
    publicar "$2" "arquivo local $2"
    ;;
  -h|--help)
    uso
    ;;
  *)
    echo "argumento desconhecido: $1" >&2
    uso >&2
    exit 2
    ;;
esac
