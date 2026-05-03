---
phase: 01-foundation
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/backend/prisma/schema.prisma
  - apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql
  - apps/backend/prisma/seed.ts
  - apps/backend/src/database/database.module.ts
  - apps/backend/src/database/prisma.service.ts
  - apps/backend/src/database/tenant-context.service.ts
  - apps/backend/src/database/types.ts
  - apps/backend/src/database/uuidv7.ts
  - apps/backend/src/app.module.ts
  - apps/backend/package.json
  - apps/backend/test/integration/rls-isolation.spec.ts
  - apps/backend/test/integration/setup.ts
  - apps/backend/jest.config.ts
  - apps/backend/jest-integration.config.ts
  - .github/workflows/ci.yml
autonomous: true
requirements: [INFRA-02]

must_haves:
  truths:
    - "Prisma schema declares organizations, users, members, roles, role_permissions, refresh_tokens, email_verification_tokens, member_invitations, outbox tables"
    - "Migration applies FORCE ROW LEVEL SECURITY on every tenant-scoped table"
    - "sgs_app role cannot SELECT/INSERT/UPDATE/DELETE rows of organization B while app.current_organization is set to organization A"
    - "Prisma application code uses sgs_app via DATABASE_URL (pgbouncer); migrations use sgs_migrator via DIRECT_URL (direct)"
    - "TenantContextService.runWithTenant() executes SET LOCAL app.current_organization inside a $transaction wrapper"
    - "CI smoke test fails the build if cross-tenant data leaks"
  artifacts:
    - path: "apps/backend/prisma/schema.prisma"
      provides: "Identity + auth schema with multi-tenant base columns"
      contains: "model Organization"
    - path: "apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql"
      provides: "First migration creating tables, RLS policies, and grants"
      contains: "FORCE ROW LEVEL SECURITY"
    - path: "apps/backend/src/database/tenant-context.service.ts"
      provides: "runWithTenant(orgId, fn) wrapper applying SET LOCAL inside transaction"
      exports: ["TenantContextService"]
    - path: "apps/backend/src/database/prisma.service.ts"
      provides: "Singleton PrismaClient lifecycle bound to NestJS"
      exports: ["PrismaService"]
    - path: "apps/backend/test/integration/rls-isolation.spec.ts"
      provides: "Cross-tenant SELECT/INSERT/UPDATE/DELETE isolation assertions"
      contains: "describe('RLS isolation'"
  key_links:
    - from: "TenantContextService.runWithTenant"
      to: "prisma.$transaction"
      via: "$executeRawUnsafe SET LOCAL app.current_organization"
      pattern: "SET LOCAL app\\.current_organization"
    - from: "Prisma migration"
      to: "every tenant-scoped table"
      via: "ALTER TABLE ... FORCE ROW LEVEL SECURITY"
      pattern: "FORCE ROW LEVEL SECURITY"
    - from: "CI workflow"
      to: "rls-isolation.spec.ts"
      via: "pnpm test:integration"
      pattern: "test:integration"
---

<objective>
Define the Phase 1 Prisma schema (identity + auth + outbox tables), wire the two-role connection model (`sgs_migrator` for migrations, `sgs_app` for runtime), enable FORCE ROW LEVEL SECURITY on every tenant-scoped table, build a `TenantContextService` that applies `SET LOCAL app.current_organization` inside Prisma transactions, and prove correctness with an RLS isolation test that runs in CI.

Purpose: Without correct RLS plumbing, every subsequent plan in this phase (auth, RBAC, frontend) leaks tenant data. This plan implements Phase 1 Success Criteria #4 and #5, which are the non-negotiable safety floor for the entire platform.

Output: A migrated database, a Prisma client wired through `sgs_app` via PgBouncer, a tenant context wrapper, and a passing CI smoke test that asserts cross-tenant isolation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-01-SUMMARY.md
@PRD_Banco_Dados_Plataforma_Saloes_v1.1.md
@PRD_Backend_Plataforma_Saloes.md
@.planning/research/PITFALLS.md
@.planning/research/ARCHITECTURE.md
@docker-compose.yml
@.env.example
@docker/postgres/init/01-roles.sql

<interfaces>
<!-- From plan 01: -->
- Backend lives at apps/backend/, runs as NestJS 10 + TypeScript 5.6 + Node 22
- DATABASE_URL points to pgbouncer:6432 (transaction-mode), used by sgs_app
- DIRECT_URL points to postgres:5432 directly, used by sgs_migrator (migrations only)
- Postgres has roles `sgs_migrator` (BYPASSRLS) and `sgs_app` (no BYPASSRLS) already created at boot

<!-- Locked decisions from CONTEXT.md driving this plan: -->
- D-02: Prisma 6 (NOT 5)
- D-12: First user of an organization receives ADMIN role automatically (schema must support this — seed/data migration in plan 04)
- D-14: 4 roles: ADMIN, MANAGER, ATTENDANT, PROFESSIONAL — seeded as `is_system=true` system roles

