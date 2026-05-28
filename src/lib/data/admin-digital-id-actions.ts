import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";
import {
  CREDENTIAL_SIGNATURE_VERSION,
  credentialVerifyPath,
  generateCredentialToken,
  hashCredentialToken,
  nextCredentialExpiry,
  signCredentialTokenHash,
} from "@/lib/data/credential-trust";
import {
  ADMIN_DIGITAL_ID_ACTION_TARGET_STATUS,
  ADMIN_DIGITAL_ID_LIFECYCLE_ACTIONS,
  ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX,
  adminDigitalIdActionAlreadyAppliedMessage,
  canRoleRunAdminDigitalIdAction,
  normalizeDigitalIdLifecycleStatus,
  type AdminDigitalIdAction,
  type DigitalIdLifecycleStatus,
} from "@/lib/data/admin-digital-id-lifecycle";
import type { UserRole } from "@/types/roles";

export {
  ADMIN_DIGITAL_ID_ACTIONS,
  ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX,
  ADMIN_DIGITAL_ID_LIFECYCLE_TRANSITIONS,
  canRoleRunAdminDigitalIdAction,
  getAdminDigitalIdAllowedLifecycleActions,
  normalizeDigitalIdLifecycleStatus,
  type AdminDigitalIdAction,
  type DigitalIdLifecycleStatus,
} from "@/lib/data/admin-digital-id-lifecycle";

type CredentialRow = {
  id: string;
  msme_id: string;
  ndmii_id: string;
  status: string | null;
  approved_at?: string | null;
  revoked_at?: string | null;
  suspended_at?: string | null;
  token_expires_at?: string | null;
  regeneration_count?: number | null;
  last_regenerated_at?: string | null;
  lifecycle_version?: number | null;
};

type MsmeRow = {
  id: string;
  msme_id: string | null;
  business_name: string | null;
  review_status: string | null;
  verification_status: string | null;
  suspended: boolean | null;
};

const SOURCE_WORKSPACE = "admin_digital_id_lifecycle_workspace";
const REASON_REQUIRED = new Set<AdminDigitalIdAction>(["suspend", "revoke", "regenerate_token", "reinstate"]);

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

export function canRunAdminDigitalIdAction(role: UserRole, action: AdminDigitalIdAction) {
  return canRoleRunAdminDigitalIdAction(role, action);
}

export function adminDigitalIdActionRequiresReason(action: AdminDigitalIdAction) {
  return REASON_REQUIRED.has(action);
}

function assertRole(ctx: UserContext, action: AdminDigitalIdAction) {
  if (!canRunAdminDigitalIdAction(ctx.role, action)) throw new Error("action_not_allowed_for_role");
  if (action === "revoke" && !["admin", "super_admin"].includes(ctx.role)) throw new Error("revoke_requires_admin");
  if (action === "assign" && !["admin", "super_admin"].includes(ctx.role)) throw new Error("assign_requires_admin");
  if (action === "regenerate_token" && !["admin", "super_admin"].includes(ctx.role)) throw new Error("regeneration_requires_admin");
}

function assertReason(action: AdminDigitalIdAction, reason: string, override: boolean) {
  if (REASON_REQUIRED.has(action) && !reason) throw new Error("reason_required");
  if (override && !reason) throw new Error("override_reason_required");
}

function assertTransitionAllowed(from: DigitalIdLifecycleStatus, action: AdminDigitalIdAction, to: DigitalIdLifecycleStatus, reason: string) {
  if (from === "pending" && to === "revoked" && !reason) throw new Error("pending_revocation_requires_review_reason");
  if (!ADMIN_DIGITAL_ID_LIFECYCLE_MATRIX[from]?.includes(action)) throw new Error(`action_${action}_not_available_for_${from}`);
}

async function loadCredential(supabase: SupabaseClient<any>, credentialId: string) {
  const { data, error } = await supabase
    .from("digital_identity_credentials")
    .select("id,msme_id,ndmii_id,status,approved_at,revoked_at,suspended_at,token_expires_at,regeneration_count,last_regenerated_at,lifecycle_version")
    .eq("id", credentialId)
    .maybeSingle<CredentialRow>();
  if (!error) {
    if (!data?.id) throw new Error("credential_not_found");
    return data;
  }

  const fallback = await supabase
    .from("digital_identity_credentials")
    .select("id,msme_id,ndmii_id,status,approved_at,revoked_at,suspended_at,token_expires_at")
    .eq("id", credentialId)
    .maybeSingle<CredentialRow>();
  if (fallback.error) throw fallback.error;
  if (!fallback.data?.id) throw new Error("credential_not_found");
  return fallback.data;
}

