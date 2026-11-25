import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import type { TenantPrismaClient } from '../../database/types';
import type { TenantContext } from '../decorators/current-tenant.decorator';
import { resolveAccess, type ResolvedAccess } from './access-resolve';

export interface LoadedAccess extends ResolvedAccess {
  memberId: string;
  organizationId: string;
}

export interface AccessGqlContext {
  tenant?: TenantContext;
  access?: LoadedAccess | null;
  accessPromise?: Promise<LoadedAccess | null>;
}

const ACCESS_SELECT = {
  id: true,
  role: {
    select: { name: true, permissions: { select: { permission: true } } },
  },
  accessOverrides: { select: { itemId: true, enabled: true } },
} as const;

interface MemberRow {
  id: string;
  role: { name: string; permissions: { permission: string }[] };
  accessOverrides: { itemId: string; enabled: boolean }[];
}

function toResolved(row: MemberRow): ResolvedAccess {
  return resolveAccess({
    roleName: row.role.name,
    rolePermissions: row.role.permissions.map((p) => p.permission),
    overrides: row.accessOverrides,
  });
}

/** Acesso efetivo de cada membro ativo informado (uma consulta só). */
export async function loadAccessManyTx(
  tx: TenantPrismaClient,
  memberIds: readonly string[],
): Promise<Map<string, ResolvedAccess>> {
  const out = new Map<string, ResolvedAccess>();
  if (memberIds.length === 0) return out;
  const rows = (await tx.member.findMany({
    where: {
      id: { in: [...memberIds] },
      deletedAt: null,
      status: 'active',
    },
    select: ACCESS_SELECT,
  })) as MemberRow[];
  for (const row of rows) out.set(row.id, toResolved(row));
  return out;
}

/** Subconjunto de membros ativos com o item ligado (push/alertas/jobs). */
export async function membersWithItemTx(
  tx: TenantPrismaClient,
  memberIds: readonly string[],
  itemId: string,
): Promise<Set<string>> {
  const many = await loadAccessManyTx(tx, memberIds);
  const out = new Set<string>();
  for (const [id, access] of many) {
    if (access.items.get(itemId)?.enabled) out.add(id);
  }
  return out;
}

@Injectable()
export class AccessService {
  constructor(private readonly tenant: TenantContextService) {}

  /** Lê do banco (RLS) papel, status e ajustes; null se o membro não está ativo. */
  async load(orgId: string, memberId: string): Promise<LoadedAccess | null> {
    return this.tenant.runWithTenant(orgId, (tx) =>
      this.loadTx(tx, orgId, memberId),
    );
  }

  /** Mesma leitura dentro de uma transação já com tenant. */
  async loadTx(
    tx: TenantPrismaClient,
    orgId: string,
    memberId: string,
  ): Promise<LoadedAccess | null> {
    const row = (await tx.member.findFirst({
      where: {
        id: memberId,
        organizationId: orgId,
        deletedAt: null,
        status: 'active',
      },
      select: ACCESS_SELECT,
    })) as MemberRow | null;
    if (!row) return null;
    return { ...toResolved(row), memberId, organizationId: orgId };
  }

  /** Memoiza por requisição HTTP em gqlCtx.accessPromise. Exige gqlCtx.tenant. */
  forContext(gqlCtx: AccessGqlContext): Promise<LoadedAccess | null> {
    if (!gqlCtx.accessPromise) {
      const tenant = gqlCtx.tenant;
      if (!tenant) {
        return Promise.reject(
          new Error('AccessService: sem tenant no contexto'),
        );
      }
      gqlCtx.accessPromise = this.load(
        tenant.organizationId,
        tenant.memberId,
      ).then((a) => {
        gqlCtx.access = a;
        return a;
      });
    }
    return gqlCtx.accessPromise;
  }

  /** Subconjunto de memberIds com o item ligado (PERM-12). */
  async membersWithItem(
    tx: TenantPrismaClient,
    memberIds: readonly string[],
    itemId: string,
  ): Promise<Set<string>> {
    return membersWithItemTx(tx, memberIds, itemId);
  }
}
