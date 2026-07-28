# modules/iam

Provisions:

- A dedicated service account per app (`web`, `api`, `worker`) — least-privilege, no shared
  "default compute" service account use.
- IAP configuration gating `web` and `api` to the practice's Google Workspace/Cloud Identity
  domain (`var.workspace_domain`).
- Workload Identity Federation pool/provider for GitHub Actions, so CI/CD deploys without any
  long-lived GCP service account key stored in GitHub secrets.

## Outputs

- `service_account_emails` — map of app name to service account email, consumed by
  `modules/compute` when deploying each Cloud Run service.

## Notes

- The IAP OAuth consent screen ("brand") is **not** managed by Terraform here. Google deprecated
  the IAP OAuth Admin API in July 2025, so `google_iap_brand` no longer reliably works — configure
  the consent screen once, manually, via Console (APIs & Services > OAuth consent screen),
  restricted to `var.workspace_domain`, before applying the IAM bindings in this module.
