import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileOutput,
  FileText,
  FileWarning,
  Gauge,
  History,
  Layers3,
  Link2,
  Network,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Target,
  UserRound,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { isImpactProgrammeReadDenied } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import type { UserContext } from "@/lib/auth/authorization";
import {
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
import { cn } from "@/lib/utils";
import { EmptyState } from "../../_components";

type SearchParams = { error?: string; success?: string; version?: string };
type ReportDetail = {
  report: InstitutionalReport | null;
  versions: InstitutionalReportVersion[];
  evidenceReferences: ReportEvidenceReference[] | null;
  indicatorReferences: ReportIndicatorReference[] | null;
  exports: InstitutionalReportExport[] | null;
  sourceErrors?: { evidence: string | null; indicators: string | null; exports: string | null };
};
type AssuranceState = "Healthy" | "Review Needed" | "Blocked" | "Unavailable";
type TimelineItem = {
  id: string;
  label: string;
  detail: string;
  actor: string;
  date: string;
  icon: LucideIcon;
  tone: string;
};

const ROUTE = "/dashboard/impact-intelligence/reports";
const UNAVAILABLE = "Unavailable";
const EXPECTED_ACTION_ERRORS = ["permission", "Only", "required", "Generate", "Legacy", "status changed", "not found", "unavailable", "could not", "failed"];

function isExpectedActionError(error: unknown) {
  return error instanceof Error && EXPECTED_ACTION_ERRORS.some((message) => error.message.includes(message));
}

function actionRedirect(reportId: string, key: "error" | "success", message: string): never {
  redirect(`${ROUTE}/${reportId}?${key}=${encodeURIComponent(message)}`);
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

function humanize(value: string | null | undefined) {
  return value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : UNAVAILABLE;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number") return UNAVAILABLE;
  if (value < 1024) return `${value.toLocaleString("en-NG")} bytes`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024).toLocaleString("en-NG")} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function reportingPeriod(report: InstitutionalReport) {
  const start = report.metadata?.reporting_period_start;
  const end = report.metadata?.reporting_period_end;
  if (typeof start === "string" && typeof end === "string") return `${formatDate(start)} - ${formatDate(end)}`;
  const period = report.metadata?.reporting_period;
  return typeof period === "string" && period.trim() ? period : UNAVAILABLE;
}

function actor(value: string | null | undefined) {
  return value ?? UNAVAILABLE;
}

function statusTone(value: string | null | undefined) {
  const status = value?.toLowerCase() ?? "";
  if (["healthy", "ready", "approved", "generated", "verified", "complete", "completed"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (["review needed", "in_review", "in review", "submitted", "pending", "draft"].includes(status)) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }
  if (["blocked", "returned", "rejected", "incomplete", "not ready"].includes(status)) {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function StatusPill({ value, dark = false }: { value: string | null | undefined; dark?: boolean }) {
  return (
    <span className={cn(
      "inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ring-1",
      dark ? "bg-white/10 text-blue-50 ring-white/15" : statusTone(value),
    )}>
      {humanize(value)}
    </span>
  );
}

function Section({
  title,
  description,
  action,
  children,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-[#0c1733] sm:text-base">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: string }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight text-[#0c1733]">{value}</p>
          <p className="truncate text-[10px] font-semibold text-slate-500">{label}</p>
        </div>
      </div>
    </article>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <Icon className="h-4 w-4 text-blue-600" />
      <dt className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-xs font-semibold leading-5 text-slate-800">{value}</dd>
    </div>
  );
}

function EmptyPanel({ title, description, icon: Icon = CircleDot }: { title: string; description: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <Icon className="mx-auto h-5 w-5 text-slate-400" />
      <p className="mt-2 text-xs font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function numericMetadata(report: InstitutionalReport, key: string) {
  const value = report.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  let accessDenied = false;

  try {
    ctx = await getCurrentUserContext();
    detail = await getInstitutionalReport(ctx, reportId, {
      includeSources: true,
      versionId: query.version,
    }) as ReportDetail;
  } catch (error) {
    unstable_rethrow(error);
    accessDenied = isImpactProgrammeReadDenied(error);
    loadError = error instanceof Error ? error.message : "Institutional report is temporarily unavailable.";
    logImpactReportDiagnostic({
      operation: "report_detail_load_failed",
      role: ctx?.role ?? null,
      authUserId: ctx?.authUserId ?? null,
      appUserId: ctx?.appUserId ?? null,
      reportId,
      errorMessage: loadError,
      success: false,
    });
  }

  if (!loadError && !detail?.report) notFound();
  if (loadError || !detail?.report || !ctx) {
    return (
      <section className="space-y-6">
        <Section title="Report Unavailable">
          <EmptyState
            title="Report detail could not load"
            description={accessDenied
              ? loadError ?? "You are not assigned to this programme."
              : "The report is missing or one of its required sources is temporarily unavailable."}
            icon={FileWarning}
          />
        </Section>
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
  const generatedExports = exports?.filter((item) => item.export_status === "generated") ?? null;
  const legacy = isLegacy(report);
  const warnings = selectedVersion?.completeness_warnings ?? [];
  const evidenceCount = evidenceReferences?.length ?? null;
  const indicatorCount = indicatorReferences?.length ?? null;
  const assessmentCount = selectedVersion ? selectedVersion.assessment_ids.length : null;
  const visitCount = selectedVersion ? selectedVersion.field_visit_ids.length : null;
  const uniqueInterventions = evidenceReferences
    ? new Set(evidenceReferences.map((item) => item.intervention_id).filter(Boolean)).size
    : null;
  const approvalEventCount = [report.submitted_at, report.reviewed_at, report.approved_at].filter(Boolean).length;
  const evidenceSupported = evidenceCount === null ? null : evidenceCount > 0;
  const indicatorSupported = indicatorCount === null ? null : indicatorCount > 0;
  const exportReady = !legacy && report.status === "approved" && Boolean(report.latest_version_id);
  const executiveReady = exportReady && warnings.length === 0 && evidenceSupported === true && indicatorSupported === true;
  const reportHealth: AssuranceState = legacy
    ? "Unavailable"
    : report.status === "returned" || warnings.length > 0
      ? "Blocked"
      : report.status === "in_review"
        ? "Review Needed"
        : executiveReady
          ? "Healthy"
          : "Review Needed";
  const assuranceScore = numericMetadata(report, "assurance_score");
  const canGenerate = canRole(ctx.role, "report", "update") && ["draft", "returned"].includes(report.status) && !legacy;
  const canSubmit = canRole(ctx.role, "report", "submit") && ["draft", "returned"].includes(report.status) && Boolean(report.latest_version_id) && !legacy;
  const canReview = canRole(ctx.role, "report", "approve") && report.status === "in_review" && !legacy;
  const canExport = canRole(ctx.role, "report", "export") && report.status === "approved" && !legacy;
  const canReadProgramme = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/programmes");
  const canReadEvidence = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/evidence");
  const canReadIndicators = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/indicators");
  const canReadAssessments = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/assessments");
  const canReadMonitoring = canAccessRoute(ctx.role, "/dashboard/impact-intelligence/monitoring");

  const lifecycle = [
    { label: "Draft", complete: true },
    { label: "Version Generated", complete: detail.versions.length > 0 },
    { label: "Submitted", complete: Boolean(report.submitted_at) },
    { label: "Under Review", complete: Boolean(report.reviewed_at) || ["in_review", "approved"].includes(report.status) },
    { label: "Approved", complete: report.status === "approved" || Boolean(report.approved_at) },
    { label: "Export Generated", complete: Boolean(generatedExports?.length) },
    { label: "Executive Consumption", complete: report.status === "approved" && Boolean(generatedExports?.length) },
  ];
  const currentLifecycleIndex = lifecycle.reduce((current, item, index) => item.complete ? index : current, 0);

  const exceptions = [
    ...(!selectedVersion ? ["No immutable report version has been generated."] : []),
    ...(evidenceSupported === false ? ["No verified evidence references support the selected version."] : []),
    ...(indicatorSupported === false ? ["No verified indicator measurements support the selected version."] : []),
    ...(report.status === "returned" ? [report.return_reason ?? "The report was returned for correction."] : []),
    ...warnings,
    ...(report.status === "approved" && !report.latest_version_id ? ["The approved report has no available latest version."] : []),
  ];

  const timeline: TimelineItem[] = [
    {
      id: "created",
      label: "Report Created",
      detail: "Institutional report draft created.",
      actor: actor(report.generated_by_user_id),
      date: report.created_at,
      icon: FileText,
      tone: "bg-slate-100 text-slate-700",
    },
    ...detail.versions.map((version) => ({
      id: `version-${version.id}`,
      label: `Version ${version.version_number} Generated`,
      detail: `Frozen source cutoff ${formatDateTime(version.source_cutoff_at)}.`,
      actor: actor(version.generated_by_user_id),
      date: version.generated_at,
      icon: Layers3,
      tone: "bg-blue-100 text-blue-700",
    })),
    ...(report.submitted_at ? [{
      id: "submitted",
      label: "Submitted For Review",
      detail: "The latest report version entered institutional review.",
      actor: actor(report.submitted_by_user_id),
      date: report.submitted_at,
      icon: Send,
      tone: "bg-cyan-100 text-cyan-700",
    }] : []),
    ...(report.reviewed_at ? [{
      id: "reviewed",
      label: report.status === "returned" ? "Review Returned" : "Review Completed",
      detail: report.status === "returned" ? report.return_reason ?? UNAVAILABLE : "Recorded report review completed.",
      actor: actor(report.reviewed_by_user_id),
      date: report.reviewed_at,
      icon: report.status === "returned" ? RotateCcw : Eye,
      tone: report.status === "returned" ? "bg-rose-100 text-rose-700" : "bg-violet-100 text-violet-700",
    }] : []),
    ...(report.approved_at ? [{
      id: "approved",
      label: "Report Approved",
      detail: "Executive approval state recorded.",
      actor: actor(report.approved_by_user_id),
      date: report.approved_at,
      icon: BadgeCheck,
      tone: "bg-emerald-100 text-emerald-700",
    }] : []),
    ...(generatedExports ?? []).map((item) => ({
      id: `export-${item.id}`,
      label: `${item.export_format.toUpperCase()} Export Generated`,
      detail: `Official export ${item.export_status}.`,
      actor: actor(item.generated_by_user_id),
      date: item.generated_at ?? item.completed_at ?? item.requested_at ?? "",
      icon: FileOutput,
      tone: "bg-amber-100 text-amber-700",
    })),
  ].filter((item) => item.date).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="space-y-5 pb-8">
      <header className="overflow-hidden rounded-2xl bg-[#071a3a] text-white shadow-xl shadow-blue-950/10">
        <div className="relative p-5 sm:p-7">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Institutional Report Review & Executive Approval War Room</p>
                <StatusPill value={report.status} dark />
                <StatusPill value={reportHealth} dark />
              </div>
              <h1 className="mt-4 max-w-4xl break-words text-2xl font-bold tracking-tight sm:text-3xl">{report.title}</h1>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-blue-100/75">
                {report.summary ?? UNAVAILABLE}
              </p>
              <div className="mt-5 grid gap-3 text-[10px] sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Report type", humanize(report.report_type)],
                  ["Programme", report.impact_programmes?.name ?? UNAVAILABLE],
                  ["Reporting period", reportingPeriod(report)],
                  ["Current status", humanize(report.status)],
                  ["Approval state", report.approved_at ? "Approved" : report.status === "returned" ? "Returned" : "Pending"],
                  ["Latest version", selectedVersion ? `Version ${selectedVersion.version_number}` : UNAVAILABLE],
                  ["Export readiness", exportReady ? "Ready" : "Not ready"],
                  ["Source cutoff", formatDateTime(selectedVersion?.source_cutoff_at)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="uppercase tracking-[0.12em] text-blue-200/60">{label}</p>
                    <p className="mt-1 truncate font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className={cn("rounded-full border px-3 py-1 text-[9px] font-bold", evidenceSupported ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-blue-100/60")}>Verified Evidence</span>
                <span className={cn("rounded-full border px-3 py-1 text-[9px] font-bold", indicatorSupported ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-blue-100/60")}>Verified Indicators</span>
                <span className={cn("rounded-full border px-3 py-1 text-[9px] font-bold", exportReady ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-blue-100/60")}>Export Ready</span>
              </div>
            </div>
            <div className="flex max-w-xl flex-wrap gap-2 xl:justify-end">
              {canGenerate && <form action={generateVersionAction.bind(null, report.id)}><Button type="submit" size="sm"><Layers3 className="h-3.5 w-3.5" /> Generate Version</Button></form>}
              {canSubmit && <form action={lifecycleAction.bind(null, report.id, "submit")}><Button type="submit" size="sm"><Send className="h-3.5 w-3.5" /> Submit</Button></form>}
              {canReview && <form action={lifecycleAction.bind(null, report.id, "approve")}><Button type="submit" size="sm"><BadgeCheck className="h-3.5 w-3.5" /> Approve</Button></form>}
              {canReview && <Link href="#approval-actions" className="inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-100"><RotateCcw className="h-3.5 w-3.5" /> Return</Link>}
              {canExport && <Link href="#export-centre" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[10px] font-bold text-[#071a3a]"><Download className="h-3.5 w-3.5" /> Export</Link>}
              <Link href={ROUTE} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold text-white"><ArrowRight className="h-3.5 w-3.5 rotate-180" /> Report Library</Link>
            </div>
          </div>
        </div>
      </header>

      {query.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{query.error}</div>}
      {query.success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.success}</div>}

      {legacy && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Legacy Unverified Report</p><p className="mt-1 leading-6">This record predates Phase 1A. Source references and institutional assurance are unavailable, so it must not be treated as an official report.</p></div></div>
        </div>
      )}
      {report.status === "returned" && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 shadow-sm">
          <div className="flex gap-3"><RotateCcw className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Report Returned For Correction</p><p className="mt-1 leading-6">{report.return_reason ?? UNAVAILABLE}</p></div></div>
        </div>
      )}
      {report.status === "approved" && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm">
          <div className="flex gap-3"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Executive-Ready Approval State</p><p className="mt-1 leading-6">The recorded institutional approval is complete. Export and assurance conditions remain visible below.</p></div></div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">
        <MetricCard label="Versions" value={formatNumber(detail.versions.length)} icon={Layers3} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Evidence Records" value={formatNumber(evidenceCount)} icon={FileCheck2} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Indicators Included" value={formatNumber(indicatorCount)} icon={Target} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Assessments Included" value={formatNumber(assessmentCount)} icon={ClipboardCheck} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Approval Events" value={formatNumber(approvalEventCount)} icon={History} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Exports Generated" value={formatNumber(generatedExports?.length ?? null)} icon={FileOutput} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Assurance Score" value={assuranceScore === null ? UNAVAILABLE : `${assuranceScore}%`} icon={Gauge} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Report Health" value={reportHealth} icon={ShieldCheck} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="Executive Readiness" value={executiveReady ? "Ready" : "Not ready"} icon={BadgeCheck} tone="bg-emerald-100 text-emerald-700" />
      </div>

      <Section title="Report Lifecycle Journey" description="Recorded progression from report creation to executive consumption.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {lifecycle.map((item, index) => (
            <div key={item.label} className={cn(
              "rounded-xl border p-3",
              item.complete
                ? "border-blue-200 bg-blue-50/70"
                : index === currentLifecycleIndex + 1
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-slate-200 bg-slate-50",
            )}>
              <div className="flex items-center gap-2">
                <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold", item.complete ? "bg-blue-600 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200")}>{index + 1}</span>
                <p className="text-[10px] font-bold text-slate-700">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Section title="Report Content Assurance Centre" description="Frozen source composition and institutional provenance for the selected version.">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Programme" value={canReadProgramme && report.programme_id ? <Link className="text-blue-700" href={`/dashboard/impact-intelligence/programmes/${report.programme_id}`}>{report.impact_programmes?.name ?? UNAVAILABLE}</Link> : report.impact_programmes?.name ?? UNAVAILABLE} icon={Network} />
            <DetailItem label="Cohort" value={report.impact_beneficiary_cohorts?.name ?? "All programme cohorts"} icon={Layers3} />
            <DetailItem label="Beneficiary" value={report.cohort_member_id ? report.msmes?.business_name ?? UNAVAILABLE : "All matching beneficiaries"} icon={UserRound} />
            <DetailItem label="Intervention" value={report.impact_interventions?.title ?? "All matching interventions"} icon={Link2} />
            <DetailItem label="Source cutoff" value={formatDateTime(selectedVersion?.source_cutoff_at)} icon={Clock3} />
            <DetailItem label="Version generator" value={actor(selectedVersion?.generated_by_user_id)} icon={UserRound} />
          </dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Evidence references", evidenceCount],
              ["Indicator references", indicatorCount],
              ["Assessment references", assessmentCount],
              ["Monitoring references", visitCount],
              ["Intervention references", uniqueInterventions],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-bold text-[#0c1733]">{formatNumber(value as number | null)}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Evidence & Verification Centre" description="Evidence support frozen into this report version. Private storage paths are never exposed.">
          <div className={cn("rounded-2xl p-5 text-white", evidenceSupported ? "bg-emerald-700" : "bg-[#0b1e42]")}>
            <ShieldCheck className="h-6 w-6" />
            <p className="mt-4 text-lg font-bold">{evidenceSupported ? "Verified evidence support recorded" : evidenceCount === null ? UNAVAILABLE : "No verified evidence support"}</p>
            <p className="mt-2 text-xs leading-6 text-white/75">Only evidence references captured by the immutable selected version are represented.</p>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <DetailItem label="Verified evidence" value={formatNumber(evidenceCount)} icon={BadgeCheck} />
            <DetailItem label="Pending evidence" value={UNAVAILABLE} icon={Clock3} />
            <DetailItem label="Returned evidence" value={UNAVAILABLE} icon={RotateCcw} />
            <DetailItem label="Rejected evidence" value={UNAVAILABLE} icon={XCircle} />
          </dl>
          {evidenceReferences === null ? (
            <p className="mt-3 text-xs font-semibold text-amber-700">Evidence references are temporarily unavailable. Other report sections remain usable.</p>
          ) : evidenceReferences.length > 0 ? (
            <div className="mt-4 space-y-2">
              {evidenceReferences.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{item.original_filename}</p><p className="mt-1 text-[10px] text-slate-500">{item.mime_type} · {formatBytes(item.file_size_bytes)}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><StatusPill value={item.verification_status} />{canReadEvidence && <a href={`/api/impact-intelligence/evidence/${item.evidence_id}?disposition=attachment`} className="text-blue-700"><Download className="h-4 w-4" /></a>}</div>
                </div>
              ))}
            </div>
          ) : null}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Outcome Attribution Centre" description="Verified indicator relationships and outcome claims included in the selected version.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Indicators included" value={formatNumber(indicatorCount)} icon={Target} />
            <DetailItem label="Outcome areas" value={indicatorReferences ? formatNumber(new Set(indicatorReferences.map((item) => item.outcome_status).filter(Boolean)).size) : UNAVAILABLE} icon={Network} />
            <DetailItem label="Verified measurements" value={indicatorReferences ? formatNumber(indicatorReferences.filter((item) => item.verification_status === "verified").length) : UNAVAILABLE} icon={BadgeCheck} />
            <DetailItem label="Unsupported measurements" value={UNAVAILABLE} icon={ShieldAlert} />
          </div>
          {indicatorReferences === null ? (
            <p className="mt-4 text-xs font-semibold text-amber-700">Indicator references are temporarily unavailable.</p>
          ) : indicatorReferences.length === 0 ? (
            <EmptyPanel title="No verified indicators" description="This selected version contains no official impact claims." icon={Target} />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {indicatorReferences.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#0c1733]">{item.indicator_name}</p><p className="mt-1 text-[10px] text-slate-500">{item.unit_of_measure} · {formatDate(item.measurement_date)}</p></div><StatusPill value={item.outcome_status} /></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[["Baseline", item.baseline_value], ["Target", item.target_value], ["Measured", item.measured_value]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-bold text-slate-800">{value === null ? UNAVAILABLE : String(value)}</p><p className="mt-1 text-[8px] uppercase text-slate-400">{label}</p></div>)}
                  </div>
                  {canReadIndicators && <Link href={`/dashboard/impact-intelligence/indicators/${item.indicator_definition_id}`} className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">View indicator <ArrowRight className="h-3 w-3" /></Link>}
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title="Assessment & Monitoring Centre" description="Approved assessments and reviewed monitoring visits contributing to this version.">
          <div className="grid gap-3 sm:grid-cols-3">
            <DetailItem label="Contributing assessments" value={formatNumber(assessmentCount)} icon={ClipboardCheck} />
            <DetailItem label="Monitoring visits" value={formatNumber(visitCount)} icon={Activity} />
            <DetailItem label="Completion state" value={selectedVersion ? "Frozen in version" : UNAVAILABLE} icon={FileCheck2} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {assessments.slice(0, 4).map((item) => (
              <article key={String(item.id)} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-slate-800">{String(item.title ?? "Assessment")}</p><StatusPill value={String(item.status ?? "approved")} /></div>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">{humanize(String(item.assessment_type ?? ""))} · Score {item.weighted_score === null || item.weighted_score === undefined ? UNAVAILABLE : String(item.weighted_score)}</p>
                {canReadAssessments && item.id ? <Link href={`/dashboard/impact-intelligence/assessments/${String(item.id)}`} className="mt-2 inline-flex text-[10px] font-bold text-blue-700">Open assessment</Link> : null}
              </article>
            ))}
            {visits.slice(0, 4).map((item) => (
              <article key={String(item.id)} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-slate-800">{String(item.title ?? "Monitoring visit")}</p><StatusPill value={String(item.status ?? "reviewed")} /></div>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">{formatDate(typeof item.visit_date === "string" ? item.visit_date : null)} · Review outcome {humanize(String(item.status ?? ""))}</p>
                {canReadMonitoring && item.id ? <Link href={`/dashboard/impact-intelligence/monitoring/${String(item.id)}`} className="mt-2 inline-flex text-[10px] font-bold text-blue-700">Open visit</Link> : null}
              </article>
            ))}
          </div>
          {assessments.length === 0 && visits.length === 0 && <div className="mt-4"><EmptyPanel title="No contributing records" description="No approved assessments or reviewed visits were included in this version." icon={ClipboardCheck} /></div>}
        </Section>
      </div>

      <Section id="approval-actions" title="Version Control & Approval Centre" description="Immutable versions and recorded institutional approval attribution.">
        {canReview && (
          <form action={lifecycleAction.bind(null, report.id, "return")} className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row">
            <input required name="return_reason" className="min-w-0 flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm" placeholder="Correction required before approval" />
            <Button type="submit" variant="secondary"><RotateCcw className="h-4 w-4" /> Return Report</Button>
          </form>
        )}
        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-3">
            {detail.versions.length === 0 ? <EmptyPanel title="No version history" description="No immutable report version has been generated." icon={Layers3} /> : detail.versions.map((version) => (
              <article key={version.id} className={cn("rounded-2xl border p-4", version.id === selectedVersion?.id ? "border-blue-300 bg-blue-50/60" : "border-slate-200")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm font-bold text-[#0c1733]">Version {version.version_number}{version.id === report.latest_version_id ? " · Latest" : ""}</p><p className="mt-1 text-[10px] text-slate-500">Generated {formatDateTime(version.generated_at)} · Actor {actor(version.generated_by_user_id)}</p></div>
                  {version.id === selectedVersion?.id ? <StatusPill value="Selected" /> : <Link href={`${ROUTE}/${report.id}?version=${version.id}`} className="text-[10px] font-bold text-blue-700">Inspect version</Link>}
                </div>
                <p className="mt-3 text-[11px] text-slate-600">{version.assessment_ids.length} assessments · {version.field_visit_ids.length} visits · {version.evidence_ids.length} evidence · {version.indicator_measurement_ids.length} indicators</p>
              </article>
            ))}
          </div>
          <div className="space-y-3">
            {[
              { label: "Submitted", date: report.submitted_at, actor: report.submitted_by_user_id, tone: "submitted" },
              { label: report.status === "returned" ? "Returned" : "Reviewed", date: report.reviewed_at, actor: report.reviewed_by_user_id, tone: report.status === "returned" ? "returned" : "in_review" },
              { label: "Approved", date: report.approved_at, actor: report.approved_by_user_id, tone: "approved" },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-[#0c1733]">{item.label}</p><StatusPill value={item.date ? item.tone : UNAVAILABLE} /></div>
                <p className="mt-3 text-[10px] text-slate-500">{formatDateTime(item.date)}</p>
                <p className="mt-1 break-all text-[10px] font-semibold text-slate-700">{actor(item.actor)}</p>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Section id="export-centre" title="Export & Distribution Centre" description="Official exports recorded for this report. Private storage locations remain hidden.">
          {canExport && (
            <form action={exportAction.bind(null, report.id)} className="mb-4 flex gap-2">
              <select name="export_format" defaultValue="pdf" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
              <Button type="submit" size="sm"><FileOutput className="h-4 w-4" /> Generate</Button>
            </form>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <DetailItem label="Available formats" value="PDF, JSON" icon={FileOutput} />
            <DetailItem label="Export readiness" value={exportReady ? "Ready" : "Not ready"} icon={ShieldCheck} />
            <DetailItem label="Latest export" value={formatDateTime(generatedExports?.[0]?.generated_at)} icon={Clock3} />
          </div>
          {exports === null ? (
            <p className="mt-4 text-xs font-semibold text-amber-700">Export history is temporarily unavailable.</p>
          ) : exports.length === 0 ? (
            <div className="mt-4"><EmptyPanel title="No exports generated" description="No official export record exists for this report." icon={FileOutput} /></div>
          ) : (
            <div className="mt-4 space-y-2">
              {exports.map((item) => (
                <Link key={item.id} href={`/api/impact-intelligence/reports/exports/${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                  <div><p className="text-xs font-bold uppercase text-slate-800">{item.export_format}</p><p className="mt-1 text-[10px] text-slate-500">{formatDateTime(item.generated_at)} · {formatBytes(item.file_size_bytes)}</p></div>
                  <div className="flex items-center gap-2"><StatusPill value={item.export_status} /><Download className="h-4 w-4 text-blue-700" /></div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Risks & Exceptions Centre" description="Real completeness conditions and approval or export blockers.">
          {exceptions.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-700" />
              <p className="mt-3 text-sm font-bold text-emerald-950">No recorded exceptions</p>
              <p className="mt-1 text-xs leading-6 text-emerald-800">The selected version has no completeness warnings or current workflow blockers.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {exceptions.map((item, index) => (
                <div key={`${item}-${index}`} className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{item}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Activity Timeline" description="Recorded report, version, approval, return, and export events only.">
        {timeline.length === 0 ? <EmptyPanel title="No activity available" description="No report events could be loaded." icon={History} /> : (
          <div className="space-y-3">
            {timeline.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.id} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-[#0c1733]">{item.label}</p><p className="text-[10px] text-slate-400">{formatDateTime(item.date)}</p></div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">{item.detail}</p>
                    <p className="mt-1 break-all text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">Actor · {item.actor}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Executive Assurance Summary" description="At-a-glance institutional readiness based only on loaded report state and frozen source references.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Report Health", reportHealth, ShieldCheck],
            ["Approval Readiness", report.status === "approved" ? "Approved" : report.status === "in_review" ? "In Review" : "Not Ready", BadgeCheck],
            ["Evidence Assurance", evidenceSupported === null ? UNAVAILABLE : evidenceSupported ? "Verified" : "Not Ready", FileCheck2],
            ["Outcome Assurance", indicatorSupported === null ? UNAVAILABLE : indicatorSupported ? "Verified" : "Not Ready", Target],
            ["Export Readiness", exportReady ? "Ready" : "Not Ready", FileOutput],
          ].map(([label, value, Icon]) => (
            <article key={String(label)} className="rounded-2xl border border-slate-200 p-4">
              <Icon className="h-5 w-5 text-blue-700" />
              <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{String(label)}</p>
              <div className="mt-2"><StatusPill value={String(value)} /></div>
            </article>
          ))}
        </div>
      </Section>
    </section>
  );
}
