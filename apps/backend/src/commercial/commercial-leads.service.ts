import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { isManagerRole, visibilityWhere, type CommercialViewer } from './commercial-access';
import { COMMERCIAL_SOURCES } from './commercial-constants';
import { CommercialError, mapCommercialError, type CommercialUserError } from './commercial-errors';
import { phoneDigits, phoneKey } from './commercial-phone';

export interface CreateCommercialLeadDto {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
  clientId?: string | null;
}

export interface UpdateCommercialLeadDto {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
}

export interface CommercialLeadFilterDto {
  search?: string | null;
  source?: string | null;
  assigneeMemberId?: string | null;
  unassigned?: boolean | null;
  limit?: number | null;
  offset?: number | null;
}

export interface DuplicateInput {
  phone?: string | null;
  email?: string | null;
  excludeLeadId?: string | null;
}

export interface DuplicateResult {
  clients: { id: string; fullName: string; phone: string | null; email: string | null }[];
  leads: { id: string; fullName: string; phone: string | null; email: string | null }[];
}

const D = String.raw`\D`;

/** Dígitos da coluna, sem o 55 inicial quando o número tem 12 ou 13 dígitos. */
const normSql = (col: string) =>
  `(CASE WHEN regexp_replace(${col}, '${D}', '', 'g') ~ '^55[0-9]{10,11}$'
     THEN substr(regexp_replace(${col}, '${D}', '', 'g'), 3)
     ELSE regexp_replace(${col}, '${D}', '', 'g') END)`;

/** Mesma chave de phoneKey(): DDD + últimos 8 dígitos, só para números com 10 ou 11 dígitos. */
const keySql = (col: string) =>
  Prisma.raw(
    `(CASE WHEN length(${normSql(col)}) IN (10, 11)
       THEN substr(${normSql(col)}, 1, 2) || right(${normSql(col)}, 8) END)`,
  );

/**
 * Procura cliente do SGS e lead com o mesmo telefone (DDD + 8 últimos dígitos) ou e-mail (D-02).
 * RLS já restringe à organização. Sem filtro de visibilidade: quem chama aplica (09-06, 09-10).
 */
export async function findDuplicatesTx(
  tx: TenantPrismaClient,
  input: DuplicateInput,
): Promise<DuplicateResult> {
  const key = phoneKey(input.phone);
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;
  if (!key && !email) return { clients: [], leads: [] };

  const clientConds: Prisma.Sql[] = [];
  const leadConds: Prisma.Sql[] = [];
  if (key) {
    for (const col of ['phone', 'phone2', 'phone3']) {
      clientConds.push(Prisma.sql`${keySql(col)} = ${key}`);
    }
    leadConds.push(Prisma.sql`${keySql('phone_digits')} = ${key}`);
  }
  if (email) {
    clientConds.push(Prisma.sql`lower(email) = ${email}`);
    leadConds.push(Prisma.sql`lower(email) = ${email}`);
  }
  const exclude = input.excludeLeadId
    ? Prisma.sql`AND id <> ${input.excludeLeadId}::uuid`
    : Prisma.empty;

  const clients = await tx.$queryRaw<DuplicateResult['clients']>(Prisma.sql`
    SELECT id::text AS id, full_name AS "fullName", phone, email
    FROM clients
    WHERE deleted_at IS NULL AND (${Prisma.join(clientConds, ' OR ')})
    ORDER BY full_name LIMIT 10`);
  const leads = await tx.$queryRaw<DuplicateResult['leads']>(Prisma.sql`
    SELECT id::text AS id, full_name AS "fullName", phone, email
    FROM commercial_leads
    WHERE deleted_at IS NULL ${exclude} AND (${Prisma.join(leadConds, ' OR ')})
    ORDER BY full_name LIMIT 10`);
  return { clients, leads };
}

const notFound = () => new CommercialError('NOT_FOUND', 'Lead não encontrado.', 'id');

const LEAD_INCLUDE = {
  client: { select: { id: true, fullName: true, phone: true, email: true } },
  creator: { select: { id: true, displayName: true, role: { select: { name: true } } } },
} satisfies Prisma.CommercialLeadInclude;

type LeadRow = Prisma.CommercialLeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

