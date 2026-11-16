-- Fase 7: tokens de aparelho para push (FCM v1), neutros em relação ao app (Capacitor agora, Expo depois).
CREATE TABLE device_tokens (
  id              UUID          NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID          NOT NULL,
  member_id       UUID          NOT NULL,
  provider        VARCHAR(10)   NOT NULL DEFAULT 'fcm',
  platform        VARCHAR(10)   NOT NULL,
  token           TEXT          NOT NULL,
  app_version     VARCHAR(20)   NULL,
  last_seen_at    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_device_tokens PRIMARY KEY (id),
  CONSTRAINT fk_device_tokens_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_device_tokens_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT chk_device_tokens_provider CHECK (provider IN ('fcm','expo')),
  CONSTRAINT chk_device_tokens_platform CHECK (platform IN ('android','ios')),
  CONSTRAINT chk_device_tokens_token CHECK (char_length(token) BETWEEN 1 AND 4096)
);

CREATE UNIQUE INDEX uq_device_tokens_org_provider_token ON device_tokens (organization_id, provider, token);
CREATE INDEX ix_device_tokens_org_member ON device_tokens (organization_id, member_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON device_tokens
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
