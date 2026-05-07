import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { CreateServiceInput, UpdateServiceInput } from './dto/service.input';

interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

type ServicePayload = {
  service: Record<string, unknown> | null;
  errors: UserError[];
};

function errorPayload(err: UserError): ServicePayload {
  return { service: null, errors: [err] };
}

/**
 * ServicesService — salon services with optional nested pricing variants (CAT-01).
 *
 * Rules:
 * - Each service belongs to exactly one category (D-06).
 * - Pricing variants are created/replaced in a single transaction (D-07).
 * - Soft-delete via deletedAt; default queries filter deletedAt IS NULL. (D-26)
 * - All DB operations MUST go through runWithTenant to respect RLS. (D-03)
 * - Service cannot be deleted if it is referenced by an active package.
 */
@Injectable()
export class ServicesService {
  constructor(private readonly tenant: TenantContextService) {}

  /**
   * Lists services, optionally filtered by categoryId.
   * Only returns non-deleted services with their pricing variants.
   */
  async list(orgId: string, categoryId?: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      return tx.service.findMany({
        where: {
          deletedAt: null,
          ...(categoryId ? { categoryId } : {}),
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          pricingVariants: { orderBy: [{ displayOrder: 'asc' }] },
          category: true,
        },
      });
    });
  }

  /**
   * Retrieves a single service by ID with pricing variants and category.
   * Returns null if not found or soft-deleted.
   */
  async getById(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.service.findFirst({
        where: { id, deletedAt: null },
        include: {
          pricingVariants: { orderBy: [{ displayOrder: 'asc' }] },
          category: true,
        },
      }),
    );
  }

  /**
   * Creates a service with optional pricing variants in a single transaction.
   * Validates that the categoryId references an active, non-deleted category.
   *
   * displayOrder is auto-assigned to last position within the category.
   */
  async create(orgId: string, input: CreateServiceInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      // Validate category exists and belongs to this org
      const cat = await tx.category.findFirst({
        where: { id: input.categoryId, deletedAt: null },
      });
      if (!cat) {
        return errorPayload({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Categoria não encontrada.',
          field: 'categoryId',
        });
      }

      // Determine next displayOrder within the category
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
          basePrice: input.basePrice,
          defaultDurationMinutes: input.defaultDurationMinutes,
          displayOrder: nextOrder,
        },
      });

      // Insert pricing variants in batch if provided
      if (input.pricingVariants && input.pricingVariants.length > 0) {
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

      // Return full service with pricing variants
      const full = await tx.service.findUnique({
        where: { id: service.id },
        include: {
          pricingVariants: { orderBy: [{ displayOrder: 'asc' }] },
          category: true,
        },
      });

      return { service: full, errors: [] as UserError[] };
    });
  }

  /**
   * Updates service fields. When pricingVariants is provided, atomically
   * replaces the entire variant set (delete all, recreate from input).
   * This is the fixed-composition approach per D-07.
   */
  async update(orgId: string, input: UpdateServiceInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.service.findFirst({
        where: { id: input.id, deletedAt: null },
      });
      if (!existing) {
        return errorPayload({ code: 'NOT_FOUND', message: 'Serviço não encontrado.' });
      }

      // Validate new category if changing
      if (input.categoryId) {
        const cat = await tx.category.findFirst({
          where: { id: input.categoryId, deletedAt: null },
        });
        if (!cat) {
          return errorPayload({
            code: 'CATEGORY_NOT_FOUND',
            message: 'Categoria não encontrada.',
            field: 'categoryId',
          });
        }
      }

      // Update service fields
      await tx.service.update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          categoryId: input.categoryId ?? existing.categoryId,
          basePrice: input.basePrice ?? existing.basePrice,
          defaultDurationMinutes:
            input.defaultDurationMinutes ?? existing.defaultDurationMinutes,
        },
      });

      // Atomically replace pricing variants if provided
      if (input.pricingVariants !== undefined) {
        // Delete all existing variants (cascade will happen for orphans)
        await tx.servicePricingVariant.deleteMany({
          where: { serviceId: input.id },
        });

        if (input.pricingVariants.length > 0) {
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
        include: {
          pricingVariants: { orderBy: [{ displayOrder: 'asc' }] },
          category: true,
        },
      });

      return { service: full, errors: [] as UserError[] };
    });
  }

  /**
   * Soft-deletes a service by setting deletedAt.
   * Blocked if the service is part of any active package (SERVICE_IN_PACKAGE).
   */
  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await tx.service.findFirst({
        where: { id, deletedAt: null },
      });
      if (!cur) {
        return errorPayload({ code: 'NOT_FOUND', message: 'Serviço não encontrado.' });
      }

      // Block if service is referenced by any package
      const pkgUses = await tx.packageService.count({
        where: { serviceId: id },
      });
      if (pkgUses > 0) {
        return errorPayload({
          code: 'SERVICE_IN_PACKAGE',
          message: 'Remova este serviço dos pacotes antes de desativar.',
        });
      }

      const service = await tx.service.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return { service, errors: [] as UserError[] };
    });
  }
}
