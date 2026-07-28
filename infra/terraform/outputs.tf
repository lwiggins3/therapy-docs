output "web_url" {
  value = module.compute.web_url
}

output "api_url" {
  value = module.compute.api_url
}

output "worker_url" {
  value = module.compute.worker_url
}

output "cloud_sql_connection_name" {
  value = module.data.cloud_sql_connection_name
}

output "documents_bucket_name" {
  value = module.data.documents_bucket_name
}

output "transcripts_bucket_name" {
  value = module.data.transcripts_bucket_name
}

output "audit_dataset_id" {
  value = module.data.audit_dataset_id
}

output "workload_identity_provider" {
  value = module.iam.workload_identity_provider
}

output "deploy_service_account_email" {
  value = module.iam.deploy_service_account_email
}
