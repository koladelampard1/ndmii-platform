import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/msme/onboarding-wizard";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

async function saveOnboarding(formData: FormData) {
  "use server";

  const context = await getCurrentUserContext();
  const { email, fullName, appUserId, role } = context;
  if (!email || !appUserId || !["msme", "admin"].includes(role)) {
    redirect("/login?message=Please sign in first");
  }

  const supabase = await createServerSupabaseClient();
  const intent = String(formData.get("intent") ?? "draft");
  const state = String(formData.get("state") ?? "Lagos");
  const businessName = String(formData.get("business_name") ?? "Untitled MSME");
  const ownerName = String(formData.get("owner_name") ?? fullName ?? "Unknown Owner");
  const sector = String(formData.get("sector") ?? "Services");

  const kycPayload = {
    NIN: String(formData.get("nin") ?? ""),
    BVN: String(formData.get("bvn") ?? ""),
    CAC: String(formData.get("cac_number") ?? ""),
    TIN: String(formData.get("tin") ?? ""),
  } as const;

  const { checks, overallStatus } = await runKycSimulation(kycPayload);
  const byProvider = new Map(checks.map((check) => [check.provider, check]));

  const basePayload = {
    business_name: businessName,
    owner_name: ownerName,
    state,
    sector,
    contact_email: String(formData.get("contact_email") ?? email ?? ""),
    contact_phone: String(formData.get("contact_phone") ?? ""),
    lga: String(formData.get("lga") ?? ""),
    address: String(formData.get("address") ?? ""),
    business_type: String(formData.get("business_type") ?? ""),
    nin: kycPayload.NIN,
    bvn: kycPayload.BVN,
    cac_number: kycPayload.CAC,
    tin: kycPayload.TIN,
    passport_photo_url: String(formData.get("passport_photo_data") ?? "") || null,
    association_id: String(formData.get("association_id") || "") || null,
    verification_status: intent === "submit" ? "pending_review" : "draft",
    review_status: intent === "submit" ? "pending_review" : "draft",
    created_by: appUserId,
  };

  const { data: existing } = await supabase
    .from("msmes")
    .select("id,msme_id")
    .eq("created_by", appUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = existing?.id
    ? await supabase.from("msmes").update(basePayload).eq("id", existing.id).select("id,msme_id").single()
    : await supabase
        .from("msmes")
        .insert({ msme_id: generateMsmeId(state), ...basePayload })
        .select("id,msme_id")
        .single();

  if (error || !data) {
    redirect(`/dashboard/msme/onboarding?error=${encodeURIComponent(error?.message ?? "Unable to save onboarding form")}`);
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

  await supabase.from("compliance_profiles").upsert(
    {
      msme_id: data.id,
      overall_status: overallStatus,
      nin_status: byProvider.get("NIN")?.status ?? "pending",
      bvn_status: byProvider.get("BVN")?.status ?? "pending",
      cac_status: byProvider.get("CAC")?.status ?? "pending",
      tin_status: byProvider.get("TIN")?.status ?? "pending",
      nin_checked_at: byProvider.get("NIN")?.checkedAt ?? new Date().toISOString(),
      bvn_checked_at: byProvider.get("BVN")?.checkedAt ?? new Date().toISOString(),
      cac_checked_at: byProvider.get("CAC")?.checkedAt ?? new Date().toISOString(),
      tin_checked_at: byProvider.get("TIN")?.checkedAt ?? new Date().toISOString(),
      nin_response_summary: byProvider.get("NIN")?.summary ?? null,
      bvn_response_summary: byProvider.get("BVN")?.summary ?? null,
      cac_response_summary: byProvider.get("CAC")?.summary ?? null,
      tin_response_summary: byProvider.get("TIN")?.summary ?? null,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "msme_id" }
  );

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

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: associations } = await supabase.from("associations").select("id,name").order("name");
  const ctx = await getCurrentUserContext();

  let latestValidation: any = null;
  if (ctx.linkedMsmeId || ctx.role === "admin") {
    const query = supabase
      .from("compliance_profiles")
      .select("overall_status,nin_status,bvn_status,cac_status,nin_checked_at,bvn_checked_at,cac_checked_at,nin_response_summary,bvn_response_summary,cac_response_summary")
      .order("last_reviewed_at", { ascending: false })
      .limit(1);

    const scoped = ctx.role === "msme" ? query.eq("msme_id", ctx.linkedMsmeId ?? "") : query;
    const { data } = await scoped.maybeSingle();
    latestValidation = data;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        New MSMEs should start from <strong>Register MSME</strong>. Automated CAC, NIN, and BVN validation runs during every onboarding save.
      </div>
      {params.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {params.success === "submit" ? "Submission received and sent to reviewer queue." : "Draft saved successfully."}
        </div>
      )}
      {latestValidation && (
        <article className="rounded-xl border bg-white p-4 text-sm">
          <h3 className="font-semibold">Latest validation simulation summary</h3>
          <p className="mt-2">Overall status: <strong className="uppercase">{latestValidation.overall_status}</strong></p>
          <p className="mt-1">NIN: {latestValidation.nin_status} • {latestValidation.nin_checked_at ? new Date(latestValidation.nin_checked_at).toLocaleString() : "pending"}</p>
          <p className="mt-1">BVN: {latestValidation.bvn_status} • {latestValidation.bvn_checked_at ? new Date(latestValidation.bvn_checked_at).toLocaleString() : "pending"}</p>
          <p className="mt-1">CAC: {latestValidation.cac_status} • {latestValidation.cac_checked_at ? new Date(latestValidation.cac_checked_at).toLocaleString() : "pending"}</p>
        </article>
      )}
      {params.error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{params.error}</div>}
      <OnboardingWizard associations={associations ?? []} onSave={saveOnboarding} />
    </section>
  );
}
