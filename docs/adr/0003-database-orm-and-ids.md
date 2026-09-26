# ADR-0003 — Database, ORM & identifier strategy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture (section-14 Q9: large-enterprise volume)

## Context

Primary datastore must be PostgreSQL, with the schema kept portable to Azure SQL / SQL Server
and MySQL "where feasible". Large-enterprise volumes (thousands of internal users, 10k+
vendors/year, heavy documents) mean we plan for read replicas and table partitioning. URLs must
not expose sequential ids (IDOR / enumeration).

## Decision

- **PostgreSQL 15** as the primary engine.
- **Prisma** as the ORM/migration tool. Chosen over TypeORM for type-safety, a single declarative
  schema, and first-class migration DX. Engine-specific features are avoided or wrapped so a
  future port to SQL Server/MySQL stays feasible; portability is validated before any such move,
  not assumed. _(TypeORM remains the documented fallback if multi-engine parity is later required
  over DX — it supports more engines natively.)_
- **Identifiers:** application entities exposed in URLs use **ULID** (lexicographically sortable,
  128-bit, non-guessable) stored as `char(26)`. Internal-only join tables may use bigint. No
  sequential id is ever placed in a URL or API response used for lookup.
- **Least-privilege runtime role:** the app connects as `vop_app`, which has no `UPDATE`/`DELETE`
  on `audit_log` (see ADR-0005). Migrations run as a separate owner role.
- **Scale hooks (designed now, tuned later):** read-replica-aware connection routing behind the
  Prisma client wrapper; `audit_log` and `document` tables designed for range/hash partitioning
  by time; heavy list endpoints paginated and index-backed.
- **Residency & retention:** India-only hosting; audit/records retained 8 years, configurable via
  `VOP_AUDIT_RETENTION_DAYS` (see ADR-0007, DPDP).

## Consequences

- Prisma migrations are the single source of schema truth; every change is a versioned migration.
- ULIDs keep ids sortable for pagination without leaking counts or order-of-creation to attackers.
- Some raw SQL will be needed for the hash-chain trigger and partitioning; kept in migrations and
  wrapped, not scattered.
- Multi-engine portability is a goal, not a guarantee — revisit with a spike before committing to
  a non-Postgres target.
