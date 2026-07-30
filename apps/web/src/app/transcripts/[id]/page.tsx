"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  apiUrl,
  getDevTherapist,
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
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async () => {
    const res = await fetch(`${apiUrl}/recommendations?transcriptId=${transcriptId}`);
    if (res.ok) {
      setRecommendations((await res.json()) as RecommendationWithDocument[]);
    }
  }, [transcriptId]);

  useEffect(() => {
    getDevTherapist()
      .then(async (therapist) => {
        setTherapistId(therapist.id);

        const [transcriptRes, documentsRes] = await Promise.all([
          fetch(`${apiUrl}/transcripts/${transcriptId}`),
          fetch(`${apiUrl}/documents`, { headers: { "x-therapist-id": therapist.id } }),
        ]);
        if (transcriptRes.ok) {
          setTranscript((await transcriptRes.json()) as TranscriptWithPatient);
        }
        if (documentsRes.ok) {
          setLibraryDocuments((await documentsRes.json()) as LibraryDocument[]);
        }
        await loadRecommendations();
      })
      .catch((err) => setError((err as Error).message));
  }, [transcriptId, loadRecommendations]);

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

  const recommendedDocumentIds = new Set(recommendations.map((r) => r.documentId));
  const addableDocuments = libraryDocuments.filter((doc) => !recommendedDocumentIds.has(doc.id));

  return (
    <main>
      <h1>Recommendations</h1>
      {transcript && (
        <p>
          Patient: {transcript.patient.displayName} — {transcript.status}
        </p>
      )}
      {error && <p>Error: {error}</p>}
      <ul>
        {recommendations.map((recommendation) => (
          <li key={recommendation.id} style={{ marginBottom: "1rem" }}>
            <strong>{recommendation.document.title}</strong> — {recommendation.status}
            {recommendation.rationale && <p>{recommendation.rationale}</p>}
            {recommendation.status === "suggested" && (
              <>
                <button onClick={() => decide(recommendation.id, "accepted")}>Accept</button>
                <button onClick={() => decide(recommendation.id, "rejected")}>Reject</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <h2>Add a document</h2>
      <select value={addDocumentId} onChange={(e) => setAddDocumentId(e.target.value)}>
        <option value="" disabled>
          Select a document
        </option>
        {addableDocuments.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.title}
          </option>
        ))}
      </select>
      <button onClick={addDocument} disabled={!addDocumentId}>
        Add
      </button>
      <p>
        <a href="/transcripts">Back to transcripts</a>
      </p>
    </main>
  );
}
