import { redirect } from "next/navigation";
import { saveClusterDeliveryPlanAction } from "@/app/dashboard/lcdbo/delivery-geography-actions";
import { ExportLink, SuccessErrorBanner } from "@/components/lcdbo/lcdbo-delivery-components";
import { ClusterPlanTable, GeographicDeliveryMetricGrid } from "@/components/lcdbo/lcdbo-delivery-geography-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { WorkspaceFilterBar } from "@/components/workspace/workspace-table";
import { getLcdboGeographyDeliverySnapshot, listGeographyReference, PLAN_ACTIVATION_STATUSES, PLAN_APPROVAL_STATUSES, requireLcdboGeographyDeliveryAccess } from "@/lib/data/lcdbo-delivery-geography";

export const dynamic = "force-dynamic";

export default async function LcdboClusterDeliveryPlansPage({ searchParams }: { searchParams: Promise<{ q?: string; activation?: string; approval?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboGeographyDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboGeographyDeliverySnapshot(access.supabase);
  if (snapshot.unavailable) return <WorkspacePage><WorkspaceState type="not-configured" title="Cluster delivery planning is not configured yet" description="Apply the LCDBO Programme Delivery Core Sprint 2 migration." /></WorkspacePage>;
  const reference = access.canManage ? await listGeographyReference(access.supabase) : { users: [], institutions: [], states: [], lgas: [], clusters: [] };
  const userId = access.ctx.appUserId;
  const visibleClusterPlanIds = new Set(snapshot.clusterPlans.filter((plan) =>
    access.canManage
    || plan.cluster_manager_id === userId
    || snapshot.statePlans.some((state) => state.id === plan.state_plan_id && state.state_coordinator_id === userId)
    || snapshot.lgaPlans.some((lga) => plan.lga_plan_id === lga.id && lga.lga_delivery_lead_id === userId)
  ).map((plan) => plan.id));
  const filtered = snapshot.clusterPlans.filter((plan) =>
    visibleClusterPlanIds.has(plan.id) &&
    (!params.q || `${plan.plan_reference} ${plan.title} ${plan.cluster?.name} ${plan.state?.name}`.toLowerCase().includes(params.q.toLowerCase())) &&
    (!params.activation || plan.activation_status === params.activation) &&
    (!params.approval || plan.approval_status === params.approval)
  );

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="Cluster Delivery" title="Cluster Delivery Plans" description="Govern industrial cluster implementation plans while deriving membership, readiness and participation data from the live cluster operations records." classification={{ classification: "operational", label: "Delivery records" }} actions={<ExportLink href="/api/lcdbo/delivery/export/clusters" />} />
      <SuccessErrorBanner success={params.success} error={params.error} />
      <GeographicDeliveryMetricGrid metrics={snapshot.metrics} />
      <WorkspaceFilterBar clearHref="/dashboard/lcdbo/delivery/clusters" appliedFilters={[params.q ? `Search: ${params.q}` : "", params.activation ? `Activation: ${params.activation}` : "", params.approval ? `Approval: ${params.approval}` : ""].filter(Boolean)}>
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold text-slate-700">Search<input name="q" defaultValue={params.q} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-sm font-bold text-slate-700">Activation<select name="activation" defaultValue={params.activation ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{PLAN_ACTIVATION_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Approval<select name="approval" defaultValue={params.approval ?? ""} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{PLAN_APPROVAL_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Apply</button>
        </form>
      </WorkspaceFilterBar>
      {access.canManage ? (
        <WorkspaceSection title="Create cluster delivery plan" description="Cluster plans must reference an existing industrial cluster and a valid parent state plan. Live membership is derived from cluster members.">
          <form action={saveClusterDeliveryPlanAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="redirect_to" value="/dashboard/lcdbo/delivery/clusters" />
            <label className="text-sm font-bold text-slate-700">State plan<select required name="state_plan_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Select state plan</option>{snapshot.statePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_reference} · {plan.state?.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">LGA plan<select name="lga_plan_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">No LGA plan</option>{snapshot.lgaPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_reference} · {plan.lga?.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">State<select required name="state_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Select state</option>{reference.states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">LGA<select name="lga_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">No LGA</option>{reference.lgas.map((lga) => <option key={lga.id} value={lga.id}>{lga.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Industrial cluster<select required name="cluster_id" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Select cluster</option>{reference.clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Cluster manager<select name="cluster_manager_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{reference.users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-2">Plan title<input required name="title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Capacity target<input type="number" min="0" name="target_business_capacity" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">Activation<select name="activation_status" defaultValue="planned" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{PLAN_ACTIVATION_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Approval<select name="approval_status" defaultValue="draft" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">{PLAN_APPROVAL_STATUSES.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Progress<input type="number" min="0" max="100" name="progress_percentage" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700 md:col-span-3">Infrastructure requirements<textarea name="infrastructure_requirements" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
            <div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Save cluster plan</button></div>
          </form>
        </WorkspaceSection>
      ) : null}
      <WorkspaceSection title="Cluster delivery register" description={`${filtered.length} configured cluster plans shown.`}>
        <ClusterPlanTable rows={filtered} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}
