import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { StorageClient } from "./types";

function keyFromUri(uri: string): string {
  const match = /^local:\/\/(.+)$/.exec(uri);
  if (!match?.[1]) {
    throw new Error(`Not a local:// URI: ${uri}`);
  }
  return match[1];
}

/** Dev/test storage: writes under a local directory. URIs are `local://<key>`. */
export class LocalDiskStorageClient implements StorageClient {
  private readonly baseDir: string;

  constructor(options: { baseDir: string }) {
    this.baseDir = resolve(options.baseDir);
  }

  async upload(input: { key: string; data: Buffer; contentType: string }): Promise<{ uri: string }> {
    const path = join(this.baseDir, input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.data);
    return { uri: `local://${input.key}` };
  }

  async download(input: { uri: string }): Promise<Buffer> {
    return readFile(join(this.baseDir, keyFromUri(input.uri)));
  }

  async delete(input: { uri: string }): Promise<void> {
    await unlink(join(this.baseDir, keyFromUri(input.uri)));
  }
}
