"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { runBulkAdminMsmeAction } from "@/lib/data/admin-msme-actions";

export type BulkAdminMsmeActionState = {
  ok: boolean;
  message: string;
};

export async function submitBulkAdminMsmeAction(_state: BulkAdminMsmeActionState, formData: FormData): Promise<BulkAdminMsmeActionState> {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const action = String(formData.get("bulk_action") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const ids = formData.getAll("msme_ids").map((value) => String(value));

  if (action !== "flag" && action !== "request_profile_review") {
    return { ok: false, message: "Unsupported bulk action." };
  }

  try {
    const supabase = await createServiceRoleSupabaseClient();
    const result = await runBulkAdminMsmeAction(supabase, { ctx, msmeIds: ids, action, reason });
    revalidatePath("/dashboard/admin/msmes");
    return { ok: true, message: `${result.count} MSME record${result.count === 1 ? "" : "s"} updated.` };
  } catch (error) {
    console.info("[admin-msme-actions]", {
      operation: "submit_bulk_admin_msme_action",
      actorRole: ctx.role,
      msmeId: ids.length === 1 ? ids[0] : "bulk",
      action,
      success: false,
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Bulk action failed",
    });
    return { ok: false, message: error instanceof Error ? error.message.replaceAll("_", " ") : "Unable to complete bulk action." };
  }
}
