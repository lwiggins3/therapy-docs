locals {
  apps = ["web", "api", "worker"]
}

resource "google_service_account" "app" {
  for_each     = toset(local.apps)
  project      = var.project_id
  account_id   = "therapy-docs-${each.key}-${var.environment}"
  display_name = "therapy-docs ${each.key} (${var.environment})"
}

# --- Runtime grants for the app service accounts ---
# Nothing granted these any permissions before now — the deployed api/worker couldn't reach
# Cloud SQL, GCS, Pub/Sub, Vertex AI, Secret Manager, or BigQuery at all.

resource "google_project_iam_member" "api_secretmanager_admin" {
  project = var.project_id
  role    = "roles/secretmanager.admin"
  member  = "serviceAccount:${google_service_account.app["api"].email}"
  # Project-wide, not per-secret: apps/api/src/lib/token-store.ts's SecretManagerTokenStore
  # creates+adds a new "gmail-token-<therapistId>" secret at runtime, per therapist, on demand —
  # there's no fixed set of secret IDs to scope a narrower grant to ahead of time. Narrow this
  # (e.g. a condition on the "gmail-token-*" prefix) before real patient data.
}

resource "google_project_iam_member" "api_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.app["api"].email}"
}

resource "google_project_iam_member" "api_aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.app["api"].email}"
}

resource "google_project_iam_member" "worker_secretmanager_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.app["worker"].email}"
}

resource "google_project_iam_member" "worker_aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.app["worker"].email}"
}

resource "google_project_iam_member" "worker_bigquery_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.app["worker"].email}"
}

# api uploads to both buckets, worker downloads from both.
resource "google_storage_bucket_iam_member" "api_documents_bucket" {
  bucket = var.documents_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app["api"].email}"
}

resource "google_storage_bucket_iam_member" "api_transcripts_bucket" {
  bucket = var.transcripts_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app["api"].email}"
}

resource "google_storage_bucket_iam_member" "worker_documents_bucket" {
  bucket = var.documents_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app["worker"].email}"
}

resource "google_storage_bucket_iam_member" "worker_transcripts_bucket" {
  bucket = var.transcripts_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app["worker"].email}"
}

# NOTE: the IAP OAuth "brand" (consent screen) is intentionally NOT managed here.
# `google_iap_brand` relies on the IAP OAuth Admin API, which Google deprecated in July 2025 —
# the resource no longer reliably functions for creation. Configure the OAuth consent screen for
# this project once, manually, via Console (APIs & Services > OAuth consent screen), restricted
# to var.workspace_domain, before applying the IAM bindings below.
#
# TODO: google_iap_web_iam_member / google_iap_web_backend_service_iam_member granting
# roles/iap.httpsResourceAccessor to a Google Group scoped to var.workspace_domain, once
# modules/compute's backend services exist to attach IAP to.

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions-${var.environment}"
  display_name              = "GitHub Actions (${var.environment})"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
  # Scoped to this specific repo — Google requires an attribute_condition on OIDC providers;
  # without one, ANY GitHub Actions workflow anywhere could potentially assume this identity.
  attribute_condition = "assertion.repository == 'lwiggins3/therapy-docs'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Distinct from the 3 runtime service accounts above — this is what GitHub Actions impersonates
# via WIF to build/push images and deploy Cloud Run revisions. Never used as a Cloud Run
# service's own runtime identity.
resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "therapy-docs-deploy-${var.environment}"
  display_name = "therapy-docs CI/CD deploy (${var.environment})"
}

resource "google_project_iam_member" "deploy_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_project_iam_member" "deploy_artifact_registry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Deploying a Cloud Run revision that runs *as* one of the app service accounts requires
# permission to "act as" that service account.
resource "google_service_account_iam_member" "deploy_can_act_as_apps" {
  for_each           = google_service_account.app
  service_account_id = each.value.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# Lets GitHub Actions (scoped to this repo, via the provider's attribute_condition above)
# impersonate the deploy service account — no long-lived key ever leaves GCP.
resource "google_service_account_iam_member" "github_actions_can_impersonate_deploy" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/lwiggins3/therapy-docs"
}
