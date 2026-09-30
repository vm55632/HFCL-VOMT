resource "kubernetes_namespace" "vop" {
  metadata {
    name = var.namespace
    labels = {
      "kubernetes.io/metadata.name" = var.namespace
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

# NOTE: the `vop-secrets` Secret and `vop-tls` TLS Secret are created out-of-band by the
# external-secrets operator (synced from HashiCorp Vault) and cert-manager respectively — never
# by Terraform, so no secret values live in state. See docs/runbooks/database.md.

resource "helm_release" "vop" {
  name      = "vop"
  namespace = kubernetes_namespace.vop.metadata[0].name
  chart     = "${path.module}/../../helm/vop"

  values = [yamlencode({
    image = {
      registry = var.image_registry
      api      = { tag = var.app_version }
      web      = { tag = var.app_version }
    }
    ingress = {
      host = var.ingress_host
    }
    existingSecret = "vop-secrets"
  })]

  # values-onprem.yaml holds the on-prem driver selection (MinIO/Vault/ClamAV/Redis).
  # Merge it in CI with `-f values-onprem.yaml`, or inline the same keys above.
}
