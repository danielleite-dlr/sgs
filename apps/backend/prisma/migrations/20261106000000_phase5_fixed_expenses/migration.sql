-- Fase 5 (FIN-03, D-06): despesas fixas mensais, só para alimentar a previsão de 30 dias.
CREATE TABLE fixed_expenses (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  name            VARCHAR(120) NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  due_day         SMALLINT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_fixed_expenses PRIMARY KEY (id),
  CONSTRAINT fk_fe_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_fe_amount CHECK (amount > 0),
  CONSTRAINT chk_fe_due_day CHECK (due_day BETWEEN 1 AND 31),
  CONSTRAINT chk_fe_name CHECK (length(btrim(name)) >= 2)
);
CREATE INDEX ix_fe_org ON fixed_expenses(organization_id);

ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fixed_expenses
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON fixed_expenses TO sgs_app;
  END IF;
END $$;

DO $$
DECLARE
  v_admin uuid;
  v_manager uuid;
BEGIN
  SELECT id INTO v_admin FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1;
  SELECT id INTO v_manager FROM roles WHERE name='MANAGER' AND is_system=true LIMIT 1;
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_admin, 'financial.expenseWrite'),
    (v_manager, 'financial.expenseWrite')
  ON CONFLICT DO NOTHING;
END $$;
