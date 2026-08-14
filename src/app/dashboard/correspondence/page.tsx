import Link from "next/link";
import { getCorrespondenceRepresentativeAuthority, getCorrespondenceWorkspaceSnapshot, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";
import { CorrespondenceTable, WorkspaceCard } from "@/app/dashboard/correspondence/_components";
import { institutionLabelForRepresentative, representativeBuckets } from "@/lib/lcdbo-correspondence/representative-workflow";

export default async function CorrespondenceDashboardPage() {
  const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("view");
  const snapshot = await getCorrespondenceWorkspaceSnapshot(supabase);
  const authority = ctx.appUserId ? await getCorrespondenceRepresentativeAuthority({ actorUserId: ctx.appUserId, programmeId: programme.id, client: supabase }) : null;
  const buckets = representativeBuckets(snapshot.records, authority);
  const stats = [
    ["Needs my action", buckets.needsMyAction.length],
    ["My drafts", buckets.drafts.length],
    ["Waiting for other party", buckets.waitingForOtherParty.length],
    ["Ready to send", buckets.readyToSend.length],
    ["Sent letters", buckets.sent.length || snapshot.summary.sent],
    ["Overdue responses", snapshot.summary.overdueResponses],
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[#082f2d] p-6 text-white shadow-xl shadow-emerald-950/10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">LCDBO Representative Correspondence</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Create, countersign and send official LCDBO letters with one representative from each institution.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">
              {authority ? `Signed in as the ${institutionLabelForRepresentative(authority.representative_role)} representative. ` : ""}
              Every action keeps the real authenticated person, institution, version, signature and dispatch audit trail.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/dashboard/correspondence/create" className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-black text-emerald-950">Create letter</Link>
            <Link href="/dashboard/correspondence/my-work" className="rounded-xl border border-white/25 px-4 py-2 text-sm font-black text-white">Needs my action</Link>
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

      <WorkspaceCard title="Needs my action" description="Letters from the other institution that need your review, return, rejection or countersignature.">
        <CorrespondenceTable records={buckets.needsMyAction.length ? buckets.needsMyAction : snapshot.myQueue} />
      </WorkspaceCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspaceCard title="Waiting for the other party" description="Letters your institution has signed and sent for countersignature.">
          <CorrespondenceTable records={buckets.waitingForOtherParty} />
        </WorkspaceCard>
        <WorkspaceCard title="Ready to send" description="Fully signed letters initiated by your institution and ready for dispatch.">
          <CorrespondenceTable records={buckets.readyToSend} />
        </WorkspaceCard>
      </div>

      <WorkspaceCard title="Recent correspondence" description="A governed record of letters you are authorised to see.">
        <CorrespondenceTable records={snapshot.records} />
      </WorkspaceCard>
    </div>
  );
}
