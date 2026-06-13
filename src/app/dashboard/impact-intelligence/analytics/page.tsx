import Link from "next/link";
import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileClock,
  FileText,
  FileWarning,
  Gauge,
  Globe2,
  MapPinned,
  Network,
  Radar,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserContext } from "@/lib/auth/authorization";
import {
  listFieldVisits,
  listImpactAssessments,
  listImpactCohorts,
  listImpactInterventions,
  listImpactProgrammes,
  listImpactReports,
  listIntelligenceFeed,
  type ImpactProgramme,
  type ImpactReport,
  type ImpactRiskFlag,
} from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import {
  listIndicatorDefinitions,
  listIndicatorMeasurements,
  type ImpactIndicatorDefinition,
  type ImpactIndicatorMeasurement,
} from "@/lib/data/impact-indicators";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/analytics";
const UNAVAILABLE = "Unavailable";
const ANALYTICS_ROLES = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "data_analyst", "auditor"];

type SourceState<T> = {
  data: T;
  available: boolean;
};

type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

type ReportRecord = ImpactReport & {
  submitted_at?: string | null;
  returned_at?: string | null;
  latest_version_id?: string | null;
  latest_version?: {
    generated_at?: string | null;
  } | null;
};

type ProgrammeAnalytics = {
  programme: ImpactProgramme;
  beneficiaries: number;
  interventions: number | null;
  evidenceTotal: number | null;
  verifiedEvidence: number | null;
  indicatorTotal: number | null;
  verifiedIndicators: number | null;
  approvedReports: number | null;
  reportTotal: number | null;
  openRisks: number | null;
  outcomeReadiness: number | null;
  evidenceReadiness: number | null;
  reportingReadiness: number | null;
  performance: number | null;
  health: HealthState;
};

