import express from "express";
import { AuditLogger } from "@therapy-docs/audit";
import { db } from "@therapy-docs/db";
import { createLlmClient, type LlmProvider } from "@therapy-docs/llm-client";
import {
  PubSubDocumentIngestMessageSchema,
  PubSubTranscriptIngestMessageSchema,
} from "@therapy-docs/shared-types";
import { createStorageClient, type StorageProvider } from "@therapy-docs/storage";
import { createTextExtractor, type TextExtractorProvider } from "./lib/text-extraction";
import { handleDocumentIngest, type DocumentIngestDeps } from "./pipelines/document-ingest";
import { handleTranscriptIngest, type TranscriptIngestDeps } from "./pipelines/transcript-ingest";

/**
 * Some Vertex AI SDK clients (observed: @anthropic-ai/vertex-sdk's AnthropicVertex) kick off a
 * background Application Default Credentials lookup as soon as they're constructed, detached
 * from the constructor's own return — if that lookup fails (no credentials configured, the
 * expected state until roadmap item 2 lands), it surfaces as an *unhandled rejection* no
 * try/catch around the constructor call can catch, and Node crashes the whole process by
 * default. A real Cloud Run deployment (with real credentials) never hits this; locally, this
 * keeps the worker itself alive so unrelated requests keep working — the specific document
 * being processed when this fires is marked "failed" on a best-effort basis below.
 */
let inFlightDocumentId: string | undefined;
let inFlightTranscriptId: string | undefined;
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (worker staying alive):", reason);
  if (inFlightDocumentId) {
    db.libraryDocument
      .update({ where: { id: inFlightDocumentId }, data: { status: "failed" } })
      .catch(() => {
        // best-effort — if this also fails the document just stays "processing"
      });
  }
  if (inFlightTranscriptId) {
    db.transcript
      .update({ where: { id: inFlightTranscriptId }, data: { status: "failed" } })
      .catch(() => {
        // best-effort — if this also fails the transcript just stays "processing"
      });
  }
});

let documentIngestDeps: DocumentIngestDeps | undefined;

/**
 * Constructed lazily, on first use, rather than at module load: the Vertex AI SDK clients try
 * to resolve Google Application Default Credentials as soon as they're constructed, which
 * throws (as an unhandled rejection, crashing the process) if none are configured — a real
 * local-dev scenario until roadmap item 2 lands. Deferring construction to request time means
 * the server itself stays up regardless; only requests that actually need the LLM client fail,
 * caught by the try/catch below like any other pipeline error.
 */
function getDocumentIngestDeps(): DocumentIngestDeps {
  documentIngestDeps ??= {
    storage: createStorageClient({
      provider: (process.env.STORAGE_PROVIDER as StorageProvider) ?? "local",
      bucket: process.env.GCS_DOCUMENTS_BUCKET,
      localDir: process.env.LOCAL_STORAGE_DIR,
    }),
    textExtractor: createTextExtractor({
      provider: (process.env.TEXT_EXTRACTOR as TextExtractorProvider) ?? "plain",
      projectId: process.env.GCP_PROJECT_ID,
      location: process.env.GCP_REGION,
      processorId: process.env.DOCUMENT_AI_PROCESSOR_ID,
    }),
    llmClient: createLlmClient({
      provider: (process.env.LLM_PROVIDER as LlmProvider) ?? "claude-vertex",
      projectId: process.env.VERTEX_AI_PROJECT ?? process.env.GCP_PROJECT_ID ?? "",
      location: process.env.VERTEX_AI_LOCATION ?? "us-central1",
      // The embedding model needs a real single region, unlike Claude's "us" multi-region above.
      embeddingLocation: process.env.GCP_REGION ?? "us-central1",
      model: process.env.LLM_MODEL || undefined,
    }),
  };
  return documentIngestDeps;
}

let transcriptIngestDeps: TranscriptIngestDeps | undefined;

/** Same lazy-construction rationale as getDocumentIngestDeps above. */
function getTranscriptIngestDeps(): TranscriptIngestDeps {
  transcriptIngestDeps ??= {
    storage: createStorageClient({
      provider: (process.env.STORAGE_PROVIDER as StorageProvider) ?? "local",
      bucket: process.env.GCS_TRANSCRIPTS_BUCKET,
      localDir: process.env.LOCAL_STORAGE_DIR,
    }),
    textExtractor: createTextExtractor({
      provider: (process.env.TEXT_EXTRACTOR as TextExtractorProvider) ?? "plain",
      projectId: process.env.GCP_PROJECT_ID,
      location: process.env.GCP_REGION,
      processorId: process.env.DOCUMENT_AI_PROCESSOR_ID,
    }),
    llmClient: createLlmClient({
      provider: (process.env.LLM_PROVIDER as LlmProvider) ?? "claude-vertex",
      projectId: process.env.VERTEX_AI_PROJECT ?? process.env.GCP_PROJECT_ID ?? "",
      location: process.env.VERTEX_AI_LOCATION ?? "us-central1",
      // The embedding model needs a real single region, unlike Claude's "us" multi-region above.
      embeddingLocation: process.env.GCP_REGION ?? "us-central1",
      model: process.env.LLM_MODEL || undefined,
    }),
    auditLogger: new AuditLogger({ bigqueryDataset: process.env.BIGQUERY_AUDIT_DATASET ?? "audit_logs" }),
  };
  return transcriptIngestDeps;
}

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

/** Decodes a Pub/Sub push subscription envelope: { message: { data: base64 } }. */
function decodePubSubMessage(body: unknown): unknown {
  const message = (body as { message?: { data?: string } })?.message;
  if (!message?.data) {
    throw new Error("Malformed Pub/Sub push envelope: missing message.data");
  }
  return JSON.parse(Buffer.from(message.data, "base64").toString("utf-8"));
}

app.post("/pubsub/document-ingest", async (req, res) => {
  try {
    const payload = PubSubDocumentIngestMessageSchema.parse(decodePubSubMessage(req.body));
    inFlightDocumentId = payload.documentId;
    await handleDocumentIngest(payload, getDocumentIngestDeps());
    res.status(204).send();
  } catch (err) {
    // Non-2xx tells Pub/Sub to retry per the subscription's retry policy.
    res.status(500).json({ error: (err as Error).message });
  } finally {
    inFlightDocumentId = undefined;
  }
});

app.post("/pubsub/transcript-ingest", async (req, res) => {
  try {
    const payload = PubSubTranscriptIngestMessageSchema.parse(decodePubSubMessage(req.body));
    inFlightTranscriptId = payload.transcriptId;
    await handleTranscriptIngest(payload, getTranscriptIngestDeps());
    res.status(204).send();
  } catch (err) {
    // Non-2xx tells Pub/Sub to retry per the subscription's retry policy.
    res.status(500).json({ error: (err as Error).message });
  } finally {
    inFlightTranscriptId = undefined;
  }
});

// Cloud Run injects PORT and expects the container to listen on it; WORKER_PORT is only
// consulted for local dev, where apps/api and apps/worker run side by side on the host.
const port = process.env.PORT ?? process.env.WORKER_PORT ?? 8081;
app.listen(port, () => {
  console.log(`worker listening on ${port}`);
});
