import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  FileText,
  FileWarning,
  Gauge,
  Link2,
  Network,
  Plus,
  RotateCcw,
  ShieldCheck,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserContext } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/session";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import {
  createIndicatorMeasurement,
  getIndicatorDefinition,
  getIndicatorFormOptions,
  listIndicatorMeasurements,
  logImpactIndicatorDiagnostic,
  returnIndicatorMeasurement,
  submitIndicatorMeasurement,
  verifyIndicatorMeasurement,
  type ImpactIndicatorDefinition,
  type ImpactIndicatorMeasurement,
  type IndicatorFormOptions,
} from "@/lib/data/impact-indicators";
import {
  listInstitutionalReports,
  type InstitutionalReport,
} from "@/lib/data/impact-reports";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../_components";

const ROUTE = "/dashboard/impact-intelligence/indicators";
const UNAVAILABLE = "Unavailable";
const EXPECTED_ACTION_ERRORS = [
  "required",
  "numeric",
  "valid",
  "permission",
  "indicator",
  "measurement",
  "assigned",
  "active",
  "status changed",
];

type SearchParams = { error?: string; success?: string };
type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

const EMPTY_OPTIONS: IndicatorFormOptions = {
  programmes: [],
  cohorts: [],
  members: [],
  interventions: [],
  assessments: [],
  scoreRuns: [],
  visits: [],
  users: [],
};

function sourceFallback<T>(data: T): SourceState<T> {
  return { data, available: false };
}

async function loadSource<T>(
  ctx: UserContext,
  indicatorId: string,
  operation: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<SourceState<T>> {
  try {
    return { data: await loader(), available: true };
  } catch (error) {
    unstable_rethrow(error);
    logImpactIndicatorDiagnostic({
      operation,
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      indicatorDefinitionId: indicatorId,
      errorMessage: error instanceof Error ? error.message : "Unknown source error.",
      success: false,
    });
    return sourceFallback(fallback);
  }
}

function isExpectedActionError(error: unknown) {
  return error instanceof Error
    && EXPECTED_ACTION_ERRORS.some((message) => error.message.toLowerCase().includes(message));
}

function actionRedirect(indicatorId: string, type: "error" | "success", message: string): never {
  redirect(`${ROUTE}/${indicatorId}?${type}=${encodeURIComponent(message)}`);
}

async function createMeasurementAction(indicatorId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  formData.set("indicator_definition_id", indicatorId);
  try {
    await createIndicatorMeasurement(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    actionRedirect(indicatorId, "error", error instanceof Error ? error.message : "Measurement could not be created.");
  }
  actionRedirect(indicatorId, "success", "Draft measurement added.");
}

async function submitMeasurementAction(indicatorId: string, measurementId: string) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await submitIndicatorMeasurement(ctx, measurementId);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    actionRedirect(indicatorId, "error", error instanceof Error ? error.message : "Measurement could not be submitted.");
  }
  actionRedirect(indicatorId, "success", "Measurement submitted for verification.");
}

async function verifyMeasurementAction(indicatorId: string, measurementId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await verifyIndicatorMeasurement(ctx, measurementId, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    actionRedirect(indicatorId, "error", error instanceof Error ? error.message : "Measurement could not be verified.");
  }
  actionRedirect(indicatorId, "success", "Measurement verified.");
}

