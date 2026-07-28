# @therapy-docs/web

Next.js (App Router) therapist-facing UI. Deployed to Cloud Run behind Identity-Aware Proxy
(IAP), so every request is already authenticated against the practice's Google Workspace /
Cloud Identity before it reaches this app — there is no separate login page to build.

## Screens

- **Document library** (`/documents`) — lists uploaded documents with status and tags;
  confirm/reject LLM-suggested tags, add manual ones. Done (roadmap item 1).
- **Upload** (`/documents/upload`) — upload a document (title + file). Done (roadmap item 1).
- **Patients & transcripts** (planned) — upload a session transcript for a patient, see
  processing status.
- **Recommendations** (planned) — per-transcript list of suggested documents with accept/reject
  controls and a way to add documents the LLM didn't suggest; "finalize" triggers draft-email
  creation.
- **Audit view** (planned) — who accessed a given transcript, for therapist/compliance visibility.

## Talks to

- `apps/api` via plain REST (`fetch` calls in `src/lib/api.ts` and the page components) — not
  tRPC yet, see `apps/api/README.md` for why. Requires `NEXT_PUBLIC_API_URL` (see root
  `.env.example`).
- No real auth yet: every request sends `x-therapist-id`, fetched once from `apps/api`'s
  `/dev/therapist` endpoint. Temporary — see `packages/db/prisma/seed.ts` and
  `docs/roadmap.md` item 2.

## Local dev

```bash
pnpm --filter @therapy-docs/web dev
```

Requires `apps/api` (and, to see documents actually finish processing, `apps/worker` +
Postgres + the Pub/Sub emulator) running locally too — see the root README's local dev section.
