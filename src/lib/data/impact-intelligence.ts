import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";
import {
  IMPACT_EVIDENCE_SELECT,
  mapImpactEvidenceRow,
  mapImpactEvidenceRows,
  uploadImpactEvidence,
  type ImpactEvidenceRecord,
} from "@/lib/data/impact-evidence";

type ImpactQueryOptions = {
  limit?: number;
  state?: string | null;
  sector?: string | null;
  search?: string | null;
  programmeId?: string | null;
  cohortId?: string | null;
  status?: string | null;
  stage?: string | null;
  interventionType?: string | null;
  interventionId?: string | null;
  assessmentType?: string | null;
  assignedOfficerId?: string | null;
  cohortMemberId?: string | null;
};

type ImpactReadArgs = {
  ctx?: UserContext;
  options: ImpactQueryOptions;
};

export const IMPACT_READ_ROLES: UserRole[] = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "auditor"];
export const IMPACT_SCOPED_READ_ROLES: UserRole[] = [...IMPACT_READ_ROLES, "field_officer"];
export const IMPACT_WRITE_ROLES: UserRole[] = ["admin", "super_admin", "programme_officer"];
export const COHORT_READ_ROLES: UserRole[] = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "auditor", "field_officer"];
export const COHORT_MANAGE_ROLES: UserRole[] = ["admin", "super_admin", "programme_officer"];
export const ASSESSMENT_MANAGE_ROLES: UserRole[] = ["admin", "super_admin", "programme_officer", "assessment_officer"];
export const ASSESSMENT_REVIEW_ROLES: UserRole[] = ["admin", "super_admin", "assessment_officer"];
export const MONITORING_MANAGE_ROLES: UserRole[] = ["admin", "super_admin", "programme_officer", "assessment_officer"];
export const MONITORING_REVIEW_ROLES: UserRole[] = ["admin", "super_admin", "assessment_officer"];

export const PROGRAMME_STATUSES = ["draft", "active", "paused", "completed", "archived"] as const;
export const COHORT_STATUSES = ["draft", "recruiting", "active", "completed", "closed"] as const;
export const COHORT_MEMBER_STATUSES = ["invited", "enrolled", "active", "completed", "dropped", "exited"] as const;
export const INTERVENTION_STATUSES = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
export const INTERVENTION_STAGES = ["intake", "eligibility", "approval", "disbursement", "monitoring", "closure"] as const;
export const ASSESSMENT_TEMPLATE_STATUSES = ["draft", "active", "archived"] as const;
export const ASSESSMENT_TYPES = ["baseline", "credit_readiness", "business_maturity", "impact", "compliance", "post_funding_monitoring", "field_verification"] as const;
export const ASSESSMENT_STATUSES = ["draft", "submitted", "reviewed", "approved", "returned", "completed", "scheduled", "in_progress", "archived"] as const;
export const ASSESSMENT_QUESTION_TYPES = ["text", "textarea", "number", "select", "multi-select", "boolean", "date", "file_upload"] as const;
export const FIELD_VISIT_STATUSES = ["pending", "assigned", "in_progress", "completed", "reviewed"] as const;
export const EVIDENCE_CATEGORIES = ["business_photo", "facility_photo", "cac_document", "invoice", "monitoring_photo", "beneficiary_document", "signed_form", "compliance_document", "other"] as const;
export const EVIDENCE_VERIFICATION_STATUSES = ["pending", "verified", "rejected", "needs_review", "returned", "archived"] as const;
export const REPORT_TYPES = ["executive_summary", "programme_performance", "assessment_summary", "monitoring_report", "intervention_report", "impact_intelligence"] as const;
export const REPORT_STATUSES = ["draft", "in_review", "returned", "approved", "archived"] as const;
export const INTELLIGENCE_CATEGORIES = ["risk", "recommendation", "anomaly", "monitoring", "intervention", "compliance", "readiness", "portfolio", "operational"] as const;
export const INTELLIGENCE_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const DEFAULT_ASSESSMENT_SCORING_BANDS = [
  { label: "low", min: 0, max: 49.9999 },
  { label: "moderate", min: 50, max: 74.9999 },
  { label: "strong", min: 75, max: 100 },
] as const;

export type ProgrammeStatus = (typeof PROGRAMME_STATUSES)[number];
export type CohortStatus = (typeof COHORT_STATUSES)[number];
export type CohortMemberStatus = (typeof COHORT_MEMBER_STATUSES)[number];
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];
export type InterventionStage = (typeof INTERVENTION_STAGES)[number];
export type AssessmentTemplateStatus = (typeof ASSESSMENT_TEMPLATE_STATUSES)[number];
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export type AssessmentQuestionType = (typeof ASSESSMENT_QUESTION_TYPES)[number];
export type FieldVisitStatus = (typeof FIELD_VISIT_STATUSES)[number];
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];
export type EvidenceVerificationStatus = (typeof EVIDENCE_VERIFICATION_STATUSES)[number];
export type ImpactReportType = (typeof REPORT_TYPES)[number];
export type ImpactReportStatus = (typeof REPORT_STATUSES)[number];
export type IntelligenceCategory = (typeof INTELLIGENCE_CATEGORIES)[number];
export type IntelligencePriority = (typeof INTELLIGENCE_PRIORITIES)[number];

export type ImpactProgramme = {
  id: string;
  name: string;
  programme_code: string | null;
  sponsor_name: string | null;
  description: string | null;
  status: ProgrammeStatus | string | null;
  start_date: string | null;
  end_date: string | null;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  cohort_count?: number;
  cohort_beneficiary_count?: number;
};

export type ImpactBeneficiaryCohort = {
  id: string;
  programme_id: string;
  name: string;
  description: string | null;
  state: string | null;
  lga: string | null;
  sector: string | null;
  target_beneficiaries: number;
  current_beneficiaries: number;
  status: CohortStatus | string;
  start_date: string | null;
  end_date: string | null;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  member_count?: number;
  active_count?: number;
  completed_count?: number;
  dropped_count?: number;
  intervention_count?: number;
  unanchored_intervention_count?: number;
  assessment_count?: number;
  submitted_assessment_count?: number;
  approved_assessment_count?: number;
  field_visit_count?: number;
  open_field_visit_count?: number;
  completed_field_visit_count?: number;
};

export type ImpactCohortMember = {
  id: string;
  cohort_id: string;
  programme_id: string;
  msme_id: string;
  member_status: CohortMemberStatus | string;
  enrolled_at: string;
  completed_at: string | null;
  exited_at: string | null;
  assigned_to_user_id: string | null;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null; verification_status?: string | null } | null;
  impact_beneficiary_cohorts?: Pick<ImpactBeneficiaryCohort, "id" | "name" | "programme_id"> | null;
  intervention_count?: number;
  assessment_count?: number;
  latest_assessment_status?: string | null;
  field_visit_count?: number;
  open_field_visit_count?: number;
  completed_field_visit_count?: number;
  interventions?: Pick<ImpactIntervention, "id" | "title" | "status">[];
};

export type ImpactIntervention = {
  id: string;
  programme_id: string | null;
  cohort_id: string | null;
  cohort_member_id: string | null;
  msme_id: string | null;
  intervention_type: string;
  title: string;
  description: string | null;
  status: InterventionStatus | string | null;
  approved_amount: number | null;
  disbursed_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  assigned_to_user_id: string | null;
  assigned_officer_id: string | null;
  closure_reason: string | null;
  closure_note: string | null;
  closed_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  impact_beneficiary_cohorts?: Pick<ImpactBeneficiaryCohort, "id" | "name" | "status" | "programme_id"> | null;
  impact_cohort_members?: Pick<ImpactCohortMember, "id" | "member_status" | "cohort_id" | "programme_id" | "msme_id"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
  assigned_officers?: { id: string; full_name: string | null; email: string | null; role: string | null } | null;
  assessment_count?: number;
};

export type ImpactInterventionEvent = {
  id: string;
  intervention_id: string;
  programme_id: string | null;
  cohort_id: string | null;
  cohort_member_id: string | null;
  msme_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  from_stage: string | null;
  to_stage: string | null;
  title: string;
  note: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  created_at: string;
};

