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
      `document-ingest.test.ts` and (as of item 4) `transcript-ingest.test.ts` cover both
      pipelines' orchestration
- [x] Vitest added to `packages/llm-client` as part of item 4 (`recommend-documents.test.ts`) and
      item 5 (`draft-email.test.ts`) — both cover their response parsers
- [x] Vitest added to `apps/api` as part of item 5 (first coverage for this app) —
      `signed-state.test.ts` and `approved-recommendations.test.ts`
- [ ] `packages/storage` still has no tests — add as its logic gets exercised by upcoming roadmap
      items, same "test alongside the feature" approach

## 4. Transcript → recommendation pipeline — DONE

- [x] `packages/db`: added `Transcript.mimeType` (schema already had `Patient`/`Transcript`/
      `Recommendation` from earlier scaffolding — text extraction dispatch needed a mimeType
      field, mirroring `LibraryDocument`)
- [x] `packages/llm-client`: implemented `recommendDocuments()` for real in both adapters
      (`recommend-documents.ts` prompt builder/parser, mirroring `suggest-tags.ts`) — first Vitest
      coverage for this package (roadmap item 3 flagged it as untested; this is that moment)
- [x] **PDF-only for now**: both document and transcript uploads are restricted to
      `application/pdf` (client `accept` + server-side `BadRequestException` on any other
      mimetype) — docx/other formats are explicit future work once this moves toward production
- [x] `apps/api`: added the missing `PatientsModule` (nothing created `Patient` rows before this),
      `TranscriptsModule` (upload → `transcripts` bucket → publish to `transcript-ingest`), and
      `RecommendationsModule` (list/accept/reject/manually-add)
- [x] `apps/worker`: implemented `handleTranscriptIngest` for real — audit-logs
      `transcript.llm_process` before any LLM call, extracts text, embeds it, pgvector-prefilters
      the top-20 `LibraryDocument`s by cosine distance scoped to the same therapist, calls
      `recommendDocuments()`, persists `suggested` `Recommendation` rows. Extracted the
      `toPgVectorLiteral` helper (was duplicated) into `src/lib/pgvector.ts`, shared with
      `document-ingest.ts`
- [x] `apps/web`: `/patients` (list + add), `/transcripts/upload` (patient picker + PDF file
      input), `/transcripts` (list) and `/transcripts/[id]` (recommendation review —
      accept/reject/manually add a document)
