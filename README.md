# VOP — Enterprise Vendor Onboarding Platform

Security-first, cloud-agnostic (on-prem first), single-organisation vendor onboarding for a
regulated enterprise. Built to withstand InfoSec review, VAPT, and forensic audit.

> **Status:** Phase 0 (Foundation) scaffold. See [`docs/adr`](docs/adr) for decisions and
> [`docs/BUILD_PROMPT.md`](docs/BUILD_PROMPT.md) for the full specification and phased plan.

## Quick start (local, fully offline)

Prerequisites: **Node 20–22**, **Docker** (for the local stack), and pnpm via Corepack.

```bash
corepack enable pnpm
pnpm install
cp .env.example .env          # fill in / keep dev defaults
pnpm compose:up               # postgres, redis, minio, clamav, mailpit, keycloak, vault
pnpm --filter @vop/api prisma:migrate
pnpm --filter @vop/api prisma:seed
pnpm dev                      # api → :3000, web → :3001
```

Health: `GET http://localhost:3000/api/v1/health/live` and `/health/ready`.
API docs (dev): `http://localhost:3000/api/docs`.

## Architecture at a glance

- **`apps/api`** — NestJS. REST `/api/v1`, deny-by-default authorization, provider adapters
  (storage, secrets, email, sms, queue, scan, key, verification) selected by environment.
- **`apps/web`** — Next.js. Accessible, schema-driven forms.
- **`packages/shared`** — types, Zod validation, and the domain model (roles, permissions,
  PAN/GST/IFSC validation, risk model) shared by both sides.
- **`packages/config`** — one typed, validated view of the environment.
- **`infra/`** — Docker/compose now; Helm + Terraform (azure/aws/gcp) in Phase 6.

The application tier is stateless and horizontally scalable. Every external dependency sits
behind an interface with an on-prem adapter wired first and cloud adapters scaffolded, so the
same codebase deploys on-prem or to any cloud by configuration alone.

## Security posture

Targets **OWASP ASVS L2**, **OWASP Top 10 / API Top 10**, mapped to **ISO 27001** and
**CERT-In** guidance, with **DPDP Act 2023** data-protection controls. Field-level envelope
encryption for PAN/bank/PII, append-only hash-chained audit trail, and a CI pipeline running
SAST, SCA, image and IaC scans plus a DAST baseline. See
[`docs/security/SECURITY_CONTROLS.md`](docs/security/SECURITY_CONTROLS.md).

## Documentation

- [`docs/BUILD_PROMPT.md`](docs/BUILD_PROMPT.md) — full spec and delivery phases.
- [`docs/adr/`](docs/adr) — architecture decision records.
- [`CLAUDE.md`](CLAUDE.md) — working notes, commands, conventions.

## License

Proprietary — client-confidential. Do not distribute.
