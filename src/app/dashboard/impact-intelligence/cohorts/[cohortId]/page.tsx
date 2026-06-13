import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  MapPin,
  Network,
  Plus,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isImpactProgrammeReadDenied } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import {
  COHORT_MANAGE_ROLES,
  COHORT_MEMBER_STATUSES,
  enrollImpactCohortMembers,
  getImpactCohortDetail,
  getInterventionStage,
  listImpactAssessments,
  listImpactFieldVisits,
  listImpactInterventions,
  listMsmePickerOptions,
  listUserPickerOptions,
  updateImpactCohortMemberStatus,
  type ImpactIntervention,
} from "@/lib/data/impact-intelligence";
import {
  listImpactEvidence,
  logImpactEvidenceDiagnostic,
  type ImpactEvidenceRecord,
} from "@/lib/data/impact-evidence";
import {
  aggregateCohortIndicators,
  listIndicatorMeasurements,
  logImpactIndicatorDiagnostic,
} from "@/lib/data/impact-indicators";
import { listInstitutionalReports } from "@/lib/data/impact-reports";
import { cn } from "@/lib/utils";
import { EmptyState, impactStatusTone } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

type PageProps = {
  params: Promise<{ cohortId: string }>;
  searchParams?: Promise<{ state?: string; sector?: string; q?: string; error?: string }>;
};

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

const ROUTE = "/dashboard/impact-intelligence/cohorts/[cohortId]";
const UNAVAILABLE = "Unavailable";
const EXPECTED_COHORT_ACTION_ERRORS = ["required", "select", "invalid", "cohort", "MSME", "member", "field officer", "permission", "already enrolled", "CSV"];

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

function redirectWithCohortError(cohortId: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Cohort action could not be completed.";
  redirect(`/dashboard/impact-intelligence/cohorts/${cohortId}?error=${encodeURIComponent(message)}`);
}

async function enrollMembersAction(cohortId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await enrollImpactCohortMembers(ctx, cohortId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "cohort_member_enrol_failed", error });
    if (!(error instanceof Error) || !EXPECTED_COHORT_ACTION_ERRORS.some((message) => error.message.toLowerCase().includes(message.toLowerCase()))) throw error;
    redirectWithCohortError(cohortId, error);
  }
  revalidatePath(`/dashboard/impact-intelligence/cohorts/${cohortId}`);
  revalidatePath("/dashboard/impact-intelligence/cohorts");
}

async function updateMemberStatusAction(cohortId: string, memberId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await updateImpactCohortMemberStatus(ctx, memberId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "cohort_member_update_failed", error });
    if (!(error instanceof Error) || !EXPECTED_COHORT_ACTION_ERRORS.some((message) => error.message.toLowerCase().includes(message.toLowerCase()))) throw error;
    redirectWithCohortError(cohortId, error);
  }
  revalidatePath(`/dashboard/impact-intelligence/cohorts/${cohortId}`);
  revalidatePath("/dashboard/impact-intelligence/cohorts");
}

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function average(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  return available.length > 0 ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null;
}

function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) : UNAVAILABLE;
}

