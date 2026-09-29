---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 02.1-backend-members-lifecycle-PLAN.md (wave 1 of Phase 02.1) - frontend wave (02.1-frontend-profissionais) still pending
last_updated: "2026-09-29T02:52:41.884Z"
last_activity: "2026-09-28 - Completed quick task 260928-vk2: Corrigir setup do pnpm e health check do CI"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02)

**Core value:** Profissional do beleza consegue agendar, atender, cobrar e comunicar com cliente em um único fluxo — sem sair da plataforma.
**Current focus:** Phase 02 — core-domain

## Current Position

Phase: 3
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-09-28 - Completed quick task 260928-vk2: Corrigir setup do pnpm e health check do CI

Progress: [██████████] 100% (Phase 1 of 5)

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: ~90 min
- Total execution time: ~3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1: Foundation | 2 | ~180 min | ~90 min |

**Recent Trend:**

- Last 5 plans: ~90 min avg
- Trend: baseline established

*Updated after each plan completion*
| Phase 01-foundation P03 | 120 | 2 tasks | 33 files |
| Phase 01-foundation P04 | 527677min | 3 tasks | 22 files |
| Phase 01-foundation P05 | 68 | 2 tasks | 17 files |
| Phase 01-foundation P06 | 90 | 3 tasks | 24 files |
| Phase 01-foundation P07 | 45 | 2 tasks | 11 files |
| Phase 02-core-domain P01 | 14 | 3 tasks | 17 files |
| Phase 02-core-domain P02 | 120 | 3 tasks | 33 files |
| Phase 02-core-domain P05 | 45 | 2 tasks | 19 files |
| Phase 02-core-domain P04 | 6 | 3 tasks | 10 files |
| Phase 02-core-domain P03 | 55 | 3 tasks | 14 files |
| Phase 02-core-domain P08 | 45 | 3 tasks | 15 files |
| Phase 02-core-domain P06 | 75 | 3 tasks | 11 files |
| Phase 02-core-domain P07 | 23 | 3 tasks | 22 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pre-Phase 1: PgBouncer é obrigatório em transaction-mode — sem ele RLS vaza entre conexões de pool
- Pre-Phase 1: Iniciar verificação WABA (WhatsApp Business Account) com Meta imediatamente — processo demora 1–4 semanas, fora do controle da engenharia
- Pre-Phase 1: Decidir Pagar.me vs Stripe Connect antes de iniciar Phase 3 — design da interface PaymentGateway depende do modelo
- Plan 01-01: Valkey 8 chosen over Redis — MIT license, binary compatible with Redis 7.2
- Plan 01-01: Fastify adapter for NestJS — better throughput than Express
- Plan 01-01: AppConfigService typed wrapper pattern for env access across all NestJS modules
- Plan 01-01: Schema-first GraphQL SDL (typePaths pattern) — matches PRD specification
- Plan 01-02: Prisma 6 with directUrl for migrations (sgs_migrator/BYPASSRLS) + url for runtime (sgs_app via PgBouncer)
- Plan 01-02: 4 system roles — ADMIN, MANAGER, ATTENDANT, PROFESSIONAL with organization_id=NULL and is_system=true
- Plan 01-02: nullif(current_setting('app.current_organization', true), '')::uuid in all RLS policies — safe for RESET+PgBouncer empty-string edge case
- Plan 01-02: TenantContextService.$transaction wrapper with SET LOCAL for guaranteed isolation and auto-reset on commit
- [Phase 01-foundation]: Plan 01-03: Tailwind CSS 3 (not v4) for shadcn/ui compatibility per CLAUDE.md constraint
- [Phase 01-foundation]: Plan 01-03: Apollo Link chain is errorLink → authLink → httpLink; setContext used for auth header injection
- [Phase 01-foundation]: Plan 01-03: Auth store persists full session shape (accessToken, refreshToken, userId, memberId, organizationId, roleName, permissions) as sgs-auth in localStorage
- [Phase 01-foundation]: Auth errors returned as errors[] in payload (GraphQL errors-as-data), not thrown exceptions
- [Phase 01-foundation]: prisma.$transaction for signup (not TenantContextService) — no org context exists yet at signup time
- [Phase 01-foundation]: Refresh token reuse detection revokes entire family — compromise assumption
- [Phase 01-foundation]: auth.graphql uses extend type Query/Mutation — base types in root.graphql
- [Phase 01-foundation]: Permission check queries role_permissions DB table (not JWT payload) — permissions authoritative in DB, JWT carries only roleName
- [Phase 01-foundation]: Relaxed SELECT USING(true) on member_invitations — token_hash is the secret, application enforces WHERE token_hash = hash, modify ops remain tenant-scoped
- [Phase 01-foundation]: AuthService.issueSession refactored private→public for InvitationService.accept reuse without duplicating token-issuing logic
- [Phase 01-foundation]: Generic 'Aceitar convite' heading used for InvitationPage — AcceptInvitation mutation does not return orgName/inviterName; deferred to Phase 2 schema extension
- [Phase 01-foundation]: auth.api.ts uses manual gql tagged templates (not codegen) — codegen integration deferred to plan 07 (CI integration)
- [Phase 01-foundation]: PgBouncer AUTH_TYPE=trust chosen as dev workaround — scram-sha-256 incompatible with PG16 pool mode without auth_query; backend connects direct to postgres for dev; fix in plan 07
- [Phase 01-foundation]: sgs_app temporarily granted BYPASSRLS for dev — signup creates org without tenant context; fix in plan 07 via SECURITY DEFINER function or role split
- [Phase 01-foundation]: auth.api.ts uses manual gql tagged templates (not codegen) — codegen integration deferred to plan 07
- [Phase 01-foundation]: EMAIL_ADAPTER Symbol token (not string) for type-safe DI override — TestEmailAdapter used in integration tests via .overrideProvider
- [Phase 01-foundation]: full-auth-flow relogins after TOKEN_REUSE_DETECTED family revocation — both old and new tokens are invalid after family revoke
- [Phase 01-foundation]: frontend-codegen CI job asserts src/gql/graphql.ts (client-preset output dir), not src/types/graphql.ts
- [Phase 02-core-domain]: One consolidated Phase 2 migration owns all 11 new tables + members.seniority_tier — Wave 2 plans only add feature code to pre-staged modules
- [Phase 02-core-domain]: PackageService junction uses EXISTS subquery on packages for tenant isolation (no organization_id column on junction table)
- [Phase 02-core-domain]: commission_rules.value uses DECIMAL(12,4) for extra precision on percentage rates
- [Phase 02-core-domain]: AppShell uses Outlet pattern — layout route group with no path, ProtectedRoute wraps AppShell as element
- [Phase 02-core-domain]: SidebarNav Catálogo uses Collapsible defaultOpen=true; all nav labels from i18n t() — zero hardcoded strings
- [Phase 02-core-domain]: CPF stored as digits-only via normalizeCpf for consistent lookup regardless of input format
- [Phase 02-core-domain]: Member type owned by identity.graphql as single SDL source-of-truth for cross-SDL cross-module reference
- [Phase 02-core-domain]: clientHistory returns [] Phase 2 stub with Phase 3 aggregation slot reserved in ClientsService
- [Phase 02-core-domain]: adjustStock creates notifications inline within same Prisma tx rather than via NotificationsService — ensures atomicity between stock update and notification creation
- [Phase 02-core-domain]: stock_low notification is org-wide (memberId=null) — any member with NOTIFICATION_READ sees it; member-specific notifications reserved for future
- [Phase 02-core-domain]: integer-cents arithmetic for individualSum computation in packages (avoids IEEE-754 float issues)
- [Phase 02-core-domain]: categories.softDelete blocks on both active children AND active services — prevents orphaned service category references
- [Phase 02-core-domain]: CPF optional; duplicate alert warns but doesn't block save (D-22)
- [Phase 02-core-domain]: ClientHistoryTab shows disabled filters (not hidden) per D-23 — Phase 3 will activate
- [Phase 02-core-domain]: /clientes/novo ordered before /clientes/:id in router to prevent React Router collision
- [Phase 02-core-domain]: Plan 06: gql tagged templates used in catalog API (not codegen client-preset) — consistent with auth.api.ts established pattern, codegen deferred to CI plan
- [Phase 02-core-domain]: Plan 06: ConfirmSoftDeleteDialog accepts ReactNode trigger with e.preventDefault on onSelect to prevent DropdownMenu closing before AlertDialog opens
- [Phase 02-core-domain]: AdjustStockDialog uses cache.evict pattern (not hardcoded refetchQueries variables) to avoid variable-mismatch with ProdutosPage's lowStockOnly state
- [Phase 02-core-domain]: AppShell self-fetches lowStockCount with pollInterval 60s — removed prop-based approach since router passes AppShell with no props
- [Phase 02-core-domain]: EntityCombobox is generic Popover+Command single-select reused across member/service/product pickers in CommissionRuleForm
- [Phase quick]: Quick-260928-vk2: jq -s 'flatten | ...' (slurp+flatten) e' o padrao para parsing de docker compose ps --format json em CI, tolerante a JSON Lines e array
- [Phase 02.1-equipe-e-profissionais-cadastro-completo-de-profissionais]: Backend wave (members-lifecycle): member_invitations gained is_professional/seniority_tier columns (Member untouched); deactivate blocks on future appointments only, commission rules inform via activeCommissionRuleCount; fixed pre-existing RLS bug in InvitationResolver.invite (unscoped organization lookup)

