# ADR-0004 — Configuration & secrets management

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture

## Context

12-factor configuration is required: nothing hardcoded (secrets, URLs, ids, cloud names,
credentials). Misconfiguration should fail fast and loudly, not surface as random runtime errors.
Secrets must never appear in code, images, or logs, and must be sourced from a secrets manager in
production.

## Decision

- **Typed config in `packages/config`.** A single Zod schema describes every `VOP_*` / standard
  variable, with types, defaults and cross-field rules. The app calls `loadConfig()` once at boot;
  on failure it prints the offending keys and exits non-zero (the reference prototype's
  fail-fast-on-boot pattern, generalised).
- **Two-tier secret sourcing.** Non-secret settings come from env. Secrets are fetched through
  `SecretsProvider` (ADR-0002): Vault on-prem, cloud secret managers in cloud, plain env in dev
  only. The env holds a _reference/path_ to a secret in real environments, not the secret itself,
  wherever the provider supports it.
- **No secrets in the repo or images.** `.env` is git-ignored; only `.env.example` (placeholders)
  is committed. `gitleaks` runs pre-commit and in CI. Container images receive secrets at runtime
  (mounted files / injected env), never baked in.
- **Redaction.** A logging redaction layer strips known secret/PII keys before anything is written
  (see ADR-0005); a test asserts secrets never reach log output.

## Consequences

- One place to see the whole configuration surface; new settings must be added to the schema.
- Boot refuses to start when required config is missing/invalid — no half-configured runtime.
- Dev convenience (`VOP_SECRETS_DRIVER=env`) is explicitly a dev-only path, gated by `NODE_ENV`.
