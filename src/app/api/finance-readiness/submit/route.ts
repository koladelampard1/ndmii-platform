import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isFinanceReadinessEnabled() {
  const raw = process.env.FINANCE_READINESS_PREVIEW_ENABLED ?? process.env.NEXT_PUBLIC_FINANCE_READINESS_PREVIEW_ENABLED;
  if (raw == null) return true;
  return !["0", "false", "off", "no"].includes(String(raw).trim().toLowerCase());
}

function toSupabaseErrorDetails(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}) {
  return {
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

export async function POST(request: Request) {
  if (!isFinanceReadinessEnabled()) {
    return NextResponse.json(
      { ok: false, code: "feature_disabled", message: "Finance readiness preview is disabled for this environment." },
      { status: 404 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", message: "Invalid request payload." }, { status: 400 });
  }

  const ctx = await getCurrentUserContext();
  if (!ctx?.appUserId || !ctx?.email) {
    return NextResponse.json({ ok: false, code: "auth_required", message: "Please sign in to run finance readiness assessment." }, { status: 401 });
  }

  if (ctx.role !== "msme") {
    return NextResponse.json({ ok: false, code: "forbidden", message: "Only MSME accounts can submit a finance readiness assessment." }, { status: 403 });
  }

  if (!ctx.linkedMsmeId) {
    return NextResponse.json(
      {
        ok: false,
        code: "missing_msme_link",
        message: "We could not map your account to an MSME profile. Refresh your session and try again.",
      },
      { status: 409 },
    );
  }

  const supabase = await createServiceRoleSupabaseClient();

  const msmeLookupValue = ctx.linkedMsmeId.trim();
  const orClause = UUID_PATTERN.test(msmeLookupValue)
    ? `id.eq.${msmeLookupValue},msme_id.eq.${msmeLookupValue.toUpperCase()}`
    : `msme_id.eq.${msmeLookupValue.toUpperCase()}`;

  const { data: msmeRow, error: msmeLookupError } = await supabase
    .from("msmes")
    .select("id,msme_id,created_by,contact_email")
    .or(orClause)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (msmeLookupError) {
    console.error("[finance-readiness-submit][msme-lookup-error]", {
      ctxRole: ctx.role,
      ctxAppUserId: ctx.appUserId,
      ctxEmail: ctx.email,
      ctxLinkedMsmeId: ctx.linkedMsmeId,
      supabase: toSupabaseErrorDetails(msmeLookupError),
    });

    return NextResponse.json(
      {
        ok: false,
        code: "msme_lookup_failed",
        message: "Unable to resolve your MSME profile before saving finance readiness assessment.",
      },
      { status: 500 },
    );
  }

  if (!msmeRow?.id) {
    return NextResponse.json(
      {
        ok: false,
        code: "msme_not_found",
        message: "We could not find the MSME profile linked to your account.",
      },
      { status: 404 },
    );
  }

  const emailMatches = Boolean(msmeRow.contact_email && msmeRow.contact_email.toLowerCase() === ctx.email.toLowerCase());
  const creatorMatches = Boolean(msmeRow.created_by && msmeRow.created_by === ctx.appUserId);

  if (!emailMatches && !creatorMatches) {
    console.warn("[finance-readiness-submit][msme-ownership-mismatch]", {
      ctxAppUserId: ctx.appUserId,
      ctxEmail: ctx.email,
      ctxLinkedMsmeId: ctx.linkedMsmeId,
      resolvedMsmeId: msmeRow.id,
      resolvedPublicMsmeId: msmeRow.msme_id,
      msmeCreatedBy: msmeRow.created_by,
      msmeContactEmail: msmeRow.contact_email,
    });

    return NextResponse.json(
      {
        ok: false,
        code: "msme_ownership_mismatch",
        message: "Your account is not authorized to submit finance readiness records for this MSME profile.",
      },
      { status: 403 },
    );
  }

  const reportPayload = payload?.report ?? payload?.pdf ?? null;
  const assessmentPayload = payload?.assessment ?? payload?.responses ?? payload;
  const score = Number(payload?.score ?? payload?.overallScore ?? NaN);

  const insertPayload = {
    msme_id: msmeRow.id,
    submitted_by_user_id: ctx.appUserId,
    public_msme_id_snapshot: msmeRow.msme_id,
    score: Number.isFinite(score) ? score : null,
    readiness_band: typeof payload?.readiness_band === "string" ? payload.readiness_band : typeof payload?.readinessBand === "string" ? payload.readinessBand : null,
    assessment_payload: assessmentPayload ?? {},
    report_payload: reportPayload,
    generated_pdf_url: typeof payload?.generated_pdf_url === "string" ? payload.generated_pdf_url : typeof payload?.pdfUrl === "string" ? payload.pdfUrl : null,
  };

  const { data: insertedAssessment, error: insertError } = await supabase
    .from("finance_readiness_assessments")
    .insert(insertPayload)
    .select("id,msme_id,created_at")
    .maybeSingle();

  if (insertError) {
    console.error("[finance-readiness-submit][insert-error]", {
      ctxAppUserId: ctx.appUserId,
      ctxEmail: ctx.email,
      ctxLinkedMsmeId: ctx.linkedMsmeId,
      resolvedMsmeId: msmeRow.id,
      resolvedPublicMsmeId: msmeRow.msme_id,
      insertPayloadSummary: {
        msme_id: insertPayload.msme_id,
        submitted_by_user_id: insertPayload.submitted_by_user_id,
        hasAssessmentPayload: Boolean(insertPayload.assessment_payload),
        hasReportPayload: Boolean(insertPayload.report_payload),
      },
      supabase: toSupabaseErrorDetails(insertError),
    });

    return NextResponse.json(
      {
        ok: false,
        code: "assessment_persist_failed",
        message: "Finance readiness assessment could not be saved. Please retry; server logs include the exact Supabase error details.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: insertedAssessment?.id ?? null,
    msme_id: insertedAssessment?.msme_id ?? msmeRow.id,
    created_at: insertedAssessment?.created_at ?? null,
  });
}
