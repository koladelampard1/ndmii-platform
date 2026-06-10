import Link from "next/link";
import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Download,
  FileCheck2,
  Filter,
  Flag,
  Gauge,
  Layers3,
  MapPinned,
  Network,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  listImpactAssessments,
  listImpactCohorts,
  listImpactInterventions,
  listImpactProgrammes,
  listImpactReports,
  listIntelligenceFeed,
  type ImpactProgramme,
  type ImpactRiskFlag,
} from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import {
  listIndicatorMeasurements,
  type ImpactIndicatorMeasurement,
} from "@/lib/data/impact-indicators";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/programmes";
const UNAVAILABLE = "Unavailable";

type SourceState<T> = {
  data: T;
  available: boolean;
};

type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

type ProgrammePortfolioItem = {
  programme: ImpactProgramme;
  states: string[];
  regions: string[];
  msmesReached: number;
  interventions: number | null;
  assessments: number | null;
  evidenceTotal: number | null;
  verifiedEvidence: number | null;
  indicatorTotal: number | null;
  verifiedIndicators: number | null;
  approvedReports: number | null;
  reportTotal: number | null;
  indicatorReadiness: number | null;
  reportingReadiness: number | null;
  evidenceReadiness: number | null;
  health: HealthState;
  attentionReasons: string[];
  issueCount: number;
  severity: string | null;
};

const STATE_REGIONS: Record<string, string> = {
  abia: "South East",
  adamawa: "North East",
  "akwa ibom": "South South",
  anambra: "South East",
  bauchi: "North East",
  bayelsa: "South South",
  benue: "North Central",
  borno: "North East",
  "cross river": "South South",
  delta: "South South",
  ebonyi: "South East",
  edo: "South South",
  ekiti: "South West",
  enugu: "South East",
  fct: "North Central",
  "abuja (fct)": "North Central",
  gombe: "North East",
  imo: "South East",
  jigawa: "North West",
  kaduna: "North West",
  kano: "North West",
  katsina: "North West",
  kebbi: "North West",
  kogi: "North Central",
  kwara: "North Central",
  lagos: "South West",
  nasarawa: "North Central",
  niger: "North Central",
  ogun: "South West",
  ondo: "South West",
  osun: "South West",
  oyo: "South West",
  plateau: "North Central",
  rivers: "South South",
  sokoto: "North West",
  taraba: "North East",
  yobe: "North East",
  zamfara: "North West",
};

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatPercent(value: number | null) {
  return value === null ? UNAVAILABLE : `${value}%`;
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string | null, role: string) {
  const source = name?.trim() || roleLabel(role);
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatFreshness(value: string | null) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceFallback<T>(data: T): SourceState<T> {
  return { data, available: false };
}

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function regionForState(state: string) {
  return STATE_REGIONS[state.trim().toLowerCase()] ?? null;
}

function healthTone(health: HealthState) {
  if (health === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (health === "Watchlist") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (health === "At Risk") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function statusTone(status: string | null) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "paused") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "completed") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function severityRank(value: string) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[value] ?? 0;
}

function deriveHealth(
  flags: ImpactRiskFlag[] | null,
  measurements: ImpactIndicatorMeasurement[] | null,
): Pick<ProgrammePortfolioItem, "health" | "attentionReasons" | "issueCount" | "severity"> {
  if (flags === null || measurements === null) {
    return { health: "Unavailable", attentionReasons: [], issueCount: 0, severity: null };
  }

  const openFlags = flags.filter((flag) => flag.status === "open");
  const verified = measurements.filter((item) => item.verification_status === "verified");
  const regressed = verified.filter((item) => item.outcome_status === "regressed");
  const belowTarget = verified.filter((item) => ["below_target", "no_baseline"].includes(item.outcome_status));
  const highFlags = openFlags.filter((flag) => ["critical", "high"].includes(flag.severity));
  const reasons = [
    ...highFlags.slice(0, 2).map((flag) => flag.title),
    ...openFlags.filter((flag) => !["critical", "high"].includes(flag.severity)).slice(0, 2).map((flag) => flag.title),
    ...(regressed.length > 0 ? [`${regressed.length} verified indicator${regressed.length === 1 ? "" : "s"} regressed`] : []),
    ...(belowTarget.length > 0 ? [`${belowTarget.length} verified indicator${belowTarget.length === 1 ? "" : "s"} below target`] : []),
  ];
  const issueCount = openFlags.length + regressed.length + belowTarget.length;
  const severity = [...openFlags]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]?.severity
    ?? (regressed.length > 0 ? "high" : belowTarget.length > 0 ? "medium" : null);

  if (highFlags.length > 0 || regressed.length > 0) {
    return { health: "At Risk", attentionReasons: reasons, issueCount, severity };
  }
  if (openFlags.length > 0 || belowTarget.length > 0) {
    return { health: "Watchlist", attentionReasons: reasons, issueCount, severity };
  }
  if (verified.length > 0) {
    return { health: "Healthy", attentionReasons: [], issueCount: 0, severity: null };
  }
  return { health: "Unavailable", attentionReasons: [], issueCount: 0, severity: null };
}

