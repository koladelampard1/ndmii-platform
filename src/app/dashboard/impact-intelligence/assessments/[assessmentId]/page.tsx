import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileQuestion,
  FileText,
  Gauge,
  History,
  MapPin,
  Network,
  Pencil,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isImpactProgrammeReadDenied } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import {
  getImpactAssessmentDetail,
  getMissingRequiredAssessmentQuestions,
  reviewAssessment,
  saveAssessmentDraft,
  submitAssessment,
  type ImpactAssessmentQuestion,
  type ImpactAssessmentResponse,
} from "@/lib/data/impact-intelligence";
import {
  listImpactEvidence,
  logImpactEvidenceDiagnostic,
  type ImpactEvidenceRecord,
} from "@/lib/data/impact-evidence";
import {
  listIndicatorMeasurements,
  logImpactIndicatorDiagnostic,
  type ImpactIndicatorMeasurement,
} from "@/lib/data/impact-indicators";
import {
  getInstitutionalReport,
  listInstitutionalReports,
  logImpactReportDiagnostic,
  type InstitutionalReport,
} from "@/lib/data/impact-reports";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/assessments/[assessmentId]";
const UNAVAILABLE = "Unavailable";
const EXPECTED_ASSESSMENT_ERRORS = [
  "Required question missing:",
  "must be numeric.",
  "must be a valid date.",
  "must use one of the configured options.",
  "contains a selection that is not configured",
  "Return reason is required",
  "Reviewed or completed assessments cannot be edited.",
  "You do not have permission to manage impact assessments.",
  "You do not have permission to review impact assessments.",
];

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";
type ReportWithExportState = InstitutionalReport & { exportCount: number | null };

function isExpectedAssessmentError(error: unknown) {
  return error instanceof Error && EXPECTED_ASSESSMENT_ERRORS.some((message) => error.message.includes(message));
}

function redirectWithAssessmentError(assessmentId: string, error: unknown): never {
  const params = new URLSearchParams();
  params.set("error", error instanceof Error ? error.message : "Assessment action could not be completed.");
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}?${params.toString()}`);
}

async function saveDraftAction(assessmentId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await saveAssessmentDraft(ctx, assessmentId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "assessment_draft_save_failed", error });
    if (!isExpectedAssessmentError(error)) throw error;
    redirectWithAssessmentError(assessmentId, error);
  }
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

async function submitAssessmentAction(assessmentId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await submitAssessment(ctx, assessmentId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "assessment_submit_failed", error });
    if (!isExpectedAssessmentError(error)) throw error;
    redirectWithAssessmentError(assessmentId, error);
  }
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
}

async function reviewAssessmentAction(assessmentId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await reviewAssessment(ctx, assessmentId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "assessment_review_failed", error });
    if (!isExpectedAssessmentError(error)) throw error;
    redirectWithAssessmentError(assessmentId, error);
  }
  redirect(`/dashboard/impact-intelligence/assessments/${assessmentId}`);
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

function responseValue(question: ImpactAssessmentQuestion, responses: ImpactAssessmentResponse[]) {
  const response = responses.find((item) => item.question_id === question.id);
  if (!response) return "";
  if (question.question_type === "number") return response.response_number?.toString() ?? "";
  if (question.question_type === "boolean") return response.response_boolean === null ? "" : response.response_boolean ? "true" : "false";
  if (question.question_type === "multi-select") {
    const values = response.response_json?.values;
    return Array.isArray(values) ? values.join(", ") : response.response_text ?? "";
  }
  return response.response_text ?? "";
}

function hasResponse(question: ImpactAssessmentQuestion, responses: ImpactAssessmentResponse[]) {
  return responseValue(question, responses).trim().length > 0;
}

function optionsFor(question: ImpactAssessmentQuestion) {
  if (!Array.isArray(question.options_json)) return [];
  return question.options_json
    .map((option) => {
      if (typeof option === "string") return { label: option, value: option };
      if (option && typeof option === "object" && "value" in option) {
        return { label: String("label" in option ? option.label : option.value), value: String(option.value) };
      }
      return null;
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;
}

function QuestionInput({ question, responses, disabled }: { question: ImpactAssessmentQuestion; responses: ImpactAssessmentResponse[]; disabled: boolean }) {
  const name = `response_${question.id}`;
  const value = responseValue(question, responses);
  const baseClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
  if (question.question_type === "textarea") return <textarea disabled={disabled} name={name} rows={3} defaultValue={value} className={baseClass} />;
  if (question.question_type === "number") return <input disabled={disabled} name={name} type="number" step="0.01" defaultValue={value} className={baseClass} />;
  if (question.question_type === "boolean") {
    return (
      <select disabled={disabled} name={name} defaultValue={value} className={baseClass}>
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (question.question_type === "date") return <input disabled={disabled} name={name} type="date" defaultValue={value} className={baseClass} />;
  if (question.question_type === "select") {
    return (
      <select disabled={disabled} name={name} defaultValue={value} className={baseClass}>
        <option value="">Select</option>
        {optionsFor(question).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }
  if (question.question_type === "multi-select") return <input disabled={disabled} name={name} defaultValue={value} className={baseClass} placeholder="Comma-separated selections" />;
  if (question.question_type === "file_upload") return <input disabled={disabled} name={name} defaultValue={value} className={baseClass} placeholder="Evidence reference" />;
  return <input disabled={disabled} name={name} defaultValue={value} className={baseClass} />;
}

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
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

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatPercent(value: number | null) {
  return value === null ? UNAVAILABLE : `${value}%`;
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : UNAVAILABLE;
}

function formatMeasurement(value: number | null, unit: string | null | undefined) {
  return value === null ? UNAVAILABLE : `${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) : UNAVAILABLE;
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function average(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  return available.length > 0 ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null;
}

function latestByDate<T>(items: T[], getDate: (item: T) => string | null | undefined) {
  return [...items].sort((a, b) => String(getDate(b) ?? "").localeCompare(String(getDate(a) ?? "")))[0] ?? null;
}

