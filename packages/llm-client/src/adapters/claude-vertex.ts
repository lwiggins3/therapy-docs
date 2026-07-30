import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import type { DocumentRecommendation, LlmClient, TagSuggestion } from "../types";
import { buildDraftEmailPrompt, parseDraftEmailResponse } from "../draft-email";
import { buildRecommendDocumentsPrompt, parseRecommendDocumentsResponse } from "../recommend-documents";
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
  private readonly embeddingLocation: string;

  constructor(options: { projectId: string; region: string; model?: string; embeddingLocation?: string }) {
    this.client = new AnthropicVertex({
      projectId: options.projectId,
      region: options.region,
    });
    this.model = options.model ?? "claude-sonnet-5@20260101";
    this.projectId = options.projectId;
    this.region = options.region;
    this.embeddingLocation = options.embeddingLocation ?? options.region;
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
    // Uses embeddingLocation, not this.region: Claude on Model Garden is served through the "us"
    // multi-region, but the embedding model needs a real single region (e.g. "us-central1").
    return embedWithVertexAi({ projectId: this.projectId, location: this.embeddingLocation }, input.text);
  }

  async recommendDocuments(input: {
    transcriptText: string;
    candidateDocuments: { id: string; title: string; summary: string }[];
  }): Promise<DocumentRecommendation[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildRecommendDocumentsPrompt(input) }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response contained no text block");
    }
    return parseRecommendDocumentsResponse(textBlock.text);
  }

  async draftEmail(input: {
    patientDisplayName: string;
    approvedDocuments: { id: string; title: string }[];
  }): Promise<{ subject: string; body: string }> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildDraftEmailPrompt(input) }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response contained no text block");
    }
    return parseDraftEmailResponse(textBlock.text);
  }
}
