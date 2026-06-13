import { createHash, randomUUID } from "crypto";
import type { UserContext } from "@/lib/auth/authorization";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createInstitutionalReportPdf } from "@/lib/reports/institutional-report-pdf";
import {
  applyProgrammeScope,
  enforceProgrammeReadAccess,
  getProgrammeScopeFilter,
  logProgrammeScopeShadowDecision,
} from "@/lib/impact-intelligence/access-scope";
import { requireRolePermission } from "@/lib/impact-intelligence/permissions";

export const REPORT_PHASE1A_TYPES = [
  "executive_summary",
  "programme_performance",
  "assessment_summary",
  "monitoring_report",
  "intervention_report",
  "impact_intelligence",
] as const;
export const REPORT_PHASE1A_STATUSES = ["draft", "in_review", "returned", "approved", "archived"] as const;
export const REPORT_READ_ROLES = ["admin", "super_admin", "programme_officer", "assessment_officer", "boi_executive", "data_analyst", "auditor"] as const;
export const REPORT_CREATE_ROLES = ["admin", "super_admin", "programme_officer"] as const;
export const REPORT_REVIEW_ROLES = ["admin", "super_admin", "assessment_officer"] as const;
export const REPORT_ARCHIVE_ROLES = ["admin", "super_admin"] as const;
export const IMPACT_REPORTS_BUCKET = "impact-reports";
export const IMPACT_REPORT_SIGNED_URL_SECONDS = 60 * 5;

type ReportScope = {
  programme_id: string;
  cohort_id: string | null;
  cohort_member_id: string | null;
  msme_id: string | null;
  intervention_id: string | null;
};

export type ReportFormOptions = {
  programmes: Array<{ id: string; name: string; programme_code: string | null }>;
  cohorts: Array<{ id: string; programme_id: string; name: string }>;
  members: Array<{ id: string; programme_id: string; cohort_id: string; msme_id: string; member_status: string; msmes: { id: string; business_name: string | null; msme_id: string | null } | null }>;
  interventions: Array<{ id: string; programme_id: string; cohort_id: string | null; cohort_member_id: string | null; msme_id: string | null; title: string }>;
};

export type InstitutionalReport = {
  id: string;
  programme_id: string | null;
  cohort_id: string | null;
  cohort_member_id: string | null;
  msme_id: string | null;
  intervention_id: string | null;
  title: string;
  summary: string | null;
  report_type: string;
  status: string;
  generated_by_user_id: string | null;
  generated_at: string | null;
  submitted_at: string | null;
  submitted_by_user_id: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  return_reason: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
  archived_at: string | null;
  archived_by_user_id: string | null;
  latest_version_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  impact_programmes?: { id: string; name: string; programme_code: string | null } | null;
  impact_beneficiary_cohorts?: { id: string; name: string } | null;
  impact_cohort_members?: { id: string; member_status: string } | null;
  impact_interventions?: { id: string; title: string } | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null } | null;
  latest_version?: InstitutionalReportVersion | null;
};

export type InstitutionalReportVersion = {
  id: string;
  report_id: string;
  version_number: number;
  title: string;
  summary: string | null;
  report_json: Record<string, unknown>;
  generated_by_user_id: string | null;
  generated_at: string;
  source_cutoff_at: string;
  report_scope: Record<string, unknown>;
  source_summary: Record<string, unknown>;
  assessment_ids: string[];
  score_run_ids: string[];
  field_visit_ids: string[];
  evidence_ids: string[];
  indicator_measurement_ids: string[];
  completeness_warnings: string[];
  metadata: Record<string, unknown>;
};

export type ReportEvidenceReference = {
  id: string;
  report_version_id: string;
  evidence_id: string;
  original_filename: string;
  verification_status: string;
  checksum_sha256: string;
  mime_type: string;
  file_size_bytes: number;
  intervention_id: string | null;
  assessment_id: string | null;
  field_visit_id: string | null;
};

export type ReportIndicatorReference = {
  id: string;
  report_version_id: string;
  indicator_definition_id: string;
  indicator_measurement_id: string;
  indicator_name: string;
  unit_of_measure: string;
  baseline_value: number | null;
  target_value: number | null;
  measured_value: number;
  progress_percentage: number | null;
  outcome_status: string;
  measurement_date: string;
  verification_status: string;
};

export type InstitutionalReportExport = {
  id: string;
  report_id: string;
  report_version_id: string | null;
  export_format: string;
  export_status: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  checksum_sha256: string | null;
  requested_at: string | null;
  completed_at: string | null;
  generated_at: string | null;
  generated_by_user_id: string | null;
};

const REPORT_SELECT =
  "id,programme_id,cohort_id,cohort_member_id,msme_id,intervention_id,title,summary,report_type,status,generated_by_user_id,generated_at,submitted_at,submitted_by_user_id,reviewed_at,reviewed_by_user_id,return_reason,approved_at,approved_by_user_id,archived_at,archived_by_user_id,latest_version_id,created_at,metadata,impact_programmes(id,name,programme_code),impact_beneficiary_cohorts(id,name),impact_cohort_members(id,member_status),impact_interventions(id,title),msmes(id,business_name,msme_id)";
