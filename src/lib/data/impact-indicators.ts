import type { UserContext } from "@/lib/auth/authorization";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  applyProgrammeScope,
  enforceProgrammeReadAccess,
  getProgrammeScopeFilter,
  logProgrammeScopeShadowDecision,
} from "@/lib/impact-intelligence/access-scope";
import { requireRolePermission } from "@/lib/impact-intelligence/permissions";

export const INDICATOR_DEFINITION_STATUSES = ["draft", "active", "archived"] as const;
export const INDICATOR_DIRECTIONS = ["increase", "decrease", "maintain"] as const;
export const INDICATOR_CALCULATION_METHODS = ["manual", "assessment_score", "field_observation", "evidence_count", "derived"] as const;
export const INDICATOR_SOURCE_TYPES = ["manual", "assessment_score", "field_visit", "evidence", "imported"] as const;
export const INDICATOR_VERIFICATION_STATUSES = ["draft", "submitted", "verified", "rejected", "returned"] as const;
export const INDICATOR_OUTCOME_STATUSES = ["no_baseline", "below_target", "on_track", "achieved", "exceeded", "regressed"] as const;

export const INDICATOR_READ_ROLES = ["admin", "super_admin", "boi_executive", "data_analyst", "programme_officer", "assessment_officer", "field_officer", "auditor"] as const;
export const INDICATOR_DEFINITION_MANAGE_ROLES = ["super_admin"] as const;
export const INDICATOR_MEASUREMENT_CREATE_ROLES = ["super_admin", "assessment_officer", "field_officer"] as const;
export const INDICATOR_MEASUREMENT_VERIFY_ROLES = ["admin", "super_admin", "assessment_officer"] as const;

export type IndicatorDirection = (typeof INDICATOR_DIRECTIONS)[number];
export type IndicatorOutcomeStatus = (typeof INDICATOR_OUTCOME_STATUSES)[number];
export type IndicatorSourceType = (typeof INDICATOR_SOURCE_TYPES)[number];
export type IndicatorVerificationStatus = (typeof INDICATOR_VERIFICATION_STATUSES)[number];

export type ImpactIndicatorDefinition = {
  id: string;
  programme_id: string | null;
  cohort_id: string | null;
  intervention_id: string | null;
  name: string;
  description: string | null;
  unit_of_measure: string;
  indicator_type: string;
  direction_of_improvement: IndicatorDirection;
  calculation_method: string;
  measurement_frequency: string | null;
  baseline_required: boolean;
  target_required: boolean;
  owner_user_id: string | null;
  status: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  impact_programmes?: { id: string; name: string; programme_code: string | null } | null;
  impact_beneficiary_cohorts?: { id: string; name: string; programme_id: string } | null;
  impact_interventions?: { id: string; title: string; programme_id: string | null; cohort_id: string | null } | null;
  owner?: { id: string; full_name: string | null; email: string | null } | null;
};

export type ImpactIndicatorMeasurement = {
  id: string;
  indicator_definition_id: string;
  programme_id: string;
  cohort_id: string | null;
  cohort_member_id: string | null;
  msme_id: string | null;
  intervention_id: string | null;
  assessment_id: string | null;
  assessment_score_run_id: string | null;
  field_visit_id: string | null;
  evidence_id: string | null;
  reporting_period_start: string | null;
  reporting_period_end: string | null;
  measurement_date: string;
  baseline_value: number | null;
  target_value: number | null;
  measured_value: number;
  progress_percentage: number | null;
  outcome_status: IndicatorOutcomeStatus;
  source_type: string;
  verification_status: IndicatorVerificationStatus;
  submitted_by_user_id: string | null;
  submitted_at: string | null;
  verified_by_user_id: string | null;
  verified_at: string | null;
  review_note: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  impact_indicator_definitions?: Pick<ImpactIndicatorDefinition, "id" | "name" | "unit_of_measure" | "direction_of_improvement"> | null;
  impact_programmes?: { id: string; name: string; programme_code: string | null } | null;
  impact_beneficiary_cohorts?: { id: string; name: string } | null;
  impact_cohort_members?: { id: string; member_status: string; msme_id: string } | null;
  impact_interventions?: { id: string; title: string } | null;
  impact_assessments?: { id: string; title: string | null; assessment_type: string | null } | null;
  impact_field_visits?: { id: string; title: string | null; status: string | null } | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null } | null;
};

