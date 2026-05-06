---
phase: 02-core-domain
plan: 04
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/backend/src/graphql/schema/products.graphql
  - apps/backend/src/catalog/products/products.service.ts
  - apps/backend/src/catalog/products/products.resolver.ts
  - apps/backend/src/catalog/products/dto/product.input.ts
  - apps/backend/src/catalog/products/products.module.ts
  - apps/backend/src/catalog/notifications/notifications.service.ts
  - apps/backend/src/catalog/notifications/notifications.resolver.ts
  - apps/backend/src/catalog/notifications/notifications.module.ts
  - apps/backend/test/integration/catalog-products.e2e.spec.ts
  - apps/backend/test/integration/catalog-notifications.e2e.spec.ts
autonomous: true
requirements: [CAT-03]

must_haves:
  truths:
    - "ADMIN/MANAGER can create products with sku unique per org"
    - "adjustStock mutation atomically updates products.stock_quantity AND inserts a stock_movements row"
    - "When stock_quantity drops to <= min_stock_level, a notification of kind 'stock_low' is created (idempotent — once per product per drop)"
    - "lowStockProducts query returns products where stock_quantity <= min_stock_level filtered by RLS"
    - "notifications query returns unread notifications for the current member"
    - "ATTENDANT cannot adjust stock (lacks PRODUCT_ADJUST_STOCK)"
    - "RLS isolates products and notifications across orgs"
  artifacts:
    - path: "apps/backend/src/graphql/schema/products.graphql"
      provides: "SDL for Product, StockMovement, Notification + product CRUD + adjustStock mutation"
      contains: "type Product"
    - path: "apps/backend/src/catalog/products/products.service.ts"
      provides: "Product CRUD + adjustStock with movement audit + low-stock notification trigger"
      min_lines: 120
    - path: "apps/backend/src/catalog/notifications/notifications.service.ts"
      provides: "Listing + mark-as-read for in-app notifications"
      min_lines: 40
  key_links:
    - from: "products.service.ts adjustStock"
      to: "stock_movements + notifications tables"
      via: "single Prisma transaction inside runWithTenant"
      pattern: "stockMovement.create"
    - from: "products.service.ts adjustStock"
      to: "notifications.create when stock_quantity <= min_stock_level"
      via: "conditional INSERT inside same tx"
      pattern: "kind: 'stock_low'"
---

<objective>
Implement the products and notifications backend domains: product CRUD with SKU-per-org uniqueness, manual stock adjustment with audited stock_movements rows, automatic low-stock in-app notification creation, and notification list/mark-read API for the future notification center.

Purpose: CAT-03 ("Proprietário cadastra produto, define estoque mínimo, recebe alerta quando estoque cai abaixo") — Phase 2 delivers the manual adjustment + alert pipeline. Phase 3 will add automatic decrement on comanda close (`type='sale'`). Phase 5 will add email/WhatsApp delivery.

Output: Two NestJS modules (products, notifications), one GraphQL SDL, two integration test specs.
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
@apps/backend/prisma/schema.prisma
@apps/backend/src/database/tenant-context.service.ts
@apps/backend/src/authz/permissions.catalog.ts
@apps/backend/src/auth/auth.service.ts

<interfaces>
<!-- Plan 01 outputs -->

From Plan 01 schema:
- `products` (organization_id, name, sku VARCHAR(60), cost_price DECIMAL(12,2), sale_price DECIMAL(12,2), stock_quantity INT, min_stock_level INT, unit ('un'|'ml'|'g'), cover_image_url, deletedAt)
- `products` UNIQUE(organization_id, sku)
- `stock_movements` (product_id, delta INT, type IN ('initial'|'manual_adjustment'|'sale'|'return'), reason TEXT, performed_by UUID, created_at)
- `notifications` (organization_id, member_id?, kind, payload JSONB, read_at, created_at)

From Plan 01 permissions:
- PRODUCT_READ, PRODUCT_WRITE, PRODUCT_ADJUST_STOCK, NOTIFICATION_READ

