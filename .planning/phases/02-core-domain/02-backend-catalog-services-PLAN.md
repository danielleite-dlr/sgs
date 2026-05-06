---
phase: 02-core-domain
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/backend/src/graphql/schema/catalog.graphql
  - apps/backend/src/catalog/categories/categories.service.ts
  - apps/backend/src/catalog/categories/categories.resolver.ts
  - apps/backend/src/catalog/categories/dto/category.input.ts
  - apps/backend/src/catalog/categories/categories.module.ts
  - apps/backend/src/catalog/services/services.service.ts
  - apps/backend/src/catalog/services/services.resolver.ts
  - apps/backend/src/catalog/services/dto/service.input.ts
  - apps/backend/src/catalog/services/services.module.ts
  - apps/backend/src/catalog/packages/packages.service.ts
  - apps/backend/src/catalog/packages/packages.resolver.ts
  - apps/backend/src/catalog/packages/dto/package.input.ts
  - apps/backend/src/catalog/packages/packages.module.ts
  - apps/backend/test/integration/catalog-categories.e2e.spec.ts
  - apps/backend/test/integration/catalog-services.e2e.spec.ts
  - apps/backend/test/integration/catalog-packages.e2e.spec.ts
autonomous: true
requirements: [CAT-01, CAT-02]

must_haves:
  truths:
    - "ADMIN/MANAGER can create, list, update, soft-delete categories with parent depth ≤ 2"
    - "Service mutations accept pricing_variants array; created service exposes them via GraphQL"
    - "Package create/update enforces fixed composition (services swap requires update mutation, no inline edits)"
    - "All catalog mutations write through TenantContextService and respect RLS"
    - "RLS isolation test confirms org A cannot read org B's categories/services/packages"
    - "Soft-delete sets deleted_at; default queries filter deletedAt IS NULL"
  artifacts:
    - path: "apps/backend/src/graphql/schema/catalog.graphql"
      provides: "SDL for Category, Service, ServicePricingVariant, Package types + CRUD mutations"
      contains: "type Category"
    - path: "apps/backend/src/catalog/categories/categories.service.ts"
      provides: "CRUD with parent depth validation (parent.parentId must be null)"
      min_lines: 80
    - path: "apps/backend/src/catalog/services/services.service.ts"
      provides: "CRUD for services + nested pricing variants in single transaction"
      min_lines: 120
    - path: "apps/backend/src/catalog/packages/packages.service.ts"
      provides: "CRUD for packages with package_services junction sync"
      min_lines: 100
  key_links:
    - from: "categories.service.ts"
      to: "TenantContextService.runWithTenant"
      via: "all DB ops wrapped"
      pattern: "runWithTenant"
    - from: "services.service.ts"
      to: "service_pricing_variants table"
      via: "tx.servicePricingVariant.createMany within service create tx"
      pattern: "servicePricingVariant"
    - from: "packages.service.ts"
      to: "package_services junction"
      via: "tx.packageService.deleteMany + createMany on update"
      pattern: "packageService"
---

<objective>
Implement the catalog backend domain: categories (hierarchical, max 2 levels), services (with nested pricing variants), and packages (fixed composition with own price). All three are exposed via GraphQL SDL with full CRUD, gated by `@RequirePermission`, write through `TenantContextService.runWithTenant`, and have integration tests covering happy path + tenant isolation + business rules.

Purpose: Phase 2 success criteria 1 and 2 require proprietários to create categories, add services with junior/senior pricing, and build packages with a price separate from the sum of services. This plan delivers the data layer; Wave 3 builds the UI.

Output: Three feature folders under `apps/backend/src/catalog/`, one consolidated GraphQL SDL `catalog.graphql`, three integration test specs.
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
@.planning/phases/02-core-domain/02-database-schema-SUMMARY.md
@.planning/phases/01-foundation/01-PHASE-SUMMARY.md
@apps/backend/prisma/schema.prisma
@apps/backend/src/database/tenant-context.service.ts
@apps/backend/src/authz/permissions.catalog.ts
@apps/backend/src/authz/decorators/require-permission.decorator.ts
@apps/backend/src/authz/decorators/current-tenant.decorator.ts
@apps/backend/src/auth/auth.service.ts
@apps/backend/src/graphql/schema/auth.graphql
@apps/backend/src/graphql/schema/scalars.graphql
@apps/backend/test/integration/rls-isolation.spec.ts

<interfaces>
<!-- Phase 1 + Plan 01 contracts Wave 2 plans MUST use without modification -->

