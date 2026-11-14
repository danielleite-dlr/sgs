---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 11
type: execute
wave: 5
depends_on: ["07-06", "07-09", "07-10"]
files_modified:
  - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md
autonomous: true
requirements: [C-01, C-02, C-03, C-04, C-05, C-06]

must_haves:
  truths:
    - "O gate completo do projeto está verde no commit publicado (lint, typecheck, jest unit, integração, vitest, E2E Playwright)"
    - "O banco do staging tem backup feito ANTES do deploy com a migration device_tokens"
    - "O staging roda o código da fase 7 com device_tokens criada (RLS forçada) e o backend sobe com o push desligado enquanto não houver credencial FCM"
    - "O site no navegador continua igual para o Studio JS (login, agenda) depois do deploy"
    - "O CI do commit está verde, incluindo o job android, que publicou o artefato gestor-beauty-debug-apk (decisão do orquestrador nº 5)"
  artifacts:
    - path: ".planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md"
      provides: "Mapa de verificação atualizado (status green das linhas automatizadas)"
  key_links:
    - from: "scripts/deploy-staging.sh"
      to: "apps/backend/prisma/migrations/20261120000000_device_tokens"
      via: "serviço migrate do compose"
      pattern: "device_tokens"
---

<objective>
Fechar a fase em código e publicar: gate completo, backup do Postgres do staging, push para `master`, deploy pelo `scripts/deploy-staging.sh`, conferência da migration e do backend, e acompanhamento do CI (incluindo o job `android` e o artefato do APK debug).

Purpose: deixar o servidor pronto para o app (D-06/D-07 — as telas do app SÃO o staging) e um APK debug baixável para o teste humano (07-13).
Output: staging atualizado, CI verde, APK debug como artefato, VALIDATION.md com status.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-09-SUMMARY.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-10-SUMMARY.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-06-SUMMARY.md

**Ambiente de execução:** igual ao 07-01. O staging é usado de verdade pelo Studio JS: backup antes, deploy fora do horário de atendimento se possível, e conferência logo depois.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gate completo e verificações estáticas da fase</name>
  <files>.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md</files>
  <read_first>
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md (Per-Task Verification Map, Wave 0 Requirements)
    - SUMMARYs 07-01 a 07-10 (desvios registrados)
  </read_first>
  <action>
1. Gate completo: `corepack pnpm install --frozen-lockfile && corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/mobile test && corepack pnpm --filter @sgs/e2e test:e2e`. Corrigir regressões no arquivo de origem e registrar no SUMMARY. `phase4-alerts-boot` local por Redis NOAUTH é a única exceção aceita.
2. Verificações estáticas (todas precisam passar):
   - `git ls-files | grep -E '\.jks$|\.keystore$|google-services\.json$|service-account.*\.json$'` vazio
   - `grep -rn "@sgs/shared" apps/backend/package.json apps/frontend/package.json` vazio
   - `grep -rn "from '@capacitor/push-notifications'" apps/frontend/src --include=*.ts --include=*.tsx | grep -v __tests__` vazio
   - `grep -n '"build":' package.json` sem mobile/shared
3. `docker compose -f docker-compose.staging.yml --env-file .env.staging build backend frontend` verde (C-06).
4. Atualizar `07-VALIDATION.md`: na tabela "Per-Task Verification Map", trocar `❌ W0` por `✅` e `⬜ pending` por `✅ green` em cada linha automatizada que passou (a linha do job `android` só no Task 2, depois do CI); marcar os itens de "Wave 0 Requirements" com `[x]`; frontmatter `wave_0_complete: true` e `nyquist_compliant: true`.
5. Commit `docs(07-11): gate verde e mapa de validação`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/mobile test && corepack pnpm --filter @sgs/e2e test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - todas as etapas do comando do `<verify>` saem 0 (exceção documentada só `phase4-alerts-boot` local)
    - `git ls-files | grep -E '\.jks$|google-services\.json$'` sai vazio
    - `grep -n "wave_0_complete: true" .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md` encontra a linha
    - `grep -n "nyquist_compliant: true" .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md` encontra a linha
    - `git status --porcelain --untracked-files=no` vazio após o commit
  </acceptance_criteria>
  <done>Fase verde localmente e sem segredos nem dependências proibidas.</done>
</task>

