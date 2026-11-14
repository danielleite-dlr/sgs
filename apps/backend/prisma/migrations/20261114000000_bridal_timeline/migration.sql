-- Fase 04.2: cronograma da noiva e das acompanhantes (modelo Studio JS)
-- A. regras de cronograma por pacote; B. cronograma confirmado por grupo;
-- C. RLS; D. permissao bridal.scheduleOverride.

-- ─── A. package_timeline_steps ────────────────────────────────────────────────
CREATE TABLE package_timeline_steps (
  id               UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id  UUID         NOT NULL,
  package_id       UUID         NOT NULL,
  display_order    INT          NOT NULL DEFAULT 0,
  is_extra         BOOLEAN      NOT NULL DEFAULT false,
  name             VARCHAR(120) NOT NULL,
  offset_minutes   INT          NOT NULL,
  kind             VARCHAR(10)  NULL,
  service_id       UUID         NULL,
  duration_minutes INT          NULL,
  starts_registry  BOOLEAN      NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_package_timeline_steps PRIMARY KEY (id),
  CONSTRAINT fk_pts_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_pts_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_pts_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT chk_pts_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT chk_pts_offset CHECK (offset_minutes BETWEEN 0 AND 1440),
  CONSTRAINT chk_pts_kind CHECK (kind IS NULL OR kind IN ('make','hair')),
  CONSTRAINT chk_pts_duration CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 600),
  CONSTRAINT chk_pts_kind_duration CHECK (kind IS NULL OR duration_minutes IS NOT NULL),
  CONSTRAINT chk_pts_extra CHECK (is_extra = false OR (kind IS NULL AND starts_registry = false AND service_id IS NULL AND duration_minutes IS NULL))
);

CREATE INDEX ix_pts_org_package ON package_timeline_steps (organization_id, package_id, display_order);
CREATE UNIQUE INDEX uq_pts_one_registry ON package_timeline_steps (package_id) WHERE starts_registry;
CREATE UNIQUE INDEX uq_pts_package_kind ON package_timeline_steps (package_id, kind) WHERE kind IS NOT NULL;

-- ─── B. bridal_timelines (snapshot confirmado; um por grupo) ──────────────────
CREATE TABLE bridal_timelines (
  id                    UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id       UUID         NOT NULL,
  group_id              UUID         NOT NULL,
  package_id            UUID         NULL,
  package_name          VARCHAR(160) NOT NULL,
  departure_time        VARCHAR(5)   NOT NULL,
  departure_at          TIMESTAMPTZ(6) NOT NULL,
  registry_starts_at    TIMESTAMPTZ(6) NOT NULL,
  registry_label        VARCHAR(120) NOT NULL,
  bride_label           VARCHAR(160) NOT NULL,
  make_professional_id  UUID         NULL,
  hair_professional_id  UUID         NULL,
  make_service_id       UUID         NULL,
  hair_service_id       UUID         NULL,
  make_starts_at        TIMESTAMPTZ(6) NULL,
  make_ends_at          TIMESTAMPTZ(6) NULL,
  hair_starts_at        TIMESTAMPTZ(6) NULL,
  hair_ends_at          TIMESTAMPTZ(6) NULL,
  make_appointment_id   UUID         NULL,
  hair_appointment_id   UUID         NULL,
  rows                  JSONB        NOT NULL DEFAULT '[]',
  text                  TEXT         NOT NULL,
  warnings              JSONB        NOT NULL DEFAULT '[]',
  confirmed_by          UUID         NULL,
  confirmed_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  version               INT          NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_bridal_timelines PRIMARY KEY (id),
  CONSTRAINT fk_bt_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_bt_group FOREIGN KEY (group_id) REFERENCES bridal_groups(id) ON DELETE CASCADE,
  CONSTRAINT uq_bt_group UNIQUE (group_id),
  CONSTRAINT fk_bt_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_bt_make_professional FOREIGN KEY (make_professional_id) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_bt_hair_professional FOREIGN KEY (hair_professional_id) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_bt_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_bt_make_service FOREIGN KEY (make_service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_bt_hair_service FOREIGN KEY (hair_service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_bt_make_appointment FOREIGN KEY (make_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT fk_bt_hair_appointment FOREIGN KEY (hair_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT chk_bt_departure CHECK (departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT chk_bt_version CHECK (version > 0),
  CONSTRAINT chk_bt_make_window CHECK (make_starts_at IS NULL OR make_ends_at > make_starts_at),
  CONSTRAINT chk_bt_hair_window CHECK (hair_starts_at IS NULL OR hair_ends_at > hair_starts_at)
);

CREATE INDEX ix_bt_org ON bridal_timelines (organization_id);
CREATE INDEX ix_bt_make_appt ON bridal_timelines (make_appointment_id) WHERE make_appointment_id IS NOT NULL;
CREATE INDEX ix_bt_hair_appt ON bridal_timelines (hair_appointment_id) WHERE hair_appointment_id IS NOT NULL;

-- ─── C. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE package_timeline_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_timeline_steps FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON package_timeline_steps
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE bridal_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridal_timelines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bridal_timelines
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- ─── D. Permissao bridal.scheduleOverride (ADMIN e MANAGER) ───────────────────
DO $$
DECLARE
  v_admin uuid;
  v_manager uuid;
BEGIN
  SELECT id INTO v_admin FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1;
  SELECT id INTO v_manager FROM roles WHERE name='MANAGER' AND is_system=true LIMIT 1;

  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_admin, 'bridal.scheduleOverride'),
    (v_manager, 'bridal.scheduleOverride')
  ON CONFLICT DO NOTHING;
END $$;
