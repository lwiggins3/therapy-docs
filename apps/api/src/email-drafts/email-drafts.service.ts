import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { db } from "@therapy-docs/db";
import { createLlmClient, type LlmClient, type LlmProvider } from "@therapy-docs/llm-client";
import { createStorageClient, type StorageClient } from "@therapy-docs/storage";
import MailComposer from "nodemailer/lib/mail-composer";
import { GmailService } from "../gmail/gmail.service";
import { APPROVED_RECOMMENDATION_STATUSES } from "./approved-recommendations";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

/** Builds a full RFC 2822 message for Gmail's drafts.create — Subject + plain-text body + one
 * attachment per approved document. "To" is prefilled from the patient's on-file email when set
 * (see docs/hipaa-compliance.md's data-minimization note — storing it is a deliberate, opt-in
 * exception made specifically for this); otherwise left blank for the therapist to fill in
 * themselves before sending from their own Gmail. */
export async function buildRawEmailMessage(input: {
  subject: string;
  body: string;
  attachments: EmailAttachment[];
  to?: string;
}): Promise<string> {
  const mail = new MailComposer({
    subject: input.subject,
    text: input.body,
    attachments: input.attachments,
    ...(input.to ? { to: input.to } : {}),
  });
  const message = await new Promise<Buffer>((resolve, reject) => {
    mail.compile().build((error, message) => {
      if (error) reject(error);
      else resolve(message);
    });
  });
  return message.toString("base64url");
}

@Injectable()
export class EmailDraftsService {
  private llmClient?: LlmClient;
  private readonly storage: StorageClient;

  constructor(private readonly gmailService: GmailService) {
    this.storage = createStorageClient({
      provider: (process.env.STORAGE_PROVIDER as "local" | "gcs") ?? "local",
      bucket: process.env.GCS_DOCUMENTS_BUCKET,
      localDir: process.env.LOCAL_STORAGE_DIR,
    });
  }

  // Constructed lazily, not in the constructor — Vertex AI SDK clients can crash the process on
  // construction if GCP credentials aren't configured (see apps/worker/src/main.ts's comment on
  // the same issue), and Nest constructs providers eagerly at bootstrap.
  private getLlmClient(): LlmClient {
    this.llmClient ??= createLlmClient({
      provider: (process.env.LLM_PROVIDER as LlmProvider) ?? "claude-vertex",
      projectId: process.env.VERTEX_AI_PROJECT ?? process.env.GCP_PROJECT_ID ?? "",
      location: process.env.VERTEX_AI_LOCATION ?? "us-central1",
      embeddingLocation: process.env.GCP_REGION ?? "us-central1",
      model: process.env.LLM_MODEL || undefined,
    });
    return this.llmClient;
  }

  async finalize(input: { transcriptId: string; therapistId: string }) {
    const transcript = await db.transcript.findUnique({
      where: { id: input.transcriptId },
      include: { patient: true },
    });
    if (!transcript) {
      throw new NotFoundException(`Transcript not found: ${input.transcriptId}`);
    }
    if (transcript.therapistId !== input.therapistId) {
      throw new ForbiddenException("Transcript belongs to a different therapist");
    }

    const recommendations = await db.recommendation.findMany({
      where: {
        transcriptId: input.transcriptId,
        status: { in: [...APPROVED_RECOMMENDATION_STATUSES] },
      },
      include: { document: true },
    });
    if (recommendations.length === 0) {
      throw new BadRequestException("No approved recommendations to draft an email from");
    }

    const approvedDocuments = recommendations.map((rec) => ({ id: rec.document.id, title: rec.document.title }));
    const { subject, body } = await this.getLlmClient().draftEmail({
      patientDisplayName: transcript.patient.displayName,
      approvedDocuments,
    });

    const attachments: EmailAttachment[] = await Promise.all(
      recommendations.map(async (rec) => ({
        filename: `${rec.document.title}.${rec.document.mimeType === "application/pdf" ? "pdf" : "bin"}`,
        content: await this.storage.download({ uri: rec.document.gcsUri }),
        contentType: rec.document.mimeType,
      })),
    );

    const gmail = await this.gmailService.getAuthorizedGmailClient(input.therapistId);
    const { data } = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: await buildRawEmailMessage({ subject, body, attachments, to: transcript.patient.email ?? undefined }),
        },
      },
    });
    if (!data.id) {
      throw new Error("Gmail did not return a draft id");
    }

    return db.emailDraft.create({
      data: {
        patientId: transcript.patientId,
        transcriptId: transcript.id,
        therapistId: input.therapistId,
        gmailDraftId: data.id,
        subject,
        body,
        documents: { create: approvedDocuments.map((doc) => ({ documentId: doc.id })) },
      },
      include: { documents: { include: { document: true } } },
    });
  }

  async listForTranscript(transcriptId: string) {
    return db.emailDraft.findMany({
      where: { transcriptId },
      include: { documents: { include: { document: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}
