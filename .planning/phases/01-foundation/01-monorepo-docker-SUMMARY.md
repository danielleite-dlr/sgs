---
phase: "01"
plan: "01"
name: monorepo-docker
subsystem: infrastructure
tags: [monorepo, docker, nestjs, react, pnpm, devenv]
dependency_graph:
  requires: []
  provides: [monorepo-root, backend-app, frontend-app, docker-compose, env-config]
  affects: [all-future-plans]
tech_stack:
  added:
    - pnpm workspaces (monorepo)
    - NestJS 10 + Fastify adapter
    - React 19 + Vite 6
    - Node.js 22 LTS
    - TypeScript 5.7 (strict)
    - PostgreSQL 16-alpine (Docker)
    - PgBouncer transaction-mode (Docker)
    - Valkey 8-alpine AOF (Docker)
    - Meilisearch v1.7 (Docker)
    - Zod 3 (env validation)
    - Apollo Server 4 + NestJS GraphQL 12 (schema-first SDL)
  patterns:
    - pnpm workspace monorepo (apps/backend + apps/frontend)
    - Multi-stage Docker builds (development + production targets)
    - Zod-validated typed environment configuration
    - Schema-first GraphQL SDL
    - Global NestJS ConfigModule with typed AppConfigService wrapper
key_files:
  created:
    - package.json (monorepo root with pnpm workspaces)
    - pnpm-workspace.yaml
    - tsconfig.base.json (strict ES2022, Node16 modules)
    - .gitignore
    - .npmrc
    - Makefile (developer workflow targets)
    - docker-compose.yml (6 services)
    - .env.example (all required env vars documented)
    - apps/backend/package.json
    - apps/backend/tsconfig.json
    - apps/backend/tsconfig.build.json
    - apps/backend/nest-cli.json
    - apps/backend/Dockerfile
    - apps/backend/src/main.ts
    - apps/backend/src/app.module.ts
    - apps/backend/src/health/health.controller.ts
    - apps/backend/src/health/health.module.ts
    - apps/backend/src/config/env.schema.ts
    - apps/backend/src/config/configuration.ts
    - apps/backend/src/config/app-config.service.ts
    - apps/backend/src/config/config.module.ts
    - apps/backend/src/schema/root.graphql
    - apps/frontend/package.json
    - apps/frontend/tsconfig.json
    - apps/frontend/tsconfig.node.json
    - apps/frontend/vite.config.ts
    - apps/frontend/index.html
    - apps/frontend/src/main.tsx
    - apps/frontend/src/App.tsx
    - apps/frontend/Dockerfile
    - apps/frontend/nginx.conf
    - apps/frontend/public/favicon.svg
    - infra/postgres/init/01-create-roles.sql
  modified: []
decisions:
  - "Node.js 22 LTS chosen (not 20) — Node 20 enters Maintenance Apr 2026"
  - "React 19 + Vite 6 chosen as most current stable releases for greenfield"
  - "Valkey 8 instead of Redis — MIT license vs RSALv2/SSPL, binary compatible"
  - "pnpm workspaces without Turborepo — sufficient for 2 apps, add later if CI is slow"
  - "Schema-first GraphQL SDL (typePaths pattern) as specified in PRDs"
  - "Fastify adapter for NestJS (performance over Express)"
  - "AppConfigService typed wrapper pattern for typed env access across modules"
  - "Multi-stage Dockerfiles with development and production targets"
  - "PgBouncer transaction-mode declared from day 1 — non-negotiable per CONTEXT.md"
metrics:
  duration_minutes: 8
  tasks_completed: 6
  files_created: 32
  completed_date: "2026-05-03"
---

# Phase 1 Plan 1: Monorepo + Docker Compose Setup — Summary

**One-liner:** pnpm monorepo with NestJS/Fastify backend, React 19/Vite 6 frontend, and Docker Compose running PostgreSQL 16, PgBouncer (transaction-mode), Valkey 8, and Meilisearch — all wired with Zod-validated typed environment configuration.

## What Was Built

A complete development environment scaffold for the SGS platform:

1. **Monorepo root** — pnpm workspaces pointing to `apps/*`, strict TypeScript base config, `.gitignore`, `.npmrc`

