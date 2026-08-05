import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/documents", label: "Documents" },
  { href: "/patients", label: "Patients" },
  { href: "/transcripts", label: "Transcripts" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
        <span className="font-semibold text-gray-900">Therapy Docs</span>
        <div className="flex gap-4 text-sm">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-gray-600 hover:text-indigo-600">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
