-- 3PL WMS PostgreSQL bootstrap
-- Executed once by the official postgres entrypoint against POSTGRES_DB.

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Roles ───────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wms_app') THEN
    CREATE ROLE wms_app
      WITH LOGIN
      PASSWORD 'wms_app_change_me'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;

COMMENT ON ROLE wms_app IS
  'Application runtime user. Session must set app.current_client_id for tenant RLS.';

-- wms (POSTGRES_USER) owns the database and runs Prisma migrations.
-- wms_app executes runtime queries under enforced row-level security.
DO $$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format('ALTER DATABASE %I OWNER TO wms', db_name);
END
$$;

ALTER ROLE wms_app SET search_path TO public;
ALTER ROLE wms_app SET row_security TO on;

-- ─── Database / schema grants ────────────────────────────────────────────────

DO $$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', db_name);
  EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO wms_app', db_name);
END
$$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO wms_app;

-- Prisma migrations run as wms; grant wms_app access to objects wms creates.
ALTER DEFAULT PRIVILEGES FOR ROLE wms IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wms_app;

ALTER DEFAULT PRIVILEGES FOR ROLE wms IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO wms_app;

ALTER DEFAULT PRIVILEGES FOR ROLE wms IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO wms_app;

-- ─── RLS session helpers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_current_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_client_id', true), '')::uuid;
$$;

REVOKE ALL ON FUNCTION app_current_client_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_client_id() TO wms_app;

COMMENT ON FUNCTION app_current_client_id() IS
  'Returns the tenant client UUID set for the current session (app.current_client_id).';
