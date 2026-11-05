-- Fase 04.1 — Layout e regras do contrato (modelo Studio JS).
-- Schema + RLS + backfill determinístico numa migration única.

-- ─── A. clients (D-08) ────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN rg          VARCHAR(20) NULL,
  ADD COLUMN postal_code VARCHAR(9)  NULL,
  ADD COLUMN phone2      VARCHAR(30) NULL,
  ADD COLUMN phone3      VARCHAR(30) NULL;

-- ─── B. packages (D-06) ───────────────────────────────────────────────────────
ALTER TABLE packages
  ADD COLUMN contract_description TEXT NULL,
  ADD CONSTRAINT chk_packages_contract_description
    CHECK (contract_description IS NULL OR char_length(contract_description) <= 2000);

-- ─── C. bridal_groups (D-04, D-10, D-11) ──────────────────────────────────────
ALTER TABLE bridal_groups
  ADD COLUMN event_kind            VARCHAR(10) NOT NULL DEFAULT 'noiva',
  ADD COLUMN responsible_client_id UUID NULL,
  ADD COLUMN event_time            VARCHAR(5) NULL,
  ADD COLUMN location_name         VARCHAR(160) NULL,
  ADD CONSTRAINT chk_bg_event_kind CHECK (event_kind IN ('noiva','debutante')),
  ADD CONSTRAINT fk_bg_responsible_client FOREIGN KEY (responsible_client_id) REFERENCES clients(id),
  ADD CONSTRAINT chk_bg_event_time
    CHECK (event_time IS NULL OR event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

CREATE INDEX ix_bg_responsible ON bridal_groups(responsible_client_id)
  WHERE responsible_client_id IS NOT NULL;

-- ─── D. contracts (D-07, D-10, D-12) ──────────────────────────────────────────
ALTER TABLE contracts
  ADD COLUMN payment_mode          VARCHAR(20) NOT NULL DEFAULT 'sinal',
  ADD COLUMN discount_description  VARCHAR(120) NULL,
  ADD COLUMN contractor_client_id  UUID NULL,
  ADD CONSTRAINT chk_contracts_payment_mode
    CHECK (payment_mode IN ('sinal','sinal_parcelado','a_vista')),
  ADD CONSTRAINT fk_contracts_contractor_client
    FOREIGN KEY (contractor_client_id) REFERENCES clients(id);

-- ─── E. contract_deposit_installments (D-02, D-13) — mutável ──────────────────
CREATE TABLE contract_deposit_installments (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  contract_id     UUID NOT NULL,
  seq             SMALLINT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  due_date        DATE NOT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_contract_deposit_installments PRIMARY KEY (id),
  CONSTRAINT fk_cdi_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cdi_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT chk_cdi_seq CHECK (seq > 0),
  CONSTRAINT chk_cdi_amount CHECK (amount > 0),
  CONSTRAINT uq_cdi_contract_seq UNIQUE (contract_id, seq)
);
CREATE INDEX ix_cdi_contract_due ON contract_deposit_installments(contract_id, due_date);
CREATE INDEX ix_cdi_org ON contract_deposit_installments(organization_id);

-- ─── F. contract_versions (snapshot estruturado) ──────────────────────────────
-- 1 = legado (texto corrido); 2 = snapshot estruturado.
ALTER TABLE contract_versions
  ADD COLUMN snapshot        JSONB NULL,
  ADD COLUMN snapshot_format SMALLINT NOT NULL DEFAULT 1,
  ADD CONSTRAINT chk_cv_snapshot_format
    CHECK (snapshot_format IN (1,2) AND (snapshot_format = 1 OR snapshot IS NOT NULL));

-- ─── G. contract_letterheads (papel timbrado, imutável, por hash) ─────────────
CREATE TABLE contract_letterheads (
  id                UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id   UUID NOT NULL,
  sha256            CHAR(64) NOT NULL,
  mime_type         VARCHAR(20) NOT NULL,
  width             INT NOT NULL,
  height            INT NOT NULL,
  size_bytes        INT NOT NULL,
  original_filename VARCHAR(200) NULL,
  data              BYTEA NOT NULL,
  uploaded_by       UUID NULL,
  created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_contract_letterheads PRIMARY KEY (id),
  CONSTRAINT fk_cl_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cl_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES members(id),
  CONSTRAINT chk_cl_mime CHECK (mime_type IN ('image/png','image/jpeg')),
  CONSTRAINT chk_cl_size CHECK (size_bytes > 0 AND size_bytes <= 2621440),
  CONSTRAINT chk_cl_dims CHECK (width > 0 AND height > 0),
  CONSTRAINT uq_cl_org_sha UNIQUE (organization_id, sha256)
);

-- ─── H. contract_settings (D-03, D-17) ────────────────────────────────────────
-- template_body continua existindo (legado, sem leitura nova).
-- text_* NULL = texto padrão do código.
ALTER TABLE contract_settings
  ADD COLUMN studio_name               VARCHAR(160) NULL,
  ADD COLUMN studio_cnpj               VARCHAR(18) NULL,
  ADD COLUMN studio_address            TEXT NULL,
  ADD COLUMN studio_representative     VARCHAR(160) NULL,
  ADD COLUMN studio_representative_rg  VARCHAR(20) NULL,
  ADD COLUMN forum_city                VARCHAR(80) NULL,
  ADD COLUMN forum_uf                  CHAR(2) NULL,
  ADD COLUMN withdrawal_notice_days    INT NOT NULL DEFAULT 30,
  ADD COLUMN text_title                TEXT NULL,
  ADD COLUMN text_intro                TEXT NULL,
  ADD COLUMN text_parties              TEXT NULL,
  ADD COLUMN text_trial_note           TEXT NULL,
  ADD COLUMN text_clauses              TEXT NULL,
  ADD COLUMN letterhead_sha256         CHAR(64) NULL,
  ADD CONSTRAINT chk_cs_withdrawal CHECK (withdrawal_notice_days BETWEEN 0 AND 365),
  ADD CONSTRAINT fk_cs_letterhead FOREIGN KEY (organization_id, letterhead_sha256)
    REFERENCES contract_letterheads(organization_id, sha256);

-- ─── I. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE contract_deposit_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_deposit_installments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_deposit_installments
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE contract_letterheads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_letterheads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contract_letterheads
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
    REVOKE UPDATE, DELETE ON contract_letterheads FROM sgs_app;
  END IF;
END $$;

-- ─── J. Backfill determinístico ───────────────────────────────────────────────
-- Roda como migrator (BYPASSRLS), nunca remove nada e rodar de novo não muda
-- nada (exceto revogar tokens novos de contratos aguardando aceite — aceitável).
-- BEGIN BACKFILL 04.1
INSERT INTO contract_deposit_installments (organization_id, contract_id, seq, amount, due_date) SELECT c.organization_id, c.id, 1, c.deposit_amount, (COALESCE(c.accepted_at, c.created_at) AT TIME ZONE COALESCE(o.timezone, 'America/Sao_Paulo'))::date FROM contracts c JOIN organizations o ON o.id = c.organization_id WHERE c.deposit_amount > 0 AND NOT EXISTS (SELECT 1 FROM contract_deposit_installments i WHERE i.contract_id = c.id) ON CONFLICT ON CONSTRAINT uq_cdi_contract_seq DO NOTHING;

UPDATE contract_items SET package_id = ranked.pkg_id FROM (SELECT ci.id AS id, c.package_id AS pkg_id, ps.quantity AS qty, ROW_NUMBER() OVER (PARTITION BY ci.contract_id, ci.service_id ORDER BY ci.sort_order, ci.created_at, ci.id) AS rn FROM contract_items ci JOIN contracts c ON c.id = ci.contract_id JOIN bridal_group_members m ON m.id = ci.group_member_id AND m.role = 'bride' JOIN package_services ps ON ps.package_id = c.package_id AND ps.service_id = ci.service_id WHERE c.package_id IS NOT NULL AND c.status <> 'cancelled' AND ci.purpose = 'event' AND NOT EXISTS (SELECT 1 FROM contract_items x WHERE x.contract_id = c.id AND x.package_id IS NOT NULL)) ranked WHERE contract_items.id = ranked.id AND ranked.rn <= ranked.qty;

UPDATE contract_access_tokens t SET revoked_at = now() FROM contracts c WHERE t.contract_id = c.id AND c.status = 'awaiting_acceptance' AND t.revoked_at IS NULL;
-- END BACKFILL 04.1
