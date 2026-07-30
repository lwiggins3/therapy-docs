import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
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
}
