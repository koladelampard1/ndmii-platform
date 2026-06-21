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
import { createLcdboProgrammePdf } from "@/lib/reports/lcdbo-programme-pdf";
import { buildGovernedMetricsPayload, buildLcdboPdfInput, scopeLcdboSnapshot } from "@/lib/reports/lcdbo-reporting";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const TYPES = new Set(["national", "state", "cluster", "partner"]);
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!TYPES.has(type)) return NextResponse.json({ error: "Unknown briefing type." }, { status: 404 });
  const ctx = await getCurrentUserContext();
  const programme = await getLcdboProgramme();
  if (!ctx.appUserId || !programme || ctx.role === "msme") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await canUseWorkspaceModule({ ctx, moduleKey: LCDBO_MODULE_KEY, allowedRoles: LCDBO_INTELLIGENCE_ROLES, scopeType: "programme", scopeId: programme.id, programmeId: programme.id, institutionId: programme.owning_institution_id }).catch(() => ({ allowed: false }));
  if (!isPlatformAdmin(ctx.role) && !access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const supabase = await createServiceRoleSupabaseClient();
    const snapshot = await getLcdboIntelligenceSnapshot(supabase);
    const scope = new URL(request.url).searchParams.get("scope");
    const subject = resolveScope(type, scope, snapshot);
    const scoped = scopeLcdboSnapshot(snapshot, { reportType: type, state: type === "state" ? scope : null, cluster: type === "cluster" ? scope : null, partner: type === "partner" ? scope : null });
    const pdf = createLcdboProgrammePdf(buildLcdboPdfInput({
      snapshot: scoped,
      reportType: `${type}_briefing`,
      title: subject ? `${subject} LCDBO Briefing` : "LCDBO National Programme Briefing",
      subtitle: "Governed programme intelligence for executive decision support",
      executiveSummary: `${subject ?? "The national LCDBO programme"} is represented within the current governed programme dataset. This briefing consolidates participation, readiness, geographic coverage, programme health and data quality for decision-making.`,
      opportunities: [`Scale participation in ${scoped.sectors[0]?.[0] ?? "priority industrial"} value chains.`, `Advance ${scoped.assessments.filter((item) => ["ready_for_investment", "ready_for_export"].includes(item.readiness_level)).length} investment/export-ready MSMEs.`, "Use active partner mandates to close readiness and evidence gaps."],
      recommendations: ["Resolve high-severity quality issues before the next reporting cycle.", "Prioritise overdue reviews, assessments and document requests.", "Refresh governed KPI and report snapshots at the agreed frequency."],
    }));
    const dimensions = { scope_type: type === "national" ? "programme" : type, programme_id: programme.id, ...(scope ? { scope_id: scope, scope_label: subject } : {}) };
    let snapshotId: string | null = null;
    try {
      const exportMetrics = { briefing_type: type, subject, ...buildGovernedMetricsPayload(scoped) };
      const reportSnapshot = await generateReportSnapshot({ programmeId: programme.id, reportType: "executive_briefing", frequency: "daily", generatedBy: ctx.appUserId, notes: `${type} briefing snapshot captured from successful PDF export.`, metrics: exportMetrics, dimensions, exportCapture: { capturedAt: new Date().toISOString(), metrics: exportMetrics, dimensions }, client: supabase });
      snapshotId = reportSnapshot.id;
    } catch (snapshotError) {
      if (!isGovernanceSchemaUnavailable(snapshotError)) throw snapshotError;
    }
    await recordPlatformEvent({ actorUserId: ctx.appUserId, eventType: "lcdbo.briefing.pdf_generated", entityType: "lcdbo_briefing", entityId: snapshotId, scopeType: "programme", scopeId: programme.id, metadata: { briefing_type: type, briefing_scope: scope, report_snapshot_id: snapshotId, snapshot_persisted: Boolean(snapshotId), byte_length: pdf.length, programme_estimate: true }, client: supabase });
    return new NextResponse(pdf as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="lcdbo-${type}-briefing-${new Date().toISOString().slice(0, 10)}.pdf"`, "Content-Length": String(pdf.length), "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[lcdbo-briefing-pdf]", error);
    return NextResponse.json({ error: "Unable to generate LCDBO briefing." }, { status: 500 });
  }
}

function resolveScope(type: string, scope: string | null, snapshot: Awaited<ReturnType<typeof getLcdboIntelligenceSnapshot>>) {
  if (!scope) return null;
  if (type === "state") return snapshot.states.find(([state]) => state === scope)?.[0] ?? null;
  if (type === "cluster") return snapshot.clusters.find((cluster) => cluster.id === scope)?.name ?? null;
  if (type === "partner") return snapshot.partners.find((partner) => partner.id === scope)?.name ?? null;
  return null;
}