export type IndicatorAggregate = {
  definitionCount: number;
  verifiedMeasurementCount: number;
  latestMeasurementCount: number;
  averageProgressPercentage: number | null;
  achievedCount: number;
  onTrackCount: number;
  belowTargetCount: number;
  regressedCount: number;
};

export type IndicatorFormOptions = {
  programmes: Array<{ id: string; name: string; programme_code: string | null }>;
  cohorts: Array<{ id: string; programme_id: string; name: string }>;
  members: Array<{ id: string; programme_id: string; cohort_id: string; msme_id: string; member_status: string; msmes: { id: string; business_name: string | null; msme_id: string | null } | null }>;
  interventions: Array<{ id: string; programme_id: string; cohort_id: string | null; cohort_member_id: string | null; msme_id: string | null; title: string }>;
  assessments: Array<{ id: string; programme_id: string | null; cohort_id: string | null; cohort_member_id: string | null; intervention_id: string | null; msme_id: string | null; title: string | null; assessment_type: string | null }>;
  scoreRuns: Array<{ id: string; assessment_id: string; weighted_score: number; readiness_category: string | null; calculated_at: string }>;
  visits: Array<{ id: string; programme_id: string | null; cohort_id: string | null; cohort_member_id: string | null; intervention_id: string | null; assessment_id: string | null; msme_id: string | null; title: string | null; status: string | null }>;
  users: Array<{ id: string; full_name: string | null; email: string | null; role: string | null }>;
};

type IndicatorFilters = {
  limit?: number;
  programmeId?: string | null;
  cohortId?: string | null;
  cohortMemberId?: string | null;
  interventionId?: string | null;
  assessmentId?: string | null;
  assessmentScoreRunId?: string | null;
  fieldVisitId?: string | null;
  definitionId?: string | null;
  verificationStatus?: string | null;
};

const DEFINITION_SELECT =
  "id,programme_id,cohort_id,intervention_id,name,description,unit_of_measure,indicator_type,direction_of_improvement,calculation_method,measurement_frequency,baseline_required,target_required,owner_user_id,status,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code),impact_beneficiary_cohorts(id,name,programme_id),impact_interventions(id,title,programme_id,cohort_id),owner:users!impact_indicator_definitions_owner_user_id_fkey(id,full_name,email)";

const MEASUREMENT_SELECT =
  "id,indicator_definition_id,programme_id,cohort_id,cohort_member_id,msme_id,intervention_id,assessment_id,assessment_score_run_id,field_visit_id,evidence_id,reporting_period_start,reporting_period_end,measurement_date,baseline_value,target_value,measured_value,progress_percentage,outcome_status,source_type,verification_status,submitted_by_user_id,submitted_at,verified_by_user_id,verified_at,review_note,created_by_user_id,created_at,updated_at,metadata,impact_indicator_definitions(id,name,unit_of_measure,direction_of_improvement),impact_programmes(id,name,programme_code),impact_beneficiary_cohorts(id,name),impact_cohort_members(id,member_status,msme_id),impact_interventions(id,title),impact_assessments(id,title,assessment_type),impact_field_visits(id,title,status),msmes(id,business_name,msme_id)";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "yes";
}

