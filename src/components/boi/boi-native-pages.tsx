import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  Landmark,
  Search,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { BoiCanonicalSection, BoiOverview, BoiPipelineBusiness, BoiSearchParams, BoiWorkspaceData } from "@/lib/data/boi-workspace";
import { BOI_SECTION_CONFIGS, filterBoiBusinesses, paginateBoiItems } from "@/lib/data/boi-workspace";

const UNAVAILABLE = "Unavailable";

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function money(value: number | null | undefined) {
  if (typeof value !== "number") return UNAVAILABLE;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

function titleCase(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function fundingTypeLabel(value: string | null | undefined) {
  const normalised = (value ?? "").toLowerCase();
  if (!normalised || normalised === "support" || normalised.includes("intervention")) return "Funding Support";
  return titleCase(value);
}

function statusTone(value: string | null | undefined) {
  const normalised = (value ?? "").toLowerCase();
  if (["active", "verified", "approved", "completed", "strong", "accepted"].some((item) => normalised.includes(item))) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["high", "critical", "rejected", "overdue", "returned"].some((item) => normalised.includes(item))) return "border-rose-200 bg-rose-50 text-rose-700";
  if (["pending", "planned", "review", "hold", "medium", "submitted"].some((item) => normalised.includes(item))) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tone ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>
      {children}
    </span>
  );
}

function PageHero({ section }: { section: BoiCanonicalSection }) {
  const config = BOI_SECTION_CONFIGS[section];
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-[linear-gradient(120deg,#07162f_0%,#122e51_58%,#2f4b66_100%)] p-6 text-white sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">{config.eyebrow}</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{config.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/75">{config.description}</p>
          </div>
          <Badge tone="border-white/15 bg-white/10 text-white">Native BOI Workspace</Badge>
        </div>
      </div>
    </section>
  );
}

function EmptyPanel({ section }: { section: BoiCanonicalSection }) {
  const config = BOI_SECTION_CONFIGS[section];
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <ShieldCheck className="mx-auto h-8 w-8 text-slate-400" />
      <h3 className="mt-4 text-base font-black text-slate-950">{config.emptyTitle}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{config.emptyDescription}</p>
    </div>
  );
}

function FilterBar({ filters, businesses }: { filters: BoiSearchParams; businesses: BoiPipelineBusiness[] }) {
  const states = Array.from(new Set(businesses.map((item) => item.state).filter((item) => item !== UNAVAILABLE))).sort();
  const sectors = Array.from(new Set(businesses.map((item) => item.sector).filter((item) => item !== UNAVAILABLE))).sort();
  const readiness = Array.from(new Set(businesses.map((item) => item.readinessStatus).filter((item) => item !== UNAVAILABLE))).sort();
  const stages = Array.from(new Set(businesses.map((item) => item.fundingStage).filter((item) => item !== UNAVAILABLE))).sort();
  return (
    <form className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input name="q" defaultValue={filters.q} placeholder="Search business, BIN, sector or programme" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white" />
      </label>
      <Select name="state" value={filters.state} options={states} placeholder="All states" />
      <Select name="sector" value={filters.sector} options={sectors} placeholder="All sectors" />
      <Select name="readiness" value={filters.readiness} options={readiness} placeholder="Readiness" />
      <Select name="stage" value={filters.stage} options={stages} placeholder="Funding stage" />
      <button className="h-10 rounded-xl bg-[#07162f] px-4 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#0f2d54]">Apply</button>
    </form>
  );
}

function Select({ name, value, options, placeholder }: { name: string; value?: string; options: string[]; placeholder: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white">
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>{titleCase(option)}</option>
      ))}
    </select>
  );
}

function Pagination({ basePath, filters, page, pageCount, total, from, to }: { basePath: string; filters: BoiSearchParams; page: number; pageCount: number; total: number; from: number; to: number }) {
  const hrefFor = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && key !== "page") params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <Link aria-disabled={page <= 1} href={hrefFor(Math.max(1, page - 1))} className={`rounded-xl border px-3 py-2 text-xs font-bold ${page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Previous</Link>
        <span className="text-xs font-bold text-slate-500">Page {page} of {pageCount}</span>
        <Link aria-disabled={page >= pageCount} href={hrefFor(Math.min(pageCount, page + 1))} className={`rounded-xl border px-3 py-2 text-xs font-bold ${page >= pageCount ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Next</Link>
      </div>
    </div>
  );
}

