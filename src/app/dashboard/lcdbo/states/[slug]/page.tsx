import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ClipboardCheck, Factory, MapPinned, UserRoundCheck, Users } from "lucide-react";
import { requireLcdboIntelligenceAccess } from "@/lib/auth/lcdbo-intelligence-access";
import { filterSnapshotByState, getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { IntelligenceBarChart, IntelligenceHeader, ReadinessProfile } from "@/components/lcdbo/lcdbo-intelligence-dashboard";
import { LcdboCommandMetricCard, LcdboPipeline } from "@/components/lcdbo/lcdbo-visuals";

export default async function LcdboStateIntelligencePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireLcdboIntelligenceAccess();
  const { slug } = await params;
  const snapshot = await getLcdboIntelligenceSnapshot(await createServiceRoleSupabaseClient());
  const stateName = snapshot.states.map(([state]) => state).find((state) => slugify(state) === slug) ?? (slug === "fct" ? "FCT" : null);
  if (!stateName) notFound();
  const state = filterSnapshotByState(snapshot, stateName);
  const placed = state.interests.filter((item) => item.status === "placed").length;
  const active = state.interests.filter((item) => item.status === "active").length;
  const pipeline = [{ label: "Registered", value: state.enrolments.length }, { label: "Enrolled", value: state.enrolments.filter((item) => ["active", "pending_review"].includes(item.status)).length }, { label: "Interested", value: state.interests.length }, { label: "Assessed", value: state.assessments.length }, { label: "Documents", value: state.documents.filter((item) => item.status === "accepted").length }, { label: "Placed", value: placed }, { label: "Active", value: active }];
  return <main className="min-h-screen bg-[#F6F8FB]"><IntelligenceHeader eyebrow="State Programme Intelligence" title={`${stateName} LCDBO Dashboard`} description="State-level visibility into MSME participation, cluster capacity, readiness and programme progression." actions={<StateSelector states={snapshot.states.map(([name]) => name)} current={stateName} />} /><div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6"><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><LcdboCommandMetricCard icon={Users} label="MSMEs" value={state.enrolments.length} /><LcdboCommandMetricCard icon={Factory} label="Clusters" value={state.clusters.length} /><LcdboCommandMetricCard icon={UserRoundCheck} label="Officers" value={state.officers} /><LcdboCommandMetricCard icon={ClipboardCheck} label="Assessments" value={state.assessments.length} /><LcdboCommandMetricCard icon={Building2} label="Active participants" value={active} /></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-[#0B2E59]">State participation funnel</h2><div className="mt-5"><LcdboPipeline stages={pipeline} /></div></section><section className="grid gap-5 lg:grid-cols-2"><IntelligenceBarChart title="Top sectors" data={state.sectors} /><ReadinessProfile data={state.readiness} /></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-[#008751]" /><h2 className="text-xl font-black text-[#0B2E59]">State cluster portfolio</h2></div><div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{state.clusters.map((cluster) => <Link key={cluster.id} href={`/dashboard/lcdbo/clusters/${cluster.id}`} className="rounded-xl border border-slate-200 p-4 hover:border-[#D4A017]"><p className="font-black text-[#0B2E59]">{cluster.name}</p><p className="mt-1 text-sm text-slate-500">{cluster.sector} · {cluster.memberCount} MSMEs</p></Link>)}</div></section></div></main>;
}

function StateSelector({ states, current }: { states: string[]; current: string }) { return <div className="flex flex-wrap gap-2">{states.slice(0, 10).map((state) => <Link key={state} href={`/dashboard/lcdbo/states/${slugify(state)}`} className={`rounded-full px-3 py-1.5 text-xs font-bold ${state === current ? "bg-[#D4A017] text-[#0B2E59]" : "border border-white/20 text-white"}`}>{state}</Link>)}</div>; }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
