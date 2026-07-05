"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRegistryOperationsContext } from "@/app/dashboard/property/operations/_context";
import {
  addCaseComment,
  assignRegistryCase,
  generateCertificate,
  issueNpinAndCredential,
  reviewDocument,
  reviewOwner,
  syncSubmittedPropertiesToCases,
  updateCaseDecision,
} from "@/lib/property/property-operations-service";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function revalidateCase(caseId?: string | null) {
  revalidatePath("/dashboard/property/operations");
  revalidatePath("/dashboard/property/cases");
  revalidatePath("/dashboard/property/assignments");
  revalidatePath("/dashboard/property/verification");
  revalidatePath("/dashboard/property/certificates");
  revalidatePath("/dashboard/property/pending");
  revalidatePath("/dashboard/property/completed");
  if (caseId) revalidatePath(`/dashboard/property/review/${caseId}`);
}

function redirectToCase(caseId: string, success: string) {
  redirect(`/dashboard/property/review/${caseId}?success=${encodeURIComponent(success)}`);
}

function redirectToCaseError(caseId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Registry action failed.";
  redirect(`/dashboard/property/review/${caseId}?error=${encodeURIComponent(message)}`);
}

export async function syncRegistryCasesAction() {
  const { ctx, supabase } = await requireRegistryOperationsContext(true);
  try {
    await syncSubmittedPropertiesToCases({ client: supabase, actorUserId: ctx.appUserId! });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync registry cases.";
    redirect(`/dashboard/property/operations?error=${encodeURIComponent(message)}`);
  }
  revalidateCase();
  redirect("/dashboard/property/operations?success=cases_synced");
}

export async function addCaseCommentAction(formData: FormData) {
  const caseId = value(formData, "case_id");
  const { ctx, supabase } = await requireRegistryOperationsContext(true);
  try {
    await addCaseComment({ caseId, ctx, formData, client: supabase });
  } catch (error) {
    redirectToCaseError(caseId, error);
  }
  revalidateCase(caseId);
  redirectToCase(caseId, "comment_added");
}

export async function assignRegistryCaseAction(formData: FormData) {
  const caseId = value(formData, "case_id");
  const { ctx, supabase } = await requireRegistryOperationsContext(true);
  try {
    await assignRegistryCase({ caseId, ctx, formData, client: supabase });
  } catch (error) {
    redirectToCaseError(caseId, error);
  }
  revalidateCase(caseId);
  redirectToCase(caseId, "assignment_updated");
}

export async function updateCaseDecisionAction(formData: FormData) {
  const caseId = value(formData, "case_id");
  const { ctx, supabase } = await requireRegistryOperationsContext(true);
  try {
    await updateCaseDecision({ caseId, ctx, formData, client: supabase });
  } catch (error) {
    redirectToCaseError(caseId, error);
  }
  revalidateCase(caseId);
  redirectToCase(caseId, "decision_recorded");
}

export async function reviewDocumentAction(formData: FormData) {
  const caseId = value(formData, "case_id");
  const { ctx, supabase } = await requireRegistryOperationsContext(true);
  try {
    await reviewDocument({ caseId, ctx, formData, client: supabase });
  } catch (error) {
    redirectToCaseError(caseId, error);
  }
  revalidateCase(caseId);
  redirectToCase(caseId, "document_reviewed");
}

export async function reviewOwnerAction(formData: FormData) {
  const caseId = value(formData, "case_id");
  const { ctx, supabase } = await requireRegistryOperationsContext(true);
  try {
    await reviewOwner({ caseId, ctx, formData, client: supabase });
  } catch (error) {
    redirectToCaseError(caseId, error);
  }
  revalidateCase(caseId);
  redirectToCase(caseId, "ownership_reviewed");
}

export async function issueNpinCredentialAction(formData: FormData) {
  const caseId = value(formData, "case_id");
  const { ctx, supabase } = await requireRegistryOperationsContext(true);
  try {
    await issueNpinAndCredential({ caseId, ctx, client: supabase });
  } catch (error) {
    redirectToCaseError(caseId, error);
  }
  revalidateCase(caseId);
  redirectToCase(caseId, "npin_credential_issued");
}

export async function generateCertificateAction(formData: FormData) {
  const caseId = value(formData, "case_id");
  const { ctx, supabase } = await requireRegistryOperationsContext(true);
  try {
    await generateCertificate({ caseId, ctx, client: supabase });
  } catch (error) {
    redirectToCaseError(caseId, error);
  }
  revalidateCase(caseId);
  redirectToCase(caseId, "certificate_generated");
}