D-13: Phase 2 only implements `manual_adjustment` and `initial` types — `sale` and `return` belong to Phase 3 POS.
D-14: Movement audit is the source of truth — never adjust stock_quantity without a movement row.
D-15: Phase 2 alert is a notification row + sidebar badge (Wave 3 UI). Email/WhatsApp deferred.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Products CRUD with SKU uniqueness validation</name>
  <files>
    apps/backend/src/graphql/schema/products.graphql
    apps/backend/src/catalog/products/products.service.ts
    apps/backend/src/catalog/products/products.resolver.ts
    apps/backend/src/catalog/products/dto/product.input.ts
    apps/backend/src/catalog/products/products.module.ts
  </files>
  <read_first>
    - apps/backend/src/catalog/categories/categories.service.ts (Plan 03 Task 1 — pattern reference, may not exist yet — read after Plan 03 Task 1 completes OR copy pattern from auth.service.ts)
    - apps/backend/src/auth/auth.service.ts (errorPayload pattern, validation precedent)
    - apps/backend/prisma/schema.prisma (Product, StockMovement models)
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-12, D-13, D-14, D-15)
  </read_first>
  <behavior>
    - createProduct({ name, sku, costPrice, salePrice, stockQuantity, minStockLevel, unit }) validates: sku unique within org, prices ≥ 0, stockQuantity ≥ 0, unit in ('un','ml','g')
    - When stockQuantity > 0 on create, also insert a stock_movements row with type='initial', delta=stockQuantity, reason='Estoque inicial'
    - updateProduct allows changing all fields EXCEPT stock_quantity directly (stock changes only via adjustStock — D-14)
    - listProducts supports `lowStockOnly` boolean filter
    - softDeleteProduct sets deletedAt
    - SKU change: if input.sku differs from existing, validate new SKU is unique in org (excluding the product being edited)
  </behavior>
  <action>
**A. Create `apps/backend/src/graphql/schema/products.graphql`:**

```graphql
# ===== Products =====

extend type Query {
  products(lowStockOnly: Boolean = false): [Product!]!
  product(id: UUID!): Product
  lowStockCount: Int!
  productStockMovements(productId: UUID!): [StockMovement!]!
}

extend type Mutation {
  createProduct(input: CreateProductInput!): ProductPayload!
  updateProduct(input: UpdateProductInput!): ProductPayload!
  adjustStock(input: AdjustStockInput!): ProductPayload!
  softDeleteProduct(input: SoftDeleteInput!): ProductPayload!
}

type Product {
  id: UUID!
  name: String!
  sku: String!
  costPrice: String!
  salePrice: String!
  stockQuantity: Int!
  minStockLevel: Int!
  unit: ProductUnit!
  isLowStock: Boolean!
  coverImageUrl: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum ProductUnit { un ml g }

type StockMovement {
  id: UUID!
  productId: UUID!
  delta: Int!
  type: StockMovementType!
  reason: String
  performedBy: UUID
  createdAt: DateTime!
}

enum StockMovementType { initial manual_adjustment sale return }

input CreateProductInput {
  name: String!
  sku: String!
  costPrice: String!
  salePrice: String!
  stockQuantity: Int!
  minStockLevel: Int!
  unit: ProductUnit!
}

input UpdateProductInput {
  id: UUID!
  name: String
  sku: String
  costPrice: String
  salePrice: String
  minStockLevel: Int
  unit: ProductUnit
}

input AdjustStockInput {
  productId: UUID!
  delta: Int!
  reason: String!
}

type ProductPayload {
  product: Product
  errors: [UserError!]!
}
```

**B. Create `dto/product.input.ts` with class-validator:**

