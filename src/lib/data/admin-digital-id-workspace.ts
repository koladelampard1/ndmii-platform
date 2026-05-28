import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadAdminDigitalIdQueue,
  type AdminDigitalIdAttentionSignal,
  type AdminDigitalIdEvent,
  type AdminDigitalIdQueueRow,
  type AdminDigitalIdSourceState,
} from "@/lib/data/admin-digital-ids";
import {
  ADMIN_DIGITAL_ID_LIFECYCLE_TRANSITIONS,
  getAdminDigitalIdAllowedLifecycleActions,
  normalizeDigitalIdLifecycleStatus,
  type AdminDigitalIdAction,
  type DigitalIdLifecycleStatus,
} from "@/lib/data/admin-digital-id-actions";

type Row = Record<string, unknown>;

export type AdminDigitalIdWorkspaceSourceName =
  | "digital_identity_credentials"
  | "credential_events"
  | "msmes"
  | "verification_reviews"
  | "verification_review_events"
  | "validation_results"
  | "complaints"
  | "compliance_profiles"
  | "msme_compliance_profiles"
  | "activity_logs"
  | "users";

export type AdminDigitalIdWorkspace = {
  credential: AdminDigitalIdQueueRow & {
    lifecycleVersion: number;
    assignedReviewerId: string | null;
    assignedAdminId: string | null;
    assignedReviewerName: string | null;
    assignedAdminName: string | null;
    assignedAt: string | null;
    assignedByName: string | null;
    reassignedCount: number;
    lastReassignmentAt: string | null;
    internalNotes: string | null;
    renewalRequestedAt: string | null;
    lastRegeneratedAt: string | null;
  };
  lifecycle: {
    status: DigitalIdLifecycleStatus;
    allowedActions: AdminDigitalIdAction[];
    matrix: Array<{ from: DigitalIdLifecycleStatus; actions: AdminDigitalIdAction[] }>;
  };
  issuanceHistory: AdminDigitalIdEvent[];
  regenerationHistory: AdminDigitalIdEvent[];
  timeline: AdminDigitalIdEvent[];
  notes: Array<{ id: string; note: string; actorRole: string | null; createdAt: string | null }>;
  assignmentHistory: AdminDigitalIdEvent[];
  handoffHistory: AdminDigitalIdEvent[];
  lifecycleFrequencySummary: Array<{ label: string; value: number }>;
  stabilityIndicators: Array<{ label: string; value: string; posture: "normal" | "watch" | "critical" }>;
  readiness: {
    publicVerification: AdminDigitalIdQueueRow["publicVerificationReadiness"];
    publicVerificationPosture: AdminDigitalIdQueueRow["publicVerificationPosture"];
    publicReason: string;
    qr: AdminDigitalIdQueueRow["qrReadiness"];
    tokenHash: AdminDigitalIdQueueRow["tokenReadiness"];
    signature: AdminDigitalIdQueueRow["signatureReadiness"];
    routeAvailable: boolean;
    routeDuplicateCount: number;
  };
  expiry: {
    posture: AdminDigitalIdQueueRow["expiryPosture"];
    daysUntilExpiry: number | null;
    renewalPendingDays: number | null;
    expiresAt: string | null;
  };
  regeneration: {
    total: number;
    recent: AdminDigitalIdEvent[];
    suspiciousBurst: boolean;
    repeatedRevocationReissue: boolean;
    routeInvalidatedAt: string | null;
    lastRegeneratedAt: string | null;
  };
  trust: {
    posture: AdminDigitalIdQueueRow["trustPosture"];
    reasons: string[];
  };
  qrRouteSignals: AdminDigitalIdAttentionSignal[];
  attentionSignals: AdminDigitalIdAttentionSignal[];
  reviewers: Array<{ id: string; label: string; role: string }>;
  sources: Record<AdminDigitalIdWorkspaceSourceName, AdminDigitalIdSourceState>;
};

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

async function maybeSingle<T>(query: PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>) {
  const result = await query;
  if (result.error && !["42P01", "42703", "PGRST116", "PGRST204"].includes(result.error.code ?? "")) throw result.error;
  return { data: result.data, source: { available: !result.error, message: result.error?.message ?? null } };
}

async function readCredentialMeta(supabase: SupabaseClient<any>, credentialId: string) {
  const full = await maybeSingle<Row>(
    supabase
      .from("digital_identity_credentials")
      .select("id,lifecycle_version,assigned_reviewer_id,assigned_admin_id,assigned_at,assigned_by,reassigned_count,last_reassignment_at,internal_notes,renewal_requested_at,last_regenerated_at")
      .eq("id", credentialId)
      .maybeSingle<Row>(),
  );
  if (full.source.available) return full;
  const fallback = await maybeSingle<Row>(
    supabase
      .from("digital_identity_credentials")
      .select("id")
      .eq("id", credentialId)
      .maybeSingle<Row>(),
  );
  return { data: fallback.data, source: full.source };
}

