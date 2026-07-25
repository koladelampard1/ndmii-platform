import Link from "next/link";
import { redirect } from "next/navigation";
import { saveRaidItemAction } from "@/app/dashboard/lcdbo/delivery-actions";
import { ExportLink, RaidTable, SuccessErrorBanner } from "@/components/lcdbo/lcdbo-delivery-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { WorkspaceFilterBar } from "@/components/workspace/workspace-table";
import { getLcdboDeliverySnapshot, listLcdboDeliveryUsers, RAID_ESCALATION_STATUSES, RAID_SEVERITIES, RAID_STATUSES, RAID_TYPES, requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";
import { getLcdboGeographyDeliverySnapshot } from "@/lib/data/lcdbo-delivery-geography";

export const dynamic = "force-dynamic";

export default async function LcdboRaidPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string; severity?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboDeliverySnapshot(access.supabase);
  if (snapshot.unavailable) return <WorkspacePage><WorkspaceState type="not-configured" title="RAID register unavailable" description="Apply the Sprint 1 delivery migration to enable this register." /></WorkspacePage>;
  const geographic = await getLcdboGeographyDeliverySnapshot(access.supabase);
  const users = access.canManage ? await listLcdboDeliveryUsers(access.supabase) : [];
  const filtered = snapshot.raids.filter((item) => (!params.type || item.raid_type === params.type) && (!params.status || item.status === params.status) && (!params.severity || item.severity === params.severity));

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="Programme Governance" title="Risks, Issues, Assumptions and Dependencies" description="Track future risks, active issues, planning assumptions and dependencies with owners, severity, mitigation and escalation status." classification={{ classification: "operational", label: "Restricted programme records" }} actions={<ExportLink href="/api/lcdbo/delivery/export/raid" />} />
      <SuccessErrorBanner success={params.success} error={params.error} />
      <WorkspaceFilterBar clearHref="/dashboard/lcdbo/raid" appliedFilters={[params.type ? `Type: ${params.type}` : "", params.status ? `Status: ${params.status}` : "", params.severity ? `Severity: ${params.severity}` : ""].filter(Boolean)}>
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold text-slate-700">Type<select name="type" defaultValue={params.type ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{RAID_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue={params.status ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{RAID_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Severity<select name="severity" defaultValue={params.severity ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{RAID_SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Apply</button>
        </form>
      </WorkspaceFilterBar>
      {access.canManage ? (
        <WorkspaceSection title="Register RAID item" description="Risks describe potential future events. Issues describe active delivery problems requiring resolution.">
          <form action={saveRaidItemAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="redirect_to" value="/dashboard/lcdbo/raid" />
            <label className="text-sm font-bold text-slate-700">Type<select name="raid_type" defaultValue="risk" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{RAID_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Title<input required name="title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Workstream<select name="workstream_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Programme-level</option>{snapshot.workstreams.map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Delivery scope<select name="delivery_scope_type" defaultValue="national" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="national">National</option><option value="state">State plan</option><option value="lga">LGA plan</option><option value="cluster">Cluster plan</option><option value="workstream">Workstream</option><option value="partner">Partner</option></select></label>
            <label className="text-sm font-bold text-slate-700">State plan<select name="state_plan_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">No state scope</option>{geographic.statePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_reference} · {plan.state?.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">LGA plan<select name="lga_plan_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">No LGA scope</option>{geographic.lgaPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_reference} · {plan.lga?.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Cluster plan<select name="cluster_plan_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">No cluster scope</option>{geographic.clusterPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_reference} · {plan.cluster?.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Owner<select name="owner_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Severity<select name="severity" defaultValue="medium" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{RAID_SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Description<textarea required name="description" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Probability<select name="probability" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Not applicable</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label>
            <label className="text-sm font-bold text-slate-700">Impact<select name="impact" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Not applicable</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label>
            <label className="text-sm font-bold text-slate-700">Escalation<select name="escalation_status" defaultValue="none" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{RAID_ESCALATION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue="open" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{RAID_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Review date<input type="date" name="review_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Target resolution<input type="date" name="target_resolution_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Mitigation or resolution plan<input name="mitigation_plan" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Resolution notes<input name="resolution_notes" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Save RAID item</button></div>
          </form>
        </WorkspaceSection>
      ) : null}
      <WorkspaceSection title="RAID register" description={`${filtered.length} of ${snapshot.raids.length} records shown.`}>
        {filtered.length ? <RaidTable rows={filtered} /> : <WorkspaceState type="filtered-zero" title="No RAID records match these filters" description="Clear or adjust filters to view programme risks, issues, assumptions and dependencies." action={<Link href="/dashboard/lcdbo/raid" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Clear filters</Link>} />}
      </WorkspaceSection>
    </WorkspacePage>
  );
}
