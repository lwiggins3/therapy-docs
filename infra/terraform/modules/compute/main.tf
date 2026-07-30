resource "google_artifact_registry_repository" "main" {
  project       = var.project_id
  location      = var.region
  repository_id = "therapy-docs"
  format        = "DOCKER"
}

locals {
  # Placeholder image until CI/CD pushes real builds to the Artifact Registry repo above.
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"
}

# --- Secrets consumed by apps/api's Gmail OAuth flow (see apps/api/src/lib/signed-state.ts,
# apps/api/src/gmail) — colocated here since compute is what actually wires them into env vars. ---

resource "random_password" "oauth_state_secret" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret" "oauth_state_secret" {
  project   = var.project_id
  secret_id = "therapy-docs-oauth-state-secret-${var.environment}"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "oauth_state_secret" {
  secret      = google_secret_manager_secret.oauth_state_secret.id
  secret_data = random_password.oauth_state_secret.result
}

resource "google_secret_manager_secret" "gmail_oauth_client_secret" {
  project   = var.project_id
  secret_id = "therapy-docs-gmail-oauth-client-secret-${var.environment}"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "gmail_oauth_client_secret" {
  secret      = google_secret_manager_secret.gmail_oauth_client_secret.id
  secret_data = var.gmail_oauth_client_secret
}

resource "google_cloud_run_v2_service" "web" {
  project  = var.project_id
  name     = "therapy-docs-web-${var.environment}"
  location = var.region

  template {
    service_account = var.service_account_emails["web"]
    vpc_access {
      network_interfaces {
        network    = var.network_id
        subnetwork = var.subnetwork_id
      }
      egress = "PRIVATE_RANGES_ONLY"
    }
    containers {
      image = local.placeholder_image
    }
  }

  # CI/CD (see .github/workflows/deploy.yml) deploys real images via `gcloud run deploy`,
  # outside Terraform. Without this, the next `apply` would revert the running image back to
  # the placeholder, fighting the deploy pipeline for ownership of this field.
  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = "therapy-docs-api-${var.environment}"
  location = var.region

  template {
    service_account = var.service_account_emails["api"]
    vpc_access {
      network_interfaces {
        network    = var.network_id
        subnetwork = var.subnetwork_id
      }
      egress = "PRIVATE_RANGES_ONLY"
    }
    containers {
      image = local.placeholder_image

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = var.database_url_secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "GCS_DOCUMENTS_BUCKET"
        value = var.documents_bucket_name
      }
      env {
        name  = "GCS_TRANSCRIPTS_BUCKET"
        value = var.transcripts_bucket_name
      }
      env {
        name  = "STORAGE_PROVIDER"
        value = "gcs"
      }
      env {
        name  = "VERTEX_AI_PROJECT"
        value = var.project_id
      }
      env {
        name  = "VERTEX_AI_LOCATION"
        value = var.region
      }
      env {
        name  = "LLM_PROVIDER"
        value = "gemini"
      }
      env {
        name  = "PUBSUB_TOPIC_DOCUMENT_INGEST"
        value = google_pubsub_topic.document_ingest.name
      }
      env {
        name  = "PUBSUB_TOPIC_TRANSCRIPT_INGEST"
        value = google_pubsub_topic.transcript_ingest.name
      }
      env {
        name  = "GMAIL_OAUTH_CLIENT_ID"
        value = var.gmail_oauth_client_id
      }
      env {
        name = "GMAIL_OAUTH_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gmail_oauth_client_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "GMAIL_OAUTH_REDIRECT_URI"
        value = var.gmail_oauth_redirect_uri
      }
      env {
        name = "OAUTH_STATE_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.oauth_state_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "TOKEN_STORE_PROVIDER"
        value = "secret-manager"
      }
      env {
        # Not a circular reference — api referencing web's uri is a normal cross-resource
        # dependency, unlike GMAIL_OAUTH_REDIRECT_URI which would need api's own uri.
        name  = "WEB_APP_URL"
        value = google_cloud_run_v2_service.web.uri
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service" "worker" {
  project  = var.project_id
  name     = "therapy-docs-worker-${var.environment}"
  location = var.region

  template {
    service_account = var.service_account_emails["worker"]
    vpc_access {
      network_interfaces {
        network    = var.network_id
        subnetwork = var.subnetwork_id
      }
      egress = "PRIVATE_RANGES_ONLY"
    }
    containers {
      image = local.placeholder_image

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = var.database_url_secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "GCS_DOCUMENTS_BUCKET"
        value = var.documents_bucket_name
      }
      env {
        name  = "GCS_TRANSCRIPTS_BUCKET"
        value = var.transcripts_bucket_name
      }
      env {
        name  = "STORAGE_PROVIDER"
        value = "gcs"
      }
      env {
        name  = "VERTEX_AI_PROJECT"
        value = var.project_id
      }
      env {
        name  = "VERTEX_AI_LOCATION"
        value = var.region
      }
      env {
        name  = "LLM_PROVIDER"
        value = "gemini"
      }
      env {
        # No Document AI processor has been provisioned (see docs/roadmap.md) — real PDF uploads
        # get UTF-8-decoded (garbage) text in the deployed env too, same limitation as local dev.
        name  = "TEXT_EXTRACTOR"
        value = "plain"
      }
      env {
        name  = "BIGQUERY_AUDIT_DATASET"
        value = var.audit_dataset_id
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

# --- Pub/Sub: document + transcript ingestion, pushed to the worker service ---

resource "google_pubsub_topic" "document_ingest" {
  project = var.project_id
  name    = "document-ingest"
}

resource "google_pubsub_topic" "transcript_ingest" {
  project = var.project_id
  name    = "transcript-ingest"
}

resource "google_pubsub_subscription" "document_ingest" {
  project = var.project_id
  name    = "document-ingest-worker"
  topic   = google_pubsub_topic.document_ingest.name

  # Real LLM calls routinely exceed the 10s default — a shorter deadline than the handler causes
  # Pub/Sub to redeliver the same message while the first attempt is still in flight, producing
  # concurrent/overlapping runs (see apps/api/src/scripts/setup-pubsub.ts for the same fix locally).
  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.worker.uri}/pubsub/document-ingest"
    oidc_token {
      service_account_email = var.service_account_emails["worker"]
    }
  }
}

resource "google_pubsub_subscription" "transcript_ingest" {
  project = var.project_id
  name    = "transcript-ingest-worker"
  topic   = google_pubsub_topic.transcript_ingest.name

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.worker.uri}/pubsub/transcript-ingest"
    oidc_token {
      service_account_email = var.service_account_emails["worker"]
    }
  }
}

# The push subscriptions above authenticate via an OIDC token asserting the worker SA's identity.
# Since the worker service isn't public, Cloud Run must be told that identity may invoke it —
# without this, Pub/Sub can never successfully deliver a push to the deployed worker at all.
resource "google_cloud_run_v2_service_iam_member" "worker_self_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.service_account_emails["worker"]}"
}
