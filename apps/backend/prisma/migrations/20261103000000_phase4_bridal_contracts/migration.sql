-- Fase 4: Noivas e Contratos
-- Grupos de noivas, contratos versionados, aceite por link, pagamentos (ledger),
-- sugestões de agenda por IA e alertas diários.
--
-- job_list_active_orgs(): `organizations` tem FORCE ROW LEVEL SECURITY, então um job
-- sem tenant (scheduler de alertas) não enxerga nenhuma organização como sgs_app.
-- A função SECURITY DEFINER expõe apenas (id, timezone) das orgs ativas — mesmo
-- padrão de auth_user_memberships.

-- ─── A. packages: sinal padrão (D-12) ─────────────────────────────────────────
ALTER TABLE packages
  ADD COLUMN deposit_kind  VARCHAR(10) NULL,
  ADD COLUMN deposit_value NUMERIC(12,2) NULL,
  ADD CONSTRAINT chk_packages_deposit CHECK (
    (deposit_kind IS NULL AND deposit_value IS NULL)
    OR (deposit_kind = 'fixed' AND deposit_value >= 0)
    OR (deposit_kind = 'percent' AND deposit_value >= 0 AND deposit_value <= 100)
  );

-- ─── B. contract_settings ─────────────────────────────────────────────────────
CREATE TABLE contract_settings (
  organization_id              UUID NOT NULL,
  balance_due_days_before      INTEGER NOT NULL DEFAULT 10,
  template_body                TEXT NULL,
  cancellation_clause          TEXT NULL,
  alert_deposit_unpaid_days    INTEGER NOT NULL DEFAULT 3,
  alert_not_accepted_days      INTEGER NOT NULL DEFAULT 3,
  alert_companion_deposit_days INTEGER NOT NULL DEFAULT 15,
  schedule_day_start           TIME NOT NULL DEFAULT '06:00',
  schedule_day_end             TIME NOT NULL DEFAULT '20:00',
  updated_by                   UUID NULL,
  created_at                   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_contract_settings PRIMARY KEY (organization_id),
  CONSTRAINT fk_contract_settings_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_contract_settings_updated_by FOREIGN KEY (updated_by) REFERENCES members(id),
  CONSTRAINT chk_cs_due_days CHECK (balance_due_days_before BETWEEN 0 AND 365),
  CONSTRAINT chk_cs_alert_days CHECK (
    alert_deposit_unpaid_days BETWEEN 0 AND 90
    AND alert_not_accepted_days BETWEEN 0 AND 90
    AND alert_companion_deposit_days BETWEEN 0 AND 365
  ),
  CONSTRAINT chk_cs_day_window CHECK (schedule_day_end > schedule_day_start)
);
CREATE TRIGGER tg_contract_settings_before_update
  BEFORE UPDATE ON contract_settings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── C. bridal_groups ─────────────────────────────────────────────────────────
