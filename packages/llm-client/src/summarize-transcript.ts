import { z } from "zod";

const MAX_TRANSCRIPT_TEXT_CHARS = 12000;

const SummarizeTranscriptResponseSchema = z.object({
  summary: z.string().min(1),
});

/** Shared prompt used by every adapter's summarizeTranscript(), so wording only lives in one place. */
export function buildSummarizeTranscriptPrompt(input: { transcriptText: string }): string {
  const truncated = input.transcriptText.slice(0, MAX_TRANSCRIPT_TEXT_CHARS);

  return `You are helping a therapist quickly recall what a session was about. Write a short,
factual recap (2-4 sentences) of what was discussed in the transcript below, grounded only in
what's actually there. Do not offer clinical advice, diagnoses, or interpretation beyond what the
patient or therapist explicitly said.

Transcript text:
"""
${truncated}
"""

Respond with ONLY JSON matching this shape, no other text:
{"summary": string}`;
}

/**
 * Parses a model's raw text response into a validated summary string. Tolerates responses
 * wrapped in a ```json fence, matching the other parsers' leniency.
 */
export function parseSummarizeTranscriptResponse(rawText: string): string {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`Failed to parse transcript summary JSON: ${(err as Error).message}`, { cause: err });
  }

  return SummarizeTranscriptResponseSchema.parse(parsed).summary;
}
