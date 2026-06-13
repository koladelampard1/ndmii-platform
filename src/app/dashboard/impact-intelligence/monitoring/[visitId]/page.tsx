import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  Link2,
  MapPin,
  Network,
  Pencil,
  ShieldCheck,
  Target,
  Upload,
  UserCheck,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isImpactProgrammeReadDenied } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import {
  assignFieldVisit,
  completeFieldVisit,
  EVIDENCE_CATEGORIES,
  getFieldVisit,
  listUserPickerOptions,
  MONITORING_MANAGE_ROLES,
  MONITORING_REVIEW_ROLES,
  type UserPickerOption,
} from "@/lib/data/impact-intelligence";
import {
  listImpactEvidence,
  logImpactEvidenceDiagnostic,
  type ImpactEvidenceRecord,
} from "@/lib/data/impact-evidence";
import { uploadImpactEvidence } from "@/lib/data/impact-evidence";
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

const ROUTE = "/dashboard/impact-intelligence/monitoring/[visitId]";
const UNAVAILABLE = "Unavailable";

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";
type ReportWithExportState = InstitutionalReport & { exportCount: number | null };

async function assignVisitAction(visitId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const assignedTo = String(formData.get("assigned_to_user_id") ?? "");
  try {
    if (assignedTo) await assignFieldVisit(ctx, visitId, assignedTo);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "monitoring_assignment_failed", error });
    if (!isExpectedMonitoringActionError(error)) throw error;
    redirectWithMonitoringError(visitId, error);
  }
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}`);
}

async function completeVisitAction(visitId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await completeFieldVisit(ctx, visitId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "monitoring_completion_failed", error });
    if (!isExpectedMonitoringActionError(error)) throw error;
    redirectWithMonitoringError(visitId, error);
  }
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}`);
}

