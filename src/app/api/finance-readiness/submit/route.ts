import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type FinanceReadinessSubmitPayload = {
  msmeId?: string;
  score?: number;
  readinessBand?: string;
  band?: string;
};

const FALLBACK_BAND = "Unrated";

function normalizeScore(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }
  }

  return null;
}

export async function POST(request: Request) {
  let payload: FinanceReadinessSubmitPayload;

  try {
    payload = (await request.json()) as FinanceReadinessSubmitPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Request payload must be valid JSON." }, { status: 400 });
  }

  const msmeId = String(payload.msmeId ?? "").trim();
  const score = normalizeScore(payload.score);
  const readinessBand = String(payload.readinessBand ?? payload.band ?? "").trim() || FALLBACK_BAND;

  if (!msmeId) {
    return NextResponse.json({ ok: false, message: "msmeId is required." }, { status: 400 });
  }

  if (score === null) {
    return NextResponse.json({ ok: false, message: "score must be a valid number." }, { status: 400 });
  }

  const supabase = await createServiceRoleSupabaseClient();

  const insertPayload = {
    msme_id: msmeId,
    score,
    readiness_band: readinessBand,
  };

  const { data, error } = await supabase
    .from("finance_readiness_assessments")
    .insert(insertPayload)
    .select("id, msme_id, score, readiness_band, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unable to save finance readiness assessment.",
        code: error.code,
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, assessment: data }, { status: 201 });
}
