import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileArchive,
  FileCheck2,
  FileClock,
  FileText,
  Flag,
  Gauge,
  History,
  Layers3,
  LockKeyhole,
  MapPinned,
  Network,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  getExecutiveDashboardMetrics,
  type ExecutiveDashboardMetrics,
} from "@/lib/data/impact-intelligence";
import {
  resolveImpactAccessScope,
  type ImpactAccessScope,
} from "@/lib/impact-intelligence/access-scope";
import {
  canAccessRoute,
  canRole,
  type ImpactAction,
  type ImpactResource,
} from "@/lib/impact-intelligence/permissions";
import type { UserRole } from "@/types/roles";
import { logImpactRouteDiagnostic } from "./_diagnostics";

type DashboardRole = Extract<
  UserRole,
  | "admin"
  | "super_admin"
  | "boi_executive"
  | "programme_officer"
  | "assessment_officer"
  | "field_officer"
  | "data_analyst"
  | "auditor"
>;

type LifecycleState = "Operational" | "Needs review" | "Restricted" | "Read-only";

type DashboardLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  detail: string;
  resource: ImpactResource;
  action?: ImpactAction;
  accent?: "emerald" | "blue" | "amber" | "violet" | "slate";
};

type LifecycleStep = {
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  detail: string;
  resource: ImpactResource;
  operatingActions: ImpactAction[];
};

const LIFECYCLE_STEPS: LifecycleStep[] = [
  {
    label: "Programme",
    shortLabel: "Programme",
    href: "/dashboard/impact-intelligence/programmes",
    icon: Layers3,
    detail: "Define programme ownership, delivery windows, budgets, and institutional accountability.",
    resource: "programme",
    operatingActions: ["create", "update"],
  },
  {
    label: "Beneficiary Cohort",
    shortLabel: "Cohort",
    href: "/dashboard/impact-intelligence/cohorts",
    icon: UsersRound,
    detail: "Organise eligible MSMEs into governed cohorts with clear delivery scope.",
    resource: "cohort",
    operatingActions: ["create", "update"],
  },
  {
    label: "Intervention",
    shortLabel: "Intervention",
    href: "/dashboard/impact-intelligence/interventions",
    icon: Network,
    detail: "Track support delivered, milestones reached, and beneficiary-level outcomes.",
    resource: "intervention",
    operatingActions: ["create", "update"],
  },
  {
    label: "Assessment",
    shortLabel: "Assessment",
    href: "/dashboard/impact-intelligence/assessments",
    icon: ClipboardCheck,
    detail: "Capture structured findings, scoring, validation, and approval decisions.",
    resource: "assessment",
    operatingActions: ["create", "review", "approve"],
  },
  {
    label: "Monitoring",
    shortLabel: "Monitoring",
    href: "/dashboard/impact-intelligence/monitoring",
    icon: MapPinned,
    detail: "Coordinate field visits, observations, checklists, and reviewed follow-up.",
    resource: "monitoring_visit",
    operatingActions: ["create", "update", "submit", "review"],
  },
  {
    label: "Evidence",
    shortLabel: "Evidence",
    href: "/dashboard/impact-intelligence/evidence",
    icon: FileArchive,
    detail: "Maintain a traceable evidence trail linked to verified programme activity.",
    resource: "evidence",
    operatingActions: ["create", "submit", "review", "verify"],
  },
  {
    label: "Indicators",
    shortLabel: "Indicators",
    href: "/dashboard/impact-intelligence/indicators",
    icon: Target,
    detail: "Measure progress against governed definitions, baselines, and targets.",
    resource: "indicator",
    operatingActions: ["create", "submit", "review", "verify"],
  },
  {
    label: "Reports",
    shortLabel: "Reports",
    href: "/dashboard/impact-intelligence/reports",
    icon: FileText,
    detail: "Publish controlled impact reports from approved assessments and verified evidence.",
    resource: "report",
    operatingActions: ["create", "submit", "review", "approve"],
  },
];

