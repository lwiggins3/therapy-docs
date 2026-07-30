terraform {
  backend "gcs" {
    # bucket = "therapy-docs-tfstate-prod" # set via -backend-config or fill in directly
    prefix = "prod"
  }
}

module "therapy_docs" {
  source = "../.."

  project_id                = var.project_id
  region                    = var.region
  environment               = "prod"
  workspace_domain          = var.workspace_domain
  gmail_oauth_client_id     = var.gmail_oauth_client_id
  gmail_oauth_client_secret = var.gmail_oauth_client_secret
  gmail_oauth_redirect_uri  = var.gmail_oauth_redirect_uri
}
