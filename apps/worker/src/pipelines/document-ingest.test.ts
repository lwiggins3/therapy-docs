import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@therapy-docs/db";
import type {
  DocumentRecommendation,
  LlmClient,
  TagSuggestion,
} from "@therapy-docs/llm-client";
import { LocalDiskStorageClient } from "@therapy-docs/storage";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PlainTextTextExtractor } from "../lib/text-extraction";
import { handleDocumentIngest } from "./document-ingest";

const FAKE_EMBEDDING = new Array(1536).fill(0).map((_, i) => i / 1536);

class StubLlmClient implements LlmClient {
  suggestTagsResult: TagSuggestion[] = [{ label: "anxiety", confidence: 0.9 }];
  shouldFailEmbed = false;

  async suggestTags(): Promise<TagSuggestion[]> {
    return this.suggestTagsResult;
  }

  async embed(): Promise<number[]> {
    if (this.shouldFailEmbed) {
      throw new Error("stub embed failure");
    }
    return FAKE_EMBEDDING;
  }

  async recommendDocuments(): Promise<DocumentRecommendation[]> {
    throw new Error("not used in this test");
  }

  async draftEmail(): Promise<{ subject: string; body: string }> {
    throw new Error("not used in this test");
  }

  async summarizeTranscript(): Promise<string> {
    throw new Error("not used in this test");
  }
}

describe("handleDocumentIngest", () => {
  let tempDir: string;
  let therapistId: string;
  const documentIds: string[] = [];
  const tagLabels: string[] = [];

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "therapy-docs-test-"));
    const therapist = await db.therapist.create({
      data: { email: `test-${randomUUID()}@example.com`, displayName: "Test Therapist" },
    });
    therapistId = therapist.id;
  });

  afterEach(async () => {
    await db.documentTagAssignment.deleteMany({ where: { documentId: { in: documentIds } } });
    await db.libraryDocument.deleteMany({ where: { id: { in: documentIds } } });
    await db.tag.deleteMany({ where: { label: { in: tagLabels } } });
    documentIds.length = 0;
    tagLabels.length = 0;
  });

  afterAll(async () => {
    await db.therapist.delete({ where: { id: therapistId } });
    await rm(tempDir, { recursive: true, force: true });
    await db.$disconnect();
  });

  async function seedDocument(text: string) {
    const storage = new LocalDiskStorageClient({ baseDir: tempDir });
    const key = `documents/${randomUUID()}.txt`;
    const { uri } = await storage.upload({
      key,
      data: Buffer.from(text, "utf-8"),
      contentType: "text/plain",
    });
    const document = await db.libraryDocument.create({
      data: {
        therapistId,
        title: "Test document",
        gcsUri: uri,
        mimeType: "text/plain",
        status: "processing",
      },
    });
    documentIds.push(document.id);
    return { document, storage, uri };
  }

  it("extracts text, embeds it, suggests tags, and marks the document ready", async () => {
    const { document, storage, uri } = await seedDocument("Coping skills worksheet for anxiety.");
    const llmClient = new StubLlmClient();
    tagLabels.push("anxiety");

    await handleDocumentIngest(
      { documentId: document.id, gcsUri: uri },
      { storage, textExtractor: new PlainTextTextExtractor(), llmClient },
    );

    const updated = await db.libraryDocument.findUniqueOrThrow({
      where: { id: document.id },
      include: { tags: { include: { tag: true } } },
    });
    expect(updated.status).toBe("ready");
    expect(updated.tags).toHaveLength(1);
    expect(updated.tags[0]?.tag.label).toBe("anxiety");
    expect(updated.tags[0]?.source).toBe("llm_suggested");
    expect(updated.tags[0]?.confirmed).toBe(false);

    const rows = await db.$queryRaw<{ has_embedding: boolean }[]>`
      SELECT (embedding IS NOT NULL) as has_embedding FROM library_documents WHERE id = ${document.id}
    `;
    expect(rows[0]?.has_embedding).toBe(true);
  });

  it("marks the document failed if the LLM call throws", async () => {
    const { document, storage, uri } = await seedDocument("Some document text.");
    const llmClient = new StubLlmClient();
    llmClient.shouldFailEmbed = true;

    await expect(
      handleDocumentIngest(
        { documentId: document.id, gcsUri: uri },
        { storage, textExtractor: new PlainTextTextExtractor(), llmClient },
      ),
    ).rejects.toThrow("stub embed failure");

    const updated = await db.libraryDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect(updated.status).toBe("failed");
  });
});
