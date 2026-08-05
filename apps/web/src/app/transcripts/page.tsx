"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
    <main>
      <h1>Transcripts</h1>
      <p>
        <Link href="/transcripts/upload">Upload a transcript</Link>
      </p>
      {error && <p>Error: {error}</p>}
      <ul>
        {transcripts.map((transcript) => (
          <li key={transcript.id}>
            <Link href={`/transcripts/${transcript.id}`}>
              {transcript.patient.displayName} — {transcript.status}
            </Link>{" "}
            <button onClick={() => deleteTranscript(transcript.id, transcript.patient.displayName)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
