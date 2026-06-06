import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { AlertTriangle, Download, FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserContext } from "@/lib/auth/authorization";
import {
  REPORT_ARCHIVE_ROLES,
  REPORT_CREATE_ROLES,
  REPORT_REVIEW_ROLES,
  generateInstitutionalReportExport,
  generateInstitutionalReportVersion,
  getInstitutionalReport,
  logImpactReportDiagnostic,
  transitionInstitutionalReport,
  type InstitutionalReport,
  type InstitutionalReportExport,
  type InstitutionalReportVersion,
  type ReportEvidenceReference,
  type ReportIndicatorReference,
} from "@/lib/data/impact-reports";
import { EmptyState, ImpactPageHeader, MetricTile, SectionCard, StatusBadge } from "../../_components";

type SearchParams = { error?: string; success?: string; version?: string };
type ReportDetail = {
  report: InstitutionalReport | null;
  versions: InstitutionalReportVersion[];
  evidenceReferences: ReportEvidenceReference[] | null;
  indicatorReferences: ReportIndicatorReference[] | null;
  exports: InstitutionalReportExport[] | null;
  sourceErrors?: { evidence: string | null; indicators: string | null; exports: string | null };
};

const EXPECTED_ACTION_ERRORS = ["permission", "Only", "required", "Generate", "Legacy", "status changed", "not found", "unavailable", "could not", "failed"];

function isExpectedActionError(error: unknown) {
  return error instanceof Error && EXPECTED_ACTION_ERRORS.some((message) => error.message.includes(message));
}
function actionRedirect(reportId: string, key: "error" | "success", message: string): never {
  redirect(`/dashboard/impact-intelligence/reports/${reportId}?${key}=${encodeURIComponent(message)}`);
}

async function generateVersionAction(reportId: string) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await generateInstitutionalReportVersion(ctx, reportId);
    actionRedirect(reportId, "success", "Immutable report version generated.");
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    actionRedirect(reportId, "error", error instanceof Error ? error.message : "Report version could not be generated.");
  }
}

async function lifecycleAction(reportId: string, action: "submit" | "return" | "approve" | "archive", formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await transitionInstitutionalReport(ctx, reportId, action, formData);
    const actionLabels = {
      submit: "submitted for review",
      return: "returned for correction",
      approve: "approved",
      archive: "archived",
    } as const;
    actionRedirect(reportId, "success", `Report ${actionLabels[action]}.`);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    actionRedirect(reportId, "error", error instanceof Error ? error.message : "Report workflow action could not be completed.");
  }
}

async function exportAction(reportId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    const format = formData.get("export_format") === "pdf" ? "pdf" : "json";
    await generateInstitutionalReportExport(ctx, reportId, format);
    actionRedirect(reportId, "success", `${format.toUpperCase()} export generated in private storage.`);
  } catch (error) {
    unstable_rethrow(error);
    if (!isExpectedActionError(error)) throw error;
    actionRedirect(reportId, "error", error instanceof Error ? error.message : "Report export could not be generated.");
  }
}

