import type { Product } from '@prisma/client';
import type { TenantPrismaClient } from '../../database/types';

export class StockError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'STOCK_INSUFFICIENT',
    message: string,
    public readonly productId: string,
  ) {
    super(message);
    this.name = 'StockError';
  }
}

/**
 * Aplica um delta de estoque na transação do chamador (NÃO abre transação).
 * Trava o produto (FOR UPDATE), recusa saldo negativo, grava stock_movements e
 * mantém a notificação stock_low idempotente ao cruzar o mínimo.
 */
export async function applyStockDelta(
  tx: TenantPrismaClient,
  a: {
    orgId: string;
    productId: string;
    delta: number;
    type: 'manual_adjustment' | 'sale' | 'return';
    reason: string | null;
    performedBy: string | null;
    comandaId?: string | null;
  },
): Promise<{ product: Product; newQty: number }> {
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
    WHERE id = ${a.productId}::uuid
    FOR UPDATE
  `;

  const product = locked[0];
  if (!product || product.deleted_at) {
    throw new StockError('NOT_FOUND', 'Produto não encontrado.', a.productId);
  }

  const newQty = product.stock_quantity + a.delta;
  if (newQty < 0) {
    throw new StockError(
      'STOCK_INSUFFICIENT',
      `Estoque insuficiente de ${product.name} (disponível: ${product.stock_quantity}).`,
      a.productId,
    );
  }

  const wasAboveMin = product.stock_quantity > product.min_stock_level;
  const nowLow = newQty <= product.min_stock_level;

  const updated = await tx.product.update({
    where: { id: a.productId },
    data: { stockQuantity: newQty },
  });

  await tx.stockMovement.create({
    data: {
      organizationId: a.orgId,
      productId: a.productId,
      delta: a.delta,
      type: a.type,
      reason: a.reason,
      performedBy: a.performedBy,
      comandaId: a.comandaId ?? null,
    },
  });

  if (wasAboveMin && nowLow) {
    // Idempotente: uma única notificação stock_low não lida por produto
    const existing = await tx.notification.findFirst({
      where: {
        organizationId: a.orgId,
        kind: 'stock_low',
        readAt: null,
        payload: { path: ['productId'], equals: a.productId },
      },
    });
    if (!existing) {
      await tx.notification.create({
        data: {
          organizationId: a.orgId,
          memberId: null, // notificação da organização inteira
          kind: 'stock_low',
          payload: {
            productId: a.productId,
            productName: product.name,
            currentStock: newQty,
            minStockLevel: product.min_stock_level,
          },
        },
      });
    }
  } else if (!wasAboveMin && !nowLow) {
    // Estoque voltou acima do mínimo — marca como lidas as stock_low pendentes
    await tx.notification.updateMany({
      where: {
        organizationId: a.orgId,
        kind: 'stock_low',
        readAt: null,
        payload: { path: ['productId'], equals: a.productId },
      },
      data: { readAt: new Date() },
    });
  }

  return { product: updated, newQty };
}
