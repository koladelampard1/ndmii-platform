import type { SupabaseClient } from "@supabase/supabase-js";
import { recordTrustedLcdboDeliveryEvent } from "@/lib/data/platform-foundation";
import {
  DELIVERY_PRIORITIES,
  HEALTH_STATUSES,
  WORKSTREAM_STATUSES,
  deliveryInput,
  isLcdboDeliverySchemaUnavailable,
  requireLcdboDeliveryAccess,
  type DeliveryAccessMode,
  type DeliveryPriority,
  type HealthStatus,
  type LcdboDeliveryAccess,
  type LcdboDeliveryUser,
} from "@/lib/data/lcdbo-delivery";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { IndustrialCluster, Institution, JsonRecord, Lga, Programme, State } from "@/types/platform";

type Client = SupabaseClient<any>;

export const PLAN_ACTIVATION_STATUSES = ["reference", "planned", "proposed", "approved", "mobilising", "active", "paused", "completed", "cancelled"] as const;
export const PLAN_APPROVAL_STATUSES = ["draft", "submitted", "under_review", "approved", "changes_requested", "rejected"] as const;
export const ACTIVITY_TYPES = ["mobilisation", "coordination", "assessment", "site_readiness", "stakeholder_engagement", "training", "infrastructure_planning", "reporting", "other"] as const;
export const PROGRESS_REVIEW_STATUSES = ["submitted", "under_review", "approved", "rejected"] as const;

export type PlanActivationStatus = typeof PLAN_ACTIVATION_STATUSES[number];
export type PlanApprovalStatus = typeof PLAN_APPROVAL_STATUSES[number];
export type ActivityType = typeof ACTIVITY_TYPES[number];
export type ProgressReviewStatus = typeof PROGRESS_REVIEW_STATUSES[number];

export type StatePlan = {
  id: string;
  programme_id: string;
  state_id: string;
  plan_reference: string;
  title: string;
  implementation_phase: string;
  activation_status: PlanActivationStatus;
  approval_status: PlanApprovalStatus;
  state_coordinator_id: string | null;
  accountable_institution_id: string | null;
  participating_institution_ids: string[];
  priority_sectors: string[];
  priority_value_chains: string[];
  target_lga_ids: string[];
  target_cluster_ids: string[];
  msme_mobilisation_target: number | null;
  enrolment_target: number | null;
  cluster_placement_target: number | null;
  infrastructure_priorities: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  delivery_status: string;
  delivery_health: HealthStatus;
  progress_percentage: number;
  reporting_completeness: number;
  latest_update: string | null;
  metadata: JsonRecord;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  state?: Pick<State, "id" | "name" | "code"> | null;
  coordinator?: LcdboDeliveryUser | null;
  accountableInstitution?: Pick<Institution, "id" | "name" | "slug" | "institution_type"> | null;
};

export type LgaPlan = {
  id: string;
  programme_id: string;
  state_plan_id: string;
  state_id: string;
  lga_id: string;
  plan_reference: string;
  title: string;
  activation_status: PlanActivationStatus;
  approval_status: PlanApprovalStatus;
  lga_delivery_lead_id: string | null;
  local_government_focal_point: string | null;
  accountable_institution_id: string | null;
  priority_sectors: string[];
  priority_value_chains: string[];
  target_communities: string[];
  msme_mobilisation_target: number | null;
  enrolment_target: number | null;
  cluster_target: number | null;
  start_date: string | null;
  target_completion_date: string | null;
  delivery_status: string;
  delivery_health: HealthStatus;
  progress_percentage: number;
  reporting_completeness: number;
  latest_update: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
  state?: Pick<State, "id" | "name" | "code"> | null;
  lga?: Pick<Lga, "id" | "name" | "code"> | null;
  statePlan?: Pick<StatePlan, "id" | "plan_reference" | "title" | "activation_status" | "approval_status"> | null;
  lead?: LcdboDeliveryUser | null;
  accountableInstitution?: Pick<Institution, "id" | "name" | "slug" | "institution_type"> | null;
};

export type ClusterPlan = {
  id: string;
  programme_id: string;
  state_plan_id: string;
  lga_plan_id: string | null;
  state_id: string;
  lga_id: string | null;
  cluster_id: string;
  plan_reference: string;
  title: string;
  cluster_development_phase: string;
  activation_status: PlanActivationStatus;
  approval_status: PlanApprovalStatus;
  cluster_manager_id: string | null;
  accountable_institution_id: string | null;
  target_operational_date: string | null;
  target_business_capacity: number | null;
  priority_value_chains: string[];
  facilities_requirements: string | null;
  infrastructure_requirements: string | null;
  readiness_gaps: string | null;
  onboarding_milestones: string | null;
  production_targets: string | null;
  capacity_utilisation_target: number | null;
  employment_target: number | null;
  dependencies: string | null;
  delivery_status: string;
  delivery_health: HealthStatus;
  progress_percentage: number;
  reporting_completeness: number;
  latest_update: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
  state?: Pick<State, "id" | "name" | "code"> | null;
  lga?: Pick<Lga, "id" | "name" | "code"> | null;
  cluster?: Pick<IndustrialCluster, "id" | "name" | "slug" | "sector" | "status" | "jobs_target" | "msme_target" | "investment_required"> | null;
  statePlan?: Pick<StatePlan, "id" | "plan_reference" | "title"> | null;
  lgaPlan?: Pick<LgaPlan, "id" | "plan_reference" | "title"> | null;
  manager?: LcdboDeliveryUser | null;
  liveMembershipCount?: number;
  latestReadiness?: string | null;
};

export type DeliveryActivity = {
  id: string;
  programme_id: string;
  state_plan_id: string | null;
  lga_plan_id: string | null;
  cluster_plan_id: string | null;
  delivery_item_id: string | null;
  reference: string;
  title: string;
  description: string | null;
  activity_type: ActivityType;
  owner_id: string | null;
  participating_institution_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_completion_date: string | null;
  status: string;
  priority: DeliveryPriority;
  progress_percentage: number;
  location_reference: string | null;
  expected_output: string | null;
  completion_notes: string | null;
  evidence_requirement: string | null;
  latest_update: string | null;
  metadata: JsonRecord;
  created_at: string;
  updated_at: string;
  owner?: LcdboDeliveryUser | null;
  statePlan?: Pick<StatePlan, "id" | "plan_reference" | "title"> | null;
  lgaPlan?: Pick<LgaPlan, "id" | "plan_reference" | "title"> | null;
  clusterPlan?: Pick<ClusterPlan, "id" | "plan_reference" | "title"> | null;
};

export type ProgressUpdate = {
  id: string;
  programme_id: string;
  workstream_id: string | null;
  state_plan_id: string | null;
  lga_plan_id: string | null;
  cluster_plan_id: string | null;
  delivery_item_id: string | null;
  activity_id: string | null;
  reporting_period_start: string;
  reporting_period_end: string;
  progress_summary: string;
  progress_percentage: number;
  updated_delivery_status: string;
  updated_health: HealthStatus;
  achievements: string | null;
  challenges: string | null;
  support_required: string | null;
  next_steps: string | null;
  evidence_references: string[];
  review_status: ProgressReviewStatus;
  submitted_by: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  metadata: JsonRecord;
  submitter?: LcdboDeliveryUser | null;
  reviewer?: LcdboDeliveryUser | null;
};

