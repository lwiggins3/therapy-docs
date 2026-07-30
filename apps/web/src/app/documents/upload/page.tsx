"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiUrl, getDevTherapist } from "../../../lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getDevTherapist()
      .then((therapist) => setTherapistId(therapist.id))
      .catch((err) => setStatus(`Failed to load dev therapist: ${(err as Error).message}`));
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
      <p>
        <a href="/documents">Back to document library</a>
      </p>
    </main>
  );
}
