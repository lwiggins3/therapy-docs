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
}): LlmClient {
  switch (options.provider) {
    case "claude-vertex":
      return new ClaudeVertexLlmClient({ projectId: options.projectId, region: options.location });
    case "gemini":
      return new GeminiLlmClient({ projectId: options.projectId, location: options.location });
    default:
      throw new Error(`Unknown LLM provider: ${options.provider satisfies never}`);
  }
}
