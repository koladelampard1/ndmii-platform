import Link from "next/link";
import { Building2, Factory, MapPinned, Users } from "lucide-react";
import { requireLcdboIntelligenceAccess } from "@/lib/auth/lcdbo-intelligence-access";
import { filterSnapshotByState, getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { IntelligenceBarChart, IntelligenceHeader, ReadinessProfile } from "@/components/lcdbo/lcdbo-intelligence-dashboard";
import { LcdboGeographyMap } from "@/components/lcdbo/lcdbo-geography-map";
import { LcdboCommandMetricCard } from "@/components/lcdbo/lcdbo-visuals";

export default async function LcdboGeographyPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  await requireLcdboIntelligenceAccess();
  const { state: requestedState } = await searchParams;
  const snapshot = await getLcdboIntelligenceSnapshot(await createServiceRoleSupabaseClient());
  const selectedState = requestedState && snapshot.states.some(([state]) => state === requestedState) ? requestedState : null;
  const stateView = selectedState ? filterSnapshotByState(snapshot, selectedState) : null;
  const stateLgas = stateView ? new Set(stateView.enrolments.map((item) => item.msme?.lga).filter(Boolean)).size : snapshot.metrics.lgasCovered;
  const participantDensity = selectedState && stateView ? [[selectedState, stateView.interests.length] as [string, number]] : snapshot.participationStates;

  return <main className="min-h-screen bg-[#F6F8FB]">
    <IntelligenceHeader eyebrow="Geographic Intelligence" title="LCDBO Programme Geography" description="Explore cluster coverage, MSME density, state participation and readiness from the governed programme dataset." />
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <form className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">State explorer
          <select name="state" defaultValue={selectedState ?? ""} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900">
            <option value="">National view</option>{snapshot.states.map(([state]) => <option key={state} value={state}>{state}</option>)}
          </select>
        </label>
        <button className="rounded-xl bg-[#0B2E59] px-5 py-3 text-sm font-black text-white">Explore geography</button>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LcdboCommandMetricCard icon={MapPinned} label="States covered" value={selectedState ? 1 : snapshot.metrics.statesCovered} />
        <LcdboCommandMetricCard icon={Factory} label="Clusters mapped" value={selectedState ? stateView?.clusters.length ?? 0 : snapshot.metrics.totalClusters} />
        <LcdboCommandMetricCard icon={Users} label="MSMEs represented" value={selectedState ? stateView?.enrolments.length ?? 0 : snapshot.metrics.totalMsmes} />
        <LcdboCommandMetricCard icon={Building2} label="LGAs covered" value={stateLgas} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <LcdboGeographyMap clusters={snapshot.clusters} selectedState={selectedState} />
        <IntelligenceBarChart title={selectedState ? `${selectedState} cluster participants` : "Participant density by state"} data={participantDensity} limit={12} />
      </section>

      {stateView ? <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">State intelligence</p><h2 className="mt-1 text-2xl font-black text-[#0B2E59]">{selectedState}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{stateView.clusters.map((cluster) => <Link key={cluster.id} href={`/dashboard/lcdbo/clusters/${cluster.id}`} className="rounded-xl border border-slate-200 p-4 hover:border-[#D4A017]"><p className="font-black text-[#0B2E59]">{cluster.name}</p><p className="mt-1 text-xs text-slate-500">{cluster.sector} · {cluster.memberCount} participants</p></Link>)}{!stateView.clusters.length && <p className="text-sm text-slate-500">No configured clusters are mapped to this state yet.</p>}</div></article>
        <ReadinessProfile data={stateView.readiness} />
        <IntelligenceBarChart title={`${selectedState} MSMEs by sector`} data={stateView.sectors} />
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Coverage disclosure</p><h2 className="mt-1 text-xl font-black text-[#0B2E59]">Data interpretation</h2><p className="mt-4 text-sm leading-6 text-slate-600">Coverage reflects current programme records. Clusters without coordinates use an approximate state placement and are identified in the map description. Counts are programme intelligence, not official population statistics.</p><Link href={`/dashboard/lcdbo/states/${slugify(selectedState!)}`} className="mt-5 inline-flex rounded-xl bg-[#0B2E59] px-4 py-3 text-sm font-black text-white">Open full state dashboard</Link></article>
      </section> : <section className="grid gap-5 lg:grid-cols-3"><IntelligenceBarChart title="MSMEs by state" data={snapshot.states} /><IntelligenceBarChart title="Clusters by state" data={snapshot.clusterStates} /><IntelligenceBarChart title="Active participation by state" data={snapshot.participationStates} /></section>}
    </div>
  </main>;
}

function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
