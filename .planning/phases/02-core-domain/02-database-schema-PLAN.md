---
phase: 02-core-domain
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/prisma/schema.prisma
  - apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql
  - apps/backend/src/authz/permissions.catalog.ts
  - apps/backend/src/catalog/catalog.module.ts
  - apps/backend/src/catalog/categories/categories.module.ts
  - apps/backend/src/catalog/services/services.module.ts
  - apps/backend/src/catalog/packages/packages.module.ts
  - apps/backend/src/catalog/products/products.module.ts
  - apps/backend/src/catalog/commissions/commissions.module.ts
  - apps/backend/src/catalog/notifications/notifications.module.ts
  - apps/backend/src/clients/clients.module.ts
  - apps/backend/src/app.module.ts
autonomous: true
requirements: [CAT-01, CAT-02, CAT-03, CAT-04, CLI-01, CLI-02]

must_haves:
  truths:
    - "All 11 Phase 2 tables exist with FORCE ROW LEVEL SECURITY enabled"
    - "Each tenant-scoped table has a tenant_isolation policy using nullif current_setting pattern"
    - "Phase 2 permissions appear in PERMISSIONS catalog and are seeded into ROLE_PERMISSIONS for ADMIN/MANAGER/ATTENDANT/PROFESSIONAL"
    - "Empty NestJS module skeletons exist for each Phase 2 bounded context and are registered in app.module.ts"
    - "Backend boots without errors after migration applies"
  artifacts:
    - path: "apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql"
      provides: "DDL for categories, services, service_pricing_variants, packages, package_services, products, stock_movements, commission_rules, clients, notifications, plus member.seniority_tier ALTER + RLS policies + sgs_app grants"
      contains: "FORCE ROW LEVEL SECURITY"
    - path: "apps/backend/prisma/schema.prisma"
      provides: "Prisma models for all Phase 2 entities + Member.seniorityTier field"
      contains: "model Category"
    - path: "apps/backend/src/authz/permissions.catalog.ts"
      provides: "Phase 2 permission constants and ROLE_PERMISSIONS extensions"
      contains: "CATEGORY_READ"
    - path: "apps/backend/src/catalog/catalog.module.ts"
      provides: "CatalogModule aggregator imported by AppModule"
      contains: "CatalogModule"
  key_links:
    - from: "apps/backend/src/app.module.ts"
      to: "CatalogModule, ClientsModule"
      via: "imports[] array"
      pattern: "CatalogModule"
    - from: "Migration RLS policies"
      to: "TenantContextService SET LOCAL"
      via: "current_setting('app.current_organization')"
      pattern: "nullif\\(current_setting\\('app.current_organization'"
---

<objective>
Establish the complete Phase 2 database foundation: 11 new tables with multi-tenant RLS, an ALTER on `members` for `seniority_tier`, the permission catalog extensions, and empty NestJS module skeletons so all Wave 2 backend plans can run in parallel without merge conflicts on shared files.

Purpose: Wave 2 plans (catalog-services, products-stock, commissions-clients) need a single, indivisible schema migration plus pre-staged shared files (permissions.catalog.ts, app.module.ts) so each can land independently. This plan owns ALL cross-cutting backend concerns; Wave 2 plans own their feature code only.

Output: One Prisma migration file with full DDL + RLS, updated schema.prisma, expanded permissions catalog with seed updates, and 7 empty bounded-context modules registered in AppModule.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-core-domain/02-CONTEXT.md
@.planning/phases/01-foundation/01-PHASE-SUMMARY.md
@apps/backend/prisma/schema.prisma
@apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql
@apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql
@apps/backend/src/authz/permissions.catalog.ts
@apps/backend/src/app.module.ts
@apps/backend/src/database/tenant-context.service.ts

<interfaces>
<!-- Phase 1 conventions Wave 2 plans MUST replicate -->

From apps/backend/prisma/schema.prisma (Phase 1 patterns):
- All tenant-scoped tables: `id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid`
- `organizationId String @map("organization_id") @db.Uuid` on every tenant-scoped model
- `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)`
- `updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)`
- Soft delete: `deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)` (D-26)
- Money: `@db.Decimal(12, 2)` (precedent from PRD §3.3 — no Phase 1 example)
- snake_case table names via `@@map("table_name")`

From apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql:
- RLS pattern (copy verbatim for each new tenant-scoped table):
  ```sql
  ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
  ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON {table}
    USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
    WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
  ```
- ALTER DEFAULT PRIVILEGES already grants future tables to sgs_app — no need to repeat per table

From apps/backend/src/authz/permissions.catalog.ts:
- Pattern `<resource>.<action>` — keep `SCREAMING_SNAKE_CASE` keys, dotted-string values
- `ROLE_PERMISSIONS` is the seed source — but the actual seed is run by migration `20260502010000_seed_role_permissions`. New permissions need a NEW migration `20260506010000_seed_phase2_permissions` that re-syncs role_permissions (idempotent).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author Prisma migration with all Phase 2 tables, RLS, indexes, and ALTER members</name>
  <files>
    apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql
    apps/backend/prisma/migrations/20260506010000_seed_phase2_permissions/migration.sql
  </files>
  <read_first>
    - apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql (RLS pattern, money column convention, default-privileges block)
    - apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql (idempotent permission seed pattern using ON CONFLICT)
    - .planning/phases/02-core-domain/02-CONTEXT.md (decisions D-04, D-07, D-12 to D-22, D-25, D-26)
    - PRD_Banco_Dados_Plataforma_Saloes_v1.1.md (catalog/products/clients/commission_rules schema sections)
  </read_first>
  <action>
Create directory `apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/` with `migration.sql` containing:

**A. ALTER members for seniority (D-08):**
```sql
ALTER TABLE members
  ADD COLUMN seniority_tier VARCHAR(20)
    CHECK (seniority_tier IS NULL OR seniority_tier IN ('junior','pleno','senior'));
```

**B. Create categories (D-04, D-05, D-06, D-25, D-26):**
```sql
CREATE TABLE categories (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  parent_id       UUID,
  name            VARCHAR(120) NOT NULL,
  display_order   INTEGER NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  CONSTRAINT pk_categories PRIMARY KEY (id),
  CONSTRAINT fk_categories_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id)
);
CREATE INDEX ix_categories_org_parent ON categories(organization_id, parent_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_categories_org_order ON categories(organization_id, parent_id, display_order) WHERE deleted_at IS NULL;
```

**C. Create services + service_pricing_variants (D-06, D-07):**
```sql
CREATE TABLE services (
  id                       UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id          UUID NOT NULL,
  category_id              UUID NOT NULL,
  name                     VARCHAR(160) NOT NULL,
  base_price               DECIMAL(12,2) NOT NULL,
  default_duration_minutes INTEGER NOT NULL,
  display_order            INTEGER NOT NULL DEFAULT 0,
  cover_image_url          TEXT,
  created_at               TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ(6),
  CONSTRAINT pk_services PRIMARY KEY (id),
  CONSTRAINT fk_services_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT chk_services_price_nonneg CHECK (base_price >= 0),
  CONSTRAINT chk_services_duration_pos CHECK (default_duration_minutes > 0)
);
CREATE INDEX ix_services_org_category ON services(organization_id, category_id) WHERE deleted_at IS NULL;

CREATE TABLE service_pricing_variants (
  id               UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id  UUID NOT NULL,
  service_id       UUID NOT NULL,
  name             VARCHAR(120) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  seniority_tier   VARCHAR(20) CHECK (seniority_tier IS NULL OR seniority_tier IN ('junior','pleno','senior')),
  price            DECIMAL(12,2) NOT NULL,
  display_order    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_service_pricing_variants PRIMARY KEY (id),
  CONSTRAINT fk_spv_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_spv_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT chk_spv_price_nonneg CHECK (price >= 0),
  CONSTRAINT chk_spv_duration_pos CHECK (duration_minutes > 0)
);
CREATE INDEX ix_spv_service ON service_pricing_variants(service_id);
```

