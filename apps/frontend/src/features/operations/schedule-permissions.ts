/**
 * Gates de UI da agenda. Espelham ROLE_PERMISSIONS em
 * apps/backend/src/authz/permissions.catalog.ts:
 *  - appointment.write -> ADMIN, MANAGER, ATTENDANT
 *  - PROFESSIONAL só lê, e o backend limita a listagem aos atendimentos em
 *    que ele é o responsável (appointments.resolver.ts).
 * Platform admin impersonando chega como 'ADMIN'.
 */
const WRITE_ROLES: readonly string[] = ["ADMIN", "MANAGER", "ATTENDANT"];

/** Pode criar agendamentos (appointment.write). */
export function canWriteAppointments(
  roleName: string | null | undefined,
): boolean {
  return roleName != null && WRITE_ROLES.includes(roleName);
}

/** Só enxerga os próprios atendimentos. */
export function seesOnlyOwnAppointments(
  roleName: string | null | undefined,
): boolean {
  return roleName === "PROFESSIONAL";
}
