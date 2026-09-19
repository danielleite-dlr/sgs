-- Migration: 20260919113000_appointments
-- Phase 3: tenant-scoped salon appointments. The exclusion constraint makes
-- professional schedule conflicts safe even when concurrent requests race.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE appointments (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  client_id       UUID NOT NULL,
  service_id      UUID NOT NULL,
  starts_at       TIMESTAMPTZ(6) NOT NULL,
  ends_at         TIMESTAMPTZ(6) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  notes           TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_appointments PRIMARY KEY (id),
  CONSTRAINT fk_appointments_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_appointments_professional FOREIGN KEY (professional_id) REFERENCES members(id),
  CONSTRAINT fk_appointments_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT chk_appointments_interval CHECK (ends_at > starts_at),
  CONSTRAINT chk_appointments_status CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  CONSTRAINT ex_appointments_professional_interval EXCLUDE USING gist (
    organization_id WITH =,
    professional_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('scheduled', 'confirmed'))
);

CREATE INDEX ix_appointments_org_starts
  ON appointments(organization_id, starts_at);
CREATE INDEX ix_appointments_org_professional_starts
  ON appointments(organization_id, professional_id, starts_at);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON appointments
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

CREATE TRIGGER tg_appointments_before_update
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Appointment permissions are seeded for the existing system roles. This is
-- idempotent and intentionally stays in this migration so new deployments get
-- schema and RBAC capability together.
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

  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_admin, 'appointment.read'),
    (v_admin, 'appointment.write'),
    (v_manager, 'appointment.read'),
    (v_manager, 'appointment.write'),
    (v_attendant, 'appointment.read'),
    (v_attendant, 'appointment.write'),
    (v_professional, 'appointment.read')
  ON CONFLICT DO NOTHING;
END $$;
