import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/msme/onboarding-wizard";
import { supabase } from "@/lib/supabase/client";
import { generateMsmeId, runKycSimulation } from "@/lib/data/ndmii";

async function saveOnboarding(formData: FormData) {
  "use server";

  const intent = String(formData.get("intent") ?? "draft");
  const state = String(formData.get("state") ?? "Lagos");
  const msmeId = generateMsmeId(state);
  const businessName = String(formData.get("business_name") ?? "Untitled MSME");
  const ownerName = String(formData.get("owner_name") ?? "Unknown Owner");
  const sector = String(formData.get("sector") ?? "Services");

  const kycPayload = {
    NIN: String(formData.get("nin") ?? ""),
    BVN: String(formData.get("bvn") ?? ""),
    CAC: String(formData.get("cac_number") ?? ""),
    TIN: String(formData.get("tin") ?? ""),
  } as const;

  const { checks, overallStatus } = await runKycSimulation(kycPayload);

  const { data } = await supabase
    .from("msmes")
    .insert({
      msme_id: msmeId,
      business_name: businessName,
      owner_name: ownerName,
      state,
      sector,
      nin: kycPayload.NIN,
      bvn: kycPayload.BVN,
      cac_number: kycPayload.CAC,
      tin: kycPayload.TIN,
      association_id: String(formData.get("association_id") || "") || null,
      verification_status: intent === "submit" ? "pending_review" : "draft",
    })
    .select("id")
    .single();

  if (data?.id) {
    await supabase.from("compliance_profiles").insert({
      msme_id: data.id,
      score: overallStatus === "verified" ? 90 : overallStatus === "pending" ? 65 : 45,
      risk_level: overallStatus === "failed" ? "high" : "medium",
      overall_status: overallStatus,
      nin_status: checks.find((x) => x.provider === "NIN")?.status ?? "pending",
      bvn_status: checks.find((x) => x.provider === "BVN")?.status ?? "pending",
      cac_status: checks.find((x) => x.provider === "CAC")?.status ?? "pending",
      tin_status: checks.find((x) => x.provider === "TIN")?.status ?? "pending",
      admin_override_status: null,
    });

    await supabase.from("tax_profiles").insert({
      msme_id: data.id,
      tax_category: "SME_STANDARD",
      vat_applicable: true,
      estimated_monthly_obligation: 125000,
      outstanding_amount: 38000,
      compliance_status: "pending",
    });

    await supabase.from("activity_logs").insert({
      action: intent === "submit" ? "msme_submitted" : "msme_draft_saved",
      entity_type: "msme",
      entity_id: data.id,
      metadata: {
        wizard_step: String(formData.get("currentStep") ?? "Review and Submit"),
      },
    });
  }

  redirect(`/dashboard/msme/onboarding?success=${intent}`);
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const params = await searchParams;
  const { data: associations } = await supabase.from("associations").select("id,name").order("name");

  return (
    <section className="space-y-4">
      {params.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {params.success === "submit" ? "Submission received and sent to reviewer queue." : "Draft saved successfully."}
        </div>
      )}
      <OnboardingWizard associations={associations ?? []} onSave={saveOnboarding} />
    </section>
  );
}
