# Helm (scaffold — built in Phase 6)

Chart for deploying VOP to Kubernetes with per-environment values files.

Planned structure:

```
infra/helm/vop/
  Chart.yaml
  values.yaml            # defaults
  values-onprem.yaml     # on-prem overrides
  values-<cloud>.yaml    # cloud overrides
  templates/             # api + web Deployments, Services, HPA, NetworkPolicies, Ingress, PDB
```

Hardening baked into templates (per ADR-0007 / SECURITY_CONTROLS.md): non-root, read-only
root filesystem, dropped capabilities, resource limits, NetworkPolicies restricting pod-to-pod
traffic, private DB/storage endpoints, and secrets sourced from the SecretsProvider (never in
the chart).
