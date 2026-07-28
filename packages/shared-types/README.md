# @therapy-docs/shared-types

Zod schemas and inferred TypeScript types for the domain entities shared across `apps/web`,
`apps/api`, and `apps/worker` — library documents, transcripts, recommendations, email drafts,
audit events, and the Pub/Sub message payloads that connect `api` and `worker`.

These mirror the Prisma models in `packages/db/prisma/schema.prisma` (see
[`docs/data-model.md`](../../docs/data-model.md) for the full entity relationship picture) and
are the source of truth for tRPC input/output types and Pub/Sub payload validation — parse
untrusted input (uploads, Pub/Sub messages) through the relevant `*Schema` before trusting it.

## Key files

- `src/index.ts` — all schemas/types. Split into multiple files if this grows unwieldy.
