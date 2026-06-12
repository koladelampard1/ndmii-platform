import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  FileWarning,
  Gauge,
  Layers3,
  Link2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { listImpactReports, type ImpactReport } from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import { cn } from "@/lib/utils";
import {
  INDICATOR_CALCULATION_METHODS,
  INDICATOR_DEFINITION_STATUSES,
  INDICATOR_DIRECTIONS,
  INDICATOR_SOURCE_TYPES,
  createIndicatorDefinition,
  createIndicatorMeasurement,
  getIndicatorFormOptions,
  listIndicatorDefinitions,
  listIndicatorMeasurements,
  logImpactIndicatorDiagnostic,
  returnIndicatorMeasurement,
  submitIndicatorMeasurement,
  verifyIndicatorMeasurement,
  type ImpactIndicatorDefinition,
  type ImpactIndicatorMeasurement,
  type IndicatorFormOptions,
} from "@/lib/data/impact-indicators";
import type { UserContext } from "@/lib/auth/authorization";
import { EmptyState } from "../_components";

type SearchParams = {
  error?: string;
  success?: string;
};

const ROUTE = "/dashboard/impact-intelligence/indicators";
const UNAVAILABLE = "Unavailable";

type SourceState<T> = {
  data: T;
  available: boolean;
};

type HealthState = "Healthy" | "Watchlist" | "At Risk" | "Unavailable";

type ReportWithLatestVersion = ImpactReport & {
  latest_version?: {
    indicator_measurement_ids?: string[] | null;
    generated_at?: string | null;
  } | null;
};

type IndicatorPortfolioItem = {
  definition: ImpactIndicatorDefinition;
  measurements: ImpactIndicatorMeasurement[];
  latest: ImpactIndicatorMeasurement | null;
  latestVerified: ImpactIndicatorMeasurement | null;
  evidenceSupported: boolean | null;
  reportReady: boolean | null;
  health: HealthState;
};

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

const EXPECTED_ACTION_ERRORS = [
  "required",
  "must be numeric",
  "Select a valid",
  "Selected indicator",
  "Measurement",
  "indicator definition",
  "indicator measurement",
  "assigned visits or beneficiaries",
  "does not match",
  "does not belong",
  "Only draft or returned",
  "Only submitted",
  "status changed",
  "duplicate key",
  "already exists",
  "permission",
];

function isExpectedActionError(error: unknown) {
  return error instanceof Error && EXPECTED_ACTION_ERRORS.some((message) => error.message.toLowerCase().includes(message.toLowerCase()));
}

function redirectWithResult(type: "error" | "success", message: string): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`${ROUTE}?${params.toString()}`);
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
    logImpactIndicatorDiagnostic({
      operation,
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      errorMessage: error instanceof Error ? error.message : "Unknown source error.",
      success: false,
    });
    return sourceFallback(fallback);
  }
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

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
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

function formatCount(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatPercent(value: number | null) {
  return value === null ? UNAVAILABLE : `${value}%`;
}

function displayStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function healthTone(health: HealthState) {
  if (health === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (health === "Watchlist") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (health === "At Risk") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function verificationTone(status: string) {
  if (status === "verified") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "submitted") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "returned") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "rejected") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function summaryHealth(value: number | null): HealthState {
  if (value === null) return "Unavailable";
  if (value >= 80) return "Healthy";
  if (value >= 50) return "Watchlist";
  return "At Risk";
}

function deriveHealth(measurement: ImpactIndicatorMeasurement | null): HealthState {
  if (!measurement || measurement.verification_status !== "verified") return "Unavailable";
  if (["achieved", "exceeded", "on_track"].includes(measurement.outcome_status)) return "Healthy";
  if (measurement.outcome_status === "below_target" || measurement.outcome_status === "no_baseline") return "Watchlist";
  if (measurement.outcome_status === "regressed") return "At Risk";
  return "Unavailable";
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
      <span className="text-[10px] font-bold text-slate-700">{value.toFixed(1)}%</span>
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
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-semibold text-slate-700">{item.label}</span>
            <span className="font-bold text-slate-900">{formatCount(item.value)}</span>
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

async function createDefinitionAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await createIndicatorDefinition(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    redirectWithResult("error", error instanceof Error ? error.message : "Indicator definition could not be created.");
  }
  redirectWithResult("success", "Indicator definition created.");
}

async function createMeasurementAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await createIndicatorMeasurement(ctx, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    redirectWithResult("error", error instanceof Error ? error.message : "Indicator measurement could not be created.");
  }
  redirectWithResult("success", "Indicator measurement saved as draft.");
}

async function submitMeasurementAction(measurementId: string) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await submitIndicatorMeasurement(ctx, measurementId);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    redirectWithResult("error", error instanceof Error ? error.message : "Indicator measurement could not be submitted.");
  }
  redirectWithResult("success", "Indicator measurement submitted for verification.");
}

async function verifyMeasurementAction(measurementId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await verifyIndicatorMeasurement(ctx, measurementId, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    redirectWithResult("error", error instanceof Error ? error.message : "Indicator measurement could not be verified.");
  }
  redirectWithResult("success", "Indicator measurement verified.");
}

async function returnMeasurementAction(measurementId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await returnIndicatorMeasurement(ctx, measurementId, formData);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    redirectWithResult("error", error instanceof Error ? error.message : "Indicator measurement could not be returned.");
  }
  redirectWithResult("success", "Indicator measurement returned for correction.");
}

