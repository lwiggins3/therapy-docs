import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDiskStorageClient } from "./local-disk";

describe("LocalDiskStorageClient", () => {
  let baseDir: string;
  let client: LocalDiskStorageClient;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "storage-test-"));
    client = new LocalDiskStorageClient({ baseDir });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("writes the file under baseDir and returns a local:// uri", async () => {
    const { uri } = await client.upload({
      key: "documents/abc/file.pdf",
      data: Buffer.from("hello world"),
      contentType: "application/pdf",
    });

    expect(uri).toBe("local://documents/abc/file.pdf");
    const onDisk = await readFile(join(baseDir, "documents/abc/file.pdf"));
    expect(onDisk.toString()).toBe("hello world");
  });

  it("creates nested directories for keys that don't exist yet", async () => {
    await client.upload({
      key: "deeply/nested/path/file.txt",
      data: Buffer.from("nested"),
      contentType: "text/plain",
    });

    await expect(readFile(join(baseDir, "deeply/nested/path/file.txt"), "utf-8")).resolves.toBe("nested");
  });

  it("round-trips arbitrary binary content exactly through upload then download", async () => {
    const data = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10]);
    const { uri } = await client.upload({ key: "binary.bin", data, contentType: "application/octet-stream" });

    const downloaded = await client.download({ uri });

    expect(downloaded).toEqual(data);
  });

  it("throws when downloading a uri that isn't local://", async () => {
    await expect(client.download({ uri: "gs://some-bucket/file.pdf" })).rejects.toThrow(/Not a local:\/\/ URI/);
  });

  it("removes the file on delete so a subsequent download fails", async () => {
    const { uri } = await client.upload({
      key: "to-delete.txt",
      data: Buffer.from("bye"),
      contentType: "text/plain",
    });

    await client.delete({ uri });

    await expect(client.download({ uri })).rejects.toThrow();
  });

  it("throws when deleting a uri that isn't local://", async () => {
    await expect(client.delete({ uri: "gs://some-bucket/file.pdf" })).rejects.toThrow(/Not a local:\/\/ URI/);
  });
});
