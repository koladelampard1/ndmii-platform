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
  Gauge,
  Layers3,
  MapPinned,
  Network,
  Plus,
  ShieldCheck,
  Target,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  listImpactAssessments,
  listImpactCohorts,
  listImpactFieldVisits,
  listImpactInterventions,
  listImpactReports,
  type ImpactBeneficiaryCohort,
} from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import { listIndicatorMeasurements, type ImpactIndicatorMeasurement } from "@/lib/data/impact-indicators";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/cohorts";
const UNAVAILABLE = "Unavailable";

type SourceState<T> = {
  data: T;
  available: boolean;
};

type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

type CohortPortfolioItem = {
  cohort: ImpactBeneficiaryCohort;
  beneficiaries: number;
  activeBeneficiaries: number;
  completedBeneficiaries: number;
  droppedBeneficiaries: number;
  interventions: number | null;
  assessments: number | null;
  visits: number | null;
  evidenceReadiness: number | null;
  indicatorReadiness: number | null;
  reportReadiness: number | null;
  assessmentCoverage: number | null;
  monitoringCoverage: number | null;
  health: HealthState;
  attentionReasons: string[];
};

function sourceFallback<T>(data: T): SourceState<T> {
  return { data, available: false };
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

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function cohortIdFromReport(report: { metadata?: Record<string, unknown> | null }) {
  const value = report.metadata?.cohort_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function healthTone(health: HealthState) {
  if (health === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (health === "Watchlist") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (health === "At Risk") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function statusTone(status: string | null) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "recruiting") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "completed") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (status === "closed") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function deriveHealth(input: {
  sourceAvailable: boolean;
  beneficiaries: number;
  dropped: number;
  evidenceReadiness: number | null;
  indicatorReadiness: number | null;
  assessmentCoverage: number | null;
  monitoringCoverage: number | null;
}) {
  if (!input.sourceAvailable) {
    return { health: "Unavailable" as const, attentionReasons: [] };
  }

  const reasons: string[] = [];
  if (input.dropped > 0) reasons.push(`${input.dropped} dropped beneficiar${input.dropped === 1 ? "y" : "ies"}`);
  if (input.beneficiaries > 0 && input.evidenceReadiness === null) reasons.push("No linked evidence");
  else if (input.evidenceReadiness !== null && input.evidenceReadiness < 80) reasons.push(`Evidence readiness ${input.evidenceReadiness}%`);
  if (input.beneficiaries > 0 && input.indicatorReadiness === null) reasons.push("No linked indicators");
  else if (input.indicatorReadiness !== null && input.indicatorReadiness < 80) reasons.push(`Indicator readiness ${input.indicatorReadiness}%`);
  if (input.beneficiaries > 0 && input.assessmentCoverage === null) reasons.push("No beneficiary assessments");
  else if (input.assessmentCoverage !== null && input.assessmentCoverage < 60) reasons.push(`Assessment coverage ${input.assessmentCoverage}%`);
  if (input.beneficiaries > 0 && input.monitoringCoverage === null) reasons.push("No beneficiary monitoring");
  else if (input.monitoringCoverage !== null && input.monitoringCoverage < 60) reasons.push(`Monitoring coverage ${input.monitoringCoverage}%`);

  const severe = input.dropped > 0
    || [input.evidenceReadiness, input.indicatorReadiness, input.assessmentCoverage, input.monitoringCoverage]
      .some((value) => value !== null && value < 40);
  if (severe) return { health: "At Risk" as const, attentionReasons: reasons };
  if (reasons.length > 0) return { health: "Watchlist" as const, attentionReasons: reasons };

  const knownReadiness = [
    input.evidenceReadiness,
    input.indicatorReadiness,
    input.assessmentCoverage,
    input.monitoringCoverage,
  ].filter((value): value is number => value !== null);
  if (knownReadiness.length === 0 && input.beneficiaries === 0) {
    return { health: "Unavailable" as const, attentionReasons: [] };
  }
  return { health: "Healthy" as const, attentionReasons: [] };
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
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
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
  if (value === null) return <span className="text-[11px] font-semibold text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div className="min-w-[84px]">
      <span className="text-[11px] font-bold text-slate-700">{value}%</span>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function DistributionBars({
  items,
  emptyText,
  tone,
}: {
  items: Array<{ label: string; value: number }>;
  emptyText: string;
  tone: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
        <MapPinned className="mx-auto h-5 w-5 text-slate-300" />
        <p className="mt-3 text-xs font-semibold text-slate-600">{emptyText}</p>
      </div>
    );
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {items.slice(0, 6).map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-slate-700">{item.label}</span>
            <span className="font-bold text-slate-900">{item.value.toLocaleString("en-NG")}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(7, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ImpactCohortsPage() {
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let cohortsSource = sourceFallback<ImpactBeneficiaryCohort[]>([]);

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    cohortsSource = await loadSource(currentContext, "cohort_portfolio_cohorts_load_failed", () => listImpactCohorts(currentContext, { limit: 500 }), []);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "cohort_portfolio_context_load_failed", error });
  }

  if (!ctx || !cohortsSource.available) {
    return (
      <section className="space-y-6">
        <Section title="Cohort Portfolio Unavailable">
          <EmptyState
            title="Cohort portfolio could not load"
            description="The cohort source, current session, or role assignment is temporarily unavailable. No portfolio metrics are being inferred."
            icon={UsersRound}
          />
        </Section>
      </section>
    );
  }

  const cohorts = cohortsSource.data;
  const cohortIds = new Set(cohorts.map((cohort) => cohort.id));
  const canReadInterventions = canRole(ctx.role, "intervention", "read");
  const canReadAssessments = canRole(ctx.role, "assessment", "read");
  const canReadMonitoring = canRole(ctx.role, "monitoring_visit", "read");
  const canReadEvidence = canRole(ctx.role, "evidence", "read");
  const canReadIndicators = canRole(ctx.role, "indicator", "read");
  const canReadReports = canRole(ctx.role, "report", "read");

  const [interventionsSource, assessmentsSource, visitsSource, evidenceSource, indicatorsSource, reportsSource] = await Promise.all([
    canReadInterventions
      ? loadSource(ctx, "cohort_portfolio_interventions_load_failed", () => listImpactInterventions(ctx, { limit: 2000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadAssessments
      ? loadSource(ctx, "cohort_portfolio_assessments_load_failed", () => listImpactAssessments(ctx, { limit: 2000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadMonitoring
      ? loadSource(ctx, "cohort_portfolio_monitoring_load_failed", () => listImpactFieldVisits(ctx, { limit: 2000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadEvidence
      ? loadSource(ctx, "cohort_portfolio_evidence_load_failed", () => listImpactEvidence(ctx, { limit: 2000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadIndicators
      ? loadSource(ctx, "cohort_portfolio_indicators_load_failed", () => listIndicatorMeasurements(ctx, { limit: 2000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadReports
      ? loadSource(ctx, "cohort_portfolio_reports_load_failed", () => listImpactReports(ctx, { limit: 2000 }), [])
      : Promise.resolve(sourceFallback([])),
  ]);

  const interventions = interventionsSource.data.filter((item) => item.cohort_id && cohortIds.has(item.cohort_id));
  const assessments = assessmentsSource.data.filter((item) => item.cohort_id && cohortIds.has(item.cohort_id));
  const visits = visitsSource.data.filter((item) => item.cohort_id && cohortIds.has(item.cohort_id));
  const evidence = evidenceSource.data.filter((item) => item.cohort_id && cohortIds.has(item.cohort_id));
  const indicators = indicatorsSource.data.filter((item) => item.cohort_id && cohortIds.has(item.cohort_id));
  const reports = reportsSource.data.filter((item) => {
    const cohortId = cohortIdFromReport(item);
    return cohortId ? cohortIds.has(cohortId) : false;
  });

  const portfolio: CohortPortfolioItem[] = cohorts.map((cohort) => {
    const cohortInterventions = interventions.filter((item) => item.cohort_id === cohort.id);
    const cohortAssessments = assessments.filter((item) => item.cohort_id === cohort.id);
    const cohortVisits = visits.filter((item) => item.cohort_id === cohort.id);
    const cohortEvidence = evidence.filter((item) => item.cohort_id === cohort.id);
    const cohortIndicators = indicators.filter((item) => item.cohort_id === cohort.id);
    const cohortReports = reports.filter((item) => cohortIdFromReport(item) === cohort.id);
    const beneficiaries = cohort.member_count ?? cohort.current_beneficiaries ?? 0;
    const verifiedEvidence = cohortEvidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length;
    const verifiedIndicators = cohortIndicators.filter((item) => item.verification_status === "verified").length;
    const approvedReports = cohortReports.filter((item) => item.status === "approved").length;
    const assessedMembers = new Set(cohortAssessments.map((item) => item.cohort_member_id).filter(Boolean)).size;
    const monitoredMembers = new Set(cohortVisits.map((item) => item.cohort_member_id).filter(Boolean)).size;
    const evidenceReadiness = evidenceSource.available ? ratio(verifiedEvidence, cohortEvidence.length) : null;
    const indicatorReadiness = indicatorsSource.available ? ratio(verifiedIndicators, cohortIndicators.length) : null;
    const reportReadiness = reportsSource.available ? ratio(approvedReports, cohortReports.length) : null;
    const assessmentCoverage = assessmentsSource.available ? ratio(assessedMembers, beneficiaries) : null;
    const monitoringCoverage = visitsSource.available ? ratio(monitoredMembers, beneficiaries) : null;
    const health = deriveHealth({
      sourceAvailable: assessmentsSource.available && visitsSource.available && evidenceSource.available && indicatorsSource.available,
      beneficiaries,
      dropped: cohort.dropped_count ?? 0,
      evidenceReadiness,
      indicatorReadiness,
      assessmentCoverage,
      monitoringCoverage,
    });

    return {
      cohort,
      beneficiaries,
      activeBeneficiaries: cohort.active_count ?? 0,
      completedBeneficiaries: cohort.completed_count ?? 0,
      droppedBeneficiaries: cohort.dropped_count ?? 0,
      interventions: interventionsSource.available ? cohortInterventions.length : null,
      assessments: assessmentsSource.available ? cohortAssessments.length : null,
      visits: visitsSource.available ? cohortVisits.length : null,
      evidenceReadiness,
      indicatorReadiness,
      reportReadiness,
      assessmentCoverage,
      monitoringCoverage,
      ...health,
    };
  });

  const totalBeneficiaries = portfolio.reduce((sum, item) => sum + item.beneficiaries, 0);
  const completedBeneficiaries = portfolio.reduce((sum, item) => sum + item.completedBeneficiaries, 0);
  const activeCohorts = cohorts.filter((cohort) => cohort.status === "active").length;
  const completionRate = ratio(completedBeneficiaries, totalBeneficiaries);
  const healthKnown = portfolio.filter((item) => item.health !== "Unavailable");
  const attentionCohorts = portfolio.filter((item) => ["Watchlist", "At Risk"].includes(item.health));
  const activeInterventions = interventionsSource.available
    ? interventions.filter((item) => item.status === "active").length
    : null;
  const approvedAssessments = assessmentsSource.available
    ? assessments.filter((item) => item.status === "approved").length
    : null;
  const reviewedVisits = visitsSource.available
    ? visits.filter((item) => item.status === "reviewed").length
    : null;
  const verifiedEvidence = evidenceSource.available
    ? evidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length
    : null;
  const verifiedIndicators = indicatorsSource.available
    ? indicators.filter((item) => item.verification_status === "verified").length
    : null;
  const freshness = latestDate([
    ...cohorts.map((item) => item.updated_at ?? item.created_at),
    ...interventions.map((item) => item.updated_at ?? item.created_at),
    ...assessments.map((item) => item.created_at),
    ...visits.map((item) => item.reviewed_at ?? item.completed_at ?? item.created_at),
    ...evidence.map((item) => item.reviewed_at ?? item.created_at),
    ...indicators.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...reports.map((item) => item.approved_at ?? item.created_at),
  ]);

  const intervenedMembers = interventionsSource.available
    ? new Set(interventions.map((item) => item.cohort_member_id).filter(Boolean)).size
    : null;
  const assessedMembers = assessmentsSource.available
    ? new Set(assessments.map((item) => item.cohort_member_id).filter(Boolean)).size
    : null;
  const monitoredMembers = visitsSource.available
    ? new Set(visits.map((item) => item.cohort_member_id).filter(Boolean)).size
    : null;
  const evidenceVerifiedMembers = evidenceSource.available
    ? new Set(evidence.filter((item) => item.status === "verified" && item.verification_status === "verified").map((item) => item.cohort_member_id).filter(Boolean)).size
    : null;
  const indicatorVerifiedMembers = indicatorsSource.available
    ? new Set(indicators.filter((item) => item.verification_status === "verified").map((item) => item.cohort_member_id).filter(Boolean)).size
    : null;
  const reportReadyCohorts = reportsSource.available
    ? new Set(reports.filter((item) => item.status === "approved").map(cohortIdFromReport).filter(Boolean)).size
    : null;

  const funnel = [
    { label: "Registered", value: totalBeneficiaries, detail: "Cohort member records", color: "bg-slate-500" },
    { label: "Enrolled", value: totalBeneficiaries, detail: "Loaded cohort enrolments", color: "bg-blue-500" },
    { label: "Active", value: portfolio.reduce((sum, item) => sum + item.activeBeneficiaries, 0), detail: "Active member status", color: "bg-cyan-500" },
    { label: "Intervened", value: intervenedMembers, detail: "Unique linked beneficiaries", color: "bg-violet-500" },
    { label: "Assessed", value: assessedMembers, detail: "Unique linked beneficiaries", color: "bg-amber-500" },
    { label: "Monitored", value: monitoredMembers, detail: "Unique linked beneficiaries", color: "bg-orange-500" },
    { label: "Evidence Verified", value: evidenceVerifiedMembers, detail: "Unique linked beneficiaries", color: "bg-emerald-500" },
    { label: "Indicator Verified", value: indicatorVerifiedMembers, detail: "Unique linked beneficiaries", color: "bg-teal-500" },
    { label: "Report Ready", value: reportReadyCohorts, detail: "Cohorts with approved linked reports", color: "bg-indigo-500" },
  ];

  const stateDistribution = Array.from(
    portfolio.reduce((map, item) => {
      const label = item.cohort.state?.trim();
      if (label) map.set(label, (map.get(label) ?? 0) + item.beneficiaries);
      return map;
    }, new Map<string, number>()),
  ).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const sectorDistribution = Array.from(
    portfolio.reduce((map, item) => {
      const label = item.cohort.sector?.trim();
      if (label) map.set(label, (map.get(label) ?? 0) + item.beneficiaries);
      return map;
    }, new Map<string, number>()),
  ).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const recentActivity = [
    ...interventions
      .filter((item) => item.created_at)
      .map((item) => ({ type: "Intervention created", title: item.title, createdAt: item.created_at, href: `/dashboard/impact-intelligence/interventions/${item.id}`, icon: Network })),
    ...assessments
      .filter((item) => item.status === "approved" && item.created_at)
      .map((item) => ({ type: "Assessment approved", title: item.title ?? "Assessment", createdAt: item.created_at, href: `/dashboard/impact-intelligence/assessments/${item.id}`, icon: ClipboardCheck })),
    ...visits
      .filter((item) => item.status === "reviewed" && (item.reviewed_at ?? item.created_at))
      .map((item) => ({ type: "Monitoring reviewed", title: item.title ?? "Field visit", createdAt: item.reviewed_at ?? item.created_at, href: `/dashboard/impact-intelligence/monitoring/${item.id}`, icon: CheckCircle2 })),
    ...evidence
      .filter((item) => item.status === "verified" && item.verification_status === "verified" && (item.reviewed_at ?? item.created_at))
      .map((item: ImpactEvidenceRecord) => ({ type: "Evidence verified", title: item.original_filename ?? item.file_name, createdAt: item.reviewed_at ?? item.created_at, href: `/dashboard/impact-intelligence/evidence/${item.id}`, icon: ShieldCheck })),
    ...indicators
      .filter((item) => item.verification_status === "verified" && (item.verified_at ?? item.created_at))
      .map((item: ImpactIndicatorMeasurement) => ({ type: "Indicator verified", title: item.impact_indicator_definitions?.name ?? "Indicator measurement", createdAt: item.verified_at ?? item.created_at, href: "/dashboard/impact-intelligence/indicators", icon: Target })),
  ]
    .filter((item) => item.createdAt && canAccessRoute(ctx.role, item.href))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6);

  const canCreate = canRole(ctx.role, "cohort", "create")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/cohorts/new");
  const canExport = canRole(ctx.role, "export", "export")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canOpenCohort = canAccessRoute(ctx.role, ROUTE);
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Cohorts</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Cohort Portfolio Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Beneficiary readiness, delivery coverage, verification, and cohort health across the current governed scope.
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
              {canCreate && (
                <Link href="/dashboard/impact-intelligence/cohorts/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#132d60]">
                  <Plus className="h-4 w-4" /> New Cohort
                </Link>
              )}
              <details className="relative">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-xl">
                  <p className="font-bold text-slate-900">Current cohort scope</p>
                  <p className="mt-2 leading-5">Showing records permitted for {roleLabel(ctx.role)}. Programme assignment and delegated field scope rules are already applied.</p>
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

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_30%,rgba(37,99,235,0.42),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="cohort-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#60a5fa" /></pattern></defs>
            <path d="M500 35 610 20l75 35 72 10 50 58-42 48 12 56-97 18-64-35-78 15-46-65 22-55Z" fill="url(#cohort-hero-dots)" stroke="#38bdf8" strokeOpacity=".4" />
            <path d="M460 230c70-50 115-112 177-82s91 6 150-68" fill="none" stroke="#38bdf8" strokeOpacity=".55" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Cohort portfolio overview</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">From enrolment to verified beneficiary readiness</h2>
              <p className="mt-2 text-sm text-blue-100/80">Scoped cohort records. Real delivery signals. No inferred source values.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total cohorts", value: formatNumber(cohorts.length), icon: Layers3, color: "text-cyan-300" },
              { label: "Active cohorts", value: formatNumber(activeCohorts), icon: Activity, color: "text-emerald-300" },
              { label: "Beneficiaries reached", value: formatNumber(totalBeneficiaries), icon: UsersRound, color: "text-violet-300" },
              { label: "Completion readiness", value: formatPercent(completionRate), icon: Gauge, color: "text-amber-300" },
              { label: "Require attention", value: healthKnown.length > 0 ? formatNumber(attentionCohorts.length) : UNAVAILABLE, icon: AlertTriangle, color: "text-rose-300" },
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
        <MetricCard label="Total Cohorts" value={formatNumber(cohorts.length)} icon={Layers3} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Active Cohorts" value={formatNumber(activeCohorts)} icon={Activity} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Beneficiaries" value={formatNumber(totalBeneficiaries)} icon={UsersRound} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Completed Beneficiaries" value={formatNumber(completedBeneficiaries)} icon={CheckCircle2} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Active Interventions" value={formatNumber(activeInterventions)} icon={Network} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Approved Assessments" value={formatNumber(approvedAssessments)} icon={ClipboardCheck} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Reviewed Visits" value={formatNumber(reviewedVisits)} icon={FileCheck2} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Verified Evidence" value={formatNumber(verifiedEvidence)} icon={ShieldCheck} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Verified Indicators" value={formatNumber(verifiedIndicators)} icon={Target} tone="bg-purple-100 text-purple-700" />
      </div>

      <Section
        title="Cohort Performance"
        description="Beneficiary status, delivery volume, and verification readiness for every cohort in the current scope."
        action={<span className="text-xs font-semibold text-slate-500">{cohorts.length} cohort{cohorts.length === 1 ? "" : "s"}</span>}
      >
        {cohorts.length === 0 ? (
          <EmptyState
            title={scopeEmptyMessage ?? (ctx.role === "field_officer" ? "No assigned cohort context" : "No cohorts available")}
            description={scopeEmptyMessage ?? (ctx.role === "field_officer" ? "Only cohorts linked to beneficiaries assigned under the existing field policy appear here." : "No cohort records are available in the current scope.")}
            actionHref={canCreate ? "/dashboard/impact-intelligence/cohorts/new" : undefined}
            actionLabel={canCreate ? "Create cohort" : undefined}
            icon={UsersRound}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {portfolio.map((item) => {
              const content = (
                <article className="group h-full rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1", statusTone(item.cohort.status))}>{item.cohort.status}</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-[#0c1733] group-hover:text-blue-700">{item.cohort.name}</h3>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{item.cohort.impact_programmes?.name ?? "Programme unavailable"}</p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700">
                      <UsersRound className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-xs">
                    <div><p className="text-[10px] text-slate-500">Beneficiaries</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.beneficiaries)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Interventions</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.interventions)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Active / completed</p><p className="mt-1 font-bold text-slate-900">{item.activeBeneficiaries} / {item.completedBeneficiaries}</p></div>
                    <div><p className="text-[10px] text-slate-500">Dropped</p><p className="mt-1 font-bold text-slate-900">{item.droppedBeneficiaries}</p></div>
                    <div><p className="text-[10px] text-slate-500">Assessments</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.assessments)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Monitoring visits</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.visits)}</p></div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Evidence readiness</span><ProgressValue value={item.evidenceReadiness} /></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Indicator readiness</span><ProgressValue value={item.indicatorReadiness} tone="bg-blue-500" /></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Report readiness</span><ProgressValue value={item.reportReadiness} tone="bg-violet-500" /></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-medium text-slate-500">{[item.cohort.state, item.cohort.sector].filter(Boolean).join(" · ") || "Distribution unavailable"}</span>
                    {canOpenCohort && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">View cohort <ArrowRight className="h-3 w-3" /></span>}
                  </div>
                </article>
              );
              return canOpenCohort
                ? <Link key={item.cohort.id} href={`/dashboard/impact-intelligence/cohorts/${item.cohort.id}`}>{content}</Link>
                : <div key={item.cohort.id}>{content}</div>;
            })}
          </div>
        )}
      </Section>

      <Section title="Beneficiary Readiness Funnel" description="Unique cohort-linked beneficiaries at each loaded delivery stage. Report readiness is cohort-level because reports do not expose a beneficiary anchor.">
        <div className="grid gap-2 lg:grid-cols-9">
          {funnel.map((item, index) => (
            <article key={item.label} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className={cn("absolute inset-x-0 top-0 h-1", item.color)} />
              <p className="mt-1 text-lg font-bold text-[#0c1733]">{formatNumber(item.value)}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-700">{item.label}</p>
              <p className="mt-1 text-[9px] leading-4 text-slate-400">{item.detail}</p>
              {index < funnel.length - 1 && <ArrowRight className="absolute right-1 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-slate-300 lg:block" />}
            </article>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Section title="Cohort Health Matrix" description="Executive comparison of delivery coverage and verified readiness.">
          {portfolio.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No cohort health rows are available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-3 py-3">Cohort</th><th className="px-3 py-3">Programme</th><th className="px-3 py-3">Beneficiaries</th><th className="px-3 py-3">Interventions</th><th className="px-3 py-3">Assessments</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Indicators</th><th className="px-3 py-3">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((item) => (
                    <tr key={item.cohort.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-3 py-3 font-semibold text-slate-900">{canOpenCohort ? <Link href={`/dashboard/impact-intelligence/cohorts/${item.cohort.id}`} className="hover:text-blue-700">{item.cohort.name}</Link> : item.cohort.name}</td>
                      <td className="px-3 py-3 text-slate-600">{item.cohort.impact_programmes?.name ?? UNAVAILABLE}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(item.beneficiaries)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(item.interventions)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(item.assessments)}</td>
                      <td className="px-3 py-3"><ProgressValue value={item.evidenceReadiness} /></td>
                      <td className="px-3 py-3"><ProgressValue value={item.indicatorReadiness} tone="bg-blue-500" /></td>
                      <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Cohorts Requiring Attention" description="Signals derived only from loaded readiness, coverage, monitoring, and beneficiary status.">
          {healthKnown.length === 0 ? (
            <EmptyState title="Attention signals unavailable" description="Required cohort readiness sources are unavailable for this role or could not be loaded. No issues are being inferred." icon={AlertTriangle} />
          ) : attentionCohorts.length === 0 ? (
            <EmptyState title="No loaded cohorts require attention" description="No low readiness, low coverage, incomplete monitoring, or dropped-beneficiary signals were found in loaded data." icon={CheckCircle2} />
          ) : (
            <div className="space-y-3">
              {attentionCohorts.slice(0, 6).map((item) => (
                <article key={item.cohort.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", item.health === "At Risk" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")}><AlertTriangle className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-bold text-slate-900">{item.cohort.name}</h3><span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.attentionReasons.slice(0, 2).join(" · ") || "Attention required"}</p>
                      {canOpenCohort && <Link href={`/dashboard/impact-intelligence/cohorts/${item.cohort.id}`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">View cohort <ArrowRight className="h-3 w-3" /></Link>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="State Distribution" description="Beneficiary reach derived from cohort state labels.">
          <DistributionBars items={stateDistribution} emptyText="No cohort state distribution is available." tone="bg-emerald-500" />
        </Section>
        <Section title="Sector Distribution" description="Beneficiary reach derived from cohort sector labels.">
          <DistributionBars items={sectorDistribution} emptyText="No cohort sector distribution is available." tone="bg-blue-500" />
        </Section>
      </div>

      <Section title="Recent Cohort Activity" description="Latest qualifying cohort-linked records available to the current role." action={<Activity className="h-4 w-4 text-slate-400" />}>
        {recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No recent cohort activity is available.</p>
        ) : (
          <div className="relative grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div className="absolute left-[8%] right-[8%] top-5 hidden border-t border-dashed border-slate-300 xl:block" aria-hidden="true" />
            {recentActivity.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={`${item.type}-${item.href}-${item.createdAt}`} href={item.href} className="relative rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-200 hover:bg-blue-50/30">
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
        <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
        <span>Metrics use only records available within the current role, programme assignment, and delegated field scope.</span>
        <span className="text-slate-300">•</span>
        <UserMinus className="h-3.5 w-3.5 text-rose-500" />
        <span>Missing sources remain unavailable and are not estimated.</span>
      </div>
    </section>
  );
}