CREATE TABLE bridal_groups (
  id                    UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id       UUID NOT NULL,
  name                  VARCHAR(160) NOT NULL,
  event_date            DATE NOT NULL,
  ready_by              TIMESTAMPTZ(6) NULL,
  location_kind         VARCHAR(10) NOT NULL DEFAULT 'studio',
  location_address      TEXT NULL,
  travel_minutes_before INTEGER NOT NULL DEFAULT 0,
  travel_minutes_after  INTEGER NOT NULL DEFAULT 0,
  status                VARCHAR(12) NOT NULL DEFAULT 'active',
  notes                 TEXT NULL,
  cancelled_at          TIMESTAMPTZ(6) NULL,
  cancel_reason         TEXT NULL,
  created_by            UUID NULL,
  created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_bridal_groups PRIMARY KEY (id),
  CONSTRAINT fk_bridal_groups_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_bridal_groups_created_by FOREIGN KEY (created_by) REFERENCES members(id),
  CONSTRAINT chk_bg_location CHECK (location_kind IN ('studio','external')),
  CONSTRAINT chk_bg_address CHECK (location_kind = 'studio' OR (location_address IS NOT NULL AND length(trim(location_address)) > 0)),
  CONSTRAINT chk_bg_travel CHECK (travel_minutes_before BETWEEN 0 AND 240 AND travel_minutes_after BETWEEN 0 AND 240),
  CONSTRAINT chk_bg_status CHECK (status IN ('active','completed','cancelled'))
);
CREATE INDEX ix_bg_org_event ON bridal_groups(organization_id, event_date);
CREATE TRIGGER tg_bridal_groups_before_update
  BEFORE UPDATE ON bridal_groups
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── D. bridal_group_members ──────────────────────────────────────────────────
CREATE TABLE bridal_group_members (
  id                  UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id     UUID NOT NULL,
  group_id            UUID NOT NULL,
  client_id           UUID NOT NULL,
  role                VARCHAR(10) NOT NULL,
  relation_label      VARCHAR(60) NULL,
  covered_by_contract BOOLEAN NOT NULL DEFAULT false,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_bridal_group_members PRIMARY KEY (id),
  CONSTRAINT fk_bgm_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_bgm_group FOREIGN KEY (group_id) REFERENCES bridal_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_bgm_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT chk_bgm_role CHECK (role IN ('bride','companion')),
  CONSTRAINT uq_bgm_group_client UNIQUE (group_id, client_id)
);
CREATE UNIQUE INDEX uq_bgm_one_bride ON bridal_group_members(group_id) WHERE role = 'bride';
CREATE INDEX ix_bgm_org_client ON bridal_group_members(organization_id, client_id);
CREATE TRIGGER tg_bridal_group_members_before_update
  BEFORE UPDATE ON bridal_group_members
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── E. bridal_member_services ────────────────────────────────────────────────
CREATE TABLE bridal_member_services (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  group_member_id UUID NOT NULL,
  service_id      UUID NOT NULL,
  purpose         VARCHAR(10) NOT NULL DEFAULT 'event',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_bridal_member_services PRIMARY KEY (id),
  CONSTRAINT fk_bms_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_bms_member FOREIGN KEY (group_member_id) REFERENCES bridal_group_members(id) ON DELETE CASCADE,
  CONSTRAINT fk_bms_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT chk_bms_purpose CHECK (purpose IN ('event','trial')),
  CONSTRAINT uq_bms_member_service_purpose UNIQUE (group_member_id, service_id, purpose)
);

-- ─── F. contract_sequences ────────────────────────────────────────────────────
CREATE TABLE contract_sequences (
  organization_id UUID NOT NULL,
  year            INTEGER NOT NULL,
  last_value      INTEGER NOT NULL,
  CONSTRAINT pk_contract_sequences PRIMARY KEY (organization_id, year),
  CONSTRAINT fk_contract_sequences_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_contract_sequences_value CHECK (last_value > 0)
);

