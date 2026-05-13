import Link from "next/link";
import { redirect } from "next/navigation";
import { BrainCircuit, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  dismissInsight,
  generateMonitoringInsights,
  generateMsmeInsights,
  generateProgrammeInsights,
  generateRiskFlags,
  listIntelligenceFeed,
} from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, MetricTile, SectionCard, StatusBadge } from "../_components";

const INTELLIGENCE_ROLES = ["admin", "boi_executive", "programme_officer", "assessment_officer", "auditor", "field_officer"];
const MANAGE_ROLES = ["admin", "boi_executive", "programme_officer", "assessment_officer"];

async function generateIntelligenceAction() {
  "use server";
  const ctx = await getCurrentUserContext();
  await generateMsmeInsights(ctx);
  await generateProgrammeInsights(ctx);
  await generateMonitoringInsights(ctx);
  await generateRiskFlags(ctx);
  redirect("/dashboard/impact-intelligence/intelligence");
}

async function dismissInsightAction(insightId: string) {
  "use server";
  const ctx = await getCurrentUserContext();
  await dismissInsight(ctx, insightId);
  redirect("/dashboard/impact-intelligence/intelligence");
}

export default async function IntelligencePage() {
  const ctx = await getCurrentUserContext();
  if (!INTELLIGENCE_ROLES.includes(ctx.role)) redirect("/access-denied");
  const feed = await listIntelligenceFeed(ctx, { limit: 100 });
  const canManage = MANAGE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Decision support"
        title="Impact Intelligence Feed"
        description="Deterministic operational insights, recommendations, anomalies, and risk signals generated from DBIN evidence-backed records."
        badge="Assistive intelligence"
      />
      {canManage && (
        <form action={generateIntelligenceAction} className="flex justify-end">
          <Button type="submit" className="gap-2"><RefreshCw className="h-4 w-4" /> Generate intelligence</Button>
        </form>
      )}

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
    </section>
  );
}
