import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck2,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileArchive,
  FileCheck2,
  FileClock,
  FileText,
  Flag,
  Gauge,
  History,
  LayoutDashboard,
  LockKeyhole,
  Map,
  MapPin,
  Network,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  getExecutiveDashboardMetrics,
  type DistributionBucket,
  type ExecutiveDashboardMetrics,
} from "@/lib/data/impact-intelligence";
import {
  resolveImpactAccessScope,
  type ImpactAccessScope,
} from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole, type ImpactResource } from "@/lib/impact-intelligence/permissions";
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

type DashboardLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  resource?: ImpactResource;
};

const MODULE_NAV: DashboardLink[] = [
  { label: "Overview", href: "/dashboard/impact-intelligence", icon: LayoutDashboard, resource: "workspace" },
  { label: "Programmes", href: "/dashboard/impact-intelligence/programmes", icon: Building2, resource: "programme" },
  { label: "Cohorts", href: "/dashboard/impact-intelligence/cohorts", icon: UsersRound, resource: "cohort" },
  { label: "Interventions", href: "/dashboard/impact-intelligence/interventions", icon: Network, resource: "intervention" },
  { label: "Assessments", href: "/dashboard/impact-intelligence/assessments", icon: ClipboardCheck, resource: "assessment" },
  { label: "Monitoring", href: "/dashboard/impact-intelligence/monitoring", icon: CalendarCheck2, resource: "monitoring_visit" },
  { label: "Evidence", href: "/dashboard/impact-intelligence/evidence", icon: FileArchive, resource: "evidence" },
  { label: "Indicators", href: "/dashboard/impact-intelligence/indicators", icon: Target, resource: "indicator" },
  { label: "Reports", href: "/dashboard/impact-intelligence/reports", icon: FileText, resource: "report" },
  { label: "Analytics", href: "/dashboard/impact-intelligence/analytics", icon: BarChart3, resource: "analytics" },
  { label: "Intelligence", href: "/dashboard/impact-intelligence/intelligence", icon: Radar, resource: "intelligence" },
  { label: "Risk Flags", href: "/dashboard/impact-intelligence/risk-flags", icon: Flag, resource: "risk_flag" },
  { label: "Audit Trail", href: "/dashboard/impact-intelligence/reports", icon: History, resource: "audit_log" },
];

const QUICK_ACTIONS: Record<DashboardRole, DashboardLink[]> = {
  programme_officer: [
    { label: "Open Programmes", href: "/dashboard/impact-intelligence/programmes", icon: Building2 },
    { label: "View Monitoring Plan", href: "/dashboard/impact-intelligence/monitoring", icon: CalendarCheck2 },
    { label: "Prepare Report", href: "/dashboard/impact-intelligence/reports", icon: FileText },
  ],
  assessment_officer: [
    { label: "Review Assessments", href: "/dashboard/impact-intelligence/assessments", icon: ClipboardCheck },
    { label: "Verify Evidence", href: "/dashboard/impact-intelligence/evidence", icon: FileCheck2 },
    { label: "Verify Indicators", href: "/dashboard/impact-intelligence/indicators", icon: Target },
  ],
  field_officer: [
    { label: "View Assigned Visits", href: "/dashboard/impact-intelligence/monitoring", icon: CalendarCheck2 },
    { label: "Upload Evidence", href: "/dashboard/impact-intelligence/evidence", icon: FileArchive },
    { label: "Submit Measurements", href: "/dashboard/impact-intelligence/indicators", icon: Target },
  ],
  boi_executive: [
    { label: "Executive Dashboard", href: "/dashboard/impact-intelligence/executive", icon: Gauge },
    { label: "Approved Reports", href: "/dashboard/impact-intelligence/reports", icon: FileCheck2 },
    { label: "Open Analytics", href: "/dashboard/impact-intelligence/analytics", icon: BarChart3 },
  ],
  auditor: [
    { label: "Review Reports", href: "/dashboard/impact-intelligence/reports", icon: FileText },
    { label: "Evidence Trail", href: "/dashboard/impact-intelligence/evidence", icon: FileArchive },
    { label: "Audit History", href: "/dashboard/impact-intelligence/reports", icon: History },
  ],
  data_analyst: [
    { label: "Open Analytics", href: "/dashboard/impact-intelligence/analytics", icon: BarChart3 },
    { label: "Intelligence", href: "/dashboard/impact-intelligence/intelligence", icon: Radar },
    { label: "Risk Flags", href: "/dashboard/impact-intelligence/risk-flags", icon: Flag },
  ],
  admin: [
    { label: "Manage Workspace", href: "/dashboard/impact-intelligence/programmes", icon: ShieldCheck },
    { label: "Programme Portfolio", href: "/dashboard/impact-intelligence/programmes", icon: Building2 },
    { label: "Audit", href: "/dashboard/impact-intelligence/reports", icon: History },
  ],
  super_admin: [
    { label: "Manage Workspace", href: "/dashboard/impact-intelligence/programmes", icon: ShieldCheck },
    { label: "Programme Portfolio", href: "/dashboard/impact-intelligence/programmes", icon: Building2 },
    { label: "Audit", href: "/dashboard/impact-intelligence/reports", icon: History },
  ],
};

