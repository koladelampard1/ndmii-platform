import Link from "next/link";
import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Flag,
  Gauge,
  Layers3,
  MapPin,
  Network,
  Plus,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isImpactProgrammeReadDenied } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import {
  getImpactProgrammeDetail,
  getInterventionStage,
  listImpactAssessments,
  listImpactFieldVisits,
  listIntelligenceFeed,
  type ImpactIntervention,
  type ImpactRiskFlag,
} from "@/lib/data/impact-intelligence";
import { listInstitutionalReports } from "@/lib/data/impact-reports";
import {
  listImpactEvidence,
  logImpactEvidenceDiagnostic,
  type ImpactEvidenceRecord,
} from "@/lib/data/impact-evidence";
import {
  aggregateProgrammeIndicators,
  listIndicatorMeasurements,
  logImpactIndicatorDiagnostic,
  type ImpactIndicatorMeasurement,
} from "@/lib/data/impact-indicators";
import { cn } from "@/lib/utils";
import { EmptyState, impactStatusTone } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/programmes/[programmeId]";
const UNAVAILABLE = "Unavailable";

type SourceState<T> = {
  data: T;
  available: boolean;
};

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

function formatCurrency(value: number | null) {
  return value === null
    ? UNAVAILABLE
    : `NGN ${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
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

function StatusPill({ value }: { value: string | null | undefined }) {
  return (
    <span className={cn("inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", toneForStatus(value))}>
      {humanize(value)}
    </span>
  );
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

function ProgressBar({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  if (value === null) return <span className="text-[11px] font-semibold text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div className="min-w-[88px]">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
        <span>{value}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
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
          {detail && <p className="mt-0.5 truncate text-[9px] text-slate-400">{detail}</p>}
        </div>
      </div>
    </article>
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

function deriveHealth(
  flags: ImpactRiskFlag[] | null,
  measurements: ImpactIndicatorMeasurement[] | null,
): HealthState {
  if (flags === null || measurements === null) return "Unavailable";
  const openFlags = flags.filter((flag) => flag.status === "open");
  const verified = measurements.filter((item) => item.verification_status === "verified");
  if (
    openFlags.some((flag) => ["critical", "high"].includes(flag.severity))
    || verified.some((item) => item.outcome_status === "regressed")
  ) return "At Risk";
  if (
    openFlags.length > 0
    || verified.some((item) => ["below_target", "no_baseline"].includes(item.outcome_status))
  ) return "Watchlist";
  return verified.length > 0 ? "Healthy" : "Unavailable";
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

export default async function ImpactProgrammeDetailPage({ params }: { params: Promise<{ programmeId: string }> }) {
  const { programmeId } = await params;
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let detail: Awaited<ReturnType<typeof getImpactProgrammeDetail>> | null = null;

  try {
    ctx = await getCurrentUserContext();
    detail = await getImpactProgrammeDetail(ctx, programmeId);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "programme_detail_load_failed", error });
    const description = isImpactProgrammeReadDenied(error)
      ? error.message
      : "The programme source, current session, or role assignment is temporarily unavailable.";
    return (
      <section className="space-y-6">
        <Section title="Programme Unavailable">
          <EmptyState title="Programme record could not load" description={description} icon={Flag} />
        </Section>
      </section>
    );
  }

  const { programme, interventions, unanchoredInterventions, enrolments, cohorts } = detail;
  if (!programme) {
    return (
      <section className="space-y-6">
        <Section title="Programme Unavailable">
          <EmptyState title="Programme record was not found" description={`No programme record is available for reference ${programmeId}.`} icon={Flag} />
        </Section>
      </section>
    );
  }

  const canReadReports = canRole(ctx.role, "report", "read");
  const canReadRisks = canRole(ctx.role, "intelligence", "read") && canRole(ctx.role, "risk_flag", "read");

  const [assessmentsSource, monitoringSource, evidenceSource, indicatorsSource, indicatorAggregateSource, reportsSource, intelligenceSource] = await Promise.all([
    loadSource(ctx, "programme_command_assessments_load_failed", () => listImpactAssessments(ctx, { programmeId, limit: 1000 }), []),
    loadSource(ctx, "programme_command_monitoring_load_failed", () => listImpactFieldVisits(ctx, { programmeId, limit: 1000 }), []),
    loadSource(ctx, "programme_command_evidence_load_failed", () => listImpactEvidence(ctx, { programmeId, limit: 1000 }), []),
    loadSource(ctx, "programme_command_indicators_load_failed", () => listIndicatorMeasurements(ctx, { programmeId, limit: 1000 }), []),
    aggregateProgrammeIndicators(ctx, programmeId)
      .then((data) => ({ data, available: true }))
      .catch((error) => {
        unstable_rethrow(error);
        logImpactIndicatorDiagnostic({
          operation: "programme_command_indicator_aggregate_unavailable",
          role: ctx.role,
          authUserId: ctx.authUserId,
          appUserId: ctx.appUserId,
          programmeId,
          errorMessage: error instanceof Error ? error.message : "Unknown indicator aggregate error",
          success: false,
        });
        return sourceFallback(null);
      }),
    canReadReports
      ? loadSource(ctx, "programme_command_reports_load_failed", () => listInstitutionalReports(ctx, 1000), [])
      : Promise.resolve(sourceFallback([])),
    canReadRisks
      ? loadSource(ctx, "programme_command_risks_load_failed", () => listIntelligenceFeed(ctx, { limit: 500 }), null)
      : Promise.resolve(sourceFallback(null)),
  ]);

  if (!evidenceSource.available) {
    logImpactEvidenceDiagnostic({
      operation: "programme_command_evidence_unavailable",
      programmeId,
      actorRole: ctx.role,
      success: false,
      errorCode: "source_unavailable",
      errorMessage: "Programme evidence could not be loaded.",
    });
  }

  const assessments = assessmentsSource.data.filter((item) => item.programme_id === programmeId);
  const monitoringVisits = monitoringSource.data.filter((item) => item.programme_id === programmeId);
  const evidenceFiles = evidenceSource.data.filter((item) => item.programme_id === programmeId);
  const indicatorMeasurements = indicatorsSource.data.filter((item) => item.programme_id === programmeId);
  const reports = reportsSource.data.filter((item) => item.programme_id === programmeId);
  const riskFlags = intelligenceSource.data?.riskFlags.filter((item) => item.programme_id === programmeId) ?? [];

  const beneficiaryCount = cohorts.reduce(
    (sum, cohort) => sum + (cohort.member_count ?? cohort.current_beneficiaries ?? 0),
    0,
  );
  const verifiedEvidence = evidenceFiles.filter(
    (item) => item.status === "verified" && item.verification_status === "verified",
  );
  const verifiedIndicators = indicatorMeasurements.filter((item) => item.verification_status === "verified");
  const approvedReports = reports.filter((item) => item.status === "approved");
  const approvedAssessments = assessments.filter((item) => item.status === "approved");
  const reviewedVisits = monitoringVisits.filter((item) => item.status === "reviewed");
  const completedVisits = monitoringVisits.filter((item) => item.status === "completed");
  const openRiskFlags = riskFlags.filter((item) => item.status === "open");

  const evidenceReadiness = evidenceSource.available ? ratio(verifiedEvidence.length, evidenceFiles.length) : null;
  const indicatorReadiness = indicatorsSource.available ? ratio(verifiedIndicators.length, indicatorMeasurements.length) : null;
  const reportingReadiness = reportsSource.available ? ratio(approvedReports.length, reports.length) : null;
  const health = deriveHealth(
    intelligenceSource.available ? riskFlags : null,
    indicatorsSource.available ? indicatorMeasurements : null,
  );

  const latestAssessment = latestByDate(assessments, (item) => item.submitted_at ?? item.conducted_at ?? item.created_at);
  const latestVisit = latestByDate(monitoringVisits, (item) => item.reviewed_at ?? item.completed_at ?? item.visit_date ?? item.created_at);
  const latestReport = latestByDate(reports, (item) => item.approved_at ?? item.generated_at ?? item.created_at);
  const atRiskIndicators = verifiedIndicators.filter((item) => ["below_target", "regressed"].includes(item.outcome_status));
  const pendingEvidence = evidenceFiles.filter((item) => ["submitted", "under_review"].includes(item.status));
  const returnedEvidence = evidenceFiles.filter((item) => item.status === "returned");
  const rejectedEvidence = evidenceFiles.filter((item) => item.status === "rejected");
  const checksumEvidence = evidenceFiles.filter((item) => Boolean(item.checksum_sha256));
  const reportsNeedingApproval = reports.filter((item) => item.status === "in_review");
  const missingEvidence = interventions.filter(
    (intervention) => !evidenceFiles.some((evidence) => evidence.intervention_id === intervention.id),
  );
  const pendingAssessmentReviews = assessments.filter((item) => item.status === "submitted");

  const canCreateCohort = canRole(ctx.role, "cohort", "create")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/cohorts/new");
  const canCreateIntervention = canRole(ctx.role, "intervention", "create")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/interventions");
  const canCreateReport = canRole(ctx.role, "report", "create")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const canViewReports = canReadReports && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");

  const funnel = [
    {
      label: "Cohorts",
      count: cohorts.length,
      readiness: ratio(cohorts.filter((item) => ["active", "completed", "closed"].includes(item.status)).length, cohorts.length),
      href: "/dashboard/impact-intelligence/cohorts",
      allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/cohorts"),
      icon: Layers3,
    },
    {
      label: "Beneficiaries",
      count: beneficiaryCount,
      readiness: ratio(beneficiaryCount, cohorts.reduce((sum, item) => sum + item.target_beneficiaries, 0)),
      href: "/dashboard/impact-intelligence/cohorts",
      allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/cohorts"),
      icon: UsersRound,
    },
    {
      label: "Interventions",
      count: interventions.length,
      readiness: ratio(interventions.filter((item) => ["active", "completed"].includes(item.status ?? "")).length, interventions.length),
      href: `/dashboard/impact-intelligence/interventions?programme_id=${programmeId}`,
      allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/interventions"),
      icon: Network,
    },
    {
      label: "Assessments",
      count: assessmentsSource.available ? assessments.length : null,
      readiness: assessmentsSource.available ? ratio(approvedAssessments.length, assessments.length) : null,
      href: `/dashboard/impact-intelligence/assessments?programme_id=${programmeId}`,
      allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/assessments"),
      icon: ClipboardCheck,
    },
    {
      label: "Monitoring",
      count: monitoringSource.available ? monitoringVisits.length : null,
      readiness: monitoringSource.available ? ratio(reviewedVisits.length, monitoringVisits.length) : null,
      href: `/dashboard/impact-intelligence/monitoring?programme_id=${programmeId}`,
      allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/monitoring"),
      icon: CalendarDays,
    },
    {
      label: "Evidence",
      count: evidenceSource.available ? evidenceFiles.length : null,
      readiness: evidenceReadiness,
      href: `/dashboard/impact-intelligence/evidence?create_programme_id=${programmeId}`,
      allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence"),
      icon: ShieldCheck,
    },
    {
      label: "Indicators",
      count: indicatorsSource.available ? indicatorMeasurements.length : null,
      readiness: indicatorReadiness,
      href: "/dashboard/impact-intelligence/indicators",
      allowed: canAccessRoute(ctx.role, "/dashboard/impact-intelligence/indicators"),
      icon: Target,
    },
    {
      label: "Reports",
      count: reportsSource.available ? reports.length : null,
      readiness: reportingReadiness,
      href: "/dashboard/impact-intelligence/reports",
      allowed: canViewReports,
      icon: FileCheck2,
    },
  ];

  const activity = [
    ...verifiedEvidence.map((item: ImpactEvidenceRecord) => ({
      type: "Evidence verified",
      title: item.original_filename ?? item.file_name,
      date: item.reviewed_at ?? item.created_at,
      href: `/dashboard/impact-intelligence/evidence/${item.id}`,
      icon: ShieldCheck,
    })),
    ...reviewedVisits.map((item) => ({
      type: "Monitoring reviewed",
      title: item.title ?? "Programme monitoring visit",
      date: item.reviewed_at ?? item.completed_at ?? item.created_at,
      href: `/dashboard/impact-intelligence/monitoring/${item.id}`,
      icon: CalendarDays,
    })),
    ...approvedReports.map((item) => ({
      type: "Report approved",
      title: item.title,
      date: item.approved_at ?? item.created_at,
      href: `/dashboard/impact-intelligence/reports/${item.id}`,
      icon: FileCheck2,
    })),
    ...interventions.map((item) => ({
      type: "Intervention created",
      title: item.title,
      date: item.created_at,
      href: `/dashboard/impact-intelligence/interventions/${item.id}`,
      icon: Network,
    })),
  ]
    .filter((item) => item.date && canAccessRoute(ctx.role, item.href))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 8);

  const sourceFreshness = latestByDate(
    [
      programme.updated_at ?? programme.created_at,
      ...cohorts.map((item) => item.updated_at ?? item.created_at),
      ...interventions.map((item) => item.updated_at ?? item.created_at),
      ...assessments.map((item) => item.created_at),
      ...monitoringVisits.map((item) => item.reviewed_at ?? item.completed_at ?? item.created_at),
      ...evidenceFiles.map((item) => item.reviewed_at ?? item.created_at),
      ...indicatorMeasurements.map((item) => item.updated_at ?? item.created_at),
      ...reports.map((item) => item.approved_at ?? item.created_at),
    ],
    (value) => value,
  );

  const attentionItems = [
    intelligenceSource.available
      ? { label: "Open risk flags", value: openRiskFlags.length, tone: openRiskFlags.length > 0 ? "rose" : "emerald" }
      : { label: "Open risk flags", value: null, tone: "slate" },
    evidenceSource.available
      ? { label: "Interventions missing evidence", value: missingEvidence.length, tone: missingEvidence.length > 0 ? "amber" : "emerald" }
      : { label: "Interventions missing evidence", value: null, tone: "slate" },
    assessmentsSource.available && monitoringSource.available && evidenceSource.available
      ? { label: "Pending operational reviews", value: pendingAssessmentReviews.length + completedVisits.length + pendingEvidence.length, tone: "amber" }
      : { label: "Pending operational reviews", value: null, tone: "slate" },
    indicatorsSource.available
      ? { label: "Indicators not verified", value: indicatorMeasurements.length - verifiedIndicators.length, tone: "amber" }
      : { label: "Indicators not verified", value: null, tone: "slate" },
    reportsSource.available
      ? { label: "Reports needing approval", value: reportsNeedingApproval.length, tone: reportsNeedingApproval.length > 0 ? "amber" : "emerald" }
      : { label: "Reports needing approval", value: null, tone: "slate" },
  ];

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <Link href="/dashboard/impact-intelligence/programmes" className="hover:text-emerald-700">Programmes</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">{programme.programme_code ?? programme.name}</span>
            </nav>
            <p className="mt-2 text-xs text-slate-500">Single Programme Command Centre</p>
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
            <defs>
              <pattern id="programme-command-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#60a5fa" />
              </pattern>
            </defs>
            <path d="M540 34 650 20l82 42 75 4 47 70-52 52 12 65-104 20-68-42-82 18-48-78 24-61Z" fill="url(#programme-command-dots)" stroke="#38bdf8" strokeOpacity=".4" />
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
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                  {programme.programme_code ?? "Programme code unavailable"}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-blue-100">
                  {humanize(programme.status)}
                </span>
              </div>
              <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">{programme.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80">
                {programme.description ?? "No programme description has been recorded."}
              </p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-xs text-blue-100/80">
                <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-cyan-300" /> {programme.sponsor_name ?? "Sponsor unavailable"}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-300" /> {formatDate(programme.start_date)} to {formatDate(programme.end_date)}</span>
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[420px]">
              {[
                { label: "Programme health", value: health, icon: Gauge },
                { label: "Evidence readiness", value: evidenceReadiness === null ? UNAVAILABLE : `${evidenceReadiness}%`, icon: ShieldCheck },
                { label: "Reporting readiness", value: reportingReadiness === null ? UNAVAILABLE : `${reportingReadiness}%`, icon: FileCheck2 },
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

          <div className="mt-7 flex flex-wrap gap-2 border-t border-white/10 pt-5">
            {canCreateCohort && (
              <Link href="/dashboard/impact-intelligence/cohorts/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-white transition hover:bg-emerald-400">
                <Plus className="h-4 w-4" /> Create Cohort
              </Link>
            )}
            {canCreateIntervention && (
              <Link href={`/dashboard/impact-intelligence/interventions?create_programme_id=${programmeId}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15">
                <Plus className="h-4 w-4" /> Create Intervention
              </Link>
            )}
            {canCreateReport && (
              <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15">
                <Plus className="h-4 w-4" /> Create Report
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
        <MetricCard label="Cohorts" value={formatNumber(cohorts.length)} icon={Layers3} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="MSMEs Reached" value={formatNumber(beneficiaryCount)} detail={enrolments.length > 0 ? `${enrolments.length} legacy links` : undefined} icon={UsersRound} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Interventions" value={formatNumber(interventions.length)} icon={Network} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Assessments" value={assessmentsSource.available ? formatNumber(assessments.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Monitoring Visits" value={monitoringSource.available ? formatNumber(monitoringVisits.length) : UNAVAILABLE} icon={CalendarDays} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Verified Evidence" value={evidenceSource.available ? formatNumber(verifiedEvidence.length) : UNAVAILABLE} icon={ShieldCheck} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Verified Indicators" value={indicatorsSource.available ? formatNumber(verifiedIndicators.length) : UNAVAILABLE} icon={Target} tone="bg-purple-100 text-purple-700" />
        <MetricCard label="Approved Reports" value={reportsSource.available ? formatNumber(approvedReports.length) : UNAVAILABLE} icon={FileCheck2} tone="bg-indigo-100 text-indigo-700" />
      </div>

      <Section title="Programme Delivery Funnel" description="Delivery progression across the programme's current scoped records.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          {funnel.map((step, index) => {
            const Icon = step.icon;
            const content = (
              <article className="group relative h-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-blue-200 hover:bg-blue-50/30">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon className="h-4 w-4" /></span>
                  <span className="text-[10px] font-bold text-slate-300">{String(index + 1).padStart(2, "0")}</span>
                </div>
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

      <Section
        title="Cohort Performance"
        description="Beneficiary reach and delivery assurance by programme cohort."
        action={canAccessRoute(ctx.role, "/dashboard/impact-intelligence/cohorts")
          ? <Link href="/dashboard/impact-intelligence/cohorts" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Cohort registry <ArrowRight className="h-3.5 w-3.5" /></Link>
          : undefined}
      >
        {cohorts.length === 0 ? (
          <EmptyPanel title="No cohorts linked" description="Create or link a beneficiary cohort to begin programme delivery tracking." icon={UsersRound} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {cohorts.map((cohort) => {
              const cohortEvidence = evidenceFiles.filter((item) => item.cohort_id === cohort.id);
              const cohortIndicators = indicatorMeasurements.filter((item) => item.cohort_id === cohort.id);
              const cohortReports = reports.filter((item) => item.cohort_id === cohort.id);
              const currentBeneficiaries = cohort.member_count ?? cohort.current_beneficiaries ?? 0;
              const cohortHealth = cohort.status === "active"
                ? (cohort.open_field_visit_count ?? 0) > 0 ? "Watchlist" : "Healthy"
                : humanize(cohort.status);
              return (
                <article key={cohort.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm shadow-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        {[cohort.lga, cohort.state].filter(Boolean).join(", ") || "Location unavailable"}
                      </p>
                      <h3 className="mt-2 truncate text-sm font-bold text-[#0c1733]">
                        {canAccessRoute(ctx.role, `/dashboard/impact-intelligence/cohorts/${cohort.id}`)
                          ? <Link href={`/dashboard/impact-intelligence/cohorts/${cohort.id}`} className="hover:text-blue-700">{cohort.name}</Link>
                          : cohort.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500">{cohort.sector ?? "Sector unavailable"}</p>
                    </div>
                    <StatusPill value={cohortHealth} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-100 py-4">
                    <div><p className="text-lg font-bold text-slate-900">{formatNumber(currentBeneficiaries)}</p><p className="text-[9px] text-slate-500">Beneficiaries</p></div>
                    <div><p className="text-lg font-bold text-slate-900">{formatNumber(cohort.intervention_count ?? 0)}</p><p className="text-[9px] text-slate-500">Interventions</p></div>
                    <div><p className="text-lg font-bold text-slate-900">{assessmentsSource.available ? formatNumber(cohort.assessment_count ?? 0) : UNAVAILABLE}</p><p className="text-[9px] text-slate-500">Assessments</p></div>
                    <div><p className="text-lg font-bold text-slate-900">{monitoringSource.available ? formatNumber(cohort.field_visit_count ?? 0) : UNAVAILABLE}</p><p className="text-[9px] text-slate-500">Monitoring</p></div>
                    <div><p className="text-lg font-bold text-slate-900">{evidenceSource.available ? formatNumber(cohortEvidence.length) : UNAVAILABLE}</p><p className="text-[9px] text-slate-500">Evidence</p></div>
                    <div><p className="text-lg font-bold text-slate-900">{indicatorsSource.available ? formatNumber(cohortIndicators.length) : UNAVAILABLE}</p><p className="text-[9px] text-slate-500">Indicators</p></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-semibold text-slate-500">Report readiness</p>
                      <p className="mt-1 text-xs font-bold text-slate-700">{reportsSource.available ? readinessStatus(ratio(cohortReports.filter((item) => item.status === "approved").length, cohortReports.length)) : UNAVAILABLE}</p>
                    </div>
                    <ProgressBar value={reportsSource.available ? ratio(cohortReports.filter((item) => item.status === "approved").length, cohortReports.length) : null} tone="bg-blue-500" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <Section
          title="Intervention & Support"
          description="Programme support portfolio, funding posture, and delivery stages."
          action={canAccessRoute(ctx.role, "/dashboard/impact-intelligence/interventions")
            ? <Link href={`/dashboard/impact-intelligence/interventions?programme_id=${programmeId}`} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">View interventions <ArrowRight className="h-3.5 w-3.5" /></Link>
            : undefined}
        >
          {interventions.length === 0 ? (
            <EmptyPanel title="No interventions linked" description="No intervention records are available for this programme." icon={Network} />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-semibold text-slate-500">Active interventions</p><p className="mt-2 text-xl font-bold text-[#0c1733]">{interventions.filter((item) => item.status === "active").length}</p></div>
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-semibold text-slate-500">Approved amount</p><p className="mt-2 text-lg font-bold text-[#0c1733]">{formatCurrency(interventions.some((item) => item.approved_amount !== null) ? interventions.reduce((sum, item) => sum + (item.approved_amount ?? 0), 0) : null)}</p></div>
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-semibold text-slate-500">Disbursed amount</p><p className="mt-2 text-lg font-bold text-[#0c1733]">{formatCurrency(interventions.some((item) => item.disbursed_amount !== null) ? interventions.reduce((sum, item) => sum + (item.disbursed_amount ?? 0), 0) : null)}</p></div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Stage distribution</p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {["intake", "eligibility", "approval", "disbursement", "monitoring", "closure"].map((stage) => (
                    <div key={stage} className="rounded-xl border border-slate-200 p-3 text-center">
                      <p className="text-lg font-bold text-[#0c1733]">{stageCount(interventions, stage)}</p>
                      <p className="mt-1 text-[9px] font-semibold capitalize text-slate-500">{stage}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section title="Requires Action" description="Interventions currently paused, planned, or lacking a cohort anchor.">
          {[...interventions.filter((item) => ["on_hold", "planned"].includes(item.status ?? "")), ...unanchoredInterventions]
            .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
            .slice(0, 5).length === 0 ? (
            <EmptyPanel title="No intervention actions" description="No paused, planned, or unanchored intervention records require attention." icon={CheckCircle2} />
          ) : (
            <div className="space-y-3">
              {[...interventions.filter((item) => ["on_hold", "planned"].includes(item.status ?? "")), ...unanchoredInterventions]
                .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
                .slice(0, 5)
                .map((item) => (
                  <Link key={item.id} href={`/dashboard/impact-intelligence/interventions/${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-amber-200 hover:bg-amber-50/40">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">{item.title}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-500">{item.impact_beneficiary_cohorts?.name ?? "Unanchored intervention"}</p>
                    </div>
                    <StatusPill value={item.cohort_id ? item.status : "Needs Anchor"} />
                  </Link>
                ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Assessment Assurance" description="Assessment workflow and approval posture.">
          {!assessmentsSource.available ? (
            <EmptyPanel title="Assessment data unavailable" description="The assessment source could not be loaded. No counts are being inferred." icon={ClipboardCheck} />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Approved", approvedAssessments.length],
                  ["Submitted", assessments.filter((item) => item.status === "submitted").length],
                  ["Reviewed", assessments.filter((item) => item.status === "reviewed").length],
                  ["Draft", assessments.filter((item) => item.status === "draft").length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-lg font-bold text-[#0c1733]">{value}</p>
                    <p className="text-[9px] font-semibold text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              {latestAssessment ? (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Latest assessment</p>
                    <p className="mt-1 text-xs font-bold text-slate-800">{latestAssessment.title ?? humanize(latestAssessment.assessment_type)}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{formatDate(latestAssessment.submitted_at ?? latestAssessment.conducted_at ?? latestAssessment.created_at)}</p>
                  </div>
                  <StatusPill value={latestAssessment.status} />
                </div>
              ) : <EmptyPanel title="No assessments" description="No assessment records are linked to this programme." icon={ClipboardCheck} />}
            </div>
          )}
        </Section>

        <Section title="Monitoring Assurance" description="Field visit completion and review posture.">
          {!monitoringSource.available ? (
            <EmptyPanel title="Monitoring data unavailable" description="The monitoring source could not be loaded. No counts are being inferred." icon={CalendarDays} />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Reviewed", reviewedVisits.length],
                  ["Completed, not reviewed", completedVisits.length],
                  ["Pending", monitoringVisits.filter((item) => ["pending", "assigned"].includes(item.status ?? "")).length],
                  ["In progress", monitoringVisits.filter((item) => item.status === "in_progress").length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-lg font-bold text-[#0c1733]">{value}</p>
                    <p className="text-[9px] font-semibold leading-4 text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              {latestVisit ? (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Latest visit</p>
                    <p className="mt-1 text-xs font-bold text-slate-800">{latestVisit.title ?? "Programme monitoring visit"}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{formatDate(latestVisit.reviewed_at ?? latestVisit.completed_at ?? latestVisit.visit_date ?? latestVisit.created_at)}</p>
                  </div>
                  <StatusPill value={latestVisit.status} />
                </div>
              ) : <EmptyPanel title="No monitoring visits" description="No field visit records are linked to this programme." icon={CalendarDays} />}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          title="Evidence Integrity"
          description="Verification decisions and checksum coverage."
          action={canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence")
            ? <Link href={`/dashboard/impact-intelligence/evidence?create_programme_id=${programmeId}`} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Evidence repository <ArrowRight className="h-3.5 w-3.5" /></Link>
            : undefined}
        >
          {!evidenceSource.available ? (
            <EmptyPanel title="Evidence data unavailable" description="The evidence source could not be loaded. No integrity values are being inferred." icon={ShieldCheck} />
          ) : evidenceFiles.length === 0 ? (
            <EmptyPanel title="No evidence linked" description="No evidence records are currently linked to this programme." icon={ShieldCheck} />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["Verified", verifiedEvidence.length],
                  ["Pending", pendingEvidence.length],
                  ["Returned", returnedEvidence.length],
                  ["Rejected", rejectedEvidence.length],
                  ["Checksum-backed", checksumEvidence.length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-lg font-bold text-[#0c1733]">{value}</p>
                    <p className="text-[9px] font-semibold text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div><p className="text-xs font-bold text-slate-800">Evidence readiness</p><p className="mt-1 text-[10px] text-slate-500">{verifiedEvidence.length} of {evidenceFiles.length} records verified</p></div>
                <ProgressBar value={evidenceReadiness} />
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Indicator Integrity"
          description="Verified measurements and outcome performance."
          action={canAccessRoute(ctx.role, "/dashboard/impact-intelligence/indicators")
            ? <Link href="/dashboard/impact-intelligence/indicators" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Indicator workspace <ArrowRight className="h-3.5 w-3.5" /></Link>
            : undefined}
        >
          {!indicatorsSource.available || !indicatorAggregateSource.available ? (
            <EmptyPanel title="Indicator data unavailable" description="Indicator measurements or aggregate data could not be loaded. No progress values are being inferred." icon={Target} />
          ) : indicatorMeasurements.length === 0 ? (
            <EmptyPanel title="No indicator measurements" description="No indicator measurements are currently linked to this programme." icon={Target} />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{verifiedIndicators.length}</p><p className="text-[9px] font-semibold text-slate-500">Verified</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{indicatorAggregateSource.data?.averageProgressPercentage === null ? UNAVAILABLE : `${indicatorAggregateSource.data?.averageProgressPercentage ?? UNAVAILABLE}%`}</p><p className="text-[9px] font-semibold text-slate-500">Average progress</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{indicatorAggregateSource.data?.achievedCount ?? UNAVAILABLE}</p><p className="text-[9px] font-semibold text-slate-500">Achieved</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{atRiskIndicators.length}</p><p className="text-[9px] font-semibold text-slate-500">At risk</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Baseline available", verifiedIndicators.filter((item) => item.baseline_value !== null).length],
                  ["Current measured", verifiedIndicators.length],
                  ["Target available", verifiedIndicators.filter((item) => item.target_value !== null).length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <span className="text-[10px] font-semibold text-slate-500">{label}</span>
                    <strong className="text-sm text-slate-800">{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Section
          title="Reports Panel"
          description="Latest institutional report, version posture, and approval state."
          action={canViewReports
            ? <Link href="/dashboard/impact-intelligence/reports" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Report library <ArrowRight className="h-3.5 w-3.5" /></Link>
            : undefined}
        >
          {!reportsSource.available ? (
            <EmptyPanel title="Report data unavailable" description={canReadReports ? "The report source could not be loaded. No report metrics are being inferred." : "Report records are not available to the current role."} icon={FileText} />
          ) : latestReport ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Latest report</p>
                  <h3 className="mt-2 text-base font-bold text-[#0c1733]">{latestReport.title}</h3>
                  <p className="mt-1 text-xs capitalize text-slate-500">{humanize(latestReport.report_type)}</p>
                </div>
                <StatusPill value={latestReport.status} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <div><p className="text-[9px] font-semibold text-slate-500">Latest version</p><p className="mt-1 text-sm font-bold text-slate-800">{latestReport.latest_version ? `v${latestReport.latest_version.version_number}` : "Not generated"}</p></div>
                <div><p className="text-[9px] font-semibold text-slate-500">Approval state</p><p className="mt-1 text-sm font-bold text-slate-800">{humanize(latestReport.status)}</p></div>
                <div><p className="text-[9px] font-semibold text-slate-500">Export availability</p><p className="mt-1 text-sm font-bold text-slate-800">{latestReport.status === "approved" && canRole(ctx.role, "report", "export") ? "Available" : "Unavailable"}</p></div>
                <div><p className="text-[9px] font-semibold text-slate-500">Updated</p><p className="mt-1 text-sm font-bold text-slate-800">{formatDate(latestReport.approved_at ?? latestReport.generated_at ?? latestReport.created_at)}</p></div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/dashboard/impact-intelligence/reports/${latestReport.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white hover:bg-[#132d60]">Open report <ArrowRight className="h-3.5 w-3.5" /></Link>
                {canCreateReport && <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> Prepare report</Link>}
              </div>
            </div>
          ) : (
            <EmptyPanel title="No reports yet" description="No institutional reports are linked to this programme." icon={FileText} />
          )}
        </Section>

        <Section title="Risk & Attention" description="Open issues derived from available programme records.">
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg",
                    item.tone === "rose" ? "bg-rose-100 text-rose-700"
                      : item.tone === "amber" ? "bg-amber-100 text-amber-700"
                        : item.tone === "emerald" ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500",
                  )}>
                    {item.value === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                </div>
                <strong className="text-sm text-[#0c1733]">{formatNumber(item.value)}</strong>
              </div>
            ))}
          </div>
          {openRiskFlags.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {openRiskFlags.slice(0, 3).map((flag) => (
                <div key={flag.id} className="rounded-xl bg-rose-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-bold text-rose-900">{flag.title}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-rose-700">{flag.description}</p></div>
                    <StatusPill value={flag.severity} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Recent Programme Activity" description="Latest verifiable delivery events from the records available to the current role.">
        {activity.length === 0 ? (
          <EmptyPanel title="No recent activity available" description="No evidence verification, monitoring review, report approval, or intervention creation event is available." icon={Activity} />
        ) : (
          <div className="relative space-y-1 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-slate-200">
            {activity.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link key={`${item.type}-${item.title}-${index}`} href={item.href} className="group relative flex items-start gap-4 rounded-xl p-3 hover:bg-slate-50">
                  <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-blue-700 shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">{item.title}</p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">{item.type}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="h-3 w-3" /> {formatDateTime(item.date)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <MapPin className="h-4 w-4 text-emerald-600" />
          <span>{new Set(cohorts.map((item) => item.state).filter(Boolean)).size || UNAVAILABLE} states represented</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <Banknote className="h-4 w-4 text-amber-600" />
          <span>{formatCurrency(interventions.some((item) => item.disbursed_amount !== null) ? interventions.reduce((sum, item) => sum + (item.disbursed_amount ?? 0), 0) : null)} disbursed</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <span>{indicatorReadiness === null ? UNAVAILABLE : `${indicatorReadiness}%`} indicator readiness</span>
        </div>
      </div>
    </section>
  );
}