export type GeographyDeliverySnapshot = {
  programme: Programme | null;
  unavailable: boolean;
  statePlans: StatePlan[];
  lgaPlans: LgaPlan[];
  clusterPlans: ClusterPlan[];
  activities: DeliveryActivity[];
  progressUpdates: ProgressUpdate[];
  metrics: ReturnType<typeof calculateGeographicDeliveryMetrics>;
};

export const GEOGRAPHIC_DELIVERY_ROLES = ["state_coordinator", "lga_coordinator", "cluster_manager"] as const;
export type GeographicDeliveryRole = typeof GEOGRAPHIC_DELIVERY_ROLES[number];
export type LcdboGeographyDeliveryAccess = LcdboDeliveryAccess & {
  canCoordinateGeography: boolean;
  geographicRoles: GeographicDeliveryRole[];
};

async function clientOrService(client?: Client) {
  return client ?? await createServiceRoleSupabaseClient();
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isMissingSprint2Schema(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  const code = candidate?.code ?? "";
  const message = candidate?.message ?? "";
  return isLcdboDeliverySchemaUnavailable(error) || ["42P01", "PGRST200", "PGRST205"].includes(code) || /lcdbo_(state_delivery_plans|lga_delivery_plans|cluster_delivery_plans|delivery_activities|delivery_progress_updates).*does not exist|could not find .*lcdbo_(state_delivery_plans|lga_delivery_plans|cluster_delivery_plans|delivery_activities|delivery_progress_updates)/i.test(message);
}

export function isLcdboDeliveryGeographySchemaUnavailable(error: unknown) {
  return isMissingSprint2Schema(error);
}

function pct(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function intOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function isValid<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return (allowed as readonly string[]).includes(value);
}

function normaliseReference(prefix: string, currentCount: number) {
  return `${prefix}-${String(currentCount + 1).padStart(3, "0")}`;
}

function calculatedHealth(status: string, progress: number, dueDate?: string | null): HealthStatus {
  if (status === "completed") return "green";
  if (["blocked", "cancelled"].includes(status)) return "red";
  if (status === "at_risk") return "amber";
  if (dueDate && new Date(dueDate) < new Date() && !["completed", "cancelled"].includes(status)) return "red";
  if (progress >= 70) return "green";
  if (progress <= 10 && ["planned", "not_started"].includes(status)) return "grey";
  return "amber";
}

function classificationLabel(metadata: JsonRecord | null | undefined) {
  const value = String(metadata?.record_classification ?? "live_operational");
  if (value === "configured_target") return "Configured target";
  if (value === "governed_update") return "Governed update";
  return "Live operational";
}

function hasGeographicRole(access: LcdboGeographyDeliveryAccess | LcdboDeliveryAccess, role: GeographicDeliveryRole) {
  return access.roles.includes(role);
}

function asGeographicAccess(access: LcdboDeliveryAccess): LcdboGeographyDeliveryAccess {
  const geographicRoles = GEOGRAPHIC_DELIVERY_ROLES.filter((role) => access.roles.includes(role));
  return {
    ...access,
    geographicRoles,
    canCoordinateGeography: geographicRoles.length > 0,
  };
}

export async function requireLcdboGeographyDeliveryAccess(mode: DeliveryAccessMode = "view", client?: Client): Promise<LcdboGeographyDeliveryAccess> {
  return asGeographicAccess(await requireLcdboDeliveryAccess(mode, client));
}

function assertProgrammeManager(access: LcdboGeographyDeliveryAccess, message = "Programme-wide LCDBO delivery management permission is required.") {
  if (!access.canManage) throw new Error(message);
}

function canSaveAssignedStatePlan(access: LcdboGeographyDeliveryAccess, plan: Pick<StatePlan, "state_coordinator_id">) {
  return access.canManage || hasGeographicRole(access, "state_coordinator") && plan.state_coordinator_id === access.ctx.appUserId;
}

function canSaveAssignedLgaPlan(access: LcdboGeographyDeliveryAccess, plan: Pick<LgaPlan, "lga_delivery_lead_id">) {
  return access.canManage || hasGeographicRole(access, "lga_coordinator") && plan.lga_delivery_lead_id === access.ctx.appUserId;
}

function canSaveAssignedClusterPlan(access: LcdboGeographyDeliveryAccess, plan: Pick<ClusterPlan, "cluster_manager_id">) {
  return access.canManage || hasGeographicRole(access, "cluster_manager") && plan.cluster_manager_id === access.ctx.appUserId;
}

function assertCanSaveStatePlan(access: LcdboGeographyDeliveryAccess, plan: Pick<StatePlan, "state_coordinator_id">) {
  if (!canSaveAssignedStatePlan(access, plan)) throw new Error("You can only manage LCDBO state plans assigned to you.");
}

function assertCanSaveLgaPlan(access: LcdboGeographyDeliveryAccess, plan: Pick<LgaPlan, "lga_delivery_lead_id">) {
  if (!canSaveAssignedLgaPlan(access, plan)) throw new Error("You can only manage LCDBO LGA plans assigned to you.");
}

function assertCanSaveClusterPlan(access: LcdboGeographyDeliveryAccess, plan: Pick<ClusterPlan, "cluster_manager_id">) {
  if (!canSaveAssignedClusterPlan(access, plan)) throw new Error("You can only manage LCDBO cluster plans assigned to you.");
}

async function canSaveActivityScope(access: LcdboGeographyDeliveryAccess, payload: { state_plan_id?: string | null; lga_plan_id?: string | null; cluster_plan_id?: string | null; owner_id?: string | null }) {
  if (access.canManage) return true;
  if (payload.cluster_plan_id) {
    const clusterPlan = await getClusterDeliveryPlan(payload.cluster_plan_id, access.programme.id, access.supabase);
    return !!clusterPlan && canSaveAssignedClusterPlan(access, clusterPlan);
  }
  if (payload.lga_plan_id) {
    const lgaPlan = await getLgaDeliveryPlan(payload.lga_plan_id, access.programme.id, access.supabase);
    return !!lgaPlan && canSaveAssignedLgaPlan(access, lgaPlan);
  }
  if (payload.state_plan_id) {
    const statePlan = await getStateDeliveryPlan(payload.state_plan_id, access.programme.id, access.supabase);
    return !!statePlan && canSaveAssignedStatePlan(access, statePlan);
  }
  return false;
}

async function assertCanSaveActivityScope(access: LcdboGeographyDeliveryAccess, payload: { state_plan_id?: string | null; lga_plan_id?: string | null; cluster_plan_id?: string | null; owner_id?: string | null }) {
  if (!await canSaveActivityScope(access, payload)) throw new Error("You can only manage LCDBO delivery activities assigned to your geographic scope.");
}

async function assertCanSubmitProgressUpdate(access: LcdboGeographyDeliveryAccess, payload: { workstream_id?: string | null; state_plan_id?: string | null; lga_plan_id?: string | null; cluster_plan_id?: string | null; delivery_item_id?: string | null; activity_id?: string | null }) {
  if (access.canManage) return;
  if (payload.workstream_id || payload.delivery_item_id) throw new Error("Geographic coordinators cannot submit updates directly against national delivery records.");
  if (payload.activity_id) {
    const activity = (await listDeliveryActivities({ programmeId: access.programme.id, client: access.supabase })).find((item) => item.id === payload.activity_id);
    if (activity && await canSaveActivityScope(access, activity)) return;
    throw new Error("You can only submit activity updates assigned to your geographic scope.");
  }
  if (payload.cluster_plan_id) {
    const clusterPlan = await getClusterDeliveryPlan(payload.cluster_plan_id, access.programme.id, access.supabase);
    if (!clusterPlan) throw new Error("Cluster delivery plan not found.");
    assertCanSaveClusterPlan(access, clusterPlan);
    return;
  }
  if (payload.lga_plan_id) {
    const lgaPlan = await getLgaDeliveryPlan(payload.lga_plan_id, access.programme.id, access.supabase);
    if (!lgaPlan) throw new Error("LGA delivery plan not found.");
    assertCanSaveLgaPlan(access, lgaPlan);
    return;
  }
  if (payload.state_plan_id) {
    const statePlan = await getStateDeliveryPlan(payload.state_plan_id, access.programme.id, access.supabase);
    if (!statePlan) throw new Error("State delivery plan not found.");
    assertCanSaveStatePlan(access, statePlan);
    return;
  }
  throw new Error("A valid assigned geographic delivery target is required.");
}

export async function getLcdboGeographyDeliverySnapshot(client?: Client): Promise<GeographyDeliverySnapshot> {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) return { programme: null, unavailable: false, statePlans: [], lgaPlans: [], clusterPlans: [], activities: [], progressUpdates: [], metrics: calculateGeographicDeliveryMetrics([], [], [], [], []) };
  try {
    const [statePlans, lgaPlans, clusterPlans, activities, progressUpdates] = await Promise.all([
      listStateDeliveryPlans({ programmeId: programme.id, client: supabase }),
      listLgaDeliveryPlans({ programmeId: programme.id, client: supabase }),
      listClusterDeliveryPlans({ programmeId: programme.id, client: supabase }),
      listDeliveryActivities({ programmeId: programme.id, client: supabase }),
      listProgressUpdates({ programmeId: programme.id, client: supabase }),
    ]);
    return { programme, unavailable: false, statePlans, lgaPlans, clusterPlans, activities, progressUpdates, metrics: calculateGeographicDeliveryMetrics(statePlans, lgaPlans, clusterPlans, activities, progressUpdates) };
  } catch (error) {
    if (isMissingSprint2Schema(error)) return { programme, unavailable: true, statePlans: [], lgaPlans: [], clusterPlans: [], activities: [], progressUpdates: [], metrics: calculateGeographicDeliveryMetrics([], [], [], [], []) };
    throw error;
  }
}

