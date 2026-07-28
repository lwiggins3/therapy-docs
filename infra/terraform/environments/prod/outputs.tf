output "web_url" {
  value = module.therapy_docs.web_url
}

output "api_url" {
  value = module.therapy_docs.api_url
}

output "worker_url" {
  value = module.therapy_docs.worker_url
}

output "cloud_sql_connection_name" {
  value = module.therapy_docs.cloud_sql_connection_name
}

output "documents_bucket_name" {
  value = module.therapy_docs.documents_bucket_name
}

output "transcripts_bucket_name" {
  value = module.therapy_docs.transcripts_bucket_name
}

output "audit_dataset_id" {
  value = module.therapy_docs.audit_dataset_id
}

output "workload_identity_provider" {
  value = module.therapy_docs.workload_identity_provider
}

output "deploy_service_account_email" {
  value = module.therapy_docs.deploy_service_account_email
}
