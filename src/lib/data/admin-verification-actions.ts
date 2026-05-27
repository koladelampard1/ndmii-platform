import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";
import { DOCUMENT_CATEGORIES, type VerificationDocumentCategory } from "@/lib/data/admin-verification-documents";
import type { VerificationReviewStatus } from "@/lib/data/admin-verification-workspace";

export const ADMIN_VERIFICATION_ACTIONS = [
  "start_review",
  "request_documents",
  "escalate",
  "mark_verified",
  "reject",
  "reopen",
  "save_notes",
  "reassign",
] as const;

export type AdminVerificationAction = (typeof ADMIN_VERIFICATION_ACTIONS)[number];

type ReviewRow = {
  id: string;
  msme_id: string;
  status: VerificationReviewStatus;
  assigned_reviewer_id: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  escalation_reason: string | null;
  rejection_reason: string | null;
  requested_documents: unknown;
  internal_notes: string | null;
};

type MsmeRow = {
  id: string;
  msme_id: string | null;
  business_name: string | null;
  verification_status: string | null;
  review_status: string | null;
};

type RequestedDocumentSpec = {
  documentType: VerificationDocumentCategory;
  label: string;
};

const ALLOWED_TRANSITIONS: Record<VerificationReviewStatus, VerificationReviewStatus[]> = {
  pending_review: ["under_review"],
  under_review: ["awaiting_documents", "verified", "rejected", "escalated"],
  awaiting_documents: ["under_review"],
  rejected: ["under_review"],
  verified: ["under_review"],
  escalated: ["under_review"],
};

const ACTION_TARGET_STATUS: Partial<Record<AdminVerificationAction, VerificationReviewStatus>> = {
  start_review: "under_review",
  request_documents: "awaiting_documents",
  escalate: "escalated",
  mark_verified: "verified",
  reject: "rejected",
  reopen: "under_review",
};

const STATUS_ACTION_MATRIX: Record<VerificationReviewStatus, AdminVerificationAction[]> = {
  pending_review: ["start_review", "save_notes", "reassign"],
  under_review: ["request_documents", "mark_verified", "reject", "escalate", "save_notes", "reassign"],
  awaiting_documents: ["start_review", "save_notes", "reassign"],
  rejected: ["start_review", "save_notes", "reassign"],
  escalated: ["start_review", "save_notes", "reassign"],
  verified: ["reopen", "save_notes", "reassign"],
};

const ACTIONS_REQUIRING_REASON = new Set<AdminVerificationAction>(["request_documents", "escalate", "mark_verified", "reject", "reopen"]);
const CANONICAL_REVIEW_STATUSES = ["pending_review", "under_review", "awaiting_documents", "escalated", "verified", "rejected"] as const;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function requestedDocumentsFromInput(value: unknown) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).slice(0, 12);
  return cleanText(value)
    .split(",")
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 12);
}

function requestedDocumentSpecsFromInput(value: unknown): RequestedDocumentSpec[] {
  const labels = requestedDocumentsFromInput(value);
  return labels.map((label) => {
    const [rawType, ...rest] = label.split("|");
    const documentType = (DOCUMENT_CATEGORIES as readonly string[]).includes(rawType) ? rawType as VerificationDocumentCategory : "OTHER";
    const cleanLabel = cleanText(rest.join("|")) || cleanText(rawType) || "Other requested document";
    return { documentType, label: cleanLabel };
  }).slice(0, 12);
}

function requestedDocumentLabels(specs: RequestedDocumentSpec[]) {
  return specs.map((spec) => spec.label);
}

function normalizeStatus(value: unknown): VerificationReviewStatus {
  const normalized = cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if ((CANONICAL_REVIEW_STATUSES as readonly string[]).includes(normalized)) return normalized as VerificationReviewStatus;
  return "pending_review";
}

function canWrite(ctx: UserContext) {
  return ctx.role === "admin" || ctx.role === "reviewer";
}

function assertAllowed(params: { ctx: UserContext; action: AdminVerificationAction; reason: string; requestedDocuments: string[] }) {
  if (!canWrite(params.ctx)) throw new Error("action_not_allowed_for_role");
  if (params.action === "reassign" && params.ctx.role !== "admin") throw new Error("admin_only_action");
  if (ACTIONS_REQUIRING_REASON.has(params.action) && !params.reason) throw new Error("reason_required");
  if (params.action === "request_documents" && params.requestedDocuments.length === 0) throw new Error("requested_documents_required");
}

