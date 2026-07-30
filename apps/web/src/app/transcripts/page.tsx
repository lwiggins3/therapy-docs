"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, getDevTherapist, type TranscriptWithPatient } from "../../lib/api";

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<TranscriptWithPatient[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getDevTherapist()
      .then(async (therapist) => {
        const res = await fetch(`${apiUrl}/transcripts`, {
          headers: { "x-therapist-id": therapist.id },
        });
        if (res.ok) {
          setTranscripts((await res.json()) as TranscriptWithPatient[]);
        }
      })
      .catch((err) => setError((err as Error).message));
  }, []);

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
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
