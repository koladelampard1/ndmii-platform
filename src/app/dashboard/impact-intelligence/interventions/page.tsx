import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  Filter,
  Gauge,
  HandCoins,
  Network,
  PauseCircle,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  createImpactIntervention,
  getInterventionStage,
  INTERVENTION_STAGES,
  INTERVENTION_STATUSES,
  listImpactAssessments,
  listImpactCohortMemberOptions,
  listImpactCohorts,
  listImpactFieldVisits,
  listImpactInterventions,
  listImpactProgrammes,
  listImpactReports,
  listUserPickerOptions,
  type ImpactIntervention,
} from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import { listIndicatorMeasurements, type ImpactIndicatorMeasurement } from "@/lib/data/impact-indicators";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";
import { CreateInterventionForm } from "./create-intervention-form";

const ROUTE = "/dashboard/impact-intelligence/interventions";
const UNAVAILABLE = "Unavailable";

type PageProps = {
  searchParams?: Promise<{
    programme_id?: string;
    cohort_id?: string;
    status?: string;
    stage?: string;
    intervention_type?: string;
    assigned_officer_id?: string;
    create_programme_id?: string;
    create_cohort_id?: string;
    error?: string;
  }>;
};

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

type InterventionPortfolioItem = {
  intervention: ImpactIntervention;
  beneficiaries: number;
  assessments: number | null;
  assessmentCoverage: number | null;
  visits: number | null;
  monitoringCoverage: number | null;
  evidenceReadiness: number | null;
  outcomeReadiness: number | null;
  reportReadiness: number | null;
  health: HealthState;
  attentionReasons: string[];
};

const EXPECTED_CREATE_INTERVENTION_ERRORS = [
  "Select a programme.",
  "Select a beneficiary cohort.",
  "Select a cohort beneficiary.",
  "Selected cohort beneficiary was not found.",
  "Selected cohort beneficiary does not belong to the selected programme.",
  "Selected cohort beneficiary does not belong to the selected cohort.",
  "An open intervention of this type already exists for this cohort beneficiary.",
  "Record an approved amount before recording disbursement.",
  "Approved amount is required before recording disbursement.",
  "Disbursed amount cannot exceed approved amount.",
  "Move interventions through one lifecycle stage at a time.",
  "Record approval before moving an intervention to disbursement.",
  "Closure reason and closure note are required before closing an intervention.",
  "Completed interventions require closure reason and closure note.",
  "Closure-stage interventions require closure reason and closure note.",
  "You do not have permission to manage impact intelligence records.",
];

function isExpectedCreateInterventionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return EXPECTED_CREATE_INTERVENTION_ERRORS.some((message) => error.message.includes(message));
}

function createInterventionErrorRedirect(formData: FormData, message: string) {
  const params = new URLSearchParams();
  const programmeId = formData.get("programme_id");
  const cohortId = formData.get("cohort_id");
  if (typeof programmeId === "string" && programmeId) params.set("create_programme_id", programmeId);
  if (typeof cohortId === "string" && cohortId) params.set("create_cohort_id", cohortId);
  params.set("error", message);
  return `${ROUTE}?${params.toString()}#create-intervention`;
}

async function createInterventionAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let interventionId: string;
  try {
    interventionId = await createImpactIntervention(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedCreateInterventionError(error)) throw error;
    const message = error instanceof Error ? error.message : "Intervention could not be created.";
    redirect(createInterventionErrorRedirect(formData, message));
  }
  redirect(`${ROUTE}/${interventionId}`);
}

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

