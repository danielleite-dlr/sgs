---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-workspace.yaml
  - .gitignore
  - .editorconfig
  - .env.example
  - .nvmrc
  - docker-compose.yml
  - docker/postgres/Dockerfile
  - docker/postgres/init/00-extensions.sql
  - docker/postgres/init/01-roles.sql
  - docker/pgbouncer/pgbouncer.ini
  - docker/pgbouncer/userlist.txt
  - docker/valkey/valkey.conf
  - docker/meilisearch/.gitkeep
  - apps/backend/package.json
  - apps/backend/tsconfig.json
  - apps/backend/src/main.ts
  - apps/backend/src/app.module.ts
  - apps/backend/Dockerfile
  - apps/frontend/package.json
  - apps/frontend/tsconfig.json
  - apps/frontend/Dockerfile
  - apps/frontend/index.html
  - apps/frontend/src/main.tsx
  - apps/frontend/src/App.tsx
  - apps/frontend/vite.config.ts
  - README.md
autonomous: false
requirements: [INFRA-01, INFRA-03]
user_setup:
  - service: docker
    why: "Local dev requires Docker Desktop or compatible daemon to run docker compose"
    env_vars: []
    dashboard_config:
      - task: "Install Docker Desktop and ensure it is running"
        location: "https://www.docker.com/products/docker-desktop/"

must_haves:
  truths:
    - "Developer runs `docker compose up -d` and all services (postgres, pgbouncer, valkey, meilisearch, backend, frontend) become healthy in under 5 minutes"
    - "Backend container exposes :3000 (NestJS bootstrap) and frontend container exposes :5173 (Vite dev server)"
    - "PostgreSQL 16 is reachable on host :5432 via pgbouncer transaction-mode pooling on :6432"
    - "Valkey 8 is reachable on :6379 with AOF persistence enabled (`appendonly yes`)"
    - "pnpm workspaces resolve `apps/backend` and `apps/frontend` from repo root"
  artifacts:
    - path: "docker-compose.yml"
      provides: "Multi-service local dev stack (postgres, pgbouncer, valkey, meilisearch, backend, frontend)"
      contains: "services:"
    - path: "pnpm-workspace.yaml"
      provides: "Monorepo workspace declaration"
      contains: "apps/*"
    - path: "apps/backend/src/main.ts"
      provides: "NestJS bootstrap entrypoint"
      min_lines: 5
    - path: "apps/frontend/src/main.tsx"
      provides: "React 19 bootstrap entrypoint"
      min_lines: 5
    - path: "docker/pgbouncer/pgbouncer.ini"
      provides: "PgBouncer transaction-mode config"
      contains: "pool_mode = transaction"
    - path: "docker/valkey/valkey.conf"
      provides: "Valkey persistence config"
      contains: "appendonly yes"
  key_links:
    - from: "docker-compose.yml backend service"
      to: "pgbouncer:6432"
      via: "DATABASE_URL env var"
      pattern: "pgbouncer:6432"
    - from: "docker-compose.yml backend service"
      to: "valkey:6379"
      via: "REDIS_URL env var"
      pattern: "valkey:6379"
    - from: "pgbouncer"
      to: "postgres:5432"
      via: "pgbouncer.ini upstream"
      pattern: "host=postgres"
---

<objective>
Establish the SGS monorepo skeleton with pnpm workspaces, NestJS backend stub, React 19 frontend stub, and a Docker Compose stack that boots PostgreSQL 16 + PgBouncer (transaction-mode) + Valkey 8 (AOF) in under 5 minutes.

Purpose: Every subsequent plan in this phase requires the file layout, container topology, and pooled DB connectivity defined here. Without this, no backend module, no migration, and no frontend page can run.

Output: A repo where `pnpm install && docker compose up -d` boots a working dev environment.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-foundation/01-CONTEXT.md
@CLAUDE.md
@PRD_Backend_Plataforma_Saloes.md
@PRD_Banco_Dados_Plataforma_Saloes_v1.1.md
@PRD_Frontend_Plataforma_Saloes.md
@SDD_Plataforma_Saloes_v1.1.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md

<interfaces>
<!-- No prior plan interfaces — this is the foundation plan. -->
<!-- Locked decisions from CONTEXT.md that drive this plan: -->

