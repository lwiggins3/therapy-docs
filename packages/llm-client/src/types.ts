/**
 * Provider-agnostic LLM interface. apps/api and apps/worker depend on this, never on a
 * specific SDK — swapping Claude-on-Vertex for Gemini (or running both side by side per task)
 * means changing LLM_PROVIDER/env config, not call sites.
 */
export interface TagSuggestion {
  label: string;
  confidence: number;
}

/** A past therapist decision on an llm_suggested tag, fed back into suggestTags() as a few-shot example. */
export interface TagFeedbackExample {
  label: string;
  decision: "accepted" | "rejected";
}

export interface DocumentRecommendation {
  documentId: string;
  rationale: string;
  score: number;
}

export interface LlmClient {
  /** Suggest tags for a newly uploaded library document, for therapist review. */
  suggestTags(input: {
    documentText: string;
    existingTags: string[];
    recentFeedback: TagFeedbackExample[];
  }): Promise<TagSuggestion[]>;

  /** Produce a float embedding for similarity search (documents and transcripts share the same space). */
  embed(input: { text: string }): Promise<number[]>;

  /** Rank/explain candidate library documents against a session transcript. */
  recommendDocuments(input: {
    transcriptText: string;
    candidateDocuments: { id: string; title: string; summary: string }[];
  }): Promise<DocumentRecommendation[]>;

  /** Draft a patient-facing follow-up email body. Never sent by this call — draft only. */
  draftEmail(input: {
    patientDisplayName: string;
    approvedDocuments: { id: string; title: string }[];
  }): Promise<{ subject: string; body: string }>;

  /** Produce a short factual recap of a session transcript, for the therapist's quick reference. */
  summarizeTranscript(input: { transcriptText: string }): Promise<string>;
}
