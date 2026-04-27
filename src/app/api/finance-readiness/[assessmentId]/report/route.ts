import { NextResponse } from "next/server";
import { buildFinanceReadinessPdf } from "@/lib/finance-readiness/pdf";
import type { AFRI } from "@/lib/finance-readiness/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FEATURE_FINANCE_READINESS, isFeatureEnabled } from "@/lib/feature-flags";

export async function GET(_: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  if (!isFeatureEnabled(FEATURE_FINANCE_READINESS)) {
    return NextResponse.json({ error: "Finance readiness module is disabled." }, { status: 403 });
  }

  const { assessmentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: row } = await supabase
    .from("finance_readiness_assessments")
    .select("id,msme_id,afri_snapshot")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  const afri = row.afri_snapshot as AFRI;
  const bytes = buildFinanceReadinessPdf(afri, row.msme_id);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="finance-readiness-${row.msme_id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
