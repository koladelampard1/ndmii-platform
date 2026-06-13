import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Eye,
  FileCheck2,
  FileWarning,
  Filter,
  Gauge,
  Layers3,
  MapPinned,
  Plus,
  Route,
  ShieldCheck,
  Target,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import {
  createFieldVisit,
  FIELD_VISIT_STATUSES,
  listImpactAssessments,
  listImpactCohortMemberOptions,
  listImpactCohorts,
  listImpactInterventions,
  listImpactProgrammes,
  listFieldVisits,
  listUserPickerOptions,
  type ImpactAssessment,
  type ImpactCohortMember,
  type ImpactFieldVisit,
  type UserPickerOption,
} from "@/lib/data/impact-intelligence";
import {
  listIndicatorMeasurements,
  type ImpactIndicatorMeasurement,
} from "@/lib/data/impact-indicators";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";
import { CreateFieldVisitForm } from "./create-field-visit-form";

const ROUTE = "/dashboard/impact-intelligence/monitoring";
const UNAVAILABLE = "Unavailable";
const COMPLETED_STATUSES = new Set(["completed", "reviewed"]);

const DEFAULT_CHECKLIST = [
  "Confirm business location | verification | yes",
  "Capture facility photo placeholder | evidence | yes",
  "Validate intervention usage | monitoring | yes",
  "Record follow-up needs | follow_up | no",
].join("\n");

type PageProps = {
  searchParams?: Promise<{
    programme_id?: string;
    cohort_id?: string;
    status?: string;
    assigned_officer_id?: string;
    create_programme_id?: string;
    create_cohort_id?: string;
    create_member_id?: string;
    create_intervention_id?: string;
    error?: string;
  }>;
};

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

type MonitoringPortfolioItem = {
  visit: ImpactFieldVisit;
  officerName: string;
  linkedEvidence: number | null;
  verifiedEvidence: number | null;
  evidenceState: string;
  reviewState: string;
  readiness: number | null;
  readinessState: string;
  health: HealthState;
  attentionReasons: string[];
};

const EXPECTED_CREATE_VISIT_ERRORS = [
  "Field visit title is required.",
  "Select a programme for this field visit.",
  "Select a beneficiary cohort for this field visit.",
  "Select a cohort beneficiary for this field visit.",
  "Selected field visit cohort beneficiary does not exist.",
  "Selected field visit cohort beneficiary does not belong to the selected programme.",
  "Selected field visit cohort beneficiary does not belong to the selected cohort.",
  "Selected field officer does not exist.",
  "Selected assignee must have field_officer role.",
  "Selected field visit intervention does not exist.",
  "Selected field visit intervention does not belong to the selected programme.",
  "Selected field visit intervention does not belong to the selected cohort.",
  "Selected field visit intervention does not belong to the selected cohort beneficiary.",
  "Selected field visit intervention MSME does not match the selected cohort beneficiary.",
  "Selected field visit assessment does not exist.",
  "Selected field visit assessment does not belong to the selected programme.",
  "Selected field visit assessment does not belong to the selected cohort.",
  "Selected field visit assessment does not belong to the selected cohort beneficiary.",
  "Selected field visit assessment MSME does not match the selected cohort beneficiary.",
  "You do not have permission to manage field monitoring.",
];

function isExpectedCreateVisitError(error: unknown) {
  return error instanceof Error && EXPECTED_CREATE_VISIT_ERRORS.some((message) => error.message.includes(message));
}

async function createVisitAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  let visitId: string;
  try {
    visitId = await createFieldVisit(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedCreateVisitError(error)) throw error;
    const params = new URLSearchParams();
    const programmeId = formData.get("programme_id");
    const cohortId = formData.get("cohort_id");
    if (typeof programmeId === "string" && programmeId) params.set("create_programme_id", programmeId);
    if (typeof cohortId === "string" && cohortId) params.set("create_cohort_id", cohortId);
    params.set("error", error instanceof Error ? error.message : "Field visit could not be created.");
    redirect(`${ROUTE}?${params.toString()}#schedule-visit`);
  }
  redirect(`${ROUTE}/${visitId}`);
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

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
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