-- ─── G. contracts ─────────────────────────────────────────────────────────────
CREATE TABLE contracts (
  id                      UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id         UUID NOT NULL,
  code                    VARCHAR(20) NOT NULL,
  bridal_group_id         UUID NOT NULL,
  bride_client_id         UUID NOT NULL,
  package_id              UUID NULL,
  status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
  items_total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due_days_before INTEGER NOT NULL,
  balance_due_date        DATE NOT NULL,
  cancellation_policy     JSONB NOT NULL,
  current_version         INTEGER NOT NULL DEFAULT 0,
  accepted_version        INTEGER NULL,
  link_generated_at       TIMESTAMPTZ(6) NULL,
  accepted_at             TIMESTAMPTZ(6) NULL,
  cancelled_at            TIMESTAMPTZ(6) NULL,
  cancelled_by            UUID NULL,
  cancel_reason           TEXT NULL,
  cancelled_by_party      VARCHAR(10) NULL,
  created_by              UUID NULL,
  created_at              TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_contracts PRIMARY KEY (id),
  CONSTRAINT fk_contracts_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_contracts_group FOREIGN KEY (bridal_group_id) REFERENCES bridal_groups(id),
  CONSTRAINT fk_contracts_bride FOREIGN KEY (bride_client_id) REFERENCES clients(id),
  CONSTRAINT fk_contracts_package FOREIGN KEY (package_id) REFERENCES packages(id),
  CONSTRAINT fk_contracts_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES members(id),
  CONSTRAINT fk_contracts_created_by FOREIGN KEY (created_by) REFERENCES members(id),
  CONSTRAINT chk_contracts_status CHECK (status IN ('draft','awaiting_acceptance','active','completed','cancelled')),
  CONSTRAINT chk_contracts_amounts CHECK (
    items_total >= 0 AND discount_amount >= 0 AND discount_amount <= items_total
    AND total_amount = items_total - discount_amount
    AND deposit_amount >= 0 AND deposit_amount <= total_amount
  ),
  CONSTRAINT chk_contracts_party CHECK (cancelled_by_party IS NULL OR cancelled_by_party IN ('client','studio')),
  CONSTRAINT chk_contracts_cancelled CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT uq_contracts_org_code UNIQUE (organization_id, code)
);
CREATE UNIQUE INDEX uq_contracts_group_live ON contracts(bridal_group_id) WHERE status <> 'cancelled';
CREATE INDEX ix_contracts_org_status ON contracts(organization_id, status);
CREATE TRIGGER tg_contracts_before_update
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── H. contract_items ────────────────────────────────────────────────────────
CREATE TABLE contract_items (
  id                   UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id      UUID NOT NULL,
  contract_id          UUID NOT NULL,
  group_member_id      UUID NOT NULL,
  service_id           UUID NOT NULL,
  package_id           UUID NULL,
  description_snapshot VARCHAR(200) NOT NULL,
  quantity             INTEGER NOT NULL DEFAULT 1,
  unit_price           NUMERIC(12,2) NOT NULL,
  total                NUMERIC(12,2) NOT NULL,
  purpose              VARCHAR(10) NOT NULL DEFAULT 'event',
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_contract_items PRIMARY KEY (id),
  CONSTRAINT fk_ci_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_ci_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_member FOREIGN KEY (group_member_id) REFERENCES bridal_group_members(id),
  CONSTRAINT fk_ci_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_ci_package FOREIGN KEY (package_id) REFERENCES packages(id),
  CONSTRAINT chk_ci_quantity CHECK (quantity > 0),
  CONSTRAINT chk_ci_prices CHECK (unit_price >= 0 AND total = unit_price * quantity),
  CONSTRAINT chk_ci_purpose CHECK (purpose IN ('event','trial'))
);
CREATE INDEX ix_ci_contract ON contract_items(contract_id);
CREATE TRIGGER tg_contract_items_before_update
  BEFORE UPDATE ON contract_items
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── I. contract_versions (append-only) ───────────────────────────────────────
CREATE TABLE contract_versions (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  contract_id     UUID NOT NULL,
  version         INTEGER NOT NULL,
  rendered_text   TEXT NOT NULL,
  text_sha256     CHAR(64) NOT NULL,
  created_by      UUID NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_contract_versions PRIMARY KEY (id),
  CONSTRAINT fk_cv_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cv_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT fk_cv_created_by FOREIGN KEY (created_by) REFERENCES members(id),
  CONSTRAINT uq_cv_contract_version UNIQUE (contract_id, version),
  CONSTRAINT chk_cv_version CHECK (version > 0)
);

-- ─── J. contract_access_tokens ────────────────────────────────────────────────
CREATE TABLE contract_access_tokens (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  contract_id     UUID NOT NULL,
  version_id      UUID NOT NULL,
  token_hash      CHAR(64) NOT NULL,
  expires_at      TIMESTAMPTZ(6) NOT NULL,
  revoked_at      TIMESTAMPTZ(6) NULL,
  created_by      UUID NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_contract_access_tokens PRIMARY KEY (id),
  CONSTRAINT fk_cat_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cat_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT fk_cat_version FOREIGN KEY (version_id) REFERENCES contract_versions(id),
  CONSTRAINT fk_cat_created_by FOREIGN KEY (created_by) REFERENCES members(id),
  CONSTRAINT uq_cat_token_hash UNIQUE (token_hash)
);
CREATE INDEX ix_cat_contract ON contract_access_tokens(contract_id);

-- ─── K. contract_acceptances (append-only) ────────────────────────────────────
CREATE TABLE contract_acceptances (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  contract_id     UUID NOT NULL,
  version_id      UUID NOT NULL,
  accepted_name   VARCHAR(255) NOT NULL,
  accepted_cpf    VARCHAR(11) NOT NULL,
  accepted_at     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  ip              VARCHAR(45) NOT NULL,
  user_agent      TEXT NULL,
  text_sha256     CHAR(64) NOT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_contract_acceptances PRIMARY KEY (id),
  CONSTRAINT fk_ca_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_ca_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT fk_ca_version FOREIGN KEY (version_id) REFERENCES contract_versions(id),
  CONSTRAINT uq_ca_version UNIQUE (version_id),
  CONSTRAINT chk_ca_cpf CHECK (accepted_cpf ~ '^[0-9]{11}$')
);

