# Terraform — GCP (scaffold)

- **GKE** (private cluster, Dataplane V2 network policy).
- **Cloud SQL for PostgreSQL** (private IP, automated backups + PITR, asia-south1).
- **Memorystore for Redis** (private).
- **Cloud Storage** bucket `vop-documents` (uniform access, versioning) — `VOP_STORAGE_DRIVER=gcs`.
- **Secret Manager** + **Cloud KMS** — secrets + envelope KEK (`VOP_SECRETS_DRIVER=gcp-sm`, `VOP_KEY_DRIVER=gcp-kms`).
- Email provider + external OIDC IdP.
- **GCE Ingress** (or nginx) + Cloud Armor WAF; managed TLS.
- **external-secrets** operator syncing Secret Manager → `vop-secrets`.

Data residency: asia-south1 (Mumbai). State holds no secrets.
