import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/msme/onboarding-wizard";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";
import { ensureWorkflowRecords } from "@/lib/data/msme-workflow";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

async function saveOnboarding(formData: FormData) {
  "use server";

  const { user, profile } = await getCurrentUserContext();
  if (!user || !profile) {
    redirect("/login?message=Please sign in first");
  }

  const supabase = await createServerSupabaseClient();
  const intent = String(formData.get("intent") ?? "draft");
  const state = String(formData.get("state") ?? "Lagos");
  const businessName = String(formData.get("business_name") ?? "Untitled MSME");
  const ownerName = String(formData.get("owner_name") ?? profile.full_name ?? "Unknown Owner");
  const sector = String(formData.get("sector") ?? "Services");

  const kycPayload = {
    NIN: String(formData.get("nin") ?? ""),
    BVN: String(formData.get("bvn") ?? ""),
    CAC: String(formData.get("cac_number") ?? ""),
    TIN: String(formData.get("tin") ?? ""),
  } as const;

  const { checks, overallStatus } = await runKycSimulation(kycPayload);

  const basePayload = {
    business_name: businessName,
    owner_name: ownerName,
    state,
    sector,
    contact_email: String(formData.get("contact_email") ?? user.email ?? ""),
    contact_phone: String(formData.get("contact_phone") ?? ""),
    lga: String(formData.get("lga") ?? ""),
    address: String(formData.get("address") ?? ""),
    business_type: String(formData.get("business_type") ?? ""),
    nin: kycPayload.NIN,
    bvn: kycPayload.BVN,
    cac_number: kycPayload.CAC,
    tin: kycPayload.TIN,
    association_id: String(formData.get("association_id") || "") || null,
    verification_status: intent === "submit" ? "pending_review" : "draft",
    review_status: intent === "submit" ? "pending_review" : "draft",
    created_by: profile.id,
  };

  const { data: existing } = await supabase
    .from("msmes")
    .select("id,msme_id")
    .eq("created_by", profile.id)
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

  await supabase.from("activity_logs").insert({
    actor_user_id: profile.id,
    action: intent === "submit" ? "msme_submitted" : "msme_draft_saved",
    entity_type: "msme",
    entity_id: data.id,
    metadata: {
      msme_id: data.msme_id,
      wizard_step: String(formData.get("currentStep") ?? "Review and Submit"),
      source: "onboarding_wizard",
    },
  });

  redirect(`/dashboard/msme/onboarding?success=${intent}`);
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: associations } = await supabase.from("associations").select("id,name").order("name");

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        New MSMEs should start from <strong>Register MSME</strong>. This wizard now updates the same canonical onboarding record.
      </div>
      {params.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {params.success === "submit" ? "Submission received and sent to reviewer queue." : "Draft saved successfully."}
        </div>
      )}
      {params.error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{params.error}</div>}
      <OnboardingWizard associations={associations ?? []} onSave={saveOnboarding} />
    </section>
  );
}