function cleanText(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

function validateContact(phone: string | null, email: string | null) {
  if (phone === null && email === null) {
    throw new CommercialError('CONTACT_REQUIRED', 'Informe telefone ou e-mail.', 'phone');
  }
  if (phone !== null && phoneDigits(phone) === null) {
    throw new CommercialError(
      'PHONE_INVALID',
      'Telefone inválido: informe DDD e número (10 ou 11 dígitos).',
      'phone',
    );
  }
  if (email !== null && !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new CommercialError('EMAIL_INVALID', 'E-mail inválido.', 'email');
  }
}

function validateSource(source: string | null | undefined): string {
  if (source === null || source === undefined || source === '') return 'manual';
  if (!COMMERCIAL_SOURCES.some((s) => s.code === source)) {
    throw new CommercialError('SOURCE_INVALID', 'Origem inválida.', 'source');
  }
  return source;
}

function validateName(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (n.length < 1 || n.length > 255) {
    throw new CommercialError('NAME_REQUIRED', 'Informe o nome (até 255 caracteres).', 'fullName');
  }
  return n;
}

@Injectable()
export class CommercialLeadsService {
  constructor(private readonly tenant: TenantContextService) {}

  private fail<T extends object>(e: unknown, empty: T): T & { errors: CommercialUserError[] } {
    const m = mapCommercialError(e);
    if (!m) throw e;
    return { ...empty, errors: [m] };
  }

  private leadVis(viewer: CommercialViewer): Prisma.CommercialLeadWhereInput {
    return visibilityWhere(viewer).lead as Prisma.CommercialLeadWhereInput;
  }

  private async hydrate(tx: TenantPrismaClient, viewer: CommercialViewer, rows: LeadRow[]) {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const deals = await tx.commercialDeal.groupBy({
      by: ['leadId'],
      where: {
        leadId: { in: ids },
        status: 'open',
        ...(visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput),
      },
      _count: { _all: true },
    });
    const inter = await tx.commercialInteraction.groupBy({
      by: ['leadId'],
      where: { leadId: { in: ids } },
      _max: { occurredAt: true },
    });
    const dealCount = new Map(deals.map((d) => [d.leadId, d._count._all]));
    const lastAt = new Map(inter.map((i) => [i.leadId, i._max.occurredAt]));
    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      phone: r.phone,
      email: r.email,
      source: r.source,
      notes: r.notes,
      client: r.client,
      createdBy: r.creator
        ? { id: r.creator.id, displayName: r.creator.displayName, roleName: r.creator.role.name }
        : null,
      consentAt: r.consentAt,
      createdAt: r.createdAt,
      openDeals: dealCount.get(r.id) ?? 0,
      lastInteractionAt: lastAt.get(r.id) ?? null,
    }));
  }

  private async getOneTx(tx: TenantPrismaClient, viewer: CommercialViewer, id: string) {
    const row = await tx.commercialLead.findFirst({
      where: { id, ...this.leadVis(viewer) },
      include: LEAD_INCLUDE,
    });
    if (!row) return null;
    return (await this.hydrate(tx, viewer, [row]))[0];
  }

  async list(orgId: string, viewer: CommercialViewer, filter?: CommercialLeadFilterDto | null) {
    const f = filter ?? {};
    const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
    const offset = Math.max(f.offset ?? 0, 0);
    const and: Prisma.CommercialLeadWhereInput[] = [this.leadVis(viewer)];
    const search = f.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      and.push({
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ phoneDigits: { contains: digits } }] : []),
        ],
      });
    }
    if (f.source) and.push({ source: f.source });
    if (isManagerRole(viewer.roleName)) {
      if (f.assigneeMemberId) {
        and.push({
          deals: { some: { assigneeMemberId: f.assigneeMemberId, deletedAt: null } },
        });
      }
      if (f.unassigned) {
        and.push({
          deals: { none: { assigneeMemberId: { not: null }, deletedAt: null } },
          OR: [{ createdBy: null }, { creator: { role: { name: { not: 'ATTENDANT' } } } }],
        });
      }
    }
    const where: Prisma.CommercialLeadWhereInput = { organizationId: orgId, AND: and };
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const [total, rows] = await Promise.all([
        tx.commercialLead.count({ where }),
        tx.commercialLead.findMany({
          where,
          include: LEAD_INCLUDE,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit,
          skip: offset,
        }),
      ]);
      return { items: await this.hydrate(tx, viewer, rows), total };
    });
  }

  get(orgId: string, viewer: CommercialViewer, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) => this.getOneTx(tx, viewer, id));
  }

  duplicates(orgId: string, viewer: CommercialViewer, input: DuplicateInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const found = await findDuplicatesTx(tx, input);
      if (!isManagerRole(viewer.roleName) && found.leads.length > 0) {
        // a atendente só é avisada de leads que ela própria enxerga
        const visible = await tx.commercialLead.findMany({
          where: { id: { in: found.leads.map((l) => l.id) }, ...this.leadVis(viewer) },
          select: { id: true },
        });
        const ok = new Set(visible.map((v) => v.id));
        found.leads = found.leads.filter((l) => ok.has(l.id));
      }
      return found;
    });
  }

  async create(orgId: string, viewer: CommercialViewer, input: CreateCommercialLeadDto) {
    try {
      const fullName = validateName(input.fullName);
      const phone = cleanText(input.phone);
      const email = cleanText(input.email)?.toLowerCase() ?? null;
      validateContact(phone, email);
      const source = validateSource(input.source);
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        if (input.clientId) await this.assertClient(tx, input.clientId);
        const row = await tx.commercialLead.create({
          data: {
            organizationId: orgId,
            fullName,
            phone,
            phoneDigits: phoneDigits(phone),
            email,
            source,
            notes: cleanText(input.notes),
            clientId: input.clientId ?? null,
            createdBy: viewer.memberId,
          },
        });
        return {
          lead: await this.getOneTx(tx, viewer, row.id),
          errors: [] as CommercialUserError[],
        };
      });
    } catch (e) {
      return this.fail(e, { lead: null });
    }
  }

  async update(orgId: string, viewer: CommercialViewer, input: UpdateCommercialLeadDto) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialLead.findFirst({
          where: { id: input.id, ...this.leadVis(viewer) },
        });
        if (!cur) throw notFound();
        const fullName = input.fullName === undefined ? cur.fullName : validateName(input.fullName);
        const phone = input.phone === undefined ? cur.phone : cleanText(input.phone);
        const email =
          input.email === undefined ? cur.email : (cleanText(input.email)?.toLowerCase() ?? null);
        validateContact(phone, email);
        const source = input.source === undefined ? cur.source : validateSource(input.source);
        await tx.commercialLead.update({
          where: { id: cur.id },
          data: {
            fullName,
            phone,
            phoneDigits: phoneDigits(phone),
            email,
            source,
            notes: input.notes === undefined ? cur.notes : cleanText(input.notes),
          },
        });
        return {
          lead: await this.getOneTx(tx, viewer, cur.id),
          errors: [] as CommercialUserError[],
        };
      });
    } catch (e) {
      return this.fail(e, { lead: null });
    }
  }

  private async assertClient(tx: TenantPrismaClient, clientId: string) {
    const c = await tx.client.findFirst({ where: { id: clientId, deletedAt: null } });
    if (!c) throw new CommercialError('NOT_FOUND', 'Cliente não encontrada.', 'clientId');
  }

  async link(orgId: string, viewer: CommercialViewer, leadId: string, clientId?: string | null) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialLead.findFirst({
          where: { id: leadId, ...this.leadVis(viewer) },
        });
        if (!cur) throw notFound();
        if (clientId) await this.assertClient(tx, clientId);
        await tx.commercialLead.update({
          where: { id: cur.id },
          data: { clientId: clientId ?? null },
        });
        return {
          lead: await this.getOneTx(tx, viewer, cur.id),
          errors: [] as CommercialUserError[],
        };
      });
    } catch (e) {
      return this.fail(e, { lead: null });
    }
  }

  async softDelete(orgId: string, viewer: CommercialViewer, id: string) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialLead.findFirst({
          where: { id, ...this.leadVis(viewer) },
        });
        if (!cur) throw notFound();
        const now = new Date();
        await tx.commercialDeal.updateMany({
          where: { leadId: id, deletedAt: null },
          data: { deletedAt: now },
        });
        await tx.commercialLead.update({ where: { id }, data: { deletedAt: now } });
        return { ok: true, errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { ok: false });
    }
  }

  async purge(orgId: string, id: string) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialLead.findFirst({ where: { id } });
        if (!cur) throw notFound();
        await tx.commercialLead.delete({ where: { id } });
        return { ok: true, errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { ok: false });
    }
  }

  /** Membros que podem ser responsáveis por negócios (D-14). */
  assignees(orgId: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const rows = await tx.member.findMany({
        where: {
          organizationId: orgId,
          status: 'active',
          deletedAt: null,
          role: { name: { in: ['ADMIN', 'MANAGER', 'ATTENDANT'] } },
        },
        include: { role: { select: { name: true } } },
        orderBy: { displayName: 'asc' },
      });
      return rows.map((m) => ({ id: m.id, displayName: m.displayName, roleName: m.role.name }));
    });
  }
}
