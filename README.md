# therapy-docs

A mono-repo that helps therapists recommend post-session aids (handouts, worksheets, psychoeducation
materials) to their patients. Therapists curate a tagged document library, upload session transcripts,
and get LLM-generated document recommendations they review and approve before a draft follow-up email
is prepared (never sent automatically).

Runs entirely on Google Cloud Platform so every service touching patient data can be enumerated for a
HIPAA Business Associate Agreement (BAA). See [`docs/hipaa-compliance.md`](docs/hipaa-compliance.md).

## What it does

1. **Document library** — upload documents, tag them manually or let an LLM suggest tags for review.
2. **Transcript → recommendation** — upload a session transcript; an LLM recommends library documents,
   and every recommendation is tied to the patient and transcript it came from.
3. **Therapist review → draft email** — accept/reject each suggestion, add your own, then generate a
   draft patient email as a Gmail draft for the therapist to review and send themselves.
4. **Audit trail** — every access to transcript content (view, LLM processing, export) is logged.

## Repo layout

| Path | Purpose |
|---|---|
| `apps/web` | Next.js therapist-facing UI, deployed behind Identity-Aware Proxy (IAP) |
| `apps/api` | NestJS backend — REST endpoints, Pub/Sub publishing, audit writes |
| `apps/worker` | Pub/Sub-triggered background pipelines (OCR, embeddings, tag suggestion, recommendations) |
| `packages/db` | Prisma schema/client for Cloud SQL (PostgreSQL + pgvector) |
| `packages/llm-client` | Provider-agnostic LLM interface (Claude-on-Vertex + Gemini adapters) |
| `packages/storage` | Provider-agnostic file storage (GCS + local-disk adapters) |
| `packages/shared-types` | Shared Zod schemas / DTOs used across apps |
| `packages/audit` | Typed audit-event emitter (Postgres + BigQuery sink) |
| `packages/config` | Shared tsconfig/eslint/prettier base configs |
| `infra/terraform` | GCP infrastructure as code |
| `docs/` | Architecture, data model, and HIPAA/BAA service inventory |

## Prerequisites

- Node.js >= 20
- [pnpm](https://pnpm.io/) 9.x (`npm install -g pnpm`)
- [gcloud CLI](https://cloud.google.com/sdk/docs/install), authenticated to the target GCP project
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.7
- Docker (for local Postgres with pgvector, and the Pub/Sub emulator)

## Local development

```bash
pnpm install
cp .env.example .env
# Edit .env: set LOCAL_STORAGE_DIR to an ABSOLUTE path (e.g. this repo's .local-storage) —
# apps/api and apps/worker run from different directories, so a relative path would resolve
# to two different folders and the worker could never find files the API wrote.

docker compose up -d                          # local Postgres (pgvector) + Pub/Sub emulator
pnpm --filter @therapy-docs/db db:push         # sync the schema into that database
pnpm --filter @therapy-docs/db seed            # create the dev Therapist (see below)
pnpm --filter @therapy-docs/api pubsub:setup   # one-time: create the document-ingest topic + push subscription
pnpm dev                                       # runs web, api, and worker in parallel via Turborepo
```

There's a single `.env` at the repo root — `.env.example` lists every variable the *whole*
system eventually needs (GCP project, GCS, Vertex AI, Pub/Sub, Gmail, BigQuery), but not all of
it is read yet (see each app's README for what actually matters to it). Scripts in
`packages/db`, `apps/api`, `apps/worker`, and `apps/web` load the root `.env` explicitly via
[`dotenv-cli`](https://github.com/entropitor/dotenv-cli) (e.g. `dotenv -e ../../.env --`) since
Prisma/Nest/tsx/Next.js only auto-load a `.env` from their *own* directory, not the repo root.

- `apps/web` → http://localhost:3000 (document library at `/documents`)
- `apps/api` → http://localhost:8080/healthz
- `apps/worker` → http://localhost:8081/healthz

Run a single app: `pnpm --filter web dev`, `pnpm --filter api dev`, etc.

There's no real identity yet (IAP isn't wired up — roadmap item 2): `apps/api`'s
`GET /dev/therapist` endpoint hands back a seeded dev therapist's id (from
`packages/db/prisma/seed.ts`), which `apps/web` sends as `x-therapist-id` on every request.

## What's actually testable right now

- **Document upload → tagging pipeline** (roadmap item 1) is implemented and works end to end
  locally: upload a document through `apps/web` (`/documents/upload`), it's stored via
  `@therapy-docs/storage`, `apps/api` publishes to the real Pub/Sub emulator, the emulator
  **push-delivers** the message to `apps/worker`, which downloads the file, extracts text, and
  attempts to embed/tag it. Manual tagging (add/confirm/reject) works fully offline. The one
  piece that needs real GCP credentials is the actual Vertex AI call
  (`suggestTags`/`embed` in `@therapy-docs/llm-client`) — without it, a document correctly ends
  up `failed` rather than hanging, which you can watch happen locally.
- **Everything builds/lints/typechecks**: `pnpm turbo run build lint typecheck`
- **Worker pipeline tests**: `pnpm --filter @therapy-docs/worker test` — exercises the full
  `document-ingest` orchestration (extract → embed → suggest tags → persist → status
  transitions, plus the failure path) against local/stub adapters, no GCP credentials needed
- **The data model is real**: `pnpm --filter @therapy-docs/db db:push` creates every table in
  `packages/db/prisma/schema.prisma` (11 tables + the `pgvector` extension) against the Docker
  Postgres

What you *can't* test locally yet (needs real GCP credentials): the actual Vertex AI responses
for tag suggestion/embeddings/recommendations/email drafting, Document AI OCR (only `.txt`/`.md`
work locally via `TEXT_EXTRACTOR=plain`), Gmail draft creation, and IAP-gated auth.

## Further reading

- [`docs/architecture.md`](docs/architecture.md) — the three core pipelines, end to end
- [`docs/data-model.md`](docs/data-model.md) — core entities and relationships
- [`docs/hipaa-compliance.md`](docs/hipaa-compliance.md) — GCP service inventory for the BAA, and the
  documented Google Workspace exception for identity + draft email
- [`docs/roadmap.md`](docs/roadmap.md) — what's left, in priority order
