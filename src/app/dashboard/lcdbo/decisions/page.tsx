import Link from "next/link";
import { redirect } from "next/navigation";
import { saveDecisionAction } from "@/app/dashboard/lcdbo/delivery-actions";
import { DecisionTable, ExportLink, SuccessErrorBanner } from "@/components/lcdbo/lcdbo-delivery-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { WorkspaceFilterBar } from "@/components/workspace/workspace-table";
import { DECISION_STATUSES, getLcdboDeliverySnapshot, listLcdboDeliveryUsers, requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";

export const dynamic = "force-dynamic";

export default async function LcdboDecisionsPage({ searchParams }: { searchParams: Promise<{ status?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboDeliverySnapshot(access.supabase);
  if (snapshot.unavailable) return <WorkspacePage><WorkspaceState type="not-configured" title="Decision register unavailable" description="Apply the Sprint 1 delivery migration to enable this register." /></WorkspacePage>;
  const users = access.canManage ? await listLcdboDeliveryUsers(access.supabase) : [];
  const filtered = snapshot.decisions.filter((item) => !params.status || item.status === params.status);

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="Programme Governance" title="Decision Register" description="Track decisions required for LCDBO delivery without turning the workspace into a meeting-management system." classification={{ classification: "operational", label: "Restricted programme records" }} actions={<ExportLink href="/api/lcdbo/delivery/export/decisions" />} />
      <SuccessErrorBanner success={params.success} error={params.error} />
      <WorkspaceFilterBar clearHref="/dashboard/lcdbo/decisions" appliedFilters={[params.status ? `Status: ${params.status}` : ""].filter(Boolean)}>
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue={params.status ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{DECISION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Apply</button>
        </form>
      </WorkspaceFilterBar>
      {access.canManage ? (
        <WorkspaceSection title="Create decision record" description="Use this for formal programme decisions requiring an owner, deadline, outcome and follow-up.">
          <form action={saveDecisionAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="redirect_to" value="/dashboard/lcdbo/decisions" />
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Decision required<input required name="decision_required" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue="pending" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{DECISION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Workstream<select name="workstream_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Programme-level</option>{snapshot.workstreams.map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Decision owner<select name="decision_owner_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Due date<input type="date" name="due_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Context<textarea name="context" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Recommendation<textarea name="recommendation" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Decision date<input type="date" name="decision_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Decision outcome<input name="decision_outcome" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Follow-up action<input name="follow_up_action" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Follow-up owner<select name="follow_up_owner_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Save decision</button></div>
          </form>
        </WorkspaceSection>
      ) : null}
      <WorkspaceSection title="Decision register" description={`${filtered.length} of ${snapshot.decisions.length} records shown.`}>
        {filtered.length ? <DecisionTable rows={filtered} /> : <WorkspaceState type="filtered-zero" title="No decisions match these filters" description="Clear or adjust filters to view decision records." action={<Link href="/dashboard/lcdbo/decisions" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Clear filters</Link>} />}
      </WorkspaceSection>
    </WorkspacePage>
  );
}
