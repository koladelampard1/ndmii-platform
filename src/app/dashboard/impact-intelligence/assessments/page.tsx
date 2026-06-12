import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileWarning,
  Filter,
  Gauge,
  Layers3,
  Network,
  Plus,
  RotateCcw,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TYPES,
  createAssessment,
  listAssessmentTemplates,
  listImpactAssessments,
  listImpactCohortMemberOptions,
  listImpactCohorts,
  listImpactInterventions,
  listImpactProgrammes,
  listImpactReports,
  type ImpactAssessment,
} from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import { listIndicatorMeasurements, type ImpactIndicatorMeasurement } from "@/lib/data/impact-indicators";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";
import { CreateAssessmentForm } from "./create-assessment-form";

const ROUTE = "/dashboard/impact-intelligence/assessments";
const UNAVAILABLE = "Unavailable";

type PageProps = {
  searchParams?: Promise<{
    programme_id?: string;
    cohort_id?: string;
    assessment_type?: string;
    status?: string;
    intervention_id?: string;
    create_programme_id?: string;
    create_cohort_id?: string;
    error?: string;
  }>;
};

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";
type ReportWithAssessmentIds = Awaited<ReturnType<typeof listImpactReports>>[number] & {
  latest_version?: { assessment_ids?: string[] | null } | null;
};

type AssessmentPortfolioItem = {
  assessment: ImpactAssessment;
  linkedEvidence: number | null;
  verifiedEvidence: number | null;
  evidenceReadiness: number | null;
  linkedIndicators: number | null;
  verifiedIndicators: number | null;
  outcomeReadiness: number | null;
  linkedReports: number | null;
  approvedReports: number | null;
  reportReadiness: number | null;
  health: HealthState;
  attentionReasons: string[];
};

const EXPECTED_ASSESSMENT_CREATE_ERRORS = [
  "Select an assessment template.",
  "Select a programme.",
  "Select a beneficiary cohort.",
  "Select a cohort beneficiary.",
  "Selected cohort beneficiary was not found.",
  "Selected cohort beneficiary does not belong to the selected programme.",
  "Selected cohort beneficiary does not belong to the selected cohort.",
  "Selected intervention was not found.",
  "Selected intervention does not belong to the selected programme.",
  "Selected intervention does not belong to the selected cohort.",
  "Selected intervention does not belong to the selected cohort beneficiary.",
  "Selected intervention MSME does not match the selected cohort beneficiary.",
  "You do not have permission to manage impact assessments.",
];

function isExpectedCreateError(error: unknown) {
  return error instanceof Error && EXPECTED_ASSESSMENT_CREATE_ERRORS.some((message) => error.message.includes(message));
}

async function createAssessmentAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let assessmentId: string;
  try {
    assessmentId = await createAssessment(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedCreateError(error)) throw error;
    const params = new URLSearchParams();
    const programmeId = formData.get("programme_id");
    const cohortId = formData.get("cohort_id");
    if (typeof programmeId === "string" && programmeId) params.set("create_programme_id", programmeId);
    if (typeof cohortId === "string" && cohortId) params.set("create_cohort_id", cohortId);
    params.set("error", error instanceof Error ? error.message : "Assessment could not be created.");
    redirect(`${ROUTE}?${params.toString()}#create-assessment`);
  }
  redirect(`${ROUTE}/${assessmentId}`);
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

