-- ─── SGS PostgreSQL Initialization ──────────────────────────────────────────
-- This script runs once when the PostgreSQL container is first created.
-- It creates the two database roles required for RLS isolation:
--   sgs_migrator: BYPASSRLS — used only for Prisma migrations
--   sgs_app:      no bypass — used by the application at runtime
--
-- CRITICAL: PgBouncer MUST run in transaction-mode so that SET LOCAL for
-- app.current_tenant_id is properly scoped to each transaction and does not
-- leak between connections in the pool.
-- ─────────────────────────────────────────────────────────────────────────────

-- The sgs_migrator role is created by POSTGRES_USER in docker-compose.
-- We just need to create sgs_app and configure permissions.

DO $$
BEGIN
  -- Create sgs_app role if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    CREATE ROLE sgs_app WITH LOGIN PASSWORD 'sgs_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    RAISE NOTICE 'Created role: sgs_app';
  ELSE
    RAISE NOTICE 'Role sgs_app already exists — skipping';
  END IF;
END
$$;

-- Grant sgs_app connect and usage privileges
GRANT CONNECT ON DATABASE sgs_dev TO sgs_app;
GRANT USAGE ON SCHEMA public TO sgs_app;

-- Grant sgs_migrator (superuser of this DB) BYPASSRLS capability
-- Note: sgs_migrator is created via POSTGRES_USER in docker-compose
ALTER ROLE sgs_migrator BYPASSRLS;

-- Grant sgs_app privileges on existing and future tables
ALTER DEFAULT PRIVILEGES FOR ROLE sgs_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sgs_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sgs_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sgs_app;

-- Allow sgs_app to execute functions
ALTER DEFAULT PRIVILEGES FOR ROLE sgs_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO sgs_app;
