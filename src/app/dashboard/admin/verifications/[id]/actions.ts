"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { runAdminVerificationAction, type AdminVerificationAction } from "@/lib/data/admin-verification-actions";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type AdminVerificationActionState = {
  ok: boolean;
  message: string;
};

const ACTION_MESSAGES: Record<AdminVerificationAction, string> = {
  start_review: "Review started.",
  request_documents: "Document request recorded.",
  escalate: "Verification escalated.",
  mark_verified: "Verification marked verified.",
  reject: "Verification rejected.",
  reopen: "Review reopened.",
  save_notes: "Reviewer notes saved.",
  reassign: "Reviewer assignment updated.",
};

function values(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? "").trim()).filter(Boolean);
}

function friendlyErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to complete action.";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("awaiting_documents") ||
    normalized.includes("awaiting documents") ||
    normalized.includes("must be under review") ||
    normalized.includes("invalid verification review transition")
  ) {
    return "This verification must be resumed before a decision can be recorded.";
  }
  return message.replaceAll("_", " ");
}

export async function submitAdminVerificationAction(_state: AdminVerificationActionState, formData: FormData): Promise<AdminVerificationActionState> {
  const ctx = await getCurrentUserContext();
  if (!["admin", "reviewer"].includes(ctx.role)) redirect("/access-denied");

  const msmeId = String(formData.get("msme_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim() as AdminVerificationAction;
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const customDocument = String(formData.get("custom_document") ?? "").trim();
  const requestedDocuments = [...values(formData, "requested_documents"), customDocument].filter(Boolean);
  const assignedReviewerId = String(formData.get("assigned_reviewer_id") ?? "").trim();

  try {
    const supabase = await createServiceRoleSupabaseClient();
    const result = await runAdminVerificationAction(supabase, {
      ctx,
      msmeId,
      action,
      reason,
      notes,
      requestedDocuments,
      assignedReviewerId,
    });
    revalidatePath(`/dashboard/admin/verifications/${msmeId}`);
    revalidatePath("/dashboard/admin/verifications");
    revalidatePath(`/dashboard/admin/msmes/${msmeId}`);
    if (result.noOp) return { ok: true, message: result.message ?? "Action completed." };
    return { ok: true, message: ACTION_MESSAGES[action] ?? "Action completed." };
  } catch (error) {
    console.info("[admin-verification-actions]", {
      operation: "submit_admin_verification_action",
      actorRole: ctx.role,
      msmeId,
      action,
      success: false,
      supabaseErrorCode: error instanceof Error ? error.name : "unknown",
      supabaseErrorMessage: error instanceof Error ? error.message : "Action failed",
    });
    return { ok: false, message: friendlyErrorMessage(error) };
  }
}
