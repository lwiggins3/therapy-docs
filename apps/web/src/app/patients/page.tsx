"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Patient } from "@therapy-docs/shared-types";
import { apiUrl, getDevTherapist } from "../../lib/api";

export default function PatientsPage() {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [externalMrn, setExternalMrn] = useState("");
  const [error, setError] = useState("");

  const loadPatients = useCallback(async (id: string) => {
    const res = await fetch(`${apiUrl}/patients`, { headers: { "x-therapist-id": id } });
    if (res.ok) {
      setPatients((await res.json()) as Patient[]);
    }
  }, []);

  useEffect(() => {
    getDevTherapist()
      .then((therapist) => {
        setTherapistId(therapist.id);
        return loadPatients(therapist.id);
      })
      .catch((err) => setError((err as Error).message));
  }, [loadPatients]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!therapistId || !displayName.trim()) return;

    const res = await fetch(`${apiUrl}/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-therapist-id": therapistId },
      body: JSON.stringify({ displayName, externalMrn: externalMrn || undefined }),
    });

    if (res.ok) {
      setDisplayName("");
      setExternalMrn("");
      await loadPatients(therapistId);
    } else {
      setError(`Failed to add patient (${res.status})`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
        {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">Error: {error}</p>}
        <ul className="flex flex-col gap-2">
          {patients.map((patient) => (
            <li key={patient.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900">
              {patient.displayName}
              {patient.externalMrn ? ` (${patient.externalMrn})` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900">Add a patient</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Display name
            <input
              value={displayName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            External MRN (optional)
            <input
              value={externalMrn}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setExternalMrn(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <button
            type="submit"
            disabled={!therapistId}
            className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add patient
          </button>
        </form>
      </div>

      <p>
        <a href="/transcripts" className="text-sm font-medium text-indigo-600 hover:underline">
          Go to transcripts
        </a>
      </p>
    </div>
  );
}
