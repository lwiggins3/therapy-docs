import type { RecordAuditEventInput } from "@therapy-docs/audit";
import { db } from "@therapy-docs/db";
import type { LlmClient } from "@therapy-docs/llm-client";
import type { PubSubTranscriptIngestMessage } from "@therapy-docs/shared-types";
import type { StorageClient } from "@therapy-docs/storage";
import { toPgVectorLiteral } from "../lib/pgvector";
import type { TextExtractor } from "../lib/text-extraction";

const CANDIDATE_LIMIT = 20;

/** Structural subset of @therapy-docs/audit's AuditLogger — lets tests substitute a stub. */
export interface AuditLoggerLike {
  record(event: RecordAuditEventInput): Promise<void>;
}

export interface TranscriptIngestDeps {
  storage: StorageClient;
  textExtractor: TextExtractor;
  llmClient: LlmClient;
  auditLogger: AuditLoggerLike;
}

/**
 * Transcript ingestion + recommendation pipeline: extract text, embed it, pre-filter candidate
 * library documents via vector similarity, then ask the LLM to rank/justify a final shortlist.
 * Every step that touches transcript content must log through @therapy-docs/audit.
 */
export async function handleTranscriptIngest(
  message: PubSubTranscriptIngestMessage,
  deps: TranscriptIngestDeps,
): Promise<void> {
  try {
    const transcript = await db.transcript.findUniqueOrThrow({
      where: { id: message.transcriptId },
    });

    await deps.auditLogger.record({
      actorId: transcript.therapistId,
      action: "transcript.llm_process",
      resourceType: "transcript",
      resourceId: transcript.id,
      patientId: transcript.patientId,
    });

    const fileData = await deps.storage.download({ uri: message.gcsUri });
    const text = await deps.textExtractor.extractText({ data: fileData, mimeType: transcript.mimeType });

    const embedding = await deps.llmClient.embed({ text });
    await db.$executeRaw`
      UPDATE transcripts
      SET embedding = ${toPgVectorLiteral(embedding)}::vector
      WHERE id = ${message.transcriptId}
    `;

    const nearest = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM library_documents
      WHERE "therapistId" = ${transcript.therapistId}
        AND status = 'ready'
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${toPgVectorLiteral(embedding)}::vector
      LIMIT ${CANDIDATE_LIMIT}
    `;

    const candidates = await db.libraryDocument.findMany({
      where: { id: { in: nearest.map((row) => row.id) } },
      include: { tags: { where: { confirmed: true }, include: { tag: true } } },
    });

    const candidateDocuments = candidates.map((doc) => ({
      id: doc.id,
      title: doc.title,
      summary: doc.tags.map((assignment) => assignment.tag.label).join(", ") || doc.title,
    }));

    const recommendations = await deps.llmClient.recommendDocuments({
      transcriptText: text,
      candidateDocuments,
    });

    for (const recommendation of recommendations) {
      await db.recommendation.create({
        data: {
          transcriptId: transcript.id,
          patientId: transcript.patientId,
          documentId: recommendation.documentId,
          status: "suggested",
          rationale: recommendation.rationale,
        },
      });
    }

    await db.transcript.update({
      where: { id: transcript.id },
      data: { status: "ready" },
    });
  } catch (err) {
    console.error(`Transcript ingest failed for ${message.transcriptId}:`, err);
    await db.transcript
      .update({ where: { id: message.transcriptId }, data: { status: "failed" } })
      .catch(() => {
        // best-effort — if this also fails the transcript just stays "processing"
      });
    throw err; // non-2xx response tells Pub/Sub to retry
  }
}
