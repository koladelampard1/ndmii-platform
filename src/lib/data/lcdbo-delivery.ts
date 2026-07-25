import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlatformAdmin, type UserContext } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { getCurrentUserContext } from "@/lib/auth/session";
import { recordPlatformEvent } from "@/lib/data/platform-foundation";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { Institution, JsonRecord, Programme } from "@/types/platform";

type Client = SupabaseClient<any>;

export const LCDBO_DELIVERY_TABLES = [
  "lcdbo_workstreams",
  "lcdbo_delivery_items",
  "lcdbo_raid_items",
  "lcdbo_decisions",
] as const;

export const WORKSTREAM_STATUSES = ["not_started", "planned", "in_progress", "at_risk", "blocked", "completed", "paused", "cancelled"] as const;
export const DELIVERY_ITEM_STATUSES = ["not_started", "planned", "in_progress", "at_risk", "blocked", "submitted", "completed", "cancelled"] as const;
export const RAID_STATUSES = ["open", "monitoring", "mitigating", "blocked", "resolved", "closed", "cancelled"] as const;
export const DECISION_STATUSES = ["draft", "pending", "escalated", "decided", "deferred", "cancelled"] as const;
export const DELIVERY_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const HEALTH_STATUSES = ["green", "amber", "red", "grey"] as const;
export const RAID_TYPES = ["risk", "issue", "assumption", "dependency"] as const;
export const RAID_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const RAID_ESCALATION_STATUSES = ["none", "watch", "escalated", "leadership"] as const;

export type WorkstreamStatus = typeof WORKSTREAM_STATUSES[number];
export type DeliveryItemStatus = typeof DELIVERY_ITEM_STATUSES[number];
export type RaidStatus = typeof RAID_STATUSES[number];
export type DecisionStatus = typeof DECISION_STATUSES[number];
export type DeliveryPriority = typeof DELIVERY_PRIORITIES[number];
export type HealthStatus = typeof HEALTH_STATUSES[number];
export type RaidType = typeof RAID_TYPES[number];
export type RaidSeverity = typeof RAID_SEVERITIES[number];

export type LcdboDeliveryUser = { id: string; full_name: string | null; email: string | null; role: string | null };

export type LcdboWorkstream = {
  id: string;
  programme_id: string;
  reference: string;
  name: string;
  description: string | null;
  accountable_owner_id: string | null;
  delivery_lead_id: string | null;
  accountable_institution_id: string | null;
  supporting_institution_ids: string[];
  start_date: string | null;
  target_date: string | null;
  status: WorkstreamStatus;
  progress_percentage: number;
  health: HealthStatus;
  priority: DeliveryPriority;
  latest_update: string | null;
  metadata: JsonRecord;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  accountableOwner?: LcdboDeliveryUser | null;
  deliveryLead?: LcdboDeliveryUser | null;
  accountableInstitution?: Pick<Institution, "id" | "name" | "slug" | "institution_type"> | null;
};

export type LcdboDeliveryItem = {
  id: string;
  programme_id: string;
  workstream_id: string | null;
  parent_delivery_item_id?: string | null;
  delivery_scope_type?: string;
  state_plan_id?: string | null;
  lga_plan_id?: string | null;
  cluster_plan_id?: string | null;
  reference: string;
  item_type: "milestone" | "deliverable";
  title: string;
  description: string | null;
  owner_id: string | null;
  supporting_institution_id: string | null;
  state_id: string | null;
  lga_id: string | null;
  start_date: string | null;
  due_date: string | null;
  priority: DeliveryPriority;
  status: DeliveryItemStatus;
  progress_percentage: number;
  evidence_requirement: string | null;
  approval_required: boolean;
  completed_at: string | null;
  blocker_reason: string | null;
  latest_update: string | null;
  metadata: JsonRecord;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  workstream?: Pick<LcdboWorkstream, "id" | "reference" | "name" | "health"> | null;
  owner?: LcdboDeliveryUser | null;
};