function formatNumber(value: number | null | undefined, unit?: string | null) {
  if (typeof value !== "number") return UNAVAILABLE;
  return `${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function DefinitionForm({ options }: { options: IndicatorFormOptions }) {
  return (
    <form action={createDefinitionAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Name
        <input required name="name" className="w-full rounded-md border px-3 py-2 font-normal" placeholder="Jobs sustained after support" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Unit of measure
        <input required name="unit_of_measure" className="w-full rounded-md border px-3 py-2 font-normal" placeholder="jobs, %, NGN" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Programme
        <select name="programme_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Portfolio-level</option>
          {options.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Cohort
        <select name="cohort_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">All cohorts</option>
          {options.cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Intervention
        <select name="intervention_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">All interventions</option>
          {options.interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Indicator type
        <select name="indicator_type" defaultValue="outcome" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="output">Output</option>
          <option value="outcome">Outcome</option>
          <option value="impact">Impact</option>
          <option value="efficiency">Efficiency</option>
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Direction
        <select name="direction_of_improvement" defaultValue="increase" className="w-full rounded-md border px-3 py-2 font-normal">
          {INDICATOR_DIRECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Calculation method
        <select name="calculation_method" defaultValue="manual" className="w-full rounded-md border px-3 py-2 font-normal">
          {INDICATOR_CALCULATION_METHODS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Frequency
        <input name="measurement_frequency" className="w-full rounded-md border px-3 py-2 font-normal" placeholder="Monthly, quarterly" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Owner
        <select name="owner_user_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Unassigned</option>
          {options.users.map((item) => <option key={item.id} value={item.id}>{item.full_name ?? item.email ?? item.id}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Status
        <select name="status" defaultValue="active" className="w-full rounded-md border px-3 py-2 font-normal">
          {INDICATOR_DEFINITION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-4 pb-2 text-sm text-slate-700">
        <label className="flex items-center gap-2"><input name="baseline_required" type="checkbox" defaultChecked /> Baseline required</label>
        <label className="flex items-center gap-2"><input name="target_required" type="checkbox" defaultChecked /> Target required</label>
      </div>
      <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4">
        Definition
        <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2 font-normal" placeholder="Describe exactly what is measured and how the unit should be interpreted." />
      </label>
      <div className="flex justify-end md:col-span-2 xl:col-span-4">
        <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Create definition</Button>
      </div>
    </form>
  );
}

function MeasurementForm({ definitions, options }: { definitions: ImpactIndicatorDefinition[]; options: IndicatorFormOptions }) {
  const activeDefinitions = definitions.filter((item) => item.status === "active");
  return (
    <form action={createMeasurementAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-sm font-medium text-slate-700 xl:col-span-2">
        Indicator
        <select required name="indicator_definition_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Select active definition</option>
          {activeDefinitions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit_of_measure})</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Programme
        <select required name="programme_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Select programme</option>
          {options.programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Cohort
        <select name="cohort_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Programme-level</option>
          {options.cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700 xl:col-span-2">
        Beneficiary
        <select name="cohort_member_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Cohort/programme aggregate</option>
          {options.members.map((item) => <option key={item.id} value={item.id}>{item.msmes?.business_name ?? item.msme_id} ({item.member_status})</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Intervention
        <select name="intervention_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Not linked</option>
          {options.interventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Assessment
        <select name="assessment_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Not linked</option>
          {options.assessments.map((item) => <option key={item.id} value={item.id}>{item.title ?? item.assessment_type ?? "Assessment"}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Assessment score run
        <select name="assessment_score_run_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Not linked</option>
          {options.scoreRuns.map((item) => <option key={item.id} value={item.id}>{item.weighted_score.toFixed(1)}% · {formatDate(item.calculated_at)}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Field visit
        <select name="field_visit_id" className="w-full rounded-md border px-3 py-2 font-normal">
          <option value="">Not linked</option>
          {options.visits.map((item) => <option key={item.id} value={item.id}>{item.title ?? "Field visit"} ({item.status ?? "pending"})</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Source
        <select name="source_type" defaultValue="manual" className="w-full rounded-md border px-3 py-2 font-normal">
          {INDICATOR_SOURCE_TYPES.filter((item) => item !== "imported" && item !== "evidence").map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Measurement date
        <input required name="measurement_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-md border px-3 py-2 font-normal" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Period start
        <input name="reporting_period_start" type="date" className="w-full rounded-md border px-3 py-2 font-normal" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Period end
        <input name="reporting_period_end" type="date" className="w-full rounded-md border px-3 py-2 font-normal" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Baseline
        <input name="baseline_value" type="number" step="0.0001" className="w-full rounded-md border px-3 py-2 font-normal" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Target
        <input name="target_value" type="number" step="0.0001" className="w-full rounded-md border px-3 py-2 font-normal" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Measured value
        <input required name="measured_value" type="number" step="0.0001" className="w-full rounded-md border px-3 py-2 font-normal" />
      </label>
      <div className="flex items-end justify-end xl:col-span-4">
        <Button type="submit" className="gap-2"><ClipboardCheck className="h-4 w-4" /> Save draft measurement</Button>
      </div>
    </form>
  );
}

function MeasurementActions({ ctx, measurement }: { ctx: UserContext; measurement: ImpactIndicatorMeasurement }) {
  const canSubmit = canRole(ctx.role, "indicator", "submit") && ["draft", "returned"].includes(measurement.verification_status);
  const canVerify = canRole(ctx.role, "indicator", "verify") && measurement.verification_status === "submitted";
  if (!canSubmit && !canVerify) return null;
  const submit = submitMeasurementAction.bind(null, measurement.id);
  const verify = verifyMeasurementAction.bind(null, measurement.id);
  const returnMeasurement = returnMeasurementAction.bind(null, measurement.id);
  return (
    <div className="mt-3 space-y-2">
      {canSubmit && <form action={submit}><Button type="submit" size="sm">Submit for verification</Button></form>}
      {canVerify && (
        <form action={verify} className="space-y-2">
          <textarea name="review_note" rows={2} className="w-full rounded-md border px-2 py-1.5 text-xs" placeholder="Optional verification note; required when returning." />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">Verify</Button>
            <Button type="submit" size="sm" variant="secondary" formAction={returnMeasurement}>Return</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default async function ImpactIndicatorsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const query = (await searchParams) ?? {};
  let ctx: UserContext;

  try {
    ctx = await getCurrentUserContext();
  } catch (error) {
    unstable_rethrow(error);
    logImpactIndicatorDiagnostic({
      operation: "indicator_context_load_failed",
      errorMessage: error instanceof Error ? error.message : "User context unavailable.",
      success: false,
    });
    return (
      <section className="space-y-5">
        <Section title="Indicators Unavailable">
          <EmptyState
            title="Outcome measurement context could not load"
            description="The session or permission context is temporarily unavailable. Other dashboard modules remain accessible."
            icon={Target}
          />
        </Section>
      </section>
    );
  }

  const canCreateDefinitions = ctx.role === "super_admin" && canRole(ctx.role, "indicator", "create");
  const canCreateMeasurements = ["super_admin", "assessment_officer", "field_officer"].includes(ctx.role)
    && canRole(ctx.role, "indicator", "create");
  const canReviewMeasurements = ["admin", "super_admin", "assessment_officer"].includes(ctx.role)
    && canRole(ctx.role, "indicator", "verify");
  const canViewReports = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");

  const [definitionsSource, measurementsSource, reportsSource, evidenceSource] = await Promise.all([
    loadSource(ctx, "indicator_definitions_load_failed", () => listIndicatorDefinitions(ctx, { limit: 500 }), [] as ImpactIndicatorDefinition[]),
    loadSource(ctx, "indicator_measurements_load_failed", () => listIndicatorMeasurements(ctx, { limit: 1000 }), [] as ImpactIndicatorMeasurement[]),
    canViewReports
      ? loadSource(ctx, "indicator_reports_load_failed", () => listImpactReports(ctx, { limit: 250 }), [] as ImpactReport[])
      : Promise.resolve(sourceFallback([] as ImpactReport[])),
    canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence")
      ? loadSource(ctx, "indicator_evidence_load_failed", () => listImpactEvidence(ctx, { limit: 1000 }), [] as ImpactEvidenceRecord[])
      : Promise.resolve(sourceFallback([] as ImpactEvidenceRecord[])),
  ]);

  let options = EMPTY_OPTIONS;
  let optionsError: string | null = null;
  if (canCreateDefinitions || canCreateMeasurements) {
    try {
      options = await getIndicatorFormOptions(ctx);
    } catch (error) {
      unstable_rethrow(error);
      optionsError = error instanceof Error ? error.message : "Indicator form options are temporarily unavailable.";
      logImpactIndicatorDiagnostic({
        operation: "indicator_options_load_failed",
        role: ctx.role,
        authUserId: ctx.authUserId,
        appUserId: ctx.appUserId,
        errorMessage: optionsError,
        success: false,
      });
    }
  }

  const definitions = definitionsSource.data;
  const measurements = measurementsSource.data;
  const reports = reportsSource.data as ReportWithLatestVersion[];
  const loadError = !definitionsSource.available && !measurementsSource.available;
  const verifiedEvidenceIds = new Set(
    evidenceSource.data
      .filter((item) => item.status === "verified" && item.verification_status === "verified")
      .map((item) => item.id),
  );
  const activeDefinitions = definitions.filter((item) => item.status === "active");
  const archivedDefinitions = definitions.filter((item) => item.status === "archived");
  const verifiedMeasurements = measurements.filter((item) => item.verification_status === "verified");
  const submittedMeasurements = measurements.filter((item) => item.verification_status === "submitted");
  const returnedMeasurements = measurements.filter((item) => item.verification_status === "returned");
  const rejectedMeasurements = measurements.filter((item) => item.verification_status === "rejected");
  const draftMeasurements = measurements.filter((item) => item.verification_status === "draft");
  const approvedReportMeasurementIds = new Set(
    reports
      .filter((report) => report.status === "approved")
      .flatMap((report) => report.latest_version?.indicator_measurement_ids ?? []),
  );
  const measurementsByDefinition = new Map<string, ImpactIndicatorMeasurement[]>();
  for (const measurement of measurements) {
    const current = measurementsByDefinition.get(measurement.indicator_definition_id) ?? [];
    current.push(measurement);
    measurementsByDefinition.set(measurement.indicator_definition_id, current);
  }

  const portfolio: IndicatorPortfolioItem[] = definitions.map((definition) => {
    const linked = [...(measurementsByDefinition.get(definition.id) ?? [])]
      .sort((a, b) => `${b.measurement_date}:${b.created_at}`.localeCompare(`${a.measurement_date}:${a.created_at}`));
    const latest = linked[0] ?? null;
    const latestVerified = linked.find((measurement) => measurement.verification_status === "verified") ?? null;
    return {
      definition,
      measurements: linked,
      latest,
      latestVerified,
      evidenceSupported: measurementsSource.available && evidenceSource.available
        ? linked.some((measurement) =>
            measurement.verification_status === "verified"
            && Boolean(measurement.evidence_id && verifiedEvidenceIds.has(measurement.evidence_id))
          )
        : null,
      reportReady: reportsSource.available
        ? linked.some((measurement) => measurement.verification_status === "verified" && approvedReportMeasurementIds.has(measurement.id))
        : null,
      health: deriveHealth(latestVerified),
    };
  });

  const latestVerifiedByDefinition = portfolio.map((item) => item.latestVerified).filter((item): item is ImpactIndicatorMeasurement => Boolean(item));
  const knownHealth = portfolio.filter((item) => item.health !== "Unavailable");
  const healthyIndicators = portfolio.filter((item) => item.health === "Healthy");
  const riskIndicators = portfolio.filter((item) => item.health === "At Risk");
  const indicatorsWithoutMeasurements = portfolio.filter((item) => item.measurements.length === 0);
  const evidenceSupportedIndicators = portfolio.filter((item) => item.evidenceSupported === true);
  const indicatorsLackingEvidence = portfolio.filter((item) => item.evidenceSupported === false);
  const reportingReadyIndicators = portfolio.filter((item) => item.reportReady === true);
  const outcomeAchievement = measurementsSource.available
    ? ratio(latestVerifiedByDefinition.filter((item) => ["achieved", "exceeded", "on_track"].includes(item.outcome_status)).length, latestVerifiedByDefinition.length)
    : null;
  const outcomeReadiness = definitionsSource.available && measurementsSource.available
    ? ratio(portfolio.filter((item) => Boolean(item.latestVerified)).length, activeDefinitions.length)
    : null;
  const reportingReadiness = reportsSource.available && measurementsSource.available
    ? ratio(reportingReadyIndicators.length, activeDefinitions.length)
    : null;
  const evidenceReadiness = measurementsSource.available && evidenceSource.available
    ? ratio(evidenceSupportedIndicators.length, portfolio.filter((item) => Boolean(item.latestVerified)).length)
    : null;
  const verificationReadiness = measurementsSource.available
    ? ratio(verifiedMeasurements.length, measurements.length)
    : null;

  const submittedStageCount = measurements.filter((item) => Boolean(item.submitted_at)).length;
  const outcomeSupportedCount = evidenceSupportedIndicators.length;
  const reportReadyCount = reportingReadyIndicators.length;
  const pipeline = [
    { label: "Indicator Created", value: definitions.length, available: definitionsSource.available, color: "bg-slate-500" },
    { label: "Measurement Submitted", value: submittedStageCount, available: measurementsSource.available, color: "bg-blue-500" },
    { label: "Under Review", value: submittedMeasurements.length, available: measurementsSource.available, color: "bg-violet-500" },
    { label: "Verified", value: verifiedMeasurements.length, available: measurementsSource.available, color: "bg-emerald-500" },
    { label: "Outcome Supported", value: outcomeSupportedCount, available: measurementsSource.available, color: "bg-cyan-500" },
    { label: "Report Ready", value: reportReadyCount, available: reportsSource.available && measurementsSource.available, color: "bg-indigo-500" },
  ];
  const availablePipeline = pipeline.filter((item) => item.available);
  const bottleneckValue = availablePipeline.length > 0 ? Math.min(...availablePipeline.map((item) => item.value)) : null;

  const topPerforming = portfolio
    .filter((item) => typeof item.latestVerified?.progress_percentage === "number")
    .sort((a, b) => (b.latestVerified?.progress_percentage ?? 0) - (a.latestVerified?.progress_percentage ?? 0))
    .slice(0, 5);
  const underperforming = portfolio
    .filter((item) => ["below_target", "regressed"].includes(item.latestVerified?.outcome_status ?? ""))
    .sort((a, b) => (a.latestVerified?.progress_percentage ?? Number.MAX_SAFE_INTEGER) - (b.latestVerified?.progress_percentage ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 5);
  const stagnantIndicators = portfolio
    .filter((item) => {
      const latest = item.latestVerified;
      return Boolean(latest && latest.baseline_value !== null && latest.measured_value === latest.baseline_value);
    })
    .slice(0, 5);

  const programmeMap = new Map<string, {
    label: string;
    indicators: Set<string>;
    outcomeAreas: Set<string>;
    verified: Set<string>;
  }>();
  for (const item of portfolio) {
    const programmeId = item.definition.programme_id ?? item.latest?.programme_id;
    const programmeName = item.definition.impact_programmes?.name ?? item.latest?.impact_programmes?.name;
    if (!programmeId || !programmeName) continue;
    const current = programmeMap.get(programmeId) ?? {
      label: programmeName,
      indicators: new Set<string>(),
      outcomeAreas: new Set<string>(),
      verified: new Set<string>(),
    };
    current.indicators.add(item.definition.id);
    current.outcomeAreas.add(item.definition.indicator_type);
    if (item.latestVerified) current.verified.add(item.definition.id);
    programmeMap.set(programmeId, current);
  }
  const programmeImpact = Array.from(programmeMap.entries())
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => b.indicators.size - a.indicators.size || a.label.localeCompare(b.label));

  const reportingBlockers = portfolio.filter((item) => Boolean(item.latestVerified) && item.reportReady === false);
  const unsupportedOutcomeClaims = verifiedMeasurements.filter((item) =>
    ["achieved", "exceeded", "on_track"].includes(item.outcome_status)
    && (!item.evidence_id || !verifiedEvidenceIds.has(item.evidence_id)),
  );
  const unverifiedMeasurements = measurements.filter((item) => item.verification_status !== "verified");
  const staleIndicatorCount: number | null = null;

  const recentActivity = [
    ...definitions.map((item) => ({
      type: "Indicator created",
      title: item.name,
      createdAt: item.created_at,
      icon: Target,
      href: `${ROUTE}#indicator-${item.id}`,
    })),
    ...measurements.filter((item) => item.submitted_at).map((item) => ({
      type: "Measurement submitted",
      title: item.impact_indicator_definitions?.name ?? "Indicator measurement",
      createdAt: item.submitted_at,
      icon: FileClock,
      href: `${ROUTE}#measurement-${item.id}`,
    })),
    ...measurements.filter((item) => item.verification_status === "returned" && item.updated_at).map((item) => ({
      type: "Measurement returned",
      title: item.impact_indicator_definitions?.name ?? "Indicator measurement",
      createdAt: item.updated_at,
      icon: RotateCcw,
      href: `${ROUTE}#measurement-${item.id}`,
    })),
    ...measurements.filter((item) => item.verified_at).map((item) => ({
      type: "Measurement verified",
      title: item.impact_indicator_definitions?.name ?? "Indicator measurement",
      createdAt: item.verified_at,
      icon: ShieldCheck,
      href: `${ROUTE}#measurement-${item.id}`,
    })),
    ...measurements.filter((item) => item.evidence_id).map((item) => ({
      type: "Evidence linked",
      title: item.impact_indicator_definitions?.name ?? "Indicator measurement",
      createdAt: item.updated_at ?? item.created_at,
      icon: Link2,
      href: canAccessRoute(ctx.role, `/dashboard/impact-intelligence/evidence/${item.evidence_id}`)
        ? `/dashboard/impact-intelligence/evidence/${item.evidence_id}`
        : `${ROUTE}#measurement-${item.id}`,
    })),
    ...reports.filter((item) => item.latest_version?.generated_at ?? item.generated_at ?? item.created_at).map((item) => ({
      type: "Report generated",
      title: item.title,
      createdAt: item.latest_version?.generated_at ?? item.generated_at ?? item.created_at,
      icon: FileCheck2,
      href: canAccessRoute(ctx.role, `/dashboard/impact-intelligence/reports/${item.id}`)
        ? `/dashboard/impact-intelligence/reports/${item.id}`
        : ROUTE,
    })),
  ]
    .filter((item) => Boolean(item.createdAt))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 8);

  const freshness = latestDate([
    ...definitions.map((item) => item.updated_at ?? item.created_at),
    ...measurements.map((item) => item.verified_at ?? item.updated_at ?? item.created_at),
    ...reports.map((item) => item.latest_version?.generated_at ?? item.generated_at ?? item.created_at),
    ...evidenceSource.data.map((item) => item.reviewed_at ?? item.uploaded_at ?? item.created_at),
  ]);
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Indicators</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Outcome &amp; Indicator Measurement Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Executive outcome health, measurement verification, evidence support, programme impact, and reporting assurance.
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
              {canCreateDefinitions && !optionsError && (
                <Link href="#create-indicator" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white hover:bg-[#132d60]">
                  <Plus className="h-4 w-4" /> Create Indicator
                </Link>
              )}
              {canCreateMeasurements && !optionsError && activeDefinitions.length > 0 && (
                <Link href="#add-measurement" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <ClipboardCheck className="h-4 w-4" /> Add Measurement
                </Link>
              )}
              {canReviewMeasurements && (
                <Link href="#review-queue" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <ShieldCheck className="h-4 w-4" /> Review Queue
                </Link>
              )}
              {canViewReports && (
                <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <BarChart3 className="h-4 w-4" /> View Reports
                </Link>
              )}
              <span title={`${ctx.fullName ?? roleLabel(ctx.role)} · ${roleLabel(ctx.role)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initials(ctx.fullName, ctx.role)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_75%_25%,rgba(16,185,129,0.32),transparent_27%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="indicator-hero-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#5eead4" strokeOpacity=".35" /></pattern></defs>
            <path d="M510 25h310v220H510z" fill="url(#indicator-hero-grid)" />
            <path d="m500 220 80-70 60 25 65-95 70 30 50-60" fill="none" stroke="#5eead4" strokeOpacity=".65" strokeWidth="2" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Outcome assurance overview</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">From indicator definition to evidence-backed, report-ready impact</h2>
              <p className="mt-2 text-sm text-blue-100/80">Scoped records only. Verified measurements remain visually and analytically distinct.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total Indicators", value: definitionsSource.available ? formatCount(definitions.length) : UNAVAILABLE, icon: Target, color: "text-cyan-300" },
              { label: "Active Indicators", value: definitionsSource.available ? formatCount(activeDefinitions.length) : UNAVAILABLE, icon: Activity, color: "text-emerald-300" },
              { label: "Verified Measurements", value: measurementsSource.available ? formatCount(verifiedMeasurements.length) : UNAVAILABLE, icon: ShieldCheck, color: "text-violet-300" },
              { label: "Outcome Readiness", value: formatPercent(outcomeReadiness), icon: Gauge, color: "text-amber-300" },
              { label: "Reporting Readiness", value: formatPercent(reportingReadiness), icon: FileCheck2, color: "text-blue-300" },
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

      {query.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
      {query.success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.success}</div>}
      {optionsError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Indicator action forms are temporarily unavailable, but loaded outcome records remain visible.</div>}
      {loadError && (
        <Section title="Indicators Unavailable">
          <EmptyState
            title="Indicator records could not load"
            description="Definition and measurement sources are temporarily unavailable. Reports and other Impact Intelligence modules remain accessible."
            icon={Target}
          />
        </Section>
      )}
      {(!definitionsSource.available || !measurementsSource.available || !evidenceSource.available || (canViewReports && !reportsSource.available)) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p><span className="font-semibold">Partial source availability:</span> unavailable metrics are explicitly labelled and available sections remain operational.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
        <MetricCard label="Total Indicators" value={definitionsSource.available ? formatCount(definitions.length) : UNAVAILABLE} icon={Target} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Active Indicators" value={definitionsSource.available ? formatCount(activeDefinitions.length) : UNAVAILABLE} icon={Activity} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Archived Indicators" value={definitionsSource.available ? formatCount(archivedDefinitions.length) : UNAVAILABLE} icon={Layers3} tone="bg-slate-100 text-slate-600" />
        <MetricCard label="Measurements" value={measurementsSource.available ? formatCount(measurements.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Verified Measurements" value={measurementsSource.available ? formatCount(verifiedMeasurements.length) : UNAVAILABLE} icon={ShieldCheck} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Outcome Achievement" value={formatPercent(outcomeAchievement)} icon={TrendingUp} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Reporting Ready" value={reportsSource.available ? formatCount(reportingReadyIndicators.length) : UNAVAILABLE} icon={FileCheck2} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Risk Indicators" value={measurementsSource.available ? formatCount(riskIndicators.length) : UNAVAILABLE} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="Evidence Supported" value={measurementsSource.available ? formatCount(evidenceSupportedIndicators.length) : UNAVAILABLE} icon={Link2} tone="bg-cyan-100 text-cyan-700" />
      </div>

      <Section title="Outcome Verification Pipeline" description="Lifecycle counts from the visible scoped indicator and measurement records. The lowest available stage is highlighted as the current bottleneck.">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {pipeline.map((item, index) => {
            const isBottleneck = item.available && bottleneckValue !== null && item.value === bottleneckValue && definitions.length > 0;
            return (
              <article key={item.label} className={cn("relative overflow-hidden rounded-xl border bg-slate-50/70 p-3", isBottleneck ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200")}>
                <div className={cn("absolute inset-x-0 top-0 h-1", item.color)} />
                <p className="mt-1 text-lg font-bold text-[#0c1733]">{item.available ? formatCount(item.value) : UNAVAILABLE}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-700">{item.label}</p>
                <p className="mt-1 text-[9px] leading-4 text-slate-400">{isBottleneck ? "Current lowest stage" : item.available ? "Loaded lifecycle state" : "Source unavailable"}</p>
                {index < pipeline.length - 1 && <ArrowRight className="absolute right-1 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-slate-300 xl:block" />}
              </article>
            );
          })}
        </div>
      </Section>

      <Section title="Indicator Portfolio" description="Latest verified performance is used for outcome health. Definitions without verified measurements remain unavailable rather than inferred.">
        {definitions.length === 0 ? (
          <EmptyState title="No indicator definitions" description={scopeEmptyMessage ?? (canCreateDefinitions ? "Create the first measurable outcome definition." : "No indicators are visible within the current programme scope.")} icon={Target} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {portfolio.map((item) => {
              const latest = item.latestVerified ?? item.latest;
              const verified = item.latestVerified?.verification_status === "verified";
              return (
                <article
                  id={`indicator-${item.definition.id}`}
                  key={item.definition.id}
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm",
                    verified ? "border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 ring-1 ring-emerald-100" : "border-slate-200 bg-white",
                    item.evidenceSupported === false && "border-amber-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-[#0c1733]">{item.definition.name}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-500">{item.definition.impact_programmes?.name ?? latest?.impact_programmes?.name ?? "Portfolio-level"} · {displayStatus(item.definition.indicator_type)}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-3">
                    <div><p className="text-[9px] font-semibold text-slate-400">Baseline</p><p className="mt-1 text-xs font-bold text-slate-800">{formatNumber(latest?.baseline_value, item.definition.unit_of_measure)}</p></div>
                    <div><p className="text-[9px] font-semibold text-slate-400">Current</p><p className="mt-1 text-xs font-bold text-slate-800">{formatNumber(latest?.measured_value, item.definition.unit_of_measure)}</p></div>
                    <div><p className="text-[9px] font-semibold text-slate-400">Target</p><p className="mt-1 text-xs font-bold text-slate-800">{formatNumber(latest?.target_value, item.definition.unit_of_measure)}</p></div>
                  </div>
                  <div className="mt-4"><ProgressValue value={latest?.progress_percentage ?? null} tone={item.health === "At Risk" ? "bg-rose-500" : item.health === "Watchlist" ? "bg-amber-500" : "bg-emerald-500"} /></div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", verificationTone(latest?.verification_status ?? "unavailable"))}>{latest ? displayStatus(latest.verification_status) : "No Measurement"}</span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", item.evidenceSupported ? "bg-cyan-50 text-cyan-700 ring-cyan-200" : "bg-amber-50 text-amber-700 ring-amber-200")}>{item.evidenceSupported === null ? UNAVAILABLE : item.evidenceSupported ? "Evidence Supported" : "Evidence Gap"}</span>
                    {item.reportReady === true && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-bold text-indigo-700 ring-1 ring-indigo-200">Report Ready</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Outcome Performance Centre" description="Verified performance groupings only.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Top performing", value: topPerforming.length, items: topPerforming, icon: TrendingUp, tone: "text-emerald-700 bg-emerald-50" },
              { label: "Underperforming", value: underperforming.length, items: underperforming, icon: TrendingDown, tone: "text-rose-700 bg-rose-50" },
              { label: "Stagnant", value: stagnantIndicators.length, items: stagnantIndicators, icon: Activity, tone: "text-amber-700 bg-amber-50" },
              { label: "Without measurements", value: indicatorsWithoutMeasurements.length, items: indicatorsWithoutMeasurements, icon: FileWarning, tone: "text-slate-700 bg-slate-100" },
            ].map((group) => {
              const Icon = group.icon;
              return (
                <article key={group.label} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className={cn("grid h-9 w-9 place-items-center rounded-xl", group.tone)}><Icon className="h-4 w-4" /></span>
                    <span className="text-xl font-bold text-[#0c1733]">{measurementsSource.available ? group.value : UNAVAILABLE}</span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-700">{group.label}</p>
                  <div className="mt-3 space-y-2">
                    {group.items.slice(0, 3).map((item) => <p key={item.definition.id} className="truncate text-[10px] text-slate-500">{item.definition.name}</p>)}
                    {group.items.length === 0 && <p className="text-[10px] text-slate-400">No matching indicators.</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </Section>

        <Section id="review-queue" title="Measurement Assurance Centre" description="Current verification states and latest recorded measurement dates.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Verified", value: verifiedMeasurements.length, icon: ShieldCheck, tone: "bg-emerald-100 text-emerald-700" },
              { label: "Submitted", value: submittedMeasurements.length, icon: FileClock, tone: "bg-blue-100 text-blue-700" },
              { label: "Returned", value: returnedMeasurements.length, icon: RotateCcw, tone: "bg-amber-100 text-amber-700" },
              { label: "Rejected", value: rejectedMeasurements.length, icon: XCircle, tone: "bg-rose-100 text-rose-700" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-200 p-3">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-xl", item.tone)}><Icon className="h-3.5 w-3.5" /></span>
                  <p className="mt-3 text-xl font-bold text-[#0c1733]">{measurementsSource.available ? formatCount(item.value) : UNAVAILABLE}</p>
                  <p className="text-[10px] font-semibold text-slate-500">{item.label}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-4 space-y-3">
            {measurements.slice(0, 6).map((item) => (
              <article id={`measurement-${item.id}`} key={item.id} className={cn("rounded-xl border p-3", item.verification_status === "verified" ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200")}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">{item.impact_indicator_definitions?.name ?? "Indicator measurement"}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Latest measurement {formatDate(item.measurement_date)} · {displayStatus(item.source_type)}</p>
                  </div>
                  <span className={cn("w-fit rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", verificationTone(item.verification_status))}>{displayStatus(item.verification_status)}</span>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-slate-500">
                  Readiness: {item.verification_status === "verified" ? (approvedReportMeasurementIds.has(item.id) ? "Report ready" : "Verified") : item.verification_status === "submitted" ? "Awaiting review" : "Not verified"}
                </p>
                <MeasurementActions ctx={ctx} measurement={item} />
              </article>
            ))}
            {measurements.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">No measurements are visible in the current scope.</p>}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Evidence Support Centre" description="Direct measurement evidence relationships only. No evidence support is inferred from programme proximity.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Indicators with verified evidence", value: evidenceSupportedIndicators.length, tone: "text-emerald-700" },
              { label: "Indicators lacking evidence", value: indicatorsLackingEvidence.length, tone: "text-amber-700" },
              { label: "Evidence-backed measurements", value: verifiedMeasurements.filter((item) => Boolean(item.evidence_id && verifiedEvidenceIds.has(item.evidence_id))).length, tone: "text-cyan-700" },
              { label: "Unsupported outcome claims", value: unsupportedOutcomeClaims.length, tone: "text-rose-700" },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <p className={cn("text-2xl font-bold", item.tone)}>{measurementsSource.available && evidenceSource.available ? formatCount(item.value) : UNAVAILABLE}</p>
                <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">{item.label}</p>
              </article>
            ))}
          </div>
          {indicatorsLackingEvidence.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-900">Evidence attention required</p>
              <p className="mt-1 text-[10px] leading-4 text-amber-800">{indicatorsLackingEvidence.length} visible indicator{indicatorsLackingEvidence.length === 1 ? "" : "s"} currently have no verified measurement with a direct evidence link.</p>
            </div>
          )}
        </Section>

        <Section title="Programme Impact Centre" description="Indicator distribution, outcome-area coverage, and verified indicator coverage by programme.">
          <div className="grid gap-5 md:grid-cols-3">
            <DistributionBars items={programmeImpact.map((item) => ({ label: item.label, value: item.indicators.size }))} emptyText="No programme-linked indicators are available." tone="bg-blue-500" />
            <DistributionBars items={programmeImpact.map((item) => ({ label: item.label, value: item.outcomeAreas.size }))} emptyText="Outcome-area coverage is unavailable." tone="bg-violet-500" />
            <DistributionBars items={programmeImpact.map((item) => ({ label: item.label, value: item.verified.size }))} emptyText="No verified programme indicators are available." tone="bg-emerald-500" />
          </div>
        </Section>
      </div>

      <Section title="Outcome Health Matrix" description="Executive scanning view using the latest verified measurement for each indicator.">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1120px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
              <tr>
                {["Indicator", "Baseline", "Target", "Current", "Progress", "Measurement Status", "Evidence Support", "Report Ready", "Health"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {portfolio.map((item) => {
                const latest = item.latestVerified ?? item.latest;
                return (
                  <tr key={item.definition.id} className={cn("border-t border-slate-100", item.latestVerified && "bg-emerald-50/20")}>
                    <td className="px-3 py-3"><p className="max-w-[240px] font-bold text-slate-800">{item.definition.name}</p><p className="mt-1 text-[9px] text-slate-400">{item.definition.impact_programmes?.name ?? "Portfolio-level"}</p></td>
                    <td className="px-3 py-3 text-slate-600">{formatNumber(latest?.baseline_value, item.definition.unit_of_measure)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatNumber(latest?.target_value, item.definition.unit_of_measure)}</td>
                    <td className="px-3 py-3 font-bold text-slate-800">{formatNumber(latest?.measured_value, item.definition.unit_of_measure)}</td>
                    <td className="px-3 py-3"><ProgressValue value={latest?.progress_percentage ?? null} /></td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", verificationTone(latest?.verification_status ?? "unavailable"))}>{latest ? displayStatus(latest.verification_status) : UNAVAILABLE}</span></td>
                    <td className="px-3 py-3">{item.evidenceSupported === null ? UNAVAILABLE : item.evidenceSupported ? "Supported" : <span className="font-bold text-amber-700">Gap</span>}</td>
                    <td className="px-3 py-3">{item.reportReady === null ? UNAVAILABLE : item.reportReady ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : "No"}</td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Risks &amp; Exceptions Centre" description="Current, observable conditions only. Staleness remains unavailable because no governed freshness threshold exists in the loaded data.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Without measurements", value: definitionsSource.available && measurementsSource.available ? indicatorsWithoutMeasurements.length : null, icon: FileWarning, tone: "bg-amber-100 text-amber-700" },
              { label: "Unverified measurements", value: measurementsSource.available ? unverifiedMeasurements.length : null, icon: FileClock, tone: "bg-blue-100 text-blue-700" },
              { label: "Evidence gaps", value: measurementsSource.available && evidenceSource.available ? indicatorsLackingEvidence.length : null, icon: Link2, tone: "bg-violet-100 text-violet-700" },
              { label: "Reporting blockers", value: reportsSource.available ? reportingBlockers.length : null, icon: FileWarning, tone: "bg-rose-100 text-rose-700" },
              { label: "Stale indicators", value: staleIndicatorCount, icon: Activity, tone: "bg-slate-200 text-slate-700" },
              { label: "Draft measurements", value: measurementsSource.available ? draftMeasurements.length : null, icon: ClipboardCheck, tone: "bg-slate-100 text-slate-600" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span>
                  <p className="mt-4 text-xl font-bold text-[#0c1733]">{formatCount(item.value)}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p>
                </article>
              );
            })}
          </div>
        </Section>

        <Section title="Activity Timeline" description="Real definition, measurement, evidence-link, and report timestamps only.">
          {recentActivity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">No dated indicator activity is available.</p>
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
                      <p className="mt-1 text-[10px] text-slate-400">{formatFreshness(item.createdAt)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <Section title="Executive Outcome Summary" description="Consolidated health based only on currently available scoped indicator, measurement, evidence, and reporting relationships.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Outcome Health", value: knownHealth.length > 0 ? ratio(healthyIndicators.length, knownHealth.length) : null, health: summaryHealth(knownHealth.length > 0 ? ratio(healthyIndicators.length, knownHealth.length) : null), icon: Activity, tone: "bg-blue-50 text-blue-700" },
            { label: "Verification Health", value: verificationReadiness, health: summaryHealth(verificationReadiness), icon: ShieldCheck, tone: "bg-violet-50 text-violet-700" },
            { label: "Evidence Support", value: evidenceReadiness, health: summaryHealth(evidenceReadiness), icon: Link2, tone: "bg-emerald-50 text-emerald-700" },
            { label: "Reporting Readiness", value: reportingReadiness, health: summaryHealth(reportingReadiness), icon: FileCheck2, tone: "bg-indigo-50 text-indigo-700" },
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
                <div className="mt-4"><ProgressValue value={item.value} /></div>
              </article>
            );
          })}
        </div>
      </Section>

      {canCreateDefinitions && !optionsError && (
        <Section id="create-indicator" title="Create Indicator" description="Create a definition within the existing governed programme, cohort, and intervention scope.">
          <DefinitionForm options={options} />
        </Section>
      )}

      {canCreateMeasurements && !optionsError && activeDefinitions.length > 0 && (
        <Section id="add-measurement" title="Add Measurement" description="Record a draft measurement using the existing scoped sources and verification workflow.">
          <MeasurementForm definitions={definitions} options={options} />
        </Section>
      )}
    </section>
  );
}
