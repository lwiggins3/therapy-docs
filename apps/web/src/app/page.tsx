import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Therapy Docs</h1>
      <p>Document library, session transcripts, and recommendations will live here.</p>
      <p>
        <Link href="/documents">Document library</Link>
      </p>
    </main>
  );
}
