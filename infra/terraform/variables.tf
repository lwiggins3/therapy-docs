variable "project_id" {
  description = "GCP project ID this environment deploys into."
  type        = string
}

variable "region" {
  description = "Primary GCP region for regional resources (Cloud Run, Cloud SQL, Pub/Sub)."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, prod), used for resource naming/labeling."
  type        = string
}

variable "workspace_domain" {
  description = "Google Workspace / Cloud Identity domain therapists authenticate against, for IAP."
  type        = string
}

variable "gmail_oauth_client_id" {
  description = "OAuth 2.0 Client ID (Web application) for the gmail.compose draft-email flow — see docs/roadmap.md item 5."
  type        = string
}

variable "gmail_oauth_client_secret" {
  description = "Client secret for gmail_oauth_client_id."
  type        = string
  sensitive   = true
}

variable "gmail_oauth_redirect_uri" {
  description = "api's own /gmail/callback URL, e.g. https://therapy-docs-api-<env>-<hash>-uc.a.run.app/gmail/callback — get the base URL from `terraform output api_url` after first deploy, and add it as an Authorized redirect URI on the OAuth client in Console."
  type        = string
}
