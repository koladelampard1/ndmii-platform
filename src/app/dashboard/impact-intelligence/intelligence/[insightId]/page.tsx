import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { dismissInsight, getInsightDetail } from "@/lib/data/impact-intelligence";
import { EmptyState, SectionCard } from "../../_components";
import { logImpactRouteDiagnostic } from "../../_diagnostics";

const INTELLIGENCE_ROLES = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "auditor", "field_officer"];
const MANAGE_ROLES = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer"];

async function dismissAction(insightId: string) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await dismissInsight(ctx, insightId);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/intelligence/[insightId]", operation: "insight_detail_dismiss_failed", error });
    if (!(error instanceof Error) || !["permission", "insight", "status"].some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirect(`/dashboard/impact-intelligence/intelligence/${insightId}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/dashboard/impact-intelligence/intelligence/${insightId}`);
}

function badgeClass(priority: string) {
  if (priority === "critical" || priority === "high") return "bg-red-100 text-red-700";
  if (priority === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default async function InsightDetailPage({ params, searchParams }: { params: Promise<{ insightId: string }>; searchParams?: Promise<{ error?: string }> }) {
  const { insightId } = await params;
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let detail: Awaited<ReturnType<typeof getInsightDetail>> | null = null;
  try {
    ctx = await getCurrentUserContext();
    if (!INTELLIGENCE_ROLES.includes(ctx.role)) redirect("/access-denied");
    detail = await getInsightDetail(ctx, insightId);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/intelligence/[insightId]", operation: "insight_detail_load_failed", error });
    return (
      <section className="space-y-6">
        <SectionCard title="Intelligence Record Unavailable">
          <EmptyState title="Intelligence record could not load" description="The legacy intelligence source, current session, or assigned scope is temporarily unavailable." icon={BrainCircuit} />
        </SectionCard>
      </section>
    );
  }
  const { insight, recommendations, riskFlags, anomalies } = detail;
  if (!insight) notFound();
  const canManage = MANAGE_ROLES.includes(ctx.role);
  const dismiss = dismissAction.bind(null, insight.id);

  return (
    <section className="space-y-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{insight.category}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{insight.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{insight.summary}</p>
          </div>
          <div className="flex gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(insight.priority)}`}>{insight.priority}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{insight.status}</span>
          </div>
        </div>
      </header>

      {query.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">MSME</p><p className="mt-1 font-semibold text-slate-950">{insight.msmes?.business_name ?? "Portfolio"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Programme</p><p className="mt-1 font-semibold text-slate-950">{insight.impact_programmes?.name ?? "Unlinked"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Intervention</p><p className="mt-1 font-semibold text-slate-950">{insight.impact_interventions?.title ?? "Unlinked"}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Source</p><p className="mt-1 font-semibold text-slate-950">{insight.insight_type}</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Recommended actions</h2>
          {recommendations.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-600">No linked recommendations for this insight.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {recommendations.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <p className="font-medium text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.recommendation}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.recommendation_type} • {item.priority}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <aside className="space-y-4">
          {canManage && insight.status === "open" && (
            <form action={dismiss} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Disposition</h2>
              <p className="mt-2 text-sm text-slate-600">Dismiss this deterministic insight when it is not actionable for the current operating context.</p>
              <Button type="submit" className="mt-4 w-full">Dismiss insight</Button>
            </form>
          )}
          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Related signals</h2>
            <p className="mt-2 text-sm text-slate-600">{riskFlags.length} risk flag(s) and {anomalies.length} anomaly event(s) are available in the current intelligence register.</p>
          </article>
        </aside>
      </div>
    </section>
  );
}
