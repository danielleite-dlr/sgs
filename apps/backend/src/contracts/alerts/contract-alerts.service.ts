import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { BLOCKING_STATUSES } from '../../appointments/appointment-status';
import { toCents } from '../../common/money';
import { TenantContextService } from '../../database/tenant-context.service';
import { EmailService } from '../../email/email.service';
import { ContractSettingsService } from '../contract-settings.service';
import {
  ALERT_KINDS,
  buildAlertCandidates,
  type AlertCandidate,
  type AlertCompanionInput,
  type AlertContractInput,
} from './alert-candidates';

export interface ContractAlertsRunResult {
  ran: boolean;
  candidates: number;
  created: number;
  resolved: number;
  emailed: number;
}

interface DigestTarget {
  email: string;
}

/** Hora (0-23) do instante no fuso informado. */
export function localHour(d: Date, timezone: string): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(d);
  return Number(h) % 24;
}

/** Data local (YYYY-MM-DD) do instante no fuso informado. */
export function localDateOf(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

const RECIPIENT_ROLES = ['ADMIN', 'MANAGER'];
const FIRST_HOUR = 8;

@Injectable()
export class ContractAlertsService {
  private readonly logger = new Logger(ContractAlertsService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly settings: ContractSettingsService,
    private readonly email: EmailService,
  ) {}

  /** Varre as orgs ativas e roda a checagem diária das que já passaram das 8h locais. */
  async tick(now: Date = new Date()): Promise<{ orgs: number; ran: number }> {
    const orgs = await this.tenant.runWithoutTenant((tx) =>
      tx.$queryRaw<{ organization_id: string; timezone: string }[]>`
        SELECT organization_id, timezone FROM job_list_active_orgs()`,
    );
    let ran = 0;
    for (const o of orgs) {
      try {
        if (localHour(now, o.timezone) < FIRST_HOUR) continue;
        const r = await this.runForOrg(o.organization_id, now);
        if (r.ran) ran++;
      } catch (e) {
        this.logger.error(
          `Falha nos alertas de contrato da org ${o.organization_id}: ${(e as Error).message}`,
        );
      }
    }
    return { orgs: orgs.length, ran };
  }

  async runForOrg(
    orgId: string,
    now: Date,
    opts: { force?: boolean } = {},
  ): Promise<ContractAlertsRunResult> {
    const outcome = await this.tenant.runWithTenant(
      orgId,
      async (tx) => {
        const org = await tx.organization.findUnique({
          where: { id: orgId },
          select: { timezone: true, tradeName: true },
        });
        const tz = org?.timezone ?? 'America/Sao_Paulo';
        const orgName = org?.tradeName ?? '';
        const today = localDateOf(now, tz);

        if (!opts.force) {
          const claimed = await tx.$queryRaw<{ run_date: Date }[]>`
            INSERT INTO contract_alert_runs (organization_id, run_date)
            VALUES (${orgId}::uuid, ${today}::date)
            ON CONFLICT DO NOTHING
            RETURNING run_date`;
          if (claimed.length === 0) return null;
        }

        const cfg = await this.settings.getEffective(tx, orgId);
        const contractRows = await tx.contract.findMany({
          where: { status: { in: ['awaiting_acceptance', 'active'] } },
          include: {
            payments: true,
            bride: { select: { fullName: true } },
            contractor: { select: { fullName: true } },
            group: { select: { eventKind: true } },
            installments: { orderBy: { seq: 'asc' } },
          },
        });
        const contracts: AlertContractInput[] = contractRows.map((c) => ({
          id: c.id,
          code: c.code,
          status: c.status,
          brideName: c.bride.fullName,
          contractorName: c.contractor?.fullName ?? c.bride.fullName,
          debutanteName: c.group.eventKind === 'debutante' ? c.bride.fullName : null,
          paymentMode: c.paymentMode as AlertContractInput['paymentMode'],
          installments: c.installments.map((i) => ({
            seq: i.seq,
            dueDate: i.dueDate.toISOString().slice(0, 10),
            cents: toCents(i.amount),
          })),
          totalCents: toCents(c.totalAmount),
          depositCents: toCents(c.depositAmount),
          paymentsCents: c.payments.map((p) => toCents(p.amount)),
          balanceDueDate: c.balanceDueDate.toISOString().slice(0, 10),
          createdLocalDate: localDateOf(c.createdAt, tz),
          acceptedLocalDate: c.acceptedAt ? localDateOf(c.acceptedAt, tz) : null,
          linkGeneratedLocalDate: c.linkGeneratedAt ? localDateOf(c.linkGeneratedAt, tz) : null,
          currentVersion: c.currentVersion,
        }));

        const groups = await tx.bridalGroup.findMany({
          where: { status: 'active', eventDate: { gte: new Date(`${today}T00:00:00.000Z`) } },
          include: {
            members: {
              where: { coveredByContract: false, role: { not: 'bride' } },
              include: { client: { select: { fullName: true } } },
            },
            appointments: {
              where: { status: { in: [...BLOCKING_STATUSES] } },
              select: { clientId: true, depositAmount: true },
            },
          },
        });
        const companions: AlertCompanionInput[] = [];
        for (const g of groups) {
          for (const m of g.members) {
            const appts = g.appointments.filter((a) => a.clientId === m.clientId);
            companions.push({
              groupId: g.id,
              groupName: g.name,
              eventDate: g.eventDate.toISOString().slice(0, 10),
              memberId: m.id,
              clientName: m.client.fullName,
              depositCents: appts.reduce((s, a) => s + toCents(a.depositAmount), 0),
              hasAppointments: appts.length > 0,
            });
          }
        }

        const candidates = buildAlertCandidates({
          today,
          settings: {
            depositUnpaidDays: cfg.alertDepositUnpaidDays,
            notAcceptedDays: cfg.alertNotAcceptedDays,
            companionDepositDays: cfg.alertCompanionDepositDays,
          },
          contracts,
          companions,
        });

        const recipients = await tx.member.findMany({
          where: {
            status: 'active',
            deletedAt: null,
            role: { name: { in: RECIPIENT_ROLES } },
          },
          select: { id: true, user: { select: { email: true } } },
        });

        // Notificações já existentes (lidas ou não) para dedupe; abertas para auto-resolução.
        const existing = await tx.notification.findMany({
          where: { kind: { in: [...ALERT_KINDS] } },
          select: { id: true, memberId: true, readAt: true, payload: true },
        });
        const keyOf = (p: Prisma.JsonValue): string | null => {
          const k = (p as { dedupeKey?: unknown } | null)?.dedupeKey;
          return typeof k === 'string' ? k : null;
        };
        const seen = new Set<string>();
        for (const n of existing) {
          const k = keyOf(n.payload);
          if (k && n.memberId) seen.add(`${n.memberId}|${k}`);
        }

        const toCreate: Prisma.NotificationCreateManyInput[] = [];
        for (const c of candidates) {
          for (const r of recipients) {
            if (seen.has(`${r.id}|${c.dedupeKey}`)) continue;
            toCreate.push({
              organizationId: orgId,
              memberId: r.id,
              kind: c.kind,
              payload: c.payload as Prisma.InputJsonValue,
            });
          }
        }
        if (toCreate.length > 0) await tx.notification.createMany({ data: toCreate });

        const current = new Set(candidates.map((c) => c.dedupeKey));
        const staleIds = existing
          .filter((n) => n.readAt === null)
          .filter((n) => {
            const k = keyOf(n.payload);
            return k !== null && !current.has(k);
          })
          .map((n) => n.id);
        if (staleIds.length > 0) {
          await tx.notification.updateMany({
            where: { id: { in: staleIds }, readAt: null },
            data: { readAt: now },
          });
        }

        const targets: DigestTarget[] = recipients
          .map((r) => ({ email: r.user.email }))
          .filter((t) => !!t.email);
        return {
          orgName,
          candidates,
          created: toCreate.length,
          resolved: staleIds.length,
          targets,
        };
      },
      { timeout: 30000 },
    );

    if (!outcome) return { ran: false, candidates: 0, created: 0, resolved: 0, emailed: 0 };

    let emailed = 0;
    // E-mail de resumo só na execução diária (a checagem manual não reenvia).
    if (!opts.force && outcome.candidates.length > 0) {
      const items = outcome.candidates.map((c: AlertCandidate) => ({
        title: c.title,
        message: c.message,
        href: c.entityType === 'contract' ? `/contratos/${c.entityId}` : `/noivas/${c.entityId}`,
      }));
      for (const t of outcome.targets) {
        try {
          await this.email.sendContractDigest(t.email, outcome.orgName, items);
          emailed++;
        } catch (e) {
          this.logger.warn(`Falha ao enviar resumo de contratos: ${(e as Error).message}`);
        }
      }
    }
    return {
      ran: true,
      candidates: outcome.candidates.length,
      created: outcome.created,
      resolved: outcome.resolved,
      emailed,
    };
  }
}
