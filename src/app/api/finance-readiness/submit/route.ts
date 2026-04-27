import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { generateAFRI } from "@/lib/finance-readiness/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FEATURE_FINANCE_READINESS, isFeatureEnabled } from "@/lib/feature-flags";

export async function POST() {
  if (!isFeatureEnabled(FEATURE_FINANCE_READINESS)) {
    return NextResponse.json({ error: "Finance readiness module is disabled." }, { status: 403 });
  }

  const ctx = await getCurrentUserContext();
  if (ctx.role !== "msme" || !ctx.linkedMsmeId) {
    return NextResponse.json({ error: "Only MSME users can submit this assessment." }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const afri = await generateAFRI(supabase, ctx.linkedMsmeId);

  const { data: inserted, error } = await supabase
    .from("finance_readiness_assessments")
    .insert({
      msme_id: ctx.linkedMsmeId,
      identity_score: afri.identityScore,
      financial_score: afri.financialScore,
      compliance_score: afri.complianceScore,
      operational_score: afri.operationalScore,
      growth_score: afri.growthScore,
      overall_score: afri.overallScore,
      readiness_level: afri.readinessLevel,
      afri_snapshot: afri,
      signal_snapshot: afri.signals,
      submitted_at: afri.generatedAt,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: "Could not persist assessment record." }, { status: 500 });
  }

  return NextResponse.json({
    assessmentId: inserted.id,
    downloadUrl: `/api/finance-readiness/${inserted.id}/report`,
    afri,
  });
}
