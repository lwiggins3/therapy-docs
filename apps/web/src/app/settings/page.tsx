"use client";

import { useEffect, useState } from "react";
import { apiUrl, getDevTherapist } from "../../lib/api";

export default function SettingsPage() {
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDevTherapist()
      .then(async (therapist) => {
        setTherapistId(therapist.id);
        const res = await fetch(`${apiUrl}/gmail/status`, {
          headers: { "x-therapist-id": therapist.id },
        });
        if (res.ok) {
          setConnected(((await res.json()) as { connected: boolean }).connected);
        }
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  async function connectGmail() {
    if (!therapistId) return;
    const res = await fetch(`${apiUrl}/gmail/auth-url`, {
      headers: { "x-therapist-id": therapistId },
    });
    if (res.ok) {
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">Error: {error}</p>}

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Gmail</h2>
        {connected === null && <p className="text-sm text-gray-500">Loading...</p>}
        {connected === true && (
          <p className="text-sm text-emerald-700">Connected — draft emails will be created in your Gmail account.</p>
        )}
        {connected === false && (
          <>
            <p className="text-sm text-gray-600">
              Not connected. Connect your Gmail account to create draft follow-up emails.
            </p>
            <button
              onClick={connectGmail}
              className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Connect Gmail
            </button>
          </>
        )}
      </div>

      <p>
        <a href="/transcripts" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to transcripts
        </a>
      </p>
    </div>
  );
}
