const STATUS_STYLES: Record<string, string> = {
  processing: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  suggested: "bg-blue-100 text-blue-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  added_by_therapist: "bg-violet-100 text-violet-800",
  pending: "bg-gray-100 text-gray-700",
  uploading: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
  skipped: "bg-gray-100 text-gray-500",
};

const FALLBACK_STYLE = "bg-gray-100 text-gray-700";

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? FALLBACK_STYLE;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
