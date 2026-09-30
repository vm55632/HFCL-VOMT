# Terraform — AWS (scaffold)

- **EKS** (managed node groups, VPC CNI, Calico/network policy).
- **RDS for PostgreSQL** (Multi-AZ, private subnets, automated backups + PITR, ap-south-1).
- **ElastiCache Redis** (private).
- **S3** bucket `vop-documents` (private, versioning, SSE-KMS) — `VOP_STORAGE_DRIVER=s3`.
- **Secrets Manager** + **KMS** — secrets + envelope KEK (`VOP_SECRETS_DRIVER=aws-sm`, `VOP_KEY_DRIVER=aws-kms`).
- **SES** for email; an external IdP (Entra/Okta) for OIDC.
- **ALB Ingress Controller** + AWS WAF; ACM TLS.
- **external-secrets** operator syncing Secrets Manager → `vop-secrets`.

Data residency: ap-south-1 (Mumbai). State holds no secrets.