function Section({
  title,
  description,
  action,
  children,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-[#0c1733] sm:text-base">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Building2;
  tone: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-tight text-[#0c1733]">{value}</p>
          <p className="truncate text-[10px] font-semibold text-slate-500">{label}</p>
        </div>
      </div>
    </article>
  );
}

function ProgressValue({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  if (value === null) return <span className="text-xs font-medium text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div className="min-w-[84px]">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
        <span>{value}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function PortfolioMap({ hasGeoData }: { hasGeoData: boolean }) {
  return (
    <div className="relative mx-auto aspect-[1.35/1] w-full max-w-[340px] overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <svg viewBox="0 0 420 310" className="h-full w-full" role="img" aria-label="Stylised Nigeria coverage map">
        <defs>
          <linearGradient id="nigeria-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={hasGeoData ? "#bbf7d0" : "#e2e8f0"} />
            <stop offset="100%" stopColor={hasGeoData ? "#16a34a" : "#cbd5e1"} />
          </linearGradient>
          <pattern id="map-grid" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#ffffff" strokeOpacity=".42" strokeWidth="1" />
          </pattern>
        </defs>
        <path
          d="M90 53 145 37l52 13 30-16 48 21 18 42 39 22-10 45 17 28-29 51-43 5-32 29-45-17-48 8-31-28-39-8-15-44 19-36-8-43 32-19Z"
          fill="url(#nigeria-fill)"
          stroke={hasGeoData ? "#059669" : "#94a3b8"}
          strokeWidth="2"
        />
        <path
          d="M90 53 145 37l52 13 30-16 48 21 18 42 39 22-10 45 17 28-29 51-43 5-32 29-45-17-48 8-31-28-39-8-15-44 19-36-8-43 32-19Z"
          fill="url(#map-grid)"
        />
        {hasGeoData && (
          <>
            <circle cx="143" cy="197" r="10" fill="#047857" fillOpacity=".9" />
            <circle cx="188" cy="126" r="14" fill="#16a34a" fillOpacity=".85" />
            <circle cx="238" cy="173" r="9" fill="#22c55e" fillOpacity=".9" />
            <circle cx="282" cy="111" r="7" fill="#059669" fillOpacity=".9" />
            <circle cx="225" cy="222" r="11" fill="#15803d" fillOpacity=".85" />
          </>
        )}
      </svg>
      {!hasGeoData && (
        <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-center text-xs font-medium text-slate-500 shadow-sm">
          Geographic coverage unavailable
        </div>
      )}
    </div>
  );
}

async function loadSource<T>(
  ctx: Awaited<ReturnType<typeof getCurrentUserContext>>,
  operation: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<SourceState<T>> {
  try {
    return { data: await loader(), available: true };
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation, error });
    return sourceFallback(fallback);
  }
}

export default async function ImpactProgrammesPage() {
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let programmesSource = sourceFallback<ImpactProgramme[]>([]);

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    programmesSource = await loadSource(currentContext, "programme_portfolio_programmes_load_failed", () => listImpactProgrammes(currentContext, { limit: 250 }), []);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "programme_portfolio_context_load_failed", error });
  }

  if (!ctx || !programmesSource.available) {
    return (
      <section className="space-y-6">
        <Section title="Programme Portfolio Unavailable">
          <EmptyState
            title="Programme portfolio could not load"
            description="The programme source, current session, or role assignment is temporarily unavailable. No portfolio metrics are being inferred."
            icon={Flag}
          />
        </Section>
      </section>
    );
  }

  const programmes = programmesSource.data;
  const programmeIds = new Set(programmes.map((programme) => programme.id));
  const [cohortsSource, interventionsSource, assessmentsSource, evidenceSource, indicatorsSource, reportsSource, intelligenceSource] = await Promise.all([
    loadSource(ctx, "programme_portfolio_cohorts_load_failed", () => listImpactCohorts(ctx, { limit: 1000 }), []),
    loadSource(ctx, "programme_portfolio_interventions_load_failed", () => listImpactInterventions(ctx, { limit: 1000 }), []),
    loadSource(ctx, "programme_portfolio_assessments_load_failed", () => listImpactAssessments(ctx, { limit: 1000 }), []),
    loadSource(ctx, "programme_portfolio_evidence_load_failed", () => listImpactEvidence(ctx, { limit: 1000 }), []),
    loadSource(ctx, "programme_portfolio_indicators_load_failed", () => listIndicatorMeasurements(ctx, { limit: 1000 }), []),
    canRole(ctx.role, "report", "read")
      ? loadSource(ctx, "programme_portfolio_reports_load_failed", () => listImpactReports(ctx, { limit: 1000 }), [])
      : Promise.resolve(sourceFallback([])),
    canRole(ctx.role, "intelligence", "read") && canRole(ctx.role, "risk_flag", "read")
      ? loadSource(ctx, "programme_portfolio_risks_load_failed", () => listIntelligenceFeed(ctx, { limit: 250 }), null)
      : Promise.resolve(sourceFallback(null)),
  ]);

  const cohorts = cohortsSource.data.filter((item) => programmeIds.has(item.programme_id));
  const interventions = interventionsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const assessments = assessmentsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const evidence = evidenceSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const indicators = indicatorsSource.data.filter((item) => programmeIds.has(item.programme_id));
  const reports = reportsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const riskFlags = intelligenceSource.data?.riskFlags.filter((item) => item.programme_id && programmeIds.has(item.programme_id)) ?? [];

  const portfolio: ProgrammePortfolioItem[] = programmes.map((programme) => {
    const programmeCohorts = cohorts.filter((item) => item.programme_id === programme.id);
    const programmeInterventions = interventions.filter((item) => item.programme_id === programme.id);
    const programmeAssessments = assessments.filter((item) => item.programme_id === programme.id);
    const programmeEvidence = evidence.filter((item) => item.programme_id === programme.id);
    const programmeIndicators = indicators.filter((item) => item.programme_id === programme.id);
    const programmeReports = reports.filter((item) => item.programme_id === programme.id);
    const programmeFlags = riskFlags.filter((item) => item.programme_id === programme.id);
    const states = Array.from(new Set(programmeCohorts.map((item) => item.state?.trim()).filter((value): value is string => Boolean(value))));
    const regions = Array.from(new Set(states.map(regionForState).filter((value): value is string => Boolean(value))));
    const verifiedEvidence = programmeEvidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length;
    const verifiedIndicators = programmeIndicators.filter((item) => item.verification_status === "verified").length;
    const approvedReports = programmeReports.filter((item) => item.status === "approved").length;
    const health = deriveHealth(
      intelligenceSource.available ? programmeFlags : null,
      indicatorsSource.available ? programmeIndicators : null,
    );

    return {
      programme,
      states,
      regions,
      msmesReached: programme.cohort_beneficiary_count ?? 0,
      interventions: interventionsSource.available ? programmeInterventions.length : null,
      assessments: assessmentsSource.available ? programmeAssessments.length : null,
      evidenceTotal: evidenceSource.available ? programmeEvidence.length : null,
      verifiedEvidence: evidenceSource.available ? verifiedEvidence : null,
      indicatorTotal: indicatorsSource.available ? programmeIndicators.length : null,
      verifiedIndicators: indicatorsSource.available ? verifiedIndicators : null,
      approvedReports: reportsSource.available ? approvedReports : null,
      reportTotal: reportsSource.available ? programmeReports.length : null,
      indicatorReadiness: indicatorsSource.available ? ratio(verifiedIndicators, programmeIndicators.length) : null,
      reportingReadiness: reportsSource.available ? ratio(approvedReports, programmeReports.length) : null,
      evidenceReadiness: evidenceSource.available ? ratio(verifiedEvidence, programmeEvidence.length) : null,
      ...health,
    };
  });

  const activeProgrammes = programmes.filter((programme) => programme.status === "active").length;
  const totalMsmes = programmes.reduce((sum, programme) => sum + (programme.cohort_beneficiary_count ?? 0), 0);
  const totalVerifiedEvidence = evidenceSource.available
    ? evidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length
    : null;
  const totalVerifiedIndicators = indicatorsSource.available
    ? indicators.filter((item) => item.verification_status === "verified").length
    : null;
  const totalApprovedReports = reportsSource.available
    ? reports.filter((item) => item.status === "approved").length
    : null;
  const attentionProgrammes = portfolio.filter((item) => ["At Risk", "Watchlist"].includes(item.health));
  const healthKnown = portfolio.filter((item) => item.health !== "Unavailable");
  const reportingRates = portfolio.map((item) => item.reportingReadiness).filter((value): value is number => value !== null);
  const reportingReadiness = reportingRates.length > 0
    ? Math.round(reportingRates.reduce((sum, value) => sum + value, 0) / reportingRates.length)
    : null;
  const freshness = latestDate([
    ...programmes.map((item) => item.updated_at ?? item.created_at),
    ...cohorts.map((item) => item.updated_at ?? item.created_at),
    ...interventions.map((item) => item.updated_at ?? item.created_at),
    ...assessments.map((item) => item.created_at),
    ...evidence.map((item) => item.created_at),
    ...indicators.map((item) => item.updated_at ?? item.created_at),
    ...reports.map((item) => item.created_at),
  ]);

  const stateReach = new Map<string, number>();
  for (const cohort of cohorts) {
    if (!cohort.state) continue;
    stateReach.set(cohort.state, (stateReach.get(cohort.state) ?? 0) + (cohort.member_count ?? cohort.current_beneficiaries ?? 0));
  }
  const topStates = Array.from(stateReach.entries())
    .map(([state, reach]) => ({ state, reach }))
    .sort((a, b) => b.reach - a.reach || a.state.localeCompare(b.state))
    .slice(0, 5);
  const regions = Array.from(new Set(Array.from(stateReach.keys()).map(regionForState).filter((value): value is string => Boolean(value))));
  const coverageIndex = stateReach.size > 0 ? Math.round((stateReach.size / 37) * 100) : null;
  const knownRegionStates = Array.from(stateReach.keys()).filter((state) => regionForState(state));
  const unknownRegionStates = stateReach.size - knownRegionStates.length;
  const geoAvailable = cohortsSource.available && stateReach.size > 0;

  const recentActivity = [
    ...programmes.map((item) => ({ type: "Programme", title: item.name, createdAt: item.created_at, href: `/dashboard/impact-intelligence/programmes/${item.id}`, icon: Building2 })),
    ...interventions.map((item) => ({ type: "Intervention", title: item.title, createdAt: item.created_at, href: `/dashboard/impact-intelligence/interventions/${item.id}`, icon: Network })),
    ...assessments.map((item) => ({ type: "Assessment", title: item.title ?? "Assessment", createdAt: item.created_at, href: `/dashboard/impact-intelligence/assessments/${item.id}`, icon: ClipboardCheck })),
    ...evidence.map((item: ImpactEvidenceRecord) => ({ type: "Evidence", title: item.original_filename ?? item.file_name, createdAt: item.created_at, href: `/dashboard/impact-intelligence/evidence/${item.id}`, icon: ShieldCheck })),
    ...reports.map((item) => ({ type: "Report", title: item.title, createdAt: item.created_at, href: `/dashboard/impact-intelligence/reports/${item.id}`, icon: FileCheck2 })),
  ]
    .filter((item) => item.createdAt && canAccessRoute(ctx.role, item.href))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5);

  const canCreate = canRole(ctx.role, "programme", "create")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/programmes/new");
  const canExport = canRole(ctx.role, "export", "export")
    && canRole(ctx.role, "report", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canOpenProgramme = canAccessRoute(ctx.role, ROUTE);
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Programmes</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Programme Portfolio</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Executive visibility across all programmes, reach, progress, and performance.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CircleDot className="h-4 w-4" />
                <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Data freshness</p>
                <p className="text-[11px] font-semibold text-slate-700">{formatFreshness(freshness)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canCreate && (
                <Link href="/dashboard/impact-intelligence/programmes/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#132d60]">
                  <Plus className="h-4 w-4" /> New Programme
                </Link>
              )}
              <details className="relative">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-xl">
                  <p className="font-bold text-slate-900">Current portfolio scope</p>
                  <p className="mt-2 leading-5">Showing records permitted for {roleLabel(ctx.role)}. Programme assignment and approved-data rules are already applied.</p>
                </div>
              </details>
              {canExport && (
                <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Download className="h-4 w-4" /> Export
                </Link>
              )}
              <span title={`${ctx.fullName ?? roleLabel(ctx.role)} · ${roleLabel(ctx.role)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initials(ctx.fullName, ctx.role)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_70%_35%,rgba(37,99,235,0.38),transparent_30%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs>
              <pattern id="hero-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#60a5fa" />
              </pattern>
            </defs>
            <path d="M510 35 610 20l75 35 72 10 50 58-42 48 12 56-97 18-64-35-78 15-46-65 22-55Z" fill="url(#hero-dots)" stroke="#38bdf8" strokeOpacity=".4" />
            <path d="M470 230c70-50 115-112 177-82s91 6 150-68" fill="none" stroke="#38bdf8" strokeOpacity=".55" />
            <circle cx="647" cy="148" r="5" fill="#22d3ee" />
            <circle cx="711" cy="156" r="4" fill="#a855f7" />
            <circle cx="797" cy="80" r="4" fill="#34d399" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Portfolio overview</p>
              <h2 className="mt-3 max-w-xl text-2xl font-bold leading-tight sm:text-3xl">Driving measurable impact across Nigerian enterprises</h2>
              <p className="mt-2 text-sm text-blue-100/80">Scoped records. Verified evidence. Transparent readiness.</p>
            </div>
            <span className="w-fit rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">
              Current portfolio
            </span>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Active programmes", value: formatNumber(activeProgrammes), icon: Building2, color: "text-cyan-300" },
              { label: "MSMEs reached", value: formatNumber(totalMsmes), icon: UsersRound, color: "text-emerald-300" },
              { label: "Interventions", value: interventionsSource.available ? formatNumber(interventions.length) : UNAVAILABLE, icon: Network, color: "text-amber-300" },
              { label: "Reporting readiness", value: formatPercent(reportingReadiness), icon: Gauge, color: "text-violet-300" },
              { label: "Require attention", value: healthKnown.length > 0 ? formatNumber(attentionProgrammes.length) : UNAVAILABLE, icon: AlertTriangle, color: "text-rose-300" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-[#0a1d40]/75 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><Icon className={cn("h-4 w-4", item.color)} /></span>
                    <div>
                      <p className="text-lg font-bold">{item.value}</p>
                      <p className="text-[10px] font-medium text-blue-100/70">{item.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <MetricCard label="Active Programmes" value={formatNumber(activeProgrammes)} icon={Building2} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="MSMEs Reached" value={formatNumber(totalMsmes)} icon={UsersRound} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Interventions" value={interventionsSource.available ? formatNumber(interventions.length) : UNAVAILABLE} icon={Network} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Assessments" value={assessmentsSource.available ? formatNumber(assessments.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Verified Evidence" value={formatNumber(totalVerifiedEvidence)} icon={ShieldCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Verified Indicators" value={formatNumber(totalVerifiedIndicators)} icon={Target} tone="bg-purple-100 text-purple-700" />
        <MetricCard label="Approved Reports" value={formatNumber(totalApprovedReports)} icon={FileCheck2} tone="bg-indigo-100 text-indigo-700" />
      </div>

      <Section
        title="Programme Portfolio"
        description="Programme performance and readiness across the current role and assignment scope."
        id="programme-health"
        action={<span className="text-xs font-semibold text-slate-500">{programmes.length} programme{programmes.length === 1 ? "" : "s"}</span>}
      >
        {programmes.length === 0 ? (
          <EmptyState
            title={scopeEmptyMessage ?? "No programmes available"}
            description={scopeEmptyMessage ?? "No programme records are available in the current scope."}
            actionHref={canCreate ? "/dashboard/impact-intelligence/programmes/new" : undefined}
            actionLabel={canCreate ? "Create programme" : undefined}
            icon={Flag}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {portfolio.map((item) => {
              const content = (
                <article className="group h-full rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1", statusTone(item.programme.status))}>
                          {item.programme.status ?? "draft"}
                        </span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-[#0c1733] group-hover:text-blue-700">{item.programme.name}</h3>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {item.states.length > 0 ? `${item.states.length} state${item.states.length === 1 ? "" : "s"}` : "States unavailable"}
                        <span className="mx-1.5 text-slate-300">•</span>
                        {item.regions.length > 0 ? `${item.regions.length} region${item.regions.length === 1 ? "" : "s"}` : "Regions unavailable"}
                      </p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700">
                      <Layers3 className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-xs">
                    <div><p className="text-[10px] text-slate-500">MSMEs reached</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.msmesReached)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Interventions</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.interventions)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Assessments</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.assessments)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Verified evidence</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.verifiedEvidence)}</p></div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Indicator readiness</span><ProgressValue value={item.indicatorReadiness} tone="bg-blue-500" /></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Reporting readiness</span><ProgressValue value={item.reportingReadiness} tone="bg-emerald-500" /></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-medium text-slate-500">{item.programme.programme_code ?? "No programme code"}</span>
                    {canOpenProgramme && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">View programme <ArrowRight className="h-3 w-3" /></span>}
                  </div>
                </article>
              );
              return canOpenProgramme
                ? <Link key={item.programme.id} href={`/dashboard/impact-intelligence/programmes/${item.programme.id}`}>{content}</Link>
                : <div key={item.programme.id}>{content}</div>;
            })}
          </div>
        )}
      </Section>

      <Section title="Geographic Coverage" description="Coverage derived from programme-linked cohort state data.">
        {!cohortsSource.available ? (
          <EmptyState title="Geographic coverage unavailable" description="Programme-linked cohort geography could not be loaded. No coverage values are being inferred." icon={MapPinned} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_.8fr_1fr]">
            <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto] lg:grid-cols-1 xl:grid-cols-[1fr_auto]">
              <PortfolioMap hasGeoData={geoAvailable} />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-1">
                <div><p className="text-2xl font-bold text-[#0c1733]">{geoAvailable ? stateReach.size : UNAVAILABLE}</p><p className="text-[10px] font-medium text-slate-500">States covered</p></div>
                <div><p className="text-2xl font-bold text-[#0c1733]">{geoAvailable ? regions.length : UNAVAILABLE}</p><p className="text-[10px] font-medium text-slate-500">Regions active</p></div>
                <div><p className="text-2xl font-bold text-[#0c1733]">{formatPercent(coverageIndex)}</p><p className="text-[10px] font-medium text-slate-500">Coverage index</p></div>
              </div>
            </div>
            <div className="border-slate-100 lg:border-l lg:pl-6">
              <h3 className="text-xs font-bold text-slate-900">Top states by reach</h3>
              {topStates.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">No programme-linked state reach is available.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {topStates.map((item, index) => (
                    <div key={item.state} className="flex items-center gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{item.state}</span>
                      <span className="text-xs font-bold text-slate-900">{formatNumber(item.reach)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-xs font-bold text-slate-900">Coverage distribution</h3>
              {geoAvailable ? (
                <div className="mt-5 flex items-center gap-5">
                  <div
                    className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
                    style={{ background: `conic-gradient(#10b981 0 ${coverageIndex ?? 0}%, #e2e8f0 ${coverageIndex ?? 0}% 100%)` }}
                  >
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center">
                      <span><strong className="block text-xl text-[#0c1733]">{stateReach.size}</strong><span className="text-[9px] text-slate-500">of 37 areas</span></span>
                    </div>
                  </div>
                  <div className="space-y-3 text-[10px] text-slate-600">
                    <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />Mapped states <strong className="float-right ml-4 text-slate-900">{knownRegionStates.length}</strong></p>
                    <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />Unmapped labels <strong className="float-right ml-4 text-slate-900">{unknownRegionStates}</strong></p>
                    <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-200" />Not covered <strong className="float-right ml-4 text-slate-900">{Math.max(0, 37 - stateReach.size)}</strong></p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">Coverage distribution is unavailable.</p>
              )}
            </div>
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Section title="Programme Health Matrix" description="Quick comparison of reach, verification, readiness, assessments, and reporting.">
          {portfolio.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No programme health rows are available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-3 py-3">Programme</th>
                    <th className="px-3 py-3">MSMEs Reached</th>
                    <th className="px-3 py-3">Evidence</th>
                    <th className="px-3 py-3">Indicators</th>
                    <th className="px-3 py-3">Assessments</th>
                    <th className="px-3 py-3">Reports</th>
                    <th className="px-3 py-3">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((item) => (
                    <tr key={item.programme.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {canOpenProgramme
                          ? <Link href={`/dashboard/impact-intelligence/programmes/${item.programme.id}`} className="hover:text-blue-700">{item.programme.name}</Link>
                          : item.programme.name}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(item.msmesReached)}</td>
                      <td className="px-3 py-3"><ProgressValue value={item.evidenceReadiness} /></td>
                      <td className="px-3 py-3"><ProgressValue value={item.indicatorReadiness} tone="bg-blue-500" /></td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(item.assessments)}</td>
                      <td className="px-3 py-3"><ProgressValue value={item.reportingReadiness} tone="bg-violet-500" /></td>
                      <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Programmes Requiring Attention" description="Loaded open risks and verified indicator exceptions only.">
          {!intelligenceSource.available || !indicatorsSource.available ? (
            <EmptyState title="Attention signals unavailable" description="Risk flags or verified indicator outcomes are not available for this role or could not be loaded. No issues are being inferred." icon={AlertTriangle} />
          ) : attentionProgrammes.length === 0 ? (
            <EmptyState title="No loaded programmes require attention" description="No open risk flags, regressed indicators, or below-target verified indicators were loaded in the current scope." icon={CheckCircle2} />
          ) : (
            <div className="space-y-3">
              {attentionProgrammes.slice(0, 5).map((item) => (
                <article key={item.programme.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", item.health === "At Risk" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900">{item.programme.name}</h3>
                        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.severity ?? item.health}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {item.issueCount} loaded issue{item.issueCount === 1 ? "" : "s"} · {item.attentionReasons[0] ?? "Attention required"}
                      </p>
                      {canOpenProgramme && (
                        <Link href={`/dashboard/impact-intelligence/programmes/${item.programme.id}`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">
                          View programme <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section
        title="Recent Programme Activity"
        description="Latest programme-scoped records available to the current role."
        action={<Activity className="h-4 w-4 text-slate-400" />}
      >
        {recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No recent programme activity is available.</p>
        ) : (
          <div className="relative grid gap-4 md:grid-cols-5">
            <div className="absolute left-[10%] right-[10%] top-5 hidden border-t border-dashed border-slate-300 md:block" aria-hidden="true" />
            {recentActivity.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={`${item.type}-${item.href}`} href={item.href} className="relative rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-200 hover:bg-blue-50/30">
                  <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-700 ring-4 ring-white"><Icon className="h-4 w-4" /></span>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">{item.type}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-[10px] text-slate-500">{formatFreshness(item.createdAt)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
        <span>Portfolio metrics use only records available within the current role and programme scope.</span>
        <span className="text-slate-300">•</span>
        <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
        <span>Missing sources remain unavailable and are not estimated.</span>
      </div>
    </section>
  );
}
