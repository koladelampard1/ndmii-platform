import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { canRole } from "@/lib/impact-intelligence/permissions";
import {
  dismissInsight,
  listIntelligenceFeed,
} from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, MetricTile, SectionCard, StatusBadge } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

const INTELLIGENCE_ROLES = ["admin", "super_admin", "boi_executive", "assessment_officer", "data_analyst", "auditor", "field_officer"];

async function dismissInsightAction(insightId: string) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await dismissInsight(ctx, insightId);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/intelligence", operation: "insight_dismiss_failed", error });
    if (!(error instanceof Error) || !["permission", "insight", "status"].some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirect(`/dashboard/impact-intelligence/intelligence?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard/impact-intelligence/intelligence");
}

export default async function IntelligencePage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let feed: Awaited<ReturnType<typeof listIntelligenceFeed>> | null = null;
  try {
    ctx = await getCurrentUserContext();
    if (!INTELLIGENCE_ROLES.includes(ctx.role)) redirect("/access-denied");
    feed = await listIntelligenceFeed(ctx, { limit: 100 });
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/intelligence", operation: "intelligence_feed_load_failed", error });
  }
  const canManage = Boolean(ctx && feed && canRole(ctx.role, "intelligence", "update"));

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Internal programme monitoring"
        title="Legacy Programme Intelligence Register"
        description="Read-only access to existing deterministic programme records. New insight generation is disabled during the truthful DBIN foundation phase."
        badge="Internal legacy register"
      />
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Not yet wired: DBIN-wide insight definitions. Existing records remain visible for internal review, but this phase does not create AI or deterministic insight claims.</p>

      {query.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
      {!feed ? (
        <SectionCard title="Intelligence Register Unavailable">
          <EmptyState title="Intelligence records could not load" description="The legacy intelligence source, current session, or assigned scope is temporarily unavailable." icon={BrainCircuit} />
        </SectionCard>
      ) : (
      <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile label="Open insights" value={feed.insights.filter((item) => item.status === "open").length} tone="emerald" />
        <MetricTile label="Recommendations" value={feed.recommendations.length} tone="blue" />
        <MetricTile label="Risk flags" value={feed.riskFlags.filter((item) => item.status === "open").length} tone="red" />
        <MetricTile label="Anomalies" value={feed.anomalies.filter((item) => item.status === "open").length} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <SectionCard title="Intelligence feed">
          {feed.insights.length === 0 ? (
            <EmptyState title="No insights generated yet" description="Run deterministic intelligence generation after operational records are available." icon={BrainCircuit} />
          ) : (
            <div className="mt-4 space-y-3">
              {feed.insights.map((insight) => {
                const dismiss = dismissInsightAction.bind(null, insight.id);
                return (
                  <div key={insight.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link href={`/dashboard/impact-intelligence/intelligence/${insight.id}`} className="font-semibold text-slate-950 hover:text-emerald-700">{insight.title}</Link>
                        <p className="mt-1 text-sm text-slate-600">{insight.summary}</p>
                        <p className="mt-2 text-xs text-slate-500">{insight.category} • {insight.msmes?.business_name ?? insight.impact_programmes?.name ?? "portfolio"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge value={insight.priority} />
                        <StatusBadge value={insight.status} />
                      </div>
                    </div>
                    {canManage && insight.status === "open" && (
                      <form action={dismiss} className="mt-3 flex justify-end">
                        <button type="submit" className="text-xs font-medium text-slate-500 hover:text-slate-900">Dismiss</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <aside className="space-y-4">
          <SectionCard title="Recommendations">
            {feed.recommendations.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">No recommendations yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {feed.recommendations.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-medium text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Priority risk">
            {feed.riskFlags.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">No open risk flags.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {feed.riskFlags.slice(0, 5).map((risk) => (
                  <Link key={risk.id} href="/dashboard/impact-intelligence/risk-flags" className="block rounded-lg border border-slate-200 p-3 hover:border-red-200 hover:bg-red-50/40">
                    <p className="font-medium text-slate-950">{risk.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{risk.severity} • {risk.status}</p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </aside>
      </div>

      <SectionCard title="Programme health summaries">
        {feed.summaries.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No programme summaries generated yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {feed.summaries.map((summary) => (
              <div key={summary.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-950">{summary.title}</p>
                <p className="mt-1 text-sm text-slate-600">{summary.summary}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      </>
      )}
    </section>
  );
}
