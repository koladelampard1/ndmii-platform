import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  HandCoins,
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
  appendImpactInterventionNote,
  getImpactInterventionDetail,
  getInterventionStage,
  INTERVENTION_STAGES,
  INTERVENTION_STATUSES,
  listIntelligenceFeed,
  listUserPickerOptions,
  updateImpactInterventionLifecycle,
  type ImpactRiskFlag,
} from "@/lib/data/impact-intelligence";
import {
  listImpactEvidence,
  logImpactEvidenceDiagnostic,
  type ImpactEvidenceRecord,
} from "@/lib/data/impact-evidence";
import {
  aggregateInterventionIndicators,
  listIndicatorMeasurements,
  logImpactIndicatorDiagnostic,
  type ImpactIndicatorMeasurement,
} from "@/lib/data/impact-indicators";
import {
  listInstitutionalReports,
  logImpactReportDiagnostic,
  type InstitutionalReport,
} from "@/lib/data/impact-reports";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/interventions/[interventionId]";
const UNAVAILABLE = "Unavailable";
const EXPECTED_INTERVENTION_ERRORS = ["required", "invalid", "status", "stage", "amount", "officer", "permission", "intervention"];

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

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

function redirectWithInterventionError(interventionId: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Intervention action could not be completed.";
  redirect(`/dashboard/impact-intelligence/interventions/${interventionId}?error=${encodeURIComponent(message)}#manage`);
}

async function updateProgressAction(interventionId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await updateImpactInterventionLifecycle(ctx, interventionId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "intervention_lifecycle_update_failed", error });
    if (!(error instanceof Error) || !EXPECTED_INTERVENTION_ERRORS.some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirectWithInterventionError(interventionId, error);
  }
  redirect(`/dashboard/impact-intelligence/interventions/${interventionId}`);
}

async function addNoteAction(interventionId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await appendImpactInterventionNote(ctx, interventionId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "intervention_note_append_failed", error });
    if (!(error instanceof Error) || !EXPECTED_INTERVENTION_ERRORS.some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirectWithInterventionError(interventionId, error);
  }
  redirect(`/dashboard/impact-intelligence/interventions/${interventionId}`);
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

