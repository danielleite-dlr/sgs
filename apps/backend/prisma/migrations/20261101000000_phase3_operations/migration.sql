-- Migration: 20261101000000_phase3_operations
-- Phase 3: agenda (bloqueios), comanda/POS, pagamentos, credito de cliente, caixa,
-- comissoes e auditoria. Tambem alarga a exclusion constraint de appointments.

-- ─── A. ALTER appointments ────────────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN comanda_id UUID NULL,
  ADD COLUMN service_variant_id UUID NULL,
  ADD COLUMN deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN cancel_reason TEXT NULL,
  ADD COLUMN cancel_reason_tag VARCHAR(30) NULL,
  ADD COLUMN cancelled_at TIMESTAMPTZ(6) NULL,
  ADD COLUMN cancelled_by UUID NULL;

ALTER TABLE appointments DROP CONSTRAINT chk_appointments_status;
ALTER TABLE appointments ADD CONSTRAINT chk_appointments_status
  CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show'));
ALTER TABLE appointments ADD CONSTRAINT chk_appointments_deposit CHECK (deposit_amount >= 0);

ALTER TABLE appointments DROP CONSTRAINT ex_appointments_professional_interval;
ALTER TABLE appointments ADD CONSTRAINT ex_appointments_professional_interval EXCLUDE USING gist (
  organization_id WITH =,
  professional_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status IN ('scheduled','confirmed','in_progress','completed'));

-- ─── B. time_blocks ───────────────────────────────────────────────────────────
CREATE TABLE time_blocks (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  professional_id UUID NULL,
  kind            VARCHAR(20) NOT NULL,
  starts_at       TIMESTAMPTZ(6) NOT NULL,
  ends_at         TIMESTAMPTZ(6) NOT NULL,
  all_day         BOOLEAN NOT NULL DEFAULT false,
  note            TEXT NULL,
  created_by      UUID NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_time_blocks PRIMARY KEY (id),
  CONSTRAINT fk_time_blocks_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_time_blocks_professional FOREIGN KEY (professional_id) REFERENCES members(id),
  CONSTRAINT fk_time_blocks_created_by FOREIGN KEY (created_by) REFERENCES members(id),
  CONSTRAINT chk_time_blocks_kind CHECK (kind IN ('folga','intervalo','feriado','indisponibilidade')),
  CONSTRAINT chk_time_blocks_scope CHECK ((kind = 'feriado') = (professional_id IS NULL)),
  CONSTRAINT chk_time_blocks_interval CHECK (ends_at > starts_at)
);
CREATE INDEX ix_time_blocks_org_prof_starts ON time_blocks(organization_id, professional_id, starts_at);
CREATE TRIGGER tg_time_blocks_before_update
  BEFORE UPDATE ON time_blocks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── C. comandas ──────────────────────────────────────────────────────────────
CREATE TABLE comandas (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  code            VARCHAR(20) NOT NULL,
  client_id       UUID NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  opened_at       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  opened_by       UUID NULL,
  closed_at       TIMESTAMPTZ(6) NULL,
  closed_by       UUID NULL,
  close_cycle     INTEGER NOT NULL DEFAULT 0,
  cancelled_at    TIMESTAMPTZ(6) NULL,
  cancel_reason   TEXT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_comandas PRIMARY KEY (id),
  CONSTRAINT fk_comandas_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_comandas_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_comandas_opened_by FOREIGN KEY (opened_by) REFERENCES members(id),
  CONSTRAINT fk_comandas_closed_by FOREIGN KEY (closed_by) REFERENCES members(id),
  CONSTRAINT uq_comandas_org_code UNIQUE (organization_id, code),
  CONSTRAINT chk_comandas_status CHECK (status IN ('open','closed','cancelled')),
  CONSTRAINT chk_comandas_total CHECK (total >= 0),
  CONSTRAINT chk_comandas_closed CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);
CREATE INDEX ix_comandas_org_status_opened ON comandas(organization_id, status, opened_at);
CREATE INDEX ix_comandas_org_closed ON comandas(organization_id, closed_at) WHERE status = 'closed';
CREATE INDEX ix_comandas_org_client ON comandas(organization_id, client_id);
CREATE TRIGGER tg_comandas_before_update
  BEFORE UPDATE ON comandas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── D. comanda_sequences ─────────────────────────────────────────────────────
CREATE TABLE comanda_sequences (
  organization_id UUID NOT NULL,
  year            INTEGER NOT NULL,
  last_value      INTEGER NOT NULL,
  CONSTRAINT pk_comanda_sequences PRIMARY KEY (organization_id, year),
  CONSTRAINT fk_comanda_sequences_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_comanda_sequences_value CHECK (last_value > 0)
);

