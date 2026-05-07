import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

type CategoryPayload = {
  category: Record<string, unknown> | null;
  errors: UserError[];
};

function errorPayload(err: UserError): CategoryPayload {
  return { category: null, errors: [err] };
}

/**
 * CategoriesService — hierarchical categories CRUD (CAT-01).
 *
 * Rules:
 * - Max depth 2 levels (root → child). No grandchildren. (D-04)
 * - displayOrder tracks position within siblings. (D-05)
 * - Soft-delete via deletedAt; default queries filter deletedAt IS NULL. (D-26)
 * - All DB operations MUST go through runWithTenant to respect RLS. (D-03)
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly tenant: TenantContextService) {}

  /**
   * Lists root categories (parentId IS NULL) with 1-level children embedded.
   * Filters out soft-deleted rows at both levels.
   */
  async list(orgId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      return tx.category.findMany({
        where: { parentId: null, deletedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          children: {
            where: { deletedAt: null },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          },
        },
      });
    });
  }

  /**
   * Retrieves a single category by ID with parent and children populated.
   * Returns null if not found or soft-deleted.
   */
  async getById(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.category.findFirst({
        where: { id, deletedAt: null },
        include: {
          children: { where: { deletedAt: null }, orderBy: [{ displayOrder: 'asc' }] },
          parent: true,
        },
      }),
    );
  }

  /**
   * Creates a category. If parentId is provided, validates that:
   * - Parent exists and is not soft-deleted.
   * - Parent has no parent itself (max 2 levels — D-04).
   *
   * displayOrder is auto-assigned to last position in the sibling group.
   */
  async create(orgId: string, input: { name: string; parentId?: string }) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      if (input.parentId) {
        const parent = await tx.category.findFirst({
          where: { id: input.parentId, deletedAt: null },
        });
        if (!parent) {
          return errorPayload({
            code: 'PARENT_NOT_FOUND',
            message: 'Categoria principal não encontrada.',
            field: 'parentId',
          });
        }
        if (parent.parentId !== null) {
          return errorPayload({
            code: 'CATEGORY_DEPTH',
            message: 'Uma subcategoria não pode ter subcategorias.',
            field: 'parentId',
          });
        }
      }

      // Determine next displayOrder within the sibling group
      const last = await tx.category.findFirst({
        where: { parentId: input.parentId ?? null, deletedAt: null },
        orderBy: { displayOrder: 'desc' },
      });
      const nextOrder = last ? last.displayOrder + 1 : 0;

      const category = await tx.category.create({
        data: {
          organizationId: orgId,
          name: input.name,
          parentId: input.parentId ?? null,
          displayOrder: nextOrder,
        },
      });

      return { category, errors: [] as UserError[] };
    });
  }

  /**
   * Updates name, parentId, or displayOrder of an existing category.
   * Re-runs depth validation if parentId changes.
   * Blocks reparenting a category that already has children (would violate max-depth).
   */
  async update(orgId: string, input: {
    id: string;
    name?: string;
    parentId?: string | null;
    displayOrder?: number;
  }) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.category.findFirst({
        where: { id: input.id, deletedAt: null },
      });
      if (!existing) {
        return errorPayload({ code: 'NOT_FOUND', message: 'Categoria não encontrada.' });
      }

      if (input.parentId !== undefined && input.parentId !== null) {
        if (input.parentId === input.id) {
          return errorPayload({
            code: 'CATEGORY_SELF_PARENT',
            message: 'Categoria não pode ser pai de si mesma.',
            field: 'parentId',
          });
        }
        const parent = await tx.category.findFirst({
          where: { id: input.parentId, deletedAt: null },
        });
        if (!parent) {
          return errorPayload({
            code: 'PARENT_NOT_FOUND',
            message: 'Categoria principal não encontrada.',
            field: 'parentId',
          });
        }
        if (parent.parentId !== null) {
          return errorPayload({
            code: 'CATEGORY_DEPTH',
            message: 'Uma subcategoria não pode ter subcategorias.',
            field: 'parentId',
          });
        }
        // Prevent reparenting a category that already has children
        const childCount = await tx.category.count({
          where: { parentId: input.id, deletedAt: null },
        });
        if (childCount > 0) {
          return errorPayload({
            code: 'CATEGORY_DEPTH',
            message: 'Categoria com subcategorias não pode ser movida para outro pai.',
            field: 'parentId',
          });
        }
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

  /**
   * Swaps displayOrder with the adjacent sibling in the specified direction.
   * No-op if already at the boundary (first/last in group).
   */
  async reorder(orgId: string, input: { id: string; direction: 'UP' | 'DOWN' }) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await tx.category.findFirst({
        where: { id: input.id, deletedAt: null },
      });
      if (!cur) {
        return errorPayload({ code: 'NOT_FOUND', message: 'Categoria não encontrada.' });
      }

      const orderFilter =
        input.direction === 'UP'
          ? { lt: cur.displayOrder }
          : { gt: cur.displayOrder };

      const sibling = await tx.category.findFirst({
        where: { parentId: cur.parentId, deletedAt: null, displayOrder: orderFilter },
        orderBy: { displayOrder: input.direction === 'UP' ? 'desc' : 'asc' },
      });

      // Already at boundary — return current without error
      if (!sibling) {
        return { category: cur, errors: [] as UserError[] };
      }

      // Swap displayOrder values atomically
      await tx.$transaction([
        tx.category.update({
          where: { id: cur.id },
          data: { displayOrder: sibling.displayOrder },
        }),
        tx.category.update({
          where: { id: sibling.id },
          data: { displayOrder: cur.displayOrder },
        }),
      ]);

      const updated = await tx.category.findUnique({ where: { id: cur.id } });
      return { category: updated, errors: [] as UserError[] };
    });
  }

  /**
   * Soft-deletes a category by setting deletedAt.
   * Blocked if:
   * - Category has active children (CATEGORY_HAS_CHILDREN).
   * - Category has active services (CATEGORY_HAS_SERVICES).
   */
  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await tx.category.findFirst({
        where: { id, deletedAt: null },
      });
      if (!cur) {
        return errorPayload({ code: 'NOT_FOUND', message: 'Categoria não encontrada.' });
      }

      const childCount = await tx.category.count({
        where: { parentId: id, deletedAt: null },
      });
      if (childCount > 0) {
        return errorPayload({
          code: 'CATEGORY_HAS_CHILDREN',
          message: 'Remova as subcategorias antes.',
        });
      }

      const serviceCount = await tx.service.count({
        where: { categoryId: id, deletedAt: null },
      });
      if (serviceCount > 0) {
        return errorPayload({
          code: 'CATEGORY_HAS_SERVICES',
          message: 'Mova ou desative os serviços desta categoria primeiro.',
        });
      }

      const category = await tx.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return { category, errors: [] as UserError[] };
    });
  }
}
