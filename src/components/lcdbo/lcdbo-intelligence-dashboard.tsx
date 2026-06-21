import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Building2, CheckCircle2, ClipboardCheck, Factory, FileCheck2, Gauge, MapPinned, Users, UserRoundCheck } from "lucide-react";
import type { IntelligenceBreakdown, LcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { LcdboCommandMetricCard, LcdboCoveragePanel, LcdboPipeline } from "@/components/lcdbo/lcdbo-visuals";

export function LcdboIntelligenceDashboard({ snapshot }: { snapshot: LcdboIntelligenceSnapshot }) {
  const metrics = snapshot.metrics;
  return (
    <main className="min-h-screen bg-[#F6F8FB]">
      <IntelligenceHeader eyebrow="National Programme Intelligence Centre" title="LCDBO National Intelligence" description="A national view of MSME participation, industrial clusters, readiness, programme geography and delivery progression." />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="National summary">
          <LcdboCommandMetricCard icon={Users} label="Total MSMEs" value={metrics.totalMsmes} />
          <LcdboCommandMetricCard icon={Factory} label="Total clusters" value={metrics.totalClusters} />
          <LcdboCommandMetricCard icon={CheckCircle2} label="Active participants" value={metrics.activeParticipants} />
          <LcdboCommandMetricCard icon={MapPinned} label="States covered" value={metrics.statesCovered} />
          <LcdboCommandMetricCard icon={Building2} label="LGAs covered" value={metrics.lgasCovered} />
          <LcdboCommandMetricCard icon={UserRoundCheck} label="Officers assigned" value={metrics.officersAssigned} />
          <LcdboCommandMetricCard icon={ClipboardCheck} label="Assessments complete" value={metrics.assessmentsCompleted} />
          <LcdboCommandMetricCard icon={FileCheck2} label="Documents reviewed" value={metrics.documentsReviewed} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><SectionTitle eyebrow="Programme pipeline" title="From registration to active participation" /><div className="mt-5"><LcdboPipeline stages={snapshot.pipeline} /></div></section>

        <section className="grid gap-5 xl:grid-cols-3">
          <IntelligenceBarChart title="MSMEs by sector" data={snapshot.sectors} />
          <IntelligenceBarChart title="Clusters by sector" data={snapshot.clusterSectors} />
          <ReadinessBySector data={snapshot.readinessBySector} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <LcdboCoveragePanel states={metrics.statesCovered} clusters={metrics.totalClusters} enrolments={metrics.totalMsmes} pending={snapshot.pipeline[1]?.value ?? 0} />
          <ReadinessProfile data={snapshot.readiness} />
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <IntelligenceBarChart title="MSMEs by state" data={snapshot.states} />
          <IntelligenceBarChart title="Clusters by state" data={snapshot.clusterStates} />
          <IntelligenceBarChart title="Participation by state" data={snapshot.participationStates} />
        </section>

        <ProgrammeEstimates estimates={snapshot.estimates} />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><SectionTitle eyebrow="State intelligence" title="Explore programme geography" /><Link href="/dashboard/lcdbo/reports" className="rounded-xl bg-[#0B2E59] px-4 py-3 text-sm font-black text-white">Open reporting centre</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{snapshot.states.slice(0, 10).map(([state, count]) => <Link key={state} href={`/dashboard/lcdbo/states/${slugify(state)}`} className="rounded-xl border border-slate-200 p-4 transition hover:border-[#D4A017]"><p className="text-lg font-black text-[#0B2E59]">{state}</p><p className="mt-1 text-sm text-slate-500">{count} enrolled MSMEs</p></Link>)}</div></section>

        <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle eyebrow="Cluster profiles" title="Industrial cluster intelligence" /><div className="mt-5 grid gap-3 sm:grid-cols-2">{snapshot.clusters.slice(0, 8).map((cluster) => <Link key={cluster.id} href={`/dashboard/lcdbo/clusters/${cluster.id}`} className="rounded-xl bg-slate-50 p-4 hover:bg-amber-50"><p className="font-black text-[#0B2E59]">{cluster.name}</p><p className="mt-1 text-xs text-slate-500">{cluster.stateName} · {cluster.memberCount} MSMEs</p></Link>)}</div></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle eyebrow="Partner dashboards" title="Institutional participation" /><div className="mt-5 grid gap-3 sm:grid-cols-2">{snapshot.partners.map((partner) => <Link key={partner.id} href={`/dashboard/lcdbo/partners/${partner.id}`} className="rounded-xl bg-slate-50 p-4 hover:bg-amber-50"><p className="font-black text-[#0B2E59]">{partner.name}</p><p className="mt-1 text-xs capitalize text-slate-500">{humanize(partner.partnerRole)}</p></Link>)}</div></article></section>
      </div>
    </main>
  );
}

export function IntelligenceHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="relative overflow-hidden bg-[#0B2E59] text-white"><div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#008751]/25 blur-3xl" /><div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-14"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">{eyebrow}</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p></div>{actions}</div></header>;
}

