import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  IMPACT_EVIDENCE_SIGNED_URL_SECONDS,
  getImpactEvidence,
  logImpactEvidenceDiagnostic,
  recordImpactEvidenceAccess,
} from "@/lib/data/impact-evidence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function safeDownloadName(fileName: string) {
  return fileName.replace(/["\r\n]/g, "_");
}

export async function GET(request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const disposition = new URL(request.url).searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

  try {
    const ctx = await getCurrentUserContext();
    if (!ctx.appUserId || ctx.role === "public") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { evidence } = await getImpactEvidence(ctx, evidenceId);
    if (!evidence) return NextResponse.json({ ok: false, error: "Evidence was not found." }, { status: 404 });
    if (!evidence.storage_bucket || !evidence.storage_path || !evidence.original_filename) {
      return NextResponse.json({ ok: false, error: "This legacy evidence record has no stored file." }, { status: 409 });
    }

    const supabase = await createServiceRoleSupabaseClient();
    const { data, error } = await supabase.storage
      .from(evidence.storage_bucket)
      .createSignedUrl(evidence.storage_path, IMPACT_EVIDENCE_SIGNED_URL_SECONDS, {
        download: disposition === "attachment" ? safeDownloadName(evidence.original_filename) : false,
      });

    if (error || !data?.signedUrl) {
      logImpactEvidenceDiagnostic({
        operation: "signed_url_failed",
        evidenceId,
        programmeId: evidence.programme_id,
        cohortId: evidence.cohort_id,
        fieldVisitId: evidence.field_visit_id,
        actorRole: ctx.role,
        errorMessage: error?.message ?? "signed_url_missing",
        success: false,
      });
      return NextResponse.json({ ok: false, error: "Secure evidence access is temporarily unavailable." }, { status: 503 });
    }

    await recordImpactEvidenceAccess(ctx, evidence, disposition);
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (error) {
    logImpactEvidenceDiagnostic({
      operation: "secure_access_failed",
      evidenceId,
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      success: false,
    });
    const forbidden = error instanceof Error && (error.message.includes("permission") || error.message.includes("assigned"));
    return NextResponse.json(
      { ok: false, error: forbidden ? "You cannot access this evidence file." : "Secure evidence access is temporarily unavailable." },
      { status: forbidden ? 403 : 503 },
    );
  }
}

