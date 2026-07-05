import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlatformAdmin, type UserContext } from "@/lib/auth/authorization";
import {
  PROPERTY_OPERATION_ROLES,
  PROPERTY_SCOPED_ROLES,
  generatePropertyCaseReference,
  generatePropertyNpin,
  recordPropertyEvent,
} from "@/lib/data/property-foundation";
import { resolveEffectiveRoles } from "@/lib/data/platform-foundation";
import type { JsonRecord } from "@/types/platform";
import type {
  Property,
  PropertyAddress,
  PropertyCaseAssignment,
  PropertyCaseComment,
  PropertyCertificate,
  PropertyDocument,
  PropertyIdentityCredential,
  PropertyOwner,
  PropertyRegistryCase,
  PropertyRegistryCaseStatus,
  PropertyScopedRole,
} from "@/types/property";

type Client = SupabaseClient<any>;

export type PropertyOperationsAccess = {
  allowed: boolean;
  canMutate: boolean;
  roles: string[];
};

export type PropertyCaseAccessMode = "view" | "operate" | "override";

export type PropertyCaseAccessResult = {
  canViewCase: boolean;
  canOperateCase: boolean;
  canOverrideCase: boolean;
  source: "platform_admin" | "property_admin" | "scoped_role" | "assigned_officer" | "denied";
  registryCase: PropertyRegistryCase;
  property: Property;
};

export type PropertyCaseListItem = PropertyRegistryCase & {
  property: Property | null;
  assignedUser?: { id: string; full_name: string | null; email: string | null; role: string | null } | null;
};

export type PropertyCaseDetail = PropertyRegistryCase & {
  property: Property;
  addresses: PropertyAddress[];
  owners: PropertyOwner[];
  documents: PropertyDocument[];
  assignments: PropertyCaseAssignment[];
  comments: PropertyCaseComment[];
  events: Array<{ id: string; event_type: string; summary: string | null; metadata: JsonRecord; created_at: string; entity_type: string; entity_id: string | null }>;
  statusHistory: Array<{ id: string; previous_status: string | null; new_status: string; change_reason: string | null; created_at: string; metadata: JsonRecord }>;
  credentials: PropertyIdentityCredential[];
  certificates: PropertyCertificate[];
};

export const CASE_COMPLETE_STATUSES = new Set<PropertyRegistryCaseStatus>(["approved", "rejected", "cancelled", "verified"]);
export const CASE_TERMINAL_STATUSES = new Set<PropertyRegistryCaseStatus>(["rejected", "cancelled", "verified"]);
export const CASE_LOCKED_BY_CREDENTIAL_STATUSES = new Set<PropertyRegistryCaseStatus>(["rejected", "returned", "cancelled"]);
export const REVIEWABLE_DOCUMENT_STATUSES = new Set<PropertyDocument["status"]>(["pending_review"]);
export const CERTIFICATE_ACTIVE_STATUSES = new Set<PropertyCertificate["status"]>(["generated"]);
export const CASE_TRANSITIONS: Record<PropertyRegistryCaseStatus, readonly PropertyRegistryCaseStatus[]> = {
  submitted: ["under_review", "awaiting_documents", "awaiting_survey", "awaiting_ownership", "approved", "rejected", "returned", "suspended", "cancelled", "verified"],
  under_review: ["awaiting_documents", "awaiting_survey", "awaiting_ownership", "approved", "rejected", "returned", "suspended", "cancelled", "verified"],
  awaiting_documents: ["under_review", "approved", "rejected", "returned", "suspended", "cancelled", "verified"],
  awaiting_survey: ["under_review", "approved", "rejected", "returned", "suspended", "cancelled", "verified"],
  awaiting_ownership: ["under_review", "approved", "rejected", "returned", "suspended", "cancelled", "verified"],
  returned: ["under_review", "cancelled"],
  suspended: ["under_review", "cancelled"],
  approved: ["verified", "suspended"],
  rejected: ["under_review"],
  cancelled: ["under_review"],
  verified: [],
};
const PROPERTY_DECISION_EVENT: Record<string, string> = {
  approved: "property.review.approved",
  rejected: "property.review.rejected",
  returned: "property.review.returned",
  suspended: "property.review.suspended",
  cancelled: "property.review.cancelled",
  under_review: "property.review.started",
  awaiting_documents: "property.review.documents_requested",
  awaiting_survey: "property.review.survey_requested",
  awaiting_ownership: "property.review.ownership_requested",
  verified: "property.review.verified",
};
const PROPERTY_OPERATION_ROLE_SET = new Set<string>(PROPERTY_OPERATION_ROLES);

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullable(value: string) {
  return value || null;
}