function assertTransitionAllowed(fromStatus: VerificationReviewStatus, toStatus: VerificationReviewStatus) {
  if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    if (fromStatus === "awaiting_documents" && ["verified", "rejected", "escalated"].includes(toStatus)) {
      throw new Error("This verification must be resumed before a decision can be recorded.");
    }
    throw new Error(`invalid_verification_transition_${fromStatus}_to_${toStatus}`);
  }
}

function assertActionAllowedForStatus(action: AdminVerificationAction, status: VerificationReviewStatus) {
  if (action === "start_review" && status === "under_review") return;
  if (STATUS_ACTION_MATRIX[status]?.includes(action)) return;
  if (status === "awaiting_documents" && ["request_documents", "mark_verified", "reject", "escalate"].includes(action)) {
    throw new Error("This verification must be resumed before a decision can be recorded.");
  }
  throw new Error(`action_${action}_not_available_for_${status}`);
}

function noopMessage(action: AdminVerificationAction, status: VerificationReviewStatus) {
  if (action === "start_review" && status === "under_review") return "Review already active";
  return "No status change needed.";
}

async function loadMsme(supabase: SupabaseClient<any>, msmeId: string) {
  const { data, error } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,verification_status,review_status")
    .eq("id", msmeId)
    .maybeSingle<MsmeRow>();
  if (error) throw error;
  if (!data?.id) throw new Error("msme_not_found");
  return data;
}

