"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { StatusBadge } from "../../components/StatusBadge";
import { apiUrl, getDevTherapist, type LibraryDocument } from "../../lib/api";

interface UpdateTagsBody {
  confirmTagIds?: string[];
  rejectTagIds?: string[];
  addLabels?: string[];
}

interface Tag {
  id: string;
  label: string;
}

function parseTagLabels(input: string): string[] {
  const labels = input
    .split(/[,\s]+/)
    .map((label) => label.trim())
    .filter(Boolean);
  return Array.from(new Set(labels));
}

export default function DocumentsPage() {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [newTagLabel, setNewTagLabel] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async (id: string) => {
    const res = await fetch(`${apiUrl}/documents`, { headers: { "x-therapist-id": id } });
    if (res.ok) {
      setDocuments((await res.json()) as LibraryDocument[]);
    }
  }, []);

  const loadTags = useCallback(async () => {
    const res = await fetch(`${apiUrl}/tags`);
    if (res.ok) {
      setTags((await res.json()) as Tag[]);
    }
  }, []);

  useEffect(() => {
    getDevTherapist()
      .then((therapist) => {
        setTherapistId(therapist.id);
        return Promise.all([loadDocuments(therapist.id), loadTags()]);
      })
      .catch((err) => setError((err as Error).message));
  }, [loadDocuments, loadTags]);

  const visibleDocuments = useMemo(() => {
    if (!tagFilter) return documents;
    return documents.filter((doc) => doc.tags.some((assignment) => assignment.tag.label === tagFilter));
  }, [documents, tagFilter]);

  useEffect(() => {
    if (!therapistId) return;
    if (!documents.some((doc) => doc.status === "processing")) return;
    const timeout = setTimeout(() => void loadDocuments(therapistId), 3000);
    return () => clearTimeout(timeout);
  }, [therapistId, documents, loadDocuments]);

  async function updateTags(documentId: string, body: UpdateTagsBody) {
    if (!therapistId) return;
    await fetch(`${apiUrl}/documents/${documentId}/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-therapist-id": therapistId },
      body: JSON.stringify(body),
    });
    await loadDocuments(therapistId);
  }

  async function deleteDocument(documentId: string, title: string) {
    if (!therapistId) return;
    if (!confirm(`Delete "${title}"? This also removes it from any past recommendations and drafts.`)) {
      return;
    }
    await fetch(`${apiUrl}/documents/${documentId}`, {
      method: "DELETE",
      headers: { "x-therapist-id": therapistId },
    });
    await loadDocuments(therapistId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Document library</h1>
        <Link href="/documents/upload" className="text-sm font-medium text-indigo-600 hover:underline">
          Upload a document
        </Link>
      </div>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">Error: {error}</p>}
      <label className="flex w-fit items-center gap-2 text-sm font-medium text-gray-700">
        Filter by tag
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.label}>
              {tag.label}
            </option>
          ))}
        </select>
      </label>
      <ul className="flex flex-col gap-4">
        {visibleDocuments.map((doc) => {
          const unconfirmedIds = doc.tags.filter((assignment) => !assignment.confirmed).map((assignment) => assignment.tag.id);
          return (
            <li key={doc.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="text-gray-900">{doc.title}</strong>
                  <StatusBadge status={doc.status} />
                </div>
                <button
                  onClick={() => deleteDocument(doc.id, doc.title)}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {doc.tags.map((assignment) => (
                  <li key={assignment.tag.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5">{assignment.tag.label}</span>
                    <span className="text-gray-500">
                      {assignment.source}
                      {assignment.confirmed ? "" : ", unconfirmed"}
                    </span>
                    {!assignment.confirmed && (
                      <>
                        <button
                          onClick={() => updateTags(doc.id, { confirmTagIds: [assignment.tag.id] })}
                          className="rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => updateTags(doc.id, { rejectTagIds: [assignment.tag.id] })}
                          className="rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {unconfirmedIds.length > 1 && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => updateTags(doc.id, { confirmTagIds: unconfirmedIds })}
                    className="rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Confirm all
                  </button>
                  <button
                    onClick={() => updateTags(doc.id, { rejectTagIds: unconfirmedIds })}
                    className="rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Reject all
                  </button>
                </div>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const labels = parseTagLabels(newTagLabel[doc.id] ?? "");
                  if (labels.length > 0) {
                    void updateTags(doc.id, { addLabels: labels });
                    setNewTagLabel((prev) => ({ ...prev, [doc.id]: "" }));
                  }
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  placeholder="Add tags (comma or space separated)"
                  value={newTagLabel[doc.id] ?? ""}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setNewTagLabel((prev) => ({ ...prev, [doc.id]: event.target.value }))
                  }
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Add tags
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
