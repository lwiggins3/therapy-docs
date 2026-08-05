"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "../../../components/StatusBadge";
import {
  apiUrl,
  getDevTherapist,
  type EmailDraftWithDocuments,
  type LibraryDocument,
  type RecommendationWithDocument,
  type TranscriptWithPatient,
} from "../../../lib/api";

export default function TranscriptReviewPage() {
  const params = useParams<{ id: string }>();
  const transcriptId = params.id;

  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptWithPatient | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationWithDocument[]>([]);
  const [libraryDocuments, setLibraryDocuments] = useState<LibraryDocument[]>([]);
  const [addDocumentId, setAddDocumentId] = useState("");
  const [emailDrafts, setEmailDrafts] = useState<EmailDraftWithDocuments[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");

  const loadTranscript = useCallback(async () => {
    const res = await fetch(`${apiUrl}/transcripts/${transcriptId}`);
    if (res.ok) {
      setTranscript((await res.json()) as TranscriptWithPatient);
    }
  }, [transcriptId]);

  const loadRecommendations = useCallback(async () => {
    const res = await fetch(`${apiUrl}/recommendations?transcriptId=${transcriptId}`);
    if (res.ok) {
      setRecommendations((await res.json()) as RecommendationWithDocument[]);
    }
  }, [transcriptId]);

  const loadEmailDrafts = useCallback(async () => {
    const res = await fetch(`${apiUrl}/email-drafts?transcriptId=${transcriptId}`);
    if (res.ok) {
      setEmailDrafts((await res.json()) as EmailDraftWithDocuments[]);
    }
  }, [transcriptId]);

  useEffect(() => {
    getDevTherapist()
      .then(async (therapist) => {
        setTherapistId(therapist.id);

        const documentsRes = await fetch(`${apiUrl}/documents`, { headers: { "x-therapist-id": therapist.id } });
        if (documentsRes.ok) {
          setLibraryDocuments((await documentsRes.json()) as LibraryDocument[]);
        }
        await loadTranscript();
        await loadRecommendations();
        await loadEmailDrafts();
      })
      .catch((err) => setError((err as Error).message));
  }, [transcriptId, loadTranscript, loadRecommendations, loadEmailDrafts]);

  useEffect(() => {
    if (!therapistId) return;
    if (transcript?.status !== "processing") return;
    const timeout = setTimeout(() => {
      void loadTranscript();
      void loadRecommendations();
    }, 3000);
    return () => clearTimeout(timeout);
  }, [therapistId, transcript, loadTranscript, loadRecommendations]);

  async function decide(recommendationId: string, status: "accepted" | "rejected") {
    if (!therapistId) return;
    await fetch(`${apiUrl}/recommendations/${recommendationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-therapist-id": therapistId },
      body: JSON.stringify({ status }),
    });
    await loadRecommendations();
  }

  async function addDocument() {
    if (!therapistId || !addDocumentId) return;
    await fetch(`${apiUrl}/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-therapist-id": therapistId },
      body: JSON.stringify({ transcriptId, documentId: addDocumentId }),
    });
    setAddDocumentId("");
    await loadRecommendations();
  }

  async function finalizeDraft() {
    if (!therapistId) return;
    setFinalizing(true);
    setError("");
    const res = await fetch(`${apiUrl}/email-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-therapist-id": therapistId },
      body: JSON.stringify({ transcriptId }),
    });
    if (res.ok) {
      await loadEmailDrafts();
    } else {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? `Failed to create draft (${res.status})`);
    }
    setFinalizing(false);
  }

  const recommendedDocumentIds = new Set(recommendations.map((r) => r.documentId));
  const addableDocuments = libraryDocuments.filter((doc) => !recommendedDocumentIds.has(doc.id));
  const hasApprovedRecommendation = recommendations.some(
    (r) => r.status === "accepted" || r.status === "added_by_therapist",
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">Recommendations</h1>
        {transcript && (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            Patient: <span className="font-medium text-gray-900">{transcript.patient.displayName}</span>
            <StatusBadge status={transcript.status} />
          </p>
        )}
        {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">Error: {error}</p>}
      </div>

      {transcript?.summary && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Session summary</h2>
          <p className="mt-2 text-sm text-gray-600">{transcript.summary}</p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {recommendations.map((recommendation) => (
          <li key={recommendation.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <strong className="text-gray-900">{recommendation.document.title}</strong>
                <StatusBadge status={recommendation.status} />
              </div>
              {recommendation.status === "suggested" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(recommendation.id, "accepted")}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => decide(recommendation.id, "rejected")}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
            {recommendation.rationale && <p className="mt-2 text-sm text-gray-600">{recommendation.rationale}</p>}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900">Add a document</h2>
        <div className="flex gap-2">
          <select
            value={addDocumentId}
            onChange={(e) => setAddDocumentId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="" disabled>
              Select a document
            </option>
            {addableDocuments.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
          <button
            onClick={addDocument}
            disabled={!addDocumentId}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900">Follow-up email</h2>
        {hasApprovedRecommendation ? (
          <button
            onClick={finalizeDraft}
            disabled={finalizing}
            className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finalizing ? "Creating draft..." : "Finalize & create draft"}
          </button>
        ) : (
          <p className="text-sm text-gray-600">Accept or add at least one document before creating a draft.</p>
        )}
        <ul className="flex flex-col gap-3">
          {emailDrafts.map((draft) => (
            <li key={draft.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <strong className="text-gray-900">{draft.subject}</strong>
              <p className="mt-1 text-sm text-gray-600">{draft.body}</p>
              <p className="mt-2 text-xs text-gray-500">
                Created as a draft in your Gmail — open Gmail to add a recipient and send.
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p>
        <a href="/transcripts" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to transcripts
        </a>
      </p>
    </div>
  );
}
