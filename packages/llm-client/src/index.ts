import { ClaudeVertexLlmClient } from "./adapters/claude-vertex";
import { GeminiLlmClient } from "./adapters/gemini";
import type { LlmClient } from "./types";

export type { DocumentRecommendation, LlmClient, TagSuggestion } from "./types";
export { ClaudeVertexLlmClient } from "./adapters/claude-vertex";
export { GeminiLlmClient } from "./adapters/gemini";

export type LlmProvider = "claude-vertex" | "gemini";

/**
 * Factory that picks the configured provider. Call sites (apps/api, apps/worker) depend only
 * on the LlmClient interface, so LLM_PROVIDER can differ per environment or even per task
 * without touching business logic.
 */
export function createLlmClient(options: {
  provider: LlmProvider;
  projectId: string;
  location: string;
  /**
   * Vertex AI embedding models (gemini-embedding-001) need a real single region (e.g.
   * "us-central1") — unlike Claude on Model Garden, they aren't served through the "us"
   * multi-region. Defaults to `location` for backwards compatibility, but callers using Claude's
   * "us" multi-region as `location` must pass this separately (see apps/worker/src/main.ts).
   */
  embeddingLocation?: string;
}): LlmClient {
  const embeddingLocation = options.embeddingLocation ?? options.location;
  switch (options.provider) {
    case "claude-vertex":
      return new ClaudeVertexLlmClient({
        projectId: options.projectId,
        region: options.location,
        embeddingLocation,
      });
    case "gemini":
      return new GeminiLlmClient({
        projectId: options.projectId,
        location: options.location,
        embeddingLocation,
      });
    default:
      throw new Error(`Unknown LLM provider: ${options.provider satisfies never}`);
  }
}
