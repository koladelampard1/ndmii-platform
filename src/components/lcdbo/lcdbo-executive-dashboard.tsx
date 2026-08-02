import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Building2, CheckCircle2, DatabaseZap, Factory, FileClock, FileText, Gauge, Handshake, MapPinned, Route, ShieldCheck, Users } from "lucide-react";
import type { PlatformEvent } from "@/types/platform";
import type { DataQualityResult, ProgrammeHealthResult, ReportSnapshot } from "@/lib/data/lcdbo-governance";
import type { Sprint3Snapshot } from "@/lib/data/lcdbo-delivery-intelligence";
import { LcdboCommandMetricCard, LcdboCoveragePanel, LcdboPipeline, LcdboSicipTeaser } from "@/components/lcdbo/lcdbo-visuals";
import { ExecutiveMetricCard, ExecutiveMetricGrid } from "@/components/workspace/workspace-metrics";
import { lcdboPublicHref } from "@/lib/lcdbo/content";

type ExecutiveMetric = {
  enrolments: number;
  clusters: number;
  activeParticipants: number;
  documentsPending: number;
  readinessCompleted: number;
  statesCovered: number;
  strategicPartners: number;
  pendingReviews: number;
};

type Props = {
  metrics: ExecutiveMetric;
  pipeline: Array<{ label: string; value: number }>;
  topSectors: Array<[string, number]>;
  topStates: Array<[string, number]>;
  recentActivity: PlatformEvent[];
  partners: string[];
  quality: DataQualityResult;
  health: ProgrammeHealthResult;
  reportSnapshots: ReportSnapshot[];
  deliveryIntelligence: Sprint3Snapshot;
};

