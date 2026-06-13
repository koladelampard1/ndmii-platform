import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileQuestion,
  FileText,
  FileWarning,
  Gauge,
  History,
  Link2,
  Network,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  Upload,
  UserRound,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserContext } from "@/lib/auth/authorization";
import { isImpactProgrammeReadDenied } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import {
  type ImpactEvidenceEvent,
  type ImpactEvidenceRecord,
  getImpactEvidence,
  logImpactEvidenceDiagnostic,
  transitionImpactEvidence,
} from "@/lib/data/impact-evidence";
import { getImpactAssessmentDetail } from "@/lib/data/impact-intelligence";
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

const ROUTE = "/dashboard/impact-intelligence/evidence/[evidenceId]";
const UNAVAILABLE = "Unavailable";

type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";
type LinkedReport = InstitutionalReport & { exportCount: number | null };

const EXPECTED_ACTION_ERRORS = [
  "permission to",
  "Only uploaded or returned",
  "Only submitted",
  "must be under review",
  "valid evidence review decision",
  "review note is required",
  "requires a stored file",
  "stored evidence file could not be confirmed",
  "assigned visits or beneficiaries",
  "status changed",
  "record was not found",
  "already archived",
];

function isExpectedActionError(error: unknown) {
  return error instanceof Error && EXPECTED_ACTION_ERRORS.some((message) => error.message.includes(message));
}

async function evidenceTransitionAction(evidenceId: string, action: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await transitionImpactEvidence(ctx, evidenceId, action, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    const params = new URLSearchParams({
      error: error instanceof Error ? error.message : "Evidence action could not be completed.",
    });
    redirect(`/dashboard/impact-intelligence/evidence/${evidenceId}?${params}`);
  }
  redirect(`/dashboard/impact-intelligence/evidence/${evidenceId}?success=Evidence%20status%20updated`);
}

function sourceFallback<T>(data: T): SourceState<T> {
  return { data, available: false };
}