export type ImpactAssessment = {
  id: string;
  template_id?: string | null;
  template_version?: number | null;
  programme_id: string | null;
  cohort_id?: string | null;
  cohort_member_id?: string | null;
  intervention_id: string | null;
  field_visit_id?: string | null;
  msme_id: string | null;
  assessment_type: string | null;
  title?: string | null;
  status: string | null;
  score?: number | null;
  risk_level?: string | null;
  conducted_by_user_id: string | null;
  conducted_at: string | null;
  submitted_at?: string | null;
  submitted_by_user_id?: string | null;
  returned_at?: string | null;
  returned_by_user_id?: string | null;
  return_reason?: string | null;
  created_at: string | null;
  metadata?: Record<string, unknown> | null;
  impact_assessment_templates?: Pick<ImpactAssessmentTemplate, "id" | "name" | "version" | "assessment_type"> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  impact_beneficiary_cohorts?: Pick<ImpactBeneficiaryCohort, "id" | "name" | "programme_id"> | null;
  impact_cohort_members?: Pick<ImpactCohortMember, "id" | "member_status" | "cohort_id" | "programme_id" | "msme_id"> | null;
  impact_interventions?: Pick<ImpactIntervention, "id" | "title" | "cohort_id" | "cohort_member_id"> | null;
  impact_field_visits?: Pick<ImpactFieldVisit, "id" | "title" | "status"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

export type ImpactAssessmentTemplate = {
  id: string;
  name: string;
  description: string | null;
  assessment_type: string;
  version: number;
  status: AssessmentTemplateStatus | string;
  scoring_bands?: AssessmentScoringBand[] | null;
  scoring_model_version?: number | null;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AssessmentScoringBand = {
  label: "low" | "moderate" | "strong" | string;
  min: number;
  max: number;
};

type QuestionScoringConfig = {
  mode?: string;
  max_score?: number;
  maxScore?: number;
  true_score?: number;
  trueScore?: number;
  false_score?: number;
  falseScore?: number;
  threshold?: number;
  operator?: string;
  pass_score?: number;
  passScore?: number;
  fail_score?: number;
  failScore?: number;
  default_score?: number;
  defaultScore?: number;
  default_option_score?: number;
  defaultOptionScore?: number;
  aggregation?: string;
  cap?: number;
  options?: Record<string, unknown>;
  option_scores?: Record<string, unknown>;
  optionScores?: Record<string, unknown>;
  ranges?: Array<Record<string, unknown>>;
};

export type ImpactAssessmentSection = {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  display_order: number;
  weight: number;
};

export type ImpactAssessmentQuestion = {
  id: string;
  assessment_id: string | null;
  template_id: string | null;
  section_id: string | null;
  question_text: string;
  question_type: AssessmentQuestionType | string;
  category: string | null;
  display_order: number;
  is_required: boolean;
  options_json: unknown;
  help_text: string | null;
  weight: number;
  scoring_config: Record<string, unknown>;
  conditional_logic: Record<string, unknown>;
};

export type ImpactAssessmentResponse = {
  id: string;
  assessment_id: string;
  question_id: string | null;
  msme_id: string | null;
  response_text: string | null;
  response_number: number | null;
  response_boolean: boolean | null;
  response_json: Record<string, unknown>;
  score: number | null;
  max_score: number | null;
  responded_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ImpactAssessmentScore = {
  id: string;
  assessment_id: string;
  score_run_id?: string | null;
  section_id: string | null;
  section_title: string | null;
  score: number;
  max_score: number;
  weighted_score: number;
  readiness_category: "low" | "moderate" | "strong" | null;
  calculated_at: string;
  is_latest?: boolean | null;
  scoring_model_version?: number | null;
};

export type ImpactAssessmentScoreRun = {
  id: string;
  assessment_id: string;
  template_id: string | null;
  template_version: number | null;
  run_type: string;
  score: number;
  max_score: number;
  weighted_score: number;
  readiness_category: "low" | "moderate" | "strong" | null;
  calculated_by_user_id: string | null;
  calculated_at: string;
  scoring_model_version: number;
  scoring_snapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type ImpactAssessmentReview = {
  id: string;
  assessment_id: string;
  reviewer_user_id: string | null;
  review_status: string;
  notes: string | null;
  created_at: string;
};

export type ImpactFieldVisit = {
  id: string;
  programme_id: string | null;
  cohort_id?: string | null;
  cohort_member_id?: string | null;
  intervention_id: string | null;
  assessment_id?: string | null;
  msme_id: string | null;
  title?: string | null;
  visit_date: string | null;
  scheduled_at?: string | null;
  location_text?: string | null;
  status: string | null;
  assigned_to_user_id: string | null;
  completed_by_user_id?: string | null;
  completed_at?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_at?: string | null;
  findings?: string | null;
  recommendations?: string | null;
  follow_up_visit_id?: string | null;
  priority?: string | null;
  created_at: string | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  impact_beneficiary_cohorts?: Pick<ImpactBeneficiaryCohort, "id" | "name" | "programme_id"> | null;
  impact_cohort_members?: Pick<ImpactCohortMember, "id" | "member_status" | "cohort_id" | "programme_id" | "msme_id"> | null;
  impact_interventions?: Pick<ImpactIntervention, "id" | "title"> | null;
  impact_assessments?: Pick<ImpactAssessment, "id" | "title" | "assessment_type"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

export type ImpactFieldVisitAssignment = {
  id: string;
  field_visit_id: string;
  assigned_to_user_id: string;
  assigned_by_user_id: string | null;
  assignment_status: string;
  assigned_at: string;
  completed_at: string | null;
};

export type ImpactMonitoringChecklist = {
  id: string;
  field_visit_id: string;
  checklist_item: string;
  item_category: string | null;
  is_required: boolean;
  is_completed: boolean;
  display_order: number;
};

export type ImpactMonitoringNote = {
  id: string;
  field_visit_id: string;
  note_type: string;
  title: string | null;
  note: string;
  created_by_user_id: string | null;
  created_at: string;
};

export type ImpactEvidenceFile = ImpactEvidenceRecord;

export type ImpactEvidenceLink = {
  id: string;
  evidence_id: string;
  programme_id: string | null;
  intervention_id: string | null;
  assessment_id: string | null;
  field_visit_id: string | null;
  msme_id: string | null;
  link_type: string;
  created_at: string;
};

export type ImpactReport = {
  id: string;
  programme_id: string | null;
  intervention_id?: string | null;
  assessment_id?: string | null;
  field_visit_id?: string | null;
  msme_id?: string | null;
  title: string;
  report_type: string | null;
  status: string | null;
  summary?: string | null;
  generated_by_user_id: string | null;
  reviewed_by_user_id?: string | null;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  generated_at?: string | null;
  published_at?: string | null;
  created_at: string | null;
  report_json?: Record<string, unknown> | null;
  evidence_references?: unknown[] | null;
  metadata?: Record<string, unknown> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  impact_interventions?: Pick<ImpactIntervention, "id" | "title"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

export type ImpactReportVersion = {
  id: string;
  report_id: string;
  version_number: number;
  title: string;
  summary: string | null;
  report_json: Record<string, unknown>;
  evidence_references: unknown[];
  created_by_user_id: string | null;
  created_at: string;
};

export type ImpactReportExport = {
  id: string;
  report_id: string;
  export_format: string;
  export_status: string;
  export_url: string | null;
  requested_by_user_id: string | null;
  requested_at: string;
  completed_at: string | null;
};

export type DistributionBucket = {
  label: string;
  value: number;
};

export type CohortDashboardMetrics = {
  totalBeneficiaries: number;
  activeBeneficiaries: number;
  completedBeneficiaries: number;
  droppedBeneficiaries: number;
  stateDistribution: DistributionBucket[];
  sectorDistribution: DistributionBucket[];
  verificationCoverage: number;
};

export type ExecutiveDashboardMetrics = {
  totalMsmes: number;
  activeProgrammes: number;
  interventionCounts: number;
  completedAssessments: number;
  monitoringCompletionRate: number;
  verifiedEvidence: number;
  pendingEvidence: number;
  stateDistribution: DistributionBucket[];
  sectorDistribution: DistributionBucket[];
  interventionStatusDistribution: DistributionBucket[];
  readinessDistribution: DistributionBucket[];
  monitoringStatusDistribution: DistributionBucket[];
  recentActivity: Array<{ label: string; detail: string; href: string; created_at: string | null }>;
  operationalAlerts: Array<{ title: string; detail: string; severity: "low" | "medium" | "high" }>;
};

export type ImpactAiInsight = {
  id: string;
  source_key: string;
  category: IntelligenceCategory | string;
  insight_type: string;
  priority: IntelligencePriority | string;
  status: string;
  title: string;
  summary: string;
  programme_id: string | null;
  intervention_id: string | null;
  assessment_id: string | null;
  report_id: string | null;
  msme_id: string | null;
  generated_at: string;
  metadata?: Record<string, unknown> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  impact_interventions?: Pick<ImpactIntervention, "id" | "title"> | null;
  impact_assessments?: Pick<ImpactAssessment, "id" | "title" | "assessment_type"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

export type ImpactAiRecommendation = {
  id: string;
  insight_id: string | null;
  source_key: string;
  recommendation_type: string;
  priority: IntelligencePriority | string;
  status: string;
  title: string;
  recommendation: string;
  programme_id: string | null;
  intervention_id: string | null;
  assessment_id: string | null;
  report_id: string | null;
  msme_id: string | null;
  created_at: string;
};

export type ImpactRiskFlag = {
  id: string;
  source_key: string;
  risk_type: string;
  severity: IntelligencePriority | string;
  status: string;
  title: string;
  description: string;
  programme_id: string | null;
  intervention_id: string | null;
  assessment_id: string | null;
  report_id: string | null;
  msme_id: string | null;
  detected_at: string;
  resolution_note: string | null;
  metadata?: Record<string, unknown> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  impact_interventions?: Pick<ImpactIntervention, "id" | "title"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

export type ImpactAnomalyEvent = {
  id: string;
  source_key: string;
  anomaly_type: string;
  severity: IntelligencePriority | string;
  status: string;
  title: string;
  description: string;
  programme_id: string | null;
  intervention_id: string | null;
  assessment_id: string | null;
  report_id: string | null;
  msme_id: string | null;
  detected_at: string;
};

export type ImpactIntelligenceSummary = {
  id: string;
  source_key: string;
  summary_type: string;
  status: string;
  title: string;
  summary: string;
  programme_id: string | null;
  report_id: string | null;
  generated_at: string;
};

export type MsmePickerOption = {
  id: string;
  business_name: string;
  msme_id: string | null;
  state: string | null;
  sector: string | null;
};

export type UserPickerOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

function logImpactDataError(source: string, error: { message?: string } | null) {
  if (!error) return;
  console.warn(`[impact-intelligence] ${source}`, { error: error.message });
}

function throwImpactReadError(source: string, error: { message?: string } | null) {
  logImpactDataError(source, error);
  if (error) throw new Error(`Impact Intelligence source unavailable (${source}): ${error.message ?? "Unknown source error"}`);
}

async function createPrivilegedImpactWriteClient() {
  // Impact Intelligence server actions enforce app-level RBAC before calling this helper.
  // The service-role client is server-only and is used here so approved writes can pass Supabase RLS.
  return createServiceRoleSupabaseClient();
}

async function createPrivilegedImpactReadClient() {
  // BOI internal pages enforce app-level RBAC before calling this helper.
  // Keep the service-role client server-only so RLS bypass never reaches the browser.
  return createServiceRoleSupabaseClient();
}

function resolveImpactReadArgs(ctxOrOptions?: UserContext | ImpactQueryOptions, maybeOptions: ImpactQueryOptions = {}): ImpactReadArgs {
  if (ctxOrOptions && "role" in ctxOrOptions) {
    return { ctx: ctxOrOptions, options: maybeOptions };
  }

  return { options: ctxOrOptions ?? {} };
}

async function createImpactReadClient(ctx?: UserContext) {
  if (!ctx) return createServerSupabaseClient();
  requireImpactRead(ctx);
  return createPrivilegedImpactReadClient();
}

async function createScopedImpactReadClient(ctx?: UserContext) {
  if (!ctx) return createServerSupabaseClient();
  requireScopedImpactRead(ctx);
  return createPrivilegedImpactReadClient();
}

async function createReportingReadClient(ctx?: UserContext) {
  if (!ctx) return createServerSupabaseClient();
  requireReportingAccess(ctx);
  return createPrivilegedImpactReadClient();
}

async function createIntelligenceReadClient(ctx: UserContext) {
  requireIntelligenceAccess(ctx);
  return createPrivilegedImpactReadClient();
}

function requireImpactRead(ctx: UserContext) {
  if (!IMPACT_READ_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to read impact intelligence records.");
  }
}

function requireScopedImpactRead(ctx: UserContext) {
  if (!IMPACT_SCOPED_READ_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to read impact intelligence records.");
  }
}

function requireImpactWrite(ctx: UserContext) {
  if (!IMPACT_WRITE_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to manage impact intelligence records.");
  }
}

function requireCohortRead(ctx: UserContext) {
  if (!COHORT_READ_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to read beneficiary cohorts.");
  }
}

function requireCohortManage(ctx: UserContext) {
  if (!COHORT_MANAGE_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to manage beneficiary cohorts.");
  }
}

function requireAssessmentManage(ctx: UserContext) {
  if (!ASSESSMENT_MANAGE_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to manage impact assessments.");
  }
}

function requireAssessmentReview(ctx: UserContext) {
  if (!ASSESSMENT_REVIEW_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to review impact assessments.");
  }
}

function requireMonitoringManage(ctx: UserContext) {
  if (!MONITORING_MANAGE_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to manage field monitoring.");
  }
}

function requireMonitoringReview(ctx: UserContext) {
  if (!MONITORING_REVIEW_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to review field monitoring.");
  }
}

function requireReportingAccess(ctx: UserContext) {
  if (!["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "auditor"].includes(ctx.role)) {
    throw new Error("You do not have permission to access impact analytics and reports.");
  }
}

function requireReportWrite(ctx: UserContext) {
  if (!["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer"].includes(ctx.role)) {
    throw new Error("You do not have permission to create impact reports.");
  }
}

function requireIntelligenceAccess(ctx: UserContext) {
  if (!["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "auditor", "field_officer"].includes(ctx.role)) {
    throw new Error("You do not have permission to access impact intelligence.");
  }
}

function requireIntelligenceManage(ctx: UserContext) {
  if (!["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer"].includes(ctx.role)) {
    throw new Error("You do not have permission to manage impact intelligence.");
  }
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numericValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(formData: FormData, key: string) {
  const value = numericValue(formData, key);
  if (!value || value < 0) return 0;
  return Math.trunc(value);
}

function normaliseStage(value: string | null): InterventionStage {
  return INTERVENTION_STAGES.includes(value as InterventionStage) ? (value as InterventionStage) : "intake";
}

function normaliseStatus(value: string | null): InterventionStatus {
  return INTERVENTION_STATUSES.includes(value as InterventionStatus) ? (value as InterventionStatus) : "planned";
}

const OPEN_INTERVENTION_STATUSES = ["planned", "active", "on_hold"];
const IMPACT_INTERVENTION_SELECT =
  "id,programme_id,cohort_id,cohort_member_id,msme_id,intervention_type,title,description,status,approved_amount,disbursed_amount,start_date,end_date,assigned_to_user_id,assigned_officer_id,closure_reason,closure_note,closed_at,approved_at,disbursed_at,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code),impact_beneficiary_cohorts(id,name,status,programme_id),impact_cohort_members(id,cohort_id,programme_id,msme_id,member_status),msmes(id,business_name,msme_id,state,sector),assigned_officers:users!impact_interventions_assigned_officer_id_fkey(id,full_name,email,role)";

function isClosureStage(stage: string | null) {
  return stage === "closure";
}

function isClosedStatus(status: string | null) {
  return status === "completed";
}

function validateFinancials(approvedAmount: number | null, disbursedAmount: number | null) {
  if (disbursedAmount !== null && approvedAmount === null) {
    throw new Error("Record an approved amount before recording disbursement.");
  }
  if (approvedAmount !== null && disbursedAmount !== null && disbursedAmount > approvedAmount) {
    throw new Error("Disbursed amount cannot exceed approved amount.");
  }
}

function validateInterventionTransition(currentStage: string, nextStage: string, params: { approvedAt: string | null; closureReason: string | null; closureNote: string | null; status: string | null }) {
  const currentIndex = INTERVENTION_STAGES.indexOf(normaliseStage(currentStage));
  const nextIndex = INTERVENTION_STAGES.indexOf(normaliseStage(nextStage));
  if (nextIndex > currentIndex + 1) {
    throw new Error("Move interventions through one lifecycle stage at a time.");
  }
  if (nextStage === "disbursement" && !params.approvedAt) {
    throw new Error("Record approval before moving an intervention to disbursement.");
  }
  if ((isClosedStatus(params.status) || isClosureStage(nextStage)) && (!params.closureReason || !params.closureNote)) {
    throw new Error("Closure reason and closure note are required before closing an intervention.");
  }
}

function normaliseCohortStatus(value: string | null): CohortStatus {
  return COHORT_STATUSES.includes(value as CohortStatus) ? (value as CohortStatus) : "draft";
}

function normaliseCohortMemberStatus(value: string | null): CohortMemberStatus {
  return COHORT_MEMBER_STATUSES.includes(value as CohortMemberStatus) ? (value as CohortMemberStatus) : "enrolled";
}

async function logActivity(params: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("activity_logs").insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  });
  logImpactDataError("activity_log_insert_failed", error);
}

export function parseProgrammeForm(formData: FormData) {
  const name = textValue(formData, "name");
  if (!name) throw new Error("Programme name is required.");

  const rawStatus = textValue(formData, "status") ?? "draft";
  const status = PROGRAMME_STATUSES.includes(rawStatus as ProgrammeStatus) ? rawStatus : "draft";

  return {
    name,
    programme_code: textValue(formData, "programme_code"),
    sponsor_name: textValue(formData, "sponsor_name"),
    description: textValue(formData, "description"),
    status,
    start_date: textValue(formData, "start_date"),
    end_date: textValue(formData, "end_date"),
  };
}

export function parseCohortForm(formData: FormData) {
  const programmeId = textValue(formData, "programme_id");
  const name = textValue(formData, "name");
  if (!programmeId) throw new Error("Select a programme for this cohort.");
  if (!name) throw new Error("Cohort name is required.");

  return {
    programme_id: programmeId,
    name,
    description: textValue(formData, "description"),
    state: textValue(formData, "state"),
    lga: textValue(formData, "lga"),
    sector: textValue(formData, "sector"),
    target_beneficiaries: integerValue(formData, "target_beneficiaries"),
    status: normaliseCohortStatus(textValue(formData, "status")),
    start_date: textValue(formData, "start_date"),
    end_date: textValue(formData, "end_date"),
  };
}

function distributionFromMembers(members: ImpactCohortMember[], key: "state" | "sector"): DistributionBucket[] {
  const counts = new Map<string, number>();
  for (const member of members) {
    const label = member.msmes?.[key]?.trim() || "Unspecified";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function buildCohortDashboardMetrics(members: ImpactCohortMember[]): CohortDashboardMetrics {
  const activeStatuses = new Set(["enrolled", "active"]);
  const verified = members.filter((member) => {
    const status = member.msmes?.verification_status?.toLowerCase() ?? "";
    return ["verified", "approved"].includes(status) || status.includes("verified");
  }).length;

  return {
    totalBeneficiaries: members.length,
    activeBeneficiaries: members.filter((member) => activeStatuses.has(member.member_status)).length,
    completedBeneficiaries: members.filter((member) => member.member_status === "completed").length,
    droppedBeneficiaries: members.filter((member) => member.member_status === "dropped").length,
    stateDistribution: distributionFromMembers(members, "state"),
    sectorDistribution: distributionFromMembers(members, "sector"),
    verificationCoverage: members.length > 0 ? Math.round((verified / members.length) * 100) : 0,
  };
}

function summarizeCohortMembers(members: ImpactCohortMember[]) {
  const counts = new Map<string, { member_count: number; active_count: number; completed_count: number; dropped_count: number }>();
  for (const member of members) {
    const current = counts.get(member.cohort_id) ?? { member_count: 0, active_count: 0, completed_count: 0, dropped_count: 0 };
    current.member_count += 1;
    if (member.member_status === "active" || member.member_status === "enrolled") current.active_count += 1;
    if (member.member_status === "completed") current.completed_count += 1;
    if (member.member_status === "dropped") current.dropped_count += 1;
    counts.set(member.cohort_id, current);
  }
  return counts;
}

export function parseInterventionForm(formData: FormData) {
  const title = textValue(formData, "title");
  if (!title) throw new Error("Intervention title is required.");

  const programmeId = textValue(formData, "programme_id");
  const cohortId = textValue(formData, "cohort_id");
  const cohortMemberId = textValue(formData, "cohort_member_id");
  if (!programmeId) throw new Error("Select a programme.");
  if (!cohortId) throw new Error("Select a beneficiary cohort.");
  if (!cohortMemberId) throw new Error("Select a cohort beneficiary.");

  const stage = normaliseStage(textValue(formData, "stage"));

  return {
    programme_id: programmeId,
    cohort_id: cohortId,
    cohort_member_id: cohortMemberId,
    intervention_type: textValue(formData, "intervention_type") ?? "support",
    title,
    description: textValue(formData, "description"),
    status: normaliseStatus(textValue(formData, "status")),
    approved_amount: numericValue(formData, "approved_amount"),
    disbursed_amount: numericValue(formData, "disbursed_amount"),
    start_date: textValue(formData, "start_date"),
    end_date: textValue(formData, "end_date"),
    assigned_officer_id: textValue(formData, "assigned_officer_id"),
    metadata: { stage },
  };
}

export async function listImpactProgrammes(ctxOrOptions?: UserContext | ImpactQueryOptions, maybeOptions: ImpactQueryOptions = {}): Promise<ImpactProgramme[]> {
  const { ctx, options } = resolveImpactReadArgs(ctxOrOptions, maybeOptions);
  const supabase = await createImpactReadClient(ctx);
  const [{ data, error }, { data: cohorts }, { data: members }] = await Promise.all([
    supabase
    .from("impact_programmes")
    .select("id,name,programme_code,sponsor_name,description,status,start_date,end_date,created_by_user_id,created_at,updated_at")
    .order("created_at", { ascending: false })
      .limit(options.limit ?? 50),
    supabase
      .from("impact_beneficiary_cohorts")
      .select("id,programme_id,current_beneficiaries"),
    supabase
      .from("impact_cohort_members")
      .select("programme_id,msme_id,member_status"),
  ]);

  throwImpactReadError("list_programmes_failed", error);
  const cohortCounts = new Map<string, number>();
  const memberSets = new Map<string, Set<string>>();
  for (const cohort of cohorts ?? []) {
    const programmeId = String(cohort.programme_id);
    cohortCounts.set(programmeId, (cohortCounts.get(programmeId) ?? 0) + 1);
  }
  for (const member of members ?? []) {
    const programmeId = String(member.programme_id);
    const msmeId = String(member.msme_id);
    if (!memberSets.has(programmeId)) memberSets.set(programmeId, new Set());
    memberSets.get(programmeId)?.add(msmeId);
  }

  return ((data ?? []) as ImpactProgramme[]).map((programme) => ({
    ...programme,
    cohort_count: cohortCounts.get(programme.id) ?? 0,
    cohort_beneficiary_count: memberSets.get(programme.id)?.size ?? 0,
  }));
}

export async function listImpactCohorts(ctx: UserContext, options: ImpactQueryOptions = {}): Promise<ImpactBeneficiaryCohort[]> {
  requireCohortRead(ctx);
  const supabase = await createPrivilegedImpactReadClient();
  let allowedCohortIds: string[] | null = null;

  if (ctx.role === "field_officer") {
    if (!ctx.appUserId) return [];
    const { data: assignments, error: assignmentError } = await supabase
      .from("impact_cohort_members")
      .select("cohort_id")
      .eq("assigned_to_user_id", ctx.appUserId);
    throwImpactReadError("list_field_officer_cohort_assignments_failed", assignmentError);
    allowedCohortIds = Array.from(new Set((assignments ?? []).map((item) => String(item.cohort_id))));
    if (allowedCohortIds.length === 0) return [];
  }

  let query = supabase
    .from("impact_beneficiary_cohorts")
    .select("id,programme_id,name,description,state,lga,sector,target_beneficiaries,current_beneficiaries,status,start_date,end_date,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code)")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (allowedCohortIds) query = query.in("id", allowedCohortIds);
  if (options.programmeId) query = query.eq("programme_id", options.programmeId);

  const [{ data, error }, { data: members }, { data: interventions }] = await Promise.all([
    query,
    supabase.from("impact_cohort_members").select("id,cohort_id,programme_id,msme_id,member_status,enrolled_at,completed_at,exited_at,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata"),
    supabase.from("impact_interventions").select("id,programme_id,cohort_id,cohort_member_id,msme_id,status"),
  ]);

  throwImpactReadError("list_cohorts_failed", error);
  const memberSummary = summarizeCohortMembers((members ?? []) as ImpactCohortMember[]);
  const interventionCounts = new Map<string, number>();
  const unanchoredInterventionCounts = new Map<string, number>();
  for (const intervention of interventions ?? []) {
    if (intervention.cohort_id) {
      const cohortId = String(intervention.cohort_id);
      interventionCounts.set(cohortId, (interventionCounts.get(cohortId) ?? 0) + 1);
    } else if (intervention.programme_id) {
      const programmeId = String(intervention.programme_id);
      unanchoredInterventionCounts.set(programmeId, (unanchoredInterventionCounts.get(programmeId) ?? 0) + 1);
    }
  }
  return ((data ?? []) as unknown as ImpactBeneficiaryCohort[]).map((cohort) => ({
    ...cohort,
    ...(memberSummary.get(cohort.id) ?? { member_count: 0, active_count: 0, completed_count: 0, dropped_count: 0 }),
    intervention_count: interventionCounts.get(cohort.id) ?? 0,
    unanchored_intervention_count: unanchoredInterventionCounts.get(cohort.programme_id) ?? 0,
  }));
}

export async function getImpactCohortDetail(ctx: UserContext, cohortId: string) {
  requireCohortRead(ctx);
  const supabase = await createPrivilegedImpactReadClient();
  const { data: cohort, error } = await supabase
    .from("impact_beneficiary_cohorts")
    .select("id,programme_id,name,description,state,lga,sector,target_beneficiaries,current_beneficiaries,status,start_date,end_date,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code)")
    .eq("id", cohortId)
    .maybeSingle();

  throwImpactReadError("get_cohort_failed", error);
  if (!cohort) return { cohort: null, members: [], dashboard: buildCohortDashboardMetrics([]) };

  let memberQuery = supabase
    .from("impact_cohort_members")
    .select("id,cohort_id,programme_id,msme_id,member_status,enrolled_at,completed_at,exited_at,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata,msmes(id,business_name,msme_id,state,sector,verification_status)")
    .eq("cohort_id", cohortId)
    .order("enrolled_at", { ascending: false });

  if (ctx.role === "field_officer") {
    if (!ctx.appUserId) return { cohort: null, members: [], dashboard: buildCohortDashboardMetrics([]) };
    memberQuery = memberQuery.eq("assigned_to_user_id", ctx.appUserId);
  }

  const [{ data: members, error: memberError }, { data: interventions }, { data: assessments }, { data: visits }] = await Promise.all([
    memberQuery,
    supabase
      .from("impact_interventions")
      .select("id,title,status,cohort_member_id,cohort_id,programme_id,msme_id")
      .eq("cohort_id", cohortId)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_assessments")
      .select("id,cohort_member_id,status,created_at")
      .eq("cohort_id", cohortId)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_field_visits")
      .select("id,cohort_id,cohort_member_id,status")
      .eq("cohort_id", cohortId)
      .order("created_at", { ascending: false }),
  ]);
  throwImpactReadError("get_cohort_members_failed", memberError);
  const scopedMembers = (members ?? []) as unknown as ImpactCohortMember[];
  if (ctx.role === "field_officer" && scopedMembers.length === 0) {
    return { cohort: null, members: [], dashboard: buildCohortDashboardMetrics([]) };
  }
  const interventionsByMember = new Map<string, Pick<ImpactIntervention, "id" | "title" | "status">[]>();
  for (const intervention of interventions ?? []) {
    if (!intervention.cohort_member_id) continue;
    const memberId = String(intervention.cohort_member_id);
    const rows = interventionsByMember.get(memberId) ?? [];
    rows.push({ id: String(intervention.id), title: String(intervention.title ?? "Intervention"), status: String(intervention.status ?? "planned") });
    interventionsByMember.set(memberId, rows);
  }
  const assessmentCountsByMember = new Map<string, number>();
  const latestAssessmentStatusByMember = new Map<string, string | null>();
  for (const assessment of assessments ?? []) {
    if (!assessment.cohort_member_id) continue;
    const memberId = String(assessment.cohort_member_id);
    assessmentCountsByMember.set(memberId, (assessmentCountsByMember.get(memberId) ?? 0) + 1);
    if (!latestAssessmentStatusByMember.has(memberId)) {
      latestAssessmentStatusByMember.set(memberId, String(assessment.status ?? "draft"));
    }
  }
  const visitCountsByMember = new Map<string, { field_visit_count: number; open_field_visit_count: number; completed_field_visit_count: number }>();
  for (const visit of visits ?? []) {
    if (!visit.cohort_member_id) continue;
    const memberId = String(visit.cohort_member_id);
    const current = visitCountsByMember.get(memberId) ?? { field_visit_count: 0, open_field_visit_count: 0, completed_field_visit_count: 0 };
    current.field_visit_count += 1;
    if (["completed", "reviewed"].includes(String(visit.status ?? ""))) current.completed_field_visit_count += 1;
    else current.open_field_visit_count += 1;
    visitCountsByMember.set(memberId, current);
  }

  return {
    cohort: cohort as unknown as ImpactBeneficiaryCohort,
    members: scopedMembers.map((member) => ({
      ...member,
      interventions: interventionsByMember.get(member.id) ?? [],
      intervention_count: interventionsByMember.get(member.id)?.length ?? 0,
      assessment_count: assessmentCountsByMember.get(member.id) ?? 0,
      latest_assessment_status: latestAssessmentStatusByMember.get(member.id) ?? null,
      ...(visitCountsByMember.get(member.id) ?? { field_visit_count: 0, open_field_visit_count: 0, completed_field_visit_count: 0 }),
    })),
    dashboard: buildCohortDashboardMetrics(scopedMembers),
  };
}

export async function createImpactCohort(ctx: UserContext, formData: FormData) {
  requireCohortManage(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const payload = { ...parseCohortForm(formData), created_by_user_id: ctx.appUserId };
  const { data, error } = await supabase.from("impact_beneficiary_cohorts").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Cohort was created but no cohort ID was returned.");
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_cohort_created", entityType: "impact_beneficiary_cohort", entityId: data.id, metadata: { role: ctx.role, programme_id: payload.programme_id } });
  return data.id as string;
}

async function resolveCsvMsmeIds(formData: FormData) {
  const csvFile = formData.get("csv_file");
  if (!csvFile || typeof csvFile === "string" || csvFile.size === 0) return [];

  const content = await csvFile.text();
  return content
    .split(/[\n,\r]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !["msme_id", "id", "business_id"].includes(value.toLowerCase()));
}

async function resolveSelectedMsmeIds(supabase: Awaited<ReturnType<typeof createPrivilegedImpactWriteClient>>, formData: FormData) {
  const directIds = [
    ...formData.getAll("msme_ids"),
    formData.get("selected_msme_id"),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  const csvValues = await resolveCsvMsmeIds(formData);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const rawIds = new Set([...directIds, ...csvValues.filter((value) => uuidPattern.test(value))]);
  const externalMsmeIds = csvValues.filter((value) => !uuidPattern.test(value));

  if (externalMsmeIds.length > 0) {
    const { data, error } = await supabase.from("msmes").select("id,msme_id").in("msme_id", externalMsmeIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) rawIds.add(String(row.id));
  }

  return Array.from(rawIds);
}

export async function enrollImpactCohortMembers(ctx: UserContext, cohortId: string, formData: FormData) {
  requireCohortManage(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const { cohort } = await getImpactCohortDetail(ctx, cohortId);
  if (!cohort) throw new Error("Cohort not found.");

  const msmeIds = await resolveSelectedMsmeIds(supabase, formData);
  if (msmeIds.length === 0) throw new Error("Select at least one MSME or upload a CSV with MSME IDs.");

  const memberStatus = normaliseCohortMemberStatus(textValue(formData, "member_status"));
  const assignedToUserId = textValue(formData, "assigned_to_user_id");
  const rows = msmeIds.map((msmeId) => ({
    cohort_id: cohortId,
    programme_id: cohort.programme_id,
    msme_id: msmeId,
    member_status: memberStatus,
    assigned_to_user_id: assignedToUserId,
    created_by_user_id: ctx.appUserId,
    metadata: { enrolment_source: "cohort_management" },
  }));

  const { error } = await supabase.from("impact_cohort_members").upsert(rows, { onConflict: "cohort_id,msme_id" });
  if (error) throw new Error(error.message);

  const programmeRows = msmeIds.map((msmeId) => ({
    programme_id: cohort.programme_id,
    msme_id: msmeId,
    enrollment_status: memberStatus === "completed" ? "completed" : "active",
    created_by_user_id: ctx.appUserId,
    metadata: { source: "impact_beneficiary_cohort", cohort_id: cohortId },
  }));
  await supabase.from("impact_programme_msmes").upsert(programmeRows, { onConflict: "programme_id,msme_id" });

  await logActivity({
    actorUserId: ctx.appUserId,
    action: "impact_cohort_members_enrolled",
    entityType: "impact_beneficiary_cohort",
    entityId: cohortId,
    metadata: { role: ctx.role, count: msmeIds.length, member_status: memberStatus, assigned_to_user_id: assignedToUserId },
  });
  return msmeIds.length;
}

export async function updateImpactCohortMemberStatus(ctx: UserContext, memberId: string, formData: FormData) {
  requireCohortManage(ctx);
  const status = normaliseCohortMemberStatus(textValue(formData, "member_status"));
  const supabase = await createPrivilegedImpactWriteClient();
  const timestamp = new Date().toISOString();
  const patch: Record<string, unknown> = {
    member_status: status,
    assigned_to_user_id: textValue(formData, "assigned_to_user_id"),
  };
  if (status === "completed") patch.completed_at = timestamp;
  if (status === "dropped" || status === "exited") patch.exited_at = timestamp;

  const { data, error } = await supabase
    .from("impact_cohort_members")
    .update(patch)
    .eq("id", memberId)
    .select("id,cohort_id,programme_id,msme_id")
    .single();
  if (error) throw new Error(error.message);

  if (data?.programme_id && data?.msme_id) {
    await supabase
      .from("impact_programme_msmes")
      .update({ enrollment_status: status === "completed" ? "completed" : status === "dropped" || status === "exited" ? "withdrawn" : "active" })
      .eq("programme_id", data.programme_id)
      .eq("msme_id", data.msme_id);
  }

  await logActivity({ actorUserId: ctx.appUserId, action: "impact_cohort_member_status_updated", entityType: "impact_cohort_member", entityId: memberId, metadata: { role: ctx.role, status, cohort_id: data?.cohort_id } });
}

export async function listImpactCohortMemberOptions(ctx: UserContext, options: ImpactQueryOptions = {}): Promise<ImpactCohortMember[]> {
  requireCohortRead(ctx);
  if (!options.cohortId) return [];
  const supabase = await createPrivilegedImpactReadClient();
  let query = supabase
    .from("impact_cohort_members")
    .select("id,cohort_id,programme_id,msme_id,member_status,enrolled_at,completed_at,exited_at,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata,msmes(id,business_name,msme_id,state,sector,verification_status),impact_beneficiary_cohorts(id,name,programme_id)")
    .eq("cohort_id", options.cohortId)
    .order("enrolled_at", { ascending: false })
    .limit(options.limit ?? 150);

  if (options.programmeId) query = query.eq("programme_id", options.programmeId);

  const { data, error } = await query;
  throwImpactReadError("list_cohort_member_options_failed", error);
  return (data ?? []) as unknown as ImpactCohortMember[];
}

export async function getImpactProgrammeDetail(ctx: UserContext, id: string) {
  requireImpactRead(ctx);
  const supabase = await createPrivilegedImpactReadClient();
  const [{ data: programme, error }, { data: interventions }, { data: enrolments }, { data: cohorts }, { data: cohortMembers }, { data: assessments }, { data: visits }] = await Promise.all([
    supabase
      .from("impact_programmes")
      .select("id,name,programme_code,sponsor_name,description,status,start_date,end_date,created_by_user_id,created_at,updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("impact_interventions")
      .select(IMPACT_INTERVENTION_SELECT)
      .eq("programme_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_programme_msmes")
      .select("id,programme_id,msme_id,enrollment_status,enrolled_at,msmes(id,business_name,msme_id,state,sector)")
      .eq("programme_id", id)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("impact_beneficiary_cohorts")
      .select("id,programme_id,name,description,state,lga,sector,target_beneficiaries,current_beneficiaries,status,start_date,end_date,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code)")
      .eq("programme_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_cohort_members")
      .select("id,cohort_id,programme_id,msme_id,member_status,enrolled_at,completed_at,exited_at,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata")
      .eq("programme_id", id),
    supabase
      .from("impact_assessments")
      .select("id,programme_id,cohort_id,status")
      .eq("programme_id", id),
    supabase
      .from("impact_field_visits")
      .select("id,programme_id,cohort_id,status")
      .eq("programme_id", id),
  ]);

  throwImpactReadError("get_programme_failed", error);
  const memberSummary = summarizeCohortMembers((cohortMembers ?? []) as ImpactCohortMember[]);
  const cohortInterventionCounts = new Map<string, number>();
  for (const intervention of interventions ?? []) {
    if (!intervention.cohort_id) continue;
    const cohortId = String(intervention.cohort_id);
    cohortInterventionCounts.set(cohortId, (cohortInterventionCounts.get(cohortId) ?? 0) + 1);
  }
  const cohortAssessmentCounts = new Map<string, { assessment_count: number; submitted_assessment_count: number; approved_assessment_count: number }>();
  for (const assessment of assessments ?? []) {
    if (!assessment.cohort_id) continue;
    const cohortId = String(assessment.cohort_id);
    const current = cohortAssessmentCounts.get(cohortId) ?? { assessment_count: 0, submitted_assessment_count: 0, approved_assessment_count: 0 };
    current.assessment_count += 1;
    if (["submitted", "reviewed", "approved", "completed"].includes(String(assessment.status ?? ""))) current.submitted_assessment_count += 1;
    if (String(assessment.status) === "approved") current.approved_assessment_count += 1;
    cohortAssessmentCounts.set(cohortId, current);
  }
  const cohortVisitCounts = new Map<string, { field_visit_count: number; open_field_visit_count: number; completed_field_visit_count: number }>();
  for (const visit of visits ?? []) {
    if (!visit.cohort_id) continue;
    const cohortId = String(visit.cohort_id);
    const current = cohortVisitCounts.get(cohortId) ?? { field_visit_count: 0, open_field_visit_count: 0, completed_field_visit_count: 0 };
    current.field_visit_count += 1;
    if (["completed", "reviewed"].includes(String(visit.status ?? ""))) current.completed_field_visit_count += 1;
    else current.open_field_visit_count += 1;
    cohortVisitCounts.set(cohortId, current);
  }
  const unanchoredInterventions = ((interventions ?? []) as unknown as ImpactIntervention[]).filter((intervention) => !intervention.cohort_id);
  return {
    programme: programme as ImpactProgramme | null,
    interventions: (interventions ?? []) as unknown as ImpactIntervention[],
    unanchoredInterventions,
    enrolments: enrolments ?? [],
    cohorts: ((cohorts ?? []) as unknown as ImpactBeneficiaryCohort[]).map((cohort) => ({
      ...cohort,
      ...(memberSummary.get(cohort.id) ?? { member_count: 0, active_count: 0, completed_count: 0, dropped_count: 0 }),
      intervention_count: cohortInterventionCounts.get(cohort.id) ?? 0,
      ...(cohortAssessmentCounts.get(cohort.id) ?? { assessment_count: 0, submitted_assessment_count: 0, approved_assessment_count: 0 }),
      ...(cohortVisitCounts.get(cohort.id) ?? { field_visit_count: 0, open_field_visit_count: 0, completed_field_visit_count: 0 }),
    })),
  };
}

export async function createImpactProgramme(ctx: UserContext, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const payload = { ...parseProgrammeForm(formData), created_by_user_id: ctx.appUserId };
  const { data, error } = await supabase.from("impact_programmes").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Programme was created but no programme ID was returned.");
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_programme_created", entityType: "impact_programme", entityId: data.id, metadata: { role: ctx.role } });
  return data.id as string;
}

export async function listImpactInterventions(ctxOrOptions?: UserContext | ImpactQueryOptions, maybeOptions: ImpactQueryOptions = {}): Promise<ImpactIntervention[]> {
  const { ctx, options } = resolveImpactReadArgs(ctxOrOptions, maybeOptions);
  const supabase = await createImpactReadClient(ctx);
  let query = supabase
    .from("impact_interventions")
    .select(IMPACT_INTERVENTION_SELECT)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (options.programmeId) query = query.eq("programme_id", options.programmeId);
  if (options.cohortId) query = query.eq("cohort_id", options.cohortId);
  if (options.status) query = query.eq("status", options.status);
  if (options.stage) query = query.eq("metadata->>stage", options.stage);
  if (options.interventionType) query = query.eq("intervention_type", options.interventionType);
  if (options.assignedOfficerId) query = query.eq("assigned_officer_id", options.assignedOfficerId);
  if (options.cohortMemberId) query = query.eq("cohort_member_id", options.cohortMemberId);

  const { data, error } = await query;
  throwImpactReadError("list_interventions_failed", error);
  return (data ?? []) as unknown as ImpactIntervention[];
}

export async function getImpactInterventionDetail(id: string, ctx?: UserContext) {
  const supabase = await createImpactReadClient(ctx);
  const [{ data: intervention, error }, { data: events }, { data: assessments }, { data: visits }] = await Promise.all([
    supabase
      .from("impact_interventions")
      .select(IMPACT_INTERVENTION_SELECT)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("impact_intervention_events")
      .select("id,intervention_id,programme_id,cohort_id,cohort_member_id,msme_id,event_type,from_status,to_status,from_stage,to_stage,title,note,actor_user_id,actor_role,created_at")
      .eq("intervention_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_assessments")
      .select(IMPACT_ASSESSMENT_SELECT)
      .eq("intervention_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_field_visits")
      .select(fieldVisitSelect())
      .eq("intervention_id", id)
      .order("created_at", { ascending: false }),
  ]);

  throwImpactReadError("get_intervention_failed", error);
  return {
    intervention: intervention as unknown as ImpactIntervention | null,
    events: (events ?? []) as ImpactInterventionEvent[],
    assessments: (assessments ?? []) as unknown as ImpactAssessment[],
    visits: (visits ?? []) as unknown as ImpactFieldVisit[],
  };
}

export async function createImpactIntervention(ctx: UserContext, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const parsed = parseInterventionForm(formData);
  validateFinancials(parsed.approved_amount, parsed.disbursed_amount);
  const now = new Date().toISOString();
  const initialApprovedAt = parsed.approved_amount !== null ? now : null;
  validateInterventionTransition("intake", String(parsed.metadata.stage), {
    approvedAt: initialApprovedAt,
    closureReason: null,
    closureNote: null,
    status: parsed.status,
  });

  const { data: member, error: memberError } = await supabase
    .from("impact_cohort_members")
    .select("id,cohort_id,programme_id,msme_id,member_status")
    .eq("id", parsed.cohort_member_id)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member) throw new Error("Selected cohort beneficiary was not found.");
  if (member.programme_id !== parsed.programme_id) throw new Error("Selected cohort beneficiary does not belong to the selected programme.");
  if (member.cohort_id !== parsed.cohort_id) throw new Error("Selected cohort beneficiary does not belong to the selected cohort.");

  if (OPEN_INTERVENTION_STATUSES.includes(parsed.status) && textValue(formData, "allow_duplicate") !== "yes") {
    const { data: duplicate, error: duplicateError } = await supabase
      .from("impact_interventions")
      .select("id,title,status")
      .eq("programme_id", parsed.programme_id)
      .eq("cohort_member_id", parsed.cohort_member_id)
      .eq("intervention_type", parsed.intervention_type)
      .in("status", OPEN_INTERVENTION_STATUSES)
      .limit(1)
      .maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate) throw new Error("An open intervention of this type already exists for this cohort beneficiary.");
  }

  const payload = {
    ...parsed,
    msme_id: member.msme_id,
    approved_at: initialApprovedAt,
    disbursed_at: parsed.disbursed_amount !== null ? now : null,
    created_by_user_id: ctx.appUserId,
  };

  const { data, error } = await supabase.from("impact_interventions").insert(payload).select("id,programme_id,cohort_id,cohort_member_id,msme_id,status,metadata").single();
  if (error) throw new Error(error.message);

  await supabase.from("impact_programme_msmes").upsert({
    programme_id: payload.programme_id,
    msme_id: payload.msme_id,
    enrollment_status: "active",
    created_by_user_id: ctx.appUserId,
    metadata: { source: "cohort_anchored_intervention", cohort_id: payload.cohort_id, cohort_member_id: payload.cohort_member_id },
  }, { onConflict: "programme_id,msme_id" });

  await appendImpactInterventionEvent(ctx, data.id, {
    programmeId: data.programme_id,
    cohortId: data.cohort_id,
    cohortMemberId: data.cohort_member_id,
    msmeId: data.msme_id,
    eventType: "intervention_created",
    title: "Intervention created",
    note: `Initial status: ${data.status}`,
    toStatus: data.status,
    toStage: String((data.metadata as Record<string, unknown> | null)?.stage ?? "intake"),
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "intervention_created", entityType: "impact_intervention", entityId: data.id, metadata: { role: ctx.role, programme_id: payload.programme_id, cohort_id: payload.cohort_id, cohort_member_id: payload.cohort_member_id } });
  return data.id as string;
}

export async function updateImpactInterventionStatus(ctx: UserContext, interventionId: string, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const { intervention } = await getImpactInterventionDetail(interventionId, ctx);
  if (!intervention) throw new Error("Intervention not found.");

  const nextStatus = normaliseStatus(textValue(formData, "status"));
  const nextStage = normaliseStage(textValue(formData, "stage"));
  const currentMetadata = (intervention.metadata ?? {}) as Record<string, unknown>;
  const currentStage = String(currentMetadata.stage ?? "intake");
  const note = textValue(formData, "note");

  const { error } = await supabase
    .from("impact_interventions")
    .update({ status: nextStatus, metadata: { ...currentMetadata, stage: nextStage } })
    .eq("id", interventionId);
  if (error) throw new Error(error.message);

  await appendImpactInterventionEvent(ctx, interventionId, {
    programmeId: intervention.programme_id,
    cohortId: intervention.cohort_id,
    cohortMemberId: intervention.cohort_member_id,
    msmeId: intervention.msme_id,
    eventType: nextStatus !== intervention.status ? "intervention_status_changed" : "intervention_stage_changed",
    title: "Intervention progress updated",
    note,
    fromStatus: intervention.status,
    toStatus: nextStatus,
    fromStage: currentStage,
    toStage: nextStage,
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_intervention_status_updated", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role, status: nextStatus, stage: nextStage } });
}

export async function updateImpactInterventionLifecycle(ctx: UserContext, interventionId: string, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const { intervention } = await getImpactInterventionDetail(interventionId, ctx);
  if (!intervention) throw new Error("Intervention not found.");

  const currentMetadata = (intervention.metadata ?? {}) as Record<string, unknown>;
  const currentStage = String(currentMetadata.stage ?? "intake");
  const nextStatus = normaliseStatus(textValue(formData, "status"));
  const nextStage = normaliseStage(textValue(formData, "stage"));
  const approvedAmount = numericValue(formData, "approved_amount");
  const disbursedAmount = numericValue(formData, "disbursed_amount");
  const assignedOfficerId = textValue(formData, "assigned_officer_id");
  const closureReason = textValue(formData, "closure_reason");
  const closureNote = textValue(formData, "closure_note");
  const note = textValue(formData, "note");
  const now = new Date().toISOString();

  validateFinancials(approvedAmount, disbursedAmount);
  const approvedAt = approvedAmount !== null ? (intervention.approved_at ?? now) : null;
  const disbursedAt = disbursedAmount !== null ? (intervention.disbursed_at ?? now) : null;
  validateInterventionTransition(currentStage, nextStage, { approvedAt, closureReason, closureNote, status: nextStatus });

  const patch = {
    status: nextStatus,
    approved_amount: approvedAmount,
    disbursed_amount: disbursedAmount,
    assigned_officer_id: assignedOfficerId,
    assigned_to_user_id: assignedOfficerId,
    start_date: textValue(formData, "start_date"),
    end_date: textValue(formData, "end_date"),
    closure_reason: closureReason,
    closure_note: closureNote,
    approved_at: approvedAt,
    disbursed_at: disbursedAt,
    closed_at: isClosedStatus(nextStatus) || isClosureStage(nextStage) ? (intervention.closed_at ?? now) : null,
    metadata: { ...currentMetadata, stage: nextStage },
  };

  const { error } = await supabase.from("impact_interventions").update(patch).eq("id", interventionId);
  if (error) throw new Error(error.message);

  if (nextStage !== currentStage) {
    await appendImpactInterventionEvent(ctx, interventionId, {
      programmeId: intervention.programme_id,
      cohortId: intervention.cohort_id,
      cohortMemberId: intervention.cohort_member_id,
      msmeId: intervention.msme_id,
      eventType: "intervention_stage_changed",
      title: "Intervention stage changed",
      note,
      fromStage: currentStage,
      toStage: nextStage,
      fromStatus: intervention.status,
      toStatus: nextStatus,
    });
    await logActivity({ actorUserId: ctx.appUserId, action: "intervention_stage_changed", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role, from_stage: currentStage, to_stage: nextStage } });
  }

  if (nextStatus !== intervention.status) {
    await appendImpactInterventionEvent(ctx, interventionId, {
      programmeId: intervention.programme_id,
      cohortId: intervention.cohort_id,
      cohortMemberId: intervention.cohort_member_id,
      msmeId: intervention.msme_id,
      eventType: "intervention_status_changed",
      title: "Intervention status changed",
      note,
      fromStage: currentStage,
      toStage: nextStage,
      fromStatus: intervention.status,
      toStatus: nextStatus,
    });
    await logActivity({ actorUserId: ctx.appUserId, action: "intervention_status_changed", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role, from_status: intervention.status, to_status: nextStatus } });
  }

  if (approvedAmount !== intervention.approved_amount || disbursedAmount !== intervention.disbursed_amount) {
    await appendImpactInterventionEvent(ctx, interventionId, {
      programmeId: intervention.programme_id,
      cohortId: intervention.cohort_id,
      cohortMemberId: intervention.cohort_member_id,
      msmeId: intervention.msme_id,
      eventType: "intervention_financials_updated",
      title: "Intervention financials updated",
      note,
      fromStatus: intervention.status,
      toStatus: nextStatus,
      fromStage: currentStage,
      toStage: nextStage,
    });
    await logActivity({ actorUserId: ctx.appUserId, action: "intervention_financials_updated", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role, approved_amount: approvedAmount, disbursed_amount: disbursedAmount } });
  }

  if (assignedOfficerId !== intervention.assigned_officer_id) {
    await appendImpactInterventionEvent(ctx, interventionId, {
      programmeId: intervention.programme_id,
      cohortId: intervention.cohort_id,
      cohortMemberId: intervention.cohort_member_id,
      msmeId: intervention.msme_id,
      eventType: "intervention_assigned",
      title: "Intervention assignment updated",
      note: note ?? "Assigned officer changed.",
    });
    await logActivity({ actorUserId: ctx.appUserId, action: "intervention_assigned", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role, assigned_officer_id: assignedOfficerId } });
  }

  if ((isClosedStatus(nextStatus) || isClosureStage(nextStage)) && !intervention.closed_at) {
    await appendImpactInterventionEvent(ctx, interventionId, {
      programmeId: intervention.programme_id,
      cohortId: intervention.cohort_id,
      cohortMemberId: intervention.cohort_member_id,
      msmeId: intervention.msme_id,
      eventType: "intervention_closed",
      title: "Intervention closed",
      note: closureNote,
      fromStatus: intervention.status,
      toStatus: nextStatus,
      fromStage: currentStage,
      toStage: nextStage,
    });
    await logActivity({ actorUserId: ctx.appUserId, action: "intervention_closed", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role, closure_reason: closureReason } });
  }
}

export async function appendImpactInterventionEvent(ctx: UserContext, interventionId: string, params: {
  programmeId?: string | null;
  cohortId?: string | null;
  cohortMemberId?: string | null;
  msmeId?: string | null;
  eventType?: string;
  title: string;
  note?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromStage?: string | null;
  toStage?: string | null;
}) {
  requireImpactWrite(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("impact_intervention_events").insert({
    intervention_id: interventionId,
    programme_id: params.programmeId ?? null,
    cohort_id: params.cohortId ?? null,
    cohort_member_id: params.cohortMemberId ?? null,
    msme_id: params.msmeId ?? null,
    event_type: params.eventType ?? "note",
    title: params.title,
    note: params.note ?? null,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    from_stage: params.fromStage ?? null,
    to_stage: params.toStage ?? null,
    actor_user_id: ctx.appUserId,
    actor_role: ctx.role,
  });
  if (error) throw new Error(error.message);
}

export async function appendImpactInterventionNote(ctx: UserContext, interventionId: string, formData: FormData) {
  requireImpactWrite(ctx);
  const { intervention } = await getImpactInterventionDetail(interventionId, ctx);
  if (!intervention) throw new Error("Intervention not found.");
  const note = textValue(formData, "note");
  if (!note) throw new Error("Timeline note is required.");
  await appendImpactInterventionEvent(ctx, interventionId, {
    programmeId: intervention.programme_id,
    cohortId: intervention.cohort_id,
    cohortMemberId: intervention.cohort_member_id,
    msmeId: intervention.msme_id,
    eventType: "note",
    title: textValue(formData, "title") ?? "Operational note",
    note,
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_intervention_event_added", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role } });
}

export async function listMsmePickerOptions(options: ImpactQueryOptions = {}): Promise<MsmePickerOption[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("msmes")
    .select("id,business_name,msme_id,state,sector")
    .order("business_name", { ascending: true })
    .limit(options.limit ?? 100);

  if (options.state) query = query.eq("state", options.state);
  if (options.sector) query = query.eq("sector", options.sector);
  if (options.search) {
    const term = options.search.replaceAll(",", " ").trim();
    if (term) query = query.or(`business_name.ilike.%${term}%,msme_id.ilike.%${term}%`);
  }

  const { data, error } = await query;

  throwImpactReadError("list_msme_picker_failed", error);
  return (data ?? []) as MsmePickerOption[];
}

export async function listUserPickerOptions(role?: UserRole): Promise<UserPickerOption[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("users").select("id,full_name,email,role").order("full_name", { ascending: true }).limit(100);
  if (role) query = query.eq("role", role);
  const { data, error } = await query;
  throwImpactReadError("list_user_picker_failed", error);
  return (data ?? []) as UserPickerOption[];
}

export function getInterventionStage(intervention: Pick<ImpactIntervention, "metadata">) {
  const value = intervention.metadata?.stage;
  return typeof value === "string" && value ? value : "intake";
}

function normaliseQuestionType(value: string | null): AssessmentQuestionType {
  return ASSESSMENT_QUESTION_TYPES.includes(value as AssessmentQuestionType) ? (value as AssessmentQuestionType) : "text";
}

function normaliseAssessmentStatus(value: string | null): AssessmentStatus {
  return ASSESSMENT_STATUSES.includes(value as AssessmentStatus) ? (value as AssessmentStatus) : "draft";
}

function normaliseTemplateStatus(value: string | null): AssessmentTemplateStatus {
  return ASSESSMENT_TEMPLATE_STATUSES.includes(value as AssessmentTemplateStatus) ? (value as AssessmentTemplateStatus) : "draft";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function clampScore(score: number, maxScore: number) {
  return Math.max(0, Math.min(score, maxScore));
}

function normalizeScoringBands(value: unknown): AssessmentScoringBand[] {
  const rows = Array.isArray(value) ? value : DEFAULT_ASSESSMENT_SCORING_BANDS;
  const bands = rows
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : null;
      const min = finiteNumber(item.min);
      const max = finiteNumber(item.max);
      if (!label || min === null || max === null || max < min) return null;
      return { label, min, max };
    })
    .filter((item): item is AssessmentScoringBand => Boolean(item));
  return bands.length > 0 ? bands : [...DEFAULT_ASSESSMENT_SCORING_BANDS];
}

function parseScoringBandsJson(raw: string | null) {
  if (!raw) return normalizeScoringBands(null);
  try {
    return normalizeScoringBands(JSON.parse(raw) as unknown);
  } catch (error) {
    throw new Error(`Invalid scoring bands JSON: ${error instanceof Error ? error.message : "Unknown parse error"}`);
  }
}

function readinessCategory(score: number, maxScore: number, bands?: AssessmentScoringBand[] | null): "low" | "moderate" | "strong" {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const matchedBand = normalizeScoringBands(bands).find((band) => percent >= band.min && percent <= band.max);
  if (matchedBand?.label === "strong" || matchedBand?.label === "moderate" || matchedBand?.label === "low") return matchedBand.label;
  if (percent >= 75) return "strong";
  if (percent >= 50) return "moderate";
  return "low";
}

function normalizeScoringConfig(value: unknown): QuestionScoringConfig {
  return isRecord(value) ? (value as QuestionScoringConfig) : {};
}

function questionMaxScore(question: Pick<ImpactAssessmentQuestion, "weight" | "scoring_config">) {
  const config = normalizeScoringConfig(question.scoring_config);
  const configuredMax = finiteNumber(config.max_score ?? config.maxScore);
  const fallback = finiteNumber(question.weight) ?? 0;
  return configuredMax !== null && configuredMax >= 0 ? configuredMax : fallback;
}

function questionOptionScoreMap(config: QuestionScoringConfig) {
  const raw = config.option_scores ?? config.optionScores ?? config.options;
  if (!isRecord(raw)) return new Map<string, number>();
  return new Map(
    Object.entries(raw)
      .map(([key, value]) => {
        const score = finiteNumber(value);
        return score === null ? null : ([key, score] as const);
      })
      .filter((entry): entry is readonly [string, number] => Boolean(entry)),
  );
}

function scoreNumberQuestion(raw: string, maxScore: number, config: QuestionScoringConfig) {
  const numeric = finiteNumber(raw);
  if (numeric === null) return 0;

  if (Array.isArray(config.ranges)) {
    for (const range of config.ranges) {
      const min = finiteNumber(range.min);
      const max = finiteNumber(range.max);
      const score = finiteNumber(range.score ?? range.points);
      const minPass = min === null || numeric >= min;
      const maxPass = max === null || numeric <= max;
      if (minPass && maxPass && score !== null) return clampScore(score, maxScore);
    }
    return clampScore(finiteNumber(config.default_score ?? config.defaultScore) ?? 0, maxScore);
  }

  const threshold = finiteNumber(config.threshold);
  if (threshold !== null) {
    const operator = typeof config.operator === "string" ? config.operator : ">=";
    const passed = operator === ">" ? numeric > threshold : operator === "<" ? numeric < threshold : operator === "<=" ? numeric <= threshold : operator === "=" || operator === "==" ? numeric === threshold : numeric >= threshold;
    const passScore = finiteNumber(config.pass_score ?? config.passScore) ?? maxScore;
    const failScore = finiteNumber(config.fail_score ?? config.failScore) ?? 0;
    return clampScore(passed ? passScore : failScore, maxScore);
  }

  return numeric > 0 ? maxScore : 0;
}

function scoreRawQuestion(question: ImpactAssessmentQuestion, rawValue: FormDataEntryValue | string | null) {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  const config = normalizeScoringConfig(question.scoring_config);
  const mode = typeof config.mode === "string" ? config.mode : "";
  const maxScore = questionMaxScore(question);
  const answered = raw.length > 0;
  let score = answered ? maxScore : 0;

  if (question.question_type === "number" || mode === "number_threshold" || mode === "number_range") {
    score = answered ? scoreNumberQuestion(raw, maxScore, config) : 0;
  } else if (question.question_type === "boolean" || mode === "boolean") {
    const value = raw ? raw === "true" || raw === "yes" || raw === "on" : null;
    const trueScore = finiteNumber(config.true_score ?? config.trueScore) ?? maxScore;
    const falseScore = finiteNumber(config.false_score ?? config.falseScore) ?? 0;
    score = value === null ? 0 : value ? trueScore : falseScore;
  } else if (question.question_type === "select" || mode === "select_options") {
    const optionScores = questionOptionScoreMap(config);
    score = answered && optionScores.size > 0 ? optionScores.get(raw) ?? finiteNumber(config.default_option_score ?? config.defaultOptionScore) ?? 0 : score;
  } else if (question.question_type === "multi-select" || mode === "multi_select_options") {
    const values = raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
    const optionScores = questionOptionScoreMap(config);
    if (values.length === 0) {
      score = 0;
    } else if (optionScores.size > 0) {
      const itemScores = values.map((value) => optionScores.get(value) ?? finiteNumber(config.default_option_score ?? config.defaultOptionScore) ?? 0);
      const aggregation = typeof config.aggregation === "string" ? config.aggregation : "sum";
      const rawScore = aggregation === "max" ? Math.max(...itemScores) : aggregation === "average" ? itemScores.reduce((sum, item) => sum + item, 0) / itemScores.length : itemScores.reduce((sum, item) => sum + item, 0);
      score = Math.min(rawScore, finiteNumber(config.cap) ?? maxScore);
    }
  }

  return { score: clampScore(score, maxScore), maxScore };
}

function rawValueFromResponse(question: ImpactAssessmentQuestion, response: ImpactAssessmentResponse | undefined) {
  if (!response) return "";
  if (question.question_type === "number") return response.response_number?.toString() ?? "";
  if (question.question_type === "boolean") return response.response_boolean === null ? "" : response.response_boolean ? "true" : "false";
  if (question.question_type === "multi-select") {
    const values = response.response_json?.values;
    return Array.isArray(values) ? values.join(", ") : response.response_text ?? "";
  }
  return response.response_text ?? "";
}

function parseOptions(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => ({ label: option, value: option }));
}

function parseTemplateQuestionRows(raw: string | null) {
  if (!raw) throw new Error("Add at least one assessment question.");
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [section, question, type, category, weight, required, options, helpText, scoringConfig] = line.split("|").map((item) => item?.trim() ?? "");
      if (!section || !question) {
        throw new Error(`Question row ${index + 1} must include a section and question text.`);
      }
      const parsedWeight = Number(weight);
      return {
        sectionTitle: section,
        questionText: question,
        questionType: normaliseQuestionType(type || "text"),
        category: category || null,
        weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1,
        isRequired: ["yes", "true", "required", "1"].includes(required.toLowerCase()),
        options: parseOptions(options || null),
        helpText: helpText || null,
        scoringConfig: parseQuestionScoringConfig(scoringConfig || null),
        displayOrder: index + 1,
      };
    });

  if (rows.length === 0) throw new Error("Add at least one assessment question.");
  return rows;
}

function parseQuestionScoringConfig(raw: string | null) {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error("Scoring config must be a JSON object.");
    return parsed;
  } catch (error) {
    throw new Error(`Invalid scoring config JSON: ${error instanceof Error ? error.message : "Unknown parse error"}`);
  }
}

function normaliseAssessmentType(value: string | null): AssessmentType {
  if (!value) return "baseline";
  if ((ASSESSMENT_TYPES as readonly string[]).includes(value)) return value as AssessmentType;

  const legacyMap: Record<string, AssessmentType> = {
    readiness: "credit_readiness",
    eligibility: "credit_readiness",
    monitoring: "post_funding_monitoring",
    completion: "impact",
  };

  return legacyMap[value] ?? "baseline";
}

const IMPACT_ASSESSMENT_SELECT =
  "id,template_id,template_version,programme_id,cohort_id,cohort_member_id,intervention_id,field_visit_id,msme_id,assessment_type,title,status,score,risk_level,conducted_by_user_id,conducted_at,submitted_at,submitted_by_user_id,returned_at,returned_by_user_id,return_reason,created_at,metadata,impact_assessment_templates(id,name,version,assessment_type),impact_programmes(id,name,programme_code),impact_beneficiary_cohorts(id,name,programme_id),impact_cohort_members(id,cohort_id,programme_id,msme_id,member_status),impact_interventions(id,title,cohort_id,cohort_member_id),impact_field_visits!impact_assessments_field_visit_id_fkey(id,title,status),msmes(id,business_name,msme_id,state,sector)";

export type ImpactAssessmentValidationError = {
  questionId: string;
  message: string;
};

function questionOptionValues(question: ImpactAssessmentQuestion) {
  if (!Array.isArray(question.options_json)) return [];
  return question.options_json
    .map((option) => {
      if (typeof option === "string") return option;
      if (option && typeof option === "object" && "value" in option) return String(option.value);
      return null;
    })
    .filter((value): value is string => Boolean(value));
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateAssessmentAnswer(question: ImpactAssessmentQuestion, raw: string, requireAnswer: boolean): ImpactAssessmentValidationError | null {
  if (!raw) {
    return requireAnswer && question.is_required ? { questionId: question.id, message: `Required question missing: ${question.question_text}` } : null;
  }

  if (question.question_type === "number" && !Number.isFinite(Number(raw))) {
    return { questionId: question.id, message: `${question.question_text} must be numeric.` };
  }

  if (question.question_type === "date" && !isValidIsoDate(raw)) {
    return { questionId: question.id, message: `${question.question_text} must be a valid date.` };
  }

  if (question.question_type === "select") {
    const options = questionOptionValues(question);
    if (options.length > 0 && !options.includes(raw)) {
      return { questionId: question.id, message: `${question.question_text} must use one of the configured options.` };
    }
  }

  if (question.question_type === "multi-select") {
    const options = questionOptionValues(question);
    const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
    if (options.length > 0 && values.some((value) => !options.includes(value))) {
      return { questionId: question.id, message: `${question.question_text} contains a selection that is not configured for this template.` };
    }
  }

  return null;
}

export async function createAssessmentTemplate(ctx: UserContext, formData: FormData) {
  requireAssessmentManage(ctx);
  const name = textValue(formData, "name");
  if (!name) throw new Error("Template name is required.");

  const rows = parseTemplateQuestionRows(textValue(formData, "question_blueprint"));
  const supabase = await createPrivilegedImpactWriteClient();
  const versionValue = numericValue(formData, "version");
  const payload = {
    name,
    description: textValue(formData, "description"),
    assessment_type: normaliseAssessmentType(textValue(formData, "assessment_type")),
    version: versionValue && versionValue > 0 ? Math.trunc(versionValue) : 1,
    status: normaliseTemplateStatus(textValue(formData, "status")),
    scoring_bands: parseScoringBandsJson(textValue(formData, "scoring_bands")),
    scoring_model_version: 1,
    created_by_user_id: ctx.appUserId,
    metadata: { source: "assessment_template_engine" },
  };

  const { data: template, error } = await supabase.from("impact_assessment_templates").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  const sectionIds = new Map<string, string>();
  let sectionOrder = 0;
  for (const row of rows) {
    if (sectionIds.has(row.sectionTitle)) continue;
    sectionOrder += 1;
    const sectionWeight = rows.filter((item) => item.sectionTitle === row.sectionTitle).reduce((sum, item) => sum + item.weight, 0);
    const { data: section, error: sectionError } = await supabase
      .from("impact_assessment_sections")
      .insert({ template_id: template.id, title: row.sectionTitle, display_order: sectionOrder, weight: sectionWeight })
      .select("id")
      .single();
    if (sectionError) throw new Error(sectionError.message);
    sectionIds.set(row.sectionTitle, section.id as string);
  }

  const questions = rows.map((row) => ({
    template_id: template.id,
    section_id: sectionIds.get(row.sectionTitle) ?? null,
    question_text: row.questionText,
    question_type: row.questionType,
    category: row.category,
    display_order: row.displayOrder,
    is_required: row.isRequired,
    options_json: row.options,
    help_text: row.helpText,
    weight: row.weight,
    scoring_config: row.scoringConfig,
    conditional_logic: {},
  }));
  const { error: questionError } = await supabase.from("impact_assessment_questions").insert(questions);
  if (questionError) throw new Error(questionError.message);

  await logActivity({ actorUserId: ctx.appUserId, action: "impact_assessment_template_created", entityType: "impact_assessment_template", entityId: template.id, metadata: { role: ctx.role, questions: questions.length } });
  return template.id as string;
}

export async function listAssessmentTemplates(ctxOrOptions?: UserContext | ImpactQueryOptions, maybeOptions: ImpactQueryOptions = {}): Promise<ImpactAssessmentTemplate[]> {
  const { ctx, options } = resolveImpactReadArgs(ctxOrOptions, maybeOptions);
  const supabase = await createImpactReadClient(ctx);
  const { data, error } = await supabase
    .from("impact_assessment_templates")
    .select("id,name,description,assessment_type,version,status,scoring_bands,scoring_model_version,created_by_user_id,created_at,updated_at,metadata")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  throwImpactReadError("list_assessment_templates_failed", error);
  return (data ?? []) as ImpactAssessmentTemplate[];
}

export async function getAssessmentTemplate(templateId: string, ctx?: UserContext) {
  const supabase = await createImpactReadClient(ctx);
  const [{ data: template, error }, { data: sections }, { data: questions }] = await Promise.all([
    supabase
      .from("impact_assessment_templates")
      .select("id,name,description,assessment_type,version,status,scoring_bands,scoring_model_version,created_by_user_id,created_at,updated_at,metadata")
      .eq("id", templateId)
      .maybeSingle(),
    supabase
      .from("impact_assessment_sections")
      .select("id,template_id,title,description,display_order,weight")
      .eq("template_id", templateId)
      .order("display_order", { ascending: true }),
    supabase
      .from("impact_assessment_questions")
      .select("id,assessment_id,template_id,section_id,question_text,question_type,category,display_order,is_required,options_json,help_text,weight,scoring_config,conditional_logic")
      .eq("template_id", templateId)
      .order("display_order", { ascending: true }),
  ]);

  throwImpactReadError("get_assessment_template_failed", error);
  return {
    template: template as ImpactAssessmentTemplate | null,
    sections: (sections ?? []) as ImpactAssessmentSection[],
    questions: (questions ?? []) as ImpactAssessmentQuestion[],
  };
}

export async function createAssessment(ctx: UserContext, formData: FormData) {
  requireAssessmentManage(ctx);
  const templateId = textValue(formData, "template_id");
  const programmeId = textValue(formData, "programme_id");
  const cohortId = textValue(formData, "cohort_id");
  const cohortMemberId = textValue(formData, "cohort_member_id");
  if (!templateId) throw new Error("Select an assessment template.");
  if (!programmeId) throw new Error("Select a programme.");
  if (!cohortId) throw new Error("Select a beneficiary cohort.");
  if (!cohortMemberId) throw new Error("Select a cohort beneficiary.");

  const { template } = await getAssessmentTemplate(templateId, ctx);
  if (!template) throw new Error("Assessment template not found.");

  const supabase = await createPrivilegedImpactWriteClient();
  const { data: member, error: memberError } = await supabase
    .from("impact_cohort_members")
    .select("id,cohort_id,programme_id,msme_id,member_status")
    .eq("id", cohortMemberId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member) throw new Error("Selected cohort beneficiary was not found.");
  if (member.programme_id !== programmeId) throw new Error("Selected cohort beneficiary does not belong to the selected programme.");
  if (member.cohort_id !== cohortId) throw new Error("Selected cohort beneficiary does not belong to the selected cohort.");

  const interventionId = textValue(formData, "intervention_id");
  if (interventionId) {
    const { data: intervention, error: interventionError } = await supabase
      .from("impact_interventions")
      .select("id,programme_id,cohort_id,cohort_member_id,msme_id")
      .eq("id", interventionId)
      .maybeSingle();
    if (interventionError) throw new Error(interventionError.message);
    if (!intervention) throw new Error("Selected intervention was not found.");
    if (intervention.programme_id !== programmeId) throw new Error("Selected intervention does not belong to the selected programme.");
    if (intervention.cohort_id !== cohortId) throw new Error("Selected intervention does not belong to the selected cohort.");
    if (intervention.cohort_member_id !== cohortMemberId) throw new Error("Selected intervention does not belong to the selected cohort beneficiary.");
    if (intervention.msme_id !== member.msme_id) throw new Error("Selected intervention MSME does not match the selected cohort beneficiary.");
  }

  const payload = {
    template_id: template.id,
    template_version: template.version,
    programme_id: programmeId,
    cohort_id: cohortId,
    cohort_member_id: cohortMemberId,
    intervention_id: interventionId,
    msme_id: member.msme_id,
    assessment_type: normaliseAssessmentType(textValue(formData, "assessment_type") ?? template.assessment_type),
    title: textValue(formData, "title") ?? template.name,
    status: "draft",
    created_by_user_id: ctx.appUserId,
    assigned_to_user_id: textValue(formData, "assigned_to_user_id"),
    metadata: { template_name: template.name, source: "cohort_anchored_assessment" },
  };
  const { data, error } = await supabase.from("impact_assessments").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await logActivity({ actorUserId: ctx.appUserId, action: "assessment_created", entityType: "impact_assessment", entityId: data.id, metadata: { role: ctx.role, template_id: template.id, programme_id: programmeId, cohort_id: cohortId, cohort_member_id: cohortMemberId } });
  return data.id as string;
}

export async function listImpactAssessments(ctxOrOptions?: UserContext | ImpactQueryOptions, maybeOptions: ImpactQueryOptions = {}): Promise<ImpactAssessment[]> {
  const { ctx, options } = resolveImpactReadArgs(ctxOrOptions, maybeOptions);
  const supabase = await createImpactReadClient(ctx);
  let query = supabase
    .from("impact_assessments")
    .select(IMPACT_ASSESSMENT_SELECT)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);

  if (options.programmeId) query = query.eq("programme_id", options.programmeId);
  if (options.cohortId) query = query.eq("cohort_id", options.cohortId);
  if (options.assessmentType) query = query.eq("assessment_type", options.assessmentType);
  if (options.status) query = query.eq("status", options.status);
  if (options.interventionId) query = query.eq("intervention_id", options.interventionId);
  if (options.cohortMemberId) query = query.eq("cohort_member_id", options.cohortMemberId);

  const { data, error } = await query;

  throwImpactReadError("list_assessments_failed", error);
  return (data ?? []) as unknown as ImpactAssessment[];
}

export async function getImpactAssessmentDetail(assessmentId: string, ctx?: UserContext) {
  const supabase = await createImpactReadClient(ctx);
  const { data: assessment, error } = await supabase
    .from("impact_assessments")
    .select(IMPACT_ASSESSMENT_SELECT)
    .eq("id", assessmentId)
    .maybeSingle();

  throwImpactReadError("get_assessment_failed", error);
  if (!assessment) return { assessment: null, template: null, sections: [], questions: [], responses: [], scores: [], scoreRuns: [], reviews: [], visits: [] };

  const templateId = (assessment as unknown as ImpactAssessment).template_id;
  const [{ template, sections, questions }, { data: responses }, { data: scores }, { data: scoreRuns }, { data: reviews }, { data: visits }] = await Promise.all([
    templateId ? getAssessmentTemplate(templateId, ctx) : Promise.resolve({ template: null, sections: [], questions: [] }),
    supabase
      .from("impact_assessment_responses")
      .select("id,assessment_id,question_id,msme_id,response_text,response_number,response_boolean,response_json,score,max_score,responded_by_user_id,created_at,updated_at")
      .eq("assessment_id", assessmentId),
    supabase
      .from("impact_assessment_scores")
      .select("id,assessment_id,score_run_id,section_id,section_title,score,max_score,weighted_score,readiness_category,calculated_at,is_latest,scoring_model_version")
      .eq("assessment_id", assessmentId)
      .eq("is_latest", true)
      .order("section_title", { ascending: true }),
    supabase
      .from("impact_assessment_score_runs")
      .select("id,assessment_id,template_id,template_version,run_type,score,max_score,weighted_score,readiness_category,calculated_by_user_id,calculated_at,scoring_model_version,scoring_snapshot,metadata")
      .eq("assessment_id", assessmentId)
      .order("calculated_at", { ascending: false }),
    supabase
      .from("impact_assessment_reviews")
      .select("id,assessment_id,reviewer_user_id,review_status,notes,created_at")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_field_visits")
      .select(fieldVisitSelect())
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    assessment: assessment as unknown as ImpactAssessment,
    template,
    sections,
    questions,
    responses: (responses ?? []) as ImpactAssessmentResponse[],
    scores: (scores ?? []) as ImpactAssessmentScore[],
    scoreRuns: (scoreRuns ?? []) as ImpactAssessmentScoreRun[],
    reviews: (reviews ?? []) as ImpactAssessmentReview[],
    visits: (visits ?? []) as unknown as ImpactFieldVisit[],
  };
}

function responsePayload(question: ImpactAssessmentQuestion, rawValue: FormDataEntryValue | null, msmeId: string | null, ctx: UserContext) {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  const { score, maxScore } = scoreRawQuestion(question, rawValue);
  const payload: Record<string, unknown> = {
    response_text: null,
    response_number: null,
    response_boolean: null,
    response_json: {},
    score,
    max_score: maxScore,
    msme_id: msmeId,
    responded_by_user_id: ctx.appUserId,
  };

  if (question.question_type === "number") {
    const numeric = Number(raw);
    payload.response_number = raw && Number.isFinite(numeric) ? numeric : null;
  } else if (question.question_type === "boolean") {
    const value = raw ? raw === "true" || raw === "yes" || raw === "on" : null;
    payload.response_boolean = value;
    payload.response_text = value === null ? null : value ? "Yes" : "No";
  } else if (question.question_type === "multi-select") {
    const values = raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
    payload.response_json = { values };
    payload.response_text = values.length > 0 ? values.join(", ") : null;
  } else {
    payload.response_text = raw || null;
  }

  return payload;
}

function assessmentResponseIsAnswered(response: ImpactAssessmentResponse) {
  if (typeof response.response_text === "string" && response.response_text.trim().length > 0) return true;
  if (response.response_number !== null) return true;
  if (response.response_boolean !== null) return true;
  const values = response.response_json?.values;
  return Array.isArray(values) && values.length > 0;
}

export function getMissingRequiredAssessmentQuestions(questions: ImpactAssessmentQuestion[], responses: ImpactAssessmentResponse[]) {
  const answered = new Set(responses.filter(assessmentResponseIsAnswered).map((response) => response.question_id));
  return questions.filter((question) => question.is_required && !answered.has(question.id));
}

export function validateAssessmentResponses(questions: ImpactAssessmentQuestion[], formData: FormData, requireRequiredAnswers: boolean): ImpactAssessmentValidationError[] {
  const errors: ImpactAssessmentValidationError[] = [];
  for (const question of questions) {
    const rawValue = formData.get(`response_${question.id}`);
    const raw = typeof rawValue === "string" ? rawValue.trim() : "";
    const error = validateAssessmentAnswer(question, raw, requireRequiredAnswers);
    if (error) errors.push(error);
  }
  return errors;
}

async function persistAssessmentResponses(ctx: UserContext, assessmentId: string, formData: FormData, options: { requireRequiredAnswers: boolean; calculateScore: boolean }) {
  requireAssessmentManage(ctx);
  const detail = await getImpactAssessmentDetail(assessmentId, ctx);
  if (!detail.assessment) throw new Error("Assessment not found.");
  if (detail.assessment.status === "reviewed" || detail.assessment.status === "approved" || detail.assessment.status === "completed") {
    throw new Error("Reviewed or completed assessments cannot be edited.");
  }

  const validationErrors = validateAssessmentResponses(detail.questions, formData, options.requireRequiredAnswers);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0].message);
  }

  const supabase = await createPrivilegedImpactWriteClient();
  for (const question of detail.questions) {
    const rawValue = formData.get(`response_${question.id}`);
    const raw = typeof rawValue === "string" ? rawValue.trim() : "";
    const existing = detail.responses.find((response) => response.question_id === question.id);
    if (!raw && !existing) continue;

    const payload = responsePayload(question, rawValue, detail.assessment.msme_id, ctx);
    if (existing) {
      const { error } = await supabase.from("impact_assessment_responses").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("impact_assessment_responses").insert({ ...payload, assessment_id: assessmentId, question_id: question.id });
      if (error) throw new Error(error.message);
    }
  }

  if (options.calculateScore) await calculateAssessmentScore(assessmentId, ctx, "submission");
}

export async function saveAssessmentDraft(ctx: UserContext, assessmentId: string, formData: FormData) {
  await persistAssessmentResponses(ctx, assessmentId, formData, { requireRequiredAnswers: false, calculateScore: false });
  const supabase = await createPrivilegedImpactWriteClient();
  const { data: current } = await supabase.from("impact_assessments").select("status").eq("id", assessmentId).maybeSingle();
  const status = normaliseAssessmentStatus(String(current?.status ?? "draft"));
  if (status === "submitted") {
    await supabase.from("impact_assessments").update({ status: "draft" }).eq("id", assessmentId);
  }
  await logActivity({ actorUserId: ctx.appUserId, action: "assessment_draft_saved", entityType: "impact_assessment", entityId: assessmentId, metadata: { role: ctx.role } });
}

export async function saveAssessmentResponse(ctx: UserContext, assessmentId: string, formData: FormData) {
  await saveAssessmentDraft(ctx, assessmentId, formData);
}

export async function calculateAssessmentScore(assessmentId: string, ctx?: UserContext, runType: "calculation" | "submission" | "review" | "completion" = "calculation") {
  const detail = await getImpactAssessmentDetail(assessmentId, ctx);
  if (!detail.assessment) throw new Error("Assessment not found.");
  const supabase = await createPrivilegedImpactWriteClient();
  const responseByQuestion = new Map(detail.responses.map((response) => [response.question_id, response]));
  const bands = normalizeScoringBands(detail.template?.scoring_bands);
  const scoringModelVersion = detail.template?.scoring_model_version ?? 1;
  const sectionScores = detail.sections.map((section) => {
    const questions = detail.questions.filter((question) => question.section_id === section.id);
    const scoredQuestions = questions.map((question) => scoreRawQuestion(question, rawValueFromResponse(question, responseByQuestion.get(question.id))));
    const maxScore = scoredQuestions.reduce((sum, item) => sum + item.maxScore, 0);
    const score = scoredQuestions.reduce((sum, item) => sum + item.score, 0);
    return {
      assessment_id: assessmentId,
      section_id: section.id,
      section_title: section.title,
      score,
      max_score: maxScore,
      weighted_score: maxScore > 0 ? (score / maxScore) * Number(section.weight || maxScore) : 0,
      readiness_category: readinessCategory(score, maxScore, bands),
      scoring_model_version: scoringModelVersion,
      metadata: { question_count: questions.length },
    };
  });
  const totalScore = sectionScores.reduce((sum, item) => sum + item.score, 0);
  const totalMax = sectionScores.reduce((sum, item) => sum + item.max_score, 0);
  const total = {
    assessment_id: assessmentId,
    section_id: null,
    section_title: "Overall",
    score: totalScore,
    max_score: totalMax,
    weighted_score: totalMax > 0 ? (totalScore / totalMax) * 100 : 0,
    readiness_category: readinessCategory(totalScore, totalMax, bands),
    scoring_model_version: scoringModelVersion,
    metadata: { score_type: "overall" },
  };

  const { data: scoreRun, error: scoreRunError } = await supabase
    .from("impact_assessment_score_runs")
    .insert({
      assessment_id: assessmentId,
      template_id: detail.assessment.template_id,
      template_version: detail.assessment.template_version,
      run_type: runType,
      score: total.score,
      max_score: total.max_score,
      weighted_score: total.weighted_score,
      readiness_category: total.readiness_category,
      calculated_by_user_id: ctx?.appUserId ?? null,
      scoring_model_version: scoringModelVersion,
      scoring_snapshot: {
        bands,
        sections: detail.sections.map((section) => ({ id: section.id, title: section.title, weight: section.weight })),
        questions: detail.questions.map((question) => ({
          id: question.id,
          section_id: question.section_id,
          question_type: question.question_type,
          weight: question.weight,
          scoring_config: question.scoring_config ?? {},
        })),
      },
      metadata: { source: "assessment_phase2a_scoring_engine" },
    })
    .select("id")
    .single();
  if (scoreRunError) throw new Error(scoreRunError.message);

  await supabase.from("impact_assessment_scores").update({ is_latest: false }).eq("assessment_id", assessmentId).eq("is_latest", true);
  const scoreRows = [...sectionScores, total].map((row) => ({
    ...row,
    score_run_id: scoreRun.id,
    is_latest: true,
  }));
  const { error } = await supabase.from("impact_assessment_scores").insert(scoreRows);
  if (error) throw new Error(error.message);
  const { error: updateError } = await supabase
    .from("impact_assessments")
    .update({ score: total.weighted_score, risk_level: total.readiness_category })
    .eq("id", assessmentId);
  if (updateError) throw new Error(updateError.message);
  return total;
}

export async function completeAssessment(ctx: UserContext, assessmentId: string) {
  requireAssessmentManage(ctx);
  const detail = await getImpactAssessmentDetail(assessmentId, ctx);
  if (!detail.assessment) throw new Error("Assessment not found.");
  const missing = getMissingRequiredAssessmentQuestions(detail.questions, detail.responses)[0];
  if (missing) throw new Error(`Required question missing: ${missing.question_text}`);

  const total = await calculateAssessmentScore(assessmentId, ctx, "completion");
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase
    .from("impact_assessments")
    .update({ status: "completed", completed_at: new Date().toISOString(), conducted_by_user_id: ctx.appUserId, conducted_at: new Date().toISOString(), score: total.weighted_score, risk_level: total.readiness_category })
    .eq("id", assessmentId);
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_assessment_completed", entityType: "impact_assessment", entityId: assessmentId, metadata: { role: ctx.role, score: total.weighted_score } });
}

export async function submitAssessment(ctx: UserContext, assessmentId: string, formData: FormData) {
  await persistAssessmentResponses(ctx, assessmentId, formData, { requireRequiredAnswers: true, calculateScore: true });
  const supabase = await createPrivilegedImpactWriteClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("impact_assessments")
    .update({
      status: "submitted",
      submitted_at: now,
      submitted_by_user_id: ctx.appUserId,
      return_reason: null,
      returned_at: null,
      returned_by_user_id: null,
    })
    .eq("id", assessmentId);
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "assessment_submitted", entityType: "impact_assessment", entityId: assessmentId, metadata: { role: ctx.role } });
}

export async function reviewAssessment(ctx: UserContext, assessmentId: string, formData: FormData) {
  requireAssessmentReview(ctx);
  const status = textValue(formData, "review_status") ?? "reviewed";
  const reviewStatus = ["reviewed", "approved", "returned"].includes(status) ? status : "reviewed";
  const returnReason = textValue(formData, "return_reason") ?? textValue(formData, "notes");
  if (reviewStatus === "returned" && !returnReason) {
    throw new Error("Return reason is required when returning an assessment for correction.");
  }
  await calculateAssessmentScore(assessmentId, ctx, "review");
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("impact_assessment_reviews").insert({
    assessment_id: assessmentId,
    reviewer_user_id: ctx.appUserId,
    review_status: reviewStatus,
    notes: reviewStatus === "returned" ? returnReason : textValue(formData, "notes"),
    metadata: { role: ctx.role },
  });
  if (error) throw new Error(error.message);
  const assessmentStatus = reviewStatus === "returned" ? "returned" : reviewStatus === "approved" ? "approved" : "reviewed";
  const { error: updateError } = await supabase
    .from("impact_assessments")
    .update({
      status: assessmentStatus,
      reviewed_by_user_id: ctx.appUserId,
      reviewed_at: new Date().toISOString(),
      returned_by_user_id: reviewStatus === "returned" ? ctx.appUserId : null,
      returned_at: reviewStatus === "returned" ? new Date().toISOString() : null,
      return_reason: reviewStatus === "returned" ? returnReason : null,
    })
    .eq("id", assessmentId);
  if (updateError) throw new Error(updateError.message);
  const action = reviewStatus === "approved" ? "assessment_approved" : reviewStatus === "returned" ? "assessment_returned" : "assessment_reviewed";
  await logActivity({ actorUserId: ctx.appUserId, action, entityType: "impact_assessment", entityId: assessmentId, metadata: { role: ctx.role, review_status: reviewStatus } });
}

function normaliseFieldVisitStatus(value: string | null): FieldVisitStatus {
  return FIELD_VISIT_STATUSES.includes(value as FieldVisitStatus) ? (value as FieldVisitStatus) : "pending";
}

function parseChecklistRows(raw: string | null) {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [item, category, required] = line.split("|").map((part) => part?.trim() ?? "");
      return {
        checklist_item: item,
        item_category: category || null,
        is_required: ["yes", "true", "required", "1"].includes((required || "").toLowerCase()),
        display_order: index + 1,
      };
    })
    .filter((row) => row.checklist_item);
}

function fieldVisitSelect() {
  return "id,programme_id,cohort_id,cohort_member_id,intervention_id,assessment_id,msme_id,title,visit_date,scheduled_at,location_text,status,assigned_to_user_id,completed_by_user_id,completed_at,reviewed_by_user_id,reviewed_at,findings,recommendations,follow_up_visit_id,priority,created_at,impact_programmes(id,name,programme_code),impact_beneficiary_cohorts(id,name,programme_id),impact_cohort_members(id,cohort_id,programme_id,msme_id,member_status),impact_interventions(id,title),impact_assessments!impact_field_visits_assessment_id_fkey(id,title,assessment_type),msmes(id,business_name,msme_id,state,sector)";
}

function evidenceSelect() {
  return IMPACT_EVIDENCE_SELECT;
}

export async function createFieldVisit(ctx: UserContext, formData: FormData) {
  requireMonitoringManage(ctx);
  const title = textValue(formData, "title");
  if (!title) throw new Error("Field visit title is required.");
  const programmeId = textValue(formData, "programme_id");
  const cohortId = textValue(formData, "cohort_id");
  const cohortMemberId = textValue(formData, "cohort_member_id");
  if (!programmeId) throw new Error("Select a programme for this field visit.");
  if (!cohortId) throw new Error("Select a beneficiary cohort for this field visit.");
  if (!cohortMemberId) throw new Error("Select a cohort beneficiary for this field visit.");

  const supabase = await createPrivilegedImpactWriteClient();
  const { data: member, error: memberError } = await supabase
    .from("impact_cohort_members")
    .select("id,cohort_id,programme_id,msme_id,member_status")
    .eq("id", cohortMemberId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member) throw new Error("Selected field visit cohort beneficiary does not exist.");
  if (member.programme_id !== programmeId) throw new Error("Selected field visit cohort beneficiary does not belong to the selected programme.");
  if (member.cohort_id !== cohortId) throw new Error("Selected field visit cohort beneficiary does not belong to the selected cohort.");

  const assignedToUserId = textValue(formData, "assigned_to_user_id");
  if (assignedToUserId) {
    const { data: assignee, error: assigneeError } = await supabase
      .from("users")
      .select("id,role")
      .eq("id", assignedToUserId)
      .maybeSingle();
    if (assigneeError) throw new Error(assigneeError.message);
    if (!assignee) throw new Error("Selected field officer does not exist.");
    if (assignee.role !== "field_officer") throw new Error("Selected assignee must have field_officer role.");
  }

  const interventionId = textValue(formData, "intervention_id");
  if (interventionId) {
    const { data: intervention, error: interventionError } = await supabase
      .from("impact_interventions")
      .select("id,programme_id,cohort_id,cohort_member_id,msme_id")
      .eq("id", interventionId)
      .maybeSingle();
    if (interventionError) throw new Error(interventionError.message);
    if (!intervention) throw new Error("Selected field visit intervention does not exist.");
    if (intervention.programme_id !== programmeId) throw new Error("Selected field visit intervention does not belong to the selected programme.");
    if (intervention.cohort_id !== cohortId) throw new Error("Selected field visit intervention does not belong to the selected cohort.");
    if (intervention.cohort_member_id !== cohortMemberId) throw new Error("Selected field visit intervention does not belong to the selected cohort beneficiary.");
    if (intervention.msme_id !== member.msme_id) throw new Error("Selected field visit intervention MSME does not match the selected cohort beneficiary.");
  }

  const assessmentId = textValue(formData, "assessment_id");
  if (assessmentId) {
    const { data: assessment, error: assessmentError } = await supabase
      .from("impact_assessments")
      .select("id,programme_id,cohort_id,cohort_member_id,msme_id")
      .eq("id", assessmentId)
      .maybeSingle();
    if (assessmentError) throw new Error(assessmentError.message);
    if (!assessment) throw new Error("Selected field visit assessment does not exist.");
    if (assessment.programme_id !== programmeId) throw new Error("Selected field visit assessment does not belong to the selected programme.");
    if (assessment.cohort_id !== cohortId) throw new Error("Selected field visit assessment does not belong to the selected cohort.");
    if (assessment.cohort_member_id !== cohortMemberId) throw new Error("Selected field visit assessment does not belong to the selected cohort beneficiary.");
    if (assessment.msme_id !== member.msme_id) throw new Error("Selected field visit assessment MSME does not match the selected cohort beneficiary.");
  }

  const scheduledAt = textValue(formData, "scheduled_at");
  const payload = {
    title,
    programme_id: programmeId,
    cohort_id: cohortId,
    cohort_member_id: cohortMemberId,
    intervention_id: interventionId,
    assessment_id: assessmentId,
    msme_id: member.msme_id,
    visit_date: textValue(formData, "visit_date") ?? scheduledAt?.slice(0, 10),
    scheduled_at: scheduledAt,
    location_text: textValue(formData, "location_text"),
    status: normaliseFieldVisitStatus(textValue(formData, "status")),
    assigned_to_user_id: assignedToUserId,
    priority: textValue(formData, "priority") ?? "normal",
    created_by_user_id: ctx.appUserId,
    metadata: { source: "cohort_anchored_field_monitoring" },
  };
  const { data, error } = await supabase.from("impact_field_visits").insert(payload).select("id,assigned_to_user_id").single();
  if (error) throw new Error(error.message);

  const checklistRows = parseChecklistRows(textValue(formData, "checklist_blueprint"));
  if (checklistRows.length > 0) {
    const { error: checklistError } = await supabase
      .from("impact_monitoring_checklists")
      .insert(checklistRows.map((row) => ({ ...row, field_visit_id: data.id })));
    if (checklistError) throw new Error(checklistError.message);
  }

  if (data.assigned_to_user_id) {
    await assignFieldVisit(ctx, data.id, data.assigned_to_user_id);
  }

  await logActivity({ actorUserId: ctx.appUserId, action: "field_visit_created", entityType: "impact_field_visit", entityId: data.id, metadata: { role: ctx.role, programme_id: programmeId, cohort_id: cohortId, cohort_member_id: cohortMemberId } });
  return data.id as string;
}

export async function assignFieldVisit(ctx: UserContext, visitId: string, assignedToUserId: string) {
  requireMonitoringManage(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const { data: assignee, error: assigneeError } = await supabase
    .from("users")
    .select("id,role")
    .eq("id", assignedToUserId)
    .maybeSingle();
  if (assigneeError) throw new Error(assigneeError.message);
  if (!assignee) throw new Error("Selected field officer does not exist.");
  if (assignee.role !== "field_officer") throw new Error("Selected assignee must have field_officer role.");

  const { error } = await supabase
    .from("impact_field_visits")
    .update({ assigned_to_user_id: assignedToUserId, assigned_at: new Date().toISOString(), status: "assigned" })
    .eq("id", visitId);
  if (error) throw new Error(error.message);

  const { error: assignmentError } = await supabase.from("impact_field_visit_assignments").insert({
    field_visit_id: visitId,
    assigned_to_user_id: assignedToUserId,
    assigned_by_user_id: ctx.appUserId,
    assignment_status: "assigned",
  });
  if (assignmentError) throw new Error(assignmentError.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "field_visit_assigned", entityType: "impact_field_visit", entityId: visitId, metadata: { role: ctx.role, assigned_to_user_id: assignedToUserId } });
}

export async function listFieldVisits(ctx?: UserContext, options: ImpactQueryOptions = {}): Promise<ImpactFieldVisit[]> {
  const supabase = await createScopedImpactReadClient(ctx);
  let query = supabase
    .from("impact_field_visits")
    .select(fieldVisitSelect())
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);

  if (ctx?.role === "field_officer") {
    query = query.eq("assigned_to_user_id", ctx.appUserId ?? "00000000-0000-0000-0000-000000000000");
  }
  if (options.programmeId) query = query.eq("programme_id", options.programmeId);
  if (options.cohortId) query = query.eq("cohort_id", options.cohortId);
  if (options.cohortMemberId) query = query.eq("cohort_member_id", options.cohortMemberId);
  if (options.interventionId) query = query.eq("intervention_id", options.interventionId);
  if (options.status) query = query.eq("status", options.status);
  if (options.assignedOfficerId) query = query.eq("assigned_to_user_id", options.assignedOfficerId);

  const { data, error } = await query;

  throwImpactReadError("list_field_visits_failed", error);
  return (data ?? []) as unknown as ImpactFieldVisit[];
}

export async function listImpactFieldVisits(ctxOrOptions?: UserContext | ImpactQueryOptions, maybeOptions: ImpactQueryOptions = {}): Promise<ImpactFieldVisit[]> {
  const { ctx, options } = resolveImpactReadArgs(ctxOrOptions, maybeOptions);
  return listFieldVisits(ctx, options);
}

export async function getFieldVisit(ctx: UserContext, visitId: string) {
  const supabase = await createScopedImpactReadClient(ctx);
  const [{ data: visit, error }, { data: assignments }, { data: checklist }, { data: notes }, { data: evidence }] = await Promise.all([
    supabase.from("impact_field_visits").select(fieldVisitSelect()).eq("id", visitId).maybeSingle(),
    supabase.from("impact_field_visit_assignments").select("id,field_visit_id,assigned_to_user_id,assigned_by_user_id,assignment_status,assigned_at,completed_at").eq("field_visit_id", visitId).order("assigned_at", { ascending: false }),
    supabase.from("impact_monitoring_checklists").select("id,field_visit_id,checklist_item,item_category,is_required,is_completed,display_order").eq("field_visit_id", visitId).order("display_order", { ascending: true }),
    supabase.from("impact_monitoring_notes").select("id,field_visit_id,note_type,title,note,created_by_user_id,created_at").eq("field_visit_id", visitId).order("created_at", { ascending: false }),
    supabase.from("impact_evidence_files").select(evidenceSelect()).eq("field_visit_id", visitId).order("created_at", { ascending: false }),
  ]);

  throwImpactReadError("get_field_visit_failed", error);
  const fieldVisit = visit as unknown as ImpactFieldVisit | null;
  if (fieldVisit && ctx.role === "field_officer" && fieldVisit.assigned_to_user_id !== ctx.appUserId) {
    throw new Error("You can only access field visits assigned to you.");
  }

  return {
    visit: fieldVisit,
    assignments: (assignments ?? []) as ImpactFieldVisitAssignment[],
    checklist: (checklist ?? []) as ImpactMonitoringChecklist[],
    notes: (notes ?? []) as ImpactMonitoringNote[],
    evidence: mapImpactEvidenceRows(evidence),
  };
}

export async function completeFieldVisit(ctx: UserContext, visitId: string, formData: FormData) {
  const detail = await getFieldVisit(ctx, visitId);
  if (!detail.visit) throw new Error("Field visit not found.");
  const supabase = await createPrivilegedImpactWriteClient();
  const now = new Date().toISOString();

  if (MONITORING_REVIEW_ROLES.includes(ctx.role) && textValue(formData, "review_action")) {
    requireMonitoringReview(ctx);
    const { error } = await supabase
      .from("impact_field_visits")
      .update({ status: "reviewed", reviewed_by_user_id: ctx.appUserId, reviewed_at: now })
      .eq("id", visitId);
    if (error) throw new Error(error.message);
    const note = textValue(formData, "review_note");
    if (note) {
      await supabase.from("impact_monitoring_notes").insert({
        field_visit_id: visitId,
        programme_id: detail.visit.programme_id,
        intervention_id: detail.visit.intervention_id,
        assessment_id: detail.visit.assessment_id ?? null,
        msme_id: detail.visit.msme_id,
        note_type: "review",
        title: "Review note",
        note,
        created_by_user_id: ctx.appUserId,
      });
    }
    await logActivity({ actorUserId: ctx.appUserId, action: "impact_field_visit_reviewed", entityType: "impact_field_visit", entityId: visitId, metadata: { role: ctx.role } });
    return;
  }

  if (ctx.role !== "field_officer" && !MONITORING_MANAGE_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to complete this field visit.");
  }

  for (const item of detail.checklist) {
    const isCompleted = formData.get(`checklist_${item.id}`) === "on";
    await supabase
      .from("impact_monitoring_checklists")
      .update({ is_completed: isCompleted, completed_by_user_id: isCompleted ? ctx.appUserId : null, completed_at: isCompleted ? now : null })
      .eq("id", item.id);
  }

  const findings = textValue(formData, "findings");
  const recommendations = textValue(formData, "recommendations");
  const { error } = await supabase
    .from("impact_field_visits")
    .update({ status: "completed", findings, recommendations, completed_by_user_id: ctx.appUserId, completed_at: now })
    .eq("id", visitId);
  if (error) throw new Error(error.message);

  const note = textValue(formData, "note");
  if (note) {
    await supabase.from("impact_monitoring_notes").insert({
      field_visit_id: visitId,
      programme_id: detail.visit.programme_id,
      intervention_id: detail.visit.intervention_id,
      assessment_id: detail.visit.assessment_id ?? null,
      msme_id: detail.visit.msme_id,
      note_type: "field_note",
      title: textValue(formData, "note_title") ?? "Field completion note",
      note,
      created_by_user_id: ctx.appUserId,
    });
  }

  await supabase
    .from("impact_field_visit_assignments")
    .update({ assignment_status: "completed", completed_at: now })
    .eq("field_visit_id", visitId)
    .eq("assigned_to_user_id", ctx.appUserId ?? detail.visit.assigned_to_user_id ?? "");
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_field_visit_completed", entityType: "impact_field_visit", entityId: visitId, metadata: { role: ctx.role } });
}

export async function createEvidenceRecord(ctx: UserContext, formData: FormData) {
  return uploadImpactEvidence(ctx, formData);
}

export async function listEvidence(ctx?: UserContext, options: ImpactQueryOptions = {}): Promise<ImpactEvidenceFile[]> {
  const supabase = await createScopedImpactReadClient(ctx);
  let query = supabase
    .from("impact_evidence_files")
    .select(evidenceSelect())
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (ctx?.role === "field_officer") {
    const { data: visits } = await supabase.from("impact_field_visits").select("id").eq("assigned_to_user_id", ctx.appUserId ?? "00000000-0000-0000-0000-000000000000");
    const visitIds = (visits ?? []).map((visit) => visit.id as string);
    if (visitIds.length === 0) return [];
    query = query.in("field_visit_id", visitIds);
  }

  const { data, error } = await query;
  throwImpactReadError("list_evidence_failed", error);
  return mapImpactEvidenceRows(data);
}

export async function getEvidence(ctx: UserContext, evidenceId: string) {
  const supabase = await createScopedImpactReadClient(ctx);
  const [{ data: evidence, error }, { data: links }] = await Promise.all([
    supabase.from("impact_evidence_files").select(evidenceSelect()).eq("id", evidenceId).maybeSingle(),
    supabase.from("impact_evidence_links").select("id,evidence_id,programme_id,intervention_id,assessment_id,field_visit_id,msme_id,link_type,created_at").eq("evidence_id", evidenceId).order("created_at", { ascending: false }),
  ]);
  throwImpactReadError("get_evidence_failed", error);
  const item = evidence ? mapImpactEvidenceRow(evidence) : null;
  if (item && ctx.role === "field_officer") {
    const visible = item.field_visit_id
      ? await supabase.from("impact_field_visits").select("id").eq("id", item.field_visit_id).eq("assigned_to_user_id", ctx.appUserId ?? "").maybeSingle()
      : { data: null };
    if (!visible.data) throw new Error("You can only access evidence linked to your assigned visits.");
  }
  return { evidence: item, links: (links ?? []) as ImpactEvidenceLink[] };
}

function bucketBy<T>(items: T[], getKey: (item: T) => string | null | undefined): DistributionBucket[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item) || "Unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function reportSelect() {
  return "id,programme_id,intervention_id,assessment_id,field_visit_id,msme_id,title,report_type,status,summary,generated_by_user_id,reviewed_by_user_id,approved_by_user_id,approved_at,generated_at,published_at,created_at,report_json,evidence_references,metadata,impact_programmes(id,name,programme_code),impact_interventions(id,title),msmes(id,business_name,msme_id,state,sector)";
}

