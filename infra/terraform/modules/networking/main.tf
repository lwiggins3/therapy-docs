resource "google_compute_network" "main" {
  project                 = var.project_id
  name                    = "therapy-docs-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  project       = var.project_id
  name          = "therapy-docs-subnet"
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = "10.10.0.0/20"
}

# Cloud Run reaches Cloud SQL (and anything else on the VPC) over private IP via Direct VPC
# Egress — Cloud Run's network interfaces attach straight to this subnet, no separate VPC Access
# Connector VM fleet needed. (A prior version of this file used google_vpc_access_connector;
# switched away after its instances consistently failed health checks on this project with no
# identifiable cause — ruled out firewall rules, stale state, quotas, and org policy one by one.
# Direct VPC Egress is also Google's current recommended approach over VPC Access Connectors.)

# TODO: google_access_context_manager_service_perimeter around GCS/Cloud SQL/BigQuery/Vertex AI
# once the org's Access Context Manager policy exists (org-level resource, provisioned outside
# a single project's Terraform state — coordinate with whoever owns the GCP org).
