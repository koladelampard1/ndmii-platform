"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  createRepresentativeCorrespondenceLetter,
  adoptLegacyRepresentativeLetter,
  createCorrespondenceRelationship,
  createCorrespondenceRecord,
  decideRepresentativeCounterpartyLetter,
  generateCorrespondenceNotificationJobs,
  recordCorrespondenceApproval,
  recordCorrespondenceDeliveryEvidence,
  recordCorrespondenceDispatch,
  recordCorrespondenceResponse,
  recordCorrespondenceSignature,
  requireLcdboCorrespondenceAccess,
  saveRepresentativeDraftVersion,
  sendCorrespondenceEmailDispatch,
  submitRepresentativeLetterToCounterparty,
  transitionCorrespondenceContactStatus,
  transitionCorrespondenceDeliveryEvidence,
  transitionCorrespondenceDelegation,
  transitionCorrespondenceTemplate,
  transitionCorrespondenceRecord,
  updateCorrespondenceResponseExpectation,
  upsertCorrespondenceContact,
  upsertCorrespondenceDelegation,
  upsertCorrespondenceTemplate,
} from "@/lib/data/lcdbo-correspondence";
import type { CorrespondenceStatus } from "@/lib/lcdbo-correspondence/types";

function success(path: string, message: string): never {
  revalidatePath("/dashboard/correspondence");
  revalidatePath("/dashboard/correspondence/register");
  revalidatePath(path);
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function failure(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function logActionFailure(label: string, error: unknown) {
  unstable_rethrow(error);
  console.warn(`[lcdbo-correspondence] ${label} failed`, error instanceof Error ? error.message : String(error));
}

export async function createCorrespondenceAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/register");
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("create");
    const record = await createCorrespondenceRecord({
      formData,
      actorUserId: ctx.appUserId!,
      programmeId: programme.id,
      client: supabase,
    });
    success(`/dashboard/correspondence/${record.id}`, "correspondence_created");
  } catch (error) {
    logActionFailure("create", error);
    failure(redirectTo, "correspondence_create_failed");
  }
}

export async function createRepresentativeLetterAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/create");
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("create");
    const record = await createRepresentativeCorrespondenceLetter({
      formData,
      actorUserId: ctx.appUserId!,
      programmeId: programme.id,
      client: supabase,
    });
    success(`/dashboard/correspondence/${record.id}`, "representative_letter_created");
  } catch (error) {
    logActionFailure("representative create", error);
    failure(redirectTo, "representative_letter_create_failed");
  }
}

