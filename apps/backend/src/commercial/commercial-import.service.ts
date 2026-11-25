import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { eligibleAssigneeIds } from './commercial-assignees';
import { visibilityWhere, type CommercialViewer } from './commercial-access';
import { CommercialError, mapCommercialError, type CommercialUserError } from './commercial-errors';
import { findDuplicatesTx } from './commercial-leads.service';
import { phoneDigits } from './commercial-phone';
import { ensureDefaultStagesTx } from './commercial-stages.service';
import {
  matchAssignee,
  MAX_IMPORT_BYTES,
  parseLeadSheet,
  type AssigneeCandidate,
  type ParsedLeadRow,
} from './lead-sheet';

export interface MemberRef {
  id: string;
  displayName: string;
  roleName: string;
}

export interface Resolved {
  row: ParsedLeadRow;
  duplicateOf: { type: 'client' | 'lead'; id: string; name: string } | null;
  /** lead duplicado que a pessoa não enxerga: pulado na gravação, sem aparecer na prévia */
  hiddenLeadDuplicate: boolean;
  assignee: MemberRef | null;
  assigneeWarning: string | null;
}

function decode(base64: string): Buffer {
  // 4/3 do limite + folga de padding: barra antes de alocar o buffer
  if (typeof base64 !== 'string' || base64.length > Math.ceil((MAX_IMPORT_BYTES * 4) / 3) + 8) {
    throw new CommercialError('FILE_TOO_LARGE', 'O arquivo passa de 2,5 MB.', 'base64');
  }
  return Buffer.from(base64, 'base64');
}

@Injectable()
export class CommercialImportService {
  constructor(private readonly tenant: TenantContextService) {}

  /** Candidatos a responsável (D-22): quem não tem Leads/Pipeline ligado e inativos ficam de fora, logo nunca casam. */
  private async candidates(tx: TenantPrismaClient, orgId: string) {
    const ids = await eligibleAssigneeIds(tx, orgId);
    const rows = await tx.member.findMany({
      where: {
        organizationId: orgId,
        status: 'active',
        deletedAt: null,
        id: { in: [...ids] },
      },
      include: { user: { select: { email: true, fullName: true } }, role: true },
    });
    const refs = new Map<string, MemberRef>();
    const list: AssigneeCandidate[] = rows.map((m) => {
      refs.set(m.id, { id: m.id, displayName: m.displayName, roleName: m.role.name });
      return {
        id: m.id,
        email: m.user.email,
        displayName: m.displayName,
        userName: m.user.fullName,
      };
    });
    return { list, refs };
  }

  private async resolve(
    tx: TenantPrismaClient,
    orgId: string,
    viewer: CommercialViewer,
    rows: ParsedLeadRow[],
  ): Promise<Resolved[]> {
    const { list, refs } = await this.candidates(tx, orgId);
    const leadVis = visibilityWhere(viewer).lead as Prisma.CommercialLeadWhereInput;
    const manager = viewer.scopeAll;
    const out: Resolved[] = [];
    for (const row of rows) {
      const found = await findDuplicatesTx(tx, { phone: row.phone, email: row.email });
      let leads = found.leads;
      let hiddenLeadDuplicate = false;
      if (!manager && leads.length > 0) {
        const visible = await tx.commercialLead.findMany({
          where: { id: { in: leads.map((l) => l.id) }, ...leadVis },
          select: { id: true },
        });
        const ok = new Set(visible.map((v) => v.id));
        hiddenLeadDuplicate = leads.some((l) => !ok.has(l.id));
        leads = leads.filter((l) => ok.has(l.id));
      }
      const duplicateOf = leads[0]
        ? { type: 'lead' as const, id: leads[0].id, name: leads[0].fullName }
        : found.clients[0]
          ? { type: 'client' as const, id: found.clients[0].id, name: found.clients[0].fullName }
          : null;
      const m = matchAssignee(row.assigneeRef, list);
      out.push({
        row,
        duplicateOf,
        hiddenLeadDuplicate,
        assignee: m.memberId ? (refs.get(m.memberId) ?? null) : null,
        assigneeWarning: m.warning,
      });
    }
    return out;
  }

  async preview(orgId: string, viewer: CommercialViewer, base64: string, filename: string) {
    try {
      const parsed = await parseLeadSheet(decode(base64), filename);
      return await this.tenant.runWithTenant(
        orgId,
        async (tx) => {
          const resolved = await this.resolve(tx, orgId, viewer, parsed.valid);
          return {
            totalRows: parsed.valid.length + parsed.invalid.length,
            valid: resolved.map((r) => ({
              ...r.row,
              duplicateOf: r.duplicateOf,
              assignee: r.assignee,
              assigneeWarning: r.assigneeWarning,
            })),
            invalid: parsed.invalid,
            errors: [] as CommercialUserError[],
          };
        },
        { timeout: 60_000 },
      );
    } catch (e) {
      const m = mapCommercialError(e);
      if (!m) throw e;
      return { totalRows: 0, valid: [], invalid: [], errors: [m] };
    }
  }

  /** Relê e revalida o arquivo no servidor; tudo numa transação (sem gravação parcial). */
  async import(orgId: string, viewer: CommercialViewer, base64: string, filename: string) {
    try {
      const parsed = await parseLeadSheet(decode(base64), filename);
      return await this.tenant.runWithTenant(
        orgId,
        async (tx) => {
          await ensureDefaultStagesTx(tx, orgId);
          const first = await tx.commercialStage.findFirst({
            where: { organizationId: orgId, kind: 'open' },
            orderBy: { position: 'asc' },
          });
          const resolved = await this.resolve(tx, orgId, viewer, parsed.valid);
          const res = {
            createdLeads: 0,
            createdDeals: 0,
            linkedClients: 0,
            assignedDeals: 0,
            unassignedDeals: 0,
            skipped: 0,
            errors: [] as CommercialUserError[],
          };
          for (const r of resolved) {
            if (r.hiddenLeadDuplicate || r.duplicateOf?.type === 'lead') {
              res.skipped++;
              continue;
            }
            const { row } = r;
            const assigneeId = r.assignee?.id ?? null;
            const lead = await tx.commercialLead.create({
              data: {
                organizationId: orgId,
                fullName: row.fullName,
                phone: row.phone,
                phoneDigits: phoneDigits(row.phone),
                email: row.email,
                source: row.source,
                notes: row.notes,
                clientId: r.duplicateOf?.type === 'client' ? r.duplicateOf.id : null,
                // D-22: o lead fica visível ao responsável da planilha; sem casamento, fila D-20
                createdBy: assigneeId,
              },
            });
            res.createdLeads++;
            if (r.duplicateOf?.type === 'client') res.linkedClients++;
            if (row.kind && first) {
              await tx.commercialDeal.create({
                data: {
                  organizationId: orgId,
                  leadId: lead.id,
                  stageId: first.id,
                  kind: row.kind,
                  eventDate: row.eventDate ? new Date(`${row.eventDate}T00:00:00.000Z`) : null,
                  source: row.source,
                  assigneeMemberId: assigneeId,
                  createdBy: viewer.memberId,
                },
              });
              res.createdDeals++;
              if (assigneeId) res.assignedDeals++;
              else res.unassignedDeals++;
            }
          }
          return res;
        },
        { timeout: 60_000 },
      );
    } catch (e) {
      const m = mapCommercialError(e);
      if (!m) throw e;
      return {
        createdLeads: 0,
        createdDeals: 0,
        linkedClients: 0,
        assignedDeals: 0,
        unassignedDeals: 0,
        skipped: 0,
        errors: [m],
      };
    }
  }
}
