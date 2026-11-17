---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 07
type: execute
wave: 4
depends_on: ["08-04", "08-06"]
files_modified:
  - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md
autonomous: true
requirements: [D-02, D-08, D-09, D-10, D-11]

must_haves:
  truths:
    - "O gate completo está verde no commit publicado (lint, typecheck, jest unit, integração, vitest, shared, E2E Playwright)"
    - "O .env.staging tem VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT (subject https://sgs.jessicaseixasmakeup.com.br), gerados uma vez, sem a chave privada aparecer em log, saída de comando ou documento"
    - "Backup do Postgres do staging feito ANTES do deploy com a migration device_tokens_webpush"
    - "No staging: migration aplicada, log 'Web Push habilitado', pushConfig devolve a chave pública para usuária logada, e check-pwa-headers.sh passa contra https://sgs.jessicaseixasmakeup.com.br"
    - "O site e o app Android continuam iguais para o Studio JS (login, agenda) e o CI do commit está verde"
  artifacts:
    - path: ".planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md"
      provides: "Mapa de verificação com status green"
      contains: "nyquist_compliant: true"
  key_links:
    - from: "docker-compose.staging.yml"
      to: ".env.staging"
      via: "VAPID_* no bloco do backend"
      pattern: "VAPID_PUBLIC_KEY"
    - from: "scripts/deploy-staging.sh"
      to: "apps/backend/prisma/migrations/20261121000000_device_tokens_webpush"
      via: "serviço migrate do compose"
      pattern: "device_tokens_webpush"
---

<objective>
Fechar a fase em código e publicar: gate completo, chaves VAPID no `.env.staging`, backup do banco, deploy (de worktree limpo se houver trabalho alheio não commitado), conferências no staging (migration, log, `pushConfig`, headers do SW/manifest) e CI verde.

Purpose: o iPhone instala e recebe push a partir do staging (as telas do app SÃO o staging); D-10 e D-11 só valem de verdade lá.
Output: staging atualizado, CI verde, `08-VALIDATION.md` com status.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-11-gate-deploy-staging-PLAN.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-04-SUMMARY.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-06-SUMMARY.md

**Ambiente de execução:** igual ao 08-01. O staging é usado de verdade pelo Studio JS: backup antes, conferência logo depois. Branch `master`.

**Regras do fluxo da usuária (obrigatórias):**
- Gate antes de commit/push: lint + tsc + jest unit + integração (Postgres local `sgs_dev` 5433/5434, `.env` carregado linha a linha) + vitest; E2E `corepack pnpm --filter @sgs/e2e test:e2e` (sem `--` antes das flags).
- Backup do banco do staging em `/root/sgs-backups/` antes de deploy com migration.
- `./scripts/deploy-staging.sh` builda da ÁRVORE DE TRABALHO. Se `git status --porcelain` mostrar mudança que não é da fase 8, NÃO deployar de `/root/sgs`: usar worktree limpo do HEAD (passo 4 do Task 2).
- Push e acompanhar o CI (`gh run watch`); só dizer "verde" com a conclusão confirmada.
- A chave privada VAPID nunca vai para log, saída de terminal, SUMMARY, VALIDATION ou commit.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gate completo e verificações estáticas</name>
  <files>.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md</files>
  <read_first>
    - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md
    - SUMMARYs 08-01 a 08-06 (desvios registrados)
  </read_first>
  <action>
1. Env local carregado linha a linha (ver 08-01). Gate: `corepack pnpm install --frozen-lockfile && corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/mobile test && corepack pnpm --filter @sgs/e2e test:e2e`. Regressão → corrigir no arquivo de origem, registrar no SUMMARY. Única exceção aceita: `phase4-alerts-boot` local por Redis NOAUTH (conferir `docker exec sgs_valkey valkey-cli ping` antes de aceitar).
2. Verificações estáticas (todas precisam passar):
   - `grep -n '"web-push": "3.6.7"' apps/backend/package.json` encontra (não 4.x)
   - `git ls-files | xargs grep -lE "VAPID_PRIVATE_KEY=[A-Za-z0-9_-]{20,}" 2>/dev/null` vazio
   - `grep -c "addEventListener('fetch'" apps/frontend/public/sw.js` = 0
   - `grep -rn "vite-plugin-pwa\|workbox" apps/frontend/package.json` vazio (D-03)
   - `grep -rn "from '@capacitor/push-notifications'" apps/frontend/src --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v infrastructure/native` vazio (D-07: Web Push não usa Capacitor)
