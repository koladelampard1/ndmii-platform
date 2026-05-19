"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, LockKeyhole, Trash2, Upload } from "lucide-react";

type ComplianceEvidencePanelProps = {
  complianceItemId: string;
  documents: ComplianceEvidenceListItem[];
};

export type ComplianceEvidenceListItem = {
  id: string;
  compliance_item_id: string;
  document_type: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
  verified_at: string | null;
  expires_at: string | null;
};

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(value / 1024))} KB`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export function ComplianceEvidencePanel({ complianceItemId, documents }: ComplianceEvidencePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function uploadEvidence(formData: FormData) {
    setStatus(null);
    setUploading(true);
    try {
      const response = await fetch("/api/msme/compliance/evidence", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setStatus({ type: "error", message: payload?.error ?? "Evidence upload failed." });
        return;
      }
      setStatus({ type: "success", message: "Evidence uploaded. Private preview links are generated only when opened." });
      startTransition(() => router.refresh());
    } catch {
      setStatus({ type: "error", message: "Evidence upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  async function deleteEvidence(documentId: string) {
    setStatus(null);
    setDeletingId(documentId);
    try {
      const response = await fetch(`/api/msme/compliance/evidence/${documentId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setStatus({ type: "error", message: payload?.error ?? "Evidence delete failed." });
        return;
      }
      setStatus({ type: "success", message: "Evidence deleted from private storage." });
      startTransition(() => router.refresh());
    } catch {
      setStatus({ type: "error", message: "Evidence delete failed. Please try again." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <LockKeyhole className="h-4 w-4 text-emerald-700" />
          Private evidence
        </p>
        <span className="text-xs text-slate-500">{documents.length} document{documents.length === 1 ? "" : "s"}</span>
      </div>

      <p className="mt-1 text-xs text-slate-600">
        Files are stored in a private Supabase bucket. Preview and download links are short-lived and generated only after access checks.
      </p>

      {status ? (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-xs ${status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {status.message}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {documents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">No evidence uploaded for this requirement yet.</p>
        ) : (
          documents.map((document) => (
            <div key={document.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-900">{document.original_filename}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {document.document_type.replaceAll("_", " ")} · {formatBytes(document.file_size_bytes)} · Uploaded {formatDateTime(document.uploaded_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteEvidence(document.id)}
                  disabled={deletingId === document.id || isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === document.id ? "Deleting" : "Delete"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/api/msme/compliance/evidence/${document.id}?disposition=inline`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </a>
                <a
                  href={`/api/msme/compliance/evidence/${document.id}?disposition=attachment`}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          void uploadEvidence(formData);
          event.currentTarget.reset();
        }}
      >
        <input type="hidden" name="compliance_item_id" value={complianceItemId} />
        <input
          name="evidence"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="min-w-0 rounded-lg border border-dashed border-emerald-300 bg-white px-3 py-2 text-xs"
          required
        />
        <select name="document_type" defaultValue="supporting_evidence" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
          <option value="certificate">Certificate</option>
          <option value="registration">Registration</option>
          <option value="tax_receipt">Tax receipt</option>
          <option value="permit">Permit</option>
          <option value="supporting_evidence">Evidence</option>
        </select>
        <button
          disabled={uploading || isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading" : "Upload Evidence"}
        </button>
      </form>
    </div>
  );
}
