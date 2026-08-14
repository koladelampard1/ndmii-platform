import Link from "next/link";
import type { ReactNode } from "react";
import type { LcdboCorrespondenceRecord } from "@/lib/lcdbo-correspondence/types";
import { simplifiedStatusForRecord, simplifiedStatusLabel } from "@/lib/lcdbo-correspondence/representative-workflow";

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

export function SubmitButton({ children }: { children: ReactNode }) {
  return <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">{children}</button>;
}
