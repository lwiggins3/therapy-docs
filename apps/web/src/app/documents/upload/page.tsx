"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "../../../components/StatusBadge";
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Upload a document</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Title
            <input
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            File
            <input
              type="file"
              accept="application/pdf"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
              required
              className="text-sm font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={!therapistId}
            className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload
          </button>
        </form>
        {status && <p className="text-sm text-gray-600">{status}</p>}
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900">Upload a folder</h2>
        <p className="text-sm text-gray-600">
          Recursively uploads every PDF found in the selected folder and its subfolders (each titled after its
          filename); non-PDF files are skipped.
        </p>
        <input type="file" ref={folderInputRef} multiple onChange={handleFolderSelect} className="text-sm" />
        {folderItems.length > 0 && (
          <>
            <button
              onClick={() => void uploadFolder()}
              disabled={folderUploading || pendingCount === 0 || !therapistId}
              className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {folderUploading ? "Uploading..." : `Upload ${pendingCount} PDF${pendingCount === 1 ? "" : "s"}`}
            </button>
            <ul className="flex flex-col gap-2">
              {folderItems.map((item) => (
                <li key={item.path} className="flex items-center gap-2 text-sm text-gray-700">
                  <StatusBadge status={item.status} />
                  <span>{item.path}</span>
                  {item.error && <span className="text-red-700">: {item.error}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p>
        <a href="/documents" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to document library
        </a>
      </p>
    </div>
  );
}
