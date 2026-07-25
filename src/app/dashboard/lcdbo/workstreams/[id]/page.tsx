import { notFound, redirect } from "next/navigation";
import { saveWorkstreamAction } from "@/app/dashboard/lcdbo/delivery-actions";
import { DeliveryItemTable, RaidTable, StatusBadge, WorkstreamTable } from "@/components/lcdbo/lcdbo-delivery-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { DELIVERY_PRIORITIES, getLcdboDeliverySnapshot, listLcdboDeliveryInstitutions, listLcdboDeliveryUsers, requireLcdboDeliveryAccess, WORKSTREAM_STATUSES } from "@/lib/data/lcdbo-delivery";

export const dynamic = "force-dynamic";

export default async function LcdboWorkstreamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboDeliverySnapshot(access.supabase);
  if (snapshot.unavailable) return <WorkspacePage><WorkspaceState type="not-configured" title="Workstream detail unavailable" description="Apply the Sprint 1 delivery migration to enable this record." /></WorkspacePage>;
  const workstream = snapshot.workstreams.find((item) => item.id === id);
  if (!workstream) notFound();
  const [users, institutions] = access.canManage ? await Promise.all([listLcdboDeliveryUsers(access.supabase), listLcdboDeliveryInstitutions(access.supabase)]) : [[], []];
  const items = snapshot.items.filter((item) => item.workstream_id === id);
  const raids = snapshot.raids.filter((item) => item.workstream_id === id);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow={workstream.reference}
        title={workstream.name}
        description={workstream.description ?? "Governed LCDBO workstream."}
        classification={{ classification: "operational", label: "Programme record" }}
        breadcrumbs={[{ label: "Programme Delivery", href: "/dashboard/lcdbo/delivery" }, { label: "Workstreams", href: "/dashboard/lcdbo/workstreams" }]}
      />
      <WorkspaceSection title="Workstream status" description="Current accountable owner, health, priority and governed progress.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Status</p><div className="mt-2"><StatusBadge value={workstream.status} /></div></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Health</p><div className="mt-2"><StatusBadge value={workstream.health} /></div></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Priority</p><div className="mt-2"><StatusBadge value={workstream.priority} /></div></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Owner</p><p className="mt-2 font-black text-slate-900">{workstream.accountableOwner?.full_name ?? workstream.accountableOwner?.email ?? "Unassigned"}</p></div>
        </div>
      </WorkspaceSection>
      {access.canManage ? (
        <WorkspaceSection title="Update workstream" description="Material updates generate LCDBO programme-delivery audit events.">
          <form action={saveWorkstreamAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="id" value={workstream.id} />
            <input type="hidden" name="reference" value={workstream.reference} />
            <input type="hidden" name="redirect_to" value={`/dashboard/lcdbo/workstreams/${workstream.id}`} />
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Name<input required name="name" defaultValue={workstream.name} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Priority<select name="priority" defaultValue={workstream.priority} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{DELIVERY_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Description<textarea name="description" rows={2} defaultValue={workstream.description ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Accountable owner<select name="accountable_owner_id" defaultValue={workstream.accountable_owner_id ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Delivery lead<select name="delivery_lead_id" defaultValue={workstream.delivery_lead_id ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Institution<select name="accountable_institution_id" defaultValue={workstream.accountable_institution_id ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Start date<input type="date" name="start_date" defaultValue={workstream.start_date ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Target date<input type="date" name="target_date" defaultValue={workstream.target_date ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Progress<input type="number" min="0" max="100" name="progress_percentage" defaultValue={workstream.progress_percentage} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue={workstream.status} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{WORKSTREAM_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Latest update<input name="latest_update" defaultValue={workstream.latest_update ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Update workstream</button></div>
          </form>
        </WorkspaceSection>
      ) : null}
      <WorkspaceSection title="Related delivery commitments"><DeliveryItemTable rows={items} /></WorkspaceSection>
      <WorkspaceSection title="Related RAID records"><RaidTable rows={raids} /></WorkspaceSection>
      <WorkspaceSection title="Source workstream"><WorkstreamTable rows={[workstream]} /></WorkspaceSection>
    </WorkspacePage>
  );
}