async function loadMsme(supabase: SupabaseClient<any>, msmeId: string) {
  const { data, error } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,review_status,verification_status,suspended")
    .eq("id", msmeId)
    .maybeSingle<MsmeRow>();
  if (error) throw error;
  if (!data?.id) throw new Error("msme_not_found");
  return data;
}

async function ensureNoOtherActiveCredential(supabase: SupabaseClient<any>, credential: CredentialRow) {
  const { data, error } = await supabase
    .from("digital_identity_credentials")
    .select("id")
    .eq("msme_id", credential.msme_id)
    .eq("status", "active")
    .neq("id", credential.id)
    .limit(1);
  if (error) throw error;
  if ((data ?? []).length) throw new Error("multiple_active_credentials_for_msme_blocked");
}

async function updateCredential(supabase: SupabaseClient<any>, credentialId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("digital_identity_credentials")
    .update(patch)
    .eq("id", credentialId)
    .select("id,msme_id,ndmii_id,status,approved_at,revoked_at,suspended_at,token_expires_at,regeneration_count,last_regenerated_at,lifecycle_version")
    .single<CredentialRow>();
  if (!error) return data;

  if (!["42703", "PGRST204"].includes(error.code ?? "")) throw error;
  const fallbackPatch = Object.fromEntries(
    Object.entries(patch).filter(([key]) => !["lifecycle_version", "lifecycle_reason", "lifecycle_source", "assigned_reviewer_id", "assigned_admin_id", "internal_notes", "renewal_requested_at", "renewal_requested_by", "last_regenerated_at", "regeneration_count", "token_invalidated_at"].includes(key)),
  );
  const fallback = await supabase
    .from("digital_identity_credentials")
    .update(fallbackPatch)
    .eq("id", credentialId)
    .select("id,msme_id,ndmii_id,status,approved_at,revoked_at,suspended_at,token_expires_at")
    .single<CredentialRow>();
  if (fallback.error) throw fallback.error;
  return fallback.data;
}

async function recordCredentialEvent(
  supabase: SupabaseClient<any>,
  params: {
    credential: CredentialRow;
    msme: MsmeRow;
    actor: UserContext;
    action: AdminDigitalIdAction;
    previousStatus: DigitalIdLifecycleStatus;
    newStatus: DigitalIdLifecycleStatus;
    reason: string | null;
    lifecycleVersion: number;
    assignedUserId?: string | null;
    publicRouteExposed?: boolean;
  },
) {
  const eventAction = params.action === "activate" || params.action === "approve_renewal" || params.action === "reinstate"
    ? "approved"
    : params.action === "regenerate_token"
      ? "reissued"
      : params.action === "save_note"
        ? "note_saved"
        : params.action === "start_renewal"
          ? "renewal_requested"
          : params.action === "assign"
            ? "assigned"
            : params.newStatus;

  const { error } = await supabase.from("credential_events").insert({
    credential_id: params.credential.id,
    action: eventAction,
    actor_role: params.actor.role,
    actor_id: params.actor.appUserId,
    metadata: {
      actor_id: params.actor.appUserId,
      actor_role: params.actor.role,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      reason: params.reason,
      source_workspace: SOURCE_WORKSPACE,
      credential_id: params.credential.id,
      msme_id: params.msme.id,
      business_id: params.msme.msme_id,
      lifecycle_version: params.lifecycleVersion,
      assigned_user_id: params.assignedUserId ?? null,
      public_verification_route_exposed_once: Boolean(params.publicRouteExposed),
    },
  });
  if (error) throw error;
}

