resource "google_kms_key_ring" "main" {
  project  = var.project_id
  name     = "therapy-docs-keyring"
  location = var.region
}

resource "google_kms_crypto_key" "main" {
  name            = "therapy-docs-cmek"
  key_ring        = google_kms_key_ring.main.id
  rotation_period = "7776000s" # 90 days
}

# --- Grant the Google-managed service agents permission to use the CMEK key ---
# CMEK on Cloud SQL/GCS/BigQuery only works if their service agents can encrypt/decrypt with the
# key. GCP auto-provisions these agents once the relevant API is enabled, but Terraform won't
# grant them KMS access on its own — without this, Cloud SQL instance creation fails partway
# through (the slowest, most expensive resource in this plan to redo).

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service_identity" "sql" {
  provider = google-beta
  project  = var.project_id
  service  = "sqladmin.googleapis.com"
}

resource "google_kms_crypto_key_iam_member" "sql_encrypter" {
  crypto_key_id = google_kms_crypto_key.main.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_project_service_identity.sql.email}"
}

data "google_storage_project_service_account" "gcs" {
  project = var.project_id
}

resource "google_kms_crypto_key_iam_member" "gcs_encrypter" {
  crypto_key_id = google_kms_crypto_key.main.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${data.google_storage_project_service_account.gcs.email_address}"
}

# TODO: BigQuery CMEK. The documented service-agent naming convention
# (bq-<project_number>@bigquery-encryption.iam.gserviceaccount.com) turned out not to exist on
# this project when applied for real — that identity isn't auto-provisioned just by enabling the
# BigQuery API the way Cloud SQL's/GCS's are. `google_bigquery_dataset.audit_logs` below falls
# back to Google-managed encryption (still encrypted at rest, just not customer-managed) until
# this is sorted out — figure out the correct provisioning step before this needs CMEK for real.

# --- Private IP access for Cloud SQL ---

resource "google_compute_global_address" "private_ip_range" {
  project       = var.project_id
  name          = "therapy-docs-sql-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = var.vpc_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = var.vpc_id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# --- Cloud SQL for PostgreSQL, with pgvector enabled ---

resource "google_sql_database_instance" "main" {
  project             = var.project_id
  name                = "therapy-docs-pg"
  region              = var.region
  database_version    = "POSTGRES_15"
  encryption_key_name = google_kms_crypto_key.main.id
  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_kms_crypto_key_iam_member.sql_encrypter,
  ]

  settings {
    tier = "db-custom-2-7680"

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_id
    }

    # No instance-level flag needed for pgvector on modern Cloud SQL for PostgreSQL — it's a
    # regular extension, enabled per-database via `CREATE EXTENSION vector` (which Prisma's
    # `extensions = [pgvector(...)]` in packages/db/prisma/schema.prisma already triggers on
    # `db push`/`migrate`). The `cloudsql.enable_pgvector` flag this used to set doesn't exist —
    # GCP rejected it outright on apply ("invalidFlagName").

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }
  }
}

resource "google_sql_database" "app" {
  project  = var.project_id
  name     = "therapy_docs"
  instance = google_sql_database_instance.main.name
}

# --- App DB user + password, stored as a fully-assembled DATABASE_URL in Secret Manager ---
# Direct VPC Egress + private IP (not the Cloud SQL Auth Proxy/unix-socket pattern), so Cloud Run
# connects with a plain postgresql:// URL against the private IP, not `connection_name`.

resource "random_password" "db_app_user" {
  length  = 32
  special = false # avoids URL-encoding characters like @/:? that would break the connection string
}

resource "google_sql_user" "app" {
  project  = var.project_id
  name     = "therapy_docs_app"
  instance = google_sql_database_instance.main.name
  password = random_password.db_app_user.result
}

resource "google_secret_manager_secret" "database_url" {
  project   = var.project_id
  secret_id = "therapy-docs-database-url-${var.environment}"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${google_sql_user.app.name}:${random_password.db_app_user.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.app.name}"
}

# --- GCS buckets: library documents + session transcripts ---

resource "google_storage_bucket" "documents" {
  project                     = var.project_id
  name                        = "${var.project_id}-therapy-docs-documents"
  location                    = var.region
  uniform_bucket_level_access = true
  versioning {
    enabled = true
  }
  encryption {
    default_kms_key_name = google_kms_crypto_key.main.id
  }
  depends_on = [google_kms_crypto_key_iam_member.gcs_encrypter]
}

resource "google_storage_bucket" "transcripts" {
  project                     = var.project_id
  name                        = "${var.project_id}-therapy-docs-transcripts"
  location                    = var.region
  uniform_bucket_level_access = true
  versioning {
    enabled = true
  }
  encryption {
    default_kms_key_name = google_kms_crypto_key.main.id
  }
  depends_on = [google_kms_crypto_key_iam_member.gcs_encrypter]
}

# --- BigQuery: long-term audit log mirror ---

resource "google_bigquery_dataset" "audit_logs" {
  project    = var.project_id
  dataset_id = "audit_logs"
  location   = var.region

  # TODO: CMEK — see the "TODO: BigQuery CMEK" note near the top of this file. Using
  # Google-managed encryption for now.

  # TODO: set default_table_expiration_ms / partition expiration once the retention period
  # required by the BAA + clinic policy is confirmed.
}

resource "google_bigquery_table" "audit_events" {
  project             = var.project_id
  dataset_id          = google_bigquery_dataset.audit_logs.dataset_id
  table_id            = "audit_events"
  deletion_protection = true

  schema = jsonencode([
    { name = "actorId", type = "STRING", mode = "REQUIRED" },
    { name = "action", type = "STRING", mode = "REQUIRED" },
    { name = "resourceType", type = "STRING", mode = "REQUIRED" },
    { name = "resourceId", type = "STRING", mode = "REQUIRED" },
    { name = "patientId", type = "STRING", mode = "NULLABLE" },
    { name = "sourceIp", type = "STRING", mode = "NULLABLE" },
    { name = "occurredAt", type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}