function isDashboardRole(role: UserRole): role is DashboardRole {
  return role in QUICK_ACTIONS;
}

function roleLabel(role: UserRole) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string | null, role: DashboardRole) {
  const source = name?.trim() || roleLabel(role);
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function scopeLabel(scope: ImpactAccessScope | null) {
  if (!scope) return "Scope unavailable";
  if (scope.mode === "assigned") return `${scope.assignmentCount} assigned programme${scope.assignmentCount === 1 ? "" : "s"}`;
  if (scope.mode === "delegated_field_scope") return "Assigned field portfolio";
  if (scope.mode === "aggregate") return "Institution-wide aggregate";
  if (scope.mode === "approved_data") return "Approved data scope";
  if (scope.mode === "administrative") return "Administrative scope";
  if (scope.mode === "unrestricted") return "Institution-wide access";
  if (scope.mode === "legacy_fallback") return "Assignment scope pending";
  return "Restricted scope";
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function WorkspaceSidebar({
  role,
  fullName,
  email,
}: {
  role: DashboardRole;
  fullName: string | null;
  email: string | null;
}) {
  const items = MODULE_NAV.filter((item) => {
    if (!canAccessRoute(role, item.href)) return false;
    if (item.resource === "audit_log" && !canRole(role, "audit_log", "read")) return false;
    return true;
  });

  return (
    <aside className="bg-[#08162f] text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[244px] lg:shrink-0 lg:flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-5 lg:block lg:border-0 lg:px-6 lg:py-7">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 grid-cols-3 gap-1" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={index} className={`rounded-full bg-white ${index === 4 ? "opacity-100" : "opacity-75"}`} />
            ))}
          </span>
          <span>
            <span className="block text-xl font-bold tracking-wide text-white">DBIN</span>
            <span className="block max-w-28 text-[8px] leading-tight text-slate-400">Digital Business Identity Network</span>
          </span>
        </Link>
        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 lg:hidden">
          {roleLabel(role)}
        </span>
      </div>

      <div className="border-b border-white/5 px-5 py-3 lg:px-6 lg:py-4">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
          <ChartNoAxesCombined className="h-4 w-4" />
          Impact Intelligence
        </p>
      </div>

      <nav aria-label="Impact Intelligence navigation" className="overflow-x-auto px-3 py-3 lg:flex-1 lg:overflow-y-auto">
        <ul className="flex min-w-max gap-1 lg:block lg:min-w-0 lg:space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/dashboard/impact-intelligence";
            return (
              <li key={`${item.label}-${item.href}`}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "group flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-xs font-medium transition",
                    active
                      ? "border-emerald-400 bg-white/10 text-white"
                      : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-emerald-300" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden p-4 lg:block">
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              {initials(fullName, role)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{fullName || roleLabel(role)}</p>
              <p className="truncate text-[10px] text-slate-400">{email || "Institutional workspace"}</p>
            </div>
          </div>
          <p className="mt-3 border-t border-white/10 pt-3 text-[10px] font-medium text-slate-300">{roleLabel(role)}</p>
        </div>
      </div>
    </aside>
  );
}

function DashboardHeader({
  role,
  fullName,
  metricsLoaded,
}: {
  role: DashboardRole;
  fullName: string | null;
  metricsLoaded: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0c1733]">Impact Command Centre</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">Executive visibility across outcomes, geography, programme delivery, and assurance.</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 border-r border-slate-200 pr-4 md:flex">
          <span className={`h-2.5 w-2.5 rounded-full ${metricsLoaded ? "bg-emerald-500" : "bg-amber-400"}`} />
          <div>
            <p className="text-[10px] font-semibold text-slate-700">Data readiness</p>
            <p className="text-[9px] text-slate-400">{metricsLoaded ? "Executive summary loaded" : "Partial data available"}</p>
          </div>
        </div>
        <button type="button" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">
          {initials(fullName, role)}
        </span>
      </div>
    </header>
  );
}