export type LcdboRaidItem = {
  id: string;
  programme_id: string;
  workstream_id: string | null;
  delivery_item_id: string | null;
  delivery_scope_type?: string;
  state_plan_id?: string | null;
  lga_plan_id?: string | null;
  cluster_plan_id?: string | null;
  reference: string;
  raid_type: RaidType;
  title: string;
  description: string;
  owner_id: string | null;
  probability: "low" | "medium" | "high" | null;
  impact: "low" | "medium" | "high" | null;
  severity: RaidSeverity;
  mitigation_plan: string | null;
  target_resolution_date: string | null;
  escalation_status: "none" | "watch" | "escalated" | "leadership";
  status: RaidStatus;
  resolution_notes: string | null;
  review_date: string | null;
  metadata: JsonRecord;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  workstream?: Pick<LcdboWorkstream, "id" | "reference" | "name" | "health"> | null;
  owner?: LcdboDeliveryUser | null;
};

export type LcdboDecision = {
  id: string;
  programme_id: string;
  workstream_id: string | null;
  delivery_item_id: string | null;
  reference: string;
  decision_required: string;
  context: string | null;
  recommendation: string | null;
  decision_owner_id: string | null;
  due_date: string | null;
  status: DecisionStatus;
  decision_outcome: string | null;
  decision_date: string | null;
  follow_up_action: string | null;
  follow_up_owner_id: string | null;
  metadata: JsonRecord;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  workstream?: Pick<LcdboWorkstream, "id" | "reference" | "name" | "health"> | null;
  decisionOwner?: LcdboDeliveryUser | null;
  followUpOwner?: LcdboDeliveryUser | null;
};

export type DeliveryAccessMode = "view" | "manage" | "assign" | "export";

export type LcdboDeliveryAccess = {
  ctx: UserContext;
  programme: Programme;
  supabase: Client;
  canManage: boolean;
  canAssign: boolean;
  canExport: boolean;
  roles: string[];
};

const GEOGRAPHIC_DELIVERY_ROLES = ["state_coordinator", "lga_coordinator", "cluster_manager"] as const;
const VIEW_ROLES = ["programme_officer", "assessment_officer", "field_officer", "data_analyst", "auditor", "observer", "admin", "super_admin", "institution_admin", ...GEOGRAPHIC_DELIVERY_ROLES] as const;
const MANAGE_ROLES = ["programme_officer", "admin", "super_admin", "institution_admin"] as const;
const EXPORT_ROLES = ["programme_officer", "data_analyst", "auditor", "admin", "super_admin", "institution_admin"] as const;

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isMissingDeliverySchema(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  const code = candidate?.code ?? "";
  const message = candidate?.message ?? "";
  return ["42P01", "PGRST200", "PGRST205"].includes(code) || /lcdbo_(workstreams|delivery_items|raid_items|decisions).*does not exist|could not find .*lcdbo_(workstreams|delivery_items|raid_items|decisions)/i.test(message);
}

export function isLcdboDeliverySchemaUnavailable(error: unknown) {
  return isMissingDeliverySchema(error);
}

async function clientOrService(client?: Client) {
  return client ?? await createServiceRoleSupabaseClient();
}

export async function requireLcdboDeliveryAccess(mode: DeliveryAccessMode = "view", client?: Client): Promise<LcdboDeliveryAccess> {
  const ctx = await getCurrentUserContext();
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme || !ctx.appUserId) throw new Error("LCDBO delivery access is unavailable.");
  const roles = mode === "manage" || mode === "assign" ? MANAGE_ROLES : mode === "export" ? EXPORT_ROLES : VIEW_ROLES;
  const permission = await canUseWorkspaceModule({
    ctx,
    moduleKey: LCDBO_MODULE_KEY,
    allowedRoles: roles,
    scopeType: "programme",
    scopeId: programme.id,
    programmeId: programme.id,
    institutionId: programme.owning_institution_id,
  }).catch(() => ({ allowed: false, roles: [] as string[], source: "denied" as const, module: { allowed: false, status: null, source: "missing" as const } }));
  const canManage = isPlatformAdmin(ctx.role) || permission.allowed && (MANAGE_ROLES as readonly string[]).some((role) => permission.roles.includes(role));
  const canExport = canManage || permission.allowed && (EXPORT_ROLES as readonly string[]).some((role) => permission.roles.includes(role));
  const canView = canManage || canExport || permission.allowed;
  if ((mode === "view" && !canView) || (mode === "export" && !canExport) || ((mode === "manage" || mode === "assign") && !canManage)) {
    throw new Error("You do not have permission to use LCDBO programme delivery.");
  }
  return { ctx, programme, supabase, canManage, canAssign: canManage, canExport, roles: permission.roles };
}

