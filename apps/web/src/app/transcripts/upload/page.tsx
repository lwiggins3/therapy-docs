"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Patient } from "@therapy-docs/shared-types";
import { apiUrl, getDevTherapist } from "../../../lib/api";

export default function UploadTranscriptPage() {
  const router = useRouter();
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getDevTherapist()
      .then(async (therapist) => {
        setTherapistId(therapist.id);
        const res = await fetch(`${apiUrl}/patients`, { headers: { "x-therapist-id": therapist.id } });
        if (res.ok) {
          setPatients((await res.json()) as Patient[]);
        }
      })
      .catch((err) => setStatus(`Failed to load dev therapist: ${(err as Error).message}`));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !therapistId || !patientId) return;

    const formData = new FormData();
    formData.append("patientId", patientId);
    if (sessionDate) {
      formData.append("sessionDate", sessionDate);
    }
    formData.append("file", file);

    setStatus("Uploading...");
    const res = await fetch(`${apiUrl}/transcripts`, {
      method: "POST",
      headers: { "x-therapist-id": therapistId },
      body: formData,
    });

    if (res.ok) {
      router.push("/transcripts");
    } else {
      setStatus(`Upload failed (${res.status})`);
    }
  }

  return (
    <main>
      <h1>Upload a transcript</h1>
      {patients.length === 0 && (
        <p>
          No patients yet — <a href="/patients">add one first</a>.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Patient
            <br />
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
              <option value="" disabled>
                Select a patient
              </option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Session date (optional)
            <br />
            <input
              type="date"
              value={sessionDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSessionDate(e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            File (PDF only)
            <br />
            <input
              type="file"
              accept="application/pdf"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
        </div>
        <button type="submit" disabled={!therapistId || !patientId}>
          Upload
        </button>
      </form>
      <p>{status}</p>
      <p>
        <a href="/transcripts">Back to transcripts</a>
      </p>
    </main>
  );
}
