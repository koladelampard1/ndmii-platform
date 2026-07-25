import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { exportLcdboDeliveryData, requireLcdboDeliveryAccess, type LcdboDeliveryExportDataset } from "@/lib/data/lcdbo-delivery";

export const dynamic = "force-dynamic";

const DATASETS = new Set<LcdboDeliveryExportDataset>(["workstreams", "milestones", "raid", "decisions"]);

export async function GET(_: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!DATASETS.has(dataset as LcdboDeliveryExportDataset)) return NextResponse.json({ error: "Unknown export dataset." }, { status: 404 });
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const access = await requireLcdboDeliveryAccess("export", supabase);
    const result = await exportLcdboDeliveryData(dataset as LcdboDeliveryExportDataset, access.ctx.appUserId!, supabase);
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to generate LCDBO delivery export." }, { status: 403 });
  }
}
