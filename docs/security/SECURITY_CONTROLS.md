# Security Controls Matrix

Living map of every control to **where it is implemented** and to the frameworks we align with:
OWASP **ASVS L2**, OWASP **Top 10** / **API Top 10**, **ISO 27001** Annex A, **CERT-In** guidance,
**DPDP Act 2023**. Updated every phase (Definition of Done). `Status`: ✅ done · 🚧 in progress ·
⏳ planned (phase).

> Phase 0 lays the foundations (config, secrets, audit, crypto services, headers, CI scanning).
> Many rows are 🚧/⏳ until their owning phase; the row exists now so nothing is forgotten.

## Authentication & sessions

| Control                                                                    | Implemented in              | ASVS      | OWASP | ISO 27001 | Status   |
| -------------------------------------------------------------------------- | --------------------------- | --------- | ----- | --------- | -------- |
| SSO (OIDC Entra / SAML) for internal users                                 | `apps/api/src/auth`         | 2.1, 2.10 | A07   | A.5.16    | ⏳ P1    |
| MFA for vendors & local break-glass                                        | `apps/api/src/auth/mfa`     | 2.8       | A07   | A.5.17    | ⏳ P1/P3 |
| Secure session cookies (httpOnly, SameSite=strict)                         | `apps/api/src/auth/session` | 3.4       | A07   | A.8.5     | ⏳ P1    |
| Idle (15m) + absolute timeout; revocation on logout/role change/deactivate | `auth/session`              | 3.3       | A07   | A.8.5     | ⏳ P1    |
| Brute-force protection (rate limit, lockout, CAPTCHA hook)                 | `auth`, `common/throttler`  | 2.2       | A07   | A.8.5     | ⏳ P1    |
| OTP: 6-digit, single-use, 5-min expiry, hashed, attempt-limited            | `auth/otp`                  | 2.8       | A07   | A.8.5     | ⏳ P3    |

## Authorization

| Control                                                 | Implemented in         | ASVS | OWASP    | ISO 27001 | Status |
| ------------------------------------------------------- | ---------------------- | ---- | -------- | --------- | ------ |
| Deny-by-default central policy guard on every endpoint  | `apps/api/src/authz`   | 4.1  | A01      | A.5.15    | ⏳ P1  |
| Object-level authorization (anti-IDOR) + negative tests | `authz`, `*/*.spec.ts` | 4.2  | API1/A01 | A.5.15    | ⏳ P1  |
| Non-sequential ids (ULID) in URLs                       | `packages/shared/ids`  | 4.2  | API1     | —         | 🚧 P0  |
| Segregation of Duties (self-approval / reporting-chain) | `authz/sod`            | 4.1  | A01      | A.5.3     | ⏳ P1  |
| Field-level visibility & masked-by-default              | `common/masking`       | 4.3  | A01      | A.8.3     | 🚧 P0  |

## Input / output

| Control                                                                              | Implemented in                       | ASVS | OWASP | ISO 27001 | Status |
| ------------------------------------------------------------------------------------ | ------------------------------------ | ---- | ----- | --------- | ------ |
| Schema validation on body/query/param, reject unknown fields                         | `packages/shared` (Zod) + Nest pipes | 5.1  | A03   | A.8.26    | 🚧 P0  |
| Parameterised queries only (Prisma)                                                  | `apps/api` (Prisma)                  | 5.3  | A03   | A.8.28    | 🚧 P0  |
| Output encoding; CSP, HSTS, X-CTO, frame-ancestors none, Referrer/Permissions-Policy | `apps/api` (helmet)                  | 14.4 | A05   | A.8.9     | 🚧 P0  |
| CSRF protection (cookie auth)                                                        | `apps/api/src/common/csrf`           | 4.2  | A01   | A.8.26    | ⏳ P1  |
| CORS allow-list from config (never `*`)                                              | `packages/config`, `main.ts`         | 14.5 | A05   | A.8.20    | 🚧 P0  |

