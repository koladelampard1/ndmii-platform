"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Toast } from "@/components/ui/toast";
import { submitBulkAssociationMemberAction } from "@/app/dashboard/admin/association-members/[id]/actions";

type Reviewer = { id: string; label: string };
type BulkAction =
  | "start_review"
  | "approve"
  | "prepare_activation"
  | "generate_invite"
  | "regenerate_invite"
  | "mark_invite_sent"
  | "mark_onboarding_started"
  | "mark_onboarding_completed"
  | "assign_reviewer"
  | "reject"
  | "request_correction"
  | "fast_track_activation"
  | "export";

const ADMIN_ACTIONS: Array<{ value: BulkAction; label: string; reason?: boolean }> = [
  { value: "start_review", label: "Start Review" },
  { value: "approve", label: "Approve" },
  { value: "prepare_activation", label: "Prepare Activation" },
  { value: "fast_track_activation", label: "Fast-Track Activation" },
  { value: "generate_invite", label: "Generate Invites" },
  { value: "regenerate_invite", label: "Regenerate Invites" },
  { value: "mark_invite_sent", label: "Mark Invite Sent" },
  { value: "mark_onboarding_started", label: "Mark Onboarding Started" },
  { value: "mark_onboarding_completed", label: "Mark Onboarding Completed" },
  { value: "assign_reviewer", label: "Assign Reviewer", reason: true },
  { value: "reject", label: "Reject", reason: true },
  { value: "request_correction", label: "Request Correction", reason: true },
  { value: "export", label: "Export CSV" },
];

const REVIEWER_ACTIONS = ADMIN_ACTIONS.filter(({ value }) => ["approve", "reject"].includes(value));

function reportCsv(report: Array<{ memberId: string; outcome: string; reason: string }>) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return ["member_id,outcome,reason", ...report.map((row) => [row.memberId, row.outcome, row.reason].map(escape).join(","))].join("\r\n");
}

function accessCsv(rows: Array<{ memberName: string; phone: string; email: string; businessName: string; temporaryPin: string; expiresAt: string }>) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return ["member_name,phone,email,business_name,temporary_pin,expiry_date", ...rows.map((row) => [row.memberName, row.phone, row.email, row.businessName, row.temporaryPin, row.expiresAt].map(escape).join(","))].join("\r\n");
}

