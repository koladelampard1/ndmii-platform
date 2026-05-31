"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { runAssociationMemberAction, runBulkAssociationMemberAction, type AssociationMemberAction } from "@/lib/data/admin-association-member-actions";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type AssociationMemberActionState = { ok: boolean; message: string };

function refresh(memberId?: string) {
  revalidatePath("/dashboard/admin/association-members");
  if (memberId) revalidatePath(`/dashboard/admin/association-members/${memberId}`);
}

export async function submitAssociationMemberAction(formData: FormData) {
  const ctx = await getCurrentUserContext();
  if (!["admin", "reviewer"].includes(ctx.role)) redirect("/access-denied");
  const memberId = String(formData.get("member_id") ?? "").trim();
  try {
    const supabase = await createServiceRoleSupabaseClient();
    await runAssociationMemberAction(supabase, {
      ctx,
      memberId,
      action: String(formData.get("action") ?? "").trim() as AssociationMemberAction,
      reason: String(formData.get("reason") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      assignedReviewerId: String(formData.get("assigned_reviewer_id") ?? "").trim(),
    });
    refresh(memberId);
  } catch (error) {
    redirect(`/dashboard/admin/association-members/${memberId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to complete action.")}`);
  }
  redirect(`/dashboard/admin/association-members/${memberId}?success=Action%20recorded`);
}

export async function submitBulkAssociationMemberAction(formData: FormData) {
  const ctx = await getCurrentUserContext();
  if (!["admin", "reviewer"].includes(ctx.role)) redirect("/access-denied");
  const memberIds = formData.getAll("member_id").map(String);
  const action = String(formData.get("action") ?? "").trim();
  if (action === "export") redirect(`/api/admin/associations/members/export?ids=${encodeURIComponent(memberIds.join(","))}`);
  try {
    const supabase = await createServiceRoleSupabaseClient();
    await runBulkAssociationMemberAction(supabase, {
      ctx,
      memberIds,
      action: action as "approve" | "reject" | "assign_reviewer",
      reason: String(formData.get("reason") ?? "").trim(),
      assignedReviewerId: String(formData.get("assigned_reviewer_id") ?? "").trim(),
    });
    refresh();
  } catch (error) {
    redirect(`/dashboard/admin/association-members?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to complete bulk action.")}`);
  }
  redirect("/dashboard/admin/association-members?success=Bulk%20action%20recorded");
}
