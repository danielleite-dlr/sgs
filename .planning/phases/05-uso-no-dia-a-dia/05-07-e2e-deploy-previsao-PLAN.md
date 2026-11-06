---
phase: 05-uso-no-dia-a-dia
plan: 07
type: execute
wave: 4
depends_on: ["05-04", "05-06"]
files_modified:
  - apps/e2e/tests/financeiro-previsao.spec.ts
  - apps/e2e/audit/previsao-staging.audit.ts
autonomous: true
requirements: [FIN-03]

must_haves:
  truths:
    - "Fluxo ponta a ponta local: cadastrar despesa fixa → ela aparece nas saídas do cartão do painel → clicar abre o detalhe com a origem 'Despesa fixa'"
    - "Gate completo verde antes do commit: typecheck, lint, jest unit, integração, vitest e E2E"
    - "Backup do banco do staging feito antes do deploy com migration"
    - "Staging no ar com a migration de fixed_expenses aplicada e o CI do GitHub verde"
    - "No staging, o usuário de auditoria (ADMIN) entra no painel e vê o cartão da previsão sem erro, e o detalhe abre"
  artifacts:
    - path: "apps/e2e/tests/financeiro-previsao.spec.ts"
      provides: "E2E do fluxo de previsão"
    - path: "apps/e2e/audit/previsao-staging.audit.ts"
      provides: "Checagem somente leitura da previsão no staging"
  key_links:
    - from: "apps/e2e/tests/financeiro-previsao.spec.ts"
      to: "/financeiro/despesas-fixas → /dashboard → /financeiro/previsao"
      via: "navegação pela UI"
      pattern: "financeiro/previsao"
    - from: "apps/e2e/audit/previsao-staging.audit.ts"
      to: "installReadOnlyGuard"
      via: "guarda somente leitura no staging"
      pattern: "installReadOnlyGuard"
---

<objective>
Fechar a entrega da previsão (FIN-03): E2E ponta a ponta, gate completo, backup do staging, commit, push, deploy (`./scripts/deploy-staging.sh`), acompanhamento do CI e checagem somente leitura no staging.

Purpose: a dona pode usar a previsão no staging hoje; o CI confirma que nada quebrou.
Output: `financeiro-previsao.spec.ts`, `previsao-staging.audit.ts`, deploy feito, CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-uso-no-dia-a-dia/05-04-SUMMARY.md
@.planning/phases/05-uso-no-dia-a-dia/05-06-SUMMARY.md