function statusHealth(status: WorkstreamStatus | DeliveryItemStatus, progress: number, dueDate?: string | null): HealthStatus {
  if (status === "completed") return "green";
  if (status === "blocked" || status === "cancelled") return "red";
  if (status === "at_risk") return "amber";
  if (dueDate && new Date(dueDate) < new Date()) return "red";
  if (progress >= 70) return "green";
  if (progress <= 10 && status === "not_started") return "grey";
  return "amber";
}

function deliveryClassification(metadata: JsonRecord | null | undefined) {
  const classification = typeof metadata?.record_classification === "string" ? metadata.record_classification : "live_operational";
  return classification === "configured_target" ? "Configured target" : "Live operational";
}

function normaliseReference(prefix: string, currentCount: number) {
  return `${prefix}-${String(currentCount + 1).padStart(3, "0")}`;
}

function isValid<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return (allowed as readonly string[]).includes(value);
}

function pct(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function deliveryInput(formData: FormData) {
  return {
    text: optionalText,
    pct,
    bool(name: string) {
      return formData.get(name) === "on" || formData.get(name) === "true";
    },
    value(name: string) {
      return optionalText(formData.get(name));
    },
  };
}

export async function getLcdboDeliverySnapshot(client?: Client) {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) return { programme: null, unavailable: false, workstreams: [], items: [], raids: [], decisions: [], metrics: emptyMetrics() };
  try {
    const [workstreams, items, raids, decisions] = await Promise.all([
      listLcdboWorkstreams({ programmeId: programme.id, client: supabase }),
      listLcdboDeliveryItems({ programmeId: programme.id, client: supabase }),
      listLcdboRaidItems({ programmeId: programme.id, client: supabase }),
      listLcdboDecisions({ programmeId: programme.id, client: supabase }),
    ]);
    return { programme, unavailable: false, workstreams, items, raids, decisions, metrics: calculateDeliveryMetrics(workstreams, items, raids, decisions) };
  } catch (error) {
    if (isMissingDeliverySchema(error)) return { programme, unavailable: true, workstreams: [], items: [], raids: [], decisions: [], metrics: emptyMetrics() };
    throw error;
  }
}

function emptyMetrics() {
  return {
    governedProgress: 0,
    workstreamCount: 0,
    activeWorkstreams: 0,
    redWorkstreams: 0,
    dueSoon: 0,
    overdueItems: 0,
    criticalRaids: 0,
    pendingDecisions: 0,
    latestUpdate: null as string | null,
  };
}

export function calculateDeliveryMetrics(workstreams: LcdboWorkstream[], items: LcdboDeliveryItem[], raids: LcdboRaidItem[], decisions: LcdboDecision[]) {
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);
  const activeItems = items.filter((item) => item.status !== "cancelled");
  const governedProgress = activeItems.length
    ? Math.round(activeItems.reduce((sum, item) => sum + item.progress_percentage, 0) / activeItems.length)
    : workstreams.length
      ? Math.round(workstreams.reduce((sum, item) => sum + item.progress_percentage, 0) / workstreams.length)
      : 0;
  const latestUpdate = [...workstreams.map((item) => item.updated_at), ...items.map((item) => item.updated_at), ...raids.map((item) => item.updated_at), ...decisions.map((item) => item.updated_at)].sort().at(-1) ?? null;
  return {
    governedProgress,
    workstreamCount: workstreams.length,
    activeWorkstreams: workstreams.filter((item) => ["planned", "in_progress", "at_risk", "blocked"].includes(item.status)).length,
    redWorkstreams: workstreams.filter((item) => item.health === "red").length,
    dueSoon: items.filter((item) => item.due_date && new Date(item.due_date) >= now && new Date(item.due_date) <= soon && item.status !== "completed").length,
    overdueItems: items.filter((item) => item.due_date && new Date(item.due_date) < now && !["completed", "cancelled"].includes(item.status)).length,
    criticalRaids: raids.filter((item) => item.severity === "critical" && !["resolved", "closed", "cancelled"].includes(item.status)).length,
    pendingDecisions: decisions.filter((item) => ["pending", "escalated"].includes(item.status)).length,
    latestUpdate,
  };
}

