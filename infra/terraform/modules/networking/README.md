# modules/networking

Provisions:

- A VPC with a single subnet per region in use.
- (Not yet implemented) A VPC Service Controls perimeter around the project, to constrain data
  exfiltration paths for the GCS buckets / Cloud SQL / BigQuery dataset holding PHI. This is the
  strongest defense-in-depth control available for the "no service outside GCP" requirement and
  should be added before production launch — see `docs/hipaa-compliance.md`.

Cloud Run reaches Cloud SQL (and anything else on the VPC) over private IP via **Direct VPC
Egress** — `modules/compute`'s Cloud Run services attach `network_interfaces` straight to this
module's subnet, no separate connector resource involved. An earlier version of this module
provisioned a `google_vpc_access_connector`; its instances consistently failed health checks on
the real `therapy-docs` project with no identifiable cause (firewall rules, stale state, quotas,
and org policy were all ruled out one at a time against the live project — see
`docs/roadmap.md` item 2). Direct VPC Egress is also Google's current recommended approach over
VPC Access Connectors for new deployments, so this wasn't purely a workaround.

## Outputs

- `vpc_id` — consumed by `modules/data` (Cloud SQL private IP) and `modules/compute` (Cloud Run
  Direct VPC Egress).
- `subnetwork_id` — consumed by `modules/compute` (Cloud Run Direct VPC Egress).
