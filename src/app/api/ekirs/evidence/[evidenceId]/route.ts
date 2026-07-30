import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  STATE_REVENUE_EVIDENCE_SIGNED_URL_SECONDS,
  getStateRevenueEvidenceForAccess,
} from "@/lib/state-revenue/onboarding";

export const runtime = "nodejs";

function safeDownloadName(fileName: string) {
  return fileName.replace(/["\r\n]/g, "_");
}

export async function GET(request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const disposition = new URL(request.url).searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
  try {
    const ctx = await getCurrentUserContext();
    const supabase = await createServiceRoleSupabaseClient();
    const evidence = await getStateRevenueEvidenceForAccess({ evidenceId, ctx, client: supabase });
    if (!evidence?.storage_bucket || !evidence.storage_path || !evidence.original_filename) {
      return NextResponse.json({ ok: false, error: "Evidence file was not found." }, { status: 404 });
    }
    const { data, error } = await supabase.storage
      .from(evidence.storage_bucket)
      .createSignedUrl(evidence.storage_path, STATE_REVENUE_EVIDENCE_SIGNED_URL_SECONDS, {
        download: disposition === "attachment" ? safeDownloadName(evidence.original_filename) : false,
      });
    if (error || !data?.signedUrl) {
      return NextResponse.json({ ok: false, error: "Secure evidence access is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.redirect(data.signedUrl, 302);
  } catch {
    return NextResponse.json({ ok: false, error: "You cannot access this evidence file." }, { status: 403 });
  }
}
