/**
 * Gates de UI das telas de noivas e contratos (Fase 4). Espelham ROLE_PERMISSIONS
 * em apps/backend/src/authz/permissions.catalog.ts (plano 04-01).
 *
 * Mesmo padrão de operations-permissions.ts. Fase 10: a fonte é `myAccess`; o
 * espelho por papel só vale até a primeira leitura. Papel desconhecido/ausente
 * não tem permissão alguma.
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
  'bridal.scheduleOverride',
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

/** Permissão efetiva (myAccess); sem myAccess, cai no espelho por papel. */
export function useBridalPermission(permission: string): boolean {
  const access = useAuthStore((s) => s.access);
  const permissions = useAuthStore((s) => s.permissions);
  const roleName = useAuthStore((s) => s.roleName);
  if (access) return access.permissions.includes(permission);
  return permissions.includes(permission) || roleHasBridalPermission(roleName, permission);
}
