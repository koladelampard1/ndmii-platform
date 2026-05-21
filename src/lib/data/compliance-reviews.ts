import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@/lib/auth/authorization";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { toSupabaseErrorInfo } from "@/lib/data/compliance-evidence";

export const COMPLIANCE_REVIEWER_ROLES = ["admin", "reviewer", "fccpc_officer", "firs_officer", "nrs_officer"] as const;
export const COMPLIANCE_REVIEW_STATUSES = ["pending_review", "under_review", "approved", "rejected", "changes_requested"] as const;

export type ComplianceReviewAction = "assign" | "approve" | "reject" | "request_changes" | "reopen";
export type ComplianceReviewStatus = (typeof COMPLIANCE_REVIEW_STATUSES)[number];

type ComplianceItemReviewRow = {
  id: string;
  msme_id: string;
  regulator_id: string;
  status: string | null;
  reviewer_user_id: string | null;
  latest_review_id: string | null;
};

type ComplianceReviewRow = {
  id: string;
  msme_id: string;
  compliance_item_id: string;
  regulator_id: string;
  reviewer_user_id: string | null;
  review_status: ComplianceReviewStatus | string;
};

type ReviewDiagnostic = {
  operation: string;
  msmeId?: string | null;
  complianceItemId?: string | null;
  reviewId?: string | null;
  reviewerRole?: string | null;
  transition?: string | null;
  exportCount?: number | null;
  supabaseCode?: string | null;
  supabaseMessage?: string | null;
};

const ACTIVE_REVIEW_STATUSES = ["pending_review", "under_review"];

export function logComplianceReviewDiagnostic(payload: ReviewDiagnostic) {
  console.info("[compliance-review]", payload);
}

export function canUseComplianceReviewQueue(ctx: Pick<UserContext, "role" | "appUserId">) {
  return Boolean(ctx.appUserId && COMPLIANCE_REVIEWER_ROLES.includes(ctx.role as (typeof COMPLIANCE_REVIEWER_ROLES)[number]));
}

export function canReviewRegulator(ctx: Pick<UserContext, "role">, regulatorCode?: string | null) {
  const code = String(regulatorCode ?? "").toUpperCase();
  if (ctx.role === "admin" || ctx.role === "reviewer") return true;
  if (ctx.role === "firs_officer" || ctx.role === "nrs_officer") return ["FIRS", "VAT"].includes(code);
  if (ctx.role === "fccpc_officer") return ["PLATFORM_KYC", "CAC", "SON", "NAFDAC", "LOCAL_AUTHORITY"].includes(code);
  return false;
}

function actorTypeForRole(role: string) {
  if (role === "msme") return "msme";
  if (role === "admin") return "admin";
  if (["reviewer", "fccpc_officer", "firs_officer", "nrs_officer"].includes(role)) return "reviewer";
  return "system";
}

function eventTypeForReviewStatus(status: string) {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "changes_requested") return "changes_requested";
  if (status === "under_review") return "review_started";
  return "review_created";
}

function reviewStatusForAction(action: ComplianceReviewAction): ComplianceReviewStatus {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  if (action === "request_changes") return "changes_requested";
  return "under_review";
}

function itemStatusForAction(action: ComplianceReviewAction) {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  if (action === "request_changes") return "changes_requested";
  return "under_review";
}

function msmeVisibleSummary(status: string) {
  if (status === "approved") return "Compliance review approved.";
  if (status === "rejected") return "Compliance review rejected.";
  if (status === "changes_requested") return "Compliance changes requested.";
  if (status === "resubmitted") return "Compliance item resubmitted for review.";
  return "Compliance review submitted.";
}