async function createEvidenceAction(visitId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  formData.set("field_visit_id", visitId);
  try {
    await uploadImpactEvidence(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "monitoring_evidence_upload_failed", error });
    if (!isExpectedMonitoringActionError(error)) throw error;
    redirectWithMonitoringError(visitId, error);
  }
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}`);
}

const EXPECTED_MONITORING_ACTION_ERRORS = [
  "Selected field officer does not exist.",
  "Selected assignee must have field_officer role.",
  "You do not have permission to manage field monitoring.",
  "You do not have permission to complete this field visit.",
  "You can only access field visits assigned to you.",
  "Choose an evidence file to upload.",
  "Evidence file must be 10MB or smaller.",
  "Evidence must be a PDF",
  "You do not have permission to upload impact evidence.",
  "Selected evidence",
  "already uploaded",
  "assigned visits or beneficiaries",
  "upload failed",
  "could not be saved",
];

function isExpectedMonitoringActionError(error: unknown) {
  return error instanceof Error && EXPECTED_MONITORING_ACTION_ERRORS.some((message) => error.message.includes(message));
}

function redirectWithMonitoringError(visitId: string, error: unknown): never {
  const params = new URLSearchParams();
  params.set("error", error instanceof Error ? error.message : "Monitoring action could not be completed.");
  redirect(`/dashboard/impact-intelligence/monitoring/${visitId}?${params.toString()}`);
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

function toneForStatus(value: string | null | undefined) {
  return impactStatusTone(value);
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

function ProgressCard({ label, value, icon: Icon }: { label: string; value: number | null; icon: typeof Gauge }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
        <StatusPill value={value === null ? UNAVAILABLE : value >= 80 ? "Ready" : value >= 50 ? "In Progress" : "Needs Attention"} />
      </div>
      <p className="mt-5 text-2xl font-bold text-[#0c1733]">{formatPercent(value)}</p>
      <p className="mt-1 text-[10px] font-semibold text-slate-500">{label}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

function isVerifiedEvidence(item: ImpactEvidenceRecord) {
  return item.status === "verified" && item.verification_status === "verified";
}

function reportVisitIds(report: InstitutionalReport) {
  return report.latest_version?.field_visit_ids ?? [];
}

function healthFromReadiness(value: number | null): HealthState {
  if (value === null) return "Unavailable";
  if (value >= 80) return "Healthy";
  if (value >= 50) return "Watchlist";
  return "At Risk";
}

export default async function MonitoringDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ visitId: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { visitId } = await params;
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let detail: Awaited<ReturnType<typeof getFieldVisit>> | null = null;

  try {
    ctx = await getCurrentUserContext();
    detail = await getFieldVisit(ctx, visitId);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "monitoring_detail_load_failed", error });
    const description = isImpactProgrammeReadDenied(error)
      ? error.message
      : "The monitoring source, current session, or assigned scope is temporarily unavailable.";
    return (
      <section className="space-y-6">
        <Section title="Monitoring Visit Unavailable">
          <EmptyState title="Monitoring visit could not load" description={description} icon={CalendarCheck} />
        </Section>
      </section>
    );
  }

  const { visit, assignments, checklist, notes, evidence: detailEvidence } = detail;
  if (!visit) notFound();

  const canManage = MONITORING_MANAGE_ROLES.includes(ctx.role) && canRole(ctx.role, "monitoring_visit", "update");
  const canReview = MONITORING_REVIEW_ROLES.includes(ctx.role) && canRole(ctx.role, "monitoring_visit", "review");
  const canComplete = (ctx.role === "field_officer" || canManage) && canRole(ctx.role, "monitoring_visit", "update");
  const canUploadEvidence = canRole(ctx.role, "evidence", "create");
  const canViewEvidence = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence");
  const canViewAssessment = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/assessments");
  const canViewIntervention = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/interventions");
  const canViewIndicators = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/indicators");
  const canViewReports = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");

  const [officersSource, evidenceSource, indicatorsSource, reportsSource] = await Promise.all([
    loadSource(ctx, "monitoring_officer_options_load_failed", () => listUserPickerOptions("field_officer"), [] as UserPickerOption[]),
    loadSource(ctx, "monitoring_detail_evidence_unavailable", async () => {
      try {
        return await listImpactEvidence(ctx, { fieldVisitId: visitId, limit: 100 });
      } catch (error) {
        logImpactEvidenceDiagnostic({
          operation: "monitoring_detail_evidence_unavailable",
          actorRole: ctx.role,
          fieldVisitId: visitId,
          success: false,
          errorCode: "source_unavailable",
          errorMessage: error instanceof Error ? error.message : "Unknown evidence error",
        });
        throw error;
      }
    }, detailEvidence as ImpactEvidenceRecord[]),
    loadSource(ctx, "monitoring_detail_indicator_measurements_unavailable", async () => {
      try {
        return await listIndicatorMeasurements(ctx, { fieldVisitId: visitId, limit: 100 });
      } catch (error) {
        logImpactIndicatorDiagnostic({
          operation: "monitoring_detail_indicator_measurements_unavailable",
          role: ctx.role,
          authUserId: ctx.authUserId,
          appUserId: ctx.appUserId,
          fieldVisitId: visitId,
          errorMessage: error instanceof Error ? error.message : "Unknown indicator error",
          success: false,
        });
        throw error;
      }
    }, [] as ImpactIndicatorMeasurement[]),
    loadSource(ctx, "monitoring_detail_reports_unavailable", async () => {
      try {
        const reports = await listInstitutionalReports(ctx, 100);
        return reports.filter((report) => reportVisitIds(report).includes(visitId));
      } catch (error) {
        logImpactReportDiagnostic({
          operation: "monitoring_detail_reports_unavailable",
          role: ctx.role,
          appUserId: ctx.appUserId,
          errorMessage: error instanceof Error ? error.message : "Unknown report error",
          success: false,
        });
        throw error;
      }
    }, [] as InstitutionalReport[]),
  ]);

  const linkedReports: ReportWithExportState[] = reportsSource.available
    ? await Promise.all(reportsSource.data.map(async (report) => {
      try {
        const reportDetail = await getInstitutionalReport(ctx, report.id, { includeSources: true, enforceReadScope: false });
        return { ...report, exportCount: reportDetail.exports?.length ?? (reportDetail.exports === null ? null : 0) };
      } catch (error) {
        unstable_rethrow(error);
        logImpactReportDiagnostic({
          operation: "monitoring_linked_report_exports_unavailable",
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

  const fieldOfficers = officersSource.data;
  const evidence = evidenceSource.data;
  const indicatorMeasurements = indicatorsSource.data;
  const assignedOfficer = fieldOfficers.find((officer) => officer.id === visit.assigned_to_user_id);
  const assignedOfficerName = visit.assigned_to_user_id === ctx.appUserId
    ? ctx.fullName ?? ctx.email ?? UNAVAILABLE
    : assignedOfficer?.full_name ?? assignedOfficer?.email ?? UNAVAILABLE;

  const completedChecklist = checklist.filter((item) => item.is_completed);
  const requiredChecklist = checklist.filter((item) => item.is_required);
  const completedRequiredChecklist = requiredChecklist.filter((item) => item.is_completed);
  const unresolvedChecklist = checklist.filter((item) => !item.is_completed);
  const verifiedEvidence = evidence.filter(isVerifiedEvidence);
  const submittedEvidence = evidence.filter((item) => ["submitted", "under_review"].includes(item.status));
  const returnedEvidence = evidence.filter((item) => item.status === "returned");
  const rejectedEvidence = evidence.filter((item) => item.status === "rejected");
  const verifiedMeasurements = indicatorMeasurements.filter((item) => item.verification_status === "verified");
  const uniqueIndicatorIds = new Set(indicatorMeasurements.map((item) => item.indicator_definition_id));
  const approvedReports = linkedReports.filter((report) => report.status === "approved");
  const visitCompleted = ["completed", "reviewed"].includes(visit.status ?? "");
  const reviewComplete = visit.status === "reviewed" || Boolean(visit.reviewed_at);
  const evidenceVerified = evidenceSource.available && evidence.length > 0 && verifiedEvidence.length === evidence.length;
  const outcomeReady = indicatorsSource.available && indicatorMeasurements.length > 0 && verifiedMeasurements.length === indicatorMeasurements.length;
  const reportReady = reviewComplete && evidenceVerified && outcomeReady;

  const monitoringReadiness = checklist.length > 0
    ? ratio(completedChecklist.length, checklist.length)
    : visitCompleted ? 100 : 0;
  const evidenceReadiness = evidenceSource.available
    ? evidence.length > 0 ? ratio(verifiedEvidence.length, evidence.length) : 0
    : null;
  const outcomeReadiness = indicatorsSource.available
    ? indicatorMeasurements.length > 0 ? ratio(verifiedMeasurements.length, indicatorMeasurements.length) : 0
    : null;
  const reportingReadiness = reportsSource.available
    ? linkedReports.length > 0 ? ratio(approvedReports.length, linkedReports.length) : reportReady ? 100 : 0
    : null;
  const readiness = average([monitoringReadiness, evidenceReadiness, outcomeReadiness, reportingReadiness]);

  const risks = [
    ...(!visitCompleted ? ["Visit completion has not been recorded."] : []),
    ...(requiredChecklist.length > completedRequiredChecklist.length ? [`${requiredChecklist.length - completedRequiredChecklist.length} required checklist item${requiredChecklist.length - completedRequiredChecklist.length === 1 ? " is" : "s are"} incomplete.`] : []),
    ...(evidenceSource.available && evidence.length === 0 ? ["No evidence is linked to this visit."] : []),
    ...(submittedEvidence.length > 0 ? [`${submittedEvidence.length} evidence record${submittedEvidence.length === 1 ? " is" : "s are"} pending verification.`] : []),
    ...(returnedEvidence.length > 0 ? [`${returnedEvidence.length} evidence record${returnedEvidence.length === 1 ? " was" : "s were"} returned.`] : []),
    ...(rejectedEvidence.length > 0 ? [`${rejectedEvidence.length} evidence record${rejectedEvidence.length === 1 ? " was" : "s were"} rejected.`] : []),
    ...(visitCompleted && !reviewComplete ? ["Visit review is pending."] : []),
    ...(!visit.findings ? ["Recorded findings are unavailable."] : []),
    ...(indicatorsSource.available && indicatorMeasurements.length === 0 ? ["No indicator measurement is linked to this visit."] : []),
    ...(indicatorMeasurements.length > verifiedMeasurements.length ? [`${indicatorMeasurements.length - verifiedMeasurements.length} indicator measurement${indicatorMeasurements.length - verifiedMeasurements.length === 1 ? " is" : "s are"} not verified.`] : []),
    ...(reportsSource.available && linkedReports.length === 0 ? ["No institutional report references this visit."] : []),
  ];
  const allAssuranceSourcesAvailable = evidenceSource.available && indicatorsSource.available && reportsSource.available;
  const health: HealthState = !allAssuranceSourcesAvailable
    ? "Unavailable"
    : rejectedEvidence.length > 0 || returnedEvidence.length > 0
      ? "At Risk"
      : reportReady && risks.length === 0
        ? "Healthy"
        : "Watchlist";

  const lifecycle = [
    { label: "Scheduled", complete: Boolean(visit.scheduled_at ?? visit.visit_date) },
    { label: "Assigned", complete: Boolean(visit.assigned_to_user_id) },
    { label: "In Progress", complete: ["in_progress", "completed", "reviewed"].includes(visit.status ?? "") || completedChecklist.length > 0 },
    { label: "Completed", complete: visitCompleted },
    { label: "Reviewed", complete: reviewComplete },
    { label: "Evidence Verified", complete: evidenceVerified },
    { label: "Outcome Ready", complete: outcomeReady },
    { label: "Report Ready", complete: reportReady },
  ];
  const currentLifecycleIndex = lifecycle.reduce((current, item, index) => item.complete ? index : current, 0);

  const activity = [
    ...(visit.created_at ? [{ type: "Visit scheduled", title: visit.title ?? "Field visit", date: visit.created_at, href: null as string | null, icon: CalendarCheck }] : []),
    ...assignments.map((item) => ({
      type: "Officer assigned",
      title: item.assigned_to_user_id === visit.assigned_to_user_id ? assignedOfficerName : "Field officer",
      date: item.assigned_at,
      href: null as string | null,
      icon: UserCheck,
    })),
    ...(visit.completed_at ? [{ type: "Visit completed", title: visit.title ?? "Field visit", date: visit.completed_at, href: null as string | null, icon: CheckCircle2 }] : []),
    ...(visit.reviewed_at ? [{ type: "Visit reviewed", title: visit.title ?? "Field visit", date: visit.reviewed_at, href: null as string | null, icon: ShieldCheck }] : []),
    ...evidence.filter((item) => item.uploaded_at ?? item.created_at).map((item) => ({
      type: "Evidence uploaded",
      title: item.original_filename ?? item.file_name,
      date: item.uploaded_at ?? item.created_at!,
      href: canViewEvidence ? `/dashboard/impact-intelligence/evidence/${item.id}` : null,
      icon: Upload,
    })),
    ...verifiedEvidence.map((item) => ({
      type: "Evidence verified",
      title: item.original_filename ?? item.file_name,
      date: item.reviewed_at ?? item.created_at!,
      href: canViewEvidence ? `/dashboard/impact-intelligence/evidence/${item.id}` : null,
      icon: BadgeCheck,
    })),
    ...verifiedMeasurements.map((item) => ({
      type: "Outcome verified",
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
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const assignVisit = assignVisitAction.bind(null, visit.id);
  const completeVisit = completeVisitAction.bind(null, visit.id);
  const createEvidence = createEvidenceAction.bind(null, visit.id);

  return (
    <section className="space-y-5 pb-8">
      <header className="overflow-hidden rounded-2xl bg-[#071a3a] text-white shadow-xl shadow-blue-950/10">
        <div className="relative p-5 sm:p-7">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Field Visit Review & Verification War Room</p>
                <StatusPill value={visit.status} dark />
                <StatusPill value={health} dark />
              </div>
              <h1 className="mt-4 max-w-4xl text-2xl font-bold tracking-tight sm:text-3xl">{visit.title ?? "Field Visit"}</h1>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-blue-100/75">
                {visit.impact_programmes?.name ?? UNAVAILABLE} · {visit.msmes?.business_name ?? UNAVAILABLE} · {visit.location_text ?? UNAVAILABLE}
              </p>
              <div className="mt-5 grid gap-3 text-[10px] sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Cohort", visit.impact_beneficiary_cohorts?.name ?? UNAVAILABLE],
                  ["Assigned officer", assignedOfficerName],
                  ["Scheduled", formatDateTime(visit.scheduled_at ?? visit.visit_date)],
                  ["Completed", formatDateTime(visit.completed_at)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="uppercase tracking-[0.12em] text-blue-200/60">{label}</p>
                    <p className="mt-1 truncate font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  ["Visit Completed", visitCompleted],
                  ["Review Complete", reviewComplete],
                  ["Evidence Verified", evidenceVerified],
                  ["Outcome Ready", outcomeReady],
                  ["Report Ready", reportReady],
                ].map(([label, ready]) => (
                  <span key={String(label)} className={cn("rounded-full border px-3 py-1 text-[9px] font-bold", ready ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-blue-100/60")}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex max-w-xl flex-wrap gap-2 xl:justify-end">
              {canComplete && visit.status !== "reviewed" && <Link href="#manage-visit" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[10px] font-bold text-[#0b1e42]"><Pencil className="h-3.5 w-3.5" /> Edit Visit</Link>}
              {canManage && <Link href="#assignment" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold text-white"><UserCheck className="h-3.5 w-3.5" /> Assign Officer</Link>}
              {canUploadEvidence && <Link href="#upload-evidence" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold text-white"><Upload className="h-3.5 w-3.5" /> Upload Evidence</Link>}
              {canReview && visit.status === "completed" && <Link href="#review-visit" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-[10px] font-bold text-[#071a3a]"><ShieldCheck className="h-3.5 w-3.5" /> Review Visit</Link>}
            </div>
          </div>
        </div>
      </header>

      {query.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{query.error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Evidence Records" value={evidenceSource.available ? formatNumber(evidence.length) : UNAVAILABLE} icon={FileText} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Verified Evidence" value={evidenceSource.available ? formatNumber(verifiedEvidence.length) : UNAVAILABLE} icon={BadgeCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Indicators Linked" value={indicatorsSource.available ? formatNumber(uniqueIndicatorIds.size) : UNAVAILABLE} icon={Target} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Assessments Linked" value={visit.assessment_id ? "1" : "0"} icon={ClipboardCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Open Issues" value={allAssuranceSourcesAvailable ? formatNumber(risks.length) : UNAVAILABLE} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="Readiness" value={formatPercent(readiness)} icon={Gauge} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Review Status" value={reviewComplete ? "Complete" : visitCompleted ? "Pending" : UNAVAILABLE} icon={ShieldCheck} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Assurance Status" value={health} icon={FileCheck2} tone="bg-slate-100 text-slate-700" />
      </div>

      <Section title="Monitoring Assurance Lifecycle" description="Current progression from scheduling through report readiness.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {lifecycle.map((item, index) => (
            <div key={item.label} className={cn("relative rounded-xl border p-3", item.complete ? "border-blue-200 bg-blue-50/70" : index === currentLifecycleIndex + 1 ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-slate-50")}>
              <div className="flex items-center gap-2">
                <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold", item.complete ? "bg-blue-600 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200")}>{index + 1}</span>
                <p className="text-[10px] font-bold text-slate-700">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Section title="Beneficiary & Context Profile" description="Scoped beneficiary, delivery, and intervention context for this visit.">
          <dl className="grid gap-3 sm:grid-cols-2">
            {([
              ["Beneficiary", visit.impact_cohort_members ? `Cohort beneficiary · ${humanize(visit.impact_cohort_members.member_status)}` : UNAVAILABLE, UserRound],
              ["MSME", visit.msmes?.business_name ?? UNAVAILABLE, UserCheck],
              ["Programme", visit.impact_programmes?.name ?? UNAVAILABLE, Network],
              ["Cohort", visit.impact_beneficiary_cohorts?.name ?? UNAVAILABLE, Link2],
              ["Intervention", visit.impact_interventions?.title ?? UNAVAILABLE, Target],
              ["Sector", visit.msmes?.sector ?? UNAVAILABLE, Gauge],
              ["State", visit.msmes?.state ?? UNAVAILABLE, MapPin],
              ["MSME ID", visit.msmes?.msme_id ?? UNAVAILABLE, BadgeCheck],
            ] satisfies Array<[string, string, LucideIcon]>).map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 p-3">
                <Icon className="h-4 w-4 text-blue-600" />
                <dt className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
                <dd className="mt-1 text-xs font-semibold leading-5 text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          {visit.intervention_id && canViewIntervention && (
            <Link href={`/dashboard/impact-intelligence/interventions/${visit.intervention_id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">
              Open intervention context <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </Section>

        <Section title="Visit Summary Centre" description="Visit objectives, observations, completion details, officer notes, and recorded outcomes.">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Objectives", checklist.length > 0 ? checklist.map((item) => item.checklist_item).join(" · ") : UNAVAILABLE],
              ["Observations", visit.findings ?? UNAVAILABLE],
              ["Completion details", visitCompleted ? `${completedChecklist.length} of ${checklist.length} checklist activities completed on ${formatDate(visit.completed_at)}.` : UNAVAILABLE],
              ["Officer notes", notes.find((note) => note.note_type === "field_note")?.note ?? notes[0]?.note ?? UNAVAILABLE],
              ["Visit outcomes", visit.recommendations ?? UNAVAILABLE],
              ["Location", visit.location_text ?? UNAVAILABLE],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-blue-700">{label}</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">{value}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Monitoring Findings Zone" description="Recorded findings, completed activities, observations, and unresolved field items.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#0b1e42] p-5 text-white">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-300">Key findings</p>
            <p className="mt-3 text-sm leading-7 text-blue-50">{visit.findings ?? UNAVAILABLE}</p>
            <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-300">Recorded observations</p>
            <p className="mt-3 text-xs leading-6 text-blue-100/75">{notes.length > 0 ? notes.map((note) => note.note).join(" · ") : UNAVAILABLE}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-xs font-bold text-emerald-900">Completed activities</p>
              <div className="mt-3 space-y-2">
                {completedChecklist.length > 0 ? completedChecklist.map((item) => <p key={item.id} className="text-[11px] leading-5 text-emerald-800">✓ {item.checklist_item}</p>) : <p className="text-[11px] text-emerald-800">{UNAVAILABLE}</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-xs font-bold text-amber-900">Unresolved items</p>
              <div className="mt-3 space-y-2">
                {unresolvedChecklist.length > 0 ? unresolvedChecklist.map((item) => <p key={item.id} className="text-[11px] leading-5 text-amber-900">• {item.checklist_item}</p>) : <p className="text-[11px] text-amber-800">{checklist.length > 0 ? "No unresolved checklist items." : UNAVAILABLE}</p>}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Evidence Verification Centre" description="Submitted evidence and its current verification state. Storage paths are never displayed.">
        {!evidenceSource.available ? (
          <EmptyPanel title="Evidence unavailable" description="The scoped evidence source could not be loaded." icon={FileText} />
        ) : evidence.length === 0 ? (
          <EmptyPanel title="No evidence linked" description="No evidence record is currently linked to this visit." icon={FileText} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {evidence.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <p className="mt-3 truncate text-xs font-bold text-[#0c1733]">{item.original_filename ?? item.file_name}</p>
                    <p className="mt-1 text-[9px] text-slate-500">{humanize(item.evidence_category)}</p>
                  </div>
                  <StatusPill value={item.verification_status ?? item.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Checksum</dt><dd className="mt-1 text-[11px] font-bold text-slate-700">{item.checksum_sha256 ? "Recorded" : UNAVAILABLE}</dd></div>
                  <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Uploaded</dt><dd className="mt-1 text-[11px] font-bold text-slate-700">{formatDate(item.uploaded_at ?? item.created_at)}</dd></div>
                  <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Assessment</dt><dd className="mt-1 truncate text-[11px] font-bold text-slate-700">{item.impact_assessments?.title ?? UNAVAILABLE}</dd></div>
                  <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Intervention</dt><dd className="mt-1 truncate text-[11px] font-bold text-slate-700">{item.impact_interventions?.title ?? UNAVAILABLE}</dd></div>
                </dl>
                {canViewEvidence && <Link href={`/dashboard/impact-intelligence/evidence/${item.id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">Review evidence <ArrowRight className="h-3.5 w-3.5" /></Link>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Verified", evidenceSource.available ? verifiedEvidence.length : null],
            ["Submitted", evidenceSource.available ? submittedEvidence.length : null],
            ["Returned", evidenceSource.available ? returnedEvidence.length : null],
            ["Rejected", evidenceSource.available ? rejectedEvidence.length : null],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
              <p className="text-lg font-bold text-[#0c1733]">{typeof value === "number" ? value : UNAVAILABLE}</p>
              <p className="text-[9px] font-semibold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Section title="Assessment & Outcome Linkage" description="Existing assessment, indicator, score, and verified outcome relationships.">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-blue-700">Linked assessment</p>
                <p className="mt-2 text-sm font-bold text-[#0c1733]">{visit.impact_assessments?.title ?? UNAVAILABLE}</p>
                <p className="mt-1 text-[10px] text-slate-500">{humanize(visit.impact_assessments?.assessment_type)}</p>
              </div>
              <StatusPill value={visit.assessment_id ? "Linked" : UNAVAILABLE} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Assessment status</dt>
                <dd className="mt-1 text-[11px] font-bold text-slate-700">{UNAVAILABLE}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Score summary</dt>
                <dd className="mt-1 text-[11px] font-bold text-slate-700">{UNAVAILABLE}</dd>
              </div>
            </dl>
            {visit.assessment_id && canViewAssessment && <Link href={`/dashboard/impact-intelligence/assessments/${visit.assessment_id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">Open assessment <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </div>
          {!indicatorsSource.available ? (
            <div className="mt-3"><EmptyPanel title="Outcome data unavailable" description="Visit-linked indicator measurements could not be loaded." icon={Target} /></div>
          ) : indicatorMeasurements.length === 0 ? (
            <div className="mt-3"><EmptyPanel title="No outcomes linked" description="No indicator measurement is currently linked to this visit." icon={Target} /></div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {indicatorMeasurements.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-slate-800">{item.impact_indicator_definitions?.name ?? "Indicator measurement"}</p>
                    <StatusPill value={item.verification_status} />
                  </div>
                  <p className="mt-3 text-lg font-bold text-[#0c1733]">{item.measured_value === null ? UNAVAILABLE : `${item.measured_value.toLocaleString("en-NG")}${item.impact_indicator_definitions?.unit_of_measure ? ` ${item.impact_indicator_definitions.unit_of_measure}` : ""}`}</p>
                  <p className="mt-1 text-[9px] text-slate-500">{humanize(item.outcome_status)} · {formatDate(item.measurement_date)}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Readiness Scorecard" description="Assurance ratios derived only from loaded visit records.">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProgressCard label="Monitoring Readiness" value={monitoringReadiness} icon={CalendarCheck} />
            <ProgressCard label="Evidence Readiness" value={evidenceReadiness} icon={ShieldCheck} />
            <ProgressCard label="Outcome Readiness" value={outcomeReadiness} icon={Target} />
            <ProgressCard label="Reporting Readiness" value={reportingReadiness} icon={FileCheck2} />
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Section title="Risks & Exceptions" description="Real incomplete, pending, missing, or rejected conditions affecting assurance.">
          {risks.length === 0 ? (
            <EmptyPanel title="No current blockers" description="No exception is present in the currently loaded visit sources." icon={CheckCircle2} />
          ) : (
            <div className="space-y-2">
              {risks.map((risk) => (
                <div key={risk} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-[11px] font-semibold leading-5 text-amber-950">{risk}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Linked Reports" description="Institutional report versions that explicitly reference this visit.">
          {!reportsSource.available ? (
            <EmptyPanel title="Reports unavailable" description="Linked institutional reports could not be loaded for this role or source." icon={FileText} />
          ) : linkedReports.length === 0 ? (
            <EmptyPanel title="No linked reports" description="No institutional report version currently references this visit." icon={FileText} />
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
                    <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Status</dt><dd className="mt-1 text-[11px] font-bold text-slate-700">{humanize(report.status)}</dd></div>
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
        <Section title="Activity Timeline" description="Real dated visit, assignment, evidence, outcome, and reporting activity.">
          {activity.length === 0 ? (
            <EmptyPanel title="No activity recorded" description="No dated activity is available for this visit." icon={Activity} />
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

        <Section title="Executive Monitoring Summary" description="Current health across the field assurance chain.">
          <div className="space-y-3">
            {[
              ["Visit Health", healthFromReadiness(monitoringReadiness)],
              ["Evidence Health", healthFromReadiness(evidenceReadiness)],
              ["Outcome Health", healthFromReadiness(outcomeReadiness)],
              ["Assurance Health", health],
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
            <p className="mt-1 text-[10px] text-blue-100/70">Composite readiness based only on available monitoring, evidence, outcome, and reporting controls.</p>
          </div>
        </Section>
      </div>

      {(canComplete || canManage || canUploadEvidence || (canReview && visit.status === "completed")) && (
        <Section id="manage-visit" title="Visit Operations" description="Existing completion, assignment, evidence, and review actions with unchanged permissions.">
          <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            {canComplete && visit.status !== "reviewed" ? (
              <form action={completeVisit} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-bold text-slate-800">Complete field visit</h3>
                  <StatusPill value={visit.status} />
                </div>
                <div className="mt-4 space-y-2">
                  {checklist.length > 0 ? checklist.map((item) => (
                    <label key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
                      <input name={`checklist_${item.id}`} type="checkbox" defaultChecked={item.is_completed} className="mt-0.5" />
                      <span><span className="font-semibold text-slate-900">{item.checklist_item}</span><span className="mt-1 block text-[9px] text-slate-500">{humanize(item.item_category)} · {item.is_required ? "Required" : "Optional"}</span></span>
                    </label>
                  )) : <EmptyPanel title="Checklist unavailable" description="No checklist items are recorded for this visit." icon={ClipboardCheck} />}
                </div>
                <textarea name="findings" rows={4} defaultValue={visit.findings ?? ""} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Field findings" />
                <textarea name="recommendations" rows={3} defaultValue={visit.recommendations ?? ""} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Recommendations or follow-up needs" />
                <textarea name="note" rows={3} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Monitoring note" />
                <div className="mt-3 flex justify-end"><Button type="submit">Complete Visit</Button></div>
              </form>
            ) : (
              <div className="rounded-2xl border border-slate-200 p-4"><EmptyPanel title="Visit editing unavailable" description="This role has read-only access or the visit is already reviewed." icon={ShieldCheck} /></div>
            )}

            <div className="space-y-4">
              {canManage && (
                <form id="assignment" action={assignVisit} className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold text-slate-800">Assign officer</h3>
                  {!officersSource.available ? (
                    <div className="mt-3"><EmptyPanel title="Officer options unavailable" description="Assignment is temporarily disabled." icon={UserCheck} /></div>
                  ) : (
                    <>
                      <select name="assigned_to_user_id" defaultValue={visit.assigned_to_user_id ?? ""} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                        <option value="">Select field officer</option>
                        {fieldOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? "Field officer"}</option>)}
                      </select>
                      <Button type="submit" className="mt-3 w-full">Assign Officer</Button>
                    </>
                  )}
                </form>
              )}

              {canUploadEvidence && (
                <form id="upload-evidence" action={createEvidence} className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold text-slate-800">Upload evidence</h3>
                  <input required name="evidence_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white" />
                  <select name="evidence_category" defaultValue="monitoring_photo" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    {EVIDENCE_CATEGORIES.map((category) => <option key={category} value={category}>{humanize(category)}</option>)}
                  </select>
                  <input name="file_url" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Optional placeholder URL" />
                  <input type="hidden" name="programme_id" value={visit.programme_id ?? ""} />
                  <input type="hidden" name="cohort_id" value={visit.cohort_id ?? ""} />
                  <input type="hidden" name="cohort_member_id" value={visit.cohort_member_id ?? ""} />
                  <input type="hidden" name="intervention_id" value={visit.intervention_id ?? ""} />
                  <input type="hidden" name="assessment_id" value={visit.assessment_id ?? ""} />
                  <input type="hidden" name="msme_id" value={visit.msme_id ?? ""} />
                  <textarea name="description" rows={3} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Evidence description" />
                  <Button type="submit" className="mt-3 w-full">Upload Evidence</Button>
                </form>
              )}

              {canReview && visit.status === "completed" && (
                <form id="review-visit" action={completeVisit} className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                  <h3 className="text-xs font-bold text-slate-800">Review visit</h3>
                  <input type="hidden" name="review_action" value="reviewed" />
                  <textarea name="review_note" rows={4} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Review note" />
                  <Button type="submit" className="mt-3 w-full">Submit Review</Button>
                </form>
              )}
            </div>
          </div>
        </Section>
      )}

      <Section title="Visit Record" description="Core identifiers and source timestamps retained from the monitoring record.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["Priority", humanize(visit.priority), AlertTriangle],
            ["Scheduled", formatDateTime(visit.scheduled_at ?? visit.visit_date), CalendarCheck],
            ["Reviewed", formatDateTime(visit.reviewed_at), ShieldCheck],
            ["Created", formatDateTime(visit.created_at), Clock3],
          ] satisfies Array<[string, string, LucideIcon]>).map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 p-3">
              <Icon className="h-4 w-4 text-blue-600" />
              <p className="mt-3 text-[9px] uppercase tracking-[0.1em] text-slate-400">{label}</p>
              <p className="mt-1 text-xs font-bold text-slate-700">{value}</p>
            </div>
          ))}
        </div>
      </Section>
    </section>
  );
}
