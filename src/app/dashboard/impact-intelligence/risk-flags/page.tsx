import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  FileWarning,
  Gauge,
  Layers3,
  Network,
  Plus,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import type { UserContext } from "@/lib/auth/authorization";
import {
  generateRiskFlags,
  listFieldVisits,
  listImpactInterventions,
  listImpactProgrammes,
  listIntelligenceFeed,
  resolveRiskFlag,
  type ImpactFieldVisit,
  type ImpactIntervention,
  type ImpactRiskFlag,
} from "@/lib/data/impact-intelligence";
import { listImpactEvidence, type ImpactEvidenceRecord } from "@/lib/data/impact-evidence";
import { listIndicatorMeasurements, type ImpactIndicatorMeasurement } from "@/lib/data/impact-indicators";
import { listInstitutionalReports, type InstitutionalReport } from "@/lib/data/impact-reports";
import { getProgrammeScopeEmptyMessage } from "@/lib/impact-intelligence/access-scope";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/risk-flags";
const UNAVAILABLE = "Unavailable";
const RISK_ROLES = ["admin", "super_admin", "boi_executive", "assessment_officer", "data_analyst", "auditor"];
const SCOPED_RISK_ROLES = new Set(["assessment_officer"]);

type Feed = Awaited<ReturnType<typeof listIntelligenceFeed>>;
type SourceState<T> = { data: T; available: boolean };
type HealthState = "Critical" | "At Risk" | "Watchlist" | "Healthy" | "Unavailable";
type RiskView = {
  risk: ImpactRiskFlag;
  category: string;
  programme: string;
  affectedArea: string;
  affectedResource: string;
  reportingImpact: string;
  executiveAction: string;
  recommendedAction: string;
  owner: string;
  escalatedAt: string | null;
  dueAt: string | null;
  linkedIntelligence: number;
  health: HealthState;
};

function redirectWithRiskError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Risk flag action could not be completed.";
  redirect(`${ROUTE}?error=${encodeURIComponent(message)}`);
}

async function generateRiskFlagsAction() {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await generateRiskFlags(ctx);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "risk_flag_generation_failed", error });
    if (
      !(error instanceof Error)
      || !["permission", "risk", "source", "unavailable"].some((message) => error.message.toLowerCase().includes(message))
    ) {
      throw error;
    }
    redirectWithRiskError(error);
  }
  redirect(ROUTE);
}

async function resolveRiskFlagAction(riskFlagId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await resolveRiskFlag(ctx, riskFlagId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "risk_flag_resolution_failed", error });
    if (
      !(error instanceof Error)
      || !["permission", "risk", "status", "resolution"].some((message) => error.message.toLowerCase().includes(message))
    ) {
      throw error;
    }
    redirectWithRiskError(error);
  }
  redirect(ROUTE);
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
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation, error });
    return sourceFallback(fallback);
  }
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

function severityRank(value: string | null | undefined) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[value?.toLowerCase() ?? ""] ?? 0;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function metadataId(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  return metadataString(metadata, keys);
}

function includesAny(value: string, terms: string[]) {
  const source = value.toLowerCase();
  return terms.some((term) => source.includes(term));
}

function categoryForRisk(risk: ImpactRiskFlag) {
  const source = `${risk.risk_type} ${risk.source_key}`;
  if (includesAny(source, ["evidence", "verification", "documentation"])) return "Evidence Risk";
  if (includesAny(source, ["indicator", "outcome", "measurement"])) return "Indicator Risk";
  if (includesAny(source, ["monitoring", "field_visit", "field-visit"])) return "Monitoring Risk";
  if (includesAny(source, ["assessment", "readiness", "score"])) return "Assessment Risk";
  if (includesAny(source, ["report", "reporting"])) return "Reporting Risk";
  if (includesAny(source, ["governance", "compliance", "approval"])) return "Governance Risk";
  if (includesAny(source, ["programme", "intervention", "delivery", "operational"])) return "Programme Delivery Risk";
  return display(risk.risk_type);
}

function severityTone(severity: string, resolved = false) {
  if (resolved) return "border-emerald-200 bg-emerald-50/55 shadow-emerald-100/50";
  if (severity === "critical") return "border-rose-400 bg-rose-50/80 shadow-lg shadow-rose-100/70";
  if (severity === "high") return "border-orange-300 bg-orange-50/65 shadow-orange-100/50";
  if (severity === "medium") return "border-amber-200 bg-amber-50/45";
  return "border-slate-200 bg-slate-50/65";
}

