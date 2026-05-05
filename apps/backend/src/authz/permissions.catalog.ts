/**
 * Phase 1 permission catalog.
 * Pattern: <resource>.<action>
 * Add new permissions in the resource's bounded-context module in later phases.
 */
export const PERMISSIONS = {
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',

  MEMBER_READ: 'member.read',
  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_EDIT_ROLE: 'member.editRole',

  ROLE_READ: 'role.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permission set per system role.
 * ADMIN gets everything, others get progressively narrower scopes.
 * Materialized into role_permissions table by the seed migration.
 */
export const ROLE_PERMISSIONS: Record<
  'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL',
  Permission[]
> = {
  ADMIN: [
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_UPDATE,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.MEMBER_EDIT_ROLE,
    PERMISSIONS.ROLE_READ,
  ],
  MANAGER: [
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.ROLE_READ,
  ],
  ATTENDANT: [PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.MEMBER_READ],
  PROFESSIONAL: [PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.MEMBER_READ],
};
