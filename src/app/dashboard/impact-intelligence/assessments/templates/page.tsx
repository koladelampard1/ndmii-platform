import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileEdit,
  FileStack,
  Gauge,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  listAssessmentTemplates,
  listImpactAssessments,
  listImpactCohorts,
  listImpactProgrammes,
  type ImpactAssessment,
  type ImpactAssessmentTemplate,
} from "@/lib/data/impact-intelligence";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState, StatusBadge, UnavailableState } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/assessments/templates";
const UNAVAILABLE = "Unavailable";

type SourceState<T> = { data: T; available: boolean };
type RegistryItem = {
  template: ImpactAssessmentTemplate;
  assessments: ImpactAssessment[];
  programmeNames: string[];
  cohortNames: string[];
  approvalStatus: string | null;
  versionStatus: string | null;
  owner: string | null;
  reviewRequired: boolean | null;
};

function sourceFallback<T>(data: T): SourceState<T> {
  return { data, available: false };
}

async function loadSource<T>(
  ctx: Awaited<ReturnType<typeof getCurrentUserContext>>,
  operation: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<SourceState<T>> {
  try {
    return { data: await loader(), available: true };
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation, error });
    return sourceFallback(fallback);
  }
}

function formatNumber(value: number | null) {
  return value === null ? UNAVAILABLE : value.toLocaleString("en-NG");
}

function formatPercent(value: number | null) {
  return value === null ? UNAVAILABLE : `${value}%`;
}