<task type="auto">
  <name>Task 2: Backup do staging, push, deploy, conferência e CI (incluindo o APK debug)</name>
  <files>.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - docker-compose.staging.yml (container_name sgs_stg_postgres, sgs_stg_backend)
    - .planning/phases/04.2-cronograma-da-noiva-e-das-acompanhantes-modelo-studio-js/04.2-12-deploy-human-verification-PLAN.md (comando de backup e de CI usados na 04.2)
  </read_first>
  <action>
1. Backup ANTES do deploy (há migration): `cd /root/sgs && set -a && . ./.env.staging && set +a && docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > /root/sgs-backups/stg-pre-app-android-$(date +%Y%m%d-%H%M).sql.gz` e conferir que o arquivo tem mais de 20 KB (`ls -l /root/sgs-backups/stg-pre-app-android-*.sql.gz`).
2. `git push origin master`.
3. Deploy: `./scripts/deploy-staging.sh` (sem `--pull`: o código já está local). Tem que terminar com "✓ Deploy concluído".
4. Conferências no staging:
   - `docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select relrowsecurity, relforcerowsecurity from pg_class where relname='device_tokens'"` → `t|t`
   - `docker logs sgs_stg_backend 2>&1 | grep -n "Push desabilitado (sem FCM_SERVICE_ACCOUNT_JSON)"` (esperado antes do 07-12) ou "Push FCM habilitado"
   - `curl -fsS -o /dev/null -w '%{http_code}' https://sgs.jessicaseixasmakeup.com.br/` → 200 e `curl -fsS https://sgs.jessicaseixasmakeup.com.br/ | grep -c "viewport-fit=cover"` → 1
   - mutation sem token: `curl -s https://sgs.jessicaseixasmakeup.com.br/graphql -H 'content-type: application/json' -d '{"query":"mutation{unregisterDeviceToken(token:\"x\")}"}'` devolve erro de autenticação (não 500, não "Cannot query field")
5. CI: `gh run list --branch master --limit 5` e `gh run watch <id>` para o workflow `CI` E para o `Android (Gestor Beauty)` do commit publicado, até verdes. Se falhar, corrigir, repetir o gate, novo push e (se o backend/frontend mudou) novo deploy. Primeira execução do job android valida o `cap sync` com pnpm (RESEARCH Wave 0): se o Gradle não achar `@capacitor/*`, aplicar o fallback do 07-04 (`public-hoist-pattern[]=@capacitor/*` no `.npmrc`) e repetir.
6. Confirmar o artefato: `gh run view <id do android> --json artifacts -q '.artifacts[].name'` contém `gestor-beauty-debug-apk`; baixar para `/root/gestor-beauty-apks/` com `gh run download <id> -n gestor-beauty-debug-apk -D /root/gestor-beauty-apks/debug-$(date +%Y%m%d)` (fora do repo).
7. `07-VALIDATION.md`: linha "Projeto Android compila (debug APK)" → `✅ green`; linha do `packages/shared`/Docker → `✅ green`. Commit `docs(07-11): staging publicado e CI verde` e push.
  </action>
  <verify>
    <automated>cd /root/sgs && ls -1 /root/sgs-backups/stg-pre-app-android-*.sql.gz && git log origin/master -1 --oneline && gh run list --branch master --limit 5 --json name,conclusion -q '.[] | select(.name=="CI" or .name=="Android (Gestor Beauty)") | .conclusion' | sort -u | grep -vx success | wc -l | grep -x 0</automated>
  </verify>
  <acceptance_criteria>
    - `/root/sgs-backups/stg-pre-app-android-*.sql.gz` existe e tem mais de 20 KB
    - `device_tokens` no staging com `t|t` (RLS habilitada e forçada)
    - `curl -fsS https://sgs.jessicaseixasmakeup.com.br/` responde 200 e contém `viewport-fit=cover`
    - últimos runs de `CI` e `Android (Gestor Beauty)` no `master` com `conclusion` = `success`
    - `ls /root/gestor-beauty-apks/debug-*/*.apk` encontra o APK debug
  </acceptance_criteria>
  <done>Fase 7 publicada no staging com backup, CI verde e APK debug disponível para o teste no aparelho.</done>
</task>

</tasks>

<verification>
Backup guardado; staging e CI verdes; APK debug baixado fora do repo.
</verification>

<success_criteria>
O servidor que o app carrega já tem tudo da fase (C-02/C-03/C-04) e existe um APK debug para instalar (C-01), sem regressão no uso diário do Studio JS.
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-11-SUMMARY.md`
</output>
