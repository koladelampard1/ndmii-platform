import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BarChart3, ClipboardCheck, FileText, MapPinned, ShieldCheck } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getExecutiveDashboardMetrics, type DistributionBucket } from "@/lib/data/impact-intelligence";

const REPORTING_ROLES = ["admin", "boi_executive", "programme_officer", "assessment_officer", "auditor"];

function assertReportingRole(role: string) {
  if (!REPORTING_ROLES.includes(role)) redirect("/access-denied");
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function DistributionChart({ title, data }: { title: string; data: DistributionBucket[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      {data.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No data available yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.slice(0, 6).map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-700">{item.label}</span>
                <span className="font-medium text-slate-950">{item.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function ExecutiveDashboardPage() {
  const ctx = await getCurrentUserContext();
  assertReportingRole(ctx.role);
  const metrics = await getExecutiveDashboardMetrics(ctx);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Executive visibility</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Impact Intelligence Executive Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Operational summary for MSME intervention performance, readiness, monitoring, and evidence verification.</p>
          </div>
          <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
            <FileText className="h-4 w-4" /> Reports
          </Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="MSMEs" value={metrics.totalMsmes} detail="Total registry footprint" />
        <MetricCard label="Active programmes" value={metrics.activeProgrammes} detail="Currently active" />
        <MetricCard label="Interventions" value={metrics.interventionCounts} detail="Tracked support records" />
        <MetricCard label="Assessments" value={metrics.completedAssessments} detail="Completed/reviewed" />
        <MetricCard label="Monitoring" value={`${metrics.monitoringCompletionRate}%`} detail="Completion rate" />
        <MetricCard label="Evidence" value={metrics.verifiedEvidence} detail="Verified records" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DistributionChart title="Intervention Status" data={metrics.interventionStatusDistribution} />
        <DistributionChart title="Readiness Distribution" data={metrics.readinessDistribution} />
        <DistributionChart title="Monitoring Status" data={metrics.monitoringStatusDistribution} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DistributionChart title="State Distribution" data={metrics.stateDistribution} />
        <DistributionChart title="Sector Distribution" data={metrics.sectorDistribution} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold text-slate-950">Recent Activity</h2></div>
          {metrics.recentActivity.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No operational activity yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {metrics.recentActivity.map((item) => (
                <Link key={`${item.label}-${item.href}`} href={item.href} className="block rounded-lg border p-3 hover:border-emerald-200 hover:bg-emerald-50/40">
                  <p className="font-medium text-slate-950">{item.detail}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.label}</p>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><h2 className="font-semibold text-slate-950">Operational Alerts</h2></div>
          {metrics.operationalAlerts.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No alerts generated from current operational data.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {metrics.operationalAlerts.map((alert) => (
                <div key={alert.title} className="rounded-lg border p-3">
                  <p className="font-medium text-slate-950">{alert.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{alert.detail}</p>
                  <p className="mt-2 text-xs uppercase text-slate-500">{alert.severity}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/dashboard/impact-intelligence/analytics" className="rounded-lg border bg-white p-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><ClipboardCheck className="mb-2 h-5 w-5 text-emerald-700" /> Open analytics</Link>
        <Link href="/dashboard/impact-intelligence/monitoring" className="rounded-lg border bg-white p-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><MapPinned className="mb-2 h-5 w-5 text-emerald-700" /> Monitoring queue</Link>
        <Link href="/dashboard/impact-intelligence/evidence" className="rounded-lg border bg-white p-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><ShieldCheck className="mb-2 h-5 w-5 text-emerald-700" /> Evidence verification</Link>
      </div>
    </section>
  );
}
