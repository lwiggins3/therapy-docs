output "cloud_sql_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "documents_bucket_name" {
  value = google_storage_bucket.documents.name
}

output "transcripts_bucket_name" {
  value = google_storage_bucket.transcripts.name
}

output "audit_dataset_id" {
  value = google_bigquery_dataset.audit_logs.dataset_id
}

output "database_url_secret_id" {
  description = "Secret Manager secret holding the fully-assembled DATABASE_URL for Cloud Run to reference."
  value       = google_secret_manager_secret.database_url.secret_id
}
