variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "network_id" {
  type = string
}

variable "subnetwork_id" {
  type = string
}

variable "service_account_emails" {
  description = "Map of app name (web, api, worker) to service account email."
  type        = map(string)
}

variable "database_url_secret_id" {
  description = "Secret Manager secret (from modules/data) holding the fully-assembled DATABASE_URL."
  type        = string
}

variable "documents_bucket_name" {
  type = string
}

variable "transcripts_bucket_name" {
  type = string
}

variable "audit_dataset_id" {
  type = string
}

variable "gmail_oauth_client_id" {
  type = string
}

variable "gmail_oauth_client_secret" {
  type      = string
  sensitive = true
}

variable "gmail_oauth_redirect_uri" {
  description = "api's own /gmail/callback URL. Can't be derived from google_cloud_run_v2_service.api.uri (circular self-reference) — supplied directly since the URL is already known after first deploy."
  type        = string
}
