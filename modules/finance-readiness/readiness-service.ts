import type { SupabaseClient } from "@supabase/supabase-js";
import {
  complianceScore,
  financialScore,
  growthScore,
  identityScore,
  operationalScore,
  type ReadinessSignals,
} from "./scoring-engine";

export type AFRI = {
  identityScore: number;
  financialScore: number;
  complianceScore: number;
  operationalScore: number;
  growthScore: number;
  overallScore: number;
  readinessLevel: "high" | "medium" | "emerging";
  generatedAt: string;
  signals: ReadinessSignals;
};

function resolveLevel(score: number): AFRI["readinessLevel"] {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "emerging";
}

export async function loadFinanceReadinessSignals(supabase: SupabaseClient, msmeId: string): Promise<ReadinessSignals> {
  const [{ data: msme }, { data: validation }, { data: compliance }, { data: provider }] = await Promise.all([
    supabase
      .from("msmes")
      .select("id,verification_status,review_status,updated_at")
      .eq("id", msmeId)
      .maybeSingle(),
    supabase
      .from("validation_results")
      .select("nin_status,bvn_status,cac_status,tin_status")
      .eq("msme_id", msmeId)
      .maybeSingle(),
    supabase
      .from("compliance_profiles")
      .select("overall_status,risk_level,score")
      .eq("msme_id", msmeId)
      .order("last_reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("provider_profiles")
      .select("id")
      .eq("msme_id", msmeId)
      .maybeSingle(),
  ]);

  const providerId = provider?.id ?? null;

  const [{ count: invoicesIssued }, { count: invoicesPaid }, { count: paymentsCount }, { data: membership }] = await Promise.all([
    providerId
      ? supabase.from("invoices").select("id", { count: "exact", head: true }).eq("provider_profile_id", providerId)
      : Promise.resolve({ count: 0 } as { count: number | null }),
    providerId
      ? supabase.from("invoices").select("id", { count: "exact", head: true }).eq("provider_profile_id", providerId).eq("status", "paid")
      : Promise.resolve({ count: 0 } as { count: number | null }),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("msme_id", msmeId),
    supabase.from("association_members").select("id").eq("msme_id", msmeId).limit(1),
  ]);

  return {
    verificationStatus: msme?.verification_status ?? null,
    reviewStatus: msme?.review_status ?? null,
    ninStatus: validation?.nin_status ?? null,
    bvnStatus: validation?.bvn_status ?? null,
    cacStatus: validation?.cac_status ?? null,
    tinStatus: validation?.tin_status ?? null,
    complianceOverallStatus: compliance?.overall_status ?? null,
    complianceRiskLevel: compliance?.risk_level ?? null,
    complianceScore: compliance?.score ?? null,
    invoicesIssued: invoicesIssued ?? 0,
    invoicesPaid: invoicesPaid ?? 0,
    paymentsCount: paymentsCount ?? 0,
    profileUpdatedAt: msme?.updated_at ?? null,
    hasAssociationMembership: Boolean(membership && membership.length > 0),
    hasProviderProfile: Boolean(providerId),
  };
}

export function buildAFRI(signals: ReadinessSignals): AFRI {
  const scoreIdentity = identityScore(signals);
  const scoreFinancial = financialScore(signals);
  const scoreCompliance = complianceScore(signals);
  const scoreOperational = operationalScore(signals);
  const scoreGrowth = growthScore(signals);

  const overallScore = Math.round((scoreIdentity + scoreFinancial + scoreCompliance + scoreOperational + scoreGrowth) / 5);

  return {
    identityScore: scoreIdentity,
    financialScore: scoreFinancial,
    complianceScore: scoreCompliance,
    operationalScore: scoreOperational,
    growthScore: scoreGrowth,
    overallScore,
    readinessLevel: resolveLevel(overallScore),
    generatedAt: new Date().toISOString(),
    signals,
  };
}

export async function generateAFRI(supabase: SupabaseClient, msmeId: string): Promise<AFRI> {
  const signals = await loadFinanceReadinessSignals(supabase, msmeId);
  return buildAFRI(signals);
}
