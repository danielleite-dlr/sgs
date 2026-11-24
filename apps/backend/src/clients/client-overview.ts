import type { Prisma } from '@prisma/client';
import { fromCents, toCents } from '../common/money';
import type { TenantPrismaClient } from '../database/types';
import { loadContractViews } from '../contracts/contract-serialize';
import { getCreditBalanceCents } from '../financial/client-credit';

const UPCOMING_LIMIT = 10;
const HISTORY_LIMIT = 200;
const OPEN_STATUSES = ['scheduled', 'confirmed', 'in_progress'];

export interface ClientHistoryFiltersInput {
  fromDate?: Date;
  toDate?: Date;
  professionalId?: string;
  kind?: string;
}

export interface ClientHistoryRow {
  id: string;
  occurredAt: Date;
  kind: string;
  description: string;
  amount: string | null;
  professionalName: string | null;
  entityType: string;
  entityId: string;
}

/** Papel da cliente no grupo: noiva/debutante, acompanhante ou responsável (debutante). */
function roleInGroup(
  memberRole: string | null,
  eventKind: string,
  isResponsible: boolean,
): 'bride' | 'debutante' | 'companion' | 'responsible' {
  if (memberRole === 'bride') return eventKind === 'debutante' ? 'debutante' : 'bride';
  if (memberRole === 'companion') return 'companion';
  return isResponsible ? 'responsible' : 'companion';
}

const uniq = <T>(values: T[]): T[] => [...new Set(values)];

/** Serviços e profissionais distintos dos itens de uma comanda. */
function comandaNames(items: { nameSnapshot: string; professional: { displayName: string } }[]) {
  return {
    serviceNames: uniq(items.map((i) => i.nameSnapshot)),
    professionalNames: uniq(items.map((i) => i.professional.displayName)),
  };
}

