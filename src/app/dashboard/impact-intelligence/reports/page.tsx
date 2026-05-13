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
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";

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

function formatDate(value: string | null | undefined) {
  if (!value) return "Not generated";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ReportsPage() {
  const ctx = await getCurrentUserContext();
  assertReportingRole(ctx.role);
  const [reports, programmes, interventions, msmes] = await Promise.all([
    listImpactReports(ctx, { limit: 100 }),
    listImpactProgrammes(ctx, { limit: 100 }),
    listImpactInterventions(ctx, { limit: 100 }),
    listMsmePickerOptions({ limit: 150 }),
  ]);
  const canWrite = REPORT_WRITE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Reporting engine"
        title="Impact Reports"
        description="Generate deterministic, evidence-linked report records from DBIN programme, intervention, assessment, monitoring, and evidence data."
        badge={`${reports.length} records`}
        actions={[{ href: "/dashboard/impact-intelligence/executive", label: "Executive dashboard", icon: FileText }]}
      />

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

      <SectionCard title="Report Library" action={<QuickLink href="/dashboard/impact-intelligence/evidence">Evidence repository</QuickLink>}>
        {reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            description="Generate the first impact report record when programme, intervention, assessment, monitoring, and evidence data is ready for review."
            icon={FileText}
          />
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}>
                <tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Generated</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link href={`/dashboard/impact-intelligence/reports/${report.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{report.title}</Link>
                      <p className="mt-1 text-xs text-slate-500">{report.summary ?? "No summary"}</p>
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>{report.report_type?.replaceAll("_", " ") ?? "report"}</td>
                    <td className={`${tableCellClassName} text-slate-600`}>{report.impact_programmes?.name ?? "All programmes"}</td>
                    <td className={tableCellClassName}><StatusBadge value={report.status ?? "draft"} /></td>
                    <td className={`${tableCellClassName} text-slate-600`}>{formatDate(report.generated_at ?? report.created_at)}</td>
                    <td className={tableCellClassName}><QuickLink href={`/dashboard/impact-intelligence/reports/${report.id}`}>Open</QuickLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </SectionCard>
    </section>
  );
}