```ts
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';

const DECIMAL = /^\d+(\.\d{1,2})?$/;
const SKU = /^[A-Za-z0-9_\-\.]{1,60}$/;

export class CreateProductInput {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString() @Matches(SKU, { message: 'SKU inválido.' }) sku!: string;
  @Matches(DECIMAL, { message: 'Preço de custo inválido.' }) costPrice!: string;
  @Matches(DECIMAL, { message: 'Preço de venda inválido.' }) salePrice!: string;
  @IsInt() @Min(0) stockQuantity!: number;
  @IsInt() @Min(0) minStockLevel!: number;
  @IsEnum(['un', 'ml', 'g']) unit!: 'un' | 'ml' | 'g';
}

export class UpdateProductInput {
  @IsUUID() id!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @Matches(SKU) sku?: string;
  @IsOptional() @Matches(DECIMAL) costPrice?: string;
  @IsOptional() @Matches(DECIMAL) salePrice?: string;
  @IsOptional() @IsInt() @Min(0) minStockLevel?: number;
  @IsOptional() @IsEnum(['un','ml','g']) unit?: 'un' | 'ml' | 'g';
}

export class AdjustStockInput {
  @IsUUID() productId!: string;
  @IsInt() delta!: number;
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
```

**C. Create `products.service.ts`** (start of file — `adjustStock` is added in Task 2):

```ts
import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import type { TenantPrismaClient } from '../../database/types';
import { CreateProductInput, UpdateProductInput } from './dto/product.input';

interface UserError { code: string; message: string; field?: string | null; }
const err = (code: string, message: string, field?: string) => ({
  product: null, errors: [{ code, message, field: field ?? null }],
});

@Injectable()
export class ProductsService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(orgId: string, lowStockOnly = false) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.product.findMany({
        where: {
          deletedAt: null,
          ...(lowStockOnly ? { } : {}),
        },
        orderBy: { name: 'asc' },
      }).then((rows) =>
        lowStockOnly ? rows.filter((p) => p.stockQuantity <= p.minStockLevel) : rows,
      ),
    );
  }

  async lowStockCount(orgId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const rows = await tx.product.findMany({
        where: { deletedAt: null },
        select: { stockQuantity: true, minStockLevel: true },
      });
      return rows.filter((p) => p.stockQuantity <= p.minStockLevel).length;
    });
  }

  async byId(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.product.findFirst({ where: { id, deletedAt: null } }),
    );
  }

  async create(orgId: string, memberId: string, input: CreateProductInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const dup = await tx.product.findFirst({
        where: { organizationId: orgId, sku: input.sku, deletedAt: null },
      });
      if (dup) return err('SKU_TAKEN', 'Este SKU já está em uso por outro produto.', 'sku');

      const product = await tx.product.create({
        data: {
          organizationId: orgId,
          name: input.name,
          sku: input.sku,
          costPrice: input.costPrice,
          salePrice: input.salePrice,
          stockQuantity: input.stockQuantity,
          minStockLevel: input.minStockLevel,
          unit: input.unit,
        },
      });

      if (input.stockQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            productId: product.id,
            delta: input.stockQuantity,
            type: 'initial',
            reason: 'Estoque inicial',
            performedBy: memberId,
          },
        });
      }
      return { product, errors: [] as UserError[] };
    });
  }

  async update(orgId: string, input: UpdateProductInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.product.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!existing) return err('NOT_FOUND', 'Produto não encontrado.');
      if (input.sku && input.sku !== existing.sku) {
        const dup = await tx.product.findFirst({
          where: { organizationId: orgId, sku: input.sku, deletedAt: null, NOT: { id: input.id } },
        });
        if (dup) return err('SKU_TAKEN', 'Este SKU já está em uso por outro produto.', 'sku');
      }
      const product = await tx.product.update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          sku: input.sku ?? existing.sku,
          costPrice: input.costPrice ?? existing.costPrice,
          salePrice: input.salePrice ?? existing.salePrice,
          minStockLevel: input.minStockLevel ?? existing.minStockLevel,
          unit: input.unit ?? existing.unit,
        },
      });
      return { product, errors: [] as UserError[] };
    });
  }

  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await tx.product.findFirst({ where: { id, deletedAt: null } });
      if (!cur) return err('NOT_FOUND', 'Produto não encontrado.');
      const product = await tx.product.update({ where: { id }, data: { deletedAt: new Date() } });
      return { product, errors: [] as UserError[] };
    });
  }

  async stockMovements(orgId: string, productId: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.stockMovement.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  // Computed field "isLowStock" for resolver — small helper exposed
  static isLowStock(p: { stockQuantity: number; minStockLevel: number }) {
    return p.stockQuantity <= p.minStockLevel;
  }
}
```

