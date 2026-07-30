"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  saveStateRevenueApplicationDraft,
  lookupStateRevenueApplicationStatus,
  uploadStateRevenueApplicationEvidence,
  type StateRevenueApplicationInput,
} from "@/lib/state-revenue/onboarding";

function text(formData: FormData, key: string, max = 240) {
  return String(formData.get(key) ?? "").normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function optional(formData: FormData, key: string, max = 240) {
  const value = text(formData, key, max);
  return value || null;
}

function evidenceTypes(formData: FormData) {
  return formData.getAll("evidence_types").map((value) => String(value ?? "").trim()).filter(Boolean).slice(0, 8);
}

function applicationPayload(formData: FormData, applicationType: "new_business" | "existing_business"): StateRevenueApplicationInput {
  const payload: StateRevenueApplicationInput = {
    jurisdictionId: "ekiti",
    applicationType,
    existingBusinessId: optional(formData, "existing_business_id"),
    businessName: text(formData, "business_name", 160),
    ownerName: optional(formData, "owner_name", 160),
    contactEmail: text(formData, "contact_email", 160).toLowerCase(),
    contactPhone: optional(formData, "contact_phone", 40),
    sector: text(formData, "sector", 120),
    businessType: optional(formData, "business_type", 120),
    formalityStatus: (text(formData, "formality_status", 40) || "informal") as StateRevenueApplicationInput["formalityStatus"],
    cacNumber: optional(formData, "cac_number", 80),
    tin: optional(formData, "tin", 80),
    lgaName: text(formData, "lga_name", 120),
    town: text(formData, "town", 120),
    community: optional(formData, "community", 120),
    address: text(formData, "address", 500),
    landmark: optional(formData, "landmark", 240),
    locationType: text(formData, "location_type", 80) || "shop",
    businessActivity: text(formData, "business_activity", 500),
    operationCommencedOn: optional(formData, "operation_commenced_on", 20),
    evidenceTypes: evidenceTypes(formData),
    consentVersion: "ekirs-sprint1-uat-v1",
    privacyNoticeVersion: "ekirs-privacy-sprint1-v1",
    declarationAccepted: formData.get("declaration_accepted") === "on",
    locationConsentStatus: formData.get("location_consent") === "on" ? "granted" : "not_requested",
  };
  const intent = text(formData, "intent", 20) || "submit";
  if (intent === "submit" && (!payload.businessName || !payload.contactEmail || !payload.sector || !payload.lgaName || !payload.town || !payload.address || !payload.businessActivity)) {
    throw new Error("Please complete the required business and Ekiti operating-location fields.");
  }
  if (intent === "submit" && !payload.declarationAccepted) throw new Error("Please accept the declaration before submitting.");
  return payload;
}

async function saveApplication(formData: FormData, applicationType: "new_business" | "existing_business", errorPath: string) {
  const supabase = await createServiceRoleSupabaseClient();
  const ctx = await getCurrentUserContext().catch(() => null);
  if (!ctx?.appUserId) redirect(`/login?workspace=ekirs&next=${encodeURIComponent(errorPath)}`);
  const intent = text(formData, "intent", 20) === "draft" ? "draft" : "submit";
  const applicationId = optional(formData, "application_id", 80);
  let app;
  try {
    app = await saveStateRevenueApplicationDraft({
      applicationId,
      data: applicationPayload(formData, applicationType),
      ctx,
      client: supabase,
      submit: intent === "submit",
      applicantResponse: optional(formData, "applicant_response", 2000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit application.";
    redirect(`${errorPath}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard/ekirs");
  revalidatePath("/dashboard/ekirs/applications");
  revalidatePath(`/ekirs/apply/resume/${app.application_reference}`);
  redirect(intent === "draft"
    ? `/ekirs/apply/resume/${encodeURIComponent(app.application_reference)}?saved=1`
    : `/ekirs/apply/status?reference=${encodeURIComponent(app.application_reference)}&submitted=1`);
}

export async function submitEkirsNewApplicationAction(formData: FormData) {
  return saveApplication(formData, "new_business", "/ekirs/apply/new");
}

export async function submitEkirsExistingApplicationAction(formData: FormData) {
  return saveApplication(formData, "existing_business", "/ekirs/apply/existing");
}

export async function uploadEkirsApplicationEvidenceAction(formData: FormData) {
  const applicationId = text(formData, "application_id", 80);
  const reference = text(formData, "application_reference", 80);
  const evidenceType = text(formData, "evidence_type", 80);
  const replacementForEvidenceId = optional(formData, "replacement_for_evidence_id", 80);
  const file = formData.get("evidence_file");
  if (!applicationId || !reference || !evidenceType || !(file instanceof File)) {
    redirect(`/ekirs/apply/resume/${encodeURIComponent(reference || "missing")}?error=${encodeURIComponent("Choose an evidence type and file.")}`);
  }
  const ctx = await getCurrentUserContext();
  const supabase = await createServiceRoleSupabaseClient();
  try {
    await uploadStateRevenueApplicationEvidence({
      applicationId,
      evidenceType,
      file,
      replacementForEvidenceId,
      ctx,
      client: supabase,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload evidence.";
    redirect(`/ekirs/apply/resume/${encodeURIComponent(reference)}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard/ekirs/applications");
  revalidatePath(`/ekirs/apply/resume/${reference}`);
  redirect(`/ekirs/apply/resume/${encodeURIComponent(reference)}?uploaded=1`);
}

export async function lookupEkirsApplicationStatusAction(formData: FormData) {
  // TODO(rate-limit): plug this lookup into the platform request-throttling middleware before public launch.
  const reference = text(formData, "application_reference", 80);
  const email = text(formData, "contact_email", 160).toLowerCase();
  if (!reference || !email) redirect("/ekirs/apply/status?error=missing_lookup_fields");
  const result = await lookupStateRevenueApplicationStatus({ jurisdictionId: "ekiti", reference, email });
  const params = new URLSearchParams();
  params.set("reference", reference);
  params.set("lookup", result ? "found" : "not_found");
  if (result?.current_status) params.set("status", result.current_status);
  redirect(`/ekirs/apply/status?${params.toString()}`);
}
