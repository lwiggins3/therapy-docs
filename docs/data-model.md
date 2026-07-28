# Data Model

Narrative companion to `packages/db/prisma/schema.prisma` — the schema file is the source of
truth; this describes the entities and why they're shaped this way.

## Entities

- **Therapist** — one row per clinician, keyed by Workspace email (the identity IAP asserts).
- **Patient** — belongs to a therapist. Deliberately minimal: a display name/identifier and an
  optional external MRN reference, no other demographic data — see the data-minimization note in
  `docs/hipaa-compliance.md`.
- **LibraryDocument** — an uploaded aid (handout, worksheet, etc.), with a `status`
  (`processing`/`ready`/`failed`), a GCS URI for the raw file, and a `pgvector` embedding column
  used for similarity search against transcripts.
- **Tag** — a free-text label, globally unique per therapist's practice (single-tenant for v1).
- **DocumentTagAssignment** — join table between documents and tags, carrying `source`
  (`manual` vs `llm_suggested`) and `confirmed` — LLM-suggested tags start unconfirmed and only
  count as "real" tags once a therapist confirms them.
- **Transcript** — an uploaded session transcript, scoped to a patient and therapist, with its
  own embedding column for recommendation matching.
- **Recommendation** — the link between a transcript and a candidate document, with a `status`
  (`suggested` → `accepted`/`rejected`, or `added_by_therapist` for documents the therapist added
  manually) and an optional `rationale` (the LLM's justification, shown to the therapist). This
  table is how "which documents were recommended to which patient" (requirement b) is tracked.
- **EmailDraft** — records that a draft was created for a patient/transcript, which documents it
  included, and the Gmail draft ID — never a "sent" flag, since this system never sends email.
- **AuditEvent** — insert-only log of every access to transcript/document content. See
  `packages/audit/README.md`.

## Relationships (high level)

```
Therapist 1──* Patient 1──* Transcript 1──* Recommendation *──1 LibraryDocument
                                │                                    │
                                └──────────* EmailDraft *─────────────┘
                                                                      │
                                              LibraryDocument *──* Tag
                                              (via DocumentTagAssignment)
```

## Why pgvector on Cloud SQL rather than a separate vector database

Document and transcript volume for a single practice is modest — pgvector on the existing
Postgres instance avoids standing up a second data store (e.g. Vertex AI Vector Search) purely
for similarity search. Revisit if/when multi-tenant scale (see the tenancy decision in the
original plan) makes a dedicated vector store worth the added operational surface.
