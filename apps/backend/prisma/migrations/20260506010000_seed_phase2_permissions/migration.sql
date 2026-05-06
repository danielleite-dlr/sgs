-- Migration: 20260506010000_seed_phase2_permissions
-- Idempotent seed for Phase 2 permissions (catalog, clients, notifications).
-- Resource pattern: <resource>.<action>. See apps/backend/src/authz/permissions.catalog.ts.
-- Uses ON CONFLICT DO NOTHING — safe to re-run.

DO $$
DECLARE
  v_admin uuid;
  v_manager uuid;
  v_attendant uuid;
  v_professional uuid;
BEGIN
  SELECT id INTO v_admin FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1;
  SELECT id INTO v_manager FROM roles WHERE name='MANAGER' AND is_system=true LIMIT 1;
  SELECT id INTO v_attendant FROM roles WHERE name='ATTENDANT' AND is_system=true LIMIT 1;
  SELECT id INTO v_professional FROM roles WHERE name='PROFESSIONAL' AND is_system=true LIMIT 1;

  -- ADMIN: full Phase 2 access (14 new permissions)
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_admin, 'category.read'),
    (v_admin, 'category.write'),
    (v_admin, 'service.read'),
    (v_admin, 'service.write'),
    (v_admin, 'package.read'),
    (v_admin, 'package.write'),
    (v_admin, 'product.read'),
    (v_admin, 'product.write'),
    (v_admin, 'product.adjustStock'),
    (v_admin, 'commission.read'),
    (v_admin, 'commission.write'),
    (v_admin, 'client.read'),
    (v_admin, 'client.write'),
    (v_admin, 'notification.read')
  ON CONFLICT DO NOTHING;

  -- MANAGER: same as ADMIN minus commission.write (13 new permissions)
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_manager, 'category.read'),
    (v_manager, 'category.write'),
    (v_manager, 'service.read'),
    (v_manager, 'service.write'),
    (v_manager, 'package.read'),
    (v_manager, 'package.write'),
    (v_manager, 'product.read'),
    (v_manager, 'product.write'),
    (v_manager, 'product.adjustStock'),
    (v_manager, 'commission.read'),
    (v_manager, 'client.read'),
    (v_manager, 'client.write'),
    (v_manager, 'notification.read')
  ON CONFLICT DO NOTHING;

  -- ATTENDANT: catalog read + client CRUD + notification read (7 new permissions)
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_attendant, 'category.read'),
    (v_attendant, 'service.read'),
    (v_attendant, 'package.read'),
    (v_attendant, 'product.read'),
    (v_attendant, 'client.read'),
    (v_attendant, 'client.write'),
    (v_attendant, 'notification.read')
  ON CONFLICT DO NOTHING;

  -- PROFESSIONAL: catalog read + client read + notification read (6 new permissions)
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_professional, 'category.read'),
    (v_professional, 'service.read'),
    (v_professional, 'package.read'),
    (v_professional, 'product.read'),
    (v_professional, 'client.read'),
    (v_professional, 'notification.read')
  ON CONFLICT DO NOTHING;
END $$;
