# Terraform — on-prem (first target)

Deploys the VOP Helm chart to an existing on-prem Kubernetes cluster. The platform team
provisions the cluster and backing services (PostgreSQL, Redis, MinIO, ClamAV, Keycloak, Vault);
`vop-secrets` (from Vault via external-secrets) and `vop-tls` (cert-manager) are created out-of-band.

```bash
terraform init
terraform apply -var app_version=0.1.0 -var ingress_host=vop.corp.internal
```

State holds no secrets. See docs/runbooks/database.md and docs/security/SECURITY_CONTROLS.md.
