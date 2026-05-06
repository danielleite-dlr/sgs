---
phase: 02-core-domain
plan: 01
slug: database-schema
subsystem: backend/database
status: complete
completed: "2026-05-06T11:57:34Z"
duration_minutes: 14
tasks_completed: 3
tasks_total: 3
files_created: 14
files_modified: 3

tags: [migration, prisma, rls, postgresql, permissions, nestjs, catalog, clients]

dependency_graph:
  requires:
    - 01-foundation/01-db-schema  # Phase 1 schema (organizations, members, roles)
    - 01-foundation/01-db-seed    # System roles for permission seeding
  provides:
    - 02-core-domain/02-catalog-services    # categories, services, service_pricing_variants tables + modules
    - 02-core-domain/02-products-stock      # products, stock_movements tables + modules
    - 02-core-domain/02-commissions-clients # commission_rules, clients tables + modules
  affects:
    - 03-core-operations  # appointments, comandas will FK to services, clients, products

tech_stack:
  added:
    - Prisma 6.19.3 new models: Category, Service, ServicePricingVariant, Package,
      PackageService, Product, StockMovement, CommissionRule, Client, Notification
    - PostgreSQL FORCE ROW LEVEL SECURITY on 10 new tenant-scoped tables
  patterns:
    - nullif(current_setting('app.current_organization', true), '')::uuid in all RLS policies
    - self-referential Category hierarchy (CategoryHierarchy named relation)
    - composite PK on PackageService junction table (packageId, serviceId)
    - DECIMAL(12,2) for money; DECIMAL(12,4) for commission values
    - soft-delete via deletedAt on all catalog entities (D-26)
    - updated_at triggers reusing Phase 1 fn_set_updated_at()

key_files:
  created:
    - apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql
    - apps/backend/prisma/migrations/20260506010000_seed_phase2_permissions/migration.sql
    - apps/backend/src/catalog/catalog.module.ts
    - apps/backend/src/catalog/categories/categories.module.ts
    - apps/backend/src/catalog/services/services.module.ts
    - apps/backend/src/catalog/packages/packages.module.ts
    - apps/backend/src/catalog/products/products.module.ts
    - apps/backend/src/catalog/commissions/commissions.module.ts
    - apps/backend/src/catalog/notifications/notifications.module.ts
    - apps/backend/src/clients/clients.module.ts
    - apps/backend/test/integration/phase2-schema-smoke.spec.ts
    - apps/backend/test/integration/phase2-modules-boot.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/authz/permissions.catalog.ts
    - apps/backend/src/app.module.ts

key_decisions:
  - "One consolidated Phase 2 migration owns all 11 new tables + members.seniority_tier — Wave 2 plans only add feature code to pre-staged modules"
  - "PackageService junction table uses parent-based RLS (EXISTS subquery on packages) — no organization_id column on junction"
  - "commission_rules.value uses DECIMAL(12,4) not DECIMAL(12,2) — extra precision needed for percentage rates (e.g. 12.345%)"
  - "modules boot test uses FastifyAdapter — backend uses @nestjs/platform-fastify, not Express"

metrics:
  duration_minutes: 14
  completed_date: "2026-05-06"
  tasks: 3
  files: 17
---

# Phase 02 Plan 01: Database Schema Summary

**One-liner:** Complete Phase 2 database foundation — 10 tenant-scoped tables with FORCE RLS, members.seniority_tier ALTER, 14 new permission constants seeded per role, and 7 empty NestJS module skeletons pre-staged for Wave 2 parallel execution.

## What Was Built

### Task 1: Phase 2 Migration Files

**Migration `20260506000000_phase2_catalog_clients/migration.sql` (334 lines):**

- `ALTER TABLE members ADD COLUMN seniority_tier VARCHAR(20) CHECK (...)` — stores junior/pleno/senior tier
- **Catalog tables:** `categories` (hierarchical, 2-level via parent_id), `services` (base_price + duration), `service_pricing_variants` (named variants per service), `packages` (fixed-price bundles), `package_services` (junction, composite PK)
- **Product tables:** `products` (sku unique per org, unit in/ml/g, low-stock index), `stock_movements` (audit trail: initial/manual_adjustment/sale/return)
- **Operational tables:** `commission_rules` (5 scope types, chk_cr_scope_shape constraint enforces FK exclusivity), `clients` (phone OR email required), `notifications` (JSONB payload, read_at nullable)
- **FORCE ROW LEVEL SECURITY** on all 10 new tables using `nullif(current_setting(...))::uuid` pattern
- `package_services` uses EXISTS subquery on parent `packages` row for tenant isolation (no org_id column)
- `updated_at` triggers on mutable tables (reuses Phase 1 `fn_set_updated_at()`)

**Migration `20260506010000_seed_phase2_permissions/migration.sql` (73 lines):**

