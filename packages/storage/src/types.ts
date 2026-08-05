/**
 * Provider-agnostic file storage, mirroring the adapter pattern in @therapy-docs/llm-client.
 * apps/api uploads (documents, transcripts); apps/worker downloads (for text extraction).
 */
export interface StorageClient {
  upload(input: { key: string; data: Buffer; contentType: string }): Promise<{ uri: string }>;
  download(input: { uri: string }): Promise<Buffer>;
  delete(input: { uri: string }): Promise<void>;
}
