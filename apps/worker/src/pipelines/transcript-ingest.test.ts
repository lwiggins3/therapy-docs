import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RecordAuditEventInput } from "@therapy-docs/audit";
import { db } from "@therapy-docs/db";
import type {
  DocumentRecommendation,
  LlmClient,
  TagSuggestion,
} from "@therapy-docs/llm-client";
import { LocalDiskStorageClient } from "@therapy-docs/storage";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PlainTextTextExtractor } from "../lib/text-extraction";
import { toPgVectorLiteral } from "../lib/pgvector";
import { handleTranscriptIngest, type AuditLoggerLike } from "./transcript-ingest";

const FAKE_EMBEDDING = new Array(1536).fill(0).map((_, i) => i / 1536);

class StubLlmClient implements LlmClient {
  recommendDocumentsResult: DocumentRecommendation[] = [];
  shouldFailEmbed = false;

  async suggestTags(): Promise<TagSuggestion[]> {
    throw new Error("not used in this test");
  }

  async embed(): Promise<number[]> {
    if (this.shouldFailEmbed) {
      throw new Error("stub embed failure");
    }
    return FAKE_EMBEDDING;
  }

  async recommendDocuments(): Promise<DocumentRecommendation[]> {
    return this.recommendDocumentsResult;
  }

  async draftEmail(): Promise<{ subject: string; body: string }> {
    throw new Error("not used in this test");
  }
}

class StubAuditLogger implements AuditLoggerLike {
  events: RecordAuditEventInput[] = [];

  async record(event: RecordAuditEventInput): Promise<void> {
    this.events.push(event);
  }
}

describe("handleTranscriptIngest", () => {
  let tempDir: string;
  let therapistId: string;
  let patientId: string;
  const documentIds: string[] = [];
  const transcriptIds: string[] = [];
  const tagLabels: string[] = [];

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "therapy-docs-test-"));
    const therapist = await db.therapist.create({
      data: { email: `test-${randomUUID()}@example.com`, displayName: "Test Therapist" },
    });
    therapistId = therapist.id;
    const patient = await db.patient.create({
      data: { therapistId, displayName: "Test Patient" },
    });
    patientId = patient.id;
  });

  afterEach(async () => {
    await db.recommendation.deleteMany({ where: { transcriptId: { in: transcriptIds } } });
    await db.transcript.deleteMany({ where: { id: { in: transcriptIds } } });
    await db.documentTagAssignment.deleteMany({ where: { documentId: { in: documentIds } } });
    await db.libraryDocument.deleteMany({ where: { id: { in: documentIds } } });
    await db.tag.deleteMany({ where: { label: { in: tagLabels } } });
    transcriptIds.length = 0;
    documentIds.length = 0;
    tagLabels.length = 0;
  });

  afterAll(async () => {
    await db.patient.delete({ where: { id: patientId } });
    await db.therapist.delete({ where: { id: therapistId } });
    await rm(tempDir, { recursive: true, force: true });
    await db.$disconnect();
  });

  async function seedReadyDocument(title: string, tagLabelPrefix: string) {
    const tagLabel = `${tagLabelPrefix}-${randomUUID()}`;
    const document = await db.libraryDocument.create({
      data: {
        therapistId,
        title,
        gcsUri: "local://unused",
        mimeType: "application/pdf",
        status: "ready",
      },
    });
    documentIds.push(document.id);
    tagLabels.push(tagLabel);

    await db.$executeRaw`
      UPDATE library_documents SET embedding = ${toPgVectorLiteral(FAKE_EMBEDDING)}::vector WHERE id = ${document.id}
    `;

    const tag = await db.tag.upsert({
      where: { label: tagLabel },
      update: {},
      create: { label: tagLabel },
    });
    await db.documentTagAssignment.create({
      data: { documentId: document.id, tagId: tag.id, source: "manual", confirmed: true },
    });

    return document;
  }

  async function seedTranscript(text: string) {
    const storage = new LocalDiskStorageClient({ baseDir: tempDir });
    const key = `transcripts/${randomUUID()}.pdf`;
    const { uri } = await storage.upload({
      key,
      data: Buffer.from(text, "utf-8"),
      contentType: "application/pdf",
    });
    const transcript = await db.transcript.create({
      data: {
        patientId,
        therapistId,
        gcsUri: uri,
        mimeType: "application/pdf",
        status: "processing",
      },
    });
    transcriptIds.push(transcript.id);
    return { transcript, storage, uri };
  }

  it("extracts text, embeds it, records an audit event, and creates suggested recommendations", async () => {
    const document = await seedReadyDocument("Coping skills worksheet", "anxiety");
    const { transcript, storage, uri } = await seedTranscript("Patient discussed anxiety coping strategies.");

    const llmClient = new StubLlmClient();
    llmClient.recommendDocumentsResult = [
      { documentId: document.id, rationale: "Directly relevant to today's session", score: 0.85 },
    ];
    const auditLogger = new StubAuditLogger();

    await handleTranscriptIngest(
      { transcriptId: transcript.id, gcsUri: uri },
      { storage, textExtractor: new PlainTextTextExtractor(), llmClient, auditLogger },
    );

    const updated = await db.transcript.findUniqueOrThrow({ where: { id: transcript.id } });
    expect(updated.status).toBe("ready");

    expect(auditLogger.events).toHaveLength(1);
    expect(auditLogger.events[0]).toMatchObject({
      action: "transcript.llm_process",
      resourceType: "transcript",
      resourceId: transcript.id,
      patientId,
    });

    const recommendations = await db.recommendation.findMany({ where: { transcriptId: transcript.id } });
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.documentId).toBe(document.id);
    expect(recommendations[0]?.status).toBe("suggested");

    const rows = await db.$queryRaw<{ has_embedding: boolean }[]>`
      SELECT (embedding IS NOT NULL) as has_embedding FROM transcripts WHERE id = ${transcript.id}
    `;
    expect(rows[0]?.has_embedding).toBe(true);
  });

  it("marks the transcript failed if the LLM call throws", async () => {
    const { transcript, storage, uri } = await seedTranscript("Some transcript text.");
    const llmClient = new StubLlmClient();
    llmClient.shouldFailEmbed = true;
    const auditLogger = new StubAuditLogger();

    await expect(
      handleTranscriptIngest(
        { transcriptId: transcript.id, gcsUri: uri },
        { storage, textExtractor: new PlainTextTextExtractor(), llmClient, auditLogger },
      ),
    ).rejects.toThrow("stub embed failure");

    const updated = await db.transcript.findUniqueOrThrow({ where: { id: transcript.id } });
    expect(updated.status).toBe("failed");
  });
});