From apps/backend/src/database/tenant-context.service.ts:
```ts
runWithTenant<T>(organizationId: string, fn: (tx: TenantPrismaClient) => Promise<T>): Promise<T>
runWithoutTenant<T>(fn: (tx: TenantPrismaClient) => Promise<T>): Promise<T>
```
ALL tenant-scoped reads/writes MUST go through `runWithTenant`. Bare `prisma.category.findMany()` calls are FORBIDDEN — they will leak across orgs because PgBouncer reuses connections and `app.current_organization` is unset.

From apps/backend/src/authz/decorators/require-permission.decorator.ts:
```ts
@RequirePermission(PERMISSIONS.CATEGORY_WRITE)  // gate mutation
@RequirePermission(PERMISSIONS.CATEGORY_READ)   // gate query
```
PermissionGuard runs after JWT auth and TenantContextInterceptor — `tenant` (TenantContext) is in GraphQL context.

From apps/backend/src/authz/decorators/current-tenant.decorator.ts (resolvers):
```ts
@CurrentTenant() tenant: TenantContext  // { organizationId, memberId, roleName }
```

From Plan 01 schema:
- Categories: parent_id nullable, depth ≤ 2 (validated in service: `parent.parentId == null`)
- Services: category_id NOT NULL, base_price DECIMAL(12,2), default_duration_minutes INT
- ServicePricingVariant: service_id with ON DELETE CASCADE, optional seniorityTier
- Packages: own price; package_services junction with quantity (default 1) and displayOrder

GraphQL schema-first pattern (apps/backend/src/graphql/schema/auth.graphql):
- `extend type Query { ... }` and `extend type Mutation { ... }`
- Use `UUID` and `DateTime` scalars from scalars.graphql
- Errors-as-data: every mutation payload has `errors: [UserError!]!` (precedent set by `AuthPayload`)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Categories domain — service, resolver, SDL, integration test</name>
  <files>
    apps/backend/src/graphql/schema/catalog.graphql
    apps/backend/src/catalog/categories/categories.service.ts
    apps/backend/src/catalog/categories/categories.resolver.ts
    apps/backend/src/catalog/categories/dto/category.input.ts
    apps/backend/src/catalog/categories/categories.module.ts
    apps/backend/test/integration/catalog-categories.e2e.spec.ts
  </files>
  <read_first>
    - apps/backend/src/graphql/schema/auth.graphql (extend type pattern, errors-as-data)
    - apps/backend/src/auth/auth.service.ts (errorPayload pattern, $transaction usage)
    - apps/backend/src/database/tenant-context.service.ts (runWithTenant signature)
    - apps/backend/test/integration/rls-isolation.spec.ts (test harness for tenant isolation)
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-04, D-05, D-06, D-26, D-27)
    - apps/backend/prisma/schema.prisma — Category model
  </read_first>
  <behavior>
    - createCategory({ name, parentId? }) returns Category. parentId null → root. parentId set → fetch parent, error CATEGORY_DEPTH if `parent.parentId !== null`.
    - listCategories returns root categories with embedded `children` (1-level deep tree). Filters `deleted_at IS NULL` by default.
    - updateCategory({ id, name?, displayOrder?, parentId? }) supports rename, reorder, reparent (with same depth check).
    - softDeleteCategory({ id }) sets `deleted_at = NOW()`. Cannot delete category with active children → error CATEGORY_HAS_CHILDREN.
    - reorderCategory({ id, direction: UP | DOWN }) swaps `displayOrder` with sibling.
    - All operations return `errors: []` on success or specific UserError code on failure (no exceptions for business errors).
    - RLS: org A cannot list/read/update/delete org B's categories.
  </behavior>
  <action>
**A. Append to `apps/backend/src/graphql/schema/catalog.graphql` (CREATE the file with this Categories block first; Tasks 2 and 3 append):**

```graphql
# ===== Categories =====

extend type Query {
  categories: [Category!]!
  category(id: UUID!): Category
}

extend type Mutation {
  createCategory(input: CreateCategoryInput!): CategoryPayload!
  updateCategory(input: UpdateCategoryInput!): CategoryPayload!
  reorderCategory(input: ReorderCategoryInput!): CategoryPayload!
  softDeleteCategory(input: SoftDeleteInput!): CategoryPayload!
}

type Category {
  id: UUID!
  name: String!
  parentId: UUID
  parent: Category
  children: [Category!]!
  displayOrder: Int!
  coverImageUrl: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

input CreateCategoryInput {
  name: String!
  parentId: UUID
}

input UpdateCategoryInput {
  id: UUID!
  name: String
  parentId: UUID
  displayOrder: Int
}

input ReorderCategoryInput {
  id: UUID!
  direction: ReorderDirection!
}

enum ReorderDirection { UP DOWN }

input SoftDeleteInput {
  id: UUID!
}

type CategoryPayload {
  category: Category
  errors: [UserError!]!
}
```

