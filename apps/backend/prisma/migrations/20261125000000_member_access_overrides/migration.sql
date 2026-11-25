-- Fase 10 — ajustes de acesso por pessoa. Só as diferenças em relação ao padrão do papel;
-- item_id é validado no serviço contra o catálogo em código (authz/access/access-catalog.ts).
CREATE TABLE member_access_overrides (
  member_id        uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES organizations(id),
  item_id          varchar(60) NOT NULL,
  enabled          boolean NOT NULL,
  updated_by       uuid NULL REFERENCES members(id) ON DELETE SET NULL,
  updated_at       timestamptz(6) NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, item_id)
);
CREATE INDEX ix_mao_org ON member_access_overrides (organization_id);
ALTER TABLE member_access_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_access_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON member_access_overrides
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
