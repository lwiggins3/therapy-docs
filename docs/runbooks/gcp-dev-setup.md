# Setting up the GCP dev environment

Roadmap item 2. Everything here runs on **your** machine with **your** `gcloud` auth — this repo's
sandbox has no GCP credentials, so none of this can be run for you. Paste output back if you want
a second pair of eyes on a `terraform plan` or an error.

**Status: done.** The `therapy-docs` project is fully set up per steps 1-7 below — dev
infrastructure is applied and the IAP OAuth consent screen is configured. This doc stays as the
record of how it was done (and every apply-time issue hit along the way, none of which
`terraform validate`/`plan` caught) in case it's ever needed again — a second environment, a
rebuild, or onboarding someone else. See `docs/roadmap.md` item 2 for the current checklist state.

## 0. Before you start

Two things fork the rest of this checklist — figure these out first:

- **Do you have a Google Workspace or Cloud Identity domain?** The identity design (`docs/hipaa-compliance.md`,
  `infra/terraform/modules/iam`) assumes IAP is restricted to your practice's Workspace domain via
  an **Internal** OAuth consent screen. Internal mode is only selectable if this GCP project
  belongs to a Workspace/Cloud Identity organization — a personal Gmail-owned project can only do
  **External**, which means a Google verification review before non-test users can sign in. If you
  don't have a Workspace domain yet, decide now whether to get one, use External + a small
  test-user allowlist for dev, or revisit the Identity Platform alternative from the original plan.
- **Do you have a GCP billing account already?** Needed to create the project. Check with:
  ```bash
  gcloud billing accounts list
  ```

## 1. Install and authenticate the gcloud CLI

```bash
brew install --cask google-cloud-sdk   # if not already installed
gcloud auth login
gcloud auth application-default login  # lets Terraform + local app code authenticate too
```

**If the browser flow shows "OK" but the CLI just hangs**: something (VPN, firewall, endpoint
security software) is likely blocking `gcloud`'s local callback listener from receiving the
redirect — the browser thinks it succeeded because it reached Google, but the CLI never got
notified. Ctrl+C the stuck command and re-run with the no-local-callback flow instead:

```bash
gcloud auth login --no-launch-browser
gcloud auth application-default login --no-launch-browser
```

This prints a URL to open manually and has you paste back a verification code instead.

## 2. Create the dev project (or connect an existing one) and link billing

Project IDs are globally unique and **permanent** — can't be renamed after creation, only the
display name can change. If you haven't created one yet:

```bash
gcloud projects create therapy-docs --name="Therapy Docs"   # add a suffix if that id is taken
gcloud config set project therapy-docs
gcloud billing projects link therapy-docs --billing-account=<BILLING_ACCOUNT_ID>
```

If you already created a project (this repo currently targets project id `therapy-docs`, billing
already linked), just point `gcloud` at it and confirm billing:

```bash
gcloud config set project therapy-docs
gcloud billing projects describe therapy-docs   # confirm it shows billingEnabled: true
```

Then set `GCP_PROJECT_ID` / `VERTEX_AI_PROJECT` in `.env` and `project_id` in
`infra/terraform/environments/<env>/terraform.tfvars` to match.

## 3. Enable the required APIs

Matches the service inventory in `docs/hipaa-compliance.md`, plus a few infra-plumbing APIs
Terraform needs that aren't PHI-facing themselves (Compute/VPC/Service Networking for the
private-IP Cloud SQL connection, IAM Credentials for Workload Identity Federation).

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  aiplatform.googleapis.com \
  documentai.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  cloudkms.googleapis.com \
  bigquery.googleapis.com \
  iap.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  servicenetworking.googleapis.com \
  vpcaccess.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iamcredentials.googleapis.com
```

## 4. Get Vertex AI Model Garden access for Claude

Console-only step, no `gcloud` command for this part:

1. Console → **Vertex AI** → **Model Garden** → search "Claude".
2. Open the Claude (Anthropic) model card → accept the terms → enable.
3. **Check the region shown on the model card.** For the `therapy-docs` project this showed
   `us` — a **multi-region**, not a specific region like `us-central1`. This can differ per
   project/over time, so check yours rather than assuming. Set `VERTEX_AI_LOCATION` in `.env` to
   whatever it shows — this is intentionally independent of `GCP_REGION`/`terraform.tfvars`'s
   `region`, which stays whatever region you picked for Cloud SQL/GCS/Pub/Sub/etc.; Vertex AI's
   location doesn't need to match the rest of your infrastructure's region.

## 5. Create the Terraform state bucket

`infra/terraform/environments/dev/main.tf` has a `backend "gcs"` block with the bucket name left
blank — state needs somewhere to live before `terraform init` will work.

```bash
gcloud storage buckets create gs://therapy-docs-tfstate \
  --project=therapy-docs \
  --location=us-central1 \
  --uniform-bucket-level-access
