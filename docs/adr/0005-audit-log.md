# ADR-0005 — Audit log: append-only + hash chain

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture, Security

## Context

The platform must produce a forensic, tamper-evident audit trail suitable for compliance review
and retained 8 years. Business/security events must be immutable and independently verifiable.
This is distinct from technical application logs.

## Decision

- **Two log types, separate paths.** (1) **Audit trail** — business/security events, in Postgres
  table `audit_log`. (2) **Application logs** — structured JSON (pino) to stdout/SIEM, technical
  only, no PII/secrets.
- **Append-only.** The runtime DB role `vop_app` is granted `INSERT`/`SELECT` on `audit_log` and
  explicitly **not** `UPDATE`/`DELETE`. A DB rule/trigger additionally rejects updates/deletes, so
  even a privileged mistake cannot rewrite history.
- **Hash chain.** Each row stores `prev_hash` and `row_hash`, where
  `row_hash = SHA-256(canonical(payload) || prev_hash)`. A verifier walks the chain and detects any
  insertion, deletion or edit. Chain head is periodically anchored (exported to WORM/SIEM) so even
  wholesale table replacement is detectable.
- **Every entry records:** timestamp (UTC), actor id, actor role, source IP, user agent, action,
  entity type/id, before/after diff (sensitive values masked), correlation id, outcome.
- **What is audited:** login success/failure, SSO events, registration & approvals, role/permission
  changes, session revocation, workflow transitions, every approve/reject with comment, field
  changes on vendor records, sensitive-field unmask views, document upload/download, exports,
  config/admin changes.
- **Redaction.** Before/after diffs and any payload run through the shared redaction layer so PAN,
  bank numbers, tokens and passwords are masked in the trail itself.
- **Export.** Auditor UI (Phase 5) can export CSV/PDF; the export action is itself audited.
  A `SiemExporter`/WORM interface is defined now.

## Consequences

- Writes are insert-only; corrections are new compensating events, never edits.
- The hash chain adds a small write cost and requires careful canonical serialisation (stable key
  order) — implemented once in the audit module and covered by tests, including a tamper-detection test.
- Retention/pruning respects the chain: pruning happens by exporting-then-archiving whole
  time-partitions, not by deleting individual rows.
