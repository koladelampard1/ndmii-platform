import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { exportLcdboOperationalData, type LcdboExportDataset } from "@/lib/data/lcdbo-operations";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const DATASETS = new Set<LcdboExportDataset>(["enrolments", "cluster-interests", "cluster-members", "readiness", "documents"]);

export async function GET(_: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!DATASETS.has(dataset as LcdboExportDataset)) return NextResponse.json({ error: "Unknown export dataset." }, { status: 404 });
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!programme || !ctx.appUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permission = await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: ["programme_officer", "admin", "super_admin", "institution_admin"], scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id });
  if (!permission.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const result = await exportLcdboOperationalData(dataset as LcdboExportDataset, ctx.appUserId, supabase);
    return new NextResponse(result.csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to generate LCDBO export." }, { status: 500 });
  }
}
