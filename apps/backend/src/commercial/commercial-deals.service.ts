import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { isManagerRole, visibilityWhere, type CommercialViewer } from './commercial-access';
import { isCommercialSource, isDealKind, isLostReason } from './commercial-constants';
import { CommercialError, mapCommercialError, type CommercialUserError } from './commercial-errors';
import { isDealOverdue, overdueSince } from './commercial-sla';
import { ensureDefaultStagesTx } from './commercial-stages.service';

export interface CommercialDealFilterDto {
  stageId?: string | null;
  status?: string | null;
  kind?: string | null;
  leadId?: string | null;
  assigneeMemberId?: string | null;
  unassigned?: boolean | null;
  closedSinceDays?: number | null;
  limit?: number | null;
  offset?: number | null;
}

export interface CreateCommercialDealDto {
  leadId: string;
  kind: string;
  stageId?: string | null;
  eventDate?: string | null;
  beneficiaryName?: string | null;
  packageId?: string | null;
  discountAmount?: string | null;
  assigneeMemberId?: string | null;
  source?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface UpdateCommercialDealDto {
  id: string;
  kind?: string | null;
  eventDate?: string | null;
  beneficiaryName?: string | null;
  packageId?: string | null;
  discountAmount?: string | null;
  source?: string | null;
  location?: string | null;
  notes?: string | null;
}

const DEAL_INCLUDE = {
  stage: true,
  lead: { select: { id: true, fullName: true, phone: true, email: true } },
  assignee: { select: { id: true, displayName: true, role: { select: { name: true } } } },
  package: { select: { id: true, name: true, price: true } },
} satisfies Prisma.CommercialDealInclude;

type DealRow = Prisma.CommercialDealGetPayload<{ include: typeof DEAL_INCLUDE }>;

const DAY_MS = 86_400_000;

const notFound = () => new CommercialError('NOT_FOUND', 'Negócio não encontrado.', 'id');

const cents = (d: Prisma.Decimal | string): number => Math.round(Number(d) * 100);
const money = (c: number): string => (c / 100).toFixed(2);

/** "50", "50.5", "50,25" -> centavos inteiros; null se inválido. */
function parseMoneyCents(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim();
  if (t === '') return 0;
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}

function cleanText(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

function parseEventDate(v: string | null | undefined): Date | null {
  const t = (v ?? '').trim();
  if (t === '') return null;
  const bad = () =>
    new CommercialError('EVENT_DATE_INVALID', 'Data do evento inválida.', 'eventDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw bad();
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) throw bad();
  return d;
}

function validateKind(kind: string | null | undefined): string {
  if (!isDealKind(kind)) {
    throw new CommercialError('KIND_INVALID', 'Tipo de negócio inválido.', 'kind');
  }
  return kind;
}

function validateSource(source: string | null | undefined, fallback: string): string {
  if (source === null || source === undefined || source === '') return fallback;
  if (!isCommercialSource(source)) {
    throw new CommercialError('SOURCE_INVALID', 'Origem inválida.', 'source');
  }
  return source;
}

function validateLengths(beneficiary: string | null, location: string | null) {
  if (beneficiary !== null && beneficiary.length > 255) {
    throw new CommercialError(
      'BENEFICIARY_TOO_LONG',
      'Nome da noiva/debutante: até 255 caracteres.',
      'beneficiaryName',
    );
  }
  if (location !== null && location.length > 255) {
    throw new CommercialError('LOCATION_TOO_LONG', 'Local: até 255 caracteres.', 'location');
  }
}

/** Valor final em centavos (ou null sem pacote); desconto não pode passar do preço. */
function computeFinal(priceCents: number | null, discountCents: number | null): number | null {
  if (discountCents === null) {
    throw new CommercialError('DISCOUNT_INVALID', 'Desconto inválido.', 'discountAmount');
  }
  if (priceCents === null) {
    if (discountCents > 0) {
      throw new CommercialError(
        'DISCOUNT_INVALID',
        'Escolha um pacote antes de dar desconto.',
        'discountAmount',
      );
    }
    return null;
  }
  if (discountCents > priceCents) {
    throw new CommercialError(
      'DISCOUNT_INVALID',
      'O desconto não pode ser maior que o preço do pacote.',
      'discountAmount',
    );
  }
  return priceCents - discountCents;
}

@Injectable()
export class CommercialDealsService {
  constructor(private readonly tenant: TenantContextService) {}

  private fail<T extends object>(e: unknown, empty: T): T & { errors: CommercialUserError[] } {
    const m = mapCommercialError(e);
    if (!m) throw e;
    return { ...empty, errors: [m] };
  }

  private dealVis(viewer: CommercialViewer): Prisma.CommercialDealWhereInput {
    return visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput;
  }

  private leadVis(viewer: CommercialViewer): Prisma.CommercialLeadWhereInput {
    return visibilityWhere(viewer).lead as Prisma.CommercialLeadWhereInput;
  }

  private serialize(r: DealRow, openByStage: Map<string, number>, now: Date) {
    const sla = {
      status: r.status as 'open' | 'won' | 'lost',
      slaDays: r.stage.slaDays,
      lastInteractionAt: r.lastInteractionAt,
      stageEnteredAt: r.stageEnteredAt,
    };
    return {
      id: r.id,
      leadId: r.leadId,
      lead: r.lead,
      stage: {
        id: r.stage.id,
        name: r.stage.name,
        color: r.stage.color,
        position: r.stage.position,
        slaDays: r.stage.slaDays,
        kind: r.stage.kind,
        isSystem: r.stage.isSystem,
        openDeals: openByStage.get(r.stage.id) ?? 0,
      },
      status: r.status,
      kind: r.kind,
      beneficiaryName: r.beneficiaryName,
      eventDate: r.eventDate ? r.eventDate.toISOString().slice(0, 10) : null,
      package: r.package
        ? { id: r.package.id, name: r.package.name, price: r.package.price.toFixed(2) }
        : null,
      packageName: r.packageName,
      packagePrice: r.packagePrice ? r.packagePrice.toFixed(2) : null,
      discountAmount: r.discountAmount.toFixed(2),
      finalAmount: r.finalAmount ? r.finalAmount.toFixed(2) : null,
      assignee: r.assignee
        ? { id: r.assignee.id, displayName: r.assignee.displayName, roleName: r.assignee.role.name }
        : null,
      source: r.source,
      location: r.location,
      notes: r.notes,
      stageEnteredAt: r.stageEnteredAt,
      lastInteractionAt: r.lastInteractionAt,
      overdue: isDealOverdue(sla, now),
      overdueSince: overdueSince(sla),
      lostReasonCode: r.lostReasonCode,
      lostReasonText: r.lostReasonText,
      closedAt: r.closedAt,
      wonContractId: r.wonContractId,
      createdAt: r.createdAt,
    };
  }

  private async hydrate(tx: TenantPrismaClient, viewer: CommercialViewer, rows: DealRow[]) {
    if (rows.length === 0) return [];
    const counts = await tx.commercialDeal.groupBy({
      by: ['stageId'],
      where: {
        status: 'open',
        stageId: { in: [...new Set(rows.map((r) => r.stageId))] },
        ...(visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput),
      },
      _count: { _all: true },
    });
    const byStage = new Map(counts.map((c) => [c.stageId, c._count._all]));
    const now = new Date();
    return rows.map((r) => this.serialize(r, byStage, now));
  }

  private async oneTx(tx: TenantPrismaClient, viewer: CommercialViewer, id: string) {
    const row = await tx.commercialDeal.findFirst({
      where: { id, ...(visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput) },
      include: DEAL_INCLUDE,
    });
    return row ? (await this.hydrate(tx, viewer, [row]))[0] : null;
  }

  /** Negócio visível ou NOT_FOUND. */
  private async requireDeal(tx: TenantPrismaClient, viewer: CommercialViewer, id: string) {
    const cur = await tx.commercialDeal.findFirst({ where: { id, ...this.dealVis(viewer) } });
    if (!cur) throw notFound();
    return cur;
  }

  private async openStage(tx: TenantPrismaClient, orgId: string, stageId?: string | null) {
    await ensureDefaultStagesTx(tx, orgId);
    if (stageId) {
      const s = await tx.commercialStage.findFirst({ where: { id: stageId } });
      if (!s) throw new CommercialError('NOT_FOUND', 'Etapa não encontrada.', 'stageId');
      if (s.kind !== 'open') {
        throw new CommercialError(
          'STAGE_SYSTEM',
          'Ganho e Perdido só pelos fluxos próprios.',
          'stageId',
        );
      }
      return s;
    }
    const first = await tx.commercialStage.findFirst({
      where: { kind: 'open' },
      orderBy: { position: 'asc' },
    });
    if (!first) throw new CommercialError('NOT_FOUND', 'Nenhuma etapa aberta.', 'stageId');
    return first;
  }

  /** Responsável válido (D-14): membro ativo ADMIN/MANAGER/ATTENDANT. */
  private async assertAssignee(tx: TenantPrismaClient, orgId: string, memberId: string) {
    const m = await tx.member.findFirst({
      where: {
        id: memberId,
        organizationId: orgId,
        status: 'active',
        deletedAt: null,
        role: { name: { in: ['ADMIN', 'MANAGER', 'ATTENDANT'] } },
      },
      select: { id: true },
    });
    if (!m) {
      throw new CommercialError(
        'ASSIGNEE_INVALID',
        'Responsável inválido para o Comercial.',
        'assigneeMemberId',
      );
    }
  }

  private async loadPackage(tx: TenantPrismaClient, packageId: string) {
    const p = await tx.package.findFirst({
      where: { id: packageId, deletedAt: null },
      select: { id: true, name: true, price: true },
    });
    if (!p) throw new CommercialError('NOT_FOUND', 'Pacote não encontrado.', 'packageId');
    return p;
  }

  async list(orgId: string, viewer: CommercialViewer, filter?: CommercialDealFilterDto | null) {
    const f = filter ?? {};
    const limit = Math.min(Math.max(f.limit ?? 200, 1), 500);
    const offset = Math.max(f.offset ?? 0, 0);
    const and: Prisma.CommercialDealWhereInput[] = [
      visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput,
    ];
    if (f.status) {
      and.push({ status: f.status });
    } else {
      const since = new Date(Date.now() - Math.max(f.closedSinceDays ?? 30, 0) * DAY_MS);
      and.push({
        OR: [{ status: 'open' }, { status: { in: ['won', 'lost'] }, closedAt: { gte: since } }],
      });
    }
    if (f.stageId) and.push({ stageId: f.stageId });
    if (f.kind) and.push({ kind: f.kind });
    if (f.leadId) and.push({ leadId: f.leadId });
    if (f.assigneeMemberId) and.push({ assigneeMemberId: f.assigneeMemberId });
    if (f.unassigned) and.push({ assigneeMemberId: null });
    const where: Prisma.CommercialDealWhereInput = { organizationId: orgId, AND: and };
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const [total, rows] = await Promise.all([
        tx.commercialDeal.count({ where }),
        tx.commercialDeal.findMany({
          where,
          include: DEAL_INCLUDE,
          orderBy: [{ stageEnteredAt: 'desc' }, { id: 'desc' }],
          take: limit,
          skip: offset,
        }),
      ]);
      return { items: await this.hydrate(tx, viewer, rows), total };
    });
  }

