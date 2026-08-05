import { VertexAI } from "@google-cloud/vertexai";
import type { DocumentRecommendation, LlmClient, TagFeedbackExample, TagSuggestion } from "../types";
import { buildDraftEmailPrompt, parseDraftEmailResponse } from "../draft-email";
import { buildRecommendDocumentsPrompt, parseRecommendDocumentsResponse } from "../recommend-documents";
import { buildSuggestTagsPrompt, parseTagSuggestionsResponse } from "../suggest-tags";
import { buildSummarizeTranscriptPrompt, parseSummarizeTranscriptResponse } from "../summarize-transcript";
import { embedWithVertexAi } from "../vertex-embedding";

/** Native Gemini on Vertex AI — first-party GCP product, simplest IAM/quota story. */
export class GeminiLlmClient implements LlmClient {
  private readonly vertexAi: VertexAI;
  private readonly model: string;
  private readonly embeddingModel: string;
  private readonly projectId: string;
  private readonly location: string;
  private readonly embeddingLocation: string;

  constructor(options: {
    projectId: string;
    location: string;
    model?: string;
    embeddingModel?: string;
    embeddingLocation?: string;
  }) {
    this.vertexAi = new VertexAI({ project: options.projectId, location: options.location });
    this.model = options.model ?? "gemini-2.5-pro";
    this.embeddingModel = options.embeddingModel ?? "gemini-embedding-001";
    this.projectId = options.projectId;
    this.location = options.location;
    this.embeddingLocation = options.embeddingLocation ?? options.location;
  }

  async suggestTags(input: {
    documentText: string;
    existingTags: string[];
    recentFeedback: TagFeedbackExample[];
  }): Promise<TagSuggestion[]> {
    const model = this.vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(buildSuggestTagsPrompt(input));
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini response contained no text");
    }
    return parseTagSuggestionsResponse(text);
  }

  async embed(input: { text: string }): Promise<number[]> {
    return embedWithVertexAi(
      { projectId: this.projectId, location: this.embeddingLocation, model: this.embeddingModel },
      input.text,
    );
  }

  async recommendDocuments(input: {
    transcriptText: string;
    candidateDocuments: { id: string; title: string; summary: string }[];
  }): Promise<DocumentRecommendation[]> {
    const model = this.vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(buildRecommendDocumentsPrompt(input));
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini response contained no text");
    }
    return parseRecommendDocumentsResponse(text);
  }

  async draftEmail(input: {
    patientDisplayName: string;
    approvedDocuments: { id: string; title: string }[];
  }): Promise<{ subject: string; body: string }> {
    const model = this.vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(buildDraftEmailPrompt(input));
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini response contained no text");
    }
    return parseDraftEmailResponse(text);
  }

  async summarizeTranscript(input: { transcriptText: string }): Promise<string> {
    const model = this.vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(buildSummarizeTranscriptPrompt(input));
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini response contained no text");
    }
    return parseSummarizeTranscriptResponse(text);
  }
}
