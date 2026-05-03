---
phase: "01"
plan: "01"
name: monorepo-docker
type: implementation
autonomous: true
wave: 1
depends_on: []
requirements: [INFRA-01]
---

# Plan 01-01: Monorepo + Docker Compose Setup

## Objective

Establish the pnpm monorepo structure with `apps/backend` (NestJS) and `apps/frontend` (React + Vite), and a Docker Compose configuration that boots all infrastructure services (PostgreSQL 16, Valkey 8, Meilisearch, PgBouncer) and app containers ready for development.

## Context

- @.planning/phases/01-foundation/01-CONTEXT.md
- @.planning/research/STACK.md

## Tasks

### Task 1: Initialize pnpm monorepo root
type="auto"

Initialize the monorepo at the repo root with:
- `package.json` with `pnpm workspaces` pointing to `apps/*`
- `pnpm-workspace.yaml`
- `.npmrc` with `shamefully-hoist=false` and `strict-peer-dependencies=false`
- Root-level `.gitignore` covering node_modules, dist, .env files, prisma generated client
- `tsconfig.base.json` at root with strict TypeScript settings (Node 22 target)

Done criteria: `pnpm-workspace.yaml` exists, `package.json` has `"workspaces": ["apps/*"]`.

### Task 2: Scaffold apps/backend (NestJS)
type="auto"

Create `apps/backend/` with:
- `package.json` for NestJS app (name: `@sgs/backend`)
- NestJS CLI-compatible structure: `src/main.ts`, `src/app.module.ts`
- Required backend dependencies: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify`, `@nestjs/graphql`, `@nestjs/apollo`, `@apollo/server`, `graphql`, `@nestjs/config`, `zod`, `prisma`, `@prisma/client`
- Dev dependencies: `typescript`, `@types/node`, `ts-node`, `@nestjs/cli`, `@nestjs/testing`, `jest`, `@types/jest`, `ts-jest`
- `tsconfig.json` extending root base
- `nest-cli.json`
- Basic health check: NestJS app that starts on port 3000 with a `/health` HTTP GET endpoint returning `{ status: "ok" }`

Done criteria: `apps/backend/package.json` exists with name `@sgs/backend`, `apps/backend/src/main.ts` exists.

### Task 3: Scaffold apps/frontend (React + Vite)
type="auto"

Create `apps/frontend/` with:
- `package.json` for React app (name: `@sgs/frontend`)
- Vite + React 19 + TypeScript
- Dependencies: `react`, `react-dom`, `@vitejs/plugin-react`, `typescript`
- `vite.config.ts` with React plugin, dev server on port 5173
- `tsconfig.json` with strict settings
- `index.html` + `src/main.tsx` + `src/App.tsx` (minimal placeholder: "SGS — Loading...")

Done criteria: `apps/frontend/package.json` exists with name `@sgs/frontend`, `apps/frontend/src/main.tsx` exists.

### Task 4: Docker Compose for development
type="auto"

Create `docker-compose.yml` at repo root with services:
- `postgres`: postgres:16-alpine, port 5432, volume for data persistence, health check, env vars for POSTGRES_USER/PASSWORD/DB
- `pgbouncer`: edoburu/pgbouncer:latest (or bitnami/pgbouncer), port 5433, transaction-mode, connects to postgres
- `valkey`: valkey/valkey:8-alpine, port 6379, AOF persistence (`--appendonly yes`), health check
- `meilisearch`: getmeili/meilisearch:v1.7, port 7700, volume for data, MEILI_MASTER_KEY env var
- `backend`: builds from apps/backend, port 3000, depends_on postgres/pgbouncer/valkey
- `frontend`: builds from apps/frontend, port 5173, depends_on backend

Also create:
- `.env.example` at repo root with all required environment variables
- `apps/backend/Dockerfile` (multi-stage: build + runtime, Node 22 Alpine)
- `apps/frontend/Dockerfile` (multi-stage: build with Vite, runtime with nginx)

Done criteria: `docker-compose.yml` exists with all 6 services, `apps/backend/Dockerfile` exists.

### Task 5: Environment configuration and validation
type="auto"

Create environment configuration:
- `apps/backend/src/config/env.schema.ts` — Zod schema validating all required env vars (DATABASE_URL, DIRECT_DATABASE_URL, REDIS_URL, MEILISEARCH_URL, MEILISEARCH_KEY, JWT_SECRET, JWT_REFRESH_SECRET, NODE_ENV, PORT)
- `apps/backend/src/config/configuration.ts` — NestJS config factory returning typed config
- Wire `ConfigModule.forRoot()` in `AppModule` with Zod validation

Done criteria: `apps/backend/src/config/env.schema.ts` exists with Zod schema.

### Task 6: Makefile / developer scripts
type="auto"

Create `Makefile` at repo root with targets:
- `make dev` — starts docker-compose in detached mode + watches logs for backend and frontend
- `make up` — `docker compose up -d`
- `make down` — `docker compose down`
- `make logs` — `docker compose logs -f`
- `make ps` — `docker compose ps`
- `make install` — `pnpm install`
- `make clean` — stops containers, removes volumes

Also add scripts to root `package.json`:
- `"dev"`: `docker compose up -d && pnpm --filter @sgs/backend dev & pnpm --filter @sgs/frontend dev`
- `"install:all"`: `pnpm install`

Done criteria: `Makefile` exists with all 7 targets.

## Verification

1. `pnpm install` runs without error from repo root
2. `docker compose config` validates without errors
3. `apps/backend/src/main.ts` compiles with TypeScript
4. All required env vars documented in `.env.example`
5. No circular dependencies in packages

## Success Criteria

- pnpm workspace resolves both apps
- Docker Compose declares all 6 services: postgres, pgbouncer, valkey, meilisearch, backend, frontend
- Backend NestJS app has health endpoint at `/health`
- Frontend Vite app renders placeholder page
- `.env.example` documents all required configuration
- Developer can run `make up` to start all infrastructure
