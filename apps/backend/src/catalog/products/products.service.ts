import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { CreateProductInput, UpdateProductInput } from './dto/product.input';

interface UserError {
  code: string;
  message: string;
  field: string | null;
}

function err(
  code: string,
  message: string,
  field?: string,
): { product: null; errors: UserError[] } {
  return { product: null, errors: [{ code, message, field: field ?? null }] };
}

@Injectable()
export class ProductsService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(orgId: string, lowStockOnly = false) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const rows = await tx.product.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
      if (lowStockOnly) {
        return rows.filter((p) => p.stockQuantity <= p.minStockLevel);
      }
      return rows;
    });
  }

  async lowStockCount(orgId: string): Promise<number> {
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
      if (dup) {
        return err('SKU_TAKEN', 'Este SKU já está em uso por outro produto.', 'sku');
      }

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
      const existing = await tx.product.findFirst({
        where: { id: input.id, deletedAt: null },
      });
      if (!existing) {
        return err('NOT_FOUND', 'Produto não encontrado.');
      }

      if (input.sku && input.sku !== existing.sku) {
        const dup = await tx.product.findFirst({
          where: {
            organizationId: orgId,
            sku: input.sku,
            deletedAt: null,
            NOT: { id: input.id },
          },
        });
        if (dup) {
          return err('SKU_TAKEN', 'Este SKU já está em uso por outro produto.', 'sku');
        }
      }

      // NOTE: stockQuantity is intentionally NOT updatable here (D-14).
      // Stock changes must go through adjustStock mutation only.
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
      if (!cur) {
        return err('NOT_FOUND', 'Produto não encontrado.');
      }
      const product = await tx.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { product, errors: [] as UserError[] };
    });
  }

  async stockMovements(orgId: string, productId: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.stockMovement.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /**
   * Adjusts stock atomically using a pessimistic SELECT FOR UPDATE lock.
   * Creates a stock_movements audit row on every call.
   * Fires an idempotent stock_low notification when stock crosses the min threshold.
   * Task 2 implements this method.
   */
  async adjustStock(
    orgId: string,
    memberId: string,
    input: { productId: string; delta: number; reason: string },
  ) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      // Pessimistic row lock to prevent concurrent stock adjustments racing
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          stock_quantity: number;
          min_stock_level: number;
          name: string;
          deleted_at: Date | null;
        }>
      >`
        SELECT id, stock_quantity, min_stock_level, name, deleted_at
        FROM products
        WHERE id = ${input.productId}::uuid
        FOR UPDATE
      `;

      const product = locked[0];
      if (!product || product.deleted_at) {
        return err('NOT_FOUND', 'Produto não encontrado.');
      }

      const newQty = product.stock_quantity + input.delta;
      if (newQty < 0) {
        return err('STOCK_NEGATIVE', 'Estoque resultante seria negativo.', 'delta');
      }

      const wasAboveMin = product.stock_quantity > product.min_stock_level;
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

      if (wasAboveMin && nowLow) {
        // Idempotent: only create one unread stock_low notification per product
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
      } else if (!wasAboveMin && !nowLow) {
        // Stock recovered above min — mark related unread stock_low notifications as read
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

  /**
   * Computed field helper — exposed for @ResolveField in the resolver.
   */
  static isLowStock(p: { stockQuantity: number; minStockLevel: number }): boolean {
    return p.stockQuantity <= p.minStockLevel;
  }
}
