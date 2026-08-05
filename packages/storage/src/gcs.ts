import { Storage } from "@google-cloud/storage";
import type { StorageClient } from "./types";

function bucketAndKeyFromUri(uri: string): { bucket: string; key: string } {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Not a gs:// URI: ${uri}`);
  }
  const [, bucket, key] = match;
  return { bucket, key };
}

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
    const { bucket, key } = bucketAndKeyFromUri(input.uri);
    const [data] = await this.storage.bucket(bucket).file(key).download();
    return data;
  }

  async delete(input: { uri: string }): Promise<void> {
    const { bucket, key } = bucketAndKeyFromUri(input.uri);
    await this.storage.bucket(bucket).file(key).delete();
  }
}