function activeRole(status: string | null | undefined, expiresAt: string | null | undefined) {
  if (status !== "active") return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

function isPropertyAdminRole(role: string | null | undefined) {
  return role === "property_admin";
}

function roleAssignmentMatchesProperty(assignment: {
  role: string | null;
  scope_type: string | null;
  scope_id: string | null;
  institution_id: string | null;
  status: string | null;
  expires_at: string | null;
}, property: Property) {
  if (!activeRole(assignment.status, assignment.expires_at)) return false;
  if (!PROPERTY_SCOPED_ROLES.includes(assignment.role as PropertyScopedRole)) return false;
  if (assignment.scope_type === "global") return true;
  if (assignment.scope_type === "property" && assignment.scope_id === property.id) return true;
  if (assignment.scope_type === "institution" && assignment.scope_id && assignment.scope_id === property.registry_institution_id) return true;
  if (assignment.institution_id && assignment.institution_id === property.registry_institution_id) return true;
  if (assignment.scope_type === "state_registry" && assignment.scope_id && assignment.scope_id === property.state_id) return true;
  if (assignment.scope_type === "lga_registry" && assignment.scope_id && assignment.scope_id === property.lga_id) return true;
  return false;
}

async function listActivePropertyRoleAssignments(input: { userId: string; client: Client }) {
  const { data, error } = await input.client
    .from("role_assignments")
    .select("role,scope_type,scope_id,institution_id,status,expires_at")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .in("role", [...PROPERTY_SCOPED_ROLES]);
  if (error) throw error;
  return data ?? [];
}

export async function resolvePropertyOperationsAccess(input: {
  ctx: UserContext;
  client: Client;
}): Promise<PropertyOperationsAccess> {
  if (!input.ctx.appUserId || input.ctx.role === "public") return { allowed: false, canMutate: false, roles: [input.ctx.role] };
  const { data: module, error: moduleError } = await input.client
    .from("platform_modules")
    .select("id,status")
    .eq("module_key", "property_registry_operations")
    .maybeSingle();
  if (moduleError) throw moduleError;
  if (!module || !["active", "preview"].includes(module.status)) return { allowed: false, canMutate: false, roles: [input.ctx.role] };
  if (isPlatformAdmin(input.ctx.role)) return { allowed: true, canMutate: true, roles: [input.ctx.role] };

  const effective = await resolveEffectiveRoles({
    userId: input.ctx.appUserId,
    globalRole: input.ctx.role,
    client: input.client,
  });
  const activeScoped = effective.scopedRoles.filter((assignment) => activeRole(assignment.status, assignment.expires_at));
  const allowed = activeScoped.some((assignment) => PROPERTY_SCOPED_ROLES.includes(assignment.role as PropertyScopedRole));
  const operationRoles = new Set<string>(PROPERTY_OPERATION_ROLES);
  const canMutate = activeScoped.some((assignment) => operationRoles.has(assignment.role));
  if (!allowed && input.ctx.appUserId) {
    const { count, error } = await input.client
      .from("property_registry_cases")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", input.ctx.appUserId);
    if (error) throw error;
    if ((count ?? 0) > 0) return { allowed: true, canMutate: true, roles: effective.roles };
  }
  return { allowed, canMutate, roles: effective.roles };
}

export async function requirePropertyOperationsAccess(input: { ctx: UserContext; client: Client; mutate?: boolean }) {
  const access = await resolvePropertyOperationsAccess({ ctx: input.ctx, client: input.client });
  if (!access.allowed || (input.mutate && !access.canMutate)) throw new Error("You do not have access to registry operations.");
  return access;
}

async function insertNotification(input: {
  caseId: string;
  propertyId: string;
  recipientUserId?: string | null;
  notificationType: string;
  title: string;
  body?: string | null;
  metadata?: JsonRecord;
  client: Client;
}) {
  const { error } = await input.client.from("property_notifications").insert({
    case_id: input.caseId,
    property_id: input.propertyId,
    recipient_user_id: input.recipientUserId ?? null,
    notification_type: input.notificationType,
    title: input.title,
    body: input.body ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

async function insertStatusHistory(input: {
  propertyId: string;
  previousStatus: string | null;
  newStatus: string;
  actorUserId: string;
  reason: string;
  metadata?: JsonRecord;
  client: Client;
}) {
  if (input.previousStatus === input.newStatus) return;
  const { error } = await input.client.from("property_status_history").insert({
    property_id: input.propertyId,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    changed_by: input.actorUserId,
    change_reason: input.reason,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

async function insertComment(input: {
  caseId: string;
  propertyId: string;
  actorUserId: string;
  comment: string;
  visibility?: "internal" | "applicant_visible";
  commentType?: "comment" | "decision_note" | "correction_request" | "assignment_note";
  metadata?: JsonRecord;
  client: Client;
}) {
  if (!input.comment.trim()) return null;
  const { data, error } = await input.client
    .from("property_case_comments")
    .insert({
      case_id: input.caseId,
      property_id: input.propertyId,
      actor_user_id: input.actorUserId,
      comment: input.comment.trim(),
      visibility: input.visibility ?? "internal",
      comment_type: input.commentType ?? "comment",
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PropertyCaseComment;
}

async function getProperty(propertyId: string, client: Client) {
  const { data, error } = await client.from("properties").select("*").eq("id", propertyId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Property not found.");
  return data as Property;
}

async function getCase(caseId: string, client: Client) {
  const { data, error } = await client.from("property_registry_cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Registry case not found.");
  return data as PropertyRegistryCase;
}

export async function resolvePropertyCaseAccess(input: {
  caseId: string;
  ctx: UserContext;
  client: Client;
}): Promise<PropertyCaseAccessResult> {
  const registryCase = await getCase(input.caseId, input.client);
  const property = await getProperty(registryCase.property_id, input.client);
  if (!input.ctx.appUserId || input.ctx.role === "public") {
    return { canViewCase: false, canOperateCase: false, canOverrideCase: false, source: "denied", registryCase, property };
  }

  if (isPlatformAdmin(input.ctx.role)) {
    return { canViewCase: true, canOperateCase: true, canOverrideCase: true, source: "platform_admin", registryCase, property };
  }

  const assignments = await listActivePropertyRoleAssignments({ userId: input.ctx.appUserId, client: input.client });
  const matchingAssignments = assignments.filter((assignment) => roleAssignmentMatchesProperty(assignment, property));
  const hasPropertyAdmin = matchingAssignments.some((assignment) => isPropertyAdminRole(assignment.role));
  if (hasPropertyAdmin) {
    return { canViewCase: true, canOperateCase: true, canOverrideCase: true, source: "property_admin", registryCase, property };
  }

  const hasScopedOperate = matchingAssignments.some((assignment) => PROPERTY_OPERATION_ROLE_SET.has(String(assignment.role)));
  const hasScopedView = matchingAssignments.some((assignment) => PROPERTY_SCOPED_ROLES.includes(assignment.role as PropertyScopedRole));
  const assignedOfficer = registryCase.assigned_to === input.ctx.appUserId;
  const canOperateCase = hasScopedOperate || assignedOfficer;
  const canViewCase = hasScopedView || assignedOfficer;

  return {
    canViewCase,
    canOperateCase,
    canOverrideCase: false,
    source: hasScopedView ? "scoped_role" : assignedOfficer ? "assigned_officer" : "denied",
    registryCase,
    property,
  };
}

export async function requirePropertyCaseAccess(input: {
  caseId: string;
  ctx: UserContext;
  client: Client;
  mode: PropertyCaseAccessMode;
}) {
  const access = await resolvePropertyCaseAccess(input);
  const allowed = input.mode === "override" ? access.canOverrideCase : input.mode === "operate" ? access.canOperateCase : access.canViewCase;
  if (!allowed) {
    throw new Error("You do not have access to this registry case.");
  }
  return access;
}

export function canTransitionPropertyCase(input: {
  from: PropertyRegistryCaseStatus;
  to: PropertyRegistryCaseStatus;
  hasActiveCredential?: boolean;
  override?: boolean;
}) {
  if (input.from === input.to) return true;
  if (input.hasActiveCredential && CASE_LOCKED_BY_CREDENTIAL_STATUSES.has(input.to)) return false;
  if (input.hasActiveCredential && input.from === "verified") return false;
  if (CASE_TERMINAL_STATUSES.has(input.from)) return Boolean(input.override) && !input.hasActiveCredential && CASE_TRANSITIONS[input.from].includes(input.to);
  return CASE_TRANSITIONS[input.from].includes(input.to);
}

function assertCanTransitionPropertyCase(input: {
  from: PropertyRegistryCaseStatus;
  to: PropertyRegistryCaseStatus;
  hasActiveCredential: boolean;
  override: boolean;
}) {
  if (!canTransitionPropertyCase(input)) {
    throw new Error(`Invalid registry transition from ${input.from} to ${input.to}.`);
  }
}

export function validateOwnerReadiness(owners: PropertyOwner[]) {
  const activeOwners = owners.filter((owner) => !owner.effective_to && owner.verification_status !== "superseded");
  if (!activeOwners.length) throw new Error("Approval requires at least one active owner.");
  if (!activeOwners.some((owner) => owner.is_primary)) throw new Error("Approval requires a primary owner.");
  for (const owner of activeOwners) {
    if (owner.ownership_percentage !== null && (owner.ownership_percentage <= 0 || owner.ownership_percentage > 100)) {
      throw new Error("Ownership percentages must be greater than 0 and not more than 100.");
    }
  }
  const percentages = activeOwners.map((owner) => owner.ownership_percentage).filter((percentage): percentage is number => percentage !== null);
  const percentageTotal = percentages.reduce((sum, percentage) => sum + percentage, 0);
  if (percentageTotal > 100.01) throw new Error("Ownership percentages cannot exceed 100%.");
  if (activeOwners.length > 1 && percentages.length === activeOwners.length && Math.abs(percentageTotal - 100) > 0.01) {
    throw new Error("Multi-owner records with percentages must total 100%.");
  }
  if (activeOwners.some((owner) => owner.verification_status !== "verified")) {
    throw new Error("Approval requires active owners to be verified.");
  }
}

export function validateDocumentReadiness(documents: PropertyDocument[]) {
  const activeDocuments = documents.filter((document) => !["superseded", "archived"].includes(document.status));
  if (!activeDocuments.length) throw new Error("Approval requires at least one supporting document.");
  if (!activeDocuments.some((document) => document.status === "accepted")) throw new Error("Approval requires at least one accepted supporting document.");
  const unresolved = activeDocuments.filter((document) => document.status !== "accepted");
  if (unresolved.length) throw new Error("Approval requires all active supporting documents to be accepted.");
}

async function assertApprovalReadiness(input: { registryCase: PropertyRegistryCase; client: Client }) {
  const [owners, documents] = await Promise.all([
    input.client.from("property_owners").select("*").eq("property_id", input.registryCase.property_id),
    input.client.from("property_documents").select("*").eq("property_id", input.registryCase.property_id),
  ]);
  if (owners.error) throw owners.error;
  if (documents.error) throw documents.error;
  validateOwnerReadiness((owners.data ?? []) as PropertyOwner[]);
  validateDocumentReadiness((documents.data ?? []) as PropertyDocument[]);
}

export function resolveDocumentReviewStatus(input: { action: string; document: Pick<PropertyDocument, "status" | "superseded_by"> }) {
  if (!["approve", "reject", "request_replacement", "supersede"].includes(input.action)) {
    throw new Error("Unsupported document review action.");
  }
  if (!REVIEWABLE_DOCUMENT_STATUSES.has(input.document.status)) {
    throw new Error("This document has already been reviewed and must be moved back to a reviewable state before another decision.");
  }
  if (input.action === "supersede" && !input.document.superseded_by) {
    throw new Error("A document can only be superseded after a replacement document relationship exists.");
  }
  if (input.action === "approve") return "accepted" as const;
  if (input.action === "supersede") return "superseded" as const;
  return "rejected" as const;
}

async function hasActiveCredential(input: { propertyId: string; client: Client }) {
  const { data, error } = await input.client
    .from("property_identity_credentials")
    .select("id")
    .eq("property_id", input.propertyId)
    .eq("status", "issued")
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function ensureRegistryCaseForProperty(input: {
  propertyId: string;
  actorUserId: string;
  client: Client;
}) {
  const property = await getProperty(input.propertyId, input.client);
  if (property.status === "draft") throw new Error("Draft properties do not have registry cases.");

  const { data: existing, error: lookupError } = await input.client
    .from("property_registry_cases")
    .select("*")
    .eq("property_id", property.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing as PropertyRegistryCase;

  const caseReference = await generatePropertyCaseReference(input.client);
  const { data: claim } = await input.client
    .from("property_claims")
    .select("id")
    .eq("property_id", property.id)
    .eq("claim_type", "registration")
    .maybeSingle();
  const { data, error } = await input.client
    .from("property_registry_cases")
    .insert({
      case_reference: caseReference,
      application_reference: property.application_reference,
      property_id: property.id,
      claim_id: claim?.id ?? null,
      status: property.status === "submitted" ? "submitted" : property.status,
      submitted_at: property.application_submitted_at ?? property.created_at,
      metadata: { phase: "dlpi_property_registry_operations_phase3" },
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Unable to create registry case.");
  await recordPropertyEvent({
    propertyId: property.id,
    eventType: "property.case.created",
    entityType: "property_registry_case",
    entityId: data.id,
    actorUserId: input.actorUserId,
    summary: `Registry case ${caseReference} created.`,
    metadata: { case_reference: caseReference },
    client: input.client,
  });
  return data as PropertyRegistryCase;
}

export async function listRegistryCases(input: {
  client: Client;
  ctx?: UserContext;
  status?: string | null;
  assignedTo?: string | null;
  limit?: number;
}) {
  let query = input.client
    .from("property_registry_cases")
    .select("*, properties(*)")
    .order("updated_at", { ascending: false })
    .limit(input.limit ?? 100);
  if (input.status) query = query.eq("status", input.status);
  if (input.assignedTo) query = query.eq("assigned_to", input.assignedTo);
  const { data, error } = await query;
  if (error) throw error;
  const cases = (data ?? []).map((row) => {
    const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    return { ...(row as PropertyRegistryCase), property: (property as Property | null) ?? null };
  }) as PropertyCaseListItem[];
  if (!input.ctx?.appUserId || isPlatformAdmin(input.ctx.role)) return cases;

  const assignments = await listActivePropertyRoleAssignments({ userId: input.ctx.appUserId, client: input.client });
  return cases.filter((item) => {
    if (item.assigned_to === input.ctx?.appUserId) return true;
    if (!item.property) return false;
    return assignments.some((assignment) => roleAssignmentMatchesProperty(assignment, item.property!));
  });
}

export async function getOperationsDashboard(input: { client: Client; ctx: UserContext }) {
  const [cases, events, assignments] = await Promise.all([
    listRegistryCases({ client: input.client, ctx: input.ctx, limit: 200 }),
    input.client.from("property_events").select("*").order("created_at", { ascending: false }).limit(12),
    input.client.from("property_case_assignments").select("*, users!property_case_assignments_assigned_to_fkey(id,full_name,email,role)").eq("status", "active").order("assigned_at", { ascending: false }).limit(50),
  ]);
  if (events.error) throw events.error;
  if (assignments.error) throw assignments.error;

  const today = new Date().toISOString().slice(0, 10);
  const completed = cases.filter((item) => item.completed_at && item.submitted_at);
  const reviewHours = completed.map((item) => (new Date(item.completed_at!).getTime() - new Date(item.submitted_at!).getTime()) / 36e5).filter(Number.isFinite);
  const workload = new Map<string, number>();
  for (const row of assignments.data ?? []) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const label = user?.full_name || user?.email || row.assigned_to || "Unassigned";
    workload.set(label, (workload.get(label) ?? 0) + 1);
  }
  const regions = new Map<string, number>();
  for (const item of cases) {
    const key = item.property?.state_id ?? "Unspecified";
    regions.set(key, (regions.get(key) ?? 0) + 1);
  }

  const visibleCaseIds = new Set(cases.map((item) => item.id));
  const visiblePropertyIds = new Set(cases.map((item) => item.property_id));
  const visibleEvents = (events.data ?? []).filter((event) => {
    if (event.property_id && visiblePropertyIds.has(event.property_id)) return true;
    if (event.metadata?.case_id && visibleCaseIds.has(String(event.metadata.case_id))) return true;
    return false;
  });

  return {
    cases,
    metrics: {
      awaitingReview: cases.filter((item) => item.status === "submitted").length,
      assignedToday: cases.filter((item) => item.assigned_at?.startsWith(today)).length,
      pendingVerification: cases.filter((item) => ["under_review", "awaiting_documents", "awaiting_survey", "awaiting_ownership"].includes(item.status)).length,
      returned: cases.filter((item) => item.status === "returned").length,
      approvedToday: cases.filter((item) => item.status === "approved" && item.decided_at?.startsWith(today)).length,
      rejected: cases.filter((item) => item.status === "rejected").length,
      averageReviewTimeHours: reviewHours.length ? Math.round(reviewHours.reduce((sum, value) => sum + value, 0) / reviewHours.length) : 0,
    },
    workload: [...workload.entries()].map(([name, count]) => ({ name, count })),
    regionalSummary: [...regions.entries()].map(([stateId, count]) => ({ stateId, count })).slice(0, 8),
    events: visibleEvents,
  };
}

export async function getRegistryCaseDetail(input: { caseId: string; client: Client; ctx?: UserContext }): Promise<PropertyCaseDetail> {
  const access = input.ctx ? await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "view" }) : null;
  const registryCase = access?.registryCase ?? await getCase(input.caseId, input.client);
  const [property, addresses, owners, documents, assignments, comments, events, statusHistory, credentials, certificates] = await Promise.all([
    input.client.from("properties").select("*").eq("id", registryCase.property_id).single(),
    input.client.from("property_addresses").select("*").eq("property_id", registryCase.property_id).order("is_primary", { ascending: false }),
    input.client.from("property_owners").select("*").eq("property_id", registryCase.property_id).order("is_primary", { ascending: false }),
    input.client.from("property_documents").select("*").eq("property_id", registryCase.property_id).order("created_at", { ascending: false }),
    input.client.from("property_case_assignments").select("*").eq("case_id", registryCase.id).order("assigned_at", { ascending: false }),
    input.client.from("property_case_comments").select("*").eq("case_id", registryCase.id).order("created_at", { ascending: false }),
    input.client.from("property_events").select("id,event_type,summary,metadata,created_at,entity_type,entity_id").eq("property_id", registryCase.property_id).order("created_at", { ascending: false }).limit(80),
    input.client.from("property_status_history").select("id,previous_status,new_status,change_reason,created_at,metadata").eq("property_id", registryCase.property_id).order("created_at", { ascending: false }),
    input.client.from("property_identity_credentials").select("*").eq("property_id", registryCase.property_id).order("created_at", { ascending: false }),
    input.client.from("property_certificates").select("*").eq("property_id", registryCase.property_id).order("generated_at", { ascending: false }),
  ]);
  for (const result of [property, addresses, owners, documents, assignments, comments, events, statusHistory, credentials, certificates]) {
    if (result.error) throw result.error;
  }
  return {
    ...registryCase,
    property: property.data as Property,
    addresses: (addresses.data ?? []) as PropertyAddress[],
    owners: (owners.data ?? []) as PropertyOwner[],
    documents: (documents.data ?? []) as PropertyDocument[],
    assignments: (assignments.data ?? []) as PropertyCaseAssignment[],
    comments: (comments.data ?? []) as PropertyCaseComment[],
    events: (events.data ?? []) as PropertyCaseDetail["events"],
    statusHistory: (statusHistory.data ?? []) as PropertyCaseDetail["statusHistory"],
    credentials: (credentials.data ?? []) as PropertyIdentityCredential[],
    certificates: (certificates.data ?? []) as PropertyCertificate[],
  };
}

export async function listAssignablePropertyUsers(input: { client: Client }) {
  const { data, error } = await input.client
    .from("users")
    .select("id,full_name,email,role")
    .in("role", ["admin", "super_admin", "programme_officer", "reviewer"])
    .order("full_name", { ascending: true });
  if (error) throw error;
  const { data: assignments, error: assignmentError } = await input.client
    .from("role_assignments")
    .select("user_id,role")
    .eq("status", "active")
    .in("role", [...PROPERTY_OPERATION_ROLES]);
  if (assignmentError) throw assignmentError;
  const scopedUserIds = new Set((assignments ?? []).map((row) => row.user_id).filter(Boolean));
  return (data ?? []).filter((user) => ["admin", "super_admin"].includes(user.role) || scopedUserIds.has(user.id));
}

export async function addCaseComment(input: { caseId: string; ctx: UserContext; formData: FormData; client: Client }) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const { registryCase } = await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "operate" });
  const comment = value(input.formData, "comment");
  const visibility = value(input.formData, "visibility") === "applicant_visible" ? "applicant_visible" : "internal";
  await insertComment({
    caseId: registryCase.id,
    propertyId: registryCase.property_id,
    actorUserId: input.ctx.appUserId,
    comment,
    visibility,
    client: input.client,
  });
  await recordPropertyEvent({
    propertyId: registryCase.property_id,
    eventType: "property.case.comment_added",
    entityType: "property_registry_case",
    entityId: registryCase.id,
    actorUserId: input.ctx.appUserId,
    summary: "Registry case comment added.",
    metadata: { visibility },
    client: input.client,
  });
}

export async function assignRegistryCase(input: { caseId: string; ctx: UserContext; formData: FormData; client: Client }) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const { registryCase } = await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "override" });
  const assignedTo = nullable(value(input.formData, "assigned_to"));
  const assignmentRole = value(input.formData, "assignment_role") || "land_registry_officer";
  const notes = nullable(value(input.formData, "notes"));
  const now = new Date().toISOString();

  const { error: closeError } = await input.client
    .from("property_case_assignments")
    .update({ status: "reassigned", unassigned_at: now })
    .eq("case_id", registryCase.id)
    .eq("status", "active");
  if (closeError) throw closeError;

  if (assignedTo) {
    const { error: assignmentError } = await input.client.from("property_case_assignments").insert({
      case_id: registryCase.id,
      property_id: registryCase.property_id,
      assignment_role: assignmentRole,
      assigned_to: assignedTo,
      assigned_by: input.ctx.appUserId,
      status: "active",
      notes,
      metadata: { phase: "dlpi_property_registry_operations_phase3" },
    });
    if (assignmentError) throw assignmentError;
  }

  const { error: caseError } = await input.client
    .from("property_registry_cases")
    .update({ assigned_to: assignedTo, assigned_by: input.ctx.appUserId, assigned_at: assignedTo ? now : null, status: assignedTo && registryCase.status === "submitted" ? "under_review" : registryCase.status })
    .eq("id", registryCase.id);
  if (caseError) throw caseError;

  if (assignedTo && registryCase.status === "submitted") {
    await updatePropertyStatus({ registryCase, newStatus: "under_review", actorUserId: input.ctx.appUserId, note: "Case assigned for registry review.", client: input.client });
  }

  await insertComment({
    caseId: registryCase.id,
    propertyId: registryCase.property_id,
    actorUserId: input.ctx.appUserId,
    comment: notes ?? (assignedTo ? "Case assigned." : "Case unassigned."),
    commentType: "assignment_note",
    client: input.client,
  });
  await insertNotification({
    caseId: registryCase.id,
    propertyId: registryCase.property_id,
    recipientUserId: assignedTo,
    notificationType: "application_assigned",
    title: assignedTo ? "Property application assigned" : "Property application unassigned",
    body: `Case ${registryCase.case_reference}`,
    metadata: { assignment_role: assignmentRole },
    client: input.client,
  });
  await recordPropertyEvent({
    propertyId: registryCase.property_id,
    eventType: assignedTo ? "property.case.assigned" : "property.case.unassigned",
    entityType: "property_registry_case",
    entityId: registryCase.id,
    actorUserId: input.ctx.appUserId,
    summary: assignedTo ? "Registry case assigned." : "Registry case unassigned.",
    metadata: { assigned_to: assignedTo, assignment_role: assignmentRole },
    client: input.client,
  });
}

async function updatePropertyStatus(input: {
  registryCase: PropertyRegistryCase;
  newStatus: PropertyRegistryCaseStatus;
  actorUserId: string;
  note: string;
  client: Client;
  override?: boolean;
}) {
  const property = await getProperty(input.registryCase.property_id, input.client);
  const now = new Date().toISOString();
  const terminal = CASE_COMPLETE_STATUSES.has(input.newStatus);
  const credentialed = await hasActiveCredential({ propertyId: property.id, client: input.client });
  assertCanTransitionPropertyCase({
    from: input.registryCase.status,
    to: input.newStatus,
    hasActiveCredential: credentialed,
    override: Boolean(input.override),
  });
  const { error: propertyError } = await input.client
    .from("properties")
    .update({ status: input.newStatus, registry_status: input.newStatus })
    .eq("id", property.id);
  if (propertyError) throw propertyError;

  const { error: caseError } = await input.client
    .from("property_registry_cases")
    .update({
      status: input.newStatus,
      decision: terminal ? input.newStatus : input.registryCase.decision,
      decision_note: terminal || ["returned", "suspended", "cancelled"].includes(input.newStatus) ? input.note : input.registryCase.decision_note,
      decided_by: terminal || ["returned", "suspended", "cancelled"].includes(input.newStatus) ? input.actorUserId : input.registryCase.decided_by,
      decided_at: terminal || ["returned", "suspended", "cancelled"].includes(input.newStatus) ? now : input.registryCase.decided_at,
      completed_at: terminal ? now : input.registryCase.completed_at,
    })
    .eq("id", input.registryCase.id);
  if (caseError) throw caseError;

  await insertStatusHistory({
    propertyId: property.id,
    previousStatus: property.status,
    newStatus: input.newStatus,
    actorUserId: input.actorUserId,
    reason: input.note,
    metadata: { case_id: input.registryCase.id, case_reference: input.registryCase.case_reference },
    client: input.client,
  });
  await recordPropertyEvent({
    propertyId: property.id,
    eventType: PROPERTY_DECISION_EVENT[input.newStatus] ?? "property.review.status_changed",
    entityType: "property_registry_case",
    entityId: input.registryCase.id,
    actorUserId: input.actorUserId,
    summary: input.note,
    metadata: { previous_status: property.status, new_status: input.newStatus, case_reference: input.registryCase.case_reference },
    client: input.client,
  });
}

export async function updateCaseDecision(input: { caseId: string; ctx: UserContext; formData: FormData; client: Client }) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const access = await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "operate" });
  const registryCase = access.registryCase;
  const action = value(input.formData, "decision") as PropertyRegistryCaseStatus;
  const note = value(input.formData, "decision_note") || `Case marked ${action.replaceAll("_", " ")}.`;
  if (!["under_review", "awaiting_documents", "awaiting_survey", "awaiting_ownership", "approved", "rejected", "returned", "suspended", "cancelled", "verified"].includes(action)) {
    throw new Error("Unsupported registry decision.");
  }
  const credentialed = await hasActiveCredential({ propertyId: registryCase.property_id, client: input.client });
  assertCanTransitionPropertyCase({ from: registryCase.status, to: action, hasActiveCredential: credentialed, override: access.canOverrideCase });
  if (["approved", "verified"].includes(action)) {
    await assertApprovalReadiness({ registryCase, client: input.client });
  }
  await updatePropertyStatus({ registryCase, newStatus: action, actorUserId: input.ctx.appUserId, note, client: input.client, override: access.canOverrideCase });
  await insertComment({
    caseId: registryCase.id,
    propertyId: registryCase.property_id,
    actorUserId: input.ctx.appUserId,
    comment: note,
    visibility: action === "returned" ? "applicant_visible" : "internal",
    commentType: action === "returned" ? "correction_request" : "decision_note",
    client: input.client,
  });
  if (action === "returned") {
    await insertNotification({
      caseId: registryCase.id,
      propertyId: registryCase.property_id,
      notificationType: "application_returned",
      title: "Property application returned for correction",
      body: note,
      client: input.client,
    });
  }
}

export async function reviewDocument(input: { caseId: string; ctx: UserContext; formData: FormData; client: Client }) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const { registryCase } = await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "operate" });
  const documentId = value(input.formData, "document_id");
  const action = value(input.formData, "document_action");
  const note = value(input.formData, "review_note");
  const { data: document, error: lookupError } = await input.client.from("property_documents").select("*").eq("id", documentId).eq("property_id", registryCase.property_id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!document) throw new Error("Document not found for this case.");
  const status = resolveDocumentReviewStatus({ action, document: document as PropertyDocument });
  const { error } = await input.client
    .from("property_documents")
    .update({ status, reviewed_by: input.ctx.appUserId, reviewed_at: new Date().toISOString(), review_note: note || null })
    .eq("id", documentId);
  if (error) throw error;
  const eventType = status === "accepted" ? "property.document.accepted" : status === "superseded" ? "property.document.superseded" : "property.document.rejected";
  const { error: docEventError } = await input.client.from("property_document_events").insert({
    document_id: documentId,
    property_id: registryCase.property_id,
    event_type: eventType,
    actor_user_id: input.ctx.appUserId,
    summary: note || `Document ${status}.`,
    metadata: { document_type: document.document_type, case_id: registryCase.id },
  });
  if (docEventError) throw docEventError;
  await recordPropertyEvent({
    propertyId: registryCase.property_id,
    eventType,
    entityType: "property_document",
    entityId: documentId,
    actorUserId: input.ctx.appUserId,
    summary: note || `Document ${status}.`,
    metadata: { document_type: document.document_type, case_id: registryCase.id },
    client: input.client,
  });
  if (action === "request_replacement") {
    await updatePropertyStatus({ registryCase, newStatus: "awaiting_documents", actorUserId: input.ctx.appUserId, note: note || "Replacement document requested.", client: input.client });
    await insertNotification({
      caseId: registryCase.id,
      propertyId: registryCase.property_id,
      notificationType: "documents_requested",
      title: "Replacement document requested",
      body: note || "The registry requested a replacement document.",
      client: input.client,
    });
  }
}

