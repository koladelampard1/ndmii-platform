import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";

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
] as const;

export type AssociationMemberAction = (typeof ASSOCIATION_MEMBER_ACTIONS)[number];
type MemberStatus = "imported" | "pending_review" | "approved" | "rejected" | "correction_requested" | "duplicate_review" | "pending_activation" | "active" | "orphaned";
type MemberRow = {
  id: string;
  association_id: string;
  member_status: MemberStatus;
  duplicate_signal: boolean | null;
  assigned_reviewer_id: string | null;
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
  pending_activation: [],
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

function assertRole(ctx: UserContext, action: AssociationMemberAction) {
  if (!["admin", "reviewer"].includes(ctx.role)) throw new Error("This role has read-only access.");
  if (["mark_duplicate", "remove_duplicate_flag", "assign_reviewer", "prepare_activation"].includes(action) && ctx.role !== "admin") {
    throw new Error("This action is available to administrators only.");
  }
}

function assertTransition(from: MemberStatus, to: MemberStatus) {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) throw new Error(`Invalid association member transition from ${from} to ${to}.`);
}

async function loadMember(supabase: SupabaseClient<any>, memberId: string) {
  const { data, error } = await supabase
    .from("association_members")
    .select("id,association_id,member_status,duplicate_signal,assigned_reviewer_id")
    .eq("id", memberId)
    .maybeSingle<MemberRow>();
  if (error) throw error;
  if (!data?.id) throw new Error("Association member not found.");
  return data;
}

async function writeAudit(
  supabase: SupabaseClient<any>,
  params: { ctx: UserContext; member: MemberRow; action: AssociationMemberAction; previousStatus: MemberStatus; newStatus: MemberStatus; reason: string; timestamp: string },
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
  params: { ctx: UserContext; memberId: string; action: AssociationMemberAction; reason?: string | null; notes?: string | null; assignedReviewerId?: string | null },
) {
  const reason = clean(params.reason);
  const notes = clean(params.notes);
  const assignedReviewerId = clean(params.assignedReviewerId) || null;
  if (!(ASSOCIATION_MEMBER_ACTIONS as readonly string[]).includes(params.action)) throw new Error("Unknown association member action.");
  assertRole(params.ctx, params.action);
  if (REASON_REQUIRED.has(params.action) && !reason) throw new Error("A reason is required for this action.");
  const member = await loadMember(supabase, params.memberId);
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
  await writeAudit(supabase, { ctx: params.ctx, member, action: params.action, previousStatus: member.member_status, newStatus: nextStatus, reason: reason || notes, timestamp });
  return { memberId: member.id, previousStatus: member.member_status, newStatus: nextStatus };
}

export async function runBulkAssociationMemberAction(
  supabase: SupabaseClient<any>,
  params: { ctx: UserContext; memberIds: string[]; action: "approve" | "reject" | "assign_reviewer"; reason?: string | null; assignedReviewerId?: string | null },
) {
  const uniqueIds = [...new Set(params.memberIds.map(clean).filter(Boolean))].slice(0, 200);
  if (!uniqueIds.length) throw new Error("Select at least one member.");
  const results = [];
  for (const memberId of uniqueIds) {
    results.push(await runAssociationMemberAction(supabase, { ...params, memberId }));
  }
  return results;
}
