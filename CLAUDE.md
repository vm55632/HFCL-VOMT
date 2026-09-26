# CLAUDE.md — VOP working notes

Running context for future sessions. Keep this current: stack, commands, conventions, decisions.

## What this is

Enterprise **Vendor Onboarding Platform (VOP)** — security-first, cloud-agnostic (on-prem first),
single-organisation. Built to pass InfoSec review / VAPT / audit. Full spec in `docs/BUILD_PROMPT.md`.
A lean reference prototype lives outside this repo at `../VOMT` — its `src/shared/*` domain logic
(risk, workflow, schema, PAN/GST/IFSC validation) is being ported into `packages/shared`.

## Stack

- **Backend:** TypeScript + NestJS 10 (`apps/api`), REST under `/api/v1`, OpenAPI 3 from decorators.
- **Frontend:** Next.js 14 + TypeScript (`apps/web`).
- **Shared:** `packages/shared` (types, Zod schemas, domain model), `packages/config` (typed env).
- **DB:** PostgreSQL 15 via Prisma. Migrations version-controlled. ULID ids in URLs (no sequential ids).
- **Cache/queue:** Redis + BullMQ.
- **Auth:** OIDC (Entra ID; Keycloak broker in dev) + SAML 2.0. Sessions = httpOnly cookies.
- **Providers (adapter pattern, chosen by env):** storage, secrets, email, sms, queue, scan, key, verification.
- **Observability:** pino JSON logs + correlation ids; OpenTelemetry.

## Monorepo layout

```
apps/api            NestJS API
apps/web            Next.js web
packages/shared     types, zod schemas, domain model (roles, permissions, validation)
packages/config     typed, validated env loading (zod)
infra/docker        Dockerfiles + docker-compose (postgres, redis, minio, clamav, mailpit, keycloak, vault)
infra/helm          (Phase 6)
infra/terraform     azure/ aws/ gcp/ (Phase 6)
docs/adr            architecture decision records
docs/security       SECURITY_CONTROLS.md, threat model (Phase 6)
docs/runbooks       operational runbooks
```

## Commands

Tooling: Node 20–22, pnpm via Corepack. Docker for the local stack.

```bash
corepack enable pnpm        # one-time: makes pnpm available (ships with Node)
pnpm install                # install all workspaces
pnpm compose:up             # start postgres/redis/minio/clamav/mailpit/keycloak/vault
pnpm --filter @vop/api prisma:migrate   # apply migrations
pnpm --filter @vop/api prisma:seed      # seed roles/permissions + demo users (fake data)
pnpm dev                    # run api + web in watch mode
pnpm build                  # build all
pnpm lint                   # eslint (flat config at repo root)
pnpm typecheck              # tsc --noEmit per package
pnpm test                   # unit tests (jest)
pnpm test:cov               # with coverage (DoD: >=80% domain/services; 100% negative authz tests)
pnpm format                 # prettier write
```

Copy `.env.example` to `.env` before running. Never commit `.env`.

## Conventions

- **No hardcoded** secrets/URLs/tenant ids/credentials — everything via `packages/config` (env) or SecretsProvider.
- **Never invent external API contracts.** Verification providers = interface + mock; real adapters are marked stubs with TODOs.
- **Deny-by-default authorization** on every endpoint (central guard). UI hiding is never the control.
- **Object-level authz** everywhere (IDOR). Every guard has negative tests.
- **Audit** every sensitive action (see `apps/api/src/audit`). Audit table is append-only + hash-chained; app DB role cannot UPDATE/DELETE it.
- **Field encryption** (envelope, via KeyProvider) for PAN, bank account, personal identifiers. Blind index/hash for searchable encrypted fields.
- **Mask** sensitive data in UI, APIs, logs, exports by default. No PII/secrets in logs (redaction layer + test).
- Package names: `@vop/api`, `@vop/web`, `@vop/shared`, `@vop/config`.
- Conventional Commits (commitlint). Pre-commit: prettier + gitleaks. Pre-push/CI: lint, typecheck, tests, SAST, SCA, image/IaC scan.

## Decisions (see docs/adr for full records)

- ADR-0001 Stack & monorepo: TypeScript/NestJS + Next.js, pnpm + Turborepo.
- ADR-0002 Cloud-agnostic adapter pattern via NestJS DI; on-prem adapters first.
- ADR-0003 DB = PostgreSQL + Prisma; ULID ids; portability caveats.
- ADR-0004 Config = zod-validated env; secrets via SecretsProvider (Vault on-prem).
- ADR-0005 Audit log = append-only + hash chain; least-privilege DB role.
- ADR-0006 Field encryption = envelope (AES-256-GCM) + blind index (HMAC).
- ADR-0007 Security-standard mapping: ISO 27001 + CERT-In + OWASP ASVS L2 + DPDP 2023.

## Phase status

- **Phase 0 (Foundation):** in progress — scaffold, providers, config, Prisma base schema, audit skeleton, health, docker-compose, CI, ADRs.
- **Phase 1 (Identity & Access):** next — SSO, JIT, self-registration + manager approval, RBAC guard, sessions, user admin.
- Phases 2–6: not started (workflow engine, onboarding, validations, audit/reporting/lifecycle, hardening/deploy).

## Known local caveats

- **Windows + `next build`:** the `output: 'standalone'` step creates symlinks and fails with
  `EPERM` on Windows without Developer Mode (worse under OneDrive). Compilation/type-checking
  succeed; only the standalone copy fails. It works on Linux (the Docker image build and CI on
  ubuntu). To build the web app locally on Windows, enable Developer Mode or build in WSL/Docker.
- **pnpm via Corepack shim:** `corepack enable pnpm` needs admin to write the Node shim. Without
  it, run pnpm as `corepack pnpm <cmd>`. `turbo` shells out to `pnpm`, so the turbo-based root
  scripts (`pnpm build`, `pnpm test`) need `pnpm` on PATH — otherwise run per package with
  `corepack pnpm --filter <pkg> <script>`.

## Deferred / open (confirm before the relevant phase)

- Real verification aggregator + sandbox creds → before Phase 4.
- ERP target + payload → before Phase 5.
- Exact spend-band thresholds/approvers → before Phase 2 seed.
- Break-glass local-login policy specifics.
