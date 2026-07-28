# @therapy-docs/llm-client

Provider-agnostic LLM interface used for tag suggestion, transcript embeddings, document
recommendation, and email drafting. All model calls run through Vertex AI so they stay inside
the GCP project boundary (required for the BAA — see
[`docs/hipaa-compliance.md`](../../docs/hipaa-compliance.md)).

## Key files

- `src/types.ts` — the `LlmClient` interface every adapter implements: `suggestTags`, `embed`,
  `recommendDocuments`, `draftEmail`.
- `src/suggest-tags.ts` — shared prompt template + response parser for `suggestTags()`, used by
  both adapters so the wording/parsing only lives in one place.
- `src/vertex-embedding.ts` — shared Vertex AI embedding call (`gemini-embedding-001`,
  `outputDimensionality: 1536` to match `packages/db`'s `vector(1536)` columns). Both adapters'
  `embed()` delegate here — Claude has no embeddings endpoint of its own.
- `src/adapters/claude-vertex.ts` — Claude via Vertex AI Model Garden.
- `src/adapters/gemini.ts` — native Gemini on Vertex AI.
- `src/index.ts` — `createLlmClient({ provider, projectId, location })` factory. Callers
  (`apps/api`, `apps/worker`) depend only on `LlmClient`, never on a specific adapter.

## Adding a new task

Add the method to `LlmClient` in `src/types.ts`, then implement it in both adapters (or throw a
clear "not supported by this provider" error if a task is inherently provider-specific).

## Status

`suggestTags()` and `embed()` are implemented for both adapters, written to the documented Vertex
AI/Anthropic API shapes — but **not verified against a live model**, since there are no GCP
credentials in the environment this was built in. Smoke-test both once real Vertex AI access
exists (see `docs/roadmap.md` item 2) before trusting the output. `recommendDocuments()` and
`draftEmail()` are still stubbed (roadmap items 4/5).
