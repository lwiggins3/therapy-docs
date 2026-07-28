"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { apiUrl, getDevTherapist, type LibraryDocument } from "../../lib/api";

interface UpdateTagsBody {
  confirmTagIds?: string[];
  rejectTagIds?: string[];
  addLabels?: string[];
}

export default function DocumentsPage() {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [newTagLabel, setNewTagLabel] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async (id: string) => {
    const res = await fetch(`${apiUrl}/documents`, { headers: { "x-therapist-id": id } });
    if (res.ok) {
      setDocuments((await res.json()) as LibraryDocument[]);
    }
  }, []);

  useEffect(() => {
    getDevTherapist()
      .then((therapist) => {
        setTherapistId(therapist.id);
        return loadDocuments(therapist.id);
      })
      .catch((err) => setError((err as Error).message));
  }, [loadDocuments]);

  async function updateTags(documentId: string, body: UpdateTagsBody) {
    if (!therapistId) return;
    await fetch(`${apiUrl}/documents/${documentId}/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-therapist-id": therapistId },
      body: JSON.stringify(body),
    });
    await loadDocuments(therapistId);
  }

  return (
    <main>
      <h1>Document library</h1>
      <p>
        <Link href="/documents/upload">Upload a document</Link>
      </p>
      {error && <p>Error: {error}</p>}
      <ul>
        {documents.map((doc) => (
          <li key={doc.id} style={{ marginBottom: "1.5rem" }}>
            <strong>{doc.title}</strong> — {doc.status}
            <ul>
              {doc.tags.map((assignment) => (
                <li key={assignment.tag.id}>
                  {assignment.tag.label} ({assignment.source}
                  {assignment.confirmed ? "" : ", unconfirmed"})
                  {!assignment.confirmed && (
                    <>
                      {" "}
                      <button
                        onClick={() => updateTags(doc.id, { confirmTagIds: [assignment.tag.id] })}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => updateTags(doc.id, { rejectTagIds: [assignment.tag.id] })}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const label = newTagLabel[doc.id]?.trim();
                if (label) {
                  void updateTags(doc.id, { addLabels: [label] });
                  setNewTagLabel((prev) => ({ ...prev, [doc.id]: "" }));
                }
              }}
            >
              <input
                placeholder="Add tag"
                value={newTagLabel[doc.id] ?? ""}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setNewTagLabel((prev) => ({ ...prev, [doc.id]: event.target.value }))
                }
              />
              <button type="submit">Add tag</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