function isOverdueVisit(visit: ImpactFieldVisit) {
  if (COMPLETED_STATUSES.has(visit.status ?? "")) return false;
  const value = visit.scheduled_at ?? visit.visit_date;
  if (!value) return false;
  const date = new Date(value.length === 10 ? `${value}T23:59:59` : value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function statusTone(status: string | null) {
  if (status === "reviewed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "completed") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "in_progress") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (status === "assigned") return "bg-amber-50 text-amber-700 ring-amber-200";
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
  icon: typeof CalendarCheck;
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
      {items.slice(0, 8).map((item) => (
        <div key={`${item.label}-${item.detail ?? ""}`}>
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

function deriveVisitHealth(input: {
  visit: ImpactFieldVisit;
  evidenceAvailable: boolean;
  linkedEvidence: number;
  verifiedEvidence: number;
}) {
  if (!input.evidenceAvailable) return { health: "Unavailable" as const, attentionReasons: [] };
  const reasons: string[] = [];
  const completed = COMPLETED_STATUSES.has(input.visit.status ?? "");

  if (!input.visit.assigned_to_user_id) reasons.push("No field officer assigned");
  if (isOverdueVisit(input.visit)) reasons.push("Scheduled visit is overdue");
  if (input.visit.status === "completed" && !input.visit.reviewed_at) reasons.push("Completed visit awaiting review");
  if (completed && input.linkedEvidence === 0) reasons.push("Completed visit has no evidence");
  else if (input.linkedEvidence > 0 && input.verifiedEvidence === 0) reasons.push("Evidence awaiting verification");

  if (
    isOverdueVisit(input.visit)
    || (completed && input.linkedEvidence === 0)
    || (input.visit.status === "reviewed" && input.verifiedEvidence === 0)
  ) {
    return { health: "At Risk" as const, attentionReasons: reasons };
  }
  if (reasons.length > 0 || !completed) {
    return { health: "Watchlist" as const, attentionReasons: reasons.length > 0 ? reasons : ["Monitoring workflow is incomplete"] };
  }
  return { health: "Healthy" as const, attentionReasons: [] };
}

function officerNameFor(
  visit: ImpactFieldVisit,
  officers: UserPickerOption[],
  currentUser: { id: string | null; name: string | null },
) {
  if (!visit.assigned_to_user_id) return UNAVAILABLE;
  if (visit.assigned_to_user_id === currentUser.id) return currentUser.name ?? "Assigned to you";
  const officer = officers.find((item) => item.id === visit.assigned_to_user_id);
  return officer?.full_name ?? officer?.email ?? UNAVAILABLE;
}

export default async function MonitoringPage({ searchParams }: PageProps) {
  const filters = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let visitsSource = sourceFallback<ImpactFieldVisit[]>([]);

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    visitsSource = await loadSource(
      currentContext,
      "monitoring_command_visits_load_failed",
      () => listFieldVisits(currentContext, {
        limit: 5000,
        programmeId: filters.programme_id,
        cohortId: filters.cohort_id,
        status: filters.status,
        assignedOfficerId: filters.assigned_officer_id,
      }),
      [],
    );
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "monitoring_command_context_load_failed", error });
  }

  if (!ctx || !visitsSource.available) {
    return (
      <section className="space-y-6">
        <Section title="Field Monitoring Command Centre Unavailable">
          <EmptyState
            title="Monitoring operations could not load"
            description="The monitoring source, current session, or assigned scope is temporarily unavailable. No operational metrics are being inferred."
            icon={CalendarCheck}
          />
        </Section>
      </section>
    );
  }

  const visits = visitsSource.data;
  const visitIds = new Set(visits.map((item) => item.id));
  const canSchedule = canRole(ctx.role, "monitoring_visit", "create");
  const canAssign = canRole(ctx.role, "monitoring_visit", "assign");
  const canReview = canRole(ctx.role, "monitoring_visit", "review");
  const canReadEvidence = canRole(ctx.role, "evidence", "read");
  const canReadIndicators = canRole(ctx.role, "indicator", "read");
  const canReadAssessments = canRole(ctx.role, "assessment", "read");
  const canViewEvidence = canReadEvidence && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence");
  const canOpenVisit = canAccessRoute(ctx.role, ROUTE);
  const createProgrammeId = filters.create_programme_id ?? "";
  const createCohortId = filters.create_cohort_id ?? "";

  const [
    programmesSource,
    cohortsSource,
    evidenceSource,
    assessmentsSource,
    indicatorsSource,
    officersSource,
    createCohortsSource,
    createMembersSource,
    createInterventionsSource,
    createAssessmentsSource,
  ] = await Promise.all([
    loadSource(ctx, "monitoring_command_programmes_load_failed", () => listImpactProgrammes(ctx, { limit: 1000 }), []),
    loadSource(ctx, "monitoring_command_cohorts_load_failed", () => listImpactCohorts(ctx, {
      limit: 2000,
      programmeId: filters.programme_id,
    }), []),
    canReadEvidence
      ? loadSource(ctx, "monitoring_command_evidence_load_failed", () => listImpactEvidence(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactEvidenceRecord[]>([])),
    canReadAssessments
      ? loadSource(ctx, "monitoring_command_assessments_load_failed", () => listImpactAssessments(ctx, {
        limit: 5000,
        programmeId: filters.programme_id,
        cohortId: filters.cohort_id,
      }), [])
      : Promise.resolve(sourceFallback<ImpactAssessment[]>([])),
    canReadIndicators
      ? loadSource(ctx, "monitoring_command_indicators_load_failed", () => listIndicatorMeasurements(ctx, {
        limit: 5000,
        programmeId: filters.programme_id,
        cohortId: filters.cohort_id,
      }), [])
      : Promise.resolve(sourceFallback<ImpactIndicatorMeasurement[]>([])),
    canAssign || canReview
      ? loadSource(ctx, "monitoring_command_officers_load_failed", () => listUserPickerOptions("field_officer"), [])
      : Promise.resolve(sourceFallback<UserPickerOption[]>([])),
    canSchedule
      ? loadSource(ctx, "monitoring_create_cohorts_load_failed", () => listImpactCohorts(ctx, {
        limit: 500,
        programmeId: createProgrammeId,
      }), [])
      : Promise.resolve(sourceFallback([])),
    canSchedule
      ? loadSource(ctx, "monitoring_create_members_load_failed", () => listImpactCohortMemberOptions(ctx, {
        limit: 500,
        programmeId: createProgrammeId,
        cohortId: createCohortId,
      }), [])
      : Promise.resolve(sourceFallback<ImpactCohortMember[]>([])),
    canSchedule
      ? loadSource(ctx, "monitoring_create_interventions_load_failed", () => listImpactInterventions(ctx, {
        limit: 500,
        programmeId: createProgrammeId,
        cohortId: createCohortId,
      }), [])
      : Promise.resolve(sourceFallback([])),
    canSchedule
      ? loadSource(ctx, "monitoring_create_assessments_load_failed", () => listImpactAssessments(ctx, {
        limit: 500,
        programmeId: createProgrammeId,
        cohortId: createCohortId,
      }), [])
      : Promise.resolve(sourceFallback<ImpactAssessment[]>([])),
  ]);

  const coverageCohorts = filters.cohort_id
    ? cohortsSource.data.filter((cohort) => cohort.id === filters.cohort_id)
    : cohortsSource.data;
  const membersSource = cohortsSource.available
    ? await loadSource(
      ctx,
      "monitoring_command_members_load_failed",
      async () => (await Promise.all(coverageCohorts.map((cohort) => listImpactCohortMemberOptions(ctx, {
        limit: 5000,
        programmeId: cohort.programme_id,
        cohortId: cohort.id,
      })))).flat(),
      [],
    )
    : sourceFallback<ImpactCohortMember[]>([]);

  const evidence = evidenceSource.data.filter((item) => item.field_visit_id && visitIds.has(item.field_visit_id));
  const assessments = assessmentsSource.data.filter((item) =>
    (item.field_visit_id && visitIds.has(item.field_visit_id))
    || visits.some((visit) => visit.assessment_id === item.id),
  );
  const indicators = indicatorsSource.data.filter((item) => item.field_visit_id && visitIds.has(item.field_visit_id));
  const officerMapAvailable = officersSource.available || ctx.role === "field_officer";

  const portfolio: MonitoringPortfolioItem[] = visits.map((visit) => {
    const linkedEvidenceRows = evidence.filter((item) => item.field_visit_id === visit.id);
    const verifiedEvidenceRows = linkedEvidenceRows.filter((item) =>
      item.status === "verified" && item.verification_status === "verified",
    );
    const linkedEvidence = evidenceSource.available ? linkedEvidenceRows.length : null;
    const verifiedEvidence = evidenceSource.available ? verifiedEvidenceRows.length : null;
    const reviewed = visit.status === "reviewed" || Boolean(visit.reviewed_at);
    const readiness = evidenceSource.available
      ? reviewed && verifiedEvidenceRows.length > 0 ? 100 : 0
      : null;
    const health = deriveVisitHealth({
      visit,
      evidenceAvailable: evidenceSource.available,
      linkedEvidence: linkedEvidenceRows.length,
      verifiedEvidence: verifiedEvidenceRows.length,
    });

    return {
      visit,
      officerName: officerMapAvailable
        ? officerNameFor(visit, officersSource.data, { id: ctx.appUserId, name: ctx.fullName })
        : UNAVAILABLE,
      linkedEvidence,
      verifiedEvidence,
      evidenceState: linkedEvidence === null
        ? UNAVAILABLE
        : linkedEvidence === 0
          ? "Missing"
          : verifiedEvidenceRows.length === linkedEvidenceRows.length
            ? "Verified"
            : "Pending verification",
      reviewState: reviewed ? "Reviewed" : visit.status === "completed" ? "Pending review" : "Not ready",
      readiness,
      readinessState: readiness === null ? UNAVAILABLE : readiness === 100 ? "Report ready" : "Not ready",
      ...health,
    };
  });

  const reviewed = visits.filter((item) => item.status === "reviewed" || item.reviewed_at).length;
  const completed = visits.filter((item) => COMPLETED_STATUSES.has(item.status ?? "")).length;
  const completedUnreviewed = visits.filter((item) => item.status === "completed" && !item.reviewed_at).length;
  const pendingReviews = completedUnreviewed;
  const assignedOfficers = new Set(visits.map((item) => item.assigned_to_user_id).filter(Boolean)).size;
  const coveredMemberIds = new Set(visits.map((item) => item.cohort_member_id).filter(Boolean));
  const beneficiariesCovered = coveredMemberIds.size;
  const evidenceCollected = evidenceSource.available ? evidence.length : null;
  const visitsWithEvidence = evidenceSource.available
    ? new Set(evidence.map((item) => item.field_visit_id).filter(Boolean)).size
    : null;
  const visitsWithVerifiedEvidence = evidenceSource.available
    ? new Set(evidence
      .filter((item) => item.status === "verified" && item.verification_status === "verified")
      .map((item) => item.field_visit_id)
      .filter(Boolean)).size
    : null;
  const pendingEvidenceVerification = evidenceSource.available
    ? evidence.filter((item) => item.verification_status !== "verified").length
    : null;
  const missingEvidence = evidenceSource.available
    ? portfolio.filter((item) => COMPLETED_STATUSES.has(item.visit.status ?? "") && item.linkedEvidence === 0)
    : [];
  const overdueVisits = visits.filter(isOverdueVisit);
  const incompleteVisits = visits.filter((item) => !COMPLETED_STATUSES.has(item.status ?? "")).length;
  const reportReadyVisits = evidenceSource.available
    ? portfolio.filter((item) => item.readiness === 100).length
    : null;
  const monitoringReadiness = evidenceSource.available ? ratio(reportReadyVisits ?? 0, visits.length) : null;
  const monitoringCoverage = ratio(completed, visits.length);
  const openMonitoringRisks = portfolio.filter((item) => item.health === "At Risk").length;

  const programmeIdsCovered = new Set(visits.map((item) => item.programme_id).filter(Boolean));
  const cohortIdsCovered = new Set(visits.map((item) => item.cohort_id).filter(Boolean));
  const programmeCoverage = programmesSource.available
    ? ratio(programmeIdsCovered.size, programmesSource.data.length)
    : null;
  const cohortCoverage = cohortsSource.available
    ? ratio(cohortIdsCovered.size, coverageCohorts.length)
    : null;
  const beneficiaryCoverage = membersSource.available
    ? ratio(beneficiariesCovered, membersSource.data.length)
    : null;
  const unvisitedMembers = membersSource.available
    ? membersSource.data.filter((member) => !coveredMemberIds.has(member.id))
    : [];

  const linkedAssessmentVisitIds = new Set<string>();
  for (const assessment of assessments) {
    if (assessment.field_visit_id) linkedAssessmentVisitIds.add(assessment.field_visit_id);
    for (const visit of visits) {
      if (visit.assessment_id === assessment.id) linkedAssessmentVisitIds.add(visit.id);
    }
  }
  const linkedIndicatorVisitIds = new Set(indicators.map((item) => item.field_visit_id).filter((value): value is string => Boolean(value)));
  const verifiedIndicatorVisitIds = new Set(indicators
    .filter((item) => item.verification_status === "verified")
    .map((item) => item.field_visit_id)
    .filter((value): value is string => Boolean(value)));
  const outcomeReadyVisits = assessmentsSource.available && indicatorsSource.available
    ? visits.filter((visit) => linkedAssessmentVisitIds.has(visit.id) && verifiedIndicatorVisitIds.has(visit.id)).length
    : null;
  const awaitingOutcomeValidation = assessmentsSource.available && indicatorsSource.available
    ? visits.filter((visit) =>
      linkedAssessmentVisitIds.has(visit.id)
      && (!linkedIndicatorVisitIds.has(visit.id) || !verifiedIndicatorVisitIds.has(visit.id)),
    ).length
    : null;

  const pipeline = [
    { label: "Scheduled", value: visits.filter((item) => Boolean(item.scheduled_at ?? item.visit_date)).length, available: true, color: "bg-slate-500" },
    { label: "Assigned", value: visits.filter((item) => Boolean(item.assigned_to_user_id)).length, available: true, color: "bg-amber-500" },
    { label: "In Progress", value: visits.filter((item) => item.status === "in_progress").length, available: true, color: "bg-violet-500" },
    { label: "Completed", value: completed, available: true, color: "bg-blue-500" },
    { label: "Reviewed", value: reviewed, available: true, color: "bg-cyan-500" },
    { label: "Evidence Verified", value: visitsWithVerifiedEvidence ?? 0, available: evidenceSource.available, color: "bg-emerald-500" },
    { label: "Report Ready", value: reportReadyVisits ?? 0, available: evidenceSource.available, color: "bg-indigo-500" },
  ];
  const availablePipeline = pipeline.filter((item) => item.available);
  const bottleneckValue = availablePipeline.length > 0 ? Math.min(...availablePipeline.map((item) => item.value)) : null;

  const programmeDistribution = programmesSource.data.map((programme) => ({
    label: programme.name,
    value: visits.filter((item) => item.programme_id === programme.id).length,
    detail: programme.programme_code ?? undefined,
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const cohortDistribution = coverageCohorts.map((cohort) => ({
    label: cohort.name,
    value: visits.filter((item) => item.cohort_id === cohort.id).length,
    detail: cohort.impact_programmes?.name ?? UNAVAILABLE,
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const stateDistribution = Array.from(visits.reduce((map, visit) => {
    const state = visit.msmes?.state?.trim();
    if (state) map.set(state, (map.get(state) ?? 0) + 1);
    return map;
  }, new Map<string, number>())).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const sectorDistribution = Array.from(visits.reduce((map, visit) => {
    const sector = visit.msmes?.sector?.trim();
    if (sector) map.set(sector, (map.get(sector) ?? 0) + 1);
    return map;
  }, new Map<string, number>())).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const concentrationDistribution = programmeDistribution.filter((item) => item.value > 0);

  const recentActivity = [
    ...visits
      .filter((item) => item.created_at)
      .map((item) => ({
        type: item.scheduled_at ?? item.visit_date ? "Visit scheduled" : "Visit created",
        title: item.title ?? "Field visit",
        createdAt: item.created_at,
        href: `${ROUTE}/${item.id}`,
        icon: CalendarCheck,
      })),
    ...visits
      .filter((item) => item.completed_at)
      .map((item) => ({
        type: "Visit completed",
        title: item.title ?? "Field visit",
        createdAt: item.completed_at,
        href: `${ROUTE}/${item.id}`,
        icon: CheckCircle2,
      })),
    ...visits
      .filter((item) => item.reviewed_at)
      .map((item) => ({
        type: "Visit reviewed",
        title: item.title ?? "Field visit",
        createdAt: item.reviewed_at,
        href: `${ROUTE}/${item.id}`,
        icon: ShieldCheck,
      })),
    ...evidence
      .filter((item) => item.uploaded_at ?? item.created_at)
      .map((item) => ({
        type: "Evidence uploaded",
        title: item.original_filename ?? item.file_name,
        createdAt: item.uploaded_at ?? item.created_at,
        href: `/dashboard/impact-intelligence/evidence/${item.id}`,
        icon: FileCheck2,
      })),
    ...evidence
      .filter((item) => item.verification_status === "verified" && item.reviewed_at)
      .map((item) => ({
        type: "Evidence verified",
        title: item.original_filename ?? item.file_name,
        createdAt: item.reviewed_at,
        href: `/dashboard/impact-intelligence/evidence/${item.id}`,
        icon: BadgeCheck,
      })),
  ]
    .filter((item) => item.createdAt && canAccessRoute(ctx.role, item.href))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 8);

  const freshness = latestDate([
    ...visits.map((item) => item.reviewed_at ?? item.completed_at ?? item.scheduled_at ?? item.created_at),
    ...evidence.map((item) => item.reviewed_at ?? item.uploaded_at ?? item.created_at),
    ...indicators.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
  ]);
  const coverageHealth = summaryHealth(beneficiaryCoverage);
  const evidenceHealth = summaryHealth(evidenceSource.available ? ratio(visitsWithVerifiedEvidence ?? 0, visits.length) : null);
  const assuranceHealth = summaryHealth(ratio(reviewed, visits.length));
  const monitoringHealth = summaryHealth(monitoringCoverage);
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  const selectedMemberId = createMembersSource.data.some((member) => member.id === filters.create_member_id)
    ? filters.create_member_id ?? ""
    : "";
  const createInterventions = createInterventionsSource.data.filter((intervention) =>
    (!createProgrammeId || intervention.programme_id === createProgrammeId)
    && (!createCohortId || intervention.cohort_id === createCohortId)
    && (!selectedMemberId || intervention.cohort_member_id === selectedMemberId),
  );
  const selectedInterventionId = createInterventions.some((intervention) => intervention.id === filters.create_intervention_id)
    ? filters.create_intervention_id ?? ""
    : "";
  const createAssessments = createAssessmentsSource.data.filter((assessment) =>
    (!createProgrammeId || assessment.programme_id === createProgrammeId)
    && (!createCohortId || assessment.cohort_id === createCohortId)
    && (!selectedMemberId || assessment.cohort_member_id === selectedMemberId),
  );

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Monitoring</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Field Monitoring Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Executive field operations coverage, visit assurance, evidence quality, outcome observation, and reporting readiness.
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
              {canSchedule && (
                <Link href="#schedule-visit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#132d60]">
                  <Plus className="h-4 w-4" /> Schedule Visit
                </Link>
              )}
              {canAssign && (
                <Link href="#monitoring-portfolio" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <UserCheck className="h-4 w-4" /> Assign Officer
                </Link>
              )}
              {canViewEvidence && (
                <Link href="/dashboard/impact-intelligence/evidence" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Eye className="h-4 w-4" /> View Evidence
                </Link>
              )}
              <details className="relative">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <form method="get" className="absolute right-0 z-30 mt-2 grid w-[min(90vw,560px)] gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:grid-cols-2">
                  <select name="programme_id" defaultValue={filters.programme_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All programmes</option>
                    {programmesSource.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select name="cohort_id" defaultValue={filters.cohort_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All cohorts</option>
                    {cohortsSource.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select name="status" defaultValue={filters.status ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All visit statuses</option>
                    {FIELD_VISIT_STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                  </select>
                  <select name="assigned_officer_id" defaultValue={filters.assigned_officer_id ?? ""} disabled={!officersSource.available} className="rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50">
                    <option value="">All field officers</option>
                    {officersSource.data.map((item) => <option key={item.id} value={item.id}>{item.full_name ?? item.email ?? "Field officer"}</option>)}
                  </select>
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="submit" className="h-9 rounded-lg bg-[#0c1f46] px-4 text-xs font-bold text-white">Apply filters</button>
                    <Link href={ROUTE} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700">Clear</Link>
                  </div>
                </form>
              </details>
              <span title={`${ctx.fullName ?? roleLabel(ctx.role)} · ${roleLabel(ctx.role)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initials(ctx.fullName, ctx.role)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_28%,rgba(16,185,129,0.36),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="monitoring-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#34d399" /></pattern></defs>
            <path d="M492 42 612 18l72 40 82 10 48 58-42 48 15 54-102 20-70-37-82 16-45-68 18-54Z" fill="url(#monitoring-hero-dots)" stroke="#34d399" strokeOpacity=".45" />
            <path d="M455 232c72-48 118-112 181-80s94 4 154-70" fill="none" stroke="#5eead4" strokeOpacity=".55" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Field operations overview</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Field coverage, evidence integrity, and reporting assurance in one view</h2>
              <p className="mt-2 text-sm text-blue-100/80">Scoped operational records only. Missing sources remain unavailable and are never estimated.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed field scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total visits", value: formatNumber(visits.length), icon: CalendarCheck, color: "text-cyan-300" },
              { label: "Reviewed visits", value: formatNumber(reviewed), icon: ShieldCheck, color: "text-emerald-300" },
              { label: "Pending reviews", value: formatNumber(pendingReviews), icon: Clock3, color: "text-amber-300" },
              { label: "Coverage status", value: formatPercent(beneficiaryCoverage), icon: Route, color: "text-violet-300" },
              { label: "Monitoring readiness", value: formatPercent(monitoringReadiness), icon: Gauge, color: "text-blue-300" },
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
        <MetricCard label="Total Visits" value={formatNumber(visits.length)} icon={CalendarCheck} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Reviewed Visits" value={formatNumber(reviewed)} icon={ShieldCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Completed Visits" value={formatNumber(completed)} icon={CheckCircle2} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Pending Reviews" value={formatNumber(pendingReviews)} icon={Clock3} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Assigned Officers" value={formatNumber(assignedOfficers)} icon={UserCheck} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Beneficiaries Covered" value={formatNumber(beneficiariesCovered)} icon={UsersRound} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Evidence Collected" value={formatNumber(evidenceCollected)} icon={FileCheck2} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Monitoring Readiness" value={formatPercent(monitoringReadiness)} icon={Gauge} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Open Monitoring Risks" value={formatNumber(openMonitoringRisks)} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
      </div>

      <Section title="Monitoring Assurance Pipeline" description="Lifecycle counts across visible visits. Report ready is derived from reviewed visits with verified visit evidence.">
        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
          {pipeline.map((item, index) => {
            const isBottleneck = item.available && bottleneckValue !== null && item.value === bottleneckValue && visits.length > 0;
            return (
              <article key={item.label} className={cn("relative overflow-hidden rounded-xl border bg-slate-50/70 p-3", isBottleneck ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200")}>
                <div className={cn("absolute inset-x-0 top-0 h-1", item.color)} />
                <p className="mt-1 text-lg font-bold text-[#0c1733]">{item.available ? formatNumber(item.value) : UNAVAILABLE}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-700">{item.label}</p>
                <p className="mt-1 text-[9px] leading-4 text-slate-400">{isBottleneck ? "Current lowest stage" : item.available ? `${formatPercent(ratio(item.value, visits.length))} of visits` : "Source unavailable"}</p>
                {index < pipeline.length - 1 && <ArrowRight className="absolute right-1 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-slate-300 xl:block" />}
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        id="monitoring-portfolio"
        title="Monitoring Portfolio"
        description="Visit-level field context, officer assignment, evidence assurance, readiness, and operational health."
        action={<span className="text-xs font-semibold text-slate-500">{visits.length} visit{visits.length === 1 ? "" : "s"}</span>}
      >
        {visits.length === 0 ? (
          <EmptyState
            title={scopeEmptyMessage ?? "No monitoring visits available"}
            description={scopeEmptyMessage ?? "No field visits are available in the current scope or filter selection."}
            actionHref={canSchedule ? "#schedule-visit" : undefined}
            actionLabel={canSchedule ? "Schedule visit" : undefined}
            icon={CalendarCheck}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {portfolio.map((item) => {
              const content = (
                <article className="group h-full rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-950/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1", statusTone(item.visit.status))}>{(item.visit.status ?? "pending").replaceAll("_", " ")}</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-[#0c1733] group-hover:text-emerald-700">{item.visit.title ?? "Field visit"}</h3>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{item.visit.impact_programmes?.name ?? UNAVAILABLE}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-400">{item.visit.impact_beneficiary_cohorts?.name ?? UNAVAILABLE}</p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700"><MapPinned className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-xs">
                    <div><p className="text-[10px] text-slate-500">Beneficiary</p><p className="mt-1 truncate font-bold text-slate-900">{item.visit.msmes?.business_name ?? UNAVAILABLE}</p></div>
                    <div><p className="text-[10px] text-slate-500">Assigned officer</p><p className="mt-1 truncate font-bold text-slate-900">{item.officerName}</p></div>
                    <div><p className="text-[10px] text-slate-500">Completion</p><p className="mt-1 font-bold capitalize text-slate-900">{COMPLETED_STATUSES.has(item.visit.status ?? "") ? "Completed" : "Incomplete"}</p></div>
                    <div><p className="text-[10px] text-slate-500">Evidence</p><p className="mt-1 truncate font-bold text-slate-900">{item.evidenceState}</p></div>
                    <div><p className="text-[10px] text-slate-500">Review</p><p className="mt-1 truncate font-bold text-slate-900">{item.reviewState}</p></div>
                    <div><p className="text-[10px] text-slate-500">Readiness</p><p className="mt-1 truncate font-bold text-slate-900">{item.readinessState}</p></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-slate-500">{formatDate(item.visit.scheduled_at ?? item.visit.visit_date)}</p>
                      {item.attentionReasons.length > 0 && <p className="mt-1 line-clamp-1 text-[9px] text-amber-700">{item.attentionReasons.join(" · ")}</p>}
                    </div>
                    {canOpenVisit && <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-700">Open visit <ArrowRight className="h-3 w-3" /></span>}
                  </div>
                </article>
              );
              return canOpenVisit
                ? <Link key={item.visit.id} href={`${ROUTE}/${item.visit.id}`}>{content}</Link>
                : <div key={item.visit.id}>{content}</div>;
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Programme Coverage" description="Visible programmes with at least one monitoring visit.">
          {!programmesSource.available ? <EmptyState title="Programme coverage unavailable" description="The programme source could not load." icon={Layers3} /> : (
            <>
              <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 p-3 text-blue-800"><span className="text-xs font-semibold">Portfolio coverage</span><span className="text-lg font-bold">{formatPercent(programmeCoverage)}</span></div>
              <DistributionBars items={programmeDistribution.filter((item) => item.value > 0)} emptyText="No programme monitoring coverage is available." tone="bg-blue-500" />
            </>
          )}
        </Section>
        <Section title="Cohort Coverage" description="Visible cohorts with field monitoring activity.">
          {!cohortsSource.available ? <EmptyState title="Cohort coverage unavailable" description="The cohort source could not load." icon={UsersRound} /> : (
            <>
              <div className="mb-4 flex items-center justify-between rounded-xl bg-violet-50 p-3 text-violet-800"><span className="text-xs font-semibold">Cohort coverage</span><span className="text-lg font-bold">{formatPercent(cohortCoverage)}</span></div>
              <DistributionBars items={cohortDistribution.filter((item) => item.value > 0)} emptyText="No cohort monitoring coverage is available." tone="bg-violet-500" />
            </>
          )}
        </Section>
        <Section title="Beneficiary Coverage" description="Cohort beneficiaries with at least one visible visit.">
          {!membersSource.available ? <EmptyState title="Beneficiary coverage unavailable" description="The scoped cohort-member source could not load." icon={UserCheck} /> : (
            <div>
              <article className="rounded-2xl bg-emerald-50 p-5 text-emerald-800">
                <UsersRound className="h-5 w-5" />
                <p className="mt-5 text-4xl font-bold">{formatPercent(beneficiaryCoverage)}</p>
                <p className="mt-1 text-xs font-semibold">Beneficiary coverage</p>
                <p className="mt-3 text-[10px] text-emerald-700/70">{beneficiariesCovered} covered · {unvisitedMembers.length} not visited</p>
              </article>
              {unvisitedMembers.length > 0 && (
                <div className="mt-3 space-y-2">
                  {unvisitedMembers.slice(0, 4).map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs">
                      <span className="truncate font-semibold text-slate-700">{member.msmes?.business_name ?? member.msmes?.msme_id ?? UNAVAILABLE}</span>
                      <span className="text-[10px] font-bold text-amber-700">Not visited</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      <Section title="Geographic Monitoring Zone" description="State, sector, and programme concentration from beneficiary and visit-linked data.">
        <div className="grid gap-6 lg:grid-cols-3">
          <div><h3 className="mb-4 text-xs font-bold text-slate-900">State distribution</h3><DistributionBars items={stateDistribution} emptyText="Unavailable: no state data is present on visible visit beneficiaries." tone="bg-emerald-500" /></div>
          <div><h3 className="mb-4 text-xs font-bold text-slate-900">Sector distribution</h3><DistributionBars items={sectorDistribution} emptyText="Unavailable: no sector data is present on visible visit beneficiaries." tone="bg-cyan-500" /></div>
          <div><h3 className="mb-4 text-xs font-bold text-slate-900">Visit concentration</h3><DistributionBars items={concentrationDistribution} emptyText="Unavailable: no programme-linked visit concentration is available." tone="bg-indigo-500" /></div>
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Monitoring Quality Centre" description="Quality indicators derived from visit status, schedule, review, and evidence links.">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Reviewed visits", value: formatNumber(reviewed), tone: "bg-emerald-50 text-emerald-700" },
              { label: "Completed, unreviewed", value: formatNumber(completedUnreviewed), tone: "bg-amber-50 text-amber-700" },
              { label: "Overdue reviews", value: UNAVAILABLE, tone: "bg-slate-100 text-slate-600" },
              { label: "Missing evidence", value: evidenceSource.available ? formatNumber(missingEvidence.length) : UNAVAILABLE, tone: "bg-rose-50 text-rose-700" },
            ].map((item) => <article key={item.label} className={cn("rounded-xl p-4", item.tone)}><p className="text-2xl font-bold">{item.value}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p></article>)}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-500">Overdue review is unavailable because the current schema has no review SLA or due-date field.</p>
        </Section>
        <Section title="Evidence Collection Centre" description="Visit-linked evidence volume and verification readiness. Storage paths are never displayed.">
          {!evidenceSource.available ? <EmptyState title="Evidence collection unavailable" description="Evidence access is unavailable for this role or the source could not load." icon={FileCheck2} /> : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Visits with evidence", value: formatNumber(visitsWithEvidence), tone: "bg-blue-50 text-blue-700" },
                { label: "Verified evidence", value: formatNumber(evidence.filter((item) => item.status === "verified" && item.verification_status === "verified").length), tone: "bg-emerald-50 text-emerald-700" },
                { label: "Pending verification", value: formatNumber(pendingEvidenceVerification), tone: "bg-amber-50 text-amber-700" },
                { label: "Missing evidence", value: formatNumber(missingEvidence.length), tone: "bg-rose-50 text-rose-700" },
              ].map((item) => <article key={item.label} className={cn("rounded-xl p-4", item.tone)}><p className="text-2xl font-bold">{item.value}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p></article>)}
            </div>
          )}
        </Section>
      </div>

      <Section title="Outcome Observation Centre" description="Only explicit visit-assessment and visit-indicator relationships contribute to outcome readiness.">
        {!assessmentsSource.available || !indicatorsSource.available ? (
          <EmptyState title="Outcome observation unavailable" description="Assessment or indicator access is unavailable for this role, or a source could not load." icon={Target} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Linked assessments", value: assessments.length, icon: ClipboardCheck, tone: "bg-blue-50 text-blue-700" },
              { label: "Linked indicators", value: indicators.length, icon: BarChart3, tone: "bg-violet-50 text-violet-700" },
              { label: "Outcome-ready visits", value: outcomeReadyVisits ?? 0, icon: BadgeCheck, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Awaiting validation", value: awaitingOutcomeValidation ?? 0, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
            ].map((item) => {
              const Icon = item.icon;
              return <article key={item.label} className={cn("rounded-2xl p-4", item.tone)}><Icon className="h-5 w-5" /><p className="mt-5 text-3xl font-bold">{formatNumber(item.value)}</p><p className="mt-1 text-[10px] font-semibold">{item.label}</p></article>;
            })}
          </div>
        )}
      </Section>

      <Section title="Monitoring Health Matrix" description="Executive comparison of visit context, evidence, review, readiness, and operational health.">
        {portfolio.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No monitoring health rows are available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3">Visit</th><th className="px-3 py-3">Programme</th><th className="px-3 py-3">Beneficiary</th><th className="px-3 py-3">Officer</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Review</th><th className="px-3 py-3">Readiness</th><th className="px-3 py-3">Health</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((item) => (
                  <tr key={item.visit.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-3 py-3 font-semibold text-slate-900">{canOpenVisit ? <Link href={`${ROUTE}/${item.visit.id}`} className="hover:text-emerald-700">{item.visit.title ?? "Field visit"}</Link> : item.visit.title ?? "Field visit"}</td>
                    <td className="px-3 py-3 text-slate-600">{item.visit.impact_programmes?.name ?? UNAVAILABLE}</td>
                    <td className="px-3 py-3 text-slate-600">{item.visit.msmes?.business_name ?? UNAVAILABLE}</td>
                    <td className="px-3 py-3 text-slate-600">{item.officerName}</td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1", statusTone(item.visit.status))}>{(item.visit.status ?? "pending").replaceAll("_", " ")}</span></td>
                    <td className="px-3 py-3 text-slate-600">{item.evidenceState}</td>
                    <td className="px-3 py-3 text-slate-600">{item.reviewState}</td>
                    <td className="px-3 py-3"><ProgressValue value={item.readiness} tone="bg-indigo-500" /></td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Review Backlog Centre" description="Attention queues derived directly from visit status, schedule, assignment, and linked evidence.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Pending reviews", value: pendingReviews, available: true, icon: Clock3, tone: "bg-blue-50 text-blue-700" },
            { label: "Missing evidence", value: missingEvidence.length, available: evidenceSource.available, icon: FileWarning, tone: "bg-rose-50 text-rose-700" },
            { label: "Overdue visits", value: overdueVisits.length, available: true, icon: AlertTriangle, tone: "bg-amber-50 text-amber-700" },
            { label: "Incomplete visits", value: incompleteVisits, available: true, icon: CalendarCheck, tone: "bg-violet-50 text-violet-700" },
            { label: "Monitoring blockers", value: openMonitoringRisks, available: evidenceSource.available, icon: ShieldCheck, tone: "bg-slate-100 text-slate-700" },
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
        {portfolio.some((item) => item.attentionReasons.length > 0) && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {portfolio.filter((item) => item.attentionReasons.length > 0).slice(0, 6).map((item) => (
              <article key={item.visit.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", item.health === "At Risk" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")}><AlertTriangle className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{item.visit.title ?? "Field visit"}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{item.attentionReasons.slice(0, 2).join(" · ")}</p>
                    {canOpenVisit && <Link href={`${ROUTE}/${item.visit.id}`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">Open visit <ArrowRight className="h-3 w-3" /></Link>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="Activity Timeline" description="Latest timestamped visit and evidence activity available to the current role." action={<Activity className="h-4 w-4 text-slate-400" />}>
        {recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No recent monitoring activity is available.</p>
        ) : (
          <div className="relative grid gap-4 md:grid-cols-4 xl:grid-cols-8">
            <div className="absolute left-[6%] right-[6%] top-5 hidden border-t border-dashed border-slate-300 xl:block" aria-hidden="true" />
            {recentActivity.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={`${item.type}-${item.href}-${item.createdAt}`} href={item.href} className="relative rounded-xl border border-slate-200 bg-white p-3 hover:border-emerald-200 hover:bg-emerald-50/30">
                  <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-4 ring-white"><Icon className="h-4 w-4" /></span>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">{item.type}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-[10px] text-slate-500">{formatFreshness(item.createdAt)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Executive Monitoring Summary" description="Portfolio health based only on loaded visit, beneficiary, evidence, and review sources.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Monitoring Health", value: monitoringCoverage, health: monitoringHealth, icon: CalendarCheck, tone: "bg-blue-50 text-blue-700" },
            { label: "Coverage Health", value: beneficiaryCoverage, health: coverageHealth, icon: Route, tone: "bg-cyan-50 text-cyan-700" },
            { label: "Evidence Health", value: evidenceSource.available ? ratio(visitsWithVerifiedEvidence ?? 0, visits.length) : null, health: evidenceHealth, icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-700" },
            { label: "Assurance Health", value: ratio(reviewed, visits.length), health: assuranceHealth, icon: BadgeCheck, tone: "bg-violet-50 text-violet-700" },
            { label: "Reporting Readiness", value: monitoringReadiness, health: summaryHealth(monitoringReadiness), icon: FileCheck2, tone: "bg-indigo-50 text-indigo-700" },
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
                <div className="mt-4"><ProgressValue value={item.value} tone={item.label === "Evidence Health" ? "bg-emerald-500" : item.label === "Assurance Health" ? "bg-violet-500" : "bg-blue-500"} /></div>
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

      {canSchedule && (
        <Section
          id="schedule-visit"
          title="Schedule Cohort-Anchored Field Visit"
          description="Create a monitoring task within the existing programme, cohort, beneficiary, intervention, assessment, and field-officer scope."
        >
          {!programmesSource.available || !createCohortsSource.available || !createMembersSource.available || !createInterventionsSource.available || !createAssessmentsSource.available || !officersSource.available ? (
            <EmptyState title="Visit scheduling options unavailable" description="One or more required creation sources could not load. No partial field visit will be created." icon={Plus} />
          ) : (
            <CreateFieldVisitForm
              key={`${createProgrammeId}:${createCohortId}`}
              programmes={programmesSource.data}
              cohorts={createCohortsSource.data}
              cohortMembers={createMembersSource.data}
              interventions={createInterventions}
              assessments={createAssessments}
              fieldOfficers={officersSource.data}
              selectedProgrammeId={createProgrammeId}
              selectedCohortId={createCohortId}
              selectedCohortMemberId={selectedMemberId}
              selectedInterventionId={selectedInterventionId}
              defaultChecklist={DEFAULT_CHECKLIST}
              action={createVisitAction}
            />
          )}
        </Section>
      )}

      <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] text-slate-500">
        <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
        <span>Metrics use only records available within the current role, programme assignment, and delegated field scope.</span>
        <span className="text-slate-300">•</span>
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <span>Missing sources remain unavailable. Review overdue is not inferred without an SLA.</span>
      </div>
    </section>
  );
}
