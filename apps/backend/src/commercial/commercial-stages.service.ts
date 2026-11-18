import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { visibilityWhere, type CommercialViewer } from './commercial-access';
import { CommercialError, mapCommercialError, type CommercialUserError } from './commercial-errors';

/** Mesmos valores do backfill da migração do 09-01. */
export const DEFAULT_STAGES = [
  { name: 'Novo', color: '#64748B', position: 0, slaDays: 1, kind: 'open', isSystem: false },
  { name: 'Contato', color: '#3B82F6', position: 1, slaDays: 3, kind: 'open', isSystem: false },
  { name: 'Proposta', color: '#8B5CF6', position: 2, slaDays: 3, kind: 'open', isSystem: false },
  { name: 'Negociação', color: '#F59E0B', position: 3, slaDays: 2, kind: 'open', isSystem: false },
  { name: 'Ganho', color: '#16A34A', position: 100, slaDays: null, kind: 'won', isSystem: true },
  { name: 'Perdido', color: '#DC2626', position: 101, slaDays: null, kind: 'lost', isSystem: true },
] as const;

const WON_POSITION = 100;
const LOST_POSITION = 101;

/** Cria as 6 etapas padrão se a org não tiver nenhuma (idempotente, seguro em paralelo). */
export async function ensureDefaultStagesTx(tx: TenantPrismaClient, orgId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('commercial_stages:' || ${orgId}))`;
  const count = await tx.commercialStage.count({ where: { organizationId: orgId } });
  if (count > 0) return;
  await tx.commercialStage.createMany({
    data: DEFAULT_STAGES.map((s) => ({ organizationId: orgId, ...s })),
  });
}

export interface CommercialStageInputDto {
  name: string;
  color: string;
  slaDays?: number | null;
}

interface StageRow {
  id: string;
  name: string;
  color: string;
  position: number;
  slaDays: number | null;
  kind: string;
  isSystem: boolean;
}

function serialize(s: StageRow, openDeals: number) {
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    position: s.position,
    slaDays: s.slaDays,
    kind: s.kind,
    isSystem: s.isSystem,
    openDeals,
  };
}

function validate(input: CommercialStageInputDto): {
  name: string;
  color: string;
  slaDays: number | null;
} {
  const name = (input.name ?? '').trim();
  if (name.length < 1 || name.length > 60) {
    throw new CommercialError('NAME_REQUIRED', 'Informe um nome de até 60 caracteres.', 'name');
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.color ?? '')) {
    throw new CommercialError('COLOR_INVALID', 'Use uma cor no formato #RRGGBB.', 'color');
  }
  const sla = input.slaDays ?? null;
  if (sla !== null && (!Number.isInteger(sla) || sla < 1 || sla > 365)) {
    throw new CommercialError('SLA_INVALID', 'O prazo deve ficar entre 1 e 365 dias.', 'slaDays');
  }
  return { name, color: input.color, slaDays: sla };
}

const notFound = () => new CommercialError('NOT_FOUND', 'Etapa não encontrada.', 'id');

@Injectable()
export class CommercialStagesService {
  constructor(private readonly tenant: TenantContextService) {}

  private async fail<T extends object>(
    e: unknown,
    empty: T,
  ): Promise<T & { errors: CommercialUserError[] }> {
    const m = mapCommercialError(e);
    if (!m) throw e;
    return { ...empty, errors: [m] };
  }

  private async listTx(tx: TenantPrismaClient, orgId: string, viewer: CommercialViewer) {
    await ensureDefaultStagesTx(tx, orgId);
    const stages = await tx.commercialStage.findMany({
      where: { organizationId: orgId },
      orderBy: { position: 'asc' },
    });
    const grouped = await tx.commercialDeal.groupBy({
      by: ['stageId'],
      where: {
        organizationId: orgId,
        status: 'open',
        ...(visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput),
      },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((g) => [g.stageId, g._count._all]));
    return stages.map((s) => serialize(s, counts.get(s.id) ?? 0));
  }

  list(orgId: string, viewer: CommercialViewer) {
    return this.tenant.runWithTenant(orgId, (tx) => this.listTx(tx, orgId, viewer));
  }

  async create(orgId: string, viewer: CommercialViewer, input: CommercialStageInputDto) {
    try {
      const v = validate(input);
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        await ensureDefaultStagesTx(tx, orgId);
        const last = await tx.commercialStage.findFirst({
          where: { organizationId: orgId, kind: 'open' },
          orderBy: { position: 'desc' },
        });
        const stage = await tx.commercialStage.create({
          data: {
            organizationId: orgId,
            name: v.name,
            color: v.color,
            slaDays: v.slaDays,
            kind: 'open',
            isSystem: false,
            position: (last?.position ?? -1) + 1,
          },
        });
        return { stage: serialize(stage, 0), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { stage: null });
    }
  }

  async update(
    orgId: string,
    viewer: CommercialViewer,
    id: string,
    input: CommercialStageInputDto,
  ) {
    try {
      const v = validate(input);
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialStage.findFirst({ where: { id, organizationId: orgId } });
        if (!cur) throw notFound();
        const stage = await tx.commercialStage.update({
          where: { id },
          data: {
            name: v.name,
            color: v.color,
            slaDays: cur.kind === 'open' ? v.slaDays : null,
          },
        });
        const open = await tx.commercialDeal.count({
          where: {
            stageId: id,
            status: 'open',
            ...(visibilityWhere(viewer).deal as Prisma.CommercialDealWhereInput),
          },
        });
        return { stage: serialize(stage, open), errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { stage: null });
    }
  }

  async reorder(orgId: string, viewer: CommercialViewer, ids: string[]) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        await ensureDefaultStagesTx(tx, orgId);
        const all = await tx.commercialStage.findMany({ where: { organizationId: orgId } });
        const byId = new Map(all.map((s) => [s.id, s]));
        const unique = new Set(ids);
        if (
          ids.length !== all.length ||
          unique.size !== ids.length ||
          ids.some((i) => !byId.has(i))
        ) {
          throw new CommercialError(
            'STAGE_ORDER',
            'A lista precisa conter todas as etapas, sem repetir.',
            'ids',
          );
        }
        const kinds = ids.map((i) => byId.get(i)!.kind);
        const firstClosed = kinds.findIndex((k) => k !== 'open');
        const wonIdx = kinds.indexOf('won');
        const lostIdx = kinds.indexOf('lost');
        const openAfter = firstClosed >= 0 && kinds.slice(firstClosed).includes('open');
        if (openAfter || wonIdx > lostIdx) {
          throw new CommercialError(
            'STAGE_ORDER',
            'Ganho e Perdido ficam sempre depois das etapas abertas.',
            'ids',
          );
        }
        let n = 0;
        for (const id of ids) {
          const kind = byId.get(id)!.kind;
          const position = kind === 'won' ? WON_POSITION : kind === 'lost' ? LOST_POSITION : n++;
          await tx.commercialStage.update({ where: { id }, data: { position } });
        }
        return {
          stages: await this.listTx(tx, orgId, viewer),
          errors: [] as CommercialUserError[],
        };
      });
    } catch (e) {
      return this.fail(e, { stages: [] });
    }
  }

  async remove(orgId: string, id: string, moveToStageId?: string | null) {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const cur = await tx.commercialStage.findFirst({ where: { id, organizationId: orgId } });
        if (!cur) throw notFound();
        if (cur.kind !== 'open' || cur.isSystem) {
          throw new CommercialError(
            'STAGE_SYSTEM',
            'As etapas Ganho e Perdido não podem ser excluídas.',
            'id',
          );
        }
        const openCount = await tx.commercialStage.count({
          where: { organizationId: orgId, kind: 'open' },
        });
        if (openCount <= 1) {
          throw new CommercialError(
            'STAGE_LAST_OPEN',
            'O funil precisa ter pelo menos uma etapa aberta.',
            'id',
          );
        }
        const deals = await tx.commercialDeal.count({ where: { stageId: id } });
        if (deals > 0) {
          if (!moveToStageId) {
            throw new CommercialError(
              'STAGE_NOT_EMPTY',
              'Esta etapa tem negócios. Escolha para onde movê-los.',
              'moveToStageId',
            );
          }
          const dest = await tx.commercialStage.findFirst({
            where: { id: moveToStageId, organizationId: orgId },
          });
          if (!dest || dest.id === id) throw notFound();
          if (dest.kind !== 'open') {
            throw new CommercialError(
              'STAGE_SYSTEM',
              'Os negócios só podem ser movidos para outra etapa aberta.',
              'moveToStageId',
            );
          }
          await tx.commercialDeal.updateMany({
            where: { stageId: id },
            data: { stageId: dest.id, stageEnteredAt: new Date() },
          });
        }
        await tx.commercialStage.delete({ where: { id } });
        return { ok: true, errors: [] as CommercialUserError[] };
      });
    } catch (e) {
      return this.fail(e, { ok: false });
    }
  }
}