const WORKBENCH_BY_ROLE: Record<DashboardRole, DashboardLink[]> = {
  programme_officer: [
    { label: "Programmes", href: "/dashboard/impact-intelligence/programmes", icon: Layers3, detail: "Manage assigned programme delivery and ownership.", resource: "programme", action: "update", accent: "emerald" },
    { label: "Cohorts", href: "/dashboard/impact-intelligence/cohorts", icon: UsersRound, detail: "Coordinate beneficiary enrolment and cohort progress.", resource: "cohort", action: "update", accent: "blue" },
    { label: "Interventions", href: "/dashboard/impact-intelligence/interventions", icon: Network, detail: "Track support delivered across assigned programmes.", resource: "intervention", action: "update", accent: "violet" },
    { label: "Monitoring", href: "/dashboard/impact-intelligence/monitoring", icon: MapPinned, detail: "Assign and follow up programme monitoring work.", resource: "monitoring_visit", action: "assign", accent: "amber" },
    { label: "Reports", href: "/dashboard/impact-intelligence/reports", icon: FileText, detail: "Prepare evidence-backed programme reports.", resource: "report", action: "create", accent: "slate" },
    { label: "Programme assurance", href: "/dashboard/impact-intelligence/evidence", icon: ShieldCheck, detail: "Review assessments, evidence, and indicators in read-only mode.", resource: "evidence", accent: "emerald" },
  ],
  assessment_officer: [
    { label: "Assessments", href: "/dashboard/impact-intelligence/assessments", icon: ClipboardCheck, detail: "Review structured findings and approve assessment outcomes.", resource: "assessment", action: "review", accent: "blue" },
    { label: "Evidence review", href: "/dashboard/impact-intelligence/evidence", icon: FileCheck2, detail: "Validate submitted evidence and return incomplete records.", resource: "evidence", action: "verify", accent: "emerald" },
    { label: "Indicators", href: "/dashboard/impact-intelligence/indicators", icon: Target, detail: "Verify measurements against governed indicator definitions.", resource: "indicator", action: "verify", accent: "violet" },
    { label: "Reports approval", href: "/dashboard/impact-intelligence/reports", icon: BadgeCheck, detail: "Review and approve institution-ready impact reports.", resource: "report", action: "approve", accent: "slate" },
    { label: "Risk flags", href: "/dashboard/impact-intelligence/risk-flags", icon: Flag, detail: "Investigate operational and evidence assurance risks.", resource: "risk_flag", action: "review", accent: "amber" },
  ],
  field_officer: [
    { label: "My visits", href: "/dashboard/impact-intelligence/monitoring", icon: CalendarCheck, detail: "Open assigned visits, checklists, and field follow-up.", resource: "monitoring_visit", action: "update", accent: "emerald" },
    { label: "My evidence", href: "/dashboard/impact-intelligence/evidence", icon: FileArchive, detail: "Capture and submit evidence from assigned field work.", resource: "evidence", action: "create", accent: "blue" },
    { label: "My measurements", href: "/dashboard/impact-intelligence/indicators", icon: Target, detail: "Record indicator measurements within assigned scope.", resource: "indicator", action: "create", accent: "violet" },
  ],
  boi_executive: [
    { label: "Executive dashboard", href: "/dashboard/impact-intelligence/executive", icon: Gauge, detail: "Review approved portfolio performance and assurance coverage.", resource: "executive_dashboard", accent: "emerald" },
    { label: "Analytics", href: "/dashboard/impact-intelligence/analytics", icon: BarChart3, detail: "Explore approved institutional aggregates and trends.", resource: "analytics", accent: "blue" },
    { label: "Approved reports", href: "/dashboard/impact-intelligence/reports", icon: FileCheck2, detail: "Open controlled reports ready for executive use.", resource: "report", accent: "slate" },
  ],
  auditor: [
    { label: "Impact reports", href: "/dashboard/impact-intelligence/reports", icon: FileText, detail: "Review report lineage, approvals, and controlled versions.", resource: "report", accent: "slate" },
    { label: "Evidence trail", href: "/dashboard/impact-intelligence/evidence", icon: FileArchive, detail: "Inspect evidence provenance and verification status.", resource: "evidence", accent: "emerald" },
    { label: "Assessments", href: "/dashboard/impact-intelligence/assessments", icon: ClipboardCheck, detail: "Examine assessment records and review decisions.", resource: "assessment", accent: "blue" },
    { label: "Version history", href: "/dashboard/impact-intelligence/reports", icon: History, detail: "Trace immutable report versions and approval history.", resource: "audit_log", accent: "violet" },
  ],
  data_analyst: [
    { label: "Analytics", href: "/dashboard/impact-intelligence/analytics", icon: BarChart3, detail: "Explore approved programme and outcome aggregates.", resource: "analytics", action: "update", accent: "blue" },
    { label: "Indicators", href: "/dashboard/impact-intelligence/indicators", icon: Target, detail: "Review verified measures, baselines, and targets.", resource: "indicator", accent: "emerald" },
    { label: "Intelligence", href: "/dashboard/impact-intelligence/intelligence", icon: Radar, detail: "Open institutional intelligence and outcome signals.", resource: "intelligence", action: "create", accent: "violet" },
    { label: "Risk flags", href: "/dashboard/impact-intelligence/risk-flags", icon: Flag, detail: "Analyse programme assurance risks requiring attention.", resource: "risk_flag", action: "review", accent: "amber" },
    { label: "Approved reports", href: "/dashboard/impact-intelligence/reports", icon: FileCheck2, detail: "Use governed reports as the source for analysis.", resource: "report", accent: "slate" },
  ],
  admin: [
    { label: "Workspace overview", href: "/dashboard/impact-intelligence/programmes", icon: Building2, detail: "Review the full programme operating environment.", resource: "workspace", action: "administer", accent: "emerald" },
    { label: "Assignments", href: "/dashboard/impact-intelligence/programmes", icon: UsersRound, detail: "Oversee programme scope and operating responsibility.", resource: "assignment", action: "assign", accent: "blue" },
    { label: "Role governance", href: "/dashboard/impact-intelligence/programmes", icon: ShieldCheck, detail: "Maintain governed access across the workspace.", resource: "assignment", action: "administer", accent: "violet" },
    { label: "All modules", href: "/dashboard/impact-intelligence/analytics", icon: DatabaseZap, detail: "Open institution-wide monitoring and analytics modules.", resource: "analytics", accent: "slate" },
  ],
  super_admin: [
    { label: "Workspace overview", href: "/dashboard/impact-intelligence/programmes", icon: Building2, detail: "Review the full programme operating environment.", resource: "workspace", action: "administer", accent: "emerald" },
    { label: "Assignments", href: "/dashboard/impact-intelligence/programmes", icon: UsersRound, detail: "Oversee programme scope and operating responsibility.", resource: "assignment", action: "assign", accent: "blue" },
    { label: "Role governance", href: "/dashboard/impact-intelligence/programmes", icon: ShieldCheck, detail: "Maintain governed access across the workspace.", resource: "assignment", action: "administer", accent: "violet" },
    { label: "All modules", href: "/dashboard/impact-intelligence/analytics", icon: DatabaseZap, detail: "Open institution-wide monitoring and analytics modules.", resource: "analytics", accent: "slate" },
  ],
};