export function BoiOverviewPage({ overview }: { overview: BoiOverview }) {
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#07162f_0%,#102f54_55%,#173b5d_100%)] p-6 text-white shadow-xl shadow-slate-300/30 sm:p-8">
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[48px] border-white/[0.035]" />
        <div className="relative grid gap-8 xl:grid-cols-[1fr_340px] xl:items-end">
          <div>
            <p className="inline-flex rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100">Development finance workspace</p>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">BOI investment intelligence for verified business growth.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100/75">Review pipeline quality, readiness signals, funding records, supporting documents, portfolio movement, risk indicators, and institutional reports from one dedicated workspace.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur">
            <p className="text-xs font-bold text-amber-200">Priority actions</p>
            <div className="mt-3 space-y-2">
              {[
                ["Review business pipeline", "/dashboard/boi/businesses"],
                ["Open readiness reviews", "/dashboard/boi/readiness"],
                ["View institutional reports", "/dashboard/boi/reports"],
              ].map(([label, href], index) => (
                <Link key={href} href={href} className={`flex items-center justify-between rounded-xl px-3 py-3 text-xs font-bold transition ${index === 0 ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/10"}`}>
                  {label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {overview.kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-2xl font-black tracking-tight text-slate-950">{kpi.value}</p>
            <h2 className="mt-2 text-sm font-bold text-slate-800">{kpi.label}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">{kpi.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <BoiBusinessTable businesses={overview.businesses.slice(0, 8)} compact />
        <OpportunityPanel overview={overview} />
      </section>
    </div>
  );
}

function OpportunityPanel({ overview }: { overview: BoiOverview }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Opportunity concentration</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">Sectors and states with visible pipeline activity</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <RankedList title="Top sectors" rows={overview.topSectors} />
        <RankedList title="Top states" rows={overview.topStates} />
      </div>
    </article>
  );
}

function RankedList({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? <p className="text-sm text-slate-500">Unavailable</p> : rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold text-slate-800">{row.label}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BoiSectionPage({ section, overview, filters }: { section: BoiCanonicalSection; overview: BoiOverview; filters: BoiSearchParams }) {
  return (
    <div className="space-y-5">
      <PageHero section={section} />
      {section === "businesses" && <BusinessPipelineSection overview={overview} filters={filters} />}
      {section === "funding-programmes" && <FundingProgrammesSection data={overview.data} />}
      {section === "funding-pipeline" && <FundingPipelineSection data={overview.data} />}
      {section === "readiness" && <ReadinessSection data={overview.data} />}
      {section === "documents" && <DocumentsSection data={overview.data} />}
      {section === "portfolio" && <PortfolioSection overview={overview} />}
      {section === "monitoring" && <MonitoringSection data={overview.data} />}
      {section === "intelligence" && <IntelligenceSection data={overview.data} overview={overview} />}
      {section === "reports" && <ReportsSection data={overview.data} />}
      {section === "risk" && <RiskSection data={overview.data} />}
      {section === "executive" && <ExecutiveSection overview={overview} />}
    </div>
  );
}

function BusinessPipelineSection({ overview, filters }: { overview: BoiOverview; filters: BoiSearchParams }) {
  const filtered = filterBoiBusinesses(overview.businesses, filters);
  const page = paginateBoiItems(filtered, filters.page, 12);
  return (
    <>
      <FilterBar filters={filters} businesses={overview.businesses} />
      {filtered.length === 0 ? <EmptyPanel section="businesses" /> : (
        <>
          <BoiBusinessTable businesses={page.items} />
          <Pagination basePath="/dashboard/boi/businesses" filters={filters} {...page} />
        </>
      )}
    </>
  );
}

function BoiBusinessTable({ businesses, compact = false }: { businesses: BoiPipelineBusiness[]; compact?: boolean }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Business pipeline</p>
          <h3 className="text-base font-black text-slate-950">Verified businesses and readiness signals</h3>
        </div>
        <UsersRound className="h-5 w-5 text-slate-400" />
      </div>
      {businesses.length === 0 ? <EmptyPanel section="businesses" /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Business</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Readiness</th>
                {!compact && <th className="px-5 py-3">Funding stage</th>}
                <th className="px-5 py-3">Risk</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {businesses.map((business) => (
                <tr key={business.memberId} className="align-top">
                  <td className="px-5 py-4">
                    <p className="font-black text-slate-950">{business.businessName}</p>
                    <p className="mt-1 text-xs text-slate-500">BIN: {business.bin}</p>
                    <p className="mt-1 text-xs text-slate-500">{business.sector}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{business.state}</td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone(business.readinessStatus)}>{titleCase(business.readinessStatus)}</Badge>
                    {typeof business.readinessScore === "number" && <p className="mt-1 text-xs font-bold text-slate-500">{business.readinessScore}% score</p>}
                  </td>
                  {!compact && <td className="px-5 py-4 text-slate-600">{titleCase(business.fundingStage)}</td>}
                  <td className="px-5 py-4"><Badge tone={statusTone(business.riskSignal)}>{business.riskSignal}</Badge></td>
                  <td className="px-5 py-4">
                    <Link href={`/dashboard/boi/businesses/${business.memberId}`} className="inline-flex items-center gap-1 text-xs font-black text-blue-700 hover:text-blue-900">
                      Open dossier <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function FundingProgrammesSection({ data }: { data: BoiWorkspaceData }) {
  if (data.programmes.length === 0) return <EmptyPanel section="funding-programmes" />;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.programmes.map((programme) => (
        <Link key={programme.id} href={`/dashboard/boi/funding-programmes/${programme.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200">
          <Landmark className="h-6 w-6 text-blue-700" />
          <h3 className="mt-4 text-lg font-black text-slate-950">{programme.name}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{programme.description ?? "Funding programme details are available in the governed portfolio record."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={statusTone(programme.status)}>{titleCase(programme.status)}</Badge>
            <Badge>{programme.programme_code ?? "Funding window"}</Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}

function FundingPipelineSection({ data }: { data: BoiWorkspaceData }) {
  if (data.interventions.length === 0) return <EmptyPanel section="funding-pipeline" />;
  return (
    <div className="grid gap-4">
      {data.interventions.map((item) => (
        <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">{fundingTypeLabel(item.intervention_type)}</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{item.msmes?.business_name ?? "Business not linked"} · {item.impact_programmes?.name ?? "Funding programme unavailable"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone(item.status)}>{titleCase(item.status)}</Badge>
              <Badge>{titleCase(typeof item.metadata?.stage === "string" ? item.metadata.stage : null)}</Badge>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Approved value" value={money(item.approved_amount)} />
            <Info label="Disbursed value" value={money(item.disbursed_amount)} />
            <Info label="Last updated" value={formatDate(item.updated_at)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ReadinessSection({ data }: { data: BoiWorkspaceData }) {
  if (data.assessments.length === 0) return <EmptyPanel section="readiness" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/dashboard/boi/readiness/templates" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">Assessment templates</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.assessments.map((assessment) => (
          <Link key={assessment.id} href={`/dashboard/boi/readiness/${assessment.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200">
            <Gauge className="h-6 w-6 text-amber-700" />
            <h3 className="mt-4 text-base font-black text-slate-950">{assessment.title ?? "Investment Readiness Assessment"}</h3>
            <p className="mt-2 text-sm text-slate-500">{assessment.msmes?.business_name ?? "Business unavailable"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={statusTone(assessment.status)}>{titleCase(assessment.status)}</Badge>
              <Badge>{typeof assessment.score === "number" ? `${assessment.score}%` : "Score unavailable"}</Badge>
              <Badge>{titleCase(assessment.risk_level)}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DocumentsSection({ data }: { data: BoiWorkspaceData }) {
  if (data.evidence.length === 0) return <EmptyPanel section="documents" />;
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
            <tr><th className="px-5 py-3">Document</th><th className="px-5 py-3">Business</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Review state</th><th className="px-5 py-3">Submitted</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.evidence.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-4 font-bold text-slate-950">{item.original_filename ?? item.file_name ?? "Supporting document"}</td>
                <td className="px-5 py-4 text-slate-600">{item.msmes?.business_name ?? UNAVAILABLE}</td>
                <td className="px-5 py-4 text-slate-600">{titleCase(item.evidence_category)}</td>
                <td className="px-5 py-4"><Badge tone={statusTone(item.verification_status)}>{titleCase(item.verification_status)}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{formatDate(item.submitted_at ?? item.uploaded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PortfolioSection({ overview }: { overview: BoiOverview }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <OpportunityPanel overview={overview} />
      <FundingPipelineSection data={overview.data} />
    </div>
  );
}

function MonitoringSection({ data }: { data: BoiWorkspaceData }) {
  if (data.visits.length === 0) return <EmptyPanel section="monitoring" />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.visits.map((visit) => (
        <article key={visit.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <CalendarDays className="h-6 w-6 text-blue-700" />
          <h3 className="mt-4 text-base font-black text-slate-950">{visit.title}</h3>
          <p className="mt-2 text-sm text-slate-500">{visit.msmes?.business_name ?? "Business unavailable"} · {formatDate(visit.visit_date)}</p>
          <div className="mt-4 flex flex-wrap gap-2"><Badge tone={statusTone(visit.status)}>{titleCase(visit.status)}</Badge><Badge>Monitoring record</Badge></div>
        </article>
      ))}
    </div>
  );
}

function IntelligenceSection({ data, overview }: { data: BoiWorkspaceData; overview: BoiOverview }) {
  const items = [...data.intelligence.insights, ...data.intelligence.summaries].slice(0, 12);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {items.length === 0 ? <EmptyPanel section="intelligence" /> : items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <BarChart3 className="h-5 w-5 text-blue-700" />
            <h3 className="mt-3 text-base font-black text-slate-950">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.summary}</p>
          </article>
        ))}
      </div>
      <OpportunityPanel overview={overview} />
    </div>
  );
}

function ReportsSection({ data }: { data: BoiWorkspaceData }) {
  if (data.reports.length === 0) return <EmptyPanel section="reports" />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.reports.map((report) => (
        <article key={report.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <FileCheck2 className="h-6 w-6 text-emerald-700" />
          <h3 className="mt-4 text-base font-black text-slate-950">{report.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{report.summary ?? "Approved institutional reporting record."}</p>
          <div className="mt-4 flex flex-wrap gap-2"><Badge tone={statusTone(report.status)}>{titleCase(report.status)}</Badge><Badge>{titleCase(report.report_type)}</Badge></div>
        </article>
      ))}
    </div>
  );
}

function RiskSection({ data }: { data: BoiWorkspaceData }) {
  if (data.intelligence.riskFlags.length === 0) return <EmptyPanel section="risk" />;
  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Risk signals are operational review indicators derived from documentation, verification, readiness, and portfolio records. They are not formal credit decisioning.</p>
      {data.intelligence.riskFlags.map((risk) => (
        <article key={risk.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          <h3 className="mt-3 text-base font-black text-slate-950">{risk.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{risk.description}</p>
          <div className="mt-4 flex flex-wrap gap-2"><Badge tone={statusTone(risk.severity)}>{titleCase(risk.severity)}</Badge><Badge>{titleCase(risk.risk_type)}</Badge></div>
        </article>
      ))}
    </div>
  );
}

function ExecutiveSection({ overview }: { overview: BoiOverview }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {overview.kpis.slice(0, 5).map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-2xl font-black text-slate-950">{kpi.value}</p>
            <h3 className="mt-2 text-sm font-bold text-slate-800">{kpi.label}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">{kpi.detail}</p>
          </article>
        ))}
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <BoiBusinessTable businesses={overview.businesses.slice(0, 8)} compact />
        <RiskSection data={overview.data} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function BoiBusinessDossier({ detail }: { detail: Awaited<ReturnType<typeof import("@/lib/data/boi-workspace").getBoiBusinessDetail>> }) {
  const business = detail.business;
  if (!business) return <EmptyPanel section="businesses" />;
  return (
    <div className="space-y-5">
      <Link href="/dashboard/boi/businesses" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to Business Pipeline</Link>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Investment dossier</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{business.businessName}</h2>
            <p className="mt-2 text-sm text-slate-500">BIN: {business.bin} · {business.sector} · {business.state}</p>
          </div>
          <div className="flex flex-wrap gap-2"><Badge tone={statusTone(business.verificationStatus)}>{titleCase(business.verificationStatus)}</Badge><Badge tone={statusTone(business.riskSignal)}>{business.riskSignal}</Badge></div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Readiness" value={`${titleCase(business.readinessStatus)}${typeof business.readinessScore === "number" ? ` · ${business.readinessScore}%` : ""}`} />
          <Info label="Funding stage" value={titleCase(business.fundingStage)} />
          <Info label="Programme" value={business.fundingProgramme} />
          <Info label="Outstanding documents" value={String(business.outstandingRequirements)} />
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-3">
        <MiniList title="Readiness history" icon={<Gauge className="h-5 w-5" />} items={detail.assessments.map((item) => ({ title: item.title ?? "Investment Readiness Assessment", meta: `${titleCase(item.status)} · ${typeof item.score === "number" ? `${item.score}%` : "Score unavailable"}` }))} />
        <MiniList title="Supporting documents" icon={<FileCheck2 className="h-5 w-5" />} items={detail.evidence.map((item) => ({ title: item.original_filename ?? item.file_name ?? "Supporting document", meta: titleCase(item.verification_status) }))} />
        <MiniList title="Portfolio activity" icon={<TrendingUp className="h-5 w-5" />} items={detail.interventions.map((item) => ({ title: item.title, meta: `${titleCase(item.status)} · ${money(item.approved_amount)}` }))} />
      </div>
    </div>
  );
}

export function BoiProgrammeDetailPage({ detail }: { detail: Awaited<ReturnType<typeof import("@/lib/data/boi-workspace").getBoiProgrammeDetail>> }) {
  const programme = detail.programme;
  if (!programme) return <EmptyPanel section="funding-programmes" />;
  return (
    <div className="space-y-5">
      <Link href="/dashboard/boi/funding-programmes" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to Funding Programmes</Link>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Landmark className="h-7 w-7 text-blue-700" />
        <h2 className="mt-4 text-3xl font-black text-slate-950">{programme.name}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{programme.description ?? "Funding programme details are available in the governed portfolio record."}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Status" value={titleCase(programme.status)} />
          <Info label="Funding records" value={String(detail.interventions.length + detail.unanchoredInterventions.length)} />
          <Info label="Business pipelines" value={String(detail.cohorts.length)} />
          <Info label="Start date" value={formatDate(programme.start_date)} />
        </div>
      </section>
      <FundingPipelineSection data={{ programmes: [programme], cohorts: detail.cohorts, members: [], interventions: [...detail.interventions, ...detail.unanchoredInterventions], assessments: [], templates: [], evidence: [], visits: [], reports: [], intelligence: { insights: [], recommendations: [], riskFlags: [], anomalies: [], summaries: [] }, metrics: null }} />
    </div>
  );
}

export function BoiAssessmentDetailPage({ detail }: { detail: Awaited<ReturnType<typeof import("@/lib/data/boi-workspace").getBoiAssessmentDetail>> }) {
  const assessment = detail.assessment;
  if (!assessment) return <EmptyPanel section="readiness" />;
  return (
    <div className="space-y-5">
      <Link href="/dashboard/boi/readiness" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to Investment Readiness</Link>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <ClipboardCheck className="h-7 w-7 text-amber-700" />
        <h2 className="mt-4 text-3xl font-black text-slate-950">{assessment.title ?? "Investment Readiness Assessment"}</h2>
        <p className="mt-3 text-sm text-slate-500">{assessment.msmes?.business_name ?? "Business unavailable"} · {assessment.impact_programmes?.name ?? "Funding programme unavailable"}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Status" value={titleCase(assessment.status)} />
          <Info label="Score" value={typeof assessment.score === "number" ? `${assessment.score}%` : UNAVAILABLE} />
          <Info label="Risk category" value={titleCase(assessment.risk_level)} />
          <Info label="Template" value={detail.template?.name ?? UNAVAILABLE} />
        </div>
      </section>
      <MiniList title="Readiness dimensions" icon={<BadgeCheck className="h-5 w-5" />} items={detail.sections.map((item) => ({ title: item.title, meta: `${item.weight ?? 0}% weight` }))} />
    </div>
  );
}

export function BoiReadinessTemplatesPage({ data }: { data: BoiWorkspaceData }) {
  return (
    <div className="space-y-5">
      <PageHero section="readiness" />
      {data.templates.length === 0 ? <EmptyPanel section="readiness" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.templates.map((template) => (
            <article key={template.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <Gauge className="h-6 w-6 text-amber-700" />
              <h3 className="mt-4 text-base font-black text-slate-950">{template.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{template.description ?? "Assessment template available for BOI readiness workflows."}</p>
              <div className="mt-4 flex flex-wrap gap-2"><Badge tone={statusTone(template.status)}>{titleCase(template.status)}</Badge><Badge>Version {template.version}</Badge></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniList({ title, icon, items }: { title: string; icon: React.ReactNode; items: Array<{ title: string; meta: string }> }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-blue-700">{icon}<h3 className="text-base font-black text-slate-950">{title}</h3></div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? <p className="text-sm text-slate-500">Unavailable</p> : items.slice(0, 8).map((item) => (
          <div key={`${item.title}-${item.meta}`} className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
