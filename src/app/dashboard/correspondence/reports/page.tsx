import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceReportsPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("export");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const byIssuer = ["JNT", "RMRDC", "RFNL"].map((issuer) => ({
    issuer,
    total: snapshot.records.filter((record) => record.issuer === issuer).length,
    issued: snapshot.records.filter((record) => record.issuer === issuer && ["sent", "delivered", "acknowledged", "response_received", "closed"].includes(record.status)).length,
  }));
  const deliveryFailures = snapshot.records.filter((record) => record.status === "delivery_failed").length;
  const responseRequired = snapshot.records.filter((record) => record.response_required).length;
  return (
    <WorkspaceCard title="Correspondence reports" description="Governed operational reporting for volumes, pending actions, response obligations and dispatch outcomes.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Open records" value={snapshot.records.filter((r) => !["closed", "cancelled", "rejected"].includes(r.status)).length} />
        <Metric label="Awaiting action" value={snapshot.summary.myQueue} />
        <Metric label="Issued records" value={snapshot.summary.sent} />
        <Metric label="Response required" value={responseRequired} />
        <Metric label="Overdue responses" value={snapshot.summary.overdueResponses} />
        <Metric label="Delivery failures" value={deliveryFailures} />
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            <tr><th className="px-4 py-3">Issuer</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3">Open</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {byIssuer.map((row) => <tr key={row.issuer}><td className="px-4 py-3 font-black text-slate-950">{row.issuer}</td><td className="px-4 py-3">{row.total}</td><td className="px-4 py-3">{row.issued}</td><td className="px-4 py-3">{row.total - row.issued}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Governance note: exports and reports use formula-safe CSV handling and correspondence-scope authorization. Production metrics should be reconciled after the migration is applied in Supabase.</p>
    </WorkspaceCard>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p></div>;
}