export async function reviewOwner(input: { caseId: string; ctx: UserContext; formData: FormData; client: Client }) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const { registryCase } = await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "operate" });
  const ownerId = value(input.formData, "owner_id");
  const action = value(input.formData, "owner_action");
  const note = value(input.formData, "review_note");
  if (!["verify", "clarify", "reject"].includes(action)) throw new Error("Unsupported ownership review action.");
  const status = action === "verify" ? "verified" : action === "clarify" ? "pending_review" : "rejected";
  const { data: owner, error: lookupError } = await input.client.from("property_owners").select("*").eq("id", ownerId).eq("property_id", registryCase.property_id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!owner) throw new Error("Owner not found for this case.");
  if (["verified", "rejected"].includes(owner.verification_status) && owner.verification_status === status) {
    throw new Error("This ownership record already has that review decision.");
  }
  const { error } = await input.client.from("property_owners").update({ verification_status: status }).eq("id", ownerId);
  if (error) throw error;
  const { error: historyError } = await input.client.from("property_owner_history").insert({
    property_id: registryCase.property_id,
    property_owner_id: ownerId,
    change_type: status === "verified" ? "verified" : "updated",
    previous_values: { verification_status: owner.verification_status },
    new_values: { verification_status: status },
    changed_by: input.ctx.appUserId,
    change_note: note || `Ownership ${status}.`,
    metadata: { case_id: registryCase.id, phase: "dlpi_property_registry_operations_phase3" },
  });
  if (historyError) throw historyError;
  await recordPropertyEvent({
    propertyId: registryCase.property_id,
    eventType: status === "verified" ? "property.owner.verified" : status === "rejected" ? "property.owner.rejected" : "property.owner.clarification_requested",
    entityType: "property_owner",
    entityId: ownerId,
    actorUserId: input.ctx.appUserId,
    summary: note || `Ownership ${status}.`,
    metadata: { case_id: registryCase.id },
    client: input.client,
  });
  if (action === "clarify") {
    await updatePropertyStatus({ registryCase, newStatus: "awaiting_ownership", actorUserId: input.ctx.appUserId, note: note || "Ownership clarification requested.", client: input.client });
  }
}

