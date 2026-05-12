import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { exportReportRecord, getImpactReport } from "@/lib/data/impact-intelligence";

const REPORTING_ROLES = ["admin", "boi_executive", "programme_officer", "assessment_officer", "auditor"];

function assertReportingRole(role: string) {
  if (!REPORTING_ROLES.includes(role)) redirect("/access-denied");
}

async function exportReportAction(reportId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  await exportReportRecord(ctx, reportId, formData);
  redirect(`/dashboard/impact-intelligence/reports/${reportId}`);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function metricValue(reportJson: Record<string, unknown> | null | undefined, key: string) {
  const value = reportJson?.[key];
  if (typeof value === "number") return value.toLocaleString("en-NG");
  return "0";
}

export default async function ReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const ctx = await getCurrentUserContext();
  assertReportingRole(ctx.role);
  const { report, versions, exports } = await getImpactReport(ctx, reportId);
  if (!report) notFound();

  const exportReport = exportReportAction.bind(null, report.id);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{report.report_type?.replaceAll("_", " ") ?? "impact report"}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{report.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{report.summary ?? "No report summary has been recorded."}</p>
          </div>
          <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{report.status ?? "draft"}</span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">MSMEs</p><p className="mt-1 text-2xl font-semibold text-slate-950">{metricValue(report.report_json, "totalMsmes")}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Programmes</p><p className="mt-1 text-2xl font-semibold text-slate-950">{metricValue(report.report_json, "activeProgrammes")}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Interventions</p><p className="mt-1 text-2xl font-semibold text-slate-950">{metricValue(report.report_json, "interventionCounts")}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Evidence verified</p><p className="mt-1 text-2xl font-semibold text-slate-950">{metricValue(report.report_json, "verifiedEvidence")}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Report metadata</h2>
          <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Programme</dt><dd className="mt-1 font-medium text-slate-950">{report.impact_programmes?.name ?? "All programmes"}</dd></div>
            <div><dt className="text-xs text-slate-500">Intervention</dt><dd className="mt-1 font-medium text-slate-950">{report.impact_interventions?.title ?? "All interventions"}</dd></div>
            <div><dt className="text-xs text-slate-500">MSME</dt><dd className="mt-1 font-medium text-slate-950">{report.msmes?.business_name ?? "All MSMEs"}</dd></div>
            <div><dt className="text-xs text-slate-500">Generated</dt><dd className="mt-1 font-medium text-slate-950">{formatDateTime(report.generated_at ?? report.created_at)}</dd></div>
          </dl>
          <div className="mt-5 rounded-lg border border-dashed bg-slate-50 p-4">
            <h3 className="font-medium text-slate-950">Deterministic report payload</h3>
            <p className="mt-1 text-sm text-slate-600">This report stores a structured JSON snapshot of the dashboard metrics at generation time. AI narrative generation is intentionally not enabled.</p>
          </div>
        </article>

        <aside className="space-y-4">
          <form action={exportReport} className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Export tracking</h2>
            <select name="export_format" defaultValue="pdf" className="mt-3 w-full rounded-md border px-3 py-2 text-sm">
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
              <option value="json">JSON</option>
            </select>
            <input name="export_url" className="mt-3 w-full rounded-md border px-3 py-2 text-sm" placeholder="Optional generated file URL" />
            <Button type="submit" className="mt-3 w-full">Record export</Button>
          </form>

          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Exports</h2>
            {exports.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">No exports recorded yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {exports.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium uppercase text-slate-950">{item.export_format}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.export_status} • {formatDateTime(item.completed_at ?? item.requested_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </aside>
      </div>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Report versions</h2>
        {versions.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No versions have been recorded.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {versions.map((version) => (
              <div key={version.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-950">Version {version.version_number}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(version.created_at)}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{version.summary ?? "No summary"}</p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
