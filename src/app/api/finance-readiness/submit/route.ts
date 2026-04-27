import { NextResponse } from "next/server";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  calculateProfileCompletion,
  computeFinanceReadiness,
  FINANCE_READINESS_QUESTIONS,
  type AssessmentResponses,
  type AutoSignals,
} from "@/lib/finance-readiness";

type SubmitPayload = {
  responses?: AssessmentResponses;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as SubmitPayload | null;
  if (!payload?.responses || typeof payload.responses !== "object") {
    return NextResponse.json({ ok: false, message: "Assessment responses are required." }, { status: 400 });
  }

  const missingRequired = FINANCE_READINESS_QUESTIONS.filter((question) => question.type !== "short_text").some(
    (question) => !(payload.responses?.[question.id] ?? "").trim(),
  );

  if (missingRequired) {
    return NextResponse.json({ ok: false, message: "Please complete all required assessment fields." }, { status: 400 });
  }

  try {
    const workspace = await getProviderWorkspaceContext();
    const supabase = await createServiceRoleSupabaseClient();

    const [
      { data: msme },
      { data: openComplaints, count: complaintCount },
      { data: taxProfile },
      { data: compliance },
      { count: invoicesIssued },
      { count: paymentsRecorded },
    ] = await Promise.all([
      supabase
        .from("msmes")
        .select("id,msme_id,business_name,owner_name,sector,state,tin,nin,bvn,cac_number,contact_email,contact_phone,verification_status")
        .eq("id", workspace.msme.id)
        .maybeSingle(),
      supabase
        .from("complaints")
        .select("id,status", { count: "exact" })
        .eq("msme_id", workspace.msme.id)
        .neq("status", "closed"),
      supabase
        .from("tax_profiles")
        .select("compliance_status,vat_applicable")
        .eq("msme_id", workspace.msme.id)
        .maybeSingle(),
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
      verificationStatus: msme?.verification_status ?? workspace.msme.verification_status ?? null,
      profileCompletion: calculateProfileCompletion({
        businessName: msme?.business_name,
        ownerName: msme?.owner_name,
        sector: msme?.sector,
        state: msme?.state,
        tin: msme?.tin,
        nin: msme?.nin,
        bvn: msme?.bvn,
        cacNumber: msme?.cac_number,
        contactEmail: msme?.contact_email,
        contactPhone: msme?.contact_phone,
      }),
      openComplaints: complaintCount ?? openComplaints?.length ?? 0,
      taxProfileStatus: taxProfile?.compliance_status ?? null,
      vatApplicable: taxProfile?.vat_applicable ?? null,
      complianceScore: compliance?.score ?? null,
      invoicesIssued: invoicesIssued ?? 0,
      paymentsRecorded: paymentsRecorded ?? 0,
    };

    const result = computeFinanceReadiness(payload.responses, autoSignals);

    const { data: inserted, error } = await supabase
      .from("finance_readiness_assessments")
      .insert({
        msme_id: workspace.msme.id,
        submitted_by: workspace.appUserId,
        afri_score: result.totalScore,
        readiness_band: result.band,
        score_breakdown: result.breakdown,
        responses: payload.responses,
        auto_signals: autoSignals,
        strengths: result.strengths,
        gaps: result.gaps,
        recommendations: result.recommendations,
        risk_flags: result.riskFlags,
      })
      .select("id,created_at")
      .single();

    if (error) {
      console.error("[finance-readiness][submit]", error);
      return NextResponse.json({ ok: false, message: "Unable to save readiness assessment right now." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      assessmentId: inserted.id,
      createdAt: inserted.created_at,
      businessName: msme?.business_name ?? workspace.msme.business_name,
      dbinId: msme?.msme_id ?? workspace.msme.msme_id,
      autoSignals,
      result,
    });
  } catch (error) {
    console.error("[finance-readiness][submit][fatal]", error);
    return NextResponse.json({ ok: false, message: "Unable to process readiness assessment." }, { status: 500 });
  }
}
