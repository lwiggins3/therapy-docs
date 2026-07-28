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