NOTE: `UserError` is defined in `auth.graphql`. Reuse it.

**B. Create `dto/category.input.ts` with class-validator:**

```ts
import { IsOptional, IsString, IsUUID, MinLength, MaxLength, IsInt, Min } from 'class-validator';

export class CreateCategoryInput {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsUUID() parentId?: string;
}

export class UpdateCategoryInput {
  @IsUUID() id!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export type ReorderDirection = 'UP' | 'DOWN';
```

**C. Create `categories.service.ts`:**

```ts
import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

interface UserError { code: string; message: string; field?: string | null; }

@Injectable()
export class CategoriesService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(orgId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      return tx.category.findMany({
        where: { deletedAt: null },
        orderBy: [{ parentId: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
        include: { children: { where: { deletedAt: null }, orderBy: [{ displayOrder: 'asc' }] } },
      });
    });
  }

  async getById(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.category.findFirst({ where: { id, deletedAt: null }, include: { children: true, parent: true } }),
    );
  }

  async create(orgId: string, input: { name: string; parentId?: string }) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      if (input.parentId) {
        const parent = await tx.category.findFirst({ where: { id: input.parentId, deletedAt: null } });
        if (!parent) return errorPayload({ code: 'PARENT_NOT_FOUND', message: 'Categoria principal não encontrada.', field: 'parentId' });
        if (parent.parentId !== null) return errorPayload({ code: 'CATEGORY_DEPTH', message: 'Uma subcategoria não pode ter subcategorias.', field: 'parentId' });
      }
      const last = await tx.category.findFirst({
        where: { parentId: input.parentId ?? null, deletedAt: null },
        orderBy: { displayOrder: 'desc' },
      });
      const nextOrder = last ? last.displayOrder + 1 : 0;
      const category = await tx.category.create({
        data: { organizationId: orgId, name: input.name, parentId: input.parentId ?? null, displayOrder: nextOrder },
      });
      return { category, errors: [] as UserError[] };
    });
  }

  async update(orgId: string, input: { id: string; name?: string; parentId?: string | null; displayOrder?: number }) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.category.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!existing) return errorPayload({ code: 'NOT_FOUND', message: 'Categoria não encontrada.' });
      if (input.parentId) {
        if (input.parentId === input.id) return errorPayload({ code: 'CATEGORY_SELF_PARENT', message: 'Categoria não pode ser pai de si mesma.', field: 'parentId' });
        const parent = await tx.category.findFirst({ where: { id: input.parentId, deletedAt: null } });
        if (!parent) return errorPayload({ code: 'PARENT_NOT_FOUND', message: 'Categoria principal não encontrada.', field: 'parentId' });
        if (parent.parentId !== null) return errorPayload({ code: 'CATEGORY_DEPTH', message: 'Uma subcategoria não pode ter subcategorias.', field: 'parentId' });
        // If reparenting and existing has children, that violates depth too
        const childCount = await tx.category.count({ where: { parentId: input.id, deletedAt: null } });
        if (childCount > 0) return errorPayload({ code: 'CATEGORY_DEPTH', message: 'Uma subcategoria não pode ter subcategorias.', field: 'parentId' });
      }
      const category = await tx.category.update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          parentId: input.parentId === undefined ? existing.parentId : input.parentId,
          displayOrder: input.displayOrder ?? existing.displayOrder,
        },
      });
      return { category, errors: [] as UserError[] };
    });
  }

  async reorder(orgId: string, input: { id: string; direction: 'UP' | 'DOWN' }) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await tx.category.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!cur) return errorPayload({ code: 'NOT_FOUND', message: 'Categoria não encontrada.' });
      const op = input.direction === 'UP' ? { lt: cur.displayOrder } : { gt: cur.displayOrder };
      const sibling = await tx.category.findFirst({
        where: { parentId: cur.parentId, deletedAt: null, displayOrder: op },
        orderBy: { displayOrder: input.direction === 'UP' ? 'desc' : 'asc' },
      });
      if (!sibling) return { category: cur, errors: [] as UserError[] };
      await tx.$transaction([
        tx.category.update({ where: { id: cur.id }, data: { displayOrder: sibling.displayOrder } }),
        tx.category.update({ where: { id: sibling.id }, data: { displayOrder: cur.displayOrder } }),
      ]);
      const updated = await tx.category.findUnique({ where: { id: cur.id } });
      return { category: updated, errors: [] as UserError[] };
    });
  }

  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await tx.category.findFirst({ where: { id, deletedAt: null } });
      if (!cur) return errorPayload({ code: 'NOT_FOUND', message: 'Categoria não encontrada.' });
      const childCount = await tx.category.count({ where: { parentId: id, deletedAt: null } });
      if (childCount > 0) return errorPayload({ code: 'CATEGORY_HAS_CHILDREN', message: 'Remova as subcategorias antes.' });
      // Also block if has services
      const serviceCount = await tx.service.count({ where: { categoryId: id, deletedAt: null } });
      if (serviceCount > 0) return errorPayload({ code: 'CATEGORY_HAS_SERVICES', message: 'Mova ou desative os serviços desta categoria primeiro.' });
      const category = await tx.category.update({ where: { id }, data: { deletedAt: new Date() } });
      return { category, errors: [] as UserError[] };
    });
  }
}

function errorPayload(err: UserError) {
  return { category: null, errors: [err] };
}
```

