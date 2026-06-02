import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileArchive,
  FileText,
  Flag,
  Gauge,
  Layers3,
  LineChart,
  MapPinned,
  Network,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

type LifecycleStatus = "Operational" | "Partial" | "Missing";
type LauncherAudience = "boi_executive" | "programme_officer" | "assessment_officer" | "field_officer" | "auditor";

type LifecycleStep = {
  label: string;
  status: LifecycleStatus;
  description: string;
  href?: string;
  source?: string;
};

type LauncherCard = {
  href: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  lifecycle: string;
  audiences: LauncherAudience[];
  priority: number;
};

const LIFECYCLE_STEPS: LifecycleStep[] = [
  {
    label: "Programme",
    status: "Operational",
    description: "Programme records, ownership, budget context, date ranges, and status tracking are available.",
    href: "/dashboard/impact-intelligence/programmes",
    source: "impact_programmes",
  },
  {
    label: "Beneficiary Cohort",
    status: "Partial",
    description: "Beneficiary MSMEs are linked through programme and intervention records, but cohort management is not a dedicated workflow yet.",
    href: "/dashboard/impact-intelligence/programmes",
    source: "impact_programme_msmes, msmes",
  },
  {
    label: "Intervention",
    status: "Operational",
    description: "MSME support interventions, lifecycle stages, and intervention event notes are available.",
    href: "/dashboard/impact-intelligence/interventions",
    source: "impact_interventions",
  },
  {
    label: "Assessment",
    status: "Operational",
    description: "Assessment templates, responses, completion, scoring records, and review states are available.",
    href: "/dashboard/impact-intelligence/assessments",
    source: "impact_assessments",
  },
  {
    label: "Field Monitoring",
    status: "Operational",
    description: "Field visit assignment, visit notes, checklists, and review states are available.",
    href: "/dashboard/impact-intelligence/monitoring",
    source: "impact_field_visits",
  },
  {
    label: "Evidence",
    status: "Partial",
    description: "Evidence metadata and links are available. Actual file upload and storage are not operational yet.",
    href: "/dashboard/impact-intelligence/evidence",
    source: "impact_evidence_files",
  },
  {
    label: "Impact Indicators",
    status: "Missing",
    description: "Indicator definitions, baselines, targets, and follow-up values are not operational yet.",
    href: "/dashboard/impact-intelligence/indicators",
    source: "impact_indicators",
  },
  {
    label: "Reports",
    status: "Partial",
    description: "Report records and versions are available. Evidence-backed indicator reports and exports are not operational yet.",
    href: "/dashboard/impact-intelligence/reports",
    source: "impact_reports",
  },
];

const LAUNCHER_CARDS: LauncherCard[] = [
  {
    href: "/dashboard/impact-intelligence/executive",
    label: "Executive dashboard",
    detail: "Review portfolio readiness, active programmes, monitoring coverage, and report status.",
    icon: Gauge,
    lifecycle: "Executive Decisions",
    audiences: ["boi_executive", "auditor"],
    priority: 1,
  },
  {
    href: "/dashboard/impact-intelligence/reports",
    label: "Reports",
    detail: "Open programme monitoring reports and track which outputs still need indicator and evidence backing.",
    icon: FileText,
    lifecycle: "Reports",
    audiences: ["boi_executive", "programme_officer", "assessment_officer", "auditor"],
    priority: 2,
  },
  {
    href: "/dashboard/impact-intelligence/risk-flags",
    label: "Risk flags",
    detail: "Review deterministic monitoring risks from existing programme records.",
    icon: Flag,
    lifecycle: "Executive Decisions",
    audiences: ["boi_executive", "field_officer", "auditor"],
    priority: 3,
  },
  {
    href: "/dashboard/impact-intelligence/programmes",
    label: "Programmes",
    detail: "Manage the institutional programme portfolio and programme-level beneficiary context.",
    icon: Layers3,
    lifecycle: "Programme",
    audiences: ["programme_officer"],
    priority: 1,
  },
  {
    href: "/dashboard/impact-intelligence/programmes",
    label: "Beneficiary cohorts",
    detail: "Review MSMEs attached to programmes and interventions until a dedicated cohort workflow is added.",
    icon: UsersRound,
    lifecycle: "Beneficiary Cohort",
    audiences: ["programme_officer"],
    priority: 2,
  },
  {
    href: "/dashboard/impact-intelligence/interventions",
    label: "Interventions",
    detail: "Track support delivered to MSMEs and the lifecycle status of each intervention.",
    icon: Network,
    lifecycle: "Intervention",
    audiences: ["programme_officer"],
    priority: 3,
  },
  {
    href: "/dashboard/impact-intelligence/assessments",
    label: "Assessments",
    detail: "Run structured assessment workflows tied to programmes, interventions, and MSMEs.",
    icon: ClipboardCheck,
    lifecycle: "Assessment",
    audiences: ["assessment_officer"],
    priority: 1,
  },
  {
    href: "/dashboard/impact-intelligence/indicators",
    label: "Impact indicators",
    detail: "Prepare definitions, baselines, targets, and follow-up values. This module is not operational yet.",
    icon: Target,
    lifecycle: "Impact Indicators",
    audiences: ["assessment_officer"],
    priority: 2,
  },
  {
    href: "/dashboard/impact-intelligence/monitoring",
    label: "Field monitoring",
    detail: "Open assigned monitoring visits, checklist tasks, and visit notes.",
    icon: MapPinned,
    lifecycle: "Field Monitoring",
    audiences: ["field_officer"],
    priority: 1,
  },
  {
    href: "/dashboard/impact-intelligence/evidence",
    label: "Evidence",
    detail: "Register and review evidence metadata linked to visits, assessments, interventions, and MSMEs.",
    icon: FileArchive,
    lifecycle: "Evidence",
    audiences: ["field_officer", "auditor"],
    priority: 2,
  },
  {
    href: "/dashboard/impact-intelligence/analytics",
    label: "Programme analytics",
    detail: "Inspect programme monitoring charts. These are operational views, not predictive analytics.",
    icon: BarChart3,
    lifecycle: "Executive Decisions",
    audiences: ["boi_executive", "programme_officer"],
    priority: 5,
  },
  {
    href: "/dashboard/impact-intelligence/intelligence",
    label: "Legacy intelligence records",
    detail: "Read existing deterministic records only. No new AI insight surface is introduced in this phase.",
    icon: LineChart,
    lifecycle: "Legacy Records",
    audiences: ["boi_executive", "programme_officer", "assessment_officer", "auditor"],
    priority: 9,
  },
];

