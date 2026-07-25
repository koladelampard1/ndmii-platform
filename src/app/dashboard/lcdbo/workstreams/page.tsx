import Link from "next/link";
import { redirect } from "next/navigation";
import { saveWorkstreamAction } from "@/app/dashboard/lcdbo/delivery-actions";
import { ExportLink, SuccessErrorBanner, WorkstreamTable } from "@/components/lcdbo/lcdbo-delivery-components";
import { WorkspaceFilterBar } from "@/components/workspace/workspace-table";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { DELIVERY_PRIORITIES, getLcdboDeliverySnapshot, listLcdboDeliveryInstitutions, listLcdboDeliveryUsers, requireLcdboDeliveryAccess, WORKSTREAM_STATUSES } from "@/lib/data/lcdbo-delivery";

export const dynamic = "force-dynamic";

export default async function LcdboWorkstreamsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; priority?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboDeliverySnapshot(access.supabase);
  if (snapshot.unavailable) return <WorkspacePage><WorkspaceState type="not-configured" title="Workstream register unavailable" description="Apply the Sprint 1 delivery migration to enable this register." /></WorkspacePage>;
  const [users, institutions] = access.canManage ? await Promise.all([listLcdboDeliveryUsers(access.supabase), listLcdboDeliveryInstitutions(access.supabase)]) : [[], []];
  const filtered = snapshot.workstreams.filter((item) =>
    (!params.q || `${item.reference} ${item.name}`.toLowerCase().includes(params.q.toLowerCase())) &&
    (!params.status || item.status === params.status) &&
    (!params.priority || item.priority === params.priority)
  );

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="Programme Delivery" title="Workstream Register" description="Structure LCDBO delivery into accountable workstreams with owners, target dates, progress and RAG health." classification={{ classification: "operational", label: "Live operational" }} actions={<ExportLink href="/api/lcdbo/delivery/export/workstreams" />} />
      <SuccessErrorBanner success={params.success} error={params.error} />
      <WorkspaceFilterBar clearHref="/dashboard/lcdbo/workstreams" appliedFilters={[params.q ? `Search: ${params.q}` : "", params.status ? `Status: ${params.status}` : "", params.priority ? `Priority: ${params.priority}` : ""].filter(Boolean)}>
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold text-slate-700">Search<input name="q" defaultValue={params.q} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue={params.status ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{WORKSTREAM_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Priority<select name="priority" defaultValue={params.priority ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{DELIVERY_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Apply</button>
        </form>
      </WorkspaceFilterBar>
      {access.canManage ? (
        <WorkspaceSection title="Create or update workstream" description="Authorized programme managers can configure accountability and progress. Use an existing reference to update intentionally through the detail page.">
          <form action={saveWorkstreamAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="redirect_to" value="/dashboard/lcdbo/workstreams" />
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Name<input required name="name" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Priority<select name="priority" defaultValue="medium" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{DELIVERY_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Description<textarea name="description" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Accountable owner<select name="accountable_owner_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Delivery lead<select name="delivery_lead_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Institution<select name="accountable_institution_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Start date<input type="date" name="start_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Target date<input type="date" name="target_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Progress<input type="number" min="0" max="100" name="progress_percentage" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue="planned" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{WORKSTREAM_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Latest update<input name="latest_update" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Save workstream</button></div>
          </form>
        </WorkspaceSection>
      ) : null}
      <WorkspaceSection title="Workstreams" description={`${filtered.length} of ${snapshot.workstreams.length} workstream records shown.`}>
        {filtered.length ? <WorkstreamTable rows={filtered} /> : <WorkspaceState type="filtered-zero" title="No workstreams match these filters" description="Clear or adjust filters to view programme workstreams." action={<Link href="/dashboard/lcdbo/workstreams" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Clear filters</Link>} />}
      </WorkspaceSection>
    </WorkspacePage>
  );
}
