#!/bin/sh
# ─── SGS PostgreSQL Initialization (staging) ────────────────────────────────
# Runs once, when the staging PostgreSQL volume is first created.
#
# Same contract as infra/postgres/init/01-create-roles.sql, but the sgs_app
# password and the database name come from the environment instead of being
# hardcoded, so staging can use real secrets.
#   sgs_migrator: BYPASSRLS — Prisma migrations only (created via POSTGRES_USER)
#   sgs_app:      no bypass — application runtime, subject to RLS
# ─────────────────────────────────────────────────────────────────────────────
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sgs_app') THEN
    CREATE ROLE sgs_app WITH LOGIN PASSWORD '${SGS_APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    RAISE NOTICE 'Created role: sgs_app';
  ELSE
    ALTER ROLE sgs_app WITH PASSWORD '${SGS_APP_PASSWORD}';
    RAISE NOTICE 'Role sgs_app already exists — password updated';
  END IF;
END
\$\$;

GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO sgs_app;
GRANT USAGE ON SCHEMA public TO sgs_app;

ALTER ROLE ${POSTGRES_USER} BYPASSRLS;

ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sgs_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sgs_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO sgs_app;
SQL
