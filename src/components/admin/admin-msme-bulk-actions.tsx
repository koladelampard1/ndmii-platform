"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, FileCheck2, Flag } from "lucide-react";
import { Toast } from "@/components/ui/toast";
import { submitBulkAdminMsmeAction } from "@/app/dashboard/admin/msmes/actions";

export function AdminMsmeBulkActions({ exportHref }: { exportHref: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<"flag" | "request_profile_review" | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onChange(event: Event) {
      const target = event.target as HTMLInputElement | null;
      if (!target?.matches("[data-msme-bulk-checkbox]")) return;
      const boxes = Array.from(document.querySelectorAll<HTMLInputElement>("[data-msme-bulk-checkbox]:checked"));
      setSelected(boxes.map((box) => box.value));
    }
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  const disabled = selected.length === 0;
  const selectedExportHref = selected.length
    ? `${exportHref}${exportHref.includes("?") ? "&" : "?"}ids=${encodeURIComponent(selected.join(","))}`
    : exportHref;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toast open={Boolean(toast)} message={toast} onClose={() => setToast("")} durationMs={3200} />
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{selected.length} selected</span>
      <button type="button" disabled={disabled} onClick={() => setAction("flag")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900 disabled:opacity-40">
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Flag
      </button>
      <button type="button" disabled={disabled} onClick={() => setAction("request_profile_review")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-800 disabled:opacity-40">
        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
        Request Review
      </button>
      <a href={selectedExportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800">
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Export
      </a>

      {action ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await submitBulkAdminMsmeAction({ ok: false, message: "" }, formData);
                setToast(result.message);
                if (result.ok) {
                  setAction(null);
                  setReason("");
                }
              });
            }}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          >
            <input type="hidden" name="bulk_action" value={action} />
            {selected.map((id) => <input key={id} type="hidden" name="msme_ids" value={id} />)}
            <h3 className="text-base font-black text-slate-950">
              {action === "flag" ? "Flag selected MSMEs?" : "Request profile review?"}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">This will update {selected.length} selected record{selected.length === 1 ? "" : "s"} and write audit events.</p>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Reason</span>
              <textarea
                name="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required={action === "flag"}
                minLength={action === "flag" ? 5 : undefined}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAction(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-700">Cancel</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{pending ? "Saving..." : "Confirm"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
