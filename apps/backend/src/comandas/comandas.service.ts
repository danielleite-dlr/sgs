import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fromCents, parseMoneyInput, toCents } from '../common/money';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import type { TenantContext } from '../authz/decorators/current-tenant.decorator';
import {
  CLIENT_CREDIT_METHOD,
  PAYMENT_METHODS,
} from './comanda-math';
import {
  ComandaError,
  buildProductItem,
  buildServiceItem,
  expandPackageItems,
  mapComandaError,
  recalcComandaTotal,
} from './comanda-items';
import { openComandaTx } from './comanda-open';
import {
  loadComandaView,
  loadComandaViews,
  type ComandaView,
} from './comanda-serialize';

export interface ComandaUserError {
  code: string;
  message: string;
  field: string | null;
}

export interface ComandaPayload {
  comanda: ComandaView | null;
  errors: ComandaUserError[];
}

const MAX_QUANTITY = 999;
const LIST_LIMIT = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (e: unknown): ComandaPayload => {
  const m = mapComandaError(e);
  if (m) return { comanda: null, errors: [m] };
  throw e;
};

const brl = (cents: number) => fromCents(cents).replace('.', ',');

type LockedComanda = { id: string; status: string; client_id: string };

/**
 * ComandasService — núcleo do POS. Toda mutação trava a linha da comanda
 * (FOR UPDATE) e só altera comanda aberta; erros de regra são lançados dentro
 * da transação (ROLLBACK) e traduzidos para `errors[]` fora dela.
 */
@Injectable()
export class ComandasService {
  constructor(private readonly tenant: TenantContextService) {}

