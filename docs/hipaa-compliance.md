# HIPAA / BAA Service Inventory

This document exists to satisfy one hard requirement of the project: **at no point should any
service outside GCP process or store patient data**, so that every service touching PHI can be
listed on Google Cloud's Business Associate Agreement (BAA).

Google Cloud's BAA covers a defined list of GCP products (the "GCP BAA-covered services" list,
which Google publishes and updates). Before production launch, cross-check every service below
against Google's current published list — this document should be kept in sync with that list,
not treated as a substitute for it.

## GCP services in the PHI path (must be BAA-covered)

| Service | Used for |
|---|---|
| Cloud Run | Hosting `web`, `api`, `worker` |
| Cloud SQL for PostgreSQL | Primary datastore: patients, transcripts, documents, tags, recommendations, drafts, audit table |
| Cloud Storage (GCS) | Raw uploaded documents and session transcripts |
| Vertex AI (Model Garden: Claude; native: Gemini) | Tag suggestion, embeddings, document recommendation, email drafting |
| Document AI | OCR/text extraction from uploaded PDFs/scans |
| Pub/Sub | Document/transcript ingestion event bus |
| Secret Manager | Gmail OAuth tokens, other runtime secrets |
| Cloud KMS | CMEK for Cloud SQL and GCS |
| BigQuery | Long-term, append-only audit log warehouse |
| Cloud Logging / Cloud Audit Logs | Infrastructure-level access logs (defense in depth alongside the application audit table) |
| Identity-Aware Proxy (IAP) | Gates `web`/`api` access to authenticated therapists |
| Artifact Registry / Cloud Build | CI/CD image storage and builds (no PHI, but part of the deployment path) |
| VPC / Direct VPC Egress / VPC Service Controls | Network isolation around the above (see `infra/terraform/modules/networking`) |

Every product in this table must appear in the executed Google Cloud BAA before production data
flows through it.

## Documented exception: Google Workspace (identity + Gmail draft)

Two pieces of this system use **Google Workspace**, not GCP infrastructure:

1. **Therapist authentication** — Identity-Aware Proxy is configured against the practice's
   Google Workspace / Cloud Identity domain, so therapists sign in with their existing Workspace
   account.
2. **Email drafting** — the finalized recommendation list is written as a Gmail draft (via the
   Gmail API, `gmail.compose` scope, per-therapist OAuth) in the therapist's own mailbox, for
   them to review and send. The application never sends email itself.

**Google Workspace and Google Cloud Platform are governed by separate BAAs.** Signing a BAA for
GCP does not automatically cover Workspace, and vice versa. This is a deliberate, acknowledged
choice (see the plan that produced this repo) — not an oversight — made on the basis that:

- No PHI is stored in Workspace/Gmail infrastructure that this application controls: IAP uses
  Workspace only to *authenticate* the therapist (an identity assertion), and the Gmail draft
  contains only what the therapist has explicitly approved to send to their own patient — the
  same content a therapist could type into their own email client. Full transcripts, raw
  documents, and the audit trail never touch Workspace.
- The clinic must still execute a **separate Google Workspace BAA** (distinct from the GCP BAA)
  covering the Gmail API and Cloud Identity/Workspace SSO before this system handles real patient
  data. Track this as a compliance prerequisite alongside the GCP BAA, not an implementation
  detail — legal/compliance sign-off should confirm both BAAs are in place before go-live.

If this exception becomes unacceptable later (e.g. the clinic doesn't have or want a separate
Workspace BAA), the two integration points can be replaced without a redesign:
- Identity: swap Workspace SSO for GCP's Identity Platform (a GCP product, covered by the GCP
  BAA) — see the "Identity Platform" alternative considered during planning.
- Email: drop Gmail API drafting and instead only render the draft in-app for the therapist to
  copy into whatever email system they use — removes the Workspace dependency entirely.

## Audit logging (requirement e)

Every read of transcript content — a therapist viewing it, the worker pipeline extracting text
from it, or an LLM call processing it — is recorded through `packages/audit`:

- **Application-level**: an insert-only `audit_events` table in Cloud SQL, mirrored to a BigQuery
  `audit_logs` dataset for immutable, long-term retention independent of the primary database's
  lifecycle.
- **Infrastructure-level**: IAP access logs and Cloud Audit Logs (Data Access logs on Cloud SQL
  and GCS) provide a second, independent trail of who reached the system and touched the
  underlying storage, as defense in depth alongside the application-level log.

See `packages/audit/README.md` for what must call this logger and when.

## Data minimization

`Patient` records store only a display name/identifier and an optional external MRN reference —
no other demographic or clinical data is duplicated into this system beyond what's in the
uploaded transcripts/documents themselves. Keep new fields to the minimum necessary as the data
model evolves.
