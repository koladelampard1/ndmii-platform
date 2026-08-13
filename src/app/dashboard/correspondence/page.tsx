import Link from "next/link";
import { getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";

export default async function CorrespondenceDashboardPage() {
  const { supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const stats = [
    ["Total records", snapshot.summary.total],
    ["Awaiting approval", snapshot.summary.awaitingApproval],
    ["Awaiting signature", snapshot.summary.awaitingSignature],
    ["Ready for dispatch", snapshot.summary.readyForDispatch],
    ["Issued", snapshot.summary.sent],
    ["Overdue responses", snapshot.summary.overdueResponses],
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[#082f2d] p-6 text-white shadow-xl shadow-emerald-950/10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">LCDBO Correspondence Management</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Official letters, approvals, signatures and dispatch in one governed register.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">A correspondence item is not officially issued until it has a reference, approval trail, protected signature event, dispatch record and tracking number.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/dashboard/correspondence/create/outgoing" className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-black text-emerald-950">Create outgoing</Link>
            <Link href="/dashboard/correspondence/create/incoming" className="rounded-xl border border-white/25 px-4 py-2 text-sm font-black text-white">Register incoming</Link>
          </div>
        </div>
      </section>

      {snapshot.schemaUnavailable ? (
        <WorkspaceCard title="Migration required" description="The LCDBO correspondence tables are not available in this environment yet. Apply the unapplied migration before live use.">
          <p className="text-sm text-slate-600">The workspace is safely showing an empty state instead of crashing.</p>
        </WorkspaceCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-black text-slate-950">{value}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <WorkspaceCard title="Action queue" description="Items requiring review, signature, dispatch or response follow-up.">
        <CorrespondenceTable records={snapshot.myQueue} />
      </WorkspaceCard>

      <WorkspaceCard title="Recent correspondence">
        <CorrespondenceTable records={snapshot.records} />
      </WorkspaceCard>
    </div>
  );
}