const VERSION_SELECT =
  "id,report_id,version_number,title,summary,report_json,generated_by_user_id,generated_at,source_cutoff_at,report_scope,source_summary,assessment_ids,score_run_ids,field_visit_ids,evidence_ids,indicator_measurement_ids,completeness_warnings,metadata";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireRole(ctx: UserContext, roles: readonly string[], message: string) {
  if (!ctx.appUserId || !roles.includes(ctx.role)) throw new Error(message);
}

export function logImpactReportDiagnostic(payload: {
  operation: string;
  role?: string | null;
  authUserId?: string | null;
  appUserId?: string | null;
  reportId?: string | null;
  reportVersionId?: string | null;
  errorMessage?: string | null;
  success?: boolean;
}) {
  console.info("[impact-reports]", payload);
}

function isLegacyReport(report: Pick<InstitutionalReport, "metadata">) {
  return report.metadata?.legacy_unverified === true || report.metadata?.report_phase !== "phase1a";
}

function assertCanReadReport(ctx: UserContext, report: InstitutionalReport) {
  requireRole(ctx, REPORT_READ_ROLES, "You do not have permission to read institutional reports.");
  if ((ctx.role === "boi_executive" || ctx.role === "data_analyst") && (report.status !== "approved" || isLegacyReport(report))) {
    throw new Error("This role can only access approved institutional reports.");
  }
}

async function logActivity(ctx: UserContext, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const supabase = await createServiceRoleSupabaseClient();
  const { error } = await supabase.from("activity_logs").insert({
    actor_user_id: ctx.appUserId,
    action,
    entity_type: "impact_report",
    entity_id: entityId,
    metadata: { role: ctx.role, ...metadata },
  });
  if (error) logImpactReportDiagnostic({ operation: "activity_log_failed", role: ctx.role, appUserId: ctx.appUserId, reportId: entityId, errorMessage: error.message, success: false });
}

export async function getReportFormOptions(ctx: UserContext): Promise<ReportFormOptions> {
  requireRolePermission(ctx.role, "report", "create", "You do not have permission to create institutional reports.");
  requireRole(ctx, REPORT_CREATE_ROLES, "You do not have permission to create institutional reports.");
  const supabase = await createServiceRoleSupabaseClient();
  await getProgrammeScopeFilter(ctx);
  const programmeQuery = applyProgrammeScope(
    supabase.from("impact_programmes").select("id,name,programme_code").order("name").limit(250),
    ctx,
    "id",
  );
  const cohortQuery = applyProgrammeScope(
    supabase.from("impact_beneficiary_cohorts").select("id,programme_id,name").order("name").limit(500),
    ctx,
  );
  const memberQuery = applyProgrammeScope(
    supabase.from("impact_cohort_members").select("id,programme_id,cohort_id,msme_id,member_status,msmes(id,business_name,msme_id)").order("enrolled_at", { ascending: false }).limit(1000),
    ctx,
  );
  const interventionQuery = applyProgrammeScope(
    supabase.from("impact_interventions").select("id,programme_id,cohort_id,cohort_member_id,msme_id,title").order("created_at", { ascending: false }).limit(1000),
    ctx,
  );
  const [programmes, cohorts, members, interventions] = await Promise.all([
    programmeQuery,
    cohortQuery,
    memberQuery,
    interventionQuery,
  ]);
  const error = programmes.error || cohorts.error || members.error || interventions.error;
  if (error) throw new Error(`Report scope options unavailable: ${error.message}`);
  return {
    programmes: (programmes.data ?? []) as ReportFormOptions["programmes"],
    cohorts: (cohorts.data ?? []) as ReportFormOptions["cohorts"],
    members: (members.data ?? []) as unknown as ReportFormOptions["members"],
    interventions: (interventions.data ?? []) as ReportFormOptions["interventions"],
  };
}