**D. Create `products.resolver.ts`** decorating queries with `PRODUCT_READ`, mutations with `PRODUCT_WRITE` (except `adjustStock` which uses `PRODUCT_ADJUST_STOCK`). Resolve `isLowStock` field via `@ResolveField`:

```ts
@Resolver('Product')
export class ProductsResolver {
  constructor(private readonly svc: ProductsService) {}

  @Query('products') @RequirePermission(PERMISSIONS.PRODUCT_READ)
  list(@CurrentTenant() t: TenantContext, @Args('lowStockOnly') lowStockOnly = false) {
    return this.svc.list(t.organizationId, lowStockOnly);
  }

  @Query('product') @RequirePermission(PERMISSIONS.PRODUCT_READ)
  one(@CurrentTenant() t: TenantContext, @Args('id') id: string) { return this.svc.byId(t.organizationId, id); }

  @Query('lowStockCount') @RequirePermission(PERMISSIONS.PRODUCT_READ)
  count(@CurrentTenant() t: TenantContext) { return this.svc.lowStockCount(t.organizationId); }

  @Query('productStockMovements') @RequirePermission(PERMISSIONS.PRODUCT_READ)
  movements(@CurrentTenant() t: TenantContext, @Args('productId') productId: string) {
    return this.svc.stockMovements(t.organizationId, productId);
  }

  @Mutation('createProduct') @RequirePermission(PERMISSIONS.PRODUCT_WRITE)
  create(@CurrentTenant() t: TenantContext, @Args('input') input: CreateProductInput) {
    return this.svc.create(t.organizationId, t.memberId, input);
  }

  @Mutation('updateProduct') @RequirePermission(PERMISSIONS.PRODUCT_WRITE)
  update(@CurrentTenant() t: TenantContext, @Args('input') input: UpdateProductInput) {
    return this.svc.update(t.organizationId, input);
  }

  @Mutation('softDeleteProduct') @RequirePermission(PERMISSIONS.PRODUCT_WRITE)
  remove(@CurrentTenant() t: TenantContext, @Args('input') input: { id: string }) {
    return this.svc.softDelete(t.organizationId, input.id);
  }

  @ResolveField('isLowStock')
  isLowStock(@Parent() p: { stockQuantity: number; minStockLevel: number }) {
    return ProductsService.isLowStock(p);
  }
}
```

The `adjustStock` mutation handler is added by Task 2 (delegates to `ProductsService.adjustStock`).

**E. Update `products.module.ts`** to register `ProductsService` and `ProductsResolver`. Import `NotificationsModule` (created in Task 3) for the adjustStock dependency on notifications — but Task 2 (in this same plan) does the wiring, so order this carefully. Module structure:

