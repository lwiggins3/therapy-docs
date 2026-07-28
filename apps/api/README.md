# @therapy-docs/api

NestJS backend. Owns all business logic: document/tag management, transcript intake
coordination, recommendation review, and Gmail draft creation. Deployed to Cloud Run behind
Identity-Aware Proxy (IAP), same as `apps/web`.

## Responsibilities

- Publishes Pub/Sub messages to kick off `apps/worker` pipelines (document ingest, transcript
  ingest) rather than doing OCR/embedding/LLM work inline in the request path — see
  `src/lib/pubsub.ts` and `src/scripts/setup-pubsub.ts`.
- Orchestrates `@therapy-docs/llm-client` for the parts of the review flow that happen
  synchronously with a therapist action (e.g. drafting the follow-up email once documents are
  finalized) — not yet implemented (roadmap item 5).
- Creates the Gmail draft (via a therapist's own `gmail.compose`-scoped OAuth token) — draft
  only, never sends. Not yet implemented (roadmap item 5).
- Writes every transcript access through `@therapy-docs/audit`. Not yet wired up — no
  `TranscriptsModule` exists yet (roadmap item 4).

## Modules

- **`DocumentsModule`** (`src/documents/`) — done (roadmap item 1). `POST /documents` (multipart
  upload → `@therapy-docs/storage` → creates a `LibraryDocument` row → publishes to
  `document-ingest`), `GET /documents` (list with tags), `PATCH /documents/:id/tags`
  (confirm/reject LLM suggestions, add manual tags), `GET /tags`.
- **`DevController`** (`src/dev/`) — `GET /dev/therapist` returns the seeded dev therapist's id.
  Temporary stand-in for real identity until IAP is wired up (roadmap item 2) — delete this
  whole thing once that lands.
- Planned: `TranscriptsModule`, `RecommendationsModule`, `EmailDraftsModule`.

REST, not tRPC, despite the original architecture note — file upload doesn't map cleanly onto
tRPC anyway (even tRPC apps typically use a REST escape hatch for uploads), and wiring tRPC's
Nest adapter is orthogonal, deferred work rather than a blocker for shipping features.

## Build

Uses NestJS's **webpack** build mode (`nest-cli.json` → `webpack.config.js`), not the default
plain-`tsc` build. `@therapy-docs/*` workspace packages ship TypeScript source with no build
step of their own (`package.json` "main" points at `src/index.ts`) — fine for Next.js/Vitest/tsx,
which do their own resolution, but plain `tsc` + `node dist/main.js` can't resolve multi-file
workspace packages at runtime. Nest's webpack mode (`ts-loader`, so `emitDecoratorMetadata`/DI
still works) bundles them in; every real npm dependency stays external via
`webpack-node-externals`'s `allowlist` option in `webpack.config.js`.

## Local dev

```bash
pnpm --filter @therapy-docs/api dev
pnpm --filter @therapy-docs/api pubsub:setup   # one-time: creates the document-ingest topic + push subscription
```

Requires `DATABASE_URL` pointing at a local Postgres with pgvector, the Pub/Sub emulator running
(`docker compose up -d`), and `LOCAL_STORAGE_DIR` set to an **absolute** path (see root README —
apps/api and apps/worker run from different directories). For anything touching Vertex AI,
`gcloud auth application-default login` against a project with the Vertex AI API enabled.