### Pending Todos

- **CI: falta `prisma generate` nos jobs `typecheck` e `lint`** (adiado em 2026-09-29). Ambos rodam `pnpm install --frozen-lockfile` e vao direto para `tsc`/`eslint` sem gerar o Prisma client, produzindo ~20 erros com uma unica causa raiz (`Prisma.ClientWhereInput` e `PrismaClientKnownRequestError` inexistentes, `tx`/`rows`/`r` com any implicito). O `ci.yml` ja tem `pnpm prisma:generate` na linha 69, mas so dentro do job `integration`; nao ha hook `postinstall` em nenhum package.json. Correcao: uma linha por job. Evidencia: run 36510415854.
- **CI: `pgbouncer` sem healthcheck no `docker-compose.yml`** (adiado em 2026-09-29). O job `integration` espera que todos os servicos nao-excluidos reportem `"healthy"`, mas `docker-compose.yml:29-49` define o pgbouncer sem bloco `healthcheck:`, entao ele nunca reporta estado e o loop estoura as 60 iteracoes. Estava mascarado pelo bug de parsing jq corrigido no quick 260928-vk2. Saidas: dar healthcheck ao pgbouncer (preferivel — INFRA-02 depende dele) ou excluir da lista de espera. Evidencia: run 36510415854.