const AUDIENCE_BY_ROLE: Partial<Record<UserRole, LauncherAudience>> = {
  boi_executive: "boi_executive",
  programme_officer: "programme_officer",
  assessment_officer: "assessment_officer",
  field_officer: "field_officer",
  auditor: "auditor",
};

const DEFAULT_AUDIENCE: LauncherAudience = "boi_executive";

function statusTone(status: LifecycleStatus) {
  if (status === "Operational") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Partial") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function roleLabel(role: UserRole) {
  return role.replaceAll("_", " ");
}

function getLauncherCards(role: UserRole) {
  const audience = AUDIENCE_BY_ROLE[role] ?? DEFAULT_AUDIENCE;
  return LAUNCHER_CARDS.filter((card) => card.audiences.includes(audience)).sort((a, b) => a.priority - b.priority);
}

function LifecycleProgressPanel() {
  const totals = LIFECYCLE_STEPS.reduce(
    (acc, step) => {
      acc[step.status] += 1;
      return acc;
    },
    { Operational: 0, Partial: 0, Missing: 0 } satisfies Record<LifecycleStatus, number>,
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Lifecycle readiness</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Measurable impact chain</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            This panel shows what is usable now and what must still be built before the workspace can produce complete evidence-backed impact reports.
          </p>
        </div>
        <div className="grid min-w-full grid-cols-3 gap-2 text-center sm:min-w-[360px]">
          {(["Operational", "Partial", "Missing"] as LifecycleStatus[]).map((status) => (
            <div key={status} className={`rounded-lg border px-3 py-2 ${statusTone(status)}`}>
              <p className="text-2xl font-semibold">{totals[status]}</p>
              <p className="text-xs font-medium">{status}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        {LIFECYCLE_STEPS.map((step) => {
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-950">{step.label}</h3>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(step.status)}`}>{step.status}</span>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-600">{step.description}</p>
              {step.source && <p className="mt-3 text-xs text-slate-500">Lifecycle source: {step.source}</p>}
            </>
          );

          return step.href ? (
            <Link key={step.label} href={step.href} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/50">
              {content}
            </Link>
          ) : (
            <article key={step.label} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              {content}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LauncherSection({ role }: { role: UserRole }) {
  const cards = getLauncherCards(role);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Role-aware launcher</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Start from your operating lane</h2>
        </div>
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{roleLabel(role)}</span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={`${card.href}-${card.label}`} href={card.href} className="group rounded-lg border border-slate-200 bg-slate-50/70 p-4 transition hover:border-emerald-300 hover:bg-white hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{card.lifecycle}</p>
              <h3 className="mt-1 font-semibold text-slate-950">{card.label}</h3>
              <p className="mt-2 text-sm leading-5 text-slate-600">{card.detail}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export async function ImpactIntelligenceContent() {
  const ctx = await getCurrentUserContext();

  return (
    <section className="space-y-6">
      <header className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
        <div className="bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(15,23,42,0)_58%)] p-6 lg:p-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Impact Intelligence Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">MSME Programme Impact Intelligence</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Track whether MSME programmes and interventions are producing measurable outcomes using assessments, field monitoring, evidence, indicators, and reports.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Institutional monitoring workspace
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <AlertTriangle className="h-3.5 w-3.5" /> No predictive analytics or fake impact metrics
            </span>
          </div>
        </div>
      </header>

      <LifecycleProgressPanel />
      <LauncherSection role={ctx.role} />
    </section>
  );
}
