import { fromCents, parseMoneyInput } from "../common/money";
import { CASH_METHODS } from "../comandas/comanda-math";
import { openComandaTx } from "../comandas/comanda-open";
import {
  buildServiceItem,
  expandPackageItems,
  recalcComandaTotal,
} from "../comandas/comanda-items";
import type { TenantPrismaClient } from "../database/types";
import { recordCashMovement } from "../financial/cash-ledger";
import type { CashMethod } from "../financial/cash-ledger";
import { lockClient, recordCreditMovement } from "../financial/client-credit";
import { professionalServesCategory } from "../identity/member-categories";
import { parseAppointmentInterval } from "./appointments.service";
import {
  SchedulingError,
  acquireScheduleLocks,
  assertSlotFree,
} from "./scheduling-guard";

export const MAX_VISIT_ITEMS = 10;

export interface VisitItemInput {
  serviceId: string;
  serviceVariantId?: string | null;
  professionalId: string;
  startsAt: Date | string;
  endsAt: Date | string;
}

export interface CreateVisitInput {
  clientId: string;
  items: VisitItemInput[];
  packageId?: string | null;
  deposit?: { amount: string; method: string } | null;
  notes?: string | null;
  /** Visita de um grupo de noivas (04-08): finalidade e cobertura do contrato (D-08). */
  bridal?: {
    groupId: string;
    purpose: "event" | "trial";
    coverage?: {
      contractId: string;
      priceByServiceId: Record<string, string>;
    } | null;
  } | null;
}

/**
 * Visita = N agendamentos + 1 comanda aberta + itens de serviço + sinal opcional,
 * tudo na transação do chamador (`runWithTenant(..., SCHEDULE_TX_OPTIONS)`).
 * Qualquer erro lançado desfaz tudo (D-05, D-03).
 */