export async function listLcdboWorkstreams(input: { programmeId: string; query?: string; status?: string; health?: string; priority?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_workstreams")
    .select("*,accountableOwner:users!lcdbo_workstreams_accountable_owner_id_fkey(id,full_name,email,role),deliveryLead:users!lcdbo_workstreams_delivery_lead_id_fkey(id,full_name,email,role),accountableInstitution:institutions!lcdbo_workstreams_accountable_institution_id_fkey(id,name,slug,institution_type)")
    .eq("programme_id", input.programmeId)
    .order("reference", { ascending: true });
  if (input.query) query = query.or(`name.ilike.%${input.query}%,reference.ilike.%${input.query}%`);
  if (input.status && isValid(input.status, WORKSTREAM_STATUSES)) query = query.eq("status", input.status);
  if (input.health && isValid(input.health, HEALTH_STATUSES)) query = query.eq("health", input.health);
  if (input.priority && isValid(input.priority, DELIVERY_PRIORITIES)) query = query.eq("priority", input.priority);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, accountableOwner: one(row.accountableOwner), deliveryLead: one(row.deliveryLead), accountableInstitution: one(row.accountableInstitution) })) as LcdboWorkstream[];
}

export async function listLcdboDeliveryItems(input: { programmeId: string; workstreamId?: string; itemType?: "milestone" | "deliverable"; status?: string; priority?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_delivery_items")
    .select("*,workstream:lcdbo_workstreams(id,reference,name,health),owner:users!lcdbo_delivery_items_owner_id_fkey(id,full_name,email,role)")
    .eq("programme_id", input.programmeId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (input.workstreamId) query = query.eq("workstream_id", input.workstreamId);
  if (input.itemType) query = query.eq("item_type", input.itemType);
  if (input.status && isValid(input.status, DELIVERY_ITEM_STATUSES)) query = query.eq("status", input.status);
  if (input.priority && isValid(input.priority, DELIVERY_PRIORITIES)) query = query.eq("priority", input.priority);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, workstream: one(row.workstream), owner: one(row.owner) })) as LcdboDeliveryItem[];
}

export async function listLcdboRaidItems(input: { programmeId: string; type?: string; status?: string; severity?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_raid_items")
    .select("*,workstream:lcdbo_workstreams(id,reference,name,health),owner:users!lcdbo_raid_items_owner_id_fkey(id,full_name,email,role)")
    .eq("programme_id", input.programmeId)
    .order("updated_at", { ascending: false });
  if (input.type && isValid(input.type, RAID_TYPES)) query = query.eq("raid_type", input.type);
  if (input.status && isValid(input.status, RAID_STATUSES)) query = query.eq("status", input.status);
  if (input.severity && isValid(input.severity, RAID_SEVERITIES)) query = query.eq("severity", input.severity);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, workstream: one(row.workstream), owner: one(row.owner) })) as LcdboRaidItem[];
}

export async function listLcdboDecisions(input: { programmeId: string; status?: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  let query = supabase
    .from("lcdbo_decisions")
    .select("*,workstream:lcdbo_workstreams(id,reference,name,health),decisionOwner:users!lcdbo_decisions_decision_owner_id_fkey(id,full_name,email,role),followUpOwner:users!lcdbo_decisions_follow_up_owner_id_fkey(id,full_name,email,role)")
    .eq("programme_id", input.programmeId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (input.status && isValid(input.status, DECISION_STATUSES)) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, workstream: one(row.workstream), decisionOwner: one(row.decisionOwner), followUpOwner: one(row.followUpOwner) })) as LcdboDecision[];
}

export async function listLcdboDeliveryUsers(client?: Client) {
  const supabase = await clientOrService(client);
  const { data, error } = await supabase
    .from("users")
    .select("id,full_name,email,role")
    .in("role", ["programme_officer", "assessment_officer", "field_officer", "data_analyst", "auditor", "admin", "super_admin"])
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as LcdboDeliveryUser[];
}

export async function listLcdboDeliveryInstitutions(client?: Client) {
  const supabase = await clientOrService(client);
  const { data, error } = await supabase.from("institutions").select("id,name,slug,institution_type").eq("status", "active").order("name");
  if (error) throw error;
  return (data ?? []) as Pick<Institution, "id" | "name" | "slug" | "institution_type">[];
}