export function calculateGeographicDeliveryMetrics(statePlans: StatePlan[], lgaPlans: LgaPlan[], clusterPlans: ClusterPlan[], activities: DeliveryActivity[], updates: ProgressUpdate[]) {
  const activeStatuses = new Set(["mobilising", "active"]);
  const operational = [...statePlans, ...lgaPlans, ...clusterPlans].filter((plan) => activeStatuses.has(plan.activation_status));
  const approvedUpdates = updates.filter((update) => update.review_status === "approved");
  const activePlans = [...statePlans, ...lgaPlans, ...clusterPlans].filter((plan) => !["cancelled"].includes(plan.activation_status));
  const progress = activePlans.length ? Math.round(activePlans.reduce((sum, plan) => sum + plan.progress_percentage, 0) / activePlans.length) : 0;
  const completeness = activePlans.length ? Math.round(activePlans.reduce((sum, plan) => sum + plan.reporting_completeness, 0) / activePlans.length) : 0;
  return {
    statePlans: statePlans.length,
    activeStatePlans: statePlans.filter((plan) => activeStatuses.has(plan.activation_status)).length,
    lgaPlans: lgaPlans.length,
    activeLgaPlans: lgaPlans.filter((plan) => activeStatuses.has(plan.activation_status)).length,
    clusterPlans: clusterPlans.length,
    activeClusterPlans: clusterPlans.filter((plan) => activeStatuses.has(plan.activation_status)).length,
    operationalPlans: operational.length,
    activities: activities.length,
    overdueActivities: activities.filter((activity) => activity.planned_end_date && new Date(activity.planned_end_date) < new Date() && !["completed", "cancelled"].includes(activity.status)).length,
    pendingUpdates: updates.filter((update) => ["submitted", "under_review"].includes(update.review_status)).length,
    approvedUpdates: approvedUpdates.length,
    geographicProgress: progress,
    reportingCompleteness: completeness,
    latestUpdate: [...statePlans, ...lgaPlans, ...clusterPlans, ...activities].map((item) => item.updated_at).concat(updates.map((item) => item.submitted_at)).sort().at(-1) ?? null,
  };
}

export async function listStateDeliveryPlans(input: { programmeId: string; query?: string; stateId?: string; activation?: string; approval?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_state_delivery_plans")
    .select("*,state:states(id,name,code),coordinator:users!lcdbo_state_delivery_plans_state_coordinator_id_fkey(id,full_name,email,role),accountableInstitution:institutions!lcdbo_state_delivery_plans_accountable_institution_id_fkey(id,name,slug,institution_type)")
    .eq("programme_id", input.programmeId)
    .order("plan_reference", { ascending: true });
  if (input.query) query = query.or(`title.ilike.%${input.query}%,plan_reference.ilike.%${input.query}%`);
  if (input.stateId) query = query.eq("state_id", input.stateId);
  if (input.activation && isValid(input.activation, PLAN_ACTIVATION_STATUSES)) query = query.eq("activation_status", input.activation);
  if (input.approval && isValid(input.approval, PLAN_APPROVAL_STATUSES)) query = query.eq("approval_status", input.approval);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, state: one(row.state), coordinator: one(row.coordinator), accountableInstitution: one(row.accountableInstitution) })) as StatePlan[];
}

export async function listLgaDeliveryPlans(input: { programmeId: string; statePlanId?: string; query?: string; stateId?: string; activation?: string; approval?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_lga_delivery_plans")
    .select("*,state:states(id,name,code),lga:lgas(id,name,code),statePlan:lcdbo_state_delivery_plans(id,plan_reference,title,activation_status,approval_status),lead:users!lcdbo_lga_delivery_plans_lga_delivery_lead_id_fkey(id,full_name,email,role),accountableInstitution:institutions!lcdbo_lga_delivery_plans_accountable_institution_id_fkey(id,name,slug,institution_type)")
    .eq("programme_id", input.programmeId)
    .order("plan_reference", { ascending: true });
  if (input.statePlanId) query = query.eq("state_plan_id", input.statePlanId);
  if (input.query) query = query.or(`title.ilike.%${input.query}%,plan_reference.ilike.%${input.query}%`);
  if (input.stateId) query = query.eq("state_id", input.stateId);
  if (input.activation && isValid(input.activation, PLAN_ACTIVATION_STATUSES)) query = query.eq("activation_status", input.activation);
  if (input.approval && isValid(input.approval, PLAN_APPROVAL_STATUSES)) query = query.eq("approval_status", input.approval);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, state: one(row.state), lga: one(row.lga), statePlan: one(row.statePlan), lead: one(row.lead), accountableInstitution: one(row.accountableInstitution) })) as LgaPlan[];
}

