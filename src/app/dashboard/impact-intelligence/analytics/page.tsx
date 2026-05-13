import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getAssessmentAnalytics, getMonitoringAnalytics, getProgrammeAnalytics, type DistributionBucket } from "@/lib/data/impact-intelligence";
import { ImpactPageHeader, MetricTile } from "../_components";

const REPORTING_ROLES = ["admin", "boi_executive", "programme_officer", "assessment_officer", "auditor"];

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
  const ctx = await getCurrentUserContext();
  assertReportingRole(ctx.role);
  const [programme, monitoring, assessment] = await Promise.all([
    getProgrammeAnalytics(ctx),
    getMonitoringAnalytics(ctx),
    getAssessmentAnalytics(ctx),
  ]);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Operational analytics"
        title="Impact Analytics"
        description="Programme, monitoring, assessment, and readiness analytics derived from DBIN operational records."
        badge="Operational data"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile label="Programmes" value={programme.programmes.length} detail="Tracked programme records" tone="emerald" />
        <MetricTile label="Monitoring visits" value={monitoring.visits.length} detail="Field monitoring records" tone="amber" />
        <MetricTile label="Monitoring completion" value={`${monitoring.completionRate}%`} detail="Completed or reviewed visits" tone="blue" />
        <MetricTile label="Completed assessments" value={assessment.completed} detail="Submitted through review" tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DistributionPanel title="Programme Status" data={programme.statusDistribution} />
        <DistributionPanel title="Interventions by Programme" data={programme.interventionByProgramme.filter((item) => item.value > 0).slice(0, 10)} />
        <DistributionPanel title="Monitoring Status" data={monitoring.statusDistribution} />
        <DistributionPanel title="Assessment Status" data={assessment.statusDistribution} />
        <DistributionPanel title="Readiness Scoring" data={assessment.readinessDistribution} />
      </div>
    </section>
  );
}