function formatCurrency(value: number | null) {
  return value === null ? UNAVAILABLE : `NGN ${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatMeasurement(value: number | null, unit: string | null | undefined) {
  if (value === null) return UNAVAILABLE;
  return `${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) : UNAVAILABLE;
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function latestByDate<T>(items: T[], getDate: (item: T) => string | null | undefined) {
  return [...items].sort((a, b) => String(getDate(b) ?? "").localeCompare(String(getDate(a) ?? "")))[0] ?? null;
}

function isOverdue(value: string | null | undefined, complete: boolean) {
  if (!value || complete) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function toneForStatus(value: string | null | undefined) {
  const status = value?.toLowerCase() ?? "";
  if (["healthy", "ready", "active", "approved", "verified", "reviewed", "completed", "achieved", "exceeded", "available"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (["watchlist", "in progress", "submitted", "under_review", "pending", "assigned", "in_progress", "on_track"].includes(status)) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (["at risk", "needs attention", "rejected", "returned", "on_hold", "regressed", "below_target", "critical", "high", "blocked"].includes(status)) {
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

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Network; tone: string }) {
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

function readinessStatus(value: number | null) {
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

function deriveHealth(input: {
  allSourcesAvailable: boolean;
  delayed: boolean;
  completedWithoutReport: boolean;
  riskFlags: ImpactRiskFlag[];
  attentionCount: number;
}): HealthState {
  if (!input.allSourcesAvailable) return "Unavailable";
  if (
    input.delayed
    || input.completedWithoutReport
    || input.riskFlags.some((flag) => flag.status === "open" && ["critical", "high"].includes(flag.severity))
  ) return "At Risk";
  if (input.attentionCount > 0 || input.riskFlags.some((flag) => flag.status === "open")) return "Watchlist";
  return "Healthy";
}

export default async function ImpactInterventionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ interventionId: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { interventionId } = await params;
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let detail: Awaited<ReturnType<typeof getImpactInterventionDetail>> | null = null;

  try {
    ctx = await getCurrentUserContext();
    detail = await getImpactInterventionDetail(interventionId, ctx);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "intervention_detail_load_failed", error });
    const description = isImpactProgrammeReadDenied(error)
      ? error.message
      : "The intervention source, current session, or role assignment is temporarily unavailable.";
    return (
      <section className="space-y-6">
        <Section title="Intervention Unavailable">
          <EmptyState title="Intervention record could not load" description={description} icon={HandCoins} />
        </Section>
      </section>
    );
  }

  const { intervention, events, assessments, visits } = detail;
  if (!intervention) notFound();

  const canEdit = canRole(ctx.role, "intervention", "update") && canAccessRoute(ctx.role, `/dashboard/impact-intelligence/interventions/${interventionId}`);
  const canScheduleMonitoring = canRole(ctx.role, "monitoring_visit", "create") && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/monitoring");
  const canViewEvidence = canRole(ctx.role, "evidence", "read") && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence");
  const canViewIndicators = canRole(ctx.role, "indicator", "read") && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/indicators");
  const canViewReports = canRole(ctx.role, "report", "read") && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canViewRisks = canRole(ctx.role, "intelligence", "read") && canRole(ctx.role, "risk_flag", "read");

  let officerOptionsFailed = false;
  const [officers, evidenceSource, indicatorAggregateSource, indicatorsSource, reportsSource, risksSource] = await Promise.all([
    canEdit
      ? listUserPickerOptions("field_officer").catch((error) => {
          officerOptionsFailed = true;
          logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "intervention_officer_options_load_failed", error });
          return [];
        })
      : Promise.resolve([]),
    canViewEvidence
      ? listImpactEvidence(ctx, { interventionId, limit: 1000 })
          .then((data) => ({ data, available: true }))
          .catch((error) => {
            unstable_rethrow(error);
            logImpactEvidenceDiagnostic({
              operation: "intervention_detail_evidence_unavailable",
              actorRole: ctx.role,
              success: false,
              errorCode: "source_unavailable",
              errorMessage: error instanceof Error ? error.message : "Unknown evidence error",
            });
            return sourceFallback<ImpactEvidenceRecord[]>([]);
          })
      : Promise.resolve(sourceFallback<ImpactEvidenceRecord[]>([])),
    canViewIndicators
      ? aggregateInterventionIndicators(ctx, interventionId)
          .then((data) => ({ data, available: true }))
          .catch((error) => {
            unstable_rethrow(error);
            logImpactIndicatorDiagnostic({
              operation: "intervention_detail_indicator_aggregate_unavailable",
              role: ctx.role,
              authUserId: ctx.authUserId,
              appUserId: ctx.appUserId,
              interventionId,
              errorMessage: error instanceof Error ? error.message : "Unknown indicator error",
              success: false,
            });
            return sourceFallback(null);
          })
      : Promise.resolve(sourceFallback(null)),
    canViewIndicators
      ? listIndicatorMeasurements(ctx, { interventionId, limit: 1000 })
          .then((data) => ({ data, available: true }))
          .catch((error) => {
            unstable_rethrow(error);
            logImpactIndicatorDiagnostic({
              operation: "intervention_detail_indicator_measurements_unavailable",
              role: ctx.role,
              authUserId: ctx.authUserId,
              appUserId: ctx.appUserId,
              interventionId,
              errorMessage: error instanceof Error ? error.message : "Unknown indicator error",
              success: false,
            });
            return sourceFallback<ImpactIndicatorMeasurement[]>([]);
          })
      : Promise.resolve(sourceFallback<ImpactIndicatorMeasurement[]>([])),
    canViewReports
      ? listInstitutionalReports(ctx, 1000)
          .then((data) => ({ data: data.filter((item) => item.intervention_id === interventionId), available: true }))
          .catch((error) => {
            unstable_rethrow(error);
            logImpactReportDiagnostic({
              operation: "intervention_detail_reports_unavailable",
              role: ctx.role,
              authUserId: ctx.authUserId,
              appUserId: ctx.appUserId,
              errorMessage: error instanceof Error ? error.message : "Unknown report error",
              success: false,
            });
            return sourceFallback<InstitutionalReport[]>([]);
          })
      : Promise.resolve(sourceFallback<InstitutionalReport[]>([])),
    canViewRisks
      ? loadSource(ctx, "intervention_detail_risks_unavailable", () => listIntelligenceFeed(ctx, { limit: 500 }), null)
      : Promise.resolve(sourceFallback(null)),
  ]);

  const evidenceFiles = evidenceSource.data.filter((item) => item.intervention_id === interventionId);
  const indicatorMeasurements = indicatorsSource.data.filter((item) => item.intervention_id === interventionId);
  const reports = reportsSource.data;
  const riskFlags = risksSource.data?.riskFlags.filter((item) => item.intervention_id === interventionId) ?? [];
  const stage = getInterventionStage(intervention);

  const approvedAssessments = assessments.filter((item) => item.status === "approved");
  const reviewedAssessments = assessments.filter((item) => item.status === "reviewed");
  const submittedAssessments = assessments.filter((item) => item.status === "submitted");
  const draftAssessments = assessments.filter((item) => item.status === "draft");
  const reviewedVisits = visits.filter((item) => item.status === "reviewed");
  const completedVisits = visits.filter((item) => item.status === "completed");
  const pendingVisits = visits.filter((item) => !["completed", "reviewed"].includes(item.status ?? ""));
  const overdueVisits = visits.filter((item) => isOverdue(item.visit_date ?? item.scheduled_at, ["completed", "reviewed"].includes(item.status ?? "")));
  const verifiedEvidence = evidenceFiles.filter((item) => item.status === "verified" && item.verification_status === "verified");
  const submittedEvidence = evidenceFiles.filter((item) => ["uploaded", "submitted", "under_review"].includes(item.status));
  const returnedEvidence = evidenceFiles.filter((item) => item.status === "returned");
  const rejectedEvidence = evidenceFiles.filter((item) => item.status === "rejected");
  const verifiedIndicators = indicatorMeasurements.filter((item) => item.verification_status === "verified");
  const approvedReports = reports.filter((item) => item.status === "approved");
  const openRiskFlags = riskFlags.filter((item) => item.status === "open");

  const assessmentReadiness = ratio(approvedAssessments.length, assessments.length);
  const monitoringReadiness = ratio(reviewedVisits.length + completedVisits.length, visits.length);
  const evidenceReadiness = evidenceSource.available ? ratio(verifiedEvidence.length, evidenceFiles.length) : null;
  const outcomeReadiness = indicatorsSource.available ? ratio(verifiedIndicators.length, indicatorMeasurements.length) : null;
  const reportingReadiness = reportsSource.available ? ratio(approvedReports.length, reports.length) : null;
  const readinessValues = [assessmentReadiness, monitoringReadiness, evidenceReadiness, outcomeReadiness, reportingReadiness]
    .filter((value): value is number => value !== null);
  const deliveryReadiness = readinessValues.length === 5
    ? Math.round(readinessValues.reduce((sum, value) => sum + value, 0) / readinessValues.length)
    : null;

  const delayed = isOverdue(intervention.end_date, ["completed", "cancelled"].includes(intervention.status ?? ""));
  const attentionItems = [
    evidenceSource.available && verifiedEvidence.length === 0 ? "Missing verified evidence" : null,
    pendingVisits.length > 0 ? `${pendingVisits.length} monitoring review${pendingVisits.length === 1 ? "" : "s"} pending` : null,
    indicatorsSource.available && verifiedIndicators.length === 0 ? "Missing verified indicators" : null,
    assessments.length === 0 || approvedAssessments.length === 0 ? "Assessment assurance incomplete" : null,
    reportsSource.available && intervention.status === "completed" && approvedReports.length === 0 ? "Completed intervention is not report ready" : null,
    delayed ? "Intervention end date has passed without completion" : null,
  ].filter((item): item is string => Boolean(item));

  const allHealthSourcesAvailable = evidenceSource.available
    && indicatorsSource.available
    && reportsSource.available
    && (canViewRisks ? risksSource.available : true);
  const health = deriveHealth({
    allSourcesAvailable: allHealthSourcesAvailable,
    delayed,
    completedWithoutReport: intervention.status === "completed" && approvedReports.length === 0,
    riskFlags,
    attentionCount: attentionItems.length,
  });

  const latestAssessment = latestByDate(assessments, (item) => item.submitted_at ?? item.conducted_at ?? item.created_at);
  const latestVisit = latestByDate(visits, (item) => item.reviewed_at ?? item.completed_at ?? item.visit_date ?? item.created_at);
  const latestReport = latestByDate(reports, (item) => item.approved_at ?? item.generated_at ?? item.created_at);
  const latestRecord = latestByDate(
    [
      intervention.updated_at ?? intervention.created_at,
      ...events.map((item) => item.created_at),
      ...assessments.map((item) => item.submitted_at ?? item.created_at),
      ...visits.map((item) => item.reviewed_at ?? item.completed_at ?? item.created_at),
      ...evidenceFiles.map((item) => item.reviewed_at ?? item.created_at),
      ...indicatorMeasurements.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
      ...reports.map((item) => item.approved_at ?? item.generated_at ?? item.created_at),
    ],
    (value) => value,
  );

  const lifecycle = [
    { label: "Planned", complete: Boolean(intervention.created_at) },
    { label: "Active", complete: intervention.status === "active" || ["completed"].includes(intervention.status ?? "") },
    { label: "Assessed", complete: approvedAssessments.length > 0 },
    { label: "Monitored", complete: reviewedVisits.length + completedVisits.length > 0 },
    { label: "Evidence Verified", complete: verifiedEvidence.length > 0 },
    { label: "Outcome Verified", complete: verifiedIndicators.length > 0 },
    { label: "Report Ready", complete: approvedReports.length > 0 },
  ];
  const currentLifecycleIndex = lifecycle.reduce((current, item, index) => item.complete ? index : current, 0);

  const readiness = [
    { label: "Assessment Readiness", value: assessmentReadiness, icon: ClipboardCheck },
    { label: "Monitoring Readiness", value: monitoringReadiness, icon: CalendarCheck },
    { label: "Evidence Readiness", value: evidenceReadiness, icon: ShieldCheck },
    { label: "Outcome Readiness", value: outcomeReadiness, icon: Target },
    { label: "Reporting Readiness", value: reportingReadiness, icon: FileCheck2 },
  ];

  const milestones = [
    { label: "Intervention created", date: intervention.created_at, complete: Boolean(intervention.created_at) },
    { label: "Delivery started", date: intervention.start_date, complete: Boolean(intervention.start_date) },
    { label: "Approval recorded", date: intervention.approved_at, complete: Boolean(intervention.approved_at) },
    { label: "Disbursement recorded", date: intervention.disbursed_at, complete: Boolean(intervention.disbursed_at) },
    { label: "Delivery closed", date: intervention.closed_at, complete: Boolean(intervention.closed_at) },
  ];

  const activity = [
    ...events.map((item) => ({
      type: item.event_type === "created" ? "Intervention created" : humanize(item.event_type),
      title: item.title,
      date: item.created_at,
      href: null as string | null,
      icon: Network,
    })),
    ...approvedAssessments.map((item) => ({
      type: "Assessment approved",
      title: item.title ?? humanize(item.assessment_type),
      date: item.submitted_at ?? item.conducted_at ?? item.created_at,
      href: `/dashboard/impact-intelligence/assessments/${item.id}`,
      icon: ClipboardCheck,
    })),
    ...reviewedVisits.map((item) => ({
      type: "Monitoring reviewed",
      title: item.title ?? "Field visit",
      date: item.reviewed_at ?? item.completed_at ?? item.created_at,
      href: `/dashboard/impact-intelligence/monitoring/${item.id}`,
      icon: CalendarCheck,
    })),
    ...verifiedEvidence.map((item) => ({
      type: "Evidence verified",
      title: item.original_filename ?? item.file_name,
      date: item.reviewed_at ?? item.created_at,
      href: `/dashboard/impact-intelligence/evidence/${item.id}`,
      icon: ShieldCheck,
    })),
    ...verifiedIndicators.map((item) => ({
      type: "Indicator verified",
      title: item.impact_indicator_definitions?.name ?? "Indicator measurement",
      date: item.verified_at ?? item.created_at,
      href: "/dashboard/impact-intelligence/indicators",
      icon: Target,
    })),
    ...reports.map((item) => ({
      type: "Report generated",
      title: item.title,
      date: item.generated_at ?? item.created_at,
      href: `/dashboard/impact-intelligence/reports/${item.id}`,
      icon: FileText,
    })),
  ]
    .filter((item) => item.date && (!item.href || canAccessRoute(ctx.role, item.href)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 10);

  const updateProgress = updateProgressAction.bind(null, intervention.id);
  const addNote = addNoteAction.bind(null, intervention.id);
  const canManage = canEdit && !officerOptionsFailed;
  const scheduleHref = `/dashboard/impact-intelligence/monitoring?create_programme_id=${intervention.programme_id ?? ""}&create_cohort_id=${intervention.cohort_id ?? ""}&create_member_id=${intervention.cohort_member_id ?? ""}&create_intervention_id=${intervention.id}`;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <Link href="/dashboard/impact-intelligence/interventions" className="hover:text-emerald-700">Interventions</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">{intervention.title}</span>
            </nav>
            <p className="mt-2 text-xs text-slate-500">Intervention Delivery War Room</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Activity className="h-4 w-4" />
              <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Latest scoped record</p>
              <p className="text-[11px] font-semibold text-slate-700">{formatDateTime(latestRecord)}</p>
            </div>
          </div>
        </div>
      </header>

      {query.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{query.error}</div>}

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_78%_24%,rgba(37,99,235,0.45),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_58%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 320" className="h-full w-full">
            <defs>
              <pattern id="intervention-war-room-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#60a5fa" />
              </pattern>
            </defs>
            <path d="M540 34 650 20l82 42 75 4 47 70-52 52 12 65-104 20-68-42-82 18-48-78 24-61Z" fill="url(#intervention-war-room-dots)" stroke="#38bdf8" strokeOpacity=".4" />
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
                <StatusPill value={intervention.status} dark />
                <StatusPill value={stage} dark />
                <StatusPill value={health} dark />
              </div>
              <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">{intervention.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80">
                {intervention.description ?? "No intervention description has been recorded."}
              </p>
              <div className="mt-5 grid gap-3 text-xs text-blue-100/80 sm:grid-cols-2">
                <span className="inline-flex items-center gap-2"><Network className="h-4 w-4 text-cyan-300" /> {intervention.impact_programmes?.name ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4 text-violet-300" /> {intervention.msmes?.business_name ?? UNAVAILABLE}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-300" /> {formatDate(intervention.start_date)} to {formatDate(intervention.end_date)}</span>
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-300" /> {intervention.impact_beneficiary_cohorts?.name ?? UNAVAILABLE}</span>
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[420px]">
              {[
                { label: "Delivery health", value: health, icon: Gauge },
                { label: "Current stage", value: humanize(stage), icon: Activity },
                { label: "Report readiness", value: reportingReadiness === null ? UNAVAILABLE : `${reportingReadiness}%`, icon: FileCheck2 },
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
            {readiness.map((item) => (
              <span key={item.label} className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-bold",
                item.value !== null && item.value >= 80
                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                  : "border-white/15 bg-white/10 text-blue-100",
              )}>
                {item.label.replace(" Readiness", "")} {item.value === null ? UNAVAILABLE : item.value >= 80 ? "Ready" : humanize(readinessStatus(item.value))}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {canEdit && (
              <Link href="#manage" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white transition hover:bg-emerald-400">
                <Pencil className="h-4 w-4" /> Edit Intervention
              </Link>
            )}
            {canScheduleMonitoring && (
              <Link href={scheduleHref} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15">
                <CalendarCheck className="h-4 w-4" /> Schedule Monitoring
              </Link>
            )}
            {canViewEvidence && (
              <Link href={`/dashboard/impact-intelligence/evidence?create_programme_id=${intervention.programme_id ?? ""}&create_cohort_id=${intervention.cohort_id ?? ""}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15">
                <ShieldCheck className="h-4 w-4" /> View Evidence
              </Link>
            )}
            {canViewReports && (
              <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-blue-100 transition hover:bg-white/10">
                View Reports <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Beneficiary" value={intervention.cohort_member_id || intervention.msme_id ? "1" : UNAVAILABLE} icon={UserRound} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Assessments" value={formatNumber(assessments.length)} icon={ClipboardCheck} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Monitoring Visits" value={formatNumber(visits.length)} icon={CalendarDays} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Verified Evidence" value={evidenceSource.available ? formatNumber(verifiedEvidence.length) : UNAVAILABLE} icon={ShieldCheck} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Verified Indicators" value={indicatorsSource.available ? formatNumber(verifiedIndicators.length) : UNAVAILABLE} icon={Target} tone="bg-purple-100 text-purple-700" />
        <MetricCard label="Reports" value={reportsSource.available ? formatNumber(reports.length) : UNAVAILABLE} icon={FileText} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Open Risks" value={risksSource.available ? formatNumber(openRiskFlags.length) : UNAVAILABLE} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="Delivery Readiness" value={deliveryReadiness === null ? UNAVAILABLE : `${deliveryReadiness}%`} icon={Gauge} tone="bg-emerald-100 text-emerald-700" />
      </div>

      <Section title="Intervention Lifecycle Journey" description="Current delivery progression based on linked, scoped records.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {lifecycle.map((item, index) => (
            <div key={item.label} className={cn(
              "relative rounded-2xl border p-4",
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
        <Section title="Beneficiary Impact Profile" description="The MSME and cohort context attached to this intervention.">
          <div className="rounded-2xl bg-slate-50 p-5">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700"><UserRound className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-[#0c1733]">{intervention.msmes?.business_name ?? UNAVAILABLE}</h3>
                <p className="mt-1 text-xs text-slate-500">{intervention.msmes?.msme_id ?? UNAVAILABLE}</p>
                <div className="mt-3"><StatusPill value={intervention.status} /></div>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
              {[
                ["Programme", intervention.impact_programmes?.name ?? UNAVAILABLE],
                ["Cohort", intervention.impact_beneficiary_cohorts?.name ?? UNAVAILABLE],
                ["Sector", intervention.msmes?.sector ?? UNAVAILABLE],
                ["State", intervention.msmes?.state ?? UNAVAILABLE],
                ["Member status", intervention.impact_cohort_members?.member_status ?? UNAVAILABLE],
                ["Assigned officer", intervention.assigned_officers?.full_name ?? intervention.assigned_officers?.email ?? UNAVAILABLE],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
                  <dd className="mt-1 text-xs font-semibold text-slate-700">{humanize(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        <Section title="Delivery Performance Centre" description="Lifecycle milestones, funding posture, and delivery timeline.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-semibold text-slate-500">Approved amount</p><p className="mt-2 text-lg font-bold text-[#0c1733]">{formatCurrency(intervention.approved_amount)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-semibold text-slate-500">Disbursed amount</p><p className="mt-2 text-lg font-bold text-[#0c1733]">{formatCurrency(intervention.disbursed_amount)}</p></div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-semibold text-slate-500">Disbursement progress</p>
              <div className="mt-2"><ProgressBar value={intervention.approved_amount && intervention.disbursed_amount !== null ? ratio(intervention.disbursed_amount, intervention.approved_amount) : null} tone="bg-blue-500" /></div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            {milestones.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 p-3">
                <div className={cn("grid h-7 w-7 place-items-center rounded-full", item.complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                  {item.complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                </div>
                <p className="mt-3 text-[10px] font-bold text-slate-700">{item.label}</p>
                <p className="mt-1 text-[9px] text-slate-500">{formatDate(item.date)}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Assessment Assurance" description="Assessment approval and review posture for this intervention.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Approved", approvedAssessments.length],
              ["Reviewed", reviewedAssessments.length],
              ["Submitted", submittedAssessments.length],
              ["Draft", draftAssessments.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-[#0c1733]">{value}</p>
                <p className="text-[9px] font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          {latestAssessment ? (
            <Link href={`/dashboard/impact-intelligence/assessments/${latestAssessment.id}`} className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50/30">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Latest assessment</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{latestAssessment.title ?? humanize(latestAssessment.assessment_type)}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {formatDate(latestAssessment.submitted_at ?? latestAssessment.conducted_at ?? latestAssessment.created_at)}
                  {" · "}{typeof latestAssessment.score === "number" ? `${latestAssessment.score.toFixed(1)}%` : UNAVAILABLE}
                </p>
              </div>
              <StatusPill value={latestAssessment.status} />
            </Link>
          ) : <div className="mt-5"><EmptyPanel title="No assessments" description="No assessment records are linked to this intervention." icon={ClipboardCheck} /></div>}
        </Section>

        <Section
          title="Monitoring Command Centre"
          description="Visit completion, review posture, and the latest field activity."
          action={canScheduleMonitoring ? <Link href={scheduleHref} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Schedule visit <ArrowRight className="h-3.5 w-3.5" /></Link> : undefined}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Reviewed", reviewedVisits.length],
              ["Completed", completedVisits.length],
              ["Pending review", pendingVisits.length],
              ["Overdue", overdueVisits.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-[#0c1733]">{value}</p>
                <p className="text-[9px] font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          {latestVisit ? (
            <div className="mt-5 space-y-3">
              <Link href={`/dashboard/impact-intelligence/monitoring/${latestVisit.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50/30">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Latest visit</p>
                  <p className="mt-1 text-xs font-bold text-slate-800">{latestVisit.title ?? "Field visit"}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{formatDate(latestVisit.reviewed_at ?? latestVisit.completed_at ?? latestVisit.visit_date ?? latestVisit.created_at)}</p>
                </div>
                <StatusPill value={latestVisit.status} />
              </Link>
              <div className="space-y-2">
                {visits.slice(0, 4).map((visit) => (
                  <div key={visit.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-500" />
                    <p className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700">{visit.title ?? "Field visit"}</p>
                    <span className="text-[9px] text-slate-500">{formatDate(visit.visit_date ?? visit.scheduled_at)}</span>
                    <StatusPill value={visit.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="mt-5"><EmptyPanel title="No monitoring visits" description="No field visit records are linked to this intervention." icon={CalendarDays} /></div>}
        </Section>
      </div>

      <Section
        title="Evidence Integrity Centre"
        description="Verification decisions, checksum coverage, and linked delivery records."
        action={canViewEvidence ? <Link href="/dashboard/impact-intelligence/evidence" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Evidence repository <ArrowRight className="h-3.5 w-3.5" /></Link> : undefined}
      >
        {!evidenceSource.available ? (
          <EmptyPanel title="Evidence data unavailable" description="The evidence source could not be loaded. No integrity counts are being inferred." icon={ShieldCheck} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Verified", verifiedEvidence.length],
                ["Submitted", submittedEvidence.length],
                ["Returned", returnedEvidence.length],
                ["Rejected", rejectedEvidence.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-lg font-bold text-[#0c1733]">{value}</p>
                  <p className="text-[9px] font-semibold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            {verifiedEvidence.length === 0 ? (
              <EmptyPanel title="No verified evidence" description="No verified evidence records are linked to this intervention." icon={ShieldCheck} />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {verifiedEvidence.map((item) => (
                  <Link key={item.id} href={`/dashboard/impact-intelligence/evidence/${item.id}`} className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-200 hover:bg-emerald-50/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800">{item.original_filename ?? item.file_name}</p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {item.impact_field_visits?.title ?? item.impact_assessments?.title ?? "Direct intervention evidence"}
                        </p>
                      </div>
                      <StatusPill value={item.verification_status} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusPill value={item.checksum_sha256 ? "Checksum available" : UNAVAILABLE} />
                      <span className="text-[10px] font-semibold text-slate-500">{formatDate(item.reviewed_at ?? item.created_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Outcome Measurement Centre"
        description="Verified measurements only; unverified values do not contribute to outcome readiness."
        action={canViewIndicators ? <Link href="/dashboard/impact-intelligence/indicators" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Indicator workspace <ArrowRight className="h-3.5 w-3.5" /></Link> : undefined}
      >
        {!indicatorsSource.available || !indicatorAggregateSource.available ? (
          <EmptyPanel title="Outcome data unavailable" description="Indicator measurements or aggregate data could not be loaded. No outcome progress is being inferred." icon={Target} />
        ) : verifiedIndicators.length === 0 ? (
          <EmptyPanel title="No verified measurements" description="No verified indicator measurements are linked to this intervention." icon={Target} />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{verifiedIndicators.length}</p><p className="text-[9px] font-semibold text-slate-500">Verified measurements</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{indicatorAggregateSource.data?.averageProgressPercentage === null ? UNAVAILABLE : `${indicatorAggregateSource.data?.averageProgressPercentage ?? UNAVAILABLE}%`}</p><p className="text-[9px] font-semibold text-slate-500">Average progress</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{indicatorAggregateSource.data?.achievedCount ?? UNAVAILABLE}</p><p className="text-[9px] font-semibold text-slate-500">Achieved</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{indicatorAggregateSource.data?.belowTargetCount ?? UNAVAILABLE}</p><p className="text-[9px] font-semibold text-slate-500">Below target</p></div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {verifiedIndicators.map((item) => {
                const unit = item.impact_indicator_definitions?.unit_of_measure;
                return (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.impact_indicator_definitions?.name ?? "Indicator measurement"}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{formatDate(item.measurement_date)}</p>
                      </div>
                      <StatusPill value={item.outcome_status} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div><p className="text-[9px] text-slate-400">Baseline</p><p className="mt-1 text-xs font-bold text-slate-700">{formatMeasurement(item.baseline_value, unit)}</p></div>
                      <div><p className="text-[9px] text-slate-400">Current</p><p className="mt-1 text-xs font-bold text-slate-700">{formatMeasurement(item.measured_value, unit)}</p></div>
                      <div><p className="text-[9px] text-slate-400">Target</p><p className="mt-1 text-xs font-bold text-slate-700">{formatMeasurement(item.target_value, unit)}</p></div>
                    </div>
                    <div className="mt-4"><ProgressBar value={item.progress_percentage} tone={["below_target", "regressed"].includes(item.outcome_status) ? "bg-rose-500" : "bg-emerald-500"} /></div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      <Section title="Intervention Readiness Scorecard" description="Executive assurance across each delivery control.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {readiness.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon className="h-4 w-4" /></span>
                  <StatusPill value={readinessStatus(item.value)} />
                </div>
                <p className="mt-5 text-xl font-bold text-[#0c1733]">{item.value === null ? UNAVAILABLE : `${item.value}%`}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-600">{item.label}</p>
                <div className="mt-3"><ProgressBar value={item.value} tone={item.value !== null && item.value < 50 ? "bg-rose-500" : item.value !== null && item.value < 80 ? "bg-amber-500" : "bg-emerald-500"} /></div>
              </article>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Section
          title="Reports & Governance"
          description="Linked report status, versioning, export eligibility, and current reporting readiness."
          action={canViewReports ? <Link href="/dashboard/impact-intelligence/reports" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Report library <ArrowRight className="h-3.5 w-3.5" /></Link> : undefined}
        >
          {!reportsSource.available ? (
            <EmptyPanel title="Report data unavailable" description="The report source could not be loaded. No governance readiness is being inferred." icon={FileText} />
          ) : reports.length === 0 ? (
            <EmptyPanel title="No linked reports" description="No report records are linked to this intervention." icon={FileText} />
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Link key={report.id} href={`/dashboard/impact-intelligence/reports/${report.id}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50/30 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{report.title}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{humanize(report.report_type)} · {report.latest_version ? `v${report.latest_version.version_number}` : "Version unavailable"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill value={report.status} />
                    <StatusPill value={report.status === "approved" && report.latest_version ? "Export available" : UNAVAILABLE} />
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-4">
            <div><p className="text-xs font-bold text-slate-800">Current reporting readiness</p><p className="mt-1 text-[10px] text-slate-500">{approvedReports.length} of {reports.length} linked reports approved</p></div>
            <ProgressBar value={reportingReadiness} tone="bg-indigo-500" />
          </div>
          {latestReport && <p className="mt-3 text-[10px] text-slate-500">Latest report activity: {latestReport.title} on {formatDate(latestReport.approved_at ?? latestReport.generated_at ?? latestReport.created_at)}</p>}
        </Section>

        <Section title="Risks & Attention Centre" description="Recorded risk flags and delivery blockers requiring action.">
          <div className="space-y-3">
            {risksSource.available && openRiskFlags.map((flag) => (
              <div key={flag.id} className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-bold text-rose-900">{flag.title}</p><p className="mt-1 text-[10px] leading-5 text-rose-700">{flag.description}</p></div>
                  <StatusPill value={flag.severity} />
                </div>
              </div>
            ))}
            {attentionItems.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-[11px] font-semibold text-amber-900">{item}</p>
              </div>
            ))}
            {!risksSource.available && canViewRisks && <EmptyPanel title="Risk data unavailable" description="Recorded risk flags could not be loaded. Operational blockers remain listed where their sources are available." icon={AlertTriangle} />}
            {attentionItems.length === 0 && (!risksSource.available || openRiskFlags.length === 0) && (
              <EmptyPanel title="No current attention items" description="No scoped blockers or open risk flags are currently recorded for this intervention." icon={CheckCircle2} />
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Section title="Recent Activity Timeline" description="Real lifecycle, assurance, evidence, outcome, and reporting activity.">
          {activity.length === 0 ? (
            <EmptyPanel title="No activity recorded" description="No linked intervention activity is available yet." icon={Activity} />
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

        <Section title="Executive Summary" description="Current health across the intervention assurance chain.">
          <div className="space-y-3">
            {[
              ["Delivery Health", health],
              ["Assurance Health", healthFromReadiness(assessmentReadiness)],
              ["Evidence Health", healthFromReadiness(evidenceReadiness)],
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
            <p className="mt-4 text-2xl font-bold">{deliveryReadiness === null ? UNAVAILABLE : `${deliveryReadiness}%`}</p>
            <p className="mt-1 text-[10px] text-blue-100/70">Composite delivery readiness from all five available assurance controls.</p>
          </div>
        </Section>
      </div>

      {canEdit && officerOptionsFailed && (
        <Section title="Intervention Updates Unavailable">
          <EmptyPanel title="Intervention update options could not load" description="Field-officer options are temporarily unavailable. The war room remains readable, but lifecycle updates are disabled." icon={HandCoins} />
        </Section>
      )}

      {canManage && (
        <Section id="manage" title="Manage Intervention" description="Update the existing lifecycle fields or append a real timeline event.">
          <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
            <form action={updateProgress} className="rounded-2xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold text-slate-700">Status<select name="status" defaultValue={intervention.status ?? "planned"} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal">{INTERVENTION_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">Stage<select name="stage" defaultValue={stage} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal">{INTERVENTION_STAGES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">Assigned officer<select name="assigned_officer_id" defaultValue={intervention.assigned_officer_id ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"><option value="">Unassigned</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? officer.id}</option>)}</select></label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">Approved amount<input name="approved_amount" type="number" min="0" step="1000" defaultValue={intervention.approved_amount ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">Disbursed amount<input name="disbursed_amount" type="number" min="0" step="1000" defaultValue={intervention.disbursed_amount ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">Start date<input name="start_date" type="date" defaultValue={intervention.start_date ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">End date<input name="end_date" type="date" defaultValue={intervention.end_date ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">Closure reason<input name="closure_reason" defaultValue={intervention.closure_reason ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">Closure note<textarea name="closure_note" rows={2} defaultValue={intervention.closure_note ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
              </div>
              <textarea name="note" rows={3} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Progress note" />
              <div className="mt-3 flex justify-end"><Button type="submit">Update progress</Button></div>
            </form>
            <form action={addNote} className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-xs font-bold text-slate-800">Append timeline event</h3>
              <input name="title" className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Event title" />
              <textarea required name="note" rows={7} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Timeline note" />
              <div className="mt-3 flex justify-end"><Button type="submit">Add event</Button></div>
            </form>
          </div>
        </Section>
      )}

      <Section title="Intervention Record" description="Core identifiers and lifecycle fields retained from the source record.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Intervention type", humanize(intervention.intervention_type), HandCoins],
            ["Approved amount", formatCurrency(intervention.approved_amount), Banknote],
            ["Closure reason", intervention.closure_reason ?? UNAVAILABLE, FileCheck2],
            ["Created", formatDateTime(intervention.created_at), Clock3],
          ].map(([label, value, Icon]) => {
            const RecordIcon = Icon as typeof HandCoins;
            return (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
                <RecordIcon className="h-4 w-4 text-slate-400" />
                <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label as string}</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{value as string}</p>
              </div>
            );
          })}
        </div>
      </Section>
    </section>
  );
}
