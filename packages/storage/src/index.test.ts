import { describe, expect, it } from "vitest";
import { createStorageClient } from "./index";
import { LocalDiskStorageClient } from "./local-disk";

describe("createStorageClient", () => {
  it("returns a LocalDiskStorageClient for the local provider", () => {
    expect(createStorageClient({ provider: "local", localDir: ".local-storage" })).toBeInstanceOf(
      LocalDiskStorageClient,
    );
  });

  it("throws for the gcs provider when no bucket is given", () => {
    expect(() => createStorageClient({ provider: "gcs" })).toThrow(/bucket is required/);
  });
});
