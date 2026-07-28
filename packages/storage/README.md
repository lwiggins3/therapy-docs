# @therapy-docs/storage

Provider-agnostic file storage, used by `apps/api` (uploads) and `apps/worker` (downloads for
text extraction). Mirrors the adapter pattern in `@therapy-docs/llm-client`.

## Usage

```ts
import { createStorageClient } from "@therapy-docs/storage";

const storage = createStorageClient({
  provider: (process.env.STORAGE_PROVIDER as "local" | "gcs") ?? "local",
  bucket: process.env.GCS_DOCUMENTS_BUCKET,
  localDir: process.env.LOCAL_STORAGE_DIR,
});

const { uri } = await storage.upload({ key: `documents/${id}`, data, contentType });
const data = await storage.download({ uri });
```

## Key files

- `src/types.ts` — the `StorageClient` interface: `upload`, `download`.
- `src/gcs.ts` — `GcsStorageClient`, real GCS via `@google-cloud/storage`. URIs: `gs://bucket/key`.
- `src/local-disk.ts` — `LocalDiskStorageClient`, dev/test only. Writes under `LOCAL_STORAGE_DIR`
  (default `.local-storage/`, gitignored). URIs: `local://key`.
- `src/index.ts` — `createStorageClient({ provider, bucket, localDir })` factory.

## Notes

Each running process is configured with exactly one provider (`STORAGE_PROVIDER=local|gcs`) —
`download()` expects URIs produced by an `upload()` from the *same* provider, not mixed schemes.
