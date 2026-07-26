import Link from "next/link";
import { BarChart3, Building2, Download, Factory, FileText, Gauge, Handshake, Printer } from "lucide-react";
import { requireLcdboIntelligenceAccess } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { IntelligenceHeader, ProgrammeEstimates } from "@/components/lcdbo/lcdbo-intelligence-dashboard";
import { scopeLcdboSnapshot } from "@/lib/reports/lcdbo-reporting";

const REPORT_TYPES = [
  { id: "national", title: "National Programme Report", detail: "National participation, coverage, readiness and programme estimates.", icon: BarChart3 },
  { id: "state", title: "State Report", detail: "State-level MSME, cluster and readiness intelligence.", icon: Building2 },
  { id: "cluster", title: "Cluster Report", detail: "Single-cluster participation and operational profile.", icon: Factory },
  { id: "partner", title: "Partner Report", detail: "Institution-specific programme participation view.", icon: Handshake },
  { id: "readiness", title: "Readiness Report", detail: "Assessment distribution and investment-readiness progression.", icon: Gauge },
  { id: "participation", title: "Participation Report", detail: "Enrolment and cluster participation pipeline.", icon: FileText },
] as const;

const DELIVERY_REPORTS = [
  { dataset: "programme-delivery", title: "Programme Delivery Report", detail: "Overall governed programme delivery, lineage and model disclosures." },
  { dataset: "workstream-performance", title: "Workstream Performance Report", detail: "Workstream health, contribution and missing-data impacts." },
  { dataset: "milestone-deliverable", title: "Milestone and Deliverable Report", detail: "Overdue, blocked and governed commitment performance." },
  { dataset: "risk-issue", title: "Risk and Issue Report", detail: "Critical risks, issues and escalation attention records." },
  { dataset: "state-delivery", title: "State Delivery Report", detail: "State delivery health, reporting completeness and drill-downs." },
  { dataset: "lga-delivery", title: "LGA Delivery Report", detail: "LGA delivery health, reporting completeness and exceptions." },
  { dataset: "cluster-delivery", title: "Cluster Delivery Report", detail: "Cluster delivery health, progress and readiness signals." },
  { dataset: "executive-exceptions", title: "Executive Exceptions Report", detail: "Decisions, critical risks, overdue records, stale reporting and readiness blockers." },
  { dataset: "pilot-readiness", title: "Pilot-Readiness Report", detail: "State, LGA and cluster controlled-pilot readiness outcomes." },
  { dataset: "evidence-verification", title: "Evidence Verification Report", detail: "Evidence links, lifecycle status, classification and review state." },
] as const;

