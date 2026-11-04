/**
 * Gates de UI das telas de noivas e contratos (Fase 4). Espelham ROLE_PERMISSIONS
 * em apps/backend/src/authz/permissions.catalog.ts (plano 04-01).
 *
 * Mesmo padrão de operations-permissions.ts: `permissions` do auth store nunca é
 * populado pelo login, então o gate é por `roleName`; a lista do store continua
 * valendo quando preenchida. Papel desconhecido/ausente não tem permissão alguma.
 */
import { useAuthStore } from '@/infrastructure/stores/auth.store';

const ATTENDANT_PERMISSIONS = ['bridal.read', 'bridal.write', 'contract.read', 'contract.payment'];

const MANAGER_PERMISSIONS = [
  'bridal.read',
  'bridal.write',
  'bridal.aiSuggest',
  'contract.read',
  'contract.write',
  'contract.payment',
  'contract.cancel',
];

export const BRIDAL_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  ADMIN: [...MANAGER_PERMISSIONS, 'contract.settings'],
  MANAGER: MANAGER_PERMISSIONS,
  ATTENDANT: ATTENDANT_PERMISSIONS,
  PROFESSIONAL: [],
};

export function roleHasBridalPermission(
  roleName: string | null | undefined,
  permission: string,
): boolean {
  if (roleName == null) return false;
  return BRIDAL_ROLE_PERMISSIONS[roleName]?.includes(permission) ?? false;
}

/** true se a permissão veio na sessão (store) ou é concedida ao papel atual. */
export function useBridalPermission(permission: string): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  const roleName = useAuthStore((s) => s.roleName);
  return permissions.includes(permission) || roleHasBridalPermission(roleName, permission);
}