- Idempotent DO $$ block with ON CONFLICT DO NOTHING
- ADMIN: +14 permissions (all Phase 2) → total 21
- MANAGER: +13 (all Phase 2 except commission.write) → total 17
- ATTENDANT: +7 (catalog reads + client CRUD + notification.read) → total 9
- PROFESSIONAL: +6 (catalog reads + client.read + notification.read) → total 8

Migrations applied via `docker exec sgs_backend npx prisma migrate deploy` — both applied cleanly.

### Task 2: Prisma Schema Update

`apps/backend/prisma/schema.prisma` updated with:

- `Member` model: added `seniorityTier String?`, `stockMovements StockMovement[]`, `notifications Notification[]`, `commissionRules CommissionRule[]`
- `Organization` model: added 9 new Phase 2 relations
- **10 new models:** Category (CategoryHierarchy named self-relation), Service, ServicePricingVariant, Package, PackageService (@@id composite), Product, StockMovement, CommissionRule, Client, Notification
- All Phase 1 conventions: `gen_uuid_v7()` PKs, `@db.Timestamptz(6)`, `@db.Decimal(12,2)` for money

Schema validated (`prisma validate` clean), Prisma client generated (v6.19.3), TypeScript typecheck passes.

Smoke test `phase2-schema-smoke.spec.ts`: 11 tests — all 10 new delegates + Member.seniorityTier select — all pass.

### Task 3: Permissions Catalog + Module Skeletons

**`permissions.catalog.ts`:** Extended from 7 to 21 permission constants. Added Phase 2 section comments. ROLE_PERMISSIONS updated for all 4 roles to match DB seed.

**7 new NestJS modules:**
- `src/catalog/catalog.module.ts` — aggregator importing all 6 sub-modules
- `src/catalog/categories/categories.module.ts`
- `src/catalog/services/services.module.ts`
- `src/catalog/packages/packages.module.ts`
- `src/catalog/products/products.module.ts`
- `src/catalog/commissions/commissions.module.ts`
- `src/catalog/notifications/notifications.module.ts`
- `src/clients/clients.module.ts`

**`app.module.ts`:** Added `CatalogModule` and `ClientsModule` imports after `IdentityModule`.

Modules boot test `phase2-modules-boot.spec.ts`: AppModule compiles + initializes with Fastify adapter — passes in 266ms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used FastifyAdapter in modules boot test**
- **Found during:** Task 3 — `createNestApplication()` failed with "platform-express is missing"
- **Issue:** The plan's boot test used `createNestApplication()` without adapter; backend uses `@nestjs/platform-fastify`, not Express
- **Fix:** Added `new FastifyAdapter()` as argument to `createNestApplication()`
- **Files modified:** `test/integration/phase2-modules-boot.spec.ts`
- **Commit:** 64ebb5e

**2. [Deviation] Migration ran via `docker exec` instead of `pnpm prisma:migrate:deploy`**
- **Found during:** Task 1 — `pnpm prisma:migrate:deploy` failed because Prisma CLI is not installed in the local host environment (only in Docker container)
- **Impact:** None — functionally equivalent. Migrations applied identically; files committed before deployment
- **Note:** npx pulled Prisma 7 which rejected the schema; local node_modules has Prisma 6.19.3 in container; used container's CLI

## Known Stubs

None — this plan creates infrastructure only (tables, schema, empty modules). No UI data rendering, no placeholder text.

## Verification Results

All acceptance criteria met:

- `prisma migrate deploy` exits 0 ✓
- 10 new tables in `pg_tables` ✓
- All 10 tables: `relrowsecurity=true`, `relforcerowsecurity=true` ✓
- All 10 tables: `tenant_isolation` policy present ✓
- `members.seniority_tier` column added ✓
- Role permission counts: ADMIN=21, MANAGER=17, ATTENDANT=9, PROFESSIONAL=8 ✓
- `prisma validate` clean ✓
- `prisma generate` produces v6.19.3 client with all 10 new delegates ✓
- TypeScript `tsc --noEmit` exits 0 ✓
- `phase2-schema-smoke.spec.ts`: 11/11 pass ✓
- `phase2-modules-boot.spec.ts`: 1/1 pass ✓
- 21 permission constants in `permissions.catalog.ts` ✓
- 7 empty module files exist and are wired in `app.module.ts` ✓

## Self-Check: PASSED

Files verified:
- `apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql` ✓
- `apps/backend/prisma/migrations/20260506010000_seed_phase2_permissions/migration.sql` ✓
- `apps/backend/prisma/schema.prisma` (contains `model Category`) ✓
- `apps/backend/src/authz/permissions.catalog.ts` (contains `CATEGORY_READ`) ✓
- `apps/backend/src/catalog/catalog.module.ts` (contains `CatalogModule`) ✓
- `apps/backend/src/app.module.ts` (imports `CatalogModule`, `ClientsModule`) ✓
- All 4 commits exist: ffc6612, 3eed04d, 64ebb5e ✓
