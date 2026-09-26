# Build Prompt: Enterprise Vendor Onboarding Platform (VOP)

> How to use: Save this file in an empty repo as `docs/BUILD_PROMPT.md`. Start Claude Code in that repo and say:
> "Read docs/BUILD_PROMPT.md end to end. Enter plan mode, ask me the open questions in section 14, then produce the architecture plan for Phase 0 and Phase 1 only. Do not write code until I approve the plan."

---

## 0. Your role and working rules

You are a principal software architect and senior full-stack engineer building a production-grade, security-first enterprise application for a regulated Indian corporate client. Treat InfoSec review, VAPT, and audit as certainties, not possibilities.

Working rules (follow strictly):

1. **Plan before code.** For every phase, write a short design note in `docs/adr/` (Architecture Decision Record) before implementing.
2. **Build in phases** (section 12). Finish, test, and summarise one phase before starting the next. Stop and ask for approval at the end of each phase.
3. **Never hardcode** secrets, URLs, tenant IDs, cloud names, or credentials. Everything comes from environment/config or a secrets manager.
4. **Never invent third-party API contracts.** For external verification APIs (PAN, GST, MCA, bank), build a provider interface plus a mock implementation. Leave real adapters as clearly marked stubs with TODOs until I supply the vendor's API documentation.
5. **Tests are part of done.** No feature is complete without unit tests, and API/integration tests for any endpoint touching auth, approvals, or vendor data.
6. **Keep a running `CLAUDE.md`** at repo root with: stack, commands (build/test/lint/run), folder conventions, and decisions made, so future sessions stay consistent.
7. If a requirement is ambiguous, list the assumption you made in the ADR instead of silently guessing. Ask when an assumption is expensive to reverse.

---

## 1. Business context

The organisation needs a single platform to onboard vendors (suppliers, service providers, contractors) with:

- A **proposer** (internal employee) who initiates a vendor onboarding request and supplies business justification.
- The **vendor** who fills in their own details and uploads documents via a secure invite link.
- **Configurable multi-stage workflows** that differ by vendor category.
- **Statutory validation** of vendor identity and compliance data (PAN, GSTIN, MSME/Udyam, bank account, MCA/CIN).
- Full **audit trail** suitable for forensic and compliance review.

---

## 2. User types and authentication

### 2.1 Internal users (organisation employees)

- **SSO is mandatory** at org level. Support both:
  - OIDC (Microsoft Entra ID / Azure AD, Okta, Google Workspace)
  - SAML 2.0 (for clients on ADFS or other IdPs)
- IdP configuration (issuer, client ID, metadata URL, claim mappings) must be **configurable per deployment**, not in code.
- Map IdP groups/claims → application roles via an admin-configurable mapping table.
- Just-in-time (JIT) user provisioning on first SSO login, created in `PENDING_APPROVAL` state unless auto-approve rule matches (see 2.3).
- Optional SCIM 2.0 endpoint for user provisioning/deprovisioning (design the interface now, implement in a later phase).
- Local username/password login for internal users must be **disabled by default** and only enabled by a break-glass admin flag, with MFA enforced.

### 2.2 Self-registration (internal users)

- A user can self-register (or arrive via JIT SSO) and request access.
- The request captures: name, employee ID, department, designation, **direct manager** (looked up from IdP attribute such as `manager` in Entra ID, or selected from directory), and requested role(s) with justification.
- **Every registration requires approval by the user's direct manager.** Optionally a second approval by a Platform Admin for privileged roles (configurable).
- Manager receives email + in-app notification with approve/reject/request-info actions. Approval links must require login (no one-click approval via unauthenticated link).
- Pending requests auto-expire after a configurable period (default 7 days) and escalate to the manager's manager.
- Users cannot approve their own requests or requests where they are in the reporting chain conflict (enforce Segregation of Duties).

### 2.3 External users (vendors)

- Vendors do **not** use org SSO.
- Vendor access is via a **time-bound, single-use invite link** generated when a proposer's request is approved to proceed, followed by email OTP (and optional mobile OTP) verification.
- After first verification the vendor sets a password meeting policy, with optional TOTP MFA.
- Vendor sessions are scoped strictly to their own vendor record (tenant isolation at query level, not just UI).

---

## 3. Role, access, and user management

### 3.1 RBAC + stage-level permissions

Implement RBAC with fine-grained permissions, extensible to ABAC (attribute-based) conditions later.

Seed roles (admin can create more):

