import Link from "next/link";
import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
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
  listIntelligenceFeed,
  type ImpactProgramme,
  type ImpactRiskFlag,
} from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import {
  listIndicatorDefinitions,
  listIndicatorMeasurements,
  type ImpactIndicatorDefinition,
  type ImpactIndicatorMeasurement,
} from "@/lib/data/impact-indicators";
import {
  listInstitutionalReportExports,
  listInstitutionalReports,
  type InstitutionalReport,
  type InstitutionalReportExport,
} from "@/lib/data/impact-reports";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/executive";
const UNAVAILABLE = "Unavailable";
const EXECUTIVE_ROLES = ["admin", "super_admin", "boi_executive", "data_analyst", "auditor"];

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

type ProgrammeExecutiveView = {
  programme: ImpactProgramme;
  beneficiaries: number;
  interventions: number | null;
  evidenceConfidence: number | null;
  outcomeConfidence: number | null;
  reportingReadiness: number | null;
  performance: number | null;
  openRisks: number | null;
  riskLevel: string;
  health: HealthState;
};

type OutcomeView = {
  definition: ImpactIndicatorDefinition;
  measurement: ImpactIndicatorMeasurement;
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

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
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

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayStatus(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) : UNAVAILABLE;
}

function regionForState(state: string) {
  return STATE_REGIONS[state.trim().toLowerCase()] ?? null;
}

function severityRank(value: string | null | undefined) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[value ?? ""] ?? 0;
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

