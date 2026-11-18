/**
 * Gates de UI do Comercial (fase 9). Espelham as permissões commercial.* do
 * backend (apps/backend/src/authz/permissions.catalog.ts).
 *
 * Mesmo padrão de bridal-permissions.ts: o gate é por `roleName`. Quem protege de
 * verdade é a API; aqui é só conforto de UI.
 */
import { useAuthStore } from '@/infrastructure/stores/auth.store';

/** D-11: papéis que acessam o Comercial (com ou sem isProfessional). */
export const COMMERCIAL_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT'] as const;

export const COMMERCIAL_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  ADMIN: ['commercial.read', 'commercial.write', 'commercial.manage'],
  MANAGER: ['commercial.read', 'commercial.write', 'commercial.manage'],
  ATTENDANT: ['commercial.read', 'commercial.write'],
  PROFESSIONAL: [],
};

/**
 * D-21 (confirmada pela usuária em 2026-11-18): espelha WIN_DEAL_ROLES de
 * apps/backend/src/commercial/commercial-access.ts; para 'só admin/gerente',
 * trocar nos dois arquivos.
 */
export const WIN_DEAL_ROLES: readonly string[] = ['ADMIN', 'MANAGER', 'ATTENDANT'];

export function canUseCommercial(roleName: string | null | undefined): boolean {
  return roleName != null && (COMMERCIAL_ROLES as readonly string[]).includes(roleName);
}

/** D-13: configurar etapas, excluir, trocar responsável e ver relatórios. */
export function isCommercialManager(roleName: string | null | undefined): boolean {
  return roleName === 'ADMIN' || roleName === 'MANAGER';
}

export function canWinDeal(roleName: string | null | undefined): boolean {
  return roleName != null && WIN_DEAL_ROLES.includes(roleName);
}

export function useCommercialAccess() {
  const roleName = useAuthStore((s) => s.roleName);
  const memberId = useAuthStore((s) => s.memberId);
  return {
    roleName,
    memberId,
    canUse: canUseCommercial(roleName),
    isManager: isCommercialManager(roleName),
    canWin: canWinDeal(roleName),
  };
}
