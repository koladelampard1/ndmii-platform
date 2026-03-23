import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerificationState } from "@/lib/integrations/adapters";

export function buildComplianceSnapshot(overallStatus: VerificationState) {
  return {
    score: overallStatus === "verified" ? 90 : overallStatus === "pending" ? 65 : 45,
    risk_level: overallStatus === "failed" ? "high" : "medium",
    overall_status: overallStatus,
  };
}

export async function ensureWorkflowRecords(
  supabase: SupabaseClient,
  params: {
    msmeId: string;
    overallStatus: VerificationState;
    checks: Array<{ provider: string; status: VerificationState | "mismatch" }>;
    taxDefaults?: {
      estimatedMonthlyObligation?: number;
      outstandingAmount?: number;
      complianceStatus?: string;
    };
  }
) {
  const complianceSnapshot = buildComplianceSnapshot(params.overallStatus);
  const nowIso = new Date().toISOString();

  await supabase.from("compliance_profiles").upsert(
    {
      msme_id: params.msmeId,
      ...complianceSnapshot,
      nin_status: params.checks.find((x) => x.provider === "NIN")?.status ?? "pending",
      bvn_status: params.checks.find((x) => x.provider === "BVN")?.status ?? "pending",
      cac_status: params.checks.find((x) => x.provider === "CAC")?.status ?? "pending",
      tin_status: params.checks.find((x) => x.provider === "TIN")?.status ?? "pending",
      nin_checked_at: params.checks.find((x) => x.provider === "NIN") ? nowIso : null,
      bvn_checked_at: params.checks.find((x) => x.provider === "BVN") ? nowIso : null,
      cac_checked_at: params.checks.find((x) => x.provider === "CAC") ? nowIso : null,
      tin_checked_at: params.checks.find((x) => x.provider === "TIN") ? nowIso : null,
      last_reviewed_at: nowIso,
    },
    { onConflict: "msme_id" }
  );

  await supabase.from("tax_profiles").upsert(
    {
      msme_id: params.msmeId,
      tax_category: "SME_STANDARD",
      vat_applicable: true,
      estimated_monthly_obligation: params.taxDefaults?.estimatedMonthlyObligation ?? 110000,
      outstanding_amount: params.taxDefaults?.outstandingAmount ?? 50000,
      compliance_status: params.taxDefaults?.complianceStatus ?? "pending",
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "msme_id" }
  );
}

export function normalizeReviewStatus(verificationStatus: string, reviewStatus: string | null) {
  if (reviewStatus) return reviewStatus;
  if (verificationStatus === "verified") return "approved";
  if (verificationStatus === "rejected") return "rejected";
  if (verificationStatus === "changes_requested") return "changes_requested";
  return "pending_review";
}
