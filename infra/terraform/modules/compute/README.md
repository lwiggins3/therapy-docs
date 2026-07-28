# modules/compute

Provisions:

- Artifact Registry Docker repo (CI/CD pushes `web`, `api`, `worker` images here).
- Three Cloud Run v2 services: `web`, `api`, `worker`, each using its own service account from
  `modules/iam` and reaching Cloud SQL over private IP via Direct VPC Egress
  (`vpc_access.network_interfaces`, attached straight to `modules/networking`'s subnet — no
  separate VPC Access Connector resource; see that module's README for why).
- Pub/Sub topics (`document-ingest`, `transcript-ingest`) and push subscriptions targeting the
  `worker` service's corresponding endpoints.

IAP-in-front-of-`web`/`api` is still a TODO in `modules/iam` — not yet wired up. Deliberately
deferred until real images (not the `hello` placeholder) are actually deployed here via CI/CD
(roadmap item 6); no urgency locking down access to a placeholder. `worker` will never be
IAP-protected regardless, since it only accepts Pub/Sub push requests, authenticated via OIDC
push auth instead.

## Inputs

- `network_id`, `subnetwork_id` (from `modules/networking`)
- `service_account_emails` (from `modules/iam`)

## Status

Cloud Run services, Artifact Registry repo, and Pub/Sub topics/subscriptions are live in the real
`therapy-docs` GCP project (roadmap item 2) — container images are still the
`us-docker.pkg.dev/cloudrun/container/hello` placeholder until CI/CD (roadmap item 6) pushes real
builds to the Artifact Registry repo here.
