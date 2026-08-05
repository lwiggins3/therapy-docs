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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">Upload a transcript</h1>
      {patients.length === 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No patients yet —{" "}
          <a href="/patients" className="font-medium underline">
            add one first
          </a>
          .
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Patient
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
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
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Session date (optional)
          <input
            type="date"
            value={sessionDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSessionDate(e.target.value)}
            className="w-fit rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          File (PDF only)
          <input
            type="file"
            accept="application/pdf"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
            required
            className="text-sm font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={!therapistId || !patientId}
          className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Upload
        </button>
      </form>
      {status && <p className="text-sm text-gray-600">{status}</p>}
      <p>
        <a href="/transcripts" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to transcripts
        </a>
      </p>
    </div>
  );
}