async function returnMeasurementAction(indicatorId: string, measurementId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await returnIndicatorMeasurement(ctx, measurementId, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    actionRedirect(indicatorId, "error", error instanceof Error ? error.message : "Measurement could not be returned.");
  }
  actionRedirect(indicatorId, "success", "Measurement returned for correction.");
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

function formatValue(value: number | null | undefined, unit?: string | null) {
  if (value === null || value === undefined) return UNAVAILABLE;
  return `${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function formatCount(value: number | null) {
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

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function statusTone(value: string | null | undefined) {
  const status = value?.toLowerCase() ?? "";
  if (["healthy", "ready", "active", "approved", "verified", "achieved", "exceeded", "available"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (["watchlist", "submitted", "under review", "on_track", "in progress", "draft"].includes(status)) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (["at risk", "returned", "rejected", "regressed", "below_target", "blocked"].includes(status)) {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function healthFromMeasurement(measurement: ImpactIndicatorMeasurement | null): HealthState {
  if (!measurement || measurement.verification_status !== "verified") return "Unavailable";
  if (["achieved", "exceeded", "on_track"].includes(measurement.outcome_status)) return "Healthy";
  if (["below_target", "no_baseline"].includes(measurement.outcome_status)) return "Watchlist";
  if (measurement.outcome_status === "regressed") return "At Risk";
  return "Unavailable";
}

function readinessLabel(value: number | null) {
  if (value === null) return UNAVAILABLE;
  if (value >= 80) return "Ready";
  if (value >= 50) return "In Progress";
  return "Needs Attention";
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
  icon: typeof Target;
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

function EmptyPanel({ title, description, icon: Icon = CircleDot }: { title: string; description: string; icon?: typeof CircleDot }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <Icon className="mx-auto h-5 w-5 text-slate-400" />
      <p className="mt-2 text-xs font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function StatusPill({ value }: { value: string | null | undefined }) {
  return (
    <span className={cn("inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", statusTone(value))}>
      {humanize(value)}
    </span>
  );
}

function ProgressBar({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  if (value === null) return <span className="text-[10px] font-semibold text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-slate-600">
        <span>Outcome progress</span>
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function MeasurementActions({
  ctx,
  indicatorId,
  measurement,
}: {
  ctx: UserContext;
  indicatorId: string;
  measurement: ImpactIndicatorMeasurement;
}) {
  const canSubmit = canRole(ctx.role, "indicator", "submit")
    && ["draft", "returned"].includes(measurement.verification_status);
  const canVerify = canRole(ctx.role, "indicator", "verify")
    && measurement.verification_status === "submitted";
  if (!canSubmit && !canVerify) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {canSubmit && (
        <form action={submitMeasurementAction.bind(null, indicatorId, measurement.id)}>
          <Button type="submit" size="sm">Submit Measurement</Button>
        </form>
      )}
      {canVerify && (
        <form action={verifyMeasurementAction.bind(null, indicatorId, measurement.id)} className="space-y-2">
          <textarea
            name="review_note"
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            placeholder="Review note. Required when returning."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">Verify</Button>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              formAction={returnMeasurementAction.bind(null, indicatorId, measurement.id)}
            >
              Return
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddMeasurementForm({
  indicator,
  options,
}: {
  indicator: ImpactIndicatorDefinition;
  options: IndicatorFormOptions;
}) {
  return (
    <form action={createMeasurementAction.bind(null, indicator.id)} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Programme
        <select required name="programme_id" defaultValue={indicator.programme_id ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800">
          <option value="">Select programme</option>
          {options.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Cohort
        <select name="cohort_id" defaultValue={indicator.cohort_id ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800">
          <option value="">Programme-level</option>
          {options.cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Beneficiary
        <select name="cohort_member_id" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800">
          <option value="">Aggregate measurement</option>
          {options.members.map((item) => <option key={item.id} value={item.id}>{item.msmes?.business_name ?? item.msme_id}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Intervention
        <select name="intervention_id" defaultValue={indicator.intervention_id ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800">
          <option value="">Not linked</option>
          {options.interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Assessment
        <select name="assessment_id" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800">
          <option value="">Not linked</option>
          {options.assessments.map((item) => <option key={item.id} value={item.id}>{item.title ?? humanize(item.assessment_type)}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Score run
        <select name="assessment_score_run_id" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800">
          <option value="">Not linked</option>
          {options.scoreRuns.map((item) => <option key={item.id} value={item.id}>{item.weighted_score.toFixed(1)}% · {formatDate(item.calculated_at)}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Field visit
        <select name="field_visit_id" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800">
          <option value="">Not linked</option>
          {options.visits.map((item) => <option key={item.id} value={item.id}>{item.title ?? "Field visit"} · {humanize(item.status)}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Source
        <select name="source_type" defaultValue="manual" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800">
          <option value="manual">Manual</option>
          <option value="assessment_score">Assessment Score</option>
          <option value="field_visit">Field Visit</option>
        </select>
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Measurement date
        <input required name="measurement_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800" />
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Baseline
        <input name="baseline_value" type="number" step="0.0001" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800" />
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Target
        <input name="target_value" type="number" step="0.0001" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800" />
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Current value
        <input required name="measured_value" type="number" step="0.0001" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800" />
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Period start
        <input name="reporting_period_start" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800" />
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-600">
        Period end
        <input name="reporting_period_end" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal text-slate-800" />
      </label>
      <div className="flex items-end justify-end md:col-span-2">
        <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Save Draft Measurement</Button>
      </div>
    </form>
  );
}

export default async function IndicatorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ indicatorId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { indicatorId } = await params;
  const query = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let indicator: ImpactIndicatorDefinition | null = null;

  try {
    ctx = await getCurrentUserContext();
    if (!canAccessRoute(ctx.role, `${ROUTE}/${indicatorId}`)) {
      throw new Error("You do not have permission to access this indicator workspace.");
    }
    indicator = await getIndicatorDefinition(ctx, indicatorId);
  } catch (error) {
    unstable_rethrow(error);
    logImpactIndicatorDiagnostic({
      operation: "indicator_detail_load_failed",
      role: ctx?.role ?? null,
      authUserId: ctx?.authUserId ?? null,
      appUserId: ctx?.appUserId ?? null,
      indicatorDefinitionId: indicatorId,
      errorMessage: error instanceof Error ? error.message : "Indicator detail unavailable.",
      success: false,
    });
    return (
      <section className="space-y-5">
        <Section title="Indicator Unavailable">
          <EmptyState
            title="Outcome verification workspace could not load"
            description={error instanceof Error ? error.message : "The indicator, session, or programme assignment is temporarily unavailable."}
            icon={Target}
          />
        </Section>
      </section>
    );
  }

  if (!indicator) notFound();

  const canCreateMeasurement = canRole(ctx.role, "indicator", "create")
    && ["super_admin", "assessment_officer", "field_officer"].includes(ctx.role)
    && indicator.status === "active";
  const canViewEvidence = canRole(ctx.role, "evidence", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence");
  const canViewReports = canRole(ctx.role, "report", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");

  const [measurementsSource, evidenceSource, reportsSource, optionsSource] = await Promise.all([
    loadSource(
      ctx,
      indicatorId,
      "indicator_detail_measurements_load_failed",
      () => listIndicatorMeasurements(ctx, { definitionId: indicatorId, limit: 1000 }),
      [] as ImpactIndicatorMeasurement[],
    ),
    canViewEvidence && indicator.programme_id
      ? loadSource(
          ctx,
          indicatorId,
          "indicator_detail_evidence_load_failed",
          () => listImpactEvidence(ctx, { programmeId: indicator.programme_id, limit: 1000 }),
          [] as ImpactEvidenceRecord[],
        )
      : Promise.resolve(sourceFallback([] as ImpactEvidenceRecord[])),
    canViewReports
      ? loadSource(
          ctx,
          indicatorId,
          "indicator_detail_reports_load_failed",
          () => listInstitutionalReports(ctx, 500),
          [] as InstitutionalReport[],
        )
      : Promise.resolve(sourceFallback([] as InstitutionalReport[])),
    canCreateMeasurement
      ? loadSource(
          ctx,
          indicatorId,
          "indicator_detail_options_load_failed",
          () => getIndicatorFormOptions(ctx),
          EMPTY_OPTIONS,
        )
      : Promise.resolve(sourceFallback(EMPTY_OPTIONS)),
  ]);

  const measurements = [...measurementsSource.data].sort((a, b) =>
    `${b.measurement_date}:${b.created_at}`.localeCompare(`${a.measurement_date}:${a.created_at}`));
  const latest = measurements[0] ?? null;
  const verifiedMeasurements = measurements.filter((item) => item.verification_status === "verified");
  const submittedMeasurements = measurements.filter((item) => item.verification_status === "submitted");
  const returnedMeasurements = measurements.filter((item) => item.verification_status === "returned");
  const rejectedMeasurements = measurements.filter((item) => item.verification_status === "rejected");
  const latestVerified = verifiedMeasurements[0] ?? null;
  const performanceMeasurement = latestVerified ?? latest;

  const evidenceById = new Map(evidenceSource.data.map((item) => [item.id, item]));
  const linkedEvidenceIds = Array.from(new Set(measurements.map((item) => item.evidence_id).filter((id): id is string => Boolean(id))));
  const linkedEvidence = linkedEvidenceIds.map((id) => evidenceById.get(id)).filter((item): item is ImpactEvidenceRecord => Boolean(item));
  const verifiedEvidenceIds = new Set(
    linkedEvidence
      .filter((item) => item.status === "verified" && item.verification_status === "verified")
      .map((item) => item.id),
  );
  const evidenceSupportedMeasurements = verifiedMeasurements.filter((item) =>
    Boolean(item.evidence_id && verifiedEvidenceIds.has(item.evidence_id)));
  const unsupportedMeasurements = verifiedMeasurements.filter((item) =>
    !item.evidence_id || !verifiedEvidenceIds.has(item.evidence_id));

  const reports = reportsSource.data.filter((report) =>
    report.latest_version?.indicator_measurement_ids.some((id) => measurements.some((measurement) => measurement.id === id)));
  const approvedReports = reports.filter((report) => report.status === "approved");
  const reportIncludedMeasurementIds = new Set(
    reports.flatMap((report) => report.latest_version?.indicator_measurement_ids ?? []),
  );
  const approvedReportMeasurementIds = new Set(
    approvedReports.flatMap((report) => report.latest_version?.indicator_measurement_ids ?? []),
  );

  const outcomeHealth = healthFromMeasurement(latestVerified);
  const verificationHealth = measurementsSource.available ? ratio(verifiedMeasurements.length, measurements.length) : null;
  const evidenceSupport = measurementsSource.available && evidenceSource.available
    ? ratio(evidenceSupportedMeasurements.length, verifiedMeasurements.length)
    : null;
  const reportReadiness = measurementsSource.available && reportsSource.available
    ? ratio(verifiedMeasurements.filter((item) => approvedReportMeasurementIds.has(item.id)).length, verifiedMeasurements.length)
    : null;
  const reportReady = reportReadiness !== null && reportReadiness === 100;
  const delta = performanceMeasurement?.baseline_value === null || performanceMeasurement?.baseline_value === undefined
    ? null
    : performanceMeasurement.measured_value - performanceMeasurement.baseline_value;

  const reportBlockers = [
    ...unsupportedMeasurements.map((item) => ({ id: `evidence-${item.id}`, label: "Verified outcome lacks verified evidence", detail: formatDate(item.measurement_date) })),
    ...verifiedMeasurements
      .filter((item) => !approvedReportMeasurementIds.has(item.id))
      .map((item) => ({ id: `report-${item.id}`, label: "Verified measurement is not in an approved report", detail: formatDate(item.measurement_date) })),
  ];

  const lifecycleStage = approvedReports.length > 0
    ? 5
    : evidenceSupportedMeasurements.length > 0
      ? 4
      : verifiedMeasurements.length > 0
        ? 3
        : submittedMeasurements.length > 0
          ? 2
          : measurements.some((item) => Boolean(item.submitted_at))
            ? 1
            : 0;
  const lifecycle = [
    { label: "Indicator Created", icon: Target },
    { label: "Measurement Submitted", icon: ClipboardCheck },
    { label: "Under Review", icon: FileClock },
    { label: "Verified", icon: ShieldCheck },
    { label: "Evidence Supported", icon: Link2 },
    { label: "Report Included", icon: FileCheck2 },
  ];

  const activity = [
    { id: `created-${indicator.id}`, type: "Indicator created", date: indicator.created_at, icon: Target, href: null },
    ...measurements.filter((item) => item.submitted_at).map((item) => ({
      id: `submitted-${item.id}`,
      type: "Measurement submitted",
      date: item.submitted_at,
      icon: ClipboardCheck,
      href: `#measurement-${item.id}`,
    })),
    ...measurements.filter((item) => item.verified_at).map((item) => ({
      id: `verified-${item.id}`,
      type: "Measurement verified",
      date: item.verified_at,
      icon: ShieldCheck,
      href: `#measurement-${item.id}`,
    })),
    ...returnedMeasurements.map((item) => ({
      id: `returned-${item.id}`,
      type: "Measurement returned",
      date: item.updated_at,
      icon: RotateCcw,
      href: `#measurement-${item.id}`,
    })),
    ...measurements.filter((item) => item.evidence_id).map((item) => ({
      id: `evidence-${item.id}`,
      type: "Evidence linked",
      date: item.updated_at ?? item.created_at,
      icon: Link2,
      href: canViewEvidence ? `/dashboard/impact-intelligence/evidence/${item.evidence_id}` : `#measurement-${item.id}`,
    })),
    ...reports.map((report) => ({
      id: `report-${report.id}`,
      type: "Report generated",
      date: report.latest_version?.generated_at ?? report.generated_at ?? report.created_at,
      icon: FileText,
      href: canViewReports ? `/dashboard/impact-intelligence/reports/${report.id}` : null,
    })),
  ]
    .filter((item) => Boolean(item.date))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const attributionRecords = measurements.filter((item) =>
    item.cohort_id || item.intervention_id || item.assessment_id || item.evidence_id);
  const latestAttribution = attributionRecords[0] ?? null;
  const canSubmitAny = measurements.some((item) =>
    canRole(ctx.role, "indicator", "submit") && ["draft", "returned"].includes(item.verification_status));
  const canReviewAny = submittedMeasurements.length > 0 && canRole(ctx.role, "indicator", "verify");
  const partialSources = [
    !measurementsSource.available ? "measurements" : null,
    canViewEvidence && !evidenceSource.available ? "evidence" : null,
    canViewReports && !reportsSource.available ? "reports" : null,
    canCreateMeasurement && !optionsSource.available ? "measurement options" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl bg-[#07152f] p-5 text-white shadow-xl shadow-slate-300/40 sm:p-7">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative">
          <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-blue-100/70">
            <Link href="/dashboard/impact-intelligence" className="hover:text-white">Impact Intelligence</Link>
            <span>/</span>
            <Link href={ROUTE} className="hover:text-white">Indicators</Link>
            <span>/</span>
            <span className="text-white">Outcome War Room</span>
          </nav>
          <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-blue-100">{humanize(indicator.indicator_type)}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-blue-100">{humanize(indicator.status)}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-blue-100">{performanceMeasurement ? humanize(performanceMeasurement.verification_status) : UNAVAILABLE}</span>
              </div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Outcome Verification &amp; Impact Attribution</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">{indicator.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100/75">{indicator.description ?? UNAVAILABLE}</p>
              <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
                <div><p className="text-blue-100/50">Programme</p><p className="mt-1 font-bold text-white">{indicator.impact_programmes?.name ?? UNAVAILABLE}</p></div>
                <div><p className="text-blue-100/50">Unit</p><p className="mt-1 font-bold text-white">{indicator.unit_of_measure || UNAVAILABLE}</p></div>
                <div><p className="text-blue-100/50">Report readiness</p><p className="mt-1 font-bold text-white">{reportsSource.available ? (reportReady ? "Ready" : readinessLabel(reportReadiness)) : UNAVAILABLE}</p></div>
              </div>
            </div>
            <div className="flex max-w-xl flex-wrap gap-2">
              <Link href={ROUTE} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/15">
                <ArrowLeft className="h-4 w-4" /> Portfolio
              </Link>
              {canCreateMeasurement && optionsSource.available && (
                <Link href="#add-measurement" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-3 text-xs font-bold text-[#07152f] hover:bg-emerald-300">
                  <Plus className="h-4 w-4" /> Add Measurement
                </Link>
              )}
              {canSubmitAny && <Link href="#measurement-history" className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/15">Submit Measurement</Link>}
              {canReviewAny && <Link href="#measurement-history" className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/15">Verify / Return</Link>}
              {canViewReports && <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/15"><FileText className="h-4 w-4" /> View Reports</Link>}
            </div>
          </div>
        </div>
      </header>

      {query.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</div>}
      {query.success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{query.success}</div>}
      {partialSources.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span className="font-bold">Partial source availability:</span> {partialSources.join(", ")} could not be loaded. Affected values are shown as {UNAVAILABLE}.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Baseline" value={measurementsSource.available ? formatValue(performanceMeasurement?.baseline_value, indicator.unit_of_measure) : UNAVAILABLE} icon={Activity} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Target" value={measurementsSource.available ? formatValue(performanceMeasurement?.target_value, indicator.unit_of_measure) : UNAVAILABLE} icon={Target} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Current Value" value={measurementsSource.available ? formatValue(performanceMeasurement?.measured_value, indicator.unit_of_measure) : UNAVAILABLE} icon={TrendingUp} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Progress" value={measurementsSource.available ? formatPercent(performanceMeasurement?.progress_percentage ?? null) : UNAVAILABLE} icon={Gauge} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Measurements" value={measurementsSource.available ? formatCount(measurements.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Verified Measurements" value={measurementsSource.available ? formatCount(verifiedMeasurements.length) : UNAVAILABLE} icon={ShieldCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Evidence Support" value={formatPercent(evidenceSupport)} icon={Link2} tone="bg-sky-100 text-sky-700" />
        <MetricCard label="Report Readiness" value={formatPercent(reportReadiness)} icon={FileCheck2} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Outcome Health" value={outcomeHealth} icon={BarChart3} tone={outcomeHealth === "At Risk" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"} />
      </div>

      <Section title="Outcome Journey" description="Lifecycle progression from the real indicator, measurement, evidence, and approved report relationships.">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {lifecycle.map((item, index) => {
            const Icon = item.icon;
            const active = index === lifecycleStage;
            const complete = index < lifecycleStage;
            return (
              <article key={item.label} className={cn("relative rounded-xl border p-4", active ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100" : complete ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60")}>
                <span className={cn("grid h-8 w-8 place-items-center rounded-lg", active ? "bg-blue-600 text-white" : complete ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400 ring-1 ring-slate-200")}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <p className="mt-3 text-[10px] font-bold text-slate-700">{item.label}</p>
                <p className="mt-1 text-[9px] text-slate-400">{active ? "Current state" : complete ? "Completed" : "Pending"}</p>
                {index < lifecycle.length - 1 && <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-slate-300 xl:block" />}
              </article>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.4fr]">
        <Section title="Performance Centre" description={latestVerified ? "Latest verified measurement is used for executive outcome performance." : "No verified measurement exists; the latest visible record is shown without treating it as verified."}>
          {!performanceMeasurement ? (
            <EmptyPanel title="No outcome measurement" description="Baseline, current value, target, delta, and achievement remain unavailable." icon={Gauge} />
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Baseline", formatValue(performanceMeasurement.baseline_value, indicator.unit_of_measure)],
                  ["Current", formatValue(performanceMeasurement.measured_value, indicator.unit_of_measure)],
                  ["Target", formatValue(performanceMeasurement.target_value, indicator.unit_of_measure)],
                  ["Delta", formatValue(delta, indicator.unit_of_measure)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[9px] font-semibold text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-bold text-[#0c1733]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <ProgressBar value={performanceMeasurement.progress_percentage} tone={outcomeHealth === "At Risk" ? "bg-rose-500" : outcomeHealth === "Watchlist" ? "bg-amber-500" : "bg-emerald-500"} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-[9px] font-semibold text-slate-400">Outcome status</p><StatusPill value={performanceMeasurement.outcome_status} /></div>
                  <div className="text-right"><p className="text-[9px] font-semibold text-slate-400">Measurement state</p><StatusPill value={performanceMeasurement.verification_status} /></div>
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section id="measurement-history" title="Measurement Verification Centre" description="All visible measurements remain within the current role and programme scope.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Verified", verifiedMeasurements.length, ShieldCheck, "text-emerald-700"],
              ["Submitted", submittedMeasurements.length, FileClock, "text-blue-700"],
              ["Returned", returnedMeasurements.length, RotateCcw, "text-amber-700"],
              ["Rejected", rejectedMeasurements.length, XCircle, "text-rose-700"],
            ].map(([label, value, Icon, tone]) => {
              const StatusIcon = Icon as typeof ShieldCheck;
              return (
                <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                  <StatusIcon className={cn("h-4 w-4", String(tone))} />
                  <p className="mt-3 text-xl font-bold text-[#0c1733]">{measurementsSource.available ? String(value) : UNAVAILABLE}</p>
                  <p className="text-[9px] font-semibold text-slate-500">{String(label)}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-3">
            {measurements.slice(0, 8).map((measurement) => (
              <article id={`measurement-${measurement.id}`} key={measurement.id} className={cn("rounded-xl border p-4", measurement.verification_status === "verified" ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><StatusPill value={measurement.verification_status} /><StatusPill value={measurement.outcome_status} /></div>
                    <p className="mt-2 text-xs font-bold text-slate-800">{formatValue(measurement.measured_value, indicator.unit_of_measure)}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{formatDate(measurement.measurement_date)} · {humanize(measurement.source_type)} · {measurement.impact_interventions?.title ?? measurement.impact_assessments?.title ?? "No intervention or assessment link"}</p>
                    {measurement.review_note && <p className="mt-2 text-[10px] leading-4 text-slate-600">Review note: {measurement.review_note}</p>}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[9px] font-semibold text-slate-400">Progress</p>
                    <p className="mt-1 text-sm font-bold text-[#0c1733]">{formatPercent(measurement.progress_percentage)}</p>
                  </div>
                </div>
                <MeasurementActions ctx={ctx} indicatorId={indicatorId} measurement={measurement} />
              </article>
            ))}
            {measurements.length === 0 && <EmptyPanel title="No measurements" description="No measurement records are visible for this indicator in the current scope." icon={ClipboardCheck} />}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Evidence Attribution Centre" description="Only direct measurement evidence relationships are counted. Storage paths are never displayed.">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-[#0c1733]">{evidenceSource.available ? linkedEvidence.length : UNAVAILABLE}</p><p className="text-[9px] text-slate-500">Linked evidence</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-lg font-bold text-emerald-700">{evidenceSource.available ? verifiedEvidenceIds.size : UNAVAILABLE}</p><p className="text-[9px] text-emerald-700">Verified support</p></div>
            <div className="rounded-xl bg-amber-50 p-3"><p className="text-lg font-bold text-amber-700">{measurementsSource.available && evidenceSource.available ? unsupportedMeasurements.length : UNAVAILABLE}</p><p className="text-[9px] text-amber-700">Unsupported claims</p></div>
          </div>
          <div className="mt-4 space-y-3">
            {linkedEvidence.map((evidence) => (
              <article key={evidence.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">{evidence.original_filename ?? evidence.file_name}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{humanize(evidence.evidence_type)} · {formatDate(evidence.captured_at ?? evidence.uploaded_at)}</p>
                  </div>
                  <StatusPill value={evidence.verification_status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold">
                  <span className={cn("rounded-full px-2 py-1", evidence.checksum_sha256 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{evidence.checksum_sha256 ? "Checksum Recorded" : UNAVAILABLE}</span>
                  <span className={cn("rounded-full px-2 py-1", verifiedEvidenceIds.has(evidence.id) ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700")}>{verifiedEvidenceIds.has(evidence.id) ? "Trusted Support" : "Support Not Verified"}</span>
                </div>
              </article>
            ))}
            {linkedEvidence.length === 0 && <EmptyPanel title={evidenceSource.available ? "No linked evidence" : "Evidence unavailable"} description={evidenceSource.available ? "No visible measurement has a direct evidence relationship." : "Evidence support could not be loaded safely."} icon={Link2} />}
          </div>
        </Section>

        <Section title="Intervention Attribution Centre" description="Contribution chain uses only relationships present on the indicator definition and visible measurements.">
          <div className="grid gap-2 sm:grid-cols-6">
            {[
              ["Programme", indicator.impact_programmes?.name ?? latestAttribution?.impact_programmes?.name],
              ["Cohort", indicator.impact_beneficiary_cohorts?.name ?? latestAttribution?.impact_beneficiary_cohorts?.name],
              ["Intervention", indicator.impact_interventions?.title ?? latestAttribution?.impact_interventions?.title],
              ["Assessment", latestAttribution?.impact_assessments?.title ?? humanize(latestAttribution?.impact_assessments?.assessment_type)],
              ["Evidence", latestAttribution?.evidence_id ? evidenceById.get(latestAttribution.evidence_id)?.original_filename ?? "Linked evidence" : null],
              ["Indicator", indicator.name],
            ].map(([label, value], index) => (
              <article key={label} className="relative rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
                <p className="mt-2 line-clamp-3 text-[10px] font-bold text-slate-700">{value || UNAVAILABLE}</p>
                {index < 5 && <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-slate-300 sm:block" />}
              </article>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><Network className="h-4 w-4" /></span>
              <div>
                <p className="text-xs font-bold text-slate-800">Attribution coverage</p>
                <p className="mt-1 text-[10px] text-slate-500">{attributionRecords.length} of {measurements.length} visible measurements carry at least one cohort, intervention, assessment, or evidence relationship.</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Reporting Impact Centre" description="Reports are matched through immutable latest-version measurement references.">
        {reports.length === 0 ? (
          <EmptyPanel title={reportsSource.available ? "Not included in a report" : "Reporting source unavailable"} description={reportsSource.available ? "No visible report latest version references a measurement from this indicator." : "Report inclusion and export availability cannot be determined."} icon={FileText} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reports.map((report) => {
              const referencedCount = report.latest_version?.indicator_measurement_ids.filter((id) => reportIncludedMeasurementIds.has(id) && measurements.some((item) => item.id === id)).length ?? 0;
              const exportAvailability = report.status === "approved" && canRole(ctx.role, "report", "export") ? "Available" : UNAVAILABLE;
              return (
                <article key={report.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="line-clamp-2 text-xs font-bold text-slate-800">{report.title}</p><p className="mt-1 text-[10px] text-slate-500">{humanize(report.report_type)}</p></div>
                    <StatusPill value={report.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                    <div><dt className="text-slate-400">Latest version</dt><dd className="mt-1 font-bold text-slate-700">{report.latest_version ? `v${report.latest_version.version_number}` : UNAVAILABLE}</dd></div>
                    <div><dt className="text-slate-400">Approval</dt><dd className="mt-1 font-bold text-slate-700">{report.approved_at ? formatDate(report.approved_at) : humanize(report.status)}</dd></div>
                    <div><dt className="text-slate-400">Measurements</dt><dd className="mt-1 font-bold text-slate-700">{referencedCount}</dd></div>
                    <div><dt className="text-slate-400">Export</dt><dd className="mt-1 font-bold text-slate-700">{exportAvailability}</dd></div>
                  </dl>
                  {canViewReports && <Link href={`/dashboard/impact-intelligence/reports/${report.id}`} className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">Open report <ArrowRight className="h-3 w-3" /></Link>}
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Risks &amp; Exceptions" description="Observable gaps only. Staleness is unavailable because the indicator has no governed freshness threshold.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Missing evidence", measurementsSource.available && evidenceSource.available ? unsupportedMeasurements.length : null, Link2, "bg-amber-100 text-amber-700"],
              ["Unverified measurements", measurementsSource.available ? measurements.length - verifiedMeasurements.length : null, FileClock, "bg-blue-100 text-blue-700"],
              ["Stale measurements", null, Activity, "bg-slate-200 text-slate-600"],
              ["Report blockers", measurementsSource.available && reportsSource.available && evidenceSource.available ? reportBlockers.length : null, FileWarning, "bg-rose-100 text-rose-700"],
              ["Unsupported claims", measurementsSource.available && evidenceSource.available ? unsupportedMeasurements.filter((item) => ["achieved", "exceeded", "on_track"].includes(item.outcome_status)).length : null, AlertTriangle, "bg-violet-100 text-violet-700"],
            ].map(([label, value, Icon, tone]) => {
              const RiskIcon = Icon as typeof AlertTriangle;
              return (
                <article key={String(label)} className="rounded-xl bg-slate-50 p-3">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", String(tone))}><RiskIcon className="h-4 w-4" /></span>
                  <p className="mt-3 text-lg font-bold text-[#0c1733]">{formatCount(typeof value === "number" ? value : null)}</p>
                  <p className="text-[9px] font-semibold text-slate-500">{String(label)}</p>
                </article>
              );
            })}
          </div>
          {reportBlockers.length > 0 && (
            <div className="mt-4 space-y-2">
              {reportBlockers.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-[10px]">
                  <span className="font-semibold text-rose-800">{item.label}</span><span className="text-rose-600">{item.detail}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Activity Timeline" description="Real indicator, measurement, evidence-link, and report timestamps only.">
          {activity.length === 0 ? (
            <EmptyPanel title="No dated activity" description="No lifecycle timestamps are available for this indicator." icon={Activity} />
          ) : (
            <div className="space-y-1">
              {activity.slice(0, 10).map((item, index) => {
                const Icon = item.icon;
                const content = (
                  <div className="flex gap-3 rounded-xl p-3 hover:bg-slate-50">
                    <div className="relative">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span>
                      {index < activity.length - 1 && <span className="absolute left-1/2 top-8 h-4 w-px -translate-x-1/2 bg-slate-200" />}
                    </div>
                    <div><p className="text-[10px] font-bold text-slate-700">{item.type}</p><p className="mt-1 text-[9px] text-slate-400">{formatDateTime(item.date)}</p></div>
                  </div>
                );
                return item.href ? <Link key={item.id} href={item.href}>{content}</Link> : <div key={item.id}>{content}</div>;
              })}
            </div>
          )}
        </Section>
      </div>

      <Section title="Executive Outcome Summary" description="Consolidated health uses only available scoped measurement, evidence, and reporting relationships.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Outcome Health", outcomeHealth, latestVerified ? humanize(latestVerified.outcome_status) : "No verified outcome", BarChart3],
            ["Verification Health", readinessLabel(verificationHealth), formatPercent(verificationHealth), ShieldCheck],
            ["Evidence Support", readinessLabel(evidenceSupport), formatPercent(evidenceSupport), Link2],
            ["Reporting Readiness", readinessLabel(reportReadiness), formatPercent(reportReadiness), FileCheck2],
          ].map(([label, value, detail, Icon]) => {
            const SummaryIcon = Icon as typeof BarChart3;
            return (
              <article key={String(label)} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                <div className="flex items-center justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0c1f46] text-white"><SummaryIcon className="h-4 w-4" /></span><StatusPill value={String(value)} /></div>
                <p className="mt-4 text-xs font-bold text-[#0c1733]">{String(label)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{String(detail)}</p>
              </article>
            );
          })}
        </div>
      </Section>

      {canCreateMeasurement && (
        <Section id="add-measurement" title="Add Measurement" description="Uses the existing scoped draft, submit, and verification workflow.">
          {optionsSource.available
            ? <AddMeasurementForm indicator={indicator} options={optionsSource.data} />
            : <EmptyPanel title="Measurement options unavailable" description="Scoped programme, cohort, intervention, assessment, and visit options could not be loaded." icon={ClipboardCheck} />}
        </Section>
      )}
    </section>
  );
}
