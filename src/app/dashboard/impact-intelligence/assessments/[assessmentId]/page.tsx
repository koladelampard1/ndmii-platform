import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Database,
  FileCheck2,
  FileQuestion,
  FileText,
  Gauge,
  Layers3,
  LockKeyhole,
  Network,
  Pencil,
  RotateCcw,
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
  type ImpactAssessmentScore,
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
import { EmptyState, impactStatusTone } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/assessments/[assessmentId]";
const EVIDENCE_UPLOAD_ROUTE = "/dashboard/impact-intelligence/evidence/upload";
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

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function storedResponseIssue(question: ImpactAssessmentQuestion, responses: ImpactAssessmentResponse[]) {
  const raw = responseValue(question, responses).trim();
  if (!raw) return null;
  if (question.question_type === "number" && !Number.isFinite(Number(raw))) return `${question.question_text} must be numeric.`;
  if (question.question_type === "date" && !isValidIsoDate(raw)) return `${question.question_text} must be a valid date.`;
  const optionValues = optionsFor(question).map((item) => item.value);
  if (question.question_type === "select" && optionValues.length > 0 && !optionValues.includes(raw)) return `${question.question_text} must use one of the configured options.`;
  if (question.question_type === "multi-select" && optionValues.length > 0) {
    const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
    if (values.some((item) => !optionValues.includes(item))) return `${question.question_text} contains a selection that is not configured for this template.`;
  }
  return null;
}