/** Visão geral da cliente: grupos de noiva, contratos, próximos atendimentos e números. */
export async function loadClientOverview(tx: TenantPrismaClient, orgId: string, clientId: string) {
  const client = await tx.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) return null;

  const groups = await tx.bridalGroup.findMany({
    where: {
      OR: [{ members: { some: { clientId } } }, { responsibleClientId: clientId }],
    },
    include: { members: { where: { clientId }, select: { role: true } } },
    orderBy: { eventDate: 'desc' },
  });
  const groupIds = groups.map((g) => g.id);

  const trials = groupIds.length
    ? await tx.appointment.findMany({
        where: {
          clientId,
          bridalGroupId: { in: groupIds },
          purpose: 'trial',
          status: { notIn: ['cancelled', 'no_show'] },
        },
        select: { bridalGroupId: true, startsAt: true },
        orderBy: { startsAt: 'asc' },
      })
    : [];

  // O contrato do grupo só aparece para quem é parte dele: a noiva/debutante e a responsável
  // da debutante. Acompanhante não vê o contrato da noiva (relato da ficha da Edna); só vê
  // contratos em que consta como noiva/contratante (dois primeiros ramos do OR).
  const contractGroupIds = groups
    .filter((g) => g.members[0]?.role === 'bride' || g.responsibleClientId === clientId)
    .map((g) => g.id);
  const contractViews = await loadContractViews(tx, orgId, {
    OR: [
      { brideClientId: clientId },
      { contractorClientId: clientId },
      ...(contractGroupIds.length ? [{ bridalGroupId: { in: contractGroupIds } }] : []),
    ],
  });

  const now = new Date();
  const upcoming = await tx.appointment.findMany({
    where: { clientId, status: { in: OPEN_STATUSES }, endsAt: { gte: now } },
    include: {
      service: { select: { name: true } },
      professional: { select: { displayName: true } },
    },
    orderBy: { startsAt: 'asc' },
    take: UPCOMING_LIMIT,
  });

  const [completed, lastVisit, spent, credit, openComandas] = await Promise.all([
    tx.appointment.count({ where: { clientId, status: 'completed' } }),
    tx.appointment.findFirst({
      where: { clientId, status: 'completed' },
      orderBy: { startsAt: 'desc' },
      select: { startsAt: true },
    }),
    tx.comanda.aggregate({
      where: { clientId, status: 'closed' },
      _sum: { total: true },
    }),
    getCreditBalanceCents(tx, clientId),
    tx.comanda.findMany({
      where: { clientId, status: 'open' },
      include: {
        items: {
          select: {
            nameSnapshot: true,
            professional: { select: { displayName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        appointments: {
          select: { startsAt: true },
          orderBy: { startsAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { openedAt: 'desc' },
    }),
  ]);

  return {
    bridalGroups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      eventKind: g.eventKind,
      role: roleInGroup(
        g.members[0]?.role ?? null,
        g.eventKind,
        g.responsibleClientId === clientId,
      ),
      eventDate: g.eventDate.toISOString().slice(0, 10),
      eventTime: g.eventTime,
      status: g.status,
      trialDates: trials.filter((t) => t.bridalGroupId === g.id).map((t) => t.startsAt),
    })),
    contracts: contractViews.map((c) => {
      const next = c.installments.find((i) => Number(i.pendingAmount) > 0);
      return {
        id: c.id,
        code: c.code,
        status: c.status,
        groupId: c.groupId,
        groupName: c.groupName,
        totalAmount: c.totalAmount,
        paid: c.paid,
        balance: c.balance,
        nextDueDate: next?.dueDate ?? null,
        nextDueAmount: next?.pendingAmount ?? null,
      };
    }),
    upcomingAppointments: upcoming.map((a) => ({
      id: a.id,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      status: a.status,
      serviceName: a.service.name,
      professionalName: a.professional.displayName,
      kind: a.purpose === 'trial' ? 'trial' : a.bridalGroupId ? 'event' : 'normal',
      comandaId: a.comandaId,
      bridalGroupId: a.bridalGroupId,
    })),
    openComandas: openComandas.map((c) => ({
      id: c.id,
      code: c.code,
      openedAt: c.openedAt,
      firstAppointmentAt: c.appointments[0]?.startsAt ?? null,
      total: fromCents(toCents(c.total)),
      ...comandaNames(c.items),
    })),
    stats: {
      completedCount: completed,
      lastVisitAt: lastVisit?.startsAt ?? null,
      totalSpent: fromCents(toCents(spent._sum.total ?? 0)),
      creditBalance: fromCents(credit),
    },
  };
}

const APPT_LABEL: Record<string, string> = {
  completed: 'Atendimento concluído',
  no_show: 'Não compareceu',
  cancelled: 'Agendamento cancelado',
  scheduled: 'Atendimento em aberto',
  confirmed: 'Atendimento em aberto',
  in_progress: 'Atendimento em aberto',
};

/**
 * Histórico da cliente (mais recente primeiro, limite 200). Inclui o que já aconteceu mesmo sem
 * conclusão: comandas abertas e atendimentos passados ainda scheduled/confirmed/in_progress
 * (rótulo "Atendimento em aberto"). Comandas canceladas nunca entram.
 */
export async function loadClientHistory(
  tx: TenantPrismaClient,
  clientId: string,
  filters: ClientHistoryFiltersInput = {},
): Promise<ClientHistoryRow[]> {
  const client = await tx.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) return [];

  const kind = filters.kind ?? 'all';
  const range = () =>
    filters.fromDate || filters.toDate
      ? {
          gte: filters.fromDate,
          lte: filters.toDate,
        }
      : undefined;
  const rows: ClientHistoryRow[] = [];

  if (kind === 'all' || kind === 'appointment') {
    const appts = await tx.appointment.findMany({
      where: {
        clientId,
        OR: [
          { status: { in: ['completed', 'no_show', 'cancelled'] } },
          { status: { in: OPEN_STATUSES }, startsAt: { lt: new Date() } },
        ],
        ...(filters.professionalId ? { professionalId: filters.professionalId } : {}),
        ...(range() ? { AND: [{ startsAt: range() }] } : {}),
      },
      include: {
        service: { select: { name: true } },
        professional: { select: { displayName: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    for (const a of appts) {
      const prefix = a.purpose === 'trial' ? 'Teste: ' : a.bridalGroupId ? 'Dia do evento: ' : '';
      rows.push({
        id: a.id,
        occurredAt: a.startsAt,
        kind: 'appointment',
        description: `${APPT_LABEL[a.status] ?? a.status} — ${prefix}${a.service.name}`,
        amount: null,
        professionalName: a.professional.displayName,
        entityType: 'appointment',
        entityId: a.id,
      });
    }
  }

  if (kind === 'all' || kind === 'comanda') {
    const where: Prisma.ComandaWhereInput = {
      clientId,
      OR: [
        { status: 'closed', closedAt: range() ?? { not: null } },
        { status: 'open', openedAt: range() },
      ],
      ...(filters.professionalId
        ? { items: { some: { professionalId: filters.professionalId } } }
        : {}),
    };
    const comandas = await tx.comanda.findMany({
      where,
      include: {
        items: {
          select: {
            nameSnapshot: true,
            professional: { select: { displayName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        appointments: {
          select: { startsAt: true },
          orderBy: { startsAt: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ closedAt: { sort: 'desc', nulls: 'last' } }, { openedAt: 'desc' }],
      take: HISTORY_LIMIT,
    });
    for (const c of comandas) {
      const { serviceNames: names, professionalNames: pros } = comandaNames(c.items);
      const isOpen = c.status === 'open';
      rows.push({
        id: c.id,
        occurredAt: isOpen ? (c.appointments[0]?.startsAt ?? c.openedAt) : (c.closedAt as Date),
        kind: 'comanda',
        description: `Comanda ${c.code}${isOpen ? ' (aberta)' : ''}${names.length ? ` — ${names.join(', ')}` : ''}`,
        amount: fromCents(toCents(c.total)),
        professionalName: pros.length ? pros.join(', ') : null,
        entityType: 'comanda',
        entityId: c.id,
      });
    }
  }

  if (kind === 'product') {
    const items = await tx.comandaItem.findMany({
      where: {
        kind: 'product',
        comanda: {
          clientId,
          status: 'closed',
          closedAt: range() ?? { not: null },
        },
        ...(filters.professionalId ? { professionalId: filters.professionalId } : {}),
      },
      include: {
        comanda: { select: { id: true, code: true, closedAt: true } },
        professional: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    for (const i of items) {
      rows.push({
        id: i.id,
        occurredAt: i.comanda.closedAt ?? i.createdAt,
        kind: 'product',
        description: `${i.nameSnapshot} (x${i.quantity}) — comanda ${i.comanda.code}`,
        amount: fromCents(toCents(i.total)),
        professionalName: i.professional.displayName,
        entityType: 'comanda',
        entityId: i.comanda.id,
      });
    }
  }

  if (kind === 'all' && !filters.professionalId) {
    const payments = await tx.contractPayment.findMany({
      where: {
        contract: {
          OR: [{ brideClientId: clientId }, { contractorClientId: clientId }],
        },
        paidAt: range(),
      },
      include: { contract: { select: { code: true } } },
      orderBy: { paidAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    for (const p of payments) {
      const estorno = p.reversesPaymentId != null;
      rows.push({
        id: p.id,
        occurredAt: p.paidAt,
        kind: 'contract_payment',
        description: `${estorno ? 'Estorno de pagamento' : 'Pagamento'} do contrato ${p.contract.code}`,
        amount: fromCents(toCents(p.amount)),
        professionalName: null,
        entityType: 'contract',
        entityId: p.contractId,
      });
    }
  }

  rows.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return rows.slice(0, HISTORY_LIMIT);
}