**D. Create packages + package_services (D-09, D-10, D-11):**
```sql
CREATE TABLE packages (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  name            VARCHAR(160) NOT NULL,
  price           DECIMAL(12,2) NOT NULL,
  valid_for_days  INTEGER,
  cover_image_url TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  CONSTRAINT pk_packages PRIMARY KEY (id),
  CONSTRAINT fk_packages_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_packages_price_nonneg CHECK (price >= 0),
  CONSTRAINT chk_packages_valid_pos CHECK (valid_for_days IS NULL OR valid_for_days > 0)
);
CREATE INDEX ix_packages_org ON packages(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE package_services (
  package_id   UUID NOT NULL,
  service_id   UUID NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT pk_package_services PRIMARY KEY (package_id, service_id),
  CONSTRAINT fk_pkgsvc_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_pkgsvc_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT chk_pkgsvc_quantity_pos CHECK (quantity > 0)
);
```

**E. Create products + stock_movements (D-12, D-13, D-14, D-15):**
```sql
CREATE TABLE products (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  name            VARCHAR(160) NOT NULL,
  sku             VARCHAR(60) NOT NULL,
  cost_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  sale_price      DECIMAL(12,2) NOT NULL,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  unit            VARCHAR(10) NOT NULL CHECK (unit IN ('un','ml','g')),
  cover_image_url TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  CONSTRAINT pk_products PRIMARY KEY (id),
  CONSTRAINT fk_products_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT uq_products_org_sku UNIQUE (organization_id, sku),
  CONSTRAINT chk_products_sale_nonneg CHECK (sale_price >= 0),
  CONSTRAINT chk_products_cost_nonneg CHECK (cost_price >= 0),
  CONSTRAINT chk_products_min_stock_nonneg CHECK (min_stock_level >= 0)
);
CREATE INDEX ix_products_org ON products(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_products_low_stock ON products(organization_id) WHERE deleted_at IS NULL AND stock_quantity <= min_stock_level;

CREATE TABLE stock_movements (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  product_id      UUID NOT NULL,
  delta           INTEGER NOT NULL,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('initial','manual_adjustment','sale','return')),
  reason          TEXT,
  performed_by    UUID,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_stock_movements PRIMARY KEY (id),
  CONSTRAINT fk_sm_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_sm_member FOREIGN KEY (performed_by) REFERENCES members(id)
);
CREATE INDEX ix_sm_product_created ON stock_movements(product_id, created_at DESC);
CREATE INDEX ix_sm_org_created ON stock_movements(organization_id, created_at DESC);
```

**F. Create commission_rules (D-17, D-18, D-19):**
```sql
CREATE TABLE commission_rules (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  scope_type      VARCHAR(20) NOT NULL CHECK (scope_type IN ('member_service','service','category','product','default')),
  service_id      UUID,
  member_id       UUID,
  category_id     UUID,
  product_id      UUID,
  kind            VARCHAR(20) NOT NULL CHECK (kind IN ('fixed','percentage')),
  value           DECIMAL(12,4) NOT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  CONSTRAINT pk_commission_rules PRIMARY KEY (id),
  CONSTRAINT fk_cr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cr_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_cr_member FOREIGN KEY (member_id) REFERENCES members(id),
  CONSTRAINT fk_cr_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_cr_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_cr_value_nonneg CHECK (value >= 0),
  CONSTRAINT chk_cr_scope_shape CHECK (
    (scope_type = 'member_service' AND member_id IS NOT NULL AND service_id IS NOT NULL AND category_id IS NULL AND product_id IS NULL) OR
    (scope_type = 'service'        AND service_id IS NOT NULL AND member_id IS NULL AND category_id IS NULL AND product_id IS NULL) OR
    (scope_type = 'category'       AND category_id IS NOT NULL AND member_id IS NULL AND service_id IS NULL AND product_id IS NULL) OR
    (scope_type = 'product'        AND product_id IS NOT NULL AND member_id IS NULL AND service_id IS NULL AND category_id IS NULL) OR
    (scope_type = 'default'        AND member_id IS NULL AND service_id IS NULL AND category_id IS NULL AND product_id IS NULL)
  )
);
CREATE UNIQUE INDEX uq_cr_org_default ON commission_rules(organization_id) WHERE scope_type = 'default' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_cr_org_member_service ON commission_rules(organization_id, member_id, service_id) WHERE scope_type = 'member_service' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_cr_org_service ON commission_rules(organization_id, service_id) WHERE scope_type = 'service' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_cr_org_category ON commission_rules(organization_id, category_id) WHERE scope_type = 'category' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_cr_org_product ON commission_rules(organization_id, product_id) WHERE scope_type = 'product' AND deleted_at IS NULL;
```

