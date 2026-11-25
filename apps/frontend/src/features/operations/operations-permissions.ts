/**
 * Gates de UI das telas da Fase 3. Espelham ROLE_PERMISSIONS em
 * apps/backend/src/authz/permissions.catalog.ts (somente as permissões usadas
 * pelas telas de operação).
 *
 * Fase 10: a fonte é `myAccess` (permissões efetivas, com os ajustes por
 * pessoa). O espelho por papel abaixo só vale até a primeira leitura, ou se a
 * leitura falhar. Papel desconhecido/ausente não tem permissão alguma.
 */
import { useAuthStore } from '@/infrastructure/stores/auth.store';

const COMANDA_FULL = ['comanda.read', 'comanda.write', 'comanda.close'];
/** Cadastro rápido de cliente no agendamento (CLIENT_WRITE no backend). */
const CLIENT_WRITE = 'client.write';

const ROLE_OPERATION_PERMISSIONS: Record<string, readonly string[]> = {
  ADMIN: [
    ...COMANDA_FULL,
    CLIENT_WRITE,
    'comanda.reopen',
    'credit.read',
    'credit.adjust',
    'financial.read',
    'commissionRecord.read',
    'commission.write',
    'financial.expenseWrite',
  ],
  MANAGER: [
    ...COMANDA_FULL,
    CLIENT_WRITE,
    'comanda.reopen',
    'credit.read',
    'credit.adjust',
    'financial.read',
    'commissionRecord.read',
    'financial.expenseWrite',
  ],
  ATTENDANT: [...COMANDA_FULL, CLIENT_WRITE, 'credit.read'],
  PROFESSIONAL: ['comanda.read', 'commissionRecord.read'],
};

export function roleHasPermission(
  roleName: string | null | undefined,
  permission: string,
): boolean {
  if (roleName == null) return false;
  return ROLE_OPERATION_PERMISSIONS[roleName]?.includes(permission) ?? false;
}

/** Permissão efetiva (myAccess); sem myAccess, cai no espelho por papel. */
export function useHasPermission(permission: string): boolean {
  const access = useAuthStore((s) => s.access);
  const permissions = useAuthStore((s) => s.permissions);
  const roleName = useAuthStore((s) => s.roleName);
  if (access) return access.permissions.includes(permission);
  return permissions.includes(permission) || roleHasPermission(roleName, permission);
}