type IndicatorAnalytics = {
  definition: ImpactIndicatorDefinition;
  latest: ImpactIndicatorMeasurement;
  programmeName: string;
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

function sourceFallback<T>(data: T): SourceState<T> {
  return { data, available: false };
}

async function loadSource<T>(
  ctx: UserContext,
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

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function average(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  return available.length > 0
    ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length)
    : null;
}

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatPercent(value: number | null) {
  return value === null ? UNAVAILABLE : `${value}%`;
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string | null, role: string) {
  const source = name?.trim() || roleLabel(role);
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
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

function displayStatus(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : UNAVAILABLE;
}

function regionForState(state: string) {
  return STATE_REGIONS[state.trim().toLowerCase()] ?? null;
}

function severityRank(value: string | null | undefined) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[value ?? ""] ?? 0;
}

function healthTone(health: HealthState) {
  if (health === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (health === "Watchlist") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (health === "At Risk") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function riskTone(value: string | null | undefined) {
  if (value === "critical" || value === "high") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (value === "medium") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (value === "low") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function deriveProgrammeHealth(
  indicators: ImpactIndicatorMeasurement[] | null,
  risks: ImpactRiskFlag[] | null,
): HealthState {
  if (indicators === null && risks === null) return "Unavailable";
  const regressed = indicators?.filter((item) => item.verification_status === "verified" && item.outcome_status === "regressed").length ?? 0;
  const belowTarget = indicators?.filter((item) => item.verification_status === "verified" && item.outcome_status === "below_target").length ?? 0;
  const openRisks = risks?.filter((item) => item.status === "open") ?? [];
  if (regressed > 0 || openRisks.some((item) => ["critical", "high"].includes(item.severity))) return "At Risk";
  if (belowTarget > 0 || openRisks.length > 0) return "Watchlist";
  const hasSignal = (indicators?.some((item) => item.verification_status === "verified") ?? false) || risks !== null;
  return hasSignal ? "Healthy" : "Unavailable";
}

function ProgressBar({
  value,
  tone = "bg-emerald-500",
  compact = false,
}: {
  value: number | null;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "min-w-[120px]" : "")}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
      </div>
      <span className="w-12 text-right text-[10px] font-bold text-slate-600">{formatPercent(value)}</span>
    </div>
  );
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
    <section id={id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#0c1733]">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{description}</p>}
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
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-[#0c1733]">{value}</p>
        </div>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

function DistributionBars({
  items,
  unavailable,
  emptyMessage,
  tone = "bg-blue-500",
}: {
  items: Array<{ label: string; value: number }>;
  unavailable?: boolean;
  emptyMessage: string;
  tone?: string;
}) {
  if (unavailable) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">Unavailable</p>;
  }
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">{emptyMessage}</p>;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
            <span className="truncate font-semibold text-slate-600">{displayStatus(item.label)}</span>
            <span className="font-bold text-slate-900">{formatNumber(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = key(item) || "Unspecified";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export default async function AnalyticsPage() {
  let ctx: UserContext | null = null;
  let programmesSource = sourceFallback<ImpactProgramme[]>([]);
  let accessDenied = false;

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    if (
      !ANALYTICS_ROLES.includes(currentContext.role)
      || !canRole(currentContext.role, "analytics", "read")
      || !canAccessRoute(currentContext.role, ROUTE)
    ) {
      accessDenied = true;
    } else {
      programmesSource = await loadSource(
        currentContext,
        "analytics_programmes_load_failed",
        () => listImpactProgrammes(currentContext, { limit: 1000 }),
        [],
      );
    }
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "analytics_context_load_failed", error });
  }

  if (accessDenied) {
    return (
      <section className="space-y-5">
        <Section title="Analytics Unavailable">
          <EmptyState
            title="Portfolio analytics are not available for this role"
            description="Broad analytics remain restricted by the current Impact Intelligence policy."
            icon={BarChart3}
          />
        </Section>
      </section>
    );
  }

  if (!ctx || !programmesSource.available) {
    return (
      <section className="space-y-5">
        <Section title="Impact Analytics Unavailable">
          <EmptyState
            title="Portfolio analytics could not load"
            description="The programme source, current session, or assignment scope is temporarily unavailable. No analytics are being inferred."
            icon={BarChart3}
          />
        </Section>
      </section>
    );
  }

  const canReadRisks = canRole(ctx.role, "intelligence", "read") && canRole(ctx.role, "risk_flag", "read");
  const canReadReports = canRole(ctx.role, "report", "read");
  const canReadEvidence = canRole(ctx.role, "evidence", "read");
  const canReadIndicators = canRole(ctx.role, "indicator", "read");

  const [
    cohortsSource,
    interventionsSource,
    assessmentsSource,
    visitsSource,
    evidenceSource,
    definitionsSource,
    measurementsSource,
    reportsSource,
    intelligenceSource,
  ] = await Promise.all([
    loadSource(ctx, "analytics_cohorts_load_failed", () => listImpactCohorts(ctx, { limit: 3000 }), []),
    loadSource(ctx, "analytics_interventions_load_failed", () => listImpactInterventions(ctx, { limit: 5000 }), []),
    loadSource(ctx, "analytics_assessments_load_failed", () => listImpactAssessments(ctx, { limit: 5000 }), []),
    loadSource(ctx, "analytics_monitoring_load_failed", () => listFieldVisits(ctx, { limit: 5000 }), []),
    canReadEvidence
      ? loadSource(ctx, "analytics_evidence_load_failed", () => listImpactEvidence(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactEvidenceRecord[]>([])),
    canReadIndicators
      ? loadSource(ctx, "analytics_indicator_definitions_load_failed", () => listIndicatorDefinitions(ctx, { limit: 2000 }), [])
      : Promise.resolve(sourceFallback<ImpactIndicatorDefinition[]>([])),
    canReadIndicators
      ? loadSource(ctx, "analytics_indicator_measurements_load_failed", () => listIndicatorMeasurements(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactIndicatorMeasurement[]>([])),
    canReadReports
      ? loadSource(ctx, "analytics_reports_load_failed", () => listImpactReports(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactReport[]>([])),
    canReadRisks
      ? loadSource(ctx, "analytics_risks_load_failed", () => listIntelligenceFeed(ctx, { limit: 500 }), null)
      : Promise.resolve(sourceFallback<Awaited<ReturnType<typeof listIntelligenceFeed>> | null>(null)),
  ]);

  const programmes = programmesSource.data;
  const programmeIds = new Set(programmes.map((item) => item.id));
  const cohorts = cohortsSource.data.filter((item) => programmeIds.has(item.programme_id));
  const interventions = interventionsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const assessments = assessmentsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const visits = visitsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const evidence = evidenceSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const definitions = definitionsSource.data.filter((item) => !item.programme_id || programmeIds.has(item.programme_id));
  const measurements = measurementsSource.data.filter((item) => programmeIds.has(item.programme_id));
  const reports = reportsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id)) as ReportRecord[];
  const riskFlags = intelligenceSource.data?.riskFlags.filter((item) => item.programme_id && programmeIds.has(item.programme_id)) ?? [];
  const openRisks = riskFlags.filter((item) => item.status === "open");

  const verifiedEvidence = evidence.filter((item) => item.status === "verified" && item.verification_status === "verified");
  const verifiedMeasurements = measurements.filter((item) => item.verification_status === "verified");
  const approvedAssessments = assessments.filter((item) => item.status === "approved");
  const reviewedVisits = visits.filter((item) => item.status === "reviewed");
  const approvedReports = reports.filter((item) => item.status === "approved");
  const submittedReports = reports.filter((item) => item.status === "in_review");
  const returnedReports = reports.filter((item) => item.status === "returned");
  const exportReadyReports = approvedReports.filter((item) => Boolean(item.latest_version_id || item.latest_version));

  const beneficiaryCount = programmes.reduce((sum, programme) => sum + (programme.cohort_beneficiary_count ?? 0), 0);
  const evidenceAssurance = evidenceSource.available ? ratio(verifiedEvidence.length, evidence.length) : null;
  const checksumCoverage = evidenceSource.available
    ? ratio(evidence.filter((item) => Boolean(item.checksum_sha256)).length, evidence.length)
    : null;
  const outcomeConfidence = measurementsSource.available
    ? ratio(verifiedMeasurements.length, measurements.length)
    : null;
  const reportingReadiness = reportsSource.available
    ? ratio(approvedReports.length, reports.length)
    : null;
  const assessmentAssurance = assessmentsSource.available
    ? ratio(approvedAssessments.length, assessments.length)
    : null;
  const monitoringAssurance = visitsSource.available
    ? ratio(reviewedVisits.length, visits.length)
    : null;
  const highOpenRisks = intelligenceSource.available
    ? openRisks.filter((item) => ["critical", "high"].includes(item.severity)).length
    : null;

  const programmeAnalytics: ProgrammeAnalytics[] = programmes.map((programme) => {
    const programmeEvidence = evidence.filter((item) => item.programme_id === programme.id);
    const programmeMeasurements = measurements.filter((item) => item.programme_id === programme.id);
    const programmeReports = reports.filter((item) => item.programme_id === programme.id);
    const programmeRisks = riskFlags.filter((item) => item.programme_id === programme.id);
    const programmeInterventions = interventions.filter((item) => item.programme_id === programme.id);
    const verifiedProgrammeEvidence = programmeEvidence.filter((item) => item.status === "verified" && item.verification_status === "verified");
    const verifiedProgrammeMeasurements = programmeMeasurements.filter((item) => item.verification_status === "verified");
    const approvedProgrammeReports = programmeReports.filter((item) => item.status === "approved");
    const outcomeReadiness = measurementsSource.available
      ? ratio(verifiedProgrammeMeasurements.length, programmeMeasurements.length)
      : null;
    const evidenceReadiness = evidenceSource.available
      ? ratio(verifiedProgrammeEvidence.length, programmeEvidence.length)
      : null;
    const programmeReportingReadiness = reportsSource.available
      ? ratio(approvedProgrammeReports.length, programmeReports.length)
      : null;
    const progressValues = verifiedProgrammeMeasurements
      .map((item) => item.progress_percentage)
      .filter((value): value is number => typeof value === "number");
    return {
      programme,
      beneficiaries: programme.cohort_beneficiary_count ?? 0,
      interventions: interventionsSource.available ? programmeInterventions.length : null,
      evidenceTotal: evidenceSource.available ? programmeEvidence.length : null,
      verifiedEvidence: evidenceSource.available ? verifiedProgrammeEvidence.length : null,
      indicatorTotal: measurementsSource.available ? programmeMeasurements.length : null,
      verifiedIndicators: measurementsSource.available ? verifiedProgrammeMeasurements.length : null,
      approvedReports: reportsSource.available ? approvedProgrammeReports.length : null,
      reportTotal: reportsSource.available ? programmeReports.length : null,
      openRisks: intelligenceSource.available ? programmeRisks.filter((item) => item.status === "open").length : null,
      outcomeReadiness,
      evidenceReadiness,
      reportingReadiness: programmeReportingReadiness,
      performance: progressValues.length > 0
        ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
        : null,
      health: deriveProgrammeHealth(
        measurementsSource.available ? programmeMeasurements : null,
        intelligenceSource.available ? programmeRisks : null,
      ),
    };
  }).sort((a, b) => (b.performance ?? -Infinity) - (a.performance ?? -Infinity) || a.programme.name.localeCompare(b.programme.name));

  const healthKnown = programmeAnalytics.filter((item) => item.health !== "Unavailable");
  const healthyProgrammes = healthKnown.filter((item) => item.health === "Healthy").length;
  const portfolioHealth = ratio(healthyProgrammes, healthKnown.length);
  const riskLevel = highOpenRisks === null
    ? UNAVAILABLE
    : highOpenRisks > 0
      ? "High"
      : openRisks.length > 0
        ? "Moderate"
        : "Low";

  const definitionsById = new Map(definitions.map((item) => [item.id, item]));
  const latestByDefinition = new Map<string, ImpactIndicatorMeasurement>();
  for (const measurement of verifiedMeasurements) {
    const current = latestByDefinition.get(measurement.indicator_definition_id);
    if (!current || `${measurement.measurement_date}:${measurement.created_at}` > `${current.measurement_date}:${current.created_at}`) {
      latestByDefinition.set(measurement.indicator_definition_id, measurement);
    }
  }
  const indicatorAnalytics: IndicatorAnalytics[] = Array.from(latestByDefinition.values())
    .map((latest) => ({
      latest,
      definition: definitionsById.get(latest.indicator_definition_id) ?? {
        id: latest.indicator_definition_id,
        programme_id: latest.programme_id,
        cohort_id: null,
        intervention_id: null,
        name: latest.impact_indicator_definitions?.name ?? "Indicator",
        description: null,
        unit_of_measure: latest.impact_indicator_definitions?.unit_of_measure ?? "",
        indicator_type: "outcome",
        direction_of_improvement: latest.impact_indicator_definitions?.direction_of_improvement ?? "increase",
        calculation_method: "manual",
        measurement_frequency: null,
        baseline_required: false,
        target_required: false,
        owner_user_id: null,
        status: "active",
        created_by_user_id: null,
        created_at: latest.created_at,
        updated_at: latest.updated_at,
        metadata: {},
      },
      programmeName: latest.impact_programmes?.name
        ?? programmes.find((item) => item.id === latest.programme_id)?.name
        ?? UNAVAILABLE,
    }));
  const topIndicators = indicatorAnalytics
    .filter((item) => ["achieved", "exceeded", "on_track"].includes(item.latest.outcome_status))
    .sort((a, b) => (b.latest.progress_percentage ?? -Infinity) - (a.latest.progress_percentage ?? -Infinity))
    .slice(0, 5);
  const underperformingIndicators = indicatorAnalytics
    .filter((item) => ["below_target", "regressed", "no_baseline"].includes(item.latest.outcome_status))
    .sort((a, b) => {
      if (a.latest.outcome_status === "regressed" && b.latest.outcome_status !== "regressed") return -1;
      if (b.latest.outcome_status === "regressed" && a.latest.outcome_status !== "regressed") return 1;
      return (a.latest.progress_percentage ?? Infinity) - (b.latest.progress_percentage ?? Infinity);
    })
    .slice(0, 5);
  const outcomeDistribution = countBy(indicatorAnalytics, (item) => item.latest.outcome_status);
  const targetAchievement = measurementsSource.available
    ? ratio(
        indicatorAnalytics.filter((item) => ["achieved", "exceeded"].includes(item.latest.outcome_status)).length,
        indicatorAnalytics.length,
      )
    : null;

  const stateReach = new Map<string, number>();
  for (const cohort of cohorts) {
    if (!cohort.state?.trim()) continue;
    stateReach.set(
      cohort.state.trim(),
      (stateReach.get(cohort.state.trim()) ?? 0) + (cohort.member_count ?? cohort.current_beneficiaries ?? 0),
    );
  }
  const topStates = Array.from(stateReach.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 6);
  const regionReach = new Map<string, number>();
  let unmappedReach = 0;
  for (const [state, reach] of stateReach) {
    const region = regionForState(state);
    if (!region) {
      unmappedReach += reach;
      continue;
    }
    regionReach.set(region, (regionReach.get(region) ?? 0) + reach);
  }
  const regions = Array.from(regionReach.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const evidenceGaps = evidenceSource.available
    ? evidence.filter((item) => item.status !== "verified" || item.verification_status !== "verified").length
    : null;
  const checksumGaps = evidenceSource.available
    ? evidence.filter((item) => !item.checksum_sha256).length
    : null;
  const reportingBottleneck = reportsSource.available
    ? [
        { label: "Draft", value: reports.filter((item) => item.status === "draft").length },
        { label: "Submitted", value: submittedReports.length },
        { label: "Returned", value: returnedReports.length },
        { label: "Approved", value: approvedReports.length },
        { label: "Export ready", value: exportReadyReports.length },
      ]
    : [];
  const riskCategories = countBy(openRisks, (item) => item.risk_type).slice(0, 6);
  const riskSeverity = countBy(openRisks, (item) => item.severity);
  const programmesRequiringAttention = programmeAnalytics
    .filter((item) => item.health === "At Risk" || item.health === "Watchlist")
    .sort((a, b) => (b.openRisks ?? 0) - (a.openRisks ?? 0))
    .slice(0, 5);

  const trendBuckets = new Map<string, number[]>();
  for (const measurement of verifiedMeasurements) {
    if (typeof measurement.progress_percentage !== "number" || !measurement.measurement_date) continue;
    const month = measurement.measurement_date.slice(0, 7);
    const values = trendBuckets.get(month) ?? [];
    values.push(measurement.progress_percentage);
    trendBuckets.set(month, values);
  }
  const trendData = Array.from(trendBuckets.entries())
    .map(([month, values]) => ({
      month,
      label: new Date(`${month}-01T00:00:00`).toLocaleDateString("en-NG", { month: "short", year: "2-digit" }),
      value: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const hasTrendData = trendData.length >= 2;

  const bestProgramme = programmeAnalytics.find((item) => item.performance !== null) ?? null;
  const weakestEvidenceProgramme = [...programmeAnalytics]
    .filter((item) => item.evidenceReadiness !== null)
    .sort((a, b) => (a.evidenceReadiness ?? Infinity) - (b.evidenceReadiness ?? Infinity))[0] ?? null;
  const highestRisk = [...openRisks].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0] ?? null;
  const strongestOutcome = topIndicators[0] ?? null;

  const evidenceConfidence = average([evidenceAssurance, checksumCoverage]);
  const overallOutcomeConfidence = average([outcomeConfidence, targetAchievement]);
  const reportingConfidence = average([reportingReadiness, reportsSource.available ? ratio(exportReadyReports.length, reports.length) : null]);
  const attentionRequired = programmeAnalytics.filter((item) => ["At Risk", "Watchlist"].includes(item.health)).length;
  const freshness = latestDate([
    ...programmes.map((item) => item.updated_at ?? item.created_at),
    ...cohorts.map((item) => item.updated_at ?? item.created_at),
    ...interventions.map((item) => item.updated_at ?? item.created_at),
    ...assessments.map((item) => item.submitted_at ?? item.created_at),
    ...visits.map((item) => item.reviewed_at ?? item.completed_at ?? item.created_at),
    ...evidence.map((item) => item.reviewed_at ?? item.uploaded_at ?? item.created_at),
    ...measurements.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...reports.map((item) => item.approved_at ?? item.submitted_at ?? item.created_at),
    ...riskFlags.map((item) => item.detected_at),
  ]);

  const canExport = canRole(ctx.role, "analytics", "export")
    && canRole(ctx.role, "export", "export")
    && canReadReports
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canViewReports = canReadReports && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canViewExecutive = canRole(ctx.role, "executive_dashboard", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/executive");
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Analytics</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">BOI Impact Analytics Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Board-ready intelligence across portfolio performance, verified outcomes, evidence assurance, geographic reach, reporting, and risk.
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
            <div className="flex flex-wrap items-center gap-2">
              {canExport && (
                <Link href="/dashboard/impact-intelligence/reports#export-centre" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#132d60]">
                  <Download className="h-4 w-4" /> Export Analytics
                </Link>
              )}
              {canViewReports && (
                <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <FileText className="h-4 w-4" /> View Reports
                </Link>
              )}
              {canViewExecutive && (
                <Link href="/dashboard/impact-intelligence/executive" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Gauge className="h-4 w-4" /> Executive Dashboard
                </Link>
              )}
              <span title={`${ctx.fullName ?? roleLabel(ctx.role)} · ${roleLabel(ctx.role)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initials(ctx.fullName, ctx.role)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_30%,rgba(37,99,235,0.42),transparent_30%),linear-gradient(120deg,#06142f_0%,#0a2452_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="analytics-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#67e8f9" /></pattern></defs>
            <path d="M510 32 615 18l82 39 67 3 55 63-47 48 8 58-94 16-70-35-75 16-53-62 25-59Z" fill="url(#analytics-hero-dots)" stroke="#38bdf8" strokeOpacity=".5" />
            <path d="M438 236c90-62 132-124 202-84s100 4 160-76" fill="none" stroke="#22d3ee" strokeOpacity=".6" />
            <circle cx="646" cy="150" r="5" fill="#34d399" />
            <circle cx="713" cy="156" r="4" fill="#a78bfa" />
            <circle cx="797" cy="78" r="4" fill="#fbbf24" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Executive intelligence layer</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Portfolio impact, assurance, and attention signals in one governed view</h2>
              <p className="mt-2 text-sm text-blue-100/80">Existing scoped records only. Verified and approved states remain role-controlled.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Overall portfolio health", value: formatPercent(portfolioHealth), icon: Gauge, color: "text-cyan-300" },
              { label: "Verified outcomes", value: measurementsSource.available ? formatNumber(verifiedMeasurements.length) : UNAVAILABLE, icon: Target, color: "text-emerald-300" },
              { label: "Reporting readiness", value: formatPercent(reportingReadiness), icon: FileCheck2, color: "text-violet-300" },
              { label: "Evidence assurance", value: formatPercent(evidenceAssurance), icon: ShieldCheck, color: "text-blue-300" },
              { label: "Portfolio risk level", value: riskLevel, icon: ShieldAlert, color: "text-amber-300" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-[#0a1d40]/75 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><Icon className={cn("h-4 w-4", item.color)} /></span>
                    <div><p className="text-lg font-bold">{item.value}</p><p className="text-[10px] font-medium text-blue-100/70">{item.label}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
        <MetricCard label="Programmes" value={formatNumber(programmes.length)} icon={Building2} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Beneficiaries / MSMEs" value={formatNumber(beneficiaryCount)} icon={UsersRound} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Interventions" value={interventionsSource.available ? formatNumber(interventions.length) : UNAVAILABLE} icon={Network} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Approved Assessments" value={assessmentsSource.available ? formatNumber(approvedAssessments.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Reviewed Visits" value={visitsSource.available ? formatNumber(reviewedVisits.length) : UNAVAILABLE} icon={MapPinned} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Verified Evidence" value={evidenceSource.available ? formatNumber(verifiedEvidence.length) : UNAVAILABLE} icon={ShieldCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Verified Indicators" value={measurementsSource.available ? formatNumber(verifiedMeasurements.length) : UNAVAILABLE} icon={Target} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Approved Reports" value={reportsSource.available ? formatNumber(approvedReports.length) : UNAVAILABLE} icon={FileCheck2} tone="bg-sky-100 text-sky-700" />
        <MetricCard label="Open Risks" value={intelligenceSource.available ? formatNumber(openRisks.length) : UNAVAILABLE} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
      </div>

      <Section
        title="Portfolio Performance Overview"
        description="Programme ranking uses the average progress percentage of the latest verified indicator measurements. Readiness values use only available source records."
        action={<span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{programmes.length} programmes</span>}
      >
        {programmeAnalytics.length === 0 ? (
          <EmptyState
            title={scopeEmptyMessage ?? "No programmes available"}
            description={scopeEmptyMessage ?? "No programme records are available in the current analytics scope."}
            icon={Building2}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {programmeAnalytics.slice(0, 9).map((item, index) => (
              <article key={item.programme.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0c1f46] text-[10px] font-bold text-white">{index + 1}</span>
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-bold text-[#0c1733]">{item.programme.name}</h3>
                      <p className="mt-1 text-[10px] text-slate-500">{item.programme.programme_code ?? "Programme code unavailable"}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-center">
                  <div><p className="text-sm font-bold text-slate-900">{formatNumber(item.beneficiaries)}</p><p className="text-[9px] text-slate-500">MSMEs</p></div>
                  <div><p className="text-sm font-bold text-slate-900">{formatNumber(item.interventions)}</p><p className="text-[9px] text-slate-500">Interventions</p></div>
                  <div><p className="text-sm font-bold text-slate-900">{formatPercent(item.performance)}</p><p className="text-[9px] text-slate-500">Performance</p></div>
                </div>
                <div className="mt-4 space-y-3">
                  <div><div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500"><span>Outcome readiness</span><span>{formatPercent(item.outcomeReadiness)}</span></div><ProgressBar value={item.outcomeReadiness} tone="bg-blue-500" /></div>
                  <div><div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500"><span>Reporting readiness</span><span>{formatPercent(item.reportingReadiness)}</span></div><ProgressBar value={item.reportingReadiness} /></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Section title="Outcome Analytics Centre" description="Latest verified measurements, target achievement, and deterministic outcome status distribution.">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Top-performing indicators</h3>
              <div className="mt-3 space-y-2">
                {!measurementsSource.available ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">Unavailable</p>
                ) : topIndicators.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">No verified on-track or achieved indicators are available.</p>
                ) : topIndicators.map((item, index) => (
                  <article key={item.latest.id} className="rounded-xl border border-slate-100 bg-emerald-50/40 p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-[11px] font-bold text-slate-800">{item.definition.name}</p>
                          <span className="text-[11px] font-bold text-emerald-700">{formatPercent(item.latest.progress_percentage)}</span>
                        </div>
                        <p className="mt-1 truncate text-[9px] text-slate-500">{item.programmeName} · {displayStatus(item.latest.outcome_status)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Underperforming indicators</h3>
              <div className="mt-3 space-y-2">
                {!measurementsSource.available ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">Unavailable</p>
                ) : underperformingIndicators.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">No verified underperforming indicators are available.</p>
                ) : underperformingIndicators.map((item) => (
                  <article key={item.latest.id} className="rounded-xl border border-slate-100 bg-rose-50/50 p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-700">
                        {item.latest.outcome_status === "regressed" ? <TrendingDown className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-[11px] font-bold text-slate-800">{item.definition.name}</p>
                          <span className="text-[11px] font-bold text-rose-700">{formatPercent(item.latest.progress_percentage)}</span>
                        </div>
                        <p className="mt-1 truncate text-[9px] text-slate-500">{item.programmeName} · {displayStatus(item.latest.outcome_status)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Outcome Distribution" description="Current state of latest verified measurements.">
          <div className="grid grid-cols-2 gap-3">
            <article className="rounded-2xl bg-[#0c1f46] p-4 text-white">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-blue-200">Verified measurements</p>
              <p className="mt-3 text-3xl font-bold">{measurementsSource.available ? formatNumber(verifiedMeasurements.length) : UNAVAILABLE}</p>
            </article>
            <article className="rounded-2xl bg-emerald-600 p-4 text-white">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-100">Target achievement</p>
              <p className="mt-3 text-3xl font-bold">{formatPercent(targetAchievement)}</p>
            </article>
          </div>
          <div className="mt-5">
            <DistributionBars items={outcomeDistribution} unavailable={!measurementsSource.available} emptyMessage="No verified outcome distribution is available." tone="bg-indigo-500" />
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Section title="Geographic Impact Zone" description="State and regional reach derived from programme-linked cohort geography. Missing geography remains unavailable.">
          {!cohortsSource.available ? (
            <EmptyState title="Geographic impact unavailable" description="Cohort geography could not be loaded. No state or regional distribution is being inferred." icon={MapPinned} />
          ) : stateReach.size === 0 ? (
            <EmptyState title="Geographic impact unavailable" description="No programme-linked cohort state values are available in the current scope." icon={MapPinned} />
          ) : (
            <div className="grid gap-6 md:grid-cols-[.75fr_1.25fr]">
              <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 p-5">
                <Globe2 className="h-32 w-32 text-blue-100" />
                <div className="absolute inset-x-5 bottom-5 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/90 p-3 text-center shadow-sm"><p className="text-xl font-bold text-[#0c1733]">{stateReach.size}</p><p className="text-[9px] text-slate-500">States</p></div>
                  <div className="rounded-xl bg-white/90 p-3 text-center shadow-sm"><p className="text-xl font-bold text-[#0c1733]">{regionReach.size}</p><p className="text-[9px] text-slate-500">Regions</p></div>
                  <div className="rounded-xl bg-white/90 p-3 text-center shadow-sm"><p className="text-xl font-bold text-[#0c1733]">{formatNumber(unmappedReach)}</p><p className="text-[9px] text-slate-500">Unmapped reach</p></div>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><h3 className="mb-4 text-xs font-bold text-slate-800">Top states by reach</h3><DistributionBars items={topStates} emptyMessage="State reach unavailable." tone="bg-emerald-500" /></div>
                <div><h3 className="mb-4 text-xs font-bold text-slate-800">Regional coverage</h3><DistributionBars items={regions} emptyMessage="Regional coverage unavailable." tone="bg-blue-500" /></div>
              </div>
            </div>
          )}
        </Section>

        <Section title="Evidence & Assurance Analytics" description="Verification, checksum, assessment, and monitoring assurance from existing records.">
          <div className="space-y-4">
            {[
              { label: "Evidence verification rate", value: evidenceAssurance, icon: ShieldCheck, tone: "bg-emerald-500" },
              { label: "Checksum coverage", value: checksumCoverage, icon: BadgeCheck, tone: "bg-cyan-500" },
              { label: "Assessment assurance", value: assessmentAssurance, icon: ClipboardCheck, tone: "bg-indigo-500" },
              { label: "Monitoring assurance", value: monitoringAssurance, icon: MapPinned, tone: "bg-blue-500" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white", item.tone)}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-slate-700">{item.label}</p><span className="text-sm font-bold text-[#0c1733]">{formatPercent(item.value)}</span></div>
                      <div className="mt-2"><ProgressBar value={item.value} tone={item.tone} /></div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-lg font-bold text-amber-800">{formatNumber(evidenceGaps)}</p><p className="text-[9px] font-bold uppercase text-amber-700">Evidence gaps</p></div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-lg font-bold text-rose-800">{formatNumber(checksumGaps)}</p><p className="text-[9px] font-bold uppercase text-rose-700">Checksum gaps</p></div>
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Reporting & Governance Analytics" description="Approval flow, reporting readiness, export readiness, and current bottlenecks.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Approved", value: reportsSource.available ? approvedReports.length : null, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
              { label: "Submitted", value: reportsSource.available ? submittedReports.length : null, icon: FileClock, tone: "text-blue-700 bg-blue-50" },
              { label: "Returned", value: reportsSource.available ? returnedReports.length : null, icon: RotateCcw, tone: "text-rose-700 bg-rose-50" },
              { label: "Export ready", value: reportsSource.available ? exportReadyReports.length : null, icon: Download, tone: "text-violet-700 bg-violet-50" },
              { label: "Readiness", value: reportingReadiness, icon: Gauge, tone: "text-cyan-700 bg-cyan-50", percent: true },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className={cn("rounded-2xl p-3", item.tone)}>
                  <Icon className="h-4 w-4" />
                  <p className="mt-4 text-xl font-bold">{item.percent ? formatPercent(item.value) : formatNumber(item.value)}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase">{item.label}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-5">
            <h3 className="mb-4 text-xs font-bold text-slate-800">Approval bottlenecks</h3>
            <DistributionBars items={reportingBottleneck} unavailable={!reportsSource.available} emptyMessage="No reporting lifecycle records are available." tone="bg-violet-500" />
          </div>
        </Section>

        <Section title="Risk Intelligence Centre" description="Open risk flags, severity, categories, and programmes requiring executive attention.">
          {!intelligenceSource.available ? (
            <EmptyState title="Risk intelligence unavailable" description="Risk records are not available for this role or the source could not be loaded." icon={ShieldAlert} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <article className="rounded-2xl bg-rose-600 p-4 text-white"><p className="text-3xl font-bold">{formatNumber(openRisks.length)}</p><p className="mt-1 text-[9px] font-bold uppercase text-rose-100">Open risk flags</p></article>
                  <article className="rounded-2xl bg-amber-500 p-4 text-white"><p className="text-3xl font-bold">{formatNumber(highOpenRisks)}</p><p className="mt-1 text-[9px] font-bold uppercase text-amber-50">High / critical</p></article>
                </div>
                <h3 className="mb-3 mt-5 text-xs font-bold text-slate-800">Severity distribution</h3>
                <DistributionBars items={riskSeverity} emptyMessage="No open risk severity data." tone="bg-rose-500" />
              </div>
              <div>
                <h3 className="mb-3 text-xs font-bold text-slate-800">Risk categories</h3>
                <DistributionBars items={riskCategories} emptyMessage="No open risk categories." tone="bg-amber-500" />
                <h3 className="mb-3 mt-5 text-xs font-bold text-slate-800">Programmes requiring attention</h3>
                <div className="space-y-2">
                  {programmesRequiringAttention.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">No programme attention signals are available.</p>
                  ) : programmesRequiringAttention.map((item) => (
                    <div key={item.programme.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <p className="truncate text-[11px] font-bold text-slate-700">{item.programme.name}</p>
                      <span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section title="Trend & Movement Centre" description="Average monthly progress across verified measurements where historical progress values exist.">
        {!measurementsSource.available || !hasTrendData ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
            <Activity className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-4 text-sm font-bold text-slate-700">Trend data unavailable</p>
            <p className="mt-1 text-xs text-slate-500">At least two historical verified measurement periods with progress values are required.</p>
          </div>
        ) : (
          <div className="flex h-56 items-end gap-3 overflow-x-auto rounded-2xl bg-slate-50 p-5">
            {trendData.map((item) => (
              <div key={item.label} className="flex min-w-14 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-bold text-slate-700">{formatPercent(item.value)}</span>
                <div className="w-full max-w-16 rounded-t-xl bg-gradient-to-t from-blue-700 to-cyan-400" style={{ height: `${Math.max(8, Math.min(100, item.value))}%` }} />
                <span className="text-[9px] font-semibold text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Executive Insight Cards" description="Deterministic statements generated only from the visible scoped records.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Best-performing programme",
              title: bestProgramme?.programme.name ?? UNAVAILABLE,
              detail: bestProgramme ? `${formatPercent(bestProgramme.performance)} average verified progress` : "No comparable verified programme progress is available.",
              icon: TrendingUp,
              tone: "bg-emerald-100 text-emerald-700",
            },
            {
              label: "Weakest evidence coverage",
              title: weakestEvidenceProgramme?.programme.name ?? UNAVAILABLE,
              detail: weakestEvidenceProgramme ? `${formatPercent(weakestEvidenceProgramme.evidenceReadiness)} verified evidence coverage` : "No comparable evidence coverage is available.",
              icon: FileWarning,
              tone: "bg-amber-100 text-amber-700",
            },
            {
              label: "Highest risk area",
              title: highestRisk?.title ?? UNAVAILABLE,
              detail: highestRisk ? `${displayStatus(highestRisk.severity)} · ${displayStatus(highestRisk.risk_type)}` : "No open risk flag is available.",
              icon: AlertTriangle,
              tone: "bg-rose-100 text-rose-700",
            },
            {
              label: "Strongest verified outcome",
              title: strongestOutcome?.definition.name ?? UNAVAILABLE,
              detail: strongestOutcome ? `${formatPercent(strongestOutcome.latest.progress_percentage)} · ${strongestOutcome.programmeName}` : "No verified achieved or on-track outcome is available.",
              icon: Target,
              tone: "bg-indigo-100 text-indigo-700",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl", item.tone)}><Icon className="h-5 w-5" /></span>
                <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                <h3 className="mt-2 text-sm font-bold leading-5 text-[#0c1733]">{item.title}</h3>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section title="Analytics Health Matrix" description="Executive scan across assurance, outcomes, reporting, risk, and programme health.">
        {programmeAnalytics.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No programme health rows are available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3">Programme</th>
                  <th className="px-3 py-3">Evidence</th>
                  <th className="px-3 py-3">Indicators</th>
                  <th className="px-3 py-3">Reports</th>
                  <th className="px-3 py-3">Risks</th>
                  <th className="px-3 py-3">Health</th>
                </tr>
              </thead>
              <tbody>
                {programmeAnalytics.map((item) => (
                  <tr key={item.programme.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {canAccessRoute(ctx.role, "/dashboard/impact-intelligence/programmes")
                        ? <Link href={`/dashboard/impact-intelligence/programmes/${item.programme.id}`} className="hover:text-blue-700">{item.programme.name}</Link>
                        : item.programme.name}
                    </td>
                    <td className="px-3 py-3"><ProgressBar value={item.evidenceReadiness} compact /></td>
                    <td className="px-3 py-3"><ProgressBar value={item.outcomeReadiness} tone="bg-blue-500" compact /></td>
                    <td className="px-3 py-3"><ProgressBar value={item.reportingReadiness} tone="bg-violet-500" compact /></td>
                    <td className="px-3 py-3">
                      {item.openRisks === null
                        ? <span className="text-slate-500">{UNAVAILABLE}</span>
                        : <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", riskTone(item.openRisks > 0 ? "high" : "low"))}>{formatNumber(item.openRisks)}</span>}
                    </td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#07152f_0%,#0d2856_60%,#10346a_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Executive analytics summary</p>
              <h2 className="mt-3 text-2xl font-bold">Decision confidence across the impact portfolio</h2>
              <p className="mt-2 max-w-2xl text-sm text-blue-100/75">Confidence scores reflect only available governed sources. Missing sources remain unavailable.</p>
            </div>
            <Radar className="h-10 w-10 text-cyan-300" />
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Impact Health", value: portfolioHealth, icon: Gauge, color: "text-cyan-300" },
              { label: "Evidence Confidence", value: evidenceConfidence, icon: ShieldCheck, color: "text-emerald-300" },
              { label: "Outcome Confidence", value: overallOutcomeConfidence, icon: Target, color: "text-violet-300" },
              { label: "Reporting Confidence", value: reportingConfidence, icon: FileCheck2, color: "text-blue-300" },
              { label: "Executive Attention Required", value: healthKnown.length > 0 ? attentionRequired : null, icon: AlertTriangle, color: "text-amber-300", number: true },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <Icon className={cn("h-5 w-5", item.color)} />
                  <p className="mt-5 text-2xl font-bold">{item.number ? formatNumber(item.value) : formatPercent(item.value)}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-blue-100/65">{item.label}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <p className="text-xs text-blue-100/70">Scope: {roleLabel(ctx.role)} · Last visible source update: {formatFreshness(freshness)}</p>
            {canViewReports && (
              <Link href="/dashboard/impact-intelligence/reports" className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300 hover:text-emerald-200">
                Open institutional reports <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