export function AssociationMemberBulkActions({
  role,
  visibleIds,
  filteredCount,
  filterSnapshot,
  exportHref,
  reviewers,
}: {
  role: string;
  visibleIds: string[];
  filteredCount: number | null;
  filterSnapshot: Record<string, string>;
  exportHref: string;
  reviewers: Reviewer[];
}) {
  const router = useRouter();
  const actions = role === "admin" ? ADMIN_ACTIONS : REVIEWER_ACTIONS;
  const [selected, setSelected] = useState<string[]>([]);
  const [targetMode, setTargetMode] = useState<"selected" | "filtered">("selected");
  const [action, setAction] = useState<BulkAction | "">("");
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [toast, setToast] = useState("");
  const [result, setResult] = useState<{ successful: number; skipped: number; failed: number; report: Array<{ memberId: string; outcome: "skipped" | "failed"; reason: string }>; accessDetails?: Array<{ memberName: string; phone: string; email: string; businessName: string; temporaryPin: string; expiresAt: string }> } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onChange(event: Event) {
      const target = event.target as HTMLInputElement | null;
      if (!target?.matches("[data-association-member-bulk-checkbox]")) return;
      const boxes = Array.from(document.querySelectorAll<HTMLInputElement>("[data-association-member-bulk-checkbox]:checked"));
      setSelected(boxes.map((box) => box.value));
      setTargetMode("selected");
    }
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  const targetCount = targetMode === "filtered" ? filteredCount ?? 0 : selected.length;
  const selectedAction = actions.find((item) => item.value === action);
  const exportUrl = useMemo(() => {
    if (targetMode === "filtered") return exportHref;
    const separator = exportHref.includes("?") ? "&" : "?";
    return `${exportHref}${separator}ids=${encodeURIComponent(selected.join(","))}`;
  }, [exportHref, selected, targetMode]);

  function setVisibleSelection(checked: boolean) {
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>("[data-association-member-bulk-checkbox]"));
    boxes.forEach((box) => { box.checked = checked; });
    setSelected(checked ? visibleIds : []);
    setTargetMode("selected");
  }

  function clearSelection() {
    setVisibleSelection(false);
    setTargetMode("selected");
  }

  function begin() {
    if (!action || targetCount === 0) return;
    if (action === "export") {
      window.location.assign(exportUrl);
      return;
    }
    setConfirming(true);
  }

  function downloadReport() {
    if (!result?.report.length) return;
    const url = URL.createObjectURL(new Blob([reportCsv(result.report)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "association-member-bulk-exceptions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadAccessDetails() {
    if (!result?.accessDetails?.length) return;
    const url = URL.createObjectURL(new Blob([accessCsv(result.accessDetails)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "association-member-one-time-access-details.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <Toast open={Boolean(toast)} message={toast} onClose={() => setToast("")} durationMs={5000} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <strong>Bulk operations</strong>
        <button type="button" onClick={() => setVisibleSelection(true)} className="rounded border px-3 py-2 font-bold">Select visible</button>
        {role === "admin" ? <button type="button" onClick={() => setTargetMode("filtered")} disabled={!filteredCount} className="rounded border px-3 py-2 font-bold disabled:opacity-40">Select all filtered</button> : null}
        <button type="button" onClick={clearSelection} className="rounded border px-3 py-2 font-bold">Clear selection</button>
        <span className="rounded bg-slate-100 px-3 py-2 font-bold">{targetMode === "filtered" ? `${filteredCount ?? 0} filtered` : `${selected.length} selected`}</span>
      </div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Bulk operations apply lifecycle rules. Invalid members will be skipped and reported.</p>
      <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(220px,2fr)_auto]">
        <select value={action} onChange={(event) => setAction(event.target.value as BulkAction)} className="rounded border px-3 py-2 text-sm">
          <option value="">Choose bulk action</option>
          {actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} disabled={action !== "assign_reviewer"} className="rounded border px-3 py-2 text-sm disabled:bg-slate-100">
          <option value="">Choose reviewer</option>
          {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.label}</option>)}
        </select>
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason required for rejection, correction, or reassignment" className="rounded border px-3 py-2 text-sm" />
        <button type="button" onClick={begin} disabled={!action || targetCount === 0} className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{action === "export" ? "Download" : "Continue"}</button>
      </div>
      {result ? <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900"><span>Success: {result.successful}</span><span>Skipped: {result.skipped}</span><span>Failed: {result.failed}</span>{result.accessDetails?.length ? <button type="button" onClick={downloadAccessDetails} className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-1"><Download className="h-3.5 w-3.5" /> Download one-time PIN export</button> : null}{result.report.length ? <button type="button" onClick={downloadReport} className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-1"><Download className="h-3.5 w-3.5" /> Download exceptions</button> : null}</div> : null}

      {confirming && selectedAction ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
        <form action={(formData) => {
          startTransition(async () => {
            const response = await submitBulkAssociationMemberAction({ ok: false, message: "" }, formData);
            setToast(response.message);
            if (response.ok && response.result) {
              setResult(response.result);
              setConfirming(false);
              clearSelection();
              router.refresh();
            }
          });
        }} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
          <input type="hidden" name="bulk_action" value={action} />
          <input type="hidden" name="target_mode" value={targetMode} />
          <input type="hidden" name="filter_snapshot" value={JSON.stringify(filterSnapshot)} />
          <input type="hidden" name="confirmed" value="yes" />
          <input type="hidden" name="reason" value={reason} />
          <input type="hidden" name="assigned_reviewer_id" value={reviewerId} />
          {selected.map((id) => <input key={id} type="hidden" name="member_ids" value={id} />)}
          <h3 className="text-base font-black">Confirm {selectedAction.label}</h3>
          <p className="mt-2 text-sm text-slate-600">This operation targets {targetCount.toLocaleString()} member{targetCount === 1 ? "" : "s"}. Records that fail lifecycle validation will be skipped and reported.</p>
          {targetCount > 100 ? <p className="mt-3 rounded bg-amber-50 p-3 text-sm font-bold text-amber-900">This operation affects more than 100 records. Confirm the filter and action before continuing.</p> : null}
          {selectedAction.reason && !reason.trim() ? <p className="mt-3 text-sm font-bold text-rose-700">Enter a reason before confirming.</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="rounded border px-4 py-2 text-sm font-black">Cancel</button>
            <button type="submit" disabled={pending || Boolean(selectedAction.reason && !reason.trim()) || Boolean(action === "assign_reviewer" && !reviewerId)} className="rounded bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{pending ? "Processing..." : "Confirm operation"}</button>
          </div>
        </form>
      </div> : null}
    </div>
  );
}