<!-- Critical constraints (PITFALLS.md): -->
- ALWAYS pair `ENABLE ROW LEVEL SECURITY` with `FORCE ROW LEVEL SECURITY`
- Use `SET LOCAL` (NOT `SET`) inside a transaction
- All money fields = NUMERIC(10,2); not used in this plan but the precedent is set in standard column conventions
- Outbox table needs organization_id, event_version, retry_count, max_retries, status, processed_at, indexed for SKIP LOCKED polling
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define Prisma schema and the initial migration with RLS, roles, and grants</name>
  <files>apps/backend/prisma/schema.prisma, apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql, apps/backend/prisma/migrations/migration_lock.toml, apps/backend/prisma/seed.ts, apps/backend/package.json, apps/backend/src/database/uuidv7.ts</files>
  <read_first>
    - apps/backend/package.json (current deps from plan 01)
    - PRD_Banco_Dados_Plataforma_Saloes_v1.1.md §3 (column conventions), §4.1 (entity definitions for organizations/users/members/roles), §6.2.1 (organization indexes), §8 (RLS implementation), §11.1 (Phase 1 entities)
    - PRD_Backend_Plataforma_Saloes.md §6.3.1 (outbox table definition)
    - .planning/research/ARCHITECTURE.md "outbox table" gap section
    - .planning/phases/01-foundation/01-CONTEXT.md `<specifics>` and `<decisions>`
  </read_first>
  <behavior>
    - Test: `prisma format` accepts the schema (syntactic validity)
    - Test: `prisma migrate diff --from-empty --to-schema-datamodel` produces a non-empty migration plan
    - Test: After migration applied to clean DB, `\d organizations` shows all required columns
    - Test: Querying `pg_tables` shows `rowsecurity = true` AND `forcerowsecurity = true` for every tenant-scoped table
    - Test: `pg_policies` shows tenant_isolation policy on each tenant-scoped table
  </behavior>
  <action>
    **Add Prisma 6 dependencies to apps/backend/package.json (per D-02):**
    - dependencies: `@prisma/client@^6.0.0`, `prisma@^6.0.0`
    - dev scripts: `"prisma:generate": "prisma generate"`, `"prisma:migrate:dev": "prisma migrate dev"`, `"prisma:migrate:deploy": "prisma migrate deploy"`, `"prisma:studio": "prisma studio"`, `"db:seed": "ts-node prisma/seed.ts"`
    - prisma config block: `"prisma": { "seed": "ts-node prisma/seed.ts" }`

    **Create `apps/backend/prisma/schema.prisma`:**

    ```prisma
    generator client {
      provider      = "prisma-client-js"
      // No previewFeatures needed in Prisma 6 for our scope
    }

    datasource db {
      provider  = "postgresql"
      url       = env("DATABASE_URL")    // sgs_app via pgbouncer:6432, transaction mode
      directUrl = env("DIRECT_URL")      // sgs_migrator via postgres:5432 (used by `prisma migrate`)
    }

    // ===== Identity & Organization =====

    model Organization {
      id              String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
      legalName       String   @map("legal_name") @db.VarChar(255)
      tradeName       String   @map("trade_name") @db.VarChar(255)
      documentType    String   @map("document_type") @db.VarChar(10)  // 'CPF' | 'CNPJ'
      documentNumber  String   @map("document_number") @db.VarChar(14)
      email           String   @db.VarChar(255)
      phone           String?  @db.VarChar(20)
      subdomain       String   @unique @db.VarChar(63)
      timezone        String   @default("America/Sao_Paulo") @db.VarChar(50)
      locale          String   @default("pt-BR") @db.VarChar(10)
      currency        String   @default("BRL") @db.VarChar(3)
      segment         String   @default("salon") @db.VarChar(30)
      status          String   @default("active") @db.VarChar(20)
      settings        Json     @default("{}") @db.JsonB
      createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
      updatedAt       DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

      members         Member[]
      roles           Role[]
      invitations     MemberInvitation[]
      outboxEvents    OutboxEvent[]

      @@unique([documentNumber], name: "uq_organizations_document")
      @@map("organizations")
    }

    model User {
      id                  String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
      email               String    @unique @db.VarChar(255)
      passwordHash        String    @map("password_hash") @db.VarChar(255)
      fullName            String    @map("full_name") @db.VarChar(255)
      emailVerifiedAt     DateTime? @map("email_verified_at") @db.Timestamptz(6)
      lastLoginAt         DateTime? @map("last_login_at") @db.Timestamptz(6)
      createdAt           DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
      updatedAt           DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

      members             Member[]
      refreshTokens       RefreshToken[]
      emailVerificationTokens EmailVerificationToken[]

      @@map("users")
    }

    model Role {
      id              String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
      organizationId  String?  @map("organization_id") @db.Uuid     // NULL = system role (shared)
      name            String   @db.VarChar(100)
      description     String?  @db.Text
      isSystem        Boolean  @default(false) @map("is_system")
      createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

      organization    Organization? @relation(fields: [organizationId], references: [id])
      permissions     RolePermission[]
      members         Member[]
      invitations     MemberInvitation[]

      @@unique([organizationId, name], name: "uq_roles_org_name")
      @@map("roles")
    }

    model RolePermission {
      roleId      String @map("role_id") @db.Uuid
      permission  String @db.VarChar(100)

      role        Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

      @@id([roleId, permission])
      @@map("role_permissions")
    }

    model Member {
      id              String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
      organizationId  String   @map("organization_id") @db.Uuid
      userId          String   @map("user_id") @db.Uuid
      roleId          String   @map("role_id") @db.Uuid
      displayName     String   @map("display_name") @db.VarChar(255)
      isProfessional  Boolean  @default(false) @map("is_professional")
      status          String   @default("active") @db.VarChar(20)
      createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
      updatedAt       DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
      deletedAt       DateTime? @map("deleted_at") @db.Timestamptz(6)

      organization    Organization @relation(fields: [organizationId], references: [id])
      user            User @relation(fields: [userId], references: [id])
      role            Role @relation(fields: [roleId], references: [id])

      @@unique([organizationId, userId], name: "uq_members_org_user")
      @@index([organizationId, status], name: "ix_members_org_status")
      @@map("members")
    }

    // ===== Auth tokens =====

    model RefreshToken {
      id              String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
      userId          String   @map("user_id") @db.Uuid
      tokenHash       String   @map("token_hash") @db.VarChar(255)
      familyId        String   @map("family_id") @db.Uuid                // shared by rotated descendants
      issuedAt        DateTime @default(now()) @map("issued_at") @db.Timestamptz(6)
      expiresAt       DateTime @map("expires_at") @db.Timestamptz(6)
      revokedAt       DateTime? @map("revoked_at") @db.Timestamptz(6)
      replacedById    String?  @map("replaced_by_id") @db.Uuid

      user            User @relation(fields: [userId], references: [id])

      @@index([userId, revokedAt], name: "ix_refresh_tokens_user_revoked")
      @@index([tokenHash], name: "ix_refresh_tokens_hash")
      @@map("refresh_tokens")
    }

    model EmailVerificationToken {
      id              String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
      userId          String   @map("user_id") @db.Uuid
      tokenHash       String   @unique @map("token_hash") @db.VarChar(255)
      expiresAt       DateTime @map("expires_at") @db.Timestamptz(6)
      consumedAt      DateTime? @map("consumed_at") @db.Timestamptz(6)
      createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

      user            User @relation(fields: [userId], references: [id])

      @@index([userId, consumedAt], name: "ix_evt_user_consumed")
      @@map("email_verification_tokens")
    }

    model MemberInvitation {
      id              String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
      organizationId  String   @map("organization_id") @db.Uuid
      email           String   @db.VarChar(255)
      roleId          String   @map("role_id") @db.Uuid
      tokenHash       String   @unique @map("token_hash") @db.VarChar(255)
      invitedById     String   @map("invited_by_id") @db.Uuid
      expiresAt       DateTime @map("expires_at") @db.Timestamptz(6)
      acceptedAt      DateTime? @map("accepted_at") @db.Timestamptz(6)
      revokedAt       DateTime? @map("revoked_at") @db.Timestamptz(6)
      createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

      organization    Organization @relation(fields: [organizationId], references: [id])
      role            Role @relation(fields: [roleId], references: [id])

      @@index([organizationId, email], name: "ix_invitations_org_email")
      @@index([expiresAt, acceptedAt, revokedAt], name: "ix_invitations_active")
      @@map("member_invitations")
    }

    // ===== Outbox (per ARCHITECTURE.md gap fix) =====

    model OutboxEvent {
      id              String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
      organizationId  String   @map("organization_id") @db.Uuid
      aggregateType   String   @map("aggregate_type") @db.VarChar(100)
      aggregateId     String   @map("aggregate_id") @db.Uuid
      eventType       String   @map("event_type") @db.VarChar(150)
      eventVersion    Int      @default(1) @map("event_version")
      payload         Json     @db.JsonB
      status          String   @default("pending") @db.VarChar(20)   // pending | processing | published | failed
      retryCount      Int      @default(0) @map("retry_count")
      maxRetries      Int      @default(5) @map("max_retries")
      lastError       String?  @map("last_error") @db.Text
      createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
      processedAt     DateTime? @map("processed_at") @db.Timestamptz(6)

      organization    Organization @relation(fields: [organizationId], references: [id])

      @@index([status, createdAt], name: "ix_outbox_status_created")
      @@map("outbox_events")
    }
    ```

    **Create `apps/backend/src/database/uuidv7.ts`** — TypeScript helper not used directly by Prisma but documents the dbgenerated function and is used by manual SQL where needed (refresh token family_id seeding, etc.):
    ```typescript
    // gen_uuid_v7() is implemented in SQL by the migration below.
    // This file holds JS-side fallback for tests / scripts that cannot call SQL.
    export function uuidv7(): string {
      const ts = BigInt(Date.now());
      const tsHex = ts.toString(16).padStart(12, '0');
      // 80 random bits split as 16 + 64 (with version+variant nibbles overwritten)
      const rand = crypto.getRandomValues(new Uint8Array(10));
      const r1 = ((rand[0] & 0x0f) | 0x70).toString(16) + rand[1].toString(16).padStart(2, '0');
      const r2 = ((rand[2] & 0x3f) | 0x80).toString(16) + rand[3].toString(16).padStart(2, '0');
      const tail = Array.from(rand.slice(4)).map((b) => b.toString(16).padStart(2, '0')).join('');
      return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-${r1.padStart(4, '0')}-${r2.padStart(4, '0')}-${tail}`;
    }
    ```

    **Create migration `apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql`:**

    Migration MUST contain, in this order:

    1. `gen_uuid_v7()` PostgreSQL function (uses pgcrypto, returns UUID with version 7 layout):
       ```sql
       CREATE OR REPLACE FUNCTION gen_uuid_v7() RETURNS UUID AS $$
       DECLARE
         ts_millis BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
         rand_bytes BYTEA := gen_random_bytes(10);
         uuid_bytes BYTEA;
       BEGIN
         uuid_bytes :=
           set_byte(set_byte(set_byte(set_byte(set_byte(set_byte(rand_bytes,
             0, ((ts_millis >> 40) & 255)::INT),
             1, ((ts_millis >> 32) & 255)::INT),
             2, ((ts_millis >> 24) & 255)::INT),
             3, ((ts_millis >> 16) & 255)::INT),
             4, ((ts_millis >>  8) & 255)::INT),
             5, ((ts_millis      ) & 255)::INT);
         -- version 7
         uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
         -- variant 10xx
         uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
         RETURN encode(uuid_bytes, 'hex')::UUID;
       END;
       $$ LANGUAGE plpgsql VOLATILE SECURITY INVOKER;
       ```

    2. `CREATE TABLE` for each model in the schema above (organizations, users, roles, role_permissions, members, refresh_tokens, email_verification_tokens, member_invitations, outbox_events). Match Prisma column types exactly.

    3. CHECK constraints not expressed in Prisma:
       ```sql
       ALTER TABLE organizations ADD CONSTRAINT ck_organizations_document_type CHECK (document_type IN ('CPF','CNPJ'));
       ALTER TABLE organizations ADD CONSTRAINT ck_organizations_status CHECK (status IN ('active','suspended','cancelled'));
       ALTER TABLE organizations ADD CONSTRAINT ck_organizations_segment CHECK (segment IN ('salon','barber','aesthetic','bridal','nails','lash'));
       ALTER TABLE members ADD CONSTRAINT ck_members_status CHECK (status IN ('active','inactive','vacation'));
       ALTER TABLE outbox_events ADD CONSTRAINT ck_outbox_status CHECK (status IN ('pending','processing','published','failed'));
       ```

    4. `updated_at` auto-update trigger (single function reused by triggers per table):
       ```sql
       CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER AS $$
       BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
       $$ LANGUAGE plpgsql;

       CREATE TRIGGER tg_organizations_before_update BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
       CREATE TRIGGER tg_users_before_update BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
       CREATE TRIGGER tg_members_before_update BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
       ```

    5. **Enable RLS on every TENANT-SCOPED table.** Tenant-scoped tables in this migration: `organizations`, `members`, `roles` (when organization_id IS NOT NULL — system roles bypass), `role_permissions` (via parent role), `member_invitations`, `outbox_events`. Non-tenant-scoped: `users`, `refresh_tokens`, `email_verification_tokens` (these reference user_id only, no organization_id; access governed by user identity not tenant).

       For each tenant-scoped table:
       ```sql
       ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
       ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
       CREATE POLICY tenant_isolation ON organizations
         USING (id = current_setting('app.current_organization', true)::uuid)
         WITH CHECK (id = current_setting('app.current_organization', true)::uuid);

       ALTER TABLE members ENABLE ROW LEVEL SECURITY;
       ALTER TABLE members FORCE ROW LEVEL SECURITY;
       CREATE POLICY tenant_isolation ON members
         USING (organization_id = current_setting('app.current_organization', true)::uuid)
         WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);

       ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
       ALTER TABLE roles FORCE ROW LEVEL SECURITY;
       CREATE POLICY tenant_isolation ON roles
         USING (organization_id IS NULL OR organization_id = current_setting('app.current_organization', true)::uuid)
         WITH CHECK (organization_id IS NULL OR organization_id = current_setting('app.current_organization', true)::uuid);

       ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
       ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
       CREATE POLICY tenant_isolation ON role_permissions
         USING (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id AND (r.organization_id IS NULL OR r.organization_id = current_setting('app.current_organization', true)::uuid)));

       ALTER TABLE member_invitations ENABLE ROW LEVEL SECURITY;
       ALTER TABLE member_invitations FORCE ROW LEVEL SECURITY;
       CREATE POLICY tenant_isolation ON member_invitations
         USING (organization_id = current_setting('app.current_organization', true)::uuid)
         WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);

       ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
       ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
       CREATE POLICY tenant_isolation ON outbox_events
         USING (organization_id = current_setting('app.current_organization', true)::uuid)
         WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);
       ```

       NOTE the `, true` second arg to `current_setting`: missing_ok = true means no error if app.current_organization is unset; instead returns empty string which fails the UUID cast. We rely on the cast failure as a fail-closed safety: queries without tenant context produce zero rows OR raise an exception, never leak.

    6. **Grant runtime privileges to `sgs_app`** (sgs_migrator already has all because it owns the DB):
       ```sql
       GRANT USAGE ON SCHEMA public TO sgs_app;
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sgs_app;
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sgs_app;
       GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sgs_app;
       -- Future tables created by future migrations get the same default privileges:
       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sgs_app;
       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sgs_app;
       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO sgs_app;
       ```

    7. Seed system roles (idempotent INSERT ... ON CONFLICT DO NOTHING). Per D-14:
       ```sql
       INSERT INTO roles (id, organization_id, name, description, is_system) VALUES
         (gen_uuid_v7(), NULL, 'ADMIN',        'Administrador da organização', true),
         (gen_uuid_v7(), NULL, 'MANAGER',      'Gerente da operação', true),
         (gen_uuid_v7(), NULL, 'ATTENDANT',    'Atendente / recepção', true),
         (gen_uuid_v7(), NULL, 'PROFESSIONAL', 'Profissional do salão', true)
       ON CONFLICT DO NOTHING;
       ```

       (Permissions for each role will be seeded in plan 05 after the permission catalog is finalized.)

    **Create `apps/backend/prisma/migrations/migration_lock.toml`:**
    ```toml
    provider = "postgresql"
    ```

    **Create `apps/backend/prisma/seed.ts`** — idempotent seed for dev only:
    ```typescript
    import { PrismaClient } from '@prisma/client';
    const prisma = new PrismaClient();

    async function main() {
      // System roles are seeded via SQL in the initial migration.
      // Per-organization data (seed orgs, demo users) is added in later plans.
      const count = await prisma.role.count({ where: { isSystem: true } });
      console.log(`[seed] system roles present: ${count}`);
    }
    main().finally(() => prisma.$disconnect());
    ```
  </action>
  <verify>
    <automated>cd d:/SGS/apps/backend && pnpm prisma format && pnpm prisma validate && docker compose exec -T -e DIRECT_URL backend pnpm prisma migrate deploy && docker compose exec -T postgres psql -U postgres -d sgs -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('organizations','members','roles','role_permissions','member_invitations','outbox_events') ORDER BY relname;" | grep -c "t | t" | grep -q "^6$"</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/prisma/schema.prisma` contains literal strings: `model Organization`, `model User`, `model Member`, `model Role`, `model RefreshToken`, `model EmailVerificationToken`, `model MemberInvitation`, `model OutboxEvent`
    - File `apps/backend/prisma/schema.prisma` contains `directUrl = env("DIRECT_URL")`
    - File `apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql` contains literal `FORCE ROW LEVEL SECURITY` at least 6 times (once per tenant-scoped table)
    - Migration file contains `CREATE FUNCTION gen_uuid_v7()` AND `CREATE POLICY tenant_isolation`
    - Migration file contains `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sgs_app`
    - Migration file contains all 4 system role inserts (`ADMIN`, `MANAGER`, `ATTENDANT`, `PROFESSIONAL`)
    - Command `pnpm prisma validate` exits 0
    - After applying migration, query `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='organizations'` returns `t, t`
    - After applying migration, query `SELECT count(*) FROM roles WHERE is_system=true` returns 4
  </acceptance_criteria>
  <done>
    Prisma schema and initial migration applied successfully. All tenant-scoped tables have FORCE ROW LEVEL SECURITY enabled with a tenant_isolation policy. sgs_app has runtime CRUD privileges (granted in migration). 4 system roles seeded.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build PrismaService + TenantContextService + RLS isolation integration test</name>
  <files>apps/backend/src/database/database.module.ts, apps/backend/src/database/prisma.service.ts, apps/backend/src/database/tenant-context.service.ts, apps/backend/src/database/types.ts, apps/backend/src/app.module.ts, apps/backend/test/integration/setup.ts, apps/backend/test/integration/rls-isolation.spec.ts, apps/backend/jest.config.ts, apps/backend/jest-integration.config.ts, apps/backend/package.json</files>
  <read_first>
    - apps/backend/prisma/schema.prisma (created in task 1 — model names for queries)
    - apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql (RLS policies — test must assert these block cross-tenant access)
    - .planning/research/PITFALLS.md "Missing `SET LOCAL` in Transaction Scope" section (the exact pattern this code must implement)
    - PRD_Backend_Plataforma_Saloes.md §2.4 (transactions) and §5.2 (tenant identification)
  </read_first>
  <behavior>
    Behavior of TenantContextService.runWithTenant:
    - Test 1: When called with a valid orgId, the callback receives a tx client where `current_setting('app.current_organization')::uuid` equals orgId.
    - Test 2: After the callback resolves, the next `prisma.$queryRaw` outside the wrapper sees `app.current_organization` as empty/unset (no leakage).
    - Test 3: When the callback throws, the transaction rolls back.

    Behavior of RLS isolation test (rls-isolation.spec.ts):
    - Test 4: Two orgs (orgA, orgB) created via direct sgs_migrator connection. Each has a Member.
    - Test 5: With sgs_app + tenant=orgA, `SELECT * FROM members` returns ONLY orgA's member (count = 1).
    - Test 6: With sgs_app + tenant=orgA, `INSERT INTO members (..., organization_id=orgB.id)` raises an error (RLS WITH CHECK violation).
    - Test 7: With sgs_app + tenant=orgA, `UPDATE members SET display_name='leak' WHERE organization_id=orgB.id` affects 0 rows.
    - Test 8: With sgs_app + tenant=orgA, `DELETE FROM members WHERE organization_id=orgB.id` affects 0 rows.
    - Test 9: With NO tenant set, `SELECT * FROM organizations` returns 0 rows (fail-closed safety).
  </behavior>
  <action>
    **Add to `apps/backend/package.json` devDependencies:** `@nestjs/testing@^10.4.0`, `supertest@^7.0.0`, `@types/supertest@^6.0.2`. Add scripts: `"test:integration": "jest --config jest-integration.config.ts --runInBand"`.

    **Create `apps/backend/jest.config.ts`** (unit tests):
    ```typescript
    import type { Config } from 'jest';
    const config: Config = {
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'src',
      testRegex: '.*\\.spec\\.ts$',
      moduleFileExtensions: ['ts', 'js', 'json'],
    };
    export default config;
    ```

    **Create `apps/backend/jest-integration.config.ts`:**
    ```typescript
    import type { Config } from 'jest';
    const config: Config = {
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'test/integration',
      testRegex: '.*\\.spec\\.ts$',
      moduleFileExtensions: ['ts', 'js', 'json'],
      setupFilesAfterEnv: ['<rootDir>/setup.ts'],
      testTimeout: 30000,
    };
    export default config;
    ```

    **Create `apps/backend/src/database/types.ts`:**
    ```typescript
    import type { Prisma } from '@prisma/client';

    /**
     * The Prisma client passed to a runWithTenant callback. It IS a transaction client.
     * Use this type instead of PrismaClient for repositories operating inside tenant scope.
     */
    export type TenantPrismaClient = Omit<Prisma.TransactionClient, '$transaction'>;
    ```

    **Create `apps/backend/src/database/prisma.service.ts`:**
    ```typescript
    import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
    import { PrismaClient } from '@prisma/client';

    @Injectable()
    export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
      private readonly logger = new Logger(PrismaService.name);

      constructor() {
        super({
          log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        });
      }

      async onModuleInit(): Promise<void> {
        await this.$connect();
        this.logger.log('Prisma connected via DATABASE_URL (sgs_app, transaction-mode pool)');
      }

      async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
      }
    }
    ```

    **Create `apps/backend/src/database/tenant-context.service.ts`** — the heart of multi-tenancy. Implements PITFALLS.md "Use `SET LOCAL` inside `$transaction`" pattern:
    ```typescript
    import { Injectable, Logger } from '@nestjs/common';
    import { PrismaService } from './prisma.service';
    import type { TenantPrismaClient } from './types';

    @Injectable()
    export class TenantContextService {
      private readonly logger = new Logger(TenantContextService.name);

      constructor(private readonly prisma: PrismaService) {}

      /**
       * Runs `fn` inside a Prisma transaction with `app.current_organization` set
       * to `organizationId` for the entirety of the transaction. The setting is
       * reset on commit/rollback (SET LOCAL is transaction-scoped).
       *
       * CRITICAL: never use bare `SET` here — that would leak across pooled connections
       * via PgBouncer transaction-mode reuse. See PITFALLS.md.
       */
      async runWithTenant<T>(
        organizationId: string,
        fn: (tx: TenantPrismaClient) => Promise<T>,
      ): Promise<T> {
        if (!isUuid(organizationId)) {
          throw new Error(`runWithTenant: invalid organizationId "${organizationId}"`);
        }
        return this.prisma.$transaction(async (tx) => {
          // Use $executeRawUnsafe with parameterized cast (safe: organizationId already validated as UUID)
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${organizationId}'`);
          return fn(tx as unknown as TenantPrismaClient);
        });
      }

      /**
       * Runs `fn` with NO tenant set — for endpoints that operate at the platform level
       * (signup, login email lookup). Caller MUST guard which tables they touch:
       * tenant-scoped tables will return 0 rows because the RLS policy needs a UUID
       * setting and the cast on empty string fails.
       */
      async runWithoutTenant<T>(
        fn: (tx: TenantPrismaClient) => Promise<T>,
      ): Promise<T> {
        return this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`RESET app.current_organization`);
          return fn(tx as unknown as TenantPrismaClient);
        });
      }
    }

    function isUuid(s: string): boolean {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    }
    ```

    **Create `apps/backend/src/database/database.module.ts`:**
    ```typescript
    import { Global, Module } from '@nestjs/common';
    import { PrismaService } from './prisma.service';
    import { TenantContextService } from './tenant-context.service';

    @Global()
    @Module({
      providers: [PrismaService, TenantContextService],
      exports: [PrismaService, TenantContextService],
    })
    export class DatabaseModule {}
    ```

    **Update `apps/backend/src/app.module.ts`** to import DatabaseModule:
    ```typescript
    import { Module, Controller, Get } from '@nestjs/common';
    import { DatabaseModule } from './database/database.module';

    @Controller('health')
    class HealthController {
      @Get()
      check() {
        return { status: 'ok', service: 'sgs-backend', timestamp: new Date().toISOString() };
      }
    }

    @Module({
      imports: [DatabaseModule],
      controllers: [HealthController],
    })
    export class AppModule {}
    ```

    **Create `apps/backend/test/integration/setup.ts`** — bootstrap a test client and a privileged client:
    ```typescript
    import { PrismaClient } from '@prisma/client';

    // Privileged client uses DIRECT_URL (sgs_migrator, BYPASSRLS) for setup/teardown only.
    // App client uses DATABASE_URL (sgs_app via pgbouncer) for assertions.
    export const adminPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DIRECT_URL! } },
    });

    export const appPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL! } },
    });

    afterAll(async () => {
      await adminPrisma.$disconnect();
      await appPrisma.$disconnect();
    });
    ```

    **Create `apps/backend/test/integration/rls-isolation.spec.ts`** — the CI smoke test that PROVES Phase 1 Success Criteria #4 and #5:
    ```typescript
    import { adminPrisma, appPrisma } from './setup';

    describe('RLS isolation between two organizations', () => {
      let orgAId: string;
      let orgBId: string;
      let userId: string;
      let memberAId: string;
      let memberBId: string;
      let adminRoleId: string;

      beforeAll(async () => {
        // Cleanup any prior leftovers from previous runs
        await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE 'rls-test-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'rls-test-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rls-test-%'`);

        const adminRole = await adminPrisma.role.findFirstOrThrow({ where: { name: 'ADMIN', isSystem: true } });
        adminRoleId = adminRole.id;

        const orgA = await adminPrisma.organization.create({
          data: { legalName: 'rls-test-A', tradeName: 'A', documentType: 'CNPJ', documentNumber: '11111111111111', email: 'a@test.com', subdomain: `rls-a-${Date.now()}`, segment: 'salon', planId: undefined as any },
        });
        orgAId = orgA.id;

        const orgB = await adminPrisma.organization.create({
          data: { legalName: 'rls-test-B', tradeName: 'B', documentType: 'CNPJ', documentNumber: '22222222222222', email: 'b@test.com', subdomain: `rls-b-${Date.now()}`, segment: 'salon', planId: undefined as any },
        });
        orgBId = orgB.id;

        const user = await adminPrisma.user.create({
          data: { email: `rls-test-${Date.now()}@test.com`, passwordHash: 'x', fullName: 'rls test user' },
        });
        userId = user.id;

        const memberA = await adminPrisma.member.create({
          data: { organizationId: orgAId, userId, roleId: adminRoleId, displayName: 'rls-test-A-member' },
        });
        memberAId = memberA.id;

        const memberB = await adminPrisma.member.create({
          data: { organizationId: orgBId, userId, roleId: adminRoleId, displayName: 'rls-test-B-member' },
        });
        memberBId = memberB.id;
      });

      afterAll(async () => {
        await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE 'rls-test-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'rls-test-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rls-test-%'`);
      });

      it('SELECT under tenant=A returns only A members', async () => {
        const rows = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${orgAId}'`);
          return tx.member.findMany({ where: { displayName: { startsWith: 'rls-test-' } } });
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(memberAId);
      });

      it('SELECT under tenant=B returns only B members', async () => {
        const rows = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${orgBId}'`);
          return tx.member.findMany({ where: { displayName: { startsWith: 'rls-test-' } } });
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(memberBId);
      });

      it('INSERT cross-tenant under tenant=A is blocked by WITH CHECK', async () => {
        await expect(
          appPrisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${orgAId}'`);
            return tx.member.create({
              data: { organizationId: orgBId, userId, roleId: adminRoleId, displayName: 'rls-test-leak' },
            });
          }),
        ).rejects.toThrow();
      });

      it('UPDATE cross-tenant under tenant=A affects 0 rows', async () => {
        const result = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${orgAId}'`);
          return tx.member.updateMany({ where: { id: memberBId }, data: { displayName: 'rls-test-pwn' } });
        });
        expect(result.count).toBe(0);
      });

      it('DELETE cross-tenant under tenant=A affects 0 rows', async () => {
        const result = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${orgAId}'`);
          return tx.member.deleteMany({ where: { id: memberBId } });
        });
        expect(result.count).toBe(0);
      });

      it('SELECT with NO tenant set returns 0 rows from organizations (fail-closed)', async () => {
        await expect(
          appPrisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`RESET app.current_organization`);
            return tx.organization.findMany();
          }),
        ).resolves.toEqual([]);
      });

      it('PgBouncer transaction-mode does not leak SET LOCAL across requests', async () => {
        // Tx 1: set tenant A
        await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${orgAId}'`);
        });
        // Tx 2: query without setting tenant — should see 0 rows because LOCAL was reset on commit
        const leaked = await appPrisma.$transaction(async (tx) => {
          return tx.organization.findMany();
        });
        expect(leaked).toEqual([]);
      });
    });
    ```

    NOTE: Plan 02 schema does not yet include the `plans` table. The Organization model references `plan_id` in the PRD but for Phase 1 we omit it (deferred to Phase 5/billing context). Update schema to remove the `planId` field if necessary and remove the `planId: undefined as any` from the test. Reconcile by: dropping `plan_id NOT NULL` from migration if present, or making it nullable. Recommended: omit plan_id from this migration entirely; add when billing context is built.
  </action>
  <verify>
    <automated>cd d:/SGS/apps/backend && pnpm prisma generate && pnpm typecheck && pnpm test:integration</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/src/database/tenant-context.service.ts` contains literal string `SET LOCAL app.current_organization`
    - File `apps/backend/src/database/tenant-context.service.ts` contains `prisma.$transaction` (uses transaction wrapper, not bare SET)
    - File `apps/backend/src/database/prisma.service.ts` exports `PrismaService` extending `PrismaClient`
    - File `apps/backend/src/database/database.module.ts` exports both `PrismaService` and `TenantContextService` and is `@Global()`
    - File `apps/backend/src/app.module.ts` imports `DatabaseModule`
    - File `apps/backend/test/integration/rls-isolation.spec.ts` contains all 7 test cases (SELECT-A, SELECT-B, INSERT-blocked, UPDATE-0, DELETE-0, no-tenant-empty, pgbouncer-no-leak)
    - Command `pnpm prisma generate` exits 0
    - Command `pnpm test:integration` exits 0 with all 7 isolation tests passing
    - Command `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    PrismaService and TenantContextService injected globally. Integration test suite proves cross-tenant SELECT/INSERT/UPDATE/DELETE are all blocked by RLS and that PgBouncer transaction-mode does not leak SET LOCAL between transactions. Phase 1 Success Criteria #4 and #5 satisfied.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire RLS isolation test into CI as a blocking gate</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - apps/backend/test/integration/rls-isolation.spec.ts (the test the CI runs)
    - docker-compose.yml (the infra the CI must mirror)
    - apps/backend/package.json (scripts and version constraints)
  </read_first>
  <action>
    Create `.github/workflows/ci.yml` that runs on every push/PR and includes a `tenant-isolation` job. Use docker compose against the same images as local dev for fidelity:

    ```yaml
    name: CI

    on:
      push:
        branches: [main]
      pull_request:

    jobs:
      typecheck:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: pnpm/action-setup@v4
            with: { version: 9 }
          - uses: actions/setup-node@v4
            with: { node-version: 22, cache: pnpm }
          - run: pnpm install --frozen-lockfile
          - run: pnpm -r typecheck

      lint:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: pnpm/action-setup@v4
            with: { version: 9 }
          - uses: actions/setup-node@v4
            with: { node-version: 22, cache: pnpm }
          - run: pnpm install --frozen-lockfile
          - run: pnpm -r lint --if-present

      tenant-isolation:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: pnpm/action-setup@v4
            with: { version: 9 }
          - uses: actions/setup-node@v4
            with: { node-version: 22, cache: pnpm }
          - run: cp .env.example .env
          - name: Boot infra (postgres + pgbouncer + valkey)
            run: docker compose up -d postgres pgbouncer valkey
          - name: Wait for healthy
            run: |
              for i in $(seq 1 60); do
                healthy=$(docker compose ps --format json | jq -r '[.[] | select(.Service != "backend" and .Service != "frontend")] | [.[].Health] | unique | join(",")')
                if [ "$healthy" = "healthy" ]; then exit 0; fi
                sleep 5
              done
              docker compose ps
              exit 1
          - name: Install backend deps
            run: pnpm install --frozen-lockfile
          - name: Apply migrations (sgs_migrator via DIRECT_URL)
            working-directory: apps/backend
            run: pnpm prisma migrate deploy
            env:
              DIRECT_URL: postgresql://sgs_migrator:change_me_migrator@localhost:5432/sgs
              DATABASE_URL: postgresql://sgs_app:change_me_app@localhost:6432/sgs?pgbouncer=true&connection_limit=10
          - name: Run RLS isolation suite
            working-directory: apps/backend
            run: pnpm test:integration
            env:
              DIRECT_URL: postgresql://sgs_migrator:change_me_migrator@localhost:5432/sgs
              DATABASE_URL: postgresql://sgs_app:change_me_app@localhost:6432/sgs?pgbouncer=true&connection_limit=10
          - name: Confirm PgBouncer is in transaction mode
            run: |
              docker compose exec -T -e PGPASSWORD=change_me_migrator pgbouncer psql -h localhost -p 6432 -U sgs_migrator pgbouncer -c "SHOW POOLS;" || true
              cat docker/pgbouncer/pgbouncer.ini | grep -E "^pool_mode\s*=\s*transaction"
          - name: Tear down
            if: always()
            run: docker compose down -v
    ```

    The `Confirm PgBouncer is in transaction mode` step asserts Phase 1 Success Criterion #5: the literal string `pool_mode = transaction` must be present in the rendered config.
  </action>
  <verify>
    <automated>cd d:/SGS && grep -q "tenant-isolation:" .github/workflows/ci.yml && grep -q "pool_mode\\s*=\\s*transaction" .github/workflows/ci.yml && grep -q "pnpm test:integration" .github/workflows/ci.yml</automated>
  </verify>
  <acceptance_criteria>
    - File `.github/workflows/ci.yml` exists and is valid YAML (`yamllint .github/workflows/ci.yml` exits 0 OR `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0)
    - File `.github/workflows/ci.yml` declares jobs: `typecheck`, `lint`, `tenant-isolation`
    - File contains literal string `pnpm test:integration`
    - File contains literal string `pool_mode\s*=\s*transaction` (asserts the pgbouncer mode check)
    - File contains literal string `prisma migrate deploy`
    - The tenant-isolation job uses both `DIRECT_URL` (sgs_migrator) and `DATABASE_URL` (sgs_app via pgbouncer:6432)
  </acceptance_criteria>
  <done>
    CI workflow exists and runs the RLS isolation suite on every push/PR. The job fails the build if any cross-tenant assertion fails or if PgBouncer is not in transaction mode.
  </done>