## Data protection

| Control                                           | Implemented in                       | ASVS | OWASP | ISO 27001 | DPDP  | Status |
| ------------------------------------------------- | ------------------------------------ | ---- | ----- | --------- | ----- | ------ |
| TLS 1.2+ everywhere (app, DB, internal)           | infra / reverse proxy                | 9.1  | A02   | A.8.24    | —     | ⏳ P6  |
| Field-level envelope encryption (PAN/bank/PII)    | `apps/api/src/crypto`                | 6.2  | A02   | A.8.24    | §8    | 🚧 P0  |
| Blind index/hash for searchable encrypted fields  | `crypto/blind-index`                 | 6.2  | A02   | A.8.24    | —     | 🚧 P0  |
| Mask sensitive data in UI/API/logs/exports        | `common/masking`, `common/redaction` | 8.1  | A09   | A.8.12    | §8    | 🚧 P0  |
| No Aadhaar stored; masked Aadhaar only            | validation/schema                    | —    | —     | —         | §8    | ⏳ P3  |
| Consent capture, retention config, export/erasure | `apps/api/src/privacy`               | —    | —     | A.5.34    | §6–13 | ⏳ P5  |

## Secrets & supply chain

| Control                                                                   | Implemented in                 | ASVS | OWASP | ISO 27001 | Status             |
| ------------------------------------------------------------------------- | ------------------------------ | ---- | ----- | --------- | ------------------ |
| No secrets in code/images/logs; gitleaks pre-commit + CI                  | `.gitleaks.toml`, `.husky`, CI | 14.2 | A05   | A.8.31    | 🚧 P0              |
| Dependency pinning + lockfile; SCA scan                                   | `pnpm-lock.yaml`, CI           | 14.2 | A06   | A.8.29    | 🚧 P0              |
| SBOM (CycloneDX)                                                          | CI (`pnpm sbom`)               | 14.2 | A06   | A.8.30    | 🚧 P0              |
| SAST (Semgrep/CodeQL), image scan (Trivy), IaC scan (Checkov), DAST (ZAP) | CI                             | 14.2 | A06   | A.8.29    | 🚧 P0 (DAST ⏳ P6) |

## Error handling & infrastructure

| Control                                                                         | Implemented in               | ASVS | OWASP | ISO 27001     | Status             |
| ------------------------------------------------------------------------------- | ---------------------------- | ---- | ----- | ------------- | ------------------ |
| Generic client errors + correlation id; no stack traces/banners                 | `common/errors`              | 7.4  | A05   | A.8.15        | 🚧 P0              |
| Structured JSON logs, correlation ids, redaction, SIEM-ready                    | `common/logging`             | 7.1  | A09   | A.8.15        | 🚧 P0              |
| Append-only, hash-chained audit trail                                           | `apps/api/src/audit`         | 7.1  | A09   | A.8.15        | 🚧 P0              |
| Containers non-root, read-only fs, resource limits, network policy              | `infra/docker`, `infra/helm` | 14.1 | A05   | A.8.9         | 🚧 P0 (helm ⏳ P6) |
| DB/storage private; WAF-ready; DDoS via cloud; encrypted backups + restore test | `infra`, `docs/runbooks`     | —    | —     | A.8.13/A.8.14 | ⏳ P6              |
| Health endpoints + monitoring/alerts                                            | `apps/api/src/health`        | —    | —     | A.8.16        | 🚧 P0              |

## CERT-In specifics

| Control                                          | Implemented in                               | Status |
| ------------------------------------------------ | -------------------------------------------- | ------ |
| Security logs retained (India) ≥ mandated period | audit retention (`VOP_AUDIT_RETENTION_DAYS`) | 🚧 P0  |
| Clocks synchronised to NTP, timestamps in UTC    | infra + app (UTC everywhere)                 | 🚧 P0  |
| Incident-reporting readiness                     | `docs/runbooks/incident-response.md`         | ⏳ P6  |
