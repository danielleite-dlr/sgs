import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { fromCents, toCents } from '../common/money';
import type { TenantPrismaClient } from '../database/types';
import { loadEffectiveSettings } from './contract-settings.service';
import { allocateInstallments, computeContractStatus } from './domain/contract-math';
import { maskCpf } from './domain/contract-template';

export const CONTRACT_INCLUDE = {
  group: { select: { name: true, eventDate: true, eventKind: true } },
  bride: { select: { fullName: true } },
  contractor: { select: { fullName: true } },
  package: { select: { name: true } },
  installments: { orderBy: { seq: 'asc' } },
  items: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { member: { include: { client: { select: { fullName: true } } } } },
  },
  payments: { orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] },
  versions: { orderBy: { version: 'desc' }, take: 1 },
  accessTokens: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
  acceptances: {
    orderBy: { acceptedAt: 'desc' },
    take: 1,
    include: { version: { select: { version: true } } },
  },
} satisfies Prisma.ContractInclude;

type ContractRow = Prisma.ContractGetPayload<{ include: typeof CONTRACT_INCLUDE }>;

export const DERIVED_FILTERS = ['deposit_pending', 'due_soon', 'overdue', 'settled'] as const;
export type DerivedFilter = (typeof DERIVED_FILTERS)[number];

const money = (v: Prisma.Decimal | string | number) => fromCents(toCents(v));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Data local (YYYY-MM-DD) de um instante no fuso da organização. */
export function localDate(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function serialize(c: ContractRow, timezone: string, today: string, depositUnpaidDays: number) {
  const paymentsCents = c.payments.map((p) => toCents(p.amount));
  const st = computeContractStatus({
    status: c.status,
    totalCents: toCents(c.totalAmount),
    depositCents: toCents(c.depositAmount),
    paymentsCents,
    balanceDueDate: isoDate(c.balanceDueDate),
    today,
    depositReferenceDate: localDate(c.acceptedAt ?? c.createdAt, timezone),
    depositUnpaidDays,
  });
  const installments = allocateInstallments(
    c.installments.map((i) => ({ seq: i.seq, dueDate: isoDate(i.dueDate), cents: toCents(i.amount) })),
    st.paidCents,
    today,
  );
  const reversedIds = new Set(c.payments.map((p) => p.reversesPaymentId).filter(Boolean));
  const version = c.versions[0];
  const token = c.accessTokens[0];
  const acc = c.acceptances[0];
  return {
    id: c.id,
    code: c.code,
    status: c.status,
    groupId: c.bridalGroupId,
    groupName: c.group.name,
    eventDate: isoDate(c.group.eventDate),
    brideClientId: c.brideClientId,
    brideName: c.bride.fullName,
    eventKind: c.group.eventKind,
    contractorClientId: c.contractorClientId ?? c.brideClientId,
    contractorName: c.contractor?.fullName ?? c.bride.fullName,
    paymentMode: c.paymentMode,
    discountDescription: c.discountDescription,
    packageName: c.package?.name ?? null,
    installments: installments.map((i) => ({
      seq: i.seq,
      dueDate: i.dueDate,
      amount: fromCents(i.cents),
      paidAmount: fromCents(i.paidCents),
      pendingAmount: fromCents(i.pendingCents),
      state: i.state,
      overdue: i.overdue,
    })),
    packageId: c.packageId,
    itemsTotal: money(c.itemsTotal),
    discountAmount: money(c.discountAmount),
    totalAmount: money(c.totalAmount),
    depositAmount: money(c.depositAmount),
    balanceDueDaysBefore: c.balanceDueDaysBefore,
    balanceDueDate: isoDate(c.balanceDueDate),
    paid: fromCents(st.paidCents),
    balance: fromCents(st.balanceCents),
    depositPaid: fromCents(st.depositPaidCents),
    depositPending: fromCents(st.depositPendingCents),
    settled: st.settled,
    daysToBalanceDue: st.daysToBalanceDue,
    balanceDueSoon: st.balanceDueSoon,
    balanceOverdue: st.balanceOverdue,
    depositOverdue: c.paymentMode === 'a_vista' ? false : st.depositOverdue,
    cancellationPolicy: c.cancellationPolicy,
    currentVersion: c.currentVersion,
    acceptedVersion: c.acceptedVersion,
    needsAcceptance: c.acceptedVersion !== c.currentVersion,
    linkGeneratedAt: c.linkGeneratedAt,
    linkExpiresAt: token?.expiresAt ?? null,
    acceptedAt: c.acceptedAt,
    acceptance: acc
      ? {
          acceptedName: acc.acceptedName,
          acceptedCpfMasked: maskCpf(acc.acceptedCpf),
          acceptedAt: acc.acceptedAt,
          ip: acc.ip,
          textSha256: acc.textSha256,
          version: acc.version.version,
        }
      : null,
    currentText: version?.renderedText ?? '',
    currentTextSha256: version?.textSha256 ?? '',
    currentSnapshotFormat: version?.snapshotFormat ?? 1,
    items: c.items.map((it) => ({
      id: it.id,
      groupMemberId: it.groupMemberId,
      personName: it.member.client.fullName,
      serviceId: it.serviceId,
      packageId: it.packageId,
      description: it.descriptionSnapshot,
      quantity: it.quantity,
      unitPrice: money(it.unitPrice),
      total: money(it.total),
      purpose: it.purpose,
      settledAtEvent: it.settledAtEvent,
      isPackageItem: it.packageId != null,
    })),
    payments: c.payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      method: p.method,
      amount: money(p.amount),
      paidAt: p.paidAt,
      memberId: p.memberId,
      reversesPaymentId: p.reversesPaymentId,
      reversed: reversedIds.has(p.id),
      note: p.note,
    })),
    cancelledAt: c.cancelledAt,
    cancelReason: c.cancelReason,
    cancelledByParty: c.cancelledByParty,
    createdAt: c.createdAt,
  };
}

export type ContractView = ReturnType<typeof serialize>;

function matchesDerived(v: ContractView, derived: DerivedFilter): boolean {
  switch (derived) {
    case 'deposit_pending':
      return v.status !== 'cancelled' && toCents(v.depositPending) > 0;
    case 'due_soon':
      return v.balanceDueSoon;
    case 'overdue':
      return v.balanceOverdue;
    case 'settled':
      return v.status !== 'cancelled' && v.settled;
  }
}

export async function loadContractViews(
  tx: TenantPrismaClient,
  orgId: string,
  where: Prisma.ContractWhereInput = {},
  derived?: string | null,
): Promise<ContractView[]> {
  if (derived != null && !(DERIVED_FILTERS as readonly string[]).includes(derived)) {
    throw new BadRequestException(`Filtro derivado inválido: ${derived}.`);
  }
  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  const timezone = org?.timezone ?? 'America/Sao_Paulo';
  const today = localDate(new Date(), timezone);
  const settings = await loadEffectiveSettings(tx, orgId);
  const rows = await tx.contract.findMany({
    where,
    include: CONTRACT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  const views = rows.map((r) => serialize(r, timezone, today, settings.alertDepositUnpaidDays));
  return derived ? views.filter((v) => matchesDerived(v, derived as DerivedFilter)) : views;
}

export async function loadContractView(
  tx: TenantPrismaClient,
  orgId: string,
  id: string,
): Promise<ContractView | null> {
  return (await loadContractViews(tx, orgId, { id }))[0] ?? null;
}