function formatScore(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : UNAVAILABLE;
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function average(values: number[]) {
  return values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string | null, role: string) {
  const source = name?.trim() || roleLabel(role);
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatFreshness(value: string | null | undefined) {
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

function titleFor(assessment: ImpactAssessment) {
  return assessment.title ?? assessment.impact_assessment_templates?.name ?? "Assessment";
}

function statusTone(status: string | null) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "reviewed") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (status === "submitted") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "returned") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "completed") return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function healthTone(health: HealthState) {
  if (health === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (health === "Watchlist") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (health === "At Risk") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function summaryHealth(value: number | null) {
  if (value === null) return "Unavailable" as const;
  if (value >= 80) return "Healthy" as const;
  if (value >= 50) return "Watchlist" as const;
  return "At Risk" as const;
}

function reportAssessmentIds(report: ReportWithAssessmentIds) {
  return Array.isArray(report.latest_version?.assessment_ids)
    ? report.latest_version.assessment_ids.filter((value): value is string => typeof value === "string")
    : [];
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
  icon: typeof ClipboardCheck;
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
    <div className="min-w-[82px]">
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
  items: Array<{ label: string; value: number; detail?: string }>;
  emptyText: string;
  tone: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">{emptyText}</p>;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {items.slice(0, 7).map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-semibold text-slate-700">{item.label}</span>
            <span className="font-bold text-slate-900">{formatNumber(item.value)}</span>
          </div>
          {item.detail && <p className="mt-0.5 truncate text-[9px] text-slate-400">{item.detail}</p>}
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function deriveAssessmentHealth(input: {
  assessment: ImpactAssessment;
  sourcesAvailable: boolean;
  linkedEvidence: number;
  verifiedEvidence: number;
  linkedIndicators: number;
  verifiedIndicators: number;
}) {
  if (!input.sourcesAvailable) return { health: "Unavailable" as const, attentionReasons: [] };

  const reasons: string[] = [];
  if (input.assessment.status === "returned") reasons.push("Returned for correction");
  if (input.linkedEvidence === 0) reasons.push("No linked evidence");
  else if (input.verifiedEvidence === 0) reasons.push("Evidence awaiting verification");
  if (input.linkedIndicators === 0) reasons.push("No linked indicators");
  else if (input.verifiedIndicators === 0) reasons.push("Indicators awaiting verification");
  if (input.assessment.status === "submitted") reasons.push("Awaiting assessment review");
  if (input.assessment.status === "draft") reasons.push("Assessment remains in draft");

  if (
    input.assessment.status === "returned"
    || (input.assessment.status === "approved" && (input.verifiedEvidence === 0 || input.verifiedIndicators === 0))
  ) {
    return { health: "At Risk" as const, attentionReasons: reasons };
  }
  if (reasons.length > 0) return { health: "Watchlist" as const, attentionReasons: reasons };
  if (["reviewed", "approved"].includes(input.assessment.status ?? "")) {
    return { health: "Healthy" as const, attentionReasons: [] };
  }
  return { health: "Watchlist" as const, attentionReasons: ["Assessment workflow is incomplete"] };
}

export default async function ImpactAssessmentsPage({ searchParams }: PageProps) {
  const filters = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let assessmentsSource = sourceFallback<ImpactAssessment[]>([]);

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    assessmentsSource = await loadSource(
      currentContext,
      "assessment_assurance_assessments_load_failed",
      () => listImpactAssessments(currentContext, {
        limit: 3000,
        programmeId: filters.programme_id,
        cohortId: filters.cohort_id,
        assessmentType: filters.assessment_type,
        status: filters.status,
        interventionId: filters.intervention_id,
      }),
      [],
    );
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "assessment_assurance_context_load_failed", error });
  }

  if (!ctx || !assessmentsSource.available) {
    return (
      <section className="space-y-6">
        <Section title="Assessment Assurance Unavailable">
          <EmptyState
            title="Assessment assurance could not load"
            description="The assessment source, current session, or role assignment is temporarily unavailable. No assurance metrics are being inferred."
            icon={ClipboardCheck}
          />
        </Section>
      </section>
    );
  }

  const assessments = assessmentsSource.data;
  const assessmentIds = new Set(assessments.map((item) => item.id));
  const createProgrammeId = filters.create_programme_id ?? "";
  const createCohortId = filters.create_cohort_id ?? "";
  const canCreate = canRole(ctx.role, "assessment", "create");
  const canReadEvidence = canRole(ctx.role, "evidence", "read");
  const canReadIndicators = canRole(ctx.role, "indicator", "read");
  const canReadReports = canRole(ctx.role, "report", "read");
  const canReadTemplates = canRole(ctx.role, "assessment_template", "read")
    && canAccessRoute(ctx.role, `${ROUTE}/templates`);

  const [
    programmesSource,
    cohortsSource,
    interventionsSource,
    evidenceSource,
    indicatorsSource,
    reportsSource,
    templatesSource,
    createCohortsSource,
    cohortMembersSource,
  ] = await Promise.all([
    loadSource(ctx, "assessment_assurance_programmes_load_failed", () => listImpactProgrammes(ctx, { limit: 1000 }), []),
    loadSource(ctx, "assessment_assurance_cohorts_load_failed", () => listImpactCohorts(ctx, { limit: 2000, programmeId: filters.programme_id }), []),
    loadSource(ctx, "assessment_assurance_interventions_load_failed", () => listImpactInterventions(ctx, {
      limit: 3000,
      programmeId: filters.programme_id,
      cohortId: filters.cohort_id,
    }), []),
    canReadEvidence
      ? loadSource(ctx, "assessment_assurance_evidence_load_failed", () => listImpactEvidence(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadIndicators
      ? loadSource(ctx, "assessment_assurance_indicators_load_failed", () => listIndicatorMeasurements(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback([])),
    canReadReports
      ? loadSource(ctx, "assessment_assurance_reports_load_failed", () => listImpactReports(ctx, { limit: 3000 }), [])
      : Promise.resolve(sourceFallback([])),
    canCreate
      ? loadSource(ctx, "assessment_create_templates_load_failed", () => listAssessmentTemplates(ctx, { limit: 250 }), [])
      : Promise.resolve(sourceFallback([])),
    canCreate
      ? loadSource(ctx, "assessment_create_cohorts_load_failed", () => listImpactCohorts(ctx, { limit: 500, programmeId: createProgrammeId }), [])
      : Promise.resolve(sourceFallback([])),
    canCreate
      ? loadSource(ctx, "assessment_create_members_load_failed", () => listImpactCohortMemberOptions(ctx, {
        limit: 500,
        programmeId: createProgrammeId,
        cohortId: createCohortId,
      }), [])
      : Promise.resolve(sourceFallback([])),
  ]);

  const evidence = evidenceSource.data.filter((item) => item.assessment_id && assessmentIds.has(item.assessment_id));
  const indicators = indicatorsSource.data.filter((item) => item.assessment_id && assessmentIds.has(item.assessment_id));
  const reports = reportsSource.data as ReportWithAssessmentIds[];
  const assessmentReports = reports.filter((report) => reportAssessmentIds(report).some((id) => assessmentIds.has(id)));
  const createInterventions = interventionsSource.data.filter((intervention) =>
    (!createProgrammeId || intervention.programme_id === createProgrammeId)
    && (!createCohortId || intervention.cohort_id === createCohortId)
    && (!intervention.cohort_member_id || cohortMembersSource.data.some((member) => member.id === intervention.cohort_member_id)),
  );

  const portfolio: AssessmentPortfolioItem[] = assessments.map((assessment) => {
    const linkedEvidenceRows = evidence.filter((item) => item.assessment_id === assessment.id);
    const linkedIndicatorRows = indicators.filter((item) => item.assessment_id === assessment.id);
    const linkedReportRows = assessmentReports.filter((item) => reportAssessmentIds(item).includes(assessment.id));
    const verifiedEvidenceRows = linkedEvidenceRows.filter((item) => item.status === "verified" && item.verification_status === "verified");
    const verifiedIndicatorRows = linkedIndicatorRows.filter((item) => item.verification_status === "verified");
    const approvedReportRows = linkedReportRows.filter((item) => item.status === "approved");
    const health = deriveAssessmentHealth({
      assessment,
      sourcesAvailable: evidenceSource.available && indicatorsSource.available,
      linkedEvidence: linkedEvidenceRows.length,
      verifiedEvidence: verifiedEvidenceRows.length,
      linkedIndicators: linkedIndicatorRows.length,
      verifiedIndicators: verifiedIndicatorRows.length,
    });

    return {
      assessment,
      linkedEvidence: evidenceSource.available ? linkedEvidenceRows.length : null,
      verifiedEvidence: evidenceSource.available ? verifiedEvidenceRows.length : null,
      evidenceReadiness: evidenceSource.available ? ratio(verifiedEvidenceRows.length, linkedEvidenceRows.length) : null,
      linkedIndicators: indicatorsSource.available ? linkedIndicatorRows.length : null,
      verifiedIndicators: indicatorsSource.available ? verifiedIndicatorRows.length : null,
      outcomeReadiness: indicatorsSource.available ? ratio(verifiedIndicatorRows.length, linkedIndicatorRows.length) : null,
      linkedReports: reportsSource.available ? linkedReportRows.length : null,
      approvedReports: reportsSource.available ? approvedReportRows.length : null,
      reportReadiness: reportsSource.available ? ratio(approvedReportRows.length, linkedReportRows.length) : null,
      ...health,
    };
  });

  const approved = assessments.filter((item) => item.status === "approved").length;
  const reviewed = assessments.filter((item) => item.status === "reviewed").length;
  const submitted = assessments.filter((item) => item.status === "submitted").length;
  const draft = assessments.filter((item) => item.status === "draft").length;
  const returned = assessments.filter((item) => item.status === "returned").length;
  const reviewBacklog = submitted + returned;
  const scored = assessments.map((item) => item.score).filter((value): value is number => typeof value === "number");
  const averageScore = average(scored);
  const programmesCovered = new Set(assessments.map((item) => item.programme_id).filter(Boolean)).size;
  const cohortsCovered = new Set(assessments.map((item) => item.cohort_id).filter(Boolean)).size;
  const interventionsCovered = new Set(assessments.map((item) => item.intervention_id).filter(Boolean)).size;
  const coveragePercentage = interventionsSource.available ? ratio(interventionsCovered, interventionsSource.data.length) : null;
  const assessmentReadiness = ratio(approved + reviewed, assessments.length);
  const evidenceLinked = evidenceSource.available
    ? new Set(evidence.map((item) => item.assessment_id).filter(Boolean)).size
    : null;
  const evidenceVerified = evidenceSource.available
    ? new Set(evidence.filter((item) => item.status === "verified" && item.verification_status === "verified").map((item) => item.assessment_id).filter(Boolean)).size
    : null;
  const indicatorsLinked = indicatorsSource.available
    ? new Set(indicators.map((item) => item.assessment_id).filter(Boolean)).size
    : null;
  const indicatorsVerified = indicatorsSource.available
    ? new Set(indicators.filter((item) => item.verification_status === "verified").map((item) => item.assessment_id).filter(Boolean)).size
    : null;
  const reportReady = reportsSource.available
    ? new Set(assessmentReports.filter((item) => item.status === "approved").flatMap(reportAssessmentIds)).size
    : null;
  const evidenceCoverage = evidenceSource.available ? ratio(evidenceVerified ?? 0, assessments.length) : null;
  const outcomeVerification = indicatorsSource.available ? ratio(indicatorsVerified ?? 0, assessments.length) : null;
  const reportingReadiness = reportsSource.available ? ratio(reportReady ?? 0, assessments.length) : null;
  const freshness = latestDate([
    ...assessments.map((item) => item.submitted_at ?? item.returned_at ?? item.conducted_at ?? item.created_at),
    ...evidence.map((item) => item.reviewed_at ?? item.uploaded_at ?? item.created_at),
    ...indicators.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...assessmentReports.map((item) => item.approved_at ?? item.generated_at ?? item.created_at),
  ]);

  const pipeline = [
    { label: "Draft", value: draft, available: true, color: "bg-slate-500" },
    { label: "Submitted", value: submitted, available: true, color: "bg-blue-500" },
    { label: "Reviewed", value: reviewed, available: true, color: "bg-violet-500" },
    { label: "Approved", value: approved, available: true, color: "bg-emerald-500" },
    { label: "Evidence Linked", value: evidenceLinked ?? 0, available: evidenceSource.available, color: "bg-cyan-500" },
    { label: "Indicators Updated", value: indicatorsLinked ?? 0, available: indicatorsSource.available, color: "bg-amber-500" },
    { label: "Report Ready", value: reportReady ?? 0, available: reportsSource.available, color: "bg-indigo-500" },
  ];
  const availablePipeline = pipeline.filter((item) => item.available);
  const bottleneckValue = availablePipeline.length > 0 ? Math.min(...availablePipeline.map((item) => item.value)) : null;

  const programmeCoverage = programmesSource.data.map((programme) => ({
    id: programme.id,
    label: programme.name,
    value: assessments.filter((item) => item.programme_id === programme.id).length,
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const cohortCoverage = cohortsSource.data.map((cohort) => ({
    id: cohort.id,
    label: cohort.name,
    detail: cohort.impact_programmes?.name ?? UNAVAILABLE,
    value: assessments.filter((item) => item.cohort_id === cohort.id).length,
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const interventionCoverage = interventionsSource.data.map((intervention) => ({
    id: intervention.id,
    label: intervention.title,
    detail: intervention.impact_programmes?.name ?? UNAVAILABLE,
    value: assessments.filter((item) => item.intervention_id === intervention.id).length,
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const interventionsWithoutAssessment = interventionsSource.available
    ? interventionCoverage.filter((item) => item.value === 0)
    : [];

  const outcomeAssessments = assessments.filter((item) =>
    ["approved", "reviewed"].includes(item.status ?? "") && typeof item.score === "number",
  );
  const approvedScores = assessments.filter((item) => item.status === "approved" && typeof item.score === "number").map((item) => item.score as number);
  const reviewedScores = assessments.filter((item) => item.status === "reviewed" && typeof item.score === "number").map((item) => item.score as number);
  const scoreDistribution = [
    { label: "80-100", value: outcomeAssessments.filter((item) => (item.score ?? 0) >= 80).length },
    { label: "60-79", value: outcomeAssessments.filter((item) => (item.score ?? 0) >= 60 && (item.score ?? 0) < 80).length },
    { label: "40-59", value: outcomeAssessments.filter((item) => (item.score ?? 0) >= 40 && (item.score ?? 0) < 60).length },
    { label: "Below 40", value: outcomeAssessments.filter((item) => (item.score ?? 0) < 40).length },
  ].filter((item) => item.value > 0);
  const trendMap = new Map<string, { count: number; scores: number[] }>();
  for (const assessment of assessments) {
    if (!assessment.created_at) continue;
    const date = new Date(assessment.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const current = trendMap.get(key) ?? { count: 0, scores: [] };
    current.count += 1;
    if (["approved", "reviewed"].includes(assessment.status ?? "") && typeof assessment.score === "number") current.scores.push(assessment.score);
    trendMap.set(key, current);
  }
  const assessmentTrends = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, value]) => ({
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-NG", { month: "short", year: "2-digit" }),
      value: value.count,
      detail: value.scores.length > 0 ? `${average(value.scores)?.toFixed(1)}% reviewed/approved average` : "No reviewed/approved score",
    }));

  const missingEvidence = evidenceSource.available ? portfolio.filter((item) => item.linkedEvidence === 0) : [];
  const missingIndicators = indicatorsSource.available ? portfolio.filter((item) => item.linkedIndicators === 0) : [];
  const returnedAssessments = portfolio.filter((item) => item.assessment.status === "returned");
  const submittedAssessments = portfolio.filter((item) => item.assessment.status === "submitted");
  const attentionAssessments = portfolio.filter((item) => ["Watchlist", "At Risk"].includes(item.health));
  const knownHealth = portfolio.filter((item) => item.health !== "Unavailable");

  const recentActivity = [
    ...assessments
      .filter((item) => item.created_at)
      .map((item) => ({ type: "Assessment created", title: titleFor(item), createdAt: item.created_at, href: `${ROUTE}/${item.id}`, icon: ClipboardCheck })),
    ...assessments
      .filter((item) => item.submitted_at)
      .map((item) => ({ type: "Assessment submitted", title: titleFor(item), createdAt: item.submitted_at, href: `${ROUTE}/${item.id}`, icon: FileCheck2 })),
    ...assessments
      .filter((item) => item.returned_at)
      .map((item) => ({ type: "Assessment returned", title: titleFor(item), createdAt: item.returned_at, href: `${ROUTE}/${item.id}`, icon: RotateCcw })),
    ...evidence
      .filter((item) => item.assessment_id && (item.uploaded_at ?? item.created_at))
      .map((item: ImpactEvidenceRecord) => ({
        type: "Evidence linked",
        title: item.original_filename ?? item.file_name,
        createdAt: item.uploaded_at ?? item.created_at,
        href: `/dashboard/impact-intelligence/evidence/${item.id}`,
        icon: ShieldCheck,
      })),
    ...indicators
      .filter((item) => item.assessment_id && (item.updated_at ?? item.created_at))
      .map((item: ImpactIndicatorMeasurement) => ({
        type: "Indicator updated",
        title: item.impact_indicator_definitions?.name ?? "Indicator measurement",
        createdAt: item.updated_at ?? item.created_at,
        href: "/dashboard/impact-intelligence/indicators",
        icon: Target,
      })),
  ]
    .filter((item) => item.createdAt && canAccessRoute(ctx.role, item.href))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6);

  const canExport = canRole(ctx.role, "export", "export")
    && canRole(ctx.role, "report", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canOpenAssessment = canAccessRoute(ctx.role, ROUTE);
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Assessments</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Assessment Assurance Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Executive assurance across assessment workflow, coverage, evidence support, verified outcomes, and reporting readiness.
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
                <Link href="#create-assessment" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#132d60]">
                  <Plus className="h-4 w-4" /> Create Assessment
                </Link>
              )}
              {canReadTemplates && (
                <Link href={`${ROUTE}/templates`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <ClipboardCheck className="h-4 w-4" /> Templates
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
                  <select name="intervention_id" defaultValue={filters.intervention_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All interventions</option>
                    {interventionsSource.data.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                  <select name="assessment_type" defaultValue={filters.assessment_type ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All assessment types</option>
                    {ASSESSMENT_TYPES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                  </select>
                  <select name="status" defaultValue={filters.status ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All statuses</option>
                    {ASSESSMENT_STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                  </select>
                  <div className="flex gap-2">
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

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_30%,rgba(14,165,233,0.4),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="assessment-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#60a5fa" /></pattern></defs>
            <path d="M500 35 610 20l75 35 72 10 50 58-42 48 12 56-97 18-64-35-78 15-46-65 22-55Z" fill="url(#assessment-hero-dots)" stroke="#38bdf8" strokeOpacity=".4" />
            <path d="M460 230c70-50 115-112 177-82s91 6 150-68" fill="none" stroke="#38bdf8" strokeOpacity=".55" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Assessment assurance overview</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">From structured assessment to verified, report-ready outcomes</h2>
              <p className="mt-2 text-sm text-blue-100/80">Scoped assessment records. Linked assurance sources. No inferred source values.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total assessments", value: formatNumber(assessments.length), icon: ClipboardCheck, color: "text-cyan-300" },
              { label: "Approved assessments", value: formatNumber(approved), icon: CheckCircle2, color: "text-emerald-300" },
              { label: "Review backlog", value: formatNumber(reviewBacklog), icon: FileWarning, color: "text-rose-300" },
              { label: "Intervention coverage", value: formatPercent(coveragePercentage), icon: Network, color: "text-amber-300" },
              { label: "Assessment readiness", value: formatPercent(assessmentReadiness), icon: Gauge, color: "text-violet-300" },
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
        <MetricCard label="Total Assessments" value={formatNumber(assessments.length)} icon={ClipboardCheck} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Approved" value={formatNumber(approved)} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Reviewed" value={formatNumber(reviewed)} icon={ShieldCheck} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Submitted" value={formatNumber(submitted)} icon={FileCheck2} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Draft" value={formatNumber(draft)} icon={FileWarning} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Programmes Covered" value={programmesSource.available ? formatNumber(programmesCovered) : UNAVAILABLE} icon={Layers3} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Cohorts Covered" value={cohortsSource.available ? formatNumber(cohortsCovered) : UNAVAILABLE} icon={UsersRound} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Interventions Covered" value={interventionsSource.available ? formatNumber(interventionsCovered) : UNAVAILABLE} icon={Network} tone="bg-purple-100 text-purple-700" />
        <MetricCard label="Average Assessment Score" value={averageScore === null ? UNAVAILABLE : `${averageScore.toFixed(1)}%`} icon={BarChart3} tone="bg-teal-100 text-teal-700" />
      </div>

      <Section title="Assessment Assurance Pipeline" description="Workflow and assurance counts across visible assessments. Each linked stage uses only its available source.">
        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
          {pipeline.map((item, index) => {
            const isBottleneck = item.available && bottleneckValue !== null && item.value === bottleneckValue && assessments.length > 0;
            return (
              <article key={item.label} className={cn("relative overflow-hidden rounded-xl border bg-slate-50/70 p-3", isBottleneck ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200")}>
                <div className={cn("absolute inset-x-0 top-0 h-1", item.color)} />
                <p className="mt-1 text-lg font-bold text-[#0c1733]">{item.available ? formatNumber(item.value) : UNAVAILABLE}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-700">{item.label}</p>
                <p className="mt-1 text-[9px] leading-4 text-slate-400">{isBottleneck ? "Current lowest stage" : item.available ? `${formatPercent(ratio(item.value, assessments.length))} of assessments` : "Source unavailable"}</p>
                {index < pipeline.length - 1 && <ArrowRight className="absolute right-1 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-slate-300 xl:block" />}
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        title="Assessment Portfolio"
        description="Assessment status, programme context, beneficiary anchors, assurance support, and outcome readiness."
        action={<span className="text-xs font-semibold text-slate-500">{assessments.length} assessment{assessments.length === 1 ? "" : "s"}</span>}
      >
        {assessments.length === 0 ? (
          <EmptyState
            title={scopeEmptyMessage ?? "No assessments available"}
            description={scopeEmptyMessage ?? "No assessment records are available in the current scope or filter selection."}
            actionHref={canCreate ? "#create-assessment" : undefined}
            actionLabel={canCreate ? "Create assessment" : undefined}
            icon={ClipboardCheck}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {portfolio.map((item) => {
              const content = (
                <article className="group h-full rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1", statusTone(item.assessment.status))}>{(item.assessment.status ?? "draft").replaceAll("_", " ")}</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-[#0c1733] group-hover:text-blue-700">{titleFor(item.assessment)}</h3>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{item.assessment.impact_programmes?.name ?? UNAVAILABLE}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-400">{item.assessment.impact_beneficiary_cohorts?.name ?? UNAVAILABLE}</p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700"><ClipboardCheck className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-xs">
                    <div><p className="text-[10px] text-slate-500">Intervention</p><p className="mt-1 truncate font-bold text-slate-900">{item.assessment.impact_interventions?.title ?? UNAVAILABLE}</p></div>
                    <div><p className="text-[10px] text-slate-500">Beneficiary</p><p className="mt-1 truncate font-bold text-slate-900">{item.assessment.msmes?.business_name ?? UNAVAILABLE}</p></div>
                    <div><p className="text-[10px] text-slate-500">Score</p><p className="mt-1 font-bold text-slate-900">{formatScore(item.assessment.score)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Approval state</p><p className="mt-1 font-bold capitalize text-slate-900">{(item.assessment.status ?? UNAVAILABLE).replaceAll("_", " ")}</p></div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Evidence readiness</span><ProgressValue value={item.evidenceReadiness} /></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Outcome readiness</span><ProgressValue value={item.outcomeReadiness} tone="bg-violet-500" /></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-medium text-slate-500">Reporting readiness</span><ProgressValue value={item.reportReadiness} tone="bg-indigo-500" /></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="truncate text-[10px] font-medium capitalize text-slate-500">{(item.assessment.assessment_type ?? UNAVAILABLE).replaceAll("_", " ")}</span>
                    {canOpenAssessment && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">View assessment <ArrowRight className="h-3 w-3" /></span>}
                  </div>
                </article>
              );
              return canOpenAssessment
                ? <Link key={item.assessment.id} href={`${ROUTE}/${item.assessment.id}`}>{content}</Link>
                : <div key={item.assessment.id}>{content}</div>;
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Programme Coverage" description="Assessments linked to each visible programme.">
          {!programmesSource.available ? (
            <EmptyState title="Programme coverage unavailable" description="The programme source could not be loaded." icon={Layers3} />
          ) : (
            <DistributionBars items={programmeCoverage} emptyText="No programme assessment coverage is available." tone="bg-blue-500" />
          )}
        </Section>
        <Section title="Cohort Coverage" description="Assessment volume across visible beneficiary cohorts.">
          {!cohortsSource.available ? (
            <EmptyState title="Cohort coverage unavailable" description="The cohort source could not be loaded." icon={UsersRound} />
          ) : (
            <DistributionBars items={cohortCoverage} emptyText="No cohort assessment coverage is available." tone="bg-violet-500" />
          )}
        </Section>
        <Section title="Intervention Coverage" description="Coverage and gaps across visible interventions.">
          {!interventionsSource.available ? (
            <EmptyState title="Intervention coverage unavailable" description="The intervention source could not be loaded." icon={Network} />
          ) : (
            <>
              <DistributionBars items={interventionCoverage.filter((item) => item.value > 0)} emptyText="No intervention assessment coverage is available." tone="bg-emerald-500" />
              {interventionsWithoutAssessment.length > 0 && (
                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800">
                  {interventionsWithoutAssessment.length} intervention{interventionsWithoutAssessment.length === 1 ? "" : "s"} currently lack linked assessments.
                </p>
              )}
            </>
          )}
        </Section>
      </div>

      <Section title="Assessment Outcome Zone" description="Score distribution and recent volume use reviewed or approved scores where applicable.">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr_.8fr]">
          <div>
            <h3 className="text-xs font-bold text-slate-900">Score distribution</h3>
            <div className="mt-4"><DistributionBars items={scoreDistribution} emptyText="No reviewed or approved scores are available." tone="bg-cyan-500" /></div>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">Assessment trend</h3>
            <div className="mt-4"><DistributionBars items={assessmentTrends} emptyText="No assessment trend data is available." tone="bg-blue-500" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <article className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              <p className="mt-5 text-3xl font-bold">{average(approvedScores) === null ? UNAVAILABLE : `${average(approvedScores)?.toFixed(1)}%`}</p>
              <p className="mt-1 text-[10px] font-semibold">Approved score average</p>
              <p className="mt-3 text-[10px] text-emerald-700/70">{approvedScores.length} scored approved assessment{approvedScores.length === 1 ? "" : "s"}</p>
            </article>
            <article className="rounded-2xl bg-violet-50 p-4 text-violet-800">
              <ShieldCheck className="h-5 w-5" />
              <p className="mt-5 text-3xl font-bold">{average(reviewedScores) === null ? UNAVAILABLE : `${average(reviewedScores)?.toFixed(1)}%`}</p>
              <p className="mt-1 text-[10px] font-semibold">Reviewed score average</p>
              <p className="mt-3 text-[10px] text-violet-700/70">{reviewedScores.length} scored reviewed assessment{reviewedScores.length === 1 ? "" : "s"}</p>
            </article>
          </div>
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Assessment Quality" description="Current workflow position across the visible assessment portfolio.">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Approved", value: approved, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Reviewed", value: reviewed, tone: "bg-violet-50 text-violet-700" },
              { label: "Submitted", value: submitted, tone: "bg-blue-50 text-blue-700" },
              { label: "Draft", value: draft, tone: "bg-slate-100 text-slate-700" },
            ].map((item) => <article key={item.label} className={cn("rounded-xl p-4", item.tone)}><p className="text-2xl font-bold">{formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p></article>)}
          </div>
        </Section>
        <Section title="Evidence Support" description="Assessment-linked evidence records and verification readiness.">
          {!evidenceSource.available ? (
            <EmptyState title="Evidence support unavailable" description="Evidence access is unavailable for this role or the evidence source could not load." icon={ShieldCheck} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Linked evidence", value: evidence.length, tone: "bg-blue-50 text-blue-700" },
                { label: "Verified evidence", value: evidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length, tone: "bg-emerald-50 text-emerald-700" },
                { label: "Missing evidence", value: missingEvidence.length, tone: "bg-rose-50 text-rose-700" },
                { label: "Evidence readiness", value: evidenceCoverage, tone: "bg-cyan-50 text-cyan-700", percent: true },
              ].map((item) => <article key={item.label} className={cn("rounded-xl p-4", item.tone)}><p className="text-2xl font-bold">{item.percent ? formatPercent(item.value) : formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p></article>)}
            </div>
          )}
        </Section>
      </div>

      <Section title="Outcome Verification Zone" description="Only verified assessment-linked indicator measurements contribute to verified outcome readiness.">
        {!indicatorsSource.available ? (
          <EmptyState title="Outcome verification unavailable" description="Indicator access is unavailable for this role or the indicator source could not load." icon={Target} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[.8fr_.8fr_1.4fr]">
            <article className="rounded-2xl bg-emerald-50 p-5 text-emerald-800">
              <Target className="h-5 w-5" />
              <p className="mt-6 text-4xl font-bold">{formatNumber(indicators.filter((item) => item.verification_status === "verified").length)}</p>
              <p className="mt-1 text-xs font-semibold">Verified indicators</p>
            </article>
            <article className="rounded-2xl bg-amber-50 p-5 text-amber-800">
              <Gauge className="h-5 w-5" />
              <p className="mt-6 text-4xl font-bold">{formatNumber(indicators.filter((item) => item.verification_status !== "verified").length)}</p>
              <p className="mt-1 text-xs font-semibold">Pending indicators</p>
            </article>
            <article className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-slate-900">Outcome readiness</h3><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(summaryHealth(outcomeVerification)))}>{summaryHealth(outcomeVerification)}</span></div>
              <p className="mt-6 text-4xl font-bold text-[#0c1733]">{formatPercent(outcomeVerification)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Share of visible assessments with at least one verified linked indicator.</p>
              <div className="mt-4"><ProgressValue value={outcomeVerification} tone="bg-violet-500" /></div>
            </article>
          </div>
        )}
      </Section>

      <Section title="Assessment Health Matrix" description="Executive comparison of workflow, evidence, indicators, reports, and assurance health.">
        {portfolio.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No assessment health rows are available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3">Assessment</th><th className="px-3 py-3">Programme</th><th className="px-3 py-3">Cohort</th><th className="px-3 py-3">Intervention</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Indicators</th><th className="px-3 py-3">Reports</th><th className="px-3 py-3">Health</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((item) => (
                  <tr key={item.assessment.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-3 py-3 font-semibold text-slate-900">{canOpenAssessment ? <Link href={`${ROUTE}/${item.assessment.id}`} className="hover:text-blue-700">{titleFor(item.assessment)}</Link> : titleFor(item.assessment)}</td>
                    <td className="px-3 py-3 text-slate-600">{item.assessment.impact_programmes?.name ?? UNAVAILABLE}</td>
                    <td className="px-3 py-3 text-slate-600">{item.assessment.impact_beneficiary_cohorts?.name ?? UNAVAILABLE}</td>
                    <td className="px-3 py-3 text-slate-600">{item.assessment.impact_interventions?.title ?? UNAVAILABLE}</td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1", statusTone(item.assessment.status))}>{(item.assessment.status ?? "draft").replaceAll("_", " ")}</span></td>
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

      <Section title="Review Backlog Centre" description="Attention queues derived directly from workflow status and missing linked assurance records.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Submitted awaiting review", value: submittedAssessments.length, available: true, icon: FileCheck2, tone: "bg-blue-50 text-blue-700" },
            { label: "Returned assessments", value: returnedAssessments.length, available: true, icon: RotateCcw, tone: "bg-rose-50 text-rose-700" },
            { label: "Missing evidence", value: missingEvidence.length, available: evidenceSource.available, icon: ShieldCheck, tone: "bg-amber-50 text-amber-700" },
            { label: "Missing indicators", value: missingIndicators.length, available: indicatorsSource.available, icon: Target, tone: "bg-violet-50 text-violet-700" },
            { label: "Interventions without assessment", value: interventionsWithoutAssessment.length, available: interventionsSource.available, icon: Network, tone: "bg-slate-100 text-slate-700" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className={cn("rounded-2xl p-4", item.tone)}>
                <Icon className="h-5 w-5" />
                <p className="mt-5 text-3xl font-bold">{item.available ? formatNumber(item.value) : UNAVAILABLE}</p>
                <p className="mt-1 text-[10px] font-semibold">{item.label}</p>
              </article>
            );
          })}
        </div>
        {knownHealth.length > 0 && attentionAssessments.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attentionAssessments.slice(0, 6).map((item) => (
              <article key={item.assessment.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", item.health === "At Risk" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")}><AlertTriangle className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{titleFor(item.assessment)}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{item.attentionReasons.slice(0, 2).join(" · ") || "Workflow attention required"}</p>
                    {canOpenAssessment && <Link href={`${ROUTE}/${item.assessment.id}`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">Open assessment <ArrowRight className="h-3 w-3" /></Link>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent Assessment Activity" description="Latest timestamped assessment, evidence, and indicator events available to the current role." action={<Activity className="h-4 w-4 text-slate-400" />}>
        {recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No recent assessment activity is available.</p>
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

      <Section title="Executive Assurance Summary" description="Portfolio assurance status based only on loaded assessment and linked verification sources.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Assessment Health", value: assessmentReadiness, health: summaryHealth(assessmentReadiness), icon: ClipboardCheck, tone: "bg-blue-50 text-blue-700" },
            { label: "Evidence Coverage", value: evidenceCoverage, health: summaryHealth(evidenceCoverage), icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-700" },
            { label: "Outcome Verification", value: outcomeVerification, health: summaryHealth(outcomeVerification), icon: Target, tone: "bg-violet-50 text-violet-700" },
            { label: "Reporting Readiness", value: reportingReadiness, health: summaryHealth(reportingReadiness), icon: FileCheck2, tone: "bg-indigo-50 text-indigo-700" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                </div>
                <p className="mt-5 text-3xl font-bold text-[#0c1733]">{formatPercent(item.value)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.label}</p>
                <div className="mt-4"><ProgressValue value={item.value} tone={item.label === "Evidence Coverage" ? "bg-emerald-500" : item.label === "Outcome Verification" ? "bg-violet-500" : "bg-blue-500"} /></div>
              </article>
            );
          })}
        </div>
      </Section>

      {filters.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {filters.error}
        </div>
      )}

      {canCreate && (
        <Section
          id="create-assessment"
          title="Create Cohort-Anchored Assessment"
          description="Create an assessment within the existing programme, cohort, beneficiary, intervention, and template scope."
        >
          {!programmesSource.available || !templatesSource.available || !createCohortsSource.available || !cohortMembersSource.available || !interventionsSource.available ? (
            <EmptyState title="Assessment creation options unavailable" description="One or more required creation sources could not load. No partial assessment will be created." icon={Plus} />
          ) : (
            <CreateAssessmentForm
              key={`${createProgrammeId}:${createCohortId}`}
              programmes={programmesSource.data}
              cohorts={createCohortsSource.data}
              cohortMembers={cohortMembersSource.data}
              interventions={createInterventions}
              templates={templatesSource.data}
              selectedProgrammeId={createProgrammeId}
              selectedCohortId={createCohortId}
              action={createAssessmentAction}
            />
          )}
        </Section>
      )}

      <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] text-slate-500">
        <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
        <span>Metrics use only records available within the current role, programme assignment, and delegated scope.</span>
        <span className="text-slate-300">•</span>
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <span>Missing sources remain unavailable and are not estimated.</span>
      </div>
    </section>
  );
}