function severityPill(severity: string) {
  if (severity === "critical") return "bg-rose-600 text-white ring-rose-600";
  if (severity === "high") return "bg-orange-100 text-orange-800 ring-orange-200";
  if (severity === "medium") return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function healthTone(health: HealthState) {
  if (health === "Critical") return "bg-rose-600 text-white ring-rose-600";
  if (health === "At Risk") return "bg-orange-50 text-orange-700 ring-orange-200";
  if (health === "Watchlist") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (health === "Healthy") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function deriveHealth(risk: ImpactRiskFlag): HealthState {
  if (risk.status === "resolved") return "Healthy";
  if (risk.status !== "open") return "Unavailable";
  if (risk.severity === "critical") return "Critical";
  if (risk.severity === "high") return "At Risk";
  if (risk.severity === "medium") return "Watchlist";
  return "Healthy";
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = key(item)?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
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
          <h2 className="text-sm font-bold text-[#0c1733]">{title}</h2>
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
  icon: typeof Gauge;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-bold tracking-tight text-[#0c1733]">{value}</p>
        </div>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

function UnavailableState({ message = UNAVAILABLE }: { message?: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">{message}</p>;
}

function DistributionBars({
  items,
  tone = "bg-rose-500",
}: {
  items: Array<{ label: string; value: number }>;
  tone?: string;
}) {
  if (items.length === 0) return <UnavailableState />;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
            <span className="truncate font-semibold text-slate-600">{display(item.label)}</span>
            <span className="font-bold text-slate-900">{item.value.toLocaleString("en-NG")}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function RiskFlagsPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const query = (await searchParams) ?? {};
  let ctx: UserContext | null = null;
  let programmesSource = sourceFallback<Awaited<ReturnType<typeof listImpactProgrammes>>>([]);

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    if (
      !RISK_ROLES.includes(currentContext.role)
      || !canRole(currentContext.role, "risk_flag", "read")
      || !canAccessRoute(currentContext.role, ROUTE)
    ) {
      redirect("/access-denied");
    }
    programmesSource = await loadSource(
      currentContext,
      "risk_programmes_load_failed",
      () => listImpactProgrammes(currentContext, { limit: 1000 }),
      [],
    );
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "risk_context_load_failed", error });
  }

  if (!ctx) {
    return (
      <Section title="Risk Command Centre Unavailable">
        <EmptyState
          title="Risk governance could not load"
          description="The current session or canonical risk access policy is temporarily unavailable."
          icon={ShieldAlert}
        />
      </Section>
    );
  }

  const canReadIntelligence = canRole(ctx.role, "intelligence", "read");
  const canReadEvidence = canRole(ctx.role, "evidence", "read");
  const canReadIndicators = canRole(ctx.role, "indicator", "read");
  const canReadReports = canRole(ctx.role, "report", "read");
  const canReadMonitoring = canRole(ctx.role, "monitoring_visit", "read");
  const canReadInterventions = canRole(ctx.role, "intervention", "read");

  const [feedSource, evidenceSource, indicatorsSource, reportsSource, visitsSource, interventionsSource] = await Promise.all([
    canReadIntelligence
      ? loadSource(ctx, "risk_feed_load_failed", () => listIntelligenceFeed(ctx as UserContext, { limit: 500 }), null)
      : Promise.resolve(sourceFallback<Feed | null>(null)),
    canReadEvidence
      ? loadSource(ctx, "risk_evidence_load_failed", () => listImpactEvidence(ctx as UserContext, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactEvidenceRecord[]>([])),
    canReadIndicators
      ? loadSource(ctx, "risk_indicators_load_failed", () => listIndicatorMeasurements(ctx as UserContext, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactIndicatorMeasurement[]>([])),
    canReadReports
      ? loadSource(ctx, "risk_reports_load_failed", () => listInstitutionalReports(ctx as UserContext, 5000), [])
      : Promise.resolve(sourceFallback<InstitutionalReport[]>([])),
    canReadMonitoring
      ? loadSource(ctx, "risk_monitoring_load_failed", () => listFieldVisits(ctx as UserContext, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactFieldVisit[]>([])),
    canReadInterventions
      ? loadSource(ctx, "risk_interventions_load_failed", () => listImpactInterventions(ctx as UserContext, { limit: 5000 }), [])
      : Promise.resolve(sourceFallback<ImpactIntervention[]>([])),
  ]);

  if (!feedSource.available || !feedSource.data) {
    return (
      <Section title="Risk Command Centre Unavailable">
        <EmptyState
          title="Risk flags could not load"
          description="The risk source or assigned programme scope is temporarily unavailable. No risk metrics are being inferred."
          icon={ShieldAlert}
        />
      </Section>
    );
  }

  const scopedRole = SCOPED_RISK_ROLES.has(ctx.role);
  if (scopedRole && !programmesSource.available) {
    return (
      <Section title="Risk Command Centre Unavailable">
        <EmptyState
          title="Assigned programme scope could not load"
          description="Risk records are withheld because the canonical programme assignment scope is temporarily unavailable."
          icon={ShieldAlert}
        />
      </Section>
    );
  }

  const visibleProgrammeIds = new Set(programmesSource.data.map((programme) => programme.id));
  const risks = feedSource.data.riskFlags
    .filter((risk) => !scopedRole || Boolean(risk.programme_id && visibleProgrammeIds.has(risk.programme_id)))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.detected_at.localeCompare(a.detected_at));
  const insights = feedSource.data.insights.filter(
    (insight) => !scopedRole || Boolean(insight.programme_id && visibleProgrammeIds.has(insight.programme_id)),
  );
  const evidenceById = new Map(evidenceSource.data.map((item) => [item.id, item]));
  const indicatorById = new Map(indicatorsSource.data.map((item) => [item.id, item]));
  const reportById = new Map(reportsSource.data.map((item) => [item.id, item]));
  const visitById = new Map(visitsSource.data.map((item) => [item.id, item]));
  const interventionById = new Map(interventionsSource.data.map((item) => [item.id, item]));
  const insightIds = new Set(insights.map((item) => item.id));
  const insightSourceKeys = new Set(insights.map((item) => item.source_key));

  const riskViews: RiskView[] = risks.map((risk) => {
    const evidenceId = metadataId(risk.metadata, ["evidence_id"]);
    const indicatorId = metadataId(risk.metadata, ["indicator_measurement_id", "indicator_id"]);
    const visitId = metadataId(risk.metadata, ["field_visit_id", "monitoring_visit_id"]);
    const insightId = metadataId(risk.metadata, ["insight_id", "intelligence_id"]);
    const evidence = evidenceId ? evidenceById.get(evidenceId) : null;
    const indicator = indicatorId ? indicatorById.get(indicatorId) : null;
    const report = risk.report_id ? reportById.get(risk.report_id) : null;
    const visit = visitId ? visitById.get(visitId) : null;
    const intervention = risk.intervention_id ? interventionById.get(risk.intervention_id) : null;
    const linkedIntelligence = Number(Boolean(
      (insightId && insightIds.has(insightId))
      || insightSourceKeys.has(risk.source_key),
    ));
    const category = categoryForRisk(risk);
    const affectedResource = evidence
      ? evidence.original_filename ?? evidence.file_name
      : indicator
        ? indicator.impact_indicator_definitions?.name ?? "Indicator measurement"
        : report
          ? report.title
          : visit
            ? visit.title ?? "Monitoring visit"
            : intervention
              ? intervention.title
              : risk.assessment_id
                ? "Assessment record"
                : risk.msmes?.business_name ?? UNAVAILABLE;
    const affectedArea = evidence
      ? "Evidence"
      : indicator
        ? "Indicator"
        : report
          ? "Report"
          : visit
            ? "Monitoring"
            : risk.assessment_id
              ? "Assessment"
              : intervention
                ? "Intervention"
                : risk.programme_id
                  ? "Programme"
                  : UNAVAILABLE;
    return {
      risk,
      category,
      programme: risk.impact_programmes?.name ?? UNAVAILABLE,
      affectedArea,
      affectedResource,
      reportingImpact: risk.report_id ? `Blocks linked report: ${report?.title ?? UNAVAILABLE}` : UNAVAILABLE,
      executiveAction: risk.status === "open" && severityRank(risk.severity) >= 3 ? "Required" : UNAVAILABLE,
      recommendedAction: metadataString(risk.metadata, ["recommended_action", "next_action", "recommendation"]) ?? UNAVAILABLE,
      owner: metadataString(risk.metadata, ["owner_name", "owner", "assigned_to"]) ?? UNAVAILABLE,
      escalatedAt: metadataString(risk.metadata, ["escalated_at", "escalation_date"]),
      dueAt: metadataString(risk.metadata, ["due_at", "due_date", "deadline"]),
      linkedIntelligence,
      health: deriveHealth(risk),
    };
  });

  const openRisks = riskViews.filter((item) => item.risk.status === "open");
  const resolvedRisks = riskViews.filter((item) => item.risk.status === "resolved");
  const criticalRisks = openRisks.filter((item) => item.risk.severity === "critical");
  const highRisks = openRisks.filter((item) => item.risk.severity === "high");
  const executiveAttention = openRisks.filter((item) => severityRank(item.risk.severity) >= 3);
  const programmesExposed = new Set(openRisks.map((item) => item.risk.programme_id).filter(Boolean)).size;
  const reportsBlocked = openRisks.filter((item) => Boolean(item.risk.report_id)).length;
  const categories = countBy(riskViews, (item) => item.category);
  const recurringPatterns = countBy(riskViews, (item) => item.risk.risk_type).filter((item) => item.value > 1);
  const escalatedRisks = openRisks.filter((item) => Boolean(item.escalatedAt));
  const overdueRisks = openRisks.filter((item) => {
    if (!item.dueAt) return false;
    const due = new Date(item.dueAt);
    return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
  });
  const linkedIntelligenceRisks = riskViews.filter((item) => item.linkedIntelligence > 0);
  const evidenceRisks = riskViews.filter((item) => item.affectedArea === "Evidence");
  const indicatorRisks = riskViews.filter((item) => item.affectedArea === "Indicator");
  const reportingRisks = riskViews.filter((item) => item.affectedArea === "Report");
  const monitoringRisks = riskViews.filter((item) => item.affectedArea === "Monitoring");
  const recentlyResolved = [...resolvedRisks]
    .filter((item) => item.risk.resolved_at)
    .sort((a, b) => (b.risk.resolved_at ?? "").localeCompare(a.risk.resolved_at ?? ""))
    .slice(0, 5);

  const programmeExposure = programmesSource.data
    .map((programme) => {
      const programmeRisks = openRisks.filter((item) => item.risk.programme_id === programme.id);
      const interventionIds = new Set(programmeRisks.map((item) => item.risk.intervention_id).filter(Boolean));
      const cohortIds = new Set(
        [...interventionIds]
          .map((id) => interventionById.get(id as string)?.cohort_id)
          .filter(Boolean),
      );
      return {
        programme,
        count: programmeRisks.length,
        score: programmeRisks.reduce((sum, item) => sum + severityRank(item.risk.severity), 0),
        cohorts: cohortIds.size,
        interventions: interventionIds.size,
        highest: [...programmeRisks].sort(
          (a, b) => severityRank(b.risk.severity) - severityRank(a.risk.severity),
        )[0]?.risk.severity ?? null,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.score - a.score || b.count - a.count || a.programme.name.localeCompare(b.programme.name));

  const freshness = latestDate([
    ...risks.map((item) => item.resolved_at ?? item.detected_at),
    ...insights.map((item) => item.generated_at),
  ]);
  const canGenerate = canRole(ctx.role, "risk_flag", "create");
  const canResolve = canRole(ctx.role, "risk_flag", "update");
  const canViewIntelligence = canReadIntelligence
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/intelligence");
  const canViewAnalytics = canRole(ctx.role, "analytics", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/analytics");
  const canViewReports = canReadReports
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/reports");
  const scopeEmptyMessage = getProgrammeScopeEmptyMessage(ctx);
  const portfolioSignal = openRisks.length === 0
    ? riskViews.length > 0 ? "No open risks" : UNAVAILABLE
    : criticalRisks.length > 0
      ? "Critical"
      : highRisks.length > 0
        ? "Elevated"
        : "Watchlist";
  const portfolioHealth: HealthState = criticalRisks.length > 0
    ? "Critical"
    : highRisks.length > 0
      ? "At Risk"
      : openRisks.length > 0
        ? "Watchlist"
        : riskViews.length > 0
          ? "Healthy"
          : "Unavailable";

  return (
    <section className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_78%_24%,rgba(220,38,38,0.42),transparent_30%),linear-gradient(120deg,#050f24_0%,#0a224d_55%,#07162f_100%)] p-5 text-white shadow-2xl shadow-blue-950/15 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 360" className="h-full w-full">
            <defs>
              <pattern id="risk-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#fda4af" />
              </pattern>
            </defs>
            <path d="M510 32 615 18l82 39 67 3 55 63-47 48 8 58-94 16-70-35-75 16-53-62 25-59Z" fill="url(#risk-hero-dots)" stroke="#fb7185" strokeOpacity=".55" />
            <path d="M410 300c105-80 160-150 245-96s112 9 184-96" fill="none" stroke="#f97316" strokeOpacity=".55" />
            <circle cx="646" cy="150" r="5" fill="#fb7185" />
            <circle cx="713" cy="156" r="4" fill="#fbbf24" />
            <circle cx="797" cy="78" r="4" fill="#34d399" />
          </svg>
        </div>
        <div className="relative">
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200/70">
            <Link href="/dashboard/impact-intelligence" className="hover:text-white">Impact Intelligence</Link>
            <span>/</span>
            <span className="text-rose-300">Risk Command Centre</span>
          </nav>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">BOI enterprise impact risk governance</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">Enterprise Impact Risk Command Centre</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/75">Board-level oversight of existing portfolio risks, exposure, assurance impact, escalation, and resolution across governed programme scope.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canGenerate && (
                <form action={generateRiskFlagsAction}>
                  <Button type="submit" className="h-10 gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#0c1f46] hover:bg-blue-50">
                    <Plus className="h-4 w-4" /> Create Risk Flag
                  </Button>
                </form>
              )}
              {canViewIntelligence && <Link href="/dashboard/impact-intelligence/intelligence" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"><Radar className="h-4 w-4" /> Open Intelligence</Link>}
              {canViewAnalytics && <Link href="/dashboard/impact-intelligence/analytics" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"><BarChart3 className="h-4 w-4" /> Open Analytics</Link>}
              {canViewReports && <Link href="/dashboard/impact-intelligence/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"><FileText className="h-4 w-4" /> Open Reports</Link>}
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { label: "Total risk flags", value: riskViews.length, icon: ShieldAlert, color: "text-cyan-300" },
              { label: "Critical risks", value: criticalRisks.length, icon: AlertOctagon, color: "text-rose-300" },
              { label: "High risks", value: highRisks.length, icon: AlertTriangle, color: "text-orange-300" },
              { label: "Open risks", value: openRisks.length, icon: Activity, color: "text-amber-300" },
              { label: "Resolved risks", value: resolvedRisks.length, icon: BadgeCheck, color: "text-emerald-300" },
              { label: "Executive attention", value: executiveAttention.length, icon: TrendingUp, color: "text-rose-300" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="bg-[#081b3d]/80 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10"><Icon className={cn("h-4 w-4", item.color)} /></span>
                    <div><p className="text-lg font-bold">{item.value.toLocaleString("en-NG")}</p><p className="text-[9px] font-medium text-blue-100/65">{item.label}</p></div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] text-blue-100/70">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5"><CircleDot className="mr-1.5 inline h-3 w-3 text-emerald-300" />Freshness: {formatFreshness(freshness)}</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5"><Radar className="mr-1.5 inline h-3 w-3 text-rose-300" />Portfolio risk signal: {portfolioSignal}</span>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-bold text-emerald-200">{display(ctx.role)} · {canResolve ? "Managed access" : "Read only"}</span>
          </div>
        </div>
      </section>

      {query.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
        <MetricCard label="Total Risks" value={riskViews.length.toLocaleString("en-NG")} icon={ShieldAlert} tone="bg-slate-100 text-slate-700" />
        <MetricCard label="Open" value={openRisks.length.toLocaleString("en-NG")} icon={Activity} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Critical" value={criticalRisks.length.toLocaleString("en-NG")} icon={AlertOctagon} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="High" value={highRisks.length.toLocaleString("en-NG")} icon={AlertTriangle} tone="bg-orange-100 text-orange-700" />
        <MetricCard label="Medium" value={openRisks.filter((item) => item.risk.severity === "medium").length.toLocaleString("en-NG")} icon={Gauge} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Low" value={openRisks.filter((item) => item.risk.severity === "low").length.toLocaleString("en-NG")} icon={ShieldCheck} tone="bg-slate-100 text-slate-600" />
        <MetricCard label="Resolved" value={resolvedRisks.length.toLocaleString("en-NG")} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Programmes Exposed" value={programmesExposed.toLocaleString("en-NG")} icon={Building2} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Reports Blocked" value={reportsBlocked.toLocaleString("en-NG")} icon={FileWarning} tone="bg-red-100 text-red-700" />
      </div>

      <Section title="Risk Severity Heatmap" description="Open risks grouped by stored severity, with the highest-ranked records shown first.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { severity: "critical", tone: "border-rose-300 bg-rose-50", accent: "text-rose-700" },
            { severity: "high", tone: "border-orange-200 bg-orange-50", accent: "text-orange-700" },
            { severity: "medium", tone: "border-amber-200 bg-amber-50", accent: "text-amber-700" },
            { severity: "low", tone: "border-slate-200 bg-slate-50", accent: "text-slate-700" },
          ].map((group) => {
            const items = openRisks.filter((item) => item.risk.severity === group.severity);
            return (
              <article key={group.severity} className={cn("rounded-2xl border p-4", group.tone)}>
                <div className="flex items-center justify-between">
                  <p className={cn("text-xs font-black uppercase tracking-[0.1em]", group.accent)}>{group.severity}</p>
                  <span className={cn("text-2xl font-bold", group.accent)}>{items.length}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {items.length === 0 ? <p className="text-[10px] text-slate-500">No open risks</p> : items.slice(0, 3).map((item) => (
                    <div key={item.risk.id} className="rounded-xl bg-white/80 p-3">
                      <p className="line-clamp-2 text-[11px] font-bold text-slate-800">{item.risk.title}</p>
                      <p className="mt-1 truncate text-[9px] text-slate-500">{item.programme} · {display(item.risk.status)}</p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <Section title="Portfolio Risk Exposure" description="Weighted exposure uses stored open-risk severity points: critical 4, high 3, medium 2, low 1.">
        {programmeExposure.length === 0 ? (
          <UnavailableState message={scopeEmptyMessage ?? "No programme-linked open risks are available."} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {programmeExposure.slice(0, 9).map((item, index) => (
              <article key={item.programme.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0c1f46] text-[10px] font-bold text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-xs font-bold text-[#0c1733]">{item.programme.name}</p><p className="mt-1 text-[9px] text-slate-500">{item.programme.programme_code ?? UNAVAILABLE}</p></div>
                      <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", severityPill(item.highest ?? "low"))}>{display(item.highest)}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-rose-50 p-2"><p className="text-sm font-bold text-rose-700">{item.score}</p><p className="text-[8px] text-rose-600">Exposure</p></div>
                      <div className="rounded-lg bg-slate-50 p-2"><p className="text-sm font-bold">{item.count}</p><p className="text-[8px] text-slate-500">Open risks</p></div>
                      <div className="rounded-lg bg-slate-50 p-2"><p className="text-sm font-bold">{item.interventions}</p><p className="text-[8px] text-slate-500">Interventions</p></div>
                      <div className="rounded-lg bg-slate-50 p-2"><p className="text-sm font-bold">{item.cohorts}</p><p className="text-[8px] text-slate-500">Cohorts</p></div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Executive Risk Register"
        description="Primary risk register from existing risk flags. Missing ownership, action, or relationship fields remain unavailable."
        action={<span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{riskViews.length} risks</span>}
      >
        {riskViews.length === 0 ? (
          <EmptyState title="No risk flags available" description="No existing risk flags are visible in the current governed programme scope." icon={ShieldAlert} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {riskViews.map((item) => {
              const resolve = resolveRiskFlagAction.bind(null, item.risk.id);
              const resolved = item.risk.status === "resolved";
              return (
                <article key={item.risk.id} className={cn("rounded-2xl border p-4", severityTone(item.risk.severity, resolved))}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        {item.risk.severity === "critical" && !resolved && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-rose-700"><AlertOctagon className="h-3 w-3" /> Executive alert</span>}
                        {resolved && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700"><BadgeCheck className="h-3 w-3" /> Resolved</span>}
                        {item.risk.report_id && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-red-700"><FileWarning className="h-3 w-3" /> Report impact</span>}
                        {["Evidence", "Indicator"].includes(item.affectedArea) && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-amber-700"><ShieldAlert className="h-3 w-3" /> Assurance warning</span>}
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-[#0c1733]">{item.risk.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{item.risk.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", severityPill(item.risk.severity))}>{display(item.risk.severity)}</span>
                      <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", healthTone(item.health))}>{item.health}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-200/70 py-3 text-[10px] sm:grid-cols-4">
                    <div><p className="font-semibold text-slate-400">Category</p><p className="mt-1 font-bold text-slate-700">{item.category}</p></div>
                    <div><p className="font-semibold text-slate-400">Programme</p><p className="mt-1 font-bold text-slate-700">{item.programme}</p></div>
                    <div><p className="font-semibold text-slate-400">Affected resource</p><p className="mt-1 font-bold text-slate-700">{item.affectedResource}</p></div>
                    <div><p className="font-semibold text-slate-400">Status</p><p className="mt-1 font-bold text-slate-700">{display(item.risk.status)}</p></div>
                    <div><p className="font-semibold text-slate-400">Created</p><p className="mt-1 font-bold text-slate-700">{formatDate(item.risk.detected_at)}</p></div>
                    <div><p className="font-semibold text-slate-400">Owner</p><p className="mt-1 font-bold text-slate-700">{item.owner}</p></div>
                    <div><p className="font-semibold text-slate-400">Next action</p><p className="mt-1 font-bold text-slate-700">{item.recommendedAction}</p></div>
                    <div><p className="font-semibold text-slate-400">Reporting impact</p><p className="mt-1 font-bold text-slate-700">{item.reportingImpact}</p></div>
                  </div>
                  {resolved && item.risk.resolution_note && <div className="mt-3 rounded-xl border border-emerald-200 bg-white/70 p-3 text-[11px] text-emerald-800"><span className="font-bold">Resolution:</span> {item.risk.resolution_note}</div>}
                  {canResolve && item.risk.status === "open" && (
                    <form action={resolve} className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input name="resolution_note" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Resolution note" />
                      <Button type="submit" variant="secondary" className="gap-2 rounded-xl"><ShieldCheck className="h-4 w-4" /> Resolve</Button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Risk Categories Centre" description="Distribution across existing stored risk types, grouped into executive risk domains.">
          <DistributionBars items={categories} tone="bg-rose-500" />
        </Section>
        <Section title="Evidence & Reporting Risk Centre" description="Only explicit source relationships are counted. Unavailable sources are not inferred.">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Evidence risks", value: evidenceSource.available ? evidenceRisks.length : null, icon: ShieldAlert, tone: "bg-amber-100 text-amber-700" },
              { label: "Indicator risks", value: indicatorsSource.available ? indicatorRisks.length : null, icon: Target, tone: "bg-blue-100 text-blue-700" },
              { label: "Report risks", value: reportsSource.available ? reportingRisks.length : null, icon: FileWarning, tone: "bg-rose-100 text-rose-700" },
              { label: "Monitoring risks", value: visitsSource.available ? monitoringRisks.length : null, icon: Activity, tone: "bg-violet-100 text-violet-700" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span>
                  <p className="mt-4 text-2xl font-bold text-[#0c1733]">{item.value === null ? UNAVAILABLE : item.value.toLocaleString("en-NG")}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p>
                </article>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Section title="Escalation & Resolution Centre" description="Escalation and overdue states appear only where stored metadata dates exist.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Escalated", value: escalatedRisks.length, tone: "text-rose-700" },
              { label: "Unresolved high", value: executiveAttention.length, tone: "text-orange-700" },
              { label: "Overdue", value: overdueRisks.length, tone: "text-amber-700" },
              { label: "Recently resolved", value: recentlyResolved.length, tone: "text-emerald-700" },
              { label: "Executive action", value: executiveAttention.length, tone: "text-red-700" },
            ].map((item) => (
              <article key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className={cn("text-xl font-bold", item.tone)}>{item.value}</p>
                <p className="mt-1 text-[9px] font-semibold text-slate-500">{item.label}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {recentlyResolved.length === 0 ? <UnavailableState message="No resolved risk timestamp is available." /> : recentlyResolved.map((item) => (
              <article key={item.risk.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/45 p-3">
                <div><p className="text-[11px] font-bold text-slate-800">{item.risk.title}</p><p className="mt-1 text-[9px] text-slate-500">{item.programme}</p></div>
                <span className="text-[9px] font-bold text-emerald-700">{formatDate(item.risk.resolved_at)}</span>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Intelligence Linkage" description="Direct metadata IDs or exact source-key links only; programme proximity is not treated as linkage.">
          <div className="grid grid-cols-2 gap-3">
            <article className="rounded-2xl bg-[#0c1f46] p-4 text-white"><Network className="h-5 w-5 text-cyan-300" /><p className="mt-5 text-3xl font-bold">{linkedIntelligenceRisks.length}</p><p className="mt-1 text-[9px] font-bold uppercase text-blue-100">Linked risk flags</p></article>
            <article className="rounded-2xl bg-rose-600 p-4 text-white"><Layers3 className="h-5 w-5 text-rose-100" /><p className="mt-5 text-3xl font-bold">{recurringPatterns.length || UNAVAILABLE}</p><p className="mt-1 text-[9px] font-bold uppercase text-rose-100">Recurring patterns</p></article>
          </div>
          <div className="mt-4">
            <DistributionBars items={recurringPatterns.slice(0, 6)} tone="bg-indigo-500" />
          </div>
        </Section>
      </div>

      <Section title="Risk Health Matrix" description="Executive scanning view. Missing relationships and actions remain unavailable.">
        {riskViews.length === 0 ? <UnavailableState /> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1180px] text-left text-[10px]">
              <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  {["Risk", "Programme", "Category", "Severity", "Status", "Affected Area", "Reporting Impact", "Executive Action", "Health"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {riskViews.map((item) => (
                  <tr key={item.risk.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="max-w-64 px-3 py-3 font-bold text-slate-800">{item.risk.title}</td>
                    <td className="px-3 py-3 text-slate-600">{item.programme}</td>
                    <td className="px-3 py-3 text-slate-600">{item.category}</td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-1 font-bold ring-1", severityPill(item.risk.severity))}>{display(item.risk.severity)}</span></td>
                    <td className="px-3 py-3 text-slate-600">{display(item.risk.status)}</td>
                    <td className="px-3 py-3 text-slate-600">{item.affectedArea}</td>
                    <td className="max-w-64 px-3 py-3 text-slate-600">{item.reportingImpact}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{item.executiveAction}</td>
                    <td className="px-3 py-3"><span className={cn("rounded-full px-2 py-1 font-bold ring-1", healthTone(item.health))}>{item.health}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Risk Activity Timeline" description="Real detected and resolved timestamps only. Escalation appears only when an explicit stored date exists.">
        {riskViews.length === 0 ? <UnavailableState /> : (
          <div className="grid gap-x-6 gap-y-1 lg:grid-cols-2">
            {riskViews.flatMap((item) => {
              const events = [{
                id: `${item.risk.id}-created`,
                title: "Risk created",
                detail: item.risk.title,
                date: item.risk.detected_at,
                tone: "bg-rose-500",
              }];
              if (item.escalatedAt) events.push({ id: `${item.risk.id}-escalated`, title: "Risk escalated", detail: item.risk.title, date: item.escalatedAt, tone: "bg-orange-500" });
              if (item.risk.resolved_at) events.push({ id: `${item.risk.id}-resolved`, title: "Risk resolved", detail: item.risk.title, date: item.risk.resolved_at, tone: "bg-emerald-500" });
              return events;
            }).filter((item) => !Number.isNaN(new Date(item.date).getTime())).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 16).map((item) => (
              <div key={item.id} className="flex gap-3 border-l border-slate-200 pb-5 pl-5">
                <span className={cn("-ml-[1.65rem] mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-white", item.tone)} />
                <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{formatDate(item.date)} · {item.title}</p><p className="mt-1 truncate text-xs font-bold text-slate-700">{item.detail}</p></div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <section className="overflow-hidden rounded-3xl bg-[#071a3c] text-white shadow-xl shadow-blue-950/10">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">Executive risk summary</p>
          <h2 className="mt-2 text-xl font-bold">Leadership attention from the current governed risk register</h2>
          <p className="mt-1 text-xs text-blue-100/65">Health states are deterministic from stored status, severity, category, and direct source relationships.</p>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Portfolio Risk Health", value: portfolioHealth, detail: `${openRisks.length} open risk${openRisks.length === 1 ? "" : "s"}`, tone: "text-rose-300" },
            { label: "Evidence Risk Health", value: evidenceSource.available ? evidenceRisks.filter((item) => item.risk.status === "open").length === 0 ? "Healthy" : "Watchlist" : "Unavailable", detail: evidenceSource.available ? `${evidenceRisks.length} linked risk${evidenceRisks.length === 1 ? "" : "s"}` : UNAVAILABLE, tone: "text-amber-300" },
            { label: "Reporting Risk Health", value: reportsSource.available ? reportsBlocked === 0 ? "Healthy" : "At Risk" : "Unavailable", detail: reportsSource.available ? `${reportsBlocked} linked report${reportsBlocked === 1 ? "" : "s"} blocked` : UNAVAILABLE, tone: "text-orange-300" },
            { label: "Governance Risk Health", value: categories.some((item) => item.label === "Governance Risk") ? "Watchlist" : riskViews.length > 0 ? "Healthy" : "Unavailable", detail: categories.find((item) => item.label === "Governance Risk") ? `${categories.find((item) => item.label === "Governance Risk")?.value} governance risk flags` : UNAVAILABLE, tone: "text-cyan-300" },
            { label: "Executive Attention Required", value: executiveAttention.length.toLocaleString("en-NG"), detail: executiveAttention[0]?.risk.title ?? UNAVAILABLE, tone: "text-rose-300" },
          ].map((item) => (
            <article key={item.label} className="bg-[#0a2048] p-5">
              <p className={cn("text-[9px] font-black uppercase tracking-[0.1em]", item.tone)}>{item.label}</p>
              <p className="mt-3 text-sm font-bold">{item.value}</p>
              <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-blue-100/65">{item.detail}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-[10px] text-blue-100/60">
          <span><Clock3 className="mr-1.5 inline h-3 w-3" />Risk register freshness: {formatFreshness(freshness)}</span>
          <span>{display(ctx.role)} · Governed programme scope</span>
        </div>
      </section>
    </section>
  );
}