async function validateReportScope(scope: ReportScope) {
  const supabase = await createServiceRoleSupabaseClient();
  const { data: programme, error: programmeError } = await supabase.from("impact_programmes").select("id,name,programme_code").eq("id", scope.programme_id).maybeSingle();
  if (programmeError) throw new Error(`Report programme unavailable: ${programmeError.message}`);
  if (!programme) throw new Error("Select a valid programme.");

  let cohort: { id: string; programme_id: string; name: string } | null = null;
  let member: { id: string; programme_id: string; cohort_id: string; msme_id: string; member_status: string } | null = null;
  let intervention: { id: string; programme_id: string; cohort_id: string | null; cohort_member_id: string | null; msme_id: string | null; title: string } | null = null;
  let msme: { id: string; business_name: string | null; msme_id: string | null } | null = null;

  if (scope.cohort_id) {
    const result = await supabase.from("impact_beneficiary_cohorts").select("id,programme_id,name").eq("id", scope.cohort_id).maybeSingle();
    if (result.error) throw new Error(`Report cohort unavailable: ${result.error.message}`);
    if (!result.data || result.data.programme_id !== scope.programme_id) throw new Error("Selected cohort does not belong to the programme.");
    cohort = result.data;
  }
  if (scope.cohort_member_id) {
    if (!scope.cohort_id) throw new Error("Select a cohort before selecting a beneficiary.");
    const result = await supabase.from("impact_cohort_members").select("id,programme_id,cohort_id,msme_id,member_status").eq("id", scope.cohort_member_id).maybeSingle();
    if (result.error) throw new Error(`Report beneficiary unavailable: ${result.error.message}`);
    if (!result.data || result.data.programme_id !== scope.programme_id || result.data.cohort_id !== scope.cohort_id) throw new Error("Selected beneficiary does not match the report scope.");
    member = result.data;
    scope.msme_id = result.data.msme_id;
  }
  if (scope.msme_id) {
    const result = await supabase.from("msmes").select("id,business_name,msme_id").eq("id", scope.msme_id).maybeSingle();
    if (result.error) throw new Error(`Report MSME unavailable: ${result.error.message}`);
    if (!result.data) throw new Error("Selected MSME does not exist.");
    msme = result.data;
  }
  if (scope.intervention_id) {
    const result = await supabase.from("impact_interventions").select("id,programme_id,cohort_id,cohort_member_id,msme_id,title").eq("id", scope.intervention_id).maybeSingle();
    if (result.error) throw new Error(`Report intervention unavailable: ${result.error.message}`);
    const row = result.data;
    if (!row || row.programme_id !== scope.programme_id
      || (scope.cohort_id && row.cohort_id !== scope.cohort_id)
      || (scope.cohort_member_id && row.cohort_member_id !== scope.cohort_member_id)
      || (scope.msme_id && row.msme_id !== scope.msme_id)) {
      throw new Error("Selected intervention does not match the report scope.");
    }
    intervention = row;
  }

  return { scope, programme, cohort, member, msme, intervention };
}

export async function createInstitutionalReport(ctx: UserContext, formData: FormData) {
  requireRolePermission(ctx.role, "report", "create", "You do not have permission to create institutional reports.");
  requireRole(ctx, REPORT_CREATE_ROLES, "You do not have permission to create institutional reports.");
  const title = textValue(formData, "title");
  const programmeId = textValue(formData, "programme_id");
  if (!title) throw new Error("Report title is required.");
  if (!programmeId) throw new Error("Select a programme.");
  const reportType = textValue(formData, "report_type") ?? "programme_performance";
  if (!(REPORT_PHASE1A_TYPES as readonly string[]).includes(reportType)) throw new Error("Select a valid report type.");
  const scope: ReportScope = {
    programme_id: programmeId,
    cohort_id: textValue(formData, "cohort_id"),
    cohort_member_id: textValue(formData, "cohort_member_id"),
    msme_id: textValue(formData, "msme_id"),
    intervention_id: textValue(formData, "intervention_id"),
  };
  await validateReportScope(scope);
  await logProgrammeScopeShadowDecision({ ctx, programmeId, action: "write", resource: "report", legacyAllowed: true });
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("impact_reports").insert({
    ...scope,
    title,
    summary: textValue(formData, "summary"),
    report_type: reportType,
    status: "draft",
    generated_by_user_id: ctx.appUserId,
    metadata: { report_phase: "phase1a", legacy_unverified: false },
  }).select("id").single();
  if (error) throw new Error(error.message);
  await logActivity(ctx, "impact_report_draft_created", data.id, { report_type: reportType, scope });
  return data.id as string;
}

function applyScope<T>(query: T, scope: ReportScope) {
  let scoped = query as T & { eq: (column: string, value: string) => typeof scoped };
  scoped = scoped.eq("programme_id", scope.programme_id);
  if (scope.cohort_id) scoped = scoped.eq("cohort_id", scope.cohort_id);
  if (scope.cohort_member_id) scoped = scoped.eq("cohort_member_id", scope.cohort_member_id);
  if (scope.msme_id) scoped = scoped.eq("msme_id", scope.msme_id);
  if (scope.intervention_id) scoped = scoped.eq("intervention_id", scope.intervention_id);
  return scoped;
}

