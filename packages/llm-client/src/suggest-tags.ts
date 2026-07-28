import { z } from "zod";
import type { TagSuggestion } from "./types";

const MAX_DOCUMENT_TEXT_CHARS = 8000;

const TagSuggestionsResponseSchema = z.object({
  tags: z.array(
    z.object({
      label: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

/** Shared prompt used by every adapter's suggestTags(), so wording only lives in one place. */
export function buildSuggestTagsPrompt(input: { documentText: string; existingTags: string[] }): string {
  const truncated = input.documentText.slice(0, MAX_DOCUMENT_TEXT_CHARS);
  const existingTagsList =
    input.existingTags.length > 0 ? input.existingTags.map((tag) => `- ${tag}`).join("\n") : "(none yet)";

  return `You are helping a therapist tag a document in their curated library of patient handouts and worksheets.

Existing tags already in use (prefer reusing one of these over inventing a near-duplicate):
${existingTagsList}

Document text:
"""
${truncated}
"""

Suggest 2-6 tags for this document. Respond with ONLY JSON matching this shape, no other text:
{"tags": [{"label": string, "confidence": number between 0 and 1}]}`;
}

/**
 * Parses a model's raw text response into validated TagSuggestion[]. Tolerates responses
 * wrapped in a ```json fence, since not every model reliably omits it even when asked to.
 */
export function parseTagSuggestionsResponse(rawText: string): TagSuggestion[] {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`Failed to parse tag suggestion JSON: ${(err as Error).message}`, { cause: err });
  }

  return TagSuggestionsResponseSchema.parse(parsed).tags;
}
