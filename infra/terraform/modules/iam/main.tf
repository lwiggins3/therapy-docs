locals {
  apps = ["web", "api", "worker"]
}

resource "google_service_account" "app" {
  for_each     = toset(local.apps)
  project      = var.project_id
  account_id   = "therapy-docs-${each.key}-${var.environment}"
  display_name = "therapy-docs ${each.key} (${var.environment})"
}

# NOTE: the IAP OAuth "brand" (consent screen) is intentionally NOT managed here.
# `google_iap_brand` relies on the IAP OAuth Admin API, which Google deprecated in July 2025 —
# the resource no longer reliably functions for creation. Configure the OAuth consent screen for
# this project once, manually, via Console (APIs & Services > OAuth consent screen), restricted
# to var.workspace_domain, before applying the IAM bindings below.
#
# TODO: google_iap_web_iam_member / google_iap_web_backend_service_iam_member granting
# roles/iap.httpsResourceAccessor to a Google Group scoped to var.workspace_domain, once
# modules/compute's backend services exist to attach IAP to.

# Deferred to roadmap item 6 (CI/CD): Google requires an explicit attribute_condition on OIDC
# workload identity pool providers, scoping which repos may assume this identity (e.g.
# assertion.repository == "my-org/therapy-docs") — a placeholder here would either be wrong or
# forgotten. Re-add this once the GitHub repo exists and CI/CD is actually being wired up.
#
# resource "google_iam_workload_identity_pool" "github" {
#   project                   = var.project_id
#   workload_identity_pool_id = "github-actions-${var.environment}"
#   display_name              = "GitHub Actions (${var.environment})"
# }
#
# resource "google_iam_workload_identity_pool_provider" "github" {
#   project                            = var.project_id
#   workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
#   workload_identity_pool_provider_id = "github"
#   display_name                       = "GitHub"
#   attribute_mapping = {
#     "google.subject"       = "assertion.sub"
#     "attribute.repository" = "assertion.repository"
#   }
#   attribute_condition = "assertion.repository == 'CHANGEME/therapy-docs'"
#   oidc {
#     issuer_uri = "https://token.actions.githubusercontent.com"
#   }
# }
