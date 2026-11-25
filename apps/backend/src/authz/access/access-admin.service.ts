import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import type { TenantPrismaClient } from '../../database/types';
import { recordAudit } from '../../common/audit-log';
import {
  ACCESS_ITEMS,
  ACCESS_ITEM_IDS,
  type AccessItemDef,
} from './access-catalog';
import {
  LOCKED_ROLES,
  defaultEnabledFor,
  resolveAccess,
  type ResolvedAccess,
} from './access-resolve';
import {
  EXCEEDS_ACTOR_MESSAGE,
  NOT_GRANTABLE_MESSAGE,
  itemAdjustability,
  targetLock,
} from './access-admin-rules';
import type { LoadedAccess } from './access.service';

export interface UserErrorDto {
  code: string;
  message: string;
  field: string | null;
}

export interface MemberAccessDto {
  memberId: string;
  displayName: string;
  roleName: string;
  editable: boolean;
  lockReason: string | null;
  items: {
    id: string;
    label: string;
    group: string;
    groupLabel: string;
    enabled: boolean;
    defaultEnabled: boolean;
    source: 'DEFAULT' | 'GRANTED' | 'DENIED';
    adjustable: boolean;
    lockReason: string | null;
    permissions: string[];
  }[];
  adjustedCount: number;
}

export interface SetMemberAccessPayload {
  access: MemberAccessDto | null;
  errors: UserErrorDto[];
}

export interface AccessChange {
  itemId: string;
  enabled: boolean;
}

interface TargetRow {
  id: string;
  displayName: string;
  role: { name: string; permissions: { permission: string }[] };
  accessOverrides: { itemId: string; enabled: boolean }[];
}

const err = (
  code: string,
  message: string,
  field?: string,
): SetMemberAccessPayload => ({
  access: null,
  errors: [{ code, message, field: field ?? null }],
});

async function loadTarget(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
): Promise<TargetRow | null> {
  return (await tx.member.findFirst({
    where: {
      id: memberId,
      organizationId: orgId,
      deletedAt: null,
      status: 'active',
    },
    select: {
      id: true,
      displayName: true,
      role: {
        select: { name: true, permissions: { select: { permission: true } } },
      },
      accessOverrides: { select: { itemId: true, enabled: true } },
    },
  })) as TargetRow | null;
}

function resolveTarget(t: TargetRow): ResolvedAccess {
  return resolveAccess({
    roleName: t.role.name,
    rolePermissions: t.role.permissions.map((p) => p.permission),
    overrides: t.accessOverrides,
  });
}

function buildView(
  actor: LoadedAccess,
  target: TargetRow,
  resolved: ResolvedAccess,
): MemberAccessDto {
  const lock = targetLock({
    actorRole: actor.roleName,
    actorId: actor.memberId,
    targetRole: target.role.name,
    targetId: target.id,
  });
  const items = ACCESS_ITEMS.flatMap((def) => {
    const r = resolved.items.get(def.id);
    if (!r) return [];
    const adj = lock
      ? { adjustable: false, lockReason: lock.message }
      : itemAdjustability(actor, target.role.name, def, r.enabled);
    return [
      {
        id: def.id,
        label: def.label,
        group: def.group,
        groupLabel: def.groupLabel,
        enabled: r.enabled,
        defaultEnabled: r.defaultEnabled,
        source: r.source,
        adjustable: adj.adjustable,
        lockReason: adj.lockReason,
        permissions: [...r.permissions].sort(),
      },
    ];
  });
  return {
    memberId: target.id,
    displayName: target.displayName,
    roleName: target.role.name,
    editable: lock === null,
    lockReason: lock?.message ?? null,
    items,
    adjustedCount: target.accessOverrides.length,
  };
}

@Injectable()
export class AccessAdminService {
  constructor(private readonly tenant: TenantContextService) {}

