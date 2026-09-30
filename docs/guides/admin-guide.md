# VOP Administrator Guide

For Platform/Super Admins, Compliance, and Auditors operating the Vendor Onboarding Platform.
Companion to the runbooks in [../runbooks](../runbooks) and [../security](../security).

## 1. Roles (seeded, deny-by-default)

| Role                      | Can do                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| **Super Admin**           | Everything, including IdP config and role mapping. Break-glass.         |
| **Platform Admin**        | User admin, categories, workflow design, no financial approval.         |
| **Proposer**              | Raise vendor cases, fill vendor details, upload evidence.               |
| **Reviewer/Approver**     | Review + approve/reject at their workflow stage (spend-band ladder).    |
| **Procurement / Finance** | Stage ownership per workflow; financial checks.                         |
| **Compliance**            | Red-flag review, policy, red-flag rules.                                |
| **Auditor**               | Read-only + audit search, chain verification, CSV export. No mutations. |
| **Vendor**                | (External portal deferred by scope decision.)                           |

Authorization is server-side and deny-by-default; hiding UI is never the control. Object-level
checks prevent reaching another user's record by id (IDOR).

## 2. Identity & access

- **SSO:** OIDC (Entra ID) + SAML 2.0. IdP config (issuer, client id, metadata URL, claim maps)
  is per-deployment in DB/config — never in code.
- **JIT provisioning:** first SSO login creates a `PENDING_APPROVAL` user unless an auto-approve
  rule matches.
- **Manager approval:** approve/reject/request-info; **links require login**; auto-expire (7 days
  default) and escalate; **SoD** blocks self-approval / reporting-chain conflicts.
- **Group/claim → role mapping:** admin-configurable table maps IdP groups/claims to VOP roles.
- **Break-glass local login:** gated by `VOP_LOCAL_LOGIN_ENABLED`; password seeded via
  `VOP_SEED_ADMIN_PASSWORD` (never hardcoded); MFA enforced. Use only when SSO is down.

### User admin (web console)

List/search/filter users → assign roles, activate/**deactivate** (kills live sessions),
**force-logout** (revoke sessions), export access review, and **delegate** an approver to an
eligible user for a date range (audit-logged).

## 3. Master data & workflow

- **Categories:** vendor categories master data (seeded: 10) via the categories admin.
- **Workflows:** versioned, data-driven engine. Design stages, per-stage permissions, tier routing,
  SLA (business-day math), and the evidence gate. Lifecycle: **draft → publish → archive**;
  published versions are **immutable**. Use route-preview to see how a case will route before
  publishing. Seeded: published `standard-vendor` v1.
- **SLA/escalation jobs:** BullMQ sweeps, gated by `VOP_JOBS_ENABLED`; manual trigger at
  `POST /maintenance/sweep`.

## 4. Onboarding oversight

- **Cases:** proposer raises → server-side risk tiering → duplicate detection → due-diligence
  checklist → workflow execution (stage ownership + evidence gate + audit).
- **Documents:** magic-byte validated + malware-scanned (infected files never stored) + SHA-256 +
  opaque-key storage; downloads authorized + audited.
- **Verification & risk:** `POST /cases/:id/verify` runs (mock) PAN/GST/bank providers with
  retry/backoff (outage → pending, never blocks), computes name-match + cross-checks, evaluates
  red flags, **re-tiers server-side**, sets `reviewRequired`. Manual review queue at `/review-queue`.
- **Lifecycle:** ERP activation stub, block/reactivate with reason, notifications.

## 5. Audit & reporting

- **Audit log:** append-only, hash-chained; app DB role cannot UPDATE/DELETE it. Auditors search,
  **verify the chain**, and export CSV. Every sensitive action is recorded (actor, role, IP, UA,
  before/after, correlation id, outcome), timestamps in **UTC**.
- **Dashboard:** stats endpoint + web dashboard for pipeline/risk/SLA views.

## 6. Configuration & secrets

- All config via `packages/config` (Zod-validated env) or the SecretsProvider — **no hardcoded
  secrets/URLs/credentials**. Providers (storage/secrets/email/sms/queue/scan/key/verification) are
  selected by env driver keys (see per-cloud READMEs under `infra/terraform`).
- Key env: `VOP_LOCAL_LOGIN_ENABLED`, `VOP_JOBS_ENABLED`, `VOP_*_DRIVER`, `VOP_MASTER_KEY` +
  `VOP_BLIND_INDEX_KEY` (from secret store), `VOP_AUDIT_RETENTION_DAYS`, `VOP_CORS_ORIGINS`.
- In production, `vop-secrets` is synced from Vault/KMS by external-secrets; the Helm chart never
  holds secret values.

## 7. Operations

- **Deploy:** Helm chart `infra/helm/vop` (+ Terraform per environment). Pre-upgrade Job runs
  `prisma migrate deploy`; apply audit-hardening SQL once per environment ([database.md](../runbooks/database.md)).
- **Health:** `/api/v1/health/live` and `/health/ready` (DB, Redis, storage, secrets).
- **Runbooks:** [backup-restore](../runbooks/backup-restore.md), [incident-response](../runbooks/incident-response.md),
  [performance](../runbooks/performance.md).
- **Security posture:** [SECURITY_CONTROLS.md](../security/SECURITY_CONTROLS.md),
  [THREAT_MODEL.md](../security/THREAT_MODEL.md).

## 8. Do / don't

- **Do** run onboarding through the workflow engine; keep authorization server-side; verify the
  audit chain after any restore.
- **Don't** hardcode secrets, edit published workflow versions (make a new version), grant roles
  beyond need, or run `prisma migrate reset` in a shared environment.
