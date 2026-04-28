import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentResponses, FinancePathway, MsmeReadinessSnapshot, ReadinessResult } from "modules/finance-readiness/types";

type AnySupabase = SupabaseClient<any, "public", any>;

export async function resolveMsmeForUser(supabase: AnySupabase, input: { appUserId?: string | null; email?: string | null }) {
  if (input.appUserId) {
    const { data } = await supabase
      .from("msmes")
      .select("id,msme_id,business_name,verification_status")
      .eq("created_by", input.appUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data;
  }

  if (input.email) {
    const { data } = await supabase
      .from("msmes")
      .select("id,msme_id,business_name,verification_status")
      .eq("contact_email", input.email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data;
  }

  return null;
}

export async function loadReadinessSnapshot(supabase: AnySupabase, msmeId: string): Promise<MsmeReadinessSnapshot> {
  const [{ data: msme }, { data: compliance }, { data: tax }, { count: openComplaints }, { count: resolvedComplaints }, { data: invoices }, { data: payments }] =
    await Promise.all([
      supabase
        .from("msmes")
        .select("business_name,msme_id,verification_status,review_status")
        .eq("id", msmeId)
        .maybeSingle(),
      supabase
        .from("compliance_profiles")
        .select("overall_status,nin_status,bvn_status,cac_status,tin_status")
        .eq("msme_id", msmeId)
        .order("last_reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("tax_profiles")
        .select("compliance_status")
        .eq("msme_id", msmeId)
        .maybeSingle(),
      supabase.from("complaints").select("id", { count: "exact", head: true }).eq("msme_id", msmeId).neq("status", "closed"),
      supabase.from("complaints").select("id", { count: "exact", head: true }).eq("msme_id", msmeId).eq("status", "closed"),
      supabase.from("invoices").select("id,status").eq("msme_id", msmeId),
      supabase.from("invoice_payments").select("payment_status,invoice_id"),
    ]);

  const paymentRows = (payments ?? []).filter((row: any) =>
    (invoices ?? []).some((invoice: any) => invoice.id === row.invoice_id),
  );
  const successful = paymentRows.filter((row: any) => row.payment_status === "success").length;
  const paymentSuccessRate = paymentRows.length ? Math.round((successful / paymentRows.length) * 100) : 0;

  const verificationHits = [
    msme?.verification_status,
    compliance?.overall_status,
    compliance?.nin_status,
    compliance?.bvn_status,
    compliance?.cac_status,
    compliance?.tin_status,
  ].filter((value) => ["verified", "approved", "compliant"].includes((value ?? "").toLowerCase())).length;

  const profileCompletion = Math.min(100, Math.round((verificationHits / 6) * 100));

  return {
    businessName: msme?.business_name ?? "Unknown Business",
    msmeIdLabel: msme?.msme_id ?? "N/A",
    verificationStatus: (msme?.verification_status ?? "pending").toLowerCase(),
    profileCompletion,
    complianceStatus: (compliance?.overall_status ?? "pending").toLowerCase(),
    taxComplianceStatus: (tax?.compliance_status ?? "pending").toLowerCase(),
    openComplaints: openComplaints ?? 0,
    resolvedComplaints: resolvedComplaints ?? 0,
    invoiceCount: invoices?.length ?? 0,
    paymentSuccessRate,
  };
}

export async function persistAssessment(supabase: AnySupabase, input: {
  msmeInternalId: string;
  pathway: FinancePathway;
  responses: AssessmentResponses;
  snapshot: MsmeReadinessSnapshot;
  result: ReadinessResult;
  createdBy: string | null;
}) {
  const { data, error } = await supabase
    .from("finance_readiness_assessments")
    .insert({
      msme_id: input.msmeInternalId,
      pathway: input.pathway,
      responses: input.responses,
      snapshot: input.snapshot,
      score: input.result.score,
      band: input.result.band,
      result: input.result,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}
