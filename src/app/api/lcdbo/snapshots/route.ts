import { NextResponse } from "next/server";
import { calculateDataQuality, calculateProgrammeHealth, generateKpiSnapshot, generateReportSnapshot, type SnapshotFrequency } from "@/lib/data/lcdbo-governance";
import { getLcdboProgramme } from "@/lib/data/lcdbo-enrolment";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { recordPlatformEvent } from "@/lib/data/platform-foundation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { buildLcdboSnapshotPlans } from "@/lib/reports/lcdbo-reporting";

const FREQUENCIES = new Set<SnapshotFrequency>(["daily", "weekly", "monthly", "quarterly"]);
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secrets = [process.env.LCDBO_SNAPSHOT_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
  if (!secrets.length) return NextResponse.json({ error: "Snapshot scheduling is not configured." }, { status: 503 });
  if (!secrets.some((secret) => request.headers.get("authorization") === `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requested = new URL(request.url).searchParams.get("frequency") ?? "daily";
  if (!FREQUENCIES.has(requested as SnapshotFrequency)) return NextResponse.json({ error: "Invalid snapshot frequency." }, { status: 400 });

  try {
    const frequency = requested as SnapshotFrequency;
    const supabase = await createServiceRoleSupabaseClient();
    const programme = await getLcdboProgramme(supabase);
    if (!programme) return NextResponse.json({ error: "LCDBO programme is not configured." }, { status: 404 });
    const intelligence = await getLcdboIntelligenceSnapshot(supabase);
    const quality = calculateDataQuality(intelligence);
    const health = calculateProgrammeHealth(intelligence);
    const plans = buildLcdboSnapshotPlans(intelligence);
    const [kpis, reports] = await Promise.all([
      generateKpiSnapshot({ programmeId: programme.id, frequency, generatedBy: null, notes: "Scheduled governed snapshot.", client: supabase }),
      Promise.all([
        ...plans.map((plan) => generateReportSnapshot({ programmeId: programme.id, reportType: plan.reportType, frequency, generatedBy: null, notes: "Scheduled governed snapshot.", metrics: plan.metrics, dimensions: plan.dimensions, client: supabase })),
        generateReportSnapshot({ programmeId: programme.id, reportType: "data_quality", frequency, generatedBy: null, metrics: quality, dimensions: { scope_type: "programme", programme_id: programme.id }, client: supabase }),
        generateReportSnapshot({ programmeId: programme.id, reportType: "programme_health", frequency, generatedBy: null, metrics: health, dimensions: { scope_type: "programme", programme_id: programme.id }, client: supabase }),
      ]),
    ]);
    const national = reports.find((report) => report.report_type === "national") ?? reports[0];
    await recordPlatformEvent({ eventType: "lcdbo.snapshot.scheduled", entityType: "lcdbo_report_snapshot", entityId: national?.id ?? null, scopeType: "programme", scopeId: programme.id, metadata: { frequency, kpi_count: kpis.length, report_types: reports.map((report) => report.report_type), report_count: reports.length, data_quality_score: quality.score, programme_health_score: health.score }, client: supabase });
    return NextResponse.json({ ok: true, frequency, snapshotDate: national?.snapshot_date ?? new Date().toISOString().slice(0, 10), kpiCount: kpis.length, reportTypes: reports.map((report) => report.report_type), reportCount: reports.length, qualityScore: quality.score, healthScore: health.score });
  } catch (error) {
    console.error("[lcdbo-scheduled-snapshot]", error);
    return NextResponse.json({ error: "Unable to generate scheduled LCDBO snapshots." }, { status: 500 });
  }
}