<interfaces>
- E2E: `loginViaUi(page, email, password)`, `navigateViaMenu(page, ...labels)` em `apps/e2e/support/ui.ts`; `readSeedState().owner` (ADMIN). Menu: grupo `Financeiro` → `Despesas fixas`, `Previsão de 30 dias`; item raiz `Início` (/dashboard).
- Textos da UI (05-05/05-06): `Nova despesa fixa`, campos `Nome`, `Valor`, `Dia do vencimento`, botão `Salvar`, toast `Despesa fixa salva.`, cartão `Previsão dos próximos 30 dias`, `Saídas previstas`, link `Ver detalhe`, página `Previsão financeira — próximos 30 dias`, badge de origem `Despesa fixa`, `Excluir despesa fixa?` / `Excluir`.
- Auditoria (05-01): `apps/e2e/audit/audit-helpers.ts` (`loadAuditEnv`, `installReadOnlyGuard`), config `apps/e2e/playwright.audit.config.ts`, credencial em `/root/sgs/.env.audit`.
- Staging DB: `cd /root/sgs && set -a && . ./.env.staging && set +a && docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres ...`
- Branch do repositório: `master` (não `main`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: E2E financeiro-previsao (local) + checagem da previsão no staging</name>
  <files>apps/e2e/tests/financeiro-previsao.spec.ts, apps/e2e/audit/previsao-staging.audit.ts</files>
  <read_first>
    - apps/e2e/tests/financeiro-dashboard.spec.ts (estilo E2E do financeiro)
    - apps/e2e/support/ui.ts
    - apps/e2e/audit/audit-helpers.ts e apps/e2e/audit/telas.audit.ts (05-01)
    - apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx, PrevisaoPage.tsx e components/ForecastCard.tsx (textos exatos)
  </read_first>
  <action>
1. `apps/e2e/tests/financeiro-previsao.spec.ts`: `test('despesa fixa cadastrada entra na previsão do painel e no detalhe', …)`:
   - `stamp = Date.now().toString(36)`; nome `Aluguel E2E ${stamp}`; dia do vencimento = dia de hoje em America/Sao_Paulo (`new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', day: '2-digit' }).format(new Date())` → número), garantindo que caia dentro da janela.
   - Login como `seed.owner` → espera `/dashboard`.
   - `navigateViaMenu(page, 'Financeiro', 'Despesas fixas')` → `Nova despesa fixa` → preencher `Nome`, `Valor` `123456` (→ `R$ 1.234,56`), `Dia do vencimento` → `Salvar` → espera o toast `Despesa fixa salva.` e a linha com o nome.
   - `navigateViaMenu(page, 'Início')` → cartão `Previsão dos próximos 30 dias` visível; `Saídas previstas` mostra valor ≥ `R$ 1.234,56` (ler o texto e converter).
   - Clicar `Ver detalhe` → URL `/financeiro/previsao` → existe linha com o nome e o badge `Despesa fixa` e o valor `R$ 1.234,56`.
   - Limpeza pela UI: voltar em Despesas fixas → `Excluir` → confirmar `Excluir` → linha some.
2. `apps/e2e/audit/previsao-staging.audit.ts` (roda com o config de auditoria, alvo staging): `installReadOnlyGuard`; login com a credencial de auditoria; espera `/dashboard`; `Previsão dos próximos 30 dias` visível e SEM o texto `Não foi possível carregar a previsão.`; clicar `Ver detalhe` → `Previsão financeira — próximos 30 dias` visível sem erro; `navigateViaMenu(page, 'Financeiro', 'Despesas fixas')` abre sem erro. Screenshot desktop e mobile em `EVIDENCE_DIR/<project>/90-previsao-*.png`. `blocked` deve ficar vazio (nenhuma mutation de negócio disparada).
3. Rodar localmente: `corepack pnpm --filter @sgs/e2e test:e2e financeiro-previsao`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/e2e test:e2e financeiro-previsao && corepack pnpm --filter @sgs/e2e typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `financeiro-previsao.spec.ts` contém `Despesas fixas`, `Previsão dos próximos 30 dias`, `Ver detalhe`, `financeiro/previsao`, `Despesa fixa` e `Excluir despesa fixa?`
    - `previsao-staging.audit.ts` contém `installReadOnlyGuard` e `Não foi possível carregar a previsão.`
    - `corepack pnpm --filter @sgs/e2e test:e2e financeiro-previsao` passa localmente
  </acceptance_criteria>
  <done>Fluxo de previsão comprovado ponta a ponta no ambiente local; checagem do staging pronta.</done>
</task>

<task type="auto">
  <name>Task 2: Gate completo → backup do staging → commit → push → deploy → CI → checagem no staging</name>
  <files>apps/e2e/audit/previsao-staging.audit.ts</files>
  <read_first>
    - scripts/deploy-staging.sh
    - .github/workflows/ci.yml
    - /root/sgs-backups (nomes dos backups anteriores: stg-pre-<slug>-AAAAMMDD-HHMM.sql.gz)
  </read_first>
  <action>
1. Gate completo, nesta ordem, tudo verde (corrigir e repetir se algo falhar; nunca commitar vermelho):
   `pnpm -r typecheck` → `pnpm -r --if-present lint` → `pnpm --filter @sgs/backend test` → `pnpm --filter @sgs/backend test:integration` (Postgres local sgs_dev 5433/5434; carregar `.env` linha a linha) → `pnpm --filter @sgs/frontend test` → `corepack pnpm --filter @sgs/e2e test:e2e` (sem `--` antes das flags).
2. Commit(s) do código da fase ainda não commitado pelos planos 05-02..05-07 (mensagens `feat(05-07): ...`/`test(05-07): ...`, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Conferir `git status --porcelain` sem `.env.audit` nem evidências.
3. Backup do staging ANTES do deploy (há migration): `cd /root/sgs && set -a && . ./.env.staging && set +a && docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" sgs_stg_postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > /root/sgs-backups/stg-pre-phase5-forecast-$(date +%Y%m%d-%H%M).sql.gz` e conferir que o arquivo tem mais de 20 KB.
4. `git push origin master`.
5. `./scripts/deploy-staging.sh` — deve terminar com `✓ Deploy concluído`. Conferir a migration: `docker exec ... psql ... -c "SELECT migration_name FROM _prisma_migrations WHERE migration_name = '20261106000000_phase5_fixed_expenses' AND finished_at IS NOT NULL"` retorna 1 linha.
6. CI: `gh run list --branch master --limit 1` e `gh run watch <id> --exit-status`; só considerar pronto com o run verde (se falhar, investigar, corrigir, repetir gate + push + deploy).
7. Checagem no staging: `cd /root/sgs/apps/e2e && corepack pnpm exec playwright test -c playwright.audit.config.ts audit/previsao-staging.audit.ts` (desktop e mobile) verde.
8. Avisar no SUMMARY, em PT-BR, que a previsão está no ar no staging (URL https://sgs.jessicaseixasmakeup.com.br) e que o CI está verde, com o id do run.
  </action>
  <verify>
    <automated>cd /root/sgs && ls -1 /root/sgs-backups/stg-pre-phase5-forecast-*.sql.gz && test -z "$(git status --porcelain --untracked-files=no)" && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -qx success && (cd apps/e2e && corepack pnpm exec playwright test -c playwright.audit.config.ts audit/previsao-staging.audit.ts)</automated>
  </verify>
  <acceptance_criteria>
    - Existe `/root/sgs-backups/stg-pre-phase5-forecast-*.sql.gz` com mais de 20 KB, criado antes do deploy
    - `git log origin/master -1` igual a `git log master -1` (push feito)
    - `_prisma_migrations` do staging tem `20261106000000_phase5_fixed_expenses` com `finished_at` preenchido
    - `gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion'` imprime `success`
    - `previsao-staging.audit.ts` passa no staging nos projetos `desktop` e `mobile`
  </acceptance_criteria>
  <done>Previsão de 30 dias no ar no staging, com backup prévio, CI verde e checagem somente leitura aprovada.</done>
</task>

</tasks>

<verification>
- Gate completo verde; push; deploy; CI `success`; checagem no staging verde
</verification>

<success_criteria>
Critérios de sucesso 2, 3 e 4 entregues no staging (a verificação humana final com dados reais fica no plano 05-20).
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-07-SUMMARY.md`
</output>