function numericValue(formData: FormData, key: string, required = false) {
  const raw = textValue(formData, key);
  if (!raw) {
    if (required) throw new Error(`${key.replaceAll("_", " ")} is required.`);
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${key.replaceAll("_", " ")} must be numeric.`);
  return value;
}

function requireRole(ctx: UserContext, roles: readonly string[], message: string) {
  if (!ctx.appUserId || !roles.includes(ctx.role)) throw new Error(message);
}

export function logImpactIndicatorDiagnostic(payload: {
  operation: string;
  role?: string | null;
  authUserId?: string | null;
  appUserId?: string | null;
  programmeId?: string | null;
  cohortId?: string | null;
  interventionId?: string | null;
  assessmentId?: string | null;
  fieldVisitId?: string | null;
  indicatorDefinitionId?: string | null;
  measurementId?: string | null;
  errorMessage?: string | null;
  success?: boolean;
}) {
  console.info("[impact-indicators]", payload);
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function calculateProgressPercentage(params: {
  direction: IndicatorDirection;
  baselineValue: number | null;
  targetValue: number | null;
  measuredValue: number;
}) {
  const { direction, baselineValue, targetValue, measuredValue } = params;
  if (baselineValue === null || targetValue === null) return null;

  let progress: number;
  if (direction === "increase") {
    const denominator = targetValue - baselineValue;
    if (denominator <= 0) return null;
    progress = ((measuredValue - baselineValue) / denominator) * 100;
  } else if (direction === "decrease") {
    const denominator = baselineValue - targetValue;
    if (denominator <= 0) return null;
    progress = ((baselineValue - measuredValue) / denominator) * 100;
  } else {
    const initialDistance = Math.abs(baselineValue - targetValue);
    if (initialDistance === 0) return measuredValue === targetValue ? 100 : 0;
    progress = (1 - Math.abs(measuredValue - targetValue) / initialDistance) * 100;
  }

  return round(Math.max(-999, Math.min(999, progress)));
}

export function calculateOutcomeStatus(params: {
  direction: IndicatorDirection;
  baselineValue: number | null;
  targetValue: number | null;
  measuredValue: number;
}): IndicatorOutcomeStatus {
  const { direction, baselineValue, targetValue, measuredValue } = params;
  if (baselineValue === null) return "no_baseline";

  if (targetValue === null) {
    if (direction === "increase") return measuredValue < baselineValue ? "regressed" : measuredValue > baselineValue ? "on_track" : "below_target";
    if (direction === "decrease") return measuredValue > baselineValue ? "regressed" : measuredValue < baselineValue ? "on_track" : "below_target";
    return measuredValue === baselineValue ? "achieved" : "regressed";
  }

  if (direction === "increase") {
    if (measuredValue < baselineValue) return "regressed";
    if (measuredValue > targetValue) return "exceeded";
    if (measuredValue === targetValue) return "achieved";
    return measuredValue > baselineValue ? "on_track" : "below_target";
  }

  if (direction === "decrease") {
    if (measuredValue > baselineValue) return "regressed";
    if (measuredValue < targetValue) return "exceeded";
    if (measuredValue === targetValue) return "achieved";
    return measuredValue < baselineValue ? "on_track" : "below_target";
  }

  if (measuredValue === targetValue) return "achieved";
  const baselineDistance = Math.abs(baselineValue - targetValue);
  const measuredDistance = Math.abs(measuredValue - targetValue);
  return measuredDistance < baselineDistance ? "on_track" : measuredDistance > baselineDistance ? "regressed" : "below_target";
}

export function aggregateIndicatorMeasurements(
  definitions: ImpactIndicatorDefinition[],
  measurements: ImpactIndicatorMeasurement[],
): IndicatorAggregate {
  const verified = measurements.filter((item) => item.verification_status === "verified");
  const latestByScope = new Map<string, ImpactIndicatorMeasurement>();
  for (const measurement of verified) {
    const scopeKey = [
      measurement.indicator_definition_id,
      measurement.programme_id,
      measurement.cohort_id ?? "",
      measurement.cohort_member_id ?? "",
      measurement.msme_id ?? "",
      measurement.intervention_id ?? "",
    ].join(":");
    const current = latestByScope.get(scopeKey);
    if (!current || `${measurement.measurement_date}:${measurement.created_at}` > `${current.measurement_date}:${current.created_at}`) {
      latestByScope.set(scopeKey, measurement);
    }
  }
  const latest = Array.from(latestByScope.values());
  const progressValues = latest.map((item) => item.progress_percentage).filter((value): value is number => typeof value === "number");
  return {
    definitionCount: definitions.length,
    verifiedMeasurementCount: verified.length,
    latestMeasurementCount: latest.length,
    averageProgressPercentage: progressValues.length > 0 ? round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) : null,
    achievedCount: latest.filter((item) => item.outcome_status === "achieved" || item.outcome_status === "exceeded").length,
    onTrackCount: latest.filter((item) => item.outcome_status === "on_track").length,
    belowTargetCount: latest.filter((item) => item.outcome_status === "below_target" || item.outcome_status === "no_baseline").length,
    regressedCount: latest.filter((item) => item.outcome_status === "regressed").length,
  };
}

async function getFieldOfficerScope(ctx: UserContext) {
  if (ctx.role !== "field_officer" || !ctx.appUserId) {
    return { visitIds: [] as string[], memberIds: [] as string[], cohortIds: [] as string[], programmeIds: [] as string[] };
  }
  const supabase = await createServiceRoleSupabaseClient();
  const [{ data: visits, error: visitError }, { data: members, error: memberError }] = await Promise.all([
    supabase.from("impact_field_visits").select("id,programme_id,cohort_id,cohort_member_id").eq("assigned_to_user_id", ctx.appUserId),
    supabase.from("impact_cohort_members").select("id,programme_id,cohort_id").eq("assigned_to_user_id", ctx.appUserId),
  ]);
  if (visitError || memberError) throw new Error("Assigned indicator scope is temporarily unavailable.");
  return {
    visitIds: (visits ?? []).map((row) => String(row.id)),
    memberIds: Array.from(new Set([...(members ?? []).map((row) => String(row.id)), ...(visits ?? []).map((row) => String(row.cohort_member_id ?? "")).filter(Boolean)])),
    cohortIds: Array.from(new Set([...(members ?? []).map((row) => String(row.cohort_id)), ...(visits ?? []).map((row) => String(row.cohort_id ?? "")).filter(Boolean)])),
    programmeIds: Array.from(new Set([...(members ?? []).map((row) => String(row.programme_id)), ...(visits ?? []).map((row) => String(row.programme_id ?? "")).filter(Boolean)])),
  };
}

export async function listIndicatorDefinitions(ctx: UserContext, filters: IndicatorFilters = {}) {
  requireRole(ctx, INDICATOR_READ_ROLES, "You do not have permission to read impact indicators.");
  const supabase = await createServiceRoleSupabaseClient();
  let query = supabase.from("impact_indicator_definitions").select(DEFINITION_SELECT).order("created_at", { ascending: false }).limit(filters.limit ?? 100);
  if (filters.programmeId) query = query.eq("programme_id", filters.programmeId);
  if (filters.cohortId) query = query.eq("cohort_id", filters.cohortId);
  if (filters.interventionId) query = query.eq("intervention_id", filters.interventionId);
  if (ctx.role === "field_officer") {
    const scope = await getFieldOfficerScope(ctx);
    if (scope.programmeIds.length === 0) return [];
    query = query.eq("status", "active").in("programme_id", scope.programmeIds);
  } else {
    await getProgrammeScopeFilter(ctx);
    query = applyProgrammeScope(query, ctx);
  }
  if (ctx.role === "boi_executive" || ctx.role === "data_analyst") query = query.eq("status", "active");
  const { data, error } = await query;
  if (error) throw new Error(`Indicator definitions unavailable: ${error.message}`);
  return (data ?? []) as unknown as ImpactIndicatorDefinition[];
}

export async function getIndicatorDefinition(ctx: UserContext, indicatorDefinitionId: string) {
  requireRole(ctx, INDICATOR_READ_ROLES, "You do not have permission to read impact indicators.");
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("impact_indicator_definitions").select(DEFINITION_SELECT).eq("id", indicatorDefinitionId).maybeSingle();
  if (error) throw new Error(`Indicator definition unavailable: ${error.message}`);
  if (data && ctx.role === "field_officer") {
    const scope = await getFieldOfficerScope(ctx);
    if (!data.programme_id || !scope.programmeIds.includes(String(data.programme_id))) throw new Error("You can only access indicators within your assigned scope.");
  }
  if (data?.programme_id && ctx.role !== "field_officer") {
    await enforceProgrammeReadAccess({ ctx, programmeId: data.programme_id, resource: "indicator_definition" });
  }
  if (data && (ctx.role === "boi_executive" || ctx.role === "data_analyst") && data.status !== "active") {
    throw new Error("This role can only access active indicator definitions.");
  }
  return data as unknown as ImpactIndicatorDefinition | null;
}

export async function createIndicatorDefinition(ctx: UserContext, formData: FormData) {
  requireRolePermission(ctx.role, "indicator", "create", "You do not have permission to create indicator definitions.");
  requireRole(ctx, INDICATOR_DEFINITION_MANAGE_ROLES, "You do not have permission to manage indicator definitions.");
  const name = textValue(formData, "name");
  const unitOfMeasure = textValue(formData, "unit_of_measure");
  if (!name) throw new Error("Indicator name is required.");
  if (!unitOfMeasure) throw new Error("Unit of measure is required.");
  const direction = textValue(formData, "direction_of_improvement") ?? "increase";
  const calculationMethod = textValue(formData, "calculation_method") ?? "manual";
  const status = textValue(formData, "status") ?? "draft";
  if (!INDICATOR_DIRECTIONS.includes(direction as IndicatorDirection)) throw new Error("Select a valid direction of improvement.");
  if (!INDICATOR_CALCULATION_METHODS.includes(calculationMethod as (typeof INDICATOR_CALCULATION_METHODS)[number])) throw new Error("Select a valid calculation method.");
  if (!INDICATOR_DEFINITION_STATUSES.includes(status as (typeof INDICATOR_DEFINITION_STATUSES)[number])) throw new Error("Select a valid indicator status.");
  await logProgrammeScopeShadowDecision({ ctx, programmeId: textValue(formData, "programme_id"), action: "write", resource: "indicator_definition", legacyAllowed: true });

  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("impact_indicator_definitions").insert({
    programme_id: textValue(formData, "programme_id"),
    cohort_id: textValue(formData, "cohort_id"),
    intervention_id: textValue(formData, "intervention_id"),
    name,
    description: textValue(formData, "description"),
    unit_of_measure: unitOfMeasure,
    indicator_type: textValue(formData, "indicator_type") ?? "outcome",
    direction_of_improvement: direction,
    calculation_method: calculationMethod,
    measurement_frequency: textValue(formData, "measurement_frequency"),
    baseline_required: booleanValue(formData, "baseline_required"),
    target_required: booleanValue(formData, "target_required"),
    owner_user_id: textValue(formData, "owner_user_id"),
    status,
    created_by_user_id: ctx.appUserId,
    metadata: { source: "indicator_phase1" },
  }).select("id").single();
  if (error) throw new Error(error.message);
  logImpactIndicatorDiagnostic({ operation: "definition_created", role: ctx.role, authUserId: ctx.authUserId, appUserId: ctx.appUserId, indicatorDefinitionId: data.id, success: true });
  return data.id as string;
}

export async function listIndicatorMeasurements(ctx: UserContext, filters: IndicatorFilters = {}) {
  requireRole(ctx, INDICATOR_READ_ROLES, "You do not have permission to read indicator measurements.");
  const supabase = await createServiceRoleSupabaseClient();
  let query = supabase.from("impact_indicator_measurements").select(MEASUREMENT_SELECT).order("measurement_date", { ascending: false }).order("created_at", { ascending: false }).limit(filters.limit ?? 100);
  if (filters.programmeId) query = query.eq("programme_id", filters.programmeId);
  if (filters.cohortId) query = query.eq("cohort_id", filters.cohortId);
  if (filters.cohortMemberId) query = query.eq("cohort_member_id", filters.cohortMemberId);
  if (filters.interventionId) query = query.eq("intervention_id", filters.interventionId);
  if (filters.assessmentId) query = query.eq("assessment_id", filters.assessmentId);
  if (filters.assessmentScoreRunId) query = query.eq("assessment_score_run_id", filters.assessmentScoreRunId);
  if (filters.fieldVisitId) query = query.eq("field_visit_id", filters.fieldVisitId);
  if (filters.definitionId) query = query.eq("indicator_definition_id", filters.definitionId);
  if (filters.verificationStatus) query = query.eq("verification_status", filters.verificationStatus);
  if (ctx.role === "boi_executive") query = query.eq("verification_status", "verified");
  if (ctx.role === "field_officer") {
    const scope = await getFieldOfficerScope(ctx);
    if (scope.visitIds.length === 0 && scope.memberIds.length === 0) return [];
    const clauses: string[] = [];
    if (scope.visitIds.length > 0) clauses.push(`field_visit_id.in.(${scope.visitIds.join(",")})`);
    if (scope.memberIds.length > 0) clauses.push(`cohort_member_id.in.(${scope.memberIds.join(",")})`);
    query = query.or(clauses.join(","));
  } else {
    await getProgrammeScopeFilter(ctx);
    query = applyProgrammeScope(query, ctx);
  }
  if (ctx.role === "data_analyst") query = query.eq("verification_status", "verified");
  const { data, error } = await query;
  if (error) throw new Error(`Indicator measurements unavailable: ${error.message}`);
  return (data ?? []) as unknown as ImpactIndicatorMeasurement[];
}

async function assertFieldOfficerMeasurementScope(ctx: UserContext, cohortMemberId: string | null, fieldVisitId: string | null) {
  if (ctx.role !== "field_officer") return;
  const scope = await getFieldOfficerScope(ctx);
  if (!(fieldVisitId && scope.visitIds.includes(fieldVisitId)) && !(cohortMemberId && scope.memberIds.includes(cohortMemberId))) {
    throw new Error("You can only submit indicator measurements for assigned visits or beneficiaries.");
  }
}

async function insertMeasurementEvent(params: {
  ctx: UserContext;
  measurementId: string;
  eventType: "created" | "submitted" | "verified" | "rejected" | "returned";
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
}) {
  const supabase = await createServiceRoleSupabaseClient();
  const { error } = await supabase.from("impact_indicator_measurement_events").insert({
    measurement_id: params.measurementId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    actor_user_id: params.ctx.appUserId,
    actor_role: params.ctx.role,
    note: params.note ?? null,
  });
  if (error) logImpactIndicatorDiagnostic({ operation: "measurement_event_failed", role: params.ctx.role, authUserId: params.ctx.authUserId, appUserId: params.ctx.appUserId, measurementId: params.measurementId, errorMessage: error.message, success: false });
}

export async function createIndicatorMeasurement(ctx: UserContext, formData: FormData) {
  requireRolePermission(ctx.role, "indicator", "create", "You do not have permission to create indicator measurements.");
  requireRole(ctx, INDICATOR_MEASUREMENT_CREATE_ROLES, "You do not have permission to create indicator measurements.");
  const definitionId = textValue(formData, "indicator_definition_id");
  if (!definitionId) throw new Error("Select an indicator definition.");
  const definition = await getIndicatorDefinition(ctx, definitionId);
  if (!definition || definition.status !== "active") throw new Error("Measurements require an active indicator definition.");
  const programmeId = textValue(formData, "programme_id") ?? definition.programme_id;
  if (!programmeId) throw new Error("Select a programme for this measurement.");
  await logProgrammeScopeShadowDecision({ ctx, programmeId, action: "write", resource: "indicator_measurement", legacyAllowed: true });
  const cohortMemberId = textValue(formData, "cohort_member_id");
  const fieldVisitId = textValue(formData, "field_visit_id");
  await assertFieldOfficerMeasurementScope(ctx, cohortMemberId, fieldVisitId);
  const baselineValue = numericValue(formData, "baseline_value");
  const targetValue = numericValue(formData, "target_value");
  const measuredValue = numericValue(formData, "measured_value", true) as number;
  const sourceType = textValue(formData, "source_type") ?? "manual";
  if (!INDICATOR_SOURCE_TYPES.includes(sourceType as IndicatorSourceType) || sourceType === "imported") {
    throw new Error("Select a valid indicator measurement source.");
  }
  if (sourceType === "evidence") {
    throw new Error("Evidence-linked indicator measurements are temporarily unavailable.");
  }
  if (sourceType === "assessment_score" && (!textValue(formData, "assessment_id") || !textValue(formData, "assessment_score_run_id"))) {
    throw new Error("Assessment score measurements require an assessment and score run.");
  }
  if (sourceType === "field_visit" && !fieldVisitId) {
    throw new Error("Field visit measurements require a field visit.");
  }
  if (definition.baseline_required && baselineValue === null) throw new Error("This indicator requires a baseline value.");
  if (definition.target_required && targetValue === null) throw new Error("This indicator requires a target value.");
  const calculation = {
    direction: definition.direction_of_improvement,
    baselineValue,
    targetValue,
    measuredValue,
  };
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("impact_indicator_measurements").insert({
    indicator_definition_id: definitionId,
    programme_id: programmeId,
    cohort_id: textValue(formData, "cohort_id") ?? definition.cohort_id,
    cohort_member_id: cohortMemberId,
    msme_id: textValue(formData, "msme_id"),
    intervention_id: textValue(formData, "intervention_id") ?? definition.intervention_id,
    assessment_id: textValue(formData, "assessment_id"),
    assessment_score_run_id: textValue(formData, "assessment_score_run_id"),
    field_visit_id: fieldVisitId,
    evidence_id: null,
    reporting_period_start: textValue(formData, "reporting_period_start"),
    reporting_period_end: textValue(formData, "reporting_period_end"),
    measurement_date: textValue(formData, "measurement_date") ?? new Date().toISOString().slice(0, 10),
    baseline_value: baselineValue,
    target_value: targetValue,
    measured_value: measuredValue,
    progress_percentage: calculateProgressPercentage(calculation),
    outcome_status: calculateOutcomeStatus(calculation),
    source_type: sourceType,
    verification_status: "draft",
    created_by_user_id: ctx.appUserId,
    metadata: { source: "indicator_phase1" },
  }).select("id").single();
  if (error) throw new Error(error.message);
  await insertMeasurementEvent({ ctx, measurementId: data.id, eventType: "created", fromStatus: null, toStatus: "draft" });
  return data.id as string;
}

async function transitionMeasurement(ctx: UserContext, measurementId: string, nextStatus: IndicatorVerificationStatus, reviewNote?: string | null) {
  const permissionAction = nextStatus === "submitted" ? "submit" : nextStatus === "verified" ? "verify" : "return";
  requireRolePermission(ctx.role, "indicator", permissionAction, "You do not have permission to perform this indicator action.");
  const supabase = await createServiceRoleSupabaseClient();
  const { data: current, error: currentError } = await supabase
    .from("impact_indicator_measurements")
    .select("id,programme_id,cohort_member_id,field_visit_id,verification_status")
    .eq("id", measurementId)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Indicator measurement was not found.");
  await logProgrammeScopeShadowDecision({ ctx, programmeId: current.programme_id, action: "write", resource: "indicator_measurement", legacyAllowed: true });

  if (nextStatus === "submitted") {
    requireRole(ctx, INDICATOR_MEASUREMENT_CREATE_ROLES, "You do not have permission to submit indicator measurements.");
    if (!["draft", "returned"].includes(current.verification_status)) throw new Error("Only draft or returned measurements can be submitted.");
    await assertFieldOfficerMeasurementScope(ctx, current.cohort_member_id, current.field_visit_id);
  } else {
    requireRole(ctx, INDICATOR_MEASUREMENT_VERIFY_ROLES, "You do not have permission to review indicator measurements.");
    if (current.verification_status !== "submitted") throw new Error("Only submitted measurements can be reviewed.");
    if (nextStatus === "returned" && !reviewNote) throw new Error("A review note is required when returning a measurement.");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    verification_status: nextStatus,
    review_note: reviewNote ?? null,
  };
  if (nextStatus === "submitted") {
    patch.submitted_by_user_id = ctx.appUserId;
    patch.submitted_at = now;
    patch.verified_by_user_id = null;
    patch.verified_at = null;
  } else if (nextStatus === "verified") {
    patch.verified_by_user_id = ctx.appUserId;
    patch.verified_at = now;
  } else {
    patch.verified_by_user_id = null;
    patch.verified_at = null;
  }
  const { data: updated, error } = await supabase.from("impact_indicator_measurements")
    .update(patch)
    .eq("id", measurementId)
    .eq("verification_status", current.verification_status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Indicator measurement status changed before this action completed.");
  await insertMeasurementEvent({
    ctx,
    measurementId,
    eventType: nextStatus === "submitted" ? "submitted" : nextStatus === "verified" ? "verified" : "returned",
    fromStatus: current.verification_status,
    toStatus: nextStatus,
    note: reviewNote,
  });
}

export async function submitIndicatorMeasurement(ctx: UserContext, measurementId: string) {
  return transitionMeasurement(ctx, measurementId, "submitted");
}

export async function verifyIndicatorMeasurement(ctx: UserContext, measurementId: string, formData: FormData) {
  return transitionMeasurement(ctx, measurementId, "verified", textValue(formData, "review_note"));
}

export async function returnIndicatorMeasurement(ctx: UserContext, measurementId: string, formData: FormData) {
  return transitionMeasurement(ctx, measurementId, "returned", textValue(formData, "review_note"));
}

async function aggregateScope(ctx: UserContext, filters: IndicatorFilters) {
  const [definitions, measurements] = await Promise.all([
    listIndicatorDefinitions(ctx, { ...filters, limit: 1000 }),
    listIndicatorMeasurements(ctx, { ...filters, verificationStatus: "verified", limit: 1000 }),
  ]);
  return aggregateIndicatorMeasurements(definitions, measurements);
}

export async function aggregateProgrammeIndicators(ctx: UserContext, programmeId: string) {
  if (ctx.role !== "field_officer") {
    await enforceProgrammeReadAccess({ ctx, programmeId, resource: "indicator_analytics" });
  }
  return aggregateScope(ctx, { programmeId });
}

export async function aggregateCohortIndicators(ctx: UserContext, cohortId: string) {
  return aggregateScope(ctx, { cohortId });
}

export async function aggregateInterventionIndicators(ctx: UserContext, interventionId: string) {
  return aggregateScope(ctx, { interventionId });
}

export async function getIndicatorFormOptions(ctx: UserContext): Promise<IndicatorFormOptions> {
  requireRole(ctx, INDICATOR_READ_ROLES, "You do not have permission to load indicator options.");
  const supabase = await createServiceRoleSupabaseClient();
  const scope = ctx.role === "field_officer" ? await getFieldOfficerScope(ctx) : null;
  const programmeFilter = scope ? null : await getProgrammeScopeFilter(ctx);
  const [programmes, cohorts, members, interventions, assessments, scoreRuns, visits, users] = await Promise.all([
    supabase.from("impact_programmes").select("id,name,programme_code").order("name").limit(250),
    supabase.from("impact_beneficiary_cohorts").select("id,programme_id,name").order("name").limit(250),
    supabase.from("impact_cohort_members").select("id,programme_id,cohort_id,msme_id,member_status,msmes(id,business_name,msme_id)").order("enrolled_at", { ascending: false }).limit(500),
    supabase.from("impact_interventions").select("id,programme_id,cohort_id,cohort_member_id,msme_id,title").order("created_at", { ascending: false }).limit(500),
    supabase.from("impact_assessments").select("id,programme_id,cohort_id,cohort_member_id,intervention_id,msme_id,title,assessment_type").order("created_at", { ascending: false }).limit(500),
    supabase.from("impact_assessment_score_runs").select("id,assessment_id,weighted_score,readiness_category,calculated_at").order("calculated_at", { ascending: false }).limit(500),
    supabase.from("impact_field_visits").select("id,programme_id,cohort_id,cohort_member_id,intervention_id,assessment_id,msme_id,title,status").order("created_at", { ascending: false }).limit(500),
    supabase.from("users").select("id,full_name,email,role").in("role", ["admin", "super_admin", "programme_officer", "assessment_officer"]).order("full_name").limit(250),
  ]);
  const firstError = programmes.error || cohorts.error || members.error || interventions.error || assessments.error || scoreRuns.error || visits.error || users.error;
  if (firstError) throw new Error(`Indicator options unavailable: ${firstError.message}`);

  let memberRows = (members.data ?? []) as unknown as IndicatorFormOptions["members"];
  let visitRows = (visits.data ?? []) as IndicatorFormOptions["visits"];
  if (scope) {
    memberRows = memberRows.filter((row) => scope.memberIds.includes(row.id));
    visitRows = visitRows.filter((row) => scope.visitIds.includes(row.id));
  }
  const allowedProgrammeIds = scope
    ? new Set(scope.programmeIds)
    : programmeFilter?.mode === "assigned"
      ? new Set(programmeFilter.programmeIds)
      : programmeFilter?.mode === "none"
        ? new Set<string>()
        : null;
  const allowedCohortIds = scope ? new Set(scope.cohortIds) : null;
  const allowedMemberIds = scope ? new Set(scope.memberIds) : null;
  const cohortRows = ((cohorts.data ?? []) as IndicatorFormOptions["cohorts"])
    .filter((row) => !allowedProgrammeIds || allowedProgrammeIds.has(row.programme_id))
    .filter((row) => !allowedCohortIds || allowedCohortIds.has(row.id));
  if (!scope && allowedProgrammeIds) {
    memberRows = memberRows.filter((row) => allowedProgrammeIds.has(row.programme_id));
    visitRows = visitRows.filter((row) => Boolean(row.programme_id && allowedProgrammeIds.has(row.programme_id)));
  }
  const interventionRows = ((interventions.data ?? []) as IndicatorFormOptions["interventions"])
    .filter((row) => !allowedProgrammeIds || allowedProgrammeIds.has(row.programme_id))
    .filter((row) => !allowedMemberIds || Boolean(row.cohort_member_id && allowedMemberIds.has(row.cohort_member_id)));
  const assessmentRows = ((assessments.data ?? []) as IndicatorFormOptions["assessments"])
    .filter((row) => !allowedProgrammeIds || Boolean(row.programme_id && allowedProgrammeIds.has(row.programme_id)))
    .filter((row) => !allowedMemberIds || Boolean(row.cohort_member_id && allowedMemberIds.has(row.cohort_member_id)));
  const allowedAssessmentIds = scope ? new Set(assessmentRows.map((row) => row.id)) : null;

  return {
    programmes: ((programmes.data ?? []) as IndicatorFormOptions["programmes"]).filter((row) => !allowedProgrammeIds || allowedProgrammeIds.has(row.id)),
    cohorts: cohortRows,
    members: memberRows,
    interventions: interventionRows,
    assessments: assessmentRows,
    scoreRuns: ((scoreRuns.data ?? []) as IndicatorFormOptions["scoreRuns"]).filter((row) => !allowedAssessmentIds || allowedAssessmentIds.has(row.assessment_id)),
    visits: visitRows,
    users: (users.data ?? []) as IndicatorFormOptions["users"],
  };
}
