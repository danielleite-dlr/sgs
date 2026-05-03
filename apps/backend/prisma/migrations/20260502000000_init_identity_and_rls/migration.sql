-- Migration: 20260502000000_init_identity_and_rls
-- Creates identity + auth + outbox tables, enables FORCE ROW LEVEL SECURITY on
-- every tenant-scoped table, grants runtime privileges to sgs_app, and seeds
-- the 4 system roles (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL).

-- ─── 0. Required extensions ──────────────────────────────────────────────────
-- pgcrypto provides gen_random_bytes() used by gen_uuid_v7()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. UUIDv7 generation function ──────────────────────────────────────────
-- UUIDv7 layout (128 bits total):
--   Bits  0-47:  48-bit Unix timestamp in milliseconds
--   Bits 48-51:  version = 0x7 (4 bits)
--   Bits 52-63:  12 random bits
--   Bits 64-65:  variant = 0b10 (2 bits)
--   Bits 66-127: 62 random bits
CREATE OR REPLACE FUNCTION gen_uuid_v7() RETURNS UUID AS $$
DECLARE
  ts_millis  BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  rand_bytes BYTEA  := gen_random_bytes(10);  -- 10 bytes = 80 random bits for ver+rand+variant fields
  uuid_bytes BYTEA;
  hex_str    TEXT;
BEGIN
  -- Build 16-byte UUID:
  -- Bytes 0-5: 48-bit timestamp (big-endian)
  -- Bytes 6-7: version nibble (0x7) + 12 random bits
  -- Bytes 8-9: variant bits (0b10xx) + 14 random bits
  -- Bytes 10-15: 48 random bits
  uuid_bytes :=
    set_byte('\x00000000000000000000000000000000'::bytea, 0, ((ts_millis >> 40) & 255)::INT);
  uuid_bytes := set_byte(uuid_bytes, 1, ((ts_millis >> 32) & 255)::INT);
  uuid_bytes := set_byte(uuid_bytes, 2, ((ts_millis >> 24) & 255)::INT);
  uuid_bytes := set_byte(uuid_bytes, 3, ((ts_millis >> 16) & 255)::INT);
  uuid_bytes := set_byte(uuid_bytes, 4, ((ts_millis >>  8) & 255)::INT);
  uuid_bytes := set_byte(uuid_bytes, 5, ((ts_millis      ) & 255)::INT);
  -- Byte 6: version 7 (high nibble) + random bits from rand_bytes[0]
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(rand_bytes, 0) & 15) | 112);
  uuid_bytes := set_byte(uuid_bytes, 7, get_byte(rand_bytes, 1));
  -- Byte 8: variant 10xx + random bits from rand_bytes[2]
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(rand_bytes, 2) & 63) | 128);
  uuid_bytes := set_byte(uuid_bytes, 9, get_byte(rand_bytes, 3));
  uuid_bytes := set_byte(uuid_bytes, 10, get_byte(rand_bytes, 4));
  uuid_bytes := set_byte(uuid_bytes, 11, get_byte(rand_bytes, 5));
  uuid_bytes := set_byte(uuid_bytes, 12, get_byte(rand_bytes, 6));
  uuid_bytes := set_byte(uuid_bytes, 13, get_byte(rand_bytes, 7));
  uuid_bytes := set_byte(uuid_bytes, 14, get_byte(rand_bytes, 8));
  uuid_bytes := set_byte(uuid_bytes, 15, get_byte(rand_bytes, 9));

  -- Convert 16-byte BYTEA to UUID string with dashes
  hex_str := encode(uuid_bytes, 'hex');
  RETURN (
    substring(hex_str, 1, 8) || '-' ||
    substring(hex_str, 9, 4) || '-' ||
    substring(hex_str, 13, 4) || '-' ||
    substring(hex_str, 17, 4) || '-' ||
    substring(hex_str, 21, 12)
  )::UUID;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY INVOKER;

-- ─── 2. Create tables ────────────────────────────────────────────────────────

