# Architecture

Three services (`apps/web`, `apps/api`, `apps/worker`), one Postgres database, and Vertex AI for
every LLM call. This document walks through the three core pipelines end to end.

```
                     ┌──────────────┐
   Therapist  ──IAP──▶   apps/web   │  Next.js UI
                     └──────┬───────┘
                            │ tRPC
                     ┌──────▼───────┐        ┌──────────────┐
                     │   apps/api   │──Pub/Sub▶  apps/worker  │
                     │   (NestJS)   │        │ (ingestion &  │
                     └──────┬───────┘        │ recommendation)│
                            │                └───────┬────────┘
                     ┌──────▼───────────────────────▼────────┐
                     │   Cloud SQL (Postgres + pgvector)      │
                     └─────────────────────────────────────────┘
                            │                        │
                     ┌──────▼──────┐          ┌──────▼──────┐
                     │  Vertex AI  │          │     GCS     │
                     │(Claude/Gemini)│         │ (documents, │
                     └─────────────┘          │ transcripts)│
                                               └─────────────┘
```

## 1. Document library ingestion (requirement a)

1. Therapist uploads one or more documents in `apps/web`.
2. `apps/api` stores the file in the GCS `documents` bucket, creates a `LibraryDocument` row
   (`status: processing`), and publishes a message to the `document-ingest` Pub/Sub topic.
3. `apps/worker`'s `document-ingest` pipeline (`src/pipelines/document-ingest.ts`):
   - Extracts text (Document AI for scans/PDFs).
   - Generates an embedding via `packages/llm-client` and stores it on the row.
   - Calls `llmClient.suggestTags(...)`, persisting suggestions as unconfirmed
     `DocumentTagAssignment` rows (`source: llm_suggested`).
   - Sets `status: ready`.
4. Therapist reviews suggested tags alongside manually-added ones in `apps/web` and
   confirms/edits them — tagging is always therapist-controlled, the LLM only suggests.

## 2. Transcript → recommendation (requirement b)

1. Therapist uploads a session transcript for a specific patient.
2. `apps/api` stores it in the GCS `transcripts` bucket, creates a `Transcript` row
   (`status: processing`), and publishes to `transcript-ingest`.
3. `apps/worker`'s `transcript-ingest` pipeline (`src/pipelines/transcript-ingest.ts`):
   - Extracts text, logging a `transcript.llm_process` audit event before any LLM call.
   - Generates an embedding, pgvector-searches `LibraryDocument` for the top-N candidates by
     similarity (a cheap pre-filter before the more expensive LLM call).
   - Calls `llmClient.recommendDocuments(...)` with the transcript text and candidate summaries;
     the LLM ranks/justifies a shortlist.
   - Inserts `Recommendation` rows (`status: suggested`), each linked to the transcript,
     patient, and document — this is how "which documents were recommended to which patient" is
     tracked per requirement (b).

## 3. Therapist review → draft email (requirement c)

1. `apps/web` shows the suggested `Recommendation` rows for a transcript. The therapist accepts
   or rejects each individually and can add documents the LLM didn't suggest (inserted as
   `Recommendation` rows with `status: added_by_therapist`).
2. Once finalized, `apps/api` calls `llmClient.draftEmail(...)` with the approved document list,
   then creates a Gmail draft (via the therapist's own `gmail.compose`-scoped OAuth token) in
   their mailbox — **never sent programmatically**. An `EmailDraft` row records which documents
   went into it.
3. The therapist reviews the draft in their own Gmail and sends it themselves.

## Cross-cutting: audit logging (requirement e)

Any code path that reads transcript content — therapist viewing it in `apps/web`, the worker
pipeline extracting/embedding it, or handing it to an LLM — calls `packages/audit`'s
`AuditLogger.record(...)`. See `docs/hipaa-compliance.md` for the retention/compliance rationale
and `packages/audit/README.md` for the exact call sites required.