- [x] Verified: `pnpm turbo run lint typecheck test` clean across all touched
      packages/apps (8 tests, including a new `transcript-ingest.test.ts` mirroring
      `document-ingest.test.ts`'s structure); real local smoke test confirmed the full mechanical
      pipeline — patient creation, PDF-only upload validation, Pub/Sub delivery to
      `/pubsub/transcript-ingest`, the audit event recorded before the (attempted) LLM call, and
      correct `failed` status transition.
- [x] Fixed a real bug surfaced by the first-ever live-model attempt (previously masked by
      `invalid_rapt` reauth failures blocking every call before this): `embedWithVertexAi` was
      reusing the *chat* model's location for the *embedding* model — fine for Gemini's own
      region, but Claude on Model Garden uses the "us" multi-region, which isn't valid for the
      `gemini-embedding-001` embedding endpoint (404s). `createLlmClient`/both adapters now take
      a separate `embeddingLocation`, defaulting to `GCP_REGION` in `apps/worker/src/main.ts`.
      Affects `document-ingest.ts` too (pre-existing, not new to item 4) — was never caught
      because this pipeline had never been exercised against a live model before now.
- [x] **Recommendation quality verified against a live model** (Gemini — see note below on
      Claude): seeded 3 tagged library documents (anxiety coping skills, sleep hygiene, couples
      communication) and a transcript describing panic attacks + a request for concrete coping
      techniques. Result: correctly recommended *only* the anxiety-coping-skills document — zero
      false positives against the two unrelated documents — with a specific, transcript-grounded
      rationale ("the patient reported multiple panic attacks and expressed a specific interest in
      learning 'concrete techniques' like breathing or grounding exercises..."). Tag suggestions
      on the 3 seed documents were also independently accurate (e.g. "Anxiety," "Panic Attacks,"
      "Grounding Techniques" for the anxiety document).
- [x] Fixed a second real bug surfaced by this test: `handleTranscriptIngest` wasn't idempotent
      against Pub/Sub's at-least-once redelivery — a concurrent redelivery raced the first
      attempt and produced two identical `Recommendation` rows for one transcript. Fixed with a
      guard at the top of the handler (`if (transcript.status === "ready") return;` — status only
      flips to `ready` after a full successful run, so it doubles as the idempotency signal, no
      dedup table needed). Covered by a new test case in `transcript-ingest.test.ts`.
- [x] **That guard alone turned out to be insufficient** — found during item 5's real Gmail
      end-to-end test, which produced 3 `Recommendation` rows for one transcript instead of 1.
      Root cause: both push subscriptions defaulted to Pub/Sub's 10-second ack deadline, but a
      real transcript-ingest run (two sequential live LLM calls — embed, then
      `recommendDocuments`) routinely takes 20-30+ seconds. Pub/Sub redelivers the same message
      while the first attempt is still in flight, *before* it's ever written `status: "ready"` —
      so the status-based guard above never even sees a reason to fire, since none of the
      concurrent/overlapping attempts have finished yet. Fixed at the actual source: both
      subscriptions now request a 600-second (Pub/Sub's max) ack deadline —
      `apps/api/src/scripts/setup-pubsub.ts` for local dev (`ackDeadlineSeconds` on create, plus
      `subscription.setMetadata()` to converge an already-existing subscription), and
      `ack_deadline_seconds = 600` on both `google_pubsub_subscription` resources in
      `infra/terraform/modules/compute/main.tf` for real deployments (**needs `terraform apply`**
      — not applied automatically). Confirmed locally: both subscriptions now report
      `ackDeadlineSeconds: 600`. This affects `document-ingest` too, though it was invisible there
      since tag assignments are `upsert`ed (idempotent at the DB level) — only `Recommendation`'s
      plain `create()` makes the duplication visible.
- [x] **Real end-to-end Gmail verification, done**: connected Gmail via `/settings`, uploaded a
      document, confirmed its tags, uploaded a matching transcript, accepted the resulting
      recommendation, and finalized — a real draft appeared in the therapist's actual Gmail
      Drafts folder (`gmailDraftId` returned by the real API), with an appropriately warm,
      correctly-scoped subject/body. Item 5's only remaining checkbox (the manual OAuth client
      setup) is now complete for local dev.
- [x] Model id is now a configuration item, not hardcoded: `createLlmClient()` takes an optional
      `model`, passed through to whichever adapter's constructor (both already accepted a `model`
      override — just wasn't wired up to any env var). `apps/worker/src/main.ts` reads it from a
      new `LLM_MODEL` env var (empty = each adapter's own hardcoded default). Set `LLM_PROVIDER=
      gemini` as the default in `.env`/`.env.example` for now, since Claude's hardcoded default
      model id 404s in this project (not deployed/enabled at that path in Model Garden). Switch
      back to `claude-vertex` + set `LLM_MODEL` once the real available Claude model id/version is
      confirmed on the project's Model Garden page.

## 5. Therapist review → draft email — DONE

This was a from-scratch build, unlike items 1/4 — no OAuth code, no token storage, no
`EmailDraftsModule` existed at all beforehand.

- [x] `packages/llm-client`: implemented `draftEmail()` for real in both adapters
      (`draft-email.ts` prompt builder/parser, mirroring `recommend-documents.ts`), with tests.
- [x] Schema: added `EmailDraft.subject`/`.body` (persists the drafted content so the review
      screen doesn't need a live Gmail round-trip) and `Therapist.gmailConnected`/`.gmailTokenRef`
      (a *pointer* to where the refresh token lives — never the token itself in Postgres, per
      `docs/hipaa-compliance.md`'s BAA table, which already named Secret Manager as the intended
      store).
- [x] `apps/api/src/lib/token-store.ts` (new): `TokenStore` interface mirroring the
      storage/llm-client adapter pattern — `LocalFileTokenStore` (dev default, clearly marked
      non-compliant) and `SecretManagerTokenStore` (one secret per therapist, real deployments).
- [x] `apps/api/src/lib/signed-state.ts` (new): HMAC-signed, short-lived OAuth `state` param —
      there's no real session system yet (every controller trusts a client-supplied
      `x-therapist-id` header), so this stands in for session-based CSRF protection/attribution,
      in the same deliberate-stopgap spirit as the `x-therapist-id` dev shim.
- [x] `apps/api`: new `GmailModule` (`/gmail/auth-url`, `/gmail/callback`, `/gmail/status`) and
      `EmailDraftsModule` (`POST /email-drafts` finalizes — LLM draft + real Gmail
      `drafts.create` call + persists `EmailDraft`/`EmailDraftDocument`; `GET /email-drafts`
      lists). Gmail draft has **no "To" address** — deliberate: `Patient` intentionally stores no
      email address (data minimization), so the therapist fills in the recipient themselves
      before sending.
- [x] `apps/web`: `/settings` (Gmail connect status/button) and a "Finalize & create draft"
      action on `/transcripts/[id]`, shown once at least one recommendation is
      accepted/added-by-therapist.
- [x] First Vitest coverage for `apps/api` (none existed before this): `signed-state.test.ts`
      (valid/expired/tampered/malformed cases) and `approved-recommendations.test.ts` (extracted
      the "what counts as approved" predicate out of an inline Prisma filter specifically so it
      was testable without DB mocking).
- [x] Verified: `pnpm turbo run lint typecheck test` clean (20 tests across `llm-client`, `api`,
      `worker`). Local smoke test confirmed the real mechanical path — `/gmail/auth-url` returns a
      correctly-shaped Google consent URL (scope, signed `state`, redirect URI all correct), and a
      seeded transcript with an accepted recommendation correctly ran the full `finalize` flow —
      transcript/patient lookup, the approved-recommendations filter, and a **real** `draftEmail()`
      call against Gemini — before failing at the expected point: `"Therapist has not connected
      Gmail yet"`.
- [ ] Deferred: once `TOKEN_STORE_PROVIDER` flips to `secret-manager` for a real deployment, the
      `api` runtime service account needs a Secret Manager IAM grant (create/add-version/access on
      its own `gmail-token-*` secrets) — no Terraform change needed for local dev.
- [ ] **`terraform apply` needed**: the `ack_deadline_seconds = 600` fix above is written in
      Terraform but not yet applied to the real dev environment — the manually-run local Pub/Sub
      setup script already has it, but real Cloud Run deploys are still on the 10s default until
      `infra/terraform/environments/dev` is applied.

## 6. CI/CD

- [x] Pushed this repo to GitHub (public) — required scrubbing real Workspace domain/Cloud Run
      URLs/bucket names that had leaked into docs first, then squashing history to a single clean
      commit before the first-ever push (those strings were embedded in earlier commits too)
- [x] Dockerfiles for all three apps (`apps/web`, `apps/api`, `apps/worker`), Turborepo-prune
      3-stage pattern, built and verified locally against real Prisma queries / a fabricated
      Pub/Sub push / real HTTP routes — not just health checks
- [x] Re-added the Workload Identity Federation pool/provider in `infra/terraform/modules/iam`
      (commented out during item 2) with a real `attribute_condition` scoped to
      `lwiggins3/therapy-docs`; added a dedicated `deploy` service account (distinct from the 3
      runtime service accounts) with `roles/run.developer`, `roles/artifactregistry.writer`, and
      `serviceAccountUser` on each app's service account
      Also added `lifecycle.ignore_changes` on each Cloud Run service's `image` field, so CI/CD
      and Terraform don't fight over ownership of it going forward
- [x] `.github/workflows/deploy.yml` — manual (`workflow_dispatch`) trigger, WIF-authenticated,
      builds/pushes/deploys `api` first then queries its live URL to bake into `web`'s build
      (`NEXT_PUBLIC_API_URL` is inlined at Next.js build time). All GCP identifiers come from
      GitHub repo variables (`gh variable set`), never hardcoded in the workflow file
- [x] Triggered the first real deploy — all three Cloud Run services now run real app images.
      First attempt failed: `apps/worker` only read `WORKER_PORT` (baked to 8081 in its
      Dockerfile) and never checked Cloud Run's injected `PORT` (8080), so the container never
      listened where Cloud Run's startup health check expected — timed out and failed to deploy.
      `apps/api` happened to work only because its own hardcoded default coincidentally matches
      Cloud Run's default. Fixed by having `apps/worker` prefer `PORT`, falling back to
      `WORKER_PORT` for local dev; redeployed clean.
- [ ] Once real images are deployed, revisit IAP-in-front-of-`web`/`api` (see item 2's note) — for
      now, all 3 services correctly return 403 to unauthenticated requests since nothing grants
      `allUsers` invoker yet

## 7. Compliance (not code, but blocking for real patient data)

- [ ] Execute the GCP BAA covering every service in `docs/hipaa-compliance.md`
- [ ] Execute the separate Google Workspace BAA (IAP SSO + Gmail API — see the documented
      exception in `docs/hipaa-compliance.md`)

## 8. Folder upload (feature request)

- [ ] `apps/web`'s upload form should accept a folder, not just individual files — recursively
      walking all nested subfolders and documents inside it and uploading each one through the
      existing per-document pipeline (item 1)