function normaliseReportType(value: string | null): ImpactReportType {
  return REPORT_TYPES.includes(value as ImpactReportType) ? (value as ImpactReportType) : "executive_summary";
}

export async function getExecutiveDashboardMetrics(ctx?: UserContext): Promise<ExecutiveDashboardMetrics> {
  const supabase = await createReportingReadClient(ctx);
  const [
    msmeCount,
    programmes,
    interventions,
    assessments,
    fieldVisits,
    evidence,
    scores,
  ] = await Promise.all([
    supabase.from("msmes").select("id", { count: "exact", head: true }),
    supabase.from("impact_programmes").select("id,name,status,created_at").limit(1000),
    supabase.from("impact_interventions").select("id,title,status,created_at,msmes(state,sector)").limit(1000),
    supabase.from("impact_assessments").select("id,title,status,created_at,risk_level").limit(1000),
    supabase.from("impact_field_visits").select("id,title,status,created_at").limit(1000),
    supabase.from("impact_evidence_files").select("id,file_name,verification_status,created_at").limit(1000),
    supabase.from("impact_assessment_scores").select("id,section_id,readiness_category").is("section_id", null).eq("is_latest", true).limit(1000),
  ]);
  [
    ["msmes_count_failed", msmeCount.error],
    ["impact_programmes_dashboard_failed", programmes.error],
    ["impact_interventions_dashboard_failed", interventions.error],
    ["impact_assessments_dashboard_failed", assessments.error],
    ["impact_field_visits_dashboard_failed", fieldVisits.error],
    ["impact_evidence_dashboard_failed", evidence.error],
    ["impact_scores_dashboard_failed", scores.error],
  ].forEach(([source, error]) => throwImpactReadError(String(source), error as { message?: string } | null));

  const programmeRows = programmes.data ?? [];
  const interventionRows = (interventions.data ?? []) as unknown as Array<{ id: string; title: string | null; status: string | null; created_at: string | null; msmes?: { state?: string | null; sector?: string | null } | null }>;
  const assessmentRows = assessments.data ?? [];
  const visitRows = fieldVisits.data ?? [];
  const evidenceRows = evidence.data ?? [];
  const scoreRows = scores.data ?? [];
  const completedVisits = visitRows.filter((visit) => ["completed", "reviewed"].includes(visit.status ?? "")).length;
  const monitoringCompletionRate = visitRows.length > 0 ? Math.round((completedVisits / visitRows.length) * 100) : 0;
  const pendingEvidence = evidenceRows.filter((item) => (item.verification_status ?? "pending") === "pending").length;

  const recentActivity = [
    ...interventionRows.slice(0, 3).map((item) => ({ label: "Intervention", detail: item.title ?? "Intervention", href: `/dashboard/impact-intelligence/interventions/${item.id}`, created_at: item.created_at })),
    ...assessmentRows.slice(0, 3).map((item) => ({ label: "Assessment", detail: item.title ?? "Assessment", href: `/dashboard/impact-intelligence/assessments/${item.id}`, created_at: item.created_at })),
    ...visitRows.slice(0, 3).map((item) => ({ label: "Monitoring", detail: item.title ?? "Field visit", href: `/dashboard/impact-intelligence/monitoring/${item.id}`, created_at: item.created_at })),
  ].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))).slice(0, 6);

  const operationalAlerts: ExecutiveDashboardMetrics["operationalAlerts"] = [];
  if (pendingEvidence > 0) operationalAlerts.push({ title: "Evidence pending verification", detail: `${pendingEvidence} evidence record(s) require review.`, severity: pendingEvidence > 10 ? "high" : "medium" });
  const pendingVisits = visitRows.filter((visit) => ["pending", "assigned", "in_progress"].includes(visit.status ?? "")).length;
  if (pendingVisits > 0) operationalAlerts.push({ title: "Monitoring tasks open", detail: `${pendingVisits} monitoring task(s) are not completed.`, severity: pendingVisits > 10 ? "high" : "low" });
  const lowReadiness = scoreRows.filter((score) => score.readiness_category === "low").length;
  if (lowReadiness > 0) operationalAlerts.push({ title: "Low readiness assessments", detail: `${lowReadiness} assessment(s) scored low readiness.`, severity: "medium" });

  return {
    totalMsmes: msmeCount.count ?? 0,
    activeProgrammes: programmeRows.filter((programme) => programme.status === "active").length,
    interventionCounts: interventionRows.length,
    completedAssessments: assessmentRows.filter((assessment) => ["completed", "reviewed", "approved"].includes(assessment.status ?? "")).length,
    monitoringCompletionRate,
    verifiedEvidence: evidenceRows.filter((item) => item.verification_status === "verified").length,
    pendingEvidence,
    stateDistribution: bucketBy(interventionRows, (item) => item.msmes?.state),
    sectorDistribution: bucketBy(interventionRows, (item) => item.msmes?.sector),
    interventionStatusDistribution: bucketBy(interventionRows, (item) => item.status),
    readinessDistribution: bucketBy(scoreRows, (item) => item.readiness_category),
    monitoringStatusDistribution: bucketBy(visitRows, (item) => item.status),
    recentActivity,
    operationalAlerts,
  };
}