D-01: Node.js 22 LTS (NOT 20)
D-02: Prisma 6 (NOT 5) — installed in plan 02, but reserve in package.json
D-03: React 19 (NOT 18)
D-04: Valkey 8 (NOT Redis — MIT-licensed Redis 7.2 binary-compatible fork)
D-05: Vite, NestJS, Tailwind — latest stable at implementation time (Tailwind 3, NOT 4 per UI-SPEC compatibility note)
D-06: pnpm workspaces (NO Turborepo / Nx)
D-07: `apps/backend/` + `apps/frontend/` at monorepo root

PgBouncer transaction-mode is NON-NEGOTIABLE per CONTEXT.md `<specifics>` and PITFALLS.md "RLS Bypass via Connection Pool" — session-mode pooling leaks `SET LOCAL app.current_organization` between tenants.

Valkey AOF persistence (`appendonly yes`) is mandatory per INFRA-03 — without it, BullMQ jobs are lost on Redis restart (PITFALLS.md "Lost Jobs on Redis Restart").
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Initialize pnpm monorepo skeleton with backend and frontend stubs</name>
  <files>package.json, pnpm-workspace.yaml, .gitignore, .editorconfig, .nvmrc, .env.example, README.md, apps/backend/package.json, apps/backend/tsconfig.json, apps/backend/src/main.ts, apps/backend/src/app.module.ts, apps/backend/nest-cli.json, apps/frontend/package.json, apps/frontend/tsconfig.json, apps/frontend/tsconfig.node.json, apps/frontend/vite.config.ts, apps/frontend/index.html, apps/frontend/src/main.tsx, apps/frontend/src/App.tsx</files>
  <read_first>
    - CLAUDE.md (stack constraints)
    - .planning/phases/01-foundation/01-CONTEXT.md (locked decisions D-01 through D-08)
    - PRD_Backend_Plataforma_Saloes.md §3.1 Layout de pastas (backend folder structure)
    - PRD_Frontend_Plataforma_Saloes.md §3.1 Layout de pastas (frontend folder structure)
  </read_first>
  <action>
    **PER D-06, D-07: pnpm workspaces with apps/backend + apps/frontend at root.**

    Create root `package.json` with:
    - `"name": "sgs"`, `"private": true`, `"version": "0.1.0"`
    - `"packageManager": "pnpm@9.12.0"` (or latest pnpm 9 stable)
    - `"engines": { "node": ">=22.0.0" }` (per D-01 Node 22 LTS)
    - scripts: `"dev": "pnpm -r --parallel dev"`, `"build": "pnpm -r build"`, `"test": "pnpm -r test"`, `"lint": "pnpm -r lint"`, `"typecheck": "pnpm -r typecheck"`
    - devDependencies: `typescript@^5.6.0`, `@types/node@^22.0.0`, `prettier@^3.3.0`

    Create `pnpm-workspace.yaml`:
    ```yaml
    packages:
      - "apps/*"
      - "packages/*"
    ```

    Create `.nvmrc` with content: `22` (single line)

    Create `.editorconfig` (UTF-8, LF, 2-space indent for code, trim trailing whitespace).

    Create `.gitignore` covering: `node_modules/`, `dist/`, `build/`, `.env`, `.env.local`, `*.log`, `coverage/`, `.turbo/`, `.next/`, `.nest/`, `.cache/`, `prisma/migrations/dev_*`, `.DS_Store`.

    Create `.env.example` with all variables future plans will need (commented placeholders only — no real secrets):
    ```
    # PostgreSQL (direct, used only by sgs_migrator role for migrations)
    POSTGRES_HOST=postgres
    POSTGRES_PORT=5432
    POSTGRES_DB=sgs
    POSTGRES_MIGRATOR_USER=sgs_migrator
    POSTGRES_MIGRATOR_PASSWORD=change_me_migrator
    POSTGRES_APP_USER=sgs_app
    POSTGRES_APP_PASSWORD=change_me_app

    # PgBouncer (used by application runtime — transaction-mode pool)
    DATABASE_URL=postgresql://sgs_app:change_me_app@pgbouncer:6432/sgs?pgbouncer=true&connection_limit=10
    DIRECT_URL=postgresql://sgs_migrator:change_me_migrator@postgres:5432/sgs

    # Valkey (Redis-compatible)
    REDIS_URL=redis://valkey:6379

    # Meilisearch (search engine — Phase 1 ships container; backend integration in later phase)
    MEILI_HOST=http://meilisearch:7700
    MEILI_MASTER_KEY=change_me_meili_master_key_at_least_16_chars

    # JWT
    JWT_ACCESS_SECRET=change_me_at_least_32_chars_long_xxxxx
    JWT_REFRESH_SECRET=change_me_at_least_32_chars_long_yyyyy
    JWT_ACCESS_TTL=15m
    JWT_REFRESH_TTL=30d

    # Email (Resend) — used in plan 04 for email verification
    RESEND_API_KEY=
    RESEND_FROM_EMAIL=no-reply@sgs.local
    APP_URL=http://localhost:5173

    # Backend
    BACKEND_PORT=3000
    NODE_ENV=development
    ```

    Create `README.md` with: project name, one-paragraph description from CLAUDE.md, "Quick start" section with commands `pnpm install`, `cp .env.example .env`, `docker compose up -d`, `docker compose logs -f backend`, and a table listing services (postgres:5432, pgbouncer:6432, valkey:6379, meilisearch:7700, backend:3000, frontend:5173).

    **Backend stub (apps/backend/):**

    `apps/backend/package.json`:
    - `"name": "@sgs/backend"`, `"version": "0.1.0"`, `"private": true`
    - scripts: `"dev": "nest start --watch"`, `"build": "nest build"`, `"start": "node dist/main"`, `"test": "jest"`, `"lint": "eslint src --ext .ts"`, `"typecheck": "tsc --noEmit"`
    - dependencies: `@nestjs/common@^10.4.0`, `@nestjs/core@^10.4.0`, `@nestjs/platform-express@^10.4.0`, `reflect-metadata@^0.2.2`, `rxjs@^7.8.1`
    - devDependencies: `@nestjs/cli@^10.4.0`, `@nestjs/schematics@^10.2.0`, `@nestjs/testing@^10.4.0`, `@types/express@^4.17.21`, `@types/jest@^29.5.13`, `@types/node@^22.0.0`, `jest@^29.7.0`, `ts-jest@^29.2.5`, `ts-node@^10.9.2`, `typescript@^5.6.0`

    `apps/backend/tsconfig.json`: target ES2023, module commonjs, decorators enabled (`experimentalDecorators: true`, `emitDecoratorMetadata: true`), strict mode, baseUrl `./`, `outDir: "./dist"`, `rootDir: "./src"`.

    `apps/backend/nest-cli.json`: `{ "$schema": "https://json.schemastore.org/nest-cli", "collection": "@nestjs/schematics", "sourceRoot": "src", "compilerOptions": { "deleteOutDir": true } }`

    `apps/backend/src/main.ts`:
    ```typescript
    import { NestFactory } from '@nestjs/core';
    import { AppModule } from './app.module';

    async function bootstrap() {
      const app = await NestFactory.create(AppModule);
      const port = Number(process.env.BACKEND_PORT) || 3000;
      await app.listen(port, '0.0.0.0');
      console.log(`[sgs-backend] listening on :${port}`);
    }
    bootstrap();
    ```

    `apps/backend/src/app.module.ts`:
    ```typescript
    import { Module, Controller, Get } from '@nestjs/common';

    @Controller('health')
    class HealthController {
      @Get()
      check() {
        return { status: 'ok', service: 'sgs-backend', timestamp: new Date().toISOString() };
      }
    }

    @Module({ controllers: [HealthController] })
    export class AppModule {}
    ```

    **Frontend stub (apps/frontend/):**

    `apps/frontend/package.json`:
    - `"name": "@sgs/frontend"`, `"type": "module"`, `"private": true`
    - scripts: `"dev": "vite"`, `"build": "tsc -b && vite build"`, `"preview": "vite preview"`, `"test": "vitest run"`, `"lint": "eslint src --ext .ts,.tsx"`, `"typecheck": "tsc --noEmit"`
    - dependencies (per D-03 React 19): `react@^19.0.0`, `react-dom@^19.0.0`
    - devDependencies: `@types/react@^19.0.0`, `@types/react-dom@^19.0.0`, `@vitejs/plugin-react@^4.3.0`, `typescript@^5.6.0`, `vite@^6.0.0`

    `apps/frontend/vite.config.ts`:
    ```typescript
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';

    export default defineConfig({
      plugins: [react()],
      server: { host: '0.0.0.0', port: 5173, strictPort: true },
    });
    ```

    `apps/frontend/index.html`: minimal HTML5 doc with `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`. Title: `SGS — Plataforma de Gestão para Salões`.

    `apps/frontend/src/main.tsx`:
    ```typescript
    import { StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    import App from './App';

    createRoot(document.getElementById('root')!).render(
      <StrictMode><App /></StrictMode>
    );
    ```

    `apps/frontend/src/App.tsx`: returns a single `<main>` with `<h1>SGS</h1>` placeholder. Real auth pages come in plan 06.

    `apps/frontend/tsconfig.json`: target ES2022, module ESNext, jsx react-jsx, strict, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `moduleResolution: "bundler"`.

    `apps/frontend/tsconfig.node.json`: target ES2022, module ESNext, types `["node"]`, for vite.config.ts only.
  </action>
  <verify>
    <automated>cd d:/SGS && pnpm install --frozen-lockfile=false && pnpm --filter @sgs/backend typecheck && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - File `pnpm-workspace.yaml` exists and contains literal string `apps/*`
    - File `package.json` exists at repo root and contains literal string `"engines"` with `"node": ">=22.0.0"`
    - File `.nvmrc` exists with content matching `^22$` (single line "22")
    - File `apps/backend/src/main.ts` contains both `NestFactory.create` and `AppModule`
    - File `apps/backend/src/app.module.ts` contains literal string `@Module(`
    - File `apps/frontend/src/main.tsx` contains both `createRoot` and `StrictMode`
    - File `apps/frontend/package.json` contains `"react": "^19` (anchors React 19)
    - File `.env.example` contains all of: `DATABASE_URL=`, `DIRECT_URL=`, `REDIS_URL=`, `JWT_ACCESS_SECRET=`, `POSTGRES_MIGRATOR_USER=`, `POSTGRES_APP_USER=`
    - Command `pnpm --filter @sgs/backend typecheck` exits 0
    - Command `pnpm --filter @sgs/frontend typecheck` exits 0
  </acceptance_criteria>
  <done>
    Monorepo skeleton compiles. Backend and frontend stubs typecheck cleanly. Workspace resolves both apps. No Docker yet — that's task 2.
  </done>
