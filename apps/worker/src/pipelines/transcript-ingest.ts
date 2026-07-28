import type { PubSubTranscriptIngestMessage } from "@therapy-docs/shared-types";

/**
 * Transcript ingestion + recommendation pipeline: extract text, embed it, pre-filter candidate
 * library documents via vector similarity, then ask the LLM to rank/justify a final shortlist.
 * Every step that touches transcript content must log through @therapy-docs/audit.
 */
export async function handleTranscriptIngest(message: PubSubTranscriptIngestMessage): Promise<void> {
  // TODO:
  // 1. Fetch the file from message.gcsUri; extract text (Document AI if needed).
  // 2. Record an audit event (action: "transcript.llm_process") before sending text to the LLM.
  // 3. Generate an embedding, pgvector-search LibraryDocument for the top-N candidates.
  // 4. Call llmClient.recommendDocuments(...) with the transcript text + candidate summaries.
  // 5. Insert Recommendation rows (status: "suggested") for the therapist to review in apps/web.
  // 6. Update Transcript.status to "ready" (or "failed" on error).
  console.log(`TODO: ingest transcript ${message.transcriptId} from ${message.gcsUri}`);
}
