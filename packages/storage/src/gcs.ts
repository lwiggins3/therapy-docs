import { Storage } from "@google-cloud/storage";
import type { StorageClient } from "./types";

/** Real GCS-backed storage. URIs are `gs://<bucket>/<key>`. */
export class GcsStorageClient implements StorageClient {
  private readonly storage: Storage;
  private readonly bucket: string;

  constructor(options: { bucket: string }) {
    this.storage = new Storage();
    this.bucket = options.bucket;
  }

  async upload(input: { key: string; data: Buffer; contentType: string }): Promise<{ uri: string }> {
    const file = this.storage.bucket(this.bucket).file(input.key);
    await file.save(input.data, { contentType: input.contentType });
    return { uri: `gs://${this.bucket}/${input.key}` };
  }

  async download(input: { uri: string }): Promise<Buffer> {
    const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(input.uri);
    if (!match?.[1] || !match[2]) {
      throw new Error(`Not a gs:// URI: ${input.uri}`);
    }
    const [, bucket, key] = match;
    const [data] = await this.storage.bucket(bucket).file(key).download();
    return data;
  }
}
