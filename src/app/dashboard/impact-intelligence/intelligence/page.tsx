import Link from "next/link";
import type { ReactNode } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  Building2,
  CheckCircle2,
  CircleDot,
  Clock3,
  Gauge,
  Globe2,
  Lightbulb,
  MapPinned,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  listIntelligenceFeed,
  dismissInsight,
  type ImpactAiInsight,
  type ImpactAiRecommendation,
  type ImpactIntelligenceSummary,
  type ImpactRiskFlag,
} from "@/lib/data/impact-intelligence";
import { canAccessRoute, canRole } from "@/lib/impact-intelligence/permissions";
import { cn } from "@/lib/utils";
import { EmptyState, UnavailableState as StandardUnavailableState } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const ROUTE = "/dashboard/impact-intelligence/intelligence";
const UNAVAILABLE = "Unavailable";
const INTELLIGENCE_ROLES = ["admin", "super_admin", "boi_executive", "assessment_officer", "data_analyst", "auditor"];

type Feed = Awaited<ReturnType<typeof listIntelligenceFeed>>;
type ProgrammeRanking = {
  id: string;
  name: string;
  total: number;
  opportunities: number;
  concerns: number;
};
type TimelineItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  tone: string;
  href?: string;
};

const STATE_REGIONS: Record<string, string> = {
  abia: "South East",
  adamawa: "North East",
  "akwa ibom": "South South",
  anambra: "South East",
  bauchi: "North East",
  bayelsa: "South South",
  benue: "North Central",
  borno: "North East",
  "cross river": "South South",
  delta: "South South",
  ebonyi: "South East",
  edo: "South South",
  ekiti: "South West",
  enugu: "South East",
  fct: "North Central",
  "abuja (fct)": "North Central",
  gombe: "North East",
  imo: "South East",
  jigawa: "North West",
  kaduna: "North West",
  kano: "North West",
  katsina: "North West",
  kebbi: "North West",
  kogi: "North Central",
  kwara: "North Central",
  lagos: "South West",
  nasarawa: "North Central",
  niger: "North Central",
  ogun: "South West",
  ondo: "South West",
  osun: "South West",
  oyo: "South West",
  plateau: "North Central",
  rivers: "South South",
  sokoto: "North West",
  taraba: "North East",
  yobe: "North East",
  zamfara: "North West",
};

