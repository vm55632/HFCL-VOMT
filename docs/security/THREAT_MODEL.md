# VOP Threat Model (STRIDE)

Scope: the Vendor Onboarding Platform — web (Next.js), API (NestJS), PostgreSQL, Redis/BullMQ,
object storage, malware scanner, and the external identity/verification providers. Method:
**STRIDE** per element, mapped to the mitigations already in the codebase and to
[SECURITY_CONTROLS.md](SECURITY_CONTROLS.md). Aligned with ISO 27001, CERT-In, OWASP ASVS L2,
DPDP 2023 (ADR-0007).

## 1. Assets

- **Vendor PII / financial identifiers** — PAN, bank account, GSTIN, personal identifiers
  (field-encrypted; the crown jewels for DPDP).
- **Case & workflow data** — onboarding decisions, risk tiers, red flags, evidence.
- **Documents** — uploaded evidence (potential malware carrier).
- **Audit trail** — append-only, hash-chained; integrity is itself an asset.
- **Identities & sessions** — user accounts, roles, session cookies, IdP trust.
- **Secrets** — DB creds, envelope KEK, blind-index key, OIDC client secret.

## 2. Trust boundaries

1. Internet → ingress/WAF (untrusted → DMZ).
2. Web/API pods → PostgreSQL / Redis / object store (app tier → data tier, private network only).
3. API → external IdP (Entra) and verification providers (outbound, mock-first).
4. App DB role → audit table (privilege boundary: app role cannot UPDATE/DELETE audit rows).
5. Human roles (Proposer / Reviewer / Admin / Auditor) — enforced by deny-by-default RBAC + SoD.

## 3. Data-flow (summary)

Browser →(TLS, httpOnly cookie)→ API →(guard: session→permissions→object-level)→ service →
(Prisma, parameterised)→ Postgres. Uploads → magic-byte check → ScanProvider → hash → opaque-key
store. Sensitive actions → audit (hash-chained). Verification → provider adapter (retry/backoff) →
risk re-tier.

## 4. STRIDE by element

### 4.1 Web client / session

| Threat              | Vector                   | Mitigation                                                                                                           |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **S**poofing        | Stolen/guessed session   | SSO (OIDC/SAML); httpOnly + SameSite=strict cookies; idle+absolute timeout; revoke on logout/role-change/deactivate. |
| **T**ampering       | CSRF, param tampering    | SameSite=strict; Zod `.strict()` validation; object-level authz.                                                     |
| **R**epudiation     | "I didn't do that"       | Every sensitive action audited with actor/IP/UA/correlation id.                                                      |
| **I**nfo disclosure | Sensitive data in UI/URL | Mask-by-default; ULID (no enumerable ids); no PII in query strings.                                                  |
| **D**oS             | Credential stuffing      | ThrottlerModule rate limit + account lockout.                                                                        |
| **E**oP             | Access another's case    | Deny-by-default guard + object-level checks + negative tests (IDOR).                                                 |

### 4.2 API / services

| Threat | Vector               | Mitigation                                                              |
| ------ | -------------------- | ----------------------------------------------------------------------- |
| S      | Forged tokens/claims | IdP signature validation; server-side sessions; no client-trusted role. |
| T      | Injection            | Prisma parameterised queries; Zod validation; no string SQL.            |
| R      | Missing trail        | Central audit interceptor; append-only + hash chain.                    |
| I      | Verbose errors       | Generic client errors + correlation id; stack traces server-side only.  |
| D      | Expensive endpoints  | Rate limiting; pagination; BullMQ offloads heavy work; HPA.             |
| E      | Privilege escalation | RBAC `resource:action`, SoD, least privilege; role changes audited.     |

### 4.3 Data tier (Postgres / Redis / object store)

| Threat | Vector                           | Mitigation                                                                                                               |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| S      | Rogue client to DB               | Private network only; TLS; per-service creds from secret store.                                                          |
| T      | Direct row edits / audit forgery | App DB role lacks UPDATE/DELETE on audit; hash chain detects tampering; DB triggers reject mutation.                     |
| R      | —                                | Audit chain + backups with PITR.                                                                                         |
| I      | At-rest exposure                 | Field-level envelope encryption (PAN/bank/PII); blind index for search; encrypted backups; private buckets, opaque keys. |
| D      | Resource exhaustion              | Connection limits; Redis eviction policy; HPA + PDB.                                                                     |
| E      | Over-privileged role             | Least-privilege `vop_app` role; migrations run as a separate role.                                                       |

### 4.4 Document upload

| Threat                         | Mitigation                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Malware upload                 | Magic-byte type check → ScanProvider (ClamAV) → infected files never stored. |
| Content spoofing (ext ≠ bytes) | `detectFileType` magic-byte validation rejects mismatches.                   |
| Path traversal / enumeration   | Opaque storage keys; downloads authorized + audited streaming.               |
| Integrity                      | SHA-256 recorded at ingest.                                                  |

### 4.5 External providers (IdP, verification)

| Threat                             | Mitigation                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Spoofed provider / MITM            | TLS; validate issuer/signatures; pinned config per deployment.                         |
| Provider outage → block onboarding | Retry/backoff → **pending**, never a hard block; degrade gracefully.                   |
| Injected malicious response        | Treated as data; Zod-validated; feeds risk model, not code paths.                      |
| Contract drift                     | Real adapters are stubs with TODOs; mocks are the source of truth until sandbox creds. |

### 4.6 Secrets / supply chain

| Threat                   | Mitigation                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Secret in code/image/log | gitleaks pre-commit + CI; redaction layer; secrets only via SecretsProvider; chart uses `existingSecret`. |
| Compromised dependency   | Lockfile pinning; SCA; SBOM (CycloneDX); Trivy image scan; Checkov IaC scan.                              |
| Compromised build        | CI SAST; least-privilege runners; signed images (roadmap).                                                |

## 5. Residual risks / roadmap

- **DAST (ZAP) fixes** — baseline scan wired in CI; tune rules and triage in staging (P6, ongoing).
- **Real verification aggregator** — adapter stubbed pending sandbox creds (deferred, ADR assumption).
- **MFA for break-glass / vendor OTP** — designed; vendor portal deferred by scope decision.
- **Signed container images / SLSA provenance** — roadmap.
- **HSM-backed KEK** — envelope encryption supports it via KeyProvider; on-prem uses Vault; cloud uses managed KMS.

## 6. Verification

Threats above are exercised by: negative authz/IDOR tests, the audit redaction + chain-verify
tests, upload clean/spoofed/EICAR demos, verification outage → pending tests, and the k6
performance test (see [../runbooks/performance.md](../runbooks/performance.md)). Re-review this
model whenever a trust boundary or external integration changes.
