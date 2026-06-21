import Link from "next/link";
import { Activity, Building2, CheckCircle2, Factory, FileClock, FileText, Gauge, Handshake, MapPinned, Users } from "lucide-react";
import type { PlatformEvent } from "@/types/platform";
import { LcdboCommandMetricCard, LcdboCoveragePanel, LcdboPipeline, LcdboSicipTeaser } from "@/components/lcdbo/lcdbo-visuals";

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
};

export function LcdboExecutiveDashboard({ metrics, pipeline, topSectors, topStates, recentActivity, partners }: Props) {
  return (
    <main className="min-h-screen bg-[#F6F8FB] text-slate-900">
      <header className="relative overflow-hidden bg-[#0B2E59] text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#008751]/25 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#efc85d]">Read-only executive view</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">LCDBO National Programme Dashboard</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">A concise national operating picture for industrial cluster participation, MSME readiness and programme delivery.</p></div>
            <div className="flex flex-wrap gap-2"><Link href="/dashboard/lcdbo" className="rounded-xl border border-white/20 px-4 py-3 text-sm font-black text-white">Operations</Link><Link href="/lcdbo" className="rounded-xl bg-[#D4A017] px-4 py-3 text-sm font-black text-[#0B2E59]">Public Programme</Link></div>
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

        <LcdboSicipTeaser />
      </div>
    </main>
  );
}

function Ranking({ title, rows, icon: Icon }: { title: string; rows: Array<[string, number]>; icon: typeof Factory }) {
  const peak = Math.max(...rows.map(([, count]) => count), 1);
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-[#008751]" /><h2 className="text-xl font-black text-[#0B2E59]">{title}</h2></div><div className="mt-5 space-y-4">{rows.map(([label, count]) => <div key={label}><div className="flex justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span className="font-black text-[#0B2E59]">{count}</span></div><div className="mt-1.5 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#008751]" style={{ width: `${(count / peak) * 100}%` }} /></div></div>)}{!rows.length && <p className="text-sm text-slate-500">Coverage data will appear as enrolments grow.</p>}</div></article>;
}
