# Runbook — Database (PostgreSQL + Prisma)

## First-time setup (local)

```bash
pnpm compose:up                                   # starts postgres (+ redis, minio, …)
pnpm --filter @vop/api prisma:generate            # generate the Prisma client
pnpm --filter @vop/api prisma:migrate             # create/apply the dev migration
psql "$DATABASE_URL" -f apps/api/prisma/hardening/audit_append_only.sql
pnpm --filter @vop/api prisma:seed                # roles + demo users + dev IdP
```

## Migrations

- Schema of record: `apps/api/prisma/schema.prisma`. Never edit the DB by hand.
- Dev: `prisma migrate dev --name <change>` generates a migration and applies it.
- Prod/staging: `prisma migrate deploy` applies committed migrations only.
- After every deploy, re-run `hardening/audit_append_only.sql` (idempotent) so the audit
  triggers and least-privilege grants cover any new tables.

## Roles

- **Owner role** (migration/DDL): owns the schema, runs migrations and the hardening script.
- **App role `vop_app`** (runtime, least privilege): read/write app tables, **INSERT/SELECT only**
  on `audit_log`. Set its password from the secrets manager, not in SQL:
  `ALTER ROLE vop_app PASSWORD :'secret'`. Point `DATABASE_URL` (app) at `vop_app`.

## Audit integrity

- `audit_log` is append-only: DB triggers reject UPDATE/DELETE; the app hash-chains each row.
- Verify the chain via the AuditService (`verify()`), exposed to auditors in Phase 5.
- Retention: `VOP_AUDIT_RETENTION_DAYS` (default 8 years). Prune by archiving whole time
  partitions to WORM storage — never by deleting individual rows.

## Scale (large-enterprise profile)

- `audit_log` and future `document` tables are candidates for time-based partitioning.
- Configure read replicas and route read-only queries there once traffic warrants (ADR-0003).

## Backup / restore

- Encrypted logical (`pg_dump`) + physical (base backup / PITR) backups; India-only storage.
- Restore is **tested** on a schedule; RPO/RTO documented in `docs/runbooks/backup-restore.md`
  (Phase 6). A restore must preserve the audit hash chain — verify after restore.