function ExecutiveHero({
  role,
  scope,
  metrics,
}: {
  role: DashboardRole;
  scope: ImpactAccessScope | null;
  metrics: ExecutiveDashboardMetrics | null;
}) {
  const actions = QUICK_ACTIONS[role].filter((item) => canAccessRoute(role, item.href));
  const primaryValue = metrics?.totalMsmes;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#07162f_0%,#102f54_58%,#0f4d53_100%)] text-white shadow-xl shadow-slate-300/30">
      <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[54px] border-white/[0.035]" />
      <div className="relative grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-end">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            Executive impact view · {scopeLabel(scope)}
          </span>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/70">Verified reach in current scope</p>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <h2 className="text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">
              {primaryValue ?? "Not loaded"}
            </h2>
            {primaryValue !== undefined && (
              <span className="mb-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                MSMEs reached
              </span>
            )}
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-blue-100/75">
            {metrics
              ? `${metrics.activeProgrammes} active programme${metrics.activeProgrammes === 1 ? "" : "s"} are delivering ${metrics.interventionCounts} tracked intervention${metrics.interventionCounts === 1 ? "" : "s"} across the visible portfolio.`
              : "Outcome summary data is not available for this view. No estimates have been applied."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] text-blue-100">{roleLabel(role)}</span>
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] text-blue-100">Verified and governed sources</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Executive actions</p>
            <Activity className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="mt-3 space-y-2">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link key={action.label} href={action.href} className={`flex items-center justify-between rounded-xl px-3 py-3 text-xs font-semibold transition ${index === 0 ? "bg-white text-slate-900" : "border border-white/10 bg-white/[0.035] text-white hover:bg-white/10"}`}>
                  <span className="flex items-center gap-2.5"><Icon className="h-4 w-4" />{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function OutcomeKpiZone({ metrics }: { metrics: ExecutiveDashboardMetrics | null }) {
  const cards: Array<{ label: string; value: string | number; detail: string; icon: LucideIcon; tone: string }> = [
    { label: "MSMEs Reached", value: metrics?.totalMsmes ?? "Not loaded", detail: metrics ? "Unique MSMEs in tracked interventions" : "Reach data unavailable", icon: UsersRound, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Active Programmes", value: metrics?.activeProgrammes ?? "Not loaded", detail: metrics ? "Currently active in scope" : "Programme data unavailable", icon: Building2, tone: "text-blue-700 bg-blue-50" },
    { label: "Interventions Delivered", value: metrics?.interventionCounts ?? "Not loaded", detail: metrics ? "Tracked delivery records" : "Intervention data unavailable", icon: Network, tone: "text-violet-700 bg-violet-50" },
    { label: "Assessments Completed", value: metrics?.completedAssessments ?? "Not loaded", detail: metrics ? "Completed, reviewed, or approved" : "Assessment data unavailable", icon: ClipboardCheck, tone: "text-amber-700 bg-amber-50" },
    { label: "Monitoring Completion", value: metrics ? `${metrics.monitoringCompletionRate}%` : "Not loaded", detail: metrics ? "Completed or reviewed visits" : "Monitoring data unavailable", icon: CalendarCheck2, tone: "text-cyan-700 bg-cyan-50" },
    { label: "Verified Evidence", value: metrics?.verifiedEvidence ?? "Not loaded", detail: metrics ? "Records with verified status" : "Evidence data unavailable", icon: FileCheck2, tone: "text-teal-700 bg-teal-50" },
  ];

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Outcome KPI Zone</p>
          <h2 className="mt-1 text-lg font-bold text-[#101a37]">What impact have we created?</h2>
        </div>
        <p className="hidden text-[10px] text-slate-400 sm:block">Unavailable measures are not inferred.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const loaded = card.value !== "Not loaded";
          return (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${card.tone}`}><Icon className="h-4 w-4" /></span>
                <span className={`h-2 w-2 rounded-full ${loaded ? "bg-emerald-500" : "bg-slate-300"}`} />
              </div>
              <p className={`mt-5 font-bold tracking-[-0.03em] text-[#111b3a] ${loaded ? "text-3xl" : "text-base"}`}>{card.value}</p>
              <h3 className="mt-1 text-xs font-semibold text-slate-700">{card.label}</h3>
              <p className="mt-2 text-[10px] leading-4 text-slate-400">{card.detail}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DistributionBars({
  data,
  emptyText,
  color = "bg-blue-500",
}: {
  data: DistributionBucket[];
  emptyText: string;
  color?: string;
}) {
  const visible = data.slice(0, 6);
  const max = Math.max(...visible.map((item) => item.value), 0);

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
        <MapPin className="mx-auto h-5 w-5 text-slate-300" />
        <p className="mt-3 text-xs font-semibold text-slate-600">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="truncate font-medium text-slate-600">{formatLabel(item.label)}</span>
            <span className="font-bold text-slate-800">{item.value}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? Math.max((item.value / max) * 100, 4) : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function GeographicImpactZone({ metrics }: { metrics: ExecutiveDashboardMetrics | null }) {
  return (
    <section>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Geographic Impact Zone</p>
        <h2 className="mt-1 text-lg font-bold text-[#101a37]">Where is impact being delivered?</h2>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.85fr_0.85fr]">
        <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#0d2341] p-5 text-white shadow-sm">
          <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full border-[28px] border-white/[0.035]" />
          <div className="relative flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">State footprint</h3>
              <p className="mt-1 text-[10px] text-blue-100/60">MSMEs represented in tracked interventions</p>
            </div>
            <Map className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="relative mt-6">
            <DistributionBars data={metrics?.stateDistribution ?? []} emptyText="Geographic distribution is not available." color="bg-emerald-400" />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Sector reach</h3>
              <p className="mt-1 text-[10px] text-slate-400">Portfolio distribution</p>
            </div>
            <TrendingUp className="h-5 w-5 text-violet-500" />
          </div>
          <div className="mt-6">
            <DistributionBars data={metrics?.sectorDistribution ?? []} emptyText="Sector distribution is not available." color="bg-violet-500" />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Programme contribution</h3>
              <p className="mt-1 text-[10px] text-slate-400">Outcome attribution by programme</p>
            </div>
            <Building2 className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
            <BarChart3 className="mx-auto h-5 w-5 text-slate-300" />
            <p className="mt-3 text-xs font-semibold text-slate-600">Programme-level outcome attribution is not loaded.</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">Open the programme portfolio for scoped records.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

function OperationalCommandCentre({
  role,
  metrics,
}: {
  role: DashboardRole;
  metrics: ExecutiveDashboardMetrics | null;
}) {
  const alerts = metrics?.operationalAlerts ?? [];
  const activity = (metrics?.recentActivity ?? []).filter((item) => canAccessRoute(role, item.href)).slice(0, 5);

  return (
    <section>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Operational Command Centre</p>
        <h2 className="mt-1 text-lg font-bold text-[#101a37]">What needs attention now?</h2>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Attention queue</h3>
              <p className="mt-1 text-[10px] text-slate-400">Current operational exceptions</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          {alerts.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.title} className="flex gap-3 py-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${alert.severity === "high" ? "bg-red-500" : alert.severity === "medium" ? "bg-amber-500" : "bg-blue-500"}`} />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700">{alert.title}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-400">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-9 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
              <p className="mt-3 text-xs font-semibold text-slate-600">No role-specific action queue is loaded here.</p>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Delivery health</h3>
              <p className="mt-1 text-[10px] text-slate-400">Intervention and monitoring status</p>
            </div>
            <Activity className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-5 space-y-6">
            <DistributionBars data={metrics?.interventionStatusDistribution ?? []} emptyText="Intervention status is not available." color="bg-blue-500" />
            <div className="border-t border-slate-100 pt-5">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Monitoring</p>
              <DistributionBars data={metrics?.monitoringStatusDistribution ?? []} emptyText="Monitoring status is not available." color="bg-cyan-500" />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Latest movement</h3>
              <p className="mt-1 text-[10px] text-slate-400">Recent records in authorised scope</p>
            </div>
            <FileClock className="h-5 w-5 text-emerald-500" />
          </div>
          {activity.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100">
              {activity.map((item) => (
                <Link key={`${item.href}-${item.created_at}`} href={item.href} className="group flex items-center gap-3 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Activity className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold text-slate-700">{item.detail}</p>
                    <p className="mt-0.5 text-[9px] text-slate-400">{item.label}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-emerald-600" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-9 text-center">
              <FileClock className="mx-auto h-5 w-5 text-slate-300" />
              <p className="mt-3 text-xs font-semibold text-slate-600">No recent activity is available for this landing view.</p>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function ExecutiveBriefing({
  role,
  metrics,
}: {
  role: DashboardRole;
  metrics: ExecutiveDashboardMetrics | null;
}) {
  const states = metrics?.stateDistribution.length ?? 0;
  const briefing = metrics
    ? [
        `${metrics.totalMsmes} MSME${metrics.totalMsmes === 1 ? "" : "s"} are represented across tracked intervention records.`,
        `${metrics.activeProgrammes} active programme${metrics.activeProgrammes === 1 ? "" : "s"} account for ${metrics.interventionCounts} intervention${metrics.interventionCounts === 1 ? "" : "s"} in the current scope.`,
        states > 0 ? `Current records span ${states} state${states === 1 ? "" : "s"}.` : "Geographic coverage is not available in the loaded summary.",
        `${metrics.verifiedEvidence} evidence record${metrics.verifiedEvidence === 1 ? "" : "s"} are verified; ${metrics.pendingEvidence} remain pending verification.`,
      ]
    : ["Executive briefing data is not available. No narrative estimates have been generated."];
  const reportsAllowed = canAccessRoute(role, "/dashboard/impact-intelligence/reports");
  const analyticsAllowed = canAccessRoute(role, "/dashboard/impact-intelligence/analytics");

  return (
    <section className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Executive Briefing</p>
            <h2 className="mt-1 text-lg font-bold text-[#101a37]">Portfolio position at a glance</h2>
          </div>
          <Gauge className="h-6 w-6 text-violet-500" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {briefing.map((item) => (
            <div key={item} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" /></span>
              <p className="text-xs leading-5 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="relative overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#102544,#173b5d)] p-6 text-white shadow-lg shadow-slate-300/30">
        <div className="absolute -bottom-16 -right-14 h-40 w-40 rounded-full border-[30px] border-white/[0.035]" />
        <div className="relative">
          <ShieldCheck className="h-7 w-7 text-emerald-300" />
          <h2 className="mt-4 text-base font-bold">Governed intelligence</h2>
          <p className="mt-2 text-xs leading-5 text-blue-100/70">This command centre uses scoped, verified, and permission-controlled records.</p>
          <div className="mt-5 space-y-2">
            {reportsAllowed && <Link href="/dashboard/impact-intelligence/reports" className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-xs font-semibold text-slate-900">Open approved reports <ArrowRight className="h-3.5 w-3.5" /></Link>}
            {analyticsAllowed && <Link href="/dashboard/impact-intelligence/analytics" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs font-semibold text-white">Explore analytics <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </div>
        </div>
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
      <section className="m-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
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
    <div className="min-h-screen bg-[#eef2f7] lg:flex">
      <WorkspaceSidebar role={ctx.role} fullName={ctx.fullName} email={ctx.email} />
      <div className="min-w-0 flex-1 lg:p-1.5 lg:pl-0">
        <div className="min-h-screen overflow-hidden bg-[#f7f9fc] lg:rounded-l-[24px] lg:border lg:border-slate-200 lg:shadow-xl lg:shadow-slate-300/30">
          <DashboardHeader role={ctx.role} fullName={ctx.fullName} metricsLoaded={Boolean(metrics)} />
          <main className="space-y-8 p-4 sm:p-5 lg:p-7">
            <ExecutiveHero role={ctx.role} scope={scope} metrics={metrics} />
            <OutcomeKpiZone metrics={metrics} />
            <GeographicImpactZone metrics={metrics} />
            <OperationalCommandCentre role={ctx.role} metrics={metrics} />
            <ExecutiveBriefing role={ctx.role} metrics={metrics} />
          </main>
        </div>
      </div>
    </div>
  );
}
