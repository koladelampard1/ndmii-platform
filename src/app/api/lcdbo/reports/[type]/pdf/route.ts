import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { LCDBO_INTELLIGENCE_ROLES } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { generateReportSnapshot, isGovernanceSchemaUnavailable } from "@/lib/data/lcdbo-governance";
import { recordPlatformEvent } from "@/lib/data/platform-foundation";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createLcdboProgrammePdf } from "@/lib/reports/lcdbo-programme-pdf";
import { buildGovernedMetricsPayload, buildLcdboPdfInput, scopeLcdboSnapshot } from "@/lib/reports/lcdbo-reporting";

const TYPES = new Set(["national", "state", "cluster", "partner", "readiness", "participation"]);
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!TYPES.has(type)) return NextResponse.json({ error: "Unknown report type." }, { status: 404 });
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!ctx.appUserId || !programme || ctx.role === "msme") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: LCDBO_INTELLIGENCE_ROLES, scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id }).catch(() => ({ allowed: false }));
  if (!isPlatformAdmin(ctx.role) && !access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const supabase = await createServiceRoleSupabaseClient();
    const snapshot = await getLcdboIntelligenceSnapshot(supabase);
    const query = new URL(request.url).searchParams;
    const state = type === "state" && snapshot.states.some(([name]) => name === query.get("state")) ? query.get("state") : null;
    const cluster = type === "cluster" && snapshot.clusters.some((item) => item.id === query.get("cluster")) ? query.get("cluster") : null;
    const partner = type === "partner" && snapshot.partners.some((item) => item.id === query.get("partner")) ? query.get("partner") : null;
    const dimensions = { scope_type: state ? "state" : cluster ? "cluster" : partner ? "partner" : "programme", programme_id: programme.id, ...(state ? { state } : {}), ...(cluster ? { cluster_id: cluster } : {}), ...(partner ? { partner_id: partner } : {}) };
    const scoped = scopeLcdboSnapshot(snapshot, { reportType: type, state, cluster, partner });
    const pdf = createLcdboProgrammePdf(buildLcdboPdfInput({ snapshot: scoped, reportType: type }));
    let snapshotId: string | null = null;
    try {
      const exportMetrics = buildGovernedMetricsPayload(scoped);
      const reportSnapshot = await generateReportSnapshot({ programmeId: programme.id, reportType: type, frequency: "daily", generatedBy: ctx.appUserId, notes: "Snapshot captured from successful PDF export.", metrics: exportMetrics, dimensions, exportCapture: { capturedAt: new Date().toISOString(), metrics: exportMetrics, dimensions }, client: supabase });
      snapshotId = reportSnapshot.id;
    } catch (snapshotError) {
      if (!isGovernanceSchemaUnavailable(snapshotError)) throw snapshotError;
    }
    await recordPlatformEvent({ actorUserId: ctx.appUserId, eventType: "lcdbo.report.pdf_generated", entityType: "lcdbo_report", entityId: snapshotId, scopeType: "programme", scopeId: programme.id, metadata: { report_type: type, state, cluster, partner, report_snapshot_id: snapshotId, snapshot_persisted: Boolean(snapshotId), byte_length: pdf.length, programme_estimate: true }, client: supabase });
    return new NextResponse(pdf as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="lcdbo-${type}-report-${new Date().toISOString().slice(0, 10)}.pdf"`, "Content-Length": String(pdf.length), "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[lcdbo-report-pdf]", error);
    return NextResponse.json({ error: "Unable to generate LCDBO PDF report." }, { status: 500 });
  }
}