export async function createVisitTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  input: CreateVisitInput,
): Promise<{ appointmentIds: string[]; comandaId: string }> {
  const { items } = input;
  if (input.bridal && input.packageId) {
    throw new SchedulingError(
      "PACKAGE_NOT_ALLOWED",
      "Pacote não pode ser usado em visita de grupo de noivas.",
      "packageId",
    );
  }
  const coverage = input.bridal?.coverage ?? null;
  if (!items || items.length === 0) {
    throw new SchedulingError(
      "ITEMS_REQUIRED",
      "Inclua ao menos um serviço.",
      "items",
    );
  }
  if (items.length > MAX_VISIT_ITEMS) {
    throw new SchedulingError(
      "TOO_MANY_ITEMS",
      `Uma visita aceita no máximo ${MAX_VISIT_ITEMS} serviços.`,
      "items",
    );
  }
  const intervals = items.map((i) => {
    const interval = parseAppointmentInterval(i.startsAt, i.endsAt);
    if (!interval) {
      throw new SchedulingError(
        "INVALID_INTERVAL",
        "O fim do agendamento deve ser posterior ao início.",
        "endsAt",
      );
    }
    return interval;
  });

  let depositCents = 0;
  if (input.deposit) {
    const cents = parseMoneyInput(input.deposit.amount);
    if (cents === null || cents <= 0) {
      throw new SchedulingError(
        "INVALID_DEPOSIT",
        "Informe um valor de sinal maior que zero.",
        "deposit",
      );
    }
    if (!(CASH_METHODS as readonly string[]).includes(input.deposit.method)) {
      throw new SchedulingError(
        "INVALID_DEPOSIT_METHOD",
        "Forma de pagamento inválida para o sinal.",
        "deposit",
      );
    }
    depositCents = cents;
  }

  await acquireScheduleLocks(
    tx,
    orgId,
    items.map((i) => i.professionalId),
  );

  const client = await tx.client.findFirst({
    where: { id: input.clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) {
    throw new SchedulingError(
      "CLIENT_NOT_FOUND",
      "Cliente ativo não encontrado.",
      "clientId",
    );
  }

  const created: { id: string; item: VisitItemInput }[] = [];
  for (const [idx, item] of items.entries()) {
    const professional = await tx.member.findFirst({
      where: {
        id: item.professionalId,
        status: "active",
        deletedAt: null,
        isProfessional: true,
      },
      select: { id: true },
    });
    if (!professional) {
      throw new SchedulingError(
        "PROFESSIONAL_NOT_FOUND",
        "Profissional ativo não encontrado.",
        "professionalId",
      );
    }
    const service = await tx.service.findFirst({
      where: { id: item.serviceId, deletedAt: null },
      select: { id: true, categoryId: true },
    });
    if (!service) {
      throw new SchedulingError(
        "SERVICE_NOT_FOUND",
        "Serviço ativo não encontrado.",
        "serviceId",
      );
    }
    if (
      !(await professionalServesCategory(
        tx,
        item.professionalId,
        service.categoryId,
      ))
    ) {
      throw new SchedulingError(
        "PROFESSIONAL_DOES_NOT_SERVE_CATEGORY",
        "Este profissional não atende a categoria deste serviço.",
        "professionalId",
      );
    }
    if (item.serviceVariantId) {
      const variant = await tx.servicePricingVariant.findFirst({
        where: { id: item.serviceVariantId, serviceId: item.serviceId },
        select: { id: true },
      });
      if (!variant) {
        throw new SchedulingError(
          "VARIANT_NOT_FOUND",
          "Variante de preço não encontrada para este serviço.",
          "serviceVariantId",
        );
      }
    }
    await assertSlotFree(tx, {
      professionalId: item.professionalId,
      startsAt: intervals[idx].startsAt,
      endsAt: intervals[idx].endsAt,
    });
    const appointment = await tx.appointment.create({
      data: {
        organizationId: orgId,
        professionalId: item.professionalId,
        clientId: input.clientId,
        serviceId: item.serviceId,
        serviceVariantId: item.serviceVariantId ?? null,
        startsAt: intervals[idx].startsAt,
        endsAt: intervals[idx].endsAt,
        notes: input.notes ?? null,
        ...(input.bridal
          ? {
              bridalGroupId: input.bridal.groupId,
              purpose: input.bridal.purpose,
              contractId:
                coverage && item.serviceId in coverage.priceByServiceId
                  ? coverage.contractId
                  : null,
            }
          : {}),
      },
      select: { id: true },
    });
    created.push({ id: appointment.id, item });
  }
  const ids = created.map((c) => c.id);

  const comanda = await openComandaTx(tx, {
    orgId,
    clientId: input.clientId,
    openedBy: memberId,
  });
  await tx.appointment.updateMany({
    where: { id: { in: ids } },
    data: { comandaId: comanda.id },
  });

  if (input.packageId) {
    const pkg = await tx.package.findFirst({
      where: { id: input.packageId, deletedAt: null },
      select: { services: { select: { serviceId: true } } },
    });
    if (!pkg) {
      throw new SchedulingError(
        "PACKAGE_NOT_FOUND",
        "Pacote não encontrado.",
        "packageId",
      );
    }
    const inPackage = new Set(pkg.services.map((s) => s.serviceId));
    for (const c of created) {
      if (!inPackage.has(c.item.serviceId)) {
        throw new SchedulingError(
          "SERVICE_NOT_IN_PACKAGE",
          "Há serviço na visita que não faz parte do pacote.",
          "items",
        );
      }
    }
    const firstByService = new Map<string, (typeof created)[number]>();
    for (const c of created) {
      if (!firstByService.has(c.item.serviceId)) {
        firstByService.set(c.item.serviceId, c);
      }
    }
    const expanded = await expandPackageItems(tx, {
      orgId,
      comandaId: comanda.id,
      packageId: input.packageId,
      assignments: [...firstByService.values()].map((c) => ({
        serviceId: c.item.serviceId,
        professionalId: c.item.professionalId,
        serviceVariantId: c.item.serviceVariantId ?? null,
        appointmentId: c.id,
      })),
      createdBy: memberId,
    });
    // Unidades extras do mesmo serviço ficam sem agendamento (D-23 no fechamento).
    const seen = new Set<string>();
    for (const row of expanded) {
      const key = row.serviceId as string;
      if (seen.has(key)) row.appointmentId = null;
      seen.add(key);
    }
    await tx.comandaItem.createMany({ data: expanded });
  } else {
    const rows = [];
    for (const c of created) {
      const row = await buildServiceItem(tx, {
        orgId,
        comandaId: comanda.id,
        serviceId: c.item.serviceId,
        serviceVariantId: c.item.serviceVariantId ?? null,
        professionalId: c.item.professionalId,
        quantity: 1,
        appointmentId: c.id,
        createdBy: memberId,
      });
      const agreed = coverage?.priceByServiceId[c.item.serviceId];
      if (coverage && agreed !== undefined) {
        // Preço acordado no contrato; listUnitPrice segue o catálogo (comissão cheia — D-08).
        row.contractId = coverage.contractId;
        row.unitPrice = agreed;
        row.total = agreed;
      }
      rows.push(row);
    }
    await tx.comandaItem.createMany({ data: rows });
  }
  await recalcComandaTotal(tx, comanda.id);

  if (input.deposit && depositCents > 0) {
    await lockClient(tx, input.clientId);
    await recordCreditMovement(tx, {
      orgId,
      clientId: input.clientId,
      amountCents: depositCents,
      kind: "deposit",
      appointmentId: ids[0],
      comandaId: comanda.id,
      createdBy: memberId,
    });
    await recordCashMovement(tx, {
      orgId,
      kind: "deposit_in",
      method: input.deposit.method as CashMethod,
      amountCents: depositCents,
      appointmentId: ids[0],
      comandaId: comanda.id,
      clientId: input.clientId,
      memberId,
      occurredAt: new Date(),
    });
    await tx.appointment.update({
      where: { id: ids[0] },
      data: { depositAmount: fromCents(depositCents) },
    });
  }

  return { appointmentIds: ids, comandaId: comanda.id };
}