async function recordActivityLog(
  supabase: SupabaseClient<any>,
  params: {
    credential: CredentialRow;
    msme: MsmeRow;
    actor: UserContext;
    action: AdminDigitalIdAction;
    previousStatus: DigitalIdLifecycleStatus;
    newStatus: DigitalIdLifecycleStatus;
    reason: string | null;
    lifecycleVersion: number;
  },
) {
  const { error } = await supabase.from("activity_logs").insert({
    actor_user_id: params.actor.appUserId,
    action: `admin_digital_id_${params.action}`,
    entity_type: "digital_identity_credential",
    entity_id: params.credential.id,
    metadata: {
      actor_id: params.actor.appUserId,
      actor_role: params.actor.role,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      reason: params.reason,
      source_workspace: SOURCE_WORKSPACE,
      credential_id: params.credential.id,
      msme_id: params.msme.id,
      business_id: params.msme.msme_id,
      lifecycle_version: params.lifecycleVersion,
    },
  });
  if (error) throw error;
}

async function synchronizeOperationalState(
  supabase: SupabaseClient<any>,
  params: { credential: CredentialRow; msme: MsmeRow; status: DigitalIdLifecycleStatus; reason: string | null; actor: UserContext; timestamp: string },
) {
  const msmePatch: Record<string, unknown> = {
    latest_admin_action: `digital_id_${params.status}`,
    latest_admin_action_at: params.timestamp,
    latest_admin_action_by: params.actor.appUserId,
  };

  if (params.status === "active") {
    msmePatch.suspended = false;
    msmePatch.verification_status = "verified";
    msmePatch.review_status = "approved";
  }
  if (params.status === "suspended") {
    msmePatch.suspended = true;
    msmePatch.verification_status = "suspended";
    msmePatch.enforcement_note = params.reason;
  }
  if (params.status === "revoked") {
    msmePatch.suspended = true;
    msmePatch.verification_status = "revoked";
    msmePatch.enforcement_note = params.reason;
  }
  if (params.status === "expired") {
    msmePatch.verification_status = "expired";
  }
  if (params.status === "renewal_pending") {
    msmePatch.verification_status = "renewal_pending";
    msmePatch.review_status = "pending_review";
  }

  const { error: msmeError } = await supabase.from("msmes").update(msmePatch).eq("id", params.msme.id);
  if (msmeError) throw msmeError;

  const marketplacePatch = params.status === "active"
    ? { trust_score: 80, updated_at: params.timestamp }
    : { trust_score: params.status === "renewal_pending" ? 55 : 0, is_featured: false, updated_at: params.timestamp };
  const { error: marketplaceError } = await supabase.from("provider_profiles").update(marketplacePatch).eq("msme_id", params.msme.id);
  if (marketplaceError && !["42P01", "42703"].includes(marketplaceError.code ?? "")) throw marketplaceError;
}

function buildStatusPatch(params: {
  action: AdminDigitalIdAction;
  from: DigitalIdLifecycleStatus;
  to: DigitalIdLifecycleStatus;
  actor: UserContext;
  reason: string;
  timestamp: string;
  lifecycleVersion: number;
}) {
  const patch: Record<string, unknown> = {
    status: params.to,
    updated_at: params.timestamp,
    lifecycle_version: params.lifecycleVersion,
    lifecycle_reason: params.reason || null,
    lifecycle_source: SOURCE_WORKSPACE,
  };

  if (params.to === "active") {
    patch.approved_at = params.timestamp;
    patch.approved_by = params.actor.appUserId;
    patch.revoked_at = null;
    patch.revoked_by = null;
    patch.revocation_reason = null;
    patch.suspended_at = null;
    patch.suspended_by = null;
  }
  if (params.to === "suspended") {
    patch.suspended_at = params.timestamp;
    patch.suspended_by = params.actor.appUserId;
    patch.revocation_reason = params.reason;
  }
  if (params.to === "revoked") {
    patch.revoked_at = params.timestamp;
    patch.revoked_by = params.actor.appUserId;
    patch.revocation_reason = params.reason;
    patch.qr_code_ref = null;
    patch.token_invalidated_at = params.timestamp;
  }
  if (params.to === "expired") {
    patch.token_expires_at = params.timestamp;
  }
  if (params.to === "renewal_pending") {
    patch.renewal_requested_at = params.timestamp;
    patch.renewal_requested_by = params.actor.appUserId;
  }

  return patch;
}