function ratio(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function display(value: string | null | undefined) {
  return value?.trim()
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : UNAVAILABLE;
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

function metadataString(template: ImpactAssessmentTemplate, keys: string[]) {
  for (const key of keys) {
    const value = template.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function metadataBoolean(template: ImpactAssessmentTemplate, keys: string[]) {
  for (const key of keys) {
    const value = template.metadata?.[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function approvalStatus(template: ImpactAssessmentTemplate) {
  return metadataString(template, ["approval_status", "governance_status", "approvalStatus"]);
}

function reviewRequired(template: ImpactAssessmentTemplate) {
  const explicit = metadataBoolean(template, ["review_required", "requires_review", "reviewRequired"]);
  if (explicit !== null) return explicit;
  const status = metadataString(template, ["review_status", "reviewStatus"]);
  if (!status) return null;
  return ["needs_review", "review_required", "due", "overdue"].includes(status.toLowerCase());
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#0c1733] sm:text-base">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{description}</p>}
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
  icon: typeof ClipboardCheck;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 truncate text-xl font-bold tracking-tight text-[#0c1733]">{value}</p>
        </div>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

function DistributionBars({
  items,
  emptyText,
  tone,
}: {
  items: Array<{ label: string; value: number; detail?: string }>;
  emptyText: string;
  tone: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">{emptyText}</p>;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {items.slice(0, 7).map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-semibold text-slate-700">{item.label}</span>
            <span className="font-bold text-slate-900">{formatNumber(item.value)}</span>
          </div>
          {item.detail && <p className="mt-0.5 truncate text-[9px] text-slate-400">{item.detail}</p>}
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AssessmentTemplatesPage() {
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let templatesSource = sourceFallback<ImpactAssessmentTemplate[]>([]);

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    templatesSource = await loadSource(
      currentContext,
      "assessment_framework_templates_load_failed",
      () => listAssessmentTemplates(currentContext, { limit: 1000 }),
      [],
    );
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "assessment_framework_context_load_failed", error });
  }

  if (!ctx || !templatesSource.available) {
    return (
      <section className="space-y-6">
        <Section title="Assessment Framework Registry Unavailable">
          <EmptyState
            title="Assessment templates could not load"
            description="The template source, current session, or role assignment is temporarily unavailable. No framework metrics are being inferred."
            icon={ClipboardCheck}
          />
        </Section>
      </section>
    );
  }

  const [assessmentsSource, programmesSource, cohortsSource] = await Promise.all([
    loadSource(ctx, "assessment_framework_assessments_load_failed", () => listImpactAssessments(ctx, { limit: 5000 }), []),
    loadSource(ctx, "assessment_framework_programmes_load_failed", () => listImpactProgrammes(ctx, { limit: 1000 }), []),
    loadSource(ctx, "assessment_framework_cohorts_load_failed", () => listImpactCohorts(ctx, { limit: 3000 }), []),
  ]);

  const templates = templatesSource.data;
  const assessments = assessmentsSource.data;
  const programmes = programmesSource.data;
  const cohorts = cohortsSource.data;
  const programmeNameById = new Map(programmes.map((programme) => [programme.id, programme.name]));
  const cohortNameById = new Map(cohorts.map((cohort) => [cohort.id, cohort.name]));

  const registry: RegistryItem[] = templates.map((template) => {
    const templateAssessments = assessments.filter((assessment) => assessment.template_id === template.id);
    const programmeNames = Array.from(new Set(templateAssessments
      .map((assessment) => assessment.impact_programmes?.name ?? (assessment.programme_id ? programmeNameById.get(assessment.programme_id) : null))
      .filter((value): value is string => Boolean(value))));
    const cohortNames = Array.from(new Set(templateAssessments
      .map((assessment) => assessment.impact_beneficiary_cohorts?.name ?? (assessment.cohort_id ? cohortNameById.get(assessment.cohort_id) : null))
      .filter((value): value is string => Boolean(value))));

    return {
      template,
      assessments: templateAssessments,
      programmeNames,
      cohortNames,
      approvalStatus: approvalStatus(template),
      versionStatus: metadataString(template, ["version_status", "versionStatus"]),
      owner: metadataString(template, ["owner_name", "owner", "framework_owner"]),
      reviewRequired: reviewRequired(template),
    };
  }).sort((a, b) =>
    b.assessments.length - a.assessments.length
    || String(b.template.updated_at ?? b.template.created_at).localeCompare(String(a.template.updated_at ?? a.template.created_at)),
  );

  const active = templates.filter((template) => template.status === "active").length;
  const draft = templates.filter((template) => template.status === "draft").length;
  const retired = templates.filter((template) => template.status === "archived").length;
  const knownApprovals = registry.filter((item) => item.approvalStatus !== null);
  const approved = knownApprovals.filter((item) => item.approvalStatus?.toLowerCase() === "approved").length;
  const knownReviews = registry.filter((item) => item.reviewRequired !== null);
  const reviewsRequired = knownReviews.filter((item) => item.reviewRequired).length;
  const usedTemplates = registry.filter((item) => item.assessments.length > 0).length;
  const programmesUsingTemplates = new Set(assessments.map((assessment) => assessment.programme_id).filter(Boolean)).size;
  const freshness = latestDate(templates.flatMap((template) => [template.updated_at, template.created_at]));
  const programmeCoverage = programmesSource.available ? ratio(programmesUsingTemplates, programmes.length) : null;
  const frameworkHealth = ratio(active, templates.length);
  const usageCoverage = assessmentsSource.available ? ratio(usedTemplates, templates.length) : null;
  const governanceHealth = knownApprovals.length === templates.length ? ratio(approved, templates.length) : null;

  const templatesByProgramme = programmes.map((programme) => {
    const programmeAssessments = assessments.filter((assessment) => assessment.programme_id === programme.id);
    return {
      label: programme.name,
      value: new Set(programmeAssessments.map((assessment) => assessment.template_id).filter(Boolean)).size,
      detail: `${programmeAssessments.length.toLocaleString("en-NG")} assessment${programmeAssessments.length === 1 ? "" : "s"}`,
    };
  }).filter((item) => item.value > 0).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const templatesByCohort = cohorts.map((cohort) => {
    const cohortAssessments = assessments.filter((assessment) => assessment.cohort_id === cohort.id);
    return {
      label: cohort.name,
      value: new Set(cohortAssessments.map((assessment) => assessment.template_id).filter(Boolean)).size,
      detail: cohort.impact_programmes?.name ?? UNAVAILABLE,
    };
  }).filter((item) => item.value > 0).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const assessmentDistribution = registry
    .filter((item) => item.assessments.length > 0)
    .map((item) => ({ label: item.template.name, value: item.assessments.length, detail: display(item.template.assessment_type) }));

  const activity = registry.flatMap((item) => {
    const events: Array<{
      type: string;
      title: string;
      createdAt: string;
      href: string;
      icon: typeof ClipboardCheck;
    }> = [];
    if (item.template.created_at) {
      events.push({
        type: "Template created",
        title: item.template.name,
        createdAt: item.template.created_at,
        href: `${ROUTE}/${item.template.id}`,
        icon: Plus,
      });
    }
    if (item.template.updated_at && item.template.updated_at !== item.template.created_at) {
      events.push({
        type: "Template updated",
        title: item.template.name,
        createdAt: item.template.updated_at,
        href: `${ROUTE}/${item.template.id}`,
        icon: RefreshCw,
      });
    }
    const approvedAt = metadataString(item.template, ["approved_at", "approval_date"]);
    if (item.approvalStatus?.toLowerCase() === "approved" && approvedAt) {
      events.push({
        type: "Template approved",
        title: item.template.name,
        createdAt: approvedAt,
        href: `${ROUTE}/${item.template.id}`,
        icon: BadgeCheck,
      });
    }
    const retiredAt = metadataString(item.template, ["retired_at", "archived_at"]);
    if (item.template.status === "archived" && retiredAt) {
      events.push({
        type: "Template retired",
        title: item.template.name,
        createdAt: retiredAt,
        href: `${ROUTE}/${item.template.id}`,
        icon: FileStack,
      });
    }
    return events;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  const canCreate = canRole(ctx.role, "assessment_template", "create")
    && canAccessRoute(ctx.role, `${ROUTE}/new`);
  const canOpenAssessments = canRole(ctx.role, "assessment", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/assessments");
  const canOpenAnalytics = canRole(ctx.role, "analytics", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/analytics");
  const canOpenTemplate = canAccessRoute(ctx.role, ROUTE);
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/40 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link href="/dashboard/impact-intelligence" className="hover:text-emerald-700">Impact Intelligence</Link>
              <span className="text-slate-300">/</span>
              <Link href="/dashboard/impact-intelligence/assessments" className="hover:text-emerald-700">Assessments</Link>
              <span className="text-slate-300">/</span>
              <span className="text-[#0c1733]">Templates</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0c1733] sm:text-3xl">Assessment Framework Command Centre</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              BOI&apos;s governed registry of assessment instruments, programme adoption, version context, and framework readiness.
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
                  <Plus className="h-4 w-4" /> Create Template
                </Link>
              )}
              {canOpenAssessments && (
                <Link href="/dashboard/impact-intelligence/assessments" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <ClipboardCheck className="h-4 w-4" /> Open Assessments
                </Link>
              )}
              {canOpenAnalytics && (
                <Link href="/dashboard/impact-intelligence/analytics" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <BarChart3 className="h-4 w-4" /> Open Analytics
                </Link>
              )}
              <span title={`${ctx.fullName ?? roleLabel(ctx.role)} · ${roleLabel(ctx.role)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initials(ctx.fullName, ctx.role)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_72%_30%,rgba(14,165,233,0.4),transparent_28%),linear-gradient(120deg,#07152f_0%,#0b2450_55%,#071a3c_100%)] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 280" className="h-full w-full">
            <defs><pattern id="framework-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#60a5fa" /></pattern></defs>
            <path d="M500 35 610 20l75 35 72 10 50 58-42 48 12 56-97 18-64-35-78 15-46-65 22-55Z" fill="url(#framework-hero-dots)" stroke="#38bdf8" strokeOpacity=".4" />
            <path d="M460 230c70-50 115-112 177-82s91 6 150-68" fill="none" stroke="#38bdf8" strokeOpacity=".55" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Assessment framework registry</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Govern every assessment instrument from definition to programme use</h2>
              <p className="mt-2 text-sm text-blue-100/80">Template records with scoped programme adoption and metadata-backed governance only.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">{roleLabel(ctx.role)}</span>
              <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-blue-100">Governed scope</span>
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total templates", value: formatNumber(templates.length), icon: FileStack, color: "text-cyan-300" },
              { label: "Active templates", value: formatNumber(active), icon: CheckCircle2, color: "text-emerald-300" },
              { label: "Draft templates", value: formatNumber(draft), icon: FileEdit, color: "text-amber-300" },
              { label: "Approved templates", value: knownApprovals.length === templates.length ? formatNumber(approved) : UNAVAILABLE, icon: BadgeCheck, color: "text-violet-300" },
              { label: "Programmes using templates", value: assessmentsSource.available ? formatNumber(programmesUsingTemplates) : UNAVAILABLE, icon: Building2, color: "text-rose-300" },
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
        <MetricCard label="Templates" value={formatNumber(templates.length)} icon={FileStack} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Active" value={formatNumber(active)} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Draft" value={formatNumber(draft)} icon={FileEdit} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Approved" value={knownApprovals.length === templates.length ? formatNumber(approved) : UNAVAILABLE} icon={BadgeCheck} tone="bg-violet-100 text-violet-700" />
        <MetricCard label="Retired" value={formatNumber(retired)} icon={FileStack} tone="bg-slate-200 text-slate-700" />
        <MetricCard label="Programme Coverage" value={formatPercent(programmeCoverage)} icon={Network} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Assessment Volume" value={assessmentsSource.available ? formatNumber(assessments.length) : UNAVAILABLE} icon={ClipboardCheck} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Review Required" value={knownReviews.length === templates.length ? formatNumber(reviewsRequired) : UNAVAILABLE} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="Recently Updated" value={UNAVAILABLE} icon={RefreshCw} tone="bg-indigo-100 text-indigo-700" />
      </div>

      <Section
        title="Template Portfolio"
        description="Registry cards ordered by assessment usage, then latest recorded template update."
        action={<span className="text-xs font-semibold text-slate-500">{templates.length} template{templates.length === 1 ? "" : "s"}</span>}
      >
        {templates.length === 0 ? (
          <EmptyState
            title="No assessment templates available"
            description="Create the first governed assessment instrument before assigning assessments to programme beneficiaries."
            actionHref={canCreate ? `${ROUTE}/new` : undefined}
            actionLabel={canCreate ? "Create template" : undefined}
            icon={ClipboardCheck}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {registry.map((item) => {
              const content = (
                <article className="group h-full rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={item.template.status} />
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 ring-1 ring-blue-200">v{item.template.version}</span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-[#0c1733] group-hover:text-blue-700">{item.template.name}</h3>
                      <p className="mt-1 text-[11px] text-slate-500">{display(item.template.assessment_type)}</p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700">
                      <BookOpenCheck className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{item.template.description ?? UNAVAILABLE}</p>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 text-xs">
                    <div><p className="text-[10px] text-slate-500">Usage count</p><p className="mt-1 font-bold text-slate-900">{assessmentsSource.available ? formatNumber(item.assessments.length) : UNAVAILABLE}</p></div>
                    <div><p className="text-[10px] text-slate-500">Programmes</p><p className="mt-1 font-bold text-slate-900">{assessmentsSource.available ? formatNumber(item.programmeNames.length) : UNAVAILABLE}</p></div>
                    <div className="col-span-2"><p className="text-[10px] text-slate-500">Programme use</p><p className="mt-1 truncate font-semibold text-slate-700">{assessmentsSource.available ? (item.programmeNames.join(", ") || UNAVAILABLE) : UNAVAILABLE}</p></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500">Last updated</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-700">{formatDate(item.template.updated_at)}</p>
                    </div>
                    {canOpenTemplate && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">Open framework <ArrowRight className="h-3 w-3" /></span>}
                  </div>
                </article>
              );
              return canOpenTemplate
                ? <Link key={item.template.id} href={`${ROUTE}/${item.template.id}`}>{content}</Link>
                : <div key={item.template.id}>{content}</div>;
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Template Health Centre" description="Usage and lifecycle signals available from current template and scoped assessment records.">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Active usage", value: assessmentsSource.available ? formatNumber(registry.filter((item) => item.template.status === "active" && item.assessments.length > 0).length) : UNAVAILABLE, icon: Activity, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Stale templates", value: UNAVAILABLE, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
              { label: "Retired templates", value: formatNumber(retired), icon: FileStack, tone: "bg-slate-100 text-slate-700" },
              { label: "Review needed", value: knownReviews.length === templates.length ? formatNumber(reviewsRequired) : UNAVAILABLE, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-slate-200 p-4">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", item.tone)}><Icon className="h-4 w-4" /></span>
                  <p className="mt-4 text-xl font-bold text-[#0c1733]">{item.value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[10px] leading-5 text-slate-400">Staleness remains unavailable because no governed review interval or stale threshold exists in the current template data.</p>
        </Section>

        <Section title="Governance Centre" description="Approval, version, ownership, and review readiness shown only where recorded on the template.">
          <div className="space-y-3">
            {registry.slice(0, 6).map((item) => (
              <div key={item.template.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1.2fr_repeat(4,.75fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">{item.template.name}</p>
                  <p className="mt-1 text-[10px] text-slate-500">v{item.template.version}</p>
                </div>
                <div><p className="text-[9px] uppercase text-slate-400">Approval</p><p className="mt-1 text-[10px] font-semibold text-slate-700">{display(item.approvalStatus)}</p></div>
                <div><p className="text-[9px] uppercase text-slate-400">Version</p><p className="mt-1 text-[10px] font-semibold text-slate-700">{display(item.versionStatus)}</p></div>
                <div><p className="text-[9px] uppercase text-slate-400">Owner</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{item.owner ?? UNAVAILABLE}</p></div>
                <div><p className="text-[9px] uppercase text-slate-400">Review</p><p className="mt-1 text-[10px] font-semibold text-slate-700">{item.reviewRequired === null ? UNAVAILABLE : item.reviewRequired ? "Required" : "Ready"}</p></div>
              </div>
            ))}
            {registry.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">No template governance records are available.</p>}
          </div>
        </Section>
      </div>

      <Section title="Programme Coverage Centre" description="Template adoption derived from assessment records already constrained by the current programme scope.">
        {!assessmentsSource.available ? (
          <UnavailableState description="Assessment usage could not be loaded, so programme and cohort template coverage is unavailable." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <div className="mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-600" /><h3 className="text-xs font-bold text-slate-900">Templates by programme</h3></div>
              <DistributionBars items={templatesByProgramme} emptyText={scopeEmptyMessage ?? "No programme template usage is recorded in the current scope."} tone="bg-blue-500" />
            </div>
            <div className="border-slate-100 lg:border-l lg:pl-6">
              <div className="mb-4 flex items-center gap-2"><UsersRound className="h-4 w-4 text-violet-600" /><h3 className="text-xs font-bold text-slate-900">Templates by cohort</h3></div>
              <DistributionBars items={templatesByCohort} emptyText="No cohort template usage is recorded in the current scope." tone="bg-violet-500" />
            </div>
            <div className="border-slate-100 lg:border-l lg:pl-6">
              <div className="mb-4 flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-emerald-600" /><h3 className="text-xs font-bold text-slate-900">Assessment distribution</h3></div>
              <DistributionBars items={assessmentDistribution} emptyText="No assessments are linked to the available templates." tone="bg-emerald-500" />
            </div>
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Section title="Activity Timeline" description="Real template creation, update, approval, and retirement timestamps only.">
          {activity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">No timestamped template activity is available.</p>
          ) : (
            <div className="space-y-1">
              {activity.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link key={`${item.type}-${item.title}-${item.createdAt}-${index}`} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{item.type}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-800">{item.title}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-slate-500">{formatDate(item.createdAt)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Executive Summary" description="Current framework, coverage, and governance health without inferred policy thresholds.">
          <div className="space-y-3">
            {[
              { label: "Framework health", value: formatPercent(frameworkHealth), detail: `${active.toLocaleString("en-NG")} of ${templates.length.toLocaleString("en-NG")} templates active`, icon: Gauge, tone: "bg-emerald-50 text-emerald-700" },
              { label: "Coverage health", value: formatPercent(usageCoverage), detail: assessmentsSource.available ? `${usedTemplates.toLocaleString("en-NG")} templates currently used` : UNAVAILABLE, icon: Network, tone: "bg-blue-50 text-blue-700" },
              { label: "Governance health", value: formatPercent(governanceHealth), detail: governanceHealth === null ? "Approval status is not recorded for every template" : `${approved.toLocaleString("en-NG")} templates approved`, icon: ShieldCheck, tone: "bg-violet-50 text-violet-700" },
              { label: "Executive attention required", value: knownReviews.length === templates.length ? formatNumber(reviewsRequired) : UNAVAILABLE, detail: knownReviews.length === templates.length ? "Templates explicitly marked for review" : "Review readiness is not recorded for every template", icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800">{item.label}</p>
                    <p className="mt-1 truncate text-[10px] text-slate-500">{item.detail}</p>
                  </div>
                  <span className="text-sm font-bold text-[#0c1733]">{item.value}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl bg-[#0c1f46] p-4 text-blue-50">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">Registry note</p>
            <p className="mt-2 text-xs leading-5 text-blue-100/80">
              Usage reflects assessments visible to {roleLabel(ctx.role)}. Approval, ownership, version status, and review readiness depend on existing template metadata.
            </p>
          </div>
        </Section>
      </div>
    </section>
  );
}