export async function listClusterDeliveryPlans(input: { programmeId: string; statePlanId?: string; lgaPlanId?: string; query?: string; stateId?: string; activation?: string; approval?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_cluster_delivery_plans")
    .select("*,state:states(id,name,code),lga:lgas(id,name,code),cluster:industrial_clusters(id,name,slug,sector,status,jobs_target,msme_target,investment_required),statePlan:lcdbo_state_delivery_plans(id,plan_reference,title),lgaPlan:lcdbo_lga_delivery_plans(id,plan_reference,title),manager:users!lcdbo_cluster_delivery_plans_cluster_manager_id_fkey(id,full_name,email,role)")
    .eq("programme_id", input.programmeId)
    .order("plan_reference", { ascending: true });
  if (input.statePlanId) query = query.eq("state_plan_id", input.statePlanId);
  if (input.lgaPlanId) query = query.eq("lga_plan_id", input.lgaPlanId);
  if (input.query) query = query.or(`title.ilike.%${input.query}%,plan_reference.ilike.%${input.query}%`);
  if (input.stateId) query = query.eq("state_id", input.stateId);
  if (input.activation && isValid(input.activation, PLAN_ACTIVATION_STATUSES)) query = query.eq("activation_status", input.activation);
  if (input.approval && isValid(input.approval, PLAN_APPROVAL_STATUSES)) query = query.eq("approval_status", input.approval);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({ ...row, state: one(row.state), lga: one(row.lga), cluster: one(row.cluster), statePlan: one(row.statePlan), lgaPlan: one(row.lgaPlan), manager: one(row.manager) })) as ClusterPlan[];
  if (!rows.length) return rows;
  const clusterIds = rows.map((row) => row.cluster_id);
  const [{ data: members }, { data: assessments }] = await Promise.all([
    supabase.from("cluster_members").select("cluster_id,status").in("cluster_id", clusterIds).in("status", ["accepted", "onboarding", "active", "placed"]),
    supabase.from("lcdbo_cluster_assessments").select("cluster_member_id,readiness_level,created_at,cluster_members!inner(cluster_id)").order("created_at", { ascending: false }).limit(250),
  ]);
  const membership = new Map<string, number>();
  for (const member of members ?? []) membership.set(member.cluster_id, (membership.get(member.cluster_id) ?? 0) + 1);
  const readiness = new Map<string, string>();
  for (const assessment of assessments ?? []) {
    const clusterId = one((assessment as any).cluster_members)?.cluster_id;
    if (clusterId && !readiness.has(clusterId)) readiness.set(clusterId, (assessment as any).readiness_level);
  }
  return rows.map((row) => ({ ...row, liveMembershipCount: membership.get(row.cluster_id) ?? 0, latestReadiness: readiness.get(row.cluster_id) ?? null }));
}

export async function listDeliveryActivities(input: { programmeId: string; statePlanId?: string; lgaPlanId?: string; clusterPlanId?: string; ownerId?: string; status?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_delivery_activities")
    .select("*,owner:users!lcdbo_delivery_activities_owner_id_fkey(id,full_name,email,role),statePlan:lcdbo_state_delivery_plans(id,plan_reference,title),lgaPlan:lcdbo_lga_delivery_plans(id,plan_reference,title),clusterPlan:lcdbo_cluster_delivery_plans(id,plan_reference,title)")
    .eq("programme_id", input.programmeId)
    .order("planned_end_date", { ascending: true, nullsFirst: false });
  if (input.statePlanId) query = query.eq("state_plan_id", input.statePlanId);
  if (input.lgaPlanId) query = query.eq("lga_plan_id", input.lgaPlanId);
  if (input.clusterPlanId) query = query.eq("cluster_plan_id", input.clusterPlanId);
  if (input.ownerId) query = query.eq("owner_id", input.ownerId);
  if (input.status && isValid(input.status, WORKSTREAM_STATUSES)) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, owner: one(row.owner), statePlan: one(row.statePlan), lgaPlan: one(row.lgaPlan), clusterPlan: one(row.clusterPlan) })) as DeliveryActivity[];
}

export async function listProgressUpdates(input: { programmeId: string; statePlanId?: string; lgaPlanId?: string; clusterPlanId?: string; activityId?: string; reviewStatus?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_delivery_progress_updates")
    .select("*,submitter:users!lcdbo_delivery_progress_updates_submitted_by_fkey(id,full_name,email,role),reviewer:users!lcdbo_delivery_progress_updates_reviewed_by_fkey(id,full_name,email,role)")
    .eq("programme_id", input.programmeId)
    .order("submitted_at", { ascending: false });
  if (input.statePlanId) query = query.eq("state_plan_id", input.statePlanId);
  if (input.lgaPlanId) query = query.eq("lga_plan_id", input.lgaPlanId);
  if (input.clusterPlanId) query = query.eq("cluster_plan_id", input.clusterPlanId);
  if (input.activityId) query = query.eq("activity_id", input.activityId);
  if (input.reviewStatus && isValid(input.reviewStatus, PROGRESS_REVIEW_STATUSES)) query = query.eq("review_status", input.reviewStatus);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, submitter: one(row.submitter), reviewer: one(row.reviewer) })) as ProgressUpdate[];
}

export async function listGeographyReference(client?: Client) {
  const supabase = await clientOrService(client);
  const [states, lgas, clusters, users, institutions] = await Promise.all([
    supabase.from("states").select("id,name,code").eq("status", "active").order("name"),
    supabase.from("lgas").select("id,state_id,name,code").eq("status", "active").order("name"),
    supabase.from("industrial_clusters").select("id,name,slug,sector,state_id,lga_id,status").order("name"),
    supabase.from("users").select("id,full_name,email,role").order("full_name"),
    supabase.from("institutions").select("id,name,slug,institution_type").eq("status", "active").order("name"),
  ]);
  if (states.error) throw states.error;
  if (lgas.error) throw lgas.error;
  if (clusters.error) throw clusters.error;
  if (users.error) throw users.error;
  if (institutions.error) throw institutions.error;
  return {
    states: (states.data ?? []) as Pick<State, "id" | "name" | "code">[],
    lgas: (lgas.data ?? []) as Array<Pick<Lga, "id" | "name" | "code"> & { state_id: string }>,
    clusters: (clusters.data ?? []) as Array<Pick<IndustrialCluster, "id" | "name" | "slug" | "sector" | "status"> & { state_id: string | null; lga_id: string | null }>,
    users: (users.data ?? []) as LcdboDeliveryUser[],
    institutions: (institutions.data ?? []) as Pick<Institution, "id" | "name" | "slug" | "institution_type">[],
  };
}

