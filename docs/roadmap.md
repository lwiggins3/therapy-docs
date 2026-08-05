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

- [x] **Bug, confirmed by the real end-to-end browser test (item 6), now fixed and verified**:
      real PDF uploads used to come back with the LLM itself reporting "unreadable content,"
      "corrupted file," "technical issue" for suggested tags — not a model quality problem, a
      text-extraction problem. `TEXT_EXTRACTOR`
      was set to `plain` everywhere (local and deployed) because no Document AI processor had ever
      been provisioned; `PlainTextTextExtractor` (`apps/worker/src/lib/text-extraction.ts`)
      UTF-8-decodes the raw file bytes, which works for `.txt`/`.md` but produces binary garbage
      for real PDFs — the LLM was correctly recognizing that garbage as unreadable. This was
      flagged as a "known limitation" caveat as far back as item 4's local testing (synthetic test
      files were plain text mislabeled as `application/pdf` to work around it) but never actually
      fixed. Tracked in [#1](https://github.com/lwiggins3/therapy-docs/issues/1).
      - [x] `google_document_ai_processor` (`OCR_PROCESSOR`, `us` multi-region — Document AI
            processors aren't available per-region like `us-central1`, same reason
            `VERTEX_AI_LOCATION` is split from `GCP_REGION`) added to
            `infra/terraform/modules/compute/main.tf`, fully Terraform-managed — no manual Console
            provisioning step needed. `worker`'s env now gets `TEXT_EXTRACTOR=document-ai`,
            `DOCUMENT_AI_LOCATION`, and `DOCUMENT_AI_PROCESSOR_ID` (the real processor id, pulled
            from the resource) automatically.
      - [x] `roles/documentai.apiUser` granted to the `worker` service account
            (`infra/terraform/modules/iam/main.tf`).
      - [x] Fixed a real bug this surfaced: `apps/worker/src/main.ts` was passing `GCP_REGION`
            (`us-central1`) as Document AI's `location` — would have 404'd against a real
            processor. Now reads the new `DOCUMENT_AI_LOCATION` env var instead.
      - [x] `gcloud services enable documentai.googleapis.com` run by you (fixed the recurring
            `invalid_rapt` ADC reauth issue by re-running `gcloud auth application-default login`
            under the correct account, `larry@agere-solutions.com` — the default ADC account was a
            personal Gmail account with no access to the `therapy-docs` project/state bucket).
            `terraform apply` run against `environments/dev`: 2 added (the processor,
            `roles/documentai.apiUser` binding), 3 changed (worker env vars; the api/web/worker
            scaling-block diff was unrelated pre-existing drift in a read-only Cloud Run field, not
            a real config change), 0 destroyed. Live processor:
            `projects/therapy-docs/locations/us/processors/85a9b9387bed8733`. Local `.env` updated
            with `TEXT_EXTRACTOR=document-ai` and the real `DOCUMENT_AI_PROCESSOR_ID`.
      - [x] Smoke-tested locally: uploaded a real PDF (`100_compassion_fatigue.pdf`) via
            `POST /documents`, worker picked it up off the real Pub/Sub emulator, document landed
            `status: "ready"` (not `failed`) with sensible LLM-suggested tags (`compassion`,
            `fatigue`, `Self-Care`, `Coping Skills`, `Behavioral Strategies`) — confirms Document AI
            is extracting real text instead of the old UTF-8-garbage-from-`plain` behavior.
      - [x] **Smoke-tested against the deployed worker — confirmed, #1 closed.** Terraform state
            already had the processor/IAM grant applied (`terraform plan` showed 0 to add, only
            the pre-existing unrelated scaling-block drift); the actual gap was that
            `apps/worker`'s `DOCUMENT_AI_LOCATION` fix (this same commit) hadn't been deployed yet
            — last successful deploy predated it. Re-ran `deploy.yml` (`workflow_dispatch`) to
            rebuild/redeploy all three services. Signed in through IAP as
            `larry@agere-solutions.com`, uploaded the same `100_compassion_fatigue.pdf` through the
            real `/documents/upload` form: landed `status: "ready"` with sensible tags
            (`Compassion Fatigue`, `Caregiver Support`, `Self-Compassion`, `Burnout`, `anxiety`).
            For direct comparison, an older document uploaded before this fix
            (`ADHD Relationships`) still sits in the library with exactly the pre-fix garbage
            tags (`Unreadable Content`, `Corrupted File`, `Technical Issue`), visible side by side
            in the same document list.

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

~~Deliberately not done yet: actually enabling IAP in front of `web`/`api`~~ — see item 6, done.

## 3. Test coverage

- [x] Vitest added to `apps/worker` as part of item 1 (not a separate retrofit pass) —
      `document-ingest.test.ts` and (as of item 4) `transcript-ingest.test.ts` cover both
      pipelines' orchestration
- [x] Vitest added to `packages/llm-client` as part of item 4 (`recommend-documents.test.ts`) and
      item 5 (`draft-email.test.ts`) — both cover their response parsers
- [x] Vitest added to `apps/api` as part of item 5 (first coverage for this app) —
      `signed-state.test.ts` and `approved-recommendations.test.ts`
- [ ] `packages/storage` still has no tests — add as its logic gets exercised by upcoming roadmap
      items, same "test alongside the feature" approach. Tracked in
      [#2](https://github.com/lwiggins3/therapy-docs/issues/2).

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
- [x] The `api` runtime service account's Secret Manager grant (`roles/secretmanager.admin`,
      project-wide — for `apps/api/src/lib/token-store.ts`'s on-demand `gmail-token-*` secret
      creation) is now written — see item 6's "real Cloud Run runtime config" entry below, which
      also picks up the `ack_deadline_seconds = 600` fix once applied.
- [x] **Bug, found during the real end-to-end browser test, now fixed and verified — #3 closed.**
      The Gmail draft didn't actually attach the approved document(s) —
      `EmailDraftsService.finalize()` (`apps/api/src/email-drafts/email-drafts.service.ts`) only
      ever built a plain-text message (subject + body mentioning the documents by title); nothing
      in `buildRawEmailMessage()` fetched the document's bytes or attached them as a MIME part.
      - [x] `EmailDraftsService` now constructs a `StorageClient` (same pattern as
            `DocumentsService`/`TranscriptsService`) and downloads each approved document's bytes
            via `storage.download({ uri: rec.document.gcsUri })` before building the message.
      - [x] `buildRawEmailMessage()` rewritten to use `nodemailer`'s `MailComposer` (new
            dependency — hand-rolling MIME multipart boundaries/encoding correctly is easy to get
            subtly wrong) to build a real `multipart/mixed` message: the plain-text body plus one
            attachment per approved document (filename derived from the document's title +
            extension from its `mimeType`).
      - [x] New unit test (`email-drafts.service.test.ts`) decodes the base64url raw message and
            asserts the multipart structure, attachment filename, content type, and byte content —
            same "test the extracted pure logic without DB mocking" approach as
            `approved-recommendations.test.ts`.
      - [x] `pnpm turbo run lint typecheck test` clean across all touched packages/apps.
      - [x] **Verified against the real local stack, not just unit tests.** Started `apps/api` and
            `apps/worker` locally, created a patient, uploaded a real transcript, manually added a
            recommendation (the transcript's content didn't match either seeded library document
            closely enough for an LLM-suggested one — expected, not a bug), and called
            `POST /email-drafts` for real. It created a real Gmail draft
            (`gmailDraftId: r-63325822191169058`) in the dev therapist's actual Gmail Drafts folder
            (Gmail connection + refresh token already set up locally from item 5's earlier
            verification). Fetched that draft back via the real Gmail API
            (`gmail.users.drafts.get`) and confirmed its structure directly: top-level
            `multipart/mixed` with a `text/plain` body part and an `application/pdf` part
            (`Test therapy.pdf`, 118,104 bytes, `Content-Disposition: attachment`) — a real
            attachment, not just text mentioning the document. Test patient/transcript/
            recommendation/draft rows cleaned up afterward; the Gmail draft itself was left in
            place.

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
- [x] **IAP in front of `web`, done — plus a real design problem it surfaced.** Testing the
      deployed app in a browser (via `gcloud run services proxy web`) hit "failed to fetch" on
      `/settings`: proxying `web` only authenticates *your* connection to `web` — `web`'s own
      client-side JS then makes a **separate** `fetch()` straight to `api`'s different origin,
      carrying no credentials at all. This was always going to break the moment `api` required
      any auth a browser can't satisfy, IAP or otherwise. Fixed properly, not by making `api`
      public:
      - Enabled IAP **directly on `web`** (`iap_enabled = true` on
        `google_cloud_run_v2_service.web`) — no load balancer/Serverless NEG/custom domain/
        managed cert needed, protects the existing `*.run.app` URL directly. **Only exists in the
        `google-beta` provider**, not stable `google` (confirmed via `terraform providers schema`
        after the field was rejected — the same kind of surprise `google_iap_brand`'s July-2025
        deprecation already produced in this exact area, this time caught before `apply` instead
        of during it). `api`/`worker` stay off IAP entirely — `api` is never browser-facing at
        all now (see below), `worker` only accepts Pub/Sub OIDC push, as already documented.
      - New `apps/web/src/app/api-proxy/[...path]/route.ts`: **every** browser → `api` call now
        routes through `web`'s own server, which mints a real Cloud Run service-to-service ID
        token (`google-auth-library`) and forwards the request untouched. `web`'s `apiUrl`
        constant (`apps/web/src/lib/api.ts`) didn't need to change shape — only what
        `NEXT_PUBLIC_API_URL` gets built with changed (`deploy.yml`: literal `/api-proxy` instead
        of querying `api`'s real URL), so no per-page code changes were needed.
      - **The Gmail OAuth callback got solved for free by the same mechanism**: Google's redirect
        is browser-mediated (not a server-to-server webhook), so pointing
        `GMAIL_OAUTH_REDIRECT_URI` at `web`'s own (already IAP-authenticated) origin instead of
        `api`'s means `api` never needs to be publicly reachable for the callback either — no
        security tradeoff needed anywhere.
      - New IAM: the IAP service agent gets `roles/run.invoker` on `web` (required for IAP to
        function at all), `web`'s own SA gets `roles/run.invoker` on `api` (mirrors the existing
        `worker_self_invoker` pattern, just cross-service), and a new `iap_accessor_members`
        list variable (not a hard-required pre-existing Google Group) grants
        `roles/iap.httpsResourceAccessor` on `web` to whoever's listed.
      - Hit and fixed a real resource cycle along the way: `web`'s new `API_URL` env
        (`google_cloud_run_v2_service.api.uri`) and `api`'s existing `WEB_APP_URL` env
        (`google_cloud_run_v2_service.web.uri`) reference each other's computed output — two
        different resources depending on each other, not the single-resource self-reference case
        hit earlier for `GMAIL_OAUTH_REDIRECT_URI`. Same fix: `api_url` is now a supplied tfvars
        value, not a cross-reference.
      - `terraform validate` clean, full `terraform plan` reviewed (3 to add, 3 to change, 0
        destroyed — all exactly as designed); enabled `iap.googleapis.com` directly via `gcloud`
        (this project enables APIs manually per the existing runbook convention, no
        `google_project_service` precedent to break).
      - **Explicitly out of scope, flagged not silently deferred**: this doesn't replace
        `apps/api/src/dev/dev.controller.ts`'s `x-therapist-id`/seeded-dev-therapist shim with
        real IAP-asserted-identity → `Therapist` lookup (`docs/data-model.md`'s note that
        `Therapist` is "keyed by Workspace email, the identity IAP asserts"). IAP now gates *who
        can reach the app at all* — it doesn't yet make the app therapist-aware per real identity;
        everyone who gets through still operates as the single seeded dev therapist. Worth its
        own pass.
