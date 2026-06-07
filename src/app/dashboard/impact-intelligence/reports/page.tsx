import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import type { UserContext } from "@/lib/auth/authorization";
import {
  createInstitutionalReport,
  getReportFormOptions,
  listInstitutionalReports,
  logImpactReportDiagnostic,
  type InstitutionalReport,
  type ReportFormOptions,
} from "@/lib/data/impact-reports";
import { EmptyState, ImpactPageHeader, QuickLink, SectionCard, StatusBadge, TableShell, tableCellClassName, tableClassName, tableHeadClassName, tableRowClassName } from "../_components";
import { CreateReportForm } from "./create-report-form";

type SearchParams = { error?: string; success?: string };

const EMPTY_OPTIONS: ReportFormOptions = { programmes: [], cohorts: [], members: [], interventions: [] };
const EXPECTED_CREATE_ERRORS = ["required", "Select", "does not", "does not match", "permission", "unavailable"];

function expectedCreateError(error: unknown) {
  return error instanceof Error && EXPECTED_CREATE_ERRORS.some((message) => error.message.includes(message));
}
async function createReportAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    const reportId = await createInstitutionalReport(ctx, formData);
    redirect(`/dashboard/impact-intelligence/reports/${reportId}?success=Draft%20report%20created`);
  } catch (error) {
    unstable_rethrow(error);
    if (!expectedCreateError(error)) throw error;
    redirect(`/dashboard/impact-intelligence/reports?error=${encodeURIComponent(error instanceof Error ? error.message : "Report draft could not be created.")}`);
  }
}

function scopeLabel(report: InstitutionalReport) {
  const parts = [
    report.impact_programmes?.name ?? "Programme unavailable",
    report.impact_beneficiary_cohorts?.name,
    report.msmes?.business_name,
    report.impact_interventions?.title,
  ].filter(Boolean);
  return parts.join(" / ");
}

function isLegacy(report: InstitutionalReport) {
  return report.metadata?.legacy_unverified === true || report.metadata?.report_phase !== "phase1a";
}

export default async function ReportsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const query = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let reports: InstitutionalReport[] = [];
  let options = EMPTY_OPTIONS;
  let listError: string | null = null;
  let optionsError: string | null = null;

  try {
    ctx = await getCurrentUserContext();
    try {
      reports = await listInstitutionalReports(ctx, 100);
    } catch (error) {
      unstable_rethrow(error);
      listError = error instanceof Error ? error.message : "Institutional reports are temporarily unavailable.";
      logImpactReportDiagnostic({ operation: "report_list_load_failed", role: ctx.role, authUserId: ctx.authUserId, appUserId: ctx.appUserId, errorMessage: listError, success: false });
    }
    if (canRole(ctx.role, "report", "create")) {
      try {
        options = await getReportFormOptions(ctx);
      } catch (error) {
        unstable_rethrow(error);
        optionsError = error instanceof Error ? error.message : "Report scope options are temporarily unavailable.";
        logImpactReportDiagnostic({ operation: "report_options_load_failed", role: ctx.role, authUserId: ctx.authUserId, appUserId: ctx.appUserId, errorMessage: optionsError, success: false });
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    listError = "Your report workspace could not be loaded. Verify the current session and assigned role.";
    logImpactReportDiagnostic({ operation: "reports_page_context_failed", errorMessage: error instanceof Error ? error.message : "unknown_error", success: false });
  }

  const canCreate = Boolean(ctx && canRole(ctx.role, "report", "create") && !optionsError);
  const scopeEmptyMessage = ctx ? getProgrammeScopeEmptyMessage(ctx) : null;

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Institutional programme reporting"
        title="Impact Reports"
        description="Generate scope-correct, versioned reports from approved assessments, reviewed monitoring visits, verified evidence, and verified indicator measurements."
        badge={`${reports.length} reports`}
        actions={ctx && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/executive")
          ? [{ href: "/dashboard/impact-intelligence/executive", label: "Executive dashboard", icon: FileText }]
          : []}
      />

      {query.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
      {query.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.success}</div>}

      {optionsError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Report creation is temporarily unavailable because scope options could not load. Existing reports remain accessible.
        </div>
      )}
      {canCreate && <CreateReportForm options={options} action={createReportAction} />}

      <SectionCard title="Report Library" action={<QuickLink href="/dashboard/impact-intelligence/evidence">Evidence repository</QuickLink>}>
        {listError ? (
          <EmptyState title="Reports unavailable" description="Report records could not be loaded. The page remains available while the report source or session is restored." icon={FileText} />
        ) : reports.length === 0 ? (
          <EmptyState title="No reports yet" description={scopeEmptyMessage ?? "Create a programme-scoped draft, generate its first immutable source version, then submit it for institutional review."} icon={FileText} />
        ) : (
          <TableShell>
            <table className={tableClassName}>
              <thead className={tableHeadClassName}>
                <tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Latest version</th><th className="px-4 py-3">Official</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      <Link href={`/dashboard/impact-intelligence/reports/${report.id}`} className="font-medium text-slate-950 hover:text-emerald-700">{report.title}</Link>
                      <p className="mt-1 text-xs capitalize text-slate-500">{report.report_type.replaceAll("_", " ")}</p>
                      {isLegacy(report) && <p className="mt-2 text-xs font-medium text-amber-700">Legacy unverified: scope and source references may be unreliable.</p>}
                    </td>
                    <td className={`${tableCellClassName} max-w-xs text-slate-600`}>{scopeLabel(report)}</td>
                    <td className={tableCellClassName}><StatusBadge value={report.status} /></td>
                    <td className={`${tableCellClassName} text-slate-600`}>{report.latest_version ? `v${report.latest_version.version_number}` : "Not generated"}</td>
                    <td className={tableCellClassName}>{report.status === "approved" && !isLegacy(report) ? <StatusBadge value="official" /> : <span className="text-xs text-slate-500">No</span>}</td>
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