| Role                            | Purpose                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Super Admin                     | Platform configuration, IdP settings, break-glass. Minimum number of holders. |
| Platform Admin                  | User, role, workflow, and category management                                 |
| Proposer                        | Initiates vendor requests, tracks status                                      |
| Reviewer / Approver (per stage) | Acts on assigned workflow stages                                              |
| Procurement                     | Commercial review stage                                                       |
| Finance                         | Bank and tax validation stage                                                 |
| Compliance / Legal              | KYC, sanctions, conflict-of-interest stage                                    |
| Auditor (read-only)             | Full read access to records and audit logs, no edits                          |
| Vendor (external)               | Own record only                                                               |

Permission model:

- Permissions are `resource:action` (e.g. `vendor:create`, `vendor:view_bank_details`, `workflow_stage:approve`, `audit_log:read`).
- **Stage-level access configuration:** for each workflow stage, admin configures which roles/users/groups can _view_, _edit which fields_, _approve_, _reject_, _send back_, _reassign_. This must be data-driven (stored in DB), not code.
- **Field-level visibility:** sensitive fields (bank account number, PAN) are masked by default; unmasking requires a specific permission and is itself audit-logged.
- Enforce authorization **server-side on every request** (policy guard/middleware). The UI hiding a button is never the control.
- Segregation of Duties rules: proposer cannot approve their own vendor; same person cannot approve two consecutive stages of the same request (configurable).

### 3.2 User management

- Admin screens: list/search/filter users, view role assignments, activate/deactivate, force logout (revoke sessions), access review export.
- Periodic **access recertification** campaign: managers confirm or revoke their reports' access (design now, implement in later phase).
- Automatic deactivation when IdP reports user disabled or after configurable inactivity period.
- Delegation: approver can delegate to another eligible user for a date range (out-of-office), audit-logged.

---

## 4. Vendor onboarding workflow

### 4.1 Proposer input (request initiation)

Proposer submits a request with:

- Vendor legal name, trade name, contact person, email, mobile
- Vendor category (see 4.3) and sub-category
- Business unit, cost centre, location(s)
- Nature of goods/services, expected annual spend band, contract duration
- Business justification (mandatory free text)
- Whether an existing vendor provides the same service (to catch duplicates)
- Conflict-of-interest declaration by proposer (related-party checkbox + details)
- Supporting documents (quotes, approvals)

System checks on submit:

- **Duplicate detection** on PAN, GSTIN, bank account, email, phone, and fuzzy name match against existing vendors. Flag, do not silently block.
- Draft/save-and-continue support.

### 4.2 Workflow engine (configurable)

Build a **data-driven workflow/state-machine engine**, not hardcoded flows.