const PRIMARY_ACTIONS_BY_ROLE: Record<DashboardRole, Array<{ label: string; href: string }>> = {
  programme_officer: [
    { label: "Open Programmes", href: "/dashboard/impact-intelligence/programmes" },
    { label: "Prepare Report", href: "/dashboard/impact-intelligence/reports" },
  ],
  assessment_officer: [
    { label: "Review Evidence", href: "/dashboard/impact-intelligence/evidence" },
    { label: "Verify Indicators", href: "/dashboard/impact-intelligence/indicators" },
  ],
  field_officer: [{ label: "View Assigned Visits", href: "/dashboard/impact-intelligence/monitoring" }],
  boi_executive: [
    { label: "View Executive Dashboard", href: "/dashboard/impact-intelligence/executive" },
    { label: "Open Approved Reports", href: "/dashboard/impact-intelligence/reports" },
  ],
  auditor: [{ label: "Open Audit Reports", href: "/dashboard/impact-intelligence/reports" }],
  data_analyst: [{ label: "Open Analytics", href: "/dashboard/impact-intelligence/analytics" }],
  admin: [{ label: "Manage Workspace", href: "/dashboard/impact-intelligence/programmes" }],
  super_admin: [{ label: "Manage Workspace", href: "/dashboard/impact-intelligence/programmes" }],
};

