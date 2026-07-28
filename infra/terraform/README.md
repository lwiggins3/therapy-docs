# infra/terraform

Terraform for every GCP resource this project uses. Every resource type provisioned here must
also appear in the service inventory in [`docs/hipaa-compliance.md`](../../docs/hipaa-compliance.md)
so the BAA covers it.

## Layout

```
infra/terraform/
├── main.tf                  # root module: wires the sub-modules together
├── variables.tf
├── versions.tf              # required_providers / Terraform version constraint
├── modules/
│   ├── networking/          # VPC, subnet, VPC Service Controls perimeter
│   ├── data/                # Cloud SQL (Postgres + pgvector), GCS buckets, BigQuery audit dataset, Cloud KMS
│   ├── compute/              # Cloud Run services (web, api, worker) via Direct VPC Egress, Pub/Sub topics/subscriptions, Artifact Registry
│   └── iam/                  # Service accounts, least-privilege bindings, IAP, Workload Identity Federation
└── environments/
    ├── dev/                  # dev-specific backend + tfvars — applied, see Status below
    └── prod/                 # prod-specific backend + tfvars — not yet applied
```

## Workflow

```bash
cd infra/terraform/environments/dev
terraform init
terraform plan   # always review before apply
terraform apply
```

Never run `terraform apply` from the module directories directly — always through an
`environments/*` root that pins a state backend.

## Status

`environments/dev` is applied against the real `therapy-docs` GCP project (roadmap item 2) — VPC,
Cloud SQL, GCS buckets, BigQuery, KMS, Artifact Registry, service accounts, and the 3 Cloud Run
services all exist. Cloud Run is still serving the placeholder `hello` image until CI/CD (roadmap
item 6) pushes real builds. `environments/prod` is written but not yet applied.

See `docs/runbooks/gcp-dev-setup.md` for the setup process and every apply-time issue hit (and
fixed) getting there — none of them were caught by `terraform validate`/`plan`, only by applying
against the real project. Each module's README covers what it's responsible for provisioning.
