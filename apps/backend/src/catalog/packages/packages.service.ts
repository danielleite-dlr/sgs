import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { CreatePackageInput, UpdatePackageInput } from './dto/package.input';

interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

type PackagePayload = {
  package: (Record<string, unknown> & { individualSum: string }) | null;
  errors: UserError[];
};

function errorPayload(err: UserError): PackagePayload {
  return { package: null, errors: [err] };
}

/**
 * Computes individualSum as the sum of (service.basePrice × quantity) for each
 * PackageService row. Uses integer arithmetic (multiply by 100, sum, divide by 100)
 * to avoid IEEE-754 floating-point rounding errors on 2-decimal prices.
 */
function computeIndividualSum(
  packageServices: Array<{
    quantity: number;
    service: { basePrice: string | number | { toString(): string } };
  }>,
): string {
  // Work in integer cents to avoid floating point issues
  let totalCents = 0;
  for (const ps of packageServices) {
    const priceCents = Math.round(parseFloat(ps.service.basePrice.toString()) * 100);
    totalCents += priceCents * ps.quantity;
  }
  const result = totalCents / 100;
  return result.toFixed(2);
}

/**
 * PackagesService — fixed-composition service bundles with own price (CAT-02).
 *
 * Rules:
 * - Package has its own price, independent of the sum of services (D-09).
 * - Composition is fixed; services array is replaced atomically on update (D-10).
 * - validForDays is nullable (null = no expiry, D-11).
 * - Soft-delete via deletedAt; no FK blocks (packages are leaf). (D-26)
 * - All DB operations MUST go through runWithTenant to respect RLS. (D-03)
 */
@Injectable()
export class PackagesService {
  constructor(private readonly tenant: TenantContextService) {}

  /**
   * Lists all non-deleted packages with their services.
   * Includes individualSum computed from service base prices.
   */
  async list(orgId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const pkgs = await tx.package.findMany({
        where: { deletedAt: null },
        orderBy: [{ name: 'asc' }],
        include: {
          services: {
            orderBy: [{ displayOrder: 'asc' }],
            include: { service: true },
          },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return pkgs.map((pkg: any) => ({
        ...pkg,
        individualSum: computeIndividualSum(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pkg.services.map((ps: any) => ({
            quantity: ps.quantity,
            service: { basePrice: ps.service.basePrice },
          })),
        ),
      }));
    });
  }

  /**
   * Retrieves a single package by ID with services and computed individualSum.
   * Returns null if not found or soft-deleted.
   */
  async getById(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const pkg = await tx.package.findFirst({
        where: { id, deletedAt: null },
        include: {
          services: {
            orderBy: [{ displayOrder: 'asc' }],
            include: { service: true },
          },
        },
      });

      if (!pkg) return null;

      return {
        ...pkg,
        individualSum: computeIndividualSum(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (pkg as any).services.map((ps: any) => ({
            quantity: ps.quantity,
            service: { basePrice: ps.service.basePrice },
          })),
        ),
      };
    });
  }

  /**
   * Creates a package with its service composition in a single transaction.
   * Validates that all referenced services exist and are active in this org.
   *
   * Minimum 1 service required per package (PACKAGE_EMPTY error otherwise).
   */
  async create(orgId: string, input: CreatePackageInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      if (!input.services || input.services.length === 0) {
        return errorPayload({
          code: 'PACKAGE_EMPTY',
          message: 'Adicione ao menos um serviço.',
          field: 'services',
        });
      }

      // Validate all referenced services exist in this org and are not deleted
      const ids = input.services.map((s) => s.serviceId);
      const found = await tx.service.findMany({
        where: { id: { in: ids }, deletedAt: null },
      });
      if (found.length !== ids.length) {
        return errorPayload({
          code: 'SERVICE_NOT_FOUND',
          message: 'Um ou mais serviços não foram encontrados.',
          field: 'services',
        });
      }

      // Create package
      const pkg = await tx.package.create({
        data: {
          organizationId: orgId,
          name: input.name,
          price: input.price,
          validForDays: input.validForDays ?? null,
        },
      });

      // Create junction rows
      await tx.packageService.createMany({
        data: input.services.map((s, i) => ({
          packageId: pkg.id,
          serviceId: s.serviceId,
          quantity: s.quantity ?? 1,
          displayOrder: i,
        })),
      });

      return {
        package: await this.loadFull(tx, pkg.id),
        errors: [] as UserError[],
      };
    });
  }

  /**
   * Updates package fields. When services array is provided, atomically replaces
   * the entire junction set (delete all, recreate from input).
   * Empty services array is rejected with PACKAGE_EMPTY.
   */
  async update(orgId: string, input: UpdatePackageInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.package.findFirst({
        where: { id: input.id, deletedAt: null },
      });
      if (!existing) {
        return errorPayload({ code: 'NOT_FOUND', message: 'Pacote não encontrado.' });
      }

      // Update scalar fields
      await tx.package.update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          price: input.price ?? existing.price,
          validForDays:
            input.validForDays === undefined ? existing.validForDays : input.validForDays,
        },
      });

      // Atomically replace service composition if provided
      if (input.services !== undefined) {
        if (input.services.length === 0) {
          return errorPayload({
            code: 'PACKAGE_EMPTY',
            message: 'Adicione ao menos um serviço.',
            field: 'services',
          });
        }

        const ids = input.services.map((s) => s.serviceId);
        const found = await tx.service.findMany({
          where: { id: { in: ids }, deletedAt: null },
        });
        if (found.length !== ids.length) {
          return errorPayload({
            code: 'SERVICE_NOT_FOUND',
            message: 'Um ou mais serviços não foram encontrados.',
            field: 'services',
          });
        }

        // Delete all existing junction rows and recreate
        await tx.packageService.deleteMany({ where: { packageId: input.id } });
        await tx.packageService.createMany({
          data: input.services.map((s, i) => ({
            packageId: input.id,
            serviceId: s.serviceId,
            quantity: s.quantity ?? 1,
            displayOrder: i,
          })),
        });
      }

      return {
        package: await this.loadFull(tx, input.id),
        errors: [] as UserError[],
      };
    });
  }

  /**
   * Soft-deletes a package by setting deletedAt.
   * Packages are leaf nodes — no FK blocks apply.
   */
  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await tx.package.findFirst({
        where: { id, deletedAt: null },
      });
      if (!cur) {
        return errorPayload({ code: 'NOT_FOUND', message: 'Pacote não encontrado.' });
      }

      const pkg = await tx.package.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return {
        package: { ...pkg, individualSum: '0.00' },
        errors: [] as UserError[],
      };
    });
  }

  /**
   * Loads a package with its full service composition and computes individualSum.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadFull(tx: any, id: string) {
    const pkg = await tx.package.findUnique({
      where: { id },
      include: {
        services: {
          orderBy: [{ displayOrder: 'asc' }],
          include: { service: true },
        },
      },
    });

    if (!pkg) return null;

    return {
      ...pkg,
      individualSum: computeIndividualSum(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pkg as any).services.map((ps: any) => ({
          quantity: ps.quantity,
          service: { basePrice: ps.service.basePrice },
        })),
      ),
    };
  }
}
