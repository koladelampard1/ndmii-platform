import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/msme/onboarding-wizard";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createLcdboEnrolment } from "@/lib/data/lcdbo-enrolment";

const ONBOARDING_SAVE_ERROR = "Unable to save profile details. Please refresh and try again.";
const MSME_EDITABLE_SELECT = "id,msme_id,business_name,owner_name,state,sector,contact_email,contact_phone,lga,address,business_type,nin,bvn,cac_number,tin,passport_photo_url,passport_photo_path,association_id,created_by,source_association_member_id,verification_status,review_status,registration_context";

function calculateConfidence(statuses: string[]) {
  const points = statuses.reduce((acc, status) => {
    if (status === "verified") return acc + 25;
    if (status === "mismatch") return acc + 10;
    if (status === "pending") return acc + 5;
    return acc;
  }, 0);

  return Math.max(0, Math.min(100, points));
}

function isMissingValidationResultsTable(error: { code?: string | null; message?: string | null } | null) {
  return error?.code === "PGRST205"
    || error?.code === "42P01"
    || error?.message?.includes("validation_results") && error.message.includes("schema cache");
}

function logOnboardingSaveError(params: {
  authUserId: string | null;
  appUserId: string;
  msmeId: string | null;
  operation: string;
  error?: { code?: string | null; message?: string | null } | null;
}) {
  console.error("[msme-onboarding-save]", {
    operation: params.operation,
    authUserId: params.authUserId,
    appUserId: params.appUserId,
    msmeId: params.msmeId,
    supabaseErrorCode: params.error?.code ?? null,
    supabaseErrorMessage: params.error?.message ?? null,
  });
}

