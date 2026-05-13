import Link from "next/link";
import {
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  Database,
  HandCoins,
  FileArchive,
  FileText,
  Flag,
  LineChart,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, MetricTile, QuickLink, SectionCard, StatusBadge } from "./_components";
import {
  IMPACT_READ_ROLES,
  listIntelligenceFeed,
  listImpactAssessments,
  listImpactFieldVisits,
  listImpactInterventions,
  listImpactProgrammes,
  listImpactReports,
} from "@/lib/data/impact-intelligence";
import { getCurrentUserContext } from "@/lib/auth/session";

type ImpactSection = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: string;
  cta: string;
};

const SECTIONS: ImpactSection[] = [
  {
    href: "/dashboard/impact-intelligence",
    label: "Overview",
    description: "Navigate the full BOI Impact Intelligence workspace and confirm operational readiness across modules.",
    icon: LineChart,
    status: "Command centre",
    cta: "Open overview",
  },
  {
    href: "/dashboard/impact-intelligence/programmes",
    label: "Programmes",
    description: "Register intervention programmes, sponsoring institutions, timelines, and operating status.",
    icon: Flag,
    status: "Governance",
    cta: "Manage programmes",
  },
  {
    href: "/dashboard/impact-intelligence/interventions",
    label: "Interventions",
    description: "Track MSME-level interventions, stage progression, disbursement status, and timeline events.",
    icon: HandCoins,
    status: "Operational",
    cta: "View interventions",
  },
  {
    href: "/dashboard/impact-intelligence/assessments",
    label: "Assessments",
    description: "Prepare MSME assessment instruments and track readiness, baseline, monitoring, and closure reviews.",
    icon: ClipboardCheck,
    status: "Structured review",
    cta: "Open assessments",
  },
  {
    href: "/dashboard/impact-intelligence/monitoring",
    label: "Monitoring",
    description: "Coordinate field monitoring visits, findings, recommendations, and follow-up status.",
    icon: MapPin,
    status: "Field queue",
    cta: "Review visits",
  },
  {
    href: "/dashboard/impact-intelligence/evidence",
    label: "Evidence",
    description: "Organize photos, documents, field artefacts, and other files that support impact claims.",
    icon: FileArchive,
    status: "Evidence trail",
    cta: "Open repository",
  },
  {
    href: "/dashboard/impact-intelligence/executive",
    label: "Executive Dashboard",
    description: "Review executive KPIs, operational alerts, readiness trends, and intervention visibility.",
    icon: BarChart3,
    status: "Executive",
    cta: "View dashboard",
  },
  {
    href: "/dashboard/impact-intelligence/analytics",
    label: "Analytics",
    description: "Inspect programme, monitoring, assessment, readiness, state, and sector distributions.",
    icon: LineChart,
    status: "Analytics",
    cta: "Inspect analytics",
  },
  {
    href: "/dashboard/impact-intelligence/reports",
    label: "Reports",
    description: "Prepare evidence-backed programme reports for institutional review and export workflows.",
    icon: FileText,
    status: "Reporting",
    cta: "Open reports",
  },
  {
    href: "/dashboard/impact-intelligence/intelligence",
    label: "Intelligence",
    description: "Generate deterministic operational insights, recommendations, anomalies, and portfolio summaries.",
    icon: BrainCircuit,
    status: "Decision support",
    cta: "Review feed",
  },
  {
    href: "/dashboard/impact-intelligence/risk-flags",
    label: "Risk Flags",
    description: "Review evidence-backed risk indicators for readiness, monitoring, intervention, and verification issues.",
    icon: ShieldAlert,
    status: "Risk control",
    cta: "Open risk register",
  },
];

