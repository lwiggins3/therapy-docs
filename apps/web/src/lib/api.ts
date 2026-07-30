import type { Patient, RecommendationStatus } from "@therapy-docs/shared-types";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface DevTherapist {
  id: string;
  email: string;
  displayName: string;
}

export interface DocumentTagAssignment {
  tag: { id: string; label: string };
  source: "manual" | "llm_suggested";
  confirmed: boolean;
}

export interface LibraryDocument {
  id: string;
  title: string;
  status: "processing" | "ready" | "failed";
  tags: DocumentTagAssignment[];
}

export interface TranscriptWithPatient {
  id: string;
  patientId: string;
  status: "processing" | "ready" | "failed";
  sessionDate: string | null;
  createdAt: string;
  patient: Patient;
}

export interface RecommendationWithDocument {
  id: string;
  documentId: string;
  status: RecommendationStatus;
  rationale: string | null;
  document: { id: string; title: string };
}

export async function getDevTherapist(): Promise<DevTherapist> {
  const res = await fetch(`${apiUrl}/dev/therapist`);
  if (!res.ok) {
    throw new Error(`Failed to load dev therapist: ${res.status}`);
  }
  return (await res.json()) as DevTherapist;
}
