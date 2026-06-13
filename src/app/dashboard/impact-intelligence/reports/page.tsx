import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileClock,
  FilePlus2,
  FileText,
  FileWarning,
  Filter,
  Gauge,
  Layers3,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Target,
  XCircle,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserContext } from "@/lib/auth/authorization";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canRole } from "@/lib/impact-intelligence/permissions";
import {
  createInstitutionalReport,
  getReportFormOptions,
  listInstitutionalReportExports,
  listInstitutionalReports,
  logImpactReportDiagnostic,
  type InstitutionalReport,
  type InstitutionalReportExport,
  type ReportFormOptions,
} from "@/lib/data/impact-reports";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { CreateReportForm } from "./create-report-form";

type SearchParams = { error?: string; success?: string };
type SourceState<T> = { data: T; available: boolean };
type HealthState = "Healthy" | "Review Needed" | "Blocked" | "Unavailable";

type ReportPortfolioItem = {
  report: InstitutionalReport;
  exports: InstitutionalReportExport[];
  evidenceSupported: boolean | null;
  indicatorSupported: boolean | null;
  reportReady: boolean | null;
  exportReady: boolean | null;
  exportGenerated: boolean | null;
  health: HealthState;
  blockers: string[];
};

const ROUTE = "/dashboard/impact-intelligence/reports";
const UNAVAILABLE = "Unavailable";
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
    redirect(`${ROUTE}/${reportId}?success=Draft%20report%20created`);
  } catch (error) {
    unstable_rethrow(error);
    if (!expectedCreateError(error)) throw error;
    redirect(`${ROUTE}?error=${encodeURIComponent(error instanceof Error ? error.message : "Report draft could not be created.")}#create-report`);
  }
}

function sourceFallback<T>(data: T): SourceState<T> {
  return { data, available: false };
}