  get(orgId: string, viewer: CommercialViewer, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) => this.oneTx(tx, viewer, id));
  }

  /** Negócios visíveis de um lead (campo CommercialLead.deals). */
  dealsOfLead(orgId: string, viewer: CommercialViewer, leadId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const rows = await tx.commercialDeal.findMany({
        where: { leadId, ...this.dealVis(viewer) },
        include: DEAL_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return this.hydrate(tx, viewer, rows);
    });
  }

  async create(orgId: string, viewer: CommercialViewer, input: CreateCommercialDealDto) {
    try {
      const kind = validateKind(input.kind);
      const eventDate = parseEventDate(input.eventDate);
      const beneficiaryName = cleanText(input.beneficiaryName);
      const location = cleanText(input.location);
      validateLengths(beneficiaryName, location);
      const discount = parseMoneyCents(input.discountAmount);
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const lead = await tx.commercialLead.findFirst({
          where: { id: input.leadId, ...this.leadVis(viewer) },
        });
        if (!lead) throw new CommercialError('NOT_FOUND', 'Lead não encontrado.', 'leadId');
        const stage = await this.openStage(tx, orgId, input.stageId);
        const source = validateSource(input.source, lead.source);

        // D-13/D-14: atendente é sempre a responsável; gestão escolhe ou deixa sem
        let assigneeMemberId: string | null = null;
        if (viewer.roleName === 'ATTENDANT') {
          assigneeMemberId = viewer.memberId;
        } else if (input.assigneeMemberId) {
          await this.assertAssignee(tx, orgId, input.assigneeMemberId);
          assigneeMemberId = input.assigneeMemberId;
        }

        let pkg: Awaited<ReturnType<CommercialDealsService['loadPackage']>> | null = null;
        if (input.packageId) pkg = await this.loadPackage(tx, input.packageId);
        const final = computeFinal(pkg ? cents(pkg.price) : null, discount);

        const row = await tx.commercialDeal.create({
          data: {
            organizationId: orgId,
            leadId: lead.id,
            stageId: stage.id,
            kind,
            eventDate,
            beneficiaryName,
            packageId: pkg?.id ?? null,
            packageName: pkg ? pkg.name.slice(0, 160) : null,
            packagePrice: pkg ? money(cents(pkg.price)) : null,
            discountAmount: money(discount ?? 0),
            finalAmount: final === null ? null : money(final),
            assigneeMemberId,
            source,
            location,
            notes: cleanText(input.notes),
            createdBy: viewer.memberId,
          },
        });
        return { deal: await this.oneTx(tx, viewer, row.id), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { deal: null });
    }
  }

  async update(orgId: string, viewer: CommercialViewer, input: UpdateCommercialDealDto) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await this.requireDeal(tx, viewer, input.id);
        if (cur.status !== 'open') {
          throw new CommercialError('DEAL_CLOSED', 'Negócio já fechado.', 'id');
        }
        const data: Prisma.CommercialDealUncheckedUpdateInput = {};
        if (input.kind !== undefined) data.kind = validateKind(input.kind);
        if (input.eventDate !== undefined) data.eventDate = parseEventDate(input.eventDate);
        const beneficiary =
          input.beneficiaryName === undefined
            ? cur.beneficiaryName
            : cleanText(input.beneficiaryName);
        const location = input.location === undefined ? cur.location : cleanText(input.location);
        validateLengths(beneficiary, location);
        data.beneficiaryName = beneficiary;
        data.location = location;
        if (input.notes !== undefined) data.notes = cleanText(input.notes);
        if (input.source !== undefined) data.source = validateSource(input.source, cur.source);

        // pacote e desconto sempre recalculados em conjunto
        let packageId = cur.packageId;
        let packageName = cur.packageName;
        let priceCents = cur.packagePrice ? cents(cur.packagePrice) : null;
        if (input.packageId !== undefined) {
          if (input.packageId === null) {
            packageId = null;
            packageName = null;
            priceCents = null;
          } else if (input.packageId !== cur.packageId) {
            const pkg = await this.loadPackage(tx, input.packageId);
            packageId = pkg.id;
            packageName = pkg.name.slice(0, 160);
            priceCents = cents(pkg.price);
          }
        }
        const discount =
          input.discountAmount === undefined
            ? cents(cur.discountAmount)
            : parseMoneyCents(input.discountAmount);
        const final = computeFinal(priceCents, discount);
        data.packageId = packageId;
        data.packageName = packageName;
        data.packagePrice = priceCents === null ? null : money(priceCents);
        data.discountAmount = money(discount ?? 0);
        data.finalAmount = final === null ? null : money(final);

        await tx.commercialDeal.update({ where: { id: cur.id }, data });
        return { deal: await this.oneTx(tx, viewer, cur.id), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { deal: null });
    }
  }

  async move(orgId: string, viewer: CommercialViewer, id: string, stageId: string) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await this.requireDeal(tx, viewer, id);
        if (cur.status !== 'open') {
          throw new CommercialError('DEAL_CLOSED', 'Negócio já fechado.', 'id');
        }
        const stage = await this.openStage(tx, orgId, stageId);
        if (stage.id !== cur.stageId) {
          await tx.commercialDeal.update({
            where: { id: cur.id },
            data: { stageId: stage.id, stageEnteredAt: new Date() },
          });
        }
        return { deal: await this.oneTx(tx, viewer, cur.id), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { deal: null });
    }
  }

  async assign(orgId: string, viewer: CommercialViewer, id: string, memberId?: string | null) {
    try {
      if (!isManagerRole(viewer.roleName)) {
        throw new CommercialError('FORBIDDEN_ROLE', 'Só gestão atribui responsável.', 'id');
      }
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await this.requireDeal(tx, viewer, id);
        if (memberId) await this.assertAssignee(tx, orgId, memberId);
        await tx.commercialDeal.update({
          where: { id: cur.id },
          data: { assigneeMemberId: memberId ?? null },
        });
        return { deal: await this.oneTx(tx, viewer, cur.id), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { deal: null });
    }
  }

  async lose(
    orgId: string,
    viewer: CommercialViewer,
    id: string,
    reasonCode: string,
    reasonText?: string | null,
  ) {
    try {
      if (!isLostReason(reasonCode)) {
        throw new CommercialError(
          'LOST_REASON_REQUIRED',
          'Escolha o motivo da perda.',
          'reasonCode',
        );
      }
      const text = cleanText(reasonText);
      if (reasonCode === 'other' && text === null) {
        throw new CommercialError(
          'LOST_REASON_REQUIRED',
          'Descreva o motivo quando for "Outro".',
          'reasonText',
        );
      }
      if (text !== null && text.length > 500) {
        throw new CommercialError(
          'LOST_REASON_TOO_LONG',
          'O motivo deve ter até 500 caracteres.',
          'reasonText',
        );
      }
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await this.requireDeal(tx, viewer, id);
        if (cur.status !== 'open') {
          throw new CommercialError('DEAL_CLOSED', 'Negócio já fechado.', 'id');
        }
        await ensureDefaultStagesTx(tx, orgId);
        const lost = await tx.commercialStage.findFirst({ where: { kind: 'lost' } });
        if (!lost) throw new CommercialError('NOT_FOUND', 'Etapa Perdido não encontrada.', 'id');
        const now = new Date();
        await tx.commercialDeal.update({
          where: { id: cur.id },
          data: {
            status: 'lost',
            stageId: lost.id,
            stageEnteredAt: now,
            closedAt: now,
            lostReasonCode: reasonCode,
            lostReasonText: text,
          },
        });
        return { deal: await this.oneTx(tx, viewer, cur.id), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { deal: null });
    }
  }

  /** D-19: só gestão reabre um negócio perdido. */
  async reopen(orgId: string, viewer: CommercialViewer, id: string, stageId?: string | null) {
    try {
      if (!isManagerRole(viewer.roleName)) {
        throw new CommercialError('FORBIDDEN_ROLE', 'Só gestão reabre negócios.', 'id');
      }
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await this.requireDeal(tx, viewer, id);
        if (cur.status === 'won') {
          throw new CommercialError('DEAL_CLOSED', 'Negócio ganho não pode ser reaberto.', 'id');
        }
        if (cur.status !== 'lost') {
          throw new CommercialError('DEAL_NOT_LOST', 'O negócio não está perdido.', 'id');
        }
        const stage = await this.openStage(tx, orgId, stageId);
        await tx.commercialDeal.update({
          where: { id: cur.id },
          data: {
            status: 'open',
            stageId: stage.id,
            stageEnteredAt: new Date(),
            closedAt: null,
            lostReasonCode: null,
            lostReasonText: null,
          },
        });
        return { deal: await this.oneTx(tx, viewer, cur.id), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { deal: null });
    }
  }

  async remove(orgId: string, viewer: CommercialViewer, id: string) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await this.requireDeal(tx, viewer, id);
        await tx.commercialDeal.update({ where: { id: cur.id }, data: { deletedAt: new Date() } });
        return { ok: true, errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { ok: false });
    }
  }
}
