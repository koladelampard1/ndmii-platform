"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, FileCheck2, Flag, LockKeyhole, MessageSquarePlus, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Toast } from "@/components/ui/toast";
import { submitAdminMsmeAction } from "@/app/dashboard/admin/msmes/[id]/actions";
import type { AdminMsmeAction } from "@/lib/data/admin-msme-actions";
import type { UserRole } from "@/types/roles";

type ActionConfig = {
  action: AdminMsmeAction;
  label: string;
  tone: string;
  icon: typeof Flag;
  requiresReason: boolean;
};

const ACTIONS: ActionConfig[] = [
  { action: "flag", label: "Flag", tone: "border-amber-300 bg-amber-50 text-amber-900", icon: Flag, requiresReason: true },
  { action: "remove_flag", label: "Remove Flag", tone: "border-slate-300 bg-white text-slate-800", icon: X, requiresReason: true },
  { action: "suspend", label: "Suspend", tone: "border-rose-300 bg-rose-50 text-rose-800", icon: LockKeyhole, requiresReason: true },
  { action: "reinstate", label: "Reinstate", tone: "border-emerald-300 bg-emerald-50 text-emerald-800", icon: RotateCcw, requiresReason: true },
  { action: "request_profile_review", label: "Request Review", tone: "border-blue-300 bg-blue-50 text-blue-800", icon: FileCheck2, requiresReason: false },
  { action: "escalate_compliance_review", label: "Escalate", tone: "border-violet-300 bg-violet-50 text-violet-800", icon: ShieldAlert, requiresReason: true },
  { action: "add_internal_note", label: "Add Note", tone: "border-slate-300 bg-slate-50 text-slate-800", icon: MessageSquarePlus, requiresReason: false },
];

function allowedActions(role: UserRole) {
  if (role === "admin") return new Set(ACTIONS.map((item) => item.action));
  if (role === "reviewer") return new Set<AdminMsmeAction>(["request_profile_review", "escalate_compliance_review"]);
  return new Set<AdminMsmeAction>();
}

export function AdminMsmeOperationalControls({
  msmeId,
  role,
  flagged,
  suspended,
}: {
  msmeId: string;
  role: UserRole;
  flagged: boolean;
  suspended: boolean;
}) {
  const [selected, setSelected] = useState<ActionConfig | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();
  const allowed = useMemo(() => allowedActions(role), [role]);

  const visibleActions = ACTIONS.filter((item) => allowed.has(item.action)).filter((item) => {
    if (item.action === "flag") return !flagged;
    if (item.action === "remove_flag") return flagged;
    if (item.action === "suspend") return !suspended;
    if (item.action === "reinstate") return suspended;
    return true;
  });

  if (!visibleActions.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        Operational actions are restricted for this role.
      </div>
    );
  }

  const needsReason = selected?.requiresReason || selected?.action === "add_internal_note";
  const actionLabel = selected?.action === "add_internal_note" ? "Internal note" : "Reason";

  return (
    <div>
      <Toast open={Boolean(toast)} message={toast} onClose={() => setToast("")} durationMs={3200} />
      <div className="grid grid-cols-2 gap-2">
        {visibleActions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.action}
              type="button"
              onClick={() => setSelected(item)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-black ${item.tone}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await submitAdminMsmeAction({ ok: false, message: "" }, formData);
                setToast(result.message);
                if (result.ok) {
                  setSelected(null);
                  setReason("");
                }
              });
            }}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          >
            <input type="hidden" name="msme_id" value={msmeId} />
            <input type="hidden" name="action" value={selected.action} />
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-950">{selected.label} MSME?</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">This action is recorded in the operational audit trail.</p>
              </div>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">{actionLabel}</span>
              <textarea
                name="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required={needsReason}
                minLength={needsReason ? 5 : undefined}
                rows={5}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600"
                placeholder={selected.action === "add_internal_note" ? "Private admin-only note" : "Operational reason"}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-700">Cancel</button>
              <button disabled={pending} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60" type="submit">
                {pending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
