import { redirect, unstable_rethrow } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/session";
import { generateRiskFlags, listIntelligenceFeed, resolveRiskFlag } from "@/lib/data/impact-intelligence";
import { EmptyState, ImpactPageHeader, MetricTile, SectionCard, StatusBadge } from "../_components";
import { logImpactRouteDiagnostic } from "../_diagnostics";

function redirectWithRiskError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Risk flag action could not be completed.";
  redirect(`/dashboard/impact-intelligence/risk-flags?error=${encodeURIComponent(message)}`);
}

const INTELLIGENCE_ROLES = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer", "auditor", "field_officer"];
const MANAGE_ROLES = ["admin", "super_admin", "boi_executive", "programme_officer", "assessment_officer"];

async function generateRiskFlagsAction() {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await generateRiskFlags(ctx);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/risk-flags", operation: "risk_flag_generation_failed", error });
    if (!(error instanceof Error) || !["permission", "risk", "source", "unavailable"].some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirectWithRiskError(error);
  }
  redirect("/dashboard/impact-intelligence/risk-flags");
}

async function resolveRiskFlagAction(riskFlagId: string, formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  try {
    await resolveRiskFlag(ctx, riskFlagId, formData);
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/risk-flags", operation: "risk_flag_resolution_failed", error });
    if (!(error instanceof Error) || !["permission", "risk", "status", "resolution"].some((message) => error.message.toLowerCase().includes(message))) throw error;
    redirectWithRiskError(error);
  }
  redirect("/dashboard/impact-intelligence/risk-flags");
}

export default async function RiskFlagsPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const query = (await searchParams) ?? {};
  let ctx: Awaited<ReturnType<typeof getCurrentUserContext>> | null = null;
  let feed: Awaited<ReturnType<typeof listIntelligenceFeed>> | null = null;
  try {
    ctx = await getCurrentUserContext();
    if (!INTELLIGENCE_ROLES.includes(ctx.role)) redirect("/access-denied");
    feed = await listIntelligenceFeed(ctx, { limit: 100 });
  } catch (error) {
    unstable_rethrow(error);
    logImpactRouteDiagnostic({ ctx, route: "/dashboard/impact-intelligence/risk-flags", operation: "risk_flag_list_load_failed", error });
  }
  const canManage = Boolean(ctx && feed && MANAGE_ROLES.includes(ctx.role));
  const openFlags = feed?.riskFlags.filter((flag) => flag.status === "open") ?? [];

  return (
    <section className="space-y-6">
      <ImpactPageHeader
        eyebrow="Internal programme monitoring"
        title="Programme Monitoring Risk Flags"
        description="Deterministic internal operational flags from programme records. Evidence placeholders do not make these evidence-backed impact findings."
        badge="Internal risk register"
      />
      {query.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{query.error}</div>}
      {!feed ? (
        <SectionCard title="Risk Register Unavailable">
          <EmptyState title="Risk flags could not load" description="The risk source, current session, or assigned scope is temporarily unavailable." icon={AlertTriangle} />
        </SectionCard>
      ) : (
      <>
      {canManage && (
        <form action={generateRiskFlagsAction} className="flex justify-end">
          <Button type="submit" className="gap-2"><AlertTriangle className="h-4 w-4" /> Generate risk flags</Button>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Open risks" value={openFlags.length} tone="red" />
        <MetricTile label="High priority" value={openFlags.filter((flag) => ["high", "critical"].includes(flag.severity)).length} tone="amber" />
        <MetricTile label="Resolved" value={feed.riskFlags.filter((flag) => flag.status === "resolved").length} tone="emerald" />
      </div>

      <SectionCard title="Risk Register">
        {feed.riskFlags.length === 0 ? (
          <EmptyState title="No risk flags yet" description="Run deterministic risk generation after interventions, assessments, monitoring, and evidence records exist." icon={AlertTriangle} />
        ) : (
          <div className="space-y-3">
            {feed.riskFlags.map((flag) => {
              const resolve = resolveRiskFlagAction.bind(null, flag.id);
              return (
                <div key={flag.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{flag.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{flag.description}</p>
                      <p className="mt-2 text-xs text-slate-500">{flag.risk_type} • {flag.msmes?.business_name ?? flag.impact_programmes?.name ?? "portfolio"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge value={flag.severity} />
                      <StatusBadge value={flag.status} />
                    </div>
                  </div>
                  {canManage && flag.status === "open" && (
                    <form action={resolve} className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input name="resolution_note" className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Resolution note" />
                      <Button type="submit" variant="secondary" className="gap-2"><ShieldCheck className="h-4 w-4" /> Resolve</Button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
      </>
      )}
    </section>
  );
}
