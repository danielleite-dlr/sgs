import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../database/tenant-context.service';

/**
 * MembersService — lists active members of the current organization.
 * Used by the frontend commission rule picker (Phase 2) and future schedule UI.
 */
@Injectable()
export class MembersService {
  constructor(private readonly tenant: TenantContextService) {}

  /**
   * Returns all active (non-deleted) members of the given organization,
   * ordered alphabetically by displayName.
   */
  async listActive(orgId: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.member
        .findMany({
          where: { organizationId: orgId, deletedAt: null },
          select: {
            id: true,
            displayName: true,
            seniorityTier: true,
            createdAt: true,
            user: { select: { email: true } },
            role: { select: { name: true } },
          },
          orderBy: { displayName: 'asc' },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            displayName: r.displayName,
            email: r.user.email,
            roleName: r.role?.name ?? 'UNKNOWN',
            seniorityTier: r.seniorityTier ?? null,
            createdAt: r.createdAt,
          })),
        ),
    );
  }
}
