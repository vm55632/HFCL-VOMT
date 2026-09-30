# Runbook — Incident Response

For security incidents affecting VOP. Aligned with **CERT-In** directions (notably the
**6-hour reporting** obligation), ISO 27001 A.5.24–A.5.28, and DPDP 2023 breach-notification
duties. Companion to [backup-restore.md](backup-restore.md) and [THREAT_MODEL.md](../security/THREAT_MODEL.md).

## Severity levels

| Sev       | Definition                                        | Examples                                                           | Response                               |
| --------- | ------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| **SEV-1** | Confirmed breach of PII/secrets, or platform down | PAN/bank exfiltration, KEK compromise, audit tampering, ransomware | Immediate; exec + CERT-In clock starts |
| **SEV-2** | Contained compromise, no confirmed data loss      | Single account takeover, exploited but caught                      | Same-day                               |
| **SEV-3** | Suspicious activity / near-miss                   | Repeated authz denials, anomalous scans                            | Next business day                      |

## Roles

- **Incident Commander (IC)** — owns the response, decisions, comms. (Platform on-call by default.)
- **Scribe** — timestamps every action in the incident log (used for the CERT-In report).
- **Comms** — internal stakeholders + regulator notification (with Legal/DPO).
- **DPO/Legal** — DPDP breach-notification assessment.

## Phases (NIST-style)

### 1. Detect & triage

Sources: SIEM alerts on audit events, failed-authz spikes, ThrottlerModule lockouts, health/alert
signals, ZAP/Trivy findings, user reports. Assign a Sev, open the incident log, name the IC.
**Start the CERT-In 6-hour timer at the moment of awareness of a reportable incident.**

### 2. Contain

- **Account/session:** deactivate the user (revokes all sessions live) and/or force-logout; rotate
  affected credentials.
- **Secret/KEK:** rotate via Vault/KMS; re-sync `vop-secrets`; audit blast radius.
- **Network:** the default-deny NetworkPolicy already limits lateral movement; tighten ingress /
  isolate the affected namespace if needed.
- **Data tier:** if audit tampering is suspected, **freeze writes** (scale API to 0) — do not let a
  restore or normal traffic overwrite evidence.
- **Malware:** infected uploads are never stored; if the scanner was bypassed, quarantine the
  bucket version and re-scan.

### 3. Eradicate & recover

- Patch the root cause (dependency bump, config fix, code fix through the normal PR/CI gates).
- Restore from clean backups if integrity is in doubt ([backup-restore.md](backup-restore.md)).
- **Verify the audit hash chain** before resuming writes — a valid chain is the integrity proof.
- Confirm `/health/ready` green; watch metrics/logs for recurrence.

### 4. Notify (regulatory)

- **CERT-In:** report reportable cyber incidents **within 6 hours** of awareness (format per the
  current CERT-In direction). Scribe's timeline feeds this.
- **DPDP:** if personal data is breached, DPO assesses and notifies the Data Protection Board and
  affected principals per the Act.
- Keep all timestamps in **UTC** (clocks are NTP-synced) to match the audit log.

### 5. Post-incident review

Within 5 business days: blameless RCA, timeline (RPO/RTO if a restore occurred), what detected it,
what delayed it, and concrete follow-ups (new tests, alerts, controls). Update
[THREAT_MODEL.md](../security/THREAT_MODEL.md) and [SECURITY_CONTROLS.md](../security/SECURITY_CONTROLS.md)
if a boundary or control changed.

## Evidence handling

- Preserve logs, audit rows, affected DB/bucket versions **before** remediation overwrites them.
- Audit log is append-only + hash-chained — export the relevant range for forensics; note the chain
  verification result.
- Chain of custody: Scribe records who accessed what evidence and when.

## Key commands

```bash
# Kill a compromised user's sessions (also blocks new login)
#   -> Admin UI: Users → deactivate; or force-logout to revoke sessions only.

# Freeze writes (preserve state for forensics / before restore)
kubectl -n vop scale deploy vop-api --replicas=0

# Rotate a secret: update in Vault/KMS, then force external-secrets resync, then roll pods
kubectl -n vop rollout restart deploy vop-api vop-web

# Verify audit integrity (auditor endpoint / tooling)
#   GET /api/v1/audit/verify  -> expect chain OK
```

## Contacts (fill per deployment)

| Role                         | Name / channel |
| ---------------------------- | -------------- |
| Incident Commander (on-call) | _TBD_          |
| DPO                          | _TBD_          |
| Legal                        | _TBD_          |
| CERT-In reporting            | _TBD_          |
| Cloud/infra vendor support   | _TBD_          |
