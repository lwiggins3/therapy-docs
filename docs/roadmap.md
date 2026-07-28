# Roadmap

Living tracker for what's left. Check items off as they land; add sub-items as work uncovers
more detail. Keep this in sync with reality — if a decision changes, edit here rather than
letting this drift out of date.

## 1. Document ingestion → tagging pipeline — DONE

- [x] Text extraction abstraction (Document AI for PDF/scans, plain decode for `.txt`/`.md`) —
      `apps/worker/src/lib/text-extraction.ts`
- [x] Wired `packages/llm-client`'s `embed()` (shared Vertex AI helper, both adapters) and
      `suggestTags()` (both adapters) for real — **unverified against a live model**, no GCP
      credentials in the environment this was built in; smoke-test once real access exists (item 2)
- [x] `apps/api`: `DocumentsModule` — upload endpoint, `LibraryDocument`/tag endpoints, publishes
      to `document-ingest` via the real Pub/Sub emulator (`src/scripts/setup-pubsub.ts`)
- [x] `apps/worker`: `handleDocumentIngest` implemented for real (extract → embed → suggest tags →
      persist unconfirmed `DocumentTagAssignment` rows → mark `ready`/`failed`)
- [x] `apps/web`: upload form (`/documents/upload`) + tag review screen (`/documents`) —
      confirm/reject/add tags. Verified in a real browser (Playwright): upload → list → manual
      tag add → status transitions all work.
- [x] `apps/worker` Vitest suite (`document-ingest.test.ts`) proves the full orchestration with
      local/stub adapters, zero GCP credentials

Also added along the way (not originally scoped, but required to make this actually work):
`packages/storage` (provider-agnostic file storage, mirrors `llm-client`'s adapter pattern),
esbuild bundling for `apps/worker` and NestJS webpack-mode bundling for `apps/api` (plain `tsc`
can't resolve multi-file workspace packages at runtime — see each app's README), a dev Therapist
seed + `/dev/therapist` shim (no real auth yet), and a `LOCAL_STORAGE_DIR` fix (must be an
absolute path since `apps/api`/`apps/worker` run from different directories).

## 2. Real GCP dev environment — DONE (see `docs/runbooks/gcp-dev-setup.md`)

- [x] GCP dev project created (`therapy-docs`, billing linked) and required APIs enabled
- [x] Vertex AI Model Garden access granted for Claude — served via the **`us` multi-region**,
      not a specific region; `VERTEX_AI_LOCATION=us` in `.env` (kept independent of `GCP_REGION`,
      which stays `us-central1` for Cloud SQL/GCS/Pub/Sub/etc.)
- [x] `terraform apply` against `infra/terraform/environments/dev` succeeded — VPC/subnet, Cloud
      SQL (`therapy-docs-pg`), GCS buckets, BigQuery `audit_logs`, KMS, Artifact Registry, service
      accounts, and the 3 Cloud Run services (still running the `hello` placeholder image — real
      images come with CI/CD, roadmap item 6) all exist for real. Found and fixed several
      apply-time-only issues along the way (none caught by `plan`/`validate`): missing CMEK IAM
      grants for Cloud SQL/GCS service agents, an invalid `cloudsql.enable_pgvector` flag (pgvector
      needs no instance flag, just `CREATE EXTENSION`), a WIF provider needing an
      `attribute_condition` we don't have a repo for yet (deferred to item 6), a VPC Access
      Connector missing `max_instances`/`max_throughput`, and — after ruling out firewall rules,
      stale state, quotas, and org policy one at a time — the connector never passing health
      checks at all, so it was replaced with Direct VPC Egress (`network_interfaces`) instead of
      chasing it further. Also added the `environments/*/outputs.tf` files that were missing
      entirely (root `outputs.tf` existed but was never re-exposed one level down).
- [x] Manually configured the IAP OAuth consent screen (can't be Terraformed — see
      `infra/terraform/modules/iam/README.md`): Internal user type, since this project belongs to
      a real Google Workspace organization (the actual domain lives in `terraform.tfvars`'s
      `workspace_domain` — gitignored, not committed).

Deliberately **not done yet**: actually enabling IAP in front of `web`/`api` and granting
`roles/iap.httpsResourceAccessor` to a Workspace group — still a TODO in
`infra/terraform/modules/iam/main.tf`. Those Cloud Run services only run the `hello` placeholder
right now, so there's no urgency locking down access before item 6 (CI/CD) deploys real code —
revisit alongside that.

## 3. Test coverage

- [x] Vitest added to `apps/worker` as part of item 1 (not a separate retrofit pass) —
      `document-ingest.test.ts` covers the pipeline orchestration
- [ ] `apps/api`, `packages/llm-client`, `packages/storage` still have no tests —
      add as their logic gets exercised by upcoming roadmap items, same "test alongside the
      feature" approach

## 4. Transcript → recommendation pipeline

- [ ] Depends on (1) — needs a populated, tagged document library to recommend against
- [ ] `apps/api`: `TranscriptsModule`, `RecommendationsModule`
- [ ] `apps/worker`: implement `handleTranscriptIngest` for real (extract → embed → pgvector
      pre-filter → `recommendDocuments()` → persist `Recommendation` rows)
- [ ] `apps/web`: transcript upload + recommendation review screen (accept/reject/add,
      per patient/transcript)

## 5. Therapist review → draft email

- [ ] `packages/llm-client`'s `draftEmail()` implementation
- [ ] `apps/api`: `EmailDraftsModule`, Gmail API integration (`gmail.compose` scope, per-therapist
      OAuth, draft-only — never sends)
- [ ] `apps/web`: finalize-recommendations action → draft review screen

## 6. CI/CD

- [ ] Push this repo to GitHub
- [ ] Re-add the Workload Identity Federation pool/provider in `infra/terraform/modules/iam`
      (commented out during item 2 — needs a real `attribute_condition` scoped to this repo,
      which didn't exist yet when that was hit)
- [ ] Wire up GitHub Actions to deploy to Cloud Run using that WIF pool
- [ ] Once real images are deployed, revisit IAP-in-front-of-`web`/`api` (see item 2's note)

## 7. Compliance (not code, but blocking for real patient data)

- [ ] Execute the GCP BAA covering every service in `docs/hipaa-compliance.md`
- [ ] Execute the separate Google Workspace BAA (IAP SSO + Gmail API — see the documented
      exception in `docs/hipaa-compliance.md`)
