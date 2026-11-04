-- Custo de serviços e itens de custo de pacotes (lucro do pacote)
-- ─── A. services.cost_price ──────────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_services_cost_price CHECK (cost_price >= 0);

-- ─── B. package_cost_items ───────────────────────────────────────────────────
-- Custos do pacote que não são serviços (lanche, champagne, assistente...).
CREATE TABLE package_cost_items (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  package_id      UUID NOT NULL,
  name            VARCHAR(120) NOT NULL,
  cost            DECIMAL(12,2) NOT NULL,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_package_cost_items PRIMARY KEY (id),
  CONSTRAINT fk_pci_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_pci_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  CONSTRAINT chk_pci_cost CHECK (cost >= 0)
);
CREATE INDEX ix_pci_org_package ON package_cost_items(organization_id, package_id);

ALTER TABLE package_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_cost_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON package_cost_items
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
