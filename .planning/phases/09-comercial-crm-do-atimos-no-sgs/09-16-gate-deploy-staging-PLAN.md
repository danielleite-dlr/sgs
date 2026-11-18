---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 16
type: execute
wave: 7
depends_on: ["09-15"]
files_modified:
  - .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md
autonomous: true
requirements: [COM-01, COM-02, COM-03, COM-04, COM-05, COM-06, COM-07, COM-08, COM-09, COM-10, COM-11, COM-12]

must_haves:
  truths:
    - "O gate completo está verde no commit publicado: lint, typecheck, jest unitário, integração completa (Postgres local sgs_dev), vitest, shared e E2E Playwright"
    - "Backup do Postgres do staging feito ANTES do deploy (a fase tem migration) em /root/sgs-backups/"
    - "No staging: migration 20261122000000_phase9_commercial aplicada, 6 tabelas commercial_* com FORCE RLS, etapas padrão para a org Studio JS, permissões commercial.* materializadas, scheduler 'commercial-reminders-tick' registrado"
    - "/contato/x/y no staging responde com frame-ancestors e o resto do app segue SAMEORIGIN; login e agenda do Studio JS continuam iguais"
    - "O último run do workflow CI no master está success, confirmado com gh run watch"
  artifacts:
    - path: ".planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md"
      provides: "mapa de verificação com status"
      contains: "nyquist_compliant: true"
  key_links:
    - from: "scripts/deploy-staging.sh"
      to: "apps/backend/prisma/migrations/20261122000000_phase9_commercial"
      via: "serviço migrate do compose"
      pattern: "phase9_commercial"
    - from: "docker-compose.staging.yml"
      to: "COMMERCIAL_REMINDERS_SCHEDULER"
      via: "env do backend"
      pattern: "COMMERCIAL_REMINDERS_SCHEDULER"
---

<objective>
Fechar a fase em código e publicar no staging: gate completo, backup do banco, push, deploy (de worktree limpo se houver trabalho alheio não commitado), conferências no staging e CI verde.

Purpose: a usuária testa no staging (é o ambiente que o Studio JS usa); as regras de entrega dela são obrigatórias.
Output: staging com o Comercial, CI verde, `09-VALIDATION.md` atualizado.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-07-gate-vapid-deploy-staging-PLAN.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-15-SUMMARY.md

**Ambiente de execução:** igual ao 09-01. Branch `master`. Staging usado de verdade pelo Studio JS (org ativa "Studio JS").

**Regras de entrega da usuária (obrigatórias):**
- Gate ANTES de cada commit/push: lint + tsc + jest unit + integração (Postgres local `sgs_dev`, env carregado linha a linha) + vitest; E2E Playwright em `apps/e2e` com `corepack pnpm --filter @sgs/e2e test:e2e` (sem `--` antes das flags).
- Backup do banco do staging em `/root/sgs-backups/` antes de deploy com migration.
- Deploy via `./scripts/deploy-staging.sh`, que builda a ÁRVORE DE TRABALHO. Se `git status --porcelain` mostrar mudança alheia à fase 9, NÃO deployar de `/root/sgs`: usar `git worktree` limpo do HEAD.
- Push e acompanhar o CI com `gh run watch`; só dizer "verde" com a conclusão confirmada.
- Frontend formatado à mão: nada de `prettier --write` em arquivo existente. Nunca importar `tailwind.config.ts` de `src/` ou testes.
- Em gate/deploy longo, se perguntarem "já subiu?", responder com barra de progresso medida no log.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gate completo e verificações estáticas</name>
  <files>.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md</files>
  <read_first>
    - .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md
    - SUMMARYs 09-01 a 09-15 (desvios registrados)
  </read_first>
  <action>
1. Env local linha a linha (09-01). Gate: `corepack pnpm install --frozen-lockfile && corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/e2e test:e2e`. Regressão → corrigir no arquivo de origem e registrar no SUMMARY. Exceção aceita só `phase4-alerts-boot` local por Redis NOAUTH (conferir `docker exec sgs_valkey valkey-cli ping` antes de aceitar).
2. Verificações estáticas (todas precisam passar):
   - `grep -rn "tailwind.config" apps/frontend/src` vazio
   - `grep -rn "@dnd-kit/sortable\|\"xlsx\"\|jspdf" apps/frontend/package.json apps/backend/package.json` vazio
   - `grep -n '"exceljs": "' apps/backend/package.json` encontra
   - `grep -rn "ThrottlerModule.forRoot" apps/backend/src | wc -l` = 1 (só o do aceite de contrato)
   - `grep -rn "WIN_DEAL_ROLES" apps/backend/src apps/frontend/src --include=*.ts | grep -v __tests__ | grep -v spec` mostra só `commercial-access.ts` e `commercial-permissions.ts` (D-21 isolada)
   - para cada tabela `commercial_*`: `grep -c "FORCE ROW LEVEL SECURITY" apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` = 6
