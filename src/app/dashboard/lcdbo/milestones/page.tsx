import Link from "next/link";
import { redirect } from "next/navigation";
import { saveDeliveryItemAction } from "@/app/dashboard/lcdbo/delivery-actions";
import { DeliveryItemTable, ExportLink, SuccessErrorBanner } from "@/components/lcdbo/lcdbo-delivery-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { WorkspaceFilterBar } from "@/components/workspace/workspace-table";
import { DELIVERY_ITEM_STATUSES, DELIVERY_PRIORITIES, getLcdboDeliverySnapshot, listLcdboDeliveryInstitutions, listLcdboDeliveryUsers, requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";

export const dynamic = "force-dynamic";

export default async function LcdboMilestonesPage({ searchParams }: { searchParams: Promise<{ type?: "milestone" | "deliverable"; status?: string; priority?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboDeliverySnapshot(access.supabase);
  if (snapshot.unavailable) return <WorkspacePage><WorkspaceState type="not-configured" title="Milestones unavailable" description="Apply the Sprint 1 delivery migration to enable this register." /></WorkspacePage>;
  const [users, institutions] = access.canManage ? await Promise.all([listLcdboDeliveryUsers(access.supabase), listLcdboDeliveryInstitutions(access.supabase)]) : [[], []];
  const filtered = snapshot.items.filter((item) => (!params.type || item.item_type === params.type) && (!params.status || item.status === params.status) && (!params.priority || item.priority === params.priority));

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="Programme Delivery" title="Milestones and Deliverables" description="Governed commitments, deadlines, evidence requirements and completion status across LCDBO delivery." classification={{ classification: "operational", label: "Live operational" }} actions={<ExportLink href="/api/lcdbo/delivery/export/milestones" />} />
      <SuccessErrorBanner success={params.success} error={params.error} />
      <WorkspaceFilterBar clearHref="/dashboard/lcdbo/milestones" appliedFilters={[params.type ? `Type: ${params.type}` : "", params.status ? `Status: ${params.status}` : "", params.priority ? `Priority: ${params.priority}` : ""].filter(Boolean)}>
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold text-slate-700">Type<select name="type" defaultValue={params.type ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option><option value="milestone">Milestone</option><option value="deliverable">Deliverable</option></select></label>
          <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue={params.status ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{DELIVERY_ITEM_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Priority<select name="priority" defaultValue={params.priority ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{DELIVERY_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Apply</button>
        </form>
      </WorkspaceFilterBar>
      {access.canManage ? (
        <WorkspaceSection title="Create milestone or deliverable" description="Use milestones for governed dates and deliverables for concrete outputs requiring completion evidence.">
          <form action={saveDeliveryItemAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="redirect_to" value="/dashboard/lcdbo/milestones" />
            <label className="text-sm font-bold text-slate-700">Type<select name="item_type" defaultValue="milestone" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="milestone">Milestone</option><option value="deliverable">Deliverable</option></select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Title<input required name="title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Workstream<select name="workstream_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Programme-level</option>{snapshot.workstreams.map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Owner<select name="owner_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Institution<select name="supporting_institution_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">None</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Description<textarea name="description" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Start date<input type="date" name="start_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Due date<input type="date" name="due_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Progress<input type="number" min="0" max="100" name="progress_percentage" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue="planned" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{DELIVERY_ITEM_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Priority<select name="priority" defaultValue="medium" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{DELIVERY_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="flex items-center gap-2 pt-8 text-sm font-bold text-slate-700"><input type="checkbox" name="approval_required" className="rounded border-slate-300" />Approval required</label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Evidence requirement<input name="evidence_requirement" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Blocker reason<input name="blocker_reason" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Latest update<input name="latest_update" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Save commitment</button></div>
          </form>
        </WorkspaceSection>
      ) : null}
      <WorkspaceSection title="Commitment register" description={`${filtered.length} of ${snapshot.items.length} records shown.`}>
        {filtered.length ? <DeliveryItemTable rows={filtered} /> : <WorkspaceState type="filtered-zero" title="No commitments match these filters" description="Clear or adjust filters to view governed milestones and deliverables." action={<Link href="/dashboard/lcdbo/milestones" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Clear filters</Link>} />}
      </WorkspaceSection>
    </WorkspacePage>
  );
}