async function buildVersionPayload(report: InstitutionalReport) {
  if (!report.programme_id) throw new Error("This report has no programme scope.");
  const validated = await validateReportScope({
    programme_id: report.programme_id,
    cohort_id: report.cohort_id,
    cohort_member_id: report.cohort_member_id,
    msme_id: report.msme_id,
    intervention_id: report.intervention_id,
  });
  const scope = validated.scope;
  const sourceCutoffAt = new Date().toISOString();
  const supabase = await createServiceRoleSupabaseClient();

  const assessmentsQuery = applyScope(
    supabase.from("impact_assessments").select("id,title,assessment_type,status,score,risk_level,reviewed_at,reviewed_by_user_id,programme_id,cohort_id,cohort_member_id,msme_id,intervention_id").eq("status", "approved").lte("reviewed_at", sourceCutoffAt),
    scope,
  );
  const reviewedVisitsQuery = applyScope(
    supabase.from("impact_field_visits").select("id,title,visit_date,status,findings,recommendations,reviewed_at,reviewed_by_user_id,programme_id,cohort_id,cohort_member_id,msme_id,intervention_id,assessment_id").eq("status", "reviewed").lte("reviewed_at", sourceCutoffAt),
    scope,
  );
  const completedVisitsQuery = applyScope(
    supabase.from("impact_field_visits").select("id", { count: "exact", head: true }).eq("status", "completed"),
    scope,
  );
  const evidenceQuery = applyScope(
    supabase.from("impact_evidence_files").select("id,original_filename,verification_status,status,checksum_sha256,mime_type,file_size_bytes,intervention_id,assessment_id,field_visit_id,programme_id,cohort_id,cohort_member_id,msme_id,metadata")
      .eq("status", "verified")
      .eq("verification_status", "verified")
      .not("storage_path", "is", null)
      .not("checksum_sha256", "is", null)
      .lte("reviewed_at", sourceCutoffAt),
    scope,
  );
  const indicatorQuery = applyScope(
    supabase.from("impact_indicator_measurements").select("id,indicator_definition_id,baseline_value,target_value,measured_value,progress_percentage,outcome_status,measurement_date,verification_status,programme_id,cohort_id,cohort_member_id,msme_id,intervention_id,impact_indicator_definitions(id,name,unit_of_measure)")
      .eq("verification_status", "verified")
      .lte("verified_at", sourceCutoffAt),
    scope,
  );

  const [assessmentResult, reviewedVisitResult, completedVisitResult, evidenceResult, indicatorResult] = await Promise.all([
    assessmentsQuery,
    reviewedVisitsQuery,
    completedVisitsQuery,
    evidenceQuery,
    indicatorQuery,
  ]);
  const sourceError = assessmentResult.error || reviewedVisitResult.error || completedVisitResult.error || evidenceResult.error || indicatorResult.error;
  if (sourceError) throw new Error(`Report source unavailable: ${sourceError.message}`);

  const assessments = assessmentResult.data ?? [];
  const assessmentIds = assessments.map((item) => String(item.id));
  const scoreRunResult = assessmentIds.length > 0
    ? await supabase.from("impact_assessment_score_runs").select("id,assessment_id,run_type,weighted_score,readiness_category,calculated_at,scoring_model_version").in("assessment_id", assessmentIds).eq("run_type", "review").lte("calculated_at", sourceCutoffAt).order("calculated_at", { ascending: false })
    : { data: [], error: null };
  if (scoreRunResult.error) throw new Error(`Assessment score runs unavailable: ${scoreRunResult.error.message}`);
  const latestScoreRunByAssessment = new Map<string, (typeof scoreRunResult.data)[number]>();
  for (const run of scoreRunResult.data ?? []) {
    if (!latestScoreRunByAssessment.has(String(run.assessment_id))) latestScoreRunByAssessment.set(String(run.assessment_id), run);
  }
  const scoreRuns = Array.from(latestScoreRunByAssessment.values());
  const assessmentPayload = assessments.map((assessment) => ({
    ...assessment,
    score_run_id: latestScoreRunByAssessment.get(String(assessment.id))?.id ?? null,
    weighted_score: latestScoreRunByAssessment.get(String(assessment.id))?.weighted_score ?? null,
    readiness_category: latestScoreRunByAssessment.get(String(assessment.id))?.readiness_category ?? assessment.risk_level,
  }));

  const evidence = (evidenceResult.data ?? []).filter((item) => item.metadata?.legacy_placeholder !== true && item.original_filename && item.checksum_sha256 && item.mime_type && Number(item.file_size_bytes) > 0);
  const evidenceReferences = evidence.map((item) => ({
    evidence_id: item.id,
    original_filename: item.original_filename,
    verification_status: item.verification_status,
    checksum_sha256: item.checksum_sha256,
    mime_type: item.mime_type,
    file_size_bytes: Number(item.file_size_bytes),
    intervention_id: item.intervention_id,
    assessment_id: item.assessment_id,
    field_visit_id: item.field_visit_id,
  }));
  const indicators = (indicatorResult.data ?? []).map((item) => {
    const definition = Array.isArray(item.impact_indicator_definitions) ? item.impact_indicator_definitions[0] : item.impact_indicator_definitions;
    return {
      indicator_definition_id: item.indicator_definition_id,
      indicator_measurement_id: item.id,
      indicator_name: definition?.name ?? "Indicator",
      unit_of_measure: definition?.unit_of_measure ?? "unspecified",
      baseline_value: item.baseline_value,
      target_value: item.target_value,
      measured_value: item.measured_value,
      progress_percentage: item.progress_percentage,
      outcome_status: item.outcome_status,
      measurement_date: item.measurement_date,
      verification_status: item.verification_status,
    };
  });

  const warnings: string[] = [];
  if (assessments.length === 0) warnings.push("No approved assessments were available within the selected scope.");
  if (assessments.length > scoreRuns.length) warnings.push(`${assessments.length - scoreRuns.length} approved assessment(s) had no review score run.`);
  if ((reviewedVisitResult.data ?? []).length === 0) warnings.push("No reviewed monitoring visits were available within the selected scope.");
  if ((completedVisitResult.count ?? 0) > 0) warnings.push(`${completedVisitResult.count} completed monitoring visit(s) were excluded because review is pending.`);
  if (evidence.length === 0) warnings.push("No verified, non-placeholder evidence files were available within the selected scope.");
  if (indicators.length === 0) warnings.push("No verified indicator measurements were available; this version contains no official impact claims.");

  const reportScope = {
    programme_id: scope.programme_id,
    programme_name: validated.programme.name,
    programme_code: validated.programme.programme_code,
    cohort_id: scope.cohort_id,
    cohort_name: validated.cohort?.name ?? null,
    cohort_member_id: scope.cohort_member_id,
    member_status: validated.member?.member_status ?? null,
    msme_id: scope.msme_id,
    msme_name: validated.msme?.business_name ?? null,
    dbin_msme_id: validated.msme?.msme_id ?? null,
    intervention_id: scope.intervention_id,
    intervention_title: validated.intervention?.title ?? null,
  };
  const sourceSummary = {
    approved_assessments: assessments.length,
    review_score_runs: scoreRuns.length,
    reviewed_field_visits: (reviewedVisitResult.data ?? []).length,
    completed_unreviewed_field_visits_excluded: completedVisitResult.count ?? 0,
    verified_evidence: evidence.length,
    verified_indicator_measurements: indicators.length,
    official_impact_claims: indicators.length,
  };
  const payload = {
    schema_version: "impact_report_phase1a_v1",
    title: report.title,
    summary: report.summary,
    report_type: report.report_type,
    generated_at: sourceCutoffAt,
    source_cutoff_at: sourceCutoffAt,
    scope: reportScope,
    source_summary: sourceSummary,
    completeness_warnings: warnings,
    assessments: assessmentPayload,
    field_visits: reviewedVisitResult.data ?? [],
    evidence: evidenceReferences,
    indicators,
  };
  return {
    sourceCutoffAt,
    reportScope,
    sourceSummary,
    warnings,
    payload,
    assessmentIds,
    scoreRunIds: scoreRuns.map((item) => String(item.id)),
    fieldVisitIds: (reviewedVisitResult.data ?? []).map((item) => String(item.id)),
    evidenceIds: evidence.map((item) => String(item.id)),
    indicatorMeasurementIds: indicators.map((item) => String(item.indicator_measurement_id)),
    evidenceReferences,
    indicators,
  };
}