export function IntelligenceBarChart({ title, data, limit = 10 }: { title: string; data: IntelligenceBreakdown; limit?: number }) {
  const rows = data.slice(0, limit);
  const peak = Math.max(...rows.map(([, count]) => count), 1);
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#008751]" /><h2 className="font-black text-[#0B2E59]">{title}</h2></div><div className="mt-5 space-y-3">{rows.map(([label, count]) => <div key={label}><div className="flex justify-between gap-4 text-xs"><span className="truncate font-semibold text-slate-600">{humanize(label)}</span><span className="font-black text-[#0B2E59]">{count}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#008751] to-emerald-400" style={{ width: `${(count / peak) * 100}%` }} /></div></div>)}{!rows.length && <p className="text-sm text-slate-500">No programme data is available for this view yet.</p>}</div></article>;
}

export function ReadinessProfile({ data }: { data: IntelligenceBreakdown }) {
  const map = new Map(data);
  const levels = ["early_stage", "developing", "ready_for_cluster", "ready_for_investment", "ready_for_export"];
  const total = Math.max(levels.reduce((sum, level) => sum + (map.get(level) ?? 0), 0), 1);
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-[#008751]" /><h2 className="text-xl font-black text-[#0B2E59]">Readiness intelligence</h2></div><div className="mt-5 space-y-4">{levels.map((level, index) => { const count = map.get(level) ?? 0; return <div key={level}><div className="flex items-center justify-between text-sm"><span className="font-semibold capitalize text-slate-700">{humanize(level)}</span><span className="font-black text-[#0B2E59]">{count}</span></div><div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${["bg-slate-400", "bg-blue-400", "bg-[#D4A017]", "bg-emerald-500", "bg-[#008751]"][index]}`} style={{ width: `${(count / total) * 100}%` }} /></div></div>; })}</div></article>;
}

export function ProgrammeEstimates({ estimates }: { estimates: LcdboIntelligenceSnapshot["estimates"] }) {
  const items = [{ label: "Jobs supported", value: estimates.jobsSupported.toLocaleString("en-NG") }, { label: "MSMEs enabled", value: estimates.msmesEnabled.toLocaleString("en-NG") }, { label: "Cluster capacity", value: estimates.clusterCapacity.toLocaleString("en-NG") }, { label: "Export ready", value: estimates.exportReady.toLocaleString("en-NG") }, { label: "Investment pipeline", value: formatNaira(estimates.investmentPipeline) }];
  return <section className="rounded-2xl border border-[#D4A017]/30 bg-amber-50 p-5 sm:p-6"><SectionTitle eyebrow="Programme Estimate" title="Indicative economic impact" /><p className="mt-2 text-sm text-slate-600">Transparent estimates derived from current programme records, cluster targets and synthetic employee metadata. These are not official government statistics.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{items.map((item) => <div key={item.label} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-2xl font-black text-[#0B2E59]">{item.value}</p><p className="mt-1 text-xs font-bold text-slate-500">{item.label}</p><span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">Programme Estimate</span></div>)}</div><details className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-4"><summary className="cursor-pointer text-sm font-black text-[#0B2E59]">Calculation logic</summary><ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2"><li>Jobs supported: sum of recorded or synthetic employee estimates.</li><li>MSMEs enabled: current LCDBO enrolment records.</li><li>Cluster capacity and investment: sum of configured cluster targets.</li><li>Export readiness: latest assessments classified ready for export.</li></ul></details></section>;
}

function ReadinessBySector({ data }: { data: Record<string, IntelligenceBreakdown> }) {
  const rows = Object.entries(data).slice(0, 8);
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-[#008751]" /><h2 className="font-black text-[#0B2E59]">Readiness by sector</h2></div><div className="mt-5 space-y-3">{rows.map(([sector, levels]) => { const total = levels.reduce((sum, [, count]) => sum + count, 0); const advanced = levels.filter(([level]) => ["ready_for_investment", "ready_for_export"].includes(level)).reduce((sum, [, count]) => sum + count, 0); return <div key={sector} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between text-xs"><span className="font-bold text-slate-700">{sector}</span><span className="font-black text-[#0B2E59]">{advanced}/{total} advanced</span></div></div>; })}{!rows.length && <p className="text-sm text-slate-500">Readiness assessments will populate this view.</p>}</div></article>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">{eyebrow}</p><h2 className="mt-1 text-xl font-black text-[#0B2E59] sm:text-2xl">{title}</h2></div>; }
function humanize(value: string) { return value.replaceAll("_", " "); }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function formatNaira(value: number) { return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", notation: "compact", maximumFractionDigits: 1 }).format(value); }