async function insertComplianceEvent(
  supabase: SupabaseClient<any>,
  params: {
    msmeId?: string | null;
    complianceItemId?: string | null;
    regulatorId?: string | null;
    eventType: string;
    actorUserId: string | null;
    actorRole: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("compliance_events").insert({
    msme_id: params.msmeId ?? null,
    compliance_item_id: params.complianceItemId ?? null,
    regulator_id: params.regulatorId ?? null,
    event_type: params.eventType,
    actor_user_id: params.actorUserId,
    actor_type: actorTypeForRole(params.actorRole),
    actor_role: params.actorRole,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    summary: params.summary,
    metadata: params.metadata ?? {},
  });

  if (error) {
    const errorInfo = toSupabaseErrorInfo(error);
    logComplianceReviewDiagnostic({
      operation: "event_insert_failed",
      msmeId: params.msmeId,
      complianceItemId: params.complianceItemId,
      reviewerRole: params.actorRole,
      transition: `${params.fromStatus ?? "none"}->${params.toStatus ?? "none"}`,
      supabaseCode: errorInfo.code,
      supabaseMessage: errorInfo.message,
    });
  }
}

async function recalculateComplianceProfile(supabase: SupabaseClient<any>, msmeId: string) {
  const { data, error } = await supabase
    .from("msme_compliance_items")
    .select("id,status,is_required,expires_at,submitted_at,approved_at,rejected_at,updated_at")
    .eq("msme_id", msmeId)
    .is("renewal_of", null);

  if (error) throw error;

  const items = (data ?? []) as Array<{
    status: string | null;
    is_required: boolean | null;
    expires_at: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    updated_at: string | null;
  }>;
  const requiredItems = items.filter((item) => item.is_required);
  const approvedRequiredCount = requiredItems.filter((item) => item.status === "approved").length;
  const expiredPenalty = requiredItems.filter((item) => ["expired", "suspended", "revoked"].includes(item.status ?? "")).length * 20;
  const rejectedPenalty = requiredItems.filter((item) => item.status === "rejected").length * 10;
  const complianceScore = requiredItems.length ? Math.max(0, Math.min(100, Math.round((approvedRequiredCount / requiredItems.length) * 100) - expiredPenalty - rejectedPenalty)) : 0;

  const overallStatus =
    items.some((item) => ["suspended", "revoked"].includes(item.status ?? "")) ? "suspended" :
    items.some((item) => item.status === "expired") ? "expired" :
    items.some((item) => item.status === "rejected") ? "rejected" :
    items.some((item) => item.status === "changes_requested") ? "changes_requested" :
    items.some((item) => ["submitted", "resubmitted", "under_review"].includes(item.status ?? "")) ? "under_review" :
    requiredItems.length > 0 && requiredItems.every((item) => item.status === "approved") ? "approved" :
    "not_started";

  const riskLevel =
    items.some((item) => ["suspended", "revoked", "expired"].includes(item.status ?? "")) ? "critical" :
    items.some((item) => ["rejected", "changes_requested"].includes(item.status ?? "")) ? "high" :
    items.some((item) => ["not_started", "draft", "submitted", "resubmitted", "under_review"].includes(item.status ?? "")) ? "medium" :
    items.length > 0 ? "low" :
    "medium";

  const latest = (values: Array<string | null>) => {
    const times = values.filter(Boolean).map((value) => new Date(value as string).getTime()).filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
  };
  const earliest = (values: Array<string | null>) => {
    const times = values.filter(Boolean).map((value) => new Date(value as string).getTime()).filter(Number.isFinite);
    return times.length ? new Date(Math.min(...times)).toISOString() : null;
  };

  const { error: profileError } = await supabase.from("msme_compliance_profiles").upsert(
    {
      msme_id: msmeId,
      overall_status: overallStatus,
      compliance_score: complianceScore,
      risk_level: riskLevel,
      total_required_count: requiredItems.length,
      approved_count: items.filter((item) => item.status === "approved").length,
      pending_count: items.filter((item) => ["not_started", "draft", "submitted", "resubmitted"].includes(item.status ?? "")).length,
      under_review_count: items.filter((item) => item.status === "under_review").length,
      changes_requested_count: items.filter((item) => item.status === "changes_requested").length,
      rejected_count: items.filter((item) => item.status === "rejected").length,
      expired_count: items.filter((item) => item.status === "expired").length,
      expiring_soon_count: items.filter((item) => item.status === "expiring_soon").length,
      suspended_count: items.filter((item) => item.status === "suspended").length,
      revoked_count: items.filter((item) => item.status === "revoked").length,
      last_submitted_at: latest(items.map((item) => item.submitted_at)),
      last_reviewed_at: latest(items.flatMap((item) => [item.approved_at, item.rejected_at, item.updated_at])),
      next_deadline_at: earliest(items.map((item) => item.expires_at)),
      last_recalculated_at: new Date().toISOString(),
      metadata: { source: "phase3_reviewer_workflow" },
    },
    { onConflict: "msme_id" },
  );

  if (profileError) throw profileError;
}

async function getActiveReview(supabase: SupabaseClient<any>, complianceItemId: string) {
  const { data, error } = await supabase
    .from("compliance_reviews")
    .select("id,msme_id,compliance_item_id,regulator_id,reviewer_user_id,review_status")
    .eq("compliance_item_id", complianceItemId)
    .in("review_status", ACTIVE_REVIEW_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ComplianceReviewRow | null;
}

async function createPendingReview(supabase: SupabaseClient<any>, item: ComplianceItemReviewRow, ctx: UserContext, previousStatus: string | null) {
  const { data, error } = await supabase
    .from("compliance_reviews")
    .insert({
      msme_id: item.msme_id,
      compliance_item_id: item.id,
      regulator_id: item.regulator_id,
      reviewer_user_id: ctx.role === "msme" ? null : ctx.appUserId,
      review_status: ctx.role === "msme" ? "pending_review" : "under_review",
      previous_status: previousStatus,
      new_status: ctx.role === "msme" ? "submitted" : "under_review",
      internal_notes: ctx.role === "msme" ? null : "Review session opened from reviewer queue.",
    })
    .select("id,msme_id,compliance_item_id,regulator_id,reviewer_user_id,review_status")
    .single();

  if (error) throw error;

  await insertComplianceEvent(supabase, {
    msmeId: item.msme_id,
    complianceItemId: item.id,
    regulatorId: item.regulator_id,
    eventType: "review_created",
    actorUserId: ctx.appUserId,
    actorRole: ctx.role,
    fromStatus: previousStatus,
    toStatus: ctx.role === "msme" ? "submitted" : "under_review",
    summary: ctx.role === "msme" ? "Compliance review submitted." : "Compliance review session created.",
    metadata: { phase: "phase3", notification_event: ctx.role === "msme" ? "review_submitted" : "review_created" },
  });

  return data as ComplianceReviewRow;
}

export async function submitComplianceItemForReview(ctx: UserContext, complianceItemId: string) {
  if (ctx.role !== "msme" || !ctx.linkedMsmeId || !ctx.appUserId) {
    throw new Error("Only the MSME owner can submit compliance evidence for review.");
  }

  const supabase = await createServiceRoleSupabaseClient();
  const { data: item, error } = await supabase
    .from("msme_compliance_items")
    .select("id,msme_id,regulator_id,status,reviewer_user_id,latest_review_id")
    .eq("id", complianceItemId)
    .maybeSingle();

  if (error || !item) throw error ?? new Error("Compliance item was not found.");
  const complianceItem = item as ComplianceItemReviewRow;
  if (complianceItem.msme_id !== ctx.linkedMsmeId) throw new Error("You can only submit your own compliance items.");

  const currentStatus = complianceItem.status ?? "not_started";
  const nextStatus = currentStatus === "changes_requested" || currentStatus === "rejected" ? "resubmitted" : "submitted";
  if (!["not_started", "draft", "changes_requested", "rejected"].includes(currentStatus)) {
    throw new Error("This compliance item cannot be submitted from its current status.");
  }

  const activeReview = await getActiveReview(supabase, complianceItem.id);
  if (activeReview) throw new Error("This compliance item already has an active review session.");

  const { count: evidenceCount, error: evidenceError } = await supabase
    .from("compliance_documents")
    .select("id", { count: "exact", head: true })
    .eq("compliance_item_id", complianceItem.id)
    .eq("msme_id", complianceItem.msme_id)
    .eq("is_deleted", false);

  if (evidenceError) throw evidenceError;
  if ((evidenceCount ?? 0) === 0) throw new Error("Upload at least one active evidence document before submitting.");

  const { error: updateError } = await supabase
    .from("msme_compliance_items")
    .update({
      status: nextStatus,
      previous_status: currentStatus,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", complianceItem.id)
    .eq("msme_id", complianceItem.msme_id)
    .eq("status", currentStatus);

  if (updateError) throw updateError;

  const review = await createPendingReview(supabase, complianceItem, ctx, currentStatus);
  await supabase.from("msme_compliance_items").update({ latest_review_id: review.id }).eq("id", complianceItem.id);
  await recalculateComplianceProfile(supabase, complianceItem.msme_id);

  logComplianceReviewDiagnostic({
    operation: "submit_for_review",
    msmeId: complianceItem.msme_id,
    complianceItemId: complianceItem.id,
    reviewId: review.id,
    reviewerRole: ctx.role,
    transition: `${currentStatus}->${nextStatus}`,
  });
}

export async function performComplianceReviewAction(ctx: UserContext, params: {
  complianceItemId: string;
  action: ComplianceReviewAction;
  decisionReason?: string | null;
  internalNotes?: string | null;
  requestedChanges?: string | null;
}) {
  if (!canUseComplianceReviewQueue(ctx)) throw new Error("You do not have permission to review compliance items.");

  const supabase = await createServiceRoleSupabaseClient();
  const { data: item, error } = await supabase
    .from("msme_compliance_items")
    .select("id,msme_id,regulator_id,status,reviewer_user_id,latest_review_id,compliance_regulators(code)")
    .eq("id", params.complianceItemId)
    .maybeSingle();

  if (error || !item) throw error ?? new Error("Compliance item was not found.");
  const complianceItem = item as ComplianceItemReviewRow & { compliance_regulators?: { code?: string | null } | Array<{ code?: string | null }> | null };
  const regulator = Array.isArray(complianceItem.compliance_regulators) ? complianceItem.compliance_regulators[0] : complianceItem.compliance_regulators;
  if (!canReviewRegulator(ctx, regulator?.code)) throw new Error("You are not authorized for this regulator queue.");

  const currentStatus = complianceItem.status ?? "not_started";
  const activeReview = await getActiveReview(supabase, complianceItem.id);
  let review = activeReview;

  if (params.action === "reopen") {
    if (!["approved", "rejected", "changes_requested"].includes(currentStatus)) throw new Error("Only a completed review can be reopened.");
    const { error: reopenError } = await supabase
      .from("msme_compliance_items")
      .update({ status: "under_review", previous_status: currentStatus, reviewer_user_id: ctx.appUserId, reviewer_role: ctx.role, updated_at: new Date().toISOString() })
      .eq("id", complianceItem.id);
    if (reopenError) throw reopenError;
    review = await createPendingReview(supabase, complianceItem, ctx, currentStatus);
    await supabase.from("msme_compliance_items").update({ latest_review_id: review.id }).eq("id", complianceItem.id);
    await recalculateComplianceProfile(supabase, complianceItem.msme_id);
    return;
  }

  if (params.action === "assign") {
    if (!["submitted", "resubmitted"].includes(currentStatus) && activeReview?.review_status !== "pending_review") {
      throw new Error("Only submitted compliance items can be assigned for review.");
    }
    if (!review) review = await createPendingReview(supabase, complianceItem, ctx, currentStatus);

    const { error: itemUpdateError } = await supabase
      .from("msme_compliance_items")
      .update({ status: "under_review", previous_status: currentStatus, reviewer_user_id: ctx.appUserId, reviewer_role: ctx.role, updated_at: new Date().toISOString() })
      .eq("id", complianceItem.id);
    if (itemUpdateError) throw itemUpdateError;

    const { error: reviewUpdateError } = await supabase
      .from("compliance_reviews")
      .update({ reviewer_user_id: ctx.appUserId, review_status: "under_review", previous_status: currentStatus, new_status: "under_review", internal_notes: params.internalNotes ?? null })
      .eq("id", review.id);
    if (reviewUpdateError) throw reviewUpdateError;

    await insertComplianceEvent(supabase, {
      msmeId: complianceItem.msme_id,
      complianceItemId: complianceItem.id,
      regulatorId: complianceItem.regulator_id,
      eventType: "review_assigned",
      actorUserId: ctx.appUserId,
      actorRole: ctx.role,
      fromStatus: currentStatus,
      toStatus: "under_review",
      summary: "Compliance review assigned and started.",
      metadata: { phase: "phase3", review_id: review.id },
    });
    await insertComplianceEvent(supabase, {
      msmeId: complianceItem.msme_id,
      complianceItemId: complianceItem.id,
      regulatorId: complianceItem.regulator_id,
      eventType: "review_started",
      actorUserId: ctx.appUserId,
      actorRole: ctx.role,
      fromStatus: currentStatus,
      toStatus: "under_review",
      summary: "Compliance item moved under review.",
      metadata: { phase: "phase3", review_id: review.id, notification_event: "review_started" },
    });
    await supabase.from("msme_compliance_items").update({ latest_review_id: review.id }).eq("id", complianceItem.id);
    await recalculateComplianceProfile(supabase, complianceItem.msme_id);
    return;
  }

  if (currentStatus !== "under_review" || !review || review.review_status !== "under_review") {
    throw new Error("Approve, reject, and changes requested actions require an under-review session.");
  }

  if (params.action === "approve") {
    const { count: evidenceCount, error: evidenceError } = await supabase
      .from("compliance_documents")
      .select("id", { count: "exact", head: true })
      .eq("compliance_item_id", complianceItem.id)
      .eq("msme_id", complianceItem.msme_id)
      .eq("is_deleted", false);
    if (evidenceError) throw evidenceError;
    if ((evidenceCount ?? 0) === 0) throw new Error("Approval requires at least one active evidence document.");
  }

  const nextStatus = itemStatusForAction(params.action);
  const nextReviewStatus = reviewStatusForAction(params.action);
  const now = new Date().toISOString();

  const itemUpdate: Record<string, unknown> = {
    status: nextStatus,
    previous_status: currentStatus,
    reviewer_user_id: ctx.appUserId,
    reviewer_role: ctx.role,
    decision_reason: params.decisionReason || params.requestedChanges || null,
    updated_at: now,
  };
  if (nextStatus === "approved") itemUpdate.approved_at = now;
  if (nextStatus === "rejected") itemUpdate.rejected_at = now;

  const { error: itemUpdateError } = await supabase.from("msme_compliance_items").update(itemUpdate).eq("id", complianceItem.id);
  if (itemUpdateError) throw itemUpdateError;

  const { error: reviewUpdateError } = await supabase
    .from("compliance_reviews")
    .update({
      reviewer_user_id: ctx.appUserId,
      review_status: nextReviewStatus,
      previous_status: currentStatus,
      new_status: nextStatus,
      decision_reason: params.decisionReason || params.requestedChanges || null,
      internal_notes: params.internalNotes || null,
      requested_changes: params.requestedChanges || null,
      reviewed_at: now,
    })
    .eq("id", review.id);
  if (reviewUpdateError) throw reviewUpdateError;

  if (params.decisionReason || params.requestedChanges || params.internalNotes) {
    const visibleComment = nextStatus === "changes_requested" || nextStatus === "rejected";
    await supabase.from("compliance_review_comments").insert({
      review_id: review.id,
      msme_id: complianceItem.msme_id,
      compliance_item_id: complianceItem.id,
      regulator_id: complianceItem.regulator_id,
      author_user_id: ctx.appUserId,
      author_role: ctx.role,
      comment_body: params.requestedChanges || params.decisionReason || params.internalNotes,
      visibility: visibleComment ? "msme_visible" : "internal",
    });
  }

  await insertComplianceEvent(supabase, {
    msmeId: complianceItem.msme_id,
    complianceItemId: complianceItem.id,
    regulatorId: complianceItem.regulator_id,
    eventType: eventTypeForReviewStatus(nextReviewStatus),
    actorUserId: ctx.appUserId,
    actorRole: ctx.role,
    fromStatus: currentStatus,
    toStatus: nextStatus,
    summary: msmeVisibleSummary(nextStatus),
    metadata: { phase: "phase3", review_id: review.id, notification_event: `review_${nextReviewStatus}` },
  });

  await recalculateComplianceProfile(supabase, complianceItem.msme_id);

  logComplianceReviewDiagnostic({
    operation: params.action,
    msmeId: complianceItem.msme_id,
    complianceItemId: complianceItem.id,
    reviewId: review.id,
    reviewerRole: ctx.role,
    transition: `${currentStatus}->${nextStatus}`,
  });
}

export async function recordComplianceReviewExport(ctx: UserContext, params: {
  regulatorId?: string | null;
  reviewStatus?: ComplianceReviewStatus | null;
  filters: Record<string, string | null | undefined>;
  exportCount: number;
}) {
  if (!canUseComplianceReviewQueue(ctx)) throw new Error("You do not have permission to export compliance reviews.");

  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("compliance_review_exports")
    .insert({
      exported_by_user_id: ctx.appUserId,
      exported_by_role: ctx.role,
      regulator_id: params.regulatorId ?? null,
      review_status: params.reviewStatus ?? null,
      filters: params.filters,
      export_format: "csv",
      export_count: params.exportCount,
    })
    .select("id")
    .single();

  if (error) throw error;

  await insertComplianceEvent(supabase, {
    msmeId: null,
    complianceItemId: null,
    regulatorId: params.regulatorId ?? null,
    eventType: "export_generated",
    actorUserId: ctx.appUserId,
    actorRole: ctx.role,
    summary: "Compliance reviewer queue CSV export generated.",
    metadata: { phase: "phase3", export_id: data.id, export_count: params.exportCount, filters: params.filters },
  });

  logComplianceReviewDiagnostic({
    operation: "export_generated",
    reviewerRole: ctx.role,
    exportCount: params.exportCount,
  });
}
