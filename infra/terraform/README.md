# Terraform (scaffold — built in Phase 6)

Infrastructure-as-Code, one folder per target. On-prem is the first deployment; the cloud
folders are scaffolded so the same application deploys anywhere by configuration (ADR-0002).

```
infra/terraform/
  onprem/   # first target: VM/K8s, PostgreSQL, MinIO, Vault, ClamAV, Keycloak
  azure/    # AKS, Azure DB for PostgreSQL, Blob, Key Vault, ACS, Entra ID
  aws/      # EKS, RDS PostgreSQL, S3, Secrets Manager, SES
  gcp/      # GKE, Cloud SQL, Cloud Storage, Secret Manager
  modules/  # shared modules (network, database, object-store, secrets, k8s-workload)
```

Each target wires the same provider abstractions; only configuration differs. Checkov scans
these directories in CI (`iac-scan` job). Start with `onprem/`, then scaffold the chosen cloud.