**G. Create clients (D-20, D-21, D-22):**
```sql
CREATE TABLE clients (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  phone           VARCHAR(30),
  email           VARCHAR(255),
  cpf             VARCHAR(14),
  birth_date      DATE,
  address         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_clients PRIMARY KEY (id),
  CONSTRAINT fk_clients_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_clients_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX ix_clients_org_name ON clients(organization_id, full_name) WHERE deleted_at IS NULL;
CREATE INDEX ix_clients_org_cpf ON clients(organization_id, cpf) WHERE cpf IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_clients_org_phone ON clients(organization_id, phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_clients_org_email ON clients(organization_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;
```

**H. Create notifications (D-15 + spec):**
```sql
CREATE TABLE notifications (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  member_id       UUID,
  kind            VARCHAR(40) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  read_at         TIMESTAMPTZ(6),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_notifications PRIMARY KEY (id),
  CONSTRAINT fk_notif_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_notif_member FOREIGN KEY (member_id) REFERENCES members(id)
);
CREATE INDEX ix_notif_org_member_unread ON notifications(organization_id, member_id, created_at DESC) WHERE read_at IS NULL;
```

**I. Enable FORCE RLS + tenant_isolation policy on each new tenant-scoped table.** Apply this exact block (copy from init migration line 279-323) for: `categories`, `services`, `service_pricing_variants`, `packages`, `products`, `stock_movements`, `commission_rules`, `clients`, `notifications`. Pattern:
```sql
ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {t} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {t}
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
```

**Special case `package_services`** — junction table, derive tenancy via parent:
```sql
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON package_services
  USING (
    EXISTS (
      SELECT 1 FROM packages p
      WHERE p.id = package_services.package_id
        AND p.organization_id = nullif(current_setting('app.current_organization', true), '')::uuid
    )
  );
```

**J. Grants:** No explicit GRANTs needed — `ALTER DEFAULT PRIVILEGES` from init migration already covers new tables (verified at init migration line 332-337).

**K. Second migration `20260506010000_seed_phase2_permissions/migration.sql` — idempotent permission seed.** Copy structure from `20260502010000_seed_role_permissions/migration.sql`. INSERT (with `ON CONFLICT (role_id, permission) DO NOTHING`) the new permissions per role:

ADMIN gets: `category.read`, `category.write`, `service.read`, `service.write`, `package.read`, `package.write`, `product.read`, `product.write`, `product.adjustStock`, `commission.read`, `commission.write`, `client.read`, `client.write`, `notification.read`.