gcloud storage buckets update gs://therapy-docs-tfstate --versioning
```

## 6. Configure and apply Terraform

`terraform.tfvars` is already filled in for this project (`project_id`, `region`,
`workspace_domain` — see `terraform.tfvars.example` for the shape) — gitignored, not committed.

```bash
cd infra/terraform/environments/dev
terraform init -backend-config="bucket=therapy-docs-tfstate"
terraform plan    # READ THIS before applying — it provisions real, billable resources
terraform apply
```

`terraform plan` output is worth pasting back here before you `apply` — happy to sanity-check it.

**What actually went wrong, in order** (none of this was caught by `validate`/`plan` — only by
applying against the real project; each is fixed in the current code, listed here so the next
environment doesn't need to rediscover them):

1. CMEK was configured on Cloud SQL/GCS/BigQuery, but nothing granted their service agents
   `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the key — added those grants
   (`modules/data/main.tf`), except BigQuery's, whose documented service-agent naming convention
   turned out not to exist on this project; that dataset uses Google-managed encryption for now
   (still a TODO to sort out CMEK there properly).
2. `cloudsql.enable_pgvector` isn't a real Cloud SQL flag — removed it; modern Cloud SQL for
   Postgres supports pgvector via a plain `CREATE EXTENSION vector`, no instance flag needed.
3. The GitHub Actions Workload Identity Federation provider needs an `attribute_condition` Google
   now requires and we don't have a real repo to scope it to yet — commented out, to be re-added
   with roadmap item 6.
4. The VPC Access Connector needed explicit `max_instances`/`max_throughput` (not caught by
   `plan`, only the live API). Fixed, but the connector then never passed its own health checks
   for an unidentified reason — firewall rules, stale connector state, GCE quotas, and four org
   policy constraints were all ruled out one at a time against the real project without success.
   Rather than keep chasing it, switched to **Direct VPC Egress**
   (`vpc_access.network_interfaces` on the Cloud Run services) instead of a connector entirely —
   also Google's current recommended approach for new deployments, not just a workaround.
5. `environments/dev` (and `prod`) had no `outputs.tf` of their own — the root module's outputs
   existed but were never re-exposed one level down, so `terraform output` showed nothing despite
   a successful apply. Added.

## 7. Configure the IAP OAuth consent screen (manual — can't be Terraformed) — done

`google_iap_brand` is deprecated (see `infra/terraform/modules/iam/README.md`) — Google retired
the API it depended on in July 2025. Done in Console instead:

1. Console → **APIs & Services** → **OAuth consent screen**.
2. User type: **Internal** (this project belongs to a real Workspace org — see step 0).
3. Filled in app name, support email, etc.

**Not done yet, and deliberately deferred**: actually enabling IAP in front of the `web`/`api`
Cloud Run services and granting `roles/iap.httpsResourceAccessor` to a Workspace group — still a
TODO in `infra/terraform/modules/iam/main.tf`. Those services currently run Google's placeholder
`hello` image, not real code or any patient data, so there's no urgency locking down access
before roadmap item 6 (CI/CD) actually deploys something real there. Revisit alongside that.

## Verification

- `gcloud services list --enabled` shows everything from step 3 — done
- Vertex AI Model Garden shows Claude as "Enabled" for your project — done (`us` multi-region)
- `terraform state list` (from `environments/dev`) shows the expected resources after `apply` —
  done: VPC/subnet, Cloud SQL, GCS buckets, BigQuery, KMS, Artifact Registry, service accounts,
  3 Cloud Run services, 2 Pub/Sub topics + push subscriptions
- `gcloud sql instances list`, `gcloud storage buckets list`, `gcloud pubsub topics list` show the
  resources Terraform created — done
- `terraform output` (from `environments/dev`) returns real values — done (shape looks like this;
  actual values are project-specific, not reproduced here since this doc is public):
  ```
  api_url                   = "https://therapy-docs-api-dev-<hash>-uc.a.run.app"
  audit_dataset_id          = "audit_logs"
  cloud_sql_connection_name = "<project-id>:us-central1:therapy-docs-pg"
  documents_bucket_name     = "<project-id>-therapy-docs-documents"
  transcripts_bucket_name   = "<project-id>-therapy-docs-transcripts"
  web_url                   = "https://therapy-docs-web-dev-<hash>-uc.a.run.app"
  worker_url                = "https://therapy-docs-worker-dev-<hash>-uc.a.run.app"
  ```
