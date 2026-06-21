import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { requireLcdboIntelligenceAccess } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { calculateDataQuality, calculateProgrammeHealth } from "@/lib/data/lcdbo-governance";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { scopeLcdboSnapshot } from "@/lib/reports/lcdbo-reporting";
import { IntelligenceHeader, ProgrammeEstimates } from "@/components/lcdbo/lcdbo-intelligence-dashboard";

const TYPES = ["national", "state", "cluster", "partner"] as const;
type BriefingType = typeof TYPES[number];

export default async function LcdboBriefingsPage({ searchParams }: { searchParams: Promise<{ type?: string; scope?: string }> }) {
  await requireLcdboIntelligenceAccess();
  const params = await searchParams;
  const type: BriefingType = TYPES.includes(params.type as BriefingType) ? params.type as BriefingType : "national";
  const snapshot = await getLcdboIntelligenceSnapshot(await createServiceRoleSupabaseClient());
  const scopeOptions = type === "state" ? snapshot.states.map(([state]) => [state, state] as const) : type === "cluster" ? snapshot.clusters.map((cluster) => [cluster.id, cluster.name] as const) : type === "partner" ? snapshot.partners.map((partner) => [partner.id, partner.name] as const) : [];
  const scope = scopeOptions.some(([id]) => id === params.scope) ? params.scope : "";
  const scopeLabel = scopeOptions.find(([id]) => id === scope)?.[1];
  const scopedSnapshot = scopeLcdboSnapshot(snapshot, { reportType: type, state: type === "state" ? scope : null, cluster: type === "cluster" ? scope : null, partner: type === "partner" ? scope : null });
  const quality = calculateDataQuality(scopedSnapshot);
  const health = calculateProgrammeHealth(scopedSnapshot);
  const briefing = buildBriefing(type, scopeLabel, scopedSnapshot, quality.score, health.score);
  const query = new URLSearchParams({ ...(scope ? { scope } : {}) }).toString();

  return <main className="min-h-screen bg-[#F6F8FB] print:bg-white"><div className="print:hidden"><IntelligenceHeader eyebrow="Executive Briefing Centre" title="LCDBO Decision Briefings" description="Generate concise national, state, cluster and partner briefings with governed metrics, opportunities, risks and recommended actions." /></div><div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 print:max-w-none print:px-0">
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden sm:grid-cols-3">
      <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Briefing audience<select name="type" defaultValue={type} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal text-slate-900">{TYPES.map((item) => <option key={item} value={item}>{humanize(item)} briefing</option>)}</select></label>
      <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Scope<select name="scope" defaultValue={scope} disabled={!scopeOptions.length} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 disabled:bg-slate-100"><option value="">{scopeOptions.length ? `All ${type}s` : "National programme"}</option>{scopeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <button className="self-end rounded-xl bg-[#0B2E59] px-5 py-3 text-sm font-black text-white">Generate briefing</button>
    </form>

    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">{humanize(type)} executive briefing</p><h1 className="mt-2 text-3xl font-black text-[#0B2E59]">{scopeLabel ? `${scopeLabel} LCDBO Briefing` : "LCDBO National Programme Briefing"}</h1><p className="mt-2 text-sm text-slate-500">Prepared {new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}</p></div><div className="flex gap-2 print:hidden"><Link href={`/api/lcdbo/briefings/${type}/pdf${query ? `?${query}` : ""}`} className="inline-flex items-center gap-2 rounded-xl bg-[#008751] px-4 py-3 text-sm font-black text-white"><Download className="h-4 w-4" />Export PDF</Link><span className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700"><Printer className="h-4 w-4" />Print ready</span></div></div>
      <section className="mt-7"><h2 className="text-xl font-black text-[#0B2E59]">Executive summary</h2><p className="mt-3 text-sm leading-7 text-slate-600">{briefing.summary}</p></section>
      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{briefing.metrics.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-black text-[#0B2E59]">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>)}</section>
      <div className="mt-8"><ProgrammeEstimates estimates={scopedSnapshot.estimates} /><div className="mt-3 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500"><p>Programme Estimate values are derived from current LCDBO records and configured cluster targets.</p><p>Demonstration records, where present, are synthetic and explicitly marked as sample data.</p><p>This briefing is a programme decision-support artifact and does not represent official government statistics.</p></div></div>
      <section className="mt-8 grid gap-6 lg:grid-cols-3"><BriefingList title="Top opportunities" items={briefing.opportunities} tone="green" /><BriefingList title="Key risks" items={briefing.risks} tone="red" /><BriefingList title="Recommended actions" items={briefing.actions} tone="blue" /></section>
      <footer className="mt-9 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">Programme estimates are derived from current LCDBO records and configured cluster targets. Demonstration records are synthetic where explicitly marked. This briefing is decision support and not an official government statistic.</footer>
    </article>
  </div></main>;
}

function buildBriefing(type: BriefingType, scope: string | undefined, snapshot: Awaited<ReturnType<typeof getLcdboIntelligenceSnapshot>>, quality: number, health: number) {
  const subject = scope ?? (type === "national" ? "the national programme" : `the ${type} portfolio`);
  const risks = calculateProgrammeHealth(snapshot).alerts.filter((alert) => alert.count > 0).slice(0, 3).map((alert) => `${alert.label}: ${alert.count} records require attention.`);
  return { summary: `${humanize(subject)} currently represents ${snapshot.metrics.totalMsmes.toLocaleString("en-NG")} enrolled MSMEs across ${snapshot.metrics.statesCovered} states and ${snapshot.metrics.totalClusters} industrial clusters. Programme health is ${health}/100 and data quality is ${quality}/100, providing a governed basis for prioritising delivery action.`, metrics: [["Enrolled MSMEs", snapshot.metrics.totalMsmes], ["Active participants", snapshot.metrics.activeParticipants], ["Readiness complete", snapshot.metrics.assessmentsCompleted], ["States covered", snapshot.metrics.statesCovered]] as Array<[string, number]>, opportunities: [`Scale participation in ${snapshot.sectors[0]?.[0] ?? "priority industrial"} value chains.`, `Advance ${snapshot.assessments.filter((item) => ["ready_for_investment", "ready_for_export"].includes(item.readiness_level)).length} investment/export-ready MSMEs.`, `Use the ${snapshot.partners.length} active programme partnerships to close evidence and support gaps.`], risks: risks.length ? risks : ["No high-severity operational alerts are currently recorded."], actions: ["Resolve high-severity data quality exceptions before the next reporting cycle.", "Prioritise overdue reviews, assessments and document evidence.", "Refresh KPI and report snapshots at the agreed governance frequency."] };
}

function BriefingList({ title, items, tone }: { title: string; items: string[]; tone: "green" | "red" | "blue" }) { const styles = { green: "border-emerald-200 bg-emerald-50 text-emerald-900", red: "border-red-200 bg-red-50 text-red-900", blue: "border-blue-200 bg-blue-50 text-blue-900" }; return <section className={`rounded-2xl border p-5 ${styles[tone]}`}><h2 className="font-black">{title}</h2><ul className="mt-4 space-y-3 text-sm leading-6">{items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}</ul></section>; }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
