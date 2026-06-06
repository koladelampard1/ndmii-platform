import type { ImpactEvidenceRecord } from "@/lib/data/impact-evidence";

type EvidenceFileSummaryProps = {
  evidence: Pick<
    ImpactEvidenceRecord,
    | "file_name"
    | "original_filename"
    | "storage_bucket"
    | "storage_path"
    | "mime_type"
    | "file_size_bytes"
    | "checksum_sha256"
    | "uploaded_at"
    | "submitted_at"
    | "reviewed_at"
    | "archived_at"
  >;
};

function formatBytes(value: number | null) {
  if (!value) return "Size unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function EvidenceFileSummary({ evidence }: EvidenceFileSummaryProps) {
  const lifecycle = [
    ["Uploaded", formatTimestamp(evidence.uploaded_at)],
    ["Submitted", formatTimestamp(evidence.submitted_at)],
    ["Reviewed", formatTimestamp(evidence.reviewed_at)],
    ["Archived", formatTimestamp(evidence.archived_at)],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <>
      <p className="break-words font-medium text-slate-950">{evidence.original_filename ?? evidence.file_name}</p>
      <p className="mt-1 text-xs text-slate-500">
        {evidence.mime_type ?? "MIME unavailable"} · {formatBytes(evidence.file_size_bytes)}
      </p>
      <p className="mt-1 break-all text-[11px] text-slate-400">
        {evidence.storage_bucket && evidence.storage_path
          ? `${evidence.storage_bucket}/${evidence.storage_path}`
          : "Private storage metadata unavailable"}
      </p>
      <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
        SHA-256: {evidence.checksum_sha256 ?? "unavailable"}
      </p>
      {lifecycle.length > 0 && (
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          {lifecycle.map(([label, value]) => `${label} ${value}`).join(" · ")}
        </p>
      )}
    </>
  );
}
