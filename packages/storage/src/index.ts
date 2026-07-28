import { GcsStorageClient } from "./gcs";
import { LocalDiskStorageClient } from "./local-disk";
import type { StorageClient } from "./types";

export type { StorageClient } from "./types";
export { GcsStorageClient } from "./gcs";
export { LocalDiskStorageClient } from "./local-disk";

export type StorageProvider = "local" | "gcs";

export function createStorageClient(options: {
  provider: StorageProvider;
  bucket?: string;
  localDir?: string;
}): StorageClient {
  switch (options.provider) {
    case "gcs":
      if (!options.bucket) {
        throw new Error("createStorageClient: bucket is required for the gcs provider");
      }
      return new GcsStorageClient({ bucket: options.bucket });
    case "local":
      return new LocalDiskStorageClient({ baseDir: options.localDir ?? ".local-storage" });
    default:
      throw new Error(`Unknown storage provider: ${options.provider satisfies never}`);
  }
}
