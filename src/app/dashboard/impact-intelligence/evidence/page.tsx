import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileArchive,
  FileCheck2,
  FileClock,
  FileQuestion,
  FileWarning,
  Filter,
  Gauge,
  Layers3,
  Link2,
  Network,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  Upload,
  XCircle,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserContext } from "@/lib/auth/authorization";
import {
  getProgrammeScopeEmptyMessage,
} from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import {
  type ImpactEvidenceRecord,
  type ImpactEvidenceUploadOptions,
  getImpactEvidenceUploadOptions,
  listImpactEvidence,
  logImpactEvidenceDiagnostic,
  uploadImpactEvidence,
} from "@/lib/data/impact-evidence";
import {
  listFieldVisits,
  listImpactAssessments,
  listImpactCohorts,
  listImpactInterventions,
  listImpactProgrammes,
  listImpactReports,
  type ImpactFieldVisit,
} from "@/lib/data/impact-intelligence";
import {
  listIndicatorMeasurements,
  type ImpactIndicatorMeasurement,
} from "@/lib/data/impact-indicators";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";
import { CreateEvidenceForm } from "./create-evidence-form";

const ROUTE = "/dashboard/impact-intelligence/evidence";
const UNAVAILABLE = "Unavailable";

type SearchParams = {
  programme_id?: string;
  cohort_id?: string;
  intervention_id?: string;
  assessment_id?: string;
  field_visit_id?: string;
  status?: string;
  create_programme_id?: string;
  create_cohort_id?: string;
  error?: string;
  success?: string;
};

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";
type ReportWithLatestVersion = Awaited<ReturnType<typeof listImpactReports>>[number] & {
  latest_version?: {
    evidence_ids?: string[] | null;
    generated_at?: string | null;
  } | null;
};

type EvidencePortfolioItem = {
  evidence: ImpactEvidenceRecord;
  legacy: boolean;
  verified: boolean;
  indicatorReady: boolean | null;
  reportReady: boolean | null;
  health: HealthState;
  attentionReasons: string[];
};

const EMPTY_UPLOAD_OPTIONS: ImpactEvidenceUploadOptions = {
  programmes: [],
  cohorts: [],
  members: [],
  interventions: [],
  assessments: [],
  visits: [],
};

const EXPECTED_UPLOAD_ERRORS = [
  "Select a programme",
  "Select a beneficiary cohort",
  "Select a cohort beneficiary",
  "Selected evidence",
  "Choose an evidence file",
  "Evidence file must be",
  "Evidence must be",
  "already uploaded",
  "assigned visits or beneficiaries",
  "permission to upload",
  "storage is unavailable",
  "upload failed",
  "could not be saved",
  "could not be checked",
  "could not be validated",
  "links could not be saved",
];

function isExpectedUploadError(error: unknown) {
  return error instanceof Error && EXPECTED_UPLOAD_ERRORS.some((message) => error.message.includes(message));
}

async function uploadEvidenceAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    const evidenceId = await uploadImpactEvidence(ctx, formData);
    redirect(`${ROUTE}/${evidenceId}?success=Evidence%20uploaded`);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedUploadError(error)) throw error;
    const params = new URLSearchParams();
    const programmeId = formData.get("programme_id");
    const cohortId = formData.get("cohort_id");
    if (typeof programmeId === "string" && programmeId) params.set("create_programme_id", programmeId);
    if (typeof cohortId === "string" && cohortId) params.set("create_cohort_id", cohortId);
    params.set("error", error instanceof Error ? error.message : "Evidence upload could not be completed.");
    redirect(`${ROUTE}?${params}`);
  }
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

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string | null, role: string) {
  const source = name?.trim() || roleLabel(role);
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function displayName(item: ImpactEvidenceRecord) {
  return item.original_filename ?? item.file_name ?? "Evidence file";
}

function uploaderName(item: ImpactEvidenceRecord) {
  return item.uploaded_by?.full_name ?? item.uploaded_by?.email ?? UNAVAILABLE;
}

function isLegacy(item: ImpactEvidenceRecord) {
  return !item.storage_bucket || !item.storage_path || !item.original_filename;
}

function isVerified(item: ImpactEvidenceRecord) {
  return item.status === "verified" && item.verification_status === "verified";
}

function statusTone(status: string | null | undefined) {
  if (status === "verified") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "submitted") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "under_review") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (status === "returned") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "rejected") return "bg-rose-50 text-rose-700 ring-rose-200";
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

function reportEvidenceIds(report: ReportWithLatestVersion) {
  return Array.isArray(report.latest_version?.evidence_ids)
    ? report.latest_version.evidence_ids.filter((value): value is string => typeof value === "string")
    : [];
}

