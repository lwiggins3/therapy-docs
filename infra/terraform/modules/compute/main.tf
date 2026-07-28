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

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.worker.uri}/pubsub/transcript-ingest"
    oidc_token {
      service_account_email = var.service_account_emails["worker"]
    }
  }
}