export async function submitRepresentativeLetterAction(formData: FormData) {
  const recordId = String(formData.get("record_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? `/dashboard/correspondence/${recordId}`);
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("sign");
    await submitRepresentativeLetterToCounterparty({
      recordId,
      actorUserId: ctx.appUserId!,
      programmeId: programme.id,
      client: supabase,
    });
    success(redirectTo, "representative_letter_sent_to_counterparty");
  } catch (error) {
    logActionFailure("representative submit", error);
    failure(redirectTo, "representative_letter_submit_failed");
  }
}

export async function saveRepresentativeDraftAction(formData: FormData) {
  const recordId = String(formData.get("record_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? `/dashboard/correspondence/${recordId}`);
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("draft");
    await saveRepresentativeDraftVersion({
      recordId,
      formData,
      actorUserId: ctx.appUserId!,
      programmeId: programme.id,
      client: supabase,
    });
    success(redirectTo, "representative_draft_saved");
  } catch (error) {
    logActionFailure("representative draft save", error);
    failure(redirectTo, "representative_draft_save_failed");
  }
}

export async function adoptLegacyRepresentativeLetterAction(formData: FormData) {
  const recordId = String(formData.get("record_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? `/dashboard/correspondence/${recordId}`);
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("draft");
    await adoptLegacyRepresentativeLetter({
      recordId,
      actorUserId: ctx.appUserId!,
      programmeId: programme.id,
      client: supabase,
    });
    success(redirectTo, "representative_letter_recovered");
  } catch (error) {
    logActionFailure("representative legacy recovery", error);
    failure(redirectTo, "representative_letter_recovery_failed");
  }
}

export async function decideRepresentativeLetterAction(formData: FormData) {
  const recordId = String(formData.get("record_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? `/dashboard/correspondence/${recordId}`);
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("approve");
    await decideRepresentativeCounterpartyLetter({
      recordId,
      actorUserId: ctx.appUserId!,
      programmeId: programme.id,
      decision: String(formData.get("decision") ?? "approved") as "approved" | "revision_requested" | "rejected",
      note: String(formData.get("note") ?? "").trim() || null,
      client: supabase,
    });
    success(redirectTo, "representative_decision_recorded");
  } catch (error) {
    logActionFailure("representative decision", error);
    failure(redirectTo, "representative_decision_failed");
  }
}

export async function transitionCorrespondenceAction(formData: FormData) {
  const recordId = String(formData.get("record_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? (recordId ? `/dashboard/correspondence/${recordId}` : "/dashboard/correspondence/register"));
  try {
    const mode = String(formData.get("mode") ?? "review") as "review" | "sign" | "dispatch" | "administer";
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess(mode);
    await transitionCorrespondenceRecord({
      recordId,
      toStatus: String(formData.get("to_status") ?? "") as CorrespondenceStatus,
      actionType: String(formData.get("action_type") ?? "updated"),
      actorUserId: ctx.appUserId!,
      note: String(formData.get("note") ?? "").trim() || null,
      client: supabase,
    });
    success(redirectTo, "correspondence_updated");
  } catch (error) {
    logActionFailure("transition", error);
    failure(redirectTo, "correspondence_update_failed");
  }
}

export async function approveCorrespondenceAction(formData: FormData) {
  const recordId = String(formData.get("record_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? `/dashboard/correspondence/${recordId}`);
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("approve");
    await recordCorrespondenceApproval({
      recordId,
      decision: String(formData.get("decision") ?? "approved") as "approved" | "rejected" | "revision_requested",
      approvalRole: String(formData.get("approval_role") ?? "joint_secretariat"),
      actorUserId: ctx.appUserId!,
      note: String(formData.get("note") ?? "").trim() || null,
      client: supabase,
    });
    success(redirectTo, "correspondence_review_recorded");
  } catch (error) {
    logActionFailure("approval", error);
    failure(redirectTo, "correspondence_review_failed");
  }
}

export async function signCorrespondenceAction(formData: FormData) {
  const recordId = String(formData.get("record_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? `/dashboard/correspondence/${recordId}`);
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("sign");
    await recordCorrespondenceSignature({
      recordId,
      actorUserId: ctx.appUserId!,
      signatureRole: String(formData.get("signature_role") ?? "signatory_delegate"),
      client: supabase,
    });
    success(redirectTo, "correspondence_signed");
  } catch (error) {
    logActionFailure("signature", error);
    failure(redirectTo, "correspondence_signature_failed");
  }
}

export async function dispatchCorrespondenceAction(formData: FormData) {
  const recordId = String(formData.get("record_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? `/dashboard/correspondence/${recordId}`);
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("dispatch");
    await recordCorrespondenceDispatch({
      recordId,
      actorUserId: ctx.appUserId!,
      channel: String(formData.get("dispatch_channel") ?? "email"),
      trackingNumber: String(formData.get("tracking_number") ?? ""),
      note: String(formData.get("note") ?? "").trim() || null,
      client: supabase,
    });
    success(redirectTo, "correspondence_dispatched");
  } catch (error) {
    logActionFailure("dispatch", error);
    failure(redirectTo, "correspondence_dispatch_failed");
  }
}

export async function saveCorrespondenceContactAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/contacts");
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("administer");
    await upsertCorrespondenceContact({ formData, actorUserId: ctx.appUserId!, programmeId: programme.id, client: supabase });
    success(redirectTo, "contact_saved");
  } catch (error) {
    logActionFailure("contact save", error);
    failure(redirectTo, "contact_save_failed");
  }
}

export async function transitionCorrespondenceContactAction(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? (contactId ? `/dashboard/correspondence/contacts/${contactId}` : "/dashboard/correspondence/contacts"));
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("administer");
    const status = String(formData.get("contact_status") ?? "inactive") as "active" | "inactive" | "archived";
    if (status === "archived" && formData.get("confirm_archive") !== "on") throw new Error("Archive confirmation is required.");
    await transitionCorrespondenceContactStatus({
      contactId,
      status,
      actorUserId: ctx.appUserId!,
      note: String(formData.get("note") ?? "").trim() || null,
      client: supabase,
    });
    success(redirectTo, "contact_status_updated");
  } catch (error) {
    logActionFailure("contact transition", error);
    failure(redirectTo, "contact_status_update_failed");
  }
}

export async function saveCorrespondenceTemplateAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/templates");
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("administer");
    await upsertCorrespondenceTemplate({ formData, actorUserId: ctx.appUserId!, programmeId: programme.id, client: supabase });
    success(redirectTo, "template_saved");
  } catch (error) {
    logActionFailure("template save", error);
    failure(redirectTo, "template_save_failed");
  }
}

export async function transitionCorrespondenceTemplateAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/templates");
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("administer");
    await transitionCorrespondenceTemplate({
      templateId: String(formData.get("template_id") ?? ""),
      action: String(formData.get("template_action") ?? "submit") as "submit" | "approve" | "reject" | "retire",
      actorUserId: ctx.appUserId!,
      note: String(formData.get("note") ?? "").trim() || null,
      client: supabase,
    });
    success(redirectTo, "template_updated");
  } catch (error) {
    logActionFailure("template transition", error);
    failure(redirectTo, "template_update_failed");
  }
}

export async function saveCorrespondenceDelegationAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/delegations");
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("administer");
    await upsertCorrespondenceDelegation({ formData, actorUserId: ctx.appUserId!, programmeId: programme.id, client: supabase });
    success(redirectTo, "delegation_saved");
  } catch (error) {
    logActionFailure("delegation save", error);
    failure(redirectTo, "delegation_save_failed");
  }
}

export async function transitionCorrespondenceDelegationAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/delegations");
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("administer");
    await transitionCorrespondenceDelegation({
      delegationId: String(formData.get("delegation_id") ?? ""),
      action: String(formData.get("delegation_action") ?? "revoke") as "approve" | "revoke" | "expire",
      actorUserId: ctx.appUserId!,
      note: String(formData.get("note") ?? "").trim() || null,
      client: supabase,
    });
    success(redirectTo, "delegation_updated");
  } catch (error) {
    logActionFailure("delegation transition", error);
    failure(redirectTo, "delegation_update_failed");
  }
}

export async function recordDeliveryEvidenceAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/delivery-evidence");
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("dispatch");
    await recordCorrespondenceDeliveryEvidence({ formData, actorUserId: ctx.appUserId!, client: supabase });
    success(redirectTo, "delivery_evidence_recorded");
  } catch (error) {
    logActionFailure("delivery evidence", error);
    failure(redirectTo, "delivery_evidence_failed");
  }
}

export async function transitionDeliveryEvidenceAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/delivery-evidence");
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("administer");
    await transitionCorrespondenceDeliveryEvidence({
      evidenceId: String(formData.get("evidence_id") ?? ""),
      action: "invalidate",
      actorUserId: ctx.appUserId!,
      note: String(formData.get("note") ?? "").trim() || null,
      client: supabase,
    });
    success(redirectTo, "delivery_evidence_invalidated");
  } catch (error) {
    logActionFailure("delivery evidence transition", error);
    failure(redirectTo, "delivery_evidence_transition_failed");
  }
}

export async function recordResponseAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/responses");
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("draft");
    await recordCorrespondenceResponse({ formData, actorUserId: ctx.appUserId!, client: supabase });
    success(redirectTo, "response_recorded");
  } catch (error) {
    logActionFailure("response", error);
    failure(redirectTo, "response_record_failed");
  }
}

export async function createRelationshipAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/related");
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("draft");
    await createCorrespondenceRelationship({ formData, actorUserId: ctx.appUserId!, client: supabase });
    success(redirectTo, "relationship_created");
  } catch (error) {
    logActionFailure("relationship", error);
    failure(redirectTo, "relationship_create_failed");
  }
}

export async function updateResponseExpectationAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/responses");
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("draft");
    await updateCorrespondenceResponseExpectation({ formData, actorUserId: ctx.appUserId!, client: supabase });
    success(redirectTo, "response_expectation_updated");
  } catch (error) {
    logActionFailure("response expectation", error);
    failure(redirectTo, "response_expectation_failed");
  }
}

export async function generateReminderJobsAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/administration");
  try {
    const { ctx, programme, supabase } = await requireLcdboCorrespondenceAccess("administer");
    await generateCorrespondenceNotificationJobs({ actorUserId: ctx.appUserId!, programmeId: programme.id, client: supabase });
    success(redirectTo, "reminder_jobs_generated");
  } catch (error) {
    logActionFailure("reminder generation", error);
    failure(redirectTo, "reminder_jobs_failed");
  }
}

export async function sendEmailDispatchAction(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "/dashboard/correspondence/dispatch");
  try {
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("dispatch");
    await sendCorrespondenceEmailDispatch({ formData, actorUserId: ctx.appUserId!, client: supabase });
    success(redirectTo, "email_dispatch_attempt_recorded");
  } catch (error) {
    logActionFailure("email dispatch", error);
    failure(redirectTo, "email_dispatch_failed");
  }
}