async function saveOnboarding(formData: FormData) {
  "use server";

  const context = await getCurrentUserContext();
  const { authUserId, email, fullName, appUserId, role } = context;
  if (!email || !appUserId || !["msme", "admin"].includes(role)) {
    redirect("/login?message=Please sign in first");
  }

  const supabase = await createServiceRoleSupabaseClient();
  const intent = String(formData.get("intent") ?? "draft");
  let existing: any = null;

  if (context.linkedMsmeId) {
    const { data, error } = await supabase
      .from("msmes")
      .select(MSME_EDITABLE_SELECT)
      .eq("id", context.linkedMsmeId)
      .eq("created_by", appUserId)
      .maybeSingle();
    if (error) {
      logOnboardingSaveError({ authUserId, appUserId, msmeId: context.linkedMsmeId, operation: "lookup_linked_owned_msme", error });
      redirect(`/dashboard/msme/onboarding?error=${encodeURIComponent(ONBOARDING_SAVE_ERROR)}`);
    }
    existing = data;
  }

  if (!existing) {
    const { data, error } = await supabase
      .from("msmes")
      .select(MSME_EDITABLE_SELECT)
      .eq("created_by", appUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logOnboardingSaveError({ authUserId, appUserId, msmeId: context.linkedMsmeId, operation: "lookup_latest_owned_msme", error });
      redirect(`/dashboard/msme/onboarding?error=${encodeURIComponent(ONBOARDING_SAVE_ERROR)}`);
    }
    existing = data;
  }

  const fieldValue = (name: string, fallback: string | null = null) => (
    formData.has(name) ? String(formData.get(name) ?? "") : fallback ?? ""
  );
  const state = fieldValue("state", existing?.state ?? "Lagos");
  const businessName = fieldValue("business_name", existing?.business_name ?? "Untitled MSME");
  const ownerName = fieldValue("owner_name", existing?.owner_name ?? fullName ?? "Unknown Owner");
  const sector = fieldValue("sector", existing?.sector ?? "Services");
  const submittedProgramme = fieldValue("programme", String(existing?.registration_context?.programme ?? ""));
  const submittedSource = fieldValue("source", String(existing?.registration_context?.source ?? ""));
  const registrationContext = submittedProgramme === "lcdbo"
    ? { programme: "lcdbo", source: submittedSource || "lcdbo_public_site" }
    : existing?.registration_context ?? {};

  const kycPayload = {
    NIN: fieldValue("nin", existing?.nin),
    BVN: fieldValue("bvn", existing?.bvn),
    CAC: fieldValue("cac_number", existing?.cac_number),
    TIN: fieldValue("tin", existing?.tin),
  } as const;

  const { checks, overallStatus } = await runKycSimulation(kycPayload);
  const byProvider = new Map(checks.map((check) => [check.provider, check]));
  const submittedPassportPhotoPath = fieldValue("passport_photo_path");
  const terminalStatus = ["verified", "approved", "active"].includes(String(existing?.verification_status ?? "").toLowerCase())
    || ["verified", "approved", "active"].includes(String(existing?.review_status ?? "").toLowerCase());

  const basePayload = {
    business_name: businessName,
    owner_name: ownerName,
    state,
    sector,
    contact_email: fieldValue("contact_email", existing?.contact_email ?? email),
    contact_phone: fieldValue("contact_phone", existing?.contact_phone),
    lga: fieldValue("lga", existing?.lga),
    address: fieldValue("address", existing?.address),
    business_type: fieldValue("business_type", existing?.business_type),
    nin: kycPayload.NIN,
    bvn: kycPayload.BVN,
    cac_number: kycPayload.CAC,
    tin: kycPayload.TIN,
    passport_photo_path: submittedPassportPhotoPath || existing?.passport_photo_path || null,
    passport_photo_url: submittedPassportPhotoPath ? null : existing?.passport_photo_url ?? null,
    association_id: fieldValue("association_id", existing?.association_id) || null,
    ...(!terminalStatus ? {
      verification_status: intent === "submit" ? "pending_review" : "draft",
      review_status: intent === "submit" ? "pending_review" : "draft",
    } : {}),
    created_by: appUserId,
    registration_context: registrationContext,
  };

  const generatedMsmeId = existing?.msme_id ?? generateMsmeId(state);
  const { data, error } = existing?.id
    ? await supabase
        .from("msmes")
        .update(basePayload)
        .eq("id", existing.id)
        .eq("created_by", appUserId)
        .select("id,msme_id,passport_photo_url,passport_photo_path")
        .maybeSingle()
    : await supabase
        .from("msmes")
        .insert({ msme_id: generatedMsmeId, ...basePayload })
        .select("id,msme_id,passport_photo_url,passport_photo_path")
        .maybeSingle();

  if (error || !data) {
    logOnboardingSaveError({ authUserId, appUserId, msmeId: existing?.id ?? null, operation: existing?.id ? "update_owned_msme" : "insert_owned_msme", error });
    redirect(`/dashboard/msme/onboarding?error=${encodeURIComponent(ONBOARDING_SAVE_ERROR)}`);
  }

  await ensureWorkflowRecords(supabase, {
    msmeId: data.id,
    overallStatus,
    checks,
    taxDefaults: {
      estimatedMonthlyObligation: 125000,
      outstandingAmount: intent === "submit" ? 38000 : 50000,
      complianceStatus: intent === "submit" ? "pending" : "draft",
    },
  });

  if (registrationContext.programme === "lcdbo") {
    await createLcdboEnrolment({
      msmeId: data.id,
      actorUserId: appUserId,
      source: String(registrationContext.source || "lcdbo_public_site"),
      client: supabase,
    });
  }

  const nowIso = new Date().toISOString();
  const ninStatus = byProvider.get("NIN")?.status ?? "pending";
  const bvnStatus = byProvider.get("BVN")?.status ?? "pending";
  const cacStatus = byProvider.get("CAC")?.status ?? "pending";
  const tinStatus = byProvider.get("TIN")?.status ?? "pending";

  await supabase.from("compliance_profiles").upsert(
    {
      msme_id: data.id,
      overall_status: overallStatus,
      nin_status: ninStatus,
      bvn_status: bvnStatus,
      cac_status: cacStatus,
      tin_status: tinStatus,
      nin_checked_at: byProvider.get("NIN")?.checkedAt ?? nowIso,
      bvn_checked_at: byProvider.get("BVN")?.checkedAt ?? nowIso,
      cac_checked_at: byProvider.get("CAC")?.checkedAt ?? nowIso,
      tin_checked_at: byProvider.get("TIN")?.checkedAt ?? nowIso,
      nin_response_summary: byProvider.get("NIN")?.summary ?? null,
      bvn_response_summary: byProvider.get("BVN")?.summary ?? null,
      cac_response_summary: byProvider.get("CAC")?.summary ?? null,
      tin_response_summary: byProvider.get("TIN")?.summary ?? null,
      last_reviewed_at: nowIso,
    },
    { onConflict: "msme_id" }
  );

  const { error: validationResultError } = await supabase.from("validation_results").upsert(
    {
      msme_id: data.id,
      nin_status: ninStatus,
      bvn_status: bvnStatus,
      cac_status: cacStatus,
      tin_status: tinStatus,
      confidence_score: calculateConfidence([ninStatus, bvnStatus, cacStatus, tinStatus]),
      validation_summary: `KYC simulation ${overallStatus}. NIN ${ninStatus}, BVN ${bvnStatus}, CAC ${cacStatus}, TIN ${tinStatus}.`,
      validated_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "msme_id" }
  );

  if (validationResultError) {
    console.warn("[msme-onboarding-validation-results]", {
      operation: isMissingValidationResultsTable(validationResultError) ? "skip_missing_table" : "upsert_failed",
      authUserId,
      appUserId,
      msmeId: data.id,
      supabaseErrorCode: validationResultError.code ?? null,
      supabaseErrorMessage: validationResultError.message,
    });
  }

  await supabase.from("activity_logs").insert({
    actor_user_id: appUserId,
    action: intent === "submit" ? "msme_submitted" : "msme_draft_saved",
    entity_type: "msme",
    entity_id: data.id,
    metadata: {
      msme_id: data.msme_id,
      wizard_step: String(formData.get("currentStep") ?? "Review and Submit"),
      source: "onboarding_wizard",
      validation_status: overallStatus,
    },
  });

  redirect(`/dashboard/msme/onboarding?success=${intent}`);
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; programme?: string; source?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: associations } = await supabase.from("associations").select("id,name").order("name");
  const ctx = await getCurrentUserContext();

  const { data: latestMsme } = await supabase
    .from("msmes")
    .select("id,passport_photo_url,registration_context")
    .eq("created_by", ctx.appUserId ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestValidation: any = null;
  if (ctx.linkedMsmeId || ctx.role === "admin") {
    const query = supabase
      .from("validation_results")
      .select("msme_id,nin_status,bvn_status,cac_status,tin_status,confidence_score,validated_at,validation_summary")
      .order("validated_at", { ascending: false })
      .limit(1);

    const scoped = ctx.role === "msme" ? query.eq("msme_id", ctx.linkedMsmeId ?? "") : query;
    const { data, error } = await scoped.maybeSingle();
    if (error && !isMissingValidationResultsTable(error)) {
      console.warn("[msme-onboarding-validation-results]", {
        operation: "page_load_failed",
        appUserId: ctx.appUserId,
        msmeId: ctx.linkedMsmeId,
        supabaseErrorCode: error.code ?? null,
        supabaseErrorMessage: error.message,
      });
    }
    latestValidation = data;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Complete your profile at your own pace. Automated CAC, NIN, and BVN validation runs during every profile save.
      </div>
      {params.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {params.success === "submit" ? "Submission received and sent to reviewer queue." : "Draft saved successfully."}
        </div>
      )}
      {latestValidation && (
        <article className="rounded-xl border bg-white p-4 text-sm">
          <h3 className="font-semibold">Latest validation simulation summary</h3>
          <p className="mt-2">Confidence score: <strong>{latestValidation.confidence_score}%</strong></p>
          <p className="mt-1">NIN: {latestValidation.nin_status} • BVN: {latestValidation.bvn_status} • CAC: {latestValidation.cac_status} • TIN: {latestValidation.tin_status}</p>
          <p className="mt-1 text-xs text-slate-600">Validated at: {latestValidation.validated_at ? new Date(latestValidation.validated_at).toLocaleString() : "pending"}</p>
          <p className="mt-2 text-xs text-slate-700">{latestValidation.validation_summary ?? "Validation summary pending."}</p>
        </article>
      )}
      {params.error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{params.error}</div>}
      <OnboardingWizard
        associations={associations ?? []}
        onSave={saveOnboarding}
        initialPassportPhotoUrl={latestMsme?.passport_photo_url ?? null}
        registrationContext={
          (latestMsme?.registration_context as { programme?: string; source?: string } | null)
          ?? (params.programme === "lcdbo" ? { programme: "lcdbo", source: params.source || "lcdbo_public_site" } : null)
        }
      />
    </section>
  );
}