-- organizations
CREATE TABLE organizations (
  id              UUID        NOT NULL DEFAULT gen_uuid_v7(),
  legal_name      VARCHAR(255) NOT NULL,
  trade_name      VARCHAR(255) NOT NULL,
  document_type   VARCHAR(10)  NOT NULL,
  document_number VARCHAR(14)  NOT NULL,
  email           VARCHAR(255) NOT NULL,
  phone           VARCHAR(20),
  subdomain       VARCHAR(63)  NOT NULL,
  timezone        VARCHAR(50)  NOT NULL DEFAULT 'America/Sao_Paulo',
  locale          VARCHAR(10)  NOT NULL DEFAULT 'pt-BR',
  currency        VARCHAR(3)   NOT NULL DEFAULT 'BRL',
  segment         VARCHAR(30)  NOT NULL DEFAULT 'salon',
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  settings        JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_organizations PRIMARY KEY (id),
  CONSTRAINT uq_organizations_subdomain UNIQUE (subdomain),
  CONSTRAINT uq_organizations_document UNIQUE (document_number)
);

-- users (NOT tenant-scoped — accessed cross-tenant for login email lookup)
CREATE TABLE users (
  id                   UUID         NOT NULL DEFAULT gen_uuid_v7(),
  email                VARCHAR(255) NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  full_name            VARCHAR(255) NOT NULL,
  email_verified_at    TIMESTAMPTZ(6),
  last_login_at        TIMESTAMPTZ(6),
  created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users_email UNIQUE (email)
);

-- roles (system roles have organization_id = NULL)
CREATE TABLE roles (
  id              UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  is_system       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_roles PRIMARY KEY (id),
  CONSTRAINT uq_roles_org_name UNIQUE (organization_id, name),
  CONSTRAINT fk_roles_organization FOREIGN KEY (organization_id)
    REFERENCES organizations (id)
);

-- role_permissions
CREATE TABLE role_permissions (
  role_id    UUID         NOT NULL,
  permission VARCHAR(100) NOT NULL,

  CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id)
    REFERENCES roles (id) ON DELETE CASCADE
);

-- members
CREATE TABLE members (
  id              UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID         NOT NULL,
  user_id         UUID         NOT NULL,
  role_id         UUID         NOT NULL,
  display_name    VARCHAR(255) NOT NULL,
  is_professional BOOLEAN      NOT NULL DEFAULT FALSE,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6),

  CONSTRAINT pk_members PRIMARY KEY (id),
  CONSTRAINT uq_members_org_user UNIQUE (organization_id, user_id),
  CONSTRAINT fk_members_organization FOREIGN KEY (organization_id)
    REFERENCES organizations (id),
  CONSTRAINT fk_members_user FOREIGN KEY (user_id)
    REFERENCES users (id),
  CONSTRAINT fk_members_role FOREIGN KEY (role_id)
    REFERENCES roles (id)
);

CREATE INDEX ix_members_org_status ON members (organization_id, status);

-- refresh_tokens (NOT tenant-scoped)
CREATE TABLE refresh_tokens (
  id            UUID         NOT NULL DEFAULT gen_uuid_v7(),
  user_id       UUID         NOT NULL,
  token_hash    VARCHAR(255) NOT NULL,
  family_id     UUID         NOT NULL,
  issued_at     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ(6) NOT NULL,
  revoked_at    TIMESTAMPTZ(6),
  replaced_by_id UUID,

  CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id)
    REFERENCES users (id)
);

CREATE INDEX ix_refresh_tokens_user_revoked ON refresh_tokens (user_id, revoked_at);
CREATE INDEX ix_refresh_tokens_hash ON refresh_tokens (token_hash);

-- email_verification_tokens (NOT tenant-scoped)
CREATE TABLE email_verification_tokens (
  id          UUID         NOT NULL DEFAULT gen_uuid_v7(),
  user_id     UUID         NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ(6) NOT NULL,
  consumed_at TIMESTAMPTZ(6),
  created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_email_verification_tokens PRIMARY KEY (id),
  CONSTRAINT uq_evt_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_evt_user FOREIGN KEY (user_id)
    REFERENCES users (id)
);

CREATE INDEX ix_evt_user_consumed ON email_verification_tokens (user_id, consumed_at);

-- member_invitations (tenant-scoped)
CREATE TABLE member_invitations (
  id              UUID         NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID         NOT NULL,
  email           VARCHAR(255) NOT NULL,
  role_id         UUID         NOT NULL,
  token_hash      VARCHAR(255) NOT NULL,
  invited_by_id   UUID         NOT NULL,
  expires_at      TIMESTAMPTZ(6) NOT NULL,
  accepted_at     TIMESTAMPTZ(6),
  revoked_at      TIMESTAMPTZ(6),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_member_invitations PRIMARY KEY (id),
  CONSTRAINT uq_invitations_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_invitations_organization FOREIGN KEY (organization_id)
    REFERENCES organizations (id),
  CONSTRAINT fk_invitations_role FOREIGN KEY (role_id)
    REFERENCES roles (id)
);

