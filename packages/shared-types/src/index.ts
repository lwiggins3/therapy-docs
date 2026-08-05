import { z } from "zod";

/**
 * Shared domain schemas/DTOs used across apps/web, apps/api, and apps/worker.
 * These mirror packages/db/prisma/schema.prisma — see docs/data-model.md for the full picture.
 */

export const DocumentTagSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  source: z.enum(["manual", "llm-suggested"]),
});
export type DocumentTag = z.infer<typeof DocumentTagSchema>;

export const LibraryDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  gcsUri: z.string(),
  mimeType: z.string(),
  status: z.enum(["processing", "ready", "failed"]),
  tags: z.array(DocumentTagSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type LibraryDocument = z.infer<typeof LibraryDocumentSchema>;

export const PatientSchema = z.object({
  id: z.string().uuid(),
  therapistId: z.string().uuid(),
  displayName: z.string().min(1),
  externalMrn: z.string().optional(),
  email: z.string().email().optional(),
  createdAt: z.coerce.date(),
});
export type Patient = z.infer<typeof PatientSchema>;

export const TranscriptSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  therapistId: z.string().uuid(),
  gcsUri: z.string(),
  status: z.enum(["processing", "ready", "failed"]),
  sessionDate: z.coerce.date().optional(),
  summary: z.string().optional(),
  createdAt: z.coerce.date(),
});
export type Transcript = z.infer<typeof TranscriptSchema>;

export const RecommendationStatusSchema = z.enum([
  "suggested",
  "accepted",
  "rejected",
  "added_by_therapist",
]);
export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;

export const RecommendationSchema = z.object({
  id: z.string().uuid(),
  transcriptId: z.string().uuid(),
  patientId: z.string().uuid(),
  documentId: z.string().uuid(),
  status: RecommendationStatusSchema,
  rationale: z.string().optional(),
  createdAt: z.coerce.date(),
  decidedAt: z.coerce.date().optional(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const EmailDraftSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  transcriptId: z.string().uuid(),
  gmailDraftId: z.string(),
  documentIds: z.array(z.string().uuid()),
  createdAt: z.coerce.date(),
});
export type EmailDraft = z.infer<typeof EmailDraftSchema>;

export const AuditActionSchema = z.enum([
  "transcript.view",
  "transcript.llm_process",
  "transcript.export",
  "document.view",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string(),
  action: AuditActionSchema,
  resourceType: z.enum(["transcript", "document"]),
  resourceId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  occurredAt: z.coerce.date(),
  sourceIp: z.string().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const PubSubDocumentIngestMessageSchema = z.object({
  documentId: z.string().uuid(),
  gcsUri: z.string(),
});
export type PubSubDocumentIngestMessage = z.infer<typeof PubSubDocumentIngestMessageSchema>;

export const PubSubTranscriptIngestMessageSchema = z.object({
  transcriptId: z.string().uuid(),
  gcsUri: z.string(),
});
export type PubSubTranscriptIngestMessage = z.infer<typeof PubSubTranscriptIngestMessageSchema>;
