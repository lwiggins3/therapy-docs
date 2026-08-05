"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "../../components/StatusBadge";
import { apiUrl, getDevTherapist, type TranscriptWithPatient } from "../../lib/api";

export default function TranscriptsPage() {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptWithPatient[]>([]);
  const [error, setError] = useState("");

  const loadTranscripts = useCallback(async (id: string) => {
    const res = await fetch(`${apiUrl}/transcripts`, { headers: { "x-therapist-id": id } });
    if (res.ok) {
      setTranscripts((await res.json()) as TranscriptWithPatient[]);
    }
  }, []);

  useEffect(() => {
    getDevTherapist()
      .then((therapist) => {
        setTherapistId(therapist.id);
        return loadTranscripts(therapist.id);
      })
      .catch((err) => setError((err as Error).message));
  }, [loadTranscripts]);

  async function deleteTranscript(transcriptId: string, patientDisplayName: string) {
    if (!therapistId) return;
    if (
      !confirm(
        `Delete the transcript for "${patientDisplayName}"? This also removes its recommendations and any drafted emails.`,
      )
    ) {
      return;
    }
    await fetch(`${apiUrl}/transcripts/${transcriptId}`, {
      method: "DELETE",
      headers: { "x-therapist-id": therapistId },
    });
    await loadTranscripts(therapistId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Transcripts</h1>
        <Link href="/transcripts/upload" className="text-sm font-medium text-indigo-600 hover:underline">
          Upload a transcript
        </Link>
      </div>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">Error: {error}</p>}
      <ul className="flex flex-col gap-3">
        {transcripts.map((transcript) => (
          <li
            key={transcript.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <Link href={`/transcripts/${transcript.id}`} className="flex items-center gap-2 text-sm text-gray-900 hover:text-indigo-600">
              <span className="font-medium">{transcript.patient.displayName}</span>
              <StatusBadge status={transcript.status} />
            </Link>
            <button
              onClick={() => deleteTranscript(transcript.id, transcript.patient.displayName)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
