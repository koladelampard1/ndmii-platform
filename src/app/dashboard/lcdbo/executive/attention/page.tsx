import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, ClipboardCheck, ShieldAlert } from "lucide-react";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";
import { getLcdboSprint3Snapshot } from "@/lib/data/lcdbo-delivery-intelligence";

export const dynamic = "force-dynamic";

const severityClass = {
  critical: "bg-rose-100 text-rose-800 ring-rose-200",
  high: "bg-orange-100 text-orange-800 ring-orange-200",
  medium: "bg-amber-100 text-amber-900 ring-amber-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default async function LcdboExecutiveAttentionPage({ searchParams }: { searchParams: Promise<{ include_test?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const includeTestData = params.include_test === "true" && access.canExport;
  const snapshot = await getLcdboSprint3Snapshot({ client: access.supabase, includeTestData });

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Executive attention"
        title="Exceptions, escalations and delivery blockers"
        description="A traceable view of the records most likely to require executive action. No duplicate decisions are created automatically."
        classification={{ classification: includeTestData ? "unavailable" : "aggregate", label: includeTestData ? "Includes test/UAT" : "Aggregate intelligence" }}
        disclosure={`This view excludes UAT/test records by default. ${snapshot.productionCounts.excludedTest} test/UAT record(s) were excluded from the current calculation.`}
        actions={<Link href="/dashboard/lcdbo/decisions" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Open decision register<ArrowRight className="h-4 w-4" /></Link>}
      />
      {snapshot.deliveryUnavailable || snapshot.geographyUnavailable ? <WorkspaceState type="not-configured" title="Delivery schema is incomplete" description="Apply Sprint 1 and Sprint 2 migrations before relying on executive attention calculations." /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {["critical", "high", "medium", "low"].map((severity) => (
          <div key={severity} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{severity}</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{snapshot.attention.filter((item) => item.severity === severity).length}</p>
          </div>
        ))}
      </div>
      <WorkspaceSection title="Executive attention queue" description="Each item links back to its source register so leadership can move from a signal to the record behind it.">
        {snapshot.attention.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.1em] text-slate-500">
                <tr><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Exception</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Classification</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {snapshot.attention.map((item) => (
                  <tr key={`${item.category}-${item.id}`}>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${severityClass[item.severity]}`}>{item.severity}</span></td>
                    <td className="px-4 py-3"><p className="font-black text-slate-900">{item.title}</p><p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{item.detail}</p></td>
                    <td className="px-4 py-3 text-slate-600">{item.source}</td>
                    <td className="px-4 py-3 text-slate-600">{item.classification.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3"><Link href={item.href} className="inline-flex items-center gap-2 font-black text-emerald-700">Open record<ArrowRight className="h-4 w-4" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <WorkspaceState type="empty" title="No executive exceptions" description="No overdue, blocked, critical, stale or readiness-blocked items were found in the current governed dataset." />}
      </WorkspaceSection>
      <WorkspaceSection title="Decision governance" description="Escalations should be resolved through the existing decision register rather than a parallel executive-decision table.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><ClipboardCheck className="mb-3 h-5 w-5" />Use the decision register to capture owner, recommendation, due date, outcome and follow-up action.</div>
          <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><ShieldAlert className="mb-3 h-5 w-5" />Health calculations do not create decisions automatically; explicit action prevents duplicate escalations.</div>
        </div>
      </WorkspaceSection>
      {includeTestData ? <WorkspaceSection><div className="flex gap-3 text-sm text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" />Diagnostic mode includes test/UAT records and must not be used for production reporting.</div></WorkspaceSection> : null}
    </WorkspacePage>
  );
}
