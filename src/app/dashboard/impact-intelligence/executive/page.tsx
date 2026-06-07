import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { ClipboardCheck, FileText, MapPinned, ShieldCheck } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getExecutiveDashboardMetrics, type DistributionBucket } from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, MetricTile, SectionCard, StatusBadge } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const REPORTING_ROLES = ["admin", "super_admin", "boi_executive", "assessment_officer", "data_analyst", "auditor"];

function assertReportingRole(role: string) {
  if (!REPORTING_ROLES.includes(role)) redirect("/access-denied");
}

function DistributionChart({ title, data }: { title: string; data: DistributionBucket[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      {data.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No data available yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.slice(0, 6).map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="font-medium text-slate-950">{item.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function ExecutiveDashboardPage() {
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let metrics: Awaited<ReturnType<typeof getExecutiveDashboardMetrics>> | null = null;
  try {
    ctx = await getCurrentUserContext();
    assertReportingRole(ctx.role);
    metrics = await getExecutiveDashboardMetrics(ctx);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/executive", operation: "executive_dashboard_load_failed", error });
  }

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Internal programme monitoring"
        title="Programme Monitoring Dashboard"
        description="Internal summary of programme-linked interventions, assessments, monitoring visits, and evidence metadata. This is not a DBIN-wide executive impact report."
        badge="Internal only"
        actions={[{ href: "/dashboard/impact-intelligence/reports", label: "Reports", icon: FileText, variant: "primary" }]}
      />

      {!metrics ? (
        <SectionCard title="Executive Dashboard Unavailable">
          <EmptyState title="Programme monitoring metrics could not load" description="The dashboard source, current session, or role assignment is temporarily unavailable. No metrics are being inferred." />
        </SectionCard>
      ) : (
      <>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricTile label="DBIN MSMEs" value={metrics.totalMsmes} detail="Registry context only; not programme beneficiaries" tone="slate" />
        <MetricTile label="Active programmes" value={metrics.activeProgrammes} detail="Currently active" tone="emerald" />
        <MetricTile label="Interventions" value={metrics.interventionCounts} detail="Tracked support records" tone="blue" />
        <MetricTile label="Assessments" value={metrics.completedAssessments} detail="Completed/reviewed" tone="slate" />
        <MetricTile label="Visit completion" value={`${metrics.monitoringCompletionRate}%`} detail="Completed or reviewed visits / all visit records" tone="amber" />
        <MetricTile label="Evidence metadata" value={metrics.verifiedEvidence} detail="Records marked verified; files may still be placeholders" tone="emerald" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DistributionChart title="Intervention Status" data={metrics.interventionStatusDistribution} />
        <DistributionChart title="Readiness Distribution" data={metrics.readinessDistribution} />
        <DistributionChart title="Monitoring Status" data={metrics.monitoringStatusDistribution} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DistributionChart title="Intervention-linked MSME State (raw values)" data={metrics.stateDistribution} />
        <DistributionChart title="Intervention-linked MSME Sector (raw values)" data={metrics.sectorDistribution} />
      </div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Data quality warning: state and sector charts are limited to intervention-linked MSMEs and use raw, unstandardized values. They are not official regional coverage metrics.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent Activity">
          {metrics.recentActivity.length === 0 ? (
            <EmptyState title="No operational activity yet" description="Activity will appear as programmes, interventions, assessments, monitoring visits, and reports are created." />
          ) : (
            <div className="mt-4 space-y-3">
              {metrics.recentActivity.map((item) => (
                <Link key={`${item.label}-${item.href}`} href={item.href} className="block rounded-lg border border-slate-200 p-3 hover:border-emerald-200 hover:bg-emerald-50/40">
                  <p className="font-medium text-slate-950">{item.detail}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.label}</p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Operational Alerts">
          {metrics.operationalAlerts.length === 0 ? (
            <EmptyState title="No alerts generated" description="Current operational data has not produced any dashboard alerts." />
          ) : (
            <div className="mt-4 space-y-3">
              {metrics.operationalAlerts.map((alert) => (
                <div key={alert.title} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-medium text-slate-950">{alert.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{alert.detail}</p>
                  <StatusBadge value={alert.severity} className="mt-2" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/dashboard/impact-intelligence/analytics" className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><ClipboardCheck className="mb-2 h-5 w-5 text-emerald-700" /> Open analytics</Link>
        <Link href="/dashboard/impact-intelligence/monitoring" className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><MapPinned className="mb-2 h-5 w-5 text-emerald-700" /> Monitoring queue</Link>
        <Link href="/dashboard/impact-intelligence/evidence" className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><ShieldCheck className="mb-2 h-5 w-5 text-emerald-700" /> Evidence verification</Link>
      </div>
      </>
      )}
    </section>
  );
}
