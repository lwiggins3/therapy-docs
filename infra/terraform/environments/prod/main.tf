terraform {
  backend "gcs" {
    # bucket = "therapy-docs-tfstate-prod" # set via -backend-config or fill in directly
    prefix = "prod"
  }
}

module "therapy_docs" {
  source = "../.."

  project_id       = var.project_id
  region           = var.region
  environment      = "prod"
  workspace_domain = var.workspace_domain
}
