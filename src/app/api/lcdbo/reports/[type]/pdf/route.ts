import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { LCDBO_INTELLIGENCE_ROLES } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { generateReportSnapshot, isGovernanceSchemaUnavailable } from "@/lib/data/lcdbo-governance";
import { getLcdboSprint3Snapshot, buildSprint3PdfInput, type Sprint3ReportFamily } from "@/lib/data/lcdbo-delivery-intelligence";
import { recordPlatformEvent, recordTrustedLcdboDeliveryEvent } from "@/lib/data/platform-foundation";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createLcdboProgrammePdf } from "@/lib/reports/lcdbo-programme-pdf";
import { buildGovernedMetricsPayload, buildLcdboPdfInput, scopeLcdboSnapshot } from "@/lib/reports/lcdbo-reporting";

const TYPES = new Set(["national", "state", "cluster", "partner", "readiness", "participation"]);
const DELIVERY_TYPES = new Set<Sprint3ReportFamily>(["programme-delivery", "workstream-performance", "milestone-deliverable", "risk-issue", "state-delivery", "lga-delivery", "cluster-delivery", "executive-exceptions", "pilot-readiness", "evidence-verification"]);
const SNAPSHOT_TYPE: Record<Sprint3ReportFamily, string> = {
  "programme-delivery": "programme_delivery",
  "workstream-performance": "workstream_performance",
  "milestone-deliverable": "milestone_deliverable",
  "risk-issue": "risk_issue",
  "state-delivery": "state_delivery",
  "lga-delivery": "lga_delivery",
  "cluster-delivery": "cluster_delivery",
  "executive-exceptions": "executive_exceptions",
  "pilot-readiness": "pilot_readiness",
  "evidence-verification": "evidence_verification",
};
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!TYPES.has(type) && !DELIVERY_TYPES.has(type as Sprint3ReportFamily)) return NextResponse.json({ error: "Unknown report type." }, { status: 404 });
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!ctx.appUserId || !programme || ctx.role === "msme") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: LCDBO_INTELLIGENCE_ROLES, scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id }).catch(() => ({ allowed: false }));
  if (!isPlatformAdmin(ctx.role) && !access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const supabase = await createServiceRoleSupabaseClient();
    if (DELIVERY_TYPES.has(type as Sprint3ReportFamily)) {
      await requireLcdboDeliveryAccess("export", supabase);
      const reportFamily = type as Sprint3ReportFamily;
      const includeTestData = new URL(request.url).searchParams.get("include_test") === "true";
      const snapshot = await getLcdboSprint3Snapshot({ client: supabase, includeTestData });
      const pdf = createLcdboProgrammePdf(buildSprint3PdfInput(snapshot, reportFamily));
      let snapshotId: string | null = null;
      try {
        const reportSnapshot = await generateReportSnapshot({
          programmeId: programme.id,
          reportType: SNAPSHOT_TYPE[reportFamily],
          frequency: "daily",
          generatedBy: ctx.appUserId,
          notes: "Snapshot captured from successful Sprint 3 delivery PDF export.",
          metrics: { sprint3: snapshot },
          dimensions: { scope_type: "programme", programme_id: programme.id, include_test_data: includeTestData, report_family: reportFamily },
          exportCapture: { capturedAt: new Date().toISOString(), metrics: { reportFamily, includeTestData }, dimensions: { scope_type: "programme", programme_id: programme.id } },
          client: supabase,
        });
        snapshotId = reportSnapshot.id;
      } catch (snapshotError) {
        if (!isGovernanceSchemaUnavailable(snapshotError)) throw snapshotError;
      }
      await recordTrustedLcdboDeliveryEvent({ actorUserId: ctx.appUserId, eventType: "lcdbo.delivery.executive_report.generated", entityType: "lcdbo_delivery_sprint3_pdf", entityId: snapshotId, scopeType: "programme", scopeId: programme.id, metadata: { report_type: reportFamily, report_snapshot_id: snapshotId, snapshot_persisted: Boolean(snapshotId), include_test_data: includeTestData, byte_length: pdf.length } });
      return new NextResponse(pdf as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="lcdbo-${reportFamily}-report-${new Date().toISOString().slice(0, 10)}.pdf"`, "Content-Length": String(pdf.length), "Cache-Control": "no-store" } });
    }
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