function deriveEvidenceHealth(input: {
  evidence: ImpactEvidenceRecord;
  indicatorsAvailable: boolean;
  reportsAvailable: boolean;
  indicatorReady: boolean;
  reportReady: boolean;
}) {
  if (isLegacy(input.evidence)) {
    return {
      health: "At Risk" as const,
      attentionReasons: ["Legacy placeholder has no confirmed private file"],
    };
  }

  const reasons: string[] = [];
  if (!input.evidence.checksum_sha256) reasons.push("Checksum unavailable");
  if (input.evidence.status === "submitted") reasons.push("Awaiting review");
  if (input.evidence.status === "under_review") reasons.push("Verification in progress");
  if (input.evidence.status === "returned") reasons.push("Returned for correction");
  if (input.evidence.status === "rejected") reasons.push("Evidence rejected");
  if (!input.evidence.programme_id || !input.evidence.cohort_id) reasons.push("Programme or cohort metadata missing");
  if (isVerified(input.evidence) && input.indicatorsAvailable && !input.indicatorReady) reasons.push("Not linked to an indicator");
  if (isVerified(input.evidence) && input.reportsAvailable && !input.reportReady) reasons.push("Not included in an approved report");

  if (input.evidence.status === "rejected" || input.evidence.status === "returned") {
    return { health: "At Risk" as const, attentionReasons: reasons };
  }
  if (isVerified(input.evidence) && input.evidence.checksum_sha256 && reasons.length === 0) {
    return { health: "Healthy" as const, attentionReasons: [] };
  }
  return { health: "Watchlist" as const, attentionReasons: reasons.length > 0 ? reasons : ["Evidence workflow is incomplete"] };
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
  icon: typeof FileArchive;
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

function CoverageBars({
  items,
  emptyText,
}: {
  items: Array<{ id: string; label: string; count: number; coverage: number | null; gap: boolean }>;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {items.slice(0, 7).map((item) => (
        <div key={item.id} className={cn("rounded-xl border p-3", item.gap ? "border-amber-200 bg-amber-50/50" : "border-slate-100 bg-slate-50/60")}>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{item.label}</span>
            <span className={cn("shrink-0 rounded-full px-2 py-1 text-[9px] font-bold", item.gap ? "bg-amber-100 text-amber-700" : "bg-white text-slate-600")}>
              {item.count} evidence
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
              <div className={cn("h-full rounded-full", item.gap ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${item.coverage ?? 0}%` }} />
            </div>
            <span className="w-10 text-right text-[10px] font-bold text-slate-500">{formatPercent(item.coverage)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function EvidencePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const filters = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let evidenceSource = sourceFallback<ImpactEvidenceRecord[]>([]);
  let loadError: string | null = null;

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    evidenceSource = await loadSource(
      currentContext,
      "evidence_command_centre_records_load_failed",
      () => listImpactEvidence(currentContext, {
        limit: 5000,
        programmeId: filters.programme_id,
        cohortId: filters.cohort_id,
        interventionId: filters.intervention_id,
        assessmentId: filters.assessment_id,
        fieldVisitId: filters.field_visit_id,
      }),
      [],
    );
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Impact evidence is temporarily unavailable.";
    logImpactEvidenceDiagnostic({
      operation: "evidence_command_centre_context_load_failed",
      actorRole: ctx?.role ?? null,
      errorMessage: loadError,
      success: false,
    });
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "evidence_command_centre_context_load_failed", error });
  }

  if (!ctx || !evidenceSource.available) {
    return (
      <section className="space-y-6">
        <Section title="Evidence Repository Unavailable">
          <EmptyState
            title="Evidence assurance could not load"
            description={loadError ?? "The evidence source, current session, or role assignment is temporarily unavailable. No assurance metrics are being inferred."}
            icon={FileWarning}
          />
        </Section>
      </section>
    );
  }

  const unfilteredEvidence = evidenceSource.data;
  const evidence = filters.status
    ? unfilteredEvidence.filter((item) => item.status === filters.status)
    : unfilteredEvidence;
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const canCreate = canRole(ctx.role, "evidence", "create");
  const canReview = canRole(ctx.role, "evidence", "review")
    || canRole(ctx.role, "evidence", "verify")
    || canRole(ctx.role, "evidence", "return");
  const canReadIndicators = canRole(ctx.role, "indicator", "read");
  const canReadReports = canRole(ctx.role, "report", "read");
  const canExport = canRole(ctx.role, "export", "export")
    && canReadReports
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");

  const [
    programmesSource,
    cohortsSource,
    interventionsSource,
    assessmentsSource,
    visitsSource,
    indicatorsSource,
    reportsSource,
    uploadOptionsSource,
  ] = await Promise.all([
    loadSource(ctx, "evidence_command_centre_programmes_load_failed", () => listImpactProgrammes(ctx, { limit: 1000 }), []),
    loadSource(ctx, "evidence_command_centre_cohorts_load_failed", () => listImpactCohorts(ctx, { limit: 2000 }), []),
    loadSource(ctx, "evidence_command_centre_interventions_load_failed", () => listImpactInterventions(ctx, { limit: 3000 }), []),
    loadSource(ctx, "evidence_command_centre_assessments_load_failed", () => listImpactAssessments(ctx, { limit: 3000 }), []),
    loadSource(ctx, "evidence_command_centre_visits_load_failed", () => listFieldVisits(ctx, { limit: 3000 }), []),
    canReadIndicators
      ? loadSource(ctx, "evidence_command_centre_indicators_load_failed", () => listIndicatorMeasurements(ctx, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactIndicatorMeasurement[]>([])),
    canReadReports
      ? loadSource(ctx, "evidence_command_centre_reports_load_failed", () => listImpactReports(ctx, { limit: 3000 }), [])
      : Promise.resolve(sourceFallback<Awaited<ReturnType<typeof listImpactReports>>>([])),
    canCreate
      ? loadSource(ctx, "evidence_command_centre_upload_options_load_failed", () => getImpactEvidenceUploadOptions(ctx, {
        programmeId: filters.create_programme_id,
        cohortId: filters.create_cohort_id,
      }), EMPTY_UPLOAD_OPTIONS)
      : Promise.resolve(sourceFallback(EMPTY_UPLOAD_OPTIONS)),
  ]);

  const indicators = indicatorsSource.data.filter((item) => item.evidence_id && evidenceIds.has(item.evidence_id));
  const reports = reportsSource.data as ReportWithLatestVersion[];
  const approvedReportEvidenceIds = new Set(
    reports
      .filter((report) => report.status === "approved")
      .flatMap(reportEvidenceIds)
      .filter((id) => evidenceIds.has(id)),
  );
  const reportEvidenceIdsSet = new Set(
    reports.flatMap(reportEvidenceIds).filter((id) => evidenceIds.has(id)),
  );
  const indicatorEvidenceIds = new Set(indicators.map((item) => item.evidence_id).filter((id): id is string => Boolean(id)));

  const portfolio: EvidencePortfolioItem[] = evidence.map((item) => {
    const indicatorReady = indicatorsSource.available && canReadIndicators ? indicatorEvidenceIds.has(item.id) : false;
    const reportReady = reportsSource.available && canReadReports ? approvedReportEvidenceIds.has(item.id) : false;
    const health = deriveEvidenceHealth({
      evidence: item,
      indicatorsAvailable: indicatorsSource.available && canReadIndicators,
      reportsAvailable: reportsSource.available && canReadReports,
      indicatorReady,
      reportReady,
    });
    return {
      evidence: item,
      legacy: isLegacy(item),
      verified: isVerified(item),
      indicatorReady: indicatorsSource.available && canReadIndicators ? indicatorReady : null,
      reportReady: reportsSource.available && canReadReports ? reportReady : null,
      ...health,
    };
  });

  const verified = portfolio.filter((item) => item.verified).length;
  const submitted = evidence.filter((item) => item.status === "submitted").length;
  const underReview = evidence.filter((item) => item.status === "under_review").length;
  const returned = evidence.filter((item) => item.status === "returned").length;
  const rejected = evidence.filter((item) => item.status === "rejected").length;
  const uploaded = evidence.filter((item) => ["draft", "uploaded"].includes(item.status)).length;
  const legacy = portfolio.filter((item) => item.legacy).length;
  const checksumAvailable = evidence.filter((item) => Boolean(item.checksum_sha256)).length;
  const missingMetadata = evidence.filter((item) =>
    !item.programme_id || !item.cohort_id || !item.uploaded_by_user_id || !item.uploaded_at,
  ).length;
  const pendingVerification = submitted + underReview;
  const programmesCovered = new Set(evidence.map((item) => item.programme_id).filter(Boolean)).size;
  const linkedAssessments = new Set(evidence.map((item) => item.assessment_id).filter(Boolean)).size;
  const linkedVisits = new Set(evidence.map((item) => item.field_visit_id).filter(Boolean)).size;
  const reportReadyEvidence = reportsSource.available && canReadReports ? approvedReportEvidenceIds.size : null;
  const indicatorReadyEvidence = indicatorsSource.available && canReadIndicators ? indicatorEvidenceIds.size : null;
  const evidenceCoverage = programmesSource.available ? ratio(programmesCovered, programmesSource.data.length) : null;
  const evidenceReadiness = ratio(verified, evidence.length);
  const qualityReadiness = ratio(
    evidence.filter((item) => isVerified(item) && Boolean(item.checksum_sha256) && !isLegacy(item)).length,
    evidence.length,
  );
  const reportingReadiness = reportReadyEvidence === null ? null : ratio(reportReadyEvidence, evidence.length);
  const outcomeSupportReadiness = indicatorsSource.available && canReadIndicators
    ? ratio(indicatorEvidenceIds.size, evidence.length)
    : null;
  const verificationHealth = summaryHealth(evidenceReadiness);
  const evidenceHealth = summaryHealth(
    portfolio.filter((item) => item.health !== "Unavailable").length > 0
      ? ratio(portfolio.filter((item) => item.health === "Healthy").length, portfolio.filter((item) => item.health !== "Unavailable").length)
      : null,
  );
  const freshness = latestDate([
    ...evidence.map((item) => item.reviewed_at ?? item.submitted_at ?? item.uploaded_at ?? item.created_at),
    ...indicators.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...reports.map((item) => item.latest_version?.generated_at ?? item.approved_at ?? item.generated_at ?? item.created_at),
  ]);

  const pipeline = [
    { label: "Uploaded", value: uploaded, available: true, color: "bg-slate-500" },
    { label: "Submitted", value: submitted, available: true, color: "bg-blue-500" },
    { label: "Under Review", value: underReview, available: true, color: "bg-violet-500" },
    { label: "Verified", value: verified, available: true, color: "bg-emerald-500" },
    { label: "Indicator Ready", value: indicatorReadyEvidence ?? 0, available: indicatorReadyEvidence !== null, color: "bg-cyan-500" },
    { label: "Report Ready", value: reportReadyEvidence ?? 0, available: reportReadyEvidence !== null, color: "bg-indigo-500" },
  ];
  const availablePipeline = pipeline.filter((item) => item.available);
  const bottleneckValue = availablePipeline.length > 0 ? Math.min(...availablePipeline.map((item) => item.value)) : null;

  const programmeCoverage = programmesSource.data.map((programme) => {
    const rows = evidence.filter((item) => item.programme_id === programme.id);
    return {
      id: programme.id,
      label: programme.name,
      count: rows.length,
      coverage: ratio(rows.filter(isVerified).length, rows.length),
      gap: rows.length === 0,
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const cohortCoverage = cohortsSource.data.map((cohort) => {
    const rows = evidence.filter((item) => item.cohort_id === cohort.id);
    return {
      id: cohort.id,
      label: cohort.name,
      count: rows.length,
      coverage: ratio(rows.filter(isVerified).length, rows.length),
      gap: rows.length === 0,
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const interventionCoverage = interventionsSource.data.map((intervention) => {
    const rows = evidence.filter((item) => item.intervention_id === intervention.id);
    return {
      id: intervention.id,
      label: intervention.title,
      count: rows.length,
      coverage: ratio(rows.filter(isVerified).length, rows.length),
      gap: rows.length === 0,
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const visitCoverage = visitsSource.data.map((visit: ImpactFieldVisit) => {
    const rows = evidence.filter((item) => item.field_visit_id === visit.id);
    return {
      id: visit.id,
      label: visit.title ?? "Monitoring visit",
      count: rows.length,
      coverage: ratio(rows.filter(isVerified).length, rows.length),
      gap: rows.length === 0,
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const missingChecksums = portfolio.filter((item) => !item.evidence.checksum_sha256);
  const orphanEvidence = portfolio.filter((item) => !item.evidence.programme_id || !item.evidence.cohort_id);
  const reportBlockers = portfolio.filter((item) =>
    item.legacy
    || !item.verified
    || !item.evidence.checksum_sha256
    || (item.reportReady === false && item.verified),
  );
  const attentionEvidence = portfolio.filter((item) => ["Watchlist", "At Risk"].includes(item.health));
  const queue = portfolio.filter((item) => ["submitted", "under_review", "returned", "rejected"].includes(item.evidence.status));
  const programmesWithoutEvidence = programmesSource.available ? programmeCoverage.filter((item) => item.gap) : [];
  const interventionsWithoutEvidence = interventionsSource.available ? interventionCoverage.filter((item) => item.gap) : [];

  const recentActivity = [
    ...evidence
      .filter((item) => item.uploaded_at ?? item.created_at)
      .map((item) => ({
        type: "Evidence uploaded",
        title: displayName(item),
        createdAt: item.uploaded_at ?? item.created_at,
        href: `${ROUTE}/${item.id}`,
        icon: Upload,
      })),
    ...evidence
      .filter((item) => item.submitted_at)
      .map((item) => ({
        type: "Evidence submitted",
        title: displayName(item),
        createdAt: item.submitted_at,
        href: `${ROUTE}/${item.id}`,
        icon: FileClock,
      })),
    ...evidence
      .filter((item) => item.reviewed_at)
      .map((item) => ({
        type: item.status === "verified" ? "Evidence verified" : item.status === "rejected" ? "Evidence rejected" : "Evidence reviewed",
        title: displayName(item),
        createdAt: item.reviewed_at,
        href: `${ROUTE}/${item.id}`,
        icon: item.status === "verified" ? ShieldCheck : item.status === "rejected" ? XCircle : ClipboardCheck,
      })),
    ...evidence
      .filter((item) => item.returned_at)
      .map((item) => ({
        type: "Evidence returned",
        title: displayName(item),
        createdAt: item.returned_at,
        href: `${ROUTE}/${item.id}`,
        icon: RotateCcw,
      })),
    ...reports
      .filter((report) => reportEvidenceIds(report).some((id) => evidenceIds.has(id)) && (report.latest_version?.generated_at ?? report.generated_at ?? report.created_at))
      .map((report) => ({
        type: "Evidence linked to report",
        title: report.title,
        createdAt: report.latest_version?.generated_at ?? report.generated_at ?? report.created_at,
        href: `/dashboard/impact-intelligence/reports/${report.id}`,
        icon: Link2,
      })),
  ]
    .filter((item) => item.createdAt && canAccessRoute(ctx.role, item.href))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 8);

  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Evidence</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Evidence Repository & Verification Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Executive assurance across evidence coverage, verification workflow, outcome support, quality controls, and reporting readiness.
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
                <p className="text-[11px] font-semibold text-slate-700">{formatDateTime(freshness)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <Link href="#upload-evidence" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#132d60]">
                  <Plus className="h-4 w-4" /> Upload Evidence
                </Link>
              )}
              {canReview && (
                <Link href="#verification-queue" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <ClipboardCheck className="h-4 w-4" /> Review Queue
                </Link>
              )}
              <details className="relative">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <form method="get" className="absolute right-0 z-30 mt-2 grid w-[min(92vw,620px)] gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:grid-cols-2">
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
                  <select name="assessment_id" defaultValue={filters.assessment_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All assessments</option>
                    {assessmentsSource.data.map((item) => <option key={item.id} value={item.id}>{item.title ?? item.assessment_type ?? "Assessment"}</option>)}
                  </select>
                  <select name="field_visit_id" defaultValue={filters.field_visit_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All monitoring visits</option>
                    {visitsSource.data.map((item) => <option key={item.id} value={item.id}>{item.title ?? "Monitoring visit"}</option>)}
                  </select>
                  <select name="status" defaultValue={filters.status ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <option value="">All statuses</option>
                    {["uploaded", "submitted", "under_review", "verified", "returned", "rejected", "archived"].map((status) => (
                      <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="submit" className="h-9 rounded-lg bg-[#0c1f46] px-4 text-xs font-bold text-white">Apply filters</button>
                    <Link href={ROUTE} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700">Clear</Link>
                  </div>
                </form>
              </details>
              {canExport && (
                <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Download className="h-4 w-4" /> Export Evidence Register
                </Link>
              )}
              <span title={`${ctx.fullName ?? roleLabel(ctx.role)} · ${roleLabel(ctx.role)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initials(ctx.fullName, ctx.role)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {filters.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{filters.error}</div>
      )}
      {filters.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{filters.success}</div>
      )}

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_30%,rgba(16,185,129,0.3),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="evidence-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#6ee7b7" /></pattern></defs>
            <path d="M510 32 615 18l82 39 67 3 55 63-47 48 8 58-94 16-70-35-75 16-53-62 25-59Z" fill="url(#evidence-hero-dots)" stroke="#34d399" strokeOpacity=".45" />
            <path d="M450 234c80-54 119-118 185-84s96 5 156-73" fill="none" stroke="#34d399" strokeOpacity=".55" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Evidence assurance overview</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">A governed trust layer for verified outcomes and institutional reporting</h2>
              <p className="mt-2 text-sm text-blue-100/80">Scoped evidence records. Existing relationships only. No inferred source values.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total evidence records", value: formatNumber(evidence.length), icon: FileArchive, color: "text-cyan-300" },
              { label: "Verified evidence", value: formatNumber(verified), icon: ShieldCheck, color: "text-emerald-300" },
              { label: "Pending verification", value: formatNumber(pendingVerification), icon: FileClock, color: "text-amber-300" },
              { label: "Evidence coverage", value: formatPercent(evidenceCoverage), icon: Network, color: "text-violet-300" },
              { label: "Evidence readiness", value: formatPercent(evidenceReadiness), icon: Gauge, color: "text-blue-300" },
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
        <MetricCard label="Total Evidence" value={formatNumber(evidence.length)} icon={FileArchive} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Verified" value={formatNumber(verified)} icon={BadgeCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Submitted" value={formatNumber(submitted)} icon={FileClock} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Returned" value={formatNumber(returned)} icon={RotateCcw} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Rejected" value={formatNumber(rejected)} icon={XCircle} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="Programmes Covered" value={formatNumber(programmesCovered)} icon={Layers3} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Linked Assessments" value={formatNumber(linkedAssessments)} icon={ClipboardCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Linked Visits" value={formatNumber(linkedVisits)} icon={Eye} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Report Ready" value={formatNumber(reportReadyEvidence)} icon={FileCheck2} tone="bg-teal-100 text-teal-700" />
      </div>

      <Section
        title="Evidence Verification Pipeline"
        description="Workflow progression from upload through indicator and approved-report use. The lowest available stage is highlighted as the current bottleneck."
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {pipeline.map((item, index) => (
            <article
              key={item.label}
              className={cn(
                "relative rounded-2xl border p-4",
                item.available && item.value === bottleneckValue
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-slate-50/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", item.available ? item.color : "bg-slate-300")} />
                {index < pipeline.length - 1 && <ArrowRight className="hidden h-3.5 w-3.5 text-slate-300 xl:block" />}
              </div>
              <p className="mt-5 text-2xl font-bold tracking-tight text-[#0c1733]">{item.available ? formatNumber(item.value) : UNAVAILABLE}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
              {item.available && item.value === bottleneckValue && <p className="mt-2 text-[9px] font-bold uppercase text-amber-700">Bottleneck</p>}
            </article>
          ))}
        </div>
      </Section>

      <Section
        title="Evidence Repository"
        description="Scoped evidence records with verification, relationship, quality, and readiness context."
        action={<span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{evidence.length} records</span>}
      >
        {portfolio.length === 0 ? (
          <EmptyState
            title="No evidence records available"
            description={scopeEmptyMessage ?? (canCreate ? "Use the governed upload workflow to add evidence in your assigned scope." : "Evidence in your assigned scope will appear here.")}
            icon={FileArchive}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {portfolio.map((item) => (
              <Link
                key={item.evidence.id}
                href={`${ROUTE}/${item.evidence.id}`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  item.verified
                    ? "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
                    : item.legacy
                      ? "border-amber-300 bg-amber-50/60"
                      : "border-slate-200 bg-white",
                )}
              >
                {item.verified && <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />}
                {item.legacy && <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />}
                <div className="flex items-start justify-between gap-3">
                  <span className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                    item.verified ? "bg-emerald-100 text-emerald-700" : item.legacy ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600",
                  )}>
                    {item.verified ? <ShieldCheck className="h-5 w-5" /> : item.legacy ? <FileQuestion className="h-5 w-5" /> : <FileArchive className="h-5 w-5" />}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold capitalize ring-1", statusTone(item.evidence.status))}>
                      {item.evidence.status.replaceAll("_", " ")}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                  </div>
                </div>
                <h3 className="mt-4 break-words text-sm font-bold text-[#0c1733] group-hover:text-emerald-800">{displayName(item.evidence)}</h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{item.evidence.description ?? "Evidence context note unavailable."}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Programme</p><p className="mt-1 truncate font-semibold text-slate-700">{item.evidence.impact_programmes?.name ?? UNAVAILABLE}</p></div>
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Cohort</p><p className="mt-1 truncate font-semibold text-slate-700">{item.evidence.impact_beneficiary_cohorts?.name ?? UNAVAILABLE}</p></div>
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Intervention</p><p className="mt-1 truncate font-semibold text-slate-700">{item.evidence.impact_interventions?.title ?? UNAVAILABLE}</p></div>
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Assessment</p><p className="mt-1 truncate font-semibold text-slate-700">{item.evidence.impact_assessments?.title ?? item.evidence.impact_assessments?.assessment_type ?? UNAVAILABLE}</p></div>
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Monitoring visit</p><p className="mt-1 truncate font-semibold text-slate-700">{item.evidence.impact_field_visits?.title ?? UNAVAILABLE}</p></div>
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Uploader</p><p className="mt-1 truncate font-semibold text-slate-700">{uploaderName(item.evidence)}</p></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.08em] text-slate-400">Uploaded</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-600">{formatDate(item.evidence.uploaded_at ?? item.evidence.created_at)}</p>
                  </div>
                  {item.legacy ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold text-amber-800">Legacy Placeholder</span>
                  ) : item.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[9px] font-bold text-white"><BadgeCheck className="h-3 w-3" /> Verified Evidence</span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500">{item.evidence.verification_status.replaceAll("_", " ")}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Evidence Coverage Zone" description="Verified evidence density and real gaps across the scoped operating model.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700">Programme coverage</h3><span className="text-[10px] font-semibold text-amber-700">{programmesWithoutEvidence.length} gaps</span></div>
              <CoverageBars items={programmeCoverage} emptyText="Programme coverage is unavailable." />
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700">Cohort coverage</h3><span className="text-[10px] font-semibold text-slate-500">{cohortCoverage.filter((item) => item.gap).length} gaps</span></div>
              <CoverageBars items={cohortCoverage} emptyText="Cohort coverage is unavailable." />
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700">Intervention coverage</h3><span className="text-[10px] font-semibold text-rose-700">{interventionsWithoutEvidence.length} gaps</span></div>
              <CoverageBars items={interventionCoverage} emptyText="Intervention coverage is unavailable." />
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700">Monitoring coverage</h3><span className="text-[10px] font-semibold text-slate-500">{visitCoverage.filter((item) => item.gap).length} gaps</span></div>
              <CoverageBars items={visitCoverage} emptyText="Monitoring coverage is unavailable." />
            </div>
          </div>
        </Section>

        <Section title="Evidence Quality Centre" description="File integrity, metadata completeness, legacy exposure, and verification quality.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Checksum available", value: checksumAvailable, icon: ShieldCheck, tone: "text-emerald-700 bg-emerald-50" },
              { label: "Verified files", value: verified, icon: BadgeCheck, tone: "text-blue-700 bg-blue-50" },
              { label: "Legacy placeholders", value: legacy, icon: FileQuestion, tone: "text-amber-700 bg-amber-50" },
              { label: "Missing metadata", value: missingMetadata, icon: FileWarning, tone: "text-rose-700 bg-rose-50" },
              { label: "Quality readiness", value: formatPercent(qualityReadiness), icon: Gauge, tone: "text-violet-700 bg-violet-50" },
              { label: "Storage paths", value: "Protected", icon: ShieldAlert, tone: "text-slate-700 bg-slate-100" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span>
                  <p className="mt-4 text-xl font-bold text-[#0c1733]">{typeof item.value === "number" ? formatNumber(item.value) : item.value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p>
                </article>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Section
          id="verification-queue"
          title="Verification Command Centre"
          description="Operational queue for evidence awaiting review, correction, or disposition."
          action={<span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-700">{queue.length} in queue</span>}
        >
          {queue.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">No submitted, under-review, returned, or rejected evidence is currently in the scoped queue.</p>
          ) : (
            <div className="space-y-2">
              {queue.slice(0, 8).map((item) => (
                <Link key={item.evidence.id} href={`${ROUTE}/${item.evidence.id}`} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", item.evidence.status === "rejected" ? "bg-rose-100 text-rose-700" : item.evidence.status === "returned" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>
                    {item.evidence.status === "rejected" ? <XCircle className="h-4 w-4" /> : item.evidence.status === "returned" ? <RotateCcw className="h-4 w-4" /> : <FileClock className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">{displayName(item.evidence)}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{item.evidence.impact_programmes?.name ?? UNAVAILABLE} · {formatDate(item.evidence.submitted_at ?? item.evidence.returned_at ?? item.evidence.reviewed_at)}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold capitalize ring-1", statusTone(item.evidence.status))}>{item.evidence.status.replaceAll("_", " ")}</span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Outcome Support Centre" description="Existing evidence relationships supporting assessments, indicators, and approved reports.">
          <div className="space-y-4">
            {[
              { label: "Evidence linked to assessments", value: linkedAssessments, readiness: ratio(evidence.filter((item) => item.assessment_id).length, evidence.length), icon: ClipboardCheck, tone: "bg-cyan-500" },
              { label: "Evidence linked to indicators", value: indicatorReadyEvidence, readiness: outcomeSupportReadiness, icon: Target, tone: "bg-amber-500" },
              { label: "Evidence linked to reports", value: reportsSource.available && canReadReports ? reportEvidenceIdsSet.size : null, readiness: reportingReadiness, icon: FileCheck2, tone: "bg-indigo-500" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("grid h-9 w-9 place-items-center rounded-xl text-white", item.tone)}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-700">{item.label}</p>
                        <span className="text-sm font-bold text-[#0c1733]">{formatNumber(item.value)}</span>
                      </div>
                      <div className="mt-2"><ProgressValue value={item.readiness} tone={item.tone} /></div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Section>
      </div>

      <Section title="Evidence Health Matrix" description="Executive scanning view across workflow, integrity, verification, and report readiness.">
        {portfolio.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">No evidence is available for the current scope and filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1120px] text-left text-xs">
              <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  {["File", "Programme", "Visit", "Assessment", "Status", "Checksum", "Verification", "Report Ready", "Health"].map((heading) => (
                    <th key={heading} className="px-4 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.map((item) => (
                  <tr key={item.evidence.id} className={cn("border-t border-slate-100", item.verified && "bg-emerald-50/30", item.legacy && "bg-amber-50/40")}>
                    <td className="max-w-[240px] px-4 py-3">
                      <Link href={`${ROUTE}/${item.evidence.id}`} className="block truncate font-bold text-slate-800 hover:text-emerald-700">{displayName(item.evidence)}</Link>
                      {item.legacy && <span className="mt-1 inline-block text-[9px] font-bold text-amber-700">Legacy Placeholder</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.evidence.impact_programmes?.name ?? UNAVAILABLE}</td>
                    <td className="px-4 py-3 text-slate-600">{item.evidence.impact_field_visits?.title ?? UNAVAILABLE}</td>
                    <td className="px-4 py-3 text-slate-600">{item.evidence.impact_assessments?.title ?? item.evidence.impact_assessments?.assessment_type ?? UNAVAILABLE}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold capitalize ring-1", statusTone(item.evidence.status))}>{item.evidence.status.replaceAll("_", " ")}</span></td>
                    <td className="px-4 py-3">{item.evidence.checksum_sha256 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-slate-400">{UNAVAILABLE}</span>}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.evidence.verification_status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">{item.reportReady === null ? UNAVAILABLE : item.reportReady ? <BadgeCheck className="h-4 w-4 text-indigo-600" /> : "No"}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Section title="Risk & Exceptions Centre" description="Only observed evidence conditions are shown; unavailable source conditions are not converted into risks.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Missing checksums", value: missingChecksums.length, icon: ShieldAlert, tone: "bg-amber-100 text-amber-700" },
              { label: "Pending reviews", value: pendingVerification, icon: Clock3, tone: "bg-blue-100 text-blue-700" },
              { label: "Rejected files", value: rejected, icon: XCircle, tone: "bg-rose-100 text-rose-700" },
              { label: "Orphan evidence", value: orphanEvidence.length, icon: Link2, tone: "bg-violet-100 text-violet-700" },
              { label: "Report blockers", value: reportBlockers.length, icon: FileWarning, tone: "bg-orange-100 text-orange-700" },
              { label: "Needing attention", value: attentionEvidence.length, icon: AlertTriangle, tone: "bg-slate-200 text-slate-700" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span>
                  <p className="mt-4 text-xl font-bold text-[#0c1733]">{formatNumber(item.value)}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p>
                </article>
              );
            })}
          </div>
        </Section>

        <Section title="Activity Timeline" description="Recorded evidence and report timestamps only.">
          {recentActivity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">No dated evidence activity is available.</p>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link key={`${item.type}-${item.href}-${item.createdAt}-${index}`} href={item.href} className="group flex gap-3 rounded-xl p-2.5 hover:bg-slate-50">
                    <div className="flex flex-col items-center">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Icon className="h-3.5 w-3.5" /></span>
                      {index < recentActivity.length - 1 && <span className="mt-1 h-full w-px bg-slate-200" />}
                    </div>
                    <div className="min-w-0 pb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-emerald-700">{item.type}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-700 group-hover:text-emerald-800">{item.title}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(item.createdAt)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <Section title="Executive Evidence Summary" description="Consolidated assurance health based on currently available scoped evidence relationships.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Evidence Health", value: evidenceHealth, metric: ratio(portfolio.filter((item) => item.health === "Healthy").length, portfolio.length), icon: Activity },
            { label: "Verification Health", value: verificationHealth, metric: evidenceReadiness, icon: ShieldCheck },
            { label: "Outcome Support Health", value: summaryHealth(outcomeSupportReadiness), metric: outcomeSupportReadiness, icon: BarChart3 },
            { label: "Reporting Readiness", value: summaryHealth(reportingReadiness), metric: reportingReadiness, icon: FileCheck2 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0c1f46] text-white"><Icon className="h-4 w-4" /></span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.value))}>{item.value}</span>
                </div>
                <p className="mt-5 text-xs font-bold text-[#0c1733]">{item.label}</p>
                <div className="mt-3"><ProgressValue value={item.metric} /></div>
              </article>
            );
          })}
        </div>
      </Section>

      {canCreate && (
        <Section
          id="upload-evidence"
          title="Upload Evidence"
          description="Upload remains constrained to existing programme, cohort, beneficiary, intervention, assessment, and visit relationships."
        >
          {uploadOptionsSource.available ? (
            <CreateEvidenceForm
              key={`${filters.create_programme_id ?? ""}:${filters.create_cohort_id ?? ""}`}
              options={uploadOptionsSource.data}
              selectedProgrammeId={filters.create_programme_id ?? ""}
              selectedCohortId={filters.create_cohort_id ?? ""}
              action={uploadEvidenceAction}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">Upload options are temporarily unavailable. Existing evidence remains visible.</p>
          )}
        </Section>
      )}
    </section>
  );
}