**D. Create `categories.resolver.ts`:**

```ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CategoriesService } from './categories.service';
import { CurrentTenant, TenantContext } from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { CreateCategoryInput, UpdateCategoryInput } from './dto/category.input';

@Resolver()
export class CategoriesResolver {
  constructor(private readonly svc: CategoriesService) {}

  @Query('categories')
  @RequirePermission(PERMISSIONS.CATEGORY_READ)
  list(@CurrentTenant() t: TenantContext) {
    return this.svc.list(t.organizationId);
  }

  @Query('category')
  @RequirePermission(PERMISSIONS.CATEGORY_READ)
  one(@CurrentTenant() t: TenantContext, @Args('id') id: string) {
    return this.svc.getById(t.organizationId, id);
  }

  @Mutation('createCategory')
  @RequirePermission(PERMISSIONS.CATEGORY_WRITE)
  create(@CurrentTenant() t: TenantContext, @Args('input') input: CreateCategoryInput) {
    return this.svc.create(t.organizationId, input);
  }

  @Mutation('updateCategory')
  @RequirePermission(PERMISSIONS.CATEGORY_WRITE)
  update(@CurrentTenant() t: TenantContext, @Args('input') input: UpdateCategoryInput) {
    return this.svc.update(t.organizationId, input);
  }

  @Mutation('reorderCategory')
  @RequirePermission(PERMISSIONS.CATEGORY_WRITE)
  reorder(@CurrentTenant() t: TenantContext, @Args('input') input: { id: string; direction: 'UP' | 'DOWN' }) {
    return this.svc.reorder(t.organizationId, input);
  }

  @Mutation('softDeleteCategory')
  @RequirePermission(PERMISSIONS.CATEGORY_WRITE)
  remove(@CurrentTenant() t: TenantContext, @Args('input') input: { id: string }) {
    return this.svc.softDelete(t.organizationId, input.id);
  }
}
```

**E. Update `categories.module.ts`** to register the new providers:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';
import { CategoriesService } from './categories.service';
import { CategoriesResolver } from './categories.resolver';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [CategoriesService, CategoriesResolver],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