export async function getStateDeliveryPlan(id: string, programmeId: string, client?: Client) {
  return (await listStateDeliveryPlans({ programmeId, client })).find((item) => item.id === id) ?? null;
}

export async function getLgaDeliveryPlan(id: string, programmeId: string, client?: Client) {
  return (await listLgaDeliveryPlans({ programmeId, client })).find((item) => item.id === id) ?? null;
}

export async function getClusterDeliveryPlan(id: string, programmeId: string, client?: Client) {
  return (await listClusterDeliveryPlans({ programmeId, client })).find((item) => item.id === id) ?? null;
}

function planPayload(formData: FormData) {
  const helper = deliveryInput(formData);
  const activation = helper.value("activation_status") ?? "planned";
  const approval = helper.value("approval_status") ?? "draft";
  const deliveryStatus = helper.value("delivery_status") ?? "planned";
  const progress = pct(formData.get("progress_percentage"));
  if (!isValid(activation, PLAN_ACTIVATION_STATUSES) || !isValid(approval, PLAN_APPROVAL_STATUSES) || !isValid(deliveryStatus, WORKSTREAM_STATUSES)) {
    throw new Error("Invalid delivery plan lifecycle values.");
  }
  return { helper, activation, approval, deliveryStatus, progress };
}

export async function createOrUpdateStatePlan(input: { formData: FormData; access: LcdboGeographyDeliveryAccess }) {
  const { ctx, programme, supabase } = input.access;
  const actorUserId = ctx.appUserId!;
  const programmeId = programme.id;
  const { helper, activation, approval, deliveryStatus, progress } = planPayload(input.formData);
  const id = helper.value("id");
  const stateId = helper.value("state_id");
  if (!stateId) throw new Error("State is required.");
  const { count } = await supabase.from("lcdbo_state_delivery_plans").select("id", { count: "exact", head: true }).eq("programme_id", programmeId);
  const payload = {
    programme_id: programmeId,
    state_id: stateId,
    plan_reference: helper.value("plan_reference") ?? normaliseReference("LCDBO-ST", count ?? 0),
    title: helper.value("title") ?? "State delivery plan",
    implementation_phase: helper.value("implementation_phase") ?? "baseline_planning",
    activation_status: activation,
    approval_status: approval,
    state_coordinator_id: helper.value("state_coordinator_id"),
    accountable_institution_id: helper.value("accountable_institution_id"),
    priority_sectors: splitList(input.formData.get("priority_sectors")),
    priority_value_chains: splitList(input.formData.get("priority_value_chains")),
    msme_mobilisation_target: intOrNull(input.formData.get("msme_mobilisation_target")),
    enrolment_target: intOrNull(input.formData.get("enrolment_target")),
    cluster_placement_target: intOrNull(input.formData.get("cluster_placement_target")),
    infrastructure_priorities: helper.value("infrastructure_priorities"),
    start_date: helper.value("start_date"),
    target_completion_date: helper.value("target_completion_date"),
    delivery_status: deliveryStatus,
    delivery_health: calculatedHealth(deliveryStatus, progress, helper.value("target_completion_date")),
    progress_percentage: progress,
    reporting_completeness: pct(input.formData.get("reporting_completeness")),
    latest_update: helper.value("latest_update"),
    metadata: { source: "lcdbo_delivery_core_sprint2", record_classification: "live_operational" },
    updated_by: actorUserId,
    ...(approval === "submitted" && !id ? { submitted_by: actorUserId, submitted_at: new Date().toISOString() } : {}),
    ...(approval === "approved" ? { approved_by: actorUserId, approved_at: new Date().toISOString() } : {}),
    ...(!id ? { created_by: actorUserId } : {}),
  };
  if (id) {
    const existing = await getStateDeliveryPlan(id, programmeId, supabase);
    if (!existing) throw new Error("State delivery plan not found.");
    assertCanSaveStatePlan(input.access, existing);
  } else {
    assertCanSaveStatePlan(input.access, payload);
  }
  const query = id ? supabase.from("lcdbo_state_delivery_plans").update(payload).eq("id", id).eq("programme_id", programmeId) : supabase.from("lcdbo_state_delivery_plans").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save state delivery plan.");
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: id ? "lcdbo.delivery.state_plan.updated" : "lcdbo.delivery.state_plan.created", entityType: "lcdbo_state_delivery_plan", entityId: data.id, scopeType: "programme", scopeId: programmeId, metadata: { plan_reference: data.plan_reference, activation_status: data.activation_status, approval_status: data.approval_status } });
  return data as StatePlan;
}

export async function createOrUpdateLgaPlan(input: { formData: FormData; access: LcdboGeographyDeliveryAccess }) {
  const { ctx, programme, supabase } = input.access;
  const actorUserId = ctx.appUserId!;
  const programmeId = programme.id;
  const { helper, activation, approval, deliveryStatus, progress } = planPayload(input.formData);
  const id = helper.value("id");
  const statePlanId = helper.value("state_plan_id");
  const stateId = helper.value("state_id");
  const lgaId = helper.value("lga_id");
  if (!statePlanId || !stateId || !lgaId) throw new Error("State plan, state and LGA are required.");
  const { count } = await supabase.from("lcdbo_lga_delivery_plans").select("id", { count: "exact", head: true }).eq("programme_id", programmeId);
  const payload = {
    programme_id: programmeId,
    state_plan_id: statePlanId,
    state_id: stateId,
    lga_id: lgaId,
    plan_reference: helper.value("plan_reference") ?? normaliseReference("LCDBO-LGA", count ?? 0),
    title: helper.value("title") ?? "LGA delivery plan",
    activation_status: activation,
    approval_status: approval,
    lga_delivery_lead_id: helper.value("lga_delivery_lead_id"),
    local_government_focal_point: helper.value("local_government_focal_point"),
    accountable_institution_id: helper.value("accountable_institution_id"),
    priority_sectors: splitList(input.formData.get("priority_sectors")),
    priority_value_chains: splitList(input.formData.get("priority_value_chains")),
    target_communities: splitList(input.formData.get("target_communities")),
    msme_mobilisation_target: intOrNull(input.formData.get("msme_mobilisation_target")),
    enrolment_target: intOrNull(input.formData.get("enrolment_target")),
    cluster_target: intOrNull(input.formData.get("cluster_target")),
    start_date: helper.value("start_date"),
    target_completion_date: helper.value("target_completion_date"),
    delivery_status: deliveryStatus,
    delivery_health: calculatedHealth(deliveryStatus, progress, helper.value("target_completion_date")),
    progress_percentage: progress,
    reporting_completeness: pct(input.formData.get("reporting_completeness")),
    latest_update: helper.value("latest_update"),
    metadata: { source: "lcdbo_delivery_core_sprint2", record_classification: "live_operational" },
    updated_by: actorUserId,
    ...(approval === "approved" ? { approved_by: actorUserId, approved_at: new Date().toISOString() } : {}),
    ...(!id ? { created_by: actorUserId } : {}),
  };
  if (id) {
    const existing = await getLgaDeliveryPlan(id, programmeId, supabase);
    if (!existing) throw new Error("LGA delivery plan not found.");
    assertCanSaveLgaPlan(input.access, existing);
  } else {
    assertCanSaveLgaPlan(input.access, payload);
  }
  const query = id ? supabase.from("lcdbo_lga_delivery_plans").update(payload).eq("id", id).eq("programme_id", programmeId) : supabase.from("lcdbo_lga_delivery_plans").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save LGA delivery plan.");
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: id ? "lcdbo.delivery.lga_plan.updated" : "lcdbo.delivery.lga_plan.created", entityType: "lcdbo_lga_delivery_plan", entityId: data.id, scopeType: "programme", scopeId: programmeId, metadata: { plan_reference: data.plan_reference, activation_status: data.activation_status, approval_status: data.approval_status } });
  return data as LgaPlan;
}

