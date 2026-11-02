import type { Prisma } from '@prisma/client';
import { fromCents, splitProportional, toCents } from '../common/money';
import type { TenantPrismaClient } from '../database/types';
import { professionalServesCategory } from '../identity/member-categories';

/** Erro de regra de negócio da comanda; lançado dentro da transação (ROLLBACK) e traduzido fora. */
export class ComandaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field: string | null = null,
  ) {
    super(message);
  }
}

export function mapComandaError(
  e: unknown,
): { code: string; message: string; field: string | null } | null {
  if (e instanceof ComandaError) {
    return { code: e.code, message: e.message, field: e.field };
  }
  return null;
}

/** Rateio do preço do pacote proporcional ao preço cheio de cada unidade (soma exata). */
export function prorateUnits(
  listUnitCents: number[],
  packagePriceCents: number,
): number[] {
  return splitProportional(listUnitCents, packagePriceCents);
}

type ItemInput = Prisma.ComandaItemUncheckedCreateInput;

async function requireProfessional(
  tx: TenantPrismaClient,
  professionalId: string,
) {
  const pro = await tx.member.findFirst({
    where: {
      id: professionalId,
      status: 'active',
      isProfessional: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!pro) {
    throw new ComandaError(
      'PROFESSIONAL_NOT_FOUND',
      'Profissional não encontrado.',
      'professionalId',
    );
  }
}

async function loadServiceForItem(
  tx: TenantPrismaClient,
  a: {
    serviceId: string;
    serviceVariantId?: string | null;
    professionalId: string;
  },
) {
  await requireProfessional(tx, a.professionalId);
  const service = await tx.service.findFirst({
    where: { id: a.serviceId, deletedAt: null },
    select: { id: true, name: true, basePrice: true, categoryId: true },
  });
  if (!service) {
    throw new ComandaError(
      'SERVICE_NOT_FOUND',
      'Serviço não encontrado.',
      'serviceId',
    );
  }
  if (!(await professionalServesCategory(tx, a.professionalId, service.categoryId))) {
    throw new ComandaError(
      'PROFESSIONAL_DOES_NOT_SERVE_CATEGORY',
      'Este profissional não atende a categoria do serviço.',
      'professionalId',
    );
  }
  let variant: { id: string; name: string; price: Prisma.Decimal } | null = null;
  if (a.serviceVariantId) {
    variant = await tx.servicePricingVariant.findFirst({
      where: { id: a.serviceVariantId, serviceId: service.id },
      select: { id: true, name: true, price: true },
    });
    if (!variant) {
      throw new ComandaError(
        'VARIANT_NOT_FOUND',
        'Variação de preço não encontrada para este serviço.',
        'serviceVariantId',
      );
    }
  }
  const listCents = toCents(variant ? variant.price : service.basePrice);
  return { service, variant, listCents };
}

const snapshotName = (name: string, variantName?: string) =>
  variantName ? `${name} — ${variantName}` : name;

/** Item de serviço com preço-snapshot (variante ?? preço base). */
export async function buildServiceItem(
  tx: TenantPrismaClient,
  a: {
    orgId: string;
    comandaId: string;
    serviceId: string;
    serviceVariantId?: string | null;
    professionalId: string;
    quantity: number;
    appointmentId?: string | null;
    createdBy: string;
  },
): Promise<ItemInput> {
  const { service, variant, listCents } = await loadServiceForItem(tx, a);
  return {
    organizationId: a.orgId,
    comandaId: a.comandaId,
    kind: 'service',
    serviceId: service.id,
    serviceVariantId: variant?.id ?? null,
    appointmentId: a.appointmentId ?? null,
    professionalId: a.professionalId,
    nameSnapshot: snapshotName(service.name, variant?.name),
    quantity: a.quantity,
    listUnitPrice: fromCents(listCents),
    unitPrice: fromCents(listCents),
    total: fromCents(listCents * a.quantity),
    createdBy: a.createdBy,
  };
}

/** Item de produto (preço de venda). Estoque só baixa no fechamento (D-21). */
export async function buildProductItem(
  tx: TenantPrismaClient,
  a: {
    orgId: string;
    comandaId: string;
    productId: string;
    professionalId: string;
    quantity: number;
    createdBy: string;
  },
): Promise<ItemInput> {
  const product = await tx.product.findFirst({
    where: { id: a.productId, deletedAt: null },
    select: { id: true, name: true, salePrice: true },
  });
  if (!product) {
    throw new ComandaError(
      'PRODUCT_NOT_FOUND',
      'Produto não encontrado.',
      'productId',
    );
  }
  const seller = await tx.member.findFirst({
    where: { id: a.professionalId, status: 'active', deletedAt: null },
    select: { id: true },
  });
  if (!seller) {
    throw new ComandaError(
      'MEMBER_NOT_FOUND',
      'Vendedor não encontrado.',
      'professionalId',
    );
  }
  const unit = toCents(product.salePrice);
  return {
    organizationId: a.orgId,
    comandaId: a.comandaId,
    kind: 'product',
    productId: product.id,
    professionalId: a.professionalId,
    nameSnapshot: product.name,
    quantity: a.quantity,
    listUnitPrice: fromCents(unit),
    unitPrice: fromCents(unit),
    total: fromCents(unit * a.quantity),
    createdBy: a.createdBy,
  };
}

/**
 * Pacote -> 1 item (quantity 1) por UNIDADE de cada serviço do pacote.
 * D-23: `listUnitPrice` guarda o preço cheio do serviço (base da comissão);
 * `unitPrice`/`total` guardam a parte rateada cobrada do cliente.
 */
export async function expandPackageItems(
  tx: TenantPrismaClient,
  a: {
    orgId: string;
    comandaId: string;
    packageId: string;
    assignments: {
      serviceId: string;
      professionalId: string;
      serviceVariantId?: string | null;
      appointmentId?: string | null;
    }[];
    createdBy: string;
  },
): Promise<ItemInput[]> {
  const pkg = await tx.package.findFirst({
    where: { id: a.packageId, deletedAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      services: {
        select: { serviceId: true, quantity: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });
  if (!pkg) {
    throw new ComandaError(
      'PACKAGE_NOT_FOUND',
      'Pacote não encontrado.',
      'packageId',
    );
  }
  const bySvc = new Map(a.assignments.map((x) => [x.serviceId, x]));
  const units: {
    assignment: (typeof a.assignments)[number];
    built: Awaited<ReturnType<typeof loadServiceForItem>>;
  }[] = [];
  for (const line of pkg.services) {
    const assignment = bySvc.get(line.serviceId);
    if (!assignment) {
      throw new ComandaError(
        'MISSING_ASSIGNMENT',
        'Informe o profissional de cada serviço do pacote.',
        'assignments',
      );
    }
    const built = await loadServiceForItem(tx, assignment);
    for (let i = 0; i < line.quantity; i++) units.push({ assignment, built });
  }
  const charged = prorateUnits(
    units.map((u) => u.built.listCents),
    toCents(pkg.price),
  );
  return units.map((u, i) => ({
    organizationId: a.orgId,
    comandaId: a.comandaId,
    kind: 'service',
    serviceId: u.built.service.id,
    serviceVariantId: u.built.variant?.id ?? null,
    packageId: pkg.id,
    appointmentId: u.assignment.appointmentId ?? null,
    professionalId: u.assignment.professionalId,
    nameSnapshot: `${u.built.service.name} (${pkg.name})`,
    quantity: 1,
    listUnitPrice: fromCents(u.built.listCents),
    unitPrice: fromCents(charged[i]),
    total: fromCents(charged[i]),
    createdBy: a.createdBy,
  }));
}

/** comandas.total = soma dos totais dos itens. */
export async function recalcComandaTotal(
  tx: TenantPrismaClient,
  comandaId: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE comandas
       SET total = COALESCE((SELECT SUM(total) FROM comanda_items WHERE comanda_id = ${comandaId}::uuid), 0),
           updated_at = now()
     WHERE id = ${comandaId}::uuid`;
}
