# SGS — Plataforma de Gestão para Salões

Sistema SaaS multi-tenant de gestão para salões de beleza, barbearias, clínicas estéticas e estúdios de noivas.

**Stack:** Node.js 22 + NestJS 10 + GraphQL + Prisma 6 + PostgreSQL 16 + Valkey 8 (Redis-compatible) | React 19 + Vite 6 + Tailwind 3 + shadcn/ui

## Quick start (local dev)

Prerequisites: Docker Desktop (with D: drive shared if running on D:), pnpm 9, Node 22.

```bash
pnpm install
cp .env.example .env
docker compose up -d --build           # ~3-5 min on first run
# Apply migrations (one-time, or after pulling new migration files)
docker compose exec backend pnpm prisma:migrate:deploy
```

Open:
- Frontend: http://localhost:5173
- Backend GraphQL: http://localhost:3000/graphql
- Backend health: http://localhost:3000/health

Sign up at http://localhost:5173/signup → check `docker compose logs backend | grep email-fallback` for the verification link → verify → log in.

## Architecture

| Layer | Tech |
|-------|------|
| Multi-tenancy | PostgreSQL Row-Level Security with `FORCE ROW LEVEL SECURITY` on every tenant-scoped table |
| DB pooling | PgBouncer in transaction mode (mandatory for `SET LOCAL app.current_organization` correctness) |
| DB roles | `sgs_migrator` (BYPASSRLS, migrations only) and `sgs_app` (no BYPASSRLS, application runtime) |
| Auth | JWT access (15min, HS256) + opaque refresh tokens (30d, Argon2id-hashed, family rotation) |
| RBAC | 4 roles (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL); permissions defined in code |
| Email | Resend adapter in production; TestEmailAdapter for integration tests (in-memory capture) |

## Phase 1 Success Criteria — how to verify

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | docker compose boots in <5min | CI job `boot-time` enforces; locally: `time docker compose up -d` |
| 2 | User can sign up + log in + session persists across refresh | Manual: signup → verify email → login → hard-refresh browser → still logged in |
| 3 | PROFESSIONAL gets error on admin-only routes | Automated: CI runs `apps/backend/test/integration/rbac.e2e-spec.ts` |
| 4 | sgs_app cannot read other-org data | Automated: CI runs `apps/backend/test/integration/rls-isolation.spec.ts` |
| 5 | PgBouncer in transaction-mode + SET LOCAL no leak | Automated: CI step "Confirm PgBouncer is in transaction mode" + RLS test 7 |

## Repo layout

```
apps/
  backend/   NestJS GraphQL API — see apps/backend/README.md
  frontend/  React 19 + Vite SPA — see apps/frontend/README.md
infra/       postgres init scripts, pgbouncer config
.planning/   Phase plans, requirements, roadmap (managed by /gsd commands)
PRD_*.md     Product requirements (backend, database, frontend) and SDD
```

## Common commands

| Task | Command |
|------|---------|
| Boot stack | `docker compose up -d` |
| Stop stack | `docker compose down` |
| Reset DB (DROP all data) | `docker compose down -v && docker compose up -d` |
| Apply migrations | `docker compose exec backend pnpm prisma:migrate:deploy` |
| Open Prisma Studio | `docker compose exec backend pnpm prisma studio` |
| Backend logs | `docker compose logs -f backend` |
| Frontend logs | `docker compose logs -f frontend` |
| Run integration tests | `cd apps/backend && pnpm test:integration` |
| Typecheck everything | `pnpm -r typecheck` |