function isLegacy(report: InstitutionalReport) {
  return report.metadata?.legacy_unverified === true || report.metadata?.report_phase !== "phase1a";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function scopeItems(report: InstitutionalReport) {
  return [
    ["Programme", report.impact_programmes?.name ?? "Unavailable"],
    ["Cohort", report.impact_beneficiary_cohorts?.name ?? "All programme cohorts"],
    ["Beneficiary", report.cohort_member_id ? report.msmes?.business_name ?? "Unavailable" : "All matching beneficiaries"],
    ["Intervention", report.impact_interventions?.title ?? "All matching interventions"],
  ];
}

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { reportId } = await params;
  const query = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let detail: ReportDetail | null = null;
  let loadError: string | null = null;

  try {
    ctx = await getCurrentUserContext();
    detail = await getInstitutionalReport(ctx, reportId, {
      includeSources: true,
      versionId: query.version,
    }) as ReportDetail;
  } catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof Error ? error.message : "Institutional report is temporarily unavailable.";
    logImpactReportDiagnostic({ operation: "report_detail_load_failed", role: ctx?.role ?? null, authUserId: ctx?.authUserId ?? null, appUserId: ctx?.appUserId ?? null, reportId, errorMessage: loadError, success: false });
  }

  if (!loadError && !detail?.report) notFound();
  if (loadError || !detail?.report) {
    return (
      <section className="space-y-6">
        <ImpactPageHeader eyebrow="Institutional programme reporting" title="Report Unavailable" description="The report workspace remains available, but this report could not be loaded safely." />
        <EmptyState title="Report could not load" description="Verify the current session, role assignment, and report data source, then reload this page." icon={FileText} />
      </section>
    );
  }

  const report = detail.report;
  const selectedVersion = detail.versions.find((item) => item.id === query.version)
    ?? detail.versions.find((item) => item.id === report.latest_version_id)
    ?? detail.versions[0]
    ?? null;
  const payload = selectedVersion?.report_json ?? {};
  const assessments = Array.isArray(payload.assessments) ? payload.assessments as Array<Record<string, unknown>> : [];
  const visits = Array.isArray(payload.field_visits) ? payload.field_visits as Array<Record<string, unknown>> : [];
  const evidenceReferences = detail.evidenceReferences;
  const indicatorReferences = detail.indicatorReferences;
  const exports = detail.exports;
  const legacy = isLegacy(report);
  const canGenerate = Boolean(ctx && (REPORT_CREATE_ROLES as readonly string[]).includes(ctx.role) && ["draft", "returned"].includes(report.status) && !legacy);
  const canSubmit = Boolean(ctx && (REPORT_CREATE_ROLES as readonly string[]).includes(ctx.role) && ["draft", "returned"].includes(report.status) && report.latest_version_id && !legacy);
  const canReview = Boolean(ctx && (REPORT_REVIEW_ROLES as readonly string[]).includes(ctx.role) && report.status === "in_review" && !legacy);
  const canArchive = Boolean(ctx && (REPORT_ARCHIVE_ROLES as readonly string[]).includes(ctx.role) && ["draft", "returned", "approved"].includes(report.status) && !legacy);
  const canExport = Boolean(ctx && ["admin", "super_admin", "programme_officer", "assessment_officer"].includes(ctx.role) && report.status === "approved" && !legacy);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow={report.report_type.replaceAll("_", " ")}
        title={report.title}
        description={report.summary ?? "No report summary was provided."}
        badge={report.status}
        actions={[{ href: "/dashboard/impact-intelligence/reports", label: "Report library", icon: FileText }]}
      />

      {query.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
      {query.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.success}</div>}
      {legacy && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Legacy unverified report</p>
          <p className="mt-1">This record predates Phase 1A. Its scope may be unreliable, source references were not captured, and it must not be treated as an official institutional report.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile label="Version" value={selectedVersion ? `v${selectedVersion.version_number}` : "None"} detail={selectedVersion ? `Cutoff ${formatDateTime(selectedVersion.source_cutoff_at)}` : "Generate a version to freeze qualified sources."} icon={FileCheck2} />
        <MetricTile label="Approved assessments" value={Number(selectedVersion?.source_summary?.approved_assessments ?? 0)} icon={ShieldCheck} tone="emerald" />
        <MetricTile label="Verified evidence" value={Number(selectedVersion?.source_summary?.verified_evidence ?? 0)} icon={FileText} tone="blue" />
        <MetricTile label="Official indicators" value={Number(selectedVersion?.source_summary?.official_impact_claims ?? 0)} icon={ShieldCheck} tone="emerald" />
      </div>

      <SectionCard title="Report Scope">
        <dl className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
          {scopeItems(report).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-950">{value}</dd></div>)}
        </dl>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <SectionCard title="Lifecycle and Version Controls">
          <div className="flex flex-wrap gap-2">
            {canGenerate && <form action={generateVersionAction.bind(null, report.id)}><Button type="submit">Generate version</Button></form>}
            {canSubmit && <form action={lifecycleAction.bind(null, report.id, "submit")}><Button type="submit">Submit for review</Button></form>}
            {canReview && <form action={lifecycleAction.bind(null, report.id, "approve")}><Button type="submit">Approve report</Button></form>}
            {canArchive && <form action={lifecycleAction.bind(null, report.id, "archive")}><Button type="submit" variant="secondary">Archive</Button></form>}
          </div>
          {canReview && (
            <form action={lifecycleAction.bind(null, report.id, "return")} className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row">
              <input required name="return_reason" className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Correction required before approval" />
              <Button type="submit" variant="secondary">Return for correction</Button>
            </form>
          )}
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Submitted</dt><dd className="mt-1">{formatDateTime(report.submitted_at)}<span className="block text-xs text-slate-500">{report.submitted_by_user_id ?? "Actor unavailable"}</span></dd></div>
            <div><dt className="text-xs text-slate-500">Reviewed</dt><dd className="mt-1">{formatDateTime(report.reviewed_at)}<span className="block text-xs text-slate-500">{report.reviewed_by_user_id ?? "Actor unavailable"}</span></dd></div>
            <div><dt className="text-xs text-slate-500">Approved</dt><dd className="mt-1">{formatDateTime(report.approved_at)}<span className="block text-xs text-slate-500">{report.approved_by_user_id ?? "Actor unavailable"}</span></dd></div>
            <div><dt className="text-xs text-slate-500">Return reason</dt><dd className="mt-1">{report.return_reason ?? "None"}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard title="Official Exports">
          {canExport && (
            <form action={exportAction.bind(null, report.id)} className="flex gap-2">
              <select name="export_format" defaultValue="pdf" className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm">
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
              <Button type="submit" size="sm">Generate</Button>
            </form>
          )}
          {exports === null ? (
            <p className="mt-3 text-sm text-amber-800">Export history is temporarily unavailable.</p>
          ) : exports.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No real export files have been generated.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {exports.map((item) => (
                <Link key={item.id} href={`/api/impact-intelligence/reports/exports/${item.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-slate-50">
                  <span><span className="font-medium uppercase">{item.export_format}</span><span className="block text-xs text-slate-500">v{detail.versions.find((version) => version.id === item.report_version_id)?.version_number ?? "?"} · {formatDateTime(item.generated_at)}</span></span>
                  <Download className="h-4 w-4 text-emerald-700" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Completeness Warnings">
        {!selectedVersion ? (
          <p className="text-sm text-slate-600">No generated version exists.</p>
        ) : selectedVersion.completeness_warnings.length === 0 ? (
          <p className="text-sm text-emerald-700">No completeness warnings were recorded at the source cutoff.</p>
        ) : (
          <div className="space-y-2">
            {selectedVersion.completeness_warnings.map((warning) => <div key={warning} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{warning}</div>)}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Approved Assessments Used">
        {assessments.length === 0 ? <p className="text-sm text-slate-600">No approved assessments were included.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {assessments.map((item) => <div key={String(item.id)} className="rounded-lg border p-4 text-sm"><p className="font-medium text-slate-950">{String(item.title ?? "Assessment")}</p><p className="mt-1 text-slate-600">{String(item.assessment_type ?? "Type unavailable")} · score {String(item.weighted_score ?? "unavailable")} · {String(item.readiness_category ?? "unclassified")}</p></div>)}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Reviewed Monitoring Visits Used">
        {visits.length === 0 ? <p className="text-sm text-slate-600">No reviewed monitoring visits were included.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {visits.map((item) => <div key={String(item.id)} className="rounded-lg border p-4 text-sm"><p className="font-medium text-slate-950">{String(item.title ?? "Field visit")}</p><p className="mt-1 text-slate-600">{String(item.visit_date ?? "Date unavailable")} · reviewed</p></div>)}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Verified Evidence References">
        {evidenceReferences === null ? (
          <p className="text-sm text-amber-800">Evidence references are temporarily unavailable. Other report sections remain usable.</p>
        ) : evidenceReferences.length === 0 ? (
          <p className="text-sm text-slate-600">No verified evidence references were captured.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {evidenceReferences.map((item) => (
              <div key={item.id} className="rounded-lg border p-4 text-sm">
                <div className="flex items-start justify-between gap-3"><p className="font-medium text-slate-950">{item.original_filename}</p><StatusBadge value={item.verification_status} /></div>
                <p className="mt-2 text-xs text-slate-500">{item.mime_type} · {item.file_size_bytes.toLocaleString("en-NG")} bytes</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-500">SHA-256 {item.checksum_sha256}</p>
                <Link href={`/api/impact-intelligence/evidence/${item.evidence_id}?disposition=attachment`} className="mt-3 inline-block text-xs font-semibold text-emerald-700">Secure evidence download</Link>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Verified Indicator Measurements">
        {indicatorReferences === null ? (
          <p className="text-sm text-amber-800">Indicator references are temporarily unavailable. Other report sections remain usable.</p>
        ) : indicatorReferences.length === 0 ? (
          <p className="text-sm text-slate-600">No verified indicator measurements were captured. This version makes no official impact claims.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Indicator</th><th className="p-3">Baseline</th><th className="p-3">Target</th><th className="p-3">Current</th><th className="p-3">Progress</th><th className="p-3">Outcome</th><th className="p-3">Date</th></tr></thead>
              <tbody>{indicatorReferences.map((item) => <tr key={item.id} className="border-b"><td className="p-3 font-medium">{item.indicator_name}<span className="block text-xs font-normal text-slate-500">{item.unit_of_measure}</span></td><td className="p-3">{item.baseline_value ?? "N/A"}</td><td className="p-3">{item.target_value ?? "N/A"}</td><td className="p-3">{item.measured_value}</td><td className="p-3">{item.progress_percentage === null ? "N/A" : `${item.progress_percentage}%`}</td><td className="p-3"><StatusBadge value={item.outcome_status} /></td><td className="p-3">{item.measurement_date}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Immutable Version History">
        {detail.versions.length === 0 ? <p className="text-sm text-slate-600">No versions have been generated.</p> : (
          <div className="space-y-3">
            {detail.versions.map((version) => (
              <div key={version.id} className={`rounded-lg border p-4 ${version.id === selectedVersion?.id ? "border-emerald-300 bg-emerald-50/40" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Version {version.version_number}{version.id === report.latest_version_id ? " · current" : ""}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(version.generated_at)}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">Source cutoff {formatDateTime(version.source_cutoff_at)} · {version.assessment_ids.length} assessments · {version.field_visit_ids.length} visits · {version.evidence_ids.length} evidence · {version.indicator_measurement_ids.length} indicators</p>
                {version.id !== selectedVersion?.id && <Link href={`/dashboard/impact-intelligence/reports/${report.id}?version=${version.id}`} className="mt-2 inline-block text-xs font-semibold text-emerald-700">Inspect frozen sources</Link>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}
