import { NextRequest, NextResponse } from "next/server";
import {
  createFinanceReadinessAssessment,
  type FinanceReadinessPathway,
} from "@/lib/msme/finance-readiness-assessments";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const pathway = body?.pathway;
  const score = Number.parseInt(String(body?.score ?? "0"), 10);
  const completion = Number.parseInt(String(body?.completion ?? "0"), 10);
  const band = String(body?.band ?? "Early-stage readiness");

  if (pathway !== "loan" && pathway !== "grant" && pathway !== "investment") {
    return NextResponse.json({ error: "Invalid pathway" }, { status: 400 });
  }

  const assessmentId = createFinanceReadinessAssessment({
    pathway: pathway as FinanceReadinessPathway,
    score: Number.isFinite(score) ? score : 0,
    completion: Number.isFinite(completion) ? completion : 0,
    band,
  });

  return NextResponse.json({ assessmentId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