export async function createOrUpdateClusterPlan(input: { formData: FormData; access: LcdboGeographyDeliveryAccess }) {
  const { ctx, programme, supabase } = input.access;
  const actorUserId = ctx.appUserId!;
  const programmeId = programme.id;
  const { helper, activation, approval, deliveryStatus, progress } = planPayload(input.formData);
  const id = helper.value("id");
  const statePlanId = helper.value("state_plan_id");
  const stateId = helper.value("state_id");
  const clusterId = helper.value("cluster_id");
  if (!statePlanId || !stateId || !clusterId) throw new Error("State plan, state and cluster are required.");
  const { count } = await supabase.from("lcdbo_cluster_delivery_plans").select("id", { count: "exact", head: true }).eq("programme_id", programmeId);
  const payload = {
    programme_id: programmeId,
    state_plan_id: statePlanId,
    lga_plan_id: helper.value("lga_plan_id"),
    state_id: stateId,
    lga_id: helper.value("lga_id"),
    cluster_id: clusterId,
    plan_reference: helper.value("plan_reference") ?? normaliseReference("LCDBO-CL", count ?? 0),
    title: helper.value("title") ?? "Cluster delivery plan",
    cluster_development_phase: helper.value("cluster_development_phase") ?? "baseline_planning",
    activation_status: activation,
    approval_status: approval,
    cluster_manager_id: helper.value("cluster_manager_id"),
    accountable_institution_id: helper.value("accountable_institution_id"),
    target_operational_date: helper.value("target_operational_date"),
    target_business_capacity: intOrNull(input.formData.get("target_business_capacity")),
    priority_value_chains: splitList(input.formData.get("priority_value_chains")),
    facilities_requirements: helper.value("facilities_requirements"),
    infrastructure_requirements: helper.value("infrastructure_requirements"),
    readiness_gaps: helper.value("readiness_gaps"),
    onboarding_milestones: helper.value("onboarding_milestones"),
    production_targets: helper.value("production_targets"),
    capacity_utilisation_target: intOrNull(input.formData.get("capacity_utilisation_target")),
    employment_target: intOrNull(input.formData.get("employment_target")),
    dependencies: helper.value("dependencies"),
    delivery_status: deliveryStatus,
    delivery_health: calculatedHealth(deliveryStatus, progress, helper.value("target_operational_date")),
    progress_percentage: progress,
    reporting_completeness: pct(input.formData.get("reporting_completeness")),
    latest_update: helper.value("latest_update"),
    metadata: { source: "lcdbo_delivery_core_sprint2", record_classification: "live_operational" },
    updated_by: actorUserId,
    ...(approval === "approved" ? { approved_by: actorUserId, approved_at: new Date().toISOString() } : {}),
    ...(!id ? { created_by: actorUserId } : {}),
  };
  if (id) {
    const existing = await getClusterDeliveryPlan(id, programmeId, supabase);
    if (!existing) throw new Error("Cluster delivery plan not found.");
    assertCanSaveClusterPlan(input.access, existing);
  } else {
    assertCanSaveClusterPlan(input.access, payload);
  }
  const query = id ? supabase.from("lcdbo_cluster_delivery_plans").update(payload).eq("id", id).eq("programme_id", programmeId) : supabase.from("lcdbo_cluster_delivery_plans").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save cluster delivery plan.");
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: id ? "lcdbo.delivery.cluster_plan.updated" : "lcdbo.delivery.cluster_plan.created", entityType: "lcdbo_cluster_delivery_plan", entityId: data.id, scopeType: "programme", scopeId: programmeId, metadata: { plan_reference: data.plan_reference, activation_status: data.activation_status, approval_status: data.approval_status } });
  return data as ClusterPlan;
}

export async function createOrUpdateActivity(input: { formData: FormData; access: LcdboGeographyDeliveryAccess }) {
  const { ctx, programme, supabase } = input.access;
  const actorUserId = ctx.appUserId!;
  const programmeId = programme.id;
  const helper = deliveryInput(input.formData);
  const id = helper.value("id");
  const activityType = helper.value("activity_type") ?? "coordination";
  const status = helper.value("status") ?? "planned";
  const priority = helper.value("priority") ?? "medium";
  if (!isValid(activityType, ACTIVITY_TYPES) || !isValid(status, WORKSTREAM_STATUSES) || !isValid(priority, DELIVERY_PRIORITIES)) throw new Error("Invalid activity values.");
  const progress = status === "completed" ? 100 : pct(input.formData.get("progress_percentage"));
  const { count } = await supabase.from("lcdbo_delivery_activities").select("id", { count: "exact", head: true }).eq("programme_id", programmeId);
  const payload = {
    programme_id: programmeId,
    state_plan_id: helper.value("state_plan_id"),
    lga_plan_id: helper.value("lga_plan_id"),
    cluster_plan_id: helper.value("cluster_plan_id"),
    delivery_item_id: helper.value("delivery_item_id"),
    reference: helper.value("reference") ?? normaliseReference("LCDBO-ACT", count ?? 0),
    title: helper.value("title") ?? "Delivery activity",
    description: helper.value("description"),
    activity_type: activityType,
    owner_id: helper.value("owner_id"),
    participating_institution_id: helper.value("participating_institution_id"),
    planned_start_date: helper.value("planned_start_date"),
    planned_end_date: helper.value("planned_end_date"),
    actual_completion_date: status === "completed" ? helper.value("actual_completion_date") ?? new Date().toISOString().slice(0, 10) : helper.value("actual_completion_date"),
    status,
    priority,
    progress_percentage: progress,
    location_reference: helper.value("location_reference"),
    expected_output: helper.value("expected_output"),
    completion_notes: helper.value("completion_notes"),
    evidence_requirement: helper.value("evidence_requirement"),
    latest_update: helper.value("latest_update"),
    metadata: { source: "lcdbo_delivery_core_sprint2", record_classification: "live_operational" },
    updated_by: actorUserId,
    ...(!id ? { created_by: actorUserId } : {}),
  };
  if (!input.access.canManage && payload.owner_id && payload.owner_id !== actorUserId) {
    throw new Error("Geographic coordinators can only assign activities to themselves or leave them unassigned.");
  }
  if (id) {
    const existing = (await listDeliveryActivities({ programmeId, client: supabase })).find((item) => item.id === id);
    if (!existing) throw new Error("Delivery activity not found.");
    await assertCanSaveActivityScope(input.access, existing);
  } else {
    await assertCanSaveActivityScope(input.access, payload);
  }
  const query = id ? supabase.from("lcdbo_delivery_activities").update(payload).eq("id", id).eq("programme_id", programmeId) : supabase.from("lcdbo_delivery_activities").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save activity.");
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: status === "completed" ? "lcdbo.delivery.activity.completed" : id ? "lcdbo.delivery.activity.updated" : "lcdbo.delivery.activity.created", entityType: "lcdbo_delivery_activity", entityId: data.id, scopeType: "programme", scopeId: programmeId, metadata: { reference: data.reference, activity_type: data.activity_type, status: data.status } });
  return data as DeliveryActivity;
}

