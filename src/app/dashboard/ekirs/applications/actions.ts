"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { reviewStateRevenueApplication, reviewStateRevenueApplicationEvidence, type StateRevenueDecisionAction } from "@/lib/state-revenue/onboarding";

function text(formData: FormData, key: string, max = 500) {
  return String(formData.get(key) ?? "").normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function reviewEkirsApplicationAction(formData: FormData) {
  const applicationId = text(formData, "application_id", 80);
  const action = text(formData, "action", 80) as StateRevenueDecisionAction;
  if (!applicationId || !action) redirect("/dashboard/ekirs/applications?error=missing_action");
  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();
  try {
    await reviewStateRevenueApplication({
      applicationId,
      action,
      ctx,
      client: supabase,
      form: {
        notes: text(formData, "notes", 1000) || null,
        reasonCode: text(formData, "reason_code", 120) || null,
        sections: text(formData, "sections", 240) || null,
        evidenceIds: text(formData, "evidence_ids", 240) || null,
        dueAt: text(formData, "due_at", 40) || null,
        assignedReviewerId: text(formData, "assigned_reviewer_id", 80) || null,
        assignedFieldOfficerId: text(formData, "assigned_field_officer_id", 80) || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review application.";
    redirect(`/dashboard/ekirs/applications/${applicationId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard/ekirs");
  revalidatePath("/dashboard/ekirs/applications");
  revalidatePath(`/dashboard/ekirs/applications/${applicationId}`);
  redirect(`/dashboard/ekirs/applications/${applicationId}?success=${encodeURIComponent(action)}`);
}

export async function reviewEkirsEvidenceAction(formData: FormData) {
  const applicationId = text(formData, "application_id", 80);
  const evidenceId = text(formData, "evidence_id", 80);
  const status = text(formData, "evidence_status", 80) as "under_review" | "accepted" | "rejected" | "replacement_requested";
  if (!applicationId || !evidenceId || !status) redirect("/dashboard/ekirs/applications?error=missing_evidence_action");
  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();
  try {
    await reviewStateRevenueApplicationEvidence({
      evidenceId,
      status,
      note: text(formData, "review_note", 1000) || null,
      ctx,
      client: supabase,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review evidence.";
    redirect(`/dashboard/ekirs/applications/${applicationId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/dashboard/ekirs/applications/${applicationId}`);
  redirect(`/dashboard/ekirs/applications/${applicationId}?success=${encodeURIComponent(`evidence_${status}`)}`);
}
