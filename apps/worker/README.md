# @therapy-docs/worker

Background pipeline service, triggered via Pub/Sub push subscriptions. Kept separate from
`apps/api` so long-running OCR/embedding/LLM work never blocks request/response latency or
shares that service's scaling profile.

## Endpoints

- `POST /pubsub/document-ingest` — triggered when a document is uploaded to the library.
  Extracts text, embeds it, suggests tags. See `src/pipelines/document-ingest.ts`.
- `POST /pubsub/transcript-ingest` — triggered when a session transcript is uploaded. Extracts
  text, embeds it, pre-filters candidate documents by similarity, then asks the LLM to rank and
  justify a shortlist as `Recommendation` rows. See `src/pipelines/transcript-ingest.ts`.
- `GET /healthz` — liveness check.

Both Pub/Sub handlers expect the standard push-subscription envelope (`{ message: { data:
<base64> } }`) and return non-2xx on failure so Pub/Sub retries per the subscription's retry
policy.

## Status

- `document-ingest` (roadmap item 1): implemented — see `src/pipelines/document-ingest.ts` and
  its test (`document-ingest.test.ts`, run with `pnpm --filter @therapy-docs/worker test`).
  Dependencies (`StorageClient`, `TextExtractor`, `LlmClient`) are injected, so the test exercises
  the full orchestration with local/stub adapters — no GCP credentials needed. The real
  `suggestTags`/`embed` calls (via `@therapy-docs/llm-client`) are unverified against a live
  model — see that package's README.
- `transcript-ingest` (roadmap item 4): still a stub.

## Known local-dev quirk

Vertex AI SDK clients (observed: `@anthropic-ai/vertex-sdk`'s `AnthropicVertex`) can kick off a
background Application Default Credentials lookup at construction time, detached from the
constructor's return — without real credentials, this surfaces as an *unhandled promise
rejection* that no try/catch around the constructor can catch, and would otherwise crash the
whole process. `src/main.ts` installs a `process.on("unhandledRejection", ...)` handler so the
server stays up regardless (marking whichever document was in flight as `failed`, best-effort).
This never happens against real Vertex AI credentials in production.

## Build

Bundled with esbuild (`build.mjs`), not plain `tsc` — same reason as `apps/api`'s webpack build
(see that README): `@therapy-docs/*` workspace packages ship TS source with no build step, which
plain `node dist/main.js` can't resolve at runtime. `build.mjs`'s esbuild plugin bundles anything
under `@therapy-docs/*` while leaving every real npm dependency external (native
bindings/dynamic requires — Prisma, Google Cloud clients — need to stay untouched).

## Local dev

```bash
pnpm --filter @therapy-docs/worker dev
pnpm --filter @therapy-docs/worker test   # runs document-ingest.test.ts against local Postgres
```

Requires `DATABASE_URL` (local Postgres with pgvector) and `LOCAL_STORAGE_DIR` set to an
**absolute** path shared with `apps/api` (see root README). To exercise a handler without the
Pub/Sub emulator, POST a base64-encoded JSON payload matching
`PubSubDocumentIngestMessageSchema`/`PubSubTranscriptIngestMessageSchema` from
`@therapy-docs/shared-types` directly to the endpoint, wrapped in `{ message: { data: <base64> } }`.