MANAGER gets: same as ADMIN minus `commission.write` (managers don't define comp policy by default).

ATTENDANT gets: `category.read`, `service.read`, `package.read`, `product.read`, `client.read`, `client.write`, `notification.read`.

PROFESSIONAL gets: `category.read`, `service.read`, `package.read`, `product.read`, `client.read`, `notification.read`.

Use the same `WITH role_id_lookup AS (SELECT id FROM roles WHERE name = 'X' AND is_system = true)` pattern from the original seed.

**L. Run `pnpm --filter @sgs/backend prisma migrate dev --name phase2_catalog_clients` once locally (or document the command).** Then run `pnpm --filter @sgs/backend prisma generate` to refresh Prisma client.
  </action>
  <verify>
    <automated>cd apps/backend && pnpm prisma migrate deploy &amp;&amp; psql "$DIRECT_URL" -c "\dt" | grep -E "categories|services|service_pricing_variants|packages|package_services|products|stock_movements|commission_rules|clients|notifications" | wc -l | grep -q "10" &amp;&amp; psql "$DIRECT_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = true" | grep -E "categories|services|products|clients|notifications" | wc -l | grep -q "9"</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql` exists and is &gt; 200 lines
    - File `apps/backend/prisma/migrations/20260506010000_seed_phase2_permissions/migration.sql` exists and contains all 14 new permissions distributed per role
    - `pnpm prisma migrate deploy` exits 0
    - `pg_tables` shows 10 new tables: categories, services, service_pricing_variants, packages, package_services, products, stock_movements, commission_rules, clients, notifications
    - Each new tenant-scoped table has `rowsecurity = true` and `forcerowsecurity = true` in `pg_class`
    - Each new tenant-scoped table has a policy named `tenant_isolation` (`SELECT count(*) FROM pg_policies WHERE policyname='tenant_isolation' AND tablename IN (...)` returns 10 — including package_services)
    - `members` table has new column `seniority_tier VARCHAR(20)` (`\d members` shows it)
    - SELECT count(*) FROM role_permissions returns &gt; original Phase 1 count (verify new perms seeded)
    - `psql -c "INSERT INTO categories (organization_id, name) VALUES (gen_uuid_v7(), 'X')"` as sgs_app role FAILS without app.current_organization set (RLS violation message)
  </acceptance_criteria>
  <done>
    - Both migration files committed
    - `prisma migrate deploy` runs clean against fresh DB
    - All 10 new tables enforce RLS using the Phase 1 nullif/current_setting pattern
    - sgs_app cannot write to any new tenant-scoped table without `app.current_organization` set
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update Prisma schema models for all Phase 2 entities + Member seniorityTier</name>
  <files>apps/backend/prisma/schema.prisma</files>
  <read_first>
    - apps/backend/prisma/schema.prisma (current model conventions, Phase 1 patterns)
    - apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql (Task 1 output — schema must mirror exactly)
  </read_first>
  <behavior>
    - `Member` model has new optional field `seniorityTier String? @map("seniority_tier") @db.VarChar(20)`
    - `Category` model with self-referential parent relation (`parent Category?`, `children Category[]`)
    - `Service` model with `category Category` relation, `pricingVariants ServicePricingVariant[]`, `commissionRules CommissionRule[]`
    - `ServicePricingVariant` with `service Service` relation
    - `Package` model with `services Service[]` via junction `PackageService`
    - `PackageService` junction model with composite PK `[packageId, serviceId]`
    - `Product` with `stockMovements StockMovement[]` and `commissionRules CommissionRule[]`
    - `StockMovement` with `product Product` and optional `performedBy Member?`
    - `CommissionRule` with optional relations to all four scope FKs
    - `Client` standalone (no relations to add yet — history is a stub in Phase 2 per D-23)
    - `Notification` with optional `member Member?` relation
    - All decimals use `@db.Decimal(12, 2)` except `commission_rules.value` which is `@db.Decimal(12, 4)`
    - All snake_case via `@map`/`@@map`
  </behavior>
  <action>
Append to `apps/backend/prisma/schema.prisma` (after the existing `OutboxEvent` model). Add a section header `// ===== Catalog =====` then `// ===== Clients =====` then `// ===== Notifications =====`.

Also modify the existing `Member` model to add:
```prisma
  seniorityTier String? @map("seniority_tier") @db.VarChar(20)
  stockMovements StockMovement[]
  notifications  Notification[]
  commissionRules CommissionRule[]
```

Also modify `Organization` to add the new relations:
```prisma
  categories       Category[]
  services         Service[]
  pricingVariants  ServicePricingVariant[]
  packages         Package[]
  products         Product[]
  stockMovements   StockMovement[]
  commissionRules  CommissionRule[]
  clients          Client[]
  notifications    Notification[]
```

Add models (verbatim):

```prisma
// ===== Catalog =====

model Category {
  id             String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  parentId       String?   @map("parent_id") @db.Uuid
  name           String    @db.VarChar(120)
  displayOrder   Int       @default(0) @map("display_order")
  coverImageUrl  String?   @map("cover_image_url") @db.Text
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  parent       Category?    @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children     Category[]   @relation("CategoryHierarchy")
  services     Service[]
  commissionRules CommissionRule[]

  @@index([organizationId, parentId], name: "ix_categories_org_parent")
  @@index([organizationId, parentId, displayOrder], name: "ix_categories_org_order")
  @@map("categories")
}

model Service {
  id                     String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId         String    @map("organization_id") @db.Uuid
  categoryId             String    @map("category_id") @db.Uuid
  name                   String    @db.VarChar(160)
  basePrice              Decimal   @map("base_price") @db.Decimal(12, 2)
  defaultDurationMinutes Int       @map("default_duration_minutes")
  displayOrder           Int       @default(0) @map("display_order")
  coverImageUrl          String?   @map("cover_image_url") @db.Text
  createdAt              DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt              DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt              DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization     Organization            @relation(fields: [organizationId], references: [id])
  category         Category                @relation(fields: [categoryId], references: [id])
  pricingVariants  ServicePricingVariant[]
  packages         PackageService[]
  commissionRules  CommissionRule[]

  @@index([organizationId, categoryId], name: "ix_services_org_category")
  @@map("services")
}

model ServicePricingVariant {
  id              String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId  String    @map("organization_id") @db.Uuid
  serviceId       String    @map("service_id") @db.Uuid
  name            String    @db.VarChar(120)
  durationMinutes Int       @map("duration_minutes")
  seniorityTier   String?   @map("seniority_tier") @db.VarChar(20)
  price           Decimal   @db.Decimal(12, 2)
  displayOrder    Int       @default(0) @map("display_order")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  service      Service      @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@index([serviceId], name: "ix_spv_service")
  @@map("service_pricing_variants")
}

model Package {
  id              String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId  String    @map("organization_id") @db.Uuid
  name            String    @db.VarChar(160)
  price           Decimal   @db.Decimal(12, 2)
  validForDays    Int?      @map("valid_for_days")
  coverImageUrl   String?   @map("cover_image_url") @db.Text
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization Organization     @relation(fields: [organizationId], references: [id])
  services     PackageService[]

  @@index([organizationId], name: "ix_packages_org")
  @@map("packages")
}

model PackageService {
  packageId    String @map("package_id") @db.Uuid
  serviceId    String @map("service_id") @db.Uuid
  quantity     Int    @default(1)
  displayOrder Int    @default(0) @map("display_order")

  package Package @relation(fields: [packageId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id])

  @@id([packageId, serviceId])
  @@map("package_services")
}

model Product {
  id              String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId  String    @map("organization_id") @db.Uuid
  name            String    @db.VarChar(160)
  sku             String    @db.VarChar(60)
  costPrice       Decimal   @default(0) @map("cost_price") @db.Decimal(12, 2)
  salePrice       Decimal   @map("sale_price") @db.Decimal(12, 2)
  stockQuantity   Int       @default(0) @map("stock_quantity")
  minStockLevel   Int       @default(0) @map("min_stock_level")
  unit            String    @db.VarChar(10)
  coverImageUrl   String?   @map("cover_image_url") @db.Text
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization    Organization     @relation(fields: [organizationId], references: [id])
  stockMovements  StockMovement[]
  commissionRules CommissionRule[]

  @@unique([organizationId, sku], name: "uq_products_org_sku")
  @@index([organizationId], name: "ix_products_org")
  @@map("products")
}

model StockMovement {
  id             String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  productId      String   @map("product_id") @db.Uuid
  delta          Int
  type           String   @db.VarChar(20)
  reason         String?  @db.Text
  performedBy    String?  @map("performed_by") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  product      Product      @relation(fields: [productId], references: [id])
  performer    Member?      @relation(fields: [performedBy], references: [id])

  @@index([productId, createdAt(sort: Desc)], name: "ix_sm_product_created")
  @@index([organizationId, createdAt(sort: Desc)], name: "ix_sm_org_created")
  @@map("stock_movements")
}

model CommissionRule {
  id             String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  scopeType      String    @map("scope_type") @db.VarChar(20)
  serviceId      String?   @map("service_id") @db.Uuid
  memberId       String?   @map("member_id") @db.Uuid
  categoryId     String?   @map("category_id") @db.Uuid
  productId      String?   @map("product_id") @db.Uuid
  kind           String    @db.VarChar(20)
  value          Decimal   @db.Decimal(12, 4)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  service      Service?     @relation(fields: [serviceId], references: [id])
  member       Member?      @relation(fields: [memberId], references: [id])
  category     Category?    @relation(fields: [categoryId], references: [id])
  product      Product?     @relation(fields: [productId], references: [id])

  @@map("commission_rules")
}

// ===== Clients =====

model Client {
  id             String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  fullName       String    @map("full_name") @db.VarChar(255)
  phone          String?   @db.VarChar(30)
  email          String?   @db.VarChar(255)
  cpf            String?   @db.VarChar(14)
  birthDate      DateTime? @map("birth_date") @db.Date
  address        String?   @db.Text
  notes          String?   @db.Text
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)
  version        Int       @default(1)

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, fullName], name: "ix_clients_org_name")
  @@map("clients")
}

// ===== Notifications =====

model Notification {
  id             String    @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  memberId       String?   @map("member_id") @db.Uuid
  kind           String    @db.VarChar(40)
  payload        Json      @default("{}") @db.JsonB
  readAt         DateTime? @map("read_at") @db.Timestamptz(6)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  member       Member?      @relation(fields: [memberId], references: [id])

  @@map("notifications")
}
```

Then run `pnpm --filter @sgs/backend prisma generate` to refresh the client. Add a tiny smoke test `apps/backend/test/integration/phase2-schema-smoke.spec.ts` that imports the generated Prisma client and verifies all new model names compile (e.g., `prisma.category`, `prisma.service`, etc., no runtime DB call needed for type assertion).
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm prisma format --check &amp;&amp; pnpm prisma validate &amp;&amp; pnpm prisma generate &amp;&amp; pnpm typecheck &amp;&amp; pnpm test:int -- --testPathPattern phase2-schema-smoke</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm prisma validate` exits 0
    - `pnpm prisma format --check` exits 0 (schema is canonical)
    - `pnpm prisma generate` produces `node_modules/.prisma/client/index.d.ts` containing exported types: `Category`, `Service`, `ServicePricingVariant`, `Package`, `PackageService`, `Product`, `StockMovement`, `CommissionRule`, `Client`, `Notification`
    - `pnpm typecheck` exits 0
    - Smoke test `phase2-schema-smoke.spec.ts` imports Prisma client and references each new delegate (`prisma.category`, `prisma.service`, etc.) without TypeScript errors
    - `Member` model in schema.prisma has line `seniorityTier String? @map("seniority_tier") @db.VarChar(20)`
  </acceptance_criteria>
  <done>
    - schema.prisma compiles, generates types, and includes all 10 new models + Member.seniorityTier
    - Smoke test asserts each new Prisma delegate is a function/object
  </done>
</task>

<task type="auto">
  <name>Task 3: Pre-stage permissions catalog and empty NestJS bounded-context modules for Wave 2 parallelism</name>
  <files>
    apps/backend/src/authz/permissions.catalog.ts
    apps/backend/src/catalog/catalog.module.ts
    apps/backend/src/catalog/categories/categories.module.ts
    apps/backend/src/catalog/services/services.module.ts
    apps/backend/src/catalog/packages/packages.module.ts
    apps/backend/src/catalog/products/products.module.ts
    apps/backend/src/catalog/commissions/commissions.module.ts
    apps/backend/src/catalog/notifications/notifications.module.ts
    apps/backend/src/clients/clients.module.ts
    apps/backend/src/app.module.ts
  </files>
  <read_first>
    - apps/backend/src/authz/permissions.catalog.ts (current PERMISSIONS + ROLE_PERMISSIONS)
    - apps/backend/src/app.module.ts (current imports[] order)
    - apps/backend/src/identity/identity.module.ts (existing bounded-context module pattern)
  </read_first>
  <action>
**A. Extend `apps/backend/src/authz/permissions.catalog.ts`:**

Add new entries to `PERMISSIONS` const (keep alphabetical-ish per resource):
```ts
  CATEGORY_READ:  'category.read',
  CATEGORY_WRITE: 'category.write',

  SERVICE_READ:  'service.read',
  SERVICE_WRITE: 'service.write',

  PACKAGE_READ:  'package.read',
  PACKAGE_WRITE: 'package.write',

  PRODUCT_READ:        'product.read',
  PRODUCT_WRITE:       'product.write',
  PRODUCT_ADJUST_STOCK:'product.adjustStock',

  COMMISSION_READ:  'commission.read',
  COMMISSION_WRITE: 'commission.write',

  CLIENT_READ:  'client.read',
  CLIENT_WRITE: 'client.write',

  NOTIFICATION_READ: 'notification.read',
```

Update `ROLE_PERMISSIONS` per role:
- `ADMIN` array: append all 14 new permissions (the catalog above).
- `MANAGER` array: append all 14 EXCEPT `COMMISSION_WRITE` (so 13 new perms).
- `ATTENDANT` array: append `CATEGORY_READ`, `SERVICE_READ`, `PACKAGE_READ`, `PRODUCT_READ`, `CLIENT_READ`, `CLIENT_WRITE`, `NOTIFICATION_READ`.
- `PROFESSIONAL` array: append `CATEGORY_READ`, `SERVICE_READ`, `PACKAGE_READ`, `PRODUCT_READ`, `CLIENT_READ`, `NOTIFICATION_READ`.

The DB seed for these is in the migration from Task 1; this file is the typed source of truth used by `@RequirePermission(...)` decorators.

**B. Create empty NestJS modules.** Each module file follows the IdentityModule template:

```ts
// apps/backend/src/catalog/catalog.module.ts
import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
import { PackagesModule } from './packages/packages.module';
import { ProductsModule } from './products/products.module';
import { CommissionsModule } from './commissions/commissions.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    CategoriesModule,
    ServicesModule,
    PackagesModule,
    ProductsModule,
    CommissionsModule,
    NotificationsModule,
  ],
})
export class CatalogModule {}
```

For each sub-module (`categories`, `services`, `packages`, `products`, `commissions`, `notifications`):
```ts
// apps/backend/src/catalog/{name}/{name}.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class {Pascal}Module {}
```

Where `{Pascal}` = `Categories`, `Services`, `Packages`, `Products`, `Commissions`, `Notifications`.

For `apps/backend/src/clients/clients.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthzModule } from '../authz/authz.module';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class ClientsModule {}
```

**C. Register modules in `apps/backend/src/app.module.ts`:**

Add to imports list (after `IdentityModule`):
```ts
import { CatalogModule } from './catalog/catalog.module';
import { ClientsModule } from './clients/clients.module';
// ...
imports: [
  // ... existing
  IdentityModule,
  CatalogModule,
  ClientsModule,
  HealthModule,
],
```

**D. Backend boot smoke test.** Add `apps/backend/test/integration/phase2-modules-boot.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

