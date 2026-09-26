# ADR-0002 — Cloud-agnostic provider/adapter pattern

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture (section-14 Q3: on-prem first, cloud-agnostic)

## Context

The client has not chosen a cloud and may deploy on-prem. The same codebase must deploy to
Azure, AWS, GCP or on-prem by changing configuration only. No infrastructure detail may leak
into domain or application code.

## Decision

Every external concern sits behind a **NestJS injectable interface** with swappable adapters.
The adapter is chosen at boot from an env variable and bound to the interface token; nothing
above the adapter knows which one is active.

| Concern                | Interface              | On-prem adapter (first)          | Cloud adapters (scaffolded stubs) |
| ---------------------- | ---------------------- | -------------------------------- | --------------------------------- |
| Object storage         | `StorageProvider`      | MinIO (S3 API) / local-fs        | Azure Blob · AWS S3 · GCS         |
| Secrets                | `SecretsProvider`      | HashiCorp Vault / env (dev)      | Azure Key Vault · AWS SM · GCP SM |
| Email                  | `EmailProvider`        | SMTP (Mailpit dev)               | SendGrid · Azure ACS · AWS SES    |
| SMS/OTP                | `SmsProvider`          | mock                             | (provider)                        |
| Queue/jobs             | `QueueProvider`        | Redis + BullMQ                   | Service Bus · SQS · Pub/Sub       |
| Malware scan           | `ScanProvider`         | ClamAV                           | cloud-native                      |
| Encryption keys        | `KeyProvider`          | local master key / Vault Transit | Azure KV · AWS KMS · GCP KMS      |
| Statutory verification | `VerificationProvider` | **mock** (per check)             | aggregator/gov (stub)             |

- Interfaces live in `packages/shared` (or an api `providers/contracts` module); adapters live in
  `apps/api/src/providers/<concern>/`.
- Selection keys: `VOP_STORAGE_DRIVER`, `VOP_SECRETS_DRIVER`, etc. (see `.env.example`).
- Cloud adapters are committed as **clearly marked stubs** that throw "not implemented" with a
  TODO, so the shape exists and Phase 6 wires them without touching call sites.

## Consequences

- One deployment variable set per environment; no code change to move clouds.
- Adapters are unit-testable in isolation; the mock/local adapters make the whole stack run offline.
- Discipline required: application code depends only on the interface, never on an SDK type.
- Slight indirection cost, accepted for portability and testability.
