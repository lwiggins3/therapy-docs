import { randomUUID } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { db } from "@therapy-docs/db";
import { createStorageClient, type StorageClient } from "@therapy-docs/storage";
import { PubSubPublisher } from "../lib/pubsub";

@Injectable()
export class TranscriptsService {
  private readonly storage: StorageClient;
  private readonly publisher: PubSubPublisher;
  private readonly transcriptIngestTopic: string;

  constructor() {
    this.storage = createStorageClient({
      provider: (process.env.STORAGE_PROVIDER as "local" | "gcs") ?? "local",
      bucket: process.env.GCS_TRANSCRIPTS_BUCKET,
      localDir: process.env.LOCAL_STORAGE_DIR,
    });
    this.publisher = new PubSubPublisher({
      projectId: process.env.GCP_PROJECT_ID || "therapy-docs-local",
    });
    this.transcriptIngestTopic = process.env.PUBSUB_TOPIC_TRANSCRIPT_INGEST ?? "transcript-ingest";
  }

  async uploadTranscript(input: {
    therapistId: string;
    patientId: string;
    sessionDate?: string;
    file: { buffer: Buffer; mimetype: string; originalname: string };
  }) {
    const id = randomUUID();
    const key = `transcripts/${id}/${input.file.originalname}`;
    const { uri } = await this.storage.upload({
      key,
      data: input.file.buffer,
      contentType: input.file.mimetype,
    });

    const transcript = await db.transcript.create({
      data: {
        id,
        patientId: input.patientId,
        therapistId: input.therapistId,
        gcsUri: uri,
        mimeType: input.file.mimetype,
        status: "processing",
        sessionDate: input.sessionDate ? new Date(input.sessionDate) : undefined,
      },
    });

    await this.publisher.publish(this.transcriptIngestTopic, { transcriptId: id, gcsUri: uri });

    return transcript;
  }

  async listTranscripts(therapistId: string, patientId?: string) {
    return db.transcript.findMany({
      where: { therapistId, ...(patientId ? { patientId } : {}) },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTranscript(id: string) {
    return db.transcript.findUnique({ where: { id }, include: { patient: true } });
  }

  async deleteTranscript(id: string, therapistId: string) {
    const transcript = await db.transcript.findUnique({ where: { id } });
    if (!transcript) {
      throw new NotFoundException(`Transcript not found: ${id}`);
    }
    if (transcript.therapistId !== therapistId) {
      throw new ForbiddenException("Transcript belongs to a different therapist");
    }

    const emailDrafts = await db.emailDraft.findMany({ where: { transcriptId: id }, select: { id: true } });
    const emailDraftIds = emailDrafts.map((draft) => draft.id);

    await db.$transaction([
      db.emailDraftDocument.deleteMany({ where: { emailDraftId: { in: emailDraftIds } } }),
      db.emailDraft.deleteMany({ where: { transcriptId: id } }),
      db.recommendation.deleteMany({ where: { transcriptId: id } }),
      db.transcript.delete({ where: { id } }),
    ]);

    await this.storage.delete({ uri: transcript.gcsUri });
  }
}
