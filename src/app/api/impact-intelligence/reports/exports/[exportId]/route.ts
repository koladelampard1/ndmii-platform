import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  IMPACT_REPORT_SIGNED_URL_SECONDS,
  getInstitutionalReportExportAccess,
  logImpactReportDiagnostic,
} from "@/lib/data/impact-reports";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  const { exportId } = await params;
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx.appUserId || ctx.role === "public") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const record = await getInstitutionalReportExportAccess(ctx, exportId);
    const supabase = await createServiceRoleSupabaseClient();
    const fileName = typeof record.metadata?.file_name === "string" ? record.metadata.file_name.replace(/["\r\n]/g, "_") : `institutional-report.${record.export_format}`;
    const { data, error } = await supabase.storage.from(record.storage_bucket).createSignedUrl(
      record.storage_path,
      IMPACT_REPORT_SIGNED_URL_SECONDS,
      { download: fileName },
    );
    if (error || !data?.signedUrl) {
      logImpactReportDiagnostic({ operation: "report_export_signed_url_failed", role: ctx.role, authUserId: ctx.authUserId, appUserId: ctx.appUserId, reportId: record.report_id, reportVersionId: record.report_version_id, errorMessage: error?.message ?? "signed_url_missing", success: false });
      return NextResponse.json({ ok: false, error: "Secure report download is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (error) {
    logImpactReportDiagnostic({ operation: "report_export_download_failed", errorMessage: error instanceof Error ? error.message : "unknown_error", success: false });
    const forbidden = error instanceof Error && error.message.includes("permission");
    return NextResponse.json({ ok: false, error: forbidden ? "You cannot access this report export." : "Secure report download is temporarily unavailable." }, { status: forbidden ? 403 : 503 });
  }
}

