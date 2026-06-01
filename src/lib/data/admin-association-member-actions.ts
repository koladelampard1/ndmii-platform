import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";
import { generateTemporaryPin, hashTemporaryPin } from "@/lib/associations/access";
import {
  ASSOCIATION_MEMBER_BULK_CHUNK_SIZE,
  ASSOCIATION_MEMBER_FILTERED_BULK_LIMIT,
  ASSOCIATION_MEMBER_SELECTED_BULK_LIMIT,
  associationMemberFiltersForDiagnostics,
  maskEmail,
  maskPhone,
  normalizePhone,
  resolveAssociationMemberBulkTargetIds,
  type AdminAssociationMemberFilters,
} from "@/lib/data/admin-association-members";

export const ASSOCIATION_MEMBER_ACTIONS = [
  "start_review",
  "approve",
  "reject",
  "request_correction",
  "mark_duplicate",
  "remove_duplicate_flag",
  "assign_reviewer",
  "save_notes",
  "prepare_activation",
  "generate_invite",
  "regenerate_invite",
  "mark_invite_sent",
  "resend_invite",
  "expire_invite",
  "mark_onboarding_started",
  "mark_onboarding_completed",
] as const;

export type AssociationMemberAction = (typeof ASSOCIATION_MEMBER_ACTIONS)[number];
type MemberStatus = "imported" | "pending_review" | "approved" | "rejected" | "correction_requested" | "duplicate_review" | "pending_activation" | "active" | "orphaned";
type MemberRow = {
  id: string;
  association_id: string;
  member_status: MemberStatus;
  duplicate_signal: boolean | null;
  assigned_reviewer_id: string | null;
  activation_state: string | null;
  phone_number: string | null;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  trade_type: string | null;
};

const ACTION_TARGET: Partial<Record<AssociationMemberAction, MemberStatus>> = {
  start_review: "pending_review",
  approve: "approved",
  reject: "rejected",
  request_correction: "correction_requested",
  mark_duplicate: "duplicate_review",
  prepare_activation: "pending_activation",
};

const ALLOWED_TRANSITIONS: Record<MemberStatus, MemberStatus[]> = {
  imported: ["pending_review"],
  pending_review: ["approved", "rejected", "correction_requested", "duplicate_review"],
  correction_requested: ["pending_review"],
  duplicate_review: ["approved", "rejected"],
  approved: ["pending_activation"],
  rejected: [],
  pending_activation: ["active"],
  active: [],
  orphaned: [],
};

const REASON_REQUIRED = new Set<AssociationMemberAction>([
  "reject",
  "request_correction",
  "mark_duplicate",
  "remove_duplicate_flag",
  "assign_reviewer",
]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

class AssociationMemberSkipError extends Error {}

function skip(message: string): never {
  throw new AssociationMemberSkipError(message);
}

function assertRole(ctx: UserContext, action: AssociationMemberAction) {
  if (!["admin", "reviewer"].includes(ctx.role)) throw new Error("This role has read-only access.");
  if (["mark_duplicate", "remove_duplicate_flag", "assign_reviewer", "prepare_activation", "generate_invite", "regenerate_invite", "mark_invite_sent", "resend_invite", "expire_invite", "mark_onboarding_started", "mark_onboarding_completed"].includes(action) && ctx.role !== "admin") {
    throw new Error("This action is available to administrators only.");
  }
}

function assertTransition(from: MemberStatus, to: MemberStatus) {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) skip(`Invalid lifecycle transition from ${from} to ${to}.`);
}

async function loadMember(supabase: SupabaseClient<any>, memberId: string) {
  const { data, error } = await supabase
    .from("association_members")
    .select("id,association_id,member_status,duplicate_signal,assigned_reviewer_id,activation_state,phone_number,email,full_name,business_name,trade_type")
    .eq("id", memberId)
    .maybeSingle<MemberRow>();
  if (error) throw error;
  if (!data?.id) throw new Error("Association member not found.");
  return data;
}