  async memberAccess(
    orgId: string,
    actor: LoadedAccess,
    memberId: string,
  ): Promise<MemberAccessDto> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const target = await loadTarget(tx, orgId, memberId);
      if (!target) throw new NotFoundException('Pessoa não encontrada.');
      return buildView(actor, target, resolveTarget(target));
    });
  }

  async overview(
    orgId: string,
  ): Promise<{ memberId: string; adjustedCount: number }[]> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const rows = await tx.member.findMany({
        where: { organizationId: orgId, deletedAt: null, status: 'active' },
        select: { id: true, _count: { select: { accessOverrides: true } } },
      });
      return rows.map((r) => ({
        memberId: r.id,
        adjustedCount: r._count.accessOverrides,
      }));
    });
  }

  async set(
    orgId: string,
    actor: LoadedAccess,
    input: { memberId: string; changes: AccessChange[] },
  ): Promise<SetMemberAccessPayload> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const target = await loadTarget(tx, orgId, input.memberId);
      if (!target) return err('MEMBER_NOT_FOUND', 'Pessoa não encontrada.');

      const lock = targetLock({
        actorRole: actor.roleName,
        actorId: actor.memberId,
        targetRole: target.role.name,
        targetId: target.id,
      });
      if (lock) return err(lock.code, lock.message, 'memberId');

      const resolved = resolveTarget(target);
      const rolePerms = new Set(target.role.permissions.map((p) => p.permission));
      const locked = (LOCKED_ROLES as readonly string[]).includes(
        target.role.name,
      );

      // Último valor vence quando o mesmo item aparece mais de uma vez.
      const byItem = new Map<string, boolean>();
      for (const c of input.changes) byItem.set(c.itemId, c.enabled);

      const effective: {
        def: AccessItemDef;
        from: boolean;
        to: boolean;
      }[] = [];
      for (const [itemId, enabled] of byItem) {
        if (!ACCESS_ITEM_IDS.has(itemId)) {
          return err('ACCESS_ITEM_UNKNOWN', 'Item de acesso desconhecido.', 'changes');
        }
        const def = ACCESS_ITEMS.find((i) => i.id === itemId)!;
        const from = resolved.items.get(itemId)?.enabled === true;
        if (from === enabled) continue;
        if (enabled) {
          if (!def.grantable && locked) {
            return err('ACCESS_ITEM_NOT_GRANTABLE', NOT_GRANTABLE_MESSAGE, 'changes');
          }
          if (actor.roleName !== 'ADMIN' && actor.items.get(itemId)?.enabled !== true) {
            return err('ACCESS_GRANT_EXCEEDS_ACTOR', EXCEEDS_ACTOR_MESSAGE, 'changes');
          }
        }
        effective.push({ def, from, to: enabled });
      }

      for (const { def, to } of effective) {
        if (to === defaultEnabledFor(def, rolePerms)) {
          await tx.memberAccessOverride.deleteMany({
            where: { memberId: target.id, itemId: def.id },
          });
        } else {
          await tx.memberAccessOverride.upsert({
            where: { memberId_itemId: { memberId: target.id, itemId: def.id } },
            create: {
              memberId: target.id,
              organizationId: orgId,
              itemId: def.id,
              enabled: to,
              updatedBy: actor.memberId,
            },
            update: {
              enabled: to,
              updatedBy: actor.memberId,
              updatedAt: new Date(),
            },
          });
        }
      }

      if (effective.length > 0) {
        await recordAudit(tx, {
          orgId,
          actorMemberId: actor.memberId,
          action: 'member.access.update',
          entityType: 'member',
          entityId: target.id,
          metadata: {
            actorRole: actor.roleName,
            targetRole: target.role.name,
            changes: effective.map((e) => ({
              itemId: e.def.id,
              from: e.from,
              to: e.to,
            })),
          },
        });
      }

      const fresh = await loadTarget(tx, orgId, target.id);
      return {
        access: buildView(actor, fresh!, resolveTarget(fresh!)),
        errors: [],
      };
    });
  }

  async reset(
    orgId: string,
    actor: LoadedAccess,
    memberId: string,
  ): Promise<SetMemberAccessPayload> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const target = await loadTarget(tx, orgId, memberId);
      if (!target) return err('MEMBER_NOT_FOUND', 'Pessoa não encontrada.');

      const lock = targetLock({
        actorRole: actor.roleName,
        actorId: actor.memberId,
        targetRole: target.role.name,
        targetId: target.id,
      });
      if (lock) return err(lock.code, lock.message, 'memberId');

      const removed = target.accessOverrides.map((o) => ({
        itemId: o.itemId,
        enabled: o.enabled,
      }));
      if (removed.length > 0) {
        await tx.memberAccessOverride.deleteMany({
          where: { memberId: target.id },
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: actor.memberId,
          action: 'member.access.reset',
          entityType: 'member',
          entityId: target.id,
          metadata: {
            reason: 'manual',
            actorRole: actor.roleName,
            targetRole: target.role.name,
            removed,
          },
        });
      }

      const fresh = await loadTarget(tx, orgId, target.id);
      return {
        access: buildView(actor, fresh!, resolveTarget(fresh!)),
        errors: [],
      };
    });
  }
}