3. `09-VALIDATION.md`: preencher status das linhas automatizadas que passaram (`❌ W0` → `✅`, `⬜ pending` → `✅ green`), itens de Wave 0 com `[x]`, frontmatter `wave_0_complete: true`, `nyquist_compliant: true`, `status: green`. Linhas manuais ficam para o 09-17.
4. Commit `docs(09-16): gate verde e mapa de validação`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/e2e test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - todas as etapas do `<verify>` saem 0 (exceção documentada só `phase4-alerts-boot` local)
    - as 6 verificações estáticas do passo 2 passam
    - `grep -n "nyquist_compliant: true" .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md` encontra
  </acceptance_criteria>
  <done>Fase verde localmente.</done>
</task>

<task type="auto">
  <name>Task 2: Backup, push, deploy, conferências no staging e CI</name>
  <files>.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - docker-compose.staging.yml (container_name `sgs_stg_postgres`, `sgs_stg_backend`, `sgs_stg_frontend`; env COMMERCIAL_REMINDERS_SCHEDULER)
    - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-07-gate-vapid-deploy-staging-PLAN.md (Task 2: backup, worktree, CI)
  </read_first>
  <action>
1. Backup ANTES do deploy: `cd /root/sgs; set -a; while IFS= read -r l; do [[ -z "$l" || "$l" == \#* ]] && continue; export "$l"; done < .env.staging; set +a; docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > /root/sgs-backups/stg-pre-comercial-$(date +%Y%m%d-%H%M).sql.gz` e conferir > 20 KB com `ls -l`.
2. `git push origin master`.
3. Deploy:
   - Árvore limpa (`git status --porcelain` vazio ou só não rastreados fora de `apps/`, `packages/`, `infra/`): `./scripts/deploy-staging.sh` até "✓ Deploy concluído".
   - Com mudança alheia não commitada: `git worktree add --detach /root/sgs-deploy-09 HEAD && cp .env.staging /root/sgs-deploy-09/ && (cd /root/sgs-deploy-09 && ./scripts/deploy-staging.sh)`; depois, de `/root/sgs`, `docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --no-build postgres pgbouncer backend frontend` (o bind mount `infra/postgres/init-staging` volta a apontar para `/root/sgs`) e `git worktree remove --force /root/sgs-deploy-09`.
4. Conferências no staging (`PSQL="docker exec -e PGPASSWORD=$POSTGRES_PASSWORD sgs_stg_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -Atc"`):
   - `$PSQL "select count(*) from pg_class where relname like 'commercial_%' and relkind='r' and relforcerowsecurity"` → `6`
   - `$PSQL "select count(*) from commercial_stages s join organizations o on o.id=s.organization_id where o.trade_name ilike '%Studio JS%'"` → `6`
   - `$PSQL "select count(*) from role_permissions where permission like 'commercial.%'"` → `8`
   - `docker logs sgs_stg_backend 2>&1 | grep -c "commercial-reminders-tick registrado"` ≥ 1; `grep -c "Web Push habilitado"` e `"Push FCM habilitado"` ≥ 1 (push intacto)
   - `curl -sI https://sgs.jessicaseixasmakeup.com.br/contato/x/y | grep -i "frame-ancestors"` encontra e `| grep -ic "x-frame-options"` = 0; `curl -sI https://sgs.jessicaseixasmakeup.com.br/agenda | grep -i "x-frame-options: SAMEORIGIN"` encontra
   - `curl -s -o /dev/null -w '%{http_code}' https://sgs.jessicaseixasmakeup.com.br/public/leads/00000000-0000-0000-0000-000000000000/x` → `404`
   - `./scripts/check-pwa-headers.sh https://sgs.jessicaseixasmakeup.com.br` → OK; `curl -fsS -o /dev/null -w '%{http_code}' https://sgs.jessicaseixasmakeup.com.br/login` → 200
5. CI: `gh run list --branch master --limit 5` e `gh run watch <id>` do workflow `CI` do commit publicado até concluir. Falhou → corrigir, gate de novo, novo push e (se backend/frontend mudou) novo deploy com backup se houver migration nova.
6. Commit `docs(09-16): staging com o Comercial e CI verde` e push.
  </action>
  <verify>
    <automated>cd /root/sgs && ls -1 /root/sgs-backups/stg-pre-comercial-*.sql.gz && curl -sI https://sgs.jessicaseixasmakeup.com.br/contato/x/y | grep -qi "frame-ancestors" && docker logs sgs_stg_backend 2>&1 | grep -q "commercial-reminders-tick registrado" && gh run list --branch master --limit 5 --json name,conclusion -q '.[] | select(.name=="CI") | .conclusion' | head -1 | grep -x success</automated>
  </verify>
  <acceptance_criteria>
    - `/root/sgs-backups/stg-pre-comercial-*.sql.gz` existe, > 20 KB e com horário anterior ao deploy
    - as conferências do passo 4 deram os valores esperados (registrar saídas no SUMMARY, sem segredos)
    - último run `CI` do `master` com `conclusion` = `success`
    - `git worktree list` sem `/root/sgs-deploy-09` no fim
  </acceptance_criteria>
  <done>Comercial no staging com backup, conferências e CI verde.</done>
</task>

</tasks>

<verification>
Gate verde, backup guardado, staging conferido, CI verde.
</verification>

<success_criteria>
O Studio JS pode usar o Comercial no staging sem regressão no uso diário.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-16-SUMMARY.md`
</output>