async function loadSource<T>(
  ctx: UserContext,
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

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number") return UNAVAILABLE;
  if (value < 1024) return `${value} bytes`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatPercent(value: number | null) {
  return value === null ? UNAVAILABLE : `${value}%`;
}

function humanize(value: string | null | undefined) {
  return value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : UNAVAILABLE;
}

function displayName(evidence: ImpactEvidenceRecord) {
  return evidence.original_filename ?? evidence.file_name ?? "Evidence file";
}

function personName(person: ImpactEvidenceRecord["uploaded_by"] | ImpactEvidenceRecord["reviewed_by"]) {
  return person?.full_name ?? person?.email ?? UNAVAILABLE;
}

function isLegacy(evidence: ImpactEvidenceRecord) {
  return !evidence.storage_bucket || !evidence.storage_path || !evidence.original_filename;
}

function isVerified(evidence: ImpactEvidenceRecord) {
  return evidence.status === "verified" && evidence.verification_status === "verified";
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function toneForStatus(value: string | null | undefined) {
  return impactStatusTone(value);
}

function StatusPill({ value, dark = false }: { value: string | null | undefined; dark?: boolean }) {
  if (dark) {
    return (
      <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-blue-100">
        {humanize(value)}
      </span>
    );
  }
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

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight text-[#0c1733]">{value}</p>
          <p className="truncate text-[10px] font-semibold text-slate-500">{label}</p>
        </div>
      </div>
    </article>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <Icon className="h-4 w-4 text-blue-600" />
      <dt className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-xs font-semibold leading-5 text-slate-800">{value}</dd>
    </div>
  );
}

function eventActor(event: ImpactEvidenceEvent | undefined) {
  if (!event) return UNAVAILABLE;
  const role = humanize(event.actor_role);
  const id = event.actor_user_id ? ` · ${event.actor_user_id.slice(0, 8)}…` : "";
  return `${role}${id}`;
}

function reportEvidenceIds(report: InstitutionalReport) {
  return Array.isArray(report.latest_version?.evidence_ids)
    ? report.latest_version.evidence_ids.filter((value): value is string => typeof value === "string")
    : [];
}

export default async function EvidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ evidenceId: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const { evidenceId } = await params;
  const query = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let evidence: ImpactEvidenceRecord | null = null;
  let events: ImpactEvidenceEvent[] = [];
  let loadError: string | null = null;
  let accessDenied = false;

  try {
    ctx = await getCurrentUserContext();
    const detail = await getImpactEvidence(ctx, evidenceId);
    evidence = detail.evidence;
    events = detail.events;
  } catch (error) {
    unstable_rethrow(error);
    accessDenied = isImpactProgrammeReadDenied(error);
    loadError = error instanceof Error ? error.message : "Evidence detail is temporarily unavailable.";
    logImpactEvidenceDiagnostic({
      operation: "evidence_detail_load_failed",
      evidenceId,
      actorRole: ctx?.role ?? null,
      errorMessage: loadError,
      success: false,
    });
  }

  if (loadError || !evidence || !ctx) {
    return (
      <section className="space-y-6">
        <Section title="Evidence Unavailable">
          <EmptyState
            title={loadError ? "Evidence detail could not load" : "Evidence record was not found"}
            description={accessDenied
              ? loadError ?? "You are not assigned to this programme."
              : loadError?.includes("assigned") || loadError?.includes("permission")
                ? "This record is outside your assigned evidence scope."
                : "The evidence record is missing or its source is temporarily unavailable."}
            icon={FileWarning}
          />
        </Section>
      </section>
    );
  }

  const canReadAssessment = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/assessments");
  const canReadMonitoring = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/monitoring");
  const canReadIntervention = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/interventions");
  const canReadIndicators = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/indicators");
  const canReadReports = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");

  const [assessmentSource, indicatorsSource, reportsSource] = await Promise.all([
    evidence.assessment_id && canReadAssessment
      ? loadSource(ctx, "evidence_linked_assessment_unavailable", async () => {
        const detail = await getImpactAssessmentDetail(evidence.assessment_id!, ctx);
        return detail.assessment;
      }, null)
      : Promise.resolve(sourceFallback<Awaited<ReturnType<typeof getImpactAssessmentDetail>>["assessment"]>(null)),
    canReadIndicators
      ? loadSource(ctx, "evidence_linked_indicators_unavailable", async () => {
        try {
          const measurements = await listIndicatorMeasurements(ctx, { limit: 5000 });
          return measurements.filter((item) => item.evidence_id === evidence.id);
        } catch (error) {
          logImpactIndicatorDiagnostic({
            operation: "evidence_linked_indicators_unavailable",
            role: ctx.role,
            authUserId: ctx.authUserId,
            appUserId: ctx.appUserId,
            errorMessage: error instanceof Error ? error.message : "Unknown indicator error",
            success: false,
          });
          throw error;
        }
      }, [] as ImpactIndicatorMeasurement[])
      : Promise.resolve(sourceFallback<ImpactIndicatorMeasurement[]>([])),
    canReadReports
      ? loadSource(ctx, "evidence_linked_reports_unavailable", async () => {
        try {
          const reports = await listInstitutionalReports(ctx, 1000);
          return reports.filter((report) => reportEvidenceIds(report).includes(evidence.id));
        } catch (error) {
          logImpactReportDiagnostic({
            operation: "evidence_linked_reports_unavailable",
            role: ctx.role,
            appUserId: ctx.appUserId,
            errorMessage: error instanceof Error ? error.message : "Unknown report error",
            success: false,
          });
          throw error;
        }
      }, [] as InstitutionalReport[])
      : Promise.resolve(sourceFallback<InstitutionalReport[]>([])),
  ]);

  const linkedReports: LinkedReport[] = reportsSource.available
    ? await Promise.all(reportsSource.data.map(async (report) => {
      try {
        const detail = await getInstitutionalReport(ctx, report.id, { includeSources: true, enforceReadScope: false });
        return { ...report, exportCount: detail.exports?.length ?? (detail.exports === null ? null : 0) };
      } catch (error) {
        unstable_rethrow(error);
        logImpactReportDiagnostic({
          operation: "evidence_linked_report_exports_unavailable",
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

  const legacy = isLegacy(evidence);
  const verified = isVerified(evidence);
  const hasStoredFile = Boolean(evidence.storage_bucket && evidence.storage_path && evidence.original_filename);
  const metadataComplete = Boolean(
    evidence.original_filename
    && evidence.mime_type
    && typeof evidence.file_size_bytes === "number"
    && evidence.uploaded_at
    && evidence.uploaded_by_user_id
    && evidence.programme_id
    && evidence.cohort_id,
  );
  const checksumPresent = Boolean(evidence.checksum_sha256);
  const chainVerified = verified && checksumPresent && hasStoredFile;
  const linkedAssessment = assessmentSource.data;
  const linkedIndicators = indicatorsSource.data;
  const verifiedMeasurements = linkedIndicators.filter((item) => item.verification_status === "verified");
  const uniqueIndicatorIds = new Set(linkedIndicators.map((item) => item.indicator_definition_id));
  const approvedReports = linkedReports.filter((report) => report.status === "approved");
  const latestReport = [...linkedReports].sort((a, b) =>
    String(b.latest_version?.generated_at ?? b.generated_at ?? b.created_at)
      .localeCompare(String(a.latest_version?.generated_at ?? a.generated_at ?? a.created_at)),
  )[0] ?? null;
  const exportCount = linkedReports.some((report) => report.exportCount === null)
    ? null
    : linkedReports.reduce((sum, report) => sum + (report.exportCount ?? 0), 0);
  const assessmentLinked = Boolean(evidence.assessment_id);
  const indicatorReady = indicatorsSource.available && linkedIndicators.length > 0 && verifiedMeasurements.length === linkedIndicators.length;
  const reportReady = reportsSource.available && approvedReports.length > 0;
  const readiness = indicatorsSource.available && reportsSource.available
    ? ratio(
      [metadataComplete, chainVerified, assessmentLinked, indicatorReady, reportReady].filter(Boolean).length,
      5,
    )
    : null;

  const risks = [
    ...(!checksumPresent ? ["Checksum is missing."] : []),
    ...(!metadataComplete ? ["Required evidence metadata is incomplete."] : []),
    ...(["uploaded", "submitted", "under_review"].includes(evidence.status) ? ["Verification is pending."] : []),
    ...(!evidence.programme_id && !evidence.cohort_id && !evidence.intervention_id && !evidence.assessment_id && !evidence.field_visit_id
      ? ["Evidence is orphaned from programme delivery context."]
      : []),
    ...(legacy ? ["Legacy placeholder has no confirmed private storage object."] : []),
    ...(verified && indicatorsSource.available && linkedIndicators.length === 0 ? ["Verified evidence is not linked to an indicator measurement."] : []),
    ...(verified && reportsSource.available && linkedReports.length === 0 ? ["Verified evidence is not referenced by an institutional report."] : []),
    ...(linkedReports.length > approvedReports.length ? ["One or more dependent reports are not approved."] : []),
  ];

  const health: HealthState = !indicatorsSource.available || !reportsSource.available
    ? "Unavailable"
    : legacy || evidence.status === "rejected" || evidence.status === "returned"
      ? "At Risk"
      : verified && risks.length === 0
        ? "Healthy"
        : "Watchlist";

  const uploadedEvent = events.find((event) => event.event_type === "uploaded");
  const submittedEvent = events.find((event) => event.event_type === "submitted");
  const reviewEvent = events.find((event) => ["review_started", "under_review"].includes(event.event_type));
  const verifiedEvent = events.find((event) => event.event_type === "verified");
  const currentStatus = legacy ? "Legacy Placeholder" : evidence.status;
  const canSubmit = canRole(ctx.role, "evidence", "submit") && ["uploaded", "returned"].includes(evidence.status);
  const canStartReview = canRole(ctx.role, "evidence", "review") && evidence.status === "submitted";
  const canVerify = canRole(ctx.role, "evidence", "verify") && evidence.status === "under_review";
  const canReturn = canRole(ctx.role, "evidence", "return") && evidence.status === "under_review";
  const canReject = canRole(ctx.role, "evidence", "review") && evidence.status === "under_review";
  const canArchive = canRole(ctx.role, "evidence", "archive") && evidence.status !== "archived";
  const transition = (action: string) => evidenceTransitionAction.bind(null, evidence.id, action);

  const lifecycle = [
    { label: "Uploaded", complete: Boolean(evidence.uploaded_at ?? uploadedEvent ?? evidence.created_at) },
    { label: "Submitted", complete: Boolean(evidence.submitted_at ?? submittedEvent) || ["submitted", "under_review", "verified"].includes(evidence.status) },
    { label: "Under Review", complete: Boolean(reviewEvent) || ["under_review", "verified"].includes(evidence.status) },
    { label: "Verified", complete: verified },
    { label: "Indicator Ready", complete: indicatorReady },
    { label: "Report Ready", complete: reportReady },
  ];
  const currentLifecycleIndex = lifecycle.reduce((current, item, index) => item.complete ? index : current, 0);

  const activity = [
    ...events.map((event) => ({
      id: event.id,
      type: humanize(event.event_type),
      detail: event.note ?? `${humanize(event.from_status)} to ${humanize(event.to_status ?? event.from_status)}`,
      actor: eventActor(event),
      date: event.created_at,
      href: null as string | null,
      icon: event.event_type === "verified"
        ? BadgeCheck
        : event.event_type === "returned"
          ? RotateCcw
          : event.event_type === "rejected"
            ? XCircle
            : event.event_type === "uploaded"
              ? Upload
              : History,
    })),
    ...linkedReports.map((report) => ({
      id: `report-${report.id}`,
      type: "Linked To Report",
      detail: report.title,
      actor: humanize(report.status),
      date: report.latest_version?.generated_at ?? report.generated_at ?? report.created_at,
      href: canReadReports ? `/dashboard/impact-intelligence/reports/${report.id}` : null,
      icon: FileCheck2,
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <section className="space-y-5 pb-8">
      <header className="overflow-hidden rounded-2xl bg-[#071a3a] text-white shadow-xl shadow-blue-950/10">
        <div className="relative p-5 sm:p-7">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Evidence Verification & Chain-of-Custody War Room</p>
                <StatusPill value={currentStatus} dark />
                <StatusPill value={health} dark />
              </div>
              <h1 className="mt-4 max-w-4xl break-words text-2xl font-bold tracking-tight sm:text-3xl">{displayName(evidence)}</h1>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-blue-100/75">
                {humanize(evidence.evidence_category ?? evidence.evidence_type)} · {evidence.impact_programmes?.name ?? UNAVAILABLE} · {personName(evidence.uploaded_by)}
              </p>
              <div className="mt-5 grid gap-3 text-[10px] sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Cohort", evidence.impact_beneficiary_cohorts?.name ?? UNAVAILABLE],
                  ["Intervention", evidence.impact_interventions?.title ?? UNAVAILABLE],
                  ["Assessment", evidence.impact_assessments?.title ?? UNAVAILABLE],
                  ["Monitoring visit", evidence.impact_field_visits?.title ?? UNAVAILABLE],
                  ["Uploaded", formatDateTime(evidence.uploaded_at ?? evidence.created_at)],
                  ["Uploader", personName(evidence.uploaded_by)],
                  ["Evidence type", humanize(evidence.evidence_type)],
                  ["Verification", humanize(evidence.verification_status)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="uppercase tracking-[0.12em] text-blue-200/60">{label}</p>
                    <p className="mt-1 truncate font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  ["Metadata Complete", metadataComplete],
                  ["Chain Verified", chainVerified],
                  ["Assessment Linked", assessmentLinked],
                  ["Indicator Ready", indicatorReady],
                  ["Report Ready", reportReady],
                ].map(([label, ready]) => (
                  <span key={String(label)} className={cn(
                    "rounded-full border px-3 py-1 text-[9px] font-bold",
                    ready
                      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-blue-100/60",
                  )}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex max-w-xl flex-wrap gap-2 xl:justify-end">
              {canVerify && <Link href="#review-actions" className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-[10px] font-bold text-[#071a3a]"><ShieldCheck className="h-3.5 w-3.5" /> Verify</Link>}
              {canReturn && <Link href="#review-actions" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold text-white"><RotateCcw className="h-3.5 w-3.5" /> Return</Link>}
              {canReject && <Link href="#review-actions" className="inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-100"><XCircle className="h-3.5 w-3.5" /> Reject</Link>}
              {hasStoredFile && <a href={`/api/impact-intelligence/evidence/${evidence.id}?disposition=attachment`} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[10px] font-bold text-[#0b1e42]"><Download className="h-3.5 w-3.5" /> Download</a>}
              {evidence.field_visit_id && canReadMonitoring && <Link href={`/dashboard/impact-intelligence/monitoring/${evidence.field_visit_id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold text-white"><Eye className="h-3.5 w-3.5" /> View Related Visit</Link>}
            </div>
          </div>
        </div>
      </header>

      {query.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{query.error}</div>}
      {query.success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.success}</div>}

      {legacy && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <div className="flex gap-3">
            <FileQuestion className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-bold">Legacy Placeholder Evidence</p><p className="mt-1 leading-6">This record has no confirmed private storage object. It cannot be treated as verified, downloaded, or used as report-ready evidence.</p></div>
          </div>
        </div>
      )}
      {verified && !legacy && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm">
          <div className="flex gap-3">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-bold">Verified Evidence Trust Banner</p><p className="mt-1 leading-6">This evidence completed the recorded verification workflow. Checksum, custody, outcome, and reporting relationships remain visible below.</p></div>
          </div>
        </div>
      )}
      {evidence.status === "submitted" && (
        <div className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950 shadow-sm">
          <div className="flex gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-bold">Submitted Evidence</p><p className="mt-1 leading-6">This evidence is locked into the verification queue and is awaiting an authorised reviewer.</p></div>
          </div>
        </div>
      )}
      {evidence.status === "returned" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Returned Evidence</p>
          <p className="mt-1">{evidence.return_reason ?? evidence.review_note ?? UNAVAILABLE}</p>
        </div>
      )}
      {evidence.status === "rejected" && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950">
          <p className="font-bold">Rejected Evidence</p>
          <p className="mt-1">{evidence.review_note ?? UNAVAILABLE}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Verification Status" value={humanize(evidence.status)} icon={ShieldCheck} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Checksum Status" value={checksumPresent ? "Recorded" : UNAVAILABLE} icon={BadgeCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Linked Assessments" value={evidence.assessment_id ? "1" : "0"} icon={ClipboardCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Linked Visits" value={evidence.field_visit_id ? "1" : "0"} icon={Network} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Linked Indicators" value={indicatorsSource.available ? formatNumber(uniqueIndicatorIds.size) : UNAVAILABLE} icon={Target} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Linked Reports" value={reportsSource.available ? formatNumber(linkedReports.length) : UNAVAILABLE} icon={FileText} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Chain Integrity" value={chainVerified ? "Verified" : legacy ? "At Risk" : "Pending"} icon={Link2} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Readiness" value={formatPercent(readiness)} icon={Gauge} tone="bg-rose-100 text-rose-700" />
      </div>

      <Section title="Evidence Verification Lifecycle" description="Recorded progression from upload through outcome and institutional reporting readiness.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {lifecycle.map((item, index) => (
            <div key={item.label} className={cn(
              "relative rounded-xl border p-3",
              item.complete
                ? "border-blue-200 bg-blue-50/70"
                : index === currentLifecycleIndex + 1
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-slate-200 bg-slate-50",
            )}>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold",
                  item.complete ? "bg-blue-600 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200",
                )}>{index + 1}</span>
                <p className="text-[10px] font-bold text-slate-700">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Section title="Evidence Identity & Context" description="Available file, beneficiary, delivery, and submission metadata.">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="File name" value={displayName(evidence)} icon={FileText} />
            <DetailItem label="MIME type" value={evidence.mime_type ?? evidence.file_type ?? UNAVAILABLE} icon={FileCheck2} />
            <DetailItem label="File size" value={formatBytes(evidence.file_size_bytes)} icon={Gauge} />
            <DetailItem label="Upload date" value={formatDateTime(evidence.uploaded_at ?? evidence.created_at)} icon={Clock3} />
            <DetailItem label="Uploader" value={personName(evidence.uploaded_by)} icon={UserRound} />
            <DetailItem label="Evidence type" value={humanize(evidence.evidence_category ?? evidence.evidence_type)} icon={FileQuestion} />
            <DetailItem label="Programme" value={evidence.impact_programmes?.name ?? UNAVAILABLE} icon={Network} />
            <DetailItem label="Cohort" value={evidence.impact_beneficiary_cohorts?.name ?? UNAVAILABLE} icon={Link2} />
            <DetailItem label="Beneficiary" value={evidence.msmes?.business_name ?? UNAVAILABLE} icon={UserRound} />
            <DetailItem label="Intervention" value={evidence.impact_interventions?.title ?? UNAVAILABLE} icon={Target} />
            <DetailItem label="Assessment" value={evidence.impact_assessments?.title ?? UNAVAILABLE} icon={ClipboardCheck} />
            <DetailItem label="Monitoring visit" value={evidence.impact_field_visits?.title ?? UNAVAILABLE} icon={Activity} />
          </dl>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-blue-700">Evidence context note</p>
            <p className="mt-2 text-xs leading-6 text-slate-600">{evidence.description ?? UNAVAILABLE}</p>
          </div>
        </Section>

        <Section title="Integrity Verification Centre" description="File integrity and metadata controls. Private storage paths are never displayed.">
          <div className={cn(
            "rounded-2xl p-5 text-white",
            verified && !legacy ? "bg-emerald-700" : legacy ? "bg-amber-700" : "bg-[#0b1e42]",
          )}>
            <ShieldCheck className="h-6 w-6" />
            <p className="mt-4 text-lg font-bold">{chainVerified ? "Verified chain integrity" : legacy ? "Legacy integrity warning" : "Integrity review pending"}</p>
            <p className="mt-2 text-xs leading-6 text-white/75">
              {chainVerified
                ? "A stored file reference, checksum, and verified workflow state are recorded."
                : "One or more integrity controls remain incomplete or unavailable."}
            </p>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              ["Checksum present", checksumPresent ? "Yes" : UNAVAILABLE],
              ["Checksum value", evidence.checksum_sha256 ? `${evidence.checksum_sha256.slice(0, 18)}…` : UNAVAILABLE],
              ["Storage verification state", hasStoredFile ? "Object reference recorded" : UNAVAILABLE],
              ["Metadata completeness", metadataComplete ? "Complete" : "Incomplete"],
              ["Legacy placeholder", legacy ? "Yes" : "No"],
              ["Verification state", humanize(evidence.verification_status)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 p-3">
                <dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">{label}</dt>
                <dd className="mt-1 break-words text-[11px] font-bold text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
          {hasStoredFile && (
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/api/impact-intelligence/evidence/${evidence.id}?disposition=inline`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" /> Secure Preview</a>
              <a href={`/api/impact-intelligence/evidence/${evidence.id}?disposition=attachment`} className="inline-flex items-center gap-2 rounded-xl bg-[#0b1e42] px-3 py-2 text-[10px] font-bold text-white"><Download className="h-3.5 w-3.5" /> Download</a>
            </div>
          )}
        </Section>
      </div>

      <Section title="Chain-of-Custody Centre" description="Timestamped actors and status transitions from the existing evidence audit trail.">
        <div className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Uploaded by", actor: personName(evidence.uploaded_by), date: evidence.uploaded_at ?? uploadedEvent?.created_at, status: "Uploaded", icon: Upload },
            { label: "Submitted by", actor: eventActor(submittedEvent), date: evidence.submitted_at ?? submittedEvent?.created_at, status: "Submitted", icon: FileCheck2 },
            { label: "Reviewed by", actor: personName(evidence.reviewed_by) !== UNAVAILABLE ? personName(evidence.reviewed_by) : eventActor(reviewEvent), date: evidence.reviewed_at ?? reviewEvent?.created_at, status: reviewEvent ? "Under Review" : UNAVAILABLE, icon: Eye },
            { label: "Verified by", actor: verified ? personName(evidence.reviewed_by) !== UNAVAILABLE ? personName(evidence.reviewed_by) : eventActor(verifiedEvent) : UNAVAILABLE, date: verified ? evidence.reviewed_at ?? verifiedEvent?.created_at : null, status: verified ? "Verified" : UNAVAILABLE, icon: BadgeCheck },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="relative rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.status === "Verified" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}><Icon className="h-4 w-4" /></span>
                  <span className="text-[9px] font-bold text-slate-400">0{index + 1}</span>
                </div>
                <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-xs font-bold text-[#0c1733]">{item.actor}</p>
                <p className="mt-1 text-[10px] text-slate-500">{formatDateTime(item.date)}</p>
                <div className="mt-3"><StatusPill value={item.status} /></div>
              </article>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Current custody status</span>
          <StatusPill value={currentStatus} />
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Assessment & Monitoring Linkage" description="Existing assessment, visit, and intervention relationships supporting this evidence.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <ClipboardCheck className="h-5 w-5 text-cyan-600" />
              <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Linked assessment</p>
              <p className="mt-1 text-sm font-bold text-[#0c1733]">{evidence.impact_assessments?.title ?? UNAVAILABLE}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500">Status</span>
                <StatusPill value={assessmentSource.available ? linkedAssessment?.status ?? UNAVAILABLE : UNAVAILABLE} />
              </div>
              {evidence.assessment_id && canReadAssessment && <Link href={`/dashboard/impact-intelligence/assessments/${evidence.assessment_id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">Open assessment <ArrowRight className="h-3.5 w-3.5" /></Link>}
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <Activity className="h-5 w-5 text-violet-600" />
              <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Linked monitoring visit</p>
              <p className="mt-1 text-sm font-bold text-[#0c1733]">{evidence.impact_field_visits?.title ?? UNAVAILABLE}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500">Status</span>
                <StatusPill value={evidence.impact_field_visits?.status ?? UNAVAILABLE} />
              </div>
              {evidence.field_visit_id && canReadMonitoring && <Link href={`/dashboard/impact-intelligence/monitoring/${evidence.field_visit_id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">Open monitoring visit <ArrowRight className="h-3.5 w-3.5" /></Link>}
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><Target className="h-5 w-5 text-blue-600" /><p className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Linked intervention</p><p className="mt-1 text-sm font-bold text-[#0c1733]">{evidence.impact_interventions?.title ?? UNAVAILABLE}</p></div>
              <StatusPill value={evidence.intervention_id ? "Linked" : UNAVAILABLE} />
            </div>
            {evidence.intervention_id && canReadIntervention && <Link href={`/dashboard/impact-intelligence/interventions/${evidence.intervention_id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">Open intervention <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <span className="text-[10px] font-bold text-slate-500">Linkage readiness</span>
            <StatusPill value={evidence.assessment_id || evidence.field_visit_id || evidence.intervention_id ? "Ready" : UNAVAILABLE} />
          </div>
        </Section>

        <Section title="Outcome Support Centre" description="Indicator measurements directly linked to this evidence record.">
          {!indicatorsSource.available ? (
            <EmptyPanel title="Outcome support unavailable" description="The scoped indicator source could not be loaded." icon={Target} />
          ) : linkedIndicators.length === 0 ? (
            <EmptyPanel title="No indicator support recorded" description="No indicator measurement currently references this evidence." icon={Target} />
          ) : (
            <div className="space-y-3">
              {linkedIndicators.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><Target className="h-5 w-5 text-amber-600" /><p className="mt-3 text-xs font-bold text-[#0c1733]">{item.impact_indicator_definitions?.name ?? UNAVAILABLE}</p><p className="mt-1 text-[10px] text-slate-500">{formatDate(item.measurement_date)} · {humanize(item.source_type)}</p></div>
                    <StatusPill value={item.verification_status} />
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ["Indicators supported", indicatorsSource.available ? uniqueIndicatorIds.size : null],
              ["Verified measurements", indicatorsSource.available ? verifiedMeasurements.length : null],
              ["Outcome readiness", indicatorsSource.available ? indicatorReady ? "Ready" : "Pending" : UNAVAILABLE],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-[#0c1733]">{typeof value === "number" ? formatNumber(value) : value}</p>
                <p className="mt-1 text-[9px] font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Reporting Impact Centre" description="Institutional reports whose latest recorded versions depend on this evidence.">
        {!reportsSource.available ? (
          <EmptyPanel title="Reporting impact unavailable" description="The scoped report source could not be loaded." icon={FileText} />
        ) : linkedReports.length === 0 ? (
          <EmptyPanel title="No report dependency recorded" description="No institutional report latest version currently references this evidence." icon={FileText} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {linkedReports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><FileText className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-xs font-bold text-[#0c1733]">{report.title}</p><p className="mt-1 text-[10px] text-slate-500">{humanize(report.report_type)}</p></div>
                  <StatusPill value={report.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Latest version</dt><dd className="mt-1 text-[11px] font-bold text-slate-700">{report.latest_version ? `v${report.latest_version.version_number}` : UNAVAILABLE}</dd></div>
                  <div><dt className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Exports</dt><dd className="mt-1 text-[11px] font-bold text-slate-700">{report.exportCount === null ? UNAVAILABLE : report.exportCount > 0 ? "Available" : "None"}</dd></div>
                </dl>
                {canReadReports && <Link href={`/dashboard/impact-intelligence/reports/${report.id}`} className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-blue-700">Open report <ArrowRight className="h-3.5 w-3.5" /></Link>}
              </article>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Reports using evidence", reportsSource.available ? linkedReports.length : null],
            ["Approved reports", reportsSource.available ? approvedReports.length : null],
            ["Latest report version", reportsSource.available ? latestReport?.latest_version ? `v${latestReport.latest_version.version_number}` : UNAVAILABLE : UNAVAILABLE],
            ["Export availability", reportsSource.available ? exportCount === null ? UNAVAILABLE : exportCount > 0 ? "Available" : "None" : UNAVAILABLE],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-bold text-[#0c1733]">{typeof value === "number" ? formatNumber(value) : value}</p>
              <p className="mt-1 text-[9px] font-semibold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 p-3">
          <span className="text-[10px] font-bold text-slate-500">Report readiness contribution</span>
          <StatusPill value={reportsSource.available ? reportReady ? "Ready" : "Pending" : UNAVAILABLE} />
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <Section title="Risks & Exceptions" description="Only observed conditions are listed; unavailable sources are not converted into risks.">
          {risks.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">No evidence exceptions are currently observed.</div>
          ) : (
            <div className="space-y-2">
              {risks.map((risk) => (
                <div key={risk} className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{risk}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><ShieldAlert className="h-4 w-4 text-rose-600" /><p className="mt-3 text-lg font-bold text-[#0c1733]">{risks.length}</p><p className="text-[9px] text-slate-500">Observed blockers</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><FileWarning className="h-4 w-4 text-amber-600" /><p className="mt-3 text-lg font-bold text-[#0c1733]">{metadataComplete ? "0" : "1"}</p><p className="text-[9px] text-slate-500">Metadata exceptions</p></div>
          </div>
        </Section>

        <Section title="Activity Timeline" description="Real evidence events and recorded report dependencies only.">
          {activity.length === 0 ? (
            <EmptyPanel title="No activity recorded" description="This record may predate the evidence audit trail." icon={Activity} />
          ) : (
            <ol className="space-y-3">
              {activity.map((item) => {
                const Icon = item.icon;
                const content = (
                  <div className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-xs font-bold text-[#0c1733]">{item.type}</p>
                        <p className="text-[9px] text-slate-400">{formatDateTime(item.date)}</p>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-600">{item.detail}</p>
                      <p className="mt-2 text-[9px] font-semibold text-slate-400">{item.actor}</p>
                    </div>
                  </div>
                );
                return <li key={item.id}>{item.href ? <Link href={item.href}>{content}</Link> : content}</li>;
              })}
            </ol>
          )}
        </Section>
      </div>

      {(canSubmit || canStartReview || canVerify || canReturn || canReject || canArchive) && (
        <Section id="review-actions" title="Evidence Review Actions" description="Actions remain governed by the existing evidence permissions and workflow transitions.">
          <div className="grid gap-4 lg:grid-cols-3">
            {canSubmit && hasStoredFile && (
              <form action={transition("submit")} className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                <h3 className="text-xs font-bold text-[#0c1733]">{evidence.status === "returned" ? "Resubmit evidence" : "Submit for review"}</h3>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">Move this stored evidence into the reviewer workflow.</p>
                <Button type="submit" className="mt-4 w-full">{evidence.status === "returned" ? "Resubmit" : "Submit evidence"}</Button>
              </form>
            )}
            {canStartReview && (
              <form action={transition("start_review")} className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                <h3 className="text-xs font-bold text-[#0c1733]">Begin verification review</h3>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">Place this submitted evidence into active review.</p>
                <Button type="submit" className="mt-4 w-full">Start review</Button>
              </form>
            )}
            {canVerify && (
              <form action={transition("verified")} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <h3 className="text-xs font-bold text-[#0c1733]">Verify evidence</h3>
                <textarea name="review_note" rows={3} className="mt-3 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm" placeholder="Verification note (optional)" />
                <Button type="submit" className="mt-3 w-full gap-2"><ShieldCheck className="h-4 w-4" /> Verify evidence</Button>
              </form>
            )}
            {canReturn && (
              <form action={transition("returned")} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                <h3 className="text-xs font-bold text-[#0c1733]">Return for correction</h3>
                <textarea required name="review_note" rows={3} className="mt-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm" placeholder="Correction required" />
                <Button type="submit" variant="secondary" className="mt-3 w-full">Return evidence</Button>
              </form>
            )}
            {canReject && (
              <form action={transition("rejected")} className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                <h3 className="text-xs font-bold text-[#0c1733]">Reject evidence</h3>
                <textarea required name="review_note" rows={3} className="mt-3 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm" placeholder="Rejection reason" />
                <Button type="submit" className="mt-3 w-full bg-rose-700 hover:bg-rose-800">Reject evidence</Button>
              </form>
            )}
            {canArchive && (
              <form action={transition("archive")} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-bold text-[#0c1733]">Archive evidence</h3>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">Remove this record from active workflow while preserving its file and audit history.</p>
                <Button type="submit" variant="secondary" className="mt-4 w-full">Archive evidence</Button>
              </form>
            )}
          </div>
        </Section>
      )}

      <Section title="Executive Assurance Summary" description="Current evidence assurance posture based on available workflow and linkage data.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Evidence Health", value: health, icon: Gauge },
            { label: "Chain Integrity", value: chainVerified ? "Verified" : legacy ? "At Risk" : "Pending", icon: ShieldCheck },
            { label: "Outcome Support", value: indicatorsSource.available ? indicatorReady ? "Ready" : linkedIndicators.length > 0 ? "Pending" : "Unavailable" : UNAVAILABLE, icon: Target },
            { label: "Reporting Readiness", value: reportsSource.available ? reportReady ? "Ready" : linkedReports.length > 0 ? "Pending" : "Unavailable" : UNAVAILABLE, icon: FileCheck2 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0b1e42] text-white"><Icon className="h-4 w-4" /></span>
                  <StatusPill value={item.value} />
                </div>
                <p className="mt-4 text-[10px] font-bold text-slate-600">{item.label}</p>
              </article>
            );
          })}
        </div>
      </Section>
    </section>
  );
}
