import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import type { DocumentRecommendation, LlmClient, TagSuggestion } from "../types";
import { buildSuggestTagsPrompt, parseTagSuggestionsResponse } from "../suggest-tags";
import { embedWithVertexAi } from "../vertex-embedding";

/**
 * Claude on Vertex AI Model Garden. Traffic stays inside the GCP project boundary, so calls
 * here are covered by the GCP BAA — unlike a direct Anthropic API integration would be.
 */
export class ClaudeVertexLlmClient implements LlmClient {
  private readonly client: AnthropicVertex;
  private readonly model: string;
  private readonly projectId: string;
  private readonly region: string;

  constructor(options: { projectId: string; region: string; model?: string }) {
    this.client = new AnthropicVertex({
      projectId: options.projectId,
      region: options.region,
    });
    this.model = options.model ?? "claude-sonnet-5@20260101";
    this.projectId = options.projectId;
    this.region = options.region;
  }

  async suggestTags(input: { documentText: string; existingTags: string[] }): Promise<TagSuggestion[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildSuggestTagsPrompt(input) }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response contained no text block");
    }
    return parseTagSuggestionsResponse(textBlock.text);
  }

  async embed(input: { text: string }): Promise<number[]> {
    // Claude has no embeddings endpoint — delegate to the shared Vertex AI embedding model so
    // every adapter returns vectors from the same embedding space regardless of LLM_PROVIDER.
    return embedWithVertexAi({ projectId: this.projectId, location: this.region }, input.text);
  }

  async recommendDocuments(_input: {
    transcriptText: string;
    candidateDocuments: { id: string; title: string; summary: string }[];
  }): Promise<DocumentRecommendation[]> {
    // TODO: prompt Claude with the transcript + candidate summaries (post vector pre-filter),
    // ask for a ranked, justified subset, parse into DocumentRecommendation[].
    throw new Error("ClaudeVertexLlmClient.recommendDocuments not yet implemented");
  }

  async draftEmail(_input: {
    patientDisplayName: string;
    approvedDocuments: { id: string; title: string }[];
  }): Promise<{ subject: string; body: string }> {
    // TODO: prompt Claude for a warm, brief follow-up email listing the approved documents.
    // Output is a draft only — apps/api hands the result to the Gmail API drafts.create call.
    throw new Error("ClaudeVertexLlmClient.draftEmail not yet implemented");
  }
}