**F. Create integration test `apps/backend/test/integration/catalog-categories.e2e.spec.ts`** following the rls-isolation.spec.ts harness. Tests:
1. ADMIN of org A creates a category — succeeds with empty errors
2. Create child category with parentId of root — succeeds
3. Create child of child — fails with code `CATEGORY_DEPTH`
4. ADMIN of org B cannot list/read org A's categories (RLS)
5. PROFESSIONAL of org A gets FORBIDDEN on createCategory (lacks CATEGORY_WRITE)
6. softDelete with active children fails with `CATEGORY_HAS_CHILDREN`
7. reorderCategory swaps displayOrder with adjacent sibling
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test:int -- --testPathPattern catalog-categories</automated>
  </verify>
  <acceptance_criteria>
    - `catalog.graphql` exists, contains `type Category`, `extend type Query { categories: [Category!]!`, and `enum ReorderDirection`
    - `categories.service.ts` &gt;= 80 lines, all DB ops wrapped in `this.tenant.runWithTenant(orgId, ...)`
    - `categories.resolver.ts` decorates each handler with `@RequirePermission(PERMISSIONS.CATEGORY_READ|WRITE)`
    - `categories.module.ts` lists `CategoriesService` and `CategoriesResolver` in `providers`
    - `pnpm typecheck` exits 0
    - `pnpm test:int -- --testPathPattern catalog-categories` passes 7 tests
    - Org-isolation test asserts org B's `categories` query returns 0 rows (not org A's data)
    - Depth-violation test asserts `errors[0].code === 'CATEGORY_DEPTH'`
  </acceptance_criteria>
  <done>
    - Categories CRUD + reorder + soft-delete operational with permission gates
    - RLS isolation proven by test
    - Depth ≤ 2 enforced
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Services domain with nested pricing variants</name>
  <files>
    apps/backend/src/graphql/schema/catalog.graphql
    apps/backend/src/catalog/services/services.service.ts
    apps/backend/src/catalog/services/services.resolver.ts
    apps/backend/src/catalog/services/dto/service.input.ts
    apps/backend/src/catalog/services/services.module.ts
    apps/backend/test/integration/catalog-services.e2e.spec.ts
  </files>
  <read_first>
    - apps/backend/src/catalog/categories/categories.service.ts (Task 1 output — pattern reference)
    - apps/backend/src/catalog/categories/categories.resolver.ts
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-06, D-07, D-08)
    - apps/backend/prisma/schema.prisma (Service, ServicePricingVariant models)
  </read_first>
  <behavior>
    - createService({ name, categoryId, basePrice, defaultDurationMinutes, pricingVariants[] }) returns Service with embedded variants
    - Each PricingVariant: { name, durationMinutes, seniorityTier?: 'junior'|'pleno'|'senior', price }
    - Service create runs in single Prisma $transaction: insert Service, then insert N variants in createMany
    - updateService can replace variants atomically: delete existing variants, recreate from input
    - listServices supports optional `categoryId` filter
    - softDeleteService blocks if service is part of active package (FK protection)
    - validate basePrice >= 0, defaultDurationMinutes > 0, pricingVariants[*].price >= 0
    - validate categoryId references an existing non-deleted category in same org
  </behavior>
  <action>
**A. Append Services SDL to `apps/backend/src/graphql/schema/catalog.graphql`:**

```graphql
# ===== Services =====

extend type Query {
  services(categoryId: UUID): [Service!]!
  service(id: UUID!): Service
}

extend type Mutation {
  createService(input: CreateServiceInput!): ServicePayload!
  updateService(input: UpdateServiceInput!): ServicePayload!
  softDeleteService(input: SoftDeleteInput!): ServicePayload!
}

type Service {
  id: UUID!
  name: String!
  categoryId: UUID!
  category: Category
  basePrice: String!                    # decimal as string to avoid float precision (PRD §3.3)
  defaultDurationMinutes: Int!
  displayOrder: Int!
  pricingVariants: [ServicePricingVariant!]!
  coverImageUrl: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type ServicePricingVariant {
  id: UUID!
  name: String!
  durationMinutes: Int!
  seniorityTier: SeniorityTier
  price: String!
  displayOrder: Int!
}

enum SeniorityTier { junior pleno senior }

input PricingVariantInput {
  name: String!
  durationMinutes: Int!
  seniorityTier: SeniorityTier
  price: String!
}

input CreateServiceInput {
  name: String!
  categoryId: UUID!
  basePrice: String!
  defaultDurationMinutes: Int!
  pricingVariants: [PricingVariantInput!]
}

input UpdateServiceInput {
  id: UUID!
  name: String
  categoryId: UUID
  basePrice: String
  defaultDurationMinutes: Int
  pricingVariants: [PricingVariantInput!]
}

type ServicePayload {
  service: Service
  errors: [UserError!]!
}
```

**B. Create `dto/service.input.ts` with class-validator** (mirrors SDL inputs, `basePrice` validated as decimal string via custom regex `/^\d+(\.\d{1,2})?$/`).

**C. Create `services.service.ts`** following Task 1 patterns. Key behaviors:

