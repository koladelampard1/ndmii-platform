"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileBadge, Image as ImageIcon, LockKeyhole, Trash2, Upload } from "lucide-react";
import { Toast } from "@/components/ui/toast";

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
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const existingFileKeys = useMemo(
    () => new Set(documents.map((document) => `${document.original_filename.toLowerCase()}-${document.file_size_bytes}`)),
    [documents],
  );

  async function uploadEvidence(formData: FormData) {
    const file = formData.get("evidence");
    if (file instanceof File && existingFileKeys.has(`${file.name.toLowerCase()}-${file.size}`)) {
      setToast("This file is already attached to this requirement.");
      return;
    }

    setUploading(true);
    try {
      const response = await fetch("/api/msme/compliance/evidence", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setToast(payload?.error ?? "Evidence upload failed.");
        return;
      }
      setToast("Evidence uploaded. Private links are generated when opened.");
      setSelectedFile(null);
      startTransition(() => router.refresh());
    } catch {
      setToast("Evidence upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteEvidence(documentId: string) {
    setDeletingId(documentId);
    try {
      const response = await fetch(`/api/msme/compliance/evidence/${documentId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setToast(payload?.error ?? "Evidence delete failed.");
        return;
      }
      setToast("Evidence deleted from private storage.");
      startTransition(() => router.refresh());
    } catch {
      setToast("Evidence delete failed. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  function setDroppedFile(file: File) {
    setSelectedFile(file);
    const input = fileInputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Toast open={Boolean(toast)} message={toast} onClose={() => setToast("")} durationMs={3200} />
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

      <div className="mt-3 space-y-2">
        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
            <FileBadge className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 font-medium text-slate-700">No evidence uploaded yet.</p>
            <p className="mt-1">Attach a PDF or image before submitting this requirement for review.</p>
          </div>
        ) : (
          documents.map((document) => (
            <div key={document.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50">
                    {document.mime_type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/msme/compliance/evidence/${document.id}?disposition=inline`} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                    ) : (
                      <FileBadge className="h-6 w-6 text-rose-600" aria-label="PDF evidence" />
                    )}
                  </div>
                  <div className="min-w-0">
                  <p className="break-words font-medium text-slate-900">{document.original_filename}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {document.document_type.replaceAll("_", " ")} · {formatBytes(document.file_size_bytes)} · Uploaded {formatDateTime(document.uploaded_at)}
                  </p>
                  {document.mime_type === "application/pdf" ? <span className="mt-2 inline-flex rounded bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">PDF</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(document.id)}
                  disabled={deletingId === document.id || isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Delete ${document.original_filename}`}
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
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </a>
                <a
                  href={`/api/msme/compliance/evidence/${document.id}?disposition=attachment`}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
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
        ref={formRef}
        className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          void uploadEvidence(formData);
          event.currentTarget.reset();
        }}
      >
        <input type="hidden" name="compliance_item_id" value={complianceItemId} />
        <label
          className={`min-w-0 cursor-pointer rounded-lg border border-dashed px-3 py-3 text-xs transition focus-within:ring-2 focus-within:ring-emerald-600 sm:py-2 ${dragActive ? "border-emerald-600 bg-emerald-50" : "border-emerald-300 bg-white"}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files.item(0);
            if (file) setDroppedFile(file);
          }}
        >
          <span className="flex items-center gap-2 text-slate-700">
            <ImageIcon className="h-4 w-4 text-emerald-700" />
            {selectedFile ? selectedFile.name : "Choose or drop PDF/image evidence"}
          </span>
          <input
            ref={fileInputRef}
            name="evidence"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            required
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <select name="document_type" defaultValue="supporting_evidence" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
          <option value="certificate">Certificate</option>
          <option value="registration">Registration</option>
          <option value="tax_receipt">Tax receipt</option>
          <option value="permit">Permit</option>
          <option value="supporting_evidence">Evidence</option>
        </select>
        <button
          disabled={uploading || isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading" : "Upload Evidence"}
        </button>
      </form>
      {uploading ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label="Upload in progress">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-600" />
        </div>
      ) : null}

      {confirmDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby={`delete-${confirmDeleteId}`}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 id={`delete-${confirmDeleteId}`} className="text-base font-semibold text-slate-900">Delete evidence?</h3>
            <p className="mt-2 text-sm text-slate-600">This removes the file from private storage and keeps an audit record of the deletion.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-md border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Cancel</button>
              <button type="button" onClick={() => void deleteEvidence(confirmDeleteId)} disabled={Boolean(deletingId)} className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-60">Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