export async function submitProgressUpdate(input: { formData: FormData; access: LcdboGeographyDeliveryAccess }) {
  const { ctx, programme, supabase } = input.access;
  const actorUserId = ctx.appUserId!;
  const programmeId = programme.id;
  const helper = deliveryInput(input.formData);
  const status = helper.value("updated_delivery_status") ?? "in_progress";
  const health = helper.value("updated_health") ?? "amber";
  if (!isValid(status, WORKSTREAM_STATUSES) || !isValid(health, HEALTH_STATUSES)) throw new Error("Invalid progress update values.");
  const payload = {
    programme_id: programmeId,
    workstream_id: helper.value("workstream_id"),
    state_plan_id: helper.value("state_plan_id"),
    lga_plan_id: helper.value("lga_plan_id"),
    cluster_plan_id: helper.value("cluster_plan_id"),
    delivery_item_id: helper.value("delivery_item_id"),
    activity_id: helper.value("activity_id"),
    reporting_period_start: helper.value("reporting_period_start") ?? new Date().toISOString().slice(0, 10),
    reporting_period_end: helper.value("reporting_period_end") ?? new Date().toISOString().slice(0, 10),
    progress_summary: helper.value("progress_summary") ?? "Progress update submitted.",
    progress_percentage: pct(input.formData.get("progress_percentage")),
    updated_delivery_status: status,
    updated_health: health,
    achievements: helper.value("achievements"),
    challenges: helper.value("challenges"),
    support_required: helper.value("support_required"),
    next_steps: helper.value("next_steps"),
    evidence_references: splitList(input.formData.get("evidence_references")),
    review_status: "submitted",
    submitted_by: actorUserId,
    metadata: { source: "lcdbo_delivery_core_sprint2", record_classification: "governed_update" },
  };
  await assertCanSubmitProgressUpdate(input.access, payload);
  const { data, error } = await supabase.from("lcdbo_delivery_progress_updates").insert(payload).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to submit progress update.");
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: "lcdbo.delivery.progress_update.submitted", entityType: "lcdbo_delivery_progress_update", entityId: data.id, scopeType: "programme", scopeId: programmeId, metadata: { review_status: data.review_status, progress_percentage: data.progress_percentage } });
  return data as ProgressUpdate;
}

export async function reviewProgressUpdate(input: { updateId: string; reviewStatus: ProgressReviewStatus; reviewNotes?: string | null; access: LcdboGeographyDeliveryAccess }) {
  if (!["approved", "rejected", "under_review"].includes(input.reviewStatus)) throw new Error("Invalid review status.");
  assertProgrammeManager(input.access, "Only programme officers, institution administrators or platform administrators can review LCDBO geographic progress updates.");
  const { ctx, programme, supabase } = input.access;
  const actorUserId = ctx.appUserId!;
  const programmeId = programme.id;
  const { data: existing, error: lookupError } = await supabase.from("lcdbo_delivery_progress_updates").select("*").eq("id", input.updateId).eq("programme_id", programmeId).single();
  if (lookupError || !existing) throw lookupError ?? new Error("Progress update not found.");
  if (existing.submitted_by === actorUserId && input.reviewStatus === "approved") throw new Error("Submitters cannot approve their own update.");
  const { data, error } = await supabase
    .from("lcdbo_delivery_progress_updates")
    .update({ review_status: input.reviewStatus, review_notes: input.reviewNotes ?? null, reviewed_by: actorUserId, reviewed_at: new Date().toISOString() })
    .eq("id", input.updateId)
    .eq("programme_id", programmeId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Unable to review progress update.");
  if (input.reviewStatus === "approved") await syncApprovedProgressUpdate(data as ProgressUpdate, actorUserId, supabase);
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: `lcdbo.delivery.progress_update.${input.reviewStatus}`, entityType: "lcdbo_delivery_progress_update", entityId: data.id, scopeType: "programme", scopeId: programmeId, metadata: { review_status: input.reviewStatus } });
  return data as ProgressUpdate;
}

async function syncApprovedProgressUpdate(update: ProgressUpdate, actorUserId: string, client: Client) {
  const patch = {
    progress_percentage: update.progress_percentage,
    delivery_status: update.updated_delivery_status,
    delivery_health: update.updated_health,
    latest_update: update.progress_summary,
    updated_by: actorUserId,
  };
  if (update.state_plan_id) await client.from("lcdbo_state_delivery_plans").update(patch).eq("id", update.state_plan_id);
  if (update.lga_plan_id) await client.from("lcdbo_lga_delivery_plans").update(patch).eq("id", update.lga_plan_id);
  if (update.cluster_plan_id) await client.from("lcdbo_cluster_delivery_plans").update(patch).eq("id", update.cluster_plan_id);
  if (update.activity_id) await client.from("lcdbo_delivery_activities").update({ progress_percentage: update.progress_percentage, status: update.updated_delivery_status, latest_update: update.progress_summary, updated_by: actorUserId }).eq("id", update.activity_id);
  if (update.workstream_id) await client.from("lcdbo_workstreams").update({ progress_percentage: update.progress_percentage, status: update.updated_delivery_status, health: update.updated_health, latest_update: update.progress_summary, updated_by: actorUserId }).eq("id", update.workstream_id);
  if (update.delivery_item_id) await client.from("lcdbo_delivery_items").update({ progress_percentage: update.progress_percentage, status: update.updated_delivery_status, latest_update: update.progress_summary, updated_by: actorUserId }).eq("id", update.delivery_item_id);
}