function QuestionInput({ question, responses, disabled }: { question: ImpactAssessmentQuestion; responses: ImpactAssessmentResponse[]; disabled: boolean }) {
  const name = `response_${question.id}`;
  const value = responseValue(question, responses);
  const baseClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
  if (question.question_type === "textarea") return <textarea disabled={disabled} name={name} rows={4} defaultValue={value} className={baseClass} />;
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

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? UNAVAILABLE : `${value}%`;
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

function latestDate(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function StatusPill({ value, dark = false }: { value: string | null | undefined; dark?: boolean }) {
  if (dark) {
    return <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-blue-100">{humanize(value)}</span>;
  }
  return <span className={cn("inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", impactStatusTone(value))}>{humanize(value)}</span>;
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

function EmptyPanel({ title, description, icon = CircleDot }: { title: string; description: string; icon?: LucideIcon }) {
  const Icon = icon;
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <Icon className="mx-auto h-5 w-5 text-slate-400" />
      <p className="mt-2 text-xs font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function StudioMetric({ label, value, icon: Icon, tone = "bg-blue-50 text-blue-700" }: { label: string; value: string; icon: LucideIcon; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-[#0c1733]">{value}</p>
          <p className="truncate text-[10px] font-semibold text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  if (value === null) return <span className="text-[10px] font-semibold text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold text-slate-700">{value}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function reportAssessmentIds(report: InstitutionalReport) {
  return Array.isArray(report.latest_version?.assessment_ids)
    ? report.latest_version.assessment_ids.filter((value): value is string => typeof value === "string")
    : [];
}

function isVerifiedEvidence(item: ImpactEvidenceRecord) {
  return item.status === "verified" && item.verification_status === "verified";
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

function sectionCompletion(sectionQuestions: ImpactAssessmentQuestion[], responses: ImpactAssessmentResponse[]) {
  return ratio(sectionQuestions.filter((question) => hasResponse(question, responses)).length, sectionQuestions.length);
}

function scoreForSection(scores: ImpactAssessmentScore[], sectionId: string) {
  return scores.find((item) => item.section_id === sectionId) ?? null;
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
  if (!assessment || !ctx) notFound();

  const [evidenceSource, indicatorsSource, reportsSource] = await Promise.all([
    loadSource(ctx, "assessment_execution_evidence_unavailable", async () => {
      try {
        return await listImpactEvidence(ctx, { assessmentId, limit: 100 });
      } catch (error) {
        logImpactEvidenceDiagnostic({
          operation: "assessment_execution_evidence_unavailable",
          actorRole: ctx.role,
          success: false,
          errorCode: "source_unavailable",
          errorMessage: error instanceof Error ? error.message : "Unknown evidence error",
        });
        throw error;
      }
    }, [] as ImpactEvidenceRecord[]),
    loadSource(ctx, "assessment_execution_indicators_unavailable", async () => {
      try {
        return await listIndicatorMeasurements(ctx, { assessmentId, limit: 100 });
      } catch (error) {
        logImpactIndicatorDiagnostic({
          operation: "assessment_execution_indicator_measurements_unavailable",
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
    loadSource(ctx, "assessment_execution_reports_unavailable", async () => {
      try {
        const reports = await listInstitutionalReports(ctx, 100);
        return reports.filter((report) => reportAssessmentIds(report).includes(assessmentId));
      } catch (error) {
        logImpactReportDiagnostic({
          operation: "assessment_execution_reports_unavailable",
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
          operation: "assessment_execution_linked_report_exports_unavailable",
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

  const canManage = canRole(ctx.role, "assessment", "update");
  const canSubmit = canRole(ctx.role, "assessment", "submit");
  const canReview = canRole(ctx.role, "assessment", "review");
  const canApprove = canRole(ctx.role, "assessment", "approve");
  const canReturn = canRole(ctx.role, "assessment", "return");
  const canUploadEvidence = canAccessRoute(ctx.role, EVIDENCE_UPLOAD_ROUTE) && canRole(ctx.role, "evidence", "create");
  const canViewEvidence = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence");
  const canViewReports = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const locked = ["reviewed", "approved", "completed"].includes(assessment.status ?? "");
  const reviewable = assessment.status === "submitted" || assessment.status === "completed";
  const saveDraft = saveDraftAction.bind(null, assessment.id);
  const submit = submitAssessmentAction.bind(null, assessment.id);
  const review = reviewAssessmentAction.bind(null, assessment.id);

  const answeredQuestions = questions.filter((question) => hasResponse(question, responses));
  const requiredQuestions = questions.filter((question) => question.is_required);
  const missingRequiredQuestions = getMissingRequiredAssessmentQuestions(questions, responses);
  const missingRequiredQuestionIds = new Set(missingRequiredQuestions.map((question) => question.id));
  const invalidResponseIssues = questions.map((question) => storedResponseIssue(question, responses)).filter((item): item is string => Boolean(item));
  const overall = scores.find((score) => score.section_id === null) ?? null;
  const latestScoreRun = scoreRuns[0] ?? null;
  const latestReview = reviews[0] ?? null;

  const evidenceFiles = evidenceSource.data;
  const verifiedEvidence = evidenceFiles.filter(isVerifiedEvidence);
  const submittedEvidence = evidenceFiles.filter((item) => item.status === "submitted" || item.status === "under_review");
  const returnedEvidence = evidenceFiles.filter((item) => item.status === "returned");
  const rejectedEvidence = evidenceFiles.filter((item) => item.status === "rejected");
  const verifiedMeasurements = indicatorsSource.data.filter((item) => item.verification_status === "verified");
  const uniqueIndicatorIds = new Set(indicatorsSource.data.map((item) => item.indicator_definition_id));
  const approvedReports = reportsWithExports.filter((report) => report.status === "approved");
  const reviewedVisits = visits.filter((visit) => visit.status === "reviewed");

  const assessmentCompletion = ratio(answeredQuestions.length, questions.length);
  const requiredCompletion = ratio(requiredQuestions.length - missingRequiredQuestions.length, requiredQuestions.length);
  const evidenceReadiness = evidenceSource.available ? (evidenceFiles.length > 0 ? ratio(verifiedEvidence.length, evidenceFiles.length) : 0) : null;
  const indicatorReadiness = indicatorsSource.available ? (indicatorsSource.data.length > 0 ? ratio(verifiedMeasurements.length, indicatorsSource.data.length) : 0) : null;
  const reportReadiness = reportsSource.available ? (reportsWithExports.length > 0 ? ratio(approvedReports.length, reportsWithExports.length) : 0) : null;
  const monitoringReadiness = visits.length > 0 ? ratio(reviewedVisits.length, visits.length) : 0;
  const compositeReadiness = average([assessmentCompletion, requiredCompletion, evidenceReadiness, indicatorReadiness, reportReadiness]);
  const readyToSubmit = !locked && missingRequiredQuestions.length === 0 && invalidResponseIssues.length === 0 && questions.length > 0;
  const scoringAvailable = Boolean(overall || assessment.score !== null || latestScoreRun);
  const reviewReady = reviewable && scoringAvailable;
  const reportReady = assessment.status === "approved"
    && verifiedEvidence.length > 0
    && verifiedMeasurements.length > 0
    && approvedReports.length > 0;
  const failedVerification = rejectedEvidence.length + indicatorsSource.data.filter((item) => item.verification_status === "rejected").length;
  const allLinkedSourcesAvailable = evidenceSource.available && indicatorsSource.available && reportsSource.available;
  const health: HealthState = !allLinkedSourcesAvailable
    ? "Unavailable"
    : assessment.status === "returned" || failedVerification > 0
      ? "At Risk"
      : readyToSubmit || reportReady
        ? "Healthy"
        : "Watchlist";

  const latestRecord = latestDate([
    assessment.created_at,
    assessment.conducted_at,
    assessment.submitted_at,
    assessment.returned_at,
    ...responses.map((item) => item.updated_at ?? item.created_at),
    ...scoreRuns.map((item) => item.calculated_at),
    ...reviews.map((item) => item.created_at),
    ...evidenceFiles.map((item) => item.reviewed_at ?? item.submitted_at ?? item.created_at),
    ...indicatorsSource.data.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...reportsWithExports.map((item) => item.approved_at ?? item.generated_at ?? item.created_at),
  ]);

  const evidenceUploadHref = `${EVIDENCE_UPLOAD_ROUTE}?${new URLSearchParams({
    programme_id: assessment.programme_id ?? "",
    cohort_id: assessment.cohort_id ?? "",
  }).toString()}`;

  const activity = [
    ...(assessment.created_at ? [{ type: "Created", title: assessment.title ?? template?.name ?? "Assessment created", date: assessment.created_at, icon: ClipboardCheck }] : []),
    ...(responses.length > 0 ? [{ type: "Draft saved", title: `${responses.length} response record(s) captured`, date: latestDate(responses.map((item) => item.updated_at ?? item.created_at)), icon: Pencil }] : []),
    ...(assessment.submitted_at ? [{ type: "Submitted", title: "Assessment submitted for review", date: assessment.submitted_at, icon: FileCheck2 }] : []),
    ...scoreRuns.map((item) => ({ type: "Scored", title: `${humanize(item.run_type)} run ${formatScore(item.weighted_score)}`, date: item.calculated_at, icon: BarChart3 })),
    ...reviews.map((item) => ({
      type: humanize(item.review_status),
      title: item.notes ?? "Review decision recorded",
      date: item.created_at,
      icon: item.review_status === "returned" ? RotateCcw : ShieldCheck,
    })),
  ].filter((item): item is { type: string; title: string; date: string; icon: LucideIcon } => Boolean(item.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  return (
    <section className="-m-4 min-h-screen bg-[#f5f7fb] sm:-m-5 lg:-m-7">
      <header className="relative overflow-hidden bg-[#071733] px-4 py-6 text-white sm:px-7 lg:px-9">
        <div className="absolute inset-0 opacity-20" aria-hidden="true">
          <svg viewBox="0 0 1200 360" className="h-full w-full">
            <defs>
              <pattern id="assessment-execution-grid" width="42" height="42" patternUnits="userSpaceOnUse">
                <path d="M42 0H0V42" fill="none" stroke="#60a5fa" strokeOpacity=".35" />
              </pattern>
            </defs>
            <rect width="1200" height="360" fill="url(#assessment-execution-grid)" />
            <path d="M792 62c95 12 182 64 267 35 68-23 94 31 110 76" fill="none" stroke="#22d3ee" strokeOpacity=".45" strokeWidth="2" />
          </svg>
        </div>
        <div className="relative mx-auto max-w-[1540px]">
          <nav className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100/70">
            <Link href="/dashboard/impact-intelligence" className="hover:text-white">Impact Intelligence</Link>
            <span>/</span>
            <Link href="/dashboard/impact-intelligence/assessments" className="hover:text-white">Assessments</Link>
            <span>/</span>
            <span className="text-white">Execution Studio</span>
          </nav>

          <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={assessment.status ?? "draft"} dark />
                <StatusPill value={assessment.assessment_type ?? template?.assessment_type} dark />
                <StatusPill value={health} dark />
                <span className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold text-emerald-200">{humanize(ctx.role)}</span>
              </div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Assessment Execution Studio</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{assessment.title ?? template?.name ?? "MSME assessment"}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100/75">
                Guided data capture, scoring, validation, and review workspace for the selected beneficiary assessment.
              </p>
              <div className="mt-5 grid gap-3 text-xs text-blue-100/80 sm:grid-cols-2 xl:grid-cols-3">
                <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4 text-violet-300" /> {assessment.msmes?.business_name ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><Network className="h-4 w-4 text-cyan-300" /> {assessment.impact_programmes?.name ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4 text-emerald-300" /> {assessment.impact_beneficiary_cohorts?.name ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><Target className="h-4 w-4 text-fuchsia-300" /> {assessment.impact_interventions?.title ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-amber-300" /> Created {formatDate(assessment.created_at)}</span>
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-300" /> Updated {formatDateTime(latestRecord)}</span>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-[520px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <Gauge className="h-4 w-4 text-cyan-300" />
                <p className="mt-3 text-2xl font-bold">{formatScore(overall?.weighted_score ?? assessment.score)}</p>
                <p className="mt-1 text-[10px] text-blue-100/60">Current score</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <ClipboardCheck className="h-4 w-4 text-emerald-300" />
                <p className="mt-3 text-2xl font-bold">{formatPercent(assessmentCompletion)}</p>
                <p className="mt-1 text-[10px] text-blue-100/60">Completion</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <ShieldCheck className="h-4 w-4 text-violet-300" />
                <p className="mt-3 text-2xl font-bold">{humanize(overall?.readiness_category ?? assessment.risk_level)}</p>
                <p className="mt-1 text-[10px] text-blue-100/60">Readiness signal</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
            {canManage && !locked && (
              <Button type="submit" form="assessment-response-form" formAction={saveDraft} className="rounded-xl bg-emerald-500 text-[#071733] hover:bg-emerald-400">
                Save Draft
              </Button>
            )}
            {canSubmit && canManage && !locked && (
              <Button type="submit" form="assessment-response-form" formAction={submit} className="rounded-xl bg-blue-500 hover:bg-blue-400">
                Submit Assessment
              </Button>
            )}
            {canReview && reviewable && (
              <form action={review}>
                <input type="hidden" name="review_status" value="reviewed" />
                <Button type="submit" className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/15">Review</Button>
              </form>
            )}
            {canApprove && reviewable && (
              <form action={review}>
                <input type="hidden" name="review_status" value="approved" />
                <Button type="submit" className="rounded-xl border border-white/15 bg-white/10 hover:bg-white/15">Approve</Button>
              </form>
            )}
            {canReturn && reviewable && (
              <Link href="#review" className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15">Return</Link>
            )}
            <Link href="/dashboard/impact-intelligence/assessments" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-blue-100 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> Assessment portfolio
            </Link>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-7">
        <div className="mx-auto grid max-w-[1540px] gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StudioMetric label="Sections" value={formatNumber(sections.length)} icon={Layers3} tone="bg-blue-50 text-blue-700" />
          <StudioMetric label="Questions" value={formatNumber(questions.length)} icon={ClipboardCheck} tone="bg-violet-50 text-violet-700" />
          <StudioMetric label="Required Complete" value={requiredQuestions.length > 0 ? `${requiredQuestions.length - missingRequiredQuestions.length}/${requiredQuestions.length}` : UNAVAILABLE} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" />
          <StudioMetric label="Responses" value={`${answeredQuestions.length}/${questions.length}`} icon={Database} tone="bg-cyan-50 text-cyan-700" />
          <StudioMetric label="Score" value={formatScore(overall?.weighted_score ?? assessment.score)} icon={BarChart3} tone="bg-indigo-50 text-indigo-700" />
          <StudioMetric label="Status" value={humanize(assessment.status)} icon={BadgeCheck} tone="bg-slate-100 text-slate-700" />
          <StudioMetric label="Review State" value={humanize(latestReview?.review_status ?? assessment.status)} icon={ShieldCheck} tone="bg-amber-50 text-amber-700" />
          <StudioMetric label="Report Ready" value={reportReady ? "Ready" : "Not Ready"} icon={FileCheck2} tone="bg-rose-50 text-rose-700" />
        </div>
      </div>

      <main className="mx-auto grid max-w-[1540px] gap-6 p-4 sm:p-7 lg:p-9 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <Section title="Section Navigator" description="Completion and score posture by template section.">
            {sections.length === 0 ? (
              <EmptyPanel title="No sections" description="This assessment template has no configured sections." icon={FileQuestion} />
            ) : (
              <nav className="space-y-2">
                {sections.map((section, index) => {
                  const sectionQuestions = questions.filter((question) => question.section_id === section.id);
                  const missingRequired = sectionQuestions.filter((question) => missingRequiredQuestionIds.has(question.id)).length;
                  const score = scoreForSection(scores, section.id);
                  return (
                    <a key={section.id} href={`#section-${section.id}`} className="block rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-700">Section {index + 1}</p>
                          <p className="mt-1 truncate text-xs font-bold text-[#0c1733]">{section.title}</p>
                        </div>
                        <StatusPill value={missingRequired > 0 ? "Incomplete" : "Ready"} />
                      </div>
                      <div className="mt-3"><ProgressBar value={sectionCompletion(sectionQuestions, responses)} tone="bg-blue-500" /></div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                        <span>{missingRequired} required missing</span>
                        <span className="text-right">{formatScore(score?.weighted_score)}</span>
                      </div>
                    </a>
                  );
                })}
              </nav>
            )}
          </Section>

          <Section title="Beneficiary Context" description="Assessment subject and linked programme scope.">
            <div className="space-y-3">
              {[
                ["Business", assessment.msmes?.business_name],
                ["MSME ID", assessment.msmes?.msme_id],
                ["Cohort Member", assessment.cohort_member_id],
                ["Programme", assessment.impact_programmes?.name],
                ["Cohort", assessment.impact_beneficiary_cohorts?.name],
                ["Intervention", assessment.impact_interventions?.title],
                ["Field Visit", assessment.impact_field_visits?.title],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                  <p className="mt-1 break-words text-xs font-semibold text-slate-700">{value ?? UNAVAILABLE}</p>
                </div>
              ))}
            </div>
          </Section>
        </aside>

        <div className="min-w-0 space-y-6">
          {query.error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-bold">Assessment action could not be completed</p><p className="mt-1 text-xs">{query.error}</p></div>
            </div>
          )}

          {assessment.status === "returned" && assessment.return_reason && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-bold">Returned for correction</p><p className="mt-1 text-xs">{assessment.return_reason}</p></div>
            </div>
          )}

          <form id="assessment-response-form" action={saveDraft} className="space-y-5">
            <Section
              id="responses"
              title="Question Response Workspace"
              description="Capture existing supported response types and preserve the current validation and scoring engine."
              action={canManage && !locked ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="secondary" className="rounded-xl">Save Draft</Button>
                  {canSubmit && <Button type="submit" formAction={submit} className="rounded-xl bg-blue-700 hover:bg-blue-600">Submit</Button>}
                </div>
              ) : <StatusPill value={locked ? "Locked" : "Read Only"} />}
            >
              {sections.length === 0 ? (
                <EmptyPanel title="No assessment sections" description="This assessment template has no configured sections." icon={ClipboardCheck} />
              ) : (
                <div className="space-y-5">
                  {sections.map((section, index) => {
                    const sectionQuestions = questions.filter((question) => question.section_id === section.id);
                    const sectionScore = scoreForSection(scores, section.id);
                    return (
                      <section key={section.id} id={`section-${section.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Section {index + 1}</p>
                              <h3 className="mt-1 text-sm font-bold text-[#0c1733]">{section.title}</h3>
                              <p className="mt-1 text-[11px] leading-5 text-slate-500">{section.description ?? "Assessment section"}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-right text-[10px] sm:min-w-48">
                              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                                <p className="text-slate-400">Completion</p>
                                <p className="mt-1 font-bold text-slate-800">{formatPercent(sectionCompletion(sectionQuestions, responses))}</p>
                              </div>
                              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                                <p className="text-slate-400">Score</p>
                                <p className="mt-1 font-bold text-slate-800">{formatScore(sectionScore?.weighted_score)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {sectionQuestions.map((question, questionIndex) => {
                            const missingRequired = missingRequiredQuestionIds.has(question.id);
                            const issue = storedResponseIssue(question, responses);
                            return (
                              <label key={question.id} className="block p-4 sm:p-5">
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-[10px] font-bold text-blue-700">{questionIndex + 1}</span>
                                      <span className="text-sm font-bold leading-5 text-[#0c1733]">{question.question_text}</span>
                                      {question.is_required && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Required</span>}
                                      {missingRequired && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Missing</span>}
                                    </div>
                                    <p className="mt-2 text-[10px] font-normal text-slate-500">{humanize(question.category ?? "uncategorized")} · {humanize(question.question_type)} · Weight {question.weight}{question.help_text ? ` · ${question.help_text}` : ""}</p>
                                  </div>
                                  <StatusPill value={hasResponse(question, responses) ? "Captured" : "Pending"} />
                                </div>
                                <QuestionInput question={question} responses={responses} disabled={!canManage || locked} />
                                {missingRequired && (
                                  <span className="mt-3 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                    This required question must be answered before submission.
                                  </span>
                                )}
                                {issue && (
                                  <span className="mt-3 block rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                                    {issue}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </Section>
          </form>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Evidence Prompt Centre" description="Linked evidence that supports this assessment record.">
              {!evidenceSource.available ? (
                <EmptyPanel title="Evidence unavailable" description="The evidence source could not be loaded. Assessment execution remains available." icon={ShieldCheck} />
              ) : evidenceFiles.length === 0 ? (
                <div className="space-y-4">
                  <EmptyPanel title="No evidence linked" description="No evidence item currently references this assessment." icon={FileQuestion} />
                  {canUploadEvidence && (
                    <Link href={evidenceUploadHref} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white hover:bg-[#132b5d]">
                      Upload Evidence <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] text-emerald-700">Verified</p><p className="mt-2 text-lg font-bold text-emerald-950">{verifiedEvidence.length}</p></div>
                    <div className="rounded-xl bg-blue-50 p-3"><p className="text-[9px] text-blue-700">Submitted</p><p className="mt-2 text-lg font-bold text-blue-950">{submittedEvidence.length}</p></div>
                    <div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] text-amber-700">Returned</p><p className="mt-2 text-lg font-bold text-amber-950">{returnedEvidence.length}</p></div>
                    <div className="rounded-xl bg-rose-50 p-3"><p className="text-[9px] text-rose-700">Rejected</p><p className="mt-2 text-lg font-bold text-rose-950">{rejectedEvidence.length}</p></div>
                  </div>
                  {evidenceFiles.slice(0, 5).map((item) => {
                    const content = (
                      <div className="rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/30">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-800">{item.original_filename ?? item.file_name}</p>
                            <p className="mt-1 text-[9px] text-slate-500">{humanize(item.evidence_category ?? item.evidence_type)}</p>
                          </div>
                          <StatusPill value={item.verification_status ?? item.status} />
                        </div>
                      </div>
                    );
                    return canViewEvidence ? <Link key={item.id} href={`/dashboard/impact-intelligence/evidence/${item.id}`}>{content}</Link> : <div key={item.id}>{content}</div>;
                  })}
                </div>
              )}
            </Section>

            <Section title="Indicator & Report Linkage" description="Downstream usage in verified outcomes and institutional reports.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <Target className="h-4 w-4 text-purple-600" />
                  <p className="mt-3 text-xl font-bold text-[#0c1733]">{indicatorsSource.available ? formatNumber(uniqueIndicatorIds.size) : UNAVAILABLE}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Linked indicators</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <p className="mt-3 text-xl font-bold text-[#0c1733]">{reportsSource.available ? formatNumber(reportsWithExports.length) : UNAVAILABLE}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Linked reports</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {!indicatorsSource.available ? (
                  <EmptyPanel title="Indicators unavailable" description="Indicator measurements could not be loaded." icon={Target} />
                ) : verifiedMeasurements.length === 0 ? (
                  <EmptyPanel title="No verified outcomes" description="No verified indicator measurement currently references this assessment." icon={Target} />
                ) : (
                  verifiedMeasurements.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-[#0c1733]">{item.impact_indicator_definitions?.name ?? "Indicator measurement"}</p>
                          <p className="mt-1 text-[9px] text-slate-500">{formatMeasurement(item.measured_value, item.impact_indicator_definitions?.unit_of_measure)}</p>
                        </div>
                        <StatusPill value={item.outcome_status} />
                      </div>
                    </div>
                  ))
                )}
                {!reportsSource.available ? (
                  <EmptyPanel title="Reports unavailable" description="Linked institutional reports could not be loaded." icon={FileText} />
                ) : reportsWithExports.length === 0 ? (
                  <EmptyPanel title="No linked reports" description="No institutional report version currently references this assessment." icon={FileText} />
                ) : (
                  reportsWithExports.slice(0, 3).map((report) => (
                    <div key={report.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#0c1733]">{report.title}</p>
                          <p className="mt-1 text-[9px] text-slate-500">Version {report.latest_version?.version_number ?? UNAVAILABLE} · Export {report.exportCount === null ? UNAVAILABLE : report.exportCount > 0 ? "Available" : "Not generated"}</p>
                        </div>
                        <StatusPill value={report.status} />
                      </div>
                      {canViewReports && <Link href={`/dashboard/impact-intelligence/reports/${report.id}`} className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">Open report <ArrowRight className="h-3 w-3" /></Link>}
                    </div>
                  ))
                )}
              </div>
            </Section>
          </div>

          <Section title="Activity Timeline" description="Real assessment, response, scoring, and review activity available on this record.">
            {activity.length === 0 ? (
              <EmptyPanel title="No activity recorded" description="No dated activity is available for this assessment." icon={Activity} />
            ) : (
              <ol className="space-y-3">
                {activity.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li key={`${item.type}-${item.date}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700">{item.type}</p><p className="mt-1 truncate text-xs font-semibold text-slate-800">{item.title}</p></div>
                          <p className="shrink-0 text-[9px] text-slate-500">{formatDateTime(item.date)}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <Section title="Validation & Readiness" description="Submit, scoring, and review readiness based on current saved data.">
            <div className="space-y-3">
              {[
                ["Required answers", missingRequiredQuestions.length === 0 ? "Complete" : `${missingRequiredQuestions.length} missing`, missingRequiredQuestions.length === 0],
                ["Stored validation", invalidResponseIssues.length === 0 ? "No issues" : `${invalidResponseIssues.length} issue(s)`, invalidResponseIssues.length === 0],
                ["Ready to submit", readyToSubmit ? "Yes" : "No", readyToSubmit],
                ["Scoring available", scoringAvailable ? "Yes" : "No", scoringAvailable],
                ["Review readiness", reviewReady ? "Ready" : "Unavailable", reviewReady],
              ].map(([label, value, good]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", good ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{value}</span>
                </div>
              ))}
            </div>
            {(missingRequiredQuestions.length > 0 || invalidResponseIssues.length > 0) && (
              <div className="mt-4 space-y-2">
                {[...missingRequiredQuestions.map((item) => `Required question missing: ${item.question_text}`), ...invalidResponseIssues].slice(0, 6).map((item) => (
                  <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-900">{item}</div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Scoring Preview Centre" description="Current section scores and latest immutable score run.">
            <div className="rounded-2xl bg-[#0c1f46] p-5 text-white">
              <Gauge className="h-5 w-5 text-cyan-300" />
              <p className="mt-4 text-3xl font-bold">{formatScore(overall?.weighted_score ?? assessment.score)}</p>
              <p className="mt-1 text-[10px] text-blue-100/70">{humanize(overall?.readiness_category ?? assessment.risk_level)} readiness</p>
            </div>
            <div className="mt-4 space-y-2">
              {sections.length === 0 ? (
                <EmptyPanel title="Section scores unavailable" description="Scores will appear after the assessment is submitted or reviewed." icon={BarChart3} />
              ) : (
                sections.slice(0, 6).map((section) => {
                  const score = scoreForSection(scores, section.id);
                  return (
                    <div key={section.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[11px] font-bold text-slate-700">{section.title}</span>
                        <span className="text-[11px] font-bold text-[#0c1733]">{formatScore(score?.weighted_score)}</span>
                      </div>
                      <p className="mt-1 text-[9px] text-slate-500">{humanize(score?.readiness_category)} · Weight {section.weight}</p>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-semibold text-slate-500">Latest score run</p>
              <p className="mt-2 text-xs font-bold text-[#0c1733]">{latestScoreRun ? `${humanize(latestScoreRun.run_type)} · ${formatScore(latestScoreRun.weighted_score)}` : UNAVAILABLE}</p>
              <p className="mt-1 text-[9px] text-slate-500">{formatDateTime(latestScoreRun?.calculated_at)} · Model v{latestScoreRun?.scoring_model_version ?? UNAVAILABLE}</p>
            </div>
          </Section>

          <Section title="Review & Approval Centre" description="Lifecycle decisions available under the current role policy.">
            <div className="space-y-3">
              {[
                ["Submitted", formatDateTime(assessment.submitted_at)],
                ["Reviewed", formatDateTime(latestReview?.created_at)],
                ["Completed", formatDateTime(assessment.conducted_at)],
                ["Returned", formatDateTime(assessment.returned_at)],
                ["Reviewer", latestReview?.reviewer_user_id ?? UNAVAILABLE],
                ["Return Reason", assessment.return_reason ?? UNAVAILABLE],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                  <p className="mt-1 break-words text-xs font-semibold text-slate-700">{value}</p>
                </div>
              ))}
            </div>
            {reviewable && (canReview || canApprove || canReturn) ? (
              <form id="review" action={review} className="mt-4 rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-[#0c1733]">Record Review Decision</p>
                <select name="review_status" defaultValue={canReview ? "reviewed" : canApprove ? "approved" : "returned"} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  {canReview && <option value="reviewed">Reviewed</option>}
                  {canApprove && <option value="approved">Approve</option>}
                  {canReturn && <option value="returned">Return for update</option>}
                </select>
                <input name="return_reason" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Return reason when correction is required" />
                <textarea name="notes" rows={3} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Review notes" />
                <Button type="submit" className="mt-3 w-full rounded-xl bg-blue-700 hover:bg-blue-600">Submit Review</Button>
              </form>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600"><LockKeyhole className="h-3.5 w-3.5" /> Review action unavailable</div>
              </div>
            )}
          </Section>

          <Section title="Executive Summary" description="Health across capture, scoring, evidence, outcomes, and reporting.">
            <div className="space-y-3">
              {[
                ["Assessment Health", health],
                ["Completion Health", healthFromReadiness(assessmentCompletion)],
                ["Scoring Health", scoringAvailable ? "Healthy" : "Unavailable"],
                ["Evidence Health", healthFromReadiness(evidenceReadiness)],
                ["Monitoring Health", healthFromReadiness(monitoringReadiness)],
                ["Outcome Health", healthFromReadiness(indicatorReadiness)],
                ["Report Readiness", readinessLabel(reportReadiness)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                  <StatusPill value={value} />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-[#0c1f46] p-5 text-white">
              <FileCheck2 className="h-5 w-5 text-cyan-300" />
              <p className="mt-4 text-2xl font-bold">{formatPercent(compositeReadiness)}</p>
              <p className="mt-1 text-[10px] text-blue-100/70">Composite readiness from loaded assessment execution sources.</p>
            </div>
          </Section>
        </aside>
      </main>
    </section>
  );
}