export async function issueNpinAndCredential(input: { caseId: string; ctx: UserContext; client: Client }) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const { registryCase, property } = await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "operate" });
  if (!["approved", "verified"].includes(property.status) || !["approved", "verified"].includes(registryCase.status)) throw new Error("NPIN can only be issued after approval or verification.");
  if (["rejected", "returned", "cancelled"].includes(property.status) || ["rejected", "returned", "cancelled"].includes(registryCase.status)) {
    throw new Error("NPIN cannot be issued for rejected, returned or cancelled applications.");
  }
  if (!property.state_id) throw new Error("A state is required to issue an NPIN.");
  const npin = property.npin ?? await generatePropertyNpin(property.state_id, input.client);
  if (!property.npin) {
    const { error: propertyError } = await input.client.from("properties").update({ npin }).eq("id", property.id);
    if (propertyError) throw propertyError;
  }

  const { data: existingCredential, error: existingCredentialError } = await input.client
    .from("property_identity_credentials")
    .select("*")
    .eq("property_id", property.id)
    .eq("status", "issued")
    .maybeSingle();
  if (existingCredentialError) throw existingCredentialError;
  if (existingCredential) return existingCredential as PropertyIdentityCredential;

  const token = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const credentialReference = `PCRED-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const snapshot = {
    npin,
    property_id: property.id,
    application_reference: property.application_reference,
    case_reference: registryCase.case_reference,
    property_type: property.property_type,
    title: property.title,
    issued_at: new Date().toISOString(),
  };
  const { data: credential, error } = await input.client
    .from("property_identity_credentials")
    .insert({
      property_id: property.id,
      npin,
      credential_reference: credentialReference,
      status: "issued",
      issued_by: input.ctx.appUserId,
      issued_at: new Date().toISOString(),
      public_token: token,
      public_token_hash: tokenHash,
      qr_code_ref: `QR-${npin}`,
      verification_snapshot: snapshot,
      signature_version: "phase3-placeholder-v1",
      public_signature: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
      metadata: { phase: "dlpi_property_registry_operations_phase3" },
    })
    .select("*")
    .single();
  if (error || !credential) throw error ?? new Error("Unable to issue credential.");
  await input.client.from("property_identity_events").insert({
    credential_id: credential.id,
    property_id: property.id,
    event_type: "property.credential.issued",
    actor_user_id: input.ctx.appUserId,
    summary: "Property identity credential issued.",
    metadata: { npin, credential_reference: credentialReference, case_id: registryCase.id },
  });
  await recordPropertyEvent({
    propertyId: property.id,
    eventType: "property.npin.issued",
    entityType: "property_identity_credential",
    entityId: credential.id,
    actorUserId: input.ctx.appUserId,
    summary: `Official NPIN ${npin} issued.`,
    metadata: { npin, credential_reference: credentialReference, case_reference: registryCase.case_reference },
    client: input.client,
  });
  await insertNotification({
    caseId: registryCase.id,
    propertyId: property.id,
    notificationType: "npin_issued",
    title: "NPIN issued",
    body: `Official NPIN ${npin} has been issued.`,
    metadata: { npin },
    client: input.client,
  });
  await insertNotification({
    caseId: registryCase.id,
    propertyId: property.id,
    notificationType: "credential_issued",
    title: "Property credential issued",
    body: `Credential ${credentialReference} has been issued.`,
    metadata: { credential_reference: credentialReference },
    client: input.client,
  });
  return credential as PropertyIdentityCredential;
}

export async function generateCertificate(input: { caseId: string; ctx: UserContext; client: Client }) {
  if (!input.ctx.appUserId) throw new Error("Authentication is required.");
  const { registryCase } = await requirePropertyCaseAccess({ caseId: input.caseId, ctx: input.ctx, client: input.client, mode: "operate" });
  const detail = await getRegistryCaseDetail({ caseId: input.caseId, client: input.client, ctx: input.ctx });
  const credential = detail.credentials.find((item) => item.status === "issued");
  if (!credential || !detail.property.npin) throw new Error("Issue an NPIN and credential before generating a certificate.");
  const { data: existingCertificate, error: existingCertificateError } = await input.client
    .from("property_certificates")
    .select("id")
    .eq("property_id", registryCase.property_id)
    .eq("credential_id", credential.id)
    .in("status", [...CERTIFICATE_ACTIVE_STATUSES])
    .limit(1);
  if (existingCertificateError) throw existingCertificateError;
  if (existingCertificate?.length) throw new Error("An active certificate already exists for this property credential.");
  const certificateReference = `PCERT-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const payload = {
    certificate_reference: certificateReference,
    application_reference: detail.property.application_reference,
    case_reference: registryCase.case_reference,
    npin: detail.property.npin,
    property: {
      title: detail.property.title,
      type: detail.property.property_type,
      parcel_reference: detail.property.parcel_reference,
      area_size: detail.property.area_size,
      area_unit: detail.property.area_unit,
    },
    owners: detail.owners.map((owner) => ({ name: owner.owner_name, type: owner.owner_type, percentage: owner.ownership_percentage })),
    registry_authority: "Digital Land & Property Infrastructure Registry",
    issue_date: new Date().toISOString(),
    qr_placeholder: credential.qr_code_ref,
    disclaimer: "This certificate is a registry operations artifact. Public online verification is not enabled in this phase.",
  };
  const { data, error } = await input.client
    .from("property_certificates")
    .insert({
      case_id: registryCase.id,
      property_id: registryCase.property_id,
      credential_id: credential.id,
      certificate_reference: certificateReference,
      generated_by: input.ctx.appUserId,
      certificate_payload: payload,
      metadata: { phase: "dlpi_property_registry_operations_phase3" },
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Unable to generate certificate.");
  await recordPropertyEvent({
    propertyId: registryCase.property_id,
    eventType: "property.certificate.generated",
    entityType: "property_certificate",
    entityId: data.id,
    actorUserId: input.ctx.appUserId,
    summary: `Property registration certificate ${certificateReference} generated.`,
    metadata: { certificate_reference: certificateReference },
    client: input.client,
  });
  return data as PropertyCertificate;
}

export async function syncSubmittedPropertiesToCases(input: { client: Client; actorUserId: string }) {
  const { data, error } = await input.client.from("properties").select("id").neq("status", "draft");
  if (error) throw error;
  for (const property of data ?? []) {
    await ensureRegistryCaseForProperty({ propertyId: property.id, actorUserId: input.actorUserId, client: input.client });
  }
}
