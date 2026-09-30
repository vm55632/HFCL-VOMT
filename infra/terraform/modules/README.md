# Terraform modules (shared)

Reusable building blocks referenced by the per-cloud roots. Each cloud root composes:

- a **cluster** module (managed Kubernetes),
- a **database** module (managed PostgreSQL, private, backups + PITR),
- a **cache** module (managed Redis, private),
- an **object-store** module (private bucket/container with versioning),
- a **secrets** module (managed secret store + KMS key for the envelope KEK), and
- the shared **helm** deploy (identical to `onprem/`, only the driver values differ).

Secrets are never created or read by Terraform: they are synced into the `vop-secrets`
Kubernetes Secret by external-secrets from the cloud's secret store. See each cloud's README.
