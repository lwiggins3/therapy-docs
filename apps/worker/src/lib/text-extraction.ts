import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

/**
 * Text extraction, mirroring the interface-plus-adapters pattern in @therapy-docs/llm-client
 * and @therapy-docs/storage. Only apps/worker needs this today, so it lives here rather than
 * as a shared package.
 */
export interface TextExtractor {
  extractText(input: { data: Buffer; mimeType: string }): Promise<string>;
}

/**
 * Dev/test default: decodes bytes as UTF-8. Correct for .txt/.md; a known, documented
 * limitation for PDFs/scans locally — those need DocumentAiTextExtractor and real credentials.
 */
export class PlainTextTextExtractor implements TextExtractor {
  async extractText(input: { data: Buffer }): Promise<string> {
    return input.data.toString("utf-8");
  }
}

/**
 * Real OCR/text extraction via Document AI. Requires a processor already provisioned in the
 * GCP project (DOCUMENT_AI_PROCESSOR_ID) — not something this code can create for you.
 *
 * NOTE: written to the documented Document AI request/response shape but not verified against
 * a live processor in this environment (no GCP credentials here) — smoke-test once real access
 * exists (see docs/roadmap.md item 2).
 */
export class DocumentAiTextExtractor implements TextExtractor {
  private readonly client: DocumentProcessorServiceClient;
  private readonly processorName: string;

  constructor(options: { projectId: string; location: string; processorId: string }) {
    this.client = new DocumentProcessorServiceClient({
      apiEndpoint: `${options.location}-documentai.googleapis.com`,
    });
    this.processorName = `projects/${options.projectId}/locations/${options.location}/processors/${options.processorId}`;
  }

  async extractText(input: { data: Buffer; mimeType: string }): Promise<string> {
    const [result] = await this.client.processDocument({
      name: this.processorName,
      rawDocument: { content: input.data, mimeType: input.mimeType },
    });
    return result.document?.text ?? "";
  }
}

export type TextExtractorProvider = "plain" | "document-ai";

export function createTextExtractor(options: {
  provider: TextExtractorProvider;
  projectId?: string;
  location?: string;
  processorId?: string;
}): TextExtractor {
  switch (options.provider) {
    case "plain":
      return new PlainTextTextExtractor();
    case "document-ai":
      if (!options.projectId || !options.location || !options.processorId) {
        throw new Error(
          "createTextExtractor: projectId, location, and processorId are required for document-ai",
        );
      }
      return new DocumentAiTextExtractor({
        projectId: options.projectId,
        location: options.location,
        processorId: options.processorId,
      });
    default:
      throw new Error(`Unknown text extractor provider: ${options.provider satisfies never}`);
  }
}