-- ─── E. comanda_items ─────────────────────────────────────────────────────────
CREATE TABLE comanda_items (
  id                 UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id    UUID NOT NULL,
  comanda_id         UUID NOT NULL,
  kind               VARCHAR(10) NOT NULL,
  service_id         UUID NULL,
  service_variant_id UUID NULL,
  product_id         UUID NULL,
  package_id         UUID NULL,
  appointment_id     UUID NULL,
  professional_id    UUID NOT NULL,
  name_snapshot      VARCHAR(200) NOT NULL,
  quantity           INTEGER NOT NULL DEFAULT 1,
  list_unit_price    NUMERIC(12,2) NOT NULL,
  unit_price         NUMERIC(12,2) NOT NULL,
  total              NUMERIC(12,2) NOT NULL,
  created_by         UUID NULL,
  created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_comanda_items PRIMARY KEY (id),
  CONSTRAINT fk_comanda_items_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_comanda_items_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE CASCADE,
  CONSTRAINT fk_comanda_items_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_comanda_items_service_variant FOREIGN KEY (service_variant_id) REFERENCES service_pricing_variants(id) ON DELETE SET NULL,
  CONSTRAINT fk_comanda_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_comanda_items_package FOREIGN KEY (package_id) REFERENCES packages(id),
  CONSTRAINT fk_comanda_items_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT fk_comanda_items_professional FOREIGN KEY (professional_id) REFERENCES members(id),
  CONSTRAINT fk_comanda_items_created_by FOREIGN KEY (created_by) REFERENCES members(id),
  CONSTRAINT chk_comanda_items_kind CHECK (kind IN ('service','product')),
  CONSTRAINT chk_comanda_items_ref CHECK (
    (kind = 'service' AND service_id IS NOT NULL AND product_id IS NULL)
    OR (kind = 'product' AND product_id IS NOT NULL AND service_id IS NULL)
  ),
  CONSTRAINT chk_comanda_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_comanda_items_prices CHECK (list_unit_price >= 0 AND unit_price >= 0 AND total >= 0)
);
CREATE INDEX ix_comanda_items_comanda ON comanda_items(comanda_id);
CREATE INDEX ix_comanda_items_org_professional ON comanda_items(organization_id, professional_id);
CREATE TRIGGER tg_comanda_items_before_update
  BEFORE UPDATE ON comanda_items
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── F. comanda_payments ──────────────────────────────────────────────────────
CREATE TABLE comanda_payments (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  comanda_id      UUID NOT NULL,
  method          VARCHAR(20) NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  paid_at         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  member_id       UUID NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_comanda_payments PRIMARY KEY (id),
  CONSTRAINT fk_comanda_payments_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_comanda_payments_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE CASCADE,
  CONSTRAINT fk_comanda_payments_member FOREIGN KEY (member_id) REFERENCES members(id),
  CONSTRAINT chk_comanda_payments_method CHECK (method IN ('cash','pix','credit_card','debit_card','transfer','client_credit')),
  CONSTRAINT chk_comanda_payments_amount CHECK (amount > 0)
);
CREATE INDEX ix_comanda_payments_comanda ON comanda_payments(comanda_id);

-- ─── G. client_credit_movements ───────────────────────────────────────────────
CREATE TABLE client_credit_movements (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  client_id       UUID NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  kind            VARCHAR(30) NOT NULL,
  appointment_id  UUID NULL,
  comanda_id      UUID NULL,
  cycle           INTEGER NULL,
  reason          TEXT NULL,
  created_by      UUID NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_client_credit_movements PRIMARY KEY (id),
  CONSTRAINT fk_ccm_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_ccm_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_ccm_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_ccm_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id),
  CONSTRAINT fk_ccm_created_by FOREIGN KEY (created_by) REFERENCES members(id),
  CONSTRAINT chk_ccm_amount CHECK (amount <> 0),
  CONSTRAINT chk_ccm_kind CHECK (kind IN ('deposit','manual_adjustment','consumption','reopen_refund'))
);
CREATE INDEX ix_ccm_org_client ON client_credit_movements(organization_id, client_id);

-- ─── H. cash_movements ────────────────────────────────────────────────────────
CREATE TABLE cash_movements (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  kind            VARCHAR(20) NOT NULL,
  method          VARCHAR(20) NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  comanda_id      UUID NULL,
  appointment_id  UUID NULL,
  client_id       UUID NULL,
  cycle           INTEGER NULL,
  occurred_at     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  member_id       UUID NULL,
  note            TEXT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_cash_movements PRIMARY KEY (id),
  CONSTRAINT fk_cash_movements_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cash_movements_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id),
  CONSTRAINT fk_cash_movements_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_cash_movements_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_cash_movements_member FOREIGN KEY (member_id) REFERENCES members(id),
  CONSTRAINT chk_cash_movements_kind CHECK (kind IN ('deposit_in','payment_in','change_out','reversal')),
  CONSTRAINT chk_cash_movements_method CHECK (method IN ('cash','pix','credit_card','debit_card','transfer')),
  CONSTRAINT chk_cash_movements_amount CHECK (amount <> 0)
);
CREATE INDEX ix_cash_movements_org_occurred ON cash_movements(organization_id, occurred_at);