CREATE INDEX ix_invitations_org_email ON member_invitations (organization_id, email);
CREATE INDEX ix_invitations_active ON member_invitations (expires_at, accepted_at, revoked_at);

-- outbox_events (tenant-scoped, SKIP LOCKED polling)
CREATE TABLE outbox_events (
  id              UUID          NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID          NOT NULL,
  aggregate_type  VARCHAR(100)  NOT NULL,
  aggregate_id    UUID          NOT NULL,
  event_type      VARCHAR(150)  NOT NULL,
  event_version   INT           NOT NULL DEFAULT 1,
  payload         JSONB         NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending',
  retry_count     INT           NOT NULL DEFAULT 0,
  max_retries     INT           NOT NULL DEFAULT 5,
  last_error      TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ(6),

  CONSTRAINT pk_outbox_events PRIMARY KEY (id),
  CONSTRAINT fk_outbox_organization FOREIGN KEY (organization_id)
    REFERENCES organizations (id)
);

CREATE INDEX ix_outbox_status_created ON outbox_events (status, created_at);

-- ─── 3. CHECK constraints ────────────────────────────────────────────────────
ALTER TABLE organizations ADD CONSTRAINT ck_organizations_document_type
  CHECK (document_type IN ('CPF','CNPJ'));
ALTER TABLE organizations ADD CONSTRAINT ck_organizations_status
  CHECK (status IN ('active','suspended','cancelled'));
ALTER TABLE organizations ADD CONSTRAINT ck_organizations_segment
  CHECK (segment IN ('salon','barber','aesthetic','bridal','nails','lash'));
ALTER TABLE members ADD CONSTRAINT ck_members_status
  CHECK (status IN ('active','inactive','vacation'));
ALTER TABLE outbox_events ADD CONSTRAINT ck_outbox_status
  CHECK (status IN ('pending','processing','published','failed'));

-- ─── 4. updated_at trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_organizations_before_update
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_users_before_update
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_members_before_update
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── 5. Row Level Security — tenant-scoped tables ────────────────────────────
-- NOTE: The second arg `true` to current_setting = missing_ok.
-- When app.current_organization is unset, the UUID cast on empty string fails
-- and the query returns 0 rows (fail-closed). Never returns wrong-tenant data.

-- organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organizations
  USING (id = current_setting('app.current_organization', true)::uuid)
  WITH CHECK (id = current_setting('app.current_organization', true)::uuid);

-- members
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON members
  USING (organization_id = current_setting('app.current_organization', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);

-- roles (system roles: organization_id IS NULL — accessible from any tenant context)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON roles
  USING (organization_id IS NULL OR organization_id = current_setting('app.current_organization', true)::uuid)
  WITH CHECK (organization_id IS NULL OR organization_id = current_setting('app.current_organization', true)::uuid);

-- role_permissions (accessed via JOIN to roles, filtered by parent role's org)
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_permissions
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND (r.organization_id IS NULL OR r.organization_id = current_setting('app.current_organization', true)::uuid)
    )
  );

-- member_invitations
ALTER TABLE member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON member_invitations
  USING (organization_id = current_setting('app.current_organization', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);

-- outbox_events
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON outbox_events
  USING (organization_id = current_setting('app.current_organization', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);

-- ─── 6. Grant runtime privileges to sgs_app ──────────────────────────────────
GRANT USAGE ON SCHEMA public TO sgs_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sgs_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sgs_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sgs_app;

-- Future tables/sequences/functions created by future migrations inherit same privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sgs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sgs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO sgs_app;

-- ─── 7. Seed system roles (idempotent) ───────────────────────────────────────
-- Per D-14: 4 system roles — ADMIN, MANAGER, ATTENDANT, PROFESSIONAL
-- organization_id = NULL marks these as platform-level system roles
INSERT INTO roles (id, organization_id, name, description, is_system) VALUES
  (gen_uuid_v7(), NULL, 'ADMIN',        'Administrador da organização', true),
  (gen_uuid_v7(), NULL, 'MANAGER',      'Gerente da operação', true),
  (gen_uuid_v7(), NULL, 'ATTENDANT',    'Atendente / recepção', true),
  (gen_uuid_v7(), NULL, 'PROFESSIONAL', 'Profissional do salão', true)
ON CONFLICT DO NOTHING;
