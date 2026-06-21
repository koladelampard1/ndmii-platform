import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { canUseWorkspaceModule } from "@/lib/auth/scoped-permissions";
import { LCDBO_INTELLIGENCE_ROLES } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { recordPlatformEvent } from "@/lib/data/platform-foundation";
import { LCDBO_MODULE_KEY } from "@/lib/lcdbo/content";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

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
  const supabase = await createServiceRoleSupabaseClient();
  const snapshot = await getLcdboIntelligenceSnapshot(supabase);
  const url = new URL(request.url);
  const rows = reportRows(type, snapshot, { state: url.searchParams.get("state"), cluster: url.searchParams.get("cluster"), partner: url.searchParams.get("partner") });
  await recordPlatformEvent({ actorUserId: ctx.appUserId, eventType: "lcdbo.report.generated", entityType: "lcdbo_report", scopeType: "programme", scopeId: programme.id, metadata: { report_type: type, row_count: Math.max(0, rows.length - 1), programme_estimate: true }, client: supabase });
  return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lcdbo-${type}-report-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}

function reportRows(type: string, snapshot: Awaited<ReturnType<typeof getLcdboIntelligenceSnapshot>>, filters: { state: string | null; cluster: string | null; partner: string | null }): unknown[][] {
  if (type === "readiness") return [["MSME ID", "Business", "Sector", "State", "Readiness level", "Score", "Assessed at"], ...snapshot.assessments.map((assessment) => { const enrolment = snapshot.enrolments.find((item) => item.msme?.id === assessment.msme_id); return [enrolment?.msme?.msme_id, enrolment?.msme?.business_name, enrolment?.msme?.sector, enrolment?.msme?.state, assessment.readiness_level, assessment.overall_score, assessment.created_at]; })];
  if (type === "participation") return [["MSME ID", "Business", "State", "Cluster", "Status", "Joined at"], ...snapshot.interests.map((item) => [item.msme?.msme_id, item.msme?.business_name, item.msme?.state, item.cluster?.name, item.status, item.joined_at])];
  if (type === "cluster") { const items = filters.cluster ? snapshot.interests.filter((item) => item.cluster_id === filters.cluster) : snapshot.interests; return [["Cluster", "MSME", "Sector", "State", "Participation status"], ...items.map((item) => [item.cluster?.name, item.msme?.business_name, item.msme?.sector, item.msme?.state, item.status])]; }
  if (type === "state") { const items = filters.state ? snapshot.enrolments.filter((item) => item.msme?.state === filters.state) : snapshot.enrolments; return [["State", "MSME ID", "Business", "Sector", "LGA", "Enrolment status"], ...items.map((item) => [item.msme?.state, item.msme?.msme_id, item.msme?.business_name, item.msme?.sector, item.msme?.lga, item.status])]; }
  if (type === "partner") { const partners = filters.partner ? snapshot.partners.filter((item) => item.id === filters.partner) : snapshot.partners; return [["Partner", "Institution type", "Programme role", "Status"], ...partners.map((item) => [item.name, item.institution_type, item.partnerRole, item.status])]; }
  return [["Metric", "Value", "Classification"], ["Total MSMEs", snapshot.metrics.totalMsmes, "Current programme record"], ["Total clusters", snapshot.metrics.totalClusters, "Current programme record"], ["Active participants", snapshot.metrics.activeParticipants, "Current programme record"], ["Jobs supported", snapshot.estimates.jobsSupported, "Programme Estimate"], ["Cluster capacity", snapshot.estimates.clusterCapacity, "Programme Estimate"], ["Investment pipeline", snapshot.estimates.investmentPipeline, "Programme Estimate"]];
}

function csvValue(value: unknown) { const raw = String(value ?? ""); const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"`; }
function toCsv(rows: unknown[][]) { return rows.map((row) => row.map(csvValue).join(",")).join("\r\n"); }
