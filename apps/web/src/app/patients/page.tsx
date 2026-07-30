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
    <main>
      <h1>Patients</h1>
      {error && <p>Error: {error}</p>}
      <ul>
        {patients.map((patient) => (
          <li key={patient.id}>
            {patient.displayName}
            {patient.externalMrn ? ` (${patient.externalMrn})` : ""}
          </li>
        ))}
      </ul>
      <h2>Add a patient</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Display name
            <br />
            <input
              value={displayName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            External MRN (optional)
            <br />
            <input
              value={externalMrn}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setExternalMrn(e.target.value)}
            />
          </label>
        </div>
        <button type="submit" disabled={!therapistId}>
          Add patient
        </button>
      </form>
      <p>
        <a href="/transcripts">Go to transcripts</a>
      </p>
    </main>
  );
}
