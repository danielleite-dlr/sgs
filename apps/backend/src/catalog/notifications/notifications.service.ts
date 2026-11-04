import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly tenant: TenantContextService) {}

  /**
   * Lists notifications visible to the current member.
   * Returns org-wide notifications (memberId IS NULL) and member-specific ones.
   * Default: unread only (unreadOnly = true).
   */
  async list(orgId: string, memberId: string, unreadOnly = true) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.notification.findMany({
        where: {
          OR: [{ memberId }, { memberId: null }],
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  /**
   * Marks a notification as read (sets read_at to now).
   * Only notifications visible to the member (own or org-wide) can be marked;
   * otherwise NotFoundException.
   */
  async markRead(orgId: string, memberId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const { count } = await tx.notification.updateMany({
        where: { id, OR: [{ memberId }, { memberId: null }] },
        data: { readAt: new Date() },
      });
      if (count === 0) throw new NotFoundException('Notificação não encontrada');
      return tx.notification.findUniqueOrThrow({ where: { id } });
    });
  }

  /** Marks all unread notifications visible to the member as read; returns how many. */
  async markAllRead(orgId: string, memberId: string): Promise<number> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const { count } = await tx.notification.updateMany({
        where: { readAt: null, OR: [{ memberId }, { memberId: null }] },
        data: { readAt: new Date() },
      });
      return count;
    });
  }

  /**
   * Count of unread notifications for the current member (org-wide + member-specific).
   * Used for sidebar badge count.
   */
  async unreadCount(orgId: string, memberId: string): Promise<number> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const count = await tx.notification.count({
        where: {
          OR: [{ memberId }, { memberId: null }],
          readAt: null,
        },
      });
      return count;
    });
  }
}
