"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  ASSOCIATION_MEMBER_BULK_ACTIONS,
  generateAssociationMemberInvite,
  runAssociationMemberAction,
  runAssociationMemberInvitationAction,
  runBulkAssociationMemberAction,
  type AssociationMemberAction,
  type AssociationMemberBulkResult,
} from "@/lib/data/admin-association-member-actions";
import type { AdminAssociationMemberFilters } from "@/lib/data/admin-association-members";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type AssociationMemberActionState = { ok: boolean; message: string };
export type BulkAssociationMemberActionState = {
  ok: boolean;
  message: string;
  result?: AssociationMemberBulkResult;
};

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
    const action = String(formData.get("action") ?? "").trim() as AssociationMemberAction;
    if (action === "generate_invite" || action === "regenerate_invite") {
      const result = await generateAssociationMemberInvite(supabase, { ctx, memberId, regenerate: action === "regenerate_invite" });
      refresh(memberId);
      redirect(`/dashboard/admin/association-members/${memberId}?success=Invitation%20generated.%20Copy%20this%20link%20now.&invite_link=${encodeURIComponent(result.inviteUrl)}`);
    }
    if (["mark_invite_sent", "resend_invite", "expire_invite", "mark_onboarding_started", "mark_onboarding_completed"].includes(action)) {
      await runAssociationMemberInvitationAction(supabase, { ctx, memberId, action: action as "mark_invite_sent" | "resend_invite" | "expire_invite" | "mark_onboarding_started" | "mark_onboarding_completed" });
    } else {
      await runAssociationMemberAction(supabase, {
        ctx, memberId, action,
        reason: String(formData.get("reason") ?? "").trim(),
        notes: String(formData.get("notes") ?? "").trim(),
        assignedReviewerId: String(formData.get("assigned_reviewer_id") ?? "").trim(),
      });
    }
    refresh(memberId);
  } catch (error) {
    redirect(`/dashboard/admin/association-members/${memberId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to complete action.")}`);
  }
  redirect(`/dashboard/admin/association-members/${memberId}?success=Action%20recorded`);
}

export async function submitBulkAssociationMemberAction(
  _state: BulkAssociationMemberActionState,
  formData: FormData,
): Promise<BulkAssociationMemberActionState> {
  const ctx = await getCurrentUserContext();
  if (!["admin", "reviewer"].includes(ctx.role)) redirect("/access-denied");
  const memberIds = formData.getAll("member_ids").map(String);
  const action = String(formData.get("bulk_action") ?? "").trim();
  const targetMode = String(formData.get("target_mode") ?? "selected") === "filtered" ? "filtered" : "selected";
  if (!(ASSOCIATION_MEMBER_BULK_ACTIONS as readonly string[]).includes(action)) return { ok: false, message: "Unsupported bulk action." };
  let filters: AdminAssociationMemberFilters = {};
  try {
    filters = JSON.parse(String(formData.get("filter_snapshot") ?? "{}")) as AdminAssociationMemberFilters;
  } catch {
    return { ok: false, message: "The filter snapshot is invalid. Refresh the page and try again." };
  }
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const result = await runBulkAssociationMemberAction(supabase, {
      ctx,
      memberIds,
      filters,
      targetMode,
      confirmed: formData.get("confirmed") === "yes",
      action: action as (typeof ASSOCIATION_MEMBER_BULK_ACTIONS)[number],
      reason: String(formData.get("reason") ?? "").trim(),
      assignedReviewerId: String(formData.get("assigned_reviewer_id") ?? "").trim(),
    });
    refresh();
    return {
      ok: true,
      message: `Bulk operation completed. ${result.successful} succeeded, ${result.skipped} skipped, ${result.failed} failed.`,
      result,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to complete bulk action." };
  }
}
