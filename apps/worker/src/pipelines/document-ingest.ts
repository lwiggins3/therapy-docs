import { db } from "@therapy-docs/db";
import type { LlmClient } from "@therapy-docs/llm-client";
import type { PubSubDocumentIngestMessage } from "@therapy-docs/shared-types";
import type { StorageClient } from "@therapy-docs/storage";
import { toPgVectorLiteral } from "../lib/pgvector";
import type { TextExtractor } from "../lib/text-extraction";

export interface DocumentIngestDeps {
  storage: StorageClient;
  textExtractor: TextExtractor;
  llmClient: LlmClient;
}

/** How many recent tag accept/reject decisions to few-shot suggestTags() with. */
const RECENT_FEEDBACK_LIMIT = 10;

/**
 * Document library ingestion pipeline: extract text, embed it, ask the LLM for tag
 * suggestions, then update the LibraryDocument row so the therapist can review suggested tags
 * in apps/web. Dependencies are injected (see main.ts for the real, env-configured instances)
 * so this orchestration can be tested with local/stub adapters — no GCP credentials needed.
 */
export async function handleDocumentIngest(
  message: PubSubDocumentIngestMessage,
  deps: DocumentIngestDeps,
): Promise<void> {
  try {
    const document = await db.libraryDocument.findUniqueOrThrow({
      where: { id: message.documentId },
    });

    const fileData = await deps.storage.download({ uri: message.gcsUri });
    const text = await deps.textExtractor.extractText({ data: fileData, mimeType: document.mimeType });

    const embedding = await deps.llmClient.embed({ text });
    await db.$executeRaw`
      UPDATE library_documents
      SET embedding = ${toPgVectorLiteral(embedding)}::vector
      WHERE id = ${message.documentId}
    `;

    const existingTags = await db.tag.findMany({ select: { label: true } });
    const recentFeedback = await db.tagSuggestionFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_FEEDBACK_LIMIT,
    });
    const suggestions = await deps.llmClient.suggestTags({
      documentText: text,
      existingTags: existingTags.map((tag) => tag.label),
      recentFeedback: recentFeedback.map((f) => ({ label: f.tagLabel, decision: f.decision })),
    });

    for (const suggestion of suggestions) {
      const tag = await db.tag.upsert({
        where: { label: suggestion.label },
        update: {},
        create: { label: suggestion.label },
      });
      await db.documentTagAssignment.upsert({
        where: { documentId_tagId: { documentId: message.documentId, tagId: tag.id } },
        update: {},
        create: {
          documentId: message.documentId,
          tagId: tag.id,
          source: "llm_suggested",
          confirmed: false,
        },
      });
    }

    await db.libraryDocument.update({
      where: { id: message.documentId },
      data: { status: "ready" },
    });
  } catch (err) {
    console.error(`Document ingest failed for ${message.documentId}:`, err);
    await db.libraryDocument
      .update({ where: { id: message.documentId }, data: { status: "failed" } })
      .catch(() => {
        // best-effort — if this also fails the document just stays "processing"
      });
    throw err; // non-2xx response tells Pub/Sub to retry
  }
}
