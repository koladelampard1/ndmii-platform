"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileQuestion, MessageSquareText, Play, RotateCcw, Send, ShieldAlert, UserCog, XCircle } from "lucide-react";
import { submitAdminVerificationAction } from "@/app/dashboard/admin/verifications/[id]/actions";
import { Toast } from "@/components/ui/toast";
import type { AdminVerificationAction } from "@/lib/data/admin-verification-actions";
import type { VerificationDocumentCategory } from "@/lib/data/admin-verification-documents";
import type { VerificationReviewStatus } from "@/lib/data/admin-verification-workspace";
import type { UserRole } from "@/types/roles";

type ReviewPanelProps = {
  msmeId: string;
  role: UserRole;
  status: VerificationReviewStatus;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  assignedAt: string | null;
  internalNotes: string | null;
  requestedDocuments: string[];
  documentChecklist: Array<{ category: VerificationDocumentCategory; label: string; status: string; required: boolean; applicable: boolean }>;
  reviewers: Array<{ id: string; label: string }>;
};

type ActionConfig = {
  action: AdminVerificationAction;
  label: string;
  icon: typeof Play;
  tone: string;
  reasonLabel?: string;
};

const FALLBACK_DOC_OPTIONS: Array<{ category: VerificationDocumentCategory; label: string }> = [
  { category: "CAC_CERTIFICATE", label: "CAC certificate" },
  { category: "TIN_PROOF", label: "TIN proof" },
  { category: "UTILITY_BILL", label: "Address proof / utility bill" },
  { category: "TAX_CLEARANCE", label: "Tax clearance" },
  { category: "BUSINESS_PREMISES_PERMIT", label: "Business premises permit" },
  { category: "BANK_PROOF", label: "Bank proof" },
  { category: "PRODUCT_CERTIFICATION", label: "Product certification" },
  { category: "OTHER", label: "Other requested documents" },
];