</task>

</tasks>

<verification>
- Migration applied cleanly via `prisma migrate deploy` (uses DIRECT_URL, sgs_migrator)
- Application code connects via DATABASE_URL (sgs_app via pgbouncer transaction-mode pool)
- Every tenant-scoped table has FORCE ROW LEVEL SECURITY enabled with a tenant_isolation policy
- TenantContextService.runWithTenant uses SET LOCAL inside $transaction
- 7-test RLS isolation suite passes (verifies SELECT/INSERT/UPDATE/DELETE blocking + no-tenant fail-closed + no PgBouncer leak)
- CI workflow runs the isolation suite on every push/PR
- 4 system roles (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL) seeded by migration
</verification>

<success_criteria>
- Phase 1 Success Criterion #4 satisfied: CI smoke test verifies sgs_app cannot read other-org data
- Phase 1 Success Criterion #5 satisfied: CI smoke test confirms PgBouncer transaction-mode + SET LOCAL no-leak
- Backend can be started and `prisma migrate deploy` applies the initial migration
- Subsequent plans can compose `TenantContextService.runWithTenant` for all tenant-scoped queries
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-02-SUMMARY.md` documenting:
- Final Prisma version installed
- Migration name and timestamp
- List of tables with FORCE ROW LEVEL SECURITY (should be 6: organizations, members, roles, role_permissions, member_invitations, outbox_events)
- The exact `runWithTenant` API signature for downstream plans to consume
- 4 system role IDs as inserted (or note they are dynamic UUIDs and queryable by name)
- Any deviations from PRD_Banco_Dados (e.g., omitted plan_id from organizations for Phase 1)
- CI job name (`tenant-isolation`) and what failure means
</output>
