import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { EvidenceLink } from "@/components/lcdbo/lcdbo-delivery-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";
import { getLcdboSprint3Snapshot, LCDBO_PILOT_READINESS_MODEL_VERSION } from "@/lib/data/lcdbo-delivery-intelligence";
import { savePilotReadinessAction } from "@/app/dashboard/lcdbo/executive-actions";

export const dynamic = "force-dynamic";

const outcomeClass: Record<string, string> = {
  not_ready: "bg-rose-50 text-rose-800 ring-rose-200",
  conditionally_ready: "bg-amber-50 text-amber-900 ring-amber-200",
  ready_for_controlled_pilot: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  active: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  paused: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default async function LcdboPilotReadinessPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; include_test?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const includeTestData = params.include_test === "true" && access.canExport;
  const snapshot = await getLcdboSprint3Snapshot({ client: access.supabase, includeTestData });
  const ready = snapshot.readiness.filter((item) => ["ready_for_controlled_pilot", "active"].includes(item.outcome)).length;

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Pilot readiness"
        title="Controlled implementation readiness"
        description="Explainable readiness assessment for state, LGA and cluster delivery plans. This is programme-delivery readiness, not MSME or cluster capability readiness."
        classification={{ classification: "estimate", label: "Governed readiness estimate" }}
        disclosure={`Model ${LCDBO_PILOT_READINESS_MODEL_VERSION}. Blocking dimensions prevent ready status; test/UAT plans are excluded by default.`}
      />
      {params.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Pilot readiness saved.</div> : null}
      {params.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">Pilot readiness could not be saved.</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">Assessed records</p><p className="mt-2 text-3xl font-black">{snapshot.readiness.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">Pilot-ready</p><p className="mt-2 text-3xl font-black text-emerald-700">{ready}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">Blocking issues</p><p className="mt-2 text-3xl font-black text-rose-700">{snapshot.readiness.reduce((sum, item) => sum + item.blockingIssues, 0)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">Excluded UAT</p><p className="mt-2 text-3xl font-black">{snapshot.productionCounts.excludedTest}</p></div>
      </div>
      <WorkspaceSection title="Readiness assessments" description="Each assessment exposes dimensions, blocking status, evidence needs and the operational record behind it.">
        {snapshot.readiness.length ? (
          <div className="space-y-4">
            {snapshot.readiness.map((item) => (
              <article key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{item.scopeType}</p><h2 className="mt-1 text-lg font-black text-slate-900">{item.title}</h2><p className="mt-1 text-xs text-slate-500">Classification: {item.classification.replaceAll("_", " ")}</p><div className="mt-3"><EvidenceLink type="pilot_readiness" id={item.key.split(":")[1]} /></div></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${outcomeClass[item.outcome]}`}>{item.outcome.replaceAll("_", " ")}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[0.25fr_0.75fr]">
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-3xl font-black text-slate-900">{item.score}%</p><p className="text-xs font-bold text-slate-500">Readiness score</p><p className="mt-2 text-xs text-rose-700">{item.blockingIssues} blocking issue(s)</p></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {item.dimensions.map((dimension) => (
                      <div key={dimension.key} className={`rounded-xl border p-3 ${dimension.met ? "border-emerald-100 bg-emerald-50" : dimension.blocking ? "border-rose-100 bg-rose-50" : "border-amber-100 bg-amber-50"}`}>
                        <div className="flex items-center gap-2">{dimension.met ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-rose-700" />}<p className="text-sm font-black text-slate-900">{dimension.requirement}</p></div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{dimension.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {access.canManage ? (
                  <form action={savePilotReadinessAction} className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
                    <input type="hidden" name="redirect_to" value="/dashboard/lcdbo/pilot-readiness" />
                    <input type="hidden" name="scope_type" value={item.scopeType} />
                    <input type="hidden" name="state_plan_id" value={item.scopeType === "state" ? item.key.split(":")[1] : ""} />
                    <input type="hidden" name="lga_plan_id" value={item.scopeType === "lga" ? item.key.split(":")[1] : ""} />
                    <input type="hidden" name="cluster_plan_id" value={item.scopeType === "cluster" ? item.key.split(":")[1] : ""} />
                    <input type="hidden" name="readiness_score" value={item.score} />
                    <input type="hidden" name="blocking_issue_count" value={item.blockingIssues} />
                    <select name="outcome" defaultValue={item.outcome} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <option value="not_ready">Not ready</option>
                      <option value="conditionally_ready">Conditionally ready</option>
                      <option value="ready_for_controlled_pilot">Ready for controlled pilot</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                    <select name="assessment_status" defaultValue={item.persisted?.assessment_status ?? "under_review"} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <option value="under_review">Under review</option>
                      <option value="approved">Approved</option>
                      <option value="changes_requested">Changes requested</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <input name="override_reason" placeholder="Override/reviewer reason where applicable" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white">Save readiness</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        ) : <WorkspaceState type="empty" title="No readiness records available" description="State, LGA or cluster delivery plans are required before pilot readiness can be assessed." />}
      </WorkspaceSection>
      <WorkspaceSection title="Readiness governance">
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><ShieldCheck className="mb-3 h-5 w-5" />A geography cannot be ready merely because a plan exists. Ownership, approval, activation status, reporting cadence, production classification and evidence readiness are all evaluated.</div>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