async function loadSource<T>(
  ctx: UserContext,
  operation: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<SourceState<T>> {
  try {
    return { data: await loader(), available: true };
  } catch (error) {
    unstable_rethrow(error);
    logImpactReportDiagnostic({
      operation,
      role: ctx.role,
      authUserId: ctx.authUserId,
      appUserId: ctx.appUserId,
      errorMessage: error instanceof Error ? error.message : "Unknown report source error.",
      success: false,
    });
    return sourceFallback(fallback);
  }
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatPercent(value: number | null) {
  return value === null ? UNAVAILABLE : `${value}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatFreshness(value: string | null | undefined) {
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

function latestDate(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string | null, role: string) {
  const source = name?.trim() || roleLabel(role);
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function displayStatus(value: string | null | undefined) {
  return (value ?? UNAVAILABLE).replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function isLegacy(report: InstitutionalReport) {
  return report.metadata?.legacy_unverified === true || report.metadata?.report_phase !== "phase1a";
}

function reportingPeriod(report: InstitutionalReport) {
  const start = report.metadata?.reporting_period_start;
  const end = report.metadata?.reporting_period_end;
  if (typeof start === "string" && typeof end === "string") return `${formatDate(start)} - ${formatDate(end)}`;
  const period = report.metadata?.reporting_period;
  return typeof period === "string" && period.trim() ? period : UNAVAILABLE;
}

function statusTone(status: string | null | undefined) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "in_review") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (status === "returned") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "draft") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "archived") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function healthTone(health: HealthState) {
  if (health === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (health === "Review Needed") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (health === "Blocked") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function summaryHealth(value: number | null): HealthState {
  if (value === null) return "Unavailable";
  if (value >= 80) return "Healthy";
  if (value >= 50) return "Review Needed";
  return "Blocked";
}

function derivePortfolioItem(
  report: InstitutionalReport,
  reportExports: InstitutionalReportExport[],
  exportsAvailable: boolean,
): ReportPortfolioItem {
  if (isLegacy(report)) {
    return {
      report,
      exports: reportExports,
      evidenceSupported: null,
      indicatorSupported: null,
      reportReady: null,
      exportReady: null,
      exportGenerated: exportsAvailable ? reportExports.some((item) => item.export_status === "generated") : null,
      health: "Unavailable",
      blockers: ["Legacy report source assurance is unavailable"],
    };
  }

  const version = report.latest_version;
  if (report.latest_version_id && !version) {
    return {
      report,
      exports: reportExports,
      evidenceSupported: null,
      indicatorSupported: null,
      reportReady: null,
      exportReady: null,
      exportGenerated: exportsAvailable ? reportExports.some((item) => item.export_status === "generated") : null,
      health: "Unavailable",
      blockers: ["Latest version assurance is unavailable"],
    };
  }

  const evidenceSupported = version ? version.evidence_ids.length > 0 : null;
  const indicatorSupported = version ? version.indicator_measurement_ids.length > 0 : null;
  const warnings = version?.completeness_warnings ?? [];
  const reportReady = version ? Boolean(evidenceSupported && indicatorSupported && warnings.length === 0) : false;
  const exportReady = report.status === "approved" && Boolean(version);
  const exportGenerated = exportsAvailable
    ? reportExports.some((item) => item.export_status === "generated")
    : null;
  const blockers: string[] = [];
  if (!version) blockers.push("No generated version");
  if (evidenceSupported === false) blockers.push("Verified evidence missing");
  if (indicatorSupported === false) blockers.push("Verified indicators missing");
  if (warnings.length > 0) blockers.push(`${warnings.length} completeness warning${warnings.length === 1 ? "" : "s"}`);
  if (report.status === "returned") blockers.push(report.return_reason ?? "Returned for correction");

  let health: HealthState = "Blocked";
  if (report.status === "in_review") health = "Review Needed";
  else if (report.status === "returned" || blockers.length > 0) health = "Blocked";
  else if (reportReady) health = "Healthy";

  return {
    report,
    exports: reportExports,
    evidenceSupported,
    indicatorSupported,
    reportReady,
    exportReady,
    exportGenerated,
    health,
    blockers,
  };
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

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
  tone: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-tight text-[#0c1733]">{value}</p>
          <p className="truncate text-[10px] font-semibold text-slate-500">{label}</p>
        </div>
      </div>
    </article>
  );
}

function ProgressValue({ value, tone = "bg-emerald-500" }: { value: number | null; tone?: string }) {
  if (value === null) return <span className="text-[10px] font-semibold text-slate-400">{UNAVAILABLE}</span>;
  return (
    <div className="min-w-[84px]">
      <span className="text-[10px] font-bold text-slate-700">{value}%</span>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function TrustIndicator({ supported, label }: { supported: boolean | null; label: string }) {
  if (supported === null) return <span className="text-[9px] font-semibold text-slate-400">{label}: {UNAVAILABLE}</span>;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ring-1",
      supported ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200",
    )}>
      {supported ? <BadgeCheck className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const query = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let reportsSource = sourceFallback<InstitutionalReport[]>([]);
  let exportsSource = sourceFallback<InstitutionalReportExport[]>([]);
  let optionsSource = sourceFallback<ReportFormOptions>(EMPTY_OPTIONS);
  let contextError: string | null = null;

  try {
    ctx = await getCurrentUserContext();
    reportsSource = await loadSource(ctx, "report_list_load_failed", () => listInstitutionalReports(ctx as UserContext, 100), []);
    if (reportsSource.available) {
      exportsSource = await loadSource(
        ctx,
        "report_exports_load_failed",
        () => listInstitutionalReportExports(ctx as UserContext, reportsSource.data.map((report) => report.id)),
        [],
      );
    }
    if (canRole(ctx.role, "report", "create")) {
      optionsSource = await loadSource(ctx, "report_options_load_failed", () => getReportFormOptions(ctx as UserContext), EMPTY_OPTIONS);
    }
  } catch (error) {
    unstable_rethrow(error);
    contextError = "Your report workspace could not be loaded. Verify the current session and assigned role.";
    logImpactReportDiagnostic({
      operation: "reports_page_context_failed",
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      success: false,
    });
  }

  if (!ctx) {
    return (
      <section className="space-y-5">
        <EmptyState title="Reports unavailable" description={contextError ?? "The report workspace could not be loaded safely."} icon={FileText} />
      </section>
    );
  }

  const reports = reportsSource.data;
  const exportsByReport = new Map<string, InstitutionalReportExport[]>();
  for (const item of exportsSource.data) {
    const current = exportsByReport.get(item.report_id) ?? [];
    current.push(item);
    exportsByReport.set(item.report_id, current);
  }
  const portfolio = reports.map((report) => derivePortfolioItem(
    report,
    exportsByReport.get(report.id) ?? [],
    exportsSource.available,
  ));

  const approved = reports.filter((report) => report.status === "approved").length;
  const submitted = reports.filter((report) => report.status === "in_review").length;
  const drafts = reports.filter((report) => report.status === "draft").length;
  const returned = reports.filter((report) => report.status === "returned").length;
  const generated = reports.filter((report) => Boolean(report.latest_version)).length;
  const exportReady = portfolio.filter((item) => item.exportReady === true).length;
  const evidenceSupported = portfolio.filter((item) => item.evidenceSupported === true).length;
  const indicatorSupported = portfolio.filter((item) => item.indicatorSupported === true).length;
  const healthy = portfolio.filter((item) => item.health === "Healthy").length;
  const reportingHealth = reportsSource.available ? ratio(healthy, portfolio.filter((item) => item.health !== "Unavailable").length) : null;
  const approvalReadiness = reportsSource.available ? ratio(approved, reports.length) : null;
  const assuranceReadyReports = portfolio.filter((item) => item.evidenceSupported !== null || item.indicatorSupported !== null);
  const evidenceAssurance = reportsSource.available ? ratio(evidenceSupported, assuranceReadyReports.length) : null;
  const exportReadiness = reportsSource.available ? ratio(exportReady, reports.filter((item) => !isLegacy(item)).length) : null;
  const freshness = latestDate([
    ...reports.map((report) => report.approved_at ?? report.reviewed_at ?? report.submitted_at ?? report.latest_version?.generated_at ?? report.created_at),
    ...exportsSource.data.map((item) => item.generated_at ?? item.completed_at ?? item.requested_at),
  ]);

  const pipeline = [
    { label: "Draft", value: drafts, available: reportsSource.available, color: "bg-amber-500" },
    { label: "Generated", value: generated, available: reportsSource.available, color: "bg-cyan-500" },
    { label: "Submitted", value: reports.filter((report) => Boolean(report.submitted_at)).length, available: reportsSource.available, color: "bg-blue-500" },
    { label: "Under Review", value: submitted, available: reportsSource.available, color: "bg-violet-500" },
    { label: "Approved", value: approved, available: reportsSource.available, color: "bg-emerald-500" },
    { label: "Export Ready", value: exportReady, available: reportsSource.available, color: "bg-teal-500" },
    { label: "Executive Consumption", value: approved, available: reportsSource.available, color: "bg-indigo-500" },
  ];
  const availablePipeline = pipeline.filter((item) => item.available);
  const bottleneckValue = availablePipeline.length > 0 ? Math.min(...availablePipeline.map((item) => item.value)) : null;

  const approvedReports = portfolio.filter((item) => item.report.status === "approved");
  const pendingReports = portfolio.filter((item) => item.report.status === "in_review");
  const recentlyApproved = [...approvedReports].sort((a, b) => String(b.report.approved_at).localeCompare(String(a.report.approved_at)));
  const exportReadyReports = portfolio.filter((item) => item.exportReady === true);
  const missingEvidence = portfolio.filter((item) => item.evidenceSupported === false);
  const missingIndicators = portfolio.filter((item) => item.indicatorSupported === false);
  const reportingGaps = portfolio.filter((item) => item.blockers.length > 0);
  const returnedReports = portfolio.filter((item) => item.report.status === "returned");
  const exportBlockers = portfolio.filter((item) => item.report.status === "approved" && item.exportReady === false);

  const programmeMap = new Map<string, {
    name: string;
    total: number;
    approved: number;
    ready: number;
  }>();
  for (const item of portfolio) {
    const key = item.report.programme_id ?? "unavailable";
    const current = programmeMap.get(key) ?? {
      name: item.report.impact_programmes?.name ?? UNAVAILABLE,
      total: 0,
      approved: 0,
      ready: 0,
    };
    current.total += 1;
    if (item.report.status === "approved") current.approved += 1;
    if (item.reportReady === true) current.ready += 1;
    programmeMap.set(key, current);
  }
  const programmeReporting = Array.from(programmeMap.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const maxProgrammeReports = Math.max(...programmeReporting.map((item) => item.total), 1);

  const recentActivity = [
    ...reports.map((report) => ({ type: "Report created", title: report.title, createdAt: report.created_at, href: `${ROUTE}/${report.id}`, icon: FilePlus2 })),
    ...reports.filter((report) => report.latest_version).map((report) => ({ type: "Version generated", title: report.title, createdAt: report.latest_version?.generated_at ?? null, href: `${ROUTE}/${report.id}`, icon: FileCheck2 })),
    ...reports.filter((report) => report.submitted_at).map((report) => ({ type: "Submitted", title: report.title, createdAt: report.submitted_at, href: `${ROUTE}/${report.id}`, icon: Send })),
    ...reports.filter((report) => report.approved_at).map((report) => ({ type: "Approved", title: report.title, createdAt: report.approved_at, href: `${ROUTE}/${report.id}`, icon: BadgeCheck })),
    ...reports.filter((report) => report.status === "returned" && report.reviewed_at).map((report) => ({ type: "Returned", title: report.title, createdAt: report.reviewed_at, href: `${ROUTE}/${report.id}`, icon: RotateCcw })),
    ...exportsSource.data.filter((item) => item.generated_at).map((item) => {
      const report = reports.find((candidate) => candidate.id === item.report_id);
      return { type: "Export generated", title: report?.title ?? "Institutional report", createdAt: item.generated_at, href: `${ROUTE}/${item.report_id}`, icon: Download };
    }),
  ]
    .filter((item) => item.createdAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 10);

  const canCreate = canRole(ctx.role, "report", "create") && optionsSource.available;
  const canGenerate = canRole(ctx.role, "report", "update");
  const canReview = canRole(ctx.role, "report", "review") || canRole(ctx.role, "report", "approve");
  const canExport = canRole(ctx.role, "report", "export");
  const firstGeneratable = portfolio.find((item) => ["draft", "returned"].includes(item.report.status) && !isLegacy(item.report));
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Reports</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Institutional Reports Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Executive control across institutional reporting, approvals, assurance, and official export readiness.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CircleDot className="h-4 w-4" />
                <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Data freshness</p>
                <p className="text-[11px] font-semibold text-slate-700">{formatFreshness(freshness)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && (
                <Link href={`${ROUTE}/new`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c1f46] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#132d60]">
                  <Plus className="h-4 w-4" /> Create Report
                </Link>
              )}
              {canGenerate && firstGeneratable && (
                <Link href={`${ROUTE}/${firstGeneratable.report.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <FileCheck2 className="h-4 w-4" /> Generate Version
                </Link>
              )}
              {canReview && (
                <Link href="#review-queue" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <ClipboardCheck className="h-4 w-4" /> Review Queue
                </Link>
              )}
              {canExport && (
                <Link href="#export-centre" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Download className="h-4 w-4" /> Export Centre
                </Link>
              )}
              <details className="relative">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Filter className="h-4 w-4" /> Scope <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-xl">
                  <p className="font-bold text-slate-900">Current reporting scope</p>
                  <p className="mt-2 leading-5">Showing report records permitted for {roleLabel(ctx.role)}. Programme assignment and approved-only rules remain enforced by the data layer.</p>
                </div>
              </details>
              <span title={`${ctx.fullName ?? roleLabel(ctx.role)} · ${roleLabel(ctx.role)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initials(ctx.fullName, ctx.role)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {query.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
      {query.success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{query.success}</div>}
      {!reportsSource.available && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Report records are temporarily unavailable. No portfolio metrics are being inferred.
        </div>
      )}
      {canRole(ctx.role, "report", "create") && !optionsSource.available && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Report creation options are temporarily unavailable. Existing reports remain accessible.
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_30%,rgba(99,102,241,0.38),transparent_30%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="reports-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#a5b4fc" /></pattern></defs>
            <path d="M510 32 615 18l82 39 67 3 55 63-47 48 8 58-94 16-70-35-75 16-53-62 25-59Z" fill="url(#reports-hero-dots)" stroke="#818cf8" strokeOpacity=".45" />
            <path d="M450 234c80-54 119-118 185-84s96 5 156-73" fill="none" stroke="#818cf8" strokeOpacity=".55" />
            <circle cx="646" cy="150" r="5" fill="#34d399" />
            <circle cx="713" cy="156" r="4" fill="#a78bfa" />
            <circle cx="797" cy="78" r="4" fill="#22d3ee" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Executive reporting overview</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Governed institutional outputs, ready for assurance and executive consumption</h2>
              <p className="mt-2 text-sm text-blue-100/80">Immutable versions. Verified source signals. Approval-controlled official exports.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total reports", value: reportsSource.available ? formatNumber(reports.length) : UNAVAILABLE, icon: FileText, color: "text-cyan-300" },
              { label: "Approved reports", value: reportsSource.available ? formatNumber(approved) : UNAVAILABLE, icon: BadgeCheck, color: "text-emerald-300" },
              { label: "Submitted reports", value: reportsSource.available ? formatNumber(submitted) : UNAVAILABLE, icon: Send, color: "text-blue-300" },
              { label: "Draft reports", value: reportsSource.available ? formatNumber(drafts) : UNAVAILABLE, icon: FileClock, color: "text-amber-300" },
              { label: "Export ready", value: reportsSource.available ? formatNumber(exportReady) : UNAVAILABLE, icon: Download, color: "text-violet-300" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-[#0a1d40]/75 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><Icon className={cn("h-4 w-4", item.color)} /></span>
                    <div><p className="text-lg font-bold">{item.value}</p><p className="text-[10px] font-medium text-blue-100/70">{item.label}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
        <MetricCard label="Total Reports" value={reportsSource.available ? formatNumber(reports.length) : UNAVAILABLE} icon={FileText} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Draft Reports" value={reportsSource.available ? formatNumber(drafts) : UNAVAILABLE} icon={FileClock} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Submitted Reports" value={reportsSource.available ? formatNumber(submitted) : UNAVAILABLE} icon={Send} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Approved Reports" value={reportsSource.available ? formatNumber(approved) : UNAVAILABLE} icon={BadgeCheck} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Returned Reports" value={reportsSource.available ? formatNumber(returned) : UNAVAILABLE} icon={RotateCcw} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="Export Ready" value={reportsSource.available ? formatNumber(exportReady) : UNAVAILABLE} icon={Download} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Evidence Supported" value={reportsSource.available ? formatNumber(evidenceSupported) : UNAVAILABLE} icon={ShieldCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Outcome Verified" value={reportsSource.available ? formatNumber(indicatorSupported) : UNAVAILABLE} icon={Target} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Reporting Health" value={formatPercent(reportingHealth)} icon={Gauge} tone="bg-teal-100 text-teal-700" />
      </div>

      <Section
        title="Institutional Reporting Pipeline"
        description="Lifecycle progression from draft creation to executive consumption. The lowest available stage is highlighted as the current bottleneck."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {pipeline.map((item, index) => (
            <article
              key={item.label}
              className={cn(
                "relative rounded-2xl border p-4",
                item.available && item.value === bottleneckValue ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", item.available ? item.color : "bg-slate-300")} />
                {index < pipeline.length - 1 && <ArrowRight className="hidden h-3.5 w-3.5 text-slate-300 2xl:block" />}
              </div>
              <p className="mt-5 text-2xl font-bold tracking-tight text-[#0c1733]">{item.available ? formatNumber(item.value) : UNAVAILABLE}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
              {item.available && item.value === bottleneckValue && <p className="mt-2 text-[9px] font-bold uppercase text-amber-700">Bottleneck</p>}
            </article>
          ))}
        </div>
      </Section>

      <Section
        title="Report Portfolio"
        description="Institutional reports with programme scope, immutable version, assurance, approval, and export context."
        action={<span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{reportsSource.available ? `${reports.length} reports` : UNAVAILABLE}</span>}
      >
        {portfolio.length === 0 ? (
          <EmptyState
            title="No reports available"
            description={scopeEmptyMessage ?? (canCreate ? "Create a programme-scoped draft to begin institutional reporting." : "Reports in the current role and programme scope will appear here.")}
            icon={FileText}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {portfolio.map((item) => (
              <Link
                key={item.report.id}
                href={`${ROUTE}/${item.report.id}`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  item.report.status === "approved"
                    ? "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
                    : item.report.status === "returned"
                      ? "border-rose-300 bg-rose-50/60"
                      : "border-slate-200 bg-white",
                )}
              >
                {item.report.status === "approved" && <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />}
                {item.report.status === "returned" && <div className="absolute inset-x-0 top-0 h-1 bg-rose-500" />}
                <div className="flex items-start justify-between gap-3">
                  <span className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                    item.report.status === "approved"
                      ? "bg-emerald-100 text-emerald-700"
                      : item.report.status === "returned"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-600",
                  )}>
                    {item.report.status === "approved" ? <FileCheck2 className="h-5 w-5" /> : item.report.status === "returned" ? <FileWarning className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", statusTone(item.report.status))}>{displayStatus(item.report.status)}</span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                  </div>
                </div>
                <h3 className="mt-4 line-clamp-2 text-sm font-bold leading-5 text-[#0c1733] group-hover:text-indigo-700">{item.report.title}</h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{displayStatus(item.report.report_type)}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Programme</p><p className="mt-1 truncate font-semibold text-slate-700">{item.report.impact_programmes?.name ?? UNAVAILABLE}</p></div>
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Reporting period</p><p className="mt-1 truncate font-semibold text-slate-700">{reportingPeriod(item.report)}</p></div>
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Latest version</p><p className="mt-1 font-semibold text-slate-700">{item.report.latest_version ? `v${item.report.latest_version.version_number}` : UNAVAILABLE}</p></div>
                  <div className="rounded-lg bg-white/80 p-2 ring-1 ring-slate-100"><p className="text-slate-400">Export state</p><p className="mt-1 font-semibold text-slate-700">{item.exportGenerated === null ? UNAVAILABLE : item.exportGenerated ? "Generated" : item.exportReady ? "Ready" : "Not ready"}</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <TrustIndicator supported={item.evidenceSupported} label="Verified evidence" />
                  <TrustIndicator supported={item.indicatorSupported} label="Verified indicators" />
                </div>
                {item.report.status === "returned" && (
                  <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] leading-4 text-rose-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{item.report.return_reason ?? "Returned for correction"}</span>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-medium text-slate-500">{formatDate(item.report.approved_at ?? item.report.submitted_at ?? item.report.created_at)}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700">Open report <ArrowRight className="h-3 w-3" /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Section id="review-queue" title="Executive Reporting Centre" description="Approved, pending-review, recently approved, and export-ready institutional outputs.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Approved reports", value: approvedReports.length, items: approvedReports, icon: BadgeCheck, tone: "bg-emerald-100 text-emerald-700" },
              { label: "Pending review", value: pendingReports.length, items: pendingReports, icon: FileClock, tone: "bg-blue-100 text-blue-700" },
              { label: "Recently approved", value: recentlyApproved.length, items: recentlyApproved, icon: CheckCircle2, tone: "bg-teal-100 text-teal-700" },
              { label: "Export ready", value: exportReadyReports.length, items: exportReadyReports, icon: Download, tone: "bg-violet-100 text-violet-700" },
            ].map((group) => {
              const Icon = group.icon;
              return (
                <article key={group.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className={cn("grid h-9 w-9 place-items-center rounded-xl", group.tone)}><Icon className="h-4 w-4" /></span>
                    <span className="text-xl font-bold text-[#0c1733]">{formatNumber(group.value)}</span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-700">{group.label}</p>
                  <div className="mt-3 space-y-1">
                    {group.items.slice(0, 3).map((item) => (
                      <Link key={item.report.id} href={`${ROUTE}/${item.report.id}`} className="block truncate rounded-lg bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-100 hover:text-indigo-700">
                        {item.report.title}
                      </Link>
                    ))}
                    {group.items.length === 0 && <p className="text-[10px] text-slate-400">No reports in this state.</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </Section>

        <Section title="Evidence & Outcome Assurance Centre" description="Assurance drawn only from the latest immutable version source references.">
          <div className="space-y-3">
            {[
              { label: "Reports with verified evidence", value: evidenceSupported, readiness: evidenceAssurance, icon: ShieldCheck, tone: "bg-emerald-500" },
              { label: "Reports missing evidence", value: missingEvidence.length, readiness: ratio(missingEvidence.length, reports.length), icon: FileWarning, tone: "bg-amber-500" },
              { label: "Reports with verified indicators", value: indicatorSupported, readiness: ratio(indicatorSupported, assuranceReadyReports.length), icon: Target, tone: "bg-indigo-500" },
              { label: "Reports with reporting gaps", value: reportingGaps.length, readiness: ratio(reportingGaps.length, reports.length), icon: AlertTriangle, tone: "bg-rose-500" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("grid h-9 w-9 place-items-center rounded-xl text-white", item.tone)}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-700">{item.label}</p>
                        <span className="text-sm font-bold text-[#0c1733]">{reportsSource.available ? formatNumber(item.value) : UNAVAILABLE}</span>
                      </div>
                      <div className="mt-2"><ProgressValue value={reportsSource.available ? item.readiness : null} tone={item.tone} /></div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Section>
      </div>

      <Section title="Programme Reporting Centre" description="Report distribution, approvals, and reporting readiness by programme within the current scope.">
        {programmeReporting.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">Programme reporting distribution is unavailable.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {programmeReporting.map((item) => (
              <article key={item.name} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#0c1733]">{item.name}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{item.approved} approved of {item.total} reports</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Layers3 className="h-4 w-4" /></span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round((item.total / maxProgrammeReports) * 100)}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-[10px] font-semibold text-slate-500">Reporting readiness</span>
                  <ProgressValue value={ratio(item.ready, item.total)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="Reporting Health Matrix" description="Executive scanning view across version, assurance, approval, export, and health state.">
        {portfolio.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">No report health rows are available.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  {["Report", "Programme", "Version", "Status", "Evidence Support", "Indicator Support", "Approval State", "Export Ready", "Health"].map((heading) => (
                    <th key={heading} className="px-4 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.map((item) => (
                  <tr key={item.report.id} className={cn("border-t border-slate-100", item.report.status === "approved" && "bg-emerald-50/30", item.report.status === "returned" && "bg-rose-50/40")}>
                    <td className="max-w-[260px] px-4 py-3"><Link href={`${ROUTE}/${item.report.id}`} className="block truncate font-bold text-slate-800 hover:text-indigo-700">{item.report.title}</Link></td>
                    <td className="px-4 py-3 text-slate-600">{item.report.impact_programmes?.name ?? UNAVAILABLE}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{item.report.latest_version ? `v${item.report.latest_version.version_number}` : UNAVAILABLE}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", statusTone(item.report.status))}>{displayStatus(item.report.status)}</span></td>
                    <td className="px-4 py-3">{item.evidenceSupported === null ? UNAVAILABLE : item.evidenceSupported ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : "No"}</td>
                    <td className="px-4 py-3">{item.indicatorSupported === null ? UNAVAILABLE : item.indicatorSupported ? <BadgeCheck className="h-4 w-4 text-indigo-600" /> : "No"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.report.status === "approved" ? "Approved" : item.report.status === "in_review" ? "Awaiting review" : "Not approved"}</td>
                    <td className="px-4 py-3">{item.exportReady === null ? UNAVAILABLE : item.exportReady ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : "No"}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Section title="Risks & Blockers Centre" description="Only observed workflow and latest-version conditions are presented as blockers.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Returned reports", value: returnedReports.length, icon: RotateCcw, tone: "bg-rose-100 text-rose-700" },
              { label: "Awaiting approval", value: pendingReports.length, icon: FileClock, tone: "bg-blue-100 text-blue-700" },
              { label: "Missing evidence", value: missingEvidence.length, icon: ShieldCheck, tone: "bg-amber-100 text-amber-700" },
              { label: "Missing indicators", value: missingIndicators.length, icon: Target, tone: "bg-violet-100 text-violet-700" },
              { label: "Export blockers", value: exportBlockers.length, icon: Download, tone: "bg-orange-100 text-orange-700" },
              { label: "Reporting gaps", value: reportingGaps.length, icon: AlertTriangle, tone: "bg-slate-200 text-slate-700" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span>
                  <p className="mt-4 text-xl font-bold text-[#0c1733]">{reportsSource.available ? formatNumber(item.value) : UNAVAILABLE}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p>
                </article>
              );
            })}
          </div>
          {returnedReports.length > 0 && (
            <div className="mt-4 space-y-2">
              {returnedReports.slice(0, 4).map((item) => (
                <Link key={item.report.id} href={`${ROUTE}/${item.report.id}`} className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <FileWarning className="h-4 w-4 shrink-0 text-rose-700" />
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-rose-900">{item.report.title}</p><p className="mt-0.5 truncate text-[10px] text-rose-700">{item.report.return_reason ?? "Returned for correction"}</p></div>
                  <ArrowRight className="h-3.5 w-3.5 text-rose-500" />
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Activity Timeline" description="Real report, version, workflow, and export timestamps only.">
          {recentActivity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">No dated report activity is available.</p>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link key={`${item.type}-${item.href}-${item.createdAt}-${index}`} href={item.href} className="group flex gap-3 rounded-xl p-2.5 hover:bg-slate-50">
                    <div className="flex flex-col items-center">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-indigo-700"><Icon className="h-3.5 w-3.5" /></span>
                      {index < recentActivity.length - 1 && <span className="mt-1 h-full w-px bg-slate-200" />}
                    </div>
                    <div className="min-w-0 pb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-indigo-700">{item.type}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-700 group-hover:text-indigo-800">{item.title}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatFreshness(item.createdAt)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <Section id="export-centre" title="Executive Reporting Summary" description="Consolidated institutional reporting health based on currently available scoped report records.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Reporting Health", value: summaryHealth(reportingHealth), metric: reportingHealth, icon: Activity },
            { label: "Approval Readiness", value: summaryHealth(approvalReadiness), metric: approvalReadiness, icon: BadgeCheck },
            { label: "Evidence Assurance", value: summaryHealth(evidenceAssurance), metric: evidenceAssurance, icon: ShieldCheck },
            { label: "Export Readiness", value: summaryHealth(exportReadiness), metric: exportReadiness, icon: Download },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0c1f46] text-white"><Icon className="h-4 w-4" /></span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.value))}>{item.value}</span>
                </div>
                <p className="mt-5 text-xs font-bold text-[#0c1733]">{item.label}</p>
                <div className="mt-3"><ProgressValue value={item.metric} /></div>
              </article>
            );
          })}
        </div>
      </Section>

      {canCreate && (
        <Section
          id="create-report"
          title="Create Institutional Report"
          description="Create a draft within existing programme, cohort, beneficiary, and intervention relationships."
        >
          <CreateReportForm options={optionsSource.data} action={createReportAction} />
        </Section>
      )}
    </section>
  );
}
