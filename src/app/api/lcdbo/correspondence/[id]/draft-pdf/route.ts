import { NextResponse } from "next/server";
import { generateCorrespondenceDraftPdf, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireLcdboCorrespondenceAccess("view");
    const pdf = await generateCorrespondenceDraftPdf(id, supabase);
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="lcdbo-correspondence-draft-${id}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Draft PDF is unavailable." }, { status: 404 });
  }
}