3. Imagens: `docker compose -f docker-compose.staging.yml --env-file .env.staging build backend frontend` verde; `./scripts/check-pwa-headers.sh` contra a imagem do frontend recém-construída (`docker run -d --rm --name sgs-fe-pwa-check -p 127.0.0.1:8099:80 sgs-staging-frontend` — conferir o nome da imagem com `docker images | grep frontend`; parar o container no fim).
4. `08-VALIDATION.md`: na "Per-Task Verification Map", `❌ W0` → `✅` e `⬜ pending` → `✅ green` nas linhas automatizadas que passaram (a linha D-11 fica para o Task 2, depois do staging); itens de "Wave 0 Requirements" com `[x]`; frontmatter `wave_0_complete: true`, `nyquist_compliant: true`, `status: green`.
5. Commit `docs(08-07): gate verde e mapa de validação`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/e2e test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - todas as etapas do `<verify>` saem 0 (exceção documentada só `phase4-alerts-boot` local)
    - `grep -n "wave_0_complete: true" .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md` encontra
    - `grep -n "nyquist_compliant: true" .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md` encontra
    - `git status --porcelain --untracked-files=no` vazio após o commit (fora mudanças de outra frente, que não entram no commit)
  </acceptance_criteria>
  <done>Fase verde localmente, sem segredo versionado nem dependência proibida.</done>
</task>

<task type="auto">
  <name>Task 2: VAPID no .env.staging, backup, push, deploy, conferências e CI</name>
  <files>.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - docker-compose.staging.yml (`name: sgs-staging`, container_name `sgs_stg_postgres`, `sgs_stg_backend`, bloco VAPID do 08-02)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-11-gate-deploy-staging-PLAN.md (backup e CI)
  </read_first>
  <action>
1. Chaves VAPID (uma vez; trocar depois invalida todas as inscrições). Sem imprimir nada:
```bash
cd /root/sgs
if ! grep -qE '^VAPID_PRIVATE_KEY=.+' .env.staging; then
  cp .env.staging /root/sgs-backups/env.staging.pre-vapid-$(date +%Y%m%d-%H%M) && chmod 600 /root/sgs-backups/env.staging.pre-vapid-*
  sed -i '/^VAPID_PUBLIC_KEY=/d;/^VAPID_PRIVATE_KEY=/d;/^VAPID_SUBJECT=/d' .env.staging
  (cd apps/backend && node -e "const k=require('web-push').generateVAPIDKeys();process.stdout.write('\n# Fase 8 — Web Push (iPhone). Não trocar: invalida as inscrições.\nVAPID_PUBLIC_KEY='+k.publicKey+'\nVAPID_PRIVATE_KEY='+k.privateKey+'\nVAPID_SUBJECT=https://sgs.jessicaseixasmakeup.com.br\n')") >> .env.staging
fi
grep -cE '^VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=.+' .env.staging   # deve dar 3; NÃO dar cat/grep que mostre o valor
```
   `.env.staging` é ignorado pelo git (conferir `git check-ignore .env.staging`).
2. Backup ANTES do deploy (há migration): `set -a; while IFS= read -r l; do [[ -z "$l" || "$l" == \#* ]] && continue; export "$l"; done < .env.staging; set +a; docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > /root/sgs-backups/stg-pre-iphone-webpush-$(date +%Y%m%d-%H%M).sql.gz` e conferir > 20 KB com `ls -l`.
3. `git push origin master`.
4. Deploy:
   - Árvore limpa (`git status --porcelain` vazio ou só arquivos não rastreados alheios a `apps/`/`packages/`/`infra/`): `./scripts/deploy-staging.sh` até "✓ Deploy concluído".
   - Com mudança alheia não commitada: `git worktree add --detach /root/sgs-deploy-08 HEAD && cp .env.staging /root/sgs-deploy-08/ && (cd /root/sgs-deploy-08 && ./scripts/deploy-staging.sh)`; depois, de `/root/sgs`, `docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --no-build postgres pgbouncer backend frontend` (o bind mount `infra/postgres/init-staging` volta a apontar para `/root/sgs`) e `git worktree remove --force /root/sgs-deploy-08`.
   - Se o caminho do APK do `publish-apk.sh` reclamar no worktree, é só aviso (o APK não muda nesta fase).