-- ─── L. contract_payments (ledger append-only) ────────────────────────────────
CREATE TABLE contract_payments (
  id                   UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id      UUID NOT NULL,
  contract_id          UUID NOT NULL,
  kind                 VARCHAR(10) NOT NULL,
  method               VARCHAR(20) NOT NULL,
  amount               NUMERIC(12,2) NOT NULL,
  paid_at              TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  member_id            UUID NULL,
  reverses_payment_id  UUID NULL,
  note                 TEXT NULL,
  created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_contract_payments PRIMARY KEY (id),
  CONSTRAINT fk_cp_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cp_contract FOREIGN KEY (contract_id) REFERENCES contracts(id),
  CONSTRAINT fk_cp_member FOREIGN KEY (member_id) REFERENCES members(id),
  CONSTRAINT fk_cp_reverses FOREIGN KEY (reverses_payment_id) REFERENCES contract_payments(id),
  CONSTRAINT chk_cp_kind CHECK (kind IN ('payment','refund','reversal')),
  CONSTRAINT chk_cp_method CHECK (method IN ('cash','pix','credit_card','debit_card','transfer')),
  CONSTRAINT chk_cp_sign CHECK ((kind = 'payment' AND amount > 0) OR (kind IN ('refund','reversal') AND amount < 0)),
  CONSTRAINT chk_cp_reversal CHECK ((kind = 'reversal') = (reverses_payment_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_cp_reverses ON contract_payments(reverses_payment_id) WHERE reverses_payment_id IS NOT NULL;
CREATE INDEX ix_cp_org_paid ON contract_payments(organization_id, paid_at);
CREATE INDEX ix_cp_contract ON contract_payments(contract_id);

-- ─── M. ALTERs de tabelas da fase 3 ───────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN bridal_group_id UUID NULL,
  ADD COLUMN contract_id UUID NULL,
  ADD COLUMN purpose VARCHAR(10) NULL,
  ADD CONSTRAINT fk_appointments_bridal_group FOREIGN KEY (bridal_group_id) REFERENCES bridal_groups(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_appointments_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_appointments_purpose CHECK (purpose IS NULL OR purpose IN ('event','trial'));
CREATE INDEX ix_appointments_bridal_group ON appointments(bridal_group_id) WHERE bridal_group_id IS NOT NULL;

ALTER TABLE time_blocks ADD COLUMN bridal_group_id UUID NULL,
  ADD CONSTRAINT fk_time_blocks_bridal_group FOREIGN KEY (bridal_group_id) REFERENCES bridal_groups(id) ON DELETE CASCADE;
ALTER TABLE time_blocks DROP CONSTRAINT chk_time_blocks_kind;
ALTER TABLE time_blocks ADD CONSTRAINT chk_time_blocks_kind CHECK (kind IN ('folga','intervalo','feriado','indisponibilidade','deslocamento'));
ALTER TABLE time_blocks ADD CONSTRAINT chk_time_blocks_travel CHECK ((kind = 'deslocamento') = (bridal_group_id IS NOT NULL));

ALTER TABLE cash_movements ADD COLUMN contract_id UUID NULL,
  ADD CONSTRAINT fk_cash_movements_contract FOREIGN KEY (contract_id) REFERENCES contracts(id);
ALTER TABLE cash_movements DROP CONSTRAINT chk_cash_movements_kind;
ALTER TABLE cash_movements ADD CONSTRAINT chk_cash_movements_kind CHECK (kind IN ('deposit_in','payment_in','change_out','reversal','contract_in','contract_refund'));

ALTER TABLE comanda_items ADD COLUMN contract_id UUID NULL,
  ADD CONSTRAINT fk_comanda_items_contract FOREIGN KEY (contract_id) REFERENCES contracts(id);
CREATE INDEX ix_comanda_items_contract ON comanda_items(contract_id) WHERE contract_id IS NOT NULL;

-- ─── N. ai_schedule_suggestions ───────────────────────────────────────────────
CREATE TABLE ai_schedule_suggestions (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  group_id        UUID NOT NULL,
  input_hash      CHAR(64) NOT NULL,
  source          VARCHAR(10) NOT NULL,
  model           VARCHAR(60) NULL,
  proposal        JSONB NOT NULL,
  warnings        JSONB NOT NULL DEFAULT '[]',
  input_tokens    INTEGER NULL,
  output_tokens   INTEGER NULL,
  created_by      UUID NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_ai_schedule_suggestions PRIMARY KEY (id),
  CONSTRAINT fk_ass_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_ass_group FOREIGN KEY (group_id) REFERENCES bridal_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_ass_created_by FOREIGN KEY (created_by) REFERENCES members(id),
  CONSTRAINT chk_ass_source CHECK (source IN ('claude','heuristic'))
);
CREATE INDEX ix_ass_lookup ON ai_schedule_suggestions(organization_id, group_id, input_hash, created_at);
CREATE INDEX ix_ass_org_created ON ai_schedule_suggestions(organization_id, created_at) WHERE source = 'claude';

-- ─── O. contract_alert_runs ───────────────────────────────────────────────────
CREATE TABLE contract_alert_runs (
  organization_id UUID NOT NULL,
  run_date        DATE NOT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_contract_alert_runs PRIMARY KEY (organization_id, run_date),
  CONSTRAINT fk_contract_alert_runs_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- ─── P. Função de job (lista orgs ativas sem tenant) ──────────────────────────
CREATE OR REPLACE FUNCTION job_list_active_orgs()
RETURNS TABLE (organization_id uuid, timezone varchar(50))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT o.id, o.timezone FROM organizations o WHERE o.status = 'active' ORDER BY o.id; $$;
REVOKE ALL ON FUNCTION job_list_active_orgs() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT EXECUTE ON FUNCTION job_list_active_orgs() TO sgs_app;
  END IF;
END $$;

-- ─── Q. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE contract_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_settings
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE bridal_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridal_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bridal_groups
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE bridal_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridal_group_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bridal_group_members
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE bridal_member_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridal_member_services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bridal_member_services
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contract_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_sequences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_sequences
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contracts
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contract_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_items
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_versions
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contract_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_access_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_access_tokens
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contract_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_acceptances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_acceptances
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_payments
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE ai_schedule_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_schedule_suggestions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_schedule_suggestions
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contract_alert_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_alert_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_alert_runs
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- ─── R. Imutabilidade dos ledgers ─────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
    REVOKE UPDATE, DELETE ON contract_payments FROM sgs_app;
    REVOKE UPDATE, DELETE ON contract_acceptances FROM sgs_app;
    REVOKE UPDATE, DELETE ON contract_versions FROM sgs_app;
  END IF;
END $$;

-- ─── S. Seed de permissoes da Fase 4 ──────────────────────────────────────────
DO $$
DECLARE
  v_admin uuid;
  v_manager uuid;
  v_attendant uuid;
BEGIN
  SELECT id INTO v_admin FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1;
  SELECT id INTO v_manager FROM roles WHERE name='MANAGER' AND is_system=true LIMIT 1;
  SELECT id INTO v_attendant FROM roles WHERE name='ATTENDANT' AND is_system=true LIMIT 1;

  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_admin, 'bridal.read'),
    (v_admin, 'bridal.write'),
    (v_admin, 'bridal.aiSuggest'),
    (v_admin, 'contract.read'),
    (v_admin, 'contract.write'),
    (v_admin, 'contract.payment'),
    (v_admin, 'contract.cancel'),
    (v_admin, 'contract.settings'),
    (v_manager, 'bridal.read'),
    (v_manager, 'bridal.write'),
    (v_manager, 'bridal.aiSuggest'),
    (v_manager, 'contract.read'),
    (v_manager, 'contract.write'),
    (v_manager, 'contract.payment'),
    (v_manager, 'contract.cancel'),
    (v_attendant, 'bridal.read'),
    (v_attendant, 'bridal.write'),
    (v_attendant, 'contract.read'),
    (v_attendant, 'contract.payment')
  ON CONFLICT DO NOTHING;
END $$;
