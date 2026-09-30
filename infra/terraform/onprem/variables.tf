variable "kubeconfig" {
  type        = string
  default     = "~/.kube/config"
  description = "Path to the kubeconfig for the on-prem cluster."
}

variable "namespace" {
  type    = string
  default = "vop"
}

variable "image_registry" {
  type        = string
  default     = "registry.vop.internal"
  description = "Private registry hosting the vop/api and vop/web images."
}

variable "app_version" {
  type        = string
  description = "Image tag / chart appVersion to deploy."
}

variable "ingress_host" {
  type    = string
  default = "vop.corp.internal"
}