5. Conferências no staging:
   - `docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from information_schema.columns where table_name='device_tokens' and column_name in ('p256dh','auth')"` → `2`
   - `... -Atc "select relforcerowsecurity from pg_class where relname='device_tokens'"` → `t`
   - `docker logs sgs_stg_backend 2>&1 | grep -c "Web Push habilitado"` ≥ 1 e `docker logs sgs_stg_backend 2>&1 | grep -c "Push FCM habilitado"` ≥ 1 (Android intacto)
   - `docker logs sgs_stg_backend 2>&1 | grep -c "VAPID_PRIVATE\|$(grep -E '^VAPID_PRIVATE_KEY=' .env.staging | cut -d= -f2 | cut -c1-12)"` = 0 (sem vazamento; o comando não imprime a chave)
   - `curl -s https://sgs.jessicaseixasmakeup.com.br/graphql -H 'content-type: application/json' -d '{"query":"{ pushConfig { webPushPublicKey } }"}'` → erro de autenticação (não 500, não "Cannot query field")
   - com usuária logada (token obtido pela mutation de login de um usuário de teste do Studio JS, sem gravar senha em arquivo), `pushConfig.webPushPublicKey` tem 87 caracteres e é igual ao `VAPID_PUBLIC_KEY` (comparar por `test`, sem imprimir)
   - `./scripts/check-pwa-headers.sh https://sgs.jessicaseixasmakeup.com.br` → "✓ Headers do app instalável OK"
   - `curl -fsS -o /dev/null -w '%{http_code}' https://sgs.jessicaseixasmakeup.com.br/login` → 200
6. CI: `gh run list --branch master --limit 5` e `gh run watch <id>` do workflow `CI` (e do `Android (Gestor Beauty)` se disparou) do commit publicado até concluir. Falhou → corrigir, gate de novo, novo push e (se backend/frontend mudou) novo deploy.
7. `08-VALIDATION.md`: linha D-11 → `✅ green`; commit `docs(08-07): staging com Web Push e CI verde` e push.
  </action>
  <verify>
    <automated>cd /root/sgs && ls -1 /root/sgs-backups/stg-pre-iphone-webpush-*.sql.gz && test "$(grep -cE '^VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=.+' .env.staging)" = 3 && ./scripts/check-pwa-headers.sh https://sgs.jessicaseixasmakeup.com.br && docker logs sgs_stg_backend 2>&1 | grep -q "Web Push habilitado" && gh run list --branch master --limit 5 --json name,conclusion,headSha -q ".[] | select(.name==\"CI\") | .conclusion" | head -1 | grep -x success</automated>
  </verify>
  <acceptance_criteria>
    - `/root/sgs-backups/stg-pre-iphone-webpush-*.sql.gz` existe e tem mais de 20 KB
    - `.env.staging` com as 3 variáveis VAPID preenchidas e `git check-ignore .env.staging` confirma que não é versionado
    - colunas `p256dh`/`auth` existem no staging e `relforcerowsecurity` = `t`
    - logs do backend com "Web Push habilitado" e "Push FCM habilitado"
    - `check-pwa-headers.sh` verde contra o staging
    - último run `CI` do `master` com `conclusion` = `success`
    - nenhum arquivo da fase (SUMMARY, VALIDATION, commits) contém o valor da chave privada
  </acceptance_criteria>
  <done>Staging pronto para o teste no iPhone, com backup, chaves e CI verde.</done>
</task>

</tasks>

<verification>
Gate verde, backup guardado, staging com Web Push ligado e headers certos, CI verde.
</verification>

<success_criteria>
O servidor que o iPhone carrega já tem tudo da fase (D-02, D-08..D-11), sem regressão no uso diário do Studio JS nem no app Android.
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-07-SUMMARY.md`
</output>
