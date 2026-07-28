terraform {
  backend "gcs" {
    # bucket = "therapy-docs-tfstate-dev" # set via -backend-config or fill in directly
    prefix = "dev"
  }
}

module "therapy_docs" {
  source = "../.."

  project_id       = var.project_id
  region           = var.region
  environment      = "dev"
  workspace_domain = var.workspace_domain
}
