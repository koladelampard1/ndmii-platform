import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { UserContext } from "@/lib/auth/authorization";
import type { UserRole } from "@/types/roles";

export const ADMIN_MSME_ACTIONS = [
  "flag",
  "remove_flag",
  "suspend",
  "reinstate",
  "request_profile_review",
  "escalate_compliance_review",
  "add_internal_note",
] as const;

export type AdminMsmeAction = (typeof ADMIN_MSME_ACTIONS)[number];

type MsmeOperationalRow = {
  id: string;
  msme_id: string | null;
  business_name: string | null;
  review_status: string | null;
  verification_status: string | null;
  flagged: boolean | null;
  suspended: boolean | null;
  enforcement_note: string | null;
  operational_review_requested?: boolean | null;
  operational_escalated?: boolean | null;
  latest_admin_action?: string | null;
};

const ACTIONS_REQUIRING_REASON = new Set<AdminMsmeAction>([
  "flag",
  "remove_flag",
  "suspend",
  "reinstate",
  "escalate_compliance_review",
]);

const ADMIN_ONLY_ACTIONS = new Set<AdminMsmeAction>(["flag", "remove_flag", "suspend", "reinstate", "add_internal_note"]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function actorTypeForRole(role: UserRole) {
  if (role === "admin") return "admin";
  if (["reviewer", "fccpc_officer", "firs_officer", "nrs_officer"].includes(role)) return "reviewer";
  return "system";
}

export function canRunAdminMsmeAction(role: UserRole, action: AdminMsmeAction) {
  if (role === "admin") return true;
  if (role === "reviewer") return action === "request_profile_review" || action === "escalate_compliance_review";
  return false;
}

export function adminMsmeActionRequiresReason(action: AdminMsmeAction) {
  return ACTIONS_REQUIRING_REASON.has(action);
}

function assertActionAllowed(ctx: UserContext, action: AdminMsmeAction, reason: string) {
  if (!canRunAdminMsmeAction(ctx.role, action)) {
    throw new Error("action_not_allowed_for_role");
  }
  if (ADMIN_ONLY_ACTIONS.has(action) && ctx.role !== "admin") {
    throw new Error("admin_only_action");
  }
  if (ACTIONS_REQUIRING_REASON.has(action) && !reason) {
    throw new Error("reason_required");
  }
}

function nextPatch(action: AdminMsmeAction, msme: MsmeOperationalRow, reason: string, actorUserId: string | null, timestamp: string) {
  const patch: Record<string, unknown> = {
    latest_admin_action: action,
    latest_admin_action_at: timestamp,
    latest_admin_action_by: actorUserId,
  };

  if (action === "flag") {
    if (msme.flagged) throw new Error("msme_already_flagged");
    patch.flagged = true;
    patch.enforcement_note = reason;
  }

  if (action === "remove_flag") {
    if (!msme.flagged) throw new Error("msme_not_flagged");
    patch.flagged = false;
    patch.enforcement_note = reason;
  }

  if (action === "suspend") {
    if (msme.suspended) throw new Error("msme_already_suspended");
    patch.suspended = true;
    patch.verification_status = "suspended";
    patch.enforcement_note = reason;
  }

  if (action === "reinstate") {
    if (!msme.suspended) throw new Error("msme_not_suspended");
    patch.suspended = false;
    patch.verification_status = "verified";
    patch.enforcement_note = reason;
  }

  if (action === "request_profile_review") {
    patch.operational_review_requested = true;
    patch.review_status = "pending_review";
  }

  if (action === "escalate_compliance_review") {
    patch.operational_escalated = true;
    patch.review_status = "under_review";
    patch.enforcement_note = reason;
  }

  return patch;
}

function statusSnapshot(msme: MsmeOperationalRow) {
  return {
    flagged: Boolean(msme.flagged),
    suspended: Boolean(msme.suspended),
    verificationStatus: msme.verification_status ?? null,
    reviewStatus: msme.review_status ?? null,
    reviewRequested: Boolean(msme.operational_review_requested),
    escalated: Boolean(msme.operational_escalated),
    latestAdminAction: msme.latest_admin_action ?? null,
  };
}

async function recordActivityEvent(
  supabase: SupabaseClient<any>,
  params: {
    actor: UserContext;
    action: AdminMsmeAction | "bulk_flag" | "bulk_request_profile_review";
    msmeId: string;
    reason: string | null;
    sourceWorkspace: string;
    previousStatus: Record<string, unknown>;
    newStatus: Record<string, unknown>;
    bulkOperationId?: string | null;
  },
) {
  const { error } = await supabase.from("activity_logs").insert({
    actor_user_id: params.actor.appUserId,
    action: `admin_msme_${params.action}`,
    entity_type: "msme",
    entity_id: params.msmeId,
    metadata: {
      actor_role: params.actor.role,
      actor_name: params.actor.fullName,
      target_msme_id: params.msmeId,
      reason: params.reason,
      source_workspace: params.sourceWorkspace,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      bulk_operation_id: params.bulkOperationId ?? null,
    },
  });
  if (error) throw error;
}

async function recordComplianceEvent(
  supabase: SupabaseClient<any>,
  params: {
    actor: UserContext;
    action: AdminMsmeAction | "bulk_flag" | "bulk_request_profile_review";
    msmeId: string;
    reason: string | null;
    previousStatus: Record<string, unknown>;
    newStatus: Record<string, unknown>;
  },
) {
  const eventType =
    params.action === "suspend"
      ? "suspended"
      : params.action === "reinstate"
        ? "reinstated"
        : params.action === "request_profile_review" || params.action === "bulk_request_profile_review" || params.action === "escalate_compliance_review"
          ? "review_started"
          : "visibility_changed";

  const { error } = await supabase.from("compliance_events").insert({
    msme_id: params.msmeId,
    event_type: eventType,
    actor_user_id: params.actor.appUserId,
    actor_type: actorTypeForRole(params.actor.role),
    actor_role: params.actor.role,
    from_status: String(params.previousStatus.reviewStatus ?? params.previousStatus.verificationStatus ?? "unknown"),
    to_status: String(params.newStatus.reviewStatus ?? params.newStatus.verificationStatus ?? "unknown"),
    summary: `Admin MSME action: ${params.action.replaceAll("_", " ")}`,
    metadata: {
      reason: params.reason,
      source_workspace: "admin_msme_workspace",
      previous_status: params.previousStatus,
      new_status: params.newStatus,
    },
  });

  if (error) {
    console.info("[admin-msme-actions]", {
      operation: "record_compliance_event",
      actorRole: params.actor.role,
      msmeId: params.msmeId,
      action: params.action,
      success: false,
      supabaseErrorCode: error.code ?? null,
      supabaseErrorMessage: error.message ?? null,
    });
  }
}

async function recordCredentialSuspensionEvent(
  supabase: SupabaseClient<any>,
  params: { actor: UserContext; msmeId: string; reason: string },
) {
  const { data: credential, error: readError } = await supabase
    .from("digital_identity_credentials")
    .select("id,status")
    .eq("msme_id", params.msmeId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError || !credential?.id) return;

  const { error } = await supabase.from("credential_events").insert({
    credential_id: credential.id,
    action: "suspended",
    actor_role: params.actor.role,
    actor_id: params.actor.appUserId,
    metadata: {
      operation: "admin_msme_suspended",
      msmeId: params.msmeId,
      previousCredentialStatus: credential.status ?? null,
      reason: params.reason,
      source_workspace: "admin_msme_workspace",
    },
  });

  if (error) {
    console.info("[admin-msme-actions]", {
      operation: "record_credential_event",
      actorRole: params.actor.role,
      msmeId: params.msmeId,
      action: "suspend",
      success: false,
      supabaseErrorCode: error.code ?? null,
      supabaseErrorMessage: error.message ?? null,
    });
  }
}

export async function runAdminMsmeAction(
  supabase: SupabaseClient<any>,
  params: {
    ctx: UserContext;
    msmeId: string;
    action: AdminMsmeAction;
    reason?: string | null;
    sourceWorkspace?: string;
  },
) {
  const reason = cleanText(params.reason);
  assertActionAllowed(params.ctx, params.action, reason);
  const timestamp = nowIso();

  const { data: msme, error: readError } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,review_status,verification_status,flagged,suspended,enforcement_note,operational_review_requested,operational_escalated,latest_admin_action")
    .eq("id", params.msmeId)
    .maybeSingle<MsmeOperationalRow>();

  if (readError) throw readError;
  if (!msme?.id) throw new Error("msme_not_found");

  const previousStatus = statusSnapshot(msme);
  const patch = nextPatch(params.action, msme, reason, params.ctx.appUserId, timestamp);
  const { data: updated, error: updateError } = await supabase
    .from("msmes")
    .update(patch)
    .eq("id", msme.id)
    .select("id,msme_id,business_name,review_status,verification_status,flagged,suspended,enforcement_note,operational_review_requested,operational_escalated,latest_admin_action")
    .single<MsmeOperationalRow>();

  if (updateError) throw updateError;
  const newStatus = statusSnapshot(updated);

  if (params.action === "add_internal_note") {
    const { error: noteError } = await supabase.from("admin_internal_notes").insert({
      msme_id: msme.id,
      author_user_id: params.ctx.appUserId,
      author_role: params.ctx.role,
      note_body: reason || cleanText(params.reason),
    });
    if (noteError) throw noteError;
  }

  await recordActivityEvent(supabase, {
    actor: params.ctx,
    action: params.action,
    msmeId: msme.id,
    reason: reason || null,
    sourceWorkspace: params.sourceWorkspace ?? "admin_msme_workspace",
    previousStatus,
    newStatus,
  });
  await recordComplianceEvent(supabase, {
    actor: params.ctx,
    action: params.action,
    msmeId: msme.id,
    reason: reason || null,
    previousStatus,
    newStatus,
  });
  if (params.action === "suspend") {
    await recordCredentialSuspensionEvent(supabase, { actor: params.ctx, msmeId: msme.id, reason });
  }

  console.info("[admin-msme-actions]", {
    operation: "run_admin_msme_action",
    actorRole: params.ctx.role,
    msmeId: msme.id,
    action: params.action,
    success: true,
  });

  return updated;
}

export async function runBulkAdminMsmeAction(
  supabase: SupabaseClient<any>,
  params: {
    ctx: UserContext;
    msmeIds: string[];
    action: Extract<AdminMsmeAction, "flag" | "request_profile_review">;
    reason?: string | null;
  },
) {
  const ids = Array.from(new Set(params.msmeIds.map(cleanText).filter(Boolean))).slice(0, 100);
  if (!ids.length) throw new Error("no_msmes_selected");
  const bulkOperationId = randomUUID();
  for (const msmeId of ids) {
    await runAdminMsmeAction(supabase, {
      ctx: params.ctx,
      msmeId,
      action: params.action,
      reason: params.reason,
      sourceWorkspace: `admin_msme_registry_bulk:${bulkOperationId}`,
    });
  }
  return { count: ids.length, bulkOperationId };
}
