-- Append-only enforcement for audit_log (ADR-0005). Idempotent — run after
-- `prisma migrate deploy`, as the schema owner. Re-runnable on every deploy.

-- 1) Reject UPDATE and DELETE on audit_log at the database level, so even a privileged
--    mistake cannot rewrite history. The hash chain detects tampering; this prevents it.
CREATE OR REPLACE FUNCTION vop_audit_no_mutate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON audit_log;
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION vop_audit_no_mutate();

DROP TRIGGER IF EXISTS audit_no_delete ON audit_log;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION vop_audit_no_mutate();

-- 2) Least-privilege runtime role. Migrations run as the owner; the application connects as
--    vop_app, which can read/write app tables but has only INSERT/SELECT on audit_log.
--    NOTE: set a real password out-of-band (ALTER ROLE vop_app PASSWORD :'secret') from the
--    secrets manager — the placeholder here is never a real credential.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vop_app') THEN
    CREATE ROLE vop_app LOGIN PASSWORD 'changeme';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO vop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vop_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vop_app;

-- Future tables/sequences created by the owner inherit these grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vop_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vop_app;

-- ...but never UPDATE/DELETE on the audit trail.
REVOKE UPDATE, DELETE ON audit_log FROM vop_app;