export async function generateInstitutionalReportVersion(ctx: UserContext, reportId: string) {
  requireRolePermission(ctx.role, "report", "update", "You do not have permission to generate institutional report versions.");
  requireRole(ctx, REPORT_CREATE_ROLES, "You do not have permission to generate institutional report versions.");
  const { report } = await getInstitutionalReport(ctx, reportId, { includeSources: false, enforceReadScope: false });
  if (!report) throw new Error("Report not found.");
  await logProgrammeScopeShadowDecision({ ctx, programmeId: report.programme_id, action: "write", resource: "report", legacyAllowed: true });
  if (isLegacyReport(report)) throw new Error("Legacy reports cannot generate Phase 1A versions.");
  if (!["draft", "returned"].includes(report.status)) throw new Error("Only draft or returned reports can generate a version.");
  const built = await buildVersionPayload(report);
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("create_impact_report_version", {
    p_report_id: reportId,
    p_title: report.title,
    p_summary: report.summary,
    p_report_json: built.payload,
    p_report_scope: built.reportScope,
    p_source_summary: built.sourceSummary,
    p_assessment_ids: built.assessmentIds,
    p_score_run_ids: built.scoreRunIds,
    p_field_visit_ids: built.fieldVisitIds,
    p_evidence_ids: built.evidenceIds,
    p_indicator_measurement_ids: built.indicatorMeasurementIds,
    p_completeness_warnings: built.warnings,
    p_generated_by_user_id: ctx.appUserId,
    p_source_cutoff_at: built.sourceCutoffAt,
    p_evidence_references: built.evidenceReferences,
    p_indicator_references: built.indicators,
  });
  if (error) throw new Error(error.message);
  await logActivity(ctx, "impact_report_version_generated", reportId, { report_version_id: data, source_summary: built.sourceSummary });
  return data as string;
}

