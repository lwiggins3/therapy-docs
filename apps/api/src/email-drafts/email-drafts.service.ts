import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { db } from "@therapy-docs/db";
import { createLlmClient, type LlmClient, type LlmProvider } from "@therapy-docs/llm-client";
import { GmailService } from "../gmail/gmail.service";
import { APPROVED_RECOMMENDATION_STATUSES } from "./approved-recommendations";

/** Builds a minimal RFC 2822 message for Gmail's drafts.create — Subject + plain-text body only.
 * "To" is deliberately left blank: Patient records intentionally store no email address (data
 * minimization, see docs/hipaa-compliance.md) — the therapist fills in the recipient themselves
 * before sending from their own Gmail. */
function buildRawEmailMessage(input: { subject: string; body: string }): string {
  const message = [`Subject: ${input.subject}`, "Content-Type: text/plain; charset=utf-8", "", input.body].join(
    "\r\n",
  );
  return Buffer.from(message).toString("base64url");
}

@Injectable()
export class EmailDraftsService {
  private llmClient?: LlmClient;

  constructor(private readonly gmailService: GmailService) {}

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

    const gmail = await this.gmailService.getAuthorizedGmailClient(input.therapistId);
    const { data } = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw: buildRawEmailMessage({ subject, body }) } },
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