export async function getMyLcdboDeliveryWork(input: { access: LcdboGeographyDeliveryAccess | LcdboDeliveryAccess }) {
  const { ctx, programme, supabase } = input.access;
  const userId = ctx.appUserId;
  if (!userId) return { statePlans: [], lgaPlans: [], clusterPlans: [], activities: [], updatesAwaitingReview: [], overdueActivities: [] };
  const [statePlans, lgaPlans, clusterPlans, activities, updates] = await Promise.all([
    listStateDeliveryPlans({ programmeId: programme.id, client: supabase }),
    listLgaDeliveryPlans({ programmeId: programme.id, client: supabase }),
    listClusterDeliveryPlans({ programmeId: programme.id, client: supabase }),
    listDeliveryActivities({ programmeId: programme.id, client: supabase }),
    listProgressUpdates({ programmeId: programme.id, client: supabase }),
  ]);
  const myStatePlans = statePlans.filter((item) => item.state_coordinator_id === userId);
  const myLgaPlans = lgaPlans.filter((item) => item.lga_delivery_lead_id === userId);
  const myClusterPlans = clusterPlans.filter((item) => item.cluster_manager_id === userId);
  const myStatePlanIds = new Set(myStatePlans.map((item) => item.id));
  const myLgaPlanIds = new Set(myLgaPlans.map((item) => item.id));
  const myClusterPlanIds = new Set(myClusterPlans.map((item) => item.id));
  const childLgaPlans = lgaPlans.filter((item) => myStatePlanIds.has(item.state_plan_id));
  const childLgaPlanIds = new Set(childLgaPlans.map((item) => item.id));
  const childClusterPlans = clusterPlans.filter((item) => myStatePlanIds.has(item.state_plan_id) || (item.lga_plan_id && (myLgaPlanIds.has(item.lga_plan_id) || childLgaPlanIds.has(item.lga_plan_id))));
  const scopedActivities = activities.filter((item) => (
    item.owner_id === userId
    || !!item.state_plan_id && myStatePlanIds.has(item.state_plan_id)
    || !!item.lga_plan_id && myLgaPlanIds.has(item.lga_plan_id)
    || !!item.cluster_plan_id && myClusterPlanIds.has(item.cluster_plan_id)
  ));
  const visibleLgaPlans = [...myLgaPlans, ...childLgaPlans.filter((child) => !myLgaPlanIds.has(child.id))];
  const visibleClusterPlanIds = new Set(myClusterPlans.map((item) => item.id));
  const visibleClusterPlans = [...myClusterPlans, ...childClusterPlans.filter((child) => !visibleClusterPlanIds.has(child.id))];
  const overdueActivities = scopedActivities.filter((item) => item.planned_end_date && new Date(item.planned_end_date) < new Date() && !["completed", "cancelled"].includes(item.status));
  const updatesAwaitingReview = input.access.canManage ? updates.filter((item) => ["submitted", "under_review"].includes(item.review_status) && item.submitted_by !== userId) : [];
  return { statePlans: myStatePlans, lgaPlans: visibleLgaPlans, clusterPlans: visibleClusterPlans, activities: scopedActivities, updatesAwaitingReview, overdueActivities };
}

function csvValue(value: unknown) {
  const raw = String(value ?? "");
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
}

export type LcdboGeographyDeliveryExportDataset = "states" | "lgas" | "clusters" | "activities" | "progress-updates" | "my-work";

export async function exportLcdboGeographyDeliveryData(dataset: LcdboGeographyDeliveryExportDataset, access: LcdboDeliveryAccess) {
  const { programme, supabase, ctx } = access;
  let rows: unknown[][] = [];
  if (dataset === "states") {
    const plans = await listStateDeliveryPlans({ programmeId: programme.id, client: supabase });
    rows = [["Reference", "State", "Activation", "Approval", "Status", "Health", "Progress", "Reporting completeness", "Coordinator", "Classification"], ...plans.map((item) => [item.plan_reference, item.state?.name, item.activation_status, item.approval_status, item.delivery_status, item.delivery_health, item.progress_percentage, item.reporting_completeness, item.coordinator?.full_name ?? item.coordinator?.email, classificationLabel(item.metadata)])];
  } else if (dataset === "lgas") {
    const plans = await listLgaDeliveryPlans({ programmeId: programme.id, client: supabase });
    rows = [["Reference", "State", "LGA", "Activation", "Approval", "Status", "Health", "Progress", "Lead", "Classification"], ...plans.map((item) => [item.plan_reference, item.state?.name, item.lga?.name, item.activation_status, item.approval_status, item.delivery_status, item.delivery_health, item.progress_percentage, item.lead?.full_name ?? item.lead?.email, classificationLabel(item.metadata)])];
  } else if (dataset === "clusters") {
    const plans = await listClusterDeliveryPlans({ programmeId: programme.id, client: supabase });
    rows = [["Reference", "State", "LGA", "Cluster", "Activation", "Approval", "Status", "Health", "Progress", "Live members", "Configured capacity", "Classification"], ...plans.map((item) => [item.plan_reference, item.state?.name, item.lga?.name, item.cluster?.name, item.activation_status, item.approval_status, item.delivery_status, item.delivery_health, item.progress_percentage, item.liveMembershipCount ?? 0, item.target_business_capacity, classificationLabel(item.metadata)])];
  } else if (dataset === "activities") {
    const activities = await listDeliveryActivities({ programmeId: programme.id, client: supabase });
    rows = [["Reference", "Activity", "Type", "Status", "Priority", "Progress", "Owner", "Planned end", "Scope", "Classification"], ...activities.map((item) => [item.reference, item.title, item.activity_type, item.status, item.priority, item.progress_percentage, item.owner?.full_name ?? item.owner?.email, item.planned_end_date, item.clusterPlan?.title ?? item.lgaPlan?.title ?? item.statePlan?.title, classificationLabel(item.metadata)])];
  } else if (dataset === "progress-updates") {
    const updates = await listProgressUpdates({ programmeId: programme.id, client: supabase });
    rows = [["Submitted", "Period start", "Period end", "Progress", "Health", "Review", "Submitter", "Summary"], ...updates.map((item) => [item.submitted_at, item.reporting_period_start, item.reporting_period_end, item.progress_percentage, item.updated_health, item.review_status, item.submitter?.full_name ?? item.submitter?.email, item.progress_summary])];
  } else {
    const work = await getMyLcdboDeliveryWork({ access });
    rows = [["Type", "Reference", "Title", "Status", "Health/Priority", "Due/Updated"], ...work.statePlans.map((item) => ["State plan", item.plan_reference, item.title, item.delivery_status, item.delivery_health, item.updated_at]), ...work.lgaPlans.map((item) => ["LGA plan", item.plan_reference, item.title, item.delivery_status, item.delivery_health, item.updated_at]), ...work.clusterPlans.map((item) => ["Cluster plan", item.plan_reference, item.title, item.delivery_status, item.delivery_health, item.updated_at]), ...work.activities.map((item) => ["Activity", item.reference, item.title, item.status, item.priority, item.planned_end_date])];
  }
  await recordTrustedLcdboDeliveryEvent({ actorUserId: ctx.appUserId!, eventType: "lcdbo.delivery.geographic_export.generated", entityType: "lcdbo_geographic_delivery_export", scopeType: "programme", scopeId: programme.id, metadata: { dataset, row_count: Math.max(0, rows.length - 1) } });
  return { csv: csv(rows), filename: `lcdbo-geographic-delivery-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`, rowCount: Math.max(0, rows.length - 1) };
}
