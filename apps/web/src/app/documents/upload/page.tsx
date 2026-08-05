"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiUrl, getDevTherapist } from "../../../lib/api";

type FolderUploadStatus = "pending" | "uploading" | "done" | "failed" | "skipped";

interface FolderUploadItem {
  path: string;
  file: File;
  status: FolderUploadStatus;
  error?: string;
}

function titleFromFile(file: File): string {
  const relativePath = file.webkitRelativePath || file.name;
  return relativePath.replace(/\.pdf$/i, "");
}

export default function UploadPage() {
  const router = useRouter();
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  const folderInputRef = useRef<HTMLInputElement>(null);
  const [folderItems, setFolderItems] = useState<FolderUploadItem[]>([]);
  const [folderUploading, setFolderUploading] = useState(false);

  useEffect(() => {
    getDevTherapist()
      .then((therapist) => setTherapistId(therapist.id))
      .catch((err) => setStatus(`Failed to load dev therapist: ${(err as Error).message}`));
  }, []);

  useEffect(() => {
    // Non-standard DOM attribute, not expressible as a JSX prop — set it imperatively instead.
    if (folderInputRef.current) {
      folderInputRef.current.webkitdirectory = true;
    }
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !therapistId) return;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    setStatus("Uploading...");
    const res = await fetch(`${apiUrl}/documents`, {
      method: "POST",
      headers: { "x-therapist-id": therapistId },
      body: formData,
    });

    if (res.ok) {
      router.push("/documents");
    } else {
      setStatus(`Upload failed (${res.status})`);
    }
  }

  function handleFolderSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setFolderItems(
      files.map((selected) => ({
        path: selected.webkitRelativePath || selected.name,
        file: selected,
        status: selected.type === "application/pdf" ? "pending" : "skipped",
      })),
    );
  }

  async function uploadFolder() {
    if (!therapistId) return;
    setFolderUploading(true);

    for (let i = 0; i < folderItems.length; i++) {
      if (folderItems[i]!.status !== "pending") continue;

      setFolderItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "uploading" } : item)));

      const formData = new FormData();
      formData.append("title", titleFromFile(folderItems[i]!.file));
      formData.append("file", folderItems[i]!.file);

      try {
        const res = await fetch(`${apiUrl}/documents`, {
          method: "POST",
          headers: { "x-therapist-id": therapistId },
          body: formData,
        });
        setFolderItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: res.ok ? "done" : "failed", error: res.ok ? undefined : `HTTP ${res.status}` } : item,
          ),
        );
      } catch (err) {
        setFolderItems((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "failed", error: (err as Error).message } : item)),
        );
      }
    }

    setFolderUploading(false);
  }

  const pendingCount = folderItems.filter((item) => item.status === "pending").length;

  return (
    <main>
      <h1>Upload a document</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Title
            <br />
            <input
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            File
            <br />
            <input
              type="file"
              accept="application/pdf"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
        </div>
        <button type="submit" disabled={!therapistId}>
          Upload
        </button>
      </form>
      <p>{status}</p>

      <h2>Upload a folder</h2>
      <p>
        Recursively uploads every PDF found in the selected folder and its subfolders (each titled after its
        filename); non-PDF files are skipped.
      </p>
      <input type="file" ref={folderInputRef} multiple onChange={handleFolderSelect} />
      {folderItems.length > 0 && (
        <>
          <p>
            <button onClick={() => void uploadFolder()} disabled={folderUploading || pendingCount === 0 || !therapistId}>
              {folderUploading ? "Uploading..." : `Upload ${pendingCount} PDF${pendingCount === 1 ? "" : "s"}`}
            </button>
          </p>
          <ul>
            {folderItems.map((item) => (
              <li key={item.path}>
                {item.path} — {item.status}
                {item.error && `: ${item.error}`}
              </li>
            ))}
          </ul>
        </>
      )}

      <p>
        <a href="/documents">Back to document library</a>
      </p>
    </main>
  );
}