  /** Trava e valida a comanda, executa `fn` e devolve a view atualizada. */
  private async mutate(
    orgId: string,
    comandaId: string,
    fn: (tx: TenantPrismaClient, comanda: LockedComanda) => Promise<void>,
  ): Promise<ComandaPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const rows = await tx.$queryRaw<LockedComanda[]>`
          SELECT id, status, client_id FROM comandas
           WHERE id = ${comandaId}::uuid FOR UPDATE`;
        const comanda = rows[0];
        if (!comanda) {
          throw new ComandaError('NOT_FOUND', 'Comanda não encontrada.', 'comandaId');
        }
        if (comanda.status !== 'open') {
          throw new ComandaError(
            'COMANDA_NOT_OPEN',
            'A comanda não está aberta.',
            'comandaId',
          );
        }
        await fn(tx, comanda);
        return { comanda: await loadComandaView(tx, comandaId), errors: [] };
      });
    } catch (e) {
      return fail(e);
    }
  }

  async openWalkIn(
    orgId: string,
    memberId: string,
    input: {
      clientId?: string | null;
      newClient?: { fullName: string; phone?: string | null } | null;
    },
  ): Promise<ComandaPayload> {
    const hasClient = !!input.clientId;
    const hasNew = !!input.newClient;
    if (hasClient === hasNew) {
      return {
        comanda: null,
        errors: [
          {
            code: 'CLIENT_REQUIRED',
            message: 'Escolha um cliente ou cadastre um novo.',
            field: 'clientId',
          },
        ],
      };
    }
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        let clientId = input.clientId ?? '';
        if (input.newClient) {
          const fullName = input.newClient.fullName?.trim() ?? '';
          if (fullName.length < 2 || fullName.length > 255) {
            throw new ComandaError(
              'INVALID_NAME',
              'Informe o nome do cliente.',
              'newClient.fullName',
            );
          }
          const phone = input.newClient.phone?.trim() || null;
          if (phone && phone.length > 30) {
            throw new ComandaError(
              'INVALID_PHONE',
              'Telefone inválido.',
              'newClient.phone',
            );
          }
          // D-06: walk-in só com nome (+ telefone opcional); sem CPF e sem e-mail.
          const created = await tx.client.create({
            data: { organizationId: orgId, fullName, phone },
            select: { id: true },
          });
          clientId = created.id;
        }
        const comanda = await openComandaTx(tx, {
          orgId,
          clientId,
          openedBy: memberId,
        });
        return { comanda: await loadComandaView(tx, comanda.id), errors: [] };
      });
    } catch (e) {
      return fail(e);
    }
  }

  addItem(
    orgId: string,
    memberId: string,
    input: {
      comandaId: string;
      kind: string;
      serviceId?: string | null;
      serviceVariantId?: string | null;
      productId?: string | null;
      professionalId: string;
      quantity: number;
    },
  ): Promise<ComandaPayload> {
    return this.mutate(orgId, input.comandaId, async (tx) => {
      if (
        !Number.isInteger(input.quantity) ||
        input.quantity < 1 ||
        input.quantity > MAX_QUANTITY
      ) {
        throw new ComandaError(
          'INVALID_QUANTITY',
          'A quantidade deve ser pelo menos 1.',
          'quantity',
        );
      }
      const base = {
        orgId,
        comandaId: input.comandaId,
        professionalId: input.professionalId,
        quantity: input.quantity,
        createdBy: memberId,
      };
      let data: Prisma.ComandaItemUncheckedCreateInput;
      if (input.kind === 'service') {
        if (!input.serviceId) {
          throw new ComandaError('SERVICE_NOT_FOUND', 'Escolha um serviço.', 'serviceId');
        }
        data = await buildServiceItem(tx, {
          ...base,
          serviceId: input.serviceId,
          serviceVariantId: input.serviceVariantId,
        });
      } else if (input.kind === 'product') {
        if (!input.productId) {
          throw new ComandaError('PRODUCT_NOT_FOUND', 'Escolha um produto.', 'productId');
        }
        data = await buildProductItem(tx, { ...base, productId: input.productId });
      } else {
        throw new ComandaError('INVALID_KIND', 'Tipo de item inválido.', 'kind');
      }
      await tx.comandaItem.create({ data });
      await recalcComandaTotal(tx, input.comandaId);
    });
  }

  removeItem(
    orgId: string,
    comandaId: string,
    itemId: string,
  ): Promise<ComandaPayload> {
    return this.mutate(orgId, comandaId, async (tx) => {
      const item = await tx.comandaItem.findFirst({
        where: { id: itemId, comandaId },
        select: { id: true, appointmentId: true },
      });
      if (!item) {
        throw new ComandaError('ITEM_NOT_FOUND', 'Item não encontrado.', 'itemId');
      }
      if (item.appointmentId) {
        throw new ComandaError(
          'ITEM_LINKED_TO_APPOINTMENT',
          'Este serviço veio de um agendamento — cancele o agendamento na agenda.',
          'itemId',
        );
      }
      await tx.comandaItem.delete({ where: { id: itemId } });
      await recalcComandaTotal(tx, comandaId);
    });
  }

  addPackage(
    orgId: string,
    memberId: string,
    input: {
      comandaId: string;
      packageId: string;
      assignments: {
        serviceId: string;
        professionalId: string;
        serviceVariantId?: string | null;
      }[];
    },
  ): Promise<ComandaPayload> {
    return this.mutate(orgId, input.comandaId, async (tx) => {
      const items = await expandPackageItems(tx, {
        orgId,
        comandaId: input.comandaId,
        packageId: input.packageId,
        assignments: input.assignments,
        createdBy: memberId,
      });
      await tx.comandaItem.createMany({ data: items });
      await recalcComandaTotal(tx, input.comandaId);
    });
  }

  addPayment(
    orgId: string,
    memberId: string,
    input: { comandaId: string; method: string; amount: string },
  ): Promise<ComandaPayload> {
    return this.mutate(orgId, input.comandaId, async (tx, comanda) => {
      if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) {
        throw new ComandaError(
          'INVALID_METHOD',
          'Forma de pagamento inválida.',
          'method',
        );
      }
      const cents = parseMoneyInput(input.amount);
      if (cents === null || cents <= 0) {
        throw new ComandaError(
          'INVALID_AMOUNT',
          'Informe um valor maior que zero.',
          'amount',
        );
      }
      const [{ total }] = await tx.$queryRaw<{ total: Prisma.Decimal }[]>`
        SELECT total FROM comandas WHERE id = ${comanda.id}::uuid`;
      const existing = await tx.comandaPayment.findMany({
        where: { comandaId: comanda.id },
        select: { method: true, amount: true },
      });
      const sumOf = (pred: (m: string) => boolean) =>
        existing
          .filter((p) => pred(p.method))
          .reduce((acc, p) => acc + toCents(p.amount), 0);

      if (input.method === CLIENT_CREDIT_METHOD) {
        // Serializa consumos concorrentes de crédito do mesmo cliente.
        await tx.$queryRaw`SELECT id FROM clients WHERE id = ${comanda.client_id}::uuid FOR UPDATE`;
        const agg = await tx.clientCreditMovement.aggregate({
          where: { clientId: comanda.client_id },
          _sum: { amount: true },
        });
        const balance = toCents(agg._sum.amount ?? 0);
        const used = sumOf((m) => m === CLIENT_CREDIT_METHOD);
        if (used + cents > balance) {
          throw new ComandaError(
            'CREDIT_INSUFFICIENT',
            `Saldo de crédito insuficiente (disponível: R$ ${brl(Math.max(0, balance - used))}).`,
            'amount',
          );
        }
      }
      // Só dinheiro pode exceder o total (gera troco).
      if (input.method !== 'cash') {
        const nonCash = sumOf((m) => m !== 'cash');
        if (nonCash + cents > toCents(total)) {
          throw new ComandaError(
            'NON_CASH_EXCEEDS_TOTAL',
            'Somente dinheiro pode gerar troco.',
            'amount',
          );
        }
      }
      // Ledgers (cash/crédito) só são gravados no fechamento (03-07, D-12).
      await tx.comandaPayment.create({
        data: {
          organizationId: orgId,
          comandaId: comanda.id,
          method: input.method,
          amount: fromCents(cents),
          memberId,
        },
      });
    });
  }

  removePayment(
    orgId: string,
    comandaId: string,
    paymentId: string,
  ): Promise<ComandaPayload> {
    return this.mutate(orgId, comandaId, async (tx) => {
      const payment = await tx.comandaPayment.findFirst({
        where: { id: paymentId, comandaId },
        select: { id: true },
      });
      if (!payment) {
        throw new ComandaError(
          'PAYMENT_NOT_FOUND',
          'Pagamento não encontrado.',
          'paymentId',
        );
      }
      await tx.comandaPayment.delete({ where: { id: paymentId } });
    });
  }

  async get(
    orgId: string,
    tenant: Pick<TenantContext, 'roleName' | 'memberId'>,
    id: string,
  ): Promise<ComandaView | null> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      if (tenant.roleName === 'PROFESSIONAL') {
        const mine = await tx.comandaItem.findFirst({
          where: { comandaId: id, professionalId: tenant.memberId },
          select: { id: true },
        });
        if (!mine) return null;
      }
      return loadComandaView(tx, id);
    });
  }

  async list(
    orgId: string,
    tenant: Pick<TenantContext, 'roleName' | 'memberId'>,
    filters: { from: string; to: string; status?: string | null; clientId?: string | null },
  ): Promise<ComandaView[]> {
    if (!DATE_RE.test(filters.from) || !DATE_RE.test(filters.to)) return [];
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: orgId },
        select: { timezone: true },
      });
      const tz = org?.timezone ?? 'America/Sao_Paulo';
      const conds: Prisma.Sql[] = [
        Prisma.sql`opened_at >= (${filters.from}::date)::timestamp AT TIME ZONE ${tz}`,
        Prisma.sql`opened_at < (${filters.to}::date)::timestamp AT TIME ZONE ${tz}`,
      ];
      if (filters.status) conds.push(Prisma.sql`status = ${filters.status}`);
      if (filters.clientId) conds.push(Prisma.sql`client_id = ${filters.clientId}::uuid`);
      if (tenant.roleName === 'PROFESSIONAL') {
        conds.push(
          Prisma.sql`EXISTS (SELECT 1 FROM comanda_items i WHERE i.comanda_id = comandas.id AND i.professional_id = ${tenant.memberId}::uuid)`,
        );
      }
      const rows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM comandas WHERE ${Prisma.join(conds, ' AND ')} ORDER BY opened_at DESC LIMIT ${LIST_LIMIT}`,
      );
      return loadComandaViews(
        tx,
        rows.map((r) => r.id),
      );
    });
  }
}
