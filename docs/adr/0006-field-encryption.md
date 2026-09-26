# ADR-0006 — Application-level field encryption

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture, Security

## Context

Beyond at-rest disk encryption, sensitive identifiers (PAN, bank account number, and personal
identifiers of vendor contacts) must be encrypted at the application layer so that a database dump
alone does not disclose them. Some of these fields must still be searchable for duplicate
detection (e.g. "does this PAN already exist?").

## Decision

- **Envelope encryption.** A data-encryption key (DEK) encrypts field values with **AES-256-GCM**
  (authenticated, per-value random IV). The DEK is itself wrapped by a key-encryption key (KEK)
  held in `KeyProvider` (ADR-0002): Vault Transit / cloud KMS in real environments, a local master
  key in dev only. Stored form: `{ v, iv, ciphertext, tag, keyId }`.
- **Blind index for search.** For fields that must be looked up while encrypted, store a
  deterministic **HMAC-SHA-256 blind index** (`VOP_BLIND_INDEX_KEY`) alongside the ciphertext.
  Duplicate detection queries the blind index, never the plaintext. Fuzzy name matching operates on
  a separately-stored normalised token set, not the encrypted legal name.
- **Where applied:** PAN, bank account number, and contact personal identifiers at minimum; the set
  is declared centrally so it is auditable and extensible. Aadhaar is **not collected**; only masked
  Aadhaar is ever accepted as document evidence.
- **Masking.** API/UI/exports return masked values by default (e.g. `XXXXX1234F`). Unmasking
  requires a specific permission and is audit-logged as a sensitive-field view (ADR-0005).
- **Key rotation.** `keyId` on every value enables KEK/DEK rotation without bulk re-encryption;
  re-encrypt lazily on write or via a background job.

## Consequences

- A raw DB dump yields ciphertext + blind indexes only; plaintext requires the KEK from KeyProvider.
- Encrypted fields cannot be queried by range or `LIKE`; equality search goes through the blind
  index, and anything needing fuzzy/range search keeps a separate, non-sensitive derived column.
- Crypto is centralised in one `crypto`/`field-encryption` service with tests (round-trip,
  tamper-detection via GCM tag, blind-index determinism); call sites never touch primitives.
