/**
 * Gates de UI do Comercial (fase 9). Espelham as permissões commercial.* do
 * backend (apps/backend/src/authz/permissions.catalog.ts).
 *
 * Quem protege de verdade é a API; aqui é só conforto de UI. Antes da primeira leitura
 * de myAccess o gate é por `roleName`; depois, pelos itens de acesso (fase 10).
 */
import { hasAccessIn, useAccess, useItemPermission } from '@/features/access/access-hooks';
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

const COMMERCIAL_ITEMS = [
  'comercial-painel',
  'comercial-leads',
  'comercial-pipeline',
  'comercial-lembretes',
  'comercial-relatorios',
  'comercial-config',
] as const;

/**
 * Fase 10 (D-05): com o acesso lido (myAccess), `canUse` e `isManager` seguem os itens
 * comercial-* ligados; o espelho por papel vale só até a primeira leitura.
 */
export function useCommercialAccess() {
  const roleName = useAuthStore((s) => s.roleName);
  const memberId = useAuthStore((s) => s.memberId);
  const access = useAccess();
  const manageLeads = useItemPermission('comercial-leads', 'commercial.manage');
  const managePipeline = useItemPermission('comercial-pipeline', 'commercial.manage');
  if (!access) {
    return {
      roleName,
      memberId,
      canUse: canUseCommercial(roleName),
      isManager: isCommercialManager(roleName),
      canWin: canWinDeal(roleName),
    };
  }
  const canUse = COMMERCIAL_ITEMS.some((id) => hasAccessIn(access, id));
  const isManager = manageLeads || managePipeline;
  return { roleName, memberId, canUse, isManager, canWin: canUse && (isManager || canWinDeal(roleName)) };
}
