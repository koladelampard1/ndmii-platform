"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  KeyRound,
  MessageSquareText,
  RefreshCcw,
  RotateCcw,
  Send,
  ShieldAlert,
  UserCog,
} from "lucide-react";
import { submitAdminDigitalIdAction } from "@/app/dashboard/admin/digital-ids/[id]/actions";
import { Toast } from "@/components/ui/toast";
import {
  canRoleRunAdminDigitalIdAction,
  type AdminDigitalIdAction,
  type DigitalIdLifecycleStatus,
} from "@/lib/data/admin-digital-id-lifecycle";
import type { UserRole } from "@/types/roles";

type Props = {
  credentialId: string;
  role: UserRole;
  currentUserId: string;
  status: DigitalIdLifecycleStatus;
  allowedActions: AdminDigitalIdAction[];
  internalNotes: string | null;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  reviewers: Array<{ id: string; label: string; role: string }>;
  regenerationCount: number;
  lastRegeneratedAt: string | null;
};

type ActionConfig = {
  action: AdminDigitalIdAction;
  label: string;
  icon: typeof CheckCircle2;
  tone: string;
  reasonLabel?: string;
  confirmText?: string;
};

const ACTIONS: ActionConfig[] = [
  { action: "activate", label: "Activate Credential", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { action: "suspend", label: "Suspend Credential", icon: ShieldAlert, tone: "border-amber-200 bg-amber-50 text-amber-900", reasonLabel: "Suspension reason" },
  { action: "revoke", label: "Revoke Credential", icon: Ban, tone: "border-rose-200 bg-rose-50 text-rose-800", reasonLabel: "Revocation reason", confirmText: "Revocation disables public verification and cannot be reinstated." },
  { action: "start_renewal", label: "Start Renewal", icon: RefreshCcw, tone: "border-blue-200 bg-blue-50 text-blue-800" },
  { action: "approve_renewal", label: "Approve Renewal", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { action: "reinstate", label: "Reinstate Credential", icon: RotateCcw, tone: "border-violet-200 bg-violet-50 text-violet-800", reasonLabel: "Reinstatement reason" },
  { action: "regenerate_token", label: "Regenerate Verification Token", icon: KeyRound, tone: "border-slate-300 bg-white text-slate-800", reasonLabel: "Regeneration reason", confirmText: "A new public verification route will be shown once after confirmation." },
];

function humanize(value: string | null | undefined) {
  return String(value ?? "Unavailable").replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LifecycleDecisionPanel({
  credentialId,
  role,
  currentUserId,
  status,
  allowedActions,
  internalNotes,
  assignedReviewerId,
  assignedReviewerName,
  assignedAdminId,
  assignedAdminName,
  reviewers,
  regenerationCount,
  lastRegeneratedAt,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ActionConfig | null>(null);
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();
  const allowed = useMemo(() => new Set(allowedActions), [allowedActions]);
  const canWrite = role === "admin" || role === "super_admin" || role === "reviewer";
  const canAssign = role === "admin" || role === "super_admin";
  const canSelfAssign = role === "reviewer" && assignedReviewerId !== currentUserId;
  const visibleActions = ACTIONS.filter((action) => allowed.has(action.action));
  const activeSelection = selected && allowed.has(selected.action) ? selected : null;
  const adminUsers = reviewers.filter((reviewer) => reviewer.role === "admin" || reviewer.role === "super_admin");
  const reviewerUsers = reviewers.filter((reviewer) => reviewer.role === "reviewer");

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 xl:sticky xl:top-24">
      <Toast open={Boolean(toast)} message={toast} onClose={() => setToast("")} durationMs={5600} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Lifecycle controls</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{humanize(status)}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Governed server-side transitions only.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{humanize(role)}</span>
      </div>

      <div className="mt-5 space-y-4">
        <section className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Assignment</h3>
          <p className="mt-2 text-sm font-black text-slate-950">Reviewer: {assignedReviewerName ?? "Unassigned"}</p>
          <p className="mt-1 text-sm font-black text-slate-950">Admin: {assignedAdminName ?? "Unassigned"}</p>
          {canAssign ? (
            <form
              action={(formData) => {
                startTransition(async () => {
                  const result = await submitAdminDigitalIdAction({ ok: false, message: "" }, formData);
                  setToast(result.message);
                  if (result.ok) router.refresh();
                });
              }}
              className="mt-3 grid gap-2"
            >
              <input type="hidden" name="credential_id" value={credentialId} />
              <input type="hidden" name="action" value="assign" />
              <select name="assigned_reviewer_id" defaultValue={assignedReviewerId ?? ""} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <option value="">No reviewer</option>
                {reviewerUsers.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}
              </select>
              <select name="assigned_admin_id" defaultValue={assignedAdminId ?? ""} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <option value="">No admin owner</option>
                {adminUsers.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}
              </select>
              <button disabled={pending} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700" type="submit">
                <UserCog className="h-3.5 w-3.5" />Save Assignment
              </button>
            </form>
          ) : canSelfAssign ? (
            <form
              action={(formData) => {
                startTransition(async () => {
                  const result = await submitAdminDigitalIdAction({ ok: false, message: "" }, formData);
                  setToast(result.message);
                  if (result.ok) router.refresh();
                });
              }}
              className="mt-3"
            >
              <input type="hidden" name="credential_id" value={credentialId} />
              <input type="hidden" name="action" value="assign" />
              <input type="hidden" name="assigned_reviewer_id" value={currentUserId} />
              <button disabled={pending} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800" type="submit">
                <UserCog className="h-3.5 w-3.5" />Self-assign
              </button>
            </form>
          ) : null}
        </section>

        <section className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Internal note</h3>
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await submitAdminDigitalIdAction({ ok: false, message: "" }, formData);
                setToast(result.message);
                if (result.ok) router.refresh();
              });
            }}
            className="mt-2"
          >
            <input type="hidden" name="credential_id" value={credentialId} />
            <input type="hidden" name="action" value="save_note" />
            <textarea name="note" defaultValue={internalNotes ?? ""} rows={5} disabled={!canWrite} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600 disabled:bg-slate-100" placeholder="Private lifecycle note" />
            {canWrite ? (
              <button disabled={pending} type="submit" className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-60">
                <MessageSquareText className="h-3.5 w-3.5" />Save Note
              </button>
            ) : null}
          </form>
        </section>

        <section className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Regeneration posture</h3>
          <p className="mt-2 text-sm font-black text-slate-950">{regenerationCount.toLocaleString()} regeneration(s)</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Last regenerated {formatDateTime(lastRegeneratedAt)}</p>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Available decisions</h3>
          {!canWrite ? (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">This role has read-only access.</p>
          ) : (
            <div className="mt-2 grid gap-2">
              {visibleActions.map((item) => {
                const Icon = item.icon;
                const disabled = !canRoleRunAdminDigitalIdAction(role, item.action);
                return (
                  <button key={item.action} disabled={disabled} type="button" onClick={() => setSelected(item)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-45 ${item.tone}`}>
                    <Icon className="h-4 w-4" />{item.label}
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
                const result = await submitAdminDigitalIdAction({ ok: false, message: "" }, formData);
                setToast(result.message);
                if (result.ok) {
                  setSelected(null);
                  router.refresh();
                }
              });
            }}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          >
            <input type="hidden" name="credential_id" value={credentialId} />
            <input type="hidden" name="action" value={activeSelection.action} />
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700"><AlertTriangle className="h-5 w-5" /></span>
              <div>
                <h3 className="text-base font-black text-slate-950">{activeSelection.label}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{activeSelection.confirmText ?? "This mutation is written to credential events and activity logs."}</p>
              </div>
            </div>
            {activeSelection.reasonLabel ? (
              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">{activeSelection.reasonLabel}</span>
                <textarea name="reason" required minLength={5} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600" />
              </label>
            ) : null}
            {activeSelection.action === "regenerate_token" && status === "suspended" ? (
              <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                <input type="checkbox" name="override" className="mt-0.5 h-4 w-4 rounded border-amber-300" />
                <span>Admin override: allow regeneration while suspended.</span>
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