function formatDate(value: string | null) {
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

function statusTone(status: string | null) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "completed") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "on_hold") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "cancelled") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function healthTone(health: HealthState) {
  if (health === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (health === "Watchlist") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (health === "At Risk") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function isDelayed(intervention: ImpactIntervention) {
  if (!intervention.end_date || ["completed", "cancelled"].includes(intervention.status ?? "")) return false;
  const end = new Date(`${intervention.end_date}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
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
  icon: typeof Network;
  tone: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-tight text-[#0c1733]">{value}</p>
          <p className="truncate text-[10px] font-semibold text-slate-500">{label}</p>
        </div>
      </div>
    </article>
  );
}

function ProgressValue({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  if (value === null) return <span className="text-[10px] font-semibold text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div className="min-w-[80px]">
      <span className="text-[10px] font-bold text-slate-700">{value}%</span>
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
    return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">{emptyText}</p>;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {items.slice(0, 6).map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-semibold capitalize text-slate-700">{item.label.replaceAll("_", " ")}</span>
            <span className="font-bold text-slate-900">{formatNumber(item.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function summaryHealth(value: number | null, goodAt = 80) {
  if (value === null) return "Unavailable" as const;
  if (value >= goodAt) return "Healthy" as const;
  if (value >= 50) return "Watchlist" as const;
  return "At Risk" as const;
}

export default async function ImpactInterventionsPage({ searchParams }: PageProps) {
  const filters = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let interventionsSource = sourceFallback<ImpactIntervention[]>([]);

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    interventionsSource = await loadSource(
      currentContext,
      "intervention_portfolio_interventions_load_failed",
      () => listImpactInterventions(currentContext, {
        limit: 2000,
        programmeId: filters.programme_id,
        cohortId: filters.cohort_id,
        status: filters.status,
        stage: filters.stage,
        interventionType: filters.intervention_type,
        assignedOfficerId: filters.assigned_officer_id,
      }),
      [],
    );
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "intervention_portfolio_context_load_failed", error });
  }

  if (!ctx || !interventionsSource.available) {
    return (
      <section className="space-y-6">
        <Section title="Intervention Delivery Unavailable">
          <EmptyState
            title="Intervention portfolio could not load"
            description="The intervention source, current session, or role assignment is temporarily unavailable. No delivery metrics are being inferred."
            icon={HandCoins}
          />
        </Section>
      </section>
    );
  }

  const interventions = interventionsSource.data;
  const interventionIds = new Set(interventions.map((item) => item.id));
  const canReadAssessments = canRole(ctx.role, "assessment", "read");
  const canReadMonitoring = canRole(ctx.role, "monitoring_visit", "read");
  const canReadEvidence = canRole(ctx.role, "evidence", "read");
  const canReadIndicators = canRole(ctx.role, "indicator", "read");
  const canReadReports = canRole(ctx.role, "report", "read");

  const [
    programmesSource,
    cohortsSource,
    assessmentsSource,
    visitsSource,
    evidenceSource,
    indicatorsSource,
    reportsSource,
    officersSource,
  ] = await Promise.all([
    loadSource(ctx, "intervention_portfolio_programmes_load_failed", () => listImpactProgrammes(ctx, { limit: 500 }), []),
    loadSource(ctx, "intervention_portfolio_cohorts_load_failed", () => listImpactCohorts(ctx, { limit: 1000, programmeId: filters.programme_id }), []),
    canReadAssessments
      ? loadSource(ctx, "intervention_portfolio_assessments_load_failed", () => listImpactAssessments(ctx, { limit: 3000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadMonitoring
      ? loadSource(ctx, "intervention_portfolio_monitoring_load_failed", () => listImpactFieldVisits(ctx, { limit: 3000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadEvidence
      ? loadSource(ctx, "intervention_portfolio_evidence_load_failed", () => listImpactEvidence(ctx, { limit: 3000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadIndicators
      ? loadSource(ctx, "intervention_portfolio_indicators_load_failed", () => listIndicatorMeasurements(ctx, { limit: 3000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadReports
      ? loadSource(ctx, "intervention_portfolio_reports_load_failed", () => listImpactReports(ctx, { limit: 3000 }), [])
      : Promise.resolve(sourceFallback([])),
    loadSource(ctx, "intervention_portfolio_officers_load_failed", () => listUserPickerOptions("field_officer"), []),
  ]);

  const assessments = assessmentsSource.data.filter((item) => item.intervention_id && interventionIds.has(item.intervention_id));
  const visits = visitsSource.data.filter((item) => item.intervention_id && interventionIds.has(item.intervention_id));
  const evidence = evidenceSource.data.filter((item) => item.intervention_id && interventionIds.has(item.intervention_id));
  const indicators = indicatorsSource.data.filter((item) => item.intervention_id && interventionIds.has(item.intervention_id));
  const reports = reportsSource.data.filter((item) => item.intervention_id && interventionIds.has(item.intervention_id));

  const portfolio: InterventionPortfolioItem[] = interventions.map((intervention) => {
    const linkedAssessments = assessments.filter((item) => item.intervention_id === intervention.id);
    const linkedVisits = visits.filter((item) => item.intervention_id === intervention.id);
    const linkedEvidence = evidence.filter((item) => item.intervention_id === intervention.id);
    const linkedIndicators = indicators.filter((item) => item.intervention_id === intervention.id);
    const linkedReports = reports.filter((item) => item.intervention_id === intervention.id);
    const approvedAssessments = linkedAssessments.filter((item) => item.status === "approved").length;
    const completedVisits = linkedVisits.filter((item) => ["completed", "reviewed"].includes(item.status ?? "")).length;
    const verifiedEvidence = linkedEvidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length;
    const verifiedIndicators = linkedIndicators.filter((item) => item.verification_status === "verified").length;
    const approvedReports = linkedReports.filter((item) => item.status === "approved").length;
    const sourcesAvailable = assessmentsSource.available
      && visitsSource.available
      && evidenceSource.available
      && indicatorsSource.available
      && reportsSource.available;
    const attentionReasons: string[] = [];
    if (isDelayed(intervention)) attentionReasons.push("End date passed without completion");
    if (assessmentsSource.available && linkedAssessments.length === 0) attentionReasons.push("No linked assessments");
    if (visitsSource.available && linkedVisits.some((item) => !["completed", "reviewed"].includes(item.status ?? ""))) attentionReasons.push("Pending monitoring");
    if (evidenceSource.available && linkedEvidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length === 0) attentionReasons.push("Missing verified evidence");
    if (indicatorsSource.available && linkedIndicators.filter((item) => item.verification_status === "verified").length === 0) attentionReasons.push("Missing verified indicators");
    if (
      reportsSource.available
      && intervention.status === "completed"
      && linkedReports.filter((item) => item.status === "approved").length === 0
    ) attentionReasons.push("Completed but not report ready");

    let health: HealthState = "Unavailable";
    if (sourcesAvailable) {
      health = isDelayed(intervention) || (intervention.status === "completed" && approvedReports === 0)
        ? "At Risk"
        : attentionReasons.length > 0
          ? "Watchlist"
          : "Healthy";
    }

    return {
      intervention,
      beneficiaries: intervention.cohort_member_id || intervention.msme_id ? 1 : 0,
      assessments: assessmentsSource.available ? linkedAssessments.length : null,
      assessmentCoverage: assessmentsSource.available ? ratio(approvedAssessments, linkedAssessments.length) : null,
      visits: visitsSource.available ? linkedVisits.length : null,
      monitoringCoverage: visitsSource.available ? ratio(completedVisits, linkedVisits.length) : null,
      evidenceReadiness: evidenceSource.available ? ratio(verifiedEvidence, linkedEvidence.length) : null,
      outcomeReadiness: indicatorsSource.available ? ratio(verifiedIndicators, linkedIndicators.length) : null,
      reportReadiness: reportsSource.available ? ratio(approvedReports, linkedReports.length) : null,
      health,
      attentionReasons,
    };
  });

  const activeInterventions = interventions.filter((item) => item.status === "active").length;
  const completedInterventions = interventions.filter((item) => item.status === "completed").length;
  const onHoldInterventions = interventions.filter((item) => item.status === "on_hold").length;
  const deliveryRate = ratio(completedInterventions, interventions.length);
  const knownHealth = portfolio.filter((item) => item.health !== "Unavailable");
  const attentionInterventions = portfolio.filter((item) => ["Watchlist", "At Risk"].includes(item.health));
  const beneficiaryIds = (items: ImpactIntervention[]) => new Set(
    items.map((item) => item.cohort_member_id ?? item.msme_id).filter((value): value is string => Boolean(value)),
  ).size;
  const beneficiariesReached = beneficiaryIds(interventions);
  const activeBeneficiaries = beneficiaryIds(interventions.filter((item) => item.status === "active"));
  const completedBeneficiaries = beneficiaryIds(interventions.filter((item) => item.status === "completed"));
  const approvedAssessments = assessmentsSource.available ? assessments.filter((item) => item.status === "approved").length : null;
  const reviewedAssessments = assessmentsSource.available ? assessments.filter((item) => item.status === "reviewed").length : null;
  const submittedAssessments = assessmentsSource.available ? assessments.filter((item) => item.status === "submitted").length : null;
  const draftAssessments = assessmentsSource.available ? assessments.filter((item) => item.status === "draft").length : null;
  const reviewedVisits = visitsSource.available ? visits.filter((item) => item.status === "reviewed").length : null;
  const completedVisits = visitsSource.available ? visits.filter((item) => item.status === "completed").length : null;
  const pendingVisits = visitsSource.available ? visits.filter((item) => !["completed", "reviewed"].includes(item.status ?? "")).length : null;
  const overdueVisits = visitsSource.available
    ? visits.filter((item) => {
      const dateValue = item.visit_date ?? item.scheduled_at;
      if (!dateValue || ["completed", "reviewed"].includes(item.status ?? "")) return false;
      const date = new Date(dateValue);
      return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
    }).length
    : null;
  const verifiedEvidence = evidenceSource.available
    ? evidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length
    : null;
  const pendingEvidence = evidenceSource.available
    ? evidence.filter((item) => ["uploaded", "submitted", "under_review"].includes(item.status)).length
    : null;
  const returnedEvidence = evidenceSource.available ? evidence.filter((item) => item.status === "returned").length : null;
  const rejectedEvidence = evidenceSource.available ? evidence.filter((item) => item.status === "rejected").length : null;
  const verifiedIndicators = indicatorsSource.available
    ? indicators.filter((item) => item.verification_status === "verified").length
    : null;
  const verifiedIndicatorRows = indicatorsSource.available
    ? indicators.filter((item) => item.verification_status === "verified")
    : [];
  const outcomeProgressValues = verifiedIndicatorRows
    .map((item) => item.progress_percentage)
    .filter((value): value is number => value !== null);
  const outcomeProgress = indicatorsSource.available && outcomeProgressValues.length > 0
    ? Math.round(outcomeProgressValues.reduce((sum, value) => sum + value, 0) / outcomeProgressValues.length)
    : null;
  const positiveOutcomes = indicatorsSource.available
    ? verifiedIndicatorRows.filter((item) => ["on_track", "achieved", "exceeded"].includes(item.outcome_status)).length
    : null;
  const monitoringCoverage = visitsSource.available
    ? ratio(
      new Set(visits.filter((item) => ["completed", "reviewed"].includes(item.status ?? "")).map((item) => item.intervention_id).filter(Boolean)).size,
      interventions.length,
    )
    : null;
  const freshness = latestDate([
    ...interventions.map((item) => item.updated_at ?? item.created_at),
    ...assessments.map((item) => item.submitted_at ?? item.created_at),
    ...visits.map((item) => item.reviewed_at ?? item.completed_at ?? item.created_at),
    ...evidence.map((item) => item.reviewed_at ?? item.created_at),
    ...indicators.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...reports.map((item) => item.approved_at ?? item.generated_at ?? item.created_at),
  ]);

  const interventionTypes = Array.from(new Set(interventions.map((item) => item.intervention_type).filter(Boolean))).sort();
  const stageDistribution = INTERVENTION_STAGES.map((stage) => ({
    label: stage,
    value: interventions.filter((item) => getInterventionStage(item) === stage).length,
  })).filter((item) => item.value > 0);
  const statusDistribution = INTERVENTION_STATUSES.map((status) => ({
    label: status,
    value: interventions.filter((item) => item.status === status).length,
  })).filter((item) => item.value > 0);
  const completedLast30Days = interventions.filter((item) => {
    if (item.status !== "completed") return false;
    const value = item.closed_at ?? item.updated_at;
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now() - (30 * 24 * 60 * 60 * 1000);
  }).length;

  const linkedAssessmentIds = new Set(assessments.map((item) => item.intervention_id).filter(Boolean));
  const linkedVisitIds = new Set(visits.filter((item) => ["completed", "reviewed"].includes(item.status ?? "")).map((item) => item.intervention_id).filter(Boolean));
  const verifiedEvidenceIds = new Set(evidence.filter((item) => item.status === "verified" && item.verification_status === "verified").map((item) => item.intervention_id).filter(Boolean));
  const verifiedOutcomeIds = new Set(indicators.filter((item) => item.verification_status === "verified").map((item) => item.intervention_id).filter(Boolean));
  const approvedReportIds = new Set(reports.filter((item) => item.status === "approved").map((item) => item.intervention_id).filter(Boolean));
  const pipeline = [
    { label: "Planned", value: interventions.filter((item) => item.status === "planned").length, available: true, color: "bg-slate-500" },
    { label: "Approved", value: interventions.filter((item) => Boolean(item.approved_at)).length, available: true, color: "bg-blue-500" },
    { label: "Active", value: activeInterventions, available: true, color: "bg-cyan-500" },
    { label: "Assessed", value: linkedAssessmentIds.size, available: assessmentsSource.available, color: "bg-amber-500" },
    { label: "Monitored", value: linkedVisitIds.size, available: visitsSource.available, color: "bg-orange-500" },
    { label: "Evidence Verified", value: verifiedEvidenceIds.size, available: evidenceSource.available, color: "bg-emerald-500" },
    { label: "Outcomes Verified", value: verifiedOutcomeIds.size, available: indicatorsSource.available, color: "bg-teal-500" },
    { label: "Report Ready", value: approvedReportIds.size, available: reportsSource.available, color: "bg-violet-500" },
  ];

  const topByReach = portfolio
    .filter((item) => item.beneficiaries > 0)
    .sort((a, b) => b.beneficiaries - a.beneficiaries || a.intervention.title.localeCompare(b.intervention.title))
    .slice(0, 5);
  const riskGroups = [
    {
      label: "Missing verified evidence",
      available: evidenceSource.available,
      items: portfolio.filter((item) => item.attentionReasons.includes("Missing verified evidence")),
    },
    {
      label: "No assessments",
      available: assessmentsSource.available,
      items: portfolio.filter((item) => item.attentionReasons.includes("No linked assessments")),
    },
    {
      label: "Pending monitoring",
      available: visitsSource.available,
      items: portfolio.filter((item) => item.attentionReasons.includes("Pending monitoring")),
    },
    {
      label: "Missing verified indicators",
      available: indicatorsSource.available,
      items: portfolio.filter((item) => item.attentionReasons.includes("Missing verified indicators")),
    },
    {
      label: "Blocked from reporting",
      available: reportsSource.available,
      items: portfolio.filter((item) => item.attentionReasons.includes("Completed but not report ready")),
    },
  ];

  const recentActivity = [
    ...interventions
      .filter((item) => item.created_at)
      .map((item) => ({ type: "Intervention created", title: item.title, createdAt: item.created_at, href: `${ROUTE}/${item.id}`, icon: Network })),
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
    ...reports
      .filter((item) => item.generated_at ?? item.created_at)
      .map((item) => ({ type: "Report generated", title: item.title, createdAt: item.generated_at ?? item.created_at, href: `/dashboard/impact-intelligence/reports/${item.id}`, icon: FileText })),
  ]
    .filter((item) => item.createdAt && canAccessRoute(ctx.role, item.href))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6);

  const canCreate = canRole(ctx.role, "intervention", "create") && canAccessRoute(ctx.role, ROUTE);
  const canExport = canRole(ctx.role, "export", "export")
    && canRole(ctx.role, "report", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canOpenIntervention = canRole(ctx.role, "intervention", "read") && canAccessRoute(ctx.role, ROUTE);
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);
  const createProgrammeId = filters.create_programme_id ?? "";
  const createCohortId = filters.create_cohort_id ?? "";
  const createCohorts = createProgrammeId
    ? cohortsSource.data.filter((item) => item.programme_id === createProgrammeId)
    : cohortsSource.data;
  const cohortMembersSource = canCreate
    ? await loadSource(ctx, "intervention_create_members_load_failed", () => listImpactCohortMemberOptions(ctx, {
      limit: 500,
      programmeId: createProgrammeId,
      cohortId: createCohortId,
    }), [])
    : sourceFallback([]);
  const assuranceRate = assessmentsSource.available ? ratio(approvedAssessments ?? 0, assessments.length) : null;
  const evidenceRate = evidenceSource.available ? ratio(verifiedEvidence ?? 0, evidence.length) : null;
  const outcomeRate = indicatorsSource.available ? ratio(verifiedIndicators ?? 0, indicators.length) : null;
  const reportingRate = reportsSource.available ? ratio(reports.filter((item) => item.status === "approved").length, reports.length) : null;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Interventions</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Intervention Delivery Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Executive visibility across support delivery, assurance, evidence, outcomes, reporting readiness, and attention signals.
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
                <Link href="#create-intervention" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#132d60]">
                  <Plus className="h-4 w-4" /> Create Intervention
                </Link>
              )}
              <details className="relative">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <form method="get" className="absolute right-0 z-30 mt-2 grid w-[min(90vw,520px)] gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:grid-cols-2">
                  <select name="programme_id" defaultValue={filters.programme_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All programmes</option>
                    {programmesSource.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select name="cohort_id" defaultValue={filters.cohort_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All cohorts</option>
                    {cohortsSource.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select name="status" defaultValue={filters.status ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All statuses</option>
                    {INTERVENTION_STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                  </select>
                  <select name="stage" defaultValue={filters.stage ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All stages</option>
                    {INTERVENTION_STAGES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select name="intervention_type" defaultValue={filters.intervention_type ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All types</option>
                    {interventionTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select name="assigned_officer_id" defaultValue={filters.assigned_officer_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All officers</option>
                    {officersSource.data.map((item) => <option key={item.id} value={item.id}>{item.full_name ?? item.email ?? item.id}</option>)}
                  </select>
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="submit" className="h-9 rounded-lg bg-[#0c1f46] px-4 text-xs font-bold text-white">Apply filters</button>
                    <Link href={ROUTE} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700">Clear</Link>
                  </div>
                </form>
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

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_30%,rgba(14,165,233,0.38),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="intervention-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#60a5fa" /></pattern></defs>
            <path d="M500 35 610 20l75 35 72 10 50 58-42 48 12 56-97 18-64-35-78 15-46-65 22-55Z" fill="url(#intervention-hero-dots)" stroke="#38bdf8" strokeOpacity=".4" />
            <path d="M460 230c70-50 115-112 177-82s91 6 150-68" fill="none" stroke="#38bdf8" strokeOpacity=".55" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Intervention delivery overview</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">From planned support to verified outcomes</h2>
              <p className="mt-2 text-sm text-blue-100/80">Scoped delivery records. Linked assurance. No inferred source values.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total interventions", value: formatNumber(interventions.length), icon: Network, color: "text-cyan-300" },
              { label: "Active interventions", value: formatNumber(activeInterventions), icon: Activity, color: "text-emerald-300" },
              { label: "Completed", value: formatNumber(completedInterventions), icon: CheckCircle2, color: "text-violet-300" },
              { label: "Delivery rate", value: formatPercent(deliveryRate), icon: Gauge, color: "text-amber-300" },
              { label: "Require attention", value: knownHealth.length > 0 ? formatNumber(attentionInterventions.length) : UNAVAILABLE, icon: AlertTriangle, color: "text-rose-300" },
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
        <MetricCard label="Total Interventions" value={formatNumber(interventions.length)} icon={Network} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Active" value={formatNumber(activeInterventions)} icon={Activity} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Completed" value={formatNumber(completedInterventions)} icon={CheckCircle2} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="On Hold" value={formatNumber(onHoldInterventions)} icon={PauseCircle} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Beneficiaries Impacted" value={formatNumber(beneficiariesReached)} icon={UsersRound} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Assessments Linked" value={assessmentsSource.available ? formatNumber(assessments.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Monitoring Coverage" value={formatPercent(monitoringCoverage)} icon={CalendarClock} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Verified Evidence" value={formatNumber(verifiedEvidence)} icon={ShieldCheck} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Verified Outcomes" value={formatNumber(verifiedIndicators)} icon={Target} tone="bg-purple-100 text-purple-700" />
      </div>

      <Section title="Intervention Pipeline" description="Interventions progressing from planned delivery to approved reporting. Each stage uses only its linked source.">
        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
          {pipeline.map((item, index) => (
            <article key={item.label} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className={cn("absolute inset-x-0 top-0 h-1", item.color)} />
              <p className="mt-1 text-lg font-bold text-[#0c1733]">{item.available ? formatNumber(item.value) : UNAVAILABLE}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-700">{item.label}</p>
              <p className="mt-1 text-[9px] leading-4 text-slate-400">{item.available ? `${formatPercent(ratio(item.value, interventions.length))} of portfolio` : "Source unavailable"}</p>
              {index < pipeline.length - 1 && <ArrowRight className="absolute right-1 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-slate-300 xl:block" />}
            </article>
          ))}
        </div>
      </Section>

      <Section
        title="Intervention Portfolio"
        description="Delivery status, beneficiary reach, assurance coverage, and verification readiness for every visible intervention."
        action={<span className="text-xs font-semibold text-slate-500">{interventions.length} intervention{interventions.length === 1 ? "" : "s"}</span>}
      >
        {interventions.length === 0 ? (
          <EmptyState
            title={scopeEmptyMessage ?? "No interventions available"}
            description={scopeEmptyMessage ?? "No intervention records are available in the current scope or filter selection."}
            actionHref={canCreate ? "#create-intervention" : undefined}
            actionLabel={canCreate ? "Create intervention" : undefined}
            icon={HandCoins}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {portfolio.map((item) => {
              const content = (
                <article className="group h-full rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1", statusTone(item.intervention.status))}>{(item.intervention.status ?? "planned").replaceAll("_", " ")}</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-[#0c1733] group-hover:text-blue-700">{item.intervention.title}</h3>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{item.intervention.impact_programmes?.name ?? UNAVAILABLE}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-400">{item.intervention.impact_beneficiary_cohorts?.name ?? UNAVAILABLE}</p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700"><HandCoins className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-xs">
                    <div><p className="text-[10px] text-slate-500">Start date</p><p className="mt-1 font-bold text-slate-900">{formatDate(item.intervention.start_date)}</p></div>
                    <div><p className="text-[10px] text-slate-500">End date</p><p className="mt-1 font-bold text-slate-900">{formatDate(item.intervention.end_date)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Beneficiaries reached</p><p className="mt-1 font-bold text-slate-900">{formatNumber(item.beneficiaries)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Delivery stage</p><p className="mt-1 font-bold capitalize text-slate-900">{getInterventionStage(item.intervention)}</p></div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Assessment coverage</span><ProgressValue value={item.assessmentCoverage} tone="bg-blue-500" /></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Monitoring coverage</span><ProgressValue value={item.monitoringCoverage} tone="bg-amber-500" /></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Evidence readiness</span><ProgressValue value={item.evidenceReadiness} /></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Outcome readiness</span><ProgressValue value={item.outcomeReadiness} tone="bg-violet-500" /></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="truncate text-[10px] font-medium text-slate-500">{item.intervention.intervention_type || UNAVAILABLE}</span>
                    {canOpenIntervention && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">View intervention <ArrowRight className="h-3 w-3" /></span>}
                  </div>
                </article>
              );
              return canOpenIntervention
                ? <Link key={item.intervention.id} href={`${ROUTE}/${item.intervention.id}`}>{content}</Link>
                : <div key={item.intervention.id}>{content}</div>;
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-3">
        <Section title="Intervention Stage Distribution" description="Current lifecycle stage across visible interventions.">
          <DistributionBars items={stageDistribution} emptyText="No intervention stage distribution is available." tone="bg-blue-500" />
        </Section>
        <Section title="Completion Distribution" description="Current delivery status across the intervention portfolio.">
          <DistributionBars items={statusDistribution} emptyText="No completion distribution is available." tone="bg-emerald-500" />
        </Section>
        <Section title="Delivery Velocity" description="Completed delivery recorded in the last 30 days.">
          <div className="rounded-2xl bg-[#0c1f46] p-5 text-white">
            <TrendingUp className="h-5 w-5 text-emerald-300" />
            <p className="mt-6 text-4xl font-bold">{formatNumber(completedLast30Days)}</p>
            <p className="mt-1 text-xs font-semibold text-blue-100">Completed in last 30 days</p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
              <div><p className="text-blue-100/60">Active</p><p className="mt-1 text-lg font-bold">{activeInterventions}</p></div>
              <div><p className="text-blue-100/60">Completed</p><p className="mt-1 text-lg font-bold">{completedInterventions}</p></div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Beneficiary Impact" description="Unique intervention-linked beneficiaries and the interventions delivering the widest available reach.">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Reached", value: beneficiariesReached, tone: "bg-violet-50 text-violet-700" },
              { label: "Active", value: activeBeneficiaries, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Completed", value: completedBeneficiaries, tone: "bg-blue-50 text-blue-700" },
            ].map((item) => (
              <article key={item.label} className={cn("rounded-2xl p-4", item.tone)}>
                <p className="text-2xl font-bold">{formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p>
              </article>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">Top interventions by reach</h3>
            {topByReach.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">No beneficiary-linked intervention reach is available.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {topByReach.map((item, index) => (
                  <div key={item.intervention.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-50 text-[10px] font-bold text-violet-700">{index + 1}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{item.intervention.title}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{item.intervention.impact_programmes?.name ?? UNAVAILABLE}</p></div>
                    <span className="text-xs font-bold text-slate-900">{item.beneficiaries}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Assessment Assurance" description="Workflow status of intervention-linked assessments.">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Approved", value: approvedAssessments, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Submitted", value: submittedAssessments, tone: "bg-blue-50 text-blue-700" },
              { label: "Draft", value: draftAssessments, tone: "bg-slate-100 text-slate-700" },
              { label: "Reviewed", value: reviewedAssessments, tone: "bg-violet-50 text-violet-700" },
            ].map((item) => <article key={item.label} className={cn("rounded-xl p-4", item.tone)}><p className="text-2xl font-bold">{formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p></article>)}
          </div>
        </Section>
        <Section title="Monitoring Assurance" description="Completion, review, and overdue status for linked field visits.">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Reviewed visits", value: reviewedVisits, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Completed visits", value: completedVisits, tone: "bg-blue-50 text-blue-700" },
              { label: "Pending review", value: pendingVisits, tone: "bg-amber-50 text-amber-700" },
              { label: "Overdue", value: overdueVisits, tone: "bg-rose-50 text-rose-700" },
            ].map((item) => <article key={item.label} className={cn("rounded-xl p-4", item.tone)}><p className="text-2xl font-bold">{formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p></article>)}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Evidence Centre" description="Verification decisions across intervention-linked evidence records.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Verified", value: verifiedEvidence, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Pending", value: pendingEvidence, tone: "bg-amber-50 text-amber-700" },
              { label: "Returned", value: returnedEvidence, tone: "bg-blue-50 text-blue-700" },
              { label: "Rejected", value: rejectedEvidence, tone: "bg-rose-50 text-rose-700" },
            ].map((item) => <article key={item.label} className={cn("rounded-xl p-4", item.tone)}><p className="text-2xl font-bold">{formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p></article>)}
          </div>
        </Section>
        <Section title="Outcomes Centre" description="Verified indicators only. Outcome progress is averaged only where a verified progress value exists.">
          <div className="grid grid-cols-3 gap-3">
            <article className="rounded-xl bg-violet-50 p-4 text-violet-700"><p className="text-2xl font-bold">{formatNumber(verifiedIndicators)}</p><p className="mt-1 text-[10px] font-semibold">Verified indicators</p></article>
            <article className="rounded-xl bg-blue-50 p-4 text-blue-700"><p className="text-2xl font-bold">{formatPercent(outcomeProgress)}</p><p className="mt-1 text-[10px] font-semibold">Outcome progress</p></article>
            <article className="rounded-xl bg-emerald-50 p-4 text-emerald-700"><p className="text-2xl font-bold">{formatNumber(positiveOutcomes)}</p><p className="mt-1 text-[10px] font-semibold">On track or achieved</p></article>
          </div>
        </Section>
      </div>

      <Section title="Intervention Health Matrix" description="Executive comparison of beneficiary reach, assurance, verification, reporting, and delivery health.">
        {portfolio.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No intervention health rows are available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead><tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Intervention</th><th className="px-3 py-3">Programme</th><th className="px-3 py-3">Beneficiaries</th><th className="px-3 py-3">Assessments</th><th className="px-3 py-3">Monitoring</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Indicators</th><th className="px-3 py-3">Reports</th><th className="px-3 py-3">Health</th>
              </tr></thead>
              <tbody>
                {portfolio.map((item) => (
                  <tr key={item.intervention.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-3 py-3 font-semibold text-slate-900">{canOpenIntervention ? <Link href={`${ROUTE}/${item.intervention.id}`} className="hover:text-blue-700">{item.intervention.title}</Link> : item.intervention.title}</td>
                    <td className="px-3 py-3 text-slate-600">{item.intervention.impact_programmes?.name ?? UNAVAILABLE}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{formatNumber(item.beneficiaries)}</td>
                    <td className="px-3 py-3"><ProgressValue value={item.assessmentCoverage} tone="bg-blue-500" /></td>
                    <td className="px-3 py-3"><ProgressValue value={item.monitoringCoverage} tone="bg-amber-500" /></td>
                    <td className="px-3 py-3"><ProgressValue value={item.evidenceReadiness} /></td>
                    <td className="px-3 py-3"><ProgressValue value={item.outcomeReadiness} tone="bg-violet-500" /></td>
                    <td className="px-3 py-3"><ProgressValue value={item.reportReadiness} tone="bg-indigo-500" /></td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Delivery Risks & Attention" description="Only explicit missing links, pending monitoring, elapsed end dates, and reporting blocks from loaded records.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {riskGroups.map((group) => (
            <article key={group.label} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-lg font-bold text-[#0c1733]">{group.available ? group.items.length : UNAVAILABLE}</span></div>
              <h3 className="mt-3 text-xs font-bold text-slate-800">{group.label}</h3>
              <p className="mt-1 text-[10px] leading-4 text-slate-400">{group.available ? (group.items[0]?.intervention.title ?? "No intervention currently flagged") : "Required source unavailable"}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Recent Intervention Activity" description="Latest qualifying intervention-linked delivery records visible to the current role." action={<Activity className="h-4 w-4 text-slate-400" />}>
        {recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No recent intervention activity is available.</p>
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

      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#07162f_0%,#102f54_60%,#0f4d53_100%)] p-5 text-white shadow-xl shadow-slate-300/20 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Executive delivery summary</p>
            <h2 className="mt-2 text-xl font-bold">Portfolio readiness at a glance</h2>
            <p className="mt-1 text-xs text-blue-100/70">Statuses reflect loaded scoped records only. Missing sources remain unavailable.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: "Delivery Health", value: deliveryRate },
              { label: "Assurance Health", value: assuranceRate },
              { label: "Evidence Health", value: evidenceRate },
              { label: "Outcome Health", value: outcomeRate },
              { label: "Reporting Health", value: reportingRate },
            ].map((item) => {
              const health = summaryHealth(item.value);
              return (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-[9px] font-semibold text-blue-100/60">{item.label}</p>
                  <p className="mt-2 text-xs font-bold">{health}</p>
                  <p className="mt-1 text-[10px] text-blue-100/70">{formatPercent(item.value)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {canCreate && (
        <Section id="create-intervention" title="Create Cohort-Anchored Intervention" description="Existing governed creation workflow. Programme and beneficiary scope rules remain enforced by the server action.">
          {filters.error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{filters.error}</div>}
          <CreateInterventionForm
            key={`${createProgrammeId}:${createCohortId}`}
            programmes={programmesSource.data}
            cohorts={createCohorts}
            cohortMembers={cohortMembersSource.data}
            officers={officersSource.data}
            selectedProgrammeId={createProgrammeId}
            selectedCohortId={createCohortId}
            action={createInterventionAction}
          />
        </Section>
      )}

      <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] text-slate-500">
        <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
        <span>Metrics use only records available within the current role, programme assignment, and delegated operational scope.</span>
        <span className="text-slate-300">•</span>
        <Clock3 className="h-3.5 w-3.5 text-amber-500" />
        <span>Unavailable sources are not estimated.</span>
      </div>
    </section>
  );
}
