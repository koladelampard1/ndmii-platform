import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getAssessmentAnalytics, getMonitoringAnalytics, getProgrammeAnalytics, type DistributionBucket } from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, MetricTile, SectionCard } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const REPORTING_ROLES = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "data_analyst", "auditor"];

function assertReportingRole(role: string) {
  if (!REPORTING_ROLES.includes(role)) redirect("/access-denied");
}

function DistributionPanel({ title, data }: { title: string; data: DistributionBucket[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      {data.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No records available.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium text-slate-950">{item.label}</p>
                <p className="text-slate-600">{item.value}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{total > 0 ? Math.round((item.value / total) * 100) : 0}% of records</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function AnalyticsPage() {
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let programme: Awaited<ReturnType<typeof getProgrammeAnalytics>> | null = null;
  let monitoring: Awaited<ReturnType<typeof getMonitoringAnalytics>> | null = null;
  let assessment: Awaited<ReturnType<typeof getAssessmentAnalytics>> | null = null;
  try {
    ctx = await getCurrentUserContext();
    assertReportingRole(ctx.role);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/analytics", operation: "analytics_context_load_failed", error });
  }
  if (ctx) {
    [programme, monitoring, assessment] = await Promise.all([
      getProgrammeAnalytics(ctx).catch((error) => {
        logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/analytics", operation: "programme_analytics_load_failed", error });
        return null;
      }),
      getMonitoringAnalytics(ctx).catch((error) => {
        logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/analytics", operation: "monitoring_analytics_load_failed", error });
        return null;
      }),
      getAssessmentAnalytics(ctx).catch((error) => {
        logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/analytics", operation: "assessment_analytics_load_failed", error });
        return null;
      }),
    ]);
  }

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Internal programme monitoring"
        title="Programme Monitoring Analytics"
        description="Programme, monitoring, and assessment analytics for the internal subsystem. These charts are not DBIN-wide impact measures."
        badge="Internal only"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile label="Loaded programmes" value={programme?.programmes.length ?? "Unavailable"} detail="Internal view, capped at 1,000 rows" tone="emerald" />
        <MetricTile label="Loaded monitoring visits" value={monitoring?.visits.length ?? "Unavailable"} detail="Internal view, capped at 1,000 rows" tone="amber" />
        <MetricTile label="Loaded visit completion" value={monitoring ? `${monitoring.completionRate}%` : "Unavailable"} detail="Completed or reviewed loaded visits / all loaded visits" tone="blue" />
        <MetricTile label="Completed assessments" value={assessment?.completed ?? "Unavailable"} detail="Submitted through review" tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {programme ? <DistributionPanel title="Programme Status" data={programme.statusDistribution} /> : <SectionCard title="Programme Status"><EmptyState title="Programme analytics unavailable" description="Programme analytics could not be loaded from the current source." /></SectionCard>}
        {programme ? <DistributionPanel title="Interventions by Programme" data={programme.interventionByProgramme.filter((item) => item.value > 0).slice(0, 10)} /> : <SectionCard title="Interventions by Programme"><EmptyState title="Programme analytics unavailable" description="Intervention distribution could not be loaded." /></SectionCard>}
        {monitoring ? <DistributionPanel title="Monitoring Status" data={monitoring.statusDistribution} /> : <SectionCard title="Monitoring Status"><EmptyState title="Monitoring analytics unavailable" description="Monitoring analytics could not be loaded from the current source." /></SectionCard>}
        {assessment ? <DistributionPanel title="Assessment Status" data={assessment.statusDistribution} /> : <SectionCard title="Assessment Status"><EmptyState title="Assessment analytics unavailable" description="Assessment analytics could not be loaded from the current source." /></SectionCard>}
        {assessment ? <DistributionPanel title="Readiness Scoring" data={assessment.readinessDistribution} /> : <SectionCard title="Readiness Scoring"><EmptyState title="Readiness analytics unavailable" description="Readiness scoring could not be loaded from the current source." /></SectionCard>}
      </div>
    </section>
  );
}
