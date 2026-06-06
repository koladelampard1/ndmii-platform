import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { AlertTriangle, BarChart3, ClipboardCheck, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  INDICATOR_CALCULATION_METHODS,
  INDICATOR_DEFINITION_MANAGE_ROLES,
  INDICATOR_DEFINITION_STATUSES,
  INDICATOR_DIRECTIONS,
  INDICATOR_MEASUREMENT_CREATE_ROLES,
  INDICATOR_MEASUREMENT_VERIFY_ROLES,
  INDICATOR_SOURCE_TYPES,
  aggregateIndicatorMeasurements,
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
import { EmptyState, ImpactPageHeader, MetricTile, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";

type SearchParams = {
  error?: string;
  success?: string;
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
  redirect(`/dashboard/impact-intelligence/indicators?${params.toString()}`);
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
  if (typeof value !== "number") return "Not set";
  return `${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function progressLabel(value: number | null) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "Unavailable";
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
  const canSubmit = (INDICATOR_MEASUREMENT_CREATE_ROLES as readonly string[]).includes(ctx.role) && ["draft", "returned"].includes(measurement.verification_status);
  const canVerify = (INDICATOR_MEASUREMENT_VERIFY_ROLES as readonly string[]).includes(ctx.role) && measurement.verification_status === "submitted";
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
  let ctx: UserContext | null = null;
  let definitions: ImpactIndicatorDefinition[] = [];
  let measurements: ImpactIndicatorMeasurement[] = [];
  let options = EMPTY_OPTIONS;
  let loadError: string | null = null;
  let optionsError: string | null = null;

  try {
    ctx = await getCurrentUserContext();
    [definitions, measurements] = await Promise.all([
      listIndicatorDefinitions(ctx, { limit: 150 }),
      listIndicatorMeasurements(ctx, { limit: 150 }),
    ]);
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
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Impact indicators are temporarily unavailable.";
    logImpactIndicatorDiagnostic({
      operation: "indicators_page_load_failed",
      role: ctx?.role ?? null,
      authUserId: ctx?.authUserId ?? null,
      appUserId: ctx?.appUserId ?? null,
      errorMessage: loadError,
      success: false,
    });
  }

  const aggregate = aggregateIndicatorMeasurements(definitions, measurements);
  const canCreateDefinitions = Boolean(ctx && (INDICATOR_DEFINITION_MANAGE_ROLES as readonly string[]).includes(ctx.role) && !optionsError);
  const canCreateMeasurements = Boolean(ctx && (INDICATOR_MEASUREMENT_CREATE_ROLES as readonly string[]).includes(ctx.role) && !optionsError);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Outcome measurement"
        title="Impact Indicators"
        description="Define measurable programme outcomes, record baseline and follow-up values, and separate verified official impact from draft operational claims."
        badge={`${definitions.length} definitions`}
        actions={[{ href: "/dashboard/impact-intelligence/reports", label: "Reports", icon: BarChart3 }]}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p><span className="font-semibold">Verification boundary:</span> only verified measurements count as official impact or appear in verified aggregates.</p>
        </div>
      </div>

      {loadError && (
        <SectionCard title="Indicators Unavailable">
          <EmptyState title="Indicator records could not load" description="The indicator source, session, permissions, or deployed schema is temporarily unavailable. Other Impact Intelligence modules remain accessible." icon={Target} />
        </SectionCard>
      )}

      {!loadError && query.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
      {!loadError && query.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.success}</div>}
      {!loadError && optionsError && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Definition and measurement forms are temporarily unavailable, but existing indicator records remain visible.</div>}

      {!loadError && (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricTile label="Definitions" value={aggregate.definitionCount} detail="All visible definitions" icon={Target} tone="emerald" />
            <MetricTile label="Verified records" value={aggregate.verifiedMeasurementCount} detail="Official measurement history" tone="emerald" />
            <MetricTile label="Average progress" value={progressLabel(aggregate.averageProgressPercentage)} detail="Latest verified values only" tone="blue" />
            <MetricTile label="Achieved" value={aggregate.achievedCount} detail="Achieved or exceeded" tone="emerald" />
            <MetricTile label="On track" value={aggregate.onTrackCount} tone="blue" />
            <MetricTile label="Attention" value={aggregate.belowTargetCount + aggregate.regressedCount} detail={`${aggregate.regressedCount} regressed`} tone="amber" />
          </div>

          {canCreateDefinitions && (
            <SectionCard title="Create indicator definition">
              <DefinitionForm options={options} />
            </SectionCard>
          )}

          {canCreateMeasurements && definitions.some((item) => item.status === "active") && (
            <SectionCard title="Record measurement">
              <MeasurementForm definitions={definitions} options={options} />
            </SectionCard>
          )}

          <SectionCard title="Indicator Definitions">
            {definitions.length === 0 ? (
              <EmptyState title="No indicator definitions" description={canCreateDefinitions ? "Create the first measurable outcome definition for a programme, cohort, or intervention." : "Indicator definitions will appear here when programme officers activate them."} icon={Target} />
            ) : (
              <TableShell>
                <table className={tableClassName}>
                  <thead className={tableHeadClassName}>
                    <tr><th className="px-4 py-3">Indicator</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Direction</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Status</th></tr>
                  </thead>
                  <tbody>
                    {definitions.map((item) => (
                      <tr key={item.id} className={tableRowClassName}>
                        <td className={tableCellClassName}><p className="font-medium text-slate-950">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.description ?? "No definition note."}</p></td>
                        <td className={`${tableCellClassName} text-slate-600`}>{item.impact_interventions?.title ?? item.impact_beneficiary_cohorts?.name ?? item.impact_programmes?.name ?? "Portfolio"}</td>
                        <td className={`${tableCellClassName} text-slate-600`}>{item.unit_of_measure}</td>
                        <td className={`${tableCellClassName} text-slate-600`}>{item.direction_of_improvement}</td>
                        <td className={`${tableCellClassName} text-slate-600`}>{item.calculation_method.replaceAll("_", " ")}</td>
                        <td className={tableCellClassName}><StatusBadge value={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            )}
          </SectionCard>

          <SectionCard title="Recent Measurements">
            {measurements.length === 0 ? (
              <EmptyState title="No measurements recorded" description="Baseline, target, and follow-up values will appear here once measurements are captured." icon={ClipboardCheck} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {measurements.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{item.impact_indicator_definitions?.name ?? "Indicator measurement"}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.impact_programmes?.name ?? "Programme"} · {item.msmes?.business_name ?? item.impact_beneficiary_cohorts?.name ?? "Aggregate"} · {formatDate(item.measurement_date)}</p>
                      </div>
                      <StatusBadge value={item.verification_status} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><p className="text-xs text-slate-500">Baseline</p><p className="mt-1 font-medium text-slate-950">{formatNumber(item.baseline_value, item.impact_indicator_definitions?.unit_of_measure)}</p></div>
                      <div><p className="text-xs text-slate-500">Current</p><p className="mt-1 font-medium text-slate-950">{formatNumber(item.measured_value, item.impact_indicator_definitions?.unit_of_measure)}</p></div>
                      <div><p className="text-xs text-slate-500">Target</p><p className="mt-1 font-medium text-slate-950">{formatNumber(item.target_value, item.impact_indicator_definitions?.unit_of_measure)}</p></div>
                      <div><p className="text-xs text-slate-500">Progress</p><p className="mt-1 font-medium text-slate-950">{progressLabel(item.progress_percentage)}</p></div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge value={item.outcome_status} />
                      <span className="text-xs text-slate-500">{item.source_type.replaceAll("_", " ")}</span>
                      {item.assessment_id && <Link href={`/dashboard/impact-intelligence/assessments/${item.assessment_id}`} className="text-xs font-medium text-emerald-700">Assessment</Link>}
                      {item.field_visit_id && <Link href={`/dashboard/impact-intelligence/monitoring/${item.field_visit_id}`} className="text-xs font-medium text-emerald-700">Field visit</Link>}
                    </div>
                    {ctx && <MeasurementActions ctx={ctx} measurement={item} />}
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </section>
  );
}