2. **NestJS backend** (`apps/backend/`) — Fastify adapter, schema-first GraphQL via Apollo, `ConfigModule` with Zod validation, typed `AppConfigService` wrapper, GET `/health` endpoint

3. **React frontend** (`apps/frontend/`) — React 19, Vite 6, strict TypeScript, path aliases (`@/*`), placeholder app with SGS branding colors from UI spec

4. **Docker Compose** — 6 services: postgres:16, pgbouncer (transaction-mode), valkey:8 (AOF), meilisearch:v1.7, backend, frontend

5. **Environment configuration** — Zod schema validates all required env vars at startup, `.env.example` documents every variable with inline explanations

6. **Developer tools** — `Makefile` with `make up/down/logs/dev/clean/prisma-*` targets, multi-stage Dockerfiles for dev and prod

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c24960d | chore(01-01): initialize pnpm monorepo root |
| 2 | 8dc7c9a | feat(01-01): scaffold apps/backend NestJS application |
| 3 | a7b331a | feat(01-01): scaffold apps/frontend React 19 + Vite application |
| 4 | b4ebfdc | chore(01-01): add Docker Compose for development environment |
| 5 | f2d91fa | feat(01-01): add typed environment configuration with Zod validation |
| 6 | 8a35cb0 | chore(01-01): add Makefile with developer workflow targets |
| - | ff663b4 | docs(01-01): create monorepo-docker plan file |

## Key Architecture Decisions

- **Valkey 8 vs Redis**: Chosen for MIT license (Redis 7.4+ is RSALv2/SSPL which is restrictive for SaaS). Valkey is binary compatible — no code changes needed.
- **PgBouncer transaction-mode**: Critical from day 1. `SET LOCAL app.current_tenant_id` is scoped to the transaction, not the connection — this is the RLS isolation mechanism. Declared in Docker Compose immediately, not retrofitted later.
- **Schema-first GraphQL**: SDL lives in `src/**/*.graphql` files, processed by `typePaths`. This matches the PRD requirement for schema-first SDL and enables proper codegen.
- **AppConfigService pattern**: Rather than injecting raw `ConfigService`, all modules will inject `AppConfigService` for type-safe, infer-typed access to env vars.
- **Fastify adapter**: NestJS on Fastify for better throughput than Express — no API surface change for consumers.

## Database Role Architecture

`infra/postgres/init/01-create-roles.sql` creates the two required PostgreSQL roles:
- `sgs_migrator`: Gets `BYPASSRLS` — used exclusively by Prisma for migrations (DIRECT_DATABASE_URL)
- `sgs_app`: No RLS bypass — used by the NestJS app at runtime via PgBouncer (DATABASE_URL)

This two-role pattern ensures that even if a bug bypasses Prisma middleware, the `sgs_app` role still cannot read other tenants' data at the database level.

## What's Next

This scaffold enables Plan 02 (Prisma schema + RLS implementation):
- The `DATABASE_URL` (PgBouncer) and `DIRECT_DATABASE_URL` (direct) URLs are already defined
- The `sgs_migrator` and `sgs_app` roles are ready in the DB init script
- The `AppConfigService` provides typed access to `databaseUrl` and `directDatabaseUrl`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified to exist:
- FOUND: pnpm-workspace.yaml
- FOUND: package.json (with workspaces: ["apps/*"])
- FOUND: tsconfig.base.json
- FOUND: apps/backend/package.json (name: @sgs/backend)
- FOUND: apps/backend/src/main.ts
- FOUND: apps/frontend/package.json (name: @sgs/frontend)
- FOUND: apps/frontend/src/main.tsx
- FOUND: docker-compose.yml (6 services: postgres, pgbouncer, valkey, meilisearch, backend, frontend)
- FOUND: .env.example
- FOUND: apps/backend/Dockerfile
- FOUND: apps/backend/src/config/env.schema.ts
- FOUND: Makefile (18 targets)

Commits verified:
- c24960d, 8dc7c9a, a7b331a, b4ebfdc, f2d91fa, 8a35cb0, ff663b4 — all present in git log