export async function transitionInstitutionalReport(ctx: UserContext, reportId: string, action: "submit" | "return" | "approve" | "archive", formData?: FormData) {
  const permissionAction = action === "submit" ? "submit" : action === "return" ? "return" : action === "approve" ? "approve" : "archive";
  requireRolePermission(ctx.role, "report", permissionAction, "You do not have permission to perform this report action.");
  const { report } = await getInstitutionalReport(ctx, reportId, { includeSources: false, enforceReadScope: false });
  if (!report) throw new Error("Report not found.");
  await logProgrammeScopeShadowDecision({ ctx, programmeId: report.programme_id, action: "write", resource: "report", legacyAllowed: true });
  if (isLegacyReport(report)) throw new Error("Legacy reports cannot enter the Phase 1A approval workflow.");
  const supabase = await createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  let expectedStatus: string | string[];
  let patch: Record<string, unknown>;

  if (action === "submit") {
    requireRole(ctx, REPORT_CREATE_ROLES, "You do not have permission to submit institutional reports.");
    if (!report.latest_version_id) throw new Error("Generate a report version before submission.");
    expectedStatus = ["draft", "returned"];
    patch = { status: "in_review", submitted_at: now, submitted_by_user_id: ctx.appUserId, return_reason: null };
  } else if (action === "return") {
    requireRole(ctx, REPORT_REVIEW_ROLES, "You do not have permission to return institutional reports.");
    const reason = formData ? textValue(formData, "return_reason") : null;
    if (!reason) throw new Error("Return reason is required.");
    expectedStatus = "in_review";
    patch = { status: "returned", reviewed_at: now, reviewed_by_user_id: ctx.appUserId, return_reason: reason };
  } else if (action === "approve") {
    requireRole(ctx, REPORT_REVIEW_ROLES, "You do not have permission to approve institutional reports.");
    if (!report.latest_version_id) throw new Error("A generated report version is required before approval.");
    expectedStatus = "in_review";
    patch = { status: "approved", reviewed_at: now, reviewed_by_user_id: ctx.appUserId, approved_at: now, approved_by_user_id: ctx.appUserId, return_reason: null };
  } else {
    requireRole(ctx, REPORT_ARCHIVE_ROLES, "You do not have permission to archive institutional reports.");
    expectedStatus = ["draft", "returned", "approved"];
    patch = { status: "archived", archived_at: now, archived_by_user_id: ctx.appUserId };
  }

  let query = supabase.from("impact_reports").update(patch).eq("id", reportId);
  query = Array.isArray(expectedStatus) ? query.in("status", expectedStatus) : query.eq("status", expectedStatus);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Report status changed before this action completed. Reload and try again.");
  await logActivity(ctx, `impact_report_${action === "return" ? "returned" : action === "submit" ? "submitted" : action === "approve" ? "approved" : "archived"}`, reportId, { report_version_id: report.latest_version_id });
}

export async function listInstitutionalReports(ctx: UserContext, limit = 100): Promise<InstitutionalReport[]> {
  requireRole(ctx, REPORT_READ_ROLES, "You do not have permission to read institutional reports.");
  const supabase = await createServiceRoleSupabaseClient();
  let query = supabase.from("impact_reports").select(REPORT_SELECT).order("created_at", { ascending: false }).limit(limit);
  await getProgrammeScopeFilter(ctx);
  query = applyProgrammeScope(query, ctx);
  if (ctx.role === "boi_executive" || ctx.role === "data_analyst") query = query.eq("status", "approved").eq("metadata->>report_phase", "phase1a");
  const { data, error } = await query;
  if (error) throw new Error(`Institutional reports unavailable: ${error.message}`);
  const reports = (data ?? []) as unknown as InstitutionalReport[];
  const versionIds = reports.map((item) => item.latest_version_id).filter((id): id is string => Boolean(id));
  if (versionIds.length === 0) return reports;
  const versions = await supabase.from("impact_report_versions").select(VERSION_SELECT).in("id", versionIds);
  if (versions.error) {
    logImpactReportDiagnostic({ operation: "latest_versions_unavailable", role: ctx.role, authUserId: ctx.authUserId, appUserId: ctx.appUserId, errorMessage: versions.error.message, success: false });
    return reports;
  }
  const byId = new Map((versions.data ?? []).map((item) => [String(item.id), item as unknown as InstitutionalReportVersion]));
  return reports.map((report) => ({ ...report, latest_version: report.latest_version_id ? byId.get(report.latest_version_id) ?? null : null }));
}

export async function listInstitutionalReportExports(
  ctx: UserContext,
  reportIds: string[],
): Promise<InstitutionalReportExport[]> {
  requireRole(ctx, REPORT_READ_ROLES, "You do not have permission to read institutional report exports.");
  if (reportIds.length === 0) return [];
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("impact_report_exports")
    .select("id,report_id,report_version_id,export_format,export_status,mime_type,file_size_bytes,checksum_sha256,requested_at,completed_at,generated_at,generated_by_user_id")
    .in("report_id", reportIds)
    .order("requested_at", { ascending: false });
  if (error) throw new Error(`Institutional report exports unavailable: ${error.message}`);
  return (data ?? []) as InstitutionalReportExport[];
}