const ROLE_DESCRIPTIONS: Record<DashboardRole, string> = {
  programme_officer: "Assigned programme operations",
  assessment_officer: "Assessment and assurance review",
  field_officer: "Assigned field delivery",
  boi_executive: "Approved institutional aggregates",
  auditor: "Independent assurance access",
  data_analyst: "Approved analytics and intelligence",
  admin: "Workspace governance",
  super_admin: "Enterprise workspace governance",
};

const TRUST_CONTROLS = [
  { label: "Verified evidence only", icon: FileCheck2, detail: "Evidence provenance and verification status remain visible." },
  { label: "Verified indicators only", icon: Target, detail: "Reported outcomes rely on governed measurements." },
  { label: "Approved assessments only", icon: ClipboardCheck, detail: "Assessment review decisions remain part of the record." },
  { label: "Reviewed monitoring only", icon: MapPinned, detail: "Field observations require review before reporting." },
  { label: "Immutable report versions", icon: History, detail: "Published versions retain a controlled evidence trail." },
];

function isDashboardRole(role: UserRole): role is DashboardRole {
  return role in WORKBENCH_BY_ROLE;
}

function roleLabel(role: UserRole) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function accentClasses(accent: DashboardLink["accent"] = "slate") {
  const classes = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return classes[accent];
}

function lifecycleState(role: UserRole, step: LifecycleStep): LifecycleState {
  if (!canAccessRoute(role, step.href)) return "Restricted";
  if (step.operatingActions.some((action) => canRole(role, step.resource, action))) {
    if (
      role === "assessment_officer"
      && ["assessment", "evidence", "indicator", "report"].includes(step.resource)
    ) return "Needs review";
    return "Operational";
  }
  return "Read-only";
}

function lifecycleStateClasses(state: LifecycleState) {
  if (state === "Operational") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (state === "Needs review") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (state === "Read-only") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
}

function scopeLabel(scope: ImpactAccessScope | null, role: DashboardRole) {
  if (!scope) return "Scope unavailable";
  if (scope.mode === "assigned") return `${scope.assignmentCount} assigned programme${scope.assignmentCount === 1 ? "" : "s"}`;
  if (scope.mode === "delegated_field_scope") return "Assigned field portfolio";
  if (scope.mode === "aggregate") return "Institution-wide aggregate";
  if (scope.mode === "approved_data") return "Approved data scope";
  if (scope.mode === "administrative") return "Administrative scope";
  if (scope.mode === "unrestricted") return "Institution-wide access";
  if (scope.mode === "legacy_fallback") {
    return role === "programme_officer" || role === "assessment_officer"
      ? "Assignment scope pending"
      : "Operational scope";
  }
  return "Restricted scope";
}

