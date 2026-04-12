import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

const DEV_MODE = process.env.NODE_ENV !== "production";

export const COMPLAINT_STATUSES = [
  "submitted",
  "under_review",
  "awaiting_msme_response",
  "awaiting_complainant_response",
  "association_follow_up",
  "regulator_review",
  "resolved",
  "closed",
  "escalated",
  "dismissed",
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

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
  logComplaint(`event:${event}`, payload);
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
  if (role === "msme") return ["awaiting_complainant_response", "resolved"].includes(nextStatus);
  if (role === "association_officer") return ["association_follow_up", "escalated", "under_review"].includes(nextStatus);
  if (role === "fccpc_officer" || role === "reviewer") return ["regulator_review", "under_review", "resolved", "dismissed", "closed", "escalated"].includes(nextStatus);
  return false;
}

export async function assertComplaintAccess(complaint: any, scope: ComplaintScope) {
  const role = scope.role;

  if (role === "admin") return true;

  if (role === "msme") {
    const allowed = scope.providerIds.includes(complaint.provider_profile_id);
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
