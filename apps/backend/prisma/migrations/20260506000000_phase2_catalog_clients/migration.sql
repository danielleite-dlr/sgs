-- Migration: 20260506000000_phase2_catalog_clients
-- Phase 2: Catalog (categories, services, service_pricing_variants, packages, package_services,
--          products, stock_movements, commission_rules) + Clients + Notifications
-- Also: ALTER members.seniority_tier, FORCE RLS on all new tenant-scoped tables.
--
-- Conventions (Phase 1):
--   - UUID PK via gen_uuid_v7()
--   - organization_id NOT NULL FK on every tenant-scoped table
--   - TIMESTAMPTZ(6) for timestamps
--   - DECIMAL(12,2) for money; DECIMAL(12,4) for commission rates
--   - soft delete via deleted_at TIMESTAMPTZ(6)
--   - RLS: nullif(current_setting('app.current_organization', true), '')::uuid pattern

-- ─── A. ALTER members — add seniority_tier ────────────────────────────────────
ALTER TABLE members
  ADD COLUMN seniority_tier VARCHAR(20)
    CHECK (seniority_tier IS NULL OR seniority_tier IN ('junior','pleno','senior'));

-- ─── B. categories ────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  parent_id       UUID,
  name            VARCHAR(120) NOT NULL,
  display_order   INTEGER NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  CONSTRAINT pk_categories PRIMARY KEY (id),
  CONSTRAINT fk_categories_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id)
);
CREATE INDEX ix_categories_org_parent ON categories(organization_id, parent_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_categories_org_order ON categories(organization_id, parent_id, display_order) WHERE deleted_at IS NULL;

-- ─── C. services ──────────────────────────────────────────────────────────────
CREATE TABLE services (
  id                       UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id          UUID NOT NULL,
  category_id              UUID NOT NULL,
  name                     VARCHAR(160) NOT NULL,
  base_price               DECIMAL(12,2) NOT NULL,
  default_duration_minutes INTEGER NOT NULL,
  display_order            INTEGER NOT NULL DEFAULT 0,
  cover_image_url          TEXT,
  created_at               TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ(6),
  CONSTRAINT pk_services PRIMARY KEY (id),
  CONSTRAINT fk_services_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT chk_services_price_nonneg CHECK (base_price >= 0),
  CONSTRAINT chk_services_duration_pos CHECK (default_duration_minutes > 0)
);
CREATE INDEX ix_services_org_category ON services(organization_id, category_id) WHERE deleted_at IS NULL;

-- service_pricing_variants
CREATE TABLE service_pricing_variants (
  id               UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id  UUID NOT NULL,
  service_id       UUID NOT NULL,
  name             VARCHAR(120) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  seniority_tier   VARCHAR(20) CHECK (seniority_tier IS NULL OR seniority_tier IN ('junior','pleno','senior')),
  price            DECIMAL(12,2) NOT NULL,
  display_order    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_service_pricing_variants PRIMARY KEY (id),
  CONSTRAINT fk_spv_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_spv_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT chk_spv_price_nonneg CHECK (price >= 0),
  CONSTRAINT chk_spv_duration_pos CHECK (duration_minutes > 0)
);
CREATE INDEX ix_spv_service ON service_pricing_variants(service_id);

-- ─── D. packages + package_services ──────────────────────────────────────────
CREATE TABLE packages (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  name            VARCHAR(160) NOT NULL,
  price           DECIMAL(12,2) NOT NULL,
  valid_for_days  INTEGER,
  cover_image_url TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  CONSTRAINT pk_packages PRIMARY KEY (id),
  CONSTRAINT fk_packages_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_packages_price_nonneg CHECK (price >= 0),
  CONSTRAINT chk_packages_valid_pos CHECK (valid_for_days IS NULL OR valid_for_days > 0)
);
CREATE INDEX ix_packages_org ON packages(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE package_services (
  package_id    UUID NOT NULL,
  service_id    UUID NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT pk_package_services PRIMARY KEY (package_id, service_id),
  CONSTRAINT fk_pkgsvc_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_pkgsvc_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT chk_pkgsvc_quantity_pos CHECK (quantity > 0)
);

-- ─── E. products + stock_movements ────────────────────────────────────────────
CREATE TABLE products (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  name            VARCHAR(160) NOT NULL,
  sku             VARCHAR(60) NOT NULL,
  cost_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  sale_price      DECIMAL(12,2) NOT NULL,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  unit            VARCHAR(10) NOT NULL CHECK (unit IN ('un','ml','g')),
  cover_image_url TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  CONSTRAINT pk_products PRIMARY KEY (id),
  CONSTRAINT fk_products_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT uq_products_org_sku UNIQUE (organization_id, sku),
  CONSTRAINT chk_products_sale_nonneg CHECK (sale_price >= 0),
  CONSTRAINT chk_products_cost_nonneg CHECK (cost_price >= 0),
  CONSTRAINT chk_products_min_stock_nonneg CHECK (min_stock_level >= 0)
);
CREATE INDEX ix_products_org ON products(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_products_low_stock ON products(organization_id) WHERE deleted_at IS NULL AND stock_quantity <= min_stock_level;

CREATE TABLE stock_movements (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  product_id      UUID NOT NULL,
  delta           INTEGER NOT NULL,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('initial','manual_adjustment','sale','return')),
  reason          TEXT,
  performed_by    UUID,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_stock_movements PRIMARY KEY (id),
  CONSTRAINT fk_sm_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_sm_member FOREIGN KEY (performed_by) REFERENCES members(id)
);
CREATE INDEX ix_sm_product_created ON stock_movements(product_id, created_at DESC);
CREATE INDEX ix_sm_org_created ON stock_movements(organization_id, created_at DESC);

-- ─── F. commission_rules ──────────────────────────────────────────────────────
CREATE TABLE commission_rules (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  scope_type      VARCHAR(20) NOT NULL CHECK (scope_type IN ('member_service','service','category','product','default')),
  service_id      UUID,
  member_id       UUID,
  category_id     UUID,
  product_id      UUID,
  kind            VARCHAR(20) NOT NULL CHECK (kind IN ('fixed','percentage')),
  value           DECIMAL(12,4) NOT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  CONSTRAINT pk_commission_rules PRIMARY KEY (id),
  CONSTRAINT fk_cr_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_cr_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_cr_member FOREIGN KEY (member_id) REFERENCES members(id),
  CONSTRAINT fk_cr_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_cr_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_cr_value_nonneg CHECK (value >= 0),
  CONSTRAINT chk_cr_scope_shape CHECK (
    (scope_type = 'member_service' AND member_id IS NOT NULL AND service_id IS NOT NULL AND category_id IS NULL AND product_id IS NULL) OR
    (scope_type = 'service'        AND service_id IS NOT NULL AND member_id IS NULL AND category_id IS NULL AND product_id IS NULL) OR
    (scope_type = 'category'       AND category_id IS NOT NULL AND member_id IS NULL AND service_id IS NULL AND product_id IS NULL) OR
    (scope_type = 'product'        AND product_id IS NOT NULL AND member_id IS NULL AND service_id IS NULL AND category_id IS NULL) OR
    (scope_type = 'default'        AND member_id IS NULL AND service_id IS NULL AND category_id IS NULL AND product_id IS NULL)
  )
);
CREATE UNIQUE INDEX uq_cr_org_default ON commission_rules(organization_id) WHERE scope_type = 'default' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_cr_org_member_service ON commission_rules(organization_id, member_id, service_id) WHERE scope_type = 'member_service' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_cr_org_service ON commission_rules(organization_id, service_id) WHERE scope_type = 'service' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_cr_org_category ON commission_rules(organization_id, category_id) WHERE scope_type = 'category' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_cr_org_product ON commission_rules(organization_id, product_id) WHERE scope_type = 'product' AND deleted_at IS NULL;

-- ─── G. clients ───────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  phone           VARCHAR(30),
  email           VARCHAR(255),
  cpf             VARCHAR(14),
  birth_date      DATE,
  address         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),
  version         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT pk_clients PRIMARY KEY (id),
  CONSTRAINT fk_clients_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_clients_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX ix_clients_org_name ON clients(organization_id, full_name) WHERE deleted_at IS NULL;
CREATE INDEX ix_clients_org_cpf ON clients(organization_id, cpf) WHERE cpf IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_clients_org_phone ON clients(organization_id, phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_clients_org_email ON clients(organization_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;

-- ─── H. notifications ─────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  member_id       UUID,
  kind            VARCHAR(40) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  read_at         TIMESTAMPTZ(6),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_notifications PRIMARY KEY (id),
  CONSTRAINT fk_notif_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_notif_member FOREIGN KEY (member_id) REFERENCES members(id)
);
CREATE INDEX ix_notif_org_member_unread ON notifications(organization_id, member_id, created_at DESC) WHERE read_at IS NULL;

-- ─── I. FORCE ROW LEVEL SECURITY on all new tenant-scoped tables ──────────────
-- Pattern: nullif(current_setting('app.current_organization', true), '')::uuid
-- (Phase 1 established pattern — empty-string safe for PgBouncer/RESET behavior)

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON categories
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON services
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- service_pricing_variants
ALTER TABLE service_pricing_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pricing_variants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON service_pricing_variants
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- packages
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON packages
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- package_services (junction: derive tenancy via parent packages row)
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON package_services
  USING (
    EXISTS (
      SELECT 1 FROM packages p
      WHERE p.id = package_services.package_id
        AND p.organization_id = nullif(current_setting('app.current_organization', true), '')::uuid
    )
  );

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_movements
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- commission_rules
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commission_rules
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clients
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notifications
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

-- ─── J. updated_at triggers for mutable tables ───────────────────────────────
-- fn_set_updated_at() already exists from Phase 1 migration

CREATE TRIGGER tg_categories_before_update
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_services_before_update
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_service_pricing_variants_before_update
  BEFORE UPDATE ON service_pricing_variants
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_packages_before_update
  BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_products_before_update
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_commission_rules_before_update
  BEFORE UPDATE ON commission_rules
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_clients_before_update
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- NOTE: sgs_app privileges for new tables are inherited from ALTER DEFAULT PRIVILEGES
-- set in the Phase 1 init migration (no explicit GRANT needed per table).
