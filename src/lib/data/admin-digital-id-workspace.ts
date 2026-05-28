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
  | "activity_logs"
  | "users";

export type AdminDigitalIdWorkspace = {
  credential: AdminDigitalIdQueueRow & {
    lifecycleVersion: number;
    assignedReviewerId: string | null;
    assignedAdminId: string | null;
    assignedReviewerName: string | null;
    assignedAdminName: string | null;
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
  readiness: {
    publicVerification: AdminDigitalIdQueueRow["publicVerificationReadiness"];
    publicReason: string;
    qr: AdminDigitalIdQueueRow["qrReadiness"];
    tokenHash: AdminDigitalIdQueueRow["tokenReadiness"];
    signature: AdminDigitalIdQueueRow["signatureReadiness"];
    safeTestHref: string | null;
  };
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
      .select("id,lifecycle_version,assigned_reviewer_id,assigned_admin_id,internal_notes,renewal_requested_at,last_regenerated_at")
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
  const action = asString(row.action) || "event";
  return {
    id: asString(row.id) || `${action}-${asString(row.created_at)}`,
    action,
    actorRole: asString(row.actor_role) || asString(metadata.actor_role) || null,
    createdAt: asString(row.created_at) || null,
    summary: [
      action.replaceAll("_", " "),
      previous && next ? `${previous} to ${next}` : "",
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

  const meta = metaResult.data ?? {};
  const users = usersResult.rows;
  const userName = (id: string | null) => {
    if (!id) return null;
    const match = users.find((user) => asString(user.id) === id);
    return asString(match?.full_name) || asString(match?.email) || null;
  };
  const timeline = [...eventResult.rows.map(toEvent), ...activityResult.rows.map(toEvent)]
    .sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
  const regenerationHistory = timeline.filter((event) => event.action.includes("reissue") || event.action.includes("regenerate"));
  const issuanceHistory = timeline.filter((event) => ["issued", "approved", "active", "activate", "approve_renewal", "reinstate"].some((token) => event.action.includes(token)));
  const status = normalizeDigitalIdLifecycleStatus(row.credentialStatus);
  const assignedReviewerId = asString(meta.assigned_reviewer_id) || null;
  const assignedAdminId = asString(meta.assigned_admin_id) || null;

  return {
    credential: {
      ...row,
      lifecycleVersion: Number(meta.lifecycle_version ?? 0),
      assignedReviewerId,
      assignedAdminId,
      assignedReviewerName: userName(assignedReviewerId),
      assignedAdminName: userName(assignedAdminId),
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
    readiness: {
      publicVerification: row.publicVerificationReadiness,
      publicReason: row.publicVerificationReason,
      qr: row.qrReadiness,
      tokenHash: row.tokenReadiness,
      signature: row.signatureReadiness,
      safeTestHref: row.safeTestHref,
    },
    attentionSignals: row.attentionSignals,
    reviewers: users.map((user) => ({
      id: asString(user.id),
      label: asString(user.full_name) || asString(user.email) || "Unnamed user",
      role: asString(user.role) || "reviewer",
    })).filter((user) => user.id),
    sources: {
      digital_identity_credentials: metaResult.source,
      credential_events: eventResult.source,
      activity_logs: activityResult.source,
      users: usersResult.source,
    },
  };
}
