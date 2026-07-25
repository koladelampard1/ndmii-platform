import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { exportLcdboDeliveryData, requireLcdboDeliveryAccess, type LcdboDeliveryExportDataset } from "@/lib/data/lcdbo-delivery";
import { exportLcdboGeographyDeliveryData, type LcdboGeographyDeliveryExportDataset } from "@/lib/data/lcdbo-delivery-geography";

export const dynamic = "force-dynamic";

const SPRINT1_DATASETS = new Set<LcdboDeliveryExportDataset>(["workstreams", "milestones", "raid", "decisions"]);
const SPRINT2_DATASETS = new Set<LcdboGeographyDeliveryExportDataset>(["states", "lgas", "clusters", "activities", "progress-updates", "my-work"]);

export async function GET(_: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!SPRINT1_DATASETS.has(dataset as LcdboDeliveryExportDataset) && !SPRINT2_DATASETS.has(dataset as LcdboGeographyDeliveryExportDataset)) return NextResponse.json({ error: "Unknown export dataset." }, { status: 404 });
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const access = await requireLcdboDeliveryAccess("export", supabase);
    const result = SPRINT1_DATASETS.has(dataset as LcdboDeliveryExportDataset)
      ? await exportLcdboDeliveryData(dataset as LcdboDeliveryExportDataset, access.ctx.appUserId!, supabase)
      : await exportLcdboGeographyDeliveryData(dataset as LcdboGeographyDeliveryExportDataset, access);
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
