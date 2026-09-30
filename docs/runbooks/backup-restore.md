# Runbook — Backup & Restore

Covers PostgreSQL (primary datastore), object storage (documents), and secrets. Aligned with
ISO 27001 A.8.13/A.8.14 and CERT-In. Companion to [database.md](database.md).

## Objectives

| Metric                  | Target                            | Rationale                                            |
| ----------------------- | --------------------------------- | ---------------------------------------------------- |
| **RPO** (max data loss) | ≤ 15 min                          | Continuous WAL archiving / PITR.                     |
| **RTO** (max downtime)  | ≤ 2 h                             | Managed-service restore + Helm redeploy.             |
| Backup retention        | 35 days PITR + 8 yr audit archive | DPDP/CERT-In retention (`VOP_AUDIT_RETENTION_DAYS`). |
| Residency               | India region only                 | ADR-0007.                                            |
| Restore test cadence    | Quarterly (record result here)    | A restore that isn't tested doesn't exist.           |

## What is backed up

1. **PostgreSQL** — automated daily base backup + continuous WAL (PITR). On-prem: `pgBackRest`
   or `wal-g` to MinIO/S3-compatible store, encrypted. Cloud: native automated backups + PITR.
2. **Object storage** (`vop-documents`) — bucket versioning + cross-region-disabled (India only)
   lifecycle; documents are already SHA-256-recorded and virus-scanned at ingest.
3. **Secrets** — NOT backed up as files. Held in Vault/KMS; recovered via the secret store's own
   DR. The `vop-secrets` K8s Secret is re-synced by external-secrets, never restored from a dump.
4. **Audit archive** — append-only, hash-chained; exported/retained separately (WORM/SIEM).

Encryption keys: the envelope KEK lives in Vault/KMS. **Encrypted field data is useless without
the KEK** — protect KEK DR with the same rigor as the DB backup, or restored PAN/bank data is
unrecoverable.

## Backup verification

- Daily: confirm last base backup + WAL continuity (alert on gap > RPO).
- Weekly: `pg_verifybackup` (or provider integrity check) on the latest base backup.
- Quarterly: full restore drill into an isolated namespace (below); verify the **audit hash chain**
  after restore (`GET /audit/verify` / auditor tooling) — a valid chain proves integrity.

## Restore procedure (PITR)

> Do this in an isolated namespace first, promote only after verification. Runbook owner:
> Platform on-call. Announce in the incident channel before starting.

1. **Freeze writes** — scale API to 0 (`kubectl scale deploy vop-api --replicas=0`) or enable
   maintenance mode, so no new writes race the restore.
2. **Choose the target time** (just before the incident). Note it in the incident log.
3. **Restore Postgres to PITR target:**
   - Cloud: trigger managed PITR to a new instance at the target timestamp.
   - On-prem: `pgbackrest --stanza=vop --type=time "--target=<ts>" restore` on a fresh data dir.
4. **Point the app at the restored DB** — update the `DATABASE_URL` in the secret store; re-sync
   `vop-secrets`; do **not** run destructive migrations (`prisma migrate deploy` is additive and
   safe; never `migrate reset` in prod).
5. **Restore object storage** if documents were affected — roll back to the version at target time
   (bucket versioning) or restore from the object-store backup.
6. **Verify:**
   - `/health/ready` green (DB, Redis, storage, secrets).
   - Audit chain verifies end-to-end.
   - Spot-check a case: encrypted fields decrypt (KEK intact), documents download + hash matches.
7. **Resume writes** — scale API back up (HPA takes over).
8. **Post-restore:** record RPO/RTO actually achieved, root cause, and any data gap in the
   incident report ([incident-response.md](incident-response.md)).

## Failure modes

| Symptom                                          | Likely cause                 | Action                                                                                           |
| ------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Restored rows present but PAN/bank won't decrypt | KEK mismatch/lost            | Recover the exact KEK version from Vault/KMS DR; encrypted data is keyed to it.                  |
| `prisma migrate` errors after restore            | Schema ahead of data         | Restore to a time consistent with the deployed schema, or deploy the matching app version first. |
| Audit chain fails to verify                      | Tampering or partial restore | Treat as a security incident; do not resume writes; escalate.                                    |
| Documents 404 after restore                      | Object store not rolled back | Restore bucket to the same PITR target time.                                                     |

## Quarterly drill log

| Date                  | RPO achieved | RTO achieved | Chain verified | Notes |
| --------------------- | ------------ | ------------ | -------------- | ----- |
| _pending first drill_ |              |              |                |       |
