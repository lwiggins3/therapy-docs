import { randomUUID } from "node:crypto";
import { db } from "@therapy-docs/db";
import { LocalDiskStorageClient } from "@therapy-docs/storage";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DocumentsService } from "./documents.service";

describe("DocumentsService.deleteDocument", () => {
  let therapistId: string;
  let otherTherapistId: string;
  let service: DocumentsService;
  let storage: LocalDiskStorageClient;
  const documentIds: string[] = [];

  beforeAll(async () => {
    const therapist = await db.therapist.create({
      data: { email: `test-${randomUUID()}@example.com`, displayName: "Test Therapist" },
    });
    therapistId = therapist.id;
    const other = await db.therapist.create({
      data: { email: `test-${randomUUID()}@example.com`, displayName: "Other Therapist" },
    });
    otherTherapistId = other.id;
    service = new DocumentsService();
    storage = new LocalDiskStorageClient({ baseDir: process.env.LOCAL_STORAGE_DIR! });
  });

  afterEach(async () => {
    await db.documentTagAssignment.deleteMany({ where: { documentId: { in: documentIds } } });
    await db.recommendation.deleteMany({ where: { documentId: { in: documentIds } } });
    await db.libraryDocument.deleteMany({ where: { id: { in: documentIds } } });
    documentIds.length = 0;
  });

  afterAll(async () => {
    await db.therapist.delete({ where: { id: therapistId } });
    await db.therapist.delete({ where: { id: otherTherapistId } });
    await db.$disconnect();
  });

  async function seedDocument() {
    const key = `documents/${randomUUID()}.txt`;
    const { uri } = await storage.upload({ key, data: Buffer.from("hello"), contentType: "text/plain" });
    const document = await db.libraryDocument.create({
      data: { therapistId, title: "Test document", gcsUri: uri, mimeType: "text/plain", status: "ready" },
    });
    documentIds.push(document.id);
    return { document, uri };
  }

  it("removes the document row and all rows that reference it, plus the underlying storage object", async () => {
    const { document, uri } = await seedDocument();
    const tag = await db.tag.upsert({
      where: { label: "smoke-test-tag" },
      update: {},
      create: { label: "smoke-test-tag" },
    });
    await db.documentTagAssignment.create({
      data: { documentId: document.id, tagId: tag.id, source: "manual", confirmed: true },
    });

    const patient = await db.patient.create({ data: { therapistId, displayName: "Test Patient" } });
    const transcript = await db.transcript.create({
      data: { patientId: patient.id, therapistId, gcsUri: "local://fake.pdf", mimeType: "application/pdf", status: "ready" },
    });
    const recommendation = await db.recommendation.create({
      data: { transcriptId: transcript.id, patientId: patient.id, documentId: document.id, status: "suggested" },
    });
    const emailDraft = await db.emailDraft.create({
      data: {
        patientId: patient.id,
        transcriptId: transcript.id,
        therapistId,
        gmailDraftId: "fake-draft-id",
        subject: "Subject",
        body: "Body",
      },
    });
    await db.emailDraftDocument.create({ data: { emailDraftId: emailDraft.id, documentId: document.id } });

    await service.deleteDocument(document.id, therapistId);

    await expect(db.libraryDocument.findUnique({ where: { id: document.id } })).resolves.toBeNull();
    await expect(
      db.documentTagAssignment.findUnique({
        where: { documentId_tagId: { documentId: document.id, tagId: tag.id } },
      }),
    ).resolves.toBeNull();
    await expect(db.recommendation.findUnique({ where: { id: recommendation.id } })).resolves.toBeNull();
    await expect(
      db.emailDraftDocument.findUnique({
        where: { emailDraftId_documentId: { emailDraftId: emailDraft.id, documentId: document.id } },
      }),
    ).resolves.toBeNull();
    // The EmailDraft itself is a historical record and survives — only the join row is removed.
    await expect(db.emailDraft.findUnique({ where: { id: emailDraft.id } })).resolves.not.toBeNull();
    await expect(storage.download({ uri })).rejects.toThrow();

    await db.emailDraft.delete({ where: { id: emailDraft.id } });
    await db.transcript.delete({ where: { id: transcript.id } });
    await db.patient.delete({ where: { id: patient.id } });
    await db.tag.delete({ where: { id: tag.id } });
  });

  it("throws NotFoundException for an unknown id", async () => {
    await expect(service.deleteDocument(randomUUID(), therapistId)).rejects.toThrow(/not found/i);
  });

  it("throws ForbiddenException when the document belongs to a different therapist", async () => {
    const { document } = await seedDocument();
    await expect(service.deleteDocument(document.id, otherTherapistId)).rejects.toThrow(/different therapist/);
  });
});