async function dismissInsightAction(insightId: string) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await dismissInsight(ctx, insightId);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "insight_dismiss_failed", error });
    if (!(error instanceof Error) || !["permission", "insight", "status"].some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirect(`${ROUTE}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(ROUTE);
}

function display(value: string | null | undefined) {
  return value?.trim()
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : UNAVAILABLE;
}

function roleLabel(role: string) {
  return display(role);
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

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const values = new Map<string, number>();
  for (const item of items) {
    const label = key(item)?.trim();
    if (!label) continue;
    values.set(label, (values.get(label) ?? 0) + 1);
  }
  return [...values.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function includesAny(value: string, terms: string[]) {
  const source = value.toLowerCase();
  return terms.some((term) => source.includes(term));
}

function isOpportunityInsight(item: ImpactAiInsight) {
  return item.category === "recommendation"
    || includesAny(`${item.title} ${item.summary} ${item.source_key}`, ["opportunity", "scale", "growth"]);
}

function isOutcomeInsight(item: ImpactAiInsight) {
  return includesAny(`${item.category} ${item.insight_type} ${item.title} ${item.summary} ${item.source_key}`, ["outcome", "indicator", "result"]);
}

function isConcernInsight(item: ImpactAiInsight) {
  return item.category === "risk"
    || item.category === "anomaly"
    || (item.status === "open" && severityRank(item.priority) >= 3);
}

function regionForState(state: string) {
  return STATE_REGIONS[state.trim().toLowerCase()] ?? null;
}

function metadataText(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function insightTone(priority: string, status: string, opportunity: boolean) {
  if (status === "resolved") return "border-emerald-200 bg-emerald-50/45";
  if (priority === "critical") return "border-rose-300 bg-rose-50/70 shadow-rose-100/60";
  if (priority === "high") return "border-amber-200 bg-amber-50/50";
  if (opportunity) return "border-violet-200 bg-violet-50/55";
  return "border-slate-200 bg-white";
}

function priorityPill(priority: string) {
  if (priority === "critical") return "bg-rose-600 text-white ring-rose-600";
  if (priority === "high") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (priority === "medium") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
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
  return <StandardUnavailableState title="Intelligence unavailable" description={message} compact />;
}

function DistributionBars({
  items,
  tone = "bg-blue-500",
  emptyMessage = UNAVAILABLE,
}: {
  items: Array<{ label: string; value: number }>;
  tone?: string;
  emptyMessage?: string;
}) {
  if (items.length === 0) return <UnavailableState message={emptyMessage} />;
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

function sourceText(item: ImpactAiInsight) {
  return [
    item.impact_programmes?.name,
    item.msmes?.business_name,
    item.impact_interventions?.title,
  ].filter(Boolean).join(" · ") || UNAVAILABLE;
}

function programmeRankings(feed: Feed) {
  const programmes = new Map<string, ProgrammeRanking>();
  const ensure = (id: string | null, name: string | null | undefined) => {
    if (!id || !name) return null;
    const current = programmes.get(id) ?? { id, name, total: 0, opportunities: 0, concerns: 0 };
    programmes.set(id, current);
    return current;
  };

  for (const insight of feed.insights) {
    const item = ensure(insight.programme_id, insight.impact_programmes?.name);
    if (!item) continue;
    item.total += 1;
    if (isOpportunityInsight(insight)) item.opportunities += 1;
    if (isConcernInsight(insight)) item.concerns += 1;
  }
  for (const risk of feed.riskFlags) {
    const item = ensure(risk.programme_id, risk.impact_programmes?.name);
    if (!item) continue;
    item.concerns += 1;
  }
  return [...programmes.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function recommendationCards(feed: Feed) {
  const linked = feed.recommendations
    .filter((item) => item.status === "open")
    .sort((a, b) => severityRank(b.priority) - severityRank(a.priority) || b.created_at.localeCompare(a.created_at));

  return linked.slice(0, 6).map((item) => {
    const title = includesAny(item.recommendation_type, ["evidence", "documentation"])
      ? "Evidence weakness detected"
      : includesAny(item.recommendation_type, ["monitoring", "follow_up"])
        ? "Monitoring gap identified"
        : includesAny(`${item.recommendation_type} ${item.title}`, ["scale", "opportunity", "growth"])
          ? "Opportunity for scale identified"
          : severityRank(item.priority) >= 3
            ? "Executive attention required"
            : item.title;
    return { ...item, executiveTitle: title };
  });
}

function createTimeline(feed: Feed): TimelineItem[] {
  const items: TimelineItem[] = [
    ...feed.insights.map((item) => ({
      id: `insight-${item.id}`,
      title: "Intelligence record created",
      detail: `${item.title} · Current status: ${display(item.status)}`,
      date: item.generated_at,
      tone: "bg-blue-500",
      href: `${ROUTE}/${item.id}`,
    })),
    ...feed.riskFlags.map((item) => ({
      id: `risk-${item.id}`,
      title: "Risk flag detected",
      detail: `${item.title} · Current status: ${display(item.status)}`,
      date: item.detected_at,
      tone: "bg-rose-500",
      href: "/dashboard/impact-intelligence/risk-flags",
    })),
    ...feed.anomalies.map((item) => ({
      id: `anomaly-${item.id}`,
      title: "Anomaly detected",
      detail: item.title,
      date: item.detected_at,
      tone: "bg-amber-500",
    })),
    ...feed.recommendations.map((item) => ({
      id: `recommendation-${item.id}`,
      title: "Recommendation recorded",
      detail: item.title,
      date: item.created_at,
      tone: "bg-violet-500",
    })),
  ];
  return items
    .filter((item) => item.date && !Number.isNaN(new Date(item.date).getTime()))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
}

function signalCard(
  label: string,
  item: ImpactAiInsight | ImpactRiskFlag | ImpactIntelligenceSummary | null,
  tone: string,
) {
  const title = item?.title ?? UNAVAILABLE;
  const detail = item
    ? "summary" in item
      ? item.summary
      : item.description
    : "No supporting intelligence record is available.";
  return { label, title, detail, tone };
}

export default async function IntelligencePage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let feed: Feed | null = null;

  try {
    const currentContext = await getCurrentUserContext();
    ctx = currentContext;
    if (
      !INTELLIGENCE_ROLES.includes(currentContext.role)
      || !canRole(currentContext.role, "intelligence", "read")
      || !canAccessRoute(currentContext.role, ROUTE)
    ) {
      redirect("/access-denied");
    }
    feed = await listIntelligenceFeed(currentContext, { limit: 100 });
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: ROUTE, operation: "intelligence_feed_load_failed", error });
  }

  if (!ctx || !feed) {
    return (
      <section className="space-y-6">
        <Section title="Executive Intelligence Hub Unavailable">
          <EmptyState title="Intelligence records could not load" description="The intelligence source, current session, or assigned programme scope is temporarily unavailable." icon={BrainCircuit} />
        </Section>
      </section>
    );
  }

  const insights = [...feed.insights].sort(
    (a, b) => severityRank(b.priority) - severityRank(a.priority) || b.generated_at.localeCompare(a.generated_at),
  );
  const activeInsights = insights.filter((item) => item.status === "open");
  const resolvedInsights = insights.filter((item) => item.status === "resolved");
  const criticalInsights = activeInsights.filter((item) => item.priority === "critical");
  const highInsights = activeInsights.filter((item) => item.priority === "high");
  const opportunityInsights = insights.filter(isOpportunityInsight);
  const outcomeInsights = insights.filter(isOutcomeInsight);
  const riskInsights = insights.filter((item) => item.category === "risk");
  const openRisks = feed.riskFlags.filter((item) => item.status === "open");
  const escalatingInsights = activeInsights.filter((item) =>
    metadataText(item.metadata, ["escalated_at", "escalation_date", "escalated"]) !== null,
  );
  const executiveAttention = activeInsights.filter((item) => severityRank(item.priority) >= 3);
  const programmeSignals = insights.filter((item) => item.programme_id);
  const monitoringSignals = insights.filter((item) => item.category === "monitoring");
  const verifiedOutcomeSignals = outcomeInsights.filter((item) =>
    includesAny(`${item.status} ${item.summary} ${item.source_key}`, ["verified", "resolved"]),
  );
  const outcomeConcerns = outcomeInsights.filter(isConcernInsight);
  const programmeRanking = programmeRankings(feed);
  const recommendations = recommendationCards(feed);
  const timeline = createTimeline(feed);
  const categories = countBy(insights, (item) => item.category);
  const repeatedCategories = categories.filter((item) => item.value > 1);
  const repeatedProgrammes = programmeRanking.filter((item) => item.total > 1);
  const states = countBy(insights, (item) => item.msmes?.state);
  const regions = countBy(
    insights.filter((item) => item.msmes?.state && regionForState(item.msmes.state)),
    (item) => regionForState(item.msmes?.state ?? ""),
  );
  const freshness = latestDate([
    ...insights.map((item) => item.generated_at),
    ...feed.recommendations.map((item) => item.created_at),
    ...feed.riskFlags.map((item) => item.detected_at),
    ...feed.anomalies.map((item) => item.detected_at),
    ...feed.summaries.map((item) => item.generated_at),
  ]);
  const topFinding = insights[0] ?? null;
  const topOpportunity = opportunityInsights[0] ?? null;
  const topRisk = [...openRisks].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]
    ?? riskInsights[0]
    ?? null;
  const strongestProgrammeSignal = programmeRanking[0]
    ? insights.find((item) => item.programme_id === programmeRanking[0].id) ?? null
    : null;
  const topAttention = executiveAttention[0] ?? null;
  const canManage = canRole(ctx.role, "intelligence", "update");
  const canViewRisks = canRole(ctx.role, "risk_flag", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/risk-flags");
  const canViewAnalytics = canRole(ctx.role, "analytics", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/analytics");
  const canViewExecutive = canRole(ctx.role, "executive_dashboard", "read")
    && canAccessRoute(ctx.role, "/dashboard/impact-intelligence/executive");
  const portfolioSignal = insights.length > 0
    ? `${new Set(programmeSignals.map((item) => item.programme_id)).size} linked programme${new Set(programmeSignals.map((item) => item.programme_id)).size === 1 ? "" : "s"}`
    : UNAVAILABLE;

  return (
    <section className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_78%_24%,rgba(37,99,235,0.5),transparent_30%),linear-gradient(120deg,#050f24_0%,#0a224d_55%,#07162f_100%)] p-5 text-white shadow-2xl shadow-blue-950/15 sm:p-7">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <svg viewBox="0 0 900 360" className="h-full w-full">
            <defs><pattern id="intelligence-hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#67e8f9" /></pattern></defs>
            <path d="M510 32 615 18l82 39 67 3 55 63-47 48 8 58-94 16-70-35-75 16-53-62 25-59Z" fill="url(#intelligence-hero-dots)" stroke="#38bdf8" strokeOpacity=".5" />
            <path d="M410 300c105-80 160-150 245-96s112 9 184-96" fill="none" stroke="#22d3ee" strokeOpacity=".55" />
            <circle cx="646" cy="150" r="5" fill="#34d399" />
            <circle cx="713" cy="156" r="4" fill="#a78bfa" />
            <circle cx="797" cy="78" r="4" fill="#fbbf24" />
          </svg>
        </div>
        <div className="relative">
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200/70">
            <Link href="/dashboard/impact-intelligence" className="hover:text-white">Impact Intelligence</Link>
            <span>/</span>
            <span className="text-emerald-300">Intelligence Hub</span>
          </nav>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">BOI Executive Situation Room</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">Executive Intelligence Hub</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/75">Strategic decision support from existing governed intelligence records, recommendations, risks, anomalies, and programme summaries.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canViewRisks && <Link href="/dashboard/impact-intelligence/risk-flags" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#0c1f46] hover:bg-blue-50"><ShieldAlert className="h-4 w-4" /> Open Risk Centre</Link>}
              {canViewAnalytics && <Link href="/dashboard/impact-intelligence/analytics" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"><BarChart3 className="h-4 w-4" /> Open Analytics</Link>}
              {canViewExecutive && <Link href="/dashboard/impact-intelligence/executive" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15"><Gauge className="h-4 w-4" /> Executive Dashboard</Link>}
            </div>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Intelligence records", value: insights.length, icon: BrainCircuit, color: "text-cyan-300" },
              { label: "Active intelligence", value: activeInsights.length, icon: Activity, color: "text-blue-300" },
              { label: "Resolved intelligence", value: resolvedInsights.length, icon: BadgeCheck, color: "text-emerald-300" },
              { label: "Opportunities", value: opportunityInsights.length, icon: Sparkles, color: "text-violet-300" },
              { label: "Executive attention required", value: executiveAttention.length, icon: AlertTriangle, color: "text-amber-300" },
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
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5"><Radar className="mr-1.5 inline h-3 w-3 text-cyan-300" />Portfolio signal: {portfolioSignal}</span>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-bold text-emerald-200">{roleLabel(ctx.role)} · {canManage ? "Managed access" : "Read only"}</span>
          </div>
        </div>
      </section>

      {query.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
        <MetricCard label="Total Intelligence" value={insights.length.toLocaleString("en-NG")} icon={BrainCircuit} tone="bg-blue-100 text-blue-700" />
        <MetricCard label="Active" value={activeInsights.length.toLocaleString("en-NG")} icon={Activity} tone="bg-cyan-100 text-cyan-700" />
        <MetricCard label="Resolved" value={resolvedInsights.length.toLocaleString("en-NG")} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Critical" value={criticalInsights.length.toLocaleString("en-NG")} icon={ShieldAlert} tone="bg-rose-100 text-rose-700" />
        <MetricCard label="High Priority" value={highInsights.length.toLocaleString("en-NG")} icon={AlertTriangle} tone="bg-amber-100 text-amber-700" />
        <MetricCard label="Programme Signals" value={programmeSignals.length.toLocaleString("en-NG")} icon={Building2} tone="bg-indigo-100 text-indigo-700" />
        <MetricCard label="Outcome Signals" value={outcomeInsights.length.toLocaleString("en-NG")} icon={Target} tone="bg-teal-100 text-teal-700" />
        <MetricCard label="Risk Signals" value={(riskInsights.length + openRisks.length).toLocaleString("en-NG")} icon={ShieldCheck} tone="bg-red-100 text-red-700" />
        <MetricCard label="Opportunities" value={opportunityInsights.length.toLocaleString("en-NG")} icon={Lightbulb} tone="bg-violet-100 text-violet-700" />
      </div>

      <Section
        title="Strategic Intelligence Feed"
        description="Priority-ranked intelligence records. Strategic significance repeats the stored record summary without generating a new narrative."
        action={<span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{insights.length} records</span>}
      >
        {insights.length === 0 ? (
          <EmptyState title="No intelligence records available" description="No existing intelligence records are visible in the current governed scope." icon={BrainCircuit} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {insights.map((insight) => {
              const opportunity = isOpportunityInsight(insight);
              const dismiss = dismissInsightAction.bind(null, insight.id);
              return (
                <article key={insight.id} className={cn("rounded-2xl border p-4 shadow-sm", insightTone(insight.priority, insight.status, opportunity))}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {insight.priority === "critical" && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-rose-700"><ShieldAlert className="h-3 w-3" /> Executive warning</span>}
                        {insight.status === "resolved" && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700"><BadgeCheck className="h-3 w-3" /> Resolved</span>}
                        {metadataText(insight.metadata, ["escalated_at", "escalation_date", "escalated"]) && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-rose-700"><AlertTriangle className="h-3 w-3" /> Escalated</span>}
                        {opportunity && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-violet-700"><Sparkles className="h-3 w-3" /> Strategic opportunity</span>}
                      </div>
                      <Link href={`${ROUTE}/${insight.id}`} className="mt-2 block text-sm font-bold text-[#0c1733] hover:text-blue-700">{insight.title}</Link>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{insight.summary}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ring-1", priorityPill(insight.priority))}>{display(insight.priority)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-200/70 py-3 text-[10px] sm:grid-cols-4">
                    <div><p className="font-semibold text-slate-400">Category</p><p className="mt-1 font-bold text-slate-700">{display(insight.category)}</p></div>
                    <div><p className="font-semibold text-slate-400">Programme / source</p><p className="mt-1 truncate font-bold text-slate-700">{sourceText(insight)}</p></div>
                    <div><p className="font-semibold text-slate-400">Status</p><p className="mt-1 font-bold text-slate-700">{display(insight.status)}</p></div>
                    <div><p className="font-semibold text-slate-400">Created</p><p className="mt-1 font-bold text-slate-700">{formatDate(insight.generated_at)}</p></div>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Owner</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-600">{UNAVAILABLE}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {canManage && insight.status === "open" && (
                        <form action={dismiss}>
                          <button type="submit" className="text-[10px] font-bold text-slate-500 hover:text-slate-900">Dismiss</button>
                        </form>
                      )}
                      <Link href={`${ROUTE}/${insight.id}`} className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900">Open record <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Section title="Emerging Patterns Centre" description="Repeated patterns are exact groupings of existing categories, programme links, and monitoring records.">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-bold text-slate-800">Recurring themes</h3>
              <DistributionBars items={repeatedCategories.slice(0, 6)} emptyMessage={UNAVAILABLE} tone="bg-indigo-500" />
            </div>
            <div>
              <h3 className="mb-3 text-xs font-bold text-slate-800">Repeated programme observations</h3>
              <DistributionBars items={repeatedProgrammes.slice(0, 6).map((item) => ({ label: item.name, value: item.total }))} emptyMessage={UNAVAILABLE} tone="bg-blue-500" />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-2xl font-bold text-[#0c1733]">{outcomeInsights.length || UNAVAILABLE}</p><p className="mt-1 text-[10px] font-bold uppercase text-slate-500">Outcome patterns</p></article>
            <article className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-2xl font-bold text-[#0c1733]">{monitoringSignals.length || UNAVAILABLE}</p><p className="mt-1 text-[10px] font-bold uppercase text-slate-500">Monitoring patterns</p></article>
          </div>
        </Section>

        <Section title="Outcome Intelligence Centre" description="Outcome views are limited to records whose stored category, source, title, or summary explicitly identifies an outcome or indicator.">
          <div className="grid grid-cols-2 gap-3">
            <article className="rounded-2xl bg-[#0c1f46] p-4 text-white"><Target className="h-5 w-5 text-cyan-300" /><p className="mt-5 text-3xl font-bold">{outcomeInsights.length || UNAVAILABLE}</p><p className="mt-1 text-[9px] font-bold uppercase text-blue-100">Strongest outcome signals</p></article>
            <article className="rounded-2xl bg-emerald-600 p-4 text-white"><BadgeCheck className="h-5 w-5 text-emerald-100" /><p className="mt-5 text-3xl font-bold">{verifiedOutcomeSignals.length || UNAVAILABLE}</p><p className="mt-1 text-[9px] font-bold uppercase text-emerald-100">Verified / resolved signals</p></article>
          </div>
          <div className="mt-4 space-y-2">
            {outcomeInsights.length === 0 ? <UnavailableState /> : outcomeInsights.slice(0, 4).map((item) => (
              <Link key={item.id} href={`${ROUTE}/${item.id}`} className={cn("block rounded-xl border p-3", isConcernInsight(item) ? "border-rose-100 bg-rose-50/50" : "border-emerald-100 bg-emerald-50/50")}>
                <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-bold text-slate-800">{item.title}</p><span className="text-[9px] font-bold text-slate-500">{display(item.status)}</span></div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{item.summary}</p>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-lg font-bold text-amber-800">{outcomeConcerns.length || UNAVAILABLE}</p><p className="mt-1 text-[9px] font-bold uppercase text-amber-700">Emerging outcome concerns</p></div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Programme Intelligence Centre" description="Programme rankings use only explicit programme relationships on existing intelligence and risk records.">
          {programmeRanking.length === 0 ? <UnavailableState /> : (
            <div className="space-y-3">
              {programmeRanking.slice(0, 7).map((item, index) => (
                <article key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0c1f46] text-[10px] font-bold text-white">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#0c1733]">{item.name}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white p-2"><p className="text-sm font-bold">{item.total}</p><p className="text-[8px] text-slate-500">Intelligence</p></div>
                        <div className="rounded-lg bg-violet-50 p-2"><p className="text-sm font-bold text-violet-700">{item.opportunities}</p><p className="text-[8px] text-violet-600">Opportunities</p></div>
                        <div className="rounded-lg bg-rose-50 p-2"><p className="text-sm font-bold text-rose-700">{item.concerns}</p><p className="text-[8px] text-rose-600">Concerns</p></div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title="Geographic Intelligence Centre" description="State and regional concentration from geography explicitly linked through intelligence MSME relationships.">
          {states.length === 0 ? (
            <EmptyState title="Geographic intelligence unavailable" description="No state-level geography exists on the intelligence records visible in the current scope." icon={MapPinned} />
          ) : (
            <div className="grid gap-5 md:grid-cols-[.7fr_1.3fr]">
              <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 p-5">
                <Globe2 className="h-24 w-24 text-blue-100" />
                <div className="absolute inset-x-4 bottom-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/90 p-3 text-center shadow-sm"><p className="text-xl font-bold text-[#0c1733]">{states.length}</p><p className="text-[9px] text-slate-500">States</p></div>
                  <div className="rounded-xl bg-white/90 p-3 text-center shadow-sm"><p className="text-xl font-bold text-[#0c1733]">{regions.length || UNAVAILABLE}</p><p className="text-[9px] text-slate-500">Regions</p></div>
                </div>
              </div>
              <div className="space-y-5">
                <div><h3 className="mb-3 text-xs font-bold text-slate-800">Intelligence by state</h3><DistributionBars items={states.slice(0, 6)} tone="bg-emerald-500" /></div>
                <div><h3 className="mb-3 text-xs font-bold text-slate-800">Intelligence by region</h3><DistributionBars items={regions.slice(0, 6)} tone="bg-blue-500" /></div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Section
          title="Risk Intelligence Linkage"
          description="Visibility into linked risk and governance signals without duplicating Risk Centre workflows."
          action={canViewRisks ? <Link href="/dashboard/impact-intelligence/risk-flags" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">Open Risk Centre <ArrowRight className="h-3 w-3" /></Link> : undefined}
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Linked risk flags", value: feed.riskFlags.length, icon: ShieldAlert, tone: "bg-rose-100 text-rose-700" },
              { label: "Unresolved concerns", value: openRisks.length, icon: AlertTriangle, tone: "bg-amber-100 text-amber-700" },
              { label: "Escalating intelligence", value: escalatingInsights.length, icon: TrendingUp, tone: "bg-red-100 text-red-700" },
              { label: "Governance observations", value: insights.filter((item) => item.category === "compliance").length, icon: ShieldCheck, tone: "bg-blue-100 text-blue-700" },
            ].map((item) => {
              const Icon = item.icon;
              return <article key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"><span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.tone)}><Icon className="h-4 w-4" /></span><p className="mt-4 text-2xl font-bold text-[#0c1733]">{item.value.toLocaleString("en-NG")}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{item.label}</p></article>;
            })}
          </div>
          <div className="mt-4 space-y-2">
            {openRisks.length === 0 ? <UnavailableState message="No unresolved linked risk flags are available." /> : openRisks.slice(0, 4).map((risk) => (
              <article key={risk.id} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                <div className="flex justify-between gap-3"><p className="text-[11px] font-bold text-slate-800">{risk.title}</p><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", priorityPill(risk.severity))}>{display(risk.severity)}</span></div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{risk.description}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Executive Recommendations Centre" description="Deterministic action cards from stored recommendation records only.">
          {recommendations.length === 0 ? <UnavailableState /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recommendations.map((item: ImpactAiRecommendation) => {
                const card = item as ImpactAiRecommendation & { executiveTitle: string };
                return (
                  <article key={card.id} className="rounded-2xl border border-violet-100 bg-violet-50/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Lightbulb className="h-4 w-4" /></span>
                      <span className={cn("rounded-full px-2 py-1 text-[9px] font-bold ring-1", priorityPill(card.priority))}>{display(card.priority)}</span>
                    </div>
                    <p className="mt-4 text-xs font-bold text-[#0c1733]">{card.executiveTitle}</p>
                    <p className="mt-1 text-[10px] font-semibold text-violet-700">{card.title}</p>
                    <p className="mt-2 text-[11px] leading-5 text-slate-600">{card.recommendation}</p>
                  </article>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <Section title="Intelligence Timeline" description="Chronological events from real created and detected timestamps. Update, escalation, and resolution dates remain unavailable unless explicitly stored by the source.">
        {timeline.length === 0 ? <UnavailableState /> : (
          <div className="grid gap-x-6 gap-y-1 lg:grid-cols-2">
            {timeline.map((item) => {
              const content = (
                <div className="flex gap-3 border-l border-slate-200 pb-5 pl-5">
                  <span className={cn("-ml-[1.65rem] mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-white", item.tone)} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{formatDate(item.date)} · {item.title}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-700">{item.detail}</p>
                  </div>
                </div>
              );
              return item.href ? <Link key={item.id} href={item.href} className="hover:bg-slate-50">{content}</Link> : <div key={item.id}>{content}</div>;
            })}
          </div>
        )}
      </Section>

      <section className="overflow-hidden rounded-3xl bg-[#071a3c] text-white shadow-xl shadow-blue-950/10">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Executive briefing summary</p>
          <h2 className="mt-2 text-xl font-bold">Leadership attention, grounded in current intelligence records</h2>
          <p className="mt-1 text-xs text-blue-100/65">No generated narrative. Each briefing item reproduces a stored title and supporting summary or description.</p>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
          {[
            signalCard("Top Strategic Finding", topFinding, "text-cyan-300"),
            signalCard("Top Opportunity", topOpportunity, "text-violet-300"),
            signalCard("Top Risk", topRisk, "text-rose-300"),
            signalCard("Strongest Programme Signal", strongestProgrammeSignal, "text-emerald-300"),
            signalCard("Executive Attention Required", topAttention, "text-amber-300"),
          ].map((item) => (
            <article key={item.label} className="bg-[#0a2048] p-5">
              <p className={cn("text-[9px] font-black uppercase tracking-[0.1em]", item.tone)}>{item.label}</p>
              <p className="mt-3 text-sm font-bold">{item.title}</p>
              <p className="mt-2 line-clamp-4 text-[10px] leading-5 text-blue-100/65">{item.detail}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-[10px] text-blue-100/60">
          <span><Clock3 className="mr-1.5 inline h-3 w-3" />Briefing freshness: {formatFreshness(freshness)}</span>
          <span>{roleLabel(ctx.role)} · Governed portfolio scope</span>
        </div>
      </section>
    </section>
  );
}
