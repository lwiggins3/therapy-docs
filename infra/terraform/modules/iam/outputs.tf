output "service_account_emails" {
  value = { for app, sa in google_service_account.app : app => sa.email }
}

output "workload_identity_provider" {
  description = "Full resource name for google-github-actions/auth's workload_identity_provider input."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account_email" {
  value = google_service_account.deploy.email
}
