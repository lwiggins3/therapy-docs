output "service_account_emails" {
  value = { for app, sa in google_service_account.app : app => sa.email }
}