export async function getInstitutionalReport(
  ctx: UserContext,
  reportId: string,
  options: { includeSources?: boolean; versionId?: string; enforceReadScope?: boolean } = {},
) {
  requireRole(ctx, REPORT_READ_ROLES, "You do not have permission to read institutional reports.");
  const supabase = await createServiceRoleSupabaseClient();
  const reportResult = await supabase.from("impact_reports").select(REPORT_SELECT).eq("id", reportId).maybeSingle();
  if (reportResult.error) throw new Error(`Institutional report unavailable: ${reportResult.error.message}`);
  const report = reportResult.data as unknown as InstitutionalReport | null;
  if (!report) return { report: null, versions: [], evidenceReferences: [], indicatorReferences: [], exports: [] };
  assertCanReadReport(ctx, report);
  if (options.enforceReadScope !== false) {
    await enforceProgrammeReadAccess({ ctx, programmeId: report.programme_id, resource: "report" });
  }
  const versionsResult = await supabase.from("impact_report_versions").select(VERSION_SELECT).eq("report_id", reportId).order("version_number", { ascending: false });
  if (versionsResult.error) throw new Error(`Report versions unavailable: ${versionsResult.error.message}`);
  const versions = (versionsResult.data ?? []) as unknown as InstitutionalReportVersion[];
  const requestedVersion = options.versionId
    ? versions.find((version) => version.id === options.versionId)
    : null;
  const selectedVersionId = requestedVersion?.id ?? report.latest_version_id ?? versions[0]?.id ?? null;

  if (!options.includeSources || !selectedVersionId) {
    return { report, versions, evidenceReferences: [], indicatorReferences: [], exports: [] };
  }
  const [evidenceResult, indicatorResult, exportResult] = await Promise.all([
    supabase.from("impact_report_version_evidence_references").select("*").eq("report_version_id", selectedVersionId).order("created_at"),
    supabase.from("impact_report_version_indicator_references").select("*").eq("report_version_id", selectedVersionId).order("measurement_date", { ascending: false }),
    supabase.from("impact_report_exports").select("id,report_id,report_version_id,export_format,export_status,mime_type,file_size_bytes,checksum_sha256,requested_at,completed_at,generated_at,generated_by_user_id").eq("report_id", reportId).order("requested_at", { ascending: false }),
  ]);
  return {
    report,
    versions,
    evidenceReferences: evidenceResult.error ? null : (evidenceResult.data ?? []) as ReportEvidenceReference[],
    indicatorReferences: indicatorResult.error ? null : (indicatorResult.data ?? []) as ReportIndicatorReference[],
    exports: exportResult.error ? null : (exportResult.data ?? []) as InstitutionalReportExport[],
    sourceErrors: {
      evidence: evidenceResult.error?.message ?? null,
      indicators: indicatorResult.error?.message ?? null,
      exports: exportResult.error?.message ?? null,
    },
  };
}

function exportFileName(report: InstitutionalReport, version: InstitutionalReportVersion, format: "pdf" | "json") {
  const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "institutional-report";
  return `${slug}-v${version.version_number}.${format}`;
}

