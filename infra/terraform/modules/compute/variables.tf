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
  description = "web's /api-proxy/gmail/callback URL (Google's OAuth redirect is browser-mediated, so it must land on web's already-IAP-authenticated origin, not api's directly — see modules/compute's IAP section). Supplied directly since the URL is already known after first deploy."
  type        = string
}

variable "iap_accessor_members" {
  description = "IAM members (e.g. \"user:you@yourdomain.com\", \"group:therapists@yourdomain.com\") granted roles/iap.httpsResourceAccessor on web — who's actually let through IAP's login gate."
  type        = list(string)
}

variable "api_url" {
  description = "api's own URL, for web's API_URL env var. Can't be google_cloud_run_v2_service.api.uri directly — api's WEB_APP_URL already references web's uri, and web referencing api's uri back would create a resource cycle. Supplied directly, same as gmail_oauth_redirect_uri."
  type        = string
}
