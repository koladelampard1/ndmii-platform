import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const isPreviewDeployment = process.env.VERCEL_ENV === "preview";

function previewLog(event: string, payload: Record<string, unknown>) {
  if (!isPreviewDeployment) return;
  console.error(`[finance-readiness-submit][${event}]`, payload);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  try {
    const context = await getCurrentUserContext();

    if (!context.appUserId) {
      return NextResponse.json({ ok: false, code: "unauthorized", message: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();

    const { data: msmeLookupData, error: msmeLookupError } = await supabase
      .from("msmes")
      .select("id,msme_id,created_by")
      .eq("created_by", context.appUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const resolvedMsmeId = msmeLookupData?.id ?? null;

    previewLog("msme_lookup_result", {
      appUserId: context.appUserId,
      resolved_msme_id: resolvedMsmeId,
      lookup_data: msmeLookupData,
      lookup_error: msmeLookupError
        ? {
            code: msmeLookupError.code,
            message: msmeLookupError.message,
            details: msmeLookupError.details,
          }
        : null,
    });

    if (!resolvedMsmeId) {
      return NextResponse.json(
        { ok: false, code: "msme_not_found", message: "No MSME profile is linked to the authenticated user." },
        { status: 404 },
      );
    }

    const insertPayload = {
      ...(body ?? {}),
      msme_id: resolvedMsmeId,
    };

    const { error: insertError } = await supabase.from("finance_readiness_submissions").insert(insertPayload);

    if (insertError) {
      previewLog("insert_failure", {
        resolved_msme_id: resolvedMsmeId,
        error: {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
        },
      });

      const responseBody = isPreviewDeployment
        ? {
            ok: false,
            code: "insert_failed",
            error: {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
            },
            resolved_msme_id: resolvedMsmeId,
          }
        : {
            ok: false,
            code: "insert_failed",
            message: "Unable to submit finance readiness payload.",
          };

      return NextResponse.json(responseBody, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    previewLog("unexpected_error", {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });

    return NextResponse.json(
      { ok: false, code: "submit_failed", message: "Unable to submit finance readiness payload." },
      { status: 500 },
    );
  }
}