```ts
import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsService } from './products.service';
import { ProductsResolver } from './products.resolver';

@Module({
  imports: [DatabaseModule, AuthzModule, NotificationsModule],
  providers: [ProductsService, ProductsResolver],
  exports: [ProductsService],
})
export class ProductsModule {}
```
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `products.graphql` defines `type Product` with field `isLowStock: Boolean!` (computed via @ResolveField)
    - `products.service.ts` lines for create method include `tx.stockMovement.create({ data: { ..., type: 'initial' } })`
    - `products.service.ts` update method does NOT touch `stockQuantity` field (per D-14)
    - `pnpm typecheck` passes — module compiles even without adjustStock implementation (Task 2 will add)
    - SKU validation regex `^[A-Za-z0-9_\\-\\.]{1,60}$` present in DTO
  </acceptance_criteria>
  <done>
    - Product CRUD operational with SKU uniqueness, prices, low-stock detection
    - Computed `isLowStock` exposed as GraphQL field
    - Initial stock seeds a stock_movements audit row
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: adjustStock with audit + automatic low-stock notification + integration test</name>
  <files>
    apps/backend/src/catalog/products/products.service.ts
    apps/backend/src/catalog/products/products.resolver.ts
    apps/backend/test/integration/catalog-products.e2e.spec.ts
  </files>
  <read_first>
    - apps/backend/src/catalog/products/products.service.ts (Task 1 output — extend, don't replace)
    - apps/backend/src/catalog/notifications/notifications.service.ts (Task 3 output — depend on it. If Task 3 not yet complete in this plan run, scaffold a thin stub that Task 3 fills in, but DO NOT remove the call.)
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-13, D-14, D-15)
    - apps/backend/test/integration/rls-isolation.spec.ts (test harness)
  </read_first>
  <behavior>
    - adjustStock({ productId, delta, reason }) executes ATOMICALLY:
      1. Read product with row-level lock to prevent race conditions
      2. newQuantity = product.stockQuantity + delta
      3. If newQuantity < 0 → return error STOCK_NEGATIVE
      4. Update products.stock_quantity = newQuantity
      5. Insert stock_movements row (type='manual_adjustment', delta, reason, performed_by=memberId)
      6. If was previously above min_stock_level AND new is at-or-below → insert notifications row (kind='stock_low', payload={productId, productName, currentStock, minStockLevel})
      7. If was previously at-or-below AND new is above → optionally clear unread stock_low notifications for this product (idempotent UX)
    - All inside ONE Prisma transaction (`runWithTenant` already wraps in one)
    - Returns updated product
  </behavior>
  <action>
**A. Add `adjustStock` to `apps/backend/src/catalog/products/products.service.ts`:**

```ts
import { NotificationsService } from '../notifications/notifications.service';

// constructor:
constructor(
  private readonly tenant: TenantContextService,
  private readonly notifications: NotificationsService,
) {}

async adjustStock(
  orgId: string,
  memberId: string,
  input: { productId: string; delta: number; reason: string },
) {
  return this.tenant.runWithTenant(orgId, async (tx) => {
    // Pessimistic row lock to prevent concurrent stock adjustments racing
    const locked = await tx.$queryRaw<Array<{ id: string; stock_quantity: number; min_stock_level: number; name: string; deleted_at: Date | null }>>`
      SELECT id, stock_quantity, min_stock_level, name, deleted_at
      FROM products
      WHERE id = ${input.productId}::uuid
      FOR UPDATE
    `;
    const product = locked[0];
    if (!product || product.deleted_at) return err('NOT_FOUND', 'Produto não encontrado.');

    const newQty = product.stock_quantity + input.delta;
    if (newQty < 0) return err('STOCK_NEGATIVE', 'Estoque resultante seria negativo.', 'delta');

    const wasOk = product.stock_quantity > product.min_stock_level;
    const nowLow = newQty <= product.min_stock_level;

    const updated = await tx.product.update({
      where: { id: input.productId },
      data: { stockQuantity: newQty },
    });

    await tx.stockMovement.create({
      data: {
        organizationId: orgId,
        productId: input.productId,
        delta: input.delta,
        type: 'manual_adjustment',
        reason: input.reason,
        performedBy: memberId,
      },
    });

    if (wasOk && nowLow) {
      // Idempotent: only one unread stock_low notif per product at a time
      const existing = await tx.notification.findFirst({
        where: {
          organizationId: orgId,
          kind: 'stock_low',
          readAt: null,
          payload: { path: ['productId'], equals: input.productId },
        },
      });
      if (!existing) {
        await tx.notification.create({
          data: {
            organizationId: orgId,
            memberId: null, // org-wide notification
            kind: 'stock_low',
            payload: {
              productId: input.productId,
              productName: product.name,
              currentStock: newQty,
              minStockLevel: product.min_stock_level,
            },
          },
        });
      }
    } else if (!wasOk && !nowLow) {
      // Stock recovered — mark related stock_low notifications read
      await tx.notification.updateMany({
        where: {
          organizationId: orgId,
          kind: 'stock_low',
          readAt: null,
          payload: { path: ['productId'], equals: input.productId },
        },
        data: { readAt: new Date() },
      });
    }

    return { product: updated, errors: [] as UserError[] };
  });
}
```