function latestDate(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function toneForStatus(value: string | null | undefined) {
  const status = value?.toLowerCase() ?? "";
  if (["healthy", "ready", "approved", "verified", "reviewed", "completed", "achieved", "exceeded", "complete"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (["watchlist", "in progress", "submitted", "under review", "pending", "uploaded", "in_progress", "on track", "on_track"].includes(status)) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (["at risk", "needs attention", "rejected", "returned", "regressed", "below target", "below_target", "blocked", "missing"].includes(status)) {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function StatusPill({ value, dark = false }: { value: string | null | undefined; dark?: boolean }) {
  if (dark) {
    return <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-blue-100">{humanize(value)}</span>;
  }
  return <span className={cn("inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", toneForStatus(value))}>{humanize(value)}</span>;
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

function EmptyPanel({ title, description, icon = CircleDot }: { title: string; description: string; icon?: typeof CircleDot }) {
  const Icon = icon;
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <Icon className="mx-auto h-5 w-5 text-slate-400" />
      <p className="mt-2 text-xs font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof ClipboardCheck; tone: string }) {
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

function ProgressBar({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  if (value === null) return <span className="text-[10px] font-semibold text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div className="min-w-[88px]">
      <span className="text-[10px] font-bold text-slate-700">{value}%</span>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function readinessLabel(value: number | null) {
  if (value === null) return UNAVAILABLE;
  if (value >= 80) return "Ready";
  if (value >= 50) return "In Progress";
  return "Needs Attention";
}

function healthFromReadiness(value: number | null): HealthState {
  if (value === null) return "Unavailable";
  if (value >= 80) return "Healthy";
  if (value >= 50) return "Watchlist";
  return "At Risk";
}

function reportAssessmentIds(report: InstitutionalReport) {
  return Array.isArray(report.latest_version?.assessment_ids)
    ? report.latest_version.assessment_ids.filter((value): value is string => typeof value === "string")
    : [];
}

function isVerifiedEvidence(item: ImpactEvidenceRecord) {
  return item.status === "verified" && item.verification_status === "verified";
}

function isReviewedVisit(status: string | null) {
  return status === "reviewed";
}

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { assessmentId } = await params;
  const query = await searchParams;
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let detail: Awaited<ReturnType<typeof getImpactAssessmentDetail>> | null = null;

  try {
    ctx = await getCurrentUserContext();
    detail = await getImpactAssessmentDetail(assessmentId, ctx);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "assessment_detail_load_failed", error });
    const description = isImpactProgrammeReadDenied(error)
      ? error.message
      : "The assessment source, current session, or role assignment is temporarily unavailable.";
    return (
      <section className="space-y-6">
        <Section title="Assessment Unavailable">
          <EmptyState title="Assessment record could not load" description={description} icon={ClipboardCheck} />
        </Section>
      </section>
    );
  }

  const { assessment, template, sections, questions, responses, scores, scoreRuns, reviews, visits } = detail;
  if (!assessment) notFound();

  const [evidenceSource, indicatorsSource, reportsSource] = await Promise.all([
    loadSource(ctx, "assessment_detail_evidence_unavailable", async () => {
      try {
        return await listImpactEvidence(ctx, { assessmentId, limit: 100 });
      } catch (error) {
        logImpactEvidenceDiagnostic({
          operation: "assessment_detail_evidence_unavailable",
          actorRole: ctx.role,
          success: false,
          errorCode: "source_unavailable",
          errorMessage: error instanceof Error ? error.message : "Unknown evidence error",
        });
        throw error;
      }
    }, [] as ImpactEvidenceRecord[]),
    loadSource(ctx, "assessment_detail_indicators_unavailable", async () => {
      try {
        return await listIndicatorMeasurements(ctx, { assessmentId, limit: 100 });
      } catch (error) {
        logImpactIndicatorDiagnostic({
          operation: "assessment_detail_indicator_measurements_unavailable",
          role: ctx.role,
          authUserId: ctx.authUserId,
          appUserId: ctx.appUserId,
          assessmentId,
          errorMessage: error instanceof Error ? error.message : "Unknown indicator error",
          success: false,
        });
        throw error;
      }
    }, [] as ImpactIndicatorMeasurement[]),
    loadSource(ctx, "assessment_detail_reports_unavailable", async () => {
      try {
        const reports = await listInstitutionalReports(ctx, 100);
        return reports.filter((report) => reportAssessmentIds(report).includes(assessmentId));
      } catch (error) {
        logImpactReportDiagnostic({
          operation: "assessment_detail_reports_unavailable",
          role: ctx.role,
          appUserId: ctx.appUserId,
          errorMessage: error instanceof Error ? error.message : "Unknown report error",
          success: false,
        });
        throw error;
      }
    }, [] as InstitutionalReport[]),
  ]);

  const reportsWithExports: ReportWithExportState[] = reportsSource.available
    ? await Promise.all(reportsSource.data.map(async (report) => {
      try {
        const reportDetail = await getInstitutionalReport(ctx, report.id, { includeSources: true, enforceReadScope: false });
        return { ...report, exportCount: reportDetail.exports?.length ?? (reportDetail.exports === null ? null : 0) };
      } catch (error) {
        unstable_rethrow(error);
        logImpactReportDiagnostic({
          operation: "assessment_linked_report_exports_unavailable",
          role: ctx.role,
          appUserId: ctx.appUserId,
          reportId: report.id,
          errorMessage: error instanceof Error ? error.message : "Unknown report export error",
          success: false,
        });
        return { ...report, exportCount: null };
      }
    }))
    : [];

  const evidenceFiles = evidenceSource.data;
  const indicatorMeasurements = indicatorsSource.data;
  const linkedReports = reportsWithExports;
  const canManage = canRole(ctx.role, "assessment", "update");
  const canSubmit = canRole(ctx.role, "assessment", "submit");
  const canReview = canRole(ctx.role, "assessment", "review");
  const canApprove = canRole(ctx.role, "assessment", "approve");
  const canReturn = canRole(ctx.role, "assessment", "return");
  const canViewEvidence = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence");
  const canViewIndicators = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/indicators");
  const canViewMonitoring = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/monitoring");
  const canViewReports = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const locked = ["reviewed", "approved", "completed"].includes(assessment.status ?? "");
  const reviewable = assessment.status === "submitted" || assessment.status === "completed";
  const saveDraft = saveDraftAction.bind(null, assessment.id);
  const submit = submitAssessmentAction.bind(null, assessment.id);
  const review = reviewAssessmentAction.bind(null, assessment.id);

  const answeredQuestions = questions.filter((question) => hasResponse(question, responses));
  const missingQuestions = questions.filter((question) => !hasResponse(question, responses));
  const missingRequiredQuestions = getMissingRequiredAssessmentQuestions(questions, responses);
  const missingRequiredQuestionIds = new Set(missingRequiredQuestions.map((question) => question.id));
  const scoredResponses = responses.filter((response) => response.score !== null && response.max_score !== null);
  const overall = scores.find((score) => score.section_id === null) ?? null;
  const reviewRuns = scoreRuns.filter((run) => run.run_type === "review");
  const approvedReviews = reviews.filter((item) => item.review_status === "approved");
  const latestReviewedRun = reviewRuns[0] ?? null;
  const latestApprovedReview = approvedReviews[0] ?? null;
  const latestApprovedRun = latestApprovedReview
    ? latestByDate(
      reviewRuns.filter((run) => run.calculated_at <= latestApprovedReview.created_at),
      (run) => run.calculated_at,
    )
    : null;

  const verifiedEvidence = evidenceFiles.filter(isVerifiedEvidence);
  const submittedEvidence = evidenceFiles.filter((item) => item.status === "submitted" || item.status === "under_review");
  const returnedEvidence = evidenceFiles.filter((item) => item.status === "returned");
  const rejectedEvidence = evidenceFiles.filter((item) => item.status === "rejected");
  const reviewedVisits = visits.filter((visit) => isReviewedVisit(visit.status));
  const pendingVisits = visits.filter((visit) => !isReviewedVisit(visit.status));
  const latestVisit = latestByDate(visits, (visit) => visit.reviewed_at ?? visit.completed_at ?? visit.visit_date ?? visit.created_at);
  const verifiedMeasurements = indicatorMeasurements.filter((item) => item.verification_status === "verified");
  const latestVerifiedMeasurement = latestByDate(verifiedMeasurements, (item) => item.verified_at ?? item.measurement_date ?? item.created_at);
  const uniqueIndicatorIds = new Set(indicatorMeasurements.map((item) => item.indicator_definition_id));
  const approvedReports = linkedReports.filter((report) => report.status === "approved");

  const assessmentReadiness = ratio(answeredQuestions.length, questions.length);
  const evidenceReadiness = evidenceSource.available ? (evidenceFiles.length > 0 ? ratio(verifiedEvidence.length, evidenceFiles.length) : 0) : null;
  const monitoringReadiness = visits.length > 0 ? ratio(reviewedVisits.length, visits.length) : 0;
  const outcomeReadiness = indicatorsSource.available ? (indicatorMeasurements.length > 0 ? ratio(verifiedMeasurements.length, indicatorMeasurements.length) : 0) : null;
  const reportingReadiness = reportsSource.available ? (linkedReports.length > 0 ? ratio(approvedReports.length, linkedReports.length) : 0) : null;
  const readiness = average([assessmentReadiness, evidenceReadiness, monitoringReadiness, outcomeReadiness, reportingReadiness]);

  const risks = [
    ...(missingRequiredQuestions.length > 0 ? [`${missingRequiredQuestions.length} required assessment response${missingRequiredQuestions.length === 1 ? " is" : "s are"} missing.`] : []),
    ...(evidenceSource.available && evidenceFiles.length === 0 ? ["No evidence is linked to this assessment."] : []),
    ...(submittedEvidence.length > 0 ? [`${submittedEvidence.length} evidence item${submittedEvidence.length === 1 ? " is" : "s are"} awaiting verification.`] : []),
    ...(returnedEvidence.length > 0 ? [`${returnedEvidence.length} evidence item${returnedEvidence.length === 1 ? " was" : "s were"} returned.`] : []),
    ...(rejectedEvidence.length > 0 ? [`${rejectedEvidence.length} evidence item${rejectedEvidence.length === 1 ? " failed" : "s failed"} verification.`] : []),
    ...(visits.length === 0 ? ["No monitoring visit is linked to this assessment."] : []),
    ...(pendingVisits.length > 0 ? [`${pendingVisits.length} monitoring visit${pendingVisits.length === 1 ? " is" : "s are"} pending review.`] : []),
    ...(indicatorsSource.available && indicatorMeasurements.length === 0 ? ["No indicator measurement is linked to this assessment."] : []),
    ...(indicatorMeasurements.length > verifiedMeasurements.length ? [`${indicatorMeasurements.length - verifiedMeasurements.length} indicator measurement${indicatorMeasurements.length - verifiedMeasurements.length === 1 ? " is" : "s are"} not verified.`] : []),
    ...(reportsSource.available && linkedReports.length === 0 ? ["No institutional report references this assessment."] : []),
    ...(linkedReports.length > approvedReports.length ? [`${linkedReports.length - approvedReports.length} linked report${linkedReports.length - approvedReports.length === 1 ? " is" : "s are"} not approved.`] : []),
  ];
  const failedVerification = rejectedEvidence.length + indicatorMeasurements.filter((item) => item.verification_status === "rejected").length;
  const openIssues = evidenceSource.available && indicatorsSource.available && reportsSource.available ? risks.length : null;
  const reportReady = assessment.status === "approved"
    && verifiedEvidence.length > 0
    && reviewedVisits.length > 0
    && verifiedMeasurements.length > 0
    && approvedReports.length > 0;
  const allAssuranceSourcesAvailable = evidenceSource.available && indicatorsSource.available && reportsSource.available;
  const health: HealthState = !allAssuranceSourcesAvailable
    ? "Unavailable"
    : assessment.status === "returned" || failedVerification > 0
      ? "At Risk"
      : reportReady && risks.length === 0
        ? "Healthy"
        : "Watchlist";

  const readinessControls = [
    { label: "Assessment", value: assessmentReadiness, icon: ClipboardCheck },
    { label: "Evidence", value: evidenceReadiness, icon: ShieldCheck },
    { label: "Monitoring", value: monitoringReadiness, icon: CalendarCheck },
    { label: "Outcome", value: outcomeReadiness, icon: Target },
    { label: "Reporting", value: reportingReadiness, icon: FileCheck2 },
  ];
  const lifecycle = [
    { label: "Draft", complete: Boolean(assessment.created_at) },
    { label: "Submitted", complete: Boolean(assessment.submitted_at) || ["submitted", "reviewed", "approved", "completed"].includes(assessment.status ?? "") },
    { label: "Reviewed", complete: reviews.some((item) => ["reviewed", "approved"].includes(item.review_status)) || ["reviewed", "approved"].includes(assessment.status ?? "") },
    { label: "Approved", complete: assessment.status === "approved" || approvedReviews.length > 0 },
    { label: "Evidence Verified", complete: verifiedEvidence.length > 0 },
    { label: "Indicators Verified", complete: verifiedMeasurements.length > 0 },
    { label: "Report Ready", complete: reportReady },
  ];
  const currentLifecycleIndex = lifecycle.reduce((current, item, index) => item.complete ? index : current, 0);
  const latestRecord = latestDate([
    assessment.created_at,
    assessment.conducted_at,
    assessment.submitted_at,
    assessment.returned_at,
    ...responses.map((item) => item.updated_at ?? item.created_at),
    ...scoreRuns.map((item) => item.calculated_at),
    ...reviews.map((item) => item.created_at),
    ...visits.map((item) => item.reviewed_at ?? item.completed_at ?? item.created_at),
    ...evidenceFiles.map((item) => item.reviewed_at ?? item.submitted_at ?? item.created_at),
    ...indicatorMeasurements.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...linkedReports.map((item) => item.approved_at ?? item.generated_at ?? item.created_at),
  ]);

  const activity = [
    ...(assessment.created_at ? [{ type: "Assessment created", title: assessment.title ?? template?.name ?? "Assessment", date: assessment.created_at, href: null as string | null, icon: ClipboardCheck }] : []),
    ...(assessment.submitted_at ? [{ type: "Assessment submitted", title: assessment.title ?? template?.name ?? "Assessment", date: assessment.submitted_at, href: null as string | null, icon: FileCheck2 }] : []),
    ...reviews.map((item) => ({
      type: `Assessment ${humanize(item.review_status).toLowerCase()}`,
      title: item.notes ?? "Review decision recorded",
      date: item.created_at,
      href: null as string | null,
      icon: ShieldCheck,
    })),
    ...evidenceFiles.filter((item) => item.submitted_at).map((item) => ({
      type: "Evidence linked",
      title: item.original_filename ?? item.file_name,
      date: item.submitted_at,
      href: canViewEvidence ? `/dashboard/impact-intelligence/evidence/${item.id}` : null,
      icon: FileText,
    })),
    ...verifiedEvidence.map((item) => ({
      type: "Evidence verified",
      title: item.original_filename ?? item.file_name,
      date: item.reviewed_at ?? item.created_at,
      href: canViewEvidence ? `/dashboard/impact-intelligence/evidence/${item.id}` : null,
      icon: ShieldCheck,
    })),
    ...verifiedMeasurements.map((item) => ({
      type: "Indicator verified",
      title: item.impact_indicator_definitions?.name ?? "Indicator measurement",
      date: item.verified_at ?? item.created_at,
      href: canViewIndicators ? "/dashboard/impact-intelligence/indicators" : null,
      icon: Target,
    })),
    ...linkedReports.map((item) => ({
      type: "Report generated",
      title: item.title,
      date: item.generated_at ?? item.created_at,
      href: canViewReports ? `/dashboard/impact-intelligence/reports/${item.id}` : null,
      icon: FileText,
    })),
  ]
    .filter((item) => Boolean(item.date))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 12);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <Link href="/dashboard/impact-intelligence/assessments" className="hover:text-emerald-700">Assessments</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">{assessment.title ?? template?.name ?? "Assessment"}</span>
            </nav>
            <p className="mt-2 text-xs text-slate-500">Assessment Review &amp; Verification War Room</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-blue-700">
              <Activity className="h-4 w-4" />
              <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Last updated</p>
              <p className="text-[11px] font-semibold text-slate-700">{formatDateTime(latestRecord)}</p>
            </div>
          </div>
        </div>
      </header>

      {query.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{query.error}</div>}
      {assessment.status === "returned" && assessment.return_reason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-bold">Returned for correction:</span> {assessment.return_reason}
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_78%_24%,rgba(37,99,235,0.45),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_58%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 320" className="h-full w-full">
            <defs>
              <pattern id="assessment-war-room-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#60a5fa" />
              </pattern>
            </defs>
            <path d="M540 34 650 20l82 42 75 4 47 70-52 52 12 65-104 20-68-42-82 18-48-78 24-61Z" fill="url(#assessment-war-room-dots)" stroke="#38bdf8" strokeOpacity=".4" />
            <path d="M458 260c82-66 128-128 203-88 68 37 102 7 171-83" fill="none" stroke="#38bdf8" strokeOpacity=".55" />
            <circle cx="661" cy="171" r="5" fill="#22d3ee" />
            <circle cx="735" cy="181" r="4" fill="#a855f7" />
            <circle cx="831" cy="89" r="4" fill="#34d399" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={assessment.status ?? "draft"} dark />
                <StatusPill value={assessment.assessment_type ?? template?.assessment_type} dark />
                <StatusPill value={health} dark />
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">{template?.name ?? "Assessment"} v{assessment.template_version ?? template?.version ?? 1}</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">{assessment.title ?? template?.name ?? "MSME assessment"}</h1>
              <div className="mt-5 grid gap-3 text-xs text-blue-100/80 sm:grid-cols-2">
                <span className="inline-flex items-center gap-2"><Network className="h-4 w-4 text-cyan-300" /> {assessment.impact_programmes?.name ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4 text-violet-300" /> {assessment.msmes?.business_name ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-300" /> {assessment.impact_beneficiary_cohorts?.name ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-300" /> Created {formatDate(assessment.created_at)}</span>
                <span className="inline-flex items-center gap-2"><Target className="h-4 w-4 text-fuchsia-300" /> {assessment.impact_interventions?.title ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-300" /> Updated {formatDateTime(latestRecord)}</span>
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[420px]">
              {[
                { label: "Assessment health", value: health, icon: Gauge },
                { label: "Assessment score", value: formatScore(overall?.weighted_score ?? assessment.score), icon: BarChart3 },
                { label: "Overall readiness", value: formatPercent(readiness), icon: FileCheck2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-[#081b3d]/75 p-4 backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-cyan-300" />
                    <p className="mt-3 text-lg font-bold">{item.value}</p>
                    <p className="mt-1 text-[10px] font-medium text-blue-100/65">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
            {[
              ["Assessment Complete", missingRequiredQuestions.length === 0 && answeredQuestions.length === questions.length],
              ["Evidence Verified", verifiedEvidence.length > 0],
              ["Monitoring Complete", reviewedVisits.length > 0 && pendingVisits.length === 0],
              ["Outcome Verified", verifiedMeasurements.length > 0],
              ["Report Ready", reportReady],
            ].map(([label, complete]) => (
              <span key={String(label)} className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-bold",
                complete ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/15 bg-white/10 text-blue-100",
              )}>
                {String(label)}: {complete ? "Yes" : "No"}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {canManage && !locked && (
              <Link href="#responses" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white transition hover:bg-emerald-400">
                <Pencil className="h-4 w-4" /> Edit Assessment
              </Link>
            )}
            {canSubmit && canManage && !locked && (
              <Button type="submit" form="assessment-response-form" formAction={submit} className="h-10 rounded-xl bg-blue-500 px-4 text-xs font-bold hover:bg-blue-400">
                Submit
              </Button>
            )}
            {canReview && reviewable && (
              <form action={review}>
                <input type="hidden" name="review_status" value="reviewed" />
                <Button type="submit" className="h-10 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold hover:bg-white/15">Review</Button>
              </form>
            )}
            {canApprove && reviewable && (
              <form action={review}>
                <input type="hidden" name="review_status" value="approved" />
                <Button type="submit" className="h-10 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold hover:bg-white/15">Approve</Button>
              </form>
            )}
            {canReturn && reviewable && (
              <Link href="#review" className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15">Return</Link>
            )}
            {canViewEvidence && (
              <Link href="#evidence" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-blue-100 transition hover:bg-white/10">
                View Evidence <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Assessment Score" value={formatScore(overall?.weighted_score ?? assessment.score)} icon={BarChart3} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Questions Answered" value={questions.length > 0 ? `${answeredQuestions.length}/${questions.length}` : UNAVAILABLE} icon={ClipboardCheck} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Evidence Linked" value={evidenceSource.available ? formatNumber(evidenceFiles.length) : UNAVAILABLE} icon={ShieldCheck} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Monitoring Visits" value={formatNumber(visits.length)} icon={CalendarCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Indicators Linked" value={indicatorsSource.available ? formatNumber(uniqueIndicatorIds.size) : UNAVAILABLE} icon={Target} tone="bg-purple-100 text-purple-700" />
        <MetricCard label="Reports Linked" value={reportsSource.available ? formatNumber(linkedReports.length) : UNAVAILABLE} icon={FileText} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Open Issues" value={formatNumber(openIssues)} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="Readiness" value={formatPercent(readiness)} icon={Gauge} tone="bg-emerald-100 text-emerald-700" />
      </div>

      <Section title="Assurance Lifecycle Journey" description="Current verification position based on real assessment and linked assurance records.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {lifecycle.map((item, index) => (
            <div key={item.label} className={cn(
              "rounded-2xl border p-4",
              index === currentLifecycleIndex ? "border-blue-300 bg-blue-50 shadow-sm" : item.complete ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/60",
            )}>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-xs font-bold",
                  item.complete ? "bg-emerald-500 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200",
                )}>{item.complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>
                {index === currentLifecycleIndex && <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-blue-700">Current</span>}
              </div>
              <p className="mt-4 text-xs font-bold text-slate-800">{item.label}</p>
              <p className="mt-1 text-[10px] text-slate-500">{item.complete ? "Reached" : UNAVAILABLE}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <Section title="Assessment Subject Profile" description="The beneficiary and intervention context attached to this assessment.">
          <div className="rounded-2xl bg-slate-50 p-5">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700"><UserRound className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-[#0c1733]">{assessment.msmes?.business_name ?? UNAVAILABLE}</h3>
                <p className="mt-1 text-xs text-slate-500">{assessment.msmes?.msme_id ?? UNAVAILABLE}</p>
                <div className="mt-3"><StatusPill value={assessment.impact_cohort_members?.member_status} /></div>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
              {[
                ["Beneficiary", assessment.impact_cohort_members?.id ?? UNAVAILABLE],
                ["MSME", assessment.msmes?.business_name ?? UNAVAILABLE],
                ["Cohort", assessment.impact_beneficiary_cohorts?.name ?? UNAVAILABLE],
                ["Programme", assessment.impact_programmes?.name ?? UNAVAILABLE],
                ["Sector", assessment.msmes?.sector ?? UNAVAILABLE],
                ["State", assessment.msmes?.state ?? UNAVAILABLE],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
                  <dd className="mt-1 text-xs font-semibold text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-blue-600">Intervention context</p>
              <p className="mt-2 text-sm font-bold text-blue-950">{assessment.impact_interventions?.title ?? UNAVAILABLE}</p>
              <p className="mt-1 text-[11px] text-blue-700">Linked field visit: {assessment.impact_field_visits?.title ?? UNAVAILABLE}</p>
            </div>
          </div>
        </Section>

        <Section title="Assessment Score Centre" description="Current score, immutable scoring runs, and assurance review checkpoints.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#0b1e42] p-5 text-white">
              <Gauge className="h-5 w-5 text-cyan-300" />
              <p className="mt-4 text-3xl font-bold">{formatScore(overall?.weighted_score ?? assessment.score)}</p>
              <p className="mt-1 text-[10px] text-blue-100/70">Overall assessment score</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-semibold text-slate-500">Latest reviewed score</p>
              <p className="mt-2 text-xl font-bold text-[#0c1733]">{formatScore(latestReviewedRun?.weighted_score)}</p>
              <p className="mt-1 text-[9px] text-slate-500">{formatDateTime(latestReviewedRun?.calculated_at)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-semibold text-slate-500">Latest approved score</p>
              <p className="mt-2 text-xl font-bold text-[#0c1733]">{formatScore(latestApprovedRun?.weighted_score)}</p>
              <p className="mt-1 text-[9px] text-slate-500">{formatDateTime(latestApprovedReview?.created_at)}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] text-slate-500">Score runs</p><p className="mt-2 text-lg font-bold text-slate-900">{scoreRuns.length}</p></div>
            <div className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] text-slate-500">Reviewed runs</p><p className="mt-2 text-lg font-bold text-slate-900">{reviewRuns.length}</p></div>
            <div className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] text-slate-500">Approved reviews</p><p className="mt-2 text-lg font-bold text-slate-900">{approvedReviews.length}</p></div>
          </div>
          {scoreRuns.length === 0 ? (
            <div className="mt-5"><EmptyPanel title="Score history unavailable" description="Scores will appear after assessment responses are saved and calculated." icon={History} /></div>
          ) : (
            <div className="mt-5 space-y-2">
              {scoreRuns.slice(0, 6).map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div><p className="text-xs font-bold text-slate-800">{humanize(run.run_type)} run</p><p className="mt-1 text-[9px] text-slate-500">{formatDateTime(run.calculated_at)} · Model v{run.scoring_model_version}</p></div>
                  <div className="text-right"><p className="text-sm font-bold text-[#0c1733]">{formatScore(run.weighted_score)}</p><StatusPill value={run.readiness_category} /></div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Assessment Responses Zone" description="Response completion, required-answer gaps, and saved response quality.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] text-slate-500">Completion state</p><div className="mt-2"><StatusPill value={missingRequiredQuestions.length === 0 && missingQuestions.length === 0 ? "Complete" : "In Progress"} /></div></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] text-slate-500">Answered questions</p><p className="mt-2 text-lg font-bold text-slate-900">{questions.length > 0 ? `${answeredQuestions.length}/${questions.length}` : UNAVAILABLE}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] text-slate-500">Missing questions</p><p className="mt-2 text-lg font-bold text-slate-900">{questions.length > 0 ? missingQuestions.length : UNAVAILABLE}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] text-slate-500">Scored responses</p><p className="mt-2 text-lg font-bold text-slate-900">{responses.length > 0 ? `${scoredResponses.length}/${responses.length}` : UNAVAILABLE}</p></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-semibold text-slate-500">Overall completion</p><div className="mt-2"><ProgressBar value={assessmentReadiness} tone="bg-blue-500" /></div></div>
          <div className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-semibold text-slate-500">Required gaps</p><p className="mt-2 text-lg font-bold text-slate-900">{questions.length > 0 ? missingRequiredQuestions.length : UNAVAILABLE}</p></div>
          <div className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-semibold text-slate-500">Latest saved response</p><p className="mt-2 text-xs font-bold text-slate-800">{formatDateTime(latestDate(responses.map((item) => item.updated_at ?? item.created_at)))}</p></div>
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Monitoring Assurance Centre" description="Linked visits, review state, and the latest monitoring finding.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-cyan-50 p-4"><p className="text-[10px] text-cyan-700">Linked field visits</p><p className="mt-2 text-xl font-bold text-cyan-950">{visits.length}</p></div>
            <div className="rounded-xl bg-emerald-50 p-4"><p className="text-[10px] text-emerald-700">Reviewed visits</p><p className="mt-2 text-xl font-bold text-emerald-950">{reviewedVisits.length}</p></div>
            <div className="rounded-xl bg-amber-50 p-4"><p className="text-[10px] text-amber-700">Pending review</p><p className="mt-2 text-xl font-bold text-amber-950">{pendingVisits.length}</p></div>
          </div>
          {latestVisit ? (
            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-bold text-[#0c1733]">{latestVisit.title ?? "Field visit"}</p><p className="mt-1 text-[10px] text-slate-500">{formatDate(latestVisit.visit_date)} · {latestVisit.location_text ?? UNAVAILABLE}</p></div>
                <StatusPill value={latestVisit.status} />
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-600">{latestVisit.findings ?? latestVisit.recommendations ?? "No visit summary has been recorded."}</p>
              {canViewMonitoring && <Link href={`/dashboard/impact-intelligence/monitoring/${latestVisit.id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">Open visit <ArrowRight className="h-3.5 w-3.5" /></Link>}
            </div>
          ) : (
            <div className="mt-5"><EmptyPanel title="No monitoring linked" description="No field visit is currently linked to this assessment." icon={CalendarCheck} /></div>
          )}
          {visits.length > 1 && (
            <div className="mt-4 space-y-2">
              {visits.slice(0, 5).map((visit) => (
                <div key={visit.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div><p className="text-xs font-semibold text-slate-800">{visit.title ?? "Field visit"}</p><p className="mt-1 text-[9px] text-slate-500">{formatDate(visit.visit_date ?? visit.created_at)}</p></div>
                  <StatusPill value={visit.status} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section id="evidence" title="Evidence Verification Centre" description="Submitted assurance files and their verification integrity.">
          {!evidenceSource.available ? (
            <EmptyPanel title="Evidence unavailable" description="The evidence source could not be loaded. Other assessment sections remain available." icon={ShieldCheck} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] text-emerald-700">Verified</p><p className="mt-2 text-lg font-bold text-emerald-950">{verifiedEvidence.length}</p></div>
                <div className="rounded-xl bg-blue-50 p-3"><p className="text-[9px] text-blue-700">Submitted</p><p className="mt-2 text-lg font-bold text-blue-950">{submittedEvidence.length}</p></div>
                <div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] text-amber-700">Returned</p><p className="mt-2 text-lg font-bold text-amber-950">{returnedEvidence.length}</p></div>
                <div className="rounded-xl bg-rose-50 p-3"><p className="text-[9px] text-rose-700">Rejected</p><p className="mt-2 text-lg font-bold text-rose-950">{rejectedEvidence.length}</p></div>
              </div>
              {evidenceFiles.length === 0 ? (
                <div className="mt-5"><EmptyPanel title="No evidence linked" description="No evidence item references this assessment." icon={FileQuestion} /></div>
              ) : (
                <div className="mt-5 space-y-2">
                  {evidenceFiles.slice(0, 8).map((item) => {
                    const content = (
                      <div className="rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/30">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{item.original_filename ?? item.file_name}</p><p className="mt-1 text-[9px] text-slate-500">{humanize(item.evidence_category ?? item.evidence_type)}</p></div>
                          <StatusPill value={item.verification_status ?? item.status} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1">Checksum {item.checksum_sha256 ? "Present" : "Unavailable"}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1">Visit {item.impact_field_visits?.title ?? UNAVAILABLE}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1">Intervention {item.impact_interventions?.title ?? UNAVAILABLE}</span>
                        </div>
                      </div>
                    );
                    return canViewEvidence ? <Link key={item.id} href={`/dashboard/impact-intelligence/evidence/${item.id}`}>{content}</Link> : <div key={item.id}>{content}</div>;
                  })}
                </div>
              )}
            </>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Section title="Outcome Verification Centre" description="Only verified indicator measurements contribute to outcome posture.">
          {!indicatorsSource.available ? (
            <EmptyPanel title="Outcome data unavailable" description="Indicator measurements could not be loaded for this assessment." icon={Target} />
          ) : verifiedMeasurements.length === 0 ? (
            <EmptyPanel title="No verified outcomes" description="No verified indicator measurement currently references this assessment." icon={Target} />
          ) : (
            <div className="space-y-3">
              {verifiedMeasurements.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="text-xs font-bold text-[#0c1733]">{item.impact_indicator_definitions?.name ?? "Indicator measurement"}</p><p className="mt-1 text-[9px] text-slate-500">Verified {formatDate(item.verified_at)} · {humanize(item.source_type)}</p></div>
                    <StatusPill value={item.outcome_status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><p className="text-[9px] text-slate-400">Baseline</p><p className="mt-1 text-xs font-bold text-slate-700">{formatMeasurement(item.baseline_value, item.impact_indicator_definitions?.unit_of_measure)}</p></div>
                    <div><p className="text-[9px] text-slate-400">Current</p><p className="mt-1 text-xs font-bold text-slate-700">{formatMeasurement(item.measured_value, item.impact_indicator_definitions?.unit_of_measure)}</p></div>
                    <div><p className="text-[9px] text-slate-400">Target</p><p className="mt-1 text-xs font-bold text-slate-700">{formatMeasurement(item.target_value, item.impact_indicator_definitions?.unit_of_measure)}</p></div>
                    <div><p className="text-[9px] text-slate-400">Progress</p><div className="mt-1"><ProgressBar value={item.progress_percentage === null ? null : Math.round(item.progress_percentage)} tone="bg-purple-500" /></div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {latestVerifiedMeasurement && <p className="mt-4 text-[10px] text-slate-500">Latest verified outcome: {formatDateTime(latestVerifiedMeasurement.verified_at ?? latestVerifiedMeasurement.created_at)}</p>}
        </Section>

        <Section title="Reporting Readiness Centre" description="Assurance controls required for defensible institutional reporting.">
          <div className="space-y-3">
            {readinessControls.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-600"><Icon className="h-4 w-4 text-blue-600" /> {item.label} readiness</span>
                    <StatusPill value={readinessLabel(item.value)} />
                  </div>
                  <div className="mt-3"><ProgressBar value={item.value} tone="bg-blue-500" /></div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl bg-[#0b1e42] p-5 text-white">
            <FileCheck2 className="h-5 w-5 text-cyan-300" />
            <p className="mt-4 text-2xl font-bold">{formatPercent(readiness)}</p>
            <p className="mt-1 text-[10px] text-blue-100/70">Composite readiness from available assessment, evidence, monitoring, outcome, and reporting controls.</p>
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Section title="Risks &amp; Exceptions" description="Real gaps, pending decisions, failed verification, and reporting blockers.">
          {!allAssuranceSourcesAvailable && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-slate-500" />
              <p className="text-[11px] font-semibold text-slate-700">One or more assurance sources are unavailable. Issue totals may be incomplete.</p>
            </div>
          )}
          {risks.length === 0 ? (
            <EmptyPanel title="No current exceptions" description="No blockers are present across the loaded assurance sources." icon={CheckCircle2} />
          ) : (
            <div className="space-y-2">
              {risks.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-[11px] font-semibold leading-5 text-amber-950">{item}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Linked Reports" description="Institutional reports that explicitly reference this assessment.">
          {!reportsSource.available ? (
            <EmptyPanel title="Reports unavailable" description="Linked institutional reports could not be loaded." icon={FileText} />
          ) : linkedReports.length === 0 ? (
            <EmptyPanel title="No linked reports" description="No institutional report version currently references this assessment." icon={FileText} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {linkedReports.map((report) => (
                <div key={report.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-xs font-bold text-[#0c1733]">{report.title}</p><p className="mt-1 text-[9px] text-slate-500">{humanize(report.report_type)}</p></div>
                    <StatusPill value={report.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Version</dt><dd className="mt-1 text-[11px] font-bold text-slate-700">{report.latest_version?.version_number ?? UNAVAILABLE}</dd></div>
                    <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Approval</dt><dd className="mt-1 text-[11px] font-bold text-slate-700">{report.approved_at ? "Approved" : UNAVAILABLE}</dd></div>
                    <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Export</dt><dd className="mt-1 text-[11px] font-bold text-slate-700">{report.exportCount === null ? UNAVAILABLE : report.exportCount > 0 ? "Available" : "Not generated"}</dd></div>
                  </dl>
                  {canViewReports && <Link href={`/dashboard/impact-intelligence/reports/${report.id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">Open report <ArrowRight className="h-3.5 w-3.5" /></Link>}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Section title="Activity Timeline" description="Real assessment, evidence, outcome, review, and reporting activity.">
          {activity.length === 0 ? (
            <EmptyPanel title="No activity recorded" description="No dated activity is available for this assessment." icon={Activity} />
          ) : (
            <ol className="space-y-3">
              {activity.map((item, index) => {
                const Icon = item.icon;
                const content = (
                  <div className="flex gap-3 rounded-xl border border-slate-200 p-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">{item.type}</p><p className="mt-1 truncate text-xs font-semibold text-slate-800">{item.title}</p></div>
                        <p className="shrink-0 text-[9px] text-slate-500">{formatDateTime(item.date)}</p>
                      </div>
                    </div>
                  </div>
                );
                return <li key={`${item.type}-${item.date}-${index}`}>{item.href ? <Link href={item.href}>{content}</Link> : content}</li>;
              })}
            </ol>
          )}
        </Section>

        <Section title="Executive Assurance Summary" description="Current health across the assessment verification chain.">
          <div className="space-y-3">
            {[
              ["Assessment Health", health],
              ["Evidence Health", healthFromReadiness(evidenceReadiness)],
              ["Monitoring Health", healthFromReadiness(monitoringReadiness)],
              ["Outcome Health", healthFromReadiness(outcomeReadiness)],
              ["Reporting Health", healthFromReadiness(reportingReadiness)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                <StatusPill value={value} />
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-[#0b1e42] p-5 text-white">
            <Gauge className="h-5 w-5 text-cyan-300" />
            <p className="mt-4 text-2xl font-bold">{formatPercent(readiness)}</p>
            <p className="mt-1 text-[10px] text-blue-100/70">Executive readiness based only on loaded, scoped records.</p>
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <form id="assessment-response-form" action={saveDraft} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
          <div id="responses" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-sm font-bold text-[#0c1733] sm:text-base">Assessment Response Record</h2><p className="mt-1 text-xs text-slate-500">Existing editable workflow retained within the verification workspace.</p></div>
            {canManage && !locked && (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="secondary" className="rounded-xl">Save Draft</Button>
                {canSubmit && <Button type="submit" formAction={submit} className="rounded-xl bg-blue-700 hover:bg-blue-600">Submit Assessment</Button>}
              </div>
            )}
          </div>
          <div className="mt-5 space-y-4">
            {sections.length === 0 ? (
              <EmptyPanel title="No assessment sections" description="This assessment template has no configured sections." icon={ClipboardCheck} />
            ) : (
              sections.map((section) => {
                const sectionQuestions = questions.filter((question) => question.section_id === section.id);
                return (
                  <section key={section.id} className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div><h3 className="text-xs font-bold text-slate-900">{section.title}</h3><p className="mt-1 text-[10px] text-slate-500">{section.description ?? "Assessment section"}</p></div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-slate-600 ring-1 ring-slate-200">Weight {section.weight}</span>
                      </div>
                    </div>
                    <div className="space-y-5 p-4">
                      {sectionQuestions.map((question) => (
                        <label key={question.id} className="block space-y-2 text-sm font-medium text-slate-700">
                          <span className="flex flex-wrap items-center gap-2">
                            <span>{question.question_text}</span>
                            {question.is_required && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Required</span>}
                            {missingRequiredQuestionIds.has(question.id) && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Missing</span>}
                          </span>
                          <QuestionInput question={question} responses={responses} disabled={!canManage || locked} />
                          {missingRequiredQuestionIds.has(question.id) && (
                            <span className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                              This required question must be answered before submission.
                            </span>
                          )}
                          <span className="block text-[10px] font-normal text-slate-500">{humanize(question.category ?? "uncategorized")} · Weight {question.weight}{question.help_text ? ` · ${question.help_text}` : ""}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </form>

        <aside className="space-y-5">
          {reviewable && (canReview || canApprove || canReturn) && (
            <form id="review" action={review} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50">
              <h2 className="text-sm font-bold text-[#0c1733]">Review Assessment</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Record the permitted review decision using the existing workflow.</p>
              <select name="review_status" defaultValue={canReview ? "reviewed" : canApprove ? "approved" : "returned"} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                {canReview && <option value="reviewed">Reviewed</option>}
                {canApprove && <option value="approved">Approved</option>}
                {canReturn && <option value="returned">Return for update</option>}
              </select>
              <input name="return_reason" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Return reason when correction is required" />
              <textarea name="notes" rows={4} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Review notes" />
              <Button type="submit" className="mt-3 w-full rounded-xl bg-blue-700 hover:bg-blue-600">Submit Review</Button>
            </form>
          )}

          <Section title="Review History" description="Recorded assessment decisions.">
            {reviews.length === 0 ? (
              <EmptyPanel title="No reviews recorded" description="Review decisions will appear here." icon={History} />
            ) : (
              <div className="space-y-2">
                {reviews.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3"><StatusPill value={item.review_status} /><span className="text-[9px] text-slate-500">{formatDateTime(item.created_at)}</span></div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-600">{item.notes ?? "No review notes recorded."}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </aside>
      </div>
    </section>
  );
}