export async function getProgrammeAnalytics(ctx?: UserContext) {
  if (ctx) requireReportingAccess(ctx);
  const [programmes, interventions] = await Promise.all([
    listImpactProgrammes(ctx, { limit: 1000 }),
    listImpactInterventions(ctx, { limit: 1000 }),
  ]);
  return {
    programmes,
    statusDistribution: bucketBy(programmes, (programme) => programme.status),
    interventionByProgramme: programmes.map((programme) => ({
      label: programme.name,
      value: interventions.filter((intervention) => intervention.programme_id === programme.id).length,
    })),
  };
}

export async function getMonitoringAnalytics(ctx?: UserContext) {
  if (ctx) requireReportingAccess(ctx);
  const visits = await listFieldVisits(ctx, { limit: 1000 });
  const completed = visits.filter((visit) => ["completed", "reviewed"].includes(visit.status ?? "")).length;
  return {
    visits,
    completionRate: visits.length > 0 ? Math.round((completed / visits.length) * 100) : 0,
    statusDistribution: bucketBy(visits, (visit) => visit.status),
  };
}

export async function getAssessmentAnalytics(ctx?: UserContext) {
  if (ctx) requireReportingAccess(ctx);
  const [assessments, metrics] = await Promise.all([listImpactAssessments(ctx, { limit: 1000 }), getExecutiveDashboardMetrics(ctx)]);
  return {
    assessments,
    completed: assessments.filter((assessment) => ["completed", "reviewed", "approved"].includes(assessment.status ?? "")).length,
    statusDistribution: bucketBy(assessments, (assessment) => assessment.status),
    readinessDistribution: metrics.readinessDistribution,
  };
}

export async function createImpactReport(ctx: UserContext, formData: FormData) {
  const { createInstitutionalReport } = await import("@/lib/data/impact-reports");
  return createInstitutionalReport(ctx, formData);
}

export async function createReportVersion(ctx: UserContext, reportId: string) {
  const { generateInstitutionalReportVersion } = await import("@/lib/data/impact-reports");
  return generateInstitutionalReportVersion(ctx, reportId);
}

export async function getImpactReport(ctx: UserContext, reportId: string) {
  const { getInstitutionalReport } = await import("@/lib/data/impact-reports");
  return getInstitutionalReport(ctx, reportId, { includeSources: true });
}

export async function exportReportRecord(ctx: UserContext, reportId: string, formData: FormData) {
  const { generateInstitutionalReportExport } = await import("@/lib/data/impact-reports");
  const format = textValue(formData, "export_format") === "pdf" ? "pdf" : "json";
  return generateInstitutionalReportExport(ctx, reportId, format);
}

function insightSelect() {
  return "id,source_key,category,insight_type,priority,status,title,summary,programme_id,intervention_id,assessment_id,report_id,msme_id,generated_at,metadata,impact_programmes(id,name,programme_code),impact_interventions(id,title),impact_assessments(id,title,assessment_type),msmes(id,business_name,msme_id,state,sector)";
}

