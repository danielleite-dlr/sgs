---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 01-foundation/01-ci-integration-PLAN.md — all 3 tasks complete. Phase 1 Foundation done.
last_updated: "2026-05-06T04:36:48.478Z"
last_activity: 2026-05-06
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 15
  completed_plans: 8
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02)

**Core value:** Profissional do beleza consegue agendar, atender, cobrar e comunicar com cliente em um único fluxo — sem sair da plataforma.
**Current focus:** Phase 1 complete — all 7 plans executed. Ready to begin Phase 2 (Core Domain) planning.

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 7 of 7 complete (Phase 1 Foundation fully done)
Status: Phase 1 complete — ready to plan Phase 2
Last activity: 2026-05-06

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

### Pending Todos

None yet.

### Blockers/Concerns

- **WABA registration**: Iniciar processo de verificação Meta Business antes do início da Phase 3 para não bloquear a Phase 5 (COMM-01 depende de WABA aprovado)
- **Payment gateway decision**: Pagar.me vs Stripe Connect deve ser decidido antes da Phase 3 — não pode ser postergado
- **pnpm concurrent installs**: Multiple parallel agent worktrees cause ENOENT conflicts on Windows when running pnpm install simultaneously. Workaround: stagger installs or use main repo node_modules.

## Session Continuity

Last session: 2026-05-06T04:36:48.452Z
Stopped at: Completed 01-foundation/01-ci-integration-PLAN.md — all 3 tasks complete. Phase 1 Foundation done.
Resume file: None