const ACTIONS: ActionConfig[] = [
  { action: "start_review", label: "Start Review", icon: Play, tone: "border-blue-200 bg-blue-50 text-blue-800" },
  { action: "request_documents", label: "Request Documents", icon: FileQuestion, tone: "border-amber-200 bg-amber-50 text-amber-900", reasonLabel: "Request note" },
  { action: "mark_verified", label: "Mark Verified", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800", reasonLabel: "Verification note" },
  { action: "reject", label: "Reject Verification", icon: XCircle, tone: "border-rose-200 bg-rose-50 text-rose-800", reasonLabel: "Rejection reason" },
  { action: "escalate", label: "Escalate", icon: ShieldAlert, tone: "border-violet-200 bg-violet-50 text-violet-800", reasonLabel: "Escalation reason" },
  { action: "reopen", label: "Reopen Review", icon: RotateCcw, tone: "border-slate-200 bg-white text-slate-800", reasonLabel: "Reopen reason" },
];

function allowedActions(status: VerificationReviewStatus) {
  if (status === "pending_review") return new Set<AdminVerificationAction>(["start_review", "save_notes", "reassign"]);
  if (status === "under_review") return new Set<AdminVerificationAction>(["request_documents", "escalate", "mark_verified", "reject", "save_notes", "reassign"]);
  if (status === "awaiting_documents") return new Set<AdminVerificationAction>(["start_review", "save_notes", "reassign"]);
  if (status === "rejected") return new Set<AdminVerificationAction>(["start_review", "save_notes", "reassign"]);
  if (status === "escalated") return new Set<AdminVerificationAction>(["start_review", "save_notes", "reassign"]);
  if (status === "verified") return new Set<AdminVerificationAction>(["reopen", "save_notes", "reassign"]);
  return new Set<AdminVerificationAction>(["save_notes", "reassign"]);
}

function actionLabel(action: AdminVerificationAction, status: VerificationReviewStatus, fallback: string) {
  if (action === "start_review" && status === "awaiting_documents") return "Documents Received - Resume Review";
  if (action === "start_review" && (status === "rejected" || status === "escalated")) return "Resume Review";
  return fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unassigned";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function humanize(value: string | null | undefined) {
  return String(value ?? "Unavailable").replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ReviewerDecisionPanel({
  msmeId,
  role,
  status,
  assignedReviewerId,
  assignedReviewerName,
  assignedAt,
  internalNotes,
  requestedDocuments,
  documentChecklist,
  reviewers,
}: ReviewPanelProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<ActionConfig | null>(null);
  const [notes, setNotes] = useState(internalNotes ?? "");
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();
  const allowed = useMemo(() => allowedActions(status), [status]);
  const canWrite = role === "admin" || role === "reviewer";
  const canReassign = role === "admin";
  const visibleActions = ACTIONS.filter((item) => allowed.has(item.action));
  const activeSelection = selected && allowed.has(selected.action) ? selected : null;
  const documentOptions = documentChecklist.length
    ? documentChecklist.map((item) => ({ category: item.category, label: item.label, suffix: item.required ? "Required" : item.applicable ? "Applicable" : "Optional" }))
    : FALLBACK_DOC_OPTIONS.map((item) => ({ ...item, suffix: "Document" }));

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 xl:sticky xl:top-24">
      <Toast open={Boolean(toast)} message={toast} onClose={() => setToast("")} durationMs={3200} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Reviewer panel</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{humanize(status)}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Human operational workflow only.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{humanize(role)}</span>
      </div>

      <div className="mt-5 space-y-4">
        <section className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Assignment</h3>
          <p className="mt-2 text-sm font-black text-slate-950">{assignedReviewerName ?? "No reviewer assigned"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Assigned {formatDateTime(assignedAt)}</p>
          {canReassign ? (
            <form
              action={(formData) => {
                startTransition(async () => {
                  const result = await submitAdminVerificationAction({ ok: false, message: "" }, formData);
                  setToast(result.message);
                  if (result.ok) router.refresh();
                });
              }}
              className="mt-3 flex gap-2"
            >
              <input type="hidden" name="msme_id" value={msmeId} />
              <input type="hidden" name="action" value="reassign" />
              <select name="assigned_reviewer_id" defaultValue={assignedReviewerId ?? ""} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <option value="">Unassigned</option>
                {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.label}</option>)}
              </select>
              <button disabled={pending} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700" type="submit">
                <UserCog className="h-3.5 w-3.5" />Save
              </button>
            </form>
          ) : null}
        </section>

        <section className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Reviewer notes</h3>
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await submitAdminVerificationAction({ ok: false, message: "" }, formData);
                setToast(result.message);
                if (result.ok) router.refresh();
              });
            }}
            className="mt-2"
          >
            <input type="hidden" name="msme_id" value={msmeId} />
            <input type="hidden" name="action" value="save_notes" />
            <textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} disabled={!canWrite} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600 disabled:bg-slate-100" placeholder="Private internal notes" />
            {canWrite ? (
              <button disabled={pending} type="submit" className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-60">
                <MessageSquareText className="h-3.5 w-3.5" />Save Notes
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Requested documents</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {requestedDocuments.length ? requestedDocuments.map((document) => <span key={document} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900">{document}</span>) : <span className="text-sm font-semibold text-slate-500">No active document request.</span>}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Decision actions</h3>
          {!canWrite ? (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">This role has read-only access.</p>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {visibleActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.action} type="button" onClick={() => setSelected(item)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-black ${item.tone}`}>
                    <Icon className="h-4 w-4" />{actionLabel(item.action, status, item.label)}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {activeSelection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await submitAdminVerificationAction({ ok: false, message: "" }, formData);
                setToast(result.message);
                if (result.ok) {
                  setSelected(null);
                  router.refresh();
                }
              });
            }}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          >
            <input type="hidden" name="msme_id" value={msmeId} />
            <input type="hidden" name="action" value={activeSelection.action} />
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700"><AlertTriangle className="h-5 w-5" /></span>
              <div>
                <h3 className="text-base font-black text-slate-950">{actionLabel(activeSelection.action, status, activeSelection.label)}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">This mutation is written to review events and activity logs.</p>
              </div>
            </div>
            {activeSelection.action === "request_documents" ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {documentOptions.map((document) => (
                  <label key={document.category} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" name="requested_documents" value={`${document.category}|${document.label}`} className="h-4 w-4 rounded border-slate-300" />
                    <span>
                      <span className="block">{document.label}</span>
                      <span className="block text-[10px] font-semibold text-slate-500">{document.suffix}</span>
                    </span>
                  </label>
                ))}
                <input name="custom_document" className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" placeholder="Other custom request" />
              </div>
            ) : null}
            {activeSelection.reasonLabel ? (
              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">{activeSelection.reasonLabel}</span>
                <textarea name="reason" required minLength={5} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600" />
              </label>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-700">Cancel</button>
              <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60" type="submit">
                <Send className="h-4 w-4" />{pending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
