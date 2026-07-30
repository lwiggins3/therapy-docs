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
    <main>
      <h1>Settings</h1>
      {error && <p>Error: {error}</p>}
      <h2>Gmail</h2>
      {connected === null && <p>Loading...</p>}
      {connected === true && <p>Connected — draft emails will be created in your Gmail account.</p>}
      {connected === false && (
        <>
          <p>Not connected. Connect your Gmail account to create draft follow-up emails.</p>
          <button onClick={connectGmail}>Connect Gmail</button>
        </>
      )}
      <p>
        <a href="/transcripts">Back to transcripts</a>
      </p>
    </main>
  );
}
