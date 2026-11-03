/**
 * Gates de UI das telas da Fase 3. Espelham ROLE_PERMISSIONS em
 * apps/backend/src/authz/permissions.catalog.ts (somente as permissões usadas
 * pelas telas de operação).
 *
 * `permissions` do auth store nunca é populado pelo login (ver
 * identity/team-permissions.ts), então o gate é por `roleName`; a lista do
 * store continua valendo quando preenchida (testes e futura sessão completa).
 * Papel desconhecido/ausente não tem permissão alguma.
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
  ],
  MANAGER: [
    ...COMANDA_FULL,
    CLIENT_WRITE,
    'comanda.reopen',
    'credit.read',
    'credit.adjust',
    'financial.read',
    'commissionRecord.read',
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

/** true se a permissão veio na sessão (store) ou é concedida ao papel atual. */
export function useHasPermission(permission: string): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  const roleName = useAuthStore((s) => s.roleName);
  return permissions.includes(permission) || roleHasPermission(roleName, permission);
}
