# Runbooks

Operational procedures for running therapy-docs. Add a file per procedure as they're written
(e.g. `rotate-cmek-key.md`, `restore-cloud-sql-from-backup.md`, `respond-to-audit-log-gap.md`).

- [`gcp-dev-setup.md`](gcp-dev-setup.md) — stand up the GCP dev environment (roadmap item 2):
  project creation, API enablement, Vertex AI Model Garden access, Terraform apply, IAP setup.

Other things worth checking:

- [`../hipaa-compliance.md`](../hipaa-compliance.md) — what to check before signing/renewing BAAs.
- [`../../infra/terraform/README.md`](../../infra/terraform/README.md) — how to plan/apply
  infrastructure changes.