export default async function LcdboReportsPage({ searchParams }: { searchParams: Promise<{ type?: string; state?: string; cluster?: string; partner?: string }> }) {
  await requireLcdboIntelligenceAccess();
  const params = await searchParams;
  const snapshot = await getLcdboIntelligenceSnapshot(await createServiceRoleSupabaseClient());
  const reportType = REPORT_TYPES.some((item) => item.id === params.type) ? params.type! : "national";
  const state = reportType === "state" && snapshot.states.some(([name]) => name === params.state) ? params.state : null;
  const cluster = reportType === "cluster" && snapshot.clusters.some((item) => item.id === params.cluster) ? params.cluster : null;
  const partner = reportType === "partner" && snapshot.partners.some((item) => item.id === params.partner) ? params.partner : null;
  const scoped = scopeLcdboSnapshot(snapshot, { reportType, state, cluster, partner });
  const scopeLabel = state ?? snapshot.clusters.find((item) => item.id === cluster)?.name ?? snapshot.partners.find((item) => item.id === partner)?.name;
  const exportParams = new URLSearchParams();
  if (state) exportParams.set("state", state);
  if (cluster) exportParams.set("cluster", cluster);
  if (partner) exportParams.set("partner", partner);
  const query = exportParams.toString();
  return <main className="min-h-screen bg-[#F6F8FB] print:bg-white"><div className="print:hidden"><IntelligenceHeader eyebrow="Executive Reporting Centre" title="LCDBO Reports" description="Generate national, state, cluster, partner, readiness and participation views from the governed programme dataset." /></div><div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 print:max-w-none print:px-0">
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden md:grid-cols-2 xl:grid-cols-5">
      <Select name="type" label="Report type" value={reportType} options={REPORT_TYPES.map((item) => [item.id, item.title])} />
      <Select name="state" label="State" value={params.state ?? ""} options={snapshot.states.map(([state]) => [state, state])} />
      <Select name="cluster" label="Cluster" value={params.cluster ?? ""} options={snapshot.clusters.map((cluster) => [cluster.id, cluster.name])} />
      <Select name="partner" label="Partner" value={params.partner ?? ""} options={snapshot.partners.map((partner) => [partner.id, partner.name])} />
      <button className="self-end rounded-xl bg-[#0B2E59] px-4 py-3 text-sm font-black text-white">Apply filters</button>
    </form>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:hidden">{REPORT_TYPES.map((item) => { const Icon = item.icon; return <Link key={item.id} href={`/dashboard/lcdbo/reports?type=${item.id}`} className={`rounded-2xl border p-5 shadow-sm ${reportType === item.id ? "border-[#D4A017] bg-amber-50" : "border-slate-200 bg-white"}`}><Icon className="h-5 w-5 text-[#008751]" /><h2 className="mt-4 font-black text-[#0B2E59]">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p></Link>; })}</section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Programme delivery reports</p>
      <h2 className="mt-1 text-2xl font-black text-[#0B2E59]">Sprint 3 governed delivery exports</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">These governed reports reuse the delivery export/PDF authorization guards, preserve formula-injection protection and exclude UAT/test records by default.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DELIVERY_REPORTS.map((item) => <article key={item.dataset} className="rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"><Download className="h-5 w-5 text-[#008751]" /><h3 className="mt-3 font-black text-[#0B2E59]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p><div className="mt-4 flex flex-wrap gap-2"><Link href={`/api/lcdbo/delivery/export/${item.dataset}`} className="rounded-xl bg-[#008751] px-3 py-2 text-xs font-black text-white">CSV</Link><Link href={`/api/lcdbo/reports/${item.dataset}/pdf`} className="rounded-xl bg-[#0B2E59] px-3 py-2 text-xs font-black text-white">PDF</Link><Link href={`/api/lcdbo/briefings/${item.dataset}/pdf`} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">Briefing PDF</Link></div></article>)}
      </div>
    </section>

    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">Executive report · Programme Estimate</p><h1 className="mt-2 text-3xl font-black text-[#0B2E59]">{scopeLabel ? `${scopeLabel} · ` : ""}{REPORT_TYPES.find((item) => item.id === reportType)?.title}</h1><p className="mt-2 text-sm text-slate-500">Generated {new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}. Values reflect current programme records and clearly marked demonstration data.</p></div><div className="flex flex-wrap gap-2 print:hidden"><Link href={`/api/lcdbo/reports/${reportType}${query ? `?${query}` : ""}`} className="inline-flex items-center gap-2 rounded-xl bg-[#008751] px-4 py-3 text-sm font-black text-white"><Download className="h-4 w-4" />Export CSV</Link><Link href={`/api/lcdbo/reports/${reportType}/pdf${query ? `?${query}` : ""}`} className="inline-flex items-center gap-2 rounded-xl bg-[#0B2E59] px-4 py-3 text-sm font-black text-white"><FileText className="h-4 w-4" />Export PDF</Link><span className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700"><Printer className="h-4 w-4" />Browser print ready</span></div></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["MSMEs", scoped.metrics.totalMsmes], ["Clusters", scoped.metrics.totalClusters], ["Assessments", scoped.metrics.assessmentsCompleted], ["Active participants", scoped.metrics.activeParticipants]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className="text-3xl font-black text-[#0B2E59]">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>)}</div></article>

    <ProgrammeEstimates estimates={scoped.estimates} />
    <p className="text-xs text-slate-500">Print using your browser&apos;s print command. The report body uses a print-optimised layout.</p>
  </div></main>;
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Array<readonly [string, string]> }) { return <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}<select name={name} defaultValue={value} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900"><option value="">All</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }
