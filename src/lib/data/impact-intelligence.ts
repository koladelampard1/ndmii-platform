import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserContext } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

type ImpactQueryOptions = {
  limit?: number;
};

export const IMPACT_READ_ROLES: UserRole[] = ["admin", "boi_executive", "programme_officer", "assessment_officer", "field_officer", "auditor"];
export const IMPACT_WRITE_ROLES: UserRole[] = ["admin", "programme_officer"];
export const ASSESSMENT_MANAGE_ROLES: UserRole[] = ["admin", "programme_officer", "assessment_officer"];
export const ASSESSMENT_REVIEW_ROLES: UserRole[] = ["admin", "assessment_officer"];
export const MONITORING_MANAGE_ROLES: UserRole[] = ["admin", "programme_officer"];
export const MONITORING_REVIEW_ROLES: UserRole[] = ["admin", "assessment_officer"];

export const PROGRAMME_STATUSES = ["draft", "active", "paused", "completed", "archived"] as const;
export const INTERVENTION_STATUSES = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
export const INTERVENTION_STAGES = ["intake", "eligibility", "approval", "disbursement", "monitoring", "closure"] as const;
export const ASSESSMENT_TEMPLATE_STATUSES = ["draft", "active", "archived"] as const;
export const ASSESSMENT_STATUSES = ["draft", "scheduled", "in_progress", "submitted", "completed", "reviewed", "approved", "archived"] as const;
export const ASSESSMENT_QUESTION_TYPES = ["text", "textarea", "number", "select", "multi-select", "boolean", "date", "file_upload"] as const;
export const FIELD_VISIT_STATUSES = ["pending", "assigned", "in_progress", "completed", "reviewed"] as const;
export const EVIDENCE_CATEGORIES = ["business_photo", "facility_photo", "cac_document", "invoice", "monitoring_photo", "beneficiary_document", "signed_form", "compliance_document", "other"] as const;
export const EVIDENCE_VERIFICATION_STATUSES = ["pending", "verified", "rejected", "needs_review"] as const;
export const REPORT_TYPES = ["executive_summary", "programme_performance", "assessment_summary", "monitoring_report", "intervention_report", "impact_intelligence"] as const;
export const REPORT_STATUSES = ["draft", "generated", "approved", "archived"] as const;
export const INTELLIGENCE_CATEGORIES = ["risk", "recommendation", "anomaly", "monitoring", "intervention", "compliance", "readiness", "portfolio", "operational"] as const;
export const INTELLIGENCE_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type ProgrammeStatus = (typeof PROGRAMME_STATUSES)[number];
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];
export type InterventionStage = (typeof INTERVENTION_STAGES)[number];
export type AssessmentTemplateStatus = (typeof ASSESSMENT_TEMPLATE_STATUSES)[number];
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
};

export type ImpactIntervention = {
  id: string;
  programme_id: string | null;
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
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

export type ImpactInterventionEvent = {
  id: string;
  intervention_id: string;
  programme_id: string | null;
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
  intervention_id: string | null;
  msme_id: string | null;
  assessment_type: string | null;
  title?: string | null;
  status: string | null;
  score?: number | null;
  risk_level?: string | null;
  conducted_by_user_id: string | null;
  conducted_at: string | null;
  created_at: string | null;
  impact_assessment_templates?: Pick<ImpactAssessmentTemplate, "id" | "name" | "version" | "assessment_type"> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  impact_interventions?: Pick<ImpactIntervention, "id" | "title"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

export type ImpactAssessmentTemplate = {
  id: string;
  name: string;
  description: string | null;
  assessment_type: string;
  version: number;
  status: AssessmentTemplateStatus | string;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
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
  section_id: string | null;
  section_title: string | null;
  score: number;
  max_score: number;
  weighted_score: number;
  readiness_category: "low" | "moderate" | "strong" | null;
  calculated_at: string;
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

export type ImpactEvidenceFile = {
  id: string;
  programme_id: string | null;
  intervention_id: string | null;
  assessment_id: string | null;
  field_visit_id: string | null;
  msme_id: string | null;
  file_name: string;
  file_url: string | null;
  file_type: string | null;
  evidence_type: string;
  evidence_category: EvidenceCategory | string | null;
  verification_status: EvidenceVerificationStatus | string;
  description: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  captured_at: string | null;
  uploaded_by_user_id: string | null;
  verified_by_user_id: string | null;
  verified_at: string | null;
  created_at: string | null;
  metadata?: Record<string, unknown> | null;
  impact_programmes?: Pick<ImpactProgramme, "id" | "name" | "programme_code"> | null;
  impact_interventions?: Pick<ImpactIntervention, "id" | "title"> | null;
  impact_assessments?: Pick<ImpactAssessment, "id" | "title" | "assessment_type"> | null;
  impact_field_visits?: Pick<ImpactFieldVisit, "id" | "title" | "status"> | null;
  msmes?: { id: string; business_name: string | null; msme_id: string | null; state: string | null; sector: string | null } | null;
};

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
  if (process.env.NODE_ENV === "production" || !error) return;
  console.info(`[impact-intelligence] ${source}`, { error: error.message });
}

function requireImpactWrite(ctx: UserContext) {
  if (!IMPACT_WRITE_ROLES.includes(ctx.role)) {
    throw new Error("You do not have permission to manage impact intelligence records.");
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

function requireEvidenceCreate(ctx: UserContext) {
  if (![...MONITORING_MANAGE_ROLES, "assessment_officer", "field_officer"].includes(ctx.role)) {
    throw new Error("You do not have permission to create evidence records.");
  }
}

function requireReportingAccess(ctx: UserContext) {
  if (!["admin", "boi_executive", "programme_officer", "assessment_officer", "auditor"].includes(ctx.role)) {
    throw new Error("You do not have permission to access impact analytics and reports.");
  }
}

function requireReportWrite(ctx: UserContext) {
  if (!["admin", "boi_executive", "programme_officer", "assessment_officer"].includes(ctx.role)) {
    throw new Error("You do not have permission to create impact reports.");
  }
}

function requireIntelligenceAccess(ctx: UserContext) {
  if (!["admin", "boi_executive", "programme_officer", "assessment_officer", "auditor", "field_officer"].includes(ctx.role)) {
    throw new Error("You do not have permission to access impact intelligence.");
  }
}

function requireIntelligenceManage(ctx: UserContext) {
  if (!["admin", "boi_executive", "programme_officer", "assessment_officer"].includes(ctx.role)) {
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

function normaliseStage(value: string | null): InterventionStage {
  return INTERVENTION_STAGES.includes(value as InterventionStage) ? (value as InterventionStage) : "intake";
}

function normaliseStatus(value: string | null): InterventionStatus {
  return INTERVENTION_STATUSES.includes(value as InterventionStatus) ? (value as InterventionStatus) : "planned";
}

async function logActivity(params: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();
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

export function parseInterventionForm(formData: FormData) {
  const title = textValue(formData, "title");
  if (!title) throw new Error("Intervention title is required.");

  const msmeId = textValue(formData, "msme_id");
  if (!msmeId) throw new Error("Select an MSME beneficiary.");

  const stage = normaliseStage(textValue(formData, "stage"));

  return {
    programme_id: textValue(formData, "programme_id"),
    msme_id: msmeId,
    intervention_type: textValue(formData, "intervention_type") ?? "support",
    title,
    description: textValue(formData, "description"),
    status: normaliseStatus(textValue(formData, "status")),
    approved_amount: numericValue(formData, "approved_amount"),
    disbursed_amount: numericValue(formData, "disbursed_amount"),
    start_date: textValue(formData, "start_date"),
    end_date: textValue(formData, "end_date"),
    metadata: { stage },
  };
}

export async function listImpactProgrammes(options: ImpactQueryOptions = {}): Promise<ImpactProgramme[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_programmes")
    .select("id,name,programme_code,sponsor_name,description,status,start_date,end_date,created_by_user_id,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  logImpactDataError("list_programmes_failed", error);
  return (data ?? []) as ImpactProgramme[];
}

export async function getImpactProgrammeDetail(id: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: programme, error }, { data: interventions }, { data: enrolments }] = await Promise.all([
    supabase
      .from("impact_programmes")
      .select("id,name,programme_code,sponsor_name,description,status,start_date,end_date,created_by_user_id,created_at,updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("impact_interventions")
      .select("id,programme_id,msme_id,intervention_type,title,description,status,approved_amount,disbursed_amount,start_date,end_date,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata,msmes(id,business_name,msme_id,state,sector)")
      .eq("programme_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("impact_programme_msmes")
      .select("id,programme_id,msme_id,enrollment_status,enrolled_at,msmes(id,business_name,msme_id,state,sector)")
      .eq("programme_id", id)
      .order("enrolled_at", { ascending: false }),
  ]);

  logImpactDataError("get_programme_failed", error);
  return {
    programme: programme as ImpactProgramme | null,
    interventions: (interventions ?? []) as unknown as ImpactIntervention[],
    enrolments: enrolments ?? [],
  };
}

export async function createImpactProgramme(ctx: UserContext, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createServerSupabaseClient();
  const payload = { ...parseProgrammeForm(formData), created_by_user_id: ctx.appUserId };
  const { data, error } = await supabase.from("impact_programmes").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_programme_created", entityType: "impact_programme", entityId: data.id, metadata: { role: ctx.role } });
  return data.id as string;
}

export async function listImpactInterventions(options: ImpactQueryOptions = {}): Promise<ImpactIntervention[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_interventions")
    .select("id,programme_id,msme_id,intervention_type,title,description,status,approved_amount,disbursed_amount,start_date,end_date,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code),msmes(id,business_name,msme_id,state,sector)")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  logImpactDataError("list_interventions_failed", error);
  return (data ?? []) as unknown as ImpactIntervention[];
}

export async function getImpactInterventionDetail(id: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: intervention, error }, { data: events }] = await Promise.all([
    supabase
      .from("impact_interventions")
      .select("id,programme_id,msme_id,intervention_type,title,description,status,approved_amount,disbursed_amount,start_date,end_date,assigned_to_user_id,created_by_user_id,created_at,updated_at,metadata,impact_programmes(id,name,programme_code),msmes(id,business_name,msme_id,state,sector)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("impact_intervention_events")
      .select("id,intervention_id,programme_id,msme_id,event_type,from_status,to_status,from_stage,to_stage,title,note,actor_user_id,actor_role,created_at")
      .eq("intervention_id", id)
      .order("created_at", { ascending: false }),
  ]);

  logImpactDataError("get_intervention_failed", error);
  return {
    intervention: intervention as unknown as ImpactIntervention | null,
    events: (events ?? []) as ImpactInterventionEvent[],
  };
}

export async function createImpactIntervention(ctx: UserContext, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createServerSupabaseClient();
  const payload = { ...parseInterventionForm(formData), created_by_user_id: ctx.appUserId };
  const { data, error } = await supabase.from("impact_interventions").insert(payload).select("id,programme_id,msme_id,status,metadata").single();
  if (error) throw new Error(error.message);

  if (payload.programme_id) {
    await supabase.from("impact_programme_msmes").upsert({
      programme_id: payload.programme_id,
      msme_id: payload.msme_id,
      enrollment_status: "active",
      created_by_user_id: ctx.appUserId,
    }, { onConflict: "programme_id,msme_id" });
  }

  await appendImpactInterventionEvent(ctx, data.id, {
    programmeId: data.programme_id,
    msmeId: data.msme_id,
    eventType: "created",
    title: "Intervention created",
    note: `Initial status: ${data.status}`,
    toStatus: data.status,
    toStage: String((data.metadata as Record<string, unknown> | null)?.stage ?? "intake"),
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_intervention_created", entityType: "impact_intervention", entityId: data.id, metadata: { role: ctx.role } });
  return data.id as string;
}

export async function updateImpactInterventionStatus(ctx: UserContext, interventionId: string, formData: FormData) {
  requireImpactWrite(ctx);
  const supabase = await createServerSupabaseClient();
  const { intervention } = await getImpactInterventionDetail(interventionId);
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
    msmeId: intervention.msme_id,
    eventType: nextStatus !== intervention.status ? "status_changed" : "stage_changed",
    title: "Intervention progress updated",
    note,
    fromStatus: intervention.status,
    toStatus: nextStatus,
    fromStage: currentStage,
    toStage: nextStage,
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_intervention_status_updated", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role, status: nextStatus, stage: nextStage } });
}

export async function appendImpactInterventionEvent(ctx: UserContext, interventionId: string, params: {
  programmeId?: string | null;
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
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("impact_intervention_events").insert({
    intervention_id: interventionId,
    programme_id: params.programmeId ?? null,
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
  const { intervention } = await getImpactInterventionDetail(interventionId);
  if (!intervention) throw new Error("Intervention not found.");
  const note = textValue(formData, "note");
  if (!note) throw new Error("Timeline note is required.");
  await appendImpactInterventionEvent(ctx, interventionId, {
    programmeId: intervention.programme_id,
    msmeId: intervention.msme_id,
    eventType: "note",
    title: textValue(formData, "title") ?? "Operational note",
    note,
  });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_intervention_event_added", entityType: "impact_intervention", entityId: interventionId, metadata: { role: ctx.role } });
}

export async function listMsmePickerOptions(options: ImpactQueryOptions = {}): Promise<MsmePickerOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("msmes")
    .select("id,business_name,msme_id,state,sector")
    .order("business_name", { ascending: true })
    .limit(options.limit ?? 100);

  logImpactDataError("list_msme_picker_failed", error);
  return (data ?? []) as MsmePickerOption[];
}

export async function listUserPickerOptions(role?: UserRole): Promise<UserPickerOption[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("users").select("id,full_name,email,role").order("full_name", { ascending: true }).limit(100);
  if (role) query = query.eq("role", role);
  const { data, error } = await query;
  logImpactDataError("list_user_picker_failed", error);
  return (data ?? []) as UserPickerOption[];
}

export function getInterventionStage(intervention: Pick<ImpactIntervention, "metadata">) {
  const value = intervention.metadata?.stage;
  return typeof value === "string" && value ? value : "intake";
}

function normaliseQuestionType(value: string | null): AssessmentQuestionType {
  return ASSESSMENT_QUESTION_TYPES.includes(value as AssessmentQuestionType) ? (value as AssessmentQuestionType) : "text";
}

function normaliseTemplateStatus(value: string | null): AssessmentTemplateStatus {
  return ASSESSMENT_TEMPLATE_STATUSES.includes(value as AssessmentTemplateStatus) ? (value as AssessmentTemplateStatus) : "draft";
}

function readinessCategory(score: number, maxScore: number): "low" | "moderate" | "strong" {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (percent >= 75) return "strong";
  if (percent >= 50) return "moderate";
  return "low";
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
      const [section, question, type, category, weight, required, options, helpText] = line.split("|").map((item) => item?.trim() ?? "");
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
        displayOrder: index + 1,
      };
    });

  if (rows.length === 0) throw new Error("Add at least one assessment question.");
  return rows;
}

export async function createAssessmentTemplate(ctx: UserContext, formData: FormData) {
  requireAssessmentManage(ctx);
  const name = textValue(formData, "name");
  if (!name) throw new Error("Template name is required.");

  const rows = parseTemplateQuestionRows(textValue(formData, "question_blueprint"));
  const supabase = await createServerSupabaseClient();
  const versionValue = numericValue(formData, "version");
  const payload = {
    name,
    description: textValue(formData, "description"),
    assessment_type: textValue(formData, "assessment_type") ?? "readiness",
    version: versionValue && versionValue > 0 ? Math.trunc(versionValue) : 1,
    status: normaliseTemplateStatus(textValue(formData, "status")),
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
    scoring_config: {},
    conditional_logic: {},
  }));
  const { error: questionError } = await supabase.from("impact_assessment_questions").insert(questions);
  if (questionError) throw new Error(questionError.message);

  await logActivity({ actorUserId: ctx.appUserId, action: "impact_assessment_template_created", entityType: "impact_assessment_template", entityId: template.id, metadata: { role: ctx.role, questions: questions.length } });
  return template.id as string;
}

export async function listAssessmentTemplates(options: ImpactQueryOptions = {}): Promise<ImpactAssessmentTemplate[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_assessment_templates")
    .select("id,name,description,assessment_type,version,status,created_by_user_id,created_at,updated_at,metadata")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  logImpactDataError("list_assessment_templates_failed", error);
  return (data ?? []) as ImpactAssessmentTemplate[];
}

export async function getAssessmentTemplate(templateId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: template, error }, { data: sections }, { data: questions }] = await Promise.all([
    supabase
      .from("impact_assessment_templates")
      .select("id,name,description,assessment_type,version,status,created_by_user_id,created_at,updated_at,metadata")
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

  logImpactDataError("get_assessment_template_failed", error);
  return {
    template: template as ImpactAssessmentTemplate | null,
    sections: (sections ?? []) as ImpactAssessmentSection[],
    questions: (questions ?? []) as ImpactAssessmentQuestion[],
  };
}

export async function createAssessment(ctx: UserContext, formData: FormData) {
  requireAssessmentManage(ctx);
  const templateId = textValue(formData, "template_id");
  const msmeId = textValue(formData, "msme_id");
  if (!templateId) throw new Error("Select an assessment template.");
  if (!msmeId) throw new Error("Select an MSME for the assessment.");

  const { template } = await getAssessmentTemplate(templateId);
  if (!template) throw new Error("Assessment template not found.");

  const supabase = await createServerSupabaseClient();
  const payload = {
    template_id: template.id,
    template_version: template.version,
    programme_id: textValue(formData, "programme_id"),
    intervention_id: textValue(formData, "intervention_id"),
    msme_id: msmeId,
    assessment_type: template.assessment_type,
    title: textValue(formData, "title") ?? template.name,
    status: "draft",
    created_by_user_id: ctx.appUserId,
    assigned_to_user_id: textValue(formData, "assigned_to_user_id"),
    metadata: { template_name: template.name },
  };
  const { data, error } = await supabase.from("impact_assessments").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await logActivity({ actorUserId: ctx.appUserId, action: "impact_assessment_created", entityType: "impact_assessment", entityId: data.id, metadata: { role: ctx.role, template_id: template.id } });
  return data.id as string;
}

export async function listImpactAssessments(options: ImpactQueryOptions = {}): Promise<ImpactAssessment[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_assessments")
    .select("id,template_id,template_version,programme_id,intervention_id,msme_id,assessment_type,title,status,score,risk_level,conducted_by_user_id,conducted_at,created_at,impact_assessment_templates(id,name,version,assessment_type),impact_programmes(id,name,programme_code),impact_interventions(id,title),msmes(id,business_name,msme_id,state,sector)")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);

  logImpactDataError("list_assessments_failed", error);
  return (data ?? []) as unknown as ImpactAssessment[];
}

export async function getImpactAssessmentDetail(assessmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: assessment, error } = await supabase
    .from("impact_assessments")
    .select("id,template_id,template_version,programme_id,intervention_id,msme_id,assessment_type,title,status,score,risk_level,conducted_by_user_id,conducted_at,created_at,impact_assessment_templates(id,name,version,assessment_type),impact_programmes(id,name,programme_code),impact_interventions(id,title),msmes(id,business_name,msme_id,state,sector)")
    .eq("id", assessmentId)
    .maybeSingle();

  logImpactDataError("get_assessment_failed", error);
  if (!assessment) return { assessment: null, template: null, sections: [], questions: [], responses: [], scores: [], reviews: [] };

  const templateId = (assessment as unknown as ImpactAssessment).template_id;
  const [{ template, sections, questions }, { data: responses }, { data: scores }, { data: reviews }] = await Promise.all([
    templateId ? getAssessmentTemplate(templateId) : Promise.resolve({ template: null, sections: [], questions: [] }),
    supabase
      .from("impact_assessment_responses")
      .select("id,assessment_id,question_id,msme_id,response_text,response_number,response_boolean,response_json,score,max_score,responded_by_user_id,created_at,updated_at")
      .eq("assessment_id", assessmentId),
    supabase
      .from("impact_assessment_scores")
      .select("id,assessment_id,section_id,section_title,score,max_score,weighted_score,readiness_category,calculated_at")
      .eq("assessment_id", assessmentId)
      .order("section_title", { ascending: true }),
    supabase
      .from("impact_assessment_reviews")
      .select("id,assessment_id,reviewer_user_id,review_status,notes,created_at")
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
    reviews: (reviews ?? []) as ImpactAssessmentReview[],
  };
}

function responsePayload(question: ImpactAssessmentQuestion, rawValue: FormDataEntryValue | null, msmeId: string | null, ctx: UserContext) {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  const maxScore = Number(question.weight ?? 0);
  const answered = raw.length > 0;
  let score = answered ? maxScore : 0;
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
    payload.response_number = Number.isFinite(numeric) ? numeric : null;
    score = Number.isFinite(numeric) && numeric > 0 ? maxScore : 0;
    payload.score = score;
  } else if (question.question_type === "boolean") {
    const value = raw === "true" || raw === "yes" || raw === "on";
    payload.response_boolean = value;
    payload.response_text = value ? "Yes" : "No";
    payload.score = value ? maxScore : 0;
  } else if (question.question_type === "multi-select") {
    const values = raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
    payload.response_json = { values };
    payload.response_text = values.join(", ");
  } else {
    payload.response_text = raw || null;
  }

  return payload;
}

export async function saveAssessmentResponse(ctx: UserContext, assessmentId: string, formData: FormData) {
  requireAssessmentManage(ctx);
  const detail = await getImpactAssessmentDetail(assessmentId);
  if (!detail.assessment) throw new Error("Assessment not found.");
  if (detail.assessment.status === "reviewed" || detail.assessment.status === "approved") {
    throw new Error("Reviewed assessments cannot be edited.");
  }

  const supabase = await createServerSupabaseClient();
  for (const question of detail.questions) {
    const rawValue = formData.get(`response_${question.id}`);
    if (question.is_required && (!rawValue || String(rawValue).trim().length === 0)) {
      throw new Error(`Required question missing: ${question.question_text}`);
    }

    const payload = responsePayload(question, rawValue, detail.assessment.msme_id, ctx);
    const existing = detail.responses.find((response) => response.question_id === question.id);
    if (existing) {
      const { error } = await supabase.from("impact_assessment_responses").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("impact_assessment_responses").insert({ ...payload, assessment_id: assessmentId, question_id: question.id });
      if (error) throw new Error(error.message);
    }
  }

  await supabase.from("impact_assessments").update({ status: "in_progress" }).eq("id", assessmentId).eq("status", "draft");
  await calculateAssessmentScore(assessmentId);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_assessment_responses_saved", entityType: "impact_assessment", entityId: assessmentId, metadata: { role: ctx.role } });
}

export async function calculateAssessmentScore(assessmentId: string) {
  const detail = await getImpactAssessmentDetail(assessmentId);
  if (!detail.assessment) throw new Error("Assessment not found.");
  const supabase = await createServerSupabaseClient();
  const responseByQuestion = new Map(detail.responses.map((response) => [response.question_id, response]));
  const sectionScores = detail.sections.map((section) => {
    const questions = detail.questions.filter((question) => question.section_id === section.id);
    const maxScore = questions.reduce((sum, question) => sum + Number(question.weight ?? 0), 0);
    const score = questions.reduce((sum, question) => sum + Number(responseByQuestion.get(question.id)?.score ?? 0), 0);
    return {
      assessment_id: assessmentId,
      section_id: section.id,
      section_title: section.title,
      score,
      max_score: maxScore,
      weighted_score: maxScore > 0 ? (score / maxScore) * Number(section.weight || maxScore) : 0,
      readiness_category: readinessCategory(score, maxScore),
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
    readiness_category: readinessCategory(totalScore, totalMax),
    metadata: { score_type: "overall" },
  };

  await supabase.from("impact_assessment_scores").delete().eq("assessment_id", assessmentId);
  const { error } = await supabase.from("impact_assessment_scores").insert([...sectionScores, total]);
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
  const detail = await getImpactAssessmentDetail(assessmentId);
  if (!detail.assessment) throw new Error("Assessment not found.");
  const answered = new Set(detail.responses.filter((response) => response.response_text || response.response_number !== null || response.response_boolean !== null).map((response) => response.question_id));
  const missing = detail.questions.find((question) => question.is_required && !answered.has(question.id));
  if (missing) throw new Error(`Required question missing: ${missing.question_text}`);

  const total = await calculateAssessmentScore(assessmentId);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("impact_assessments")
    .update({ status: "completed", completed_at: new Date().toISOString(), conducted_by_user_id: ctx.appUserId, conducted_at: new Date().toISOString(), score: total.weighted_score, risk_level: total.readiness_category })
    .eq("id", assessmentId);
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_assessment_completed", entityType: "impact_assessment", entityId: assessmentId, metadata: { role: ctx.role, score: total.weighted_score } });
}

export async function reviewAssessment(ctx: UserContext, assessmentId: string, formData: FormData) {
  requireAssessmentReview(ctx);
  const status = textValue(formData, "review_status") ?? "reviewed";
  const reviewStatus = ["reviewed", "approved", "returned"].includes(status) ? status : "reviewed";
  await calculateAssessmentScore(assessmentId);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("impact_assessment_reviews").insert({
    assessment_id: assessmentId,
    reviewer_user_id: ctx.appUserId,
    review_status: reviewStatus,
    notes: textValue(formData, "notes"),
    metadata: { role: ctx.role },
  });
  if (error) throw new Error(error.message);
  const assessmentStatus = reviewStatus === "returned" ? "in_progress" : reviewStatus === "approved" ? "approved" : "reviewed";
  const { error: updateError } = await supabase
    .from("impact_assessments")
    .update({ status: assessmentStatus, reviewed_by_user_id: ctx.appUserId, reviewed_at: new Date().toISOString() })
    .eq("id", assessmentId);
  if (updateError) throw new Error(updateError.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_assessment_reviewed", entityType: "impact_assessment", entityId: assessmentId, metadata: { role: ctx.role, review_status: reviewStatus } });
}

function normaliseFieldVisitStatus(value: string | null): FieldVisitStatus {
  return FIELD_VISIT_STATUSES.includes(value as FieldVisitStatus) ? (value as FieldVisitStatus) : "pending";
}

function normaliseEvidenceCategory(value: string | null): EvidenceCategory {
  return EVIDENCE_CATEGORIES.includes(value as EvidenceCategory) ? (value as EvidenceCategory) : "other";
}

function normaliseEvidenceStatus(value: string | null): EvidenceVerificationStatus {
  return EVIDENCE_VERIFICATION_STATUSES.includes(value as EvidenceVerificationStatus) ? (value as EvidenceVerificationStatus) : "pending";
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
  return "id,programme_id,intervention_id,assessment_id,msme_id,title,visit_date,scheduled_at,location_text,status,assigned_to_user_id,completed_by_user_id,completed_at,reviewed_by_user_id,reviewed_at,findings,recommendations,follow_up_visit_id,priority,created_at,impact_programmes(id,name,programme_code),impact_interventions(id,title),impact_assessments(id,title,assessment_type),msmes(id,business_name,msme_id,state,sector)";
}

function evidenceSelect() {
  return "id,programme_id,intervention_id,assessment_id,field_visit_id,msme_id,file_name,file_url,file_type,evidence_type,evidence_category,verification_status,description,storage_bucket,storage_path,captured_at,uploaded_by_user_id,verified_by_user_id,verified_at,created_at,metadata,impact_programmes(id,name,programme_code),impact_interventions(id,title),impact_assessments(id,title,assessment_type),impact_field_visits(id,title,status),msmes(id,business_name,msme_id,state,sector)";
}

export async function createFieldVisit(ctx: UserContext, formData: FormData) {
  requireMonitoringManage(ctx);
  const msmeId = textValue(formData, "msme_id");
  if (!msmeId) throw new Error("Select an MSME for the field visit.");
  const title = textValue(formData, "title");
  if (!title) throw new Error("Field visit title is required.");

  const supabase = await createServerSupabaseClient();
  const scheduledAt = textValue(formData, "scheduled_at");
  const payload = {
    title,
    programme_id: textValue(formData, "programme_id"),
    intervention_id: textValue(formData, "intervention_id"),
    assessment_id: textValue(formData, "assessment_id"),
    msme_id: msmeId,
    visit_date: textValue(formData, "visit_date") ?? scheduledAt?.slice(0, 10),
    scheduled_at: scheduledAt,
    location_text: textValue(formData, "location_text"),
    status: normaliseFieldVisitStatus(textValue(formData, "status")),
    assigned_to_user_id: textValue(formData, "assigned_to_user_id"),
    priority: textValue(formData, "priority") ?? "normal",
    created_by_user_id: ctx.appUserId,
    metadata: { source: "field_monitoring_engine" },
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

  await logActivity({ actorUserId: ctx.appUserId, action: "impact_field_visit_created", entityType: "impact_field_visit", entityId: data.id, metadata: { role: ctx.role } });
  return data.id as string;
}

export async function assignFieldVisit(ctx: UserContext, visitId: string, assignedToUserId: string) {
  requireMonitoringManage(ctx);
  const supabase = await createServerSupabaseClient();
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
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_field_visit_assigned", entityType: "impact_field_visit", entityId: visitId, metadata: { role: ctx.role, assigned_to_user_id: assignedToUserId } });
}

export async function listFieldVisits(ctx?: UserContext, options: ImpactQueryOptions = {}): Promise<ImpactFieldVisit[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("impact_field_visits")
    .select(fieldVisitSelect())
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);

  if (ctx?.role === "field_officer") {
    query = query.eq("assigned_to_user_id", ctx.appUserId ?? "00000000-0000-0000-0000-000000000000");
  }

  const { data, error } = await query;

  logImpactDataError("list_field_visits_failed", error);
  return (data ?? []) as unknown as ImpactFieldVisit[];
}

export async function listImpactFieldVisits(options: ImpactQueryOptions = {}): Promise<ImpactFieldVisit[]> {
  return listFieldVisits(undefined, options);
}

export async function getFieldVisit(ctx: UserContext, visitId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: visit, error }, { data: assignments }, { data: checklist }, { data: notes }, { data: evidence }] = await Promise.all([
    supabase.from("impact_field_visits").select(fieldVisitSelect()).eq("id", visitId).maybeSingle(),
    supabase.from("impact_field_visit_assignments").select("id,field_visit_id,assigned_to_user_id,assigned_by_user_id,assignment_status,assigned_at,completed_at").eq("field_visit_id", visitId).order("assigned_at", { ascending: false }),
    supabase.from("impact_monitoring_checklists").select("id,field_visit_id,checklist_item,item_category,is_required,is_completed,display_order").eq("field_visit_id", visitId).order("display_order", { ascending: true }),
    supabase.from("impact_monitoring_notes").select("id,field_visit_id,note_type,title,note,created_by_user_id,created_at").eq("field_visit_id", visitId).order("created_at", { ascending: false }),
    supabase.from("impact_evidence_files").select(evidenceSelect()).eq("field_visit_id", visitId).order("created_at", { ascending: false }),
  ]);

  logImpactDataError("get_field_visit_failed", error);
  const fieldVisit = visit as unknown as ImpactFieldVisit | null;
  if (fieldVisit && ctx.role === "field_officer" && fieldVisit.assigned_to_user_id !== ctx.appUserId) {
    throw new Error("You can only access field visits assigned to you.");
  }

  return {
    visit: fieldVisit,
    assignments: (assignments ?? []) as ImpactFieldVisitAssignment[],
    checklist: (checklist ?? []) as ImpactMonitoringChecklist[],
    notes: (notes ?? []) as ImpactMonitoringNote[],
    evidence: (evidence ?? []) as unknown as ImpactEvidenceFile[],
  };
}

export async function completeFieldVisit(ctx: UserContext, visitId: string, formData: FormData) {
  const detail = await getFieldVisit(ctx, visitId);
  if (!detail.visit) throw new Error("Field visit not found.");
  const supabase = await createServerSupabaseClient();
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
  requireEvidenceCreate(ctx);
  const fileName = textValue(formData, "file_name");
  if (!fileName) throw new Error("Evidence file name is required.");

  const category = normaliseEvidenceCategory(textValue(formData, "evidence_category"));
  const evidenceType = category.includes("photo") ? "photo" : "document";
  const supabase = await createServerSupabaseClient();
  const payload = {
    programme_id: textValue(formData, "programme_id"),
    intervention_id: textValue(formData, "intervention_id"),
    assessment_id: textValue(formData, "assessment_id"),
    field_visit_id: textValue(formData, "field_visit_id"),
    msme_id: textValue(formData, "msme_id"),
    file_name: fileName,
    file_url: textValue(formData, "file_url"),
    file_type: textValue(formData, "file_type") ?? "placeholder",
    evidence_type: textValue(formData, "evidence_type") ?? evidenceType,
    evidence_category: category,
    verification_status: "pending",
    description: textValue(formData, "description"),
    storage_bucket: textValue(formData, "storage_bucket"),
    storage_path: textValue(formData, "storage_path"),
    captured_at: textValue(formData, "captured_at"),
    uploaded_by_user_id: ctx.appUserId,
    metadata: { storage_ready: true },
  };

  const { data, error } = await supabase.from("impact_evidence_files").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  await linkEvidenceToEntity(ctx, data.id, formData);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_evidence_created", entityType: "impact_evidence_file", entityId: data.id, metadata: { role: ctx.role, category } });
  return data.id as string;
}

export async function linkEvidenceToEntity(ctx: UserContext, evidenceId: string, formData: FormData) {
  requireEvidenceCreate(ctx);
  const supabase = await createServerSupabaseClient();
  const payload = {
    evidence_id: evidenceId,
    programme_id: textValue(formData, "programme_id"),
    intervention_id: textValue(formData, "intervention_id"),
    assessment_id: textValue(formData, "assessment_id"),
    field_visit_id: textValue(formData, "field_visit_id"),
    msme_id: textValue(formData, "msme_id"),
    link_type: textValue(formData, "link_type") ?? "supporting_evidence",
    created_by_user_id: ctx.appUserId,
  };
  if (!payload.programme_id && !payload.intervention_id && !payload.assessment_id && !payload.field_visit_id && !payload.msme_id) return;
  const { error } = await supabase.from("impact_evidence_links").insert(payload);
  if (error) throw new Error(error.message);
}

export async function listEvidence(ctx?: UserContext, options: ImpactQueryOptions = {}): Promise<ImpactEvidenceFile[]> {
  const supabase = await createServerSupabaseClient();
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
  logImpactDataError("list_evidence_failed", error);
  return (data ?? []) as unknown as ImpactEvidenceFile[];
}

export async function getEvidence(ctx: UserContext, evidenceId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: evidence, error }, { data: links }] = await Promise.all([
    supabase.from("impact_evidence_files").select(evidenceSelect()).eq("id", evidenceId).maybeSingle(),
    supabase.from("impact_evidence_links").select("id,evidence_id,programme_id,intervention_id,assessment_id,field_visit_id,msme_id,link_type,created_at").eq("evidence_id", evidenceId).order("created_at", { ascending: false }),
  ]);
  logImpactDataError("get_evidence_failed", error);
  const item = evidence as unknown as ImpactEvidenceFile | null;
  if (item && ctx.role === "field_officer") {
    const visible = item.field_visit_id
      ? await supabase.from("impact_field_visits").select("id").eq("id", item.field_visit_id).eq("assigned_to_user_id", ctx.appUserId ?? "").maybeSingle()
      : { data: null };
    if (!visible.data) throw new Error("You can only access evidence linked to your assigned visits.");
  }
  return { evidence: item, links: (links ?? []) as ImpactEvidenceLink[] };
}

export async function verifyEvidence(ctx: UserContext, evidenceId: string, formData: FormData) {
  requireMonitoringReview(ctx);
  const verificationStatus = normaliseEvidenceStatus(textValue(formData, "verification_status"));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("impact_evidence_files")
    .update({
      verification_status: verificationStatus,
      verified_by_user_id: ctx.appUserId,
      verified_at: new Date().toISOString(),
      metadata: { review_note: textValue(formData, "review_note") },
    })
    .eq("id", evidenceId);
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_evidence_verified", entityType: "impact_evidence_file", entityId: evidenceId, metadata: { role: ctx.role, verification_status: verificationStatus } });
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
  if (ctx) requireReportingAccess(ctx);
  const supabase = await createServerSupabaseClient();
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
    supabase.from("impact_assessment_scores").select("id,section_id,readiness_category").is("section_id", null).limit(1000),
  ]);

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
    listImpactProgrammes({ limit: 1000 }),
    listImpactInterventions({ limit: 1000 }),
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
  const visits = await listFieldVisits(undefined, { limit: 1000 });
  const completed = visits.filter((visit) => ["completed", "reviewed"].includes(visit.status ?? "")).length;
  return {
    visits,
    completionRate: visits.length > 0 ? Math.round((completed / visits.length) * 100) : 0,
    statusDistribution: bucketBy(visits, (visit) => visit.status),
  };
}

export async function getAssessmentAnalytics(ctx?: UserContext) {
  if (ctx) requireReportingAccess(ctx);
  const [assessments, metrics] = await Promise.all([listImpactAssessments({ limit: 1000 }), getExecutiveDashboardMetrics(ctx)]);
  return {
    assessments,
    completed: assessments.filter((assessment) => ["completed", "reviewed", "approved"].includes(assessment.status ?? "")).length,
    statusDistribution: bucketBy(assessments, (assessment) => assessment.status),
    readinessDistribution: metrics.readinessDistribution,
  };
}

export async function createImpactReport(ctx: UserContext, formData: FormData) {
  requireReportWrite(ctx);
  const title = textValue(formData, "title");
  if (!title) throw new Error("Report title is required.");
  const supabase = await createServerSupabaseClient();
  const metrics = await getExecutiveDashboardMetrics(ctx);
  const reportType = normaliseReportType(textValue(formData, "report_type"));
  const payload = {
    title,
    report_type: reportType,
    status: "generated",
    summary: textValue(formData, "summary") ?? `${title} generated from DBIN operational impact intelligence records.`,
    programme_id: textValue(formData, "programme_id"),
    intervention_id: textValue(formData, "intervention_id"),
    assessment_id: textValue(formData, "assessment_id"),
    field_visit_id: textValue(formData, "field_visit_id"),
    msme_id: textValue(formData, "msme_id"),
    generated_by_user_id: ctx.appUserId,
    generated_at: new Date().toISOString(),
    report_json: metrics as unknown as Record<string, unknown>,
    evidence_references: [],
    metadata: { deterministic: true, source: "impact_reporting_engine" },
  };
  const { data, error } = await supabase.from("impact_reports").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  await createReportVersion(ctx, data.id, { title: payload.title, summary: payload.summary, reportJson: payload.report_json, evidenceReferences: [] });
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_report_created", entityType: "impact_report", entityId: data.id, metadata: { role: ctx.role, report_type: reportType } });
  return data.id as string;
}

export async function createReportVersion(ctx: UserContext, reportId: string, input?: { title?: string; summary?: string | null; reportJson?: Record<string, unknown>; evidenceReferences?: unknown[] }) {
  requireReportWrite(ctx);
  const supabase = await createServerSupabaseClient();
  const [{ data: report }, { data: versions }] = await Promise.all([
    supabase.from("impact_reports").select("id,title,summary,report_json,evidence_references").eq("id", reportId).maybeSingle(),
    supabase.from("impact_report_versions").select("version_number").eq("report_id", reportId).order("version_number", { ascending: false }).limit(1),
  ]);
  if (!report) throw new Error("Report not found.");
  const nextVersion = Number(versions?.[0]?.version_number ?? 0) + 1;
  const { error } = await supabase.from("impact_report_versions").insert({
    report_id: reportId,
    version_number: nextVersion,
    title: input?.title ?? report.title,
    summary: input?.summary ?? report.summary,
    report_json: input?.reportJson ?? report.report_json ?? {},
    evidence_references: input?.evidenceReferences ?? report.evidence_references ?? [],
    created_by_user_id: ctx.appUserId,
    metadata: { source: "impact_reporting_engine" },
  });
  if (error) throw new Error(error.message);
}

export async function getImpactReport(ctx: UserContext, reportId: string) {
  requireReportingAccess(ctx);
  const supabase = await createServerSupabaseClient();
  const [{ data: report, error }, { data: versions }, { data: exports }] = await Promise.all([
    supabase.from("impact_reports").select(reportSelect()).eq("id", reportId).maybeSingle(),
    supabase.from("impact_report_versions").select("id,report_id,version_number,title,summary,report_json,evidence_references,created_by_user_id,created_at").eq("report_id", reportId).order("version_number", { ascending: false }),
    supabase.from("impact_report_exports").select("id,report_id,export_format,export_status,export_url,requested_by_user_id,requested_at,completed_at").eq("report_id", reportId).order("requested_at", { ascending: false }),
  ]);
  logImpactDataError("get_impact_report_failed", error);
  return {
    report: report as unknown as ImpactReport | null,
    versions: (versions ?? []) as ImpactReportVersion[],
    exports: (exports ?? []) as ImpactReportExport[],
  };
}

export async function exportReportRecord(ctx: UserContext, reportId: string, formData: FormData) {
  requireReportingAccess(ctx);
  const exportFormat = textValue(formData, "export_format") ?? "pdf";
  const format = ["pdf", "csv", "xlsx", "json"].includes(exportFormat) ? exportFormat : "pdf";
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("impact_report_exports").insert({
    report_id: reportId,
    export_format: format,
    export_status: "generated",
    export_url: textValue(formData, "export_url"),
    requested_by_user_id: ctx.appUserId,
    completed_at: new Date().toISOString(),
    metadata: { deterministic: true },
  }).select("id").single();
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_report_exported", entityType: "impact_report", entityId: reportId, metadata: { role: ctx.role, export_format: format, export_id: data.id } });
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
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("impact_anomaly_events").upsert({ ...row, status: "open", detected_at: new Date().toISOString() }, { onConflict: "source_key" });
  if (error) throw new Error(error.message);
}

export async function generateMsmeInsights(ctx: UserContext) {
  requireIntelligenceManage(ctx);
  const supabase = await createServerSupabaseClient();
  const [{ data: assessments }, { data: scores }, { data: evidence }] = await Promise.all([
    supabase.from("impact_assessments").select("id,title,status,msme_id,programme_id,intervention_id").limit(1000),
    supabase.from("impact_assessment_scores").select("assessment_id,section_id,weighted_score,readiness_category").is("section_id", null).limit(1000),
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
    listImpactProgrammes({ limit: 1000 }),
    listImpactInterventions({ limit: 1000 }),
    listFieldVisits(undefined, { limit: 1000 }),
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
  const supabase = await createServerSupabaseClient();
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
  const [visits, evidence] = await Promise.all([listFieldVisits(undefined, { limit: 1000 }), listEvidence(undefined, { limit: 1000 })]);
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
    listImpactInterventions({ limit: 1000 }),
    listEvidence(undefined, { limit: 1000 }),
    listImpactAssessments({ limit: 1000 }),
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
  requireIntelligenceAccess(ctx);
  const supabase = await createServerSupabaseClient();
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
  logImpactDataError("list_intelligence_feed_failed", error);
  return {
    insights: (insights ?? []) as unknown as ImpactAiInsight[],
    recommendations: (recommendations ?? []) as ImpactAiRecommendation[],
    riskFlags: (riskFlags ?? []) as unknown as ImpactRiskFlag[],
    anomalies: (anomalies ?? []) as ImpactAnomalyEvent[],
    summaries: (summaries ?? []) as ImpactIntelligenceSummary[],
  };
}

export async function getInsightDetail(ctx: UserContext, insightId: string) {
  requireIntelligenceAccess(ctx);
  const supabase = await createServerSupabaseClient();
  const [{ data: insight, error }, { data: recommendations }, { data: riskFlags }, { data: anomalies }] = await Promise.all([
    supabase.from("impact_ai_insights").select(insightSelect()).eq("id", insightId).maybeSingle(),
    supabase.from("impact_ai_recommendations").select("id,insight_id,source_key,recommendation_type,priority,status,title,recommendation,programme_id,intervention_id,assessment_id,report_id,msme_id,created_at").eq("insight_id", insightId).order("created_at", { ascending: false }),
    supabase.from("impact_risk_flags").select(riskSelect()).limit(20),
    supabase.from("impact_anomaly_events").select("id,source_key,anomaly_type,severity,status,title,description,programme_id,intervention_id,assessment_id,report_id,msme_id,detected_at").limit(20),
  ]);
  logImpactDataError("get_insight_detail_failed", error);
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
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("impact_ai_insights").update({
    status: "dismissed",
    dismissed_by_user_id: ctx.appUserId,
    dismissed_at: new Date().toISOString(),
  }).eq("id", insightId);
  if (error) throw new Error(error.message);
  await logActivity({ actorUserId: ctx.appUserId, action: "impact_ai_insight_dismissed", entityType: "impact_ai_insight", entityId: insightId, metadata: { role: ctx.role } });
}

export async function listImpactReports(options: ImpactQueryOptions = {}): Promise<ImpactReport[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("impact_reports")
    .select(reportSelect())
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 25);

  logImpactDataError("list_reports_failed", error);
  return (data ?? []) as unknown as ImpactReport[];
}
