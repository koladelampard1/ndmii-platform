import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BrainCircuit, Lightbulb, RefreshCw } from "lucide-react";
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

function badgeClass(priority: string) {
  if (priority === "critical" || priority === "high") return "bg-red-100 text-red-700";
  if (priority === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function IntelligencePage() {
  const ctx = await getCurrentUserContext();
  if (!INTELLIGENCE_ROLES.includes(ctx.role)) redirect("/access-denied");
  const feed = await listIntelligenceFeed(ctx, { limit: 100 });
  const canManage = MANAGE_ROLES.includes(ctx.role);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Decision support</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Impact Intelligence Feed</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Deterministic operational insights, recommendations, anomalies, and risk signals generated from DBIN evidence-backed records.</p>
          </div>
          {canManage && (
            <form action={generateIntelligenceAction}>
              <Button type="submit" className="gap-2"><RefreshCw className="h-4 w-4" /> Generate intelligence</Button>
            </form>
          )}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Open insights</p><p className="mt-1 text-2xl font-semibold text-slate-950">{feed.insights.filter((item) => item.status === "open").length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Recommendations</p><p className="mt-1 text-2xl font-semibold text-slate-950">{feed.recommendations.length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Risk flags</p><p className="mt-1 text-2xl font-semibold text-slate-950">{feed.riskFlags.filter((item) => item.status === "open").length}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Anomalies</p><p className="mt-1 text-2xl font-semibold text-slate-950">{feed.anomalies.filter((item) => item.status === "open").length}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold text-slate-950">Intelligence feed</h2></div>
          {feed.insights.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed bg-slate-50 p-6 text-center">
              <h3 className="font-semibold text-slate-950">No insights generated yet</h3>
              <p className="mt-2 text-sm text-slate-600">Run deterministic intelligence generation after operational records are available.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {feed.insights.map((insight) => {
                const dismiss = dismissInsightAction.bind(null, insight.id);
                return (
                  <div key={insight.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link href={`/dashboard/impact-intelligence/intelligence/${insight.id}`} className="font-semibold text-slate-950 hover:text-emerald-700">{insight.title}</Link>
                        <p className="mt-1 text-sm text-slate-600">{insight.summary}</p>
                        <p className="mt-2 text-xs text-slate-500">{insight.category} • {insight.msmes?.business_name ?? insight.impact_programmes?.name ?? "portfolio"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(insight.priority)}`}>{insight.priority}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{insight.status}</span>
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
        </article>

        <aside className="space-y-4">
          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold text-slate-950">Recommendations</h2></div>
            {feed.recommendations.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">No recommendations yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {feed.recommendations.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <p className="font-medium text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-600" /><h2 className="font-semibold text-slate-950">Priority risk</h2></div>
            {feed.riskFlags.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">No open risk flags.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {feed.riskFlags.slice(0, 5).map((risk) => (
                  <Link key={risk.id} href="/dashboard/impact-intelligence/risk-flags" className="block rounded-lg border p-3 hover:border-red-200 hover:bg-red-50/40">
                    <p className="font-medium text-slate-950">{risk.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{risk.severity} • {risk.status}</p>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </aside>
      </div>

      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Programme health summaries</h2>
        {feed.summaries.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No programme summaries generated yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {feed.summaries.map((summary) => (
              <div key={summary.id} className="rounded-lg border p-4">
                <p className="font-medium text-slate-950">{summary.title}</p>
                <p className="mt-1 text-sm text-slate-600">{summary.summary}</p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
