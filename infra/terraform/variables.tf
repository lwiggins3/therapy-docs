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
