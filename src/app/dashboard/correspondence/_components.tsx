import Link from "next/link";
import type { ReactNode } from "react";
import type { LcdboCorrespondenceRecord } from "@/lib/lcdbo-correspondence/types";
import { simplifiedStatusForRecord, simplifiedStatusLabel } from "@/lib/lcdbo-correspondence/representative-workflow";
import { CorrespondenceSubmitButton } from "./submit-button";

export function WorkspaceCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const ACTION_MESSAGES: Record<string, string> = {
  representative_letter_created: "Draft letter created successfully.",
  representative_draft_saved: "The corrected draft was saved as the current version.",
  representative_letter_sent_to_counterparty: "Your institutional approval was recorded and the letter was sent to the other party.",
  representative_decision_recorded: "The counterparty decision was recorded.",
  correspondence_dispatched: "The dispatch was recorded successfully.",
  email_dispatch_attempt_recorded: "The email provider accepted the official letter and the dispatch was recorded.",
  representative_letter_create_failed: "The letter could not be created. Check the required fields and your representative authority.",
  representative_draft_save_failed: "The draft could not be saved. It may no longer be open for editing.",
  representative_letter_submit_failed: "The letter could not be submitted. Confirm that you have an active signature authority and the letter is still awaiting your action.",
  representative_decision_failed: "The decision could not be recorded. A reason is required when returning or rejecting a letter.",
  correspondence_dispatch_failed: "Dispatch could not be recorded. Both institutions must approve the current version and its final PDF must pass the integrity check.",
  email_dispatch_failed: "The email was not sent. Check the approved sender configuration, recipient address and provider status; the letter has not been marked sent.",
};

export function CorrespondenceActionBanner({ success, error }: { success?: string; error?: string }) {
  const code = error ?? success;
  if (!code) return null;
  const failed = Boolean(error);
  return <div role={failed ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm font-bold ${failed ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{ACTION_MESSAGES[code] ?? code.replaceAll("_", " ")}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status.includes("awaiting") ? "bg-amber-50 text-amber-800 ring-amber-200" : status === "sent" || status === "closed" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : status === "rejected" || status === "revoked" || status === "cancelled" ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ring-1 ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

export function RepresentativeStatusBadge({ record }: { record: LcdboCorrespondenceRecord }) {
  const status = simplifiedStatusForRecord(record);
  const tone = status.includes("awaiting") ? "bg-amber-50 text-amber-800 ring-amber-200" : status === "ready_to_send" || status === "sent" || status === "closed" || status === "response_received" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : status === "rejected" || status === "revoked" || status === "cancelled" ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ring-1 ${tone}`}>{simplifiedStatusLabel(status)}</span>;
}

export function CorrespondenceTable({ records }: { records: LcdboCorrespondenceRecord[] }) {
  if (!records.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm font-bold text-slate-800">No correspondence records yet.</p>
        <p className="mt-1 text-sm text-slate-600">Create or register the first official LCDBO correspondence item.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Issuer</th>
              <th className="px-4 py-3">Next step</th>
              <th className="px-4 py-3">Responsible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-emerald-50/40">
                <td className="whitespace-nowrap px-4 py-3 font-black text-emerald-800">
                  <Link href={`/dashboard/correspondence/${record.id}`}>{record.reference}</Link>
                </td>
                <td className="min-w-[18rem] px-4 py-3 font-semibold text-slate-900">{record.subject}</td>
                <td className="px-4 py-3 text-slate-600">{record.issuer}/{record.direction}</td>
                <td className="px-4 py-3"><RepresentativeStatusBadge record={record} /></td>
                <td className="px-4 py-3 text-slate-600">{record.owner?.full_name ?? record.owner?.email ?? "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SubmitButton({ children, pendingLabel = "Processing..." }: { children: ReactNode; pendingLabel?: string }) {
  return <CorrespondenceSubmitButton pendingLabel={pendingLabel}>{children}</CorrespondenceSubmitButton>;
}
