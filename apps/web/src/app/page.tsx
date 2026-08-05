import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold text-gray-900">Therapy Docs</h1>
      <p className="text-sm text-gray-600">
        Document library, session transcripts, and recommendations will live here.
      </p>
      <p>
        <Link href="/documents" className="text-sm font-medium text-indigo-600 hover:underline">
          Document library
        </Link>
      </p>
    </div>
  );
}
