variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_id" {
  description = "VPC (from modules/networking) Cloud SQL attaches to via private IP."
  type        = string
}
