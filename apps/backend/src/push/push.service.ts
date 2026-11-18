import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { TenantContextService } from '../database/tenant-context.service';
import {
  buildCommercialReminderMessage,
  buildPushMessage,
  type PushAppointmentView,
} from './push-messages';
import {
  PUSH_PROVIDER,
  WEBPUSH_PROVIDER,
  type PushJob,
  type PushMessage,
  type PushProvider,
  type PushSendResult,
  type WebPushKeys,
} from './push.types';
import { resolvePushTargets } from './resolve-push-targets';

export interface PushDispatchResult {
  sent: number;
  invalid: number;
  failed: number;
  skipped?: string;
}

const CONCURRENCY = 10;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const MANAGER_ROLES = ['ADMIN', 'MANAGER'];
const COMMERCIAL_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT'];

interface SendItem {
  tokenId: string;
  token: string;
  provider: 'fcm' | 'webpush';
  keys?: WebPushKeys;
  message: PushMessage;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly tenant: TenantContextService,
    @Inject(PUSH_PROVIDER) private readonly provider: PushProvider,
    @Optional() @Inject(WEBPUSH_PROVIDER) private readonly webPush?: PushProvider,
  ) {}

  async dispatch(job: PushJob): Promise<PushDispatchResult> {
    const channels = [
      this.provider.enabled ? 'fcm' : null,
      this.webPush?.enabled ? 'webpush' : null,
    ].filter((c): c is 'fcm' | 'webpush' => c !== null);
    if (channels.length === 0) return { sent: 0, invalid: 0, failed: 0, skipped: 'disabled' };
    if (job.kind === 'commercial.reminder') return this.dispatchCommercialReminder(job, channels);

    let where: Record<string, unknown>;
    if (job.kind === 'bridal.cancelled') {
      if (!job.groupId && !job.contractId) {
        return { sent: 0, invalid: 0, failed: 0, skipped: 'no-scope' };
      }
      where = {
        status: 'cancelled',
        cancelledBy: job.actorMemberId,
        cancelledAt: { gte: new Date(job.since) },
        ...(job.groupId ? { bridalGroupId: job.groupId } : {}),
        ...(job.contractId ? { contractId: job.contractId } : {}),
      };
    } else {
      where = { id: { in: job.appointmentIds } };
    }

    const plan = await this.tenant.runWithTenant(job.orgId, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: job.orgId },
        select: { timezone: true },
      });
      const timezone = org?.timezone ?? DEFAULT_TIMEZONE;

      const rows = await tx.appointment.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        select: {
          id: true,
          professionalId: true,
          startsAt: true,
          professional: { select: { displayName: true } },
          client: { select: { fullName: true } },
          service: { select: { name: true } },
          bridalGroup: {
            select: {
              id: true,
              name: true,
              eventKind: true,
              eventDate: true,
              members: {
                where: { role: 'bride' },
                select: { client: { select: { fullName: true } } },
              },
            },
          },
        },
      });
      if (rows.length === 0) return { skipped: 'no-appointments' as const };

      const managers = await tx.member.findMany({
        where: {
          status: 'active',
          deletedAt: null,
          role: { name: { in: MANAGER_ROLES } },
        },
        select: { id: true },
      });
      const profIds = [...new Set(rows.map((r) => r.professionalId))];
      const activeProfs = await tx.member.findMany({
        where: { id: { in: profIds }, status: 'active', deletedAt: null },
        select: { id: true },
      });

      const views: PushAppointmentView[] = rows.map((r) => ({
        id: r.id,
        professionalId: r.professionalId,
        professionalName: r.professional.displayName,
        clientName: r.client.fullName,
        serviceName: r.service.name,
        startsAt: r.startsAt,
        bridalGroup: r.bridalGroup
          ? {
              id: r.bridalGroup.id,
              name: r.bridalGroup.name,
              eventKind: r.bridalGroup.eventKind,
              eventDate: r.bridalGroup.eventDate,
              brideName: r.bridalGroup.members[0]?.client.fullName ?? null,
            }
          : null,
      }));

      const targets = resolvePushTargets({
        appointments: rows.map((r) => ({ id: r.id, professionalId: r.professionalId })),
        managerMemberIds: managers.map((m) => m.id),
        activeMemberIds: new Set(activeProfs.map((m) => m.id)),
        actorMemberId: job.actorMemberId,
      });
      if (targets.length === 0) return { skipped: 'no-targets' as const };

      const tokens = await tx.deviceToken.findMany({
        where: { memberId: { in: targets.map((t) => t.memberId) }, provider: { in: channels } },
        select: {
          id: true,
          memberId: true,
          token: true,
          provider: true,
          p256dh: true,
          auth: true,
        },
      });

      const items: SendItem[] = [];
      const seen = new Set<string>();
      for (const target of targets) {
        const message = buildPushMessage(
          job.kind,
          target,
          views.filter((v) => target.appointmentIds.includes(v.id)),
          timezone,
        );
        for (const t of tokens.filter((x) => x.memberId === target.memberId)) {
          const provider = t.provider === 'webpush' ? 'webpush' : 'fcm';
          const key = `${provider}:${t.token}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            tokenId: t.id,
            token: t.token,
            provider,
            keys:
              provider === 'webpush' && t.p256dh && t.auth
                ? { p256dh: t.p256dh, auth: t.auth }
                : undefined,
            message,
          });
        }
      }
      return { items };
    });

    if ('skipped' in plan) return { sent: 0, invalid: 0, failed: 0, skipped: plan.skipped };

    return this.sendItems(job.orgId, plan.items);
  }

  /** Lembrete comercial: responsável (ou quem criou) + ADMIN/MANAGER ativos, cada membro uma vez (D-16). */
  private async dispatchCommercialReminder(
    job: Extract<PushJob, { kind: 'commercial.reminder' }>,
    channels: ('fcm' | 'webpush')[],
  ): Promise<PushDispatchResult> {
    const plan = await this.tenant.runWithTenant(job.orgId, async (tx) => {
      const reminder = await tx.commercialReminder.findFirst({
        where: { id: job.reminderId, completedAt: null },
        include: { deal: { include: { lead: true } }, lead: true },
      });
      if (!reminder) return { skipped: 'no-reminder' as const };

      const org = await tx.organization.findUnique({
        where: { id: job.orgId },
        select: { timezone: true },
      });
      const timezone = org?.timezone ?? DEFAULT_TIMEZONE;

      const ownerId = reminder.deal ? reminder.deal.assigneeMemberId : reminder.createdBy;
      const managers = await tx.member.findMany({
        where: { status: 'active', deletedAt: null, role: { name: { in: MANAGER_ROLES } } },
        select: { id: true },
      });
      const candidateIds = [...new Set([...(ownerId ? [ownerId] : []), ...managers.map((m) => m.id)])];
      const eligible = await tx.member.findMany({
        where: {
          id: { in: candidateIds },
          status: 'active',
          deletedAt: null,
          role: { name: { in: COMMERCIAL_ROLES } },
        },
        select: { id: true },
      });
      const memberIds = [...new Set(eligible.map((m) => m.id))];
      if (memberIds.length === 0) return { skipped: 'no-targets' as const };

      const lead = reminder.deal?.lead ?? reminder.lead;
      const eventDate = reminder.deal?.eventDate
        ? reminder.deal.eventDate.toISOString().slice(0, 10)
        : null;
      const message = buildCommercialReminderMessage(
        {
          reminderId: reminder.id,
          title: reminder.title,
          description: reminder.description,
          leadName: lead?.fullName ?? null,
          dealKind: reminder.deal?.kind ?? null,
          eventDate,
        },
        timezone,
      );

      const tokens = await tx.deviceToken.findMany({
        where: { memberId: { in: memberIds }, provider: { in: channels } },
        select: { id: true, memberId: true, token: true, provider: true, p256dh: true, auth: true },
      });
      const items: SendItem[] = [];
      const seen = new Set<string>();
      for (const t of tokens) {
        const provider = t.provider === 'webpush' ? 'webpush' : 'fcm';
        const key = `${provider}:${t.token}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          tokenId: t.id,
          token: t.token,
          provider,
          keys:
            provider === 'webpush' && t.p256dh && t.auth
              ? { p256dh: t.p256dh, auth: t.auth }
              : undefined,
          message,
        });
      }
      return { items };
    });
    if ('skipped' in plan) return { sent: 0, invalid: 0, failed: 0, skipped: plan.skipped };
    return this.sendItems(job.orgId, plan.items);
  }

  private async sendItems(orgId: string, items: SendItem[]): Promise<PushDispatchResult> {
    const results: { item: SendItem; result: PushSendResult }[] = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const slice = items.slice(i, i + CONCURRENCY);
      const done = await Promise.all(
        slice.map(async (item) => {
          let result: PushSendResult;
          try {
            result =
              item.provider === 'webpush'
                ? await this.webPush!.send(item.token, item.message, item.keys)
                : await this.provider.send(item.token, item.message);
          } catch (e) {
            result = { status: 'failed', retryable: true, reason: (e as Error).message };
          }
          return { item, result };
        }),
      );
      results.push(...done);
    }

    let sent = 0;
    let failed = 0;
    const invalidIds: string[] = [];
    let allRetryable = true;
    const credentialLogged = new Set<string>();
    for (const { item, result } of results) {
      if (result.status === 'sent') {
        sent++;
      } else if (result.status === 'invalid_token') {
        invalidIds.push(item.tokenId);
        this.logger.log(`Token inválido removido (…${item.token.slice(-6)}): ${result.reason}`);
      } else {
        failed++;
        if (!result.retryable) {
          allRetryable = false;
          if (/credencial/i.test(result.reason) && !credentialLogged.has(item.provider)) {
            credentialLogged.add(item.provider);
            this.logger.error(
              `Falha de credencial ${item.provider === 'webpush' ? 'Web Push' : 'FCM'}: ${result.reason}`,
            );
          }
        }
        this.logger.warn(`Falha no envio (…${item.token.slice(-6)}): ${result.reason}`);
      }
    }

    if (invalidIds.length > 0) {
      await this.tenant.runWithTenant(orgId, (tx) =>
        tx.deviceToken.deleteMany({ where: { id: { in: invalidIds } } }),
      );
    }

    // Falha parcial (um canal enviou) não reenvia, para não duplicar aviso (mesmo limite da fase 7).
    if (results.length > 0 && sent === 0 && invalidIds.length === 0 && allRetryable) {
      throw new Error('Push indisponível: nova tentativa');
    }
    return { sent, invalid: invalidIds.length, failed };
  }}