function riskSelect() {
  return "id,source_key,risk_type,severity,status,title,description,programme_id,intervention_id,assessment_id,report_id,msme_id,detected_at,resolution_note,metadata,impact_programmes(id,name,programme_code),impact_interventions(id,title),msmes(id,business_name,msme_id,state,sector)";
}

async function upsertInsight(row: {
  source_key: string;
  category: IntelligenceCategory;
  insight_type?: string;
  priority: IntelligencePriority;
  title: string;
  summary: string;
  programme_id?: string | null;
  intervention_id?: string | null;
  assessment_id?: string | null;
  report_id?: string | null;
  msme_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createPrivilegedImpactWriteClient();
  const { data, error } = await supabase
    .from("impact_ai_insights")
    .upsert({ ...row, insight_type: row.insight_type ?? "deterministic", status: "open", generated_at: new Date().toISOString() }, { onConflict: "source_key" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function upsertRecommendation(row: {
  insight_id?: string | null;
  source_key: string;
  recommendation_type: string;
  priority: IntelligencePriority;
  title: string;
  recommendation: string;
  programme_id?: string | null;
  intervention_id?: string | null;
  assessment_id?: string | null;
  report_id?: string | null;
  msme_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("impact_ai_recommendations").upsert({ ...row, status: "open" }, { onConflict: "source_key" });
  if (error) throw new Error(error.message);
}

async function upsertRiskFlag(row: {
  source_key: string;
  risk_type: string;
  severity: IntelligencePriority;
  title: string;
  description: string;
  programme_id?: string | null;
  intervention_id?: string | null;
  assessment_id?: string | null;
  report_id?: string | null;
  msme_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("impact_risk_flags").upsert({ ...row, status: "open", detected_at: new Date().toISOString() }, { onConflict: "source_key" });
  if (error) throw new Error(error.message);
}

async function upsertAnomaly(row: {
  source_key: string;
  anomaly_type: string;
  severity: IntelligencePriority;
  title: string;
  description: string;
  programme_id?: string | null;
  intervention_id?: string | null;
  assessment_id?: string | null;
  report_id?: string | null;
  msme_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("impact_anomaly_events").upsert({ ...row, status: "open", detected_at: new Date().toISOString() }, { onConflict: "source_key" });
  if (error) throw new Error(error.message);
}

export async function generateMsmeInsights(ctx: UserContext) {
  requireIntelligenceManage(ctx);
  const supabase = await createPrivilegedImpactReadClient();
  const [{ data: assessments }, { data: scores }, { data: evidence }] = await Promise.all([
    supabase.from("impact_assessments").select("id,title,status,msme_id,programme_id,intervention_id").limit(1000),
    supabase.from("impact_assessment_scores").select("assessment_id,section_id,weighted_score,readiness_category").is("section_id", null).eq("is_latest", true).limit(1000),
    supabase.from("impact_evidence_files").select("id,msme_id,verification_status").limit(1000),
  ]);

  let generated = 0;
  const scoreByAssessment = new Map((scores ?? []).map((score) => [score.assessment_id as string, score]));
  for (const assessment of assessments ?? []) {
    const score = scoreByAssessment.get(assessment.id as string);
    if (score?.readiness_category === "low" || Number(score?.weighted_score ?? 100) < 50) {
      const insightId = await upsertInsight({
        source_key: `msme-low-readiness:${assessment.id}`,
        category: "readiness",
        priority: "high",
        title: "Weak MSME readiness detected",
        summary: "Assessment scoring indicates low readiness and should be reviewed before further intervention decisions.",
        programme_id: assessment.programme_id,
        intervention_id: assessment.intervention_id,
        assessment_id: assessment.id,
        msme_id: assessment.msme_id,
        metadata: { weighted_score: score?.weighted_score, readiness_category: score?.readiness_category },
      });
      await upsertRecommendation({
        insight_id: insightId,
        source_key: `recommend-reassessment:${assessment.id}`,
        recommendation_type: "recommend_reassessment",
        priority: "high",
        title: "Recommend reassessment",
        recommendation: "Schedule a reassessment and validate readiness blockers before escalation.",
        programme_id: assessment.programme_id,
        intervention_id: assessment.intervention_id,
        assessment_id: assessment.id,
        msme_id: assessment.msme_id,
      });
      generated += 1;
    }
  }

  const evidenceByMsme = bucketBy((evidence ?? []) as Array<{ msme_id: string | null; verification_status: string | null }>, (item) => item.msme_id);
  for (const bucket of evidenceByMsme.filter((item) => item.label !== "Unspecified" && item.value === 0)) {
    await upsertInsight({
      source_key: `msme-missing-evidence:${bucket.label}`,
      category: "compliance",
      priority: "medium",
      title: "MSME evidence gap",
      summary: "No evidence records are currently linked to this MSME.",
      msme_id: bucket.label,
    });
    generated += 1;
  }
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_msme_insights_generated", entityType: "impact_ai_insight", entityId: ctx.appUserId ?? "system", metadata: { generated } });
  return generated;
}

export async function generateProgrammeInsights(ctx: UserContext) {
  requireIntelligenceManage(ctx);
  const [programmes, interventions, visits] = await Promise.all([
    listImpactProgrammes(ctx, { limit: 1000 }),
    listImpactInterventions(ctx, { limit: 1000 }),
    listFieldVisits(ctx, { limit: 1000 }),
  ]);
  let generated = 0;
  for (const programme of programmes) {
    const programmeInterventions = interventions.filter((item) => item.programme_id === programme.id);
    const inactive = programmeInterventions.filter((item) => ["planned", "on_hold"].includes(item.status ?? "")).length;
    const programmeVisits = visits.filter((visit) => visit.programme_id === programme.id);
    const incompleteVisits = programmeVisits.filter((visit) => !["completed", "reviewed"].includes(visit.status ?? "")).length;
    if (programme.status === "active" && programmeInterventions.length === 0) {
      const insightId = await upsertInsight({ source_key: `programme-no-interventions:${programme.id}`, category: "portfolio", priority: "medium", title: "Active programme has no interventions", summary: "Programme is active but has no linked MSME intervention records.", programme_id: programme.id });
      await upsertRecommendation({ insight_id: insightId, source_key: `recommend-programme-review:${programme.id}`, recommendation_type: "recommend_programme_review", priority: "medium", title: "Recommend programme review", recommendation: "Review programme setup and beneficiary onboarding progress.", programme_id: programme.id });
      generated += 1;
    }
    if (inactive >= 3 || incompleteVisits >= 3) {
      await upsertRiskFlag({ source_key: `programme-operational-bottleneck:${programme.id}`, risk_type: "operational_bottleneck", severity: "high", title: "Programme operational bottleneck", description: "Multiple interventions or monitoring tasks are not progressing.", programme_id: programme.id, metadata: { inactive_interventions: inactive, incomplete_visits: incompleteVisits } });
      generated += 1;
    }
    await createIntelligenceSummary(programme.id, {
      source_key: `programme-health:${programme.id}`,
      title: `${programme.name} health summary`,
      summary: `${programmeInterventions.length} intervention(s), ${programmeVisits.length} monitoring visit(s), ${incompleteVisits} open monitoring task(s).`,
      metadata: { interventions: programmeInterventions.length, visits: programmeVisits.length, incomplete_visits: incompleteVisits },
    });
  }
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_programme_insights_generated", entityType: "impact_ai_insight", entityId: ctx.appUserId ?? "system", metadata: { generated } });
  return generated;
}

async function createIntelligenceSummary(programmeId: string, input: { source_key: string; title: string; summary: string; metadata?: Record<string, unknown> }) {
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("impact_intelligence_summaries").upsert({
    source_key: input.source_key,
    summary_type: "programme_health",
    status: "current",
    title: input.title,
    summary: input.summary,
    programme_id: programmeId,
    generated_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  }, { onConflict: "source_key" });
  if (error) throw new Error(error.message);
}

export async function generateMonitoringInsights(ctx: UserContext) {
  requireIntelligenceManage(ctx);
  const [visits, evidence] = await Promise.all([listFieldVisits(ctx, { limit: 1000 }), listEvidence(ctx, { limit: 1000 })]);
  let generated = 0;
  const now = Date.now();
  for (const visit of visits) {
    const visitTime = visit.visit_date ? new Date(visit.visit_date).getTime() : null;
    const isOverdue = visitTime && visitTime < now && !["completed", "reviewed"].includes(visit.status ?? "");
    const linkedEvidence = evidence.filter((item) => item.field_visit_id === visit.id);
    if (isOverdue) {
      const insightId = await upsertInsight({ source_key: `monitoring-overdue:${visit.id}`, category: "monitoring", priority: "high", title: "Overdue monitoring visit", summary: "Scheduled monitoring date has passed without completion.", programme_id: visit.programme_id, intervention_id: visit.intervention_id, assessment_id: visit.assessment_id, msme_id: visit.msme_id, metadata: { visit_date: visit.visit_date, status: visit.status } });
      await upsertRecommendation({ insight_id: insightId, source_key: `recommend-follow-up-monitoring:${visit.id}`, recommendation_type: "recommend_follow_up_monitoring", priority: "high", title: "Recommend follow-up monitoring", recommendation: "Assign or escalate this monitoring task for immediate field follow-up.", programme_id: visit.programme_id, intervention_id: visit.intervention_id, assessment_id: visit.assessment_id, msme_id: visit.msme_id });
      generated += 1;
    }
    if (["completed", "reviewed"].includes(visit.status ?? "") && linkedEvidence.length === 0) {
      await upsertAnomaly({ source_key: `monitoring-missing-evidence:${visit.id}`, anomaly_type: "missing_evidence", severity: "medium", title: "Completed monitoring has no evidence", description: "A completed monitoring visit has no linked evidence records.", programme_id: visit.programme_id, intervention_id: visit.intervention_id, assessment_id: visit.assessment_id, msme_id: visit.msme_id, metadata: { field_visit_id: visit.id } });
      await upsertRecommendation({ source_key: `recommend-documentation-completion:${visit.id}`, recommendation_type: "recommend_documentation_completion", priority: "medium", title: "Recommend documentation completion", recommendation: "Attach monitoring photo, signed form, or field evidence before reporting.", programme_id: visit.programme_id, intervention_id: visit.intervention_id, assessment_id: visit.assessment_id, msme_id: visit.msme_id });
      generated += 1;
    }
  }
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_monitoring_insights_generated", entityType: "impact_ai_insight", entityId: ctx.appUserId ?? "system", metadata: { generated } });
  return generated;
}

export async function generateRiskFlags(ctx: UserContext) {
  requireIntelligenceManage(ctx);
  const [interventions, evidence, assessments] = await Promise.all([
    listImpactInterventions(ctx, { limit: 1000 }),
    listEvidence(ctx, { limit: 1000 }),
    listImpactAssessments(ctx, { limit: 1000 }),
  ]);
  let generated = 0;
  for (const intervention of interventions) {
    const createdAt = intervention.created_at ? new Date(intervention.created_at).getTime() : Date.now();
    const ageDays = Math.floor((Date.now() - createdAt) / 86400000);
    if (ageDays > 30 && ["planned", "on_hold"].includes(intervention.status ?? "")) {
      await upsertRiskFlag({ source_key: `intervention-inactivity:${intervention.id}`, risk_type: "intervention_inactivity", severity: "medium", title: "Intervention inactivity", description: "Intervention has remained inactive for more than 30 days.", programme_id: intervention.programme_id, intervention_id: intervention.id, msme_id: intervention.msme_id, metadata: { age_days: ageDays, status: intervention.status } });
      generated += 1;
    }
  }
  for (const item of evidence.filter((record) => record.verification_status === "rejected" || record.verification_status === "needs_review")) {
    await upsertRiskFlag({ source_key: `evidence-verification-risk:${item.id}`, risk_type: "evidence_verification", severity: item.verification_status === "rejected" ? "high" : "medium", title: "Evidence verification risk", description: "Evidence record failed or requires verification review.", programme_id: item.programme_id, intervention_id: item.intervention_id, assessment_id: item.assessment_id, msme_id: item.msme_id, metadata: { evidence_id: item.id, status: item.verification_status } });
    generated += 1;
  }
  for (const assessment of assessments.filter((item) => item.risk_level === "low")) {
    await upsertRiskFlag({ source_key: `assessment-readiness-risk:${assessment.id}`, risk_type: "weak_readiness", severity: "high", title: "Weak readiness risk", description: "Assessment readiness category is low and should be reviewed before further support.", programme_id: assessment.programme_id, intervention_id: assessment.intervention_id, assessment_id: assessment.id, msme_id: assessment.msme_id, metadata: { score: assessment.score } });
    generated += 1;
  }
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_risk_flags_generated", entityType: "impact_risk_flag", entityId: ctx.appUserId ?? "system", metadata: { generated } });
  return generated;
}

export async function listIntelligenceFeed(ctx: UserContext, options: ImpactQueryOptions = {}) {
  const supabase = await createIntelligenceReadClient(ctx);
  let query = supabase.from("impact_ai_insights").select(insightSelect()).order("generated_at", { ascending: false }).limit(options.limit ?? 100);
  let scopedMsmeIds: string[] | null = null;
  if (ctx.role === "field_officer") {
    const { data: visits } = await supabase.from("impact_field_visits").select("msme_id").eq("assigned_to_user_id", ctx.appUserId ?? "");
    scopedMsmeIds = [...new Set((visits ?? []).map((visit) => visit.msme_id).filter(Boolean) as string[])];
    if (scopedMsmeIds.length === 0) return { insights: [], recommendations: [], riskFlags: [], anomalies: [], summaries: [] };
    query = query.in("msme_id", scopedMsmeIds);
  }
  let recommendationsQuery = supabase.from("impact_ai_recommendations").select("id,insight_id,source_key,recommendation_type,priority,status,title,recommendation,programme_id,intervention_id,assessment_id,report_id,msme_id,created_at").order("created_at", { ascending: false }).limit(50);
  let riskQuery = supabase.from("impact_risk_flags").select(riskSelect()).order("detected_at", { ascending: false }).limit(50);
  let anomalyQuery = supabase.from("impact_anomaly_events").select("id,source_key,anomaly_type,severity,status,title,description,programme_id,intervention_id,assessment_id,report_id,msme_id,detected_at").order("detected_at", { ascending: false }).limit(50);
  if (scopedMsmeIds) {
    recommendationsQuery = recommendationsQuery.in("msme_id", scopedMsmeIds);
    riskQuery = riskQuery.in("msme_id", scopedMsmeIds);
    anomalyQuery = anomalyQuery.in("msme_id", scopedMsmeIds);
  }
  const [{ data: insights, error }, { data: recommendations }, { data: riskFlags }, { data: anomalies }, { data: summaries }] = await Promise.all([
    query,
    recommendationsQuery,
    riskQuery,
    anomalyQuery,
    supabase.from("impact_intelligence_summaries").select("id,source_key,summary_type,status,title,summary,programme_id,report_id,generated_at").order("generated_at", { ascending: false }).limit(20),
  ]);
  throwImpactReadError("list_intelligence_feed_failed", error);
  return {
    insights: (insights ?? []) as unknown as ImpactAiInsight[],
    recommendations: (recommendations ?? []) as ImpactAiRecommendation[],
    riskFlags: (riskFlags ?? []) as unknown as ImpactRiskFlag[],
    anomalies: (anomalies ?? []) as ImpactAnomalyEvent[],
    summaries: (summaries ?? []) as ImpactIntelligenceSummary[],
  };
}

export async function getInsightDetail(ctx: UserContext, insightId: string) {
  const supabase = await createIntelligenceReadClient(ctx);
  const [{ data: insight, error }, { data: recommendations }, { data: riskFlags }, { data: anomalies }] = await Promise.all([
    supabase.from("impact_ai_insights").select(insightSelect()).eq("id", insightId).maybeSingle(),
    supabase.from("impact_ai_recommendations").select("id,insight_id,source_key,recommendation_type,priority,status,title,recommendation,programme_id,intervention_id,assessment_id,report_id,msme_id,created_at").eq("insight_id", insightId).order("created_at", { ascending: false }),
    supabase.from("impact_risk_flags").select(riskSelect()).limit(20),
    supabase.from("impact_anomaly_events").select("id,source_key,anomaly_type,severity,status,title,description,programme_id,intervention_id,assessment_id,report_id,msme_id,detected_at").limit(20),
  ]);
  throwImpactReadError("get_insight_detail_failed", error);
  const item = insight as unknown as ImpactAiInsight | null;
  if (item && ctx.role === "field_officer") {
    const { data: visits } = await supabase.from("impact_field_visits").select("id").eq("assigned_to_user_id", ctx.appUserId ?? "").eq("msme_id", item.msme_id ?? "");
    if (!visits || visits.length === 0) throw new Error("You can only access intelligence linked to your assigned monitoring portfolio.");
  }
  return {
    insight: item,
    recommendations: (recommendations ?? []) as ImpactAiRecommendation[],
    riskFlags: (riskFlags ?? []) as unknown as ImpactRiskFlag[],
    anomalies: (anomalies ?? []) as ImpactAnomalyEvent[],
  };
}

export async function resolveRiskFlag(ctx: UserContext, riskFlagId: string, formData: FormData) {
  requireIntelligenceManage(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("impact_risk_flags").update({
    status: "resolved",
    resolved_by_user_id: ctx.appUserId,
    resolved_at: new Date().toISOString(),
    resolution_note: textValue(formData, "resolution_note"),
  }).eq("id", riskFlagId);
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_risk_flag_resolved", entityType: "impact_risk_flag", entityId: riskFlagId, metadata: { role: ctx.role } });
}

export async function dismissInsight(ctx: UserContext, insightId: string) {
  requireIntelligenceManage(ctx);
  const supabase = await createPrivilegedImpactWriteClient();
  const { error } = await supabase.from("impact_ai_insights").update({
    status: "dismissed",
    dismissed_by_user_id: ctx.appUserId,
    dismissed_at: new Date().toISOString(),
  }).eq("id", insightId);
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_ai_insight_dismissed", entityType: "impact_ai_insight", entityId: insightId, metadata: { role: ctx.role } });
}

export async function listImpactReports(ctxOrOptions?: UserContext | ImpactQueryOptions, maybeOptions: ImpactQueryOptions = {}): Promise<ImpactReport[]> {
  const { ctx, options } = resolveImpactReadArgs(ctxOrOptions, maybeOptions);
  if (!ctx) throw new Error("Institutional report access requires an authenticated user context.");
  const { listInstitutionalReports } = await import("@/lib/data/impact-reports");
  return listInstitutionalReports(ctx, options.limit ?? 25) as unknown as Promise<ImpactReport[]>;
}
