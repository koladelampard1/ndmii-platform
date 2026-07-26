import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { exportLcdboDeliveryData, requireLcdboDeliveryAccess, type LcdboDeliveryExportDataset } from "@/lib/data/lcdbo-delivery";
import { exportLcdboGeographyDeliveryData, type LcdboGeographyDeliveryExportDataset } from "@/lib/data/lcdbo-delivery-geography";
import { exportLcdboSprint3Data, type Sprint3ExportDataset } from "@/lib/data/lcdbo-delivery-intelligence";

export const dynamic = "force-dynamic";

const SPRINT1_DATASETS = new Set<LcdboDeliveryExportDataset>(["workstreams", "milestones", "raid", "decisions"]);
const SPRINT2_DATASETS = new Set<LcdboGeographyDeliveryExportDataset>(["states", "lgas", "clusters", "activities", "progress-updates", "my-work"]);
const SPRINT3_DATASETS = new Set<Sprint3ExportDataset>([
  "executive-metrics",
  "executive-attention",
  "pilot-readiness",
  "evidence",
  "programme-delivery",
  "workstream-performance",
  "milestone-deliverable",
  "risk-issue",
  "state-delivery",
  "lga-delivery",
  "cluster-delivery",
  "executive-exceptions",
  "evidence-verification",
]);

export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!SPRINT1_DATASETS.has(dataset as LcdboDeliveryExportDataset) && !SPRINT2_DATASETS.has(dataset as LcdboGeographyDeliveryExportDataset) && !SPRINT3_DATASETS.has(dataset as Sprint3ExportDataset)) return NextResponse.json({ error: "Unknown export dataset." }, { status: 404 });
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const access = await requireLcdboDeliveryAccess("export", supabase);
    const includeTestData = new URL(request.url).searchParams.get("include_test") === "true";
    const result = SPRINT1_DATASETS.has(dataset as LcdboDeliveryExportDataset)
      ? await exportLcdboDeliveryData(dataset as LcdboDeliveryExportDataset, access.ctx.appUserId!, supabase)
      : SPRINT2_DATASETS.has(dataset as LcdboGeographyDeliveryExportDataset)
        ? await exportLcdboGeographyDeliveryData(dataset as LcdboGeographyDeliveryExportDataset, access)
        : await exportLcdboSprint3Data(dataset as Sprint3ExportDataset, supabase, includeTestData);
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
