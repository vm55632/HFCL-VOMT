# ADR-0007 — Security-standard mapping

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Security, Architecture (section-14 Q8, Q10)

## Context

The client requires alignment with **ISO 27001** and **CERT-In** guidance, on top of the prompt's
baseline of **OWASP ASVS Level 2**, **OWASP Top 10** and **API Security Top 10**, plus India's
**Digital Personal Data Protection Act, 2023 (DPDP)**. Data is India-only, retained 8 years.

## Decision

Maintain a single living control matrix at
[`docs/security/SECURITY_CONTROLS.md`](../security/SECURITY_CONTROLS.md) that maps each control to
**where it is implemented** and to each framework:

- **OWASP ASVS L2 / Top 10 / API Top 10** — the technical baseline (authn, authz, session, input
  validation, crypto, error handling, logging). Every applicable ASVS L2 requirement gets a row.
- **ISO 27001 Annex A** — organisational/technical controls (access control A.5/A.8, cryptography,
  logging & monitoring, supplier/operations security, backup). Cross-referenced per control.
- **CERT-In directions (2022)** — security-log retention (India), synchronised clocks (NTP, UTC),
  and incident-reporting readiness. Audit retention configured to satisfy the longer of DPDP,
  statutory record-keeping (8 years) and CERT-In.
- **DPDP Act 2023** — purpose limitation, consent capture for vendor contact persons, retention
  policy config, and a data export/erasure workflow for personal data where legally permitted.
  Data residency: India-only hosting (`VOP_DATA_REGION=in`).

The matrix is updated every phase; the Definition of Done requires audit events and control-matrix
rows for each new sensitive action. Phase 6 adds the STRIDE threat model and a ZAP DAST pass.

## Consequences

- Security is tracked as verifiable rows, not prose — auditable and reviewable by InfoSec.
- Some controls are process, not code (backup restore tests, access recertification, incident
  reporting); these are captured as runbooks in `docs/runbooks` and owned by ops.
- Framework mappings will be reviewed with the client's InfoSec team; rows may be added to meet a
  specific ISO 27001 Statement of Applicability.