async function readEvents(supabase: SupabaseClient<any>, credentialId: string) {
  const { data, error } = await supabase
    .from("credential_events")
    .select("id,credential_id,action,actor_role,metadata,created_at")
    .eq("credential_id", credentialId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { rows: [], source: { available: false, message: error.message } };
  return { rows: (data ?? []) as Row[], source: { available: true, message: null } };
}

async function readActivity(supabase: SupabaseClient<any>, credentialId: string) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id,action,entity_type,entity_id,metadata,created_at")
    .eq("entity_id", credentialId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { rows: [], source: { available: false, message: error.message } };
  return { rows: (data ?? []) as Row[], source: { available: true, message: null } };
}

async function readVerificationReviewEvents(supabase: SupabaseClient<any>, msmeId: string) {
  const { data: reviews, error: reviewError } = await supabase
    .from("verification_reviews")
    .select("id")
    .eq("msme_id", msmeId)
    .limit(10);
  if (reviewError) return { rows: [], source: { available: false, message: reviewError.message } };
  const reviewIds = (reviews ?? []).map((row: Row) => asString(row.id)).filter(Boolean);
  if (!reviewIds.length) return { rows: [], source: { available: true, message: null } };

  const { data, error } = await supabase
    .from("verification_review_events")
    .select("id,verification_review_id,event_type,actor_role,previous_status,new_status,metadata,created_at")
    .in("verification_review_id", reviewIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { rows: [], source: { available: false, message: error.message } };
  return { rows: (data ?? []) as Row[], source: { available: true, message: null } };
}

async function readUsers(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase
    .from("users")
    .select("id,full_name,email,role")
    .in("role", ["admin", "super_admin", "reviewer"])
    .order("full_name", { ascending: true });
  if (error) return { rows: [], source: { available: false, message: error.message } };
  return { rows: (data ?? []) as Row[], source: { available: true, message: null } };
}

function toEvent(row: Row): AdminDigitalIdEvent {
  const metadata = metadataObject(row.metadata);
  const previous = asString(metadata.previous_status);
  const next = asString(metadata.new_status);
  const reason = asString(metadata.reason);
  const action = asString(row.action) || asString(row.event_type) || "event";
  const previousStatus = previous || asString(row.previous_status);
  const nextStatus = next || asString(row.new_status);
  return {
    id: asString(row.id) || `${action}-${asString(row.created_at)}`,
    action,
    actorRole: asString(row.actor_role) || asString(metadata.actor_role) || null,
    createdAt: asString(row.created_at) || null,
    summary: [
      action.replaceAll("_", " "),
      previousStatus && nextStatus ? `${previousStatus} to ${nextStatus}` : "",
      reason ? `Reason: ${reason}` : "",
    ].filter(Boolean).join(" - "),
  };
}

function buildNotes(events: Row[], activity: Row[]) {
  return [...events, ...activity].map((row) => {
    const metadata = metadataObject(row.metadata);
    const action = asString(row.action);
    const note = action.includes("note") ? asString(metadata.reason) || asString(metadata.note) : "";
    if (!note) return null;
    return {
      id: asString(row.id) || `${action}-${asString(row.created_at)}`,
      note,
      actorRole: asString(row.actor_role) || asString(metadata.actor_role) || null,
      createdAt: asString(row.created_at) || null,
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function getAdminDigitalIdWorkspace(
  supabase: SupabaseClient<any>,
  credentialId: string,
): Promise<AdminDigitalIdWorkspace | null> {
  const queue = await loadAdminDigitalIdQueue(supabase, { selectedId: credentialId, page: 1, pageSize: 25 });
  const row = queue.selectedRow?.id === credentialId ? queue.selectedRow : null;
  if (!row) return null;

  const [metaResult, eventResult, activityResult, usersResult] = await Promise.all([
    readCredentialMeta(supabase, credentialId),
    readEvents(supabase, credentialId),
    readActivity(supabase, credentialId),
    readUsers(supabase),
  ]);
  const reviewEventsResult = await readVerificationReviewEvents(supabase, row.msmeRowId ?? "");

  const meta = metaResult.data ?? {};
  const users = usersResult.rows;
  const maskEmail = (value: unknown) => {
    const normalized = asString(value);
    if (!normalized || !normalized.includes("@")) return "";
    const [local, domain] = normalized.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  };
  const userName = (id: string | null) => {
    if (!id) return null;
    const match = users.find((user) => asString(user.id) === id);
    return asString(match?.full_name) || maskEmail(match?.email) || null;
  };
  const timeline = [...eventResult.rows.map(toEvent), ...activityResult.rows.map(toEvent), ...reviewEventsResult.rows.map(toEvent)]
    .sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
  const regenerationHistory = timeline.filter((event) => event.action.includes("reissue") || event.action.includes("regenerate"));
  const revocationCount = timeline.filter((event) => event.action.includes("revoke") || event.action.includes("revoked")).length;
  const issuanceHistory = timeline.filter((event) => ["issued", "approved", "active", "activate", "approve_renewal", "reinstate"].some((token) => event.action.includes(token)));
  const status = normalizeDigitalIdLifecycleStatus(row.credentialStatus);
  const assignedReviewerId = asString(meta.assigned_reviewer_id) || null;
  const assignedAdminId = asString(meta.assigned_admin_id) || null;
  const assignmentHistory = timeline.filter((event) => event.action.includes("assign"));
  const handoffHistory = assignmentHistory.filter((event) => event.summary.includes("previous") || event.action.includes("assigned"));
  const lifecycleActions = ["approved", "suspended", "revoked", "expired", "renewal_requested", "reissued", "note_saved", "assigned"];
  const lifecycleFrequencySummary = lifecycleActions
    .map((label) => ({ label, value: timeline.filter((event) => event.action === label || event.action.includes(label)).length }))
    .filter((item) => item.value > 0);
  const stabilityIndicators = [
    { label: "Lifecycle changes", value: row.lifecycleChangeCount.toLocaleString(), posture: row.lifecycleChangeCount >= 4 ? "watch" as const : "normal" as const },
    { label: "Regeneration frequency", value: row.regenerationCount.toLocaleString(), posture: row.regenerationCount >= 3 ? "critical" as const : row.regenerationCount >= 2 ? "watch" as const : "normal" as const },
    { label: "Assignment changes", value: row.assignment.reassignedCount.toLocaleString(), posture: row.assignment.reassignedCount >= 3 ? "watch" as const : "normal" as const },
    { label: "Public verification", value: row.publicVerificationReadiness.replaceAll("_", " "), posture: row.publicVerificationReadiness === "likely_invalid" ? "critical" as const : "normal" as const },
  ];

  return {
    credential: {
      ...row,
      lifecycleVersion: Number(meta.lifecycle_version ?? 0),
      assignedReviewerId,
      assignedAdminId,
      assignedReviewerName: userName(assignedReviewerId),
      assignedAdminName: userName(assignedAdminId),
      assignedAt: asString(meta.assigned_at) || row.assignment.assignedAt,
      assignedByName: userName(asString(meta.assigned_by) || row.assignment.assignedBy),
      reassignedCount: Number(meta.reassigned_count ?? row.assignment.reassignedCount),
      lastReassignmentAt: asString(meta.last_reassignment_at) || row.assignment.lastReassignmentAt,
      internalNotes: asString(meta.internal_notes) || null,
      renewalRequestedAt: asString(meta.renewal_requested_at) || null,
      lastRegeneratedAt: asString(meta.last_regenerated_at) || null,
    },
    lifecycle: {
      status,
      allowedActions: getAdminDigitalIdAllowedLifecycleActions(status),
      matrix: ADMIN_DIGITAL_ID_LIFECYCLE_TRANSITIONS,
    },
    issuanceHistory,
    regenerationHistory,
    timeline,
    notes: buildNotes(eventResult.rows, activityResult.rows),
    assignmentHistory,
    handoffHistory,
    lifecycleFrequencySummary,
    stabilityIndicators,
    readiness: {
      publicVerification: row.publicVerificationReadiness,
      publicVerificationPosture: row.publicVerificationPosture,
      publicReason: row.publicVerificationReason,
      qr: row.qrReadiness,
      tokenHash: row.tokenReadiness,
      signature: row.signatureReadiness,
      routeAvailable: row.publicRouteAvailable,
      routeDuplicateCount: row.routeDuplicateCount,
    },
    expiry: {
      posture: row.expiryPosture,
      daysUntilExpiry: row.daysUntilExpiry,
      renewalPendingDays: row.renewalPendingDays,
      expiresAt: row.expiryAt,
    },
    regeneration: {
      total: row.regenerationCount,
      recent: regenerationHistory.filter((event) => (Date.now() - (Date.parse(event.createdAt ?? "") || 0)) <= 30 * 86_400_000).slice(0, 10),
      suspiciousBurst: regenerationHistory.filter((event) => (Date.now() - (Date.parse(event.createdAt ?? "") || 0)) <= 7 * 86_400_000).length >= 2,
      repeatedRevocationReissue: revocationCount >= 2 && row.regenerationCount >= 2,
      routeInvalidatedAt: row.tokenInvalidatedAt,
      lastRegeneratedAt: row.lastRegeneratedAt,
    },
    trust: { posture: row.trustPosture, reasons: row.trustReasons },
    qrRouteSignals: row.qrRouteSignals,
    attentionSignals: row.attentionSignals,
    reviewers: users.map((user) => ({
      id: asString(user.id),
      label: asString(user.full_name) || maskEmail(user.email) || "Unnamed user",
      role: asString(user.role) || "reviewer",
    })).filter((user) => user.id),
    sources: {
      digital_identity_credentials: metaResult.source,
      credential_events: queue.sources.credential_events.available ? queue.sources.credential_events : eventResult.source,
      msmes: queue.sources.msmes,
      verification_reviews: queue.sources.verification_reviews,
      verification_review_events: reviewEventsResult.source,
      validation_results: queue.sources.validation_results,
      complaints: queue.sources.complaints,
      compliance_profiles: queue.sources.compliance_profiles,
      msme_compliance_profiles: queue.sources.msme_compliance_profiles,
      activity_logs: queue.sources.activity_logs.available ? queue.sources.activity_logs : activityResult.source,
      users: usersResult.source,
    },
  };
}
