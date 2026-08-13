import { NextResponse } from "next/server";
import { createDeliveryEvidenceDownloadUrl, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export async function GET(_request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  try {
    const { evidenceId } = await params;
    const { ctx, supabase } = await requireLcdboCorrespondenceAccess("dispatch");
    const signedUrl = await createDeliveryEvidenceDownloadUrl({
      evidenceId,
      actorUserId: ctx.appUserId!,
      client: supabase,
    });
    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (error) {
    console.warn("[lcdbo-correspondence] evidence download failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Delivery evidence is unavailable." }, { status: 404 });
  }
}
