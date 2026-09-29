/**
 * Gates de UI para as acoes de equipe. Espelham ROLE_PERMISSIONS em
 * apps/backend/src/authz/permissions.catalog.ts:
 *  - member.invite            -> ADMIN, MANAGER
 *  - member.editRole/.remove  -> ADMIN
 *
 * `permissions` do auth store nunca e populado, por isso o gate e por
 * `roleName`. Platform admin impersonando chega como 'ADMIN'. Comparacao exata
 * e sem fallback permissivo: papel desconhecido/ausente nao ve nenhuma acao.
 */
const INVITE_ROLES: readonly string[] = ['ADMIN', 'MANAGER'];
const MANAGE_ROLES: readonly string[] = ['ADMIN'];

/** Convidar e revogar convites (member.invite). */
export function canInviteMembers(roleName: string | null | undefined): boolean {
  return roleName != null && INVITE_ROLES.includes(roleName);
}

/** Editar, desativar e reativar membros (member.editRole / member.remove). */
export function canManageMembers(roleName: string | null | undefined): boolean {
  return roleName != null && MANAGE_ROLES.includes(roleName);
}
