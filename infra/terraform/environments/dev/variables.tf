variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "workspace_domain" {
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
  type = string
}

variable "iap_accessor_members" {
  type = list(string)
}

variable "api_url" {
  type = string
}
