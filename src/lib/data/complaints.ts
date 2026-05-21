import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

const DEV_MODE = process.env.NODE_ENV !== "production";

export const COMPLAINT_STATUSES = [
  "submitted",
  "under_review",
  "awaiting_msme_response",
  "awaiting_complainant_response",
  "resolution_proposed",
  "association_follow_up",
  "regulator_review",
  "resolved",
  "closed",
  "escalated",
  "dismissed",
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

type ComplaintAccessRecord = {
  id?: string | null;
  msme_id?: string | null;
  provider_msme_id?: string | null;
  provider_profile_id?: string | null;
  provider_id?: string | null;
  association_id?: string | null;
};

type MsmeComplaintWorkspace = {
  msme: {
    id: string;
    msme_id?: string | null;
  };
  provider: {
    id: string;
    msme_id?: string | null;
  };
};

type ComplaintScope = {
  role: UserRole;
  appUserId: string | null;
  linkedMsmeId: string | null;
  linkedAssociationId: string | null;
  providerIds: string[];
};

function logComplaint(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[complaints] ${message}`, payload);
}

export function generateComplaintReference() {
  const date = new Date();
  const ymd = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CMP-${ymd}-${rand}`;
}

export async function getComplaintScope(): Promise<ComplaintScope> {
  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();

  let providerIds: string[] = [];
  if (ctx.linkedMsmeId) {
    const { data: providers } = await supabase
      .from("provider_profiles")
      .select("id")
      .eq("msme_id", ctx.linkedMsmeId)
      .order("updated_at", { ascending: false });
    providerIds = (providers ?? []).map((p) => p.id);
  }

  return {
    role: ctx.role,
    appUserId: ctx.appUserId,
    linkedMsmeId: ctx.linkedMsmeId,
    linkedAssociationId: ctx.linkedAssociationId,
    providerIds,
  };
}

export async function emitComplaintEvent(event: "complaint_submitted" | "complaint_responded" | "complaint_status_changed" | "complaint_assigned", payload: Record<string, unknown>) {
  logComplaint(`event:${event}`, {
    complaintId: payload.complaintId ?? null,
    providerId: payload.providerId ?? payload.providerProfileId ?? null,
    operation: event,
    status: payload.status ?? payload.toStatus ?? null,
  });
}

export async function createComplaintStatusHistory(params: {
  complaintId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: string | null;
  changedByRole: UserRole | string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = await createServiceRoleSupabaseClient();
  await supabase.from("complaint_status_history").insert({
    complaint_id: params.complaintId,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    changed_by_user_id: params.changedByUserId,
    changed_by_role: params.changedByRole,
    note: params.note ?? null,
    metadata: params.metadata ?? null,
  });
}

export function canRoleUpdateStatus(role: UserRole, nextStatus: string) {
  if (![...COMPLAINT_STATUSES].includes(nextStatus as ComplaintStatus)) return false;
  if (role === "admin") return true;
  if (role === "msme") return ["awaiting_complainant_response", "resolution_proposed"].includes(nextStatus);
  if (role === "association_officer") return ["association_follow_up", "escalated", "under_review"].includes(nextStatus);
  if (role === "fccpc_officer" || role === "reviewer") return ["regulator_review", "under_review", "resolved", "dismissed", "closed", "escalated"].includes(nextStatus);
  return false;
}

export function normalizeComplaintStatus(value: string | null | undefined): ComplaintStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "open" || normalized === "new") return "submitted";
  if ([...COMPLAINT_STATUSES].includes(normalized as ComplaintStatus)) return normalized as ComplaintStatus;
  return "submitted";
}

export function canTransitionComplaintStatus(params: {
  role: UserRole | string;
  fromStatus?: string | null;
  toStatus: string;
}) {
  const role = params.role as UserRole;
  const toStatus = normalizeComplaintStatus(params.toStatus);

  if (!canRoleUpdateStatus(role, toStatus)) return false;

  if (role === "msme" && ["resolved", "closed", "dismissed"].includes(toStatus)) return false;
  if (role === "association_officer" && ["resolved", "closed", "dismissed"].includes(toStatus)) return false;

  return true;
}

export function buildMsmeComplaintOwnershipValues(workspace: MsmeComplaintWorkspace) {
  return {
    msmeIds: Array.from(new Set([workspace.msme.id, workspace.msme.msme_id, workspace.provider.msme_id].filter(Boolean) as string[])),
    providerIds: Array.from(new Set([workspace.provider.id].filter(Boolean))),
  };
}

export function buildMsmeComplaintOrFilter(workspace: MsmeComplaintWorkspace) {
  const { msmeIds, providerIds } = buildMsmeComplaintOwnershipValues(workspace);
  const clauses = [
    ...msmeIds.flatMap((id) => [`msme_id.eq.${id}`, `provider_msme_id.eq.${id}`]),
    ...providerIds.flatMap((id) => [`provider_profile_id.eq.${id}`, `provider_id.eq.${id}`]),
  ];
  return clauses.join(",");
}

export function canMsmeAccessComplaint(complaint: ComplaintAccessRecord | null | undefined, workspace: MsmeComplaintWorkspace) {
  if (!complaint) return false;
  const { msmeIds, providerIds } = buildMsmeComplaintOwnershipValues(workspace);
  return Boolean(
    (complaint.msme_id && msmeIds.includes(complaint.msme_id)) ||
      (complaint.provider_msme_id && msmeIds.includes(complaint.provider_msme_id)) ||
      (complaint.provider_profile_id && providerIds.includes(complaint.provider_profile_id)) ||
      (complaint.provider_id && providerIds.includes(complaint.provider_id))
  );
}

export async function assertComplaintAccess(complaint: any, scope: ComplaintScope) {
  const role = scope.role;

  if (role === "admin") return true;

  if (role === "msme") {
    const allowed =
      Boolean(scope.linkedMsmeId && [complaint.msme_id, complaint.provider_msme_id].includes(scope.linkedMsmeId)) ||
      scope.providerIds.includes(complaint.provider_profile_id) ||
      scope.providerIds.includes(complaint.provider_id);
    logComplaint("ownership_check_msme", {
      complaintId: complaint.id,
      providerProfileId: complaint.provider_profile_id,
      ownedProviderIds: scope.providerIds,
      allowed,
    });
    return allowed;
  }

  if (role === "association_officer") {
    return Boolean(scope.linkedAssociationId && complaint.association_id === scope.linkedAssociationId);
  }

  if (role === "fccpc_officer" || role === "reviewer") {
    return true;
  }

  return false;
}