export async function runAdminDigitalIdAction(
  supabase: SupabaseClient<any>,
  params: {
    ctx: UserContext;
    credentialId: string;
    action: AdminDigitalIdAction;
    reason?: string | null;
    note?: string | null;
    assignedReviewerId?: string | null;
    assignedAdminId?: string | null;
    override?: boolean;
  },
) {
  const reason = cleanText(params.reason);
  const note = cleanText(params.note);
  const override = Boolean(params.override);
  assertRole(params.ctx, params.action);

  const timestamp = nowIso();
  const credential = await loadCredential(supabase, params.credentialId);
  const msme = await loadMsme(supabase, credential.msme_id);
  const from = normalizeDigitalIdLifecycleStatus(credential.status);
  let to = ADMIN_DIGITAL_ID_ACTION_TARGET_STATUS[params.action] ?? from;
  let publicRoute: string | null = null;

  console.info("[admin-digital-id-lifecycle]", {
    credentialId: credential.id,
    currentStatus: credential.status ?? null,
    requestedAction: params.action,
    normalizedStatus: from,
    actorRole: params.ctx.role,
  });

  if (to === from && ADMIN_DIGITAL_ID_LIFECYCLE_ACTIONS.has(params.action)) {
    return { credential, publicRoute: null, noOp: true, message: adminDigitalIdActionAlreadyAppliedMessage(from) };
  }

  assertReason(params.action, reason, override);

  const lifecycleVersion = Number(credential.lifecycle_version ?? 0) + 1;
  let patch: Record<string, unknown> = { updated_at: timestamp, lifecycle_version: lifecycleVersion, lifecycle_reason: reason || null, lifecycle_source: SOURCE_WORKSPACE };

  if (params.action === "save_note") {
    if (!note) throw new Error("note_required");
    patch.internal_notes = note;
  } else if (params.action === "assign") {
    patch.assigned_reviewer_id = cleanText(params.assignedReviewerId) || null;
    patch.assigned_admin_id = cleanText(params.assignedAdminId) || null;
  } else if (params.action === "regenerate_token") {
    assertTransitionAllowed(from, params.action, from, reason);
    const count = Number(credential.regeneration_count ?? 0);
    const lastTime = Date.parse(credential.last_regenerated_at ?? "");
    if (count >= 3 && Number.isFinite(lastTime) && Date.now() - lastTime < 86_400_000) throw new Error("excessive_regeneration_blocked");
    const token = generateCredentialToken();
    const publicTokenHash = hashCredentialToken(token);
    publicRoute = credentialVerifyPath(token);
    patch = {
      ...patch,
      public_token: token,
      public_token_hash: publicTokenHash,
      public_signature: signCredentialTokenHash({ tokenHash: publicTokenHash, ndmiiId: credential.ndmii_id }),
      signature_version: CREDENTIAL_SIGNATURE_VERSION,
      token_expires_at: nextCredentialExpiry(new Date(timestamp)),
      qr_code_ref: publicRoute,
      regeneration_count: count + 1,
      last_regenerated_at: timestamp,
      token_invalidated_at: timestamp,
    };
  } else {
    if (!to) throw new Error("missing_target_status");
    assertTransitionAllowed(from, params.action, to, reason);
    if (to === "active") await ensureNoOtherActiveCredential(supabase, credential);
    patch = buildStatusPatch({ action: params.action, from, to, actor: params.ctx, reason, timestamp, lifecycleVersion });
  }

  const updated = await updateCredential(supabase, credential.id, patch);
  to = normalizeDigitalIdLifecycleStatus(updated.status);

  if (!["save_note", "assign", "regenerate_token"].includes(params.action)) {
    await synchronizeOperationalState(supabase, { credential: updated, msme, status: to, reason: reason || null, actor: params.ctx, timestamp });
  }

  await recordCredentialEvent(supabase, {
    credential: updated,
    msme,
    actor: params.ctx,
    action: params.action,
    previousStatus: from,
    newStatus: to,
    reason: reason || (params.action === "save_note" ? note : null),
    lifecycleVersion,
    assignedUserId: cleanText(params.assignedReviewerId) || cleanText(params.assignedAdminId) || null,
    publicRouteExposed: Boolean(publicRoute),
  });
  await recordActivityLog(supabase, {
    credential: updated,
    msme,
    actor: params.ctx,
    action: params.action,
    previousStatus: from,
    newStatus: to,
    reason: reason || (params.action === "save_note" ? note : null),
    lifecycleVersion,
  });

  return { credential: updated, publicRoute, noOp: false, message: null };
}
