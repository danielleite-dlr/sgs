-- Fase 09: Comercial (CRM do Atimos no SGS)
-- A. tabelas; B. indices; C. RLS; D. triggers; E. etapas padrao; F. permissoes.
-- FKs para members/contracts/clients/packages sao anulaveis com ON DELETE SET NULL,
-- para nao quebrar purge_member / purge_bridal_group.

-- ─── A. Tabelas ───────────────────────────────────────────────────────────────
CREATE TABLE commercial_stages (
  id              UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID         NOT NULL,
  name            VARCHAR(60)  NOT NULL,
  color           VARCHAR(7)   NOT NULL,
  position        INT          NOT NULL,
  sla_days        INT          NULL,
  kind            VARCHAR(10)  NOT NULL,
  is_system       BOOLEAN      NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_commercial_stages PRIMARY KEY (id),
  CONSTRAINT fk_cs_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_cs_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT chk_cs_sla CHECK (sla_days IS NULL OR sla_days BETWEEN 1 AND 365),
  CONSTRAINT chk_cs_kind CHECK (kind IN ('open','won','lost')),
  CONSTRAINT chk_cs_sla_open CHECK (kind = 'open' OR sla_days IS NULL)
);

CREATE TABLE commercial_leads (
  id                   UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id      UUID         NOT NULL,
  full_name            VARCHAR(255) NOT NULL,
  phone                VARCHAR(30)  NULL,
  phone_digits         VARCHAR(15)  NULL,
  email                VARCHAR(255) NULL,
  source               VARCHAR(20)  NOT NULL DEFAULT 'manual',
  notes                TEXT         NULL,
  client_id            UUID         NULL,
  created_by           UUID         NULL,
  consent_at           TIMESTAMPTZ(6) NULL,
  consent_text_version VARCHAR(40)  NULL,
  deleted_at           TIMESTAMPTZ(6) NULL,
  created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_commercial_leads PRIMARY KEY (id),
  CONSTRAINT fk_cl_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cl_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_cl_created_by FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT chk_cl_source CHECK (source IN ('manual','instagram','indicacao','site','whatsapp','import','outro')),
  CONSTRAINT chk_cl_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE commercial_deals (
  id                  UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id     UUID         NOT NULL,
  lead_id             UUID         NOT NULL,
  stage_id            UUID         NOT NULL,
  status              VARCHAR(10)  NOT NULL DEFAULT 'open',
  kind                VARCHAR(10)  NOT NULL,
  beneficiary_name    VARCHAR(255) NULL,
  event_date          DATE         NULL,
  package_id          UUID         NULL,
  package_name        VARCHAR(160) NULL,
  package_price       NUMERIC(12,2) NULL,
  discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_amount        NUMERIC(12,2) NULL,
  assignee_member_id  UUID         NULL,
  source              VARCHAR(20)  NOT NULL DEFAULT 'manual',
  location            VARCHAR(255) NULL,
  notes               TEXT         NULL,
  stage_entered_at    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMPTZ(6) NULL,
  lost_reason_code    VARCHAR(30)  NULL,
  lost_reason_text    VARCHAR(500) NULL,
  closed_at           TIMESTAMPTZ(6) NULL,
  won_contract_id     UUID         NULL,
  won_client_id       UUID         NULL,
  created_by          UUID         NULL,
  deleted_at          TIMESTAMPTZ(6) NULL,
  created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_commercial_deals PRIMARY KEY (id),
  CONSTRAINT fk_cd_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cd_lead FOREIGN KEY (lead_id) REFERENCES commercial_leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_cd_stage FOREIGN KEY (stage_id) REFERENCES commercial_stages(id),
  CONSTRAINT fk_cd_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_cd_assignee FOREIGN KEY (assignee_member_id) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_cd_won_contract FOREIGN KEY (won_contract_id) REFERENCES contracts(id) ON DELETE SET NULL,
  CONSTRAINT fk_cd_won_client FOREIGN KEY (won_client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_cd_created_by FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT chk_cd_status CHECK (status IN ('open','won','lost')),
  CONSTRAINT chk_cd_kind CHECK (kind IN ('noiva','debutante')),
  CONSTRAINT chk_cd_discount CHECK (discount_amount >= 0),
  CONSTRAINT chk_cd_source CHECK (source IN ('manual','instagram','indicacao','site','whatsapp','import','outro')),
  CONSTRAINT chk_cd_lost_code CHECK (lost_reason_code IS NULL OR lost_reason_code IN ('price','date_unavailable','chose_other','no_response','gave_up','other')),
  CONSTRAINT chk_cd_lost CHECK (status <> 'lost' OR lost_reason_code IS NOT NULL)
);

CREATE TABLE commercial_interactions (
  id              UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID         NOT NULL,
  lead_id         UUID         NOT NULL,
  deal_id         UUID         NULL,
  type            VARCHAR(10)  NOT NULL,
  notes           TEXT         NULL,
  occurred_at     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  created_by      UUID         NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_commercial_interactions PRIMARY KEY (id),
  CONSTRAINT fk_ci_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_ci_lead FOREIGN KEY (lead_id) REFERENCES commercial_leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_deal FOREIGN KEY (deal_id) REFERENCES commercial_deals(id) ON DELETE SET NULL,
  CONSTRAINT fk_ci_created_by FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT chk_ci_type CHECK (type IN ('call','whatsapp','email','meeting','visit','other'))
);

CREATE TABLE commercial_reminders (
  id              UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID         NOT NULL,
  lead_id         UUID         NULL,
  deal_id         UUID         NULL,
  interaction_id  UUID         NULL,
  title           VARCHAR(160) NOT NULL,
  description     TEXT         NULL,
  due_at          TIMESTAMPTZ(6) NOT NULL,
  completed_at    TIMESTAMPTZ(6) NULL,
  notified_at     TIMESTAMPTZ(6) NULL,
  created_by      UUID         NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_commercial_reminders PRIMARY KEY (id),
  CONSTRAINT fk_cr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cr_lead FOREIGN KEY (lead_id) REFERENCES commercial_leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_cr_deal FOREIGN KEY (deal_id) REFERENCES commercial_deals(id) ON DELETE SET NULL,
  CONSTRAINT fk_cr_interaction FOREIGN KEY (interaction_id) REFERENCES commercial_interactions(id) ON DELETE SET NULL,
  CONSTRAINT fk_cr_created_by FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL
);

CREATE TABLE commercial_form_settings (
  id                         UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id            UUID         NOT NULL,
  token                      VARCHAR(64)  NOT NULL,
  is_active                  BOOLEAN      NOT NULL DEFAULT false,
  default_assignee_member_id UUID         NULL,
  success_message            VARCHAR(300) NULL,
  consent_text               TEXT         NOT NULL DEFAULT 'Autorizo o salão a usar meus dados para entrar em contato sobre o orçamento, conforme a LGPD.',
  consent_text_version       VARCHAR(40)  NOT NULL DEFAULT 'v1',
  updated_by                 UUID         NULL,
  created_at                 TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_commercial_form_settings PRIMARY KEY (id),
  CONSTRAINT uq_cfs_org UNIQUE (organization_id),
  CONSTRAINT fk_cfs_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cfs_assignee FOREIGN KEY (default_assignee_member_id) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_cfs_updated_by FOREIGN KEY (updated_by) REFERENCES members(id) ON DELETE SET NULL
);

-- ─── B. Indices ───────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX uq_cs_won ON commercial_stages (organization_id) WHERE kind = 'won';
CREATE UNIQUE INDEX uq_cs_lost ON commercial_stages (organization_id) WHERE kind = 'lost';
CREATE INDEX ix_cs_org_position ON commercial_stages (organization_id, position);

CREATE INDEX ix_cl_org_phone ON commercial_leads (organization_id, phone_digits);
CREATE INDEX ix_cl_org_email ON commercial_leads (organization_id, lower(email));
CREATE INDEX ix_cl_org_created_by ON commercial_leads (organization_id, created_by);

CREATE UNIQUE INDEX uq_cd_won_contract ON commercial_deals (won_contract_id) WHERE won_contract_id IS NOT NULL;
CREATE INDEX ix_cd_org_stage ON commercial_deals (organization_id, stage_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_cd_org_assignee ON commercial_deals (organization_id, assignee_member_id);
CREATE INDEX ix_cd_org_lead ON commercial_deals (organization_id, lead_id);

CREATE INDEX ix_ci_org_lead ON commercial_interactions (organization_id, lead_id, occurred_at DESC);

CREATE INDEX ix_cr_due ON commercial_reminders (organization_id, due_at) WHERE completed_at IS NULL AND notified_at IS NULL;
CREATE INDEX ix_cr_org_deal ON commercial_reminders (organization_id, deal_id);

-- ─── C. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE commercial_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_stages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commercial_stages
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE commercial_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_leads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commercial_leads
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE commercial_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_deals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commercial_deals
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE commercial_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_interactions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commercial_interactions
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE commercial_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_reminders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commercial_reminders
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

ALTER TABLE commercial_form_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_form_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commercial_form_settings
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- ─── D. Triggers de updated_at ────────────────────────────────────────────────
CREATE TRIGGER trg_commercial_stages_updated_at BEFORE UPDATE ON commercial_stages
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_commercial_leads_updated_at BEFORE UPDATE ON commercial_leads
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_commercial_deals_updated_at BEFORE UPDATE ON commercial_deals
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_commercial_interactions_updated_at BEFORE UPDATE ON commercial_interactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_commercial_reminders_updated_at BEFORE UPDATE ON commercial_reminders
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_commercial_form_settings_updated_at BEFORE UPDATE ON commercial_form_settings
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── E. Etapas padrao para organizacoes existentes (idempotente) ──────────────
INSERT INTO commercial_stages (organization_id, name, color, position, sla_days, kind, is_system)
SELECT o.id, s.name, s.color, s.position, s.sla_days, s.kind, s.is_system
FROM organizations o
CROSS JOIN (VALUES
  ('Novo', '#64748B', 0, 1, 'open', false),
  ('Contato', '#3B82F6', 1, 3, 'open', false),
  ('Proposta', '#8B5CF6', 2, 3, 'open', false),
  ('Negociação', '#F59E0B', 3, 2, 'open', false),
  ('Ganho', '#16A34A', 100, NULL, 'won', true),
  ('Perdido', '#DC2626', 101, NULL, 'lost', true)
) AS s(name, color, position, sla_days, kind, is_system)
WHERE NOT EXISTS (SELECT 1 FROM commercial_stages cs WHERE cs.organization_id = o.id);

-- ─── F. Permissoes commercial.* ───────────────────────────────────────────────
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
    (v_admin, 'commercial.read'),
    (v_admin, 'commercial.write'),
    (v_admin, 'commercial.manage'),
    (v_manager, 'commercial.read'),
    (v_manager, 'commercial.write'),
    (v_manager, 'commercial.manage'),
    (v_attendant, 'commercial.read'),
    (v_attendant, 'commercial.write')
  ON CONFLICT DO NOTHING;
END $$;
