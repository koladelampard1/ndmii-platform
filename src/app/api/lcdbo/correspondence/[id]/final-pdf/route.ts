import { NextResponse } from "next/server";
import { generateCorrespondenceFinalPdf, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireLcdboCorrespondenceAccess("view");
    const pdf = await generateCorrespondenceFinalPdf(id, supabase);
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="lcdbo-correspondence-final-${id}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Final PDF is unavailable until the correspondence has been issued." }, { status: 404 });
  }
}
