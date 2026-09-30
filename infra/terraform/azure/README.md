# Terraform — Azure (scaffold)

Provisions VOP on Azure, then deploys the Helm chart. Wire the same provider interfaces as on-prem.

Resources to define (`main.tf`):

- **AKS** cluster (system + user node pools, Azure CNI, network policy on).
- **Azure Database for PostgreSQL** Flexible Server (private endpoint, geo-redundant backup, India region).
- **Azure Cache for Redis** (private endpoint) — queues/rate-limit.
- **Storage Account / Blob** container `vop-documents` (private, versioning) — `VOP_STORAGE_DRIVER=azure-blob`.
- **Key Vault** — secrets + envelope KEK (`VOP_SECRETS_DRIVER=azure-kv`, `VOP_KEY_DRIVER=azure-kv`).
- **Entra ID** app registration for OIDC (`VOP_OIDC_*`).
- **Azure Communication Services** (or SMTP relay) for email.
- **Application Gateway / AGIC** ingress with WAF; TLS via cert-manager or App Gateway.
- **external-secrets** operator syncing Key Vault → the `vop-secrets` Secret the chart consumes.

Data residency: pin all resources to an India region (DPDP / ADR-0007). State holds no secrets.