```ts
async create(orgId: string, input: CreateServiceInput) {
  return this.tenant.runWithTenant(orgId, async (tx) => {
    // Validate categoryId exists in org
    const cat = await tx.category.findFirst({ where: { id: input.categoryId, deletedAt: null } });
    if (!cat) return errorPayload({ code: 'CATEGORY_NOT_FOUND', message: 'Categoria não encontrada.', field: 'categoryId' });
    
    const last = await tx.service.findFirst({
      where: { categoryId: input.categoryId, deletedAt: null },
      orderBy: { displayOrder: 'desc' },
    });
    const nextOrder = last ? last.displayOrder + 1 : 0;

    const service = await tx.service.create({
      data: {
        organizationId: orgId,
        categoryId: input.categoryId,
        name: input.name,
        basePrice: input.basePrice,       // string → Prisma Decimal
        defaultDurationMinutes: input.defaultDurationMinutes,
        displayOrder: nextOrder,
      },
    });

    if (input.pricingVariants?.length) {
      await tx.servicePricingVariant.createMany({
        data: input.pricingVariants.map((v, i) => ({
          organizationId: orgId,
          serviceId: service.id,
          name: v.name,
          durationMinutes: v.durationMinutes,
          seniorityTier: v.seniorityTier ?? null,
          price: v.price,
          displayOrder: i,
        })),
      });
    }
    const full = await tx.service.findUnique({
      where: { id: service.id },
      include: { pricingVariants: { orderBy: { displayOrder: 'asc' } } },
    });
    return { service: full, errors: [] };
  });
}

async update(orgId: string, input: UpdateServiceInput) {
  return this.tenant.runWithTenant(orgId, async (tx) => {
    const existing = await tx.service.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!existing) return errorPayload({ code: 'NOT_FOUND', message: 'Serviço não encontrado.' });
    if (input.categoryId) {
      const cat = await tx.category.findFirst({ where: { id: input.categoryId, deletedAt: null } });
      if (!cat) return errorPayload({ code: 'CATEGORY_NOT_FOUND', message: 'Categoria não encontrada.', field: 'categoryId' });
    }
    await tx.service.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        categoryId: input.categoryId ?? existing.categoryId,
        basePrice: input.basePrice ?? existing.basePrice,
        defaultDurationMinutes: input.defaultDurationMinutes ?? existing.defaultDurationMinutes,
      },
    });
    if (input.pricingVariants !== undefined) {
      await tx.servicePricingVariant.deleteMany({ where: { serviceId: input.id } });
      if (input.pricingVariants.length) {
        await tx.servicePricingVariant.createMany({
          data: input.pricingVariants.map((v, i) => ({
            organizationId: orgId,
            serviceId: input.id,
            name: v.name,
            durationMinutes: v.durationMinutes,
            seniorityTier: v.seniorityTier ?? null,
            price: v.price,
            displayOrder: i,
          })),
        });
      }
    }
    const full = await tx.service.findUnique({
      where: { id: input.id },
      include: { pricingVariants: { orderBy: { displayOrder: 'asc' } } },
    });
    return { service: full, errors: [] };
  });
}
```

`softDelete` blocks when active package_services rows exist for the service:
```ts
const pkgUses = await tx.packageService.count({ where: { serviceId: id } });
if (pkgUses > 0) return errorPayload({ code: 'SERVICE_IN_PACKAGE', message: 'Remova este serviço dos pacotes antes de desativar.' });
```

**D. Create `services.resolver.ts`** with same gating pattern as categories (use `SERVICE_READ` / `SERVICE_WRITE`).

**E. Update `services.module.ts`** to register providers (keep imports of DatabaseModule + AuthzModule).