- [x] `terraform apply` run against the real dev project. Hit and fixed one more real bug along
      the way: `roles/iap.httpsResourceAccessor` lives on IAP's *own* IAM policy for the protected
      resource, not Cloud Run's — `google_cloud_run_v2_service_iam_member` rejected it outright
      ("Role roles/iap.httpsResourceAccessor is not supported for this resource"). Fixed with the
      dedicated `google_iap_web_cloud_run_service_iam_member` resource (also `google-beta` only,
      same as `iap_enabled` itself). New redirect URI added to the OAuth client in Console.
- [x] **Found while trying to actually test the deployed app: it couldn't have worked at all.**
      The 3 Cloud Run services had zero environment configuration — no `DATABASE_URL`, no GCS
      bucket names, no LLM provider, no Gmail OAuth credentials, nothing (only `image` was set).
      This predates today — item 6's original verification only checked containers *boot* and
      pass health checks, never real functional behavior. Also found: the `web`/`api`/`worker`
      service accounts had **zero** project-level IAM grants at all (no Cloud SQL, Secret Manager,
      Storage, Pub/Sub, Vertex AI, or BigQuery access), and Pub/Sub could never have successfully
      pushed to the deployed `worker` — nothing granted the worker's own identity `roles/run.invoker`
      on itself, which OIDC-authenticated push subscriptions require since the service isn't public.
      Fixed all of it:
      - `infra/terraform/modules/data`: new `google_sql_user` + `random_password`, DB password
        never touches Postgres directly — assembled into a full `DATABASE_URL` and stored as a
        `google_secret_manager_secret` (Direct VPC Egress + private IP, so this is a plain
        `postgresql://` URL against the instance's private IP, not the Auth Proxy/`connection_name`
        pattern)
      - `infra/terraform/modules/iam`: new grants for `api` (`secretmanager.admin` project-wide —
        needed since `SecretManagerTokenStore` creates secrets on demand, not a fixed set;
        `pubsub.publisher`; `aiplatform.user`; `storage.objectAdmin` on both buckets) and `worker`
        (`secretmanager.secretAccessor`; `aiplatform.user`; `bigquery.dataEditor`;
        `storage.objectAdmin` on both buckets)
      - `infra/terraform/modules/compute`: full `env`/secret wiring on `api` and `worker`
        (`DATABASE_URL`, bucket names, `LLM_PROVIDER=gemini`, Pub/Sub topic names, Gmail OAuth
        client id/secret, a `random_password`-generated `OAUTH_STATE_SECRET`,
        `TOKEN_STORE_PROVIDER=secret-manager` — **critical**, since Cloud Run's filesystem doesn't
        persist across revisions/instances, `local` would silently lose every therapist's Gmail
        connection — `WEB_APP_URL`); the worker `run.invoker`-on-itself binding; `web` needs no
        runtime env vars (`NEXT_PUBLIC_API_URL` is already build-time only)
      - New `gmail_oauth_client_id`/`_client_secret`/`_redirect_uri` tfvars (same OAuth client
        already created for local dev — just add the deployed API's `/gmail/callback` as a second
        Authorized redirect URI on it). `GMAIL_OAUTH_REDIRECT_URI` can't be derived from
        `google_cloud_run_v2_service.api.uri` (a resource can't reference its own computed output)
        so it's supplied directly — you already have it from `terraform output api_url`
      - `terraform validate` clean; a real `terraform plan` against the actual dev project reviewed
        in full — 20 to add, 3 to change (the 3 services picking up their new `env` blocks), all
        exactly as designed, no surprises
      - **Known limitation carried forward, not new**: `TEXT_EXTRACTOR=plain` for the deployed
        worker too (no Document AI processor provisioned) — real PDF uploads get UTF-8-decoded
        garbage text in the deployed env, same as local dev
- [x] `terraform apply` run, `deploy.yml` re-triggered (real images with items 4/5's features now
      on Cloud Run), schema pushed onto the real Cloud SQL instance via a one-off
      `gcloud run jobs execute` (no public IP — nothing outside the VPC can reach it any other
      way; the job ran `prisma db push` using the already-built `worker` image, then was deleted),
      dev therapist seeded the same way.
- [x] **Real end-to-end browser test against the deployed app — done.** Signed in via IAP as a
      real Workspace user, connected Gmail through the real OAuth consent screen, uploaded a real
      document, uploaded a real transcript, got a recommendation, finalized a draft. The mechanism
      works end to end. Three real gaps surfaced by actually using it for real, all tracked below:
      document/transcript deletion is missing entirely (item 9), the Gmail draft doesn't attach
      the actual file (item 5's note), and real PDF text extraction is producing garbage the LLM
      itself flags as unreadable (item 1's note) — this last one is the "known limitation carried
      forward" above, now with concrete evidence instead of a theoretical caveat.

## 7. Compliance (not code, but blocking for real patient data)

- [ ] Execute the GCP BAA covering every service in `docs/hipaa-compliance.md`. Tracked in
      [#4](https://github.com/lwiggins3/therapy-docs/issues/4).
- [ ] Execute the separate Google Workspace BAA (IAP SSO + Gmail API — see the documented
      exception in `docs/hipaa-compliance.md`). Tracked in
      [#5](https://github.com/lwiggins3/therapy-docs/issues/5).

## 8. Folder upload (feature request)

- [ ] `apps/web`'s upload form should accept a folder, not just individual files — recursively
      walking all nested subfolders and documents inside it and uploading each one through the
      existing per-document pipeline (item 1). Tracked in
      [#6](https://github.com/lwiggins3/therapy-docs/issues/6).

## 9. Delete documents and transcripts (feature request)

Found missing during the real end-to-end browser test (item 6) — there's currently no way to
remove a library document or a transcript once uploaded, from the UI or the API. Tracked in
[#7](https://github.com/lwiggins3/therapy-docs/issues/7).

- [ ] `apps/api`: `DELETE /documents/:id` (remove the `LibraryDocument` row + its
      `DocumentTagAssignment`/`Recommendation`/`EmailDraftDocument` references, and the underlying
      GCS object via `StorageClient`) and `DELETE /transcripts/:id` (same, for `Transcript` +
      its `Recommendation`/`EmailDraft` references) — both scoped to the calling therapist,
      mirroring the ownership checks already used in `updateTags`/`EmailDraftsService.finalize`
- [ ] `apps/web`: a delete action on `/documents` (per document row) and `/transcripts` (per
      transcript row), with a confirmation step before removing

## 10. Tag suggestion feedback loop (feature request)

The system is currently stateless with respect to tag review outcomes. Reject just
`db.documentTagAssignment.delete()`s the row — nothing records that a tag was suggested-and-
rejected, for this document or in general. Manual add's only downstream effect is that the new
label joins the global `existingTags` vocabulary list passed into every future `suggestTags()`
prompt (`buildSuggestTagsPrompt`'s "prefer reusing one of these over inventing a near-duplicate")
— a shared vocabulary hint, not a learning signal; it doesn't tell the model *which documents*
warrant *which* tags. Confirm just flips `confirmed: true`, with no feedback to the LLM at all.
Net effect: ten rejections of the same bad suggestion on similar documents would produce the same
suggestion an eleventh time.

- [ ] Include a handful of recent accept/reject decisions as few-shot examples in the
      `suggestTags` prompt (`packages/llm-client/src/suggest-tags.ts`) — no fine-tuning
      infrastructure needed, just richer prompt context. Needs a query for "recent confirmed vs.
      rejected `DocumentTagAssignment` rows" that doesn't exist yet. Tradeoff: prompt size/cost
      grows with example count — needs a sensible cap. Tracked in
      [#8](https://github.com/lwiggins3/therapy-docs/issues/8).

## 11. Style the application (feature request)

`apps/web` currently has zero design system — plain semantic HTML (`<main>`, `<ul>`, `<form>`),
no CSS framework/component library, only scattered inline `style={{}}` in a couple of spots. Fine
for a functional prototype, not for something a therapist would actually want to use day to day.

- [ ] Add real visual styling/branding across all of `apps/web`'s pages (`/documents`,
      `/transcripts`, `/patients`, `/settings`, upload/review screens) — a consistent layout,
      typography, color palette, and basic component styling (buttons, forms, status badges,
      nav). Needs a design-approach decision (Tailwind, CSS modules, a component library, etc.)
      before implementation. Tracked in
      [#9](https://github.com/lwiggins3/therapy-docs/issues/9).