function healthTone(value: HealthState) {
  if (value === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "Watchlist") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (value === "At Risk") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function riskTone(value: string) {
  if (value === "Critical" || value === "High") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (value === "Moderate") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (value === "Low") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function deriveHealth(measurements: ImpactIndicatorMeasurement[] | null, risks: ImpactRiskFlag[] | null): HealthState {
  if (measurements === null && risks === null) return "Unavailable";
  const regressed = measurements?.some((item) => item.verification_status === "verified" && item.outcome_status === "regressed");
  const belowTarget = measurements?.some((item) => item.verification_status === "verified" && item.outcome_status === "below_target");
  const openRisks = risks?.filter((item) => item.status === "open") ?? [];
  if (regressed || openRisks.some((item) => ["critical", "high"].includes(item.severity))) return "At Risk";
  if (belowTarget || openRisks.length > 0) return "Watchlist";
  const hasSignal = measurements?.some((item) => item.verification_status === "verified") || risks !== null;
  return hasSignal ? "Healthy" : "Unavailable";
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
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
  icon: typeof Gauge;
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

function ProgressBar({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  return (
    <div className="flex min-w-[120px] items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
      </div>
      <span className="w-12 text-right text-[10px] font-bold text-slate-600">{formatPercent(value)}</span>
    </div>
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
  if (unavailable) return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">{UNAVAILABLE}</p>;
  if (items.length === 0) return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">{emptyMessage}</p>;
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

function UnavailableState({ message }: { message: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">{message}</p>;
}

export default async function ExecutiveDashboardPage() {
  let ctx: UserContext | null = null;
  let programmesSource = sourceFallback<ImpactProgramme[]>([]);

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    if (
      EXECUTIVE_ROLES.includes(currentContext.role)
      && canRole(currentContext.role, "executive_dashboard", "read")
      && canAccessRoute(currentContext.role, ROUTE)
    ) {
      programmesSource = await loadSource(
        currentContext,
        "executive_programmes_load_failed",
        () => listImpactProgrammes(currentContext, { limit: 1000 }),
        [],
      );
    }
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "executive_context_load_failed", error });
  }

  if (
    !ctx
    || !EXECUTIVE_ROLES.includes(ctx.role)
    || !canRole(ctx.role, "executive_dashboard", "read")
    || !canAccessRoute(ctx.role, ROUTE)
  ) {
    return (
      <Section title="Executive Dashboard Unavailable">
        <EmptyState
          title="Executive portfolio intelligence is not available for this role"
          description="Access remains controlled by the existing Impact Intelligence route and role policy."
          icon={Gauge}
        />
      </Section>
    );
  }

  if (!programmesSource.available) {
    return (
      <Section title="Executive Dashboard Unavailable">
        <EmptyState
          title="Portfolio intelligence could not load"
          description="The programme source, current session, or assignment scope is temporarily unavailable. No metrics are being inferred."
          icon={Gauge}
        />
      </Section>
    );
  }

  const canReadEvidence = canRole(ctx.role, "evidence", "read");
  const canReadIndicators = canRole(ctx.role, "indicator", "read");
  const canReadReports = canRole(ctx.role, "report", "read");
  const canReadRisks = canRole(ctx.role, "risk_flag", "read") && canRole(ctx.role, "intelligence", "read");

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
    loadSource(ctx, "executive_cohorts_load_failed", () => listImpactCohorts(ctx, { limit: 3000 }), []),
    loadSource(ctx, "executive_interventions_load_failed", () => listImpactInterventions(ctx, { limit: 5000 }), []),
    loadSource(ctx, "executive_assessments_load_failed", () => listImpactAssessments(ctx, { limit: 5000 }), []),
    loadSource(ctx, "executive_monitoring_load_failed", () => listFieldVisits(ctx, { limit: 5000 }), []),
    canReadEvidence
      ? loadSource(ctx, "executive_evidence_load_failed", () => listImpactEvidence(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactEvidenceRecord[]>([])),
    canReadIndicators
      ? loadSource(ctx, "executive_indicator_definitions_load_failed", () => listIndicatorDefinitions(ctx, { limit: 2000 }), [])
      : Promise.resolve(sourceFallback<ImpactIndicatorDefinition[]>([])),
    canReadIndicators
      ? loadSource(ctx, "executive_indicator_measurements_load_failed", () => listIndicatorMeasurements(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactIndicatorMeasurement[]>([])),
    canReadReports
      ? loadSource(ctx, "executive_reports_load_failed", () => listInstitutionalReports(ctx, 5000), [])
      : Promise.resolve(sourceFallback<InstitutionalReport[]>([])),
    canReadRisks
      ? loadSource(ctx, "executive_risks_load_failed", () => listIntelligenceFeed(ctx, { limit: 500 }), null)
      : Promise.resolve(sourceFallback<Awaited<ReturnType<typeof listIntelligenceFeed>> | null>(null)),
  ]);

  const exportsSource = reportsSource.available && canReadReports
    ? await loadSource(
        ctx,
        "executive_report_exports_load_failed",
        () => listInstitutionalReportExports(ctx as UserContext, reportsSource.data.map((report) => report.id)),
        [],
      )
    : sourceFallback<InstitutionalReportExport[]>([]);

  const programmes = programmesSource.data;
  const programmeIds = new Set(programmes.map((item) => item.id));
  const activeProgrammes = programmes.filter((item) => item.status === "active");
  const cohorts = cohortsSource.data.filter((item) => programmeIds.has(item.programme_id));
  const interventions = interventionsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const assessments = assessmentsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const visits = visitsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const evidence = evidenceSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const definitions = definitionsSource.data.filter((item) => !item.programme_id || programmeIds.has(item.programme_id));
  const measurements = measurementsSource.data.filter((item) => programmeIds.has(item.programme_id));
  const reports = reportsSource.data.filter((item) => item.programme_id && programmeIds.has(item.programme_id));
  const riskFlags = intelligenceSource.data?.riskFlags.filter((item) => item.programme_id && programmeIds.has(item.programme_id)) ?? [];

  const approvedAssessments = assessments.filter((item) => item.status === "approved");
  const reviewedVisits = visits.filter((item) => item.status === "reviewed");
  const verifiedEvidence = evidence.filter((item) => item.status === "verified" && item.verification_status === "verified");
  const verifiedMeasurements = measurements.filter((item) => item.verification_status === "verified");
  const approvedReports = reports.filter((item) => item.status === "approved");
  const submittedReports = reports.filter((item) => item.status === "in_review");
  const openRisks = riskFlags.filter((item) => item.status === "open");
  const highRisks = openRisks.filter((item) => ["critical", "high"].includes(item.severity));
  const exportReadyReports = approvedReports.filter((item) => Boolean(item.latest_version_id && item.latest_version));
  const generatedExportReportIds = new Set(
    exportsSource.data.filter((item) => item.export_status === "generated").map((item) => item.report_id),
  );

  const activeProgrammeIds = new Set(activeProgrammes.map((item) => item.id));
  const evidenceProgrammeIds = new Set(verifiedEvidence.map((item) => item.programme_id).filter(Boolean));
  const outcomeProgrammeIds = new Set(verifiedMeasurements.map((item) => item.programme_id));
  const reportingProgrammeIds = new Set(approvedReports.map((item) => item.programme_id).filter(Boolean));
  const programmeDenominator = activeProgrammes.length;
  const evidenceCoverage = evidenceSource.available
    ? ratio([...activeProgrammeIds].filter((id) => evidenceProgrammeIds.has(id)).length, programmeDenominator)
    : null;
  const outcomeCoverage = measurementsSource.available
    ? ratio([...activeProgrammeIds].filter((id) => outcomeProgrammeIds.has(id)).length, programmeDenominator)
    : null;
  const reportingReadiness = reportsSource.available
    ? ratio([...activeProgrammeIds].filter((id) => reportingProgrammeIds.has(id)).length, programmeDenominator)
    : null;
  const checksumCoverage = evidenceSource.available
    ? ratio(verifiedEvidence.filter((item) => Boolean(item.checksum_sha256)).length, verifiedEvidence.length)
    : null;
  const evidenceConfidence = average([evidenceCoverage, checksumCoverage]);

  const definitionsById = new Map(definitions.map((item) => [item.id, item]));
  const latestByDefinition = new Map<string, ImpactIndicatorMeasurement>();
  for (const measurement of verifiedMeasurements) {
    const current = latestByDefinition.get(measurement.indicator_definition_id);
    if (!current || `${measurement.measurement_date}:${measurement.created_at}` > `${current.measurement_date}:${current.created_at}`) {
      latestByDefinition.set(measurement.indicator_definition_id, measurement);
    }
  }
  const outcomes: OutcomeView[] = Array.from(latestByDefinition.values()).map((measurement) => ({
    measurement,
    definition: definitionsById.get(measurement.indicator_definition_id) ?? {
      id: measurement.indicator_definition_id,
      programme_id: measurement.programme_id,
      cohort_id: null,
      intervention_id: null,
      name: measurement.impact_indicator_definitions?.name ?? "Indicator",
      description: null,
      unit_of_measure: measurement.impact_indicator_definitions?.unit_of_measure ?? "",
      indicator_type: "outcome",
      direction_of_improvement: measurement.impact_indicator_definitions?.direction_of_improvement ?? "increase",
      calculation_method: "manual",
      measurement_frequency: null,
      baseline_required: false,
      target_required: false,
      owner_user_id: null,
      status: "active",
      created_by_user_id: null,
      created_at: measurement.created_at,
      updated_at: measurement.updated_at,
      metadata: {},
    },
    programmeName: measurement.impact_programmes?.name
      ?? programmes.find((item) => item.id === measurement.programme_id)?.name
      ?? UNAVAILABLE,
  }));
  const strongestOutcomes = outcomes
    .filter((item) => ["achieved", "exceeded", "on_track"].includes(item.measurement.outcome_status))
    .sort((a, b) => (b.measurement.progress_percentage ?? -Infinity) - (a.measurement.progress_percentage ?? -Infinity))
    .slice(0, 5);
  const underperformingOutcomes = outcomes
    .filter((item) => ["below_target", "regressed", "no_baseline"].includes(item.measurement.outcome_status))
    .sort((a, b) => {
      if (a.measurement.outcome_status === "regressed" && b.measurement.outcome_status !== "regressed") return -1;
      if (b.measurement.outcome_status === "regressed" && a.measurement.outcome_status !== "regressed") return 1;
      return (a.measurement.progress_percentage ?? Infinity) - (b.measurement.progress_percentage ?? Infinity);
    })
    .slice(0, 5);
  const outcomeAchievement = measurementsSource.available
    ? ratio(outcomes.filter((item) => ["achieved", "exceeded"].includes(item.measurement.outcome_status)).length, outcomes.length)
    : null;
  const outcomeConfidence = average([outcomeCoverage, outcomeAchievement]);

  const programmeViews: ProgrammeExecutiveView[] = programmes.map((programme) => {
    const programmeEvidence = verifiedEvidence.filter((item) => item.programme_id === programme.id);
    const programmeOutcomes = verifiedMeasurements.filter((item) => item.programme_id === programme.id);
    const programmeReports = approvedReports.filter((item) => item.programme_id === programme.id);
    const programmeRisks = riskFlags.filter((item) => item.programme_id === programme.id);
    const progress = programmeOutcomes
      .map((item) => item.progress_percentage)
      .filter((value): value is number => typeof value === "number");
    const highestSeverity = [...programmeRisks.filter((item) => item.status === "open")]
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]?.severity;
    return {
      programme,
      beneficiaries: programme.cohort_beneficiary_count ?? 0,
      interventions: interventionsSource.available
        ? interventions.filter((item) => item.programme_id === programme.id).length
        : null,
      evidenceConfidence: evidenceSource.available ? (programmeEvidence.length > 0 ? 100 : 0) : null,
      outcomeConfidence: measurementsSource.available ? (programmeOutcomes.length > 0 ? 100 : 0) : null,
      reportingReadiness: reportsSource.available ? (programmeReports.length > 0 ? 100 : 0) : null,
      performance: progress.length > 0
        ? Math.round(progress.reduce((sum, value) => sum + value, 0) / progress.length)
        : null,
      openRisks: intelligenceSource.available ? programmeRisks.filter((item) => item.status === "open").length : null,
      riskLevel: highestSeverity ? displayStatus(highestSeverity) : intelligenceSource.available ? "Low" : UNAVAILABLE,
      health: deriveHealth(
        measurementsSource.available ? programmeOutcomes : null,
        intelligenceSource.available ? programmeRisks : null,
      ),
    };
  }).sort((a, b) => (b.performance ?? -Infinity) - (a.performance ?? -Infinity) || a.programme.name.localeCompare(b.programme.name));

  const knownHealth = programmeViews.filter((item) => item.health !== "Unavailable");
  const portfolioHealth = ratio(knownHealth.filter((item) => item.health === "Healthy").length, knownHealth.length);
  const attentionProgrammes = programmeViews.filter((item) => item.health === "At Risk" || item.health === "Watchlist");
  const strongestProgramme = programmeViews.find((item) => item.performance !== null) ?? null;
  const highestRiskProgramme = [...programmeViews]
    .filter((item) => item.openRisks !== null && item.openRisks > 0)
    .sort((a, b) => (b.openRisks ?? 0) - (a.openRisks ?? 0) || severityRank(b.riskLevel.toLowerCase()) - severityRank(a.riskLevel.toLowerCase()))[0] ?? null;
  const weakestEvidenceProgramme = [...programmeViews]
    .filter((item) => item.evidenceConfidence !== null)
    .sort((a, b) => (a.evidenceConfidence ?? Infinity) - (b.evidenceConfidence ?? Infinity))[0] ?? null;
  const reportsAwaitingApproval = canRole(ctx.role, "report", "review") ? submittedReports.length : null;

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
  for (const [state, reach] of stateReach) {
    const region = regionForState(state);
    if (region) regionReach.set(region, (regionReach.get(region) ?? 0) + reach);
  }
  const regions = Array.from(regionReach.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const evidenceGapProgrammes = evidenceSource.available
    ? activeProgrammes.filter((item) => !evidenceProgrammeIds.has(item.id)).length
    : null;
  const indicatorGapProgrammes = measurementsSource.available
    ? activeProgrammes.filter((item) => !outcomeProgrammeIds.has(item.id)).length
    : null;
  const monitoringReviewGaps = visitsSource.available ? visits.length - reviewedVisits.length : null;
  const beneficiaryCount = programmes.reduce((sum, programme) => sum + (programme.cohort_beneficiary_count ?? 0), 0);
  const outcomeDistribution = countBy(outcomes, (item) => item.measurement.outcome_status);
  const riskSeverity = countBy(openRisks, (item) => item.severity);
  const latestReports = [...approvedReports]
    .sort((a, b) => (b.approved_at ?? b.created_at).localeCompare(a.approved_at ?? a.created_at))
    .slice(0, 6);

  const reportingBottleneck = reportsSource.available
    ? canRole(ctx.role, "report", "review") && submittedReports.length > 0
      ? `${submittedReports.length} report${submittedReports.length === 1 ? "" : "s"} awaiting approval`
      : evidenceGapProgrammes !== null && evidenceGapProgrammes > 0
        ? `${evidenceGapProgrammes} active programme${evidenceGapProgrammes === 1 ? "" : "s"} without verified evidence`
        : indicatorGapProgrammes !== null && indicatorGapProgrammes > 0
          ? `${indicatorGapProgrammes} active programme${indicatorGapProgrammes === 1 ? "" : "s"} without verified outcomes`
          : approvedReports.length === 0
            ? "No approved reports available"
            : "No observed reporting bottleneck"
    : UNAVAILABLE;

  const freshness = latestDate([
    ...programmes.map((item) => item.updated_at ?? item.created_at),
    ...cohorts.map((item) => item.updated_at ?? item.created_at),
    ...interventions.map((item) => item.updated_at ?? item.created_at),
    ...assessments.map((item) => item.submitted_at ?? item.created_at),
    ...visits.map((item) => item.reviewed_at ?? item.completed_at ?? item.created_at),
    ...verifiedEvidence.map((item) => item.reviewed_at ?? item.uploaded_at ?? item.created_at),
    ...verifiedMeasurements.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...approvedReports.map((item) => item.approved_at ?? item.created_at),
    ...riskFlags.map((item) => item.detected_at),
  ]);

  const canViewReports = canReadReports && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canDownloadReports = canViewReports
    && canRole(ctx.role, "report", "export")
    && canRole(ctx.role, "export", "export");
  const canViewAnalytics = canRole(ctx.role, "analytics", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/analytics");
  const canViewRisks = canReadRisks && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/risk-flags");
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_78%_24%,rgba(37,99,235,0.48),transparent_30%),linear-gradient(120deg,#050f24_0%,#0a224d_55%,#07162f_100%)] p-5 text-white shadow-2xl shadow-blue-950/15 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 360" className="h-full w-full">
            <defs><pattern id="executive-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#67e8f9" /></pattern></defs>
            <path d="M510 32 615 18l82 39 67 3 55 63-47 48 8 58-94 16-70-35-75 16-53-62 25-59Z" fill="url(#executive-hero-dots)" stroke="#38bdf8" strokeOpacity=".5" />
            <path d="M410 300c105-80 160-150 245-96s112 9 184-96" fill="none" stroke="#22d3ee" strokeOpacity=".55" />
            <circle cx="646" cy="150" r="5" fill="#34d399" />
            <circle cx="713" cy="156" r="4" fill="#a78bfa" />
            <circle cx="797" cy="78" r="4" fill="#fbbf24" />
          </svg>
        </div>
        <div className="relative">
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200/70">
            <Link href="/dashboard/impact-intelligence" className="hover:text-white">Impact Intelligence</Link>
            <span>/</span>
            <span className="text-emerald-300">Executive</span>
          </nav>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">BOI executive impact intelligence</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">Portfolio impact, assurance, and executive attention in one governed view</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/75">Board-ready intelligence from existing programme-scoped records. Approved and verified states remain enforced by the data layer.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canViewReports && <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#0c1f46] hover:bg-blue-50"><FileText className="h-4 w-4" /> Open Reports</Link>}
              {canDownloadReports && <Link href="/dashboard/impact-intelligence/reports#export-centre" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"><Download className="h-4 w-4" /> Download Approved Reports</Link>}
              {canViewAnalytics && <Link href="/dashboard/impact-intelligence/analytics" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"><BarChart3 className="h-4 w-4" /> Open Analytics</Link>}
              {canViewRisks && <Link href="/dashboard/impact-intelligence/risk-flags" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"><ShieldAlert className="h-4 w-4" /> View Risk Flags</Link>}
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { label: "Portfolio impact health", value: formatPercent(portfolioHealth), icon: Gauge, color: "text-cyan-300" },
              { label: "Approved reports", value: reportsSource.available ? formatNumber(approvedReports.length) : UNAVAILABLE, icon: FileCheck2, color: "text-violet-300" },
              { label: "Verified indicators", value: measurementsSource.available ? formatNumber(verifiedMeasurements.length) : UNAVAILABLE, icon: Target, color: "text-emerald-300" },
              { label: "Verified evidence", value: evidenceSource.available ? formatNumber(verifiedEvidence.length) : UNAVAILABLE, icon: ShieldCheck, color: "text-blue-300" },
              { label: "Executive attention", value: knownHealth.length > 0 ? formatNumber(attentionProgrammes.length) : UNAVAILABLE, icon: AlertTriangle, color: "text-amber-300" },
              { label: "Data freshness", value: formatFreshness(freshness), icon: CircleDot, color: "text-teal-300", small: true },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="bg-[#081b3d]/80 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10"><Icon className={cn("h-4 w-4", item.color)} /></span>
                    <div className="min-w-0"><p className={cn("font-bold", item.small ? "text-[11px] leading-4" : "text-lg")}>{item.value}</p><p className="text-[9px] font-medium text-blue-100/65">{item.label}</p></div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] text-blue-100/70">
            <span>Governed portfolio scope · {roleLabel(ctx.role)}</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-bold text-emerald-200">{roleLabel(ctx.role)} · Read only</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
        <MetricCard label="Active Programmes" value={formatNumber(activeProgrammes.length)} icon={Building2} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="MSMEs / Beneficiaries" value={formatNumber(beneficiaryCount)} icon={UsersRound} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Interventions Delivered" value={interventionsSource.available ? formatNumber(interventions.filter((item) => item.status === "completed").length) : UNAVAILABLE} icon={Network} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Approved Assessments" value={assessmentsSource.available ? formatNumber(approvedAssessments.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Reviewed Visits" value={visitsSource.available ? formatNumber(reviewedVisits.length) : UNAVAILABLE} icon={MapPinned} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Verified Evidence" value={evidenceSource.available ? formatNumber(verifiedEvidence.length) : UNAVAILABLE} icon={ShieldCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Verified Indicators" value={measurementsSource.available ? formatNumber(verifiedMeasurements.length) : UNAVAILABLE} icon={Target} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Approved Reports" value={reportsSource.available ? formatNumber(approvedReports.length) : UNAVAILABLE} icon={FileCheck2} tone="bg-sky-100 text-sky-700" />
        <MetricCard label="Open Executive Risks" value={intelligenceSource.available ? formatNumber(openRisks.length) : UNAVAILABLE} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
      </div>

      <Section
        title="Portfolio Health Overview"
        description="Programme performance uses the average progress of verified measurements. Assurance reflects verified evidence, verified outcomes, approved reporting, and open risk signals."
        action={<span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{programmes.length} programmes</span>}
      >
        {programmeViews.length === 0 ? (
          <EmptyState title={scopeEmptyMessage ?? "No programmes available"} description={scopeEmptyMessage ?? "No programme records are available in the current executive scope."} icon={Building2} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {programmeViews.slice(0, 9).map((item, index) => (
              <article key={item.programme.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0c1f46] text-[10px] font-bold text-white">{index + 1}</span>
                    <div className="min-w-0"><h3 className="truncate text-xs font-bold text-[#0c1733]">{item.programme.name}</h3><p className="mt-1 text-[10px] text-slate-500">{item.programme.programme_code ?? "Programme code unavailable"}</p></div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-center">
                  <div><p className="text-sm font-bold text-slate-900">{formatNumber(item.beneficiaries)}</p><p className="text-[9px] text-slate-500">MSMEs</p></div>
                  <div><p className="text-sm font-bold text-slate-900">{formatNumber(item.interventions)}</p><p className="text-[9px] text-slate-500">Interventions</p></div>
                  <div><p className="text-sm font-bold text-slate-900">{formatPercent(item.performance)}</p><p className="text-[9px] text-slate-500">Outcome rate</p></div>
                </div>
                <div className="mt-4 space-y-3">
                  <div><div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500"><span>Evidence confidence</span><span>{formatPercent(item.evidenceConfidence)}</span></div><ProgressBar value={item.evidenceConfidence} /></div>
                  <div><div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500"><span>Outcome confidence</span><span>{formatPercent(item.outcomeConfidence)}</span></div><ProgressBar value={item.outcomeConfidence} tone="bg-blue-500" /></div>
                  <div><div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500"><span>Reporting readiness</span><span>{formatPercent(item.reportingReadiness)}</span></div><ProgressBar value={item.reportingReadiness} tone="bg-violet-500" /></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Section title="Verified Outcomes Centre" description="Latest verified measurements only, with deterministic achievement and underperformance status.">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Strongest verified outcomes</h3>
              <div className="mt-3 space-y-2">
                {!measurementsSource.available ? <UnavailableState message={UNAVAILABLE} /> : strongestOutcomes.length === 0 ? <UnavailableState message="No verified achieved or on-track outcomes are available." /> : strongestOutcomes.map((item, index) => (
                  <article key={item.measurement.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">{index + 1}</span>
                      <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="truncate text-[11px] font-bold text-slate-800">{item.definition.name}</p><span className="text-[11px] font-bold text-emerald-700">{formatPercent(item.measurement.progress_percentage)}</span></div><p className="mt-1 truncate text-[9px] text-slate-500">{item.programmeName} · {displayStatus(item.measurement.outcome_status)}</p></div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Underperforming outcomes</h3>
              <div className="mt-3 space-y-2">
                {!measurementsSource.available ? <UnavailableState message={UNAVAILABLE} /> : underperformingOutcomes.length === 0 ? <UnavailableState message="No verified underperforming outcomes are available." /> : underperformingOutcomes.map((item) => (
                  <article key={item.measurement.id} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-700">{item.measurement.outcome_status === "regressed" ? <TrendingDown className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}</span>
                      <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="truncate text-[11px] font-bold text-slate-800">{item.definition.name}</p><span className="text-[11px] font-bold text-rose-700">{formatPercent(item.measurement.progress_percentage)}</span></div><p className="mt-1 truncate text-[9px] text-slate-500">{item.programmeName} · {displayStatus(item.measurement.outcome_status)}</p></div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Outcome Scorecard" description="Achievement and verified measurement status across the visible portfolio.">
          <div className="grid grid-cols-2 gap-3">
            <article className="rounded-2xl bg-[#0c1f46] p-4 text-white"><Target className="h-5 w-5 text-cyan-300" /><p className="mt-5 text-3xl font-bold">{measurementsSource.available ? formatNumber(verifiedMeasurements.length) : UNAVAILABLE}</p><p className="mt-1 text-[9px] font-bold uppercase text-blue-100">Verified measurements</p></article>
            <article className="rounded-2xl bg-emerald-600 p-4 text-white"><BadgeCheck className="h-5 w-5 text-emerald-100" /><p className="mt-5 text-3xl font-bold">{formatPercent(outcomeAchievement)}</p><p className="mt-1 text-[9px] font-bold uppercase text-emerald-100">Outcome achievement</p></article>
          </div>
          <div className="mt-5"><DistributionBars items={outcomeDistribution} unavailable={!measurementsSource.available} emptyMessage="No verified outcome distribution is available." tone="bg-indigo-500" /></div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Evidence Confidence Centre" description="Verified evidence coverage, checksum assurance, and active-programme evidence gaps.">
          <div className="space-y-4">
            {[
              { label: "Evidence verification rate", value: evidenceSource.available ? ratio(verifiedEvidence.length, evidence.length) : null, detail: "Verified evidence as a share of evidence visible under the current role policy.", icon: ShieldCheck, tone: "bg-emerald-500" },
              { label: "Evidence coverage", value: evidenceCoverage, detail: "Active programmes with at least one verified evidence record.", icon: BadgeCheck, tone: "bg-blue-500" },
              { label: "Checksum-backed evidence", value: checksumCoverage, detail: "Verified evidence records with a stored SHA-256 checksum.", icon: FileCheck2, tone: "bg-cyan-500" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white", item.tone)}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="text-xs font-bold text-slate-700">{item.label}</p><span className="text-sm font-bold text-[#0c1733]">{formatPercent(item.value)}</span></div><ProgressBar value={item.value} tone={item.tone} /><p className="mt-2 text-[9px] leading-4 text-slate-500">{item.detail}</p></div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-2xl font-bold text-amber-800">{formatNumber(evidenceGapProgrammes)}</p><p className="mt-1 text-[10px] font-bold uppercase text-amber-700">Active programme evidence gaps</p></div>
        </Section>

        <Section title="Geographic Impact View" description="State and regional reach from programme-linked cohort geography. Missing geography remains unavailable.">
          {!cohortsSource.available || stateReach.size === 0 ? (
            <EmptyState title="Geographic impact unavailable" description="No programme-linked cohort geography is available in the current scope." icon={MapPinned} />
          ) : (
            <div className="grid gap-5 md:grid-cols-[.7fr_1.3fr]">
              <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 p-5">
                <Globe2 className="h-28 w-28 text-blue-100" />
                <div className="absolute inset-x-4 bottom-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/90 p-3 text-center shadow-sm"><p className="text-xl font-bold text-[#0c1733]">{stateReach.size}</p><p className="text-[9px] text-slate-500">States covered</p></div>
                  <div className="rounded-xl bg-white/90 p-3 text-center shadow-sm"><p className="text-xl font-bold text-[#0c1733]">{regionReach.size}</p><p className="text-[9px] text-slate-500">Regions</p></div>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><h3 className="mb-4 text-xs font-bold text-slate-800">Top locations by reach</h3><DistributionBars items={topStates} emptyMessage="Location reach unavailable." tone="bg-emerald-500" /></div>
                <div><h3 className="mb-4 text-xs font-bold text-slate-800">Regional distribution</h3><DistributionBars items={regions} emptyMessage="Regional distribution unavailable." tone="bg-blue-500" /></div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section title="Executive Risk & Attention Centre" description="Observed risk flags and governed workflow gaps requiring executive attention.">
        <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {[
              { label: "High severity risks", value: intelligenceSource.available ? highRisks.length : null, icon: ShieldAlert, tone: "bg-rose-100 text-rose-700" },
              { label: "Reports awaiting approval", value: reportsAwaitingApproval, icon: FileClock, tone: "bg-blue-100 text-blue-700" },
              { label: "Missing evidence blockers", value: evidenceGapProgrammes, icon: FileWarning, tone: "bg-amber-100 text-amber-700" },
              { label: "Indicator gaps", value: indicatorGapProgrammes, icon: Target, tone: "bg-violet-100 text-violet-700" },
              { label: "Monitoring review gaps", value: monitoringReviewGaps, icon: MapPinned, tone: "bg-cyan-100 text-cyan-700" },
            ].map((item) => {
              const Icon = item.icon;
              return <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"><span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span><p className="mt-4 text-2xl font-bold text-[#0c1733]">{formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p></article>;
            })}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><h3 className="mb-4 text-xs font-bold text-slate-800">Risk severity</h3><DistributionBars items={riskSeverity} unavailable={!intelligenceSource.available} emptyMessage="No open risk flags are available." tone="bg-rose-500" /></div>
            <div>
              <h3 className="mb-4 text-xs font-bold text-slate-800">Programmes requiring attention</h3>
              <div className="space-y-2">
                {attentionProgrammes.length === 0 ? <UnavailableState message={knownHealth.length > 0 ? "No executive attention signals are present." : UNAVAILABLE} /> : attentionProgrammes.slice(0, 6).map((item) => (
                  <div key={item.programme.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"><p className="truncate text-[11px] font-bold text-slate-700">{item.programme.name}</p><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Reports for Executive Review"
        description="Approved reports, permitted approval queues, export readiness, and latest immutable versions."
        action={canViewReports ? <Link href="/dashboard/impact-intelligence/reports" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700">Open all reports <ArrowRight className="h-3.5 w-3.5" /></Link> : null}
      >
        {!reportsSource.available ? <UnavailableState message={UNAVAILABLE} /> : reports.length === 0 ? <UnavailableState message="No reports are available in the current approved and programme scope." /> : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              {latestReports.map((report) => (
                <Link key={report.id} href={`/dashboard/impact-intelligence/reports/${report.id}`} className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><FileCheck2 className="h-5 w-5" /></span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200">Approved</span></div>
                  <h3 className="mt-4 line-clamp-2 text-sm font-bold leading-5 text-[#0c1733]">{report.title}</h3>
                  <p className="mt-1 truncate text-[10px] text-slate-500">{report.impact_programmes?.name ?? UNAVAILABLE}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-[9px]">
                    <div className="rounded-lg bg-white p-2 ring-1 ring-slate-100"><p className="text-slate-400">Version</p><p className="mt-1 font-bold text-slate-700">{report.latest_version ? `v${report.latest_version.version_number}` : UNAVAILABLE}</p></div>
                    <div className="rounded-lg bg-white p-2 ring-1 ring-slate-100"><p className="text-slate-400">Export</p><p className="mt-1 font-bold text-slate-700">{generatedExportReportIds.has(report.id) ? "Generated" : exportReadyReports.some((item) => item.id === report.id) ? "Ready" : UNAVAILABLE}</p></div>
                    <div className="rounded-lg bg-white p-2 ring-1 ring-slate-100"><p className="text-slate-400">Approved</p><p className="mt-1 font-bold text-slate-700">{formatDate(report.approved_at)}</p></div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 content-start">
              {[
                { label: "Approved reports", value: approvedReports.length, icon: BadgeCheck, tone: "bg-emerald-100 text-emerald-700" },
                { label: "Awaiting approval", value: reportsAwaitingApproval, icon: FileClock, tone: "bg-blue-100 text-blue-700" },
                { label: "Export ready", value: exportReadyReports.length, icon: Download, tone: "bg-violet-100 text-violet-700" },
                { label: "Generated exports", value: exportsSource.available ? generatedExportReportIds.size : null, icon: FileCheck2, tone: "bg-cyan-100 text-cyan-700" },
              ].map((item) => {
                const Icon = item.icon;
                return <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"><span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span><p className="mt-5 text-2xl font-bold text-[#0c1733]">{formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p></article>;
              })}
            </div>
          </div>
        )}
      </Section>

      <Section title="Strategic Insight Cards" description="Deterministic statements generated only from visible approved, verified, and scoped records.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Strongest programme", title: strongestProgramme?.programme.name ?? UNAVAILABLE, detail: strongestProgramme ? `${formatPercent(strongestProgramme.performance)} average verified progress` : "No comparable verified programme progress is available.", icon: TrendingUp, tone: "bg-emerald-100 text-emerald-700" },
            { label: "Highest risk programme", title: highestRiskProgramme?.programme.name ?? UNAVAILABLE, detail: highestRiskProgramme ? `${formatNumber(highestRiskProgramme.openRisks)} open risks · ${highestRiskProgramme.riskLevel}` : "No open programme risk is available.", icon: ShieldAlert, tone: "bg-rose-100 text-rose-700" },
            { label: "Strongest verified outcome", title: strongestOutcomes[0]?.definition.name ?? UNAVAILABLE, detail: strongestOutcomes[0] ? `${formatPercent(strongestOutcomes[0].measurement.progress_percentage)} · ${strongestOutcomes[0].programmeName}` : "No verified achieved or on-track outcome is available.", icon: Target, tone: "bg-indigo-100 text-indigo-700" },
            { label: "Weakest evidence coverage", title: weakestEvidenceProgramme?.programme.name ?? UNAVAILABLE, detail: weakestEvidenceProgramme ? `${formatPercent(weakestEvidenceProgramme.evidenceConfidence)} verified evidence coverage` : "No comparable evidence coverage is available.", icon: FileWarning, tone: "bg-amber-100 text-amber-700" },
            { label: "Reporting bottleneck", title: reportingBottleneck, detail: "Derived from permitted report approval, evidence, and outcome coverage states.", icon: FileClock, tone: "bg-blue-100 text-blue-700" },
          ].map((item) => {
            const Icon = item.icon;
            return <article key={item.label} className="rounded-2xl border border-slate-200 p-4"><span className={cn("grid h-10 w-10 place-items-center rounded-xl", item.tone)}><Icon className="h-5 w-5" /></span><p className="mt-4 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">{item.label}</p><h3 className="mt-2 text-sm font-bold leading-5 text-[#0c1733]">{item.title}</h3><p className="mt-2 text-[10px] leading-4 text-slate-500">{item.detail}</p></article>;
          })}
        </div>
      </Section>

      <Section title="Executive Health Matrix" description="Board-level scan of programme assurance, reporting readiness, risk, and executive status.">
        {programmeViews.length === 0 ? <UnavailableState message="No programme health rows are available." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead><tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500"><th className="px-3 py-3">Programme</th><th className="px-3 py-3">Evidence Confidence</th><th className="px-3 py-3">Outcome Confidence</th><th className="px-3 py-3">Reporting Readiness</th><th className="px-3 py-3">Risk Level</th><th className="px-3 py-3">Executive Status</th></tr></thead>
              <tbody>
                {programmeViews.map((item) => (
                  <tr key={item.programme.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-3 py-3 font-semibold text-slate-900">{canAccessRoute(ctx.role, "/dashboard/impact-intelligence/programmes") ? <Link href={`/dashboard/impact-intelligence/programmes/${item.programme.id}`} className="hover:text-blue-700">{item.programme.name}</Link> : item.programme.name}</td>
                    <td className="px-3 py-3"><ProgressBar value={item.evidenceConfidence} /></td>
                    <td className="px-3 py-3"><ProgressBar value={item.outcomeConfidence} tone="bg-blue-500" /></td>
                    <td className="px-3 py-3"><ProgressBar value={item.reportingReadiness} tone="bg-violet-500" /></td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", riskTone(item.riskLevel))}>{item.riskLevel}</span></td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#06132d_0%,#0c2857_60%,#10366e_100%)] p-5 text-white shadow-2xl shadow-blue-950/15 sm:p-7">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Executive summary</p><h2 className="mt-3 text-2xl font-bold">Decision confidence across the BOI impact portfolio</h2><p className="mt-2 max-w-2xl text-sm text-blue-100/75">Scores reflect only available governed sources. Missing sources remain unavailable.</p></div>
            <Radar className="h-10 w-10 text-cyan-300" />
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Portfolio Health", value: portfolioHealth, icon: Gauge, color: "text-cyan-300" },
              { label: "Evidence Assurance", value: evidenceConfidence, icon: ShieldCheck, color: "text-emerald-300" },
              { label: "Outcome Assurance", value: outcomeConfidence, icon: Target, color: "text-violet-300" },
              { label: "Reporting Readiness", value: reportingReadiness, icon: FileCheck2, color: "text-blue-300" },
              { label: "Recommended Executive Attention", value: knownHealth.length > 0 ? attentionProgrammes.length : null, icon: AlertTriangle, color: "text-amber-300", number: true },
            ].map((item) => {
              const Icon = item.icon;
              return <article key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"><Icon className={cn("h-5 w-5", item.color)} /><p className="mt-5 text-2xl font-bold">{item.number ? formatNumber(item.value) : formatPercent(item.value)}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-blue-100/65">{item.label}</p></article>;
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <p className="text-xs text-blue-100/70">Scope: {roleLabel(ctx.role)} · Last visible source update: {formatFreshness(freshness)}</p>
            {canViewReports && <Link href="/dashboard/impact-intelligence/reports" className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300 hover:text-emerald-200">Open approved reports <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </div>
        </div>
      </section>
    </section>
  );
}
