"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { runAdminMsmeAction, type AdminMsmeAction } from "@/lib/data/admin-msme-actions";

export type AdminMsmeActionState = {
  ok: boolean;
  message: string;
};

const ACTION_MESSAGES: Record<AdminMsmeAction, string> = {
  flag: "MSME flagged.",
  remove_flag: "Flag removed.",
  suspend: "MSME suspended.",
  reinstate: "MSME reinstated.",
  request_profile_review: "Profile review requested.",
  escalate_compliance_review: "Compliance review escalated.",
  add_internal_note: "Internal note added.",
};

export async function submitAdminMsmeAction(_state: AdminMsmeActionState, formData: FormData): Promise<AdminMsmeActionState> {
  const ctx = await getCurrentUserContext();
  if (!["admin", "reviewer"].includes(ctx.role)) redirect("/access-denied");

  const msmeId = String(formData.get("msme_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim() as AdminMsmeAction;
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    const supabase = await createServiceRoleSupabaseClient();
    await runAdminMsmeAction(supabase, {
      ctx,
      msmeId,
      action,
      reason,
      sourceWorkspace: "admin_msme_detail_workspace",
    });
    revalidatePath(`/dashboard/admin/msmes/${msmeId}`);
    revalidatePath("/dashboard/admin/msmes");
    return { ok: true, message: ACTION_MESSAGES[action] ?? "Action completed." };
  } catch (error) {
    console.info("[admin-msme-actions]", {
      operation: "submit_admin_msme_action",
      actorRole: ctx.role,
      msmeId,
      action,
      success: false,
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Action failed",
    });
    return { ok: false, message: error instanceof Error ? error.message.replaceAll("_", " ") : "Unable to complete action." };
  }
}
