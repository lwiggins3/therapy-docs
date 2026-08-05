"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "../../components/StatusBadge";
import { apiUrl, getDevTherapist, type TranscriptWithPatient } from "../../lib/api";

type SortOrder = "date-desc" | "date-asc" | "patient";

function transcriptDate(transcript: TranscriptWithPatient): string {
  return transcript.sessionDate ?? transcript.createdAt;
}

export default function TranscriptsPage() {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptWithPatient[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-desc");
  const [patientFilter, setPatientFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
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

  useEffect(() => {
    if (!therapistId) return;
    if (!transcripts.some((t) => t.status === "processing")) return;
    const timeout = setTimeout(() => void loadTranscripts(therapistId), 3000);
    return () => clearTimeout(timeout);
  }, [therapistId, transcripts, loadTranscripts]);

  const patients = useMemo(() => {
    const byId = new Map(transcripts.map((t) => [t.patientId, t.patient.displayName]));
    return Array.from(byId.entries());
  }, [transcripts]);

  const visibleTranscripts = useMemo(() => {
    let result = transcripts;
    if (patientFilter) {
      result = result.filter((t) => t.patientId === patientFilter);
    }
    if (dateFilter) {
      result = result.filter((t) => transcriptDate(t).slice(0, 10) === dateFilter);
    }
    return [...result].sort((a, b) => {
      if (sortOrder === "patient") {
        return a.patient.displayName.localeCompare(b.patient.displayName);
      }
      const diff = new Date(transcriptDate(a)).getTime() - new Date(transcriptDate(b)).getTime();
      return sortOrder === "date-asc" ? diff : -diff;
    });
  }, [transcripts, patientFilter, dateFilter, sortOrder]);

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
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Sort by
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="date-desc">Date (newest first)</option>
            <option value="date-asc">Date (oldest first)</option>
            <option value="patient">Patient (A→Z)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Patient
          <select
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All patients</option>
            {patients.map(([id, displayName]) => (
              <option key={id} value={id}>
                {displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Date
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Clear date
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {visibleTranscripts.map((transcript) => (
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
