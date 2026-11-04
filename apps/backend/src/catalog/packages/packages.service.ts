import { Injectable } from '@nestjs/common';
import { parseMoneyInput, fromCents } from '../../common/money';
import { TenantContextService } from '../../database/tenant-context.service';
import { computePackageCosts } from '../catalog-costs';
import {
  CreatePackageInput,
  PackageCostItemInput,
  UpdatePackageInput,
} from './dto/package.input';

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

type PackagePayload = {
  package: (Record<string, unknown> & { individualSum: string }) | null;
  errors: UserError[];
};

type DepositResult =
  | { ok: true; kind: 'fixed' | 'percent' | null; value: string | null }
  | { ok: false; error: UserError };

const invalidDeposit = (message: string): DepositResult => ({
  ok: false,
  error: { code: 'INVALID_DEPOSIT', message, field: 'depositValue' },
});

/** Entrada do pacote de noiva (D-12): ambos ou nenhum; R$ fixo ou percentual de 0 a 100. */
function validateDeposit(
  kind: string | null | undefined,
  value: string | null | undefined,
): DepositResult {
  if ((kind == null) !== (value == null)) {
    return invalidDeposit('Informe o tipo e o valor da entrada.');
  }
  if (kind == null || value == null) return { ok: true, kind: null, value: null };
  if (kind !== 'fixed' && kind !== 'percent') {
    return invalidDeposit('O tipo da entrada deve ser fixed ou percent.');
  }
  const cents = parseMoneyInput(value);
  if (cents === null) return invalidDeposit('Valor da entrada inválido.');
  if (kind === 'percent' && cents > 10000) {
    return invalidDeposit('A entrada em percentual não pode passar de 100%.');
  }
  return { ok: true, kind, value: fromCents(cents) };
}

/** Decimal -> "30.00" (o GraphQL String de um Decimal perderia os zeros). */
function withDeposit<T extends { depositValue?: unknown }>(pkg: T): T {
  const v = pkg.depositValue as { toFixed?: (n: number) => string } | null | undefined;
  return { ...pkg, depositValue: v && v.toFixed ? v.toFixed(2) : null };
}

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

const PACKAGE_INCLUDE = {
  services: {
    orderBy: [{ displayOrder: 'asc' as const }],
    include: { service: true },
  },
  costItems: { orderBy: [{ displayOrder: 'asc' as const }] },
};

/**
 * Pacote carregado com PACKAGE_INCLUDE -> objeto GraphQL: individualSum,
 * entrada formatada e custos/lucro (o resolver de campo esconde os custos de
 * quem não edita o catálogo).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPackageView(pkg: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const services = (pkg.services ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const costItems = ((pkg.costItems ?? []) as any[]).map((ci) => ({
    id: ci.id,
    name: ci.name,
    cost: fromCents(Math.round(parseFloat(ci.cost.toString()) * 100)),
    displayOrder: ci.displayOrder,
  }));
  return withDeposit({
    ...pkg,
    costItems,
    individualSum: computeIndividualSum(
      services.map((ps) => ({
        quantity: ps.quantity,
        service: { basePrice: ps.service.basePrice },
      })),
    ),
    ...computePackageCosts({ price: pkg.price, services, costItems }),
  });
}

type CostItemsResult =
  | { ok: true; rows: Array<{ name: string; cost: string }> }
  | { ok: false; error: UserError };

/** Itens de custo: nome 1–120 caracteres, custo decimal >= 0. */
function validateCostItems(items: PackageCostItemInput[]): CostItemsResult {
  const rows: Array<{ name: string; cost: string }> = [];
  for (const item of items) {
    const name = (item.name ?? '').trim();
    if (name.length === 0 || name.length > 120) {
      return {
        ok: false,
        error: { code: 'INVALID_COST_ITEM', message: 'Informe o nome do item de custo.', field: 'costItems' },
      };
    }
    const cents = parseMoneyInput(item.cost);
    if (cents === null) {
      return {
        ok: false,
        error: { code: 'INVALID_COST_ITEM', message: `Custo inválido em "${name}".`, field: 'costItems' },
      };
    }
    rows.push({ name, cost: fromCents(cents) });
  }
  return { ok: true, rows };
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
        include: PACKAGE_INCLUDE,
      });
      return pkgs.map(toPackageView);
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
        include: PACKAGE_INCLUDE,
      });
      return pkg ? toPackageView(pkg) : null;
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

      const dep = validateDeposit(input.depositKind, input.depositValue);
      if (!dep.ok) return errorPayload(dep.error);

      const costs = validateCostItems(input.costItems ?? []);
      if (!costs.ok) return errorPayload(costs.error);

      // Create package
      const pkg = await tx.package.create({
        data: {
          organizationId: orgId,
          name: input.name,
          price: input.price,
          validForDays: input.validForDays ?? null,
          depositKind: dep.kind,
          depositValue: dep.value,
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

      if (costs.rows.length > 0) {
        await tx.packageCostItem.createMany({
          data: costs.rows.map((c, i) => ({
            organizationId: orgId,
            packageId: pkg.id,
            name: c.name,
            cost: c.cost,
            displayOrder: i,
          })),
        });
      }

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

      // Entrada: ambos ausentes = inalterada; depositKind null explícito limpa os dois
      let depositData: { depositKind: string | null; depositValue: string | null } | undefined;
      if (input.depositKind === null) {
        depositData = { depositKind: null, depositValue: null };
      } else if (input.depositKind !== undefined || input.depositValue !== undefined) {
        const dep = validateDeposit(input.depositKind, input.depositValue);
        if (!dep.ok) return errorPayload(dep.error);
        depositData = { depositKind: dep.kind, depositValue: dep.value };
      }

      let costRows: Array<{ name: string; cost: string }> | undefined;
      if (input.costItems !== undefined && input.costItems !== null) {
        const costs = validateCostItems(input.costItems);
        if (!costs.ok) return errorPayload(costs.error);
        costRows = costs.rows;
      }

      // Update scalar fields
      await tx.package.update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          price: input.price ?? existing.price,
          validForDays:
            input.validForDays === undefined ? existing.validForDays : input.validForDays,
          ...(depositData ?? {}),
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

      // Substitui os itens de custo quando enviados (lista vazia limpa)
      if (costRows !== undefined) {
        await tx.packageCostItem.deleteMany({ where: { packageId: input.id } });
        if (costRows.length > 0) {
          await tx.packageCostItem.createMany({
            data: costRows.map((c, i) => ({
              organizationId: orgId,
              packageId: input.id,
              name: c.name,
              cost: c.cost,
              displayOrder: i,
            })),
          });
        }
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
        package: toPackageView({ ...pkg, services: [], costItems: [] }),
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
      include: PACKAGE_INCLUDE,
    });
    return pkg ? toPackageView(pkg) : null;
  }
}
