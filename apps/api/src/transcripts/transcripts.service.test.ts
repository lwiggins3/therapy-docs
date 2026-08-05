import { randomUUID } from "node:crypto";
import { db } from "@therapy-docs/db";
import { LocalDiskStorageClient } from "@therapy-docs/storage";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { TranscriptsService } from "./transcripts.service";

describe("TranscriptsService.deleteTranscript", () => {
  let therapistId: string;
  let otherTherapistId: string;
  let patientId: string;
  let service: TranscriptsService;
  let storage: LocalDiskStorageClient;
  const transcriptIds: string[] = [];

  beforeAll(async () => {
    const therapist = await db.therapist.create({
      data: { email: `test-${randomUUID()}@example.com`, displayName: "Test Therapist" },
    });
    therapistId = therapist.id;
    const other = await db.therapist.create({
      data: { email: `test-${randomUUID()}@example.com`, displayName: "Other Therapist" },
    });
    otherTherapistId = other.id;
    const patient = await db.patient.create({ data: { therapistId, displayName: "Test Patient" } });
    patientId = patient.id;
    service = new TranscriptsService();
    storage = new LocalDiskStorageClient({ baseDir: process.env.LOCAL_STORAGE_DIR! });
  });

  afterEach(async () => {
    await db.transcript.deleteMany({ where: { id: { in: transcriptIds } } });
    transcriptIds.length = 0;
  });

  afterAll(async () => {
    await db.patient.delete({ where: { id: patientId } });
    await db.therapist.delete({ where: { id: therapistId } });
    await db.therapist.delete({ where: { id: otherTherapistId } });
    await db.$disconnect();
  });

  async function seedTranscript() {
    const key = `transcripts/${randomUUID()}.txt`;
    const { uri } = await storage.upload({ key, data: Buffer.from("session notes"), contentType: "text/plain" });
    const transcript = await db.transcript.create({
      data: { patientId, therapistId, gcsUri: uri, mimeType: "text/plain", status: "ready" },
    });
    transcriptIds.push(transcript.id);
    return { transcript, uri };
  }

  it("removes the transcript row and all rows that reference it, plus the underlying storage object", async () => {
    const { transcript, uri } = await seedTranscript();
    const document = await db.libraryDocument.create({
      data: { therapistId, title: "Doc", gcsUri: "local://fake.pdf", mimeType: "application/pdf", status: "ready" },
    });
    const recommendation = await db.recommendation.create({
      data: { transcriptId: transcript.id, patientId, documentId: document.id, status: "suggested" },
    });
    const emailDraft = await db.emailDraft.create({
      data: {
        patientId,
        transcriptId: transcript.id,
        therapistId,
        gmailDraftId: "fake-draft-id",
        subject: "Subject",
        body: "Body",
      },
    });
    await db.emailDraftDocument.create({ data: { emailDraftId: emailDraft.id, documentId: document.id } });

    await service.deleteTranscript(transcript.id, therapistId);

    await expect(db.transcript.findUnique({ where: { id: transcript.id } })).resolves.toBeNull();
    await expect(db.recommendation.findUnique({ where: { id: recommendation.id } })).resolves.toBeNull();
    await expect(db.emailDraft.findUnique({ where: { id: emailDraft.id } })).resolves.toBeNull();
    await expect(
      db.emailDraftDocument.findUnique({
        where: { emailDraftId_documentId: { emailDraftId: emailDraft.id, documentId: document.id } },
      }),
    ).resolves.toBeNull();
    await expect(storage.download({ uri })).rejects.toThrow();

    await db.libraryDocument.delete({ where: { id: document.id } });
  });

  it("throws NotFoundException for an unknown id", async () => {
    await expect(service.deleteTranscript(randomUUID(), therapistId)).rejects.toThrow(/not found/i);
  });

  it("throws ForbiddenException when the transcript belongs to a different therapist", async () => {
    const { transcript } = await seedTranscript();
    await expect(service.deleteTranscript(transcript.id, otherTherapistId)).rejects.toThrow(/different therapist/);
  });
});