type ImpactIntelligencePageProps = {
  activeSection?: "overview" | "programmes" | "interventions" | "assessments" | "monitoring" | "field-visits" | "evidence" | "executive" | "analytics" | "reports" | "intelligence" | "risk-flags";
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function ImpactIntelligenceContent({ activeSection = "overview" }: ImpactIntelligencePageProps) {
  const ctx = await getCurrentUserContext();
  const [programmes, interventions, assessments, fieldVisits, reports, feed] = await Promise.all([
    listImpactProgrammes(ctx, { limit: 100 }),
    listImpactInterventions(ctx, { limit: 100 }),
    listImpactAssessments(ctx, { limit: 100 }),
    listImpactFieldVisits(ctx, { limit: 100 }),
    IMPACT_READ_ROLES.includes(ctx.role) && ctx.role !== "field_officer" ? listImpactReports(ctx, { limit: 100 }) : listImpactReports({ limit: 100 }),
    listIntelligenceFeed(ctx, { limit: 100 }),
  ]);

  const normalizedSection = activeSection === "field-visits" ? "monitoring" : activeSection;
  const active = normalizedSection === "overview" ? SECTIONS[0] : SECTIONS.find((section) => section.href.endsWith(normalizedSection));
  const openRiskFlags = feed.riskFlags.filter((flag) => flag.status === "open").length;
  const heroMetrics = [
    { label: "Total programmes", value: programmes.length, detail: "Registered intervention portfolios", icon: Flag, tone: "emerald" as const },
    { label: "Interventions", value: interventions.length, detail: "MSME-linked support records", icon: HandCoins, tone: "blue" as const },
    { label: "Assessments", value: assessments.length, detail: "Readiness and impact instruments", icon: ClipboardCheck, tone: "slate" as const },
    { label: "Field visits", value: fieldVisits.length, detail: "Monitoring assignments and visits", icon: MapPin, tone: "amber" as const },
    { label: "Reports", value: reports.length, detail: "Evidence-backed report records", icon: FileText, tone: "emerald" as const },
    { label: "Risk flags", value: openRiskFlags, detail: "Open deterministic risk signals", icon: ShieldAlert, tone: openRiskFlags > 0 ? "red" as const : "slate" as const },
  ];

  return (
    <section className="space-y-7">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm">
        <div className="bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0)_46%)] p-6 lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">BOI Impact Intelligence</p>
                <StatusBadge value="Executive workspace" className="bg-white/10 text-slate-100 ring-white/15" />
              </div>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-white">
                {active?.label ?? "Impact Intelligence"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                {active?.description ??
                  "Foundational workspace for programme intelligence, intervention monitoring, field evidence, and evidence-backed impact reporting across DBIN."}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <div className="flex items-center gap-2 font-medium text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Institutional operating model
              </div>
              <p className="mt-2 max-w-sm leading-6 text-slate-300">
                Dashboards derive from programmes, interventions, assessments, monitoring records, evidence, reports, and deterministic risk signals.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {heroMetrics.map((metric) => (
              <MetricTile key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const selected = normalizedSection === "overview" ? section.href === "/dashboard/impact-intelligence" : section.href.endsWith(normalizedSection);
          return (
            <Link
              key={section.href}
              href={section.href}
              className={[
                "group rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md",
                selected ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <Icon className="h-5 w-5" />
                </span>
                <StatusBadge value={section.status} />
              </div>
              <h2 className="mt-4 font-semibold text-slate-950">{section.label}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">{section.description}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 group-hover:text-emerald-800">{section.cta}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent Programmes" action={<QuickLink href="/dashboard/impact-intelligence/programmes">View programmes</QuickLink>}>
          <div className="mt-4 space-y-3">
            {programmes.length === 0 ? (
              <EmptyState
                title="No programmes registered"
                description="Start with a BOI programme, then link interventions, assessments, monitoring tasks, and evidence so executive dashboards have live operational data."
                actionHref="/dashboard/impact-intelligence/programmes"
                actionLabel="Open programme registry"
                icon={Database}
              />
            ) : (
              programmes.slice(0, 5).map((programme) => (
                <div key={programme.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{programme.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {programme.programme_code ?? "No code"} • {programme.sponsor_name ?? "Sponsor pending"}
                      </p>
                    </div>
                    <StatusBadge value={programme.status ?? "draft"} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Operational Queue" action={<LineChart className="h-5 w-5 text-emerald-700" />}>
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-slate-950">Latest intervention</p>
              <p className="mt-1 text-sm text-slate-600">
                {interventions[0] ? `${interventions[0].title} • ${interventions[0].status ?? "planned"}` : "No intervention records yet."}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-slate-950">Latest assessment</p>
              <p className="mt-1 text-sm text-slate-600">
                {assessments[0]
                  ? `${assessments[0].assessment_type ?? "Assessment"} • ${assessments[0].status ?? "draft"} • ${formatDate(assessments[0].conducted_at)}`
                  : "No assessment records yet."}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-slate-950">Next field visit</p>
              <p className="mt-1 text-sm text-slate-600">
                {fieldVisits[0]
                  ? `${fieldVisits[0].status ?? "scheduled"} • ${formatDate(fieldVisits[0].visit_date)}`
                  : "No field visit records yet."}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-slate-950">Latest report</p>
              <p className="mt-1 text-sm text-slate-600">
                {reports[0] ? `${reports[0].title} • ${reports[0].status ?? "draft"}` : "No report records yet."}
              </p>
            </div>
            <div className="rounded-lg border border-dashed bg-emerald-50/60 p-3">
              <p className="text-sm font-medium text-slate-950">Demo path</p>
              <p className="mt-1 text-sm text-slate-600">
                Programmes to interventions to assessments to monitoring to evidence to dashboards to intelligence.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
