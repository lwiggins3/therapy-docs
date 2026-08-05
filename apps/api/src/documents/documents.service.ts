import { randomUUID } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { db } from "@therapy-docs/db";
import { createStorageClient, type StorageClient } from "@therapy-docs/storage";
import { PubSubPublisher } from "../lib/pubsub";

export interface UpdateTagsInput {
  confirmTagIds?: string[];
  rejectTagIds?: string[];
  addLabels?: string[];
}

@Injectable()
export class DocumentsService {
  private readonly storage: StorageClient;
  private readonly publisher: PubSubPublisher;
  private readonly documentIngestTopic: string;

  constructor() {
    this.storage = createStorageClient({
      provider: (process.env.STORAGE_PROVIDER as "local" | "gcs") ?? "local",
      bucket: process.env.GCS_DOCUMENTS_BUCKET,
      localDir: process.env.LOCAL_STORAGE_DIR,
    });
    this.publisher = new PubSubPublisher({
      projectId: process.env.GCP_PROJECT_ID || "therapy-docs-local",
    });
    this.documentIngestTopic = process.env.PUBSUB_TOPIC_DOCUMENT_INGEST ?? "document-ingest";
  }

  async uploadDocument(input: {
    therapistId: string;
    title: string;
    file: { buffer: Buffer; mimetype: string; originalname: string };
  }) {
    const id = randomUUID();
    const key = `documents/${id}/${input.file.originalname}`;
    const { uri } = await this.storage.upload({
      key,
      data: input.file.buffer,
      contentType: input.file.mimetype,
    });

    const document = await db.libraryDocument.create({
      data: {
        id,
        therapistId: input.therapistId,
        title: input.title,
        gcsUri: uri,
        mimeType: input.file.mimetype,
        status: "processing",
      },
    });

    await this.publisher.publish(this.documentIngestTopic, { documentId: id, gcsUri: uri });

    return document;
  }

  async listDocuments(therapistId: string) {
    return db.libraryDocument.findMany({
      where: { therapistId },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listTags() {
    return db.tag.findMany({ orderBy: { label: "asc" } });
  }

  async updateTags(documentId: string, therapistId: string, input: UpdateTagsInput) {
    const document = await db.libraryDocument.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }
    if (document.therapistId !== therapistId) {
      throw new ForbiddenException("Document belongs to a different therapist");
    }

    for (const tagId of input.confirmTagIds ?? []) {
      const assignment = await db.documentTagAssignment.findUnique({
        where: { documentId_tagId: { documentId, tagId } },
        include: { tag: true },
      });
      await db.documentTagAssignment.update({
        where: { documentId_tagId: { documentId, tagId } },
        data: { confirmed: true },
      });
      if (assignment?.source === "llm_suggested") {
        await db.tagSuggestionFeedback.create({
          data: { documentId, tagLabel: assignment.tag.label, decision: "accepted" },
        });
      }
    }

    for (const tagId of input.rejectTagIds ?? []) {
      const assignment = await db.documentTagAssignment.findUnique({
        where: { documentId_tagId: { documentId, tagId } },
        include: { tag: true },
      });
      await db.documentTagAssignment.delete({
        where: { documentId_tagId: { documentId, tagId } },
      });
      if (assignment?.source === "llm_suggested") {
        await db.tagSuggestionFeedback.create({
          data: { documentId, tagLabel: assignment.tag.label, decision: "rejected" },
        });
      }
    }

    for (const label of input.addLabels ?? []) {
      const tag = await db.tag.upsert({
        where: { label },
        update: {},
        create: { label },
      });
      await db.documentTagAssignment.upsert({
        where: { documentId_tagId: { documentId, tagId: tag.id } },
        update: { confirmed: true },
        create: { documentId, tagId: tag.id, source: "manual", confirmed: true },
      });
    }

    return db.libraryDocument.findUnique({
      where: { id: documentId },
      include: { tags: { include: { tag: true } } },
    });
  }

  async deleteDocument(id: string, therapistId: string) {
    const document = await db.libraryDocument.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Document not found: ${id}`);
    }
    if (document.therapistId !== therapistId) {
      throw new ForbiddenException("Document belongs to a different therapist");
    }

    await db.$transaction([
      db.tagSuggestionFeedback.deleteMany({ where: { documentId: id } }),
      db.documentTagAssignment.deleteMany({ where: { documentId: id } }),
      db.emailDraftDocument.deleteMany({ where: { documentId: id } }),
      db.recommendation.deleteMany({ where: { documentId: id } }),
      db.libraryDocument.delete({ where: { id } }),
    ]);

    await this.storage.delete({ uri: document.gcsUri });
  }
}