export async function createOrUpdateWorkstream(input: { formData: FormData; actorUserId: string; programmeId: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  const helper = deliveryInput(input.formData);
  const id = helper.value("id");
  const status = helper.value("status") ?? "planned";
  const priority = helper.value("priority") ?? "medium";
  const progress = pct(input.formData.get("progress_percentage"));
  if (!isValid(status, WORKSTREAM_STATUSES) || !isValid(priority, DELIVERY_PRIORITIES)) throw new Error("Invalid workstream status or priority.");
  const { count } = await supabase.from("lcdbo_workstreams").select("id", { count: "exact", head: true }).eq("programme_id", input.programmeId);
  const payload = {
    programme_id: input.programmeId,
    reference: helper.value("reference") ?? normaliseReference("LCDBO-WS", count ?? 0),
    name: helper.value("name") ?? "Untitled workstream",
    description: helper.value("description"),
    accountable_owner_id: helper.value("accountable_owner_id"),
    delivery_lead_id: helper.value("delivery_lead_id"),
    accountable_institution_id: helper.value("accountable_institution_id"),
    start_date: helper.value("start_date"),
    target_date: helper.value("target_date"),
    status,
    progress_percentage: progress,
    health: statusHealth(status, progress, helper.value("target_date")),
    priority,
    latest_update: helper.value("latest_update"),
    metadata: { source: "lcdbo_delivery_core_sprint1", record_classification: "live_operational" },
    updated_by: input.actorUserId,
    ...(!id ? { created_by: input.actorUserId } : {}),
  };
  const query = id ? supabase.from("lcdbo_workstreams").update(payload).eq("id", id).eq("programme_id", input.programmeId) : supabase.from("lcdbo_workstreams").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save workstream.");
  await recordPlatformEvent({ actorUserId: input.actorUserId, eventType: id ? "lcdbo.delivery.workstream.updated" : "lcdbo.delivery.workstream.created", entityType: "lcdbo_workstream", entityId: data.id, scopeType: "programme", scopeId: input.programmeId, metadata: { reference: data.reference, status: data.status, progress_percentage: data.progress_percentage }, client: supabase });
  return data as LcdboWorkstream;
}

export async function createOrUpdateDeliveryItem(input: { formData: FormData; actorUserId: string; programmeId: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  const helper = deliveryInput(input.formData);
  const id = helper.value("id");
  const itemType = helper.value("item_type") ?? "milestone";
  const status = helper.value("status") ?? "planned";
  const priority = helper.value("priority") ?? "medium";
  if (!["milestone", "deliverable"].includes(itemType) || !isValid(status, DELIVERY_ITEM_STATUSES) || !isValid(priority, DELIVERY_PRIORITIES)) throw new Error("Invalid delivery item values.");
  const progress = status === "completed" ? 100 : pct(input.formData.get("progress_percentage"));
  const { count } = await supabase.from("lcdbo_delivery_items").select("id", { count: "exact", head: true }).eq("programme_id", input.programmeId);
  const payload = {
    programme_id: input.programmeId,
    workstream_id: helper.value("workstream_id"),
    parent_delivery_item_id: helper.value("parent_delivery_item_id"),
    delivery_scope_type: helper.value("delivery_scope_type") ?? "national",
    state_plan_id: helper.value("state_plan_id"),
    lga_plan_id: helper.value("lga_plan_id"),
    cluster_plan_id: helper.value("cluster_plan_id"),
    reference: helper.value("reference") ?? normaliseReference(itemType === "milestone" ? "LCDBO-MS" : "LCDBO-DL", count ?? 0),
    item_type: itemType as "milestone" | "deliverable",
    title: helper.value("title") ?? "Untitled delivery item",
    description: helper.value("description"),
    owner_id: helper.value("owner_id"),
    supporting_institution_id: helper.value("supporting_institution_id"),
    start_date: helper.value("start_date"),
    due_date: helper.value("due_date"),
    priority,
    status,
    progress_percentage: progress,
    evidence_requirement: helper.value("evidence_requirement"),
    approval_required: helper.bool("approval_required"),
    completed_at: status === "completed" ? new Date().toISOString() : null,
    blocker_reason: helper.value("blocker_reason"),
    latest_update: helper.value("latest_update"),
    metadata: { source: "lcdbo_delivery_core_sprint1", record_classification: "live_operational" },
    updated_by: input.actorUserId,
    ...(!id ? { created_by: input.actorUserId } : {}),
  };
  const query = id ? supabase.from("lcdbo_delivery_items").update(payload).eq("id", id).eq("programme_id", input.programmeId) : supabase.from("lcdbo_delivery_items").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save milestone or deliverable.");
  await recordPlatformEvent({ actorUserId: input.actorUserId, eventType: id ? "lcdbo.delivery.item.updated" : "lcdbo.delivery.item.created", entityType: "lcdbo_delivery_item", entityId: data.id, scopeType: "programme", scopeId: input.programmeId, metadata: { reference: data.reference, item_type: data.item_type, status: data.status }, client: supabase });
  return data as LcdboDeliveryItem;
}

export async function createOrUpdateRaidItem(input: { formData: FormData; actorUserId: string; programmeId: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  const helper = deliveryInput(input.formData);
  const id = helper.value("id");
  const raidType = helper.value("raid_type") ?? "risk";
  const status = helper.value("status") ?? "open";
  const severity = helper.value("severity") ?? "medium";
  const escalation = helper.value("escalation_status") ?? "none";
  if (!isValid(raidType, RAID_TYPES) || !isValid(status, RAID_STATUSES) || !isValid(severity, RAID_SEVERITIES) || !isValid(escalation, RAID_ESCALATION_STATUSES)) throw new Error("Invalid RAID values.");
  const resolutionNotes = helper.value("resolution_notes");
  if (["resolved", "closed"].includes(status) && !resolutionNotes) throw new Error("Resolution notes are required before closing a RAID item.");
  const { count } = await supabase.from("lcdbo_raid_items").select("id", { count: "exact", head: true }).eq("programme_id", input.programmeId);
  const payload = {
    programme_id: input.programmeId,
    workstream_id: helper.value("workstream_id"),
    reference: helper.value("reference") ?? normaliseReference("LCDBO-RAID", count ?? 0),
    raid_type: raidType,
    delivery_scope_type: helper.value("delivery_scope_type") ?? "national",
    state_plan_id: helper.value("state_plan_id"),
    lga_plan_id: helper.value("lga_plan_id"),
    cluster_plan_id: helper.value("cluster_plan_id"),
    title: helper.value("title") ?? "Untitled RAID item",
    description: helper.value("description") ?? "No description provided.",
    owner_id: helper.value("owner_id"),
    probability: helper.value("probability"),
    impact: helper.value("impact"),
    severity,
    mitigation_plan: helper.value("mitigation_plan"),
    target_resolution_date: helper.value("target_resolution_date"),
    escalation_status: escalation,
    status,
    resolution_notes: resolutionNotes,
    review_date: helper.value("review_date"),
    metadata: { source: "lcdbo_delivery_core_sprint1", record_classification: "live_operational" },
    updated_by: input.actorUserId,
    ...(!id ? { created_by: input.actorUserId } : {}),
  };
  const query = id ? supabase.from("lcdbo_raid_items").update(payload).eq("id", id).eq("programme_id", input.programmeId) : supabase.from("lcdbo_raid_items").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save RAID item.");
  await recordPlatformEvent({ actorUserId: input.actorUserId, eventType: id ? "lcdbo.delivery.raid.updated" : "lcdbo.delivery.raid.created", entityType: "lcdbo_raid_item", entityId: data.id, scopeType: "programme", scopeId: input.programmeId, metadata: { reference: data.reference, raid_type: data.raid_type, status: data.status, severity: data.severity, escalation_status: data.escalation_status }, client: supabase });
  return data as LcdboRaidItem;
}

export async function createOrUpdateDecision(input: { formData: FormData; actorUserId: string; programmeId: string; client?: Client }) {
  const supabase = await clientOrService(input.client);
  const helper = deliveryInput(input.formData);
  const id = helper.value("id");
  const status = helper.value("status") ?? "pending";
  if (!isValid(status, DECISION_STATUSES)) throw new Error("Invalid decision status.");
  const outcome = helper.value("decision_outcome");
  const decisionDate = helper.value("decision_date");
  if (status === "decided" && (!outcome || !decisionDate)) throw new Error("Decision outcome and decision date are required.");
  const { count } = await supabase.from("lcdbo_decisions").select("id", { count: "exact", head: true }).eq("programme_id", input.programmeId);
  const payload = {
    programme_id: input.programmeId,
    workstream_id: helper.value("workstream_id"),
    delivery_item_id: helper.value("delivery_item_id"),
    reference: helper.value("reference") ?? normaliseReference("LCDBO-DEC", count ?? 0),
    decision_required: helper.value("decision_required") ?? "Decision required",
    context: helper.value("context"),
    recommendation: helper.value("recommendation"),
    decision_owner_id: helper.value("decision_owner_id"),
    due_date: helper.value("due_date"),
    status,
    decision_outcome: outcome,
    decision_date: decisionDate,
    follow_up_action: helper.value("follow_up_action"),
    follow_up_owner_id: helper.value("follow_up_owner_id"),
    metadata: { source: "lcdbo_delivery_core_sprint1", record_classification: "live_operational" },
    updated_by: input.actorUserId,
    ...(!id ? { created_by: input.actorUserId } : {}),
  };
  const query = id ? supabase.from("lcdbo_decisions").update(payload).eq("id", id).eq("programme_id", input.programmeId) : supabase.from("lcdbo_decisions").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save decision.");
  await recordPlatformEvent({ actorUserId: input.actorUserId, eventType: status === "decided" ? "lcdbo.delivery.decision.completed" : id ? "lcdbo.delivery.decision.updated" : "lcdbo.delivery.decision.created", entityType: "lcdbo_decision", entityId: data.id, scopeType: "programme", scopeId: input.programmeId, metadata: { reference: data.reference, status: data.status }, client: supabase });
  return data as LcdboDecision;
}

function csvValue(value: unknown) {
  const raw = String(value ?? "");
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
}

export type LcdboDeliveryExportDataset = "workstreams" | "milestones" | "raid" | "decisions";

export async function exportLcdboDeliveryData(dataset: LcdboDeliveryExportDataset, actorUserId: string, client?: Client) {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  if (!programme) throw new Error("LCDBO programme is not configured.");
  let rows: unknown[][] = [];
  if (dataset === "workstreams") {
    const workstreams = await listLcdboWorkstreams({ programmeId: programme.id, client: supabase });
    rows = [["Reference", "Workstream", "Status", "Health", "Priority", "Progress", "Target date", "Classification", "Latest update"], ...workstreams.map((item) => [item.reference, item.name, item.status, item.health, item.priority, item.progress_percentage, item.target_date, deliveryClassification(item.metadata), item.latest_update])];
  } else if (dataset === "milestones") {
    const items = await listLcdboDeliveryItems({ programmeId: programme.id, client: supabase });
    rows = [["Reference", "Type", "Title", "Workstream", "Scope", "Status", "Priority", "Progress", "Due date", "Evidence required", "Latest update"], ...items.map((item) => [item.reference, item.item_type, item.title, item.workstream?.name, item.delivery_scope_type ?? "national", item.status, item.priority, item.progress_percentage, item.due_date, item.evidence_requirement, item.latest_update])];
  } else if (dataset === "raid") {
    const raids = await listLcdboRaidItems({ programmeId: programme.id, client: supabase });
    rows = [["Reference", "Type", "Title", "Workstream", "Scope", "Status", "Severity", "Escalation", "Review date", "Target resolution", "Mitigation"], ...raids.map((item) => [item.reference, item.raid_type, item.title, item.workstream?.name, item.delivery_scope_type ?? "national", item.status, item.severity, item.escalation_status, item.review_date, item.target_resolution_date, item.mitigation_plan])];
  } else {
    const decisions = await listLcdboDecisions({ programmeId: programme.id, client: supabase });
    rows = [["Reference", "Decision required", "Workstream", "Status", "Owner", "Due date", "Decision date", "Outcome", "Follow-up"], ...decisions.map((item) => [item.reference, item.decision_required, item.workstream?.name, item.status, item.decisionOwner?.full_name ?? item.decisionOwner?.email, item.due_date, item.decision_date, item.decision_outcome, item.follow_up_action])];
  }
  await recordPlatformEvent({ actorUserId, eventType: "lcdbo.delivery.export.generated", entityType: "lcdbo_delivery_export", scopeType: "programme", scopeId: programme.id, metadata: { dataset, row_count: Math.max(0, rows.length - 1) }, client: supabase });
  return { csv: csv(rows), filename: `lcdbo-delivery-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`, rowCount: Math.max(0, rows.length - 1) };
}
