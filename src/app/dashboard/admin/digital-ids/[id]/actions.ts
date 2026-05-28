"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { runAdminDigitalIdAction, type AdminDigitalIdAction } from "@/lib/data/admin-digital-id-actions";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type AdminDigitalIdActionState = {
  ok: boolean;
  message: string;
};

const ACTION_MESSAGES: Partial<Record<AdminDigitalIdAction, string>> = {
  activate: "Credential activated.",
  suspend: "Credential suspended.",
  revoke: "Credential revoked.",
  start_renewal: "Renewal started.",
  approve_renewal: "Renewal approved.",
  reinstate: "Credential reinstated.",
  save_note: "Internal note saved.",
  assign: "Assignment updated.",
};

function friendlyErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to complete action.";
  return message.replaceAll("_", " ");
}

export async function submitAdminDigitalIdAction(_state: AdminDigitalIdActionState, formData: FormData): Promise<AdminDigitalIdActionState> {
  const ctx = await getCurrentUserContext();
  if (!["admin", "super_admin", "reviewer"].includes(ctx.role)) redirect("/access-denied");

  const credentialId = String(formData.get("credential_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim() as AdminDigitalIdAction;
  const reason = String(formData.get("reason") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const assignedReviewerId = String(formData.get("assigned_reviewer_id") ?? "").trim();
  const assignedAdminId = String(formData.get("assigned_admin_id") ?? "").trim();
  const override = String(formData.get("override") ?? "") === "on";

  try {
    const supabase = await createServiceRoleSupabaseClient();
    const result = await runAdminDigitalIdAction(supabase, {
      ctx,
      credentialId,
      action,
      reason,
      note,
      assignedReviewerId,
      assignedAdminId,
      override,
    });
    revalidatePath(`/dashboard/admin/digital-ids/${credentialId}`);
    revalidatePath("/dashboard/admin/digital-ids");
    revalidatePath(`/dashboard/admin/msmes/${result.credential.msme_id}`);
    const baseMessage = result.noOp && result.message
      ? result.message
      : action === "regenerate_token"
      ? `Verification route regenerated: ${result.publicRoute ?? "route unavailable"}`
      : ACTION_MESSAGES[action] ?? "Action completed.";
    return { ok: true, message: baseMessage };
  } catch (error) {
    console.info("[admin-digital-id-actions]", {
      credentialId,
      currentStatus: null,
      requestedAction: action,
      normalizedStatus: null,
      actorRole: ctx.role,
    });
    return { ok: false, message: friendlyErrorMessage(error) };
  }
}
