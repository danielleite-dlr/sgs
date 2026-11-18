import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { visibilityWhere, type CommercialViewer } from './commercial-access';
import { isInteractionType } from './commercial-constants';
import { CommercialError, mapCommercialError, type CommercialUserError } from './commercial-errors';

export interface CreateCommercialInteractionDto {
  leadId: string;
  dealId?: string | null;
  type: string;
  notes?: string | null;
  occurredAt?: Date | string | null;
  nextContactAt?: Date | string | null;
  nextContactTitle?: string | null;
}

const INTERACTION_INCLUDE = {
  creator: { select: { id: true, displayName: true, role: { select: { name: true } } } },
  reminders: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 },
} satisfies Prisma.CommercialInteractionInclude;

type InteractionRow = Prisma.CommercialInteractionGetPayload<{
  include: typeof INTERACTION_INCLUDE;
}>;

const FUTURE_TOLERANCE_MS = 5 * 60_000;

function toDate(v: Date | string | null | undefined, field: string): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new CommercialError('DATE_INVALID', 'Data inválida.', field);
  }
  return d;
}

function serialize(r: InteractionRow) {
  return {
    id: r.id,
    leadId: r.leadId,
    dealId: r.dealId,
    type: r.type,
    notes: r.notes,
    occurredAt: r.occurredAt,
    createdBy: r.creator
      ? { id: r.creator.id, displayName: r.creator.displayName, roleName: r.creator.role.name }
      : null,
    reminderId: r.reminders[0]?.id ?? null,
  };
}

@Injectable()
export class CommercialInteractionsService {
  constructor(private readonly tenant: TenantContextService) {}

  private fail<T extends object>(e: unknown, empty: T): T & { errors: CommercialUserError[] } {
    const m = mapCommercialError(e);
    if (!m) throw e;
    return { ...empty, errors: [m] };
  }

  /**
   * Registra a interação, atualiza o último contato dos negócios e, com "próximo contato em",
   * cria o lembrete, tudo na mesma transação (D-15, D-17). Qualquer erro desfaz tudo.
   */
  async create(orgId: string, viewer: CommercialViewer, input: CreateCommercialInteractionDto) {
    try {
      if (!isInteractionType(input.type)) {
        throw new CommercialError('TYPE_INVALID', 'Tipo de interação inválido.', 'type');
      }
      const notes = (input.notes ?? '').trim() || null;
      if (notes !== null && notes.length > 2000) {
        throw new CommercialError('NOTES_TOO_LONG', 'Notas: até 2000 caracteres.', 'notes');
      }
      const now = new Date();
      const occurredAt = toDate(input.occurredAt, 'occurredAt') ?? now;
      if (occurredAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
        throw new CommercialError(
          'OCCURRED_IN_FUTURE',
          'A data da interação não pode estar no futuro.',
          'occurredAt',
        );
      }
      const nextContactAt = toDate(input.nextContactAt, 'nextContactAt');
      if (nextContactAt && nextContactAt.getTime() <= now.getTime()) {
        throw new CommercialError(
          'NEXT_CONTACT_PAST',
          'O próximo contato precisa ser no futuro.',
          'nextContactAt',
        );
      }
      const customTitle = (input.nextContactTitle ?? '').trim();
      if (customTitle.length > 160) {
        throw new CommercialError(
          'TITLE_TOO_LONG',
          'Título do lembrete: até 160 caracteres.',
          'nextContactTitle',
        );
      }

      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const lead = await tx.commercialLead.findFirst({
          where: {
            id: input.leadId,
            ...(visibilityWhere(viewer).lead as Prisma.CommercialLeadWhereInput),
          },
        });
        if (!lead) throw new CommercialError('NOT_FOUND', 'Lead não encontrado.', 'leadId');

        const dealVis = visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput;
        let dealIds: string[];
        if (input.dealId) {
          const deal = await tx.commercialDeal.findFirst({
            where: { id: input.dealId, leadId: lead.id, ...dealVis },
            select: { id: true },
          });
          if (!deal) throw new CommercialError('NOT_FOUND', 'Negócio não encontrado.', 'dealId');
          dealIds = [deal.id];
        } else {
          const open = await tx.commercialDeal.findMany({
            where: { leadId: lead.id, status: 'open', ...dealVis },
            select: { id: true },
          });
          dealIds = open.map((d) => d.id);
        }

        const row = await tx.commercialInteraction.create({
          data: {
            organizationId: orgId,
            leadId: lead.id,
            dealId: input.dealId ?? null,
            type: input.type,
            notes,
            occurredAt,
            createdBy: viewer.memberId,
          },
        });

        if (dealIds.length > 0) {
          await tx.$executeRaw`
            UPDATE commercial_deals
            SET last_interaction_at = GREATEST(COALESCE(last_interaction_at, ${occurredAt}::timestamptz), ${occurredAt}::timestamptz)
            WHERE id = ANY(${dealIds}::uuid[])`;
        }

        if (nextContactAt) {
          await tx.commercialReminder.create({
            data: {
              organizationId: orgId,
              leadId: lead.id,
              dealId: input.dealId ?? null,
              interactionId: row.id,
              title: customTitle || `Retomar contato com ${lead.fullName}`.slice(0, 160),
              dueAt: nextContactAt,
              createdBy: viewer.memberId,
            },
          });
        }

        const full = await tx.commercialInteraction.findUniqueOrThrow({
          where: { id: row.id },
          include: INTERACTION_INCLUDE,
        });
        return { interaction: serialize(full), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { interaction: null });
    }
  }

  list(
    orgId: string,
    viewer: CommercialViewer,
    leadId: string,
    dealId?: string | null,
    limit?: number | null,
  ) {
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const vis = visibilityWhere(viewer).interaction as Prisma.CommercialInteractionWhereInput;
      if (dealId) {
        const deal = await tx.commercialDeal.findFirst({
          where: {
            id: dealId,
            leadId,
            ...(visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput),
          },
          select: { id: true },
        });
        if (!deal) return [];
      }
      const rows = await tx.commercialInteraction.findMany({
        where: { leadId, ...(dealId ? { dealId } : {}), ...vis },
        include: INTERACTION_INCLUDE,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take,
      });
      return rows.map(serialize);
    });
  }

  async remove(orgId: string, viewer: CommercialViewer, id: string) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx: TenantPrismaClient) => {
        const cur = await tx.commercialInteraction.findFirst({
          where: {
            id,
            ...(visibilityWhere(viewer).interaction as Prisma.CommercialInteractionWhereInput),
          },
          select: { id: true },
        });
        if (!cur) {
          throw new CommercialError('NOT_FOUND', 'Interação não encontrada.', 'id');
        }
        await tx.commercialInteraction.delete({ where: { id } });
        return { ok: true, errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { ok: false });
    }
  }
}