function HeroSection({
  role,
  scope,
  metricsLoaded,
}: {
  role: DashboardRole;
  scope: ImpactAccessScope | null;
  metricsLoaded: boolean;
}) {
  const actions = PRIMARY_ACTIONS_BY_ROLE[role].filter((action) => canAccessRoute(role, action.href));

  return (
    <header className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl shadow-slate-300/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,rgba(30,64,175,0.18),transparent_52%)]" />
      <div className="relative grid gap-8 px-5 py-7 sm:px-7 lg:grid-cols-[minmax(0,1fr),auto] lg:items-end lg:px-9 lg:py-9">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Institutional impact workspace
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
              {roleLabel(role)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
              {scopeLabel(scope, role)}
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Impact Intelligence
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Evidence-backed programme monitoring, verified outcomes, and institutional impact reporting.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-300">
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-emerald-300" />
              {metricsLoaded ? "Operational summary loaded" : "Operational summary partially available"}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />
            <span>{ROLE_DESCRIPTIONS[role]}</span>
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">
            {actions.map((action, index) => (
              <Link
                key={action.label}
                href={action.href}
                className={
                  index === 0
                    ? "inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                    : "inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                }
              >
                {action.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

function ExecutiveKpiStrip({ metrics }: { metrics: ExecutiveDashboardMetrics | null }) {
  const unavailable = "Not loaded";
  const cards: Array<{ label: string; value: string | number; detail: string; icon: LucideIcon }> = [
    { label: "Programmes", value: metrics?.activeProgrammes ?? unavailable, detail: metrics ? "Active programmes in current scope" : "Summary source unavailable", icon: Layers3 },
    { label: "Beneficiary cohorts", value: unavailable, detail: "Open the cohort registry for scoped totals", icon: UsersRound },
    { label: "Interventions", value: metrics?.interventionCounts ?? unavailable, detail: metrics ? "Tracked intervention records" : "Summary source unavailable", icon: Network },
    { label: "Assessments", value: metrics?.completedAssessments ?? unavailable, detail: metrics ? "Completed, reviewed, or approved" : "Summary source unavailable", icon: ClipboardCheck },
    { label: "Monitoring visits", value: metrics ? `${metrics.monitoringCompletionRate}%` : unavailable, detail: metrics ? "Completion coverage in current scope" : "Summary source unavailable", icon: MapPinned },
    { label: "Verified evidence", value: metrics?.verifiedEvidence ?? unavailable, detail: metrics ? "Records with verified status" : "Summary source unavailable", icon: FileCheck2 },
    { label: "Verified indicators", value: unavailable, detail: "Open indicators for governed measures", icon: Target },
    { label: "Approved reports", value: unavailable, detail: "Open reports for approved outputs", icon: FileText },
  ];

  return (
    <section aria-labelledby="executive-kpis">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Executive overview</p>
          <h2 id="executive-kpis" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Portfolio at a glance</h2>
        </div>
        <p className="text-xs text-slate-500">Unavailable values are never inferred.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        {cards.map((card) => {
          const Icon = card.icon;
          const isUnavailable = typeof card.value === "string" && card.value === unavailable;
          return (
            <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-50 text-slate-600 ring-1 ring-slate-100">
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`h-2 w-2 rounded-full ${isUnavailable ? "bg-slate-300" : "bg-emerald-500"}`} />
              </div>
              <p className={`mt-4 font-semibold tracking-tight text-slate-950 ${isUnavailable ? "text-base" : "text-2xl"}`}>{card.value}</p>
              <h3 className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{card.label}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">{card.detail}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LifecycleJourneyPanel({ role }: { role: DashboardRole }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Impact lifecycle</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">From programme design to trusted reporting</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Follow the governed path from delivery scope through validation, evidence, outcome measurement, and reporting.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
          <Activity className="h-3.5 w-3.5" />
          Access-aware journey
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LIFECYCLE_STEPS.map((step, index) => {
          const state = lifecycleState(role, step);
          const Icon = step.icon;
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${state === "Restricted" ? "bg-slate-100 text-slate-400 ring-slate-200" : "bg-slate-950 text-white ring-slate-800"}`}>
                    {state === "Restricted" ? <LockKeyhole className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Step {index + 1}</p>
                    <h3 className="font-semibold text-slate-950">{step.shortLabel}</h3>
                  </div>
                </div>
                {state !== "Restricted" && <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />}
              </div>
              <p className="mt-4 text-sm leading-5 text-slate-600">{step.detail}</p>
              <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${lifecycleStateClasses(state)}`}>
                {state}
              </span>
            </>
          );

          return state === "Restricted" ? (
            <article key={step.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 opacity-75">
              {content}
            </article>
          ) : (
            <Link key={step.label} href={step.href} className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md">
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RoleWorkbench({ role }: { role: DashboardRole }) {
  const cards = WORKBENCH_BY_ROLE[role].filter(
    (card) =>
      canAccessRoute(role, card.href)
      && (!card.action || canRole(role, card.resource, card.action)),
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Role-based workbench</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Your operating priorities</h2>
        <p className="mt-2 text-sm text-slate-600">Only modules permitted for {roleLabel(role)} are shown.</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={`${card.label}-${card.href}`} href={card.href} className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-emerald-200 hover:bg-white hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ${accentClasses(card.accent)}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowRight className="mt-1 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-950">{card.label}</h3>
              <p className="mt-2 text-sm leading-5 text-slate-600">{card.detail}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function AssurancePanel() {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_52%,#eff6ff_100%)] p-5 shadow-sm sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(240px,0.8fr),minmax(0,2fr)] xl:items-center">
        <div>
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-700 text-white shadow-lg shadow-emerald-700/20">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Institutional assurance</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Built for defensible impact decisions</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Every report remains anchored to governed reviews and traceable source records.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TRUST_CONTROLS.map((control) => {
            const Icon = control.icon;
            return (
              <article key={control.label} className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                <Icon className="h-5 w-5 text-emerald-700" />
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{control.label}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{control.detail}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function NextActionsPanel({
  role,
  metrics,
}: {
  role: DashboardRole;
  metrics: ExecutiveDashboardMetrics | null;
}) {
  const recentActivity = (metrics?.recentActivity ?? []).filter((item) => canAccessRoute(role, item.href)).slice(0, 4);
  const alerts = metrics?.operationalAlerts.slice(0, 4) ?? [];
  const fallbackAction = PRIMARY_ACTIONS_BY_ROLE[role].find((action) => canAccessRoute(role, action.href));

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Recent activity</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Latest operational movement</h2>
          </div>
          <FileClock className="h-5 w-5 text-slate-400" />
        </div>
        {recentActivity.length > 0 ? (
          <div className="mt-5 space-y-2">
            {recentActivity.map((item) => (
              <Link key={`${item.label}-${item.href}`} href={item.href} className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.detail}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.label}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-emerald-700" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <FileClock className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No recent activity is available for this landing view.</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Open your workbench to review records within your authorised scope.</p>
            {fallbackAction && (
              <Link href={fallbackAction.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                {fallbackAction.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Next actions</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Items requiring attention</h2>
          </div>
          <Flag className="h-5 w-5 text-slate-400" />
        </div>
        {alerts.length > 0 ? (
          <div className="mt-5 space-y-2">
            {alerts.map((alert) => (
              <div key={alert.title} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{alert.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{alert.detail}</p>
                  </div>
                  <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${alert.severity === "high" ? "bg-red-500" : alert.severity === "medium" ? "bg-amber-500" : "bg-blue-500"}`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No role-specific action queue is loaded here.</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Pending reviews, visits, and report tasks remain available in their authorised modules.</p>
          </div>
        )}
      </article>
    </section>
  );
}

export async function ImpactIntelligenceContent() {
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let scope: ImpactAccessScope | null = null;
  let metrics: ExecutiveDashboardMetrics | null = null;

  try {
    ctx = await getCurrentUserContext();
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({
      ctx,
      route: "/dashboard/impact-intelligence",
      operation: "workspace_context_load_failed",
      error,
    });
  }

  if (!ctx || !isDashboardRole(ctx.role)) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <LockKeyhole className="mx-auto h-8 w-8 text-slate-400" />
        <h1 className="mt-4 text-xl font-semibold text-slate-950">Impact Intelligence unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">The current institutional role or session context could not be resolved.</p>
      </section>
    );
  }

  [scope, metrics] = await Promise.all([
    resolveImpactAccessScope(ctx).catch((error) => {
      logImpactRouteDiagnostic({
        ctx,
        route: "/dashboard/impact-intelligence",
        operation: "workspace_scope_load_failed",
        error,
      });
      return null;
    }),
    canRole(ctx.role, "executive_dashboard", "read")
      ? getExecutiveDashboardMetrics(ctx).catch((error) => {
          logImpactRouteDiagnostic({
            ctx,
            route: "/dashboard/impact-intelligence",
            operation: "workspace_summary_load_failed",
            error,
          });
          return null;
        })
      : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-6 pb-4">
      <HeroSection role={ctx.role} scope={scope} metricsLoaded={Boolean(metrics)} />
      <ExecutiveKpiStrip metrics={metrics} />
      <LifecycleJourneyPanel role={ctx.role} />
      <RoleWorkbench role={ctx.role} />
      <AssurancePanel />
      <NextActionsPanel role={ctx.role} metrics={metrics} />
    </section>
  );
}
