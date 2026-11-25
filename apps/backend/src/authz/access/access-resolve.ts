/**
 * Resolução do acesso efetivo de uma pessoa (função pura, sem I/O).
 * Padrão do papel + overrides por item (ganho/negação), com Admin intocável.
 */
import {
  ACCESS_GATES,
  ACCESS_ITEMS,
  type AccessGateName,
  type AccessItemDef,
} from './access-catalog';

export type AccessSource = 'DEFAULT' | 'GRANTED' | 'DENIED';

export interface ResolvedItem {
  id: string;
  enabled: boolean;
  defaultEnabled: boolean;
  source: AccessSource;
  permissions: ReadonlySet<string>;
}

export interface ResolvedAccess {
  roleName: string;
  rolePermissions: ReadonlySet<string>;
  items: ReadonlyMap<string, ResolvedItem>;
  /** rolePermissions ∪ managerPermissions dos itens GANHOS (gates de UI e máscaras). */
  permissions: ReadonlySet<string>;
}

/** Papéis que não recebem item com `grantable: false`. */
export const LOCKED_ROLES = ['ATTENDANT', 'PROFESSIONAL'] as const;

export function defaultEnabledFor(
  item: AccessItemDef,
  rolePermissions: ReadonlySet<string>,
): boolean {
  return item.requires.every((p) => rolePermissions.has(p));
}

export function resolveAccess(input: {
  roleName: string;
  rolePermissions: Iterable<string>;
  overrides: ReadonlyArray<{ itemId: string; enabled: boolean }>;
}): ResolvedAccess {
  const rolePermissions = new Set<string>(input.rolePermissions);
  const isAdmin = input.roleName === 'ADMIN';
  const locked = (LOCKED_ROLES as readonly string[]).includes(input.roleName);

  const overrideById = new Map<string, boolean>();
  for (const o of input.overrides) overrideById.set(o.itemId, o.enabled);

  const items = new Map<string, ResolvedItem>();
  const permissions = new Set<string>(rolePermissions);

  for (const def of ACCESS_ITEMS) {
    if (isAdmin) {
      items.set(def.id, {
        id: def.id,
        enabled: true,
        defaultEnabled: true,
        source: 'DEFAULT',
        permissions: rolePermissions,
      });
      continue;
    }

    const defaultEnabled = defaultEnabledFor(def, rolePermissions);
    let override = overrideById.get(def.id);
    if (override === true && !def.grantable && locked) override = undefined;
    if (override === defaultEnabled) override = undefined;

    if (override === undefined) {
      items.set(def.id, {
        id: def.id,
        enabled: defaultEnabled,
        defaultEnabled,
        source: 'DEFAULT',
        permissions: defaultEnabled ? rolePermissions : new Set<string>(),
      });
    } else if (override) {
      const granted = new Set<string>([
        ...rolePermissions,
        ...def.managerPermissions,
      ]);
      for (const p of granted) permissions.add(p);
      items.set(def.id, {
        id: def.id,
        enabled: true,
        defaultEnabled,
        source: 'GRANTED',
        permissions: granted,
      });
    } else {
      items.set(def.id, {
        id: def.id,
        enabled: false,
        defaultEnabled,
        source: 'DENIED',
        permissions: new Set<string>(),
      });
    }
  }

  return { roleName: input.roleName, rolePermissions, items, permissions };
}

/** Une, sem repetição, ids de itens e nomes de porteiros; nomes desconhecidos somem. */
export function expandGates(idsOrGates: readonly string[]): string[] {
  const out = new Set<string>();
  for (const name of idsOrGates) {
    const gate = ACCESS_GATES[name as AccessGateName];
    if (gate) {
      for (const id of gate) out.add(id);
    } else if (ACCESS_ITEMS.some((i) => i.id === name)) {
      out.add(name);
    }
  }
  return [...out];
}

export type AccessCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'ITEM_DISABLED' | 'MISSING_PERMISSIONS';
      missing: string[];
    };

export function checkAccess(
  access: ResolvedAccess,
  gates: readonly string[],
  required: readonly string[],
): AccessCheck {
  if (gates.length === 0) {
    const missing = required.filter((p) => !access.rolePermissions.has(p));
    return missing.length === 0
      ? { ok: true }
      : { ok: false, reason: 'MISSING_PERMISSIONS', missing };
  }

  const enabled = expandGates(gates)
    .map((id) => access.items.get(id))
    .filter((i): i is ResolvedItem => !!i && i.enabled);

  if (enabled.length === 0) {
    return { ok: false, reason: 'ITEM_DISABLED', missing: [...required] };
  }

  let firstMissing: string[] | null = null;
  for (const item of enabled) {
    const missing = required.filter((p) => !item.permissions.has(p));
    if (missing.length === 0) return { ok: true };
    firstMissing ??= missing;
  }
  return {
    ok: false,
    reason: 'MISSING_PERMISSIONS',
    missing: firstMissing ?? [],
  };
}

export function isGranted(access: ResolvedAccess, itemId: string): boolean {
  return access.items.get(itemId)?.source === 'GRANTED';
}

/** Vê custo/margem (PERM-07): package.write OU service.write OU financial.read. */
export function hasCostVisibility(access: ResolvedAccess): boolean {
  const p = access.permissions;
  return (
    p.has('package.write') || p.has('service.write') || p.has('financial.read')
  );
}