function latestByDate<T>(items: T[], getDate: (item: T) => string | null | undefined) {
  return [...items].sort((a, b) => String(getDate(b) ?? "").localeCompare(String(getDate(a) ?? "")))[0] ?? null;
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

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
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

function ProgressBar({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  if (value === null) return <span className="text-[11px] font-semibold text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div className="min-w-[88px]">
      <span className="text-[11px] font-bold text-slate-700">{value}%</span>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof UsersRound; tone: string }) {
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

function readinessStatus(value: number | null) {
  if (value === null) return UNAVAILABLE;
  if (value >= 80) return "Ready";
  if (value >= 50) return "In Progress";
  return "Needs Attention";
}

function stageCount(items: ImpactIntervention[], stage: string) {
  return items.filter((item) => getInterventionStage(item) === stage).length;
}

export default async function ImpactCohortDetailPage({ params, searchParams }: PageProps) {
  const { cohortId } = await params;
  const filters = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let detail: Awaited<ReturnType<typeof getImpactCohortDetail>> | null = null;

  try {
    ctx = await getCurrentUserContext();
    detail = await getImpactCohortDetail(ctx, cohortId);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "cohort_detail_load_failed", error });
    const description = isImpactProgrammeReadDenied(error)
      ? error.message
      : "The cohort source, current session, or assigned scope is temporarily unavailable.";
    return (
      <section className="space-y-6">
        <Section title="Cohort Unavailable">
          <EmptyState title="Cohort record could not load" description={description} icon={UsersRound} />
        </Section>
      </section>
    );
  }

  const { cohort, members } = detail;
  if (!cohort) notFound();

  const canManage = COHORT_MANAGE_ROLES.includes(ctx.role)
    && canRole(ctx.role, "cohort", "update")
    && canRole(ctx.role, "beneficiary", "update");
  const canReadReports = canRole(ctx.role, "report", "read");
  let registryOptionsFailed = false;
  let officerOptionsFailed = false;

  const [
    registryMsmes,
    fieldOfficers,
    interventionsSource,
    assessmentsSource,
    monitoringSource,
    evidenceSource,
    indicatorsSource,
    indicatorAggregateSource,
    reportsSource,
  ] = await Promise.all([
    canManage
      ? listMsmePickerOptions({ limit: 150, state: filters.state, sector: filters.sector, search: filters.q }).catch((error) => {
          registryOptionsFailed = true;
          logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "cohort_registry_options_load_failed", error });
          return [];
        })
      : Promise.resolve([]),
    canManage
      ? listUserPickerOptions("field_officer").catch((error) => {
          officerOptionsFailed = true;
          logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "cohort_officer_options_load_failed", error });
          return [];
        })
      : Promise.resolve([]),
    loadSource(ctx, "cohort_command_interventions_load_failed", () => listImpactInterventions(ctx, { cohortId, limit: 1000 }), []),
    loadSource(ctx, "cohort_command_assessments_load_failed", () => listImpactAssessments(ctx, { cohortId, limit: 1000 }), []),
    loadSource(ctx, "cohort_command_monitoring_load_failed", () => listImpactFieldVisits(ctx, { cohortId, limit: 1000 }), []),
    listImpactEvidence(ctx, { cohortId, limit: 1000 })
      .then((data) => ({ data, available: true }))
      .catch((error) => {
        unstable_rethrow(error);
        logImpactEvidenceDiagnostic({
          operation: "cohort_command_evidence_unavailable",
          cohortId,
          actorRole: ctx.role,
          success: false,
          errorCode: "source_unavailable",
          errorMessage: error instanceof Error ? error.message : "Unknown evidence error",
        });
        return sourceFallback<ImpactEvidenceRecord[]>([]);
      }),
    listIndicatorMeasurements(ctx, { cohortId, limit: 1000 })
      .then((data) => ({ data, available: true }))
      .catch((error) => {
        unstable_rethrow(error);
        logImpactIndicatorDiagnostic({
          operation: "cohort_command_indicators_unavailable",
          role: ctx.role,
          authUserId: ctx.authUserId,
          appUserId: ctx.appUserId,
          cohortId,
          errorMessage: error instanceof Error ? error.message : "Unknown indicator error",
          success: false,
        });
        return sourceFallback([]);
      }),
    aggregateCohortIndicators(ctx, cohortId)
      .then((data) => ({ data, available: true }))
      .catch((error) => {
        unstable_rethrow(error);
        logImpactIndicatorDiagnostic({
          operation: "cohort_command_indicator_aggregate_unavailable",
          role: ctx.role,
          authUserId: ctx.authUserId,
          appUserId: ctx.appUserId,
          cohortId,
          errorMessage: error instanceof Error ? error.message : "Unknown indicator aggregate error",
          success: false,
        });
        return sourceFallback(null);
      }),
    canReadReports
      ? loadSource(ctx, "cohort_command_reports_load_failed", () => listInstitutionalReports(ctx, 1000), [])
      : Promise.resolve(sourceFallback([])),
  ]);

  const interventions = interventionsSource.data.filter((item) => item.cohort_id === cohortId);
  const assessments = assessmentsSource.data.filter((item) => item.cohort_id === cohortId);
  const monitoringVisits = monitoringSource.data.filter((item) => item.cohort_id === cohortId);
  const evidenceFiles = evidenceSource.data.filter((item) => item.cohort_id === cohortId);
  const indicatorMeasurements = indicatorsSource.data.filter((item) => item.cohort_id === cohortId);
  const reports = reportsSource.data.filter((item) => item.cohort_id === cohortId);

  const canManageMembers = canManage && !registryOptionsFailed && !officerOptionsFailed;
  const officerById = new Map(fieldOfficers.map((officer) => [officer.id, officer]));
  const memberIds = new Set(members.map((member) => member.msme_id));
  const availableMsmes = registryMsmes.filter((msme) => !memberIds.has(msme.id));
  const enrolAction = enrollMembersAction.bind(null, cohortId);

  const activeMembers = members.filter((member) => ["active", "enrolled"].includes(member.member_status));
  const completedMembers = members.filter((member) => member.member_status === "completed");
  const inactiveMembers = members.filter((member) => ["inactive", "dropped", "exited"].includes(member.member_status));
  const participationRate = ratio(activeMembers.length + completedMembers.length, members.length);
  const completionRate = ratio(completedMembers.length, members.length);

  const activeInterventions = interventions.filter((item) => item.status === "active");
  const completedInterventions = interventions.filter((item) => item.status === "completed");
  const interventionActions = interventions.filter((item) => ["planned", "on_hold"].includes(item.status ?? ""));
  const approvedAssessments = assessments.filter((item) => item.status === "approved");
  const submittedAssessments = assessments.filter((item) => item.status === "submitted");
  const reviewedAssessments = assessments.filter((item) => item.status === "reviewed");
  const draftAssessments = assessments.filter((item) => item.status === "draft");
  const reviewedVisits = monitoringVisits.filter((item) => item.status === "reviewed");
  const completedVisits = monitoringVisits.filter((item) => item.status === "completed");
  const overdueVisits = monitoringVisits.filter((item) => {
    if (!item.visit_date || ["completed", "reviewed"].includes(item.status ?? "")) return false;
    const visitDate = new Date(item.visit_date);
    return !Number.isNaN(visitDate.getTime()) && visitDate.getTime() < Date.now();
  });
  const verifiedEvidence = evidenceFiles.filter((item) => item.status === "verified" && item.verification_status === "verified");
  const submittedEvidence = evidenceFiles.filter((item) => ["submitted", "under_review"].includes(item.status));
  const returnedEvidence = evidenceFiles.filter((item) => item.status === "returned");
  const rejectedEvidence = evidenceFiles.filter((item) => item.status === "rejected");
  const verifiedIndicators = indicatorMeasurements.filter((item) => item.verification_status === "verified");
  const approvedReports = reports.filter((item) => item.status === "approved");
  const reportsNeedingApproval = reports.filter((item) => item.status === "in_review");

  const assessmentCoverage = assessmentsSource.available ? ratio(approvedAssessments.length, members.length) : null;
  const monitoringCompleteness = monitoringSource.available ? ratio(reviewedVisits.length, monitoringVisits.length) : null;
  const evidenceStrength = evidenceSource.available ? ratio(verifiedEvidence.length, evidenceFiles.length) : null;
  const indicatorCoverage = indicatorsSource.available ? ratio(verifiedIndicators.length, indicatorMeasurements.length) : null;
  const reportingReadiness = reportsSource.available ? ratio(approvedReports.length, reports.length) : null;
  const readinessScore = average([assessmentCoverage, monitoringCompleteness, evidenceStrength, indicatorCoverage, reportingReadiness]);

  const missingEvidence = interventions.filter(
    (intervention) => !evidenceFiles.some((evidence) => evidence.intervention_id === intervention.id),
  );
  const missingIndicators = interventions.filter(
    (intervention) => !verifiedIndicators.some((indicator) => indicator.intervention_id === intervention.id),
  );
  const reportBlockerCount = [
    submittedAssessments.length,
    completedVisits.length,
    submittedEvidence.length,
    indicatorMeasurements.length - verifiedIndicators.length,
  ].reduce((sum, value) => sum + value, 0);

  const health: HealthState = !assessmentsSource.available || !monitoringSource.available || !evidenceSource.available || !indicatorsSource.available
    ? "Unavailable"
    : overdueVisits.length > 0 || verifiedIndicators.some((item) => item.outcome_status === "regressed")
      ? "At Risk"
      : interventionActions.length > 0
        || submittedAssessments.length > 0
        || completedVisits.length > 0
        || submittedEvidence.length > 0
        || verifiedIndicators.some((item) => ["below_target", "no_baseline"].includes(item.outcome_status))
        ? "Watchlist"
        : verifiedIndicators.length > 0 || verifiedEvidence.length > 0
          ? "Healthy"
          : "Unavailable";

  const latestAssessment = latestByDate(assessments, (item) => item.submitted_at ?? item.conducted_at ?? item.created_at);
  const latestVisit = latestByDate(monitoringVisits, (item) => item.reviewed_at ?? item.completed_at ?? item.visit_date ?? item.created_at);
  const latestReport = latestByDate(reports, (item) => item.approved_at ?? item.generated_at ?? item.created_at);
  const sourceFreshness = latestByDate(
    [
      cohort.updated_at ?? cohort.created_at,
      ...members.map((item) => item.updated_at ?? item.created_at ?? item.enrolled_at),
      ...interventions.map((item) => item.updated_at ?? item.created_at),
      ...assessments.map((item) => item.submitted_at ?? item.created_at),
      ...monitoringVisits.map((item) => item.reviewed_at ?? item.completed_at ?? item.created_at),
      ...evidenceFiles.map((item) => item.reviewed_at ?? item.created_at),
      ...indicatorMeasurements.map((item) => item.updated_at ?? item.created_at),
      ...reports.map((item) => item.approved_at ?? item.created_at),
    ],
    (value) => value,
  );

  const beneficiariesRequiringAttention = members
    .filter((member) => ["inactive", "dropped", "exited"].includes(member.member_status)
      || (member.open_field_visit_count ?? 0) > 0
      || ["submitted", "returned"].includes(member.latest_assessment_status ?? ""))
    .slice(0, 6);

  const canAddBeneficiary = canManageMembers;
  const canScheduleMonitoring = canRole(ctx.role, "monitoring_visit", "create")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/monitoring");
  const canCreateIntervention = canRole(ctx.role, "intervention", "create")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/interventions");
  const canViewReports = canReadReports && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");

  const funnel = [
    { label: "Beneficiaries", count: members.length, readiness: ratio(members.length, cohort.target_beneficiaries), icon: UsersRound, href: "#beneficiary-performance", allowed: true },
    { label: "Interventions", count: interventionsSource.available ? interventions.length : null, readiness: interventionsSource.available ? ratio(activeInterventions.length + completedInterventions.length, interventions.length) : null, icon: Network, href: `/dashboard/impact-intelligence/interventions?cohort_id=${cohortId}`, allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/interventions") },
    { label: "Assessments", count: assessmentsSource.available ? assessments.length : null, readiness: assessmentCoverage, icon: ClipboardCheck, href: `/dashboard/impact-intelligence/assessments?cohort_id=${cohortId}`, allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/assessments") },
    { label: "Monitoring", count: monitoringSource.available ? monitoringVisits.length : null, readiness: monitoringCompleteness, icon: CalendarDays, href: `/dashboard/impact-intelligence/monitoring?create_programme_id=${cohort.programme_id}&create_cohort_id=${cohortId}`, allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/monitoring") },
    { label: "Evidence", count: evidenceSource.available ? evidenceFiles.length : null, readiness: evidenceStrength, icon: ShieldCheck, href: `/dashboard/impact-intelligence/evidence?create_programme_id=${cohort.programme_id}&create_cohort_id=${cohortId}`, allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence") },
    { label: "Indicators", count: indicatorsSource.available ? indicatorMeasurements.length : null, readiness: indicatorCoverage, icon: Target, href: "/dashboard/impact-intelligence/indicators", allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/indicators") },
    { label: "Reports", count: reportsSource.available ? reports.length : null, readiness: reportingReadiness, icon: FileCheck2, href: "/dashboard/impact-intelligence/reports", allowed: canViewReports },
  ];

  const activity = [
    ...members.map((item) => ({ type: "Beneficiary added", title: item.msmes?.business_name ?? "Cohort beneficiary", date: item.enrolled_at, href: "#beneficiary-management", icon: UsersRound })),
    ...interventions.map((item) => ({ type: "Intervention created", title: item.title, date: item.created_at, href: `/dashboard/impact-intelligence/interventions/${item.id}`, icon: Network })),
    ...approvedAssessments.map((item) => ({ type: "Assessment approved", title: item.title ?? humanize(item.assessment_type), date: item.submitted_at ?? item.conducted_at ?? item.created_at, href: `/dashboard/impact-intelligence/assessments/${item.id}`, icon: ClipboardCheck })),
    ...reviewedVisits.map((item) => ({ type: "Monitoring reviewed", title: item.title ?? "Cohort monitoring visit", date: item.reviewed_at ?? item.completed_at ?? item.created_at, href: `/dashboard/impact-intelligence/monitoring/${item.id}`, icon: CalendarDays })),
    ...verifiedEvidence.map((item) => ({ type: "Evidence verified", title: item.original_filename ?? item.file_name, date: item.reviewed_at ?? item.created_at, href: `/dashboard/impact-intelligence/evidence/${item.id}`, icon: ShieldCheck })),
    ...verifiedIndicators.map((item) => ({ type: "Indicator verified", title: item.impact_indicator_definitions?.name ?? "Indicator measurement", date: item.verified_at ?? item.created_at, href: "/dashboard/impact-intelligence/indicators", icon: Target })),
    ...approvedReports.map((item) => ({ type: "Report approved", title: item.title, date: item.approved_at ?? item.created_at, href: `/dashboard/impact-intelligence/reports/${item.id}`, icon: FileCheck2 })),
  ]
    .filter((item) => item.date && (item.href.startsWith("#") || canAccessRoute(ctx.role, item.href)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 8);

  const cohortCode = typeof cohort.metadata?.cohort_code === "string"
    ? cohort.metadata.cohort_code
    : typeof cohort.metadata?.code === "string"
      ? cohort.metadata.code
      : null;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <Link href="/dashboard/impact-intelligence/cohorts" className="hover:text-emerald-700">Cohorts</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">{cohortCode ?? cohort.name}</span>
            </nav>
            <p className="mt-2 text-xs text-slate-500">Cohort Performance & Outcome Command Centre</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CircleDot className="h-4 w-4" />
              <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Latest scoped record</p>
              <p className="text-[11px] font-semibold text-slate-700">{formatDateTime(sourceFreshness)}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_78%_24%,rgba(37,99,235,0.45),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_58%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 320" className="h-full w-full">
            <defs><pattern id="cohort-command-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#60a5fa" /></pattern></defs>
            <path d="M540 34 650 20l82 42 75 4 47 70-52 52 12 65-104 20-68-42-82 18-48-78 24-61Z" fill="url(#cohort-command-dots)" stroke="#38bdf8" strokeOpacity=".4" />
            <path d="M458 260c82-66 128-128 203-88 68 37 102 7 171-83" fill="none" stroke="#38bdf8" strokeOpacity=".55" />
            <circle cx="661" cy="171" r="5" fill="#22d3ee" /><circle cx="735" cy="181" r="4" fill="#a855f7" /><circle cx="831" cy="89" r="4" fill="#34d399" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                {cohortCode && <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">{cohortCode}</span>}
                <StatusPill value={cohort.status} dark />
                <StatusPill value={health} dark />
              </div>
              <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">{cohort.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80">{cohort.description ?? "No cohort description has been recorded."}</p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-xs text-blue-100/80">
                <span className="inline-flex items-center gap-2"><Network className="h-4 w-4 text-cyan-300" /> {cohort.impact_programmes?.name ?? "Programme unavailable"}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-300" /> {formatDate(cohort.start_date)} to {formatDate(cohort.end_date)}</span>
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-violet-300" /> {[cohort.lga, cohort.state].filter(Boolean).join(", ") || "Location unavailable"}</span>
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[420px]">
              {[
                { label: "Beneficiaries", value: formatNumber(members.length), icon: UsersRound },
                { label: "Cohort health", value: health, icon: Gauge },
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
            {[
              ["Assessment Ready", assessmentCoverage],
              ["Monitoring Ready", monitoringCompleteness],
              ["Evidence Ready", evidenceStrength],
              ["Indicator Ready", indicatorCoverage],
              ["Report Ready", reportingReadiness],
            ].map(([label, value]) => (
              <span key={String(label)} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-blue-100">
                {label}: {readinessStatus(value as number | null)}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {canAddBeneficiary && <Link href="#beneficiary-management" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white transition hover:bg-emerald-400"><Plus className="h-4 w-4" /> Add Beneficiary</Link>}
            {canScheduleMonitoring && <Link href={`/dashboard/impact-intelligence/monitoring?create_programme_id=${cohort.programme_id}&create_cohort_id=${cohortId}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15"><CalendarCheck className="h-4 w-4" /> Schedule Monitoring</Link>}
            {canCreateIntervention && <Link href={`/dashboard/impact-intelligence/interventions?create_programme_id=${cohort.programme_id}&create_cohort_id=${cohortId}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15"><Plus className="h-4 w-4" /> Create Intervention</Link>}
            {canViewReports && <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-blue-100 transition hover:bg-white/10">View Reports <ArrowRight className="h-4 w-4" /></Link>}
          </div>
        </div>
      </section>

      {filters.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{filters.error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
        <MetricCard label="Beneficiaries" value={formatNumber(members.length)} icon={UsersRound} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Active Beneficiaries" value={formatNumber(activeMembers.length)} icon={CircleDot} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Completed Beneficiaries" value={formatNumber(completedMembers.length)} icon={CheckCircle2} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Interventions" value={interventionsSource.available ? formatNumber(interventions.length) : UNAVAILABLE} icon={Network} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Assessments" value={assessmentsSource.available ? formatNumber(assessments.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Monitoring Visits" value={monitoringSource.available ? formatNumber(monitoringVisits.length) : UNAVAILABLE} icon={CalendarDays} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Verified Evidence" value={evidenceSource.available ? formatNumber(verifiedEvidence.length) : UNAVAILABLE} icon={ShieldCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Verified Indicators" value={indicatorsSource.available ? formatNumber(verifiedIndicators.length) : UNAVAILABLE} icon={Target} tone="bg-purple-100 text-purple-700" />
        <MetricCard label="Approved Reports" value={reportsSource.available ? formatNumber(approvedReports.length) : UNAVAILABLE} icon={FileCheck2} tone="bg-indigo-100 text-indigo-700" />
      </div>

      <Section title="Cohort Delivery Funnel" description="Operational progression across records scoped to this cohort.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {funnel.map((step, index) => {
            const Icon = step.icon;
            const content = (
              <article className="group h-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-blue-200 hover:bg-blue-50/30">
                <div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon className="h-4 w-4" /></span><span className="text-[10px] font-bold text-slate-300">{String(index + 1).padStart(2, "0")}</span></div>
                <p className="mt-4 text-2xl font-bold text-[#0c1733]">{formatNumber(step.count)}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-700">{step.label}</p>
                <div className="mt-3"><ProgressBar value={step.readiness} tone={step.readiness !== null && step.readiness < 50 ? "bg-amber-500" : "bg-emerald-500"} /></div>
                <div className="mt-3"><StatusPill value={readinessStatus(step.readiness)} /></div>
              </article>
            );
            return step.allowed ? <Link key={step.label} href={step.href}>{content}</Link> : <div key={step.label}>{content}</div>;
          })}
        </div>
      </Section>

      <div id="beneficiary-performance" className="grid scroll-mt-6 gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Section title="Beneficiary Performance" description="Participation and completion posture for the current scoped beneficiaries.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Active", activeMembers.length],
              ["Completed", completedMembers.length],
              ["Inactive / dropout", inactiveMembers.length],
              ["Total", members.length],
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className="text-xl font-bold text-[#0c1733]">{value}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{label}</p></div>)}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Participation rate</p><p className="mt-1 text-[10px] text-slate-500">Active and completed beneficiaries</p><div className="mt-3"><ProgressBar value={participationRate} /></div></div>
            <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Completion rate</p><p className="mt-1 text-[10px] text-slate-500">Completed beneficiaries against enrolment</p><div className="mt-3"><ProgressBar value={completionRate} tone="bg-blue-500" /></div></div>
          </div>
        </Section>

        <Section title="Beneficiaries Requiring Attention" description="Only beneficiaries with an existing inactive, open-monitoring, or pending-assessment signal.">
          {beneficiariesRequiringAttention.length === 0 ? (
            <EmptyPanel title="No beneficiary alerts" description="No current beneficiary record exposes an attention signal." icon={CheckCircle2} />
          ) : (
            <div className="space-y-3">
              {beneficiariesRequiringAttention.map((member) => (
                <div key={member.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{member.msmes?.business_name ?? "Unknown MSME"}</p><p className="mt-1 text-[10px] text-slate-500">{member.open_field_visit_count ?? 0} open visits · {member.assessment_count ?? 0} assessments</p></div>
                  <StatusPill value={["inactive", "dropped", "exited"].includes(member.member_status) ? member.member_status : member.latest_assessment_status ?? "Needs review"} />
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Section title="Intervention Delivery" description="Distribution, stage progression, and completion of cohort interventions.">
          {!interventionsSource.available ? (
            <EmptyPanel title="Intervention data unavailable" description="The intervention source could not be loaded. No counts are being inferred." icon={Network} />
          ) : interventions.length === 0 ? (
            <EmptyPanel title="No interventions linked" description="No intervention records are scoped to this cohort." icon={Network} />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Active", activeInterventions.length],
                  ["Completed", completedInterventions.length],
                  ["Planned", interventions.filter((item) => item.status === "planned").length],
                  ["On hold", interventions.filter((item) => item.status === "on_hold").length],
                ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{value}</p><p className="text-[9px] font-semibold text-slate-500">{label}</p></div>)}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Stage breakdown</p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {["intake", "eligibility", "approval", "disbursement", "monitoring", "closure"].map((stage) => <div key={stage} className="rounded-xl border border-slate-200 p-3 text-center"><p className="text-lg font-bold text-[#0c1733]">{stageCount(interventions, stage)}</p><p className="mt-1 text-[9px] font-semibold capitalize text-slate-500">{stage}</p></div>)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Intervention completion</p><div className="mt-3"><ProgressBar value={ratio(completedInterventions.length, interventions.length)} tone="bg-blue-500" /></div></div>
            </div>
          )}
        </Section>

        <Section title="Interventions Requiring Action" description="Planned or on-hold records that currently need delivery action.">
          {interventionActions.length === 0 ? (
            <EmptyPanel title="No intervention actions" description="No planned or on-hold intervention records require attention." icon={CheckCircle2} />
          ) : (
            <div className="space-y-3">
              {interventionActions.slice(0, 6).map((item) => (
                <Link key={item.id} href={`/dashboard/impact-intelligence/interventions/${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-amber-200 hover:bg-amber-50/40">
                  <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-500">{humanize(item.intervention_type)}</p></div><StatusPill value={item.status} />
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Assessment Assurance" description="Assessment workflow and approval posture.">
          {!assessmentsSource.available ? <EmptyPanel title="Assessment data unavailable" description="The assessment source could not be loaded. No counts are being inferred." icon={ClipboardCheck} /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Approved", approvedAssessments.length], ["Reviewed", reviewedAssessments.length], ["Submitted", submittedAssessments.length], ["Draft", draftAssessments.length]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{value}</p><p className="text-[9px] font-semibold text-slate-500">{label}</p></div>)}
              </div>
              {latestAssessment ? <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Latest assessment</p><p className="mt-1 text-xs font-bold text-slate-800">{latestAssessment.title ?? humanize(latestAssessment.assessment_type)}</p><p className="mt-1 text-[10px] text-slate-500">{formatDate(latestAssessment.submitted_at ?? latestAssessment.conducted_at ?? latestAssessment.created_at)}</p></div><StatusPill value={latestAssessment.status} /></div> : <EmptyPanel title="No assessments" description="No assessment records are linked to this cohort." icon={ClipboardCheck} />}
            </div>
          )}
        </Section>

        <Section title="Monitoring Assurance" description="Field visit completion, review posture, and overdue activity.">
          {!monitoringSource.available ? <EmptyPanel title="Monitoring data unavailable" description="The monitoring source could not be loaded. No counts are being inferred." icon={CalendarDays} /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Reviewed", reviewedVisits.length], ["Completed", completedVisits.length], ["Pending review", completedVisits.length], ["Overdue", overdueVisits.length]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{value}</p><p className="text-[9px] font-semibold text-slate-500">{label}</p></div>)}
              </div>
              {latestVisit ? <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Latest monitoring activity</p><p className="mt-1 text-xs font-bold text-slate-800">{latestVisit.title ?? "Cohort monitoring visit"}</p><p className="mt-1 text-[10px] text-slate-500">{formatDate(latestVisit.reviewed_at ?? latestVisit.completed_at ?? latestVisit.visit_date ?? latestVisit.created_at)}</p></div><StatusPill value={latestVisit.status} /></div> : <EmptyPanel title="No monitoring visits" description="No field visit records are linked to this cohort." icon={CalendarDays} />}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Evidence Integrity" description="Verification decisions and coverage across cohort evidence.">
          {!evidenceSource.available ? <EmptyPanel title="Evidence data unavailable" description="The evidence source could not be loaded. No integrity values are being inferred." icon={ShieldCheck} /> : evidenceFiles.length === 0 ? <EmptyPanel title="No evidence linked" description="No evidence records are currently linked to this cohort." icon={ShieldCheck} /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Verified", verifiedEvidence.length], ["Submitted", submittedEvidence.length], ["Returned", returnedEvidence.length], ["Rejected", rejectedEvidence.length]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{value}</p><p className="text-[9px] font-semibold text-slate-500">{label}</p></div>)}
              </div>
              <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Evidence coverage</p><p className="mt-1 text-[10px] text-slate-500">Only verified records contribute</p><div className="mt-3"><ProgressBar value={evidenceStrength} /></div></div>
            </div>
          )}
        </Section>

        <Section title="Indicator Integrity" description="Verified measurements, coverage, and cohort outcome posture.">
          {!indicatorsSource.available || !indicatorAggregateSource.available ? <EmptyPanel title="Indicator data unavailable" description="Indicator measurements or aggregate data could not be loaded. No progress values are being inferred." icon={Target} /> : indicatorMeasurements.length === 0 ? <EmptyPanel title="No indicator measurements" description="No indicator measurements are currently linked to this cohort." icon={Target} /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{verifiedIndicators.length}</p><p className="text-[9px] font-semibold text-slate-500">Verified</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{verifiedIndicators.filter((item) => item.baseline_value !== null).length}</p><p className="text-[9px] font-semibold text-slate-500">Baseline</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{verifiedIndicators.length}</p><p className="text-[9px] font-semibold text-slate-500">Current</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{verifiedIndicators.filter((item) => item.target_value !== null).length}</p><p className="text-[9px] font-semibold text-slate-500">Target</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Average progress</p><div className="mt-3"><ProgressBar value={indicatorAggregateSource.data?.averageProgressPercentage ?? null} tone="bg-purple-500" /></div></div>
                <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-800">Outcome status</p><div className="mt-3 flex flex-wrap gap-2"><StatusPill value={`${indicatorAggregateSource.data?.achievedCount ?? 0} achieved`} /><StatusPill value={`${indicatorAggregateSource.data?.belowTargetCount ?? 0} below target`} /><StatusPill value={`${indicatorAggregateSource.data?.regressedCount ?? 0} regressed`} /></div></div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section title="Cohort Outcome Scorecard" description="Executive readiness based only on available, verified cohort records.">
        <div className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
          <div className="rounded-2xl bg-[#0c1f46] p-6 text-white">
            <Gauge className="h-5 w-5 text-cyan-300" />
            <p className="mt-6 text-4xl font-bold">{readinessScore === null ? UNAVAILABLE : `${readinessScore}%`}</p>
            <p className="mt-2 text-xs font-semibold text-blue-100/70">Overall readiness score</p>
            <div className="mt-4"><StatusPill value={readinessStatus(readinessScore)} dark /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Evidence strength", evidenceStrength],
              ["Monitoring completeness", monitoringCompleteness],
              ["Assessment coverage", assessmentCoverage],
              ["Indicator coverage", indicatorCoverage],
              ["Reporting readiness", reportingReadiness],
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-semibold leading-4 text-slate-500">{label}</p><div className="mt-3"><ProgressBar value={value as number | null} /></div><div className="mt-3"><StatusPill value={readinessStatus(value as number | null)} /></div></div>)}
          </div>
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Section title="Reports Panel" description="Latest cohort report, approval posture, and export availability.">
          {!reportsSource.available ? <EmptyPanel title="Report data unavailable" description={canReadReports ? "The report source could not be loaded. No report metrics are being inferred." : "Report records are not available to the current role."} icon={FileText} /> : latestReport ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Latest report</p><h3 className="mt-2 text-base font-bold text-[#0c1733]">{latestReport.title}</h3><p className="mt-1 text-xs text-slate-500">{humanize(latestReport.report_type)}</p></div><StatusPill value={latestReport.status} /></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div><p className="text-[9px] font-semibold text-slate-500">Latest version</p><p className="mt-1 text-sm font-bold text-slate-800">{latestReport.latest_version ? `v${latestReport.latest_version.version_number}` : UNAVAILABLE}</p></div>
                <div><p className="text-[9px] font-semibold text-slate-500">Version count</p><p className="mt-1 text-sm font-bold text-slate-800">{UNAVAILABLE}</p></div>
                <div><p className="text-[9px] font-semibold text-slate-500">Approved state</p><p className="mt-1 text-sm font-bold text-slate-800">{latestReport.status === "approved" ? "Approved" : "Not approved"}</p></div>
                <div><p className="text-[9px] font-semibold text-slate-500">Export availability</p><p className="mt-1 text-sm font-bold text-slate-800">{latestReport.status === "approved" && canRole(ctx.role, "report", "export") ? "Available" : "Unavailable"}</p></div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-white p-4"><div><p className="text-xs font-bold text-slate-800">Report readiness</p><p className="mt-1 text-[10px] text-slate-500">{approvedReports.length} of {reports.length} reports approved</p></div><ProgressBar value={reportingReadiness} tone="bg-blue-500" /></div>
              <Link href={`/dashboard/impact-intelligence/reports/${latestReport.id}`} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white hover:bg-[#132d60]">Open report <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          ) : <EmptyPanel title="No cohort reports" description="No institutional reports are currently scoped to this cohort." icon={FileText} />}
        </Section>

        <Section title="Risk & Attention Centre" description="Current blockers derived from available cohort records.">
          <div className="space-y-3">
            {[
              ["Interventions missing evidence", evidenceSource.available && interventionsSource.available ? missingEvidence.length : null],
              ["Pending assessments", assessmentsSource.available ? submittedAssessments.length : null],
              ["Pending monitoring reviews", monitoringSource.available ? completedVisits.length : null],
              ["Interventions missing verified indicators", indicatorsSource.available && interventionsSource.available ? missingIndicators.length : null],
              ["Report blockers", assessmentsSource.available && monitoringSource.available && evidenceSource.available && indicatorsSource.available ? reportBlockerCount : null],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-3"><span className={cn("grid h-8 w-8 place-items-center rounded-lg", value === 0 ? "bg-emerald-100 text-emerald-700" : value === null ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700")}>{value === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</span><span className="text-xs font-semibold text-slate-700">{label}</span></div>
                <strong className="text-sm text-[#0c1733]">{formatNumber(value as number | null)}</strong>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Recent Cohort Activity" description="Latest real delivery events visible to the current role.">
        {activity.length === 0 ? <EmptyPanel title="No recent activity available" description="No beneficiary, intervention, assessment, monitoring, evidence, indicator, or report event is available." icon={Activity} /> : (
          <div className="relative space-y-1 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-slate-200">
            {activity.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link key={`${item.type}-${item.title}-${index}`} href={item.href} className="group relative flex items-start gap-4 rounded-xl p-3 hover:bg-slate-50">
                  <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-blue-700 shadow-sm"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1 pt-0.5"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">{item.title}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{item.type}</p></div><span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="h-3 w-3" /> {formatDateTime(item.date)}</span></div></div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Cohort Health Summary" description="Executive condition across delivery, evidence, outcomes, and reporting.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Delivery Health", interventionsSource.available && monitoringSource.available ? (overdueVisits.length > 0 || interventionActions.length > 0 ? "Watchlist" : interventions.length > 0 ? "Healthy" : "Unavailable") : "Unavailable", Network],
            ["Evidence Health", evidenceSource.available ? (submittedEvidence.length > 0 || returnedEvidence.length > 0 || rejectedEvidence.length > 0 ? "Watchlist" : verifiedEvidence.length > 0 ? "Healthy" : "Unavailable") : "Unavailable", ShieldCheck],
            ["Outcome Health", indicatorsSource.available ? (verifiedIndicators.some((item) => item.outcome_status === "regressed") ? "At Risk" : verifiedIndicators.some((item) => item.outcome_status === "below_target") ? "Watchlist" : verifiedIndicators.length > 0 ? "Healthy" : "Unavailable") : "Unavailable", Target],
            ["Reporting Health", reportsSource.available ? (reportsNeedingApproval.length > 0 ? "Watchlist" : approvedReports.length > 0 ? "Healthy" : "Unavailable") : "Unavailable", FileCheck2],
          ].map(([label, value, icon]) => {
            const Icon = icon as typeof Network;
            return <div key={String(label)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-blue-700"><Icon className="h-4 w-4" /></span><p className="text-xs font-bold text-slate-800">{label as string}</p></div><StatusPill value={value as string} /></div>;
          })}
        </div>
      </Section>

      {canManage && (registryOptionsFailed || officerOptionsFailed) && (
        <Section title="Cohort Management Unavailable">
          <EmptyState title="Member management options could not load" description="Registry or field-officer options are temporarily unavailable. Existing cohort data remains visible, but enrolment and member updates are disabled." icon={UsersRound} />
        </Section>
      )}

      {canManageMembers && (
        <Section title="Add Beneficiaries" description="Filter the existing MSME registry or upload a CSV. Existing cohort business rules remain unchanged.">
          <div id="beneficiary-management" className="scroll-mt-6">
            <form method="get" className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
              <input name="state" defaultValue={filters.state ?? ""} className="rounded-md border px-3 py-2 text-sm" placeholder="Filter state" />
              <input name="sector" defaultValue={filters.sector ?? ""} className="rounded-md border px-3 py-2 text-sm" placeholder="Filter sector" />
              <input name="q" defaultValue={filters.q ?? ""} className="rounded-md border px-3 py-2 text-sm" placeholder="Business name or MSME ID" />
              <Button type="submit" variant="secondary">Apply registry filters</Button>
            </form>
            <form action={enrolAction} className="mt-4 grid gap-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-1 text-sm font-medium text-slate-700">Individual MSME<select name="selected_msme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal"><option value="">No individual selection</option>{availableMsmes.map((msme) => <option key={msme.id} value={msme.id}>{msme.business_name} ({msme.msme_id ?? msme.state ?? "DBIN"})</option>)}</select></label>
                <label className="space-y-1 text-sm font-medium text-slate-700">Member status<select name="member_status" defaultValue="enrolled" className="w-full rounded-md border px-3 py-2 text-sm font-normal">{COHORT_MEMBER_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></label>
                <label className="space-y-1 text-sm font-medium text-slate-700">Assign field officer<select name="assigned_to_user_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal"><option value="">Unassigned</option>{fieldOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? officer.id}</option>)}</select></label>
              </div>
              <label className="space-y-1 text-sm font-medium text-slate-700">CSV upload<input name="csv_file" type="file" accept=".csv,text/csv,text/plain" className="w-full rounded-md border px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white" /></label>
              <div className="rounded-xl border border-slate-200">
                <div className="border-b bg-slate-50 px-4 py-3"><p className="text-sm font-semibold text-slate-950">Filtered registry selection</p><p className="mt-1 text-xs text-slate-500">{availableMsmes.length} available MSMEs. Select multiple records for bulk enrolment.</p></div>
                <div className="max-h-80 overflow-auto p-3">
                  {availableMsmes.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-slate-600">No available registry matches. Adjust filters or upload a CSV.</p> : <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{availableMsmes.map((msme) => <label key={msme.id} className="flex items-start gap-3 rounded-xl border bg-white p-3 text-sm"><input name="msme_ids" value={msme.id} type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" /><span><span className="font-medium text-slate-900">{msme.business_name}</span><span className="mt-1 block text-xs text-slate-500">{msme.msme_id ?? "No MSME ID"} · {msme.state ?? "No state"} · {msme.sector ?? "No sector"}</span></span></label>)}</div>}
                </div>
              </div>
              <div className="flex justify-end"><Button type="submit">Enrol selected MSMEs</Button></div>
            </form>
          </div>
        </Section>
      )}

      <Section title="Cohort Beneficiary Registry" description="Operational member records, assignments, and delivery links.">
        {members.length === 0 ? <EmptyPanel title="No beneficiaries enrolled" description="No beneficiaries are currently visible in this cohort scope." icon={UsersRound} /> : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {members.map((member) => {
              const updateAction = updateMemberStatusAction.bind(null, cohortId, member.id);
              return (
                <article key={member.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm shadow-slate-100">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-[#0c1733]">{member.msmes?.business_name ?? "Unknown MSME"}</h3><p className="mt-1 text-[10px] text-slate-500">{member.msmes?.msme_id ?? member.msme_id} · {member.msmes?.state ?? "Location unavailable"}</p></div><StatusPill value={member.member_status} /></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-center"><div><p className="text-lg font-bold text-slate-900">{member.intervention_count ?? 0}</p><p className="text-[9px] text-slate-500">Interventions</p></div><div><p className="text-lg font-bold text-slate-900">{member.assessment_count ?? 0}</p><p className="text-[9px] text-slate-500">Assessments</p></div><div><p className="text-lg font-bold text-slate-900">{member.field_visit_count ?? 0}</p><p className="text-[9px] text-slate-500">Monitoring</p></div></div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-slate-500"><span>{member.msmes?.sector ?? "Sector unavailable"}</span><span>{formatDate(member.enrolled_at)}</span></div>
                  {canManageMembers ? (
                    <form action={updateAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <select name="member_status" defaultValue={member.member_status} className="h-9 rounded-md border px-2 text-xs">{COHORT_MEMBER_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select>
                      <select name="assigned_to_user_id" defaultValue={member.assigned_to_user_id ?? ""} className="h-9 rounded-md border px-2 text-xs"><option value="">Unassigned</option>{fieldOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name ?? officer.email ?? officer.id}</option>)}</select>
                      <Button type="submit" size="sm">Save</Button>
                    </form>
                  ) : <p className="mt-4 text-[10px] text-slate-500">Assigned officer: {member.assigned_to_user_id ? officerById.get(member.assigned_to_user_id)?.full_name ?? officerById.get(member.assigned_to_user_id)?.email ?? "Assigned" : "Unassigned"}</p>}
                </article>
              );
            })}
          </div>
        )}
      </Section>
    </section>
  );
}