async function loadOrCreateReview(supabase: SupabaseClient<any>, params: { msmeId: string; ctx: UserContext; timestamp: string }) {
  const { data: existing, error: readError } = await supabase
    .from("verification_reviews")
    .select("id,msme_id,status,assigned_reviewer_id,assigned_at,started_at,completed_at,escalation_reason,rejection_reason,requested_documents,internal_notes")
    .eq("msme_id", params.msmeId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ReviewRow>();
  if (readError) throw readError;
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from("verification_reviews")
    .insert({
      msme_id: params.msmeId,
      status: "pending_review",
      assigned_reviewer_id: params.ctx.role === "reviewer" || params.ctx.role === "admin" ? params.ctx.appUserId : null,
      assigned_at: params.ctx.appUserId ? params.timestamp : null,
    })
    .select("id,msme_id,status,assigned_reviewer_id,assigned_at,started_at,completed_at,escalation_reason,rejection_reason,requested_documents,internal_notes")
    .single<ReviewRow>();
  if (error) throw error;
  return data;
}

function buildReviewPatch(params: {
  action: AdminVerificationAction;
  fromStatus: VerificationReviewStatus;
  toStatus: VerificationReviewStatus | null;
  ctx: UserContext;
  reason: string;
  notes: string;
  requestedDocuments: string[];
  assignedReviewerId: string | null;
  timestamp: string;
}) {
  const patch: Record<string, unknown> = {};
  if (params.toStatus) {
    patch.status = params.toStatus;
    if (params.toStatus === "under_review") {
      patch.started_at = params.timestamp;
      patch.completed_at = null;
      if (params.action === "start_review" && params.ctx.appUserId) {
        patch.assigned_reviewer_id = params.ctx.appUserId;
        patch.assigned_at = params.timestamp;
      }
    }
    if (params.toStatus === "verified" || params.toStatus === "rejected") patch.completed_at = params.timestamp;
    if (params.toStatus === "escalated") patch.escalation_reason = params.reason;
    if (params.toStatus === "rejected") patch.rejection_reason = params.reason;
    if (params.toStatus !== "rejected") patch.rejection_reason = null;
  }
  if (params.action === "request_documents") patch.requested_documents = params.requestedDocuments;
  if (params.action === "save_notes") patch.internal_notes = params.notes;
  if (params.action === "reassign") {
    patch.assigned_reviewer_id = params.assignedReviewerId || null;
    patch.assigned_at = params.assignedReviewerId ? params.timestamp : null;
  }
  return patch;
}

async function recordStructuredDocumentRequests(
  supabase: SupabaseClient<any>,
  params: {
    reviewId: string;
    msmeId: string;
    ctx: UserContext;
    reason: string;
    specs: RequestedDocumentSpec[];
    timestamp: string;
  },
) {
  if (!params.specs.length) return;
  const { error } = await supabase.from("verification_document_requests").insert(
    params.specs.map((spec) => ({
      verification_review_id: params.reviewId,
      msme_id: params.msmeId,
      document_type: spec.documentType,
      label: spec.label,
      status: "requested",
      requested_by: params.ctx.appUserId,
      requested_at: params.timestamp,
      metadata: {
        source_workspace: "admin_verification_workspace",
        reason: params.reason,
      },
    })),
  );
  if (!error) return;
  if (["42P01", "42703"].includes(error.code ?? "")) {
    console.info("[admin-verification-actions]", {
      operation: "record_structured_document_requests",
      msmeId: params.msmeId,
      verificationReviewId: params.reviewId,
      documentCount: params.specs.length,
      supabaseErrorCode: error.code ?? null,
      supabaseErrorMessage: error.message ?? null,
    });
    return;
  }
  throw error;
}

function buildMsmePatch(action: AdminVerificationAction, toStatus: VerificationReviewStatus | null, timestamp: string, actorId: string | null) {
  const patch: Record<string, unknown> = {
    latest_admin_action: `verification_${action}`,
    latest_admin_action_at: timestamp,
    latest_admin_action_by: actorId,
  };
  if (toStatus) patch.review_status = toStatus;
  if (toStatus === "verified") patch.verification_status = "verified";
  if (toStatus === "rejected") patch.verification_status = "rejected";
  if (toStatus === "under_review" && action === "reopen") patch.verification_status = "pending";
  return patch;
}

async function recordReviewEvent(
  supabase: SupabaseClient<any>,
  params: {
    reviewId: string;
    actor: UserContext;
    action: AdminVerificationAction;
    previousStatus: VerificationReviewStatus | null;
    newStatus: VerificationReviewStatus | null;
    reason: string | null;
    requestedDocuments: string[];
    assignedReviewerId: string | null;
  },
) {
  const { error } = await supabase.from("verification_review_events").insert({
    verification_review_id: params.reviewId,
    event_type: params.action,
    actor_id: params.actor.appUserId,
    actor_role: params.actor.role,
    previous_status: params.previousStatus,
    new_status: params.newStatus,
    metadata: {
      source_workspace: "admin_verification_workspace",
      reason: params.reason,
      requested_documents: params.requestedDocuments,
      assigned_reviewer_id: params.assignedReviewerId,
    },
  });
  if (error) throw error;
}

async function recordActivityLog(
  supabase: SupabaseClient<any>,
  params: {
    actor: UserContext;
    action: AdminVerificationAction;
    msme: MsmeRow;
    reviewId: string;
    previousStatus: VerificationReviewStatus | null;
    newStatus: VerificationReviewStatus | null;
    reason: string | null;
    requestedDocuments: string[];
  },
) {
  const { error } = await supabase.from("activity_logs").insert({
    actor_user_id: params.actor.appUserId,
    action: `admin_verification_${params.action}`,
    entity_type: "verification_review",
    entity_id: params.reviewId,
    metadata: {
      actor_role: params.actor.role,
      target_msme_id: params.msme.id,
      target_business_id: params.msme.msme_id,
      source_workspace: "admin_verification_workspace",
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      reason: params.reason,
      requested_documents: params.requestedDocuments,
    },
  });
  if (error) throw error;
}

async function recordCommentIfNeeded(
  supabase: SupabaseClient<any>,
  params: { reviewId: string; ctx: UserContext; action: AdminVerificationAction; comment: string; timestamp: string },
) {
  if (!params.comment) return;
  const { error } = await supabase.from("verification_review_comments").insert({
    verification_review_id: params.reviewId,
    visibility: "internal",
    comment: params.comment,
    actor_id: params.ctx.appUserId,
    actor_role: params.ctx.role,
    created_at: params.timestamp,
  });
  if (error) throw error;
}

export async function runAdminVerificationAction(
  supabase: SupabaseClient<any>,
  params: {
    ctx: UserContext;
    msmeId: string;
    action: AdminVerificationAction;
    reason?: string | null;
    notes?: string | null;
    requestedDocuments?: string[] | string | null;
    assignedReviewerId?: string | null;
  },
) {
  const reason = cleanText(params.reason);
  const notes = cleanText(params.notes);
  const requestedDocumentSpecs = requestedDocumentSpecsFromInput(params.requestedDocuments);
  const requestedDocuments = requestedDocumentLabels(requestedDocumentSpecs);
  assertAllowed({ ctx: params.ctx, action: params.action, reason, requestedDocuments });

  const timestamp = nowIso();
  const msme = await loadMsme(supabase, params.msmeId);
  const review = await loadOrCreateReview(supabase, { msmeId: msme.id, ctx: params.ctx, timestamp });
  const fromStatus = normalizeStatus(review.status);
  const toStatus = ACTION_TARGET_STATUS[params.action] ? normalizeStatus(ACTION_TARGET_STATUS[params.action]) : null;
  console.info("[admin-verification-actions]", {
    operation: "verification_transition_check",
    actorRole: params.ctx.role,
    msmeId: msme.id,
    action: params.action,
    dbWorkflowStatus: review.status,
    requestedNextStatus: ACTION_TARGET_STATUS[params.action] ?? null,
    normalizedCurrentStatus: fromStatus,
    normalizedNextStatus: toStatus,
  });
  assertActionAllowedForStatus(params.action, fromStatus);
  if (toStatus && fromStatus === toStatus) {
    console.info("[admin-verification-actions]", {
      operation: "verification_transition_noop",
      actorRole: params.ctx.role,
      msmeId: msme.id,
      action: params.action,
      currentStatus: fromStatus,
      requestedNextStatus: toStatus,
      success: true,
    });
    return { review, noOp: true, message: noopMessage(params.action, fromStatus) };
  }
  if (toStatus) assertTransitionAllowed(fromStatus, toStatus);

  const patch = buildReviewPatch({
    action: params.action,
    fromStatus,
    toStatus,
    ctx: params.ctx,
    reason,
    notes,
    requestedDocuments,
    assignedReviewerId: cleanText(params.assignedReviewerId) || null,
    timestamp,
  });

  const { data: updated, error: updateError } = await supabase
    .from("verification_reviews")
    .update(patch)
    .eq("id", review.id)
    .select("id,msme_id,status,assigned_reviewer_id,assigned_at,started_at,completed_at,escalation_reason,rejection_reason,requested_documents,internal_notes")
    .single<ReviewRow>();
  if (updateError) throw updateError;

  const msmePatch = buildMsmePatch(params.action, toStatus, timestamp, params.ctx.appUserId);
  const { error: msmeUpdateError } = await supabase.from("msmes").update(msmePatch).eq("id", msme.id);
  if (msmeUpdateError) throw msmeUpdateError;

  const commentText = params.action === "save_notes" ? notes : reason;
  await recordCommentIfNeeded(supabase, { reviewId: review.id, ctx: params.ctx, action: params.action, comment: commentText, timestamp });
  if (params.action === "request_documents") {
    await recordStructuredDocumentRequests(supabase, {
      reviewId: review.id,
      msmeId: msme.id,
      ctx: params.ctx,
      reason,
      specs: requestedDocumentSpecs,
      timestamp,
    });
  }
  await recordReviewEvent(supabase, {
    reviewId: review.id,
    actor: params.ctx,
    action: params.action,
    previousStatus: fromStatus,
    newStatus: toStatus ?? normalizeStatus(updated.status),
    reason: reason || null,
    requestedDocuments,
    assignedReviewerId: cleanText(params.assignedReviewerId) || null,
  });
  await recordActivityLog(supabase, {
    actor: params.ctx,
    action: params.action,
    msme,
    reviewId: review.id,
    previousStatus: fromStatus,
    newStatus: toStatus ?? normalizeStatus(updated.status),
    reason: reason || null,
    requestedDocuments,
  });

  console.info("[admin-verification-actions]", {
    operation: "run_admin_verification_action",
    actorRole: params.ctx.role,
    msmeId: msme.id,
    action: params.action,
    previousStatus: fromStatus,
    newStatus: toStatus ?? updated.status,
    success: true,
  });

  return { review: updated, noOp: false, message: null };
}