NOTE: `payload: { path: ['productId'], equals: ... }` is the Prisma JSONB filter syntax for matching a key inside a JSON column. Verify with `pnpm prisma studio` if uncertain — the equivalent raw SQL is `WHERE payload->>'productId' = ?`.

**B. Wire the resolver mutation in `products.resolver.ts`:**

```ts
@Mutation('adjustStock')
@RequirePermission(PERMISSIONS.PRODUCT_ADJUST_STOCK)
adjustStock(@CurrentTenant() t: TenantContext, @Args('input') input: AdjustStockInput) {
  return this.svc.adjustStock(t.organizationId, t.memberId, input);
}
```

**C. Create integration test `apps/backend/test/integration/catalog-products.e2e.spec.ts`** following rls-isolation harness. Tests:

1. Create product with stockQuantity=10, minStockLevel=5 → product.stockQuantity=10, ONE stock_movement row with type='initial'
2. Create product with same SKU → SKU_TAKEN error
3. adjustStock(delta=-6) → product.stockQuantity=4 (was 10), TWO stock_movement rows (initial + manual_adjustment), ONE notification (kind='stock_low')
4. adjustStock(delta=-2) on already-low product → stockQuantity=2, no NEW stock_low notification (idempotent — still only one unread)
5. adjustStock(delta=+10) on low-stock product → stockQuantity=12 (above min=5), unread stock_low notification marked read
6. adjustStock that would make negative → STOCK_NEGATIVE
7. ATTENDANT cannot adjustStock (lacks PRODUCT_ADJUST_STOCK permission, gets FORBIDDEN)
8. RLS: org B cannot read org A's products or notifications
9. Concurrent adjustStock test (optional smoke): two parallel calls, both end up consistent (the `FOR UPDATE` lock serializes them — both succeed with correct final stock)
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test:int -- --testPathPattern catalog-products</automated>
  </verify>
  <acceptance_criteria>
    - `adjustStock` method exists in `products.service.ts`, is `>= 50 lines`, contains `FOR UPDATE` raw query
    - `payload: { path: ['productId'], equals` pattern present (Prisma JSONB filter)
    - Resolver mutation `adjustStock` decorated with `@RequirePermission(PERMISSIONS.PRODUCT_ADJUST_STOCK)`
    - Integration test passes 8 tests (skip the concurrency smoke if too flaky on Windows — keep all 8 stable ones)
    - Test scenario "stock recovers above min" asserts the unread stock_low notification has `read_at` set after the recovery
    - Test asserts each adjustStock call inserts exactly ONE new stock_movements row
  </acceptance_criteria>
  <done>
    - adjustStock atomically updates products.stock_quantity, audits via stock_movements, creates idempotent stock_low notification when threshold crosses, clears notification when stock recovers
    - Unauthorized roles cannot adjust stock
    - Tests cover all branches
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Notifications service + resolver for sidebar low-stock badge and notification list</name>
  <files>
    apps/backend/src/catalog/notifications/notifications.service.ts
    apps/backend/src/catalog/notifications/notifications.resolver.ts
    apps/backend/src/catalog/notifications/notifications.module.ts
    apps/backend/test/integration/catalog-notifications.e2e.spec.ts
  </files>
  <read_first>
    - apps/backend/prisma/schema.prisma (Notification model)
    - apps/backend/src/catalog/products/products.service.ts (Task 2 — adjustStock creates notifications, integration test depends on this listing)
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-15, specifics §Notifications table)
  </read_first>
  <behavior>
    - notifications query — list unread notifications visible to current member (memberId = current OR memberId IS NULL for org-wide)
    - markNotificationRead({ id }) sets read_at = NOW()
    - Notifications visible to org members regardless of role (NOTIFICATION_READ permission gates access — given to all 4 roles in Plan 01)
  </behavior>
  <action>
**A. Update `apps/backend/src/graphql/schema/products.graphql`** to also include the Notification SDL (or create separate `notifications.graphql` — choose ONE location per `typePaths` glob in graphql config; pragmatic: keep in same file to avoid SDL split). Add at the bottom:

```graphql
# ===== Notifications =====

extend type Query {
  notifications(unreadOnly: Boolean = true): [Notification!]!
}

extend type Mutation {
  markNotificationRead(input: MarkReadInput!): Notification!
}

type Notification {
  id: UUID!
  kind: String!
  payload: JSON!
  readAt: DateTime
  createdAt: DateTime!
}

input MarkReadInput {
  id: UUID!
}

scalar JSON
```

If `JSON` scalar is not registered in the GraphQL module, register it via `graphql-scalars` or add to scalars.graphql. PRD STACK references `graphql-scalars` library — install if not already present: `pnpm --filter @sgs/backend add graphql-scalars`.

Wire `JSONResolver` from `graphql-scalars` in `apps/backend/src/graphql/graphql.module.ts` resolvers list. (Verify by running backend boot.)

**B. Create `notifications.service.ts`:**

```ts
import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(orgId: string, memberId: string, unreadOnly = true) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.notification.findMany({
        where: {
          OR: [{ memberId }, { memberId: null }],
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  async markRead(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.notification.update({ where: { id }, data: { readAt: new Date() } }),
    );
  }
}
```

**C. Create `notifications.resolver.ts`:**

```ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import { CurrentTenant, TenantContext } from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';

@Resolver()
export class NotificationsResolver {
  constructor(private readonly svc: NotificationsService) {}

  @Query('notifications')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  list(@CurrentTenant() t: TenantContext, @Args('unreadOnly') unreadOnly = true) {
    return this.svc.list(t.organizationId, t.memberId, unreadOnly);
  }

  @Mutation('markNotificationRead')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  markRead(@CurrentTenant() t: TenantContext, @Args('input') input: { id: string }) {
    return this.svc.markRead(t.organizationId, input.id);
  }
}
```

**D. Update `notifications.module.ts`:**

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';
import { NotificationsService } from './notifications.service';
import { NotificationsResolver } from './notifications.resolver';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [NotificationsService, NotificationsResolver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

**E. Create integration test `catalog-notifications.e2e.spec.ts`:**
1. After product low-stock event, `notifications` query returns 1 entry with kind='stock_low' and payload.productId matches
2. markNotificationRead sets read_at
3. Subsequent `notifications` query (default unreadOnly=true) does NOT return marked-read notification
4. RLS: org B sees 0 notifications when org A has stock_low notifications
5. PROFESSIONAL of org A can read notifications (NOTIFICATION_READ granted to all roles per Plan 01)
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test:int -- --testPathPattern catalog-notifications</automated>
  </verify>
  <acceptance_criteria>
    - `notifications.service.ts` &gt;= 40 lines, all DB ops in `runWithTenant`
    - `JSON` scalar registered (verify backend boots without "Unknown type JSON" GraphQL error: `pnpm --filter @sgs/backend dev` 5-second smoke OR Nest test boot in test passes)
    - `notifications` resolver gated by `NOTIFICATION_READ` (the broadest-scope permission — given to all 4 roles)
    - Integration test passes 5 tests
    - JSON payload returned for stock_low notification contains `productId`, `productName`, `currentStock`, `minStockLevel` keys
  </acceptance_criteria>
  <done>
    - Members can list/mark-read in-app notifications
    - JSON scalar registered for arbitrary payload
    - Tests prove RLS isolation and permission gating
  </done>
</task>

</tasks>

<verification>
- products.graphql parses; Nest boots with ProductsModule + NotificationsModule registered
- adjustStock atomically updates stock + audit + notification (proven by integration test)
- SKU uniqueness enforced per organization
- Notifications RLS-isolated and permission-gated
</verification>

<success_criteria>
- Backend integration tests `catalog-products` (8) and `catalog-notifications` (5) all pass
- `pnpm --filter @sgs/backend typecheck` exits 0
- Backend boots with new resolvers without schema errors
- Wave 3 frontend can fetch low-stock count for sidebar badge via `lowStockCount` query
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-domain/02-backend-products-stock-SUMMARY.md` documenting the adjustStock contract, notification kinds (`stock_low`), and JSON scalar registration so Phase 3 (POS) can reuse the stock_movements pipeline for `sale`/`return` types.
</output>