- **Testes de RBAC e auth nunca rodaram — 4 arquivos invisiveis para o Jest** (descoberto em 2026-09-29 pelo plan-checker da fase 02.1, confirmado empiricamente). `apps/backend/jest-integration.config.ts:7` usa `testRegex: '.*\.spec\.ts$'`, que exige PONTO antes de `spec.ts`. Os arquivos `rbac.e2e-spec.ts`, `invitation.e2e-spec.ts`, `auth.e2e-spec.ts` e `full-auth-flow.e2e-spec.ts` usam HIFEN e nunca sao descobertos — ou seja, a cobertura de RBAC e do fluxo completo de autenticacao nunca executou, apesar de a Fase 1 ter sido marcada completa com eles no plano. Correcao: renomear os 4 para `.e2e.spec.ts` e rodar, esperando que falhas reais aparecam. Nao feito agora para nao virar desvio grande no meio da fase 02.1.
- **`pnpm test:e2e` aponta para config inexistente** (mesmo contexto). `apps/backend/package.json:18` roda `jest --config ./test/jest-e2e.json`, mas `apps/backend/test/jest-e2e.json` nao existe no repo. O comando falha imediatamente. Decidir: criar a config ou remover o script.

### Blockers/Concerns

- **WABA registration**: Iniciar processo de verificação Meta Business antes do início da Phase 3 para não bloquear a Phase 5 (COMM-01 depende de WABA aprovado)
- **Payment gateway decision**: Pagar.me vs Stripe Connect deve ser decidido antes da Phase 3 — não pode ser postergado
- **pnpm concurrent installs**: Multiple parallel agent worktrees cause ENOENT conflicts on Windows when running pnpm install simultaneously. Workaround: stagger installs or use main repo node_modules.

### Roadmap Evolution

- Phase 02.1 inserted after Phase 2: Equipe e profissionais — cadastro completo de profissionais (URGENT)
- Phase 02.1 executada 2026-09-29: 2 waves, 2/2 planos. Backend e frontend mesclados no master. Falta a verificacao manual ponta a ponta do criterio do M1 (convite -> aceite -> aparece em /profissionais, /agenda e /catalogo/comissoes), que exige as duas apps no ar.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260922-0kn | Exibir a comissao cadastrada do servico (tipo e valor) na tela de editar servico | 2026-09-22 | 9df355f | [260922-0kn-exibir-a-comissao-cadastrada-do-servico-](./quick/260922-0kn-exibir-a-comissao-cadastrada-do-servico-/) |
| 260928-vk2 | Corrigir setup do pnpm (ERR_PNPM_BAD_PM_VERSION) e parsing jq do health check do CI (JSON Lines) | 2026-09-28 | 31d6bdf | [260928-vk2-corrigir-setup-do-pnpm-e-health-check-do](./quick/260928-vk2-corrigir-setup-do-pnpm-e-health-check-do/) |

## Session Continuity

Last session: 2026-09-29T02:52:41.875Z
Stopped at: Completed 02.1-backend-members-lifecycle-PLAN.md (wave 1 of Phase 02.1) - frontend wave (02.1-frontend-profissionais) still pending
Resume file: None
