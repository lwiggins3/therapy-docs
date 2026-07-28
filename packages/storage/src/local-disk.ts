import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { StorageClient } from "./types";

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
    const match = /^local:\/\/(.+)$/.exec(input.uri);
    if (!match?.[1]) {
      throw new Error(`Not a local:// URI: ${input.uri}`);
    }
    return readFile(join(this.baseDir, match[1]));
  }
}
