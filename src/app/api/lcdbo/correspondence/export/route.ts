import { NextResponse } from "next/server";
import { correspondenceCsv, getCorrespondenceRegister, requireLcdboCorrespondenceAccess } from "@/lib/data/lcdbo-correspondence";

export async function GET() {
  try {
    const { supabase } = await requireLcdboCorrespondenceAccess("export");
    const register = await getCorrespondenceRegister({ page: 1, pageSize: 50 }, supabase);
    return new NextResponse(correspondenceCsv(register.records), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"lcdb-o-correspondence-register.csv\"",
      },
    });
  } catch {
    return NextResponse.json({ error: "Correspondence export is unavailable." }, { status: 403 });
  }
}
