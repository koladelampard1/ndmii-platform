import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { evaluateFinanceReadiness } from "modules/finance-readiness/engine";
import type { AssessmentResponses, FinancePathway } from "modules/finance-readiness/types";
import { loadReadinessSnapshot, persistAssessment, resolveMsmeForUser } from "@/lib/finance-readiness/repository";

type SubmitPayload = {
  pathway: FinancePathway;
  responses: AssessmentResponses;
};

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentUserContext();
    if (ctx.role !== "msme") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Partial<SubmitPayload>;
    if (!body.pathway || !body.responses) {
      return NextResponse.json({ error: "Missing pathway or responses." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const msme = await resolveMsmeForUser(supabase, { appUserId: ctx.appUserId, email: ctx.email });

    if (!msme?.id) {
      return NextResponse.json({ error: "Unable to resolve an MSME profile for this user." }, { status: 404 });
    }

    const snapshot = await loadReadinessSnapshot(supabase, msme.id as string);
    const result = evaluateFinanceReadiness({
      pathway: body.pathway,
      responses: body.responses,
      snapshot,
    });

    const assessmentId = await persistAssessment(supabase, {
      msmeInternalId: msme.id as string,
      pathway: body.pathway,
      responses: body.responses,
      snapshot,
      result,
      createdBy: ctx.appUserId,
    });

    return NextResponse.json({
      assessmentId,
      pathway: body.pathway,
      score: result.score,
      band: result.band,
      breakdown: result.breakdown,
      strengths: result.strengths,
      gaps: result.gaps,
      recommendations: result.recommendations,
      riskFlags: result.riskFlags,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finance readiness submission failed." },
      { status: 500 },
    );
  }
}
