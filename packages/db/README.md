# @therapy-docs/db

Prisma schema and client for the primary datastore: Cloud SQL for PostgreSQL with the
`pgvector` extension for document/transcript embeddings.

Single source of truth for the data model — see [`docs/data-model.md`](../../docs/data-model.md)
for the narrative version of these entities and their relationships.

## Key files

- `prisma/schema.prisma` — all models: `Therapist`, `Patient`, `LibraryDocument`, `Tag`,
  `DocumentTagAssignment`, `Transcript`, `Recommendation`, `EmailDraft`, `AuditEvent`.
- `src/index.ts` — exports a shared `db` (`PrismaClient`) singleton; import this from
  `apps/api`/`apps/worker` rather than constructing a new client per app.
- `prisma/seed.ts` — seeds one dev `Therapist` (`dev@example.com`), idempotent. There's no real
  identity/signup flow yet (IAP isn't wired — roadmap item 2), so `apps/api`'s `/dev/therapist`
  endpoint hands this seeded id to `apps/web` as a temporary stand-in for logged-in identity.

## Notes

- `embedding` columns are typed `Unsupported("vector(1536)")` since Prisma has no first-class
  pgvector type. Raw SQL migrations are needed to add `ivfflat`/`hnsw` indexes and to write/query
  the vector columns (see Prisma's `$queryRaw` / `$executeRaw`).
- `AuditEvent` is insert-only by convention — always write through `@therapy-docs/audit`, never
  `db.auditEvent.update()`/`.delete()`.
- 1536 dimensions assumes a specific embedding model; adjust to match whichever Vertex AI
  embedding model `packages/llm-client` is configured to use.

## Local dev

```bash
pnpm --filter @therapy-docs/db generate  # regenerate the Prisma client after schema changes
pnpm --filter @therapy-docs/db db:push   # sync the schema straight to your local Postgres (no migration file)
pnpm --filter @therapy-docs/db seed      # create the dev Therapist row
```

`db:push` is the fast path for local iteration — it diffs `schema.prisma` against the database
and applies the change directly, no migration history involved. Use it against the Docker
Postgres from the root README for day-to-day local dev.

To create a real, committed migration (needed before this schema reaches a shared/deployed
database), run `pnpm --filter @therapy-docs/db migrate:dev` yourself in an interactive terminal —
it prompts for a migration name and provisions a temporary shadow database to compute the diff,
so it needs a real TTY and will hang if run non-interactively (e.g. piped, or from a script).