- Admin UI to define workflows per vendor category: ordered stages, parallel stages, conditional branches (e.g. "if annual spend > X, add CFO approval"; "if foreign vendor, skip GST and add FEMA/tax residency check").
- Each stage defines: name, assignee rule (role / specific user / proposer's manager / dynamic by business unit), SLA in hours, escalation target, required checklist, allowed actions (approve / reject / send back to proposer / send back to vendor / request info / hold).
- Workflow definitions are **versioned**. In-flight requests continue on the version they started with.
- Every state transition is validated server-side against the definition and recorded immutably.
- SLA timers with reminders and escalation via background jobs.

Default workflow to seed (editable):

1. Proposer request submitted
2. Proposer's line manager approval
3. Vendor invited → vendor self-fills profile and uploads documents
4. Automated statutory validation (section 5)
5. Procurement review
6. Finance review (bank + tax)
7. Compliance review (KYC, sanctions/adverse media placeholder, conflict of interest)
8. Final approval (configurable by spend band)
9. Vendor activated → vendor code generated → push to ERP (integration stub)

Status visibility: proposer and vendor see a timeline of stages with current owner and SLA (vendor sees only non-sensitive stage names).

### 4.3 Vendor categories

Configurable master data. Seed with:

- Goods supplier / Manufacturer
- Service provider
- Contractor / Sub-contractor
- Consultant / Professional (individual or firm)
- Logistics / Transport
- IT / Software / SaaS
- One-time vendor
- Foreign vendor (non-resident)
- Government / PSU
- Related party (triggers enhanced due diligence)

Each category configures: required documents, required validations, applicable workflow, applicable form fields, and document expiry rules.

### 4.4 Entity types

Support constitution types that change required fields: Individual/Proprietor, Partnership, LLP, Private Limited, Public Limited, Trust/Society, HUF, Government, Foreign entity.

---

## 5. Statutory validations (pluggable providers)

Design a `VerificationProvider` interface per check so the client can plug in their chosen API vendor (government APIs directly, or aggregators). Each provider: `verify(input) → { status, normalisedData, rawResponseRef, verifiedAt, providerName }`. Build a **mock provider** for each, used in dev/test.

| Check            | Input                                     | Validation to implement                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PAN**          | PAN number, name                          | Format regex `[A-Z]{5}[0-9]{4}[A-Z]`; 4th character matches entity type (P, C, F, etc.) vs declared constitution; name match score against provider response; PAN–Aadhaar link status field if provider returns it                                           |
| **GSTIN**        | GSTIN                                     | 15-char format, state code (first 2 digits) valid, embedded PAN (chars 3–12) equals vendor PAN, checksum digit validation; provider: legal name, trade name, status (Active/Cancelled/Suspended), registration date, address, filing status                  |
| **MSME / Udyam** | Udyam Registration Number                 | Format `UDYAM-XX-00-0000000`; provider: enterprise type (Micro/Small/Medium), major activity, name match. Store classification because it affects payment terms (MSMED Act 45-day rule)                                                                      |
| **Bank account** | Account number, IFSC, account holder name | IFSC format and bank/branch lookup; **penny-drop or penny-less verification** via provider; name match score; cancelled cheque upload required. Bank changes after activation trigger re-verification and a mandatory finance approval (common fraud vector) |
| **MCA**          | CIN or LLPIN                              | Format validation; provider: company status (Active/Strike-off/Under liquidation), date of incorporation, directors/designated partners, registered address, paid-up capital                                                                                 |

Rules:

- Name matching uses a normalised fuzzy score (strip "Pvt", "Ltd", punctuation, case) with configurable thresholds: auto-pass / manual review / fail.
- Validation results are stored with timestamp and provider reference; raw responses stored encrypted, retained per retention policy.
- Validation failures route the request to a manual review queue, never auto-reject silently.
- Retries with exponential backoff; provider outages must not block the whole workflow (mark "pending verification").
- Cross-checks: PAN in GSTIN = PAN; bank account holder name ≈ PAN name ≈ GST legal name; flag mismatches.
- Red-flag rules engine (configurable) that raises alerts, e.g. vendor bank account matches an employee's bank account, vendor address/phone/email matches an employee, recently incorporated company with high spend band, GST cancelled, multiple vendors sharing a bank account.

---

## 6. Documents and file storage

- Uploads: PDF, JPG, PNG only by default (configurable allow-list). Validate **magic bytes**, not just extension. Max size configurable.
- **Malware scan** every upload (ClamAV container by default, pluggable to cloud-native scanning). Files stay in a quarantine location until scan passes.
- Store files outside the web root with random object keys; never trust user-supplied filenames.
- Downloads via short-lived pre-signed URLs or a streaming endpoint that re-checks authorization.
- Document metadata: type, expiry date, version, uploaded by, hash (SHA-256) for integrity.
- Expiry tracking and reminders (e.g. GST certificate, insurance, licences).

---

## 7. Cloud-agnostic architecture (critical requirement)

The client will decide the cloud (Azure, AWS, GCP, or on-prem). The same codebase must deploy anywhere by changing configuration only.

### 7.1 Abstraction layers

Create interfaces with swappable adapters selected via environment config:

- **Object storage:** `StorageProvider` → adapters for Azure Blob, AWS S3, GCP Cloud Storage, MinIO (S3-compatible, used for local/on-prem).
- **Database:** Use an ORM that supports multiple engines. Primary target PostgreSQL; keep schema portable to Azure SQL / SQL Server and MySQL where feasible. Avoid engine-specific features unless wrapped. Migrations version-controlled.
- **Secrets:** `SecretsProvider` → Azure Key Vault, AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, env (dev only).
- **Email:** `EmailProvider` → SMTP, SendGrid, Azure Communication Services, AWS SES.
- **SMS/OTP:** `SmsProvider` → pluggable, mock in dev.
- **Queue/jobs:** Redis-backed job queue by default; interface allows swapping to Azure Service Bus / SQS / Pub/Sub.
- **Malware scanning:** `ScanProvider` → ClamAV default, cloud-native options pluggable.
- **KMS / encryption keys:** `KeyProvider` for envelope encryption keys.

### 7.2 Deployment

- Containerised (Docker, non-root user, minimal/distroless base images, pinned versions).
- Kubernetes Helm chart with values files per environment; also a `docker-compose.yml` for local dev with Postgres, Redis, MinIO, ClamAV, Mailpit, and a mock OIDC IdP (e.g. Keycloak) so the whole system runs offline.
- Infrastructure-as-Code: Terraform module structure with separate folders for `azure/`, `aws/`, `gcp/` (start with one fully working, scaffold others).
- 12-factor configuration; health (`/health/live`, `/health/ready`) endpoints.
- Stateless app tier so it scales horizontally.

---

## 8. Recommended stack (confirm or propose alternatives in the first ADR)

- **Backend:** TypeScript + NestJS (modular, strong DI for provider pattern), or Java Spring Boot if client prefers. Justify choice.
- **Frontend:** React/Next.js + TypeScript, accessible component library, form schema driven by category config.
- **DB:** PostgreSQL 15+ via Prisma or TypeORM (whichever gives better multi-engine portability; justify).
- **Cache/queue:** Redis + BullMQ.
- **Auth:** OIDC/SAML via well-maintained libraries (e.g. `openid-client`, `@node-saml`), or Keycloak as identity broker. Justify.
- **API:** REST with OpenAPI 3 spec generated from code; versioned (`/api/v1`).
- **Observability:** OpenTelemetry traces/metrics, structured JSON logs.

Monorepo layout suggestion:

```
/apps/api        /apps/web        /packages/shared (types, validation schemas)
/infra/docker    /infra/helm      /infra/terraform/{azure,aws,gcp}
/docs/adr        /docs/security   /docs/runbooks
```

---

## 9. Security requirements (InfoSec / VAPT-ready)

Target **OWASP ASVS Level 2** minimum and cover the **OWASP Top 10 and API Security Top 10**. Produce `docs/security/SECURITY_CONTROLS.md` mapping each control below to where it is implemented.

**Authentication & sessions**

- SSO for internal users; MFA for vendors and any local accounts.
- Sessions via secure, HttpOnly, SameSite=strict cookies (or short-lived access tokens + rotating refresh tokens stored server-side). Idle timeout (15 min default) and absolute timeout configurable.
- Session revocation on logout, role change, deactivation.
- Brute-force protection: rate limiting, progressive delays, account lockout, CAPTCHA hook on public endpoints.
- OTPs: 6 digits, single use, 5-minute expiry, hashed at rest, attempt-limited.

**Authorization**

- Deny-by-default. Central policy guard on every endpoint. Object-level authorization checks (prevent IDOR) with tests proving a vendor cannot access another vendor's record by changing IDs.
- Use non-sequential IDs (UUIDv7/ULID) in URLs.

**Input/output**

- Schema validation on every request body, query, and param (e.g. Zod/class-validator). Reject unknown fields.
- Parameterised queries only (ORM); no string-built SQL.
- Output encoding; strict **Content Security Policy**, HSTS, X-Content-Type-Options, frame-ancestors none, Referrer-Policy, Permissions-Policy.
- CSRF protection for cookie-based auth.
- CORS allow-list from config, never `*`.

**Data protection**

- TLS 1.2+ everywhere, including DB and internal service connections.
- Encryption at rest (cloud default) **plus application-level field encryption** for PAN, bank account number, and any personal identifiers, using envelope encryption via `KeyProvider`. Store blind index/hash for searchable fields (duplicate detection).
- Mask sensitive data in UI, APIs, logs, and exports by default.
- Do not collect or store Aadhaar numbers. If identity proof requires it, accept masked Aadhaar only.
- Compliance with India's **Digital Personal Data Protection Act, 2023**: purpose limitation, consent capture for vendor contact persons, retention policy config, data export/erasure workflow for personal data where legally permitted.

**Secrets & supply chain**

- No secrets in code, images, or logs. Pre-commit secret scanning (e.g. gitleaks).
- Dependency pinning with lockfiles; SCA scanning; generate SBOM (CycloneDX).
- CI pipeline stages: lint → type-check → unit tests → integration tests → SAST (e.g. Semgrep/CodeQL) → dependency scan → container image scan (e.g. Trivy) → IaC scan (e.g. Checkov) → DAST baseline (OWASP ZAP) against staging.

**Error handling**

- Generic error messages to clients; detailed errors only in server logs with correlation ID. No stack traces in responses.
- Disable framework/version banners.

**Infrastructure**

- Containers run as non-root with read-only filesystem where possible; resource limits; network policies restricting pod-to-pod traffic.
- DB and storage not publicly accessible; private endpoints.
- WAF-ready (document recommended rules), DDoS protection via cloud provider.
- Backups encrypted, restore tested, RPO/RTO documented.

---

## 10. Audit logging and monitoring

Two distinct log types:

**1. Audit trail (business/security events) — immutable**

- Log: login success/failure, SSO events, registration and approvals, role/permission changes, workflow transitions, every approve/reject with comments, field changes on vendor record (old → new, sensitive values masked), sensitive-field unmask views, document upload/download, exports, config changes, admin actions.
- Each entry: timestamp (UTC), actor ID, actor role, IP, user agent, action, entity type/ID, before/after diff, correlation ID, outcome.
- **Tamper-evident**: append-only table with hash chaining (each record stores hash of previous), no update/delete permissions for the app DB user on that table. Optional export to WORM storage / SIEM.
- Auditor UI: search/filter by user, vendor, date, action; export to CSV/PDF with the export itself logged.
- Retention configurable (default 8 years to align with statutory record-keeping; confirm with client).

**2. Application logs (technical)**

- Structured JSON, correlation IDs across services, no PII/secrets (add a redaction layer and a test for it).
- SIEM integration ready (Syslog/HTTP forwarder; Sentinel/Splunk/QRadar compatible format).
- Alerts on: repeated login failures, privilege escalation, mass downloads, bank detail change, unusual after-hours approvals.

---

## 11. Other functional features

- **Dashboards:** proposer (my requests), approver (my queue with SLA status), admin (pipeline by stage, ageing, rejection reasons), compliance (red flags).
- **Notifications:** email + in-app, templated and configurable per event; no sensitive data in email bodies.
- **Vendor lifecycle after activation:** profile change requests (re-enter approval workflow for material fields like bank, GST, address), periodic re-validation, blocking/deactivation with reason, re-activation workflow.
- **Reports/exports:** role-restricted, logged, masked by default.
- **ERP integration:** outbound interface (SAP/Oracle/Dynamics) as a stubbed adapter with event on vendor activation; idempotent.
- **Accessibility:** WCAG 2.1 AA. **Responsive** for vendor portal on mobile.
- **i18n-ready** (English first).

---

## 12. Delivery phases

Stop at the end of each phase with: what was built, how to run it, test results, open risks, and what the next phase covers.

- **Phase 0 – Foundation:** ADRs for stack, repo scaffold, CLAUDE.md, docker-compose local stack, CI pipeline with security scans, provider interfaces with mock/local adapters (storage, secrets, email), config management, health checks, logging, audit log module skeleton.
- **Phase 1 – Identity & access:** OIDC + SAML SSO, JIT provisioning, self-registration with manager approval, RBAC/permission guard, user management admin UI, session management, audit events for all of the above.
- **Phase 2 – Master data & workflow engine:** vendor categories, entity types, document requirements, configurable versioned workflow engine with stage-level permissions, SLA/escalation jobs, admin workflow designer UI.
- **Phase 3 – Vendor onboarding:** proposer request form, duplicate detection, vendor invite + OTP portal, dynamic vendor form, document upload with scanning, workflow execution end-to-end.
- **Phase 4 – Validations & risk:** PAN, GSTIN, Udyam, bank, MCA provider interfaces + mocks, name matching, cross-checks, red-flag rules engine, manual review queue.
- **Phase 5 – Audit, reporting, lifecycle:** auditor UI, dashboards, exports, vendor change requests, re-validation, ERP stub, notifications polish.
- **Phase 6 – Hardening & deployment:** Helm chart, Terraform for chosen cloud, security controls document, threat model (STRIDE) in `docs/security/`, ZAP scan fixes, performance test (target: 500 concurrent users, p95 API < 500 ms), backup/restore runbook, admin and user guides.

---

## 13. Definition of done (every phase)

- All tests pass; coverage ≥ 80% on domain/services, 100% of authorization guards have negative tests.
- Lint, type-check, SAST, dependency and image scans pass with no high/critical findings (or documented, justified exceptions).
- OpenAPI spec updated.
- Audit events emitted for all new sensitive actions.
- No secrets, PII, or debug code committed.
- CLAUDE.md and relevant ADRs updated.
- Runs locally with a single `docker compose up` and seeded demo data (fake vendors only, no real PAN/GST numbers).

---

## 14. Open questions — ask me these before Phase 0

1. Preferred backend language (TypeScript/NestJS vs Java/Spring Boot) and any client tech-standards document?
2. Which IdP(s) must be supported first (Entra ID, Okta, ADFS/SAML)? Is the manager attribute available in the IdP?
3. Target cloud for the first deployment, and must it also run on-prem?
4. Single organisation or multi-tenant (several client organisations on one deployment)?
5. Which verification API vendor(s) will be used for PAN/GST/MCA/bank/Udyam, and are sandbox credentials available?
6. Which ERP receives activated vendors?
7. Approval thresholds by spend band, and who is the final approver at each band?
8. Data retention period and any data residency requirement (India-only hosting)?
9. Expected volumes: internal users, vendors per year, documents per vendor?
10. Client's InfoSec checklist or VAPT standard to align with (e.g. ISO 27001 controls, CERT-In guidelines)?