describe('Phase 2 module skeletons', () => {
  it('AppModule compiles with CatalogModule + ClientsModule registered', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    expect(app).toBeDefined();
    await app.close();
  });
});
```

NOTE: empty modules with no providers/resolvers MUST still compile under NestJS — verified by this smoke test.
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test:int -- --testPathPattern phase2-modules-boot</automated>
  </verify>
  <acceptance_criteria>
    - `permissions.catalog.ts` exports 14 new constants matching the list above (verify with `grep -c "_READ:\\|_WRITE:" apps/backend/src/authz/permissions.catalog.ts` &gt;= 21)
    - `ROLE_PERMISSIONS.ADMIN` array length increased by 14 vs Phase 1
    - `ROLE_PERMISSIONS.MANAGER` array length increased by 13
    - `ROLE_PERMISSIONS.ATTENDANT` array length increased by 7
    - `ROLE_PERMISSIONS.PROFESSIONAL` array length increased by 6
    - 7 new module files exist under `apps/backend/src/catalog/` and `apps/backend/src/clients/`
    - `apps/backend/src/app.module.ts` imports `CatalogModule` and `ClientsModule` (grep finds both names)
    - `phase2-modules-boot.spec.ts` passes — Nest app initializes without DI errors
    - `pnpm typecheck` passes
  </acceptance_criteria>
  <done>
    - 14 new permission constants exist; ROLE_PERMISSIONS extended for all 4 roles
    - 7 empty NestJS modules registered and boot under Nest test harness
    - Wave 2 plans can now add resolvers/services to their respective modules without touching shared files
  </done>
</task>

</tasks>

<verification>
- Migration applies cleanly to fresh DB and is idempotent on re-apply (no destructive operations)
- All 10 new tenant-scoped tables enforce RLS with the exact `nullif(current_setting('app.current_organization', true), '')::uuid` pattern
- Prisma schema validates and generates client types for every new model
- Permissions catalog typed source of truth + DB seed match
- Backend boots with all 7 new empty modules registered
</verification>

<success_criteria>
- `pnpm prisma migrate deploy` exits 0 against a freshly-reset Phase 1 DB
- `SELECT count(*) FROM pg_tables WHERE schemaname='public'` returns Phase 1 count + 10
- `pnpm typecheck` and `pnpm test:int -- --testPathPattern phase2-modules-boot` both pass
- Insert into a tenant-scoped Phase 2 table without `app.current_organization` SET fails as expected
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-domain/02-database-schema-SUMMARY.md` listing migration files, new Prisma models, new permission constants, and the empty module structure for Wave 2 to consume.
</output>
