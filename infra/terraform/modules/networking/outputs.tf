output "vpc_id" {
  value = google_compute_network.main.id
}

output "subnetwork_id" {
  value = google_compute_subnetwork.main.id
}