-- ─── I. commission_records ────────────────────────────────────────────────────
-- comanda_item_id e rule_id sem FK de proposito: item pode ser removido apos
-- reabertura e regra pode ser apagada; o snapshot preserva os dados.
CREATE TABLE commission_records (
  id                 UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id    UUID NOT NULL,
  comanda_id         UUID NOT NULL,
  comanda_item_id    UUID NOT NULL,
  member_id          UUID NOT NULL,
  kind               VARCHAR(10) NOT NULL,
  cycle              INTEGER NOT NULL,
  base_amount        NUMERIC(12,2) NOT NULL,
  charged_amount     NUMERIC(12,2) NOT NULL,
  rule_id            UUID NULL,
  rule_kind          VARCHAR(20) NULL,
  rule_value         NUMERIC(12,4) NULL,
  no_rule            BOOLEAN NOT NULL DEFAULT false,
  rule_snapshot      JSONB NOT NULL,
  calculated_amount  NUMERIC(12,2) NOT NULL,
  reverses_record_id UUID NULL,
  calculated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_commission_records PRIMARY KEY (id),
  CONSTRAINT fk_cr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cr_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id),
  CONSTRAINT fk_cr_member FOREIGN KEY (member_id) REFERENCES members(id),
  CONSTRAINT fk_cr_reverses FOREIGN KEY (reverses_record_id) REFERENCES commission_records(id),
  CONSTRAINT chk_cr_kind CHECK (kind IN ('accrual','reversal')),
  CONSTRAINT chk_cr_rule_kind CHECK (rule_kind IS NULL OR rule_kind IN ('fixed','percentage')),
  CONSTRAINT chk_cr_no_rule CHECK (no_rule = (rule_kind IS NULL)),
  CONSTRAINT chk_cr_no_rule_zero CHECK (no_rule = false OR calculated_amount = 0),
  CONSTRAINT chk_cr_reversal CHECK ((kind = 'reversal') = (reverses_record_id IS NOT NULL)),
  CONSTRAINT uq_cr_item_cycle_kind UNIQUE (comanda_item_id, cycle, kind)
);
CREATE INDEX ix_cr_org_calculated ON commission_records(organization_id, calculated_at);
CREATE INDEX ix_cr_org_member_calculated ON commission_records(organization_id, member_id, calculated_at);
CREATE INDEX ix_cr_comanda ON commission_records(comanda_id);

-- ─── J. audit_log ─────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  actor_member_id UUID NULL,
  action          VARCHAR(60) NOT NULL,
  entity_type     VARCHAR(40) NOT NULL,
  entity_id       UUID NOT NULL,
  reason          TEXT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_audit_log PRIMARY KEY (id),
  CONSTRAINT fk_audit_log_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_audit_log_actor FOREIGN KEY (actor_member_id) REFERENCES members(id)
);
CREATE INDEX ix_audit_log_org_entity ON audit_log(organization_id, entity_type, entity_id);

-- ─── K. stock_movements.comanda_id ────────────────────────────────────────────
ALTER TABLE stock_movements ADD COLUMN comanda_id UUID NULL;
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_comanda
  FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE SET NULL;
CREATE INDEX ix_sm_comanda ON stock_movements(comanda_id);

-- ─── L. FKs de appointments que dependem de comandas ──────────────────────────
ALTER TABLE appointments
  ADD CONSTRAINT fk_appointments_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_appointments_service_variant FOREIGN KEY (service_variant_id) REFERENCES service_pricing_variants(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_appointments_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES members(id);
CREATE INDEX ix_appointments_comanda ON appointments(comanda_id);

-- ─── M. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON time_blocks
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comandas FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comandas
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE comanda_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_sequences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comanda_sequences
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE comanda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comanda_items
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE comanda_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comanda_payments
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE client_credit_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_credit_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON client_credit_movements
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cash_movements
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commission_records
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_log
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- ─── N. Imutabilidade dos ledgers (append-only para sgs_app) ──────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
    REVOKE UPDATE, DELETE ON commission_records FROM sgs_app;
    REVOKE UPDATE, DELETE ON audit_log FROM sgs_app;
    REVOKE UPDATE, DELETE ON cash_movements FROM sgs_app;
    REVOKE UPDATE, DELETE ON client_credit_movements FROM sgs_app;
  END IF;
END $$;

-- ─── O. Seed de permissoes da Fase 3 ──────────────────────────────────────────
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
    (v_admin, 'comanda.read'),
    (v_admin, 'comanda.write'),
    (v_admin, 'comanda.close'),
    (v_admin, 'comanda.reopen'),
    (v_admin, 'credit.read'),
    (v_admin, 'credit.adjust'),
    (v_admin, 'financial.read'),
    (v_admin, 'commissionRecord.read'),
    (v_manager, 'comanda.read'),
    (v_manager, 'comanda.write'),
    (v_manager, 'comanda.close'),
    (v_manager, 'comanda.reopen'),
    (v_manager, 'credit.read'),
    (v_manager, 'credit.adjust'),
    (v_manager, 'financial.read'),
    (v_manager, 'commissionRecord.read'),
    (v_attendant, 'comanda.read'),
    (v_attendant, 'comanda.write'),
    (v_attendant, 'comanda.close'),
    (v_attendant, 'credit.read'),
    (v_professional, 'comanda.read'),
    (v_professional, 'commissionRecord.read')
  ON CONFLICT DO NOTHING;
END $$;
