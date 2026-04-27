import { redirect } from "next/navigation";
import { FinanceReadinessClient } from "./readiness-client";
import { FEATURE_FINANCE_READINESS, calculateProfileCompletion, type AutoSignals } from "@/lib/finance-readiness";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function FinanceReadinessPage() {
  if (!FEATURE_FINANCE_READINESS) {
    redirect("/dashboard/msme");
  }

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const [{ count: complaintCount }, { data: taxProfile }, { data: compliance }, { count: invoicesCount }, { count: paymentsCount }] = await Promise.all([
    supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .eq("msme_id", workspace.msme.id)
      .neq("status", "closed"),
    supabase.from("tax_profiles").select("compliance_status,vat_applicable").eq("msme_id", workspace.msme.id).maybeSingle(),
    supabase
      .from("compliance_profiles")
      .select("score")
      .eq("msme_id", workspace.msme.id)
      .order("last_reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("msme_id", workspace.msme.id),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("msme_id", workspace.msme.id),
  ]);

  const autoSignals: AutoSignals = {
    verificationStatus: workspace.msme.verification_status,
    profileCompletion: calculateProfileCompletion({
      businessName: workspace.msme.business_name,
      ownerName: workspace.msme.owner_name,
      sector: workspace.msme.sector,
      state: workspace.msme.state,
      contactEmail: workspace.msme.contact_email,
    }),
    openComplaints: complaintCount ?? 0,
    taxProfileStatus: taxProfile?.compliance_status ?? null,
    vatApplicable: taxProfile?.vat_applicable ?? null,
    complianceScore: compliance?.score ?? null,
    invoicesIssued: invoicesCount ?? 0,
    paymentsRecorded: paymentsCount ?? 0,
  };

  return <FinanceReadinessClient businessName={workspace.msme.business_name} dbinId={workspace.msme.msme_id} autoSignals={autoSignals} />;
}
