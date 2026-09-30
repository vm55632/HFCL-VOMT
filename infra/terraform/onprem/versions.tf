terraform {
  required_version = ">= 1.6"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
  }
}

# On-prem: point at an existing Kubernetes cluster (the platform team provisions the cluster,
# PostgreSQL, Redis, MinIO, ClamAV, Keycloak and Vault). Terraform here deploys the VOP chart.
provider "kubernetes" {
  config_path = var.kubeconfig
}
provider "helm" {
  kubernetes {
    config_path = var.kubeconfig
  }
}