const INVITE_EXPIRY_HOURS = Number(process.env.NDMII_ASSOCIATION_INVITE_EXPIRY_HOURS ?? "72");

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createRawToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function inviteUrl(token: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/association-onboarding/${token}`;
}

function maskedDestination(member: MemberRow) {
  return maskEmail(member.email) ?? maskPhone(member.phone_number) ?? "No contact available";
}

async function loadLatestInvite(supabase: SupabaseClient<any>, memberId: string) {
  const { data, error } = await supabase.from("association_member_invitations").select("*").eq("association_member_id", memberId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as Record<string, any> | null;
}

async function writeInvitationAudit(supabase: SupabaseClient<any>, params: { ctx: UserContext | null; member: MemberRow; eventType: string; invitationId: string; bulkOperationId?: string; metadata?: Record<string, unknown> }) {
  const timestamp = new Date().toISOString();
  const metadata = { invitation_id: params.invitationId, association_id: params.member.association_id, member_id: params.member.id, bulk_operation_id: params.bulkOperationId ?? null, ...(params.metadata ?? {}), raw_token_stored: false };
  const eventPayload = { association_id: params.member.association_id, association_member_id: params.member.id, member_id: params.member.id, actor_id: params.ctx?.appUserId ?? null, actor_user_id: params.ctx?.appUserId ?? null, actor_role: params.ctx?.role ?? "public", event_type: params.eventType, metadata, created_at: timestamp };
  const { error: eventError } = await supabase.from("association_member_events").insert(eventPayload);
  if (eventError) throw eventError;
  const { error: activityError } = await supabase.from("activity_logs").insert({ actor_user_id: params.ctx?.appUserId ?? null, action: `association_member_${params.eventType}`, entity_type: "association_member", entity_id: params.member.id, metadata, created_at: timestamp });
  if (activityError) throw activityError;
}

export async function generateAssociationMemberInvite(supabase: SupabaseClient<any>, params: { ctx: UserContext; memberId: string; regenerate?: boolean; bulkOperationId?: string }) {
  assertRole(params.ctx, params.regenerate ? "regenerate_invite" : "generate_invite");
  const member = await loadMember(supabase, params.memberId);
  if (member.member_status !== "pending_activation") skip("Member is not pending activation.");
  if (member.duplicate_signal) skip("Duplicate signal must be resolved before invitation.");
  if (["onboarding_completed", "credential_issued"].includes(member.activation_state ?? "")) skip("Onboarding or credential lifecycle has already progressed.");
  const latest = await loadLatestInvite(supabase, member.id);
  const now = new Date();
  if (latest && latest.status !== "expired" && new Date(String(latest.token_expires_at)).getTime() > now.getTime()) {
    if (!params.regenerate) skip("An active invite already exists.");
    await supabase.from("association_member_invitations").update({ status: "expired", expired_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", latest.id);
    await writeInvitationAudit(supabase, { ctx: params.ctx, member, invitationId: latest.id, eventType: "invite_expired", bulkOperationId: params.bulkOperationId, metadata: { reason: "regenerated" } });
  }
  const token = createRawToken();
  const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("association_member_invitations").insert({ association_member_id: member.id, association_id: member.association_id, token_hash: tokenHash(token), token_expires_at: expiresAt, status: "generated", sent_channel: "manual", sent_to_masked: maskedDestination(member), created_by: params.ctx.appUserId, metadata: { raw_token_stored: false } }).select("id").single();
  if (error) throw error;
  await supabase.from("association_members").update({ activation_state: "invited", invite_status: "GENERATED", updated_at: now.toISOString() }).eq("id", member.id);
  await writeInvitationAudit(supabase, { ctx: params.ctx, member, invitationId: data.id, eventType: "invite_generated", bulkOperationId: params.bulkOperationId, metadata: { regenerated: Boolean(params.regenerate), expires_at: expiresAt } });
  return { memberId: member.id, invitationId: data.id as string, inviteUrl: inviteUrl(token), expiresAt };
}

export async function runAssociationMemberInvitationAction(supabase: SupabaseClient<any>, params: { ctx: UserContext; memberId: string; action: Extract<AssociationMemberAction, "mark_invite_sent" | "resend_invite" | "expire_invite" | "mark_onboarding_started" | "mark_onboarding_completed">; bulkOperationId?: string }) {
  assertRole(params.ctx, params.action);
  const member = await loadMember(supabase, params.memberId);
  const latest = await loadLatestInvite(supabase, member.id);
  if (!latest) skip("Generate an invitation first.");
  const now = new Date().toISOString();
  if (params.action === "mark_invite_sent" || params.action === "resend_invite") {
    if (member.activation_state !== "invited") skip("Only invited members can be marked as sent.");
    if (latest.status === "expired" || new Date(String(latest.token_expires_at)).getTime() <= Date.now()) skip("This invitation has expired. Regenerate it first.");
    await supabase.from("association_member_invitations").update({ status: "sent", sent_channel: "manual", sent_to_masked: maskedDestination(member), updated_at: now, metadata: { ...(latest.metadata ?? {}), last_sent_at: now } }).eq("id", latest.id);
    await supabase.from("association_members").update({ invite_status: "SENT", updated_at: now }).eq("id", member.id);
    await writeInvitationAudit(supabase, { ctx: params.ctx, member, invitationId: latest.id, eventType: params.action === "resend_invite" ? "invite_resent" : "invite_sent", bulkOperationId: params.bulkOperationId });
  } else if (params.action === "expire_invite") {
    await supabase.from("association_member_invitations").update({ status: "expired", expired_at: now, updated_at: now }).eq("id", latest.id);
    await supabase.from("association_members").update({ invite_status: "EXPIRED", updated_at: now }).eq("id", member.id);
    await writeInvitationAudit(supabase, { ctx: params.ctx, member, invitationId: latest.id, eventType: "invite_expired", bulkOperationId: params.bulkOperationId });
  } else {
    const completed = params.action === "mark_onboarding_completed";
    if (completed && member.activation_state !== "onboarding_started") skip("Onboarding must be started before it can be completed.");
    if (!completed && !["invited", "invite_opened"].includes(member.activation_state ?? "")) skip("Only invited members can start onboarding.");
    await supabase.from("association_member_invitations").update({ status: completed ? "accepted" : latest.status, accepted_at: completed ? now : latest.accepted_at, updated_at: now }).eq("id", latest.id);
    await supabase.from("association_members").update({ activation_state: completed ? "onboarding_completed" : "onboarding_started", member_status: completed ? "active" : member.member_status, status_changed_at: completed ? now : undefined, updated_at: now }).eq("id", member.id);
    await writeInvitationAudit(supabase, { ctx: params.ctx, member, invitationId: latest.id, eventType: completed ? "onboarding_completed" : "onboarding_started", bulkOperationId: params.bulkOperationId });
    if (completed) await writeInvitationAudit(supabase, { ctx: params.ctx, member: { ...member, member_status: "active" }, invitationId: latest.id, eventType: "member_activated", bulkOperationId: params.bulkOperationId });
  }
}

export async function openAssociationMemberInvite(supabase: SupabaseClient<any>, token: string, startOnboarding = false) {
  const hash = tokenHash(token);
  const { data: invite, error } = await supabase.from("association_member_invitations").select("*,association_members(id,association_id,member_status,activation_state,full_name,business_name,trade_type,lga,phone_number,email,associations(name))").eq("token_hash", hash).maybeSingle();
  if (error) throw error;
  if (!invite) return { ok: false as const, error: "This invitation link is invalid." };
  const member = invite.association_members as Record<string, any>;
  if (invite.status === "expired" || new Date(invite.token_expires_at).getTime() <= Date.now()) {
    if (invite.status !== "expired") await supabase.from("association_member_invitations").update({ status: "expired", expired_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", invite.id);
    return { ok: false as const, error: "This invitation link has expired. Ask the onboarding team to regenerate it." };
  }
  const now = new Date().toISOString();
  const firstOpen = !invite.opened_at;
  const nextState = startOnboarding ? "onboarding_started" : member.activation_state === "invited" ? "invite_opened" : member.activation_state;
  const openedStatus = ["accepted", "opened"].includes(invite.status) ? invite.status : "opened";
  const memberInviteStatus = startOnboarding ? "ONBOARDING_STARTED" : member.activation_state === "invited" ? "OPENED" : undefined;
  await supabase.from("association_member_invitations").update({ status: startOnboarding ? invite.status : openedStatus, opened_at: invite.opened_at ?? now, updated_at: now }).eq("id", invite.id);
  await supabase.from("association_members").update({ activation_state: nextState, invite_status: memberInviteStatus, updated_at: now }).eq("id", member.id);
  if (firstOpen) await writeInvitationAudit(supabase, { ctx: null, member: member as MemberRow, invitationId: invite.id, eventType: "invite_opened" });
  if (startOnboarding && member.activation_state !== "onboarding_started") await writeInvitationAudit(supabase, { ctx: null, member: member as MemberRow, invitationId: invite.id, eventType: "onboarding_started" });
  return { ok: true as const, invitationId: invite.id as string, member: { fullName: nullable(member.full_name), businessName: nullable(member.business_name), tradeType: nullable(member.trade_type), lga: nullable(member.lga), associationName: nullable(member.associations?.name), activationState: nextState }, expiresAt: invite.token_expires_at as string };
}

function nullable(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function writeAudit(
  supabase: SupabaseClient<any>,
  params: { ctx: UserContext; member: MemberRow; action: AssociationMemberAction; previousStatus: MemberStatus; newStatus: MemberStatus; reason: string; timestamp: string; bulkOperationId?: string },
) {
  const metadata = {
    actor_id: params.ctx.appUserId,
    actor_role: params.ctx.role,
    member_id: params.member.id,
    association_id: params.member.association_id,
    previous_status: params.previousStatus,
    new_status: params.newStatus,
    reason: params.reason || null,
    source_workspace: "admin_association_member_workspace",
    timestamp: params.timestamp,
    bulk_operation_id: params.bulkOperationId ?? null,
  };
  const { error: eventError } = await supabase.from("association_member_events").insert({
    association_id: params.member.association_id,
    association_member_id: params.member.id,
    member_id: params.member.id,
    actor_id: params.ctx.appUserId,
    actor_user_id: params.ctx.appUserId,
    actor_role: params.ctx.role,
    event_type: params.action,
    metadata,
    created_at: params.timestamp,
  });
  if (eventError) throw eventError;
  const { error: activityError } = await supabase.from("activity_logs").insert({
    actor_user_id: params.ctx.appUserId,
    action: `admin_association_member_${params.action}`,
    entity_type: "association_member",
    entity_id: params.member.id,
    metadata,
    created_at: params.timestamp,
  });
  if (activityError) throw activityError;
}

export async function runAssociationMemberAction(
  supabase: SupabaseClient<any>,
  params: { ctx: UserContext; memberId: string; action: AssociationMemberAction; reason?: string | null; notes?: string | null; assignedReviewerId?: string | null; bulkOperationId?: string },
) {
  const reason = clean(params.reason);
  const notes = clean(params.notes);
  const assignedReviewerId = clean(params.assignedReviewerId) || null;
  if (!(ASSOCIATION_MEMBER_ACTIONS as readonly string[]).includes(params.action)) throw new Error("Unknown association member action.");
  assertRole(params.ctx, params.action);
  if (REASON_REQUIRED.has(params.action as AssociationMemberAction) && !reason) throw new Error("A reason is required for this action.");
  const member = await loadMember(supabase, params.memberId);
  if (params.action === "approve" && (member.duplicate_signal || member.member_status === "duplicate_review")) {
    skip("Duplicate review must be resolved before approval.");
  }
  if (params.action === "prepare_activation" && member.duplicate_signal) skip("Duplicate signal must be resolved before activation preparation.");
  const nextStatus = ACTION_TARGET[params.action] ?? member.member_status;
  if (ACTION_TARGET[params.action]) assertTransition(member.member_status, nextStatus);
  const timestamp = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: timestamp };
  if (nextStatus !== member.member_status) {
    patch.member_status = nextStatus;
    patch.status_changed_at = timestamp;
    patch.latest_review_reason = reason || null;
  }
  if (params.action === "approve") {
    patch.approved_at = timestamp;
    patch.reviewed_at = timestamp;
    patch.rejection_reason = null;
    patch.correction_reason = null;
  }
  if (params.action === "reject") {
    patch.rejection_reason = reason;
    patch.reviewed_at = timestamp;
  }
  if (params.action === "request_correction") patch.correction_reason = reason;
  if (params.action === "mark_duplicate") {
    patch.duplicate_signal = true;
    patch.duplicate_reasons = [reason];
  }
  if (params.action === "remove_duplicate_flag") {
    patch.duplicate_signal = false;
    patch.duplicate_reasons = [];
    patch.latest_review_reason = reason;
  }
  if (params.action === "assign_reviewer") {
    patch.assigned_reviewer_id = assignedReviewerId;
    patch.assigned_at = assignedReviewerId ? timestamp : null;
    patch.latest_review_reason = reason;
  }
  if (params.action === "save_notes") patch.internal_notes = notes;
  const { error } = await supabase.from("association_members").update(patch).eq("id", member.id);
  if (error) throw error;
  await writeAudit(supabase, { ctx: params.ctx, member, action: params.action, previousStatus: member.member_status, newStatus: nextStatus, reason: reason || notes, timestamp, bulkOperationId: params.bulkOperationId });
  return { memberId: member.id, previousStatus: member.member_status, newStatus: nextStatus };
}

const ACCESS_PIN_EXPIRY_DAYS = Number(process.env.NDMII_ASSOCIATION_ACCESS_PIN_EXPIRY_DAYS ?? "7");

export type AssociationMemberAccessDetail = {
  memberId: string;
  memberName: string;
  phone: string;
  email: string;
  businessName: string;
  temporaryPin: string;
  expiresAt: string;
};

function assertFastTrackEligibility(member: MemberRow) {
  if (!["imported", "pending_review", "approved", "pending_activation"].includes(member.member_status)) skip("Member status is not eligible for fast-track access.");
  if (member.duplicate_signal || member.member_status === "duplicate_review") skip("Duplicate review must be resolved before fast-track access.");
  if (!member.phone_number && !member.email) skip("Phone number or email is required.");
  if (!member.business_name) skip("Business name is required.");
  if (!member.full_name) skip("Full name is required.");
  if (!member.trade_type) skip("Trade type is required.");
  if (!member.association_id) skip("Association is required.");
}

async function writeAccessAudit(supabase: SupabaseClient<any>, params: { ctx: UserContext; member: MemberRow; credentialId: string; eventType: string; bulkOperationId?: string; metadata?: Record<string, unknown> }) {
  const timestamp = new Date().toISOString();
  const metadata = { association_id: params.member.association_id, member_id: params.member.id, access_credential_id: params.credentialId, bulk_operation_id: params.bulkOperationId ?? null, raw_pin_stored: false, ...(params.metadata ?? {}) };
  const { error: eventError } = await supabase.from("association_member_events").insert({ association_id: params.member.association_id, association_member_id: params.member.id, member_id: params.member.id, actor_id: params.ctx.appUserId, actor_user_id: params.ctx.appUserId, actor_role: params.ctx.role, event_type: params.eventType, metadata, created_at: timestamp });
  if (eventError) throw eventError;
  const { error: activityError } = await supabase.from("activity_logs").insert({ actor_user_id: params.ctx.appUserId, action: `association_member_${params.eventType}`, entity_type: "association_member", entity_id: params.member.id, metadata, created_at: timestamp });
  if (activityError) throw activityError;
}

async function moveMemberToPendingActivation(supabase: SupabaseClient<any>, member: MemberRow, timestamp: string) {
  const transitions: Partial<Record<MemberStatus, MemberStatus[]>> = {
    imported: ["pending_review", "approved", "pending_activation"],
    pending_review: ["approved", "pending_activation"],
    approved: ["pending_activation"],
  };
  for (const memberStatus of transitions[member.member_status] ?? []) {
    const patch: Record<string, unknown> = { member_status: memberStatus, status_changed_at: timestamp, updated_at: timestamp };
    if (memberStatus === "approved") {
      patch.approved_at = timestamp;
      patch.reviewed_at = timestamp;
    }
    const { error } = await supabase.from("association_members").update(patch).eq("id", member.id);
    if (error) throw error;
  }
}

export async function generateAssociationMemberTemporaryAccess(supabase: SupabaseClient<any>, params: { ctx: UserContext; memberId: string; regenerate?: boolean; bulkOperationId?: string; reservedPins?: Set<string> }) {
  if (params.ctx.role !== "admin") throw new Error("Fast-track activation is available to administrators only.");
  const member = await loadMember(supabase, params.memberId);
  assertFastTrackEligibility(member);
  const { data: current, error: loadError } = await supabase.from("association_member_access_credentials").select("id,status").eq("association_member_id", member.id).maybeSingle();
  if (loadError) throw loadError;
  if (current && !params.regenerate) skip("Access details have already been generated.");
  let pin = generateTemporaryPin();
  while (params.reservedPins?.has(pin)) pin = generateTemporaryPin();
  params.reservedPins?.add(pin);
  const now = new Date();
  await moveMemberToPendingActivation(supabase, member, now.toISOString());
  const expiresAt = new Date(now.getTime() + ACCESS_PIN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const payload = { association_member_id: member.id, association_id: member.association_id, login_phone_normalized: normalizePhone(member.phone_number), login_email: member.email?.trim().toLowerCase() || null, temporary_pin_hash: hashTemporaryPin(pin), temporary_pin_expires_at: expiresAt, must_change_password: true, first_login_completed_at: null, status: "active", auth_user_id: null, created_by: params.ctx.appUserId, updated_at: now.toISOString(), last_used_at: null, metadata: { raw_pin_stored: false, notification_provider_configured: false } };
  const result = current
    ? await supabase.from("association_member_access_credentials").update(payload).eq("id", current.id).select("id").single()
    : await supabase.from("association_member_access_credentials").insert(payload).select("id").single();
  if (result.error) throw result.error;
  const credentialId = String(result.data.id);
  const notificationStatus = "pending_manual";
  const { error: notificationError } = await supabase.from("association_member_access_notifications").insert({ association_member_access_credential_id: credentialId, association_member_id: member.id, association_id: member.association_id, channel: "printed_access_slip", status: notificationStatus, destination_masked: maskedDestination(member), created_by: params.ctx.appUserId, metadata: { raw_pin_stored: false, provider_configured: false } });
  if (notificationError) throw notificationError;
  const { error: memberError } = await supabase.from("association_members").update({ activation_state: "account_created", access_status: "access_ready", access_pin_expires_at: expiresAt, access_first_login_completed_at: null, access_notification_status: notificationStatus, updated_at: now.toISOString() }).eq("id", member.id);
  if (memberError) throw memberError;
  await writeAccessAudit(supabase, { ctx: params.ctx, member, credentialId, eventType: params.regenerate ? "temporary_pin_regenerated" : "access_generated", bulkOperationId: params.bulkOperationId, metadata: { expires_at: expiresAt, notification_status: notificationStatus } });
  return { memberId: member.id, memberName: member.full_name ?? "", phone: member.phone_number ?? "", email: member.email ?? "", businessName: member.business_name ?? "", temporaryPin: pin, expiresAt };
}

export async function recordAssociationMemberAccessExport(supabase: SupabaseClient<any>, params: { ctx: UserContext; details: AssociationMemberAccessDetail[]; bulkOperationId?: string }) {
  if (params.ctx.role !== "admin") throw new Error("Temporary PIN export is available to administrators only.");
  for (const detail of params.details) {
    const member = await loadMember(supabase, detail.memberId);
    const { data } = await supabase.from("association_member_access_credentials").select("id").eq("association_member_id", member.id).maybeSingle();
    if (data?.id) await writeAccessAudit(supabase, { ctx: params.ctx, member, credentialId: String(data.id), eventType: "access_exported", bulkOperationId: params.bulkOperationId });
  }
}

export const ASSOCIATION_MEMBER_BULK_ACTIONS = [
  "start_review",
  "approve",
  "prepare_activation",
  "generate_invite",
  "regenerate_invite",
  "mark_invite_sent",
  "mark_onboarding_started",
  "mark_onboarding_completed",
  "assign_reviewer",
  "reject",
  "request_correction",
  "fast_track_activation",
] as const;

export type AssociationMemberBulkAction = (typeof ASSOCIATION_MEMBER_BULK_ACTIONS)[number];
export type AssociationMemberBulkResult = {
  operationId: string;
  action: AssociationMemberBulkAction;
  targetMode: "selected" | "filtered";
  totalTargeted: number;
  successful: number;
  skipped: number;
  failed: number;
  reasons: Record<string, number>;
  report: Array<{ memberId: string; outcome: "skipped" | "failed"; reason: string }>;
  accessDetails?: AssociationMemberAccessDetail[];
};

function assertBulkEligibility(member: MemberRow, action: AssociationMemberBulkAction) {
  if (action === "start_review" && member.member_status !== "imported") skip("Only imported members can start review in bulk.");
  if (action === "approve" && member.member_status !== "pending_review") skip("Only pending review members can be approved in bulk.");
  if (action === "prepare_activation" && member.member_status !== "approved") skip("Only approved members can be prepared for activation.");
  if (action === "reject" && !["pending_review", "duplicate_review"].includes(member.member_status)) skip("Only review queue members can be rejected.");
  if (action === "request_correction" && member.member_status !== "pending_review") skip("Only pending review members can receive correction requests.");
}

function addReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

async function createBulkOperation(
  supabase: SupabaseClient<any>,
  params: { ctx: UserContext; action: AssociationMemberBulkAction; targetMode: "selected" | "filtered"; filterSnapshot: Record<string, unknown>; totalTargeted: number },
) {
  const { data, error } = await supabase.from("association_member_bulk_operations").insert({
    action: params.action,
    requested_by: params.ctx.appUserId,
    target_mode: params.targetMode,
    filter_snapshot: params.filterSnapshot,
    total_targeted: params.totalTargeted,
    status: "processing",
    metadata: { actor_role: params.ctx.role, chunk_size: ASSOCIATION_MEMBER_BULK_CHUNK_SIZE },
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

export async function runBulkAssociationMemberAction(
  supabase: SupabaseClient<any>,
  params: {
    ctx: UserContext;
    memberIds?: string[];
    filters?: AdminAssociationMemberFilters;
    targetMode: "selected" | "filtered";
    confirmed?: boolean;
    action: AssociationMemberBulkAction;
    reason?: string | null;
    assignedReviewerId?: string | null;
  },
): Promise<AssociationMemberBulkResult> {
  if (!(ASSOCIATION_MEMBER_BULK_ACTIONS as readonly string[]).includes(params.action)) throw new Error("Unsupported bulk action.");
  if (!["admin", "reviewer"].includes(params.ctx.role)) throw new Error("This role has read-only access.");
  if (params.targetMode === "filtered" && params.ctx.role !== "admin") throw new Error("Filtered bulk operations are available to administrators only.");
  if (params.ctx.role === "reviewer" && !["approve", "reject"].includes(params.action)) throw new Error("Reviewers can only bulk approve or reject selected members.");
  const uniqueIds = params.targetMode === "filtered"
    ? await resolveAssociationMemberBulkTargetIds(supabase, params.filters ?? {}, ASSOCIATION_MEMBER_FILTERED_BULK_LIMIT)
    : [...new Set((params.memberIds ?? []).map(clean).filter(Boolean))];
  const limit = params.targetMode === "filtered" ? ASSOCIATION_MEMBER_FILTERED_BULK_LIMIT : ASSOCIATION_MEMBER_SELECTED_BULK_LIMIT;
  if (!uniqueIds.length) throw new Error("Select at least one member.");
  if (uniqueIds.length > limit) throw new Error(`${params.targetMode === "filtered" ? "Filtered" : "Selected-row"} bulk operations are limited to ${limit.toLocaleString()} members.`);
  if (uniqueIds.length > 100 && !params.confirmed) throw new Error("Confirmation is required for bulk operations targeting more than 100 members.");

  const reason = clean(params.reason);
  const assignedReviewerId = clean(params.assignedReviewerId) || null;
  if (REASON_REQUIRED.has(params.action as AssociationMemberAction) && !reason) throw new Error("A reason is required for this action.");
  if (params.action === "assign_reviewer" && !assignedReviewerId) throw new Error("Select a reviewer before assigning members.");
  const filterSnapshot = params.targetMode === "filtered"
    ? associationMemberFiltersForDiagnostics(params.filters ?? {})
    : { selected_count: uniqueIds.length };
  const operationId = await createBulkOperation(supabase, { ctx: params.ctx, action: params.action, targetMode: params.targetMode, filterSnapshot, totalTargeted: uniqueIds.length });
  const result: AssociationMemberBulkResult = { operationId, action: params.action, targetMode: params.targetMode, totalTargeted: uniqueIds.length, successful: 0, skipped: 0, failed: 0, reasons: {}, report: [], accessDetails: params.action === "fast_track_activation" ? [] : undefined };
  const reservedPins = new Set<string>();

  for (let offset = 0; offset < uniqueIds.length; offset += ASSOCIATION_MEMBER_BULK_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(offset, offset + ASSOCIATION_MEMBER_BULK_CHUNK_SIZE);
    for (const memberId of chunk) {
      try {
        const member = await loadMember(supabase, memberId);
        assertBulkEligibility(member, params.action);
        if (params.action === "fast_track_activation") {
          result.accessDetails?.push(await generateAssociationMemberTemporaryAccess(supabase, { ctx: params.ctx, memberId, bulkOperationId: operationId, reservedPins }));
        } else if (params.action === "generate_invite" || params.action === "regenerate_invite") {
          await generateAssociationMemberInvite(supabase, { ctx: params.ctx, memberId, regenerate: params.action === "regenerate_invite", bulkOperationId: operationId });
        } else if (["mark_invite_sent", "mark_onboarding_started", "mark_onboarding_completed"].includes(params.action)) {
          await runAssociationMemberInvitationAction(supabase, { ctx: params.ctx, memberId, action: params.action as "mark_invite_sent" | "mark_onboarding_started" | "mark_onboarding_completed", bulkOperationId: operationId });
        } else {
          await runAssociationMemberAction(supabase, { ctx: params.ctx, memberId, action: params.action, reason, assignedReviewerId, bulkOperationId: operationId });
        }
        result.successful += 1;
      } catch (error) {
        const reasonText = error instanceof Error ? error.message : "Unable to process member.";
        const outcome = error instanceof AssociationMemberSkipError ? "skipped" : "failed";
        result[outcome] += 1;
        addReason(result.reasons, reasonText);
        result.report.push({ memberId, outcome, reason: reasonText });
      }
    }
  }

  const completedAt = new Date().toISOString();
  const { error: updateError } = await supabase.from("association_member_bulk_operations").update({
    success_count: result.successful,
    skipped_count: result.skipped,
    failed_count: result.failed,
    status: result.failed ? "completed_with_errors" : "completed",
    completed_at: completedAt,
    metadata: { actor_role: params.ctx.role, chunk_size: ASSOCIATION_MEMBER_BULK_CHUNK_SIZE, reasons: result.reasons },
  }).eq("id", operationId);
  if (updateError) throw updateError;
  if (result.accessDetails?.length) await recordAssociationMemberAccessExport(supabase, { ctx: params.ctx, details: result.accessDetails, bulkOperationId: operationId });
  return result;
}
