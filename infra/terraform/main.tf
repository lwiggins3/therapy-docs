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
  source           = "./modules/iam"
  project_id       = var.project_id
  environment      = var.environment
  workspace_domain = var.workspace_domain
}

module "data" {
  source     = "./modules/data"
  project_id = var.project_id
  region     = var.region
  vpc_id     = module.networking.vpc_id
}

module "compute" {
  source                 = "./modules/compute"
  project_id             = var.project_id
  region                 = var.region
  environment            = var.environment
  network_id             = module.networking.vpc_id
  subnetwork_id          = module.networking.subnetwork_id
  service_account_emails = module.iam.service_account_emails
}