**F. Create integration test `catalog-services.e2e.spec.ts`** covering:
1. Create service with 2 pricing variants (junior + senior) → both persist
2. Update service replacing variant set → old variants deleted, new ones inserted
3. Service from org B is invisible to org A (RLS)
4. Create service with non-existent category → CATEGORY_NOT_FOUND
5. Soft-delete service used in a package → SERVICE_IN_PACKAGE
6. ATTENDANT cannot create service (READ permission only)
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test:int -- --testPathPattern catalog-services</automated>
  </verify>
  <acceptance_criteria>
    - `catalog.graphql` contains `type Service`, `type ServicePricingVariant`, `enum SeniorityTier`, `input PricingVariantInput`
    - `services.service.ts` &gt;= 120 lines, uses `tx.servicePricingVariant.createMany` for batch insert
    - All DB writes wrapped in `runWithTenant` (no bare `prisma.service.*` calls)
    - `services.resolver.ts` uses `@RequirePermission(PERMISSIONS.SERVICE_READ)` on queries, `SERVICE_WRITE` on mutations
    - Test passes scenario "service with junior + senior variants" — querying back returns array length 2 with correct seniorityTier values
    - Update test asserts old variant count 2 → new variant count 1 (replacement, not merge)
    - RLS test passes — org B sees 0 services from org A
  </acceptance_criteria>
  <done>
    - createService accepts pricingVariants in single transaction, persists Service + N variants
    - updateService atomically replaces the variant list
    - All catalog.graphql additions parse and integrate with existing scalars
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Packages domain with junction sync and price-vs-sum transparency hook</name>
  <files>
    apps/backend/src/graphql/schema/catalog.graphql
    apps/backend/src/catalog/packages/packages.service.ts
    apps/backend/src/catalog/packages/packages.resolver.ts
    apps/backend/src/catalog/packages/dto/package.input.ts
    apps/backend/src/catalog/packages/packages.module.ts
    apps/backend/test/integration/catalog-packages.e2e.spec.ts
  </files>
  <read_first>
    - apps/backend/src/catalog/services/services.service.ts (Task 2 output)
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-09, D-10, D-11)
    - apps/backend/prisma/schema.prisma (Package, PackageService models)
    - .planning/phases/02-core-domain/02-UI-SPEC.md §Package Pricing Transparency (front-end uses `individualSum` derivation)
  </read_first>
  <behavior>
    - createPackage({ name, price, services: [{ serviceId, quantity }] }) creates package + junction rows in single tx
    - updatePackage({ id, name?, price?, services? }) replaces junction rows when services array provided (delete all, recreate)
    - Package.individualSum field — computed (resolver field): SUM(service.basePrice * quantity) for each PackageService row
    - softDeletePackage sets deleted_at; no FK blocks (packages are leaf)
    - Validations: price >= 0, services array length >= 1, each serviceId references active service in same org
  </behavior>
  <action>
**A. Append Packages SDL to `apps/backend/src/graphql/schema/catalog.graphql`:**

```graphql
# ===== Packages =====

extend type Query {
  packages: [Package!]!
  package(id: UUID!): Package
}

extend type Mutation {
  createPackage(input: CreatePackageInput!): PackagePayload!
  updatePackage(input: UpdatePackageInput!): PackagePayload!
  softDeletePackage(input: SoftDeleteInput!): PackagePayload!
}

type Package {
  id: UUID!
  name: String!
  price: String!
  individualSum: String!     # computed: sum of (service.basePrice * quantity)
  validForDays: Int
  services: [PackageServiceItem!]!
  coverImageUrl: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type PackageServiceItem {
  serviceId: UUID!
  service: Service!
  quantity: Int!
  displayOrder: Int!
}

input PackageServiceInput {
  serviceId: UUID!
  quantity: Int = 1
}

input CreatePackageInput {
  name: String!
  price: String!
  validForDays: Int
  services: [PackageServiceInput!]!
}

input UpdatePackageInput {
  id: UUID!
  name: String
  price: String
  validForDays: Int
  services: [PackageServiceInput!]
}

type PackagePayload {
  package: Package
  errors: [UserError!]!
}
```

**B. Create `dto/package.input.ts`** with class-validator. Validate `services: ArrayMinSize(1)` for create.

**C. Create `packages.service.ts`** with the same pattern. Key methods:

