import { beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.fn().mockResolvedValue(undefined);
const download = vi.fn().mockResolvedValue([Buffer.from("downloaded content")]);
const file = vi.fn().mockReturnValue({ save, download });
const bucket = vi.fn().mockReturnValue({ file });

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn().mockImplementation(function StorageMock() {
    return { bucket };
  }),
}));

const { GcsStorageClient } = await import("./gcs");

describe("GcsStorageClient", () => {
  beforeEach(() => {
    save.mockClear();
    download.mockClear();
    file.mockClear();
    bucket.mockClear();
  });

  it("uploads to the configured bucket/key and returns a gs:// uri", async () => {
    const client = new GcsStorageClient({ bucket: "my-bucket" });
    const data = Buffer.from("some pdf bytes");

    const { uri } = await client.upload({ key: "documents/abc/file.pdf", data, contentType: "application/pdf" });

    expect(uri).toBe("gs://my-bucket/documents/abc/file.pdf");
    expect(bucket).toHaveBeenCalledWith("my-bucket");
    expect(file).toHaveBeenCalledWith("documents/abc/file.pdf");
    expect(save).toHaveBeenCalledWith(data, { contentType: "application/pdf" });
  });

  it("parses bucket and key out of a gs:// uri and downloads that object", async () => {
    const client = new GcsStorageClient({ bucket: "default-bucket" });

    const result = await client.download({ uri: "gs://other-bucket/some/key.pdf" });

    expect(bucket).toHaveBeenCalledWith("other-bucket");
    expect(file).toHaveBeenCalledWith("some/key.pdf");
    expect(result.toString()).toBe("downloaded content");
  });

  it("throws when downloading a uri that isn't gs://", async () => {
    const client = new GcsStorageClient({ bucket: "my-bucket" });

    await expect(client.download({ uri: "local://some/key.pdf" })).rejects.toThrow(/Not a gs:\/\/ URI/);
  });
});