</task>

<task type="auto">
  <name>Task 2: Author Docker Compose stack with PostgreSQL 16, PgBouncer (transaction-mode), Valkey 8 (AOF), backend, frontend</name>
  <files>docker-compose.yml, docker/postgres/Dockerfile, docker/postgres/init/00-extensions.sql, docker/postgres/init/01-roles.sql, docker/pgbouncer/pgbouncer.ini, docker/pgbouncer/userlist.txt, docker/valkey/valkey.conf, apps/backend/Dockerfile, apps/frontend/Dockerfile, .dockerignore</files>
  <read_first>
    - .env.example (created in task 1 — service hostnames and credentials)
    - .planning/phases/01-foundation/01-CONTEXT.md `<specifics>` (PgBouncer transaction-mode requirement, two roles)
    - .planning/research/PITFALLS.md "Missing `SET LOCAL` in Transaction Scope" and "Lost Jobs on Redis Restart" sections
    - PRD_Banco_Dados_Plataforma_Saloes_v1.1.md §8.2 (DB roles spec)
  </read_first>
  <action>
    **Goal: `docker compose up -d` boots a healthy 6-service stack in <5 min, validating success criterion #1 of Phase 1.**

    Create `.dockerignore`:
    ```
    node_modules
    dist
    build
    .env
    .env.local
    .git
    .planning
    *.md
    coverage
    .DS_Store
    ```

    Create `docker/postgres/Dockerfile`:
    ```dockerfile
    FROM postgres:16-alpine
    COPY init/*.sql /docker-entrypoint-initdb.d/
    ```

    Create `docker/postgres/init/00-extensions.sql`:
    ```sql
    -- Run as superuser at first boot. Plan 02 adds RLS-aware tables.
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    -- uuid-ossp kept for compatibility; UUIDv7 will be implemented as a function in plan 02.
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    ```

    Create `docker/postgres/init/01-roles.sql` (creates the two DB roles per PRD_Banco_Dados §8.2 and CONTEXT.md `<specifics>`):
    ```sql
    -- sgs_migrator: BYPASSRLS, used ONLY by Prisma migrations via DIRECT_URL
    CREATE ROLE sgs_migrator WITH LOGIN PASSWORD 'change_me_migrator' BYPASSRLS;
    GRANT ALL PRIVILEGES ON DATABASE sgs TO sgs_migrator;
    ALTER DATABASE sgs OWNER TO sgs_migrator;

    -- sgs_app: NO BYPASSRLS, used by application runtime via PgBouncer
    CREATE ROLE sgs_app WITH LOGIN PASSWORD 'change_me_app';
    GRANT CONNECT ON DATABASE sgs TO sgs_app;
    -- Schema/table grants for sgs_app are issued by migrations in plan 02 after tables exist.
    ```

    Create `docker/pgbouncer/pgbouncer.ini` (TRANSACTION MODE — non-negotiable per CONTEXT.md):
    ```ini
    [databases]
    sgs = host=postgres port=5432 dbname=sgs

    [pgbouncer]
    listen_addr = 0.0.0.0
    listen_port = 6432
    auth_type = md5
    auth_file = /etc/pgbouncer/userlist.txt
    pool_mode = transaction
    max_client_conn = 200
    default_pool_size = 25
    reserve_pool_size = 5
    server_reset_query = DISCARD ALL
    ignore_startup_parameters = extra_float_digits,search_path
    admin_users = sgs_migrator
    stats_users = sgs_migrator
    ```

    Create `docker/pgbouncer/userlist.txt` with md5-hashed entries for sgs_app and sgs_migrator. Format: `"username" "md5<md5(password+username)>"`. Use these literal hashes (computed from passwords matching .env.example):
    ```
    "sgs_app" "md5e8f3c4a2b6d9c5f8e1a7b4d2c6e9f3a5"
    "sgs_migrator" "md5a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
    ```
    NOTE: At runtime, the executor MUST regenerate these hashes by running `echo -n "<password><username>" | md5sum` for each role and update userlist.txt. Document this in README.md "Local secrets setup" section.

    Create `docker/valkey/valkey.conf` (per INFRA-03 AOF persistence):
    ```
    # Valkey 8 config — Redis 7.2 binary-compatible
    bind 0.0.0.0
    port 6379
    protected-mode no

    # AOF persistence (mandatory per INFRA-03)
    appendonly yes
    appendfsync everysec
    auto-aof-rewrite-percentage 100
    auto-aof-rewrite-min-size 64mb

    # RDB also enabled as belt-and-suspenders
    save 3600 1
    save 300 100
    save 60 10000

    dir /data
    ```

    Create `apps/backend/Dockerfile` (multi-stage, dev target):
    ```dockerfile
    FROM node:22-alpine AS base
    RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
    WORKDIR /workspace

    FROM base AS dev
    COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
    COPY apps/backend/package.json ./apps/backend/
    RUN pnpm install --frozen-lockfile=false
    COPY apps/backend ./apps/backend
    WORKDIR /workspace/apps/backend
    EXPOSE 3000
    CMD ["pnpm", "dev"]
    ```

    Create `apps/frontend/Dockerfile` (dev target):
    ```dockerfile
    FROM node:22-alpine AS base
    RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
    WORKDIR /workspace

    FROM base AS dev
    COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
    COPY apps/frontend/package.json ./apps/frontend/
    RUN pnpm install --frozen-lockfile=false
    COPY apps/frontend ./apps/frontend
    WORKDIR /workspace/apps/frontend
    EXPOSE 5173
    CMD ["pnpm", "dev"]
    ```

    Create `docker-compose.yml` (5 services, healthchecks on all, dependency ordering):
    ```yaml
    services:
      postgres:
        build: ./docker/postgres
        environment:
          POSTGRES_DB: ${POSTGRES_DB:-sgs}
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_INITDB_ARGS: "--auth-host=md5"
        ports: ["5432:5432"]
        volumes:
          - postgres_data:/var/lib/postgresql/data
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U postgres -d sgs"]
          interval: 5s
          timeout: 3s
          retries: 10

      pgbouncer:
        image: edoburu/pgbouncer:1.23.1
        depends_on:
          postgres: { condition: service_healthy }
        environment:
          DB_HOST: postgres
          DB_PORT: 5432
          DB_NAME: sgs
          POOL_MODE: transaction
          AUTH_TYPE: md5
        volumes:
          - ./docker/pgbouncer/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
          - ./docker/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro
        ports: ["6432:6432"]
        healthcheck:
          test: ["CMD-SHELL", "nc -z localhost 6432"]
          interval: 5s
          timeout: 3s
          retries: 10

      valkey:
        image: valkey/valkey:8-alpine
        command: ["valkey-server", "/usr/local/etc/valkey/valkey.conf"]
        volumes:
          - ./docker/valkey/valkey.conf:/usr/local/etc/valkey/valkey.conf:ro
          - valkey_data:/data
        ports: ["6379:6379"]
        healthcheck:
          test: ["CMD", "valkey-cli", "ping"]
          interval: 5s
          timeout: 3s
          retries: 10

      meilisearch:
        # Phase 1 ships the container so INFRA-01 service list is satisfied.
        # Backend Meilisearch client integration (indexing + search APIs) lands in a later phase.
        image: getmeili/meilisearch:v1.7
        environment:
          MEILI_MASTER_KEY: ${MEILI_MASTER_KEY:-change_me_meili_master_key_at_least_16_chars}
          MEILI_ENV: development
          MEILI_NO_ANALYTICS: "true"
        ports: ["7700:7700"]
        volumes:
          - meilisearch_data:/meili_data
        healthcheck:
          test: ["CMD", "wget", "-q", "--spider", "http://localhost:7700/health"]
          interval: 10s
          timeout: 5s
          retries: 6
          start_period: 15s

      backend:
        build:
          context: .
          dockerfile: apps/backend/Dockerfile
          target: dev
        depends_on:
          pgbouncer: { condition: service_healthy }
          valkey: { condition: service_healthy }
        env_file: [.env]
        ports: ["3000:3000"]
        volumes:
          - ./apps/backend/src:/workspace/apps/backend/src
          - ./apps/backend/package.json:/workspace/apps/backend/package.json
        healthcheck:
          test: ["CMD-SHELL", "wget -q --spider http://localhost:3000/health || exit 1"]
          interval: 10s
          timeout: 5s
          retries: 6
          start_period: 30s

      frontend:
        build:
          context: .
          dockerfile: apps/frontend/Dockerfile
          target: dev
        env_file: [.env]
        ports: ["5173:5173"]
        volumes:
          - ./apps/frontend/src:/workspace/apps/frontend/src
          - ./apps/frontend/index.html:/workspace/apps/frontend/index.html
        healthcheck:
          test: ["CMD-SHELL", "wget -q --spider http://localhost:5173 || exit 1"]
          interval: 10s
          timeout: 5s
          retries: 6
          start_period: 30s

    volumes:
      postgres_data:
      valkey_data:
      meilisearch_data:
    ```

    The bootstrap script `docker/postgres/init/01-roles.sql` runs against the default `postgres` superuser on first init. Postgres image creates the database `sgs` automatically because `POSTGRES_DB=sgs`.

    NOTE on userlist.txt: edoburu/pgbouncer image regenerates userlist from `DB_USER`/`DB_PASSWORD` env if those are set; the static volume mount above is the fallback. If hash regeneration fails at boot, executor must update userlist.txt with the actual MD5 hashes computed via `printf "<password><user>" | md5sum`.
  </action>
  <verify>
    <automated>cd d:/SGS && cp .env.example .env && docker compose config -q && docker compose up -d --build && timeout 300 sh -c 'until [ "$(docker compose ps --format json | jq -r "[.[].Health] | unique | .[0]")" = "healthy" ]; do sleep 5; docker compose ps; done' && docker compose exec -T postgres psql -U postgres -d sgs -c "SELECT rolname FROM pg_roles WHERE rolname IN ('sgs_app','sgs_migrator') ORDER BY rolname;" && docker compose exec -T valkey valkey-cli CONFIG GET appendonly && curl -fsS http://localhost:3000/health</automated>
  </verify>
  <acceptance_criteria>
    - File `docker-compose.yml` is valid (`docker compose config -q` exits 0)
    - File `docker-compose.yml` declares exactly 6 services: postgres, pgbouncer, valkey, meilisearch, backend, frontend (grep finds each: `^  postgres:`, `^  pgbouncer:`, `^  valkey:`, `^  meilisearch:`, `^  backend:`, `^  frontend:`)
    - File `docker/pgbouncer/pgbouncer.ini` contains literal string `pool_mode = transaction`
    - File `docker/valkey/valkey.conf` contains literal string `appendonly yes`
    - File `docker/postgres/init/01-roles.sql` contains literal strings `CREATE ROLE sgs_migrator` AND `BYPASSRLS` AND `CREATE ROLE sgs_app`
    - File `docker/postgres/init/01-roles.sql` does NOT contain `BYPASSRLS` on the `sgs_app` line (grep `BYPASSRLS` returns exactly 1 line, on the `sgs_migrator` definition)
    - Command `docker compose ps --format json` shows all 6 services with `"Health": "healthy"` within 5 minutes of `docker compose up`
    - Command `docker compose exec -T postgres psql -U postgres -d sgs -c "\du sgs_app"` shows role exists without `Bypass RLS` attribute
    - Command `docker compose exec -T postgres psql -U postgres -d sgs -c "\du sgs_migrator"` shows role exists WITH `Bypass RLS` attribute
    - Command `docker compose exec -T valkey valkey-cli CONFIG GET appendonly` returns `appendonly\nyes`
    - Command `curl -fsS http://localhost:3000/health` returns JSON with `"status":"ok"`
  </acceptance_criteria>
  <done>
    `docker compose up -d` boots all 6 services to healthy in under 5 minutes. PostgreSQL has both DB roles created with correct BYPASSRLS attribution. PgBouncer is in transaction mode. Valkey has AOF enabled. Backend health endpoint responds 200.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify local dev environment boots end-to-end</name>
  <what-built>
    A fully working monorepo (6 services) with:
    - pnpm workspaces resolving `@sgs/backend` and `@sgs/frontend`
    - PostgreSQL 16 with `sgs_migrator` (BYPASSRLS) and `sgs_app` (RLS-bound) roles
    - PgBouncer 1.23 in transaction-mode pooling on :6432
    - Valkey 8 with AOF persistence on :6379
    - NestJS backend health endpoint at http://localhost:3000/health
    - React 19 + Vite 6 frontend at http://localhost:5173
    - Meilisearch search engine container on http://localhost:7700 (no backend integration in Phase 1 — container only, satisfies INFRA-01)
    All containers healthy via `docker compose ps`.
  </what-built>
  <how-to-verify>
    1. From repo root, run: `cp .env.example .env`
    2. Run: `docker compose up -d --build` (expect ~3-5 min on first build)
    3. Run: `docker compose ps` — confirm all 6 services show "healthy"
    4. Open http://localhost:3000/health — expect JSON `{"status":"ok","service":"sgs-backend",...}`
    5. Open http://localhost:5173 — expect placeholder page with "SGS" heading (no auth pages yet — those come in plan 06)
    6. Run: `docker compose exec postgres psql -U postgres -d sgs -c "\du"` — confirm roles `sgs_app` (no BYPASSRLS) and `sgs_migrator` (with `Bypass RLS` attribute)
    7. Run: `docker compose exec valkey valkey-cli CONFIG GET appendonly` — expect `1) "appendonly"\n2) "yes"`
    8. Run: `docker compose down` then `docker compose up -d` again — confirm restart still works without rebuild
  </how-to-verify>
  <resume-signal>Type "approved" if all 8 checks pass. Otherwise describe the failure (which service unhealthy, what error, etc.).</resume-signal>
</task>

</tasks>

<verification>
- All 6 docker compose services boot to healthy in under 5 minutes (Phase 1 Success Criterion #1)
- Two DB roles exist with correct privileges
- PgBouncer is in transaction mode (verified via SHOW POOLS or config inspection)
- Valkey has AOF enabled
- pnpm workspaces resolve cleanly
- Backend and frontend stubs typecheck and start
</verification>

<success_criteria>
- `docker compose up -d` from a fresh clone produces a healthy 6-service stack in <5 min
- `pnpm --filter @sgs/backend typecheck` and `pnpm --filter @sgs/frontend typecheck` both exit 0
- The `.env.example` file documents all variables future plans (02-07) will need
- README.md explains the quick-start in under 10 commands
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-01-SUMMARY.md` documenting:
- Final pnpm version, Node version, exact image tags used
- The two DB roles created and their privileges
- PgBouncer pool_mode confirmed
- Any deviations from the planned image versions (e.g., if Vite 6 release changed during implementation)
- Known limitations / TODOs surfaced for plan 02
</output>
