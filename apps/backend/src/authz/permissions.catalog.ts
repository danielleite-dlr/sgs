/**
 * Permission catalog — typed source of truth for resource-level access control.
 * Pattern: <resource>.<action>
 * Phase 1: organization, member, role permissions.
 * Phase 2: category, service, package, product, commission, client, notification permissions.
 * Phase 3: comanda, credit, financial, commissionRecord permissions (migration 20261101000000_phase3_operations).
 * Materialized into role_permissions table by seed migrations.
 */
export const PERMISSIONS = {
  // ===== Phase 1: Identity & Organization =====
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',

  MEMBER_READ: 'member.read',
  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_EDIT_ROLE: 'member.editRole',

  ROLE_READ: 'role.read',

  // ===== Phase 2: Catalog =====
  CATEGORY_READ: 'category.read',
  CATEGORY_WRITE: 'category.write',

  SERVICE_READ: 'service.read',
  SERVICE_WRITE: 'service.write',

  PACKAGE_READ: 'package.read',
  PACKAGE_WRITE: 'package.write',

  PRODUCT_READ: 'product.read',
  PRODUCT_WRITE: 'product.write',
  PRODUCT_ADJUST_STOCK: 'product.adjustStock',

  COMMISSION_READ: 'commission.read',
  COMMISSION_WRITE: 'commission.write',

  // ===== Phase 2: Clients =====
  CLIENT_READ: 'client.read',
  CLIENT_WRITE: 'client.write',

  // ===== Phase 3: Appointments =====
  APPOINTMENT_READ: 'appointment.read',
  APPOINTMENT_WRITE: 'appointment.write',

  // ===== Phase 2: Notifications =====
  NOTIFICATION_READ: 'notification.read',

  // ===== Phase 3: Operations =====
  COMANDA_READ: 'comanda.read',
  COMANDA_WRITE: 'comanda.write',
  COMANDA_CLOSE: 'comanda.close',
  COMANDA_REOPEN: 'comanda.reopen',
  CREDIT_READ: 'credit.read',
  CREDIT_ADJUST: 'credit.adjust',
  FINANCIAL_READ: 'financial.read',
  COMMISSION_RECORD_READ: 'commissionRecord.read',

  // ===== Phase 4: Bridal & Contracts =====
  BRIDAL_READ: 'bridal.read',
  BRIDAL_WRITE: 'bridal.write',
  BRIDAL_AI_SUGGEST: 'bridal.aiSuggest',
  CONTRACT_READ: 'contract.read',
  CONTRACT_WRITE: 'contract.write',
  CONTRACT_PAYMENT: 'contract.payment',
  CONTRACT_CANCEL: 'contract.cancel',
  CONTRACT_SETTINGS: 'contract.settings',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permission set per system role.
 * ADMIN gets everything; other roles get progressively narrower scopes.
 * Materialized into role_permissions table by the seed migration.
 * Phase 1: 20260502010000_seed_role_permissions
 * Phase 2: 20260506010000_seed_phase2_permissions
 * Phase 3: 20261101000000_phase3_operations
 * Phase 4: 20261103000000_phase4_bridal_contracts
 */
export const ROLE_PERMISSIONS: Record<
  'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL',
  Permission[]
> = {
  ADMIN: [
    // Phase 1
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_UPDATE,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.MEMBER_EDIT_ROLE,
    PERMISSIONS.ROLE_READ,
    // Phase 2 — 14 new permissions
    PERMISSIONS.CATEGORY_READ,
    PERMISSIONS.CATEGORY_WRITE,
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_WRITE,
    PERMISSIONS.PACKAGE_READ,
    PERMISSIONS.PACKAGE_WRITE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_WRITE,
    PERMISSIONS.PRODUCT_ADJUST_STOCK,
    PERMISSIONS.COMMISSION_READ,
    PERMISSIONS.COMMISSION_WRITE,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_WRITE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.APPOINTMENT_WRITE,
    // Phase 3 — operations
    PERMISSIONS.COMANDA_READ,
    PERMISSIONS.COMANDA_WRITE,
    PERMISSIONS.COMANDA_CLOSE,
    PERMISSIONS.COMANDA_REOPEN,
    PERMISSIONS.CREDIT_READ,
    PERMISSIONS.CREDIT_ADJUST,
    PERMISSIONS.FINANCIAL_READ,
    PERMISSIONS.COMMISSION_RECORD_READ,
    // Phase 4 — bridal & contracts
    PERMISSIONS.BRIDAL_READ,
    PERMISSIONS.BRIDAL_WRITE,
    PERMISSIONS.BRIDAL_AI_SUGGEST,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_WRITE,
    PERMISSIONS.CONTRACT_PAYMENT,
    PERMISSIONS.CONTRACT_CANCEL,
    PERMISSIONS.CONTRACT_SETTINGS,
  ],
  MANAGER: [
    // Phase 1
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.ROLE_READ,
    // Phase 2 — 13 new permissions (no COMMISSION_WRITE)
    PERMISSIONS.CATEGORY_READ,
    PERMISSIONS.CATEGORY_WRITE,
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_WRITE,
    PERMISSIONS.PACKAGE_READ,
    PERMISSIONS.PACKAGE_WRITE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_WRITE,
    PERMISSIONS.PRODUCT_ADJUST_STOCK,
    PERMISSIONS.COMMISSION_READ,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_WRITE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.APPOINTMENT_WRITE,
    // Phase 3 — operations
    PERMISSIONS.COMANDA_READ,
    PERMISSIONS.COMANDA_WRITE,
    PERMISSIONS.COMANDA_CLOSE,
    PERMISSIONS.COMANDA_REOPEN,
    PERMISSIONS.CREDIT_READ,
    PERMISSIONS.CREDIT_ADJUST,
    PERMISSIONS.FINANCIAL_READ,
    PERMISSIONS.COMMISSION_RECORD_READ,
    // Phase 4 — bridal & contracts
    PERMISSIONS.BRIDAL_READ,
    PERMISSIONS.BRIDAL_WRITE,
    PERMISSIONS.BRIDAL_AI_SUGGEST,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_WRITE,
    PERMISSIONS.CONTRACT_PAYMENT,
    PERMISSIONS.CONTRACT_CANCEL,
  ],
  ATTENDANT: [
    // Phase 1
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBER_READ,
    // Phase 2 — 7 new permissions
    PERMISSIONS.CATEGORY_READ,
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.PACKAGE_READ,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_WRITE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.APPOINTMENT_WRITE,
    // Phase 3 — operations
    PERMISSIONS.COMANDA_READ,
    PERMISSIONS.COMANDA_WRITE,
    PERMISSIONS.COMANDA_CLOSE,
    PERMISSIONS.CREDIT_READ,
    // Phase 4 — bridal & contracts
    PERMISSIONS.BRIDAL_READ,
    PERMISSIONS.BRIDAL_WRITE,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_PAYMENT,
  ],
  PROFESSIONAL: [
    // Phase 1
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBER_READ,
    // Phase 2 — 6 new permissions
    PERMISSIONS.CATEGORY_READ,
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.PACKAGE_READ,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.APPOINTMENT_READ,
    // Phase 3 — operations
    PERMISSIONS.COMANDA_READ,
    PERMISSIONS.COMMISSION_RECORD_READ,
  ],
};