export function LcdboExecutiveDashboard({ metrics, pipeline, topSectors, topStates, recentActivity, partners, quality, health, reportSnapshots, deliveryIntelligence }: Props) {
  return (
    <main className="min-h-screen bg-[#F6F8FB] text-slate-900">
      <header className="relative overflow-hidden bg-[#0B2E59] text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#008751]/25 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Read-only executive view</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">LCDBO National Programme Dashboard</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">A concise national operating picture for industrial cluster participation, MSME readiness and programme delivery.</p></div>
            <div className="flex flex-wrap gap-2"><Link href="/dashboard/lcdbo" className="rounded-xl border border-white/20 px-4 py-3 text-sm font-black text-white">Operations</Link><Link href={lcdboPublicHref()} className="rounded-xl bg-[#D4A017] px-4 py-3 text-sm font-black text-[#0B2E59]">Public Programme</Link></div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <section aria-label="National programme metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LcdboCommandMetricCard icon={Users} label="Enrolments" value={metrics.enrolments} />
          <LcdboCommandMetricCard icon={Factory} label="Industrial clusters" value={metrics.clusters} />
          <LcdboCommandMetricCard icon={CheckCircle2} label="Active participants" value={metrics.activeParticipants} />
          <LcdboCommandMetricCard icon={FileClock} label="Documents pending" value={metrics.documentsPending} attention={metrics.documentsPending > 0} />
          <LcdboCommandMetricCard icon={Gauge} label="Readiness completed" value={metrics.readinessCompleted} />
          <LcdboCommandMetricCard icon={MapPinned} label="States covered" value={metrics.statesCovered} />
          <LcdboCommandMetricCard icon={Handshake} label="Strategic partners" value={metrics.strategicPartners} />
          <LcdboCommandMetricCard icon={FileText} label="Pending reviews" value={metrics.pendingReviews} attention={metrics.pendingReviews > 0} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><DatabaseZap className="h-5 w-5 text-[#008751]" /><h2 className="font-black text-[#0B2E59]">Governance confidence</h2></div><div className="mt-5 grid grid-cols-2 gap-3">{[["Data quality", quality.score], ["Programme health", health.score]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className={`text-3xl font-black ${Number(value) >= 75 ? "text-[#008751]" : "text-amber-600"}`}>{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label} / 100</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/lcdbo/data-quality" className="rounded-xl bg-[#0B2E59] px-3 py-2 text-xs font-black text-white">Data quality</Link><Link href="/dashboard/lcdbo/geography" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-[#0B2E59]">Geography</Link><Link href="/dashboard/lcdbo/briefings" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-[#0B2E59]">Briefings</Link></div></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><h2 className="font-black text-[#0B2E59]">Executive attention</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{health.alerts.filter((item) => item.count > 0).slice(0, 4).map((item) => <div key={item.code} className="rounded-xl bg-amber-50 p-3"><p className="text-sm font-black text-amber-950">{item.label} · {item.count}</p><p className="mt-1 text-xs text-amber-800">{item.detail}</p></div>)}{!health.alerts.some((item) => item.count > 0) && <p className="text-sm text-slate-500">No active programme alerts.</p>}</div></article></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Delivery intelligence</p>
              <h2 className="mt-1 text-2xl font-black text-[#0B2E59]">Explainable programme health</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{deliveryIntelligence.health.disclosure}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/lcdbo/executive/attention" className="inline-flex items-center gap-2 rounded-xl bg-[#0B2E59] px-4 py-3 text-sm font-black text-white">Attention queue<ArrowRight className="h-4 w-4" /></Link>
              <Link href="/dashboard/lcdbo/pilot-readiness" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-[#0B2E59]">Pilot readiness</Link>
              <Link href="/dashboard/lcdbo/evidence" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-[#0B2E59]">Evidence</Link>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Calculated health</p>
              <p className="mt-3 text-5xl font-black">{deliveryIntelligence.health.score}</p>
              <p className="mt-2 text-sm font-bold text-slate-300">{deliveryIntelligence.health.statusText}</p>
              <p className="mt-4 text-xs leading-5 text-slate-400">{deliveryIntelligence.health.modelVersion} · {new Date(deliveryIntelligence.health.calculatedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {deliveryIntelligence.health.factors.slice(0, 8).map((factor) => (
                <Link key={factor.code} href={factor.drillDownHref} className="rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3"><p className="font-black text-slate-900">{factor.label}</p><span className="text-sm font-black text-[#008751]">{factor.score}</span></div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{factor.explanation}</p>
                  {factor.missingDataImpact ? <p className="mt-2 text-xs font-bold text-amber-700">{factor.missingDataImpact}</p> : null}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <ExecutiveMetricGrid>
          {deliveryIntelligence.metrics.slice(0, 8).map((item) => (
            <ExecutiveMetricCard
              key={item.title}
              label={item.title}
              value={item.value}
              context={item.calculationBasis}
              status={String(item.value).includes("0") ? "neutral" : item.title.toLowerCase().includes("overdue") || item.title.toLowerCase().includes("critical") || item.title.toLowerCase().includes("pending") ? "attention" : "positive"}
              classification={{ classification: item.classification === "live_operational" ? "operational" : item.classification === "configured_target" ? "target" : item.classification === "governed_estimate" ? "estimate" : item.classification === "test_uat" ? "unavailable" : "aggregate", label: item.classification.replaceAll("_", " ") }}
              sourceNote={`${item.source}. Excluded UAT/test: ${item.excludedRecords}.`}
              comparisonPeriod={item.reportingPeriod}
              action={{ label: "View lineage", href: item.drillDownHref }}
              icon={item.title.includes("Pilot") ? ShieldCheck : item.title.includes("Active") ? MapPinned : item.title.includes("Progress") ? Gauge : item.title.includes("Decision") ? FileText : item.title.includes("Risk") ? AlertTriangle : Route}
            />
          ))}
        </ExecutiveMetricGrid>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Multi-level health</p>
              <h2 className="mt-1 text-2xl font-black text-[#0B2E59]">Health explanation by delivery level</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Programme, workstream, state, LGA and cluster scores use the same versioned model and show included records, excluded UAT/test records and drill-down destinations.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{deliveryIntelligence.health.modelVersion}</span>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Records</th><th className="px-4 py-3">Missing/test impact</th><th className="px-4 py-3">Drill-down</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveryIntelligence.scopedHealth.slice(0, 12).map((item) => (
                  <tr key={`${item.targetType}:${item.targetId}`}>
                    <td className="px-4 py-3"><p className="font-black text-slate-900">{item.targetTitle}</p><p className="mt-1 text-xs text-slate-500">{item.targetType.replaceAll("_", " ")}</p></td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{item.statusText}</span>{item.override ? <p className="mt-1 text-xs font-bold text-amber-700">Override: {item.override.override_reason}</p> : null}</td>
                    <td className="px-4 py-3 font-black text-[#0B2E59]">{item.score}</td>
                    <td className="px-4 py-3 text-slate-600">{item.includedRecords} included · {item.excludedRecords} UAT/test excluded</td>
                    <td className="px-4 py-3 text-xs leading-5 text-slate-500">{item.factors.find((factor) => factor.missingDataImpact)?.missingDataImpact ?? item.disclosure}</td>
                    <td className="px-4 py-3"><Link href={item.drillDownHref} className="font-black text-emerald-700 hover:underline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Programme pipeline</p><h2 className="mt-1 text-2xl font-black text-[#0B2E59]">National delivery progression</h2><div className="mt-5"><LcdboPipeline stages={pipeline} /></div></section>

        <LcdboCoveragePanel states={metrics.statesCovered} clusters={metrics.clusters} enrolments={metrics.enrolments} pending={metrics.pendingReviews + metrics.documentsPending} />

        <section className="grid gap-5 lg:grid-cols-2">
          <Ranking title="Top sectors" rows={topSectors} icon={Factory} />
          <Ranking title="Top states" rows={topStates} icon={MapPinned} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-[#008751]" /><h2 className="text-xl font-black text-[#0B2E59]">Recent programme activity</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{recentActivity.slice(0, 8).map((event) => <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-bold capitalize text-slate-800">{event.event_type.replace("lcdbo.", "").replaceAll("_", " ").replaceAll(".", " · ")}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p></div>)}{!recentActivity.length && <p className="text-sm text-slate-500">Programme activity will appear as operational milestones are recorded.</p>}</div></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[#008751]" /><h2 className="text-xl font-black text-[#0B2E59]">Strategic partners</h2></div><div className="mt-5 space-y-2">{partners.map((partner, index) => <div key={partner} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0B2E59] text-xs font-black text-white">{String(index + 1).padStart(2, "0")}</span><span className="text-sm font-bold text-slate-700">{partner}</span></div>)}</div></article>
        </section>

        {reportSnapshots.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Reporting cadence</p><h2 className="mt-1 text-xl font-black text-[#0B2E59]">Latest governed snapshots</h2></div><Link href="/dashboard/lcdbo/reports" className="rounded-xl bg-[#0B2E59] px-4 py-3 text-sm font-black text-white">Open reports</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{reportSnapshots.slice(0, 4).map((item) => { const delta = snapshotDelta(reportSnapshots, item); return <div key={item.id} className="rounded-xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-2"><p className="font-black capitalize text-[#0B2E59]">{item.report_type.replaceAll("_", " ")}</p>{delta != null ? <span className={`rounded-full px-2 py-1 text-[10px] font-black ${delta >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{delta >= 0 ? "+" : ""}{delta}</span> : null}</div><p className="mt-1 text-xs text-slate-500">{item.snapshot_date} · {item.frequency}</p></div>; })}</div></section> : <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Reporting cadence</p><h2 className="mt-1 text-xl font-black text-[#0B2E59]">No governed snapshots yet</h2><p className="mt-2 text-sm leading-6 text-slate-500">Capture the first reporting snapshot to establish an executive baseline and unlock period comparisons.</p><Link href="/dashboard/lcdbo/data-quality" className="mt-4 inline-flex rounded-xl bg-[#0B2E59] px-4 py-3 text-sm font-black text-white">Establish baseline</Link></section>}

        <LcdboSicipTeaser />
      </div>
    </main>
  );
}

function Ranking({ title, rows, icon: Icon }: { title: string; rows: Array<[string, number]>; icon: typeof Factory }) {
  const peak = Math.max(...rows.map(([, count]) => count), 1);
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-[#008751]" /><h2 className="text-xl font-black text-[#0B2E59]">{title}</h2></div><div className="mt-5 space-y-4">{rows.map(([label, count]) => <div key={label}><div className="flex justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span className="font-black text-[#0B2E59]">{count}</span></div><div className="mt-1.5 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#008751]" style={{ width: `${(count / peak) * 100}%` }} /></div></div>)}{!rows.length && <p className="text-sm text-slate-500">Coverage data will appear as enrolments grow.</p>}</div></article>;
}

function snapshotDelta(items: ReportSnapshot[], current: ReportSnapshot) { const score = Number(current.metrics_payload.score); if (!Number.isFinite(score)) return null; const previous = items.find((item) => item.report_type === current.report_type && item.id !== current.id && Number.isFinite(Number(item.metrics_payload.score))); return previous ? score - Number(previous.metrics_payload.score) : null; }
