import { z } from "zod";

const DraftEmailResponseSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export interface DraftEmailResult {
  subject: string;
  body: string;
}

/** Shared prompt used by every adapter's draftEmail(), so wording only lives in one place. */
export function buildDraftEmailPrompt(input: {
  patientDisplayName: string;
  approvedDocuments: { id: string; title: string }[];
}): string {
  const documentsList = input.approvedDocuments.map((doc) => `- ${doc.title}`).join("\n");

  return `You are helping a therapist draft a brief, warm follow-up email to their patient after a
session. The email should mention that some resources are attached/linked for them to review, and
invite them to reach out with any questions. Do not invent details about the session — only refer
generically to "today's session" and the resources below.

Patient's first name or preferred name (use this, not a formal salutation): ${input.patientDisplayName}

Resources being shared:
${documentsList}

Respond with ONLY JSON matching this shape, no other text:
{"subject": string, "body": string}`;
}

/**
 * Parses a model's raw text response into a validated DraftEmailResult. Tolerates responses
 * wrapped in a ```json fence, matching the other two parsers' leniency.
 */
export function parseDraftEmailResponse(rawText: string): DraftEmailResult {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`Failed to parse draft email JSON: ${(err as Error).message}`, { cause: err });
  }

  return DraftEmailResponseSchema.parse(parsed);
}
