provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

module "networking" {
  source     = "./modules/networking"
  project_id = var.project_id
  region     = var.region
}

module "iam" {
  source                  = "./modules/iam"
  project_id              = var.project_id
  environment             = var.environment
  workspace_domain        = var.workspace_domain
  documents_bucket_name   = module.data.documents_bucket_name
  transcripts_bucket_name = module.data.transcripts_bucket_name
}

module "data" {
  source      = "./modules/data"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  vpc_id      = module.networking.vpc_id
}

module "compute" {
  source                    = "./modules/compute"
  project_id                = var.project_id
  region                    = var.region
  environment               = var.environment
  network_id                = module.networking.vpc_id
  subnetwork_id             = module.networking.subnetwork_id
  service_account_emails    = module.iam.service_account_emails
  database_url_secret_id    = module.data.database_url_secret_id
  documents_bucket_name     = module.data.documents_bucket_name
  transcripts_bucket_name   = module.data.transcripts_bucket_name
  audit_dataset_id          = module.data.audit_dataset_id
  gmail_oauth_client_id     = var.gmail_oauth_client_id
  gmail_oauth_client_secret = var.gmail_oauth_client_secret
  gmail_oauth_redirect_uri  = var.gmail_oauth_redirect_uri
  iap_accessor_members      = var.iap_accessor_members
  api_url                   = var.api_url
}
