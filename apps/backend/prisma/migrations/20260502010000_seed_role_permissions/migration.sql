-- Seed Phase 1 permissions for the 4 system roles created in init migration.
-- Resource pattern: <resource>.<action>. See apps/backend/src/authz/permissions.catalog.ts.

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

  -- ADMIN: full access for Phase 1
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_admin, 'organization.read'),
    (v_admin, 'organization.update'),
    (v_admin, 'member.read'),
    (v_admin, 'member.invite'),
    (v_admin, 'member.remove'),
    (v_admin, 'member.editRole'),
    (v_admin, 'role.read')
  ON CONFLICT DO NOTHING;

  -- MANAGER
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_manager, 'organization.read'),
    (v_manager, 'member.read'),
    (v_manager, 'member.invite'),
    (v_manager, 'role.read')
  ON CONFLICT DO NOTHING;

  -- ATTENDANT
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_attendant, 'organization.read'),
    (v_attendant, 'member.read')
  ON CONFLICT DO NOTHING;

  -- PROFESSIONAL
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_professional, 'organization.read'),
    (v_professional, 'member.read')
  ON CONFLICT DO NOTHING;
END $$;

-- ===== Relaxed SELECT policy on member_invitations =====
-- The token_hash IS the secret; only the invitee knows the plaintext (sha256 lookup).
-- INSERT/UPDATE/DELETE remain tenant-scoped via tenant_isolation_modify WITH CHECK.
-- This MUST be in the same migration so prisma migrate deploy applies it before
-- any acceptInvitation() call (which scans without tenant context by token_hash).
DROP POLICY IF EXISTS tenant_isolation ON member_invitations;
CREATE POLICY tenant_isolation_select ON member_invitations
  FOR SELECT
  USING (true);  -- application-layer enforces token check via WHERE token_hash = ?
CREATE POLICY tenant_isolation_modify ON member_invitations
  FOR ALL
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
