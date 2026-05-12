import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  createImpactReport,
  listImpactReports,
  listImpactInterventions,
  listImpactProgrammes,
  listMsmePickerOptions,
  REPORT_TYPES,
} from "@/lib/data/impact-intelligence";

const REPORTING_ROLES = ["admin", "boi_executive", "programme_officer", "assessment_officer", "auditor"];
const REPORT_WRITE_ROLES = ["admin", "boi_executive", "programme_officer", "assessment_officer"];

function assertReportingRole(role: string) {
  if (!REPORTING_ROLES.includes(role)) redirect("/access-denied");
}

async function createReportAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  const reportId = await createImpactReport(ctx, formData);
  redirect(`/dashboard/impact-intelligence/reports/${reportId}`);
}

function statusClass(status: string | null) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "generated") return "bg-blue-100 text-blue-700";
  if (status === "archived") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not generated";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ReportsPage() {
  const ctx = await getCurrentUserContext();
  assertReportingRole(ctx.role);
  const [reports, programmes, interventions, msmes] = await Promise.all([
    listImpactReports({ limit: 100 }),
    listImpactProgrammes({ limit: 100 }),
    listImpactInterventions({ limit: 100 }),
    listMsmePickerOptions({ limit: 150 }),
  ]);
  const canWrite = REPORT_WRITE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Reporting engine</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Impact Reports</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Generate deterministic, evidence-linked report records from DBIN programme, intervention, assessment, monitoring, and evidence data.</p>
          </div>
          <Link href="/dashboard/impact-intelligence/executive" className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <FileText className="h-4 w-4" /> Executive dashboard
          </Link>
        </div>
      </header>

      {canWrite && (
        <form action={createReportAction} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-3">
          <h2 className="font-semibold text-slate-950 lg:col-span-3">Generate report record</h2>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Title
            <input required name="title" className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="BOI MSME Impact Intelligence Summary" />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Report type
            <select name="report_type" defaultValue="executive_summary" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              {REPORT_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Programme
            <select name="programme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">All programmes</option>
              {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Intervention
            <select name="intervention_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">All interventions</option>
              {interventions.map((intervention) => <option key={intervention.id} value={intervention.id}>{intervention.title}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            MSME
            <select name="msme_id" className="w-full rounded-md border px-3 py-2 text-sm font-normal">
              <option value="">All MSMEs</option>
              {msmes.map((msme) => <option key={msme.id} value={msme.id}>{msme.business_name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
            Summary
            <textarea name="summary" rows={3} className="w-full rounded-md border px-3 py-2 text-sm font-normal" placeholder="Optional deterministic summary note." />
          </label>
          <div className="flex justify-end lg:col-span-3">
            <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Generate report</Button>
          </div>
        </form>
      )}

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        {reports.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center">
            <h2 className="font-semibold text-slate-950">No reports yet</h2>
            <p className="mt-2 text-sm text-slate-600">Generate the first impact report record when programme data is ready for review.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Generated</th></tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((report) => (
                  <tr key={report.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/impact-intelligence/reports/${report.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{report.title}</Link>
                      <p className="mt-1 text-xs text-slate-500">{report.summary ?? "No summary"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{report.report_type?.replaceAll("_", " ") ?? "report"}</td>
                    <td className="px-4 py-3 text-slate-600">{report.impact_programmes?.name ?? "All programmes"}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(report.status)}`}>{report.status ?? "draft"}</span></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(report.generated_at ?? report.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