```ts
async create(orgId: string, input: CreatePackageInput) {
  return this.tenant.runWithTenant(orgId, async (tx) => {
    if (!input.services || input.services.length === 0) return errorPayload({ code: 'PACKAGE_EMPTY', message: 'Adicione ao menos um serviço.', field: 'services' });
    const ids = input.services.map((s) => s.serviceId);
    const found = await tx.service.findMany({ where: { id: { in: ids }, deletedAt: null } });
    if (found.length !== ids.length) return errorPayload({ code: 'SERVICE_NOT_FOUND', message: 'Um ou mais serviços não foram encontrados.', field: 'services' });

    const pkg = await tx.package.create({
      data: {
        organizationId: orgId,
        name: input.name,
        price: input.price,
        validForDays: input.validForDays ?? null,
      },
    });
    await tx.packageService.createMany({
      data: input.services.map((s, i) => ({
        packageId: pkg.id,
        serviceId: s.serviceId,
        quantity: s.quantity ?? 1,
        displayOrder: i,
      })),
    });
    return { package: await this.loadFull(tx, pkg.id), errors: [] };
  });
}

async update(orgId: string, input: UpdatePackageInput) {
  return this.tenant.runWithTenant(orgId, async (tx) => {
    const existing = await tx.package.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!existing) return errorPayload({ code: 'NOT_FOUND', message: 'Pacote não encontrado.' });
    await tx.package.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        price: input.price ?? existing.price,
        validForDays: input.validForDays === undefined ? existing.validForDays : input.validForDays,
      },
    });
    if (input.services !== undefined) {
      if (input.services.length === 0) return errorPayload({ code: 'PACKAGE_EMPTY', message: 'Adicione ao menos um serviço.', field: 'services' });
      const ids = input.services.map((s) => s.serviceId);
      const found = await tx.service.findMany({ where: { id: { in: ids }, deletedAt: null } });
      if (found.length !== ids.length) return errorPayload({ code: 'SERVICE_NOT_FOUND', message: 'Serviço inválido.', field: 'services' });
      await tx.packageService.deleteMany({ where: { packageId: input.id } });
      await tx.packageService.createMany({
        data: input.services.map((s, i) => ({
          packageId: input.id, serviceId: s.serviceId, quantity: s.quantity ?? 1, displayOrder: i,
        })),
      });
    }
    return { package: await this.loadFull(tx, input.id), errors: [] };
  });
}

private async loadFull(tx: any, id: string) {
  const pkg = await tx.package.findUnique({
    where: { id },
    include: {
      services: {
        orderBy: { displayOrder: 'asc' },
        include: { service: true },
      },
    },
  });
  // Compute individualSum server-side for transparency display (UI-SPEC §Package Pricing)
  const sum = pkg?.services.reduce((acc, ps) => acc.plus(new Decimal(ps.service.basePrice).times(ps.quantity)), new Decimal(0)) ?? new Decimal(0);
  return { ...pkg, individualSum: sum.toFixed(2) };
}
```

NOTE: import `Decimal` from `@prisma/client/runtime/library` for accurate decimal math.

**D. Create `packages.resolver.ts`** following the established pattern. Permissions: `PACKAGE_READ`/`PACKAGE_WRITE`.

The `individualSum` computation is done in the service when loading; alternatively as a `@ResolveField()` on the Package resolver. Use the service-side approach above for simplicity since SDL is non-code-first.

**E. Update `packages.module.ts`** to register providers.

**F. Create integration test `catalog-packages.e2e.spec.ts`** covering:
1. Create package with 3 services (mix of quantities 1, 1, 2) — package + 3 junction rows
2. `individualSum` returned equals base prices × quantities (e.g., 50+80+(60×2) = 250)
3. Package.price can be different from individualSum (D-09)
4. Update package replacing services list — old junction rows gone
5. Create package with empty services list → PACKAGE_EMPTY
6. Create package referencing soft-deleted service → SERVICE_NOT_FOUND
7. softDelete blocks service that's in this package (cross-test with services.service softDelete) — done in services tests already
8. RLS isolation: org B cannot read org A's packages
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test:int -- --testPathPattern catalog-packages</automated>
  </verify>
  <acceptance_criteria>
    - `catalog.graphql` adds `type Package`, `type PackageServiceItem`, `input PackageServiceInput`
    - `packages.service.ts` uses `tx.packageService.deleteMany` + `createMany` for atomic junction sync on update
    - `individualSum` computed using Prisma Decimal (not JavaScript Number) — verified by grep `Decimal` in source
    - 8 integration tests pass
    - Update test asserts: 3 services → updated to 2 services → DB has exactly 2 package_services rows for that package
    - Empty package test asserts `errors[0].code === 'PACKAGE_EMPTY'`
  </acceptance_criteria>
  <done>
    - Package CRUD works with junction sync via delete+createMany pattern
    - `individualSum` computed deterministically with Decimal precision
    - Package can have price different from sum, supporting UI-SPEC §Package Pricing Transparency
  </done>
</task>

</tasks>

<verification>
- `apps/backend/src/graphql/schema/catalog.graphql` parses cleanly when backend boots
- All catalog mutations gated by `@RequirePermission`
- All DB ops wrapped in `runWithTenant`
- 3 integration test specs pass for categories, services, packages — each includes RLS isolation test
- Soft-delete semantics: rows are filtered by `deletedAt IS NULL` in default queries
</verification>

<success_criteria>
- `pnpm --filter @sgs/backend typecheck` and `pnpm --filter @sgs/backend test:int` (catalog-* tests) exit 0
- Backend boots with new resolvers registered (no missing-schema-type errors at startup)
- Integration tests cover happy path + RLS isolation + permission gating + business rule violations for all three entities
- Wave 3 frontend can consume the SDL via `pnpm codegen`
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-domain/02-backend-catalog-services-SUMMARY.md` listing exposed GraphQL operations, validation rules, and the soft-delete cascade rules.
</output>