export async function generateInstitutionalReportExport(ctx: UserContext, reportId: string, format: "pdf" | "json") {
  requireRolePermission(ctx.role, "report", "export", "You do not have permission to generate report exports.");
  requireRole(ctx, ["admin", "super_admin", "programme_officer", "assessment_officer"], "You do not have permission to generate report exports.");
  if (!["pdf", "json"].includes(format)) throw new Error("Select PDF or JSON export.");
  const detail = await getInstitutionalReport(ctx, reportId, { includeSources: true, enforceReadScope: false });
  if (!detail.report) throw new Error("Report not found.");
  if (detail.report.status !== "approved") throw new Error("Only approved reports can be exported as official reports.");
  const version = detail.versions.find((item) => item.id === detail.report?.latest_version_id);
  if (!version) throw new Error("The approved report version could not be loaded.");
  const payload = version.report_json;
  const exportBytes = format === "json"
    ? Buffer.from(JSON.stringify({ report: { id: detail.report.id, title: detail.report.title, status: detail.report.status }, version: payload }, null, 2))
    : Buffer.from(createInstitutionalReportPdf({
      reportId: detail.report.id,
      title: detail.report.title,
      summary: detail.report.summary,
      reportType: detail.report.report_type,
      versionNumber: version.version_number,
      versionId: version.id,
      generatedAt: version.generated_at,
      generatedByUserId: version.generated_by_user_id,
      sourceCutoffAt: version.source_cutoff_at,
      status: detail.report.status,
      metadata: detail.report.metadata,
      scope: version.report_scope,
      sourceSummary: version.source_summary,
      warnings: version.completeness_warnings,
      assessments: Array.isArray(payload.assessments) ? payload.assessments as Array<Record<string, unknown>> : [],
      scoreRunIds: version.score_run_ids,
      fieldVisits: Array.isArray(payload.field_visits) ? payload.field_visits as Array<Record<string, unknown>> : [],
      evidence: Array.isArray(payload.evidence) ? payload.evidence as Array<Record<string, unknown>> : [],
      indicators: Array.isArray(payload.indicators) ? payload.indicators as Array<Record<string, unknown>> : [],
      governance: {
        createdAt: detail.report.created_at,
        createdByUserId: detail.report.generated_by_user_id,
        submittedAt: detail.report.submitted_at,
        submittedByUserId: detail.report.submitted_by_user_id,
        reviewedAt: detail.report.reviewed_at,
        reviewedByUserId: detail.report.reviewed_by_user_id,
        approvedAt: detail.report.approved_at,
        approvedByUserId: detail.report.approved_by_user_id,
        returnedReason: detail.report.return_reason,
      },
      versions: detail.versions.map((item) => ({
        id: item.id,
        versionNumber: item.version_number,
        generatedAt: item.generated_at,
        generatedByUserId: item.generated_by_user_id,
        sourceCutoffAt: item.source_cutoff_at,
        assessmentCount: item.assessment_ids.length,
        fieldVisitCount: item.field_visit_ids.length,
        evidenceCount: item.evidence_ids.length,
        indicatorCount: item.indicator_measurement_ids.length,
        warningCount: item.completeness_warnings.length,
      })),
      exports: (detail.exports ?? []).map((item) => ({
        id: item.id,
        format: item.export_format,
        status: item.export_status,
        generatedAt: item.generated_at,
        generatedByUserId: item.generated_by_user_id,
        fileSizeBytes: item.file_size_bytes,
        checksumSha256: item.checksum_sha256,
      })),
    }));
  const mimeType = format === "pdf" ? "application/pdf" : "application/json";
  const checksum = createHash("sha256").update(exportBytes).digest("hex");
  const storagePath = `${reportId}/${version.id}/${randomUUID()}-${exportFileName(detail.report, version, format)}`;
  const supabase = await createServiceRoleSupabaseClient();
  const upload = await supabase.storage.from(IMPACT_REPORTS_BUCKET).upload(storagePath, exportBytes, { contentType: mimeType, upsert: false });
  if (upload.error) throw new Error(`Report export upload failed: ${upload.error.message}`);
  const folder = storagePath.slice(0, storagePath.lastIndexOf("/"));
  const storedName = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const verification = await supabase.storage.from(IMPACT_REPORTS_BUCKET).list(folder, { search: storedName, limit: 5 });
  if (verification.error || !(verification.data ?? []).some((item) => item.name === storedName)) {
    await supabase.storage.from(IMPACT_REPORTS_BUCKET).remove([storagePath]);
    throw new Error("The generated report file could not be confirmed in private storage.");
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("impact_report_exports").insert({
    report_id: reportId,
    report_version_id: version.id,
    export_format: format,
    export_status: "generated",
    export_url: null,
    storage_bucket: IMPACT_REPORTS_BUCKET,
    storage_path: storagePath,
    mime_type: mimeType,
    file_size_bytes: exportBytes.length,
    checksum_sha256: checksum,
    requested_by_user_id: ctx.appUserId,
    requested_at: now,
    completed_at: now,
    generated_at: now,
    generated_by_user_id: ctx.appUserId,
    metadata: { file_name: exportFileName(detail.report, version, format), report_phase: "phase1a" },
  }).select("id").single();
  if (error) {
    await supabase.storage.from(IMPACT_REPORTS_BUCKET).remove([storagePath]);
    throw new Error(`Report export metadata could not be saved: ${error.message}`);
  }
  await logActivity(ctx, "impact_report_export_generated", reportId, { report_version_id: version.id, export_id: data.id, format, checksum_sha256: checksum });
  return data.id as string;
}

export async function getInstitutionalReportExportAccess(ctx: UserContext, exportId: string) {
  requireRole(ctx, REPORT_READ_ROLES, "You do not have permission to download institutional reports.");
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("impact_report_exports")
    .select("id,report_id,report_version_id,export_format,export_status,storage_bucket,storage_path,mime_type,metadata")
    .eq("id", exportId)
    .maybeSingle();
  if (error) throw new Error(`Report export unavailable: ${error.message}`);
  if (!data || data.export_status !== "generated" || !data.storage_bucket || !data.storage_path) throw new Error("Generated report file was not found.");
  const reportResult = await supabase.from("impact_reports").select(REPORT_SELECT).eq("id", data.report_id).maybeSingle();
  if (reportResult.error || !reportResult.data) throw new Error("Report access could not be verified.");
  assertCanReadReport(ctx, reportResult.data as unknown as InstitutionalReport);
  return data;
}
