import { z } from "zod";
import type { DocumentRecommendation } from "./types";

const MAX_TRANSCRIPT_TEXT_CHARS = 8000;

const RecommendationsResponseSchema = z.object({
  recommendations: z.array(
    z.object({
      documentId: z.string().min(1),
      rationale: z.string().min(1),
      score: z.number().min(0).max(1),
    }),
  ),
});

/** Shared prompt used by every adapter's recommendDocuments(), so wording only lives in one place. */
export function buildRecommendDocumentsPrompt(input: {
  transcriptText: string;
  candidateDocuments: { id: string; title: string; summary: string }[];
}): string {
  const truncated = input.transcriptText.slice(0, MAX_TRANSCRIPT_TEXT_CHARS);
  const candidatesList = input.candidateDocuments
    .map((doc) => `- id: ${doc.id} | title: ${doc.title} | tags: ${doc.summary}`)
    .join("\n");

  return `You are helping a therapist choose which handouts/worksheets from their curated library to
send a patient as a follow-up to today's session.

Candidate documents (id | title | tags):
${candidatesList}

Session transcript:
"""
${truncated}
"""

Choose the documents from the candidate list above that are genuinely relevant to this session —
skip any that don't fit, and only include a document id that appears in the candidate list. For
each chosen document, give a short rationale grounded in the transcript and a relevance score
between 0 and 1. Respond with ONLY JSON matching this shape, no other text:
{"recommendations": [{"documentId": string, "rationale": string, "score": number between 0 and 1}]}`;
}

/**
 * Parses a model's raw text response into validated DocumentRecommendation[]. Tolerates
 * responses wrapped in a ```json fence, matching parseTagSuggestionsResponse's leniency.
 */
export function parseRecommendDocumentsResponse(rawText: string): DocumentRecommendation[] {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`Failed to parse recommendation JSON: ${(err as Error).message}`, { cause: err });
  }

  return RecommendationsResponseSchema.parse(parsed).recommendations;
}
