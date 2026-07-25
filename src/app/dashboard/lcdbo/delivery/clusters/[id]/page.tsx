import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { saveDeliveryActivityAction, submitDeliveryProgressUpdateAction, reviewDeliveryProgressUpdateAction } from "@/app/dashboard/lcdbo/delivery-geography-actions";
import { SuccessErrorBanner } from "@/components/lcdbo/lcdbo-delivery-components";
import { ActivityTable, ProgressUpdateTimeline, SmallInfo } from "@/components/lcdbo/lcdbo-delivery-geography-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { getClusterDeliveryPlan, getLgaDeliveryPlan, getStateDeliveryPlan, listDeliveryActivities, listGeographyReference, listProgressUpdates, requireLcdboGeographyDeliveryAccess } from "@/lib/data/lcdbo-delivery-geography";

export const dynamic = "force-dynamic";

export default async function ClusterDeliveryPlanDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const access = await requireLcdboGeographyDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const plan = await getClusterDeliveryPlan(id, access.programme.id, access.supabase);
  if (!plan) notFound();
  const [parentState, parentLga, activities, updates, reference] = await Promise.all([
    getStateDeliveryPlan(plan.state_plan_id, access.programme.id, access.supabase),
    plan.lga_plan_id ? getLgaDeliveryPlan(plan.lga_plan_id, access.programme.id, access.supabase) : Promise.resolve(null),
    listDeliveryActivities({ programmeId: access.programme.id, clusterPlanId: plan.id, client: access.supabase }),
    listProgressUpdates({ programmeId: access.programme.id, clusterPlanId: plan.id, client: access.supabase }),
    access.canManage ? listGeographyReference(access.supabase) : Promise.resolve({ users: [], institutions: [], states: [], lgas: [], clusters: [] }),
  ]);
  const userId = access.ctx.appUserId;
  const canOperateThisCluster = access.canManage || plan.cluster_manager_id === userId;
  const canViewThisCluster = canOperateThisCluster || parentState?.state_coordinator_id === userId || parentLga?.lga_delivery_lead_id === userId;
  if (!canViewThisCluster) redirect("/access-denied");

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="Cluster Delivery Plan" title={plan.title} description={`${plan.cluster?.name ?? "Cluster"} implementation plan. Live membership and readiness remain derived from cluster operations records.`} breadcrumbs={[{ label: "Cluster plans", href: "/dashboard/lcdbo/delivery/clusters" }, { label: plan.statePlan?.plan_reference ?? "State plan", href: `/dashboard/lcdbo/delivery/states/${plan.state_plan_id}` }]} classification={{ classification: plan.metadata?.record_classification === "configured_target" ? "target" : "operational", label: plan.metadata?.record_classification === "configured_target" ? "Configured planning data" : "Live operational" }} actions={<><Link href={`/dashboard/lcdbo/clusters/${plan.cluster_id}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700">Open cluster profile</Link><Link href={`/dashboard/lcdbo/delivery/states/${plan.state_plan_id}`} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Parent state plan</Link></>} />
      <SuccessErrorBanner success={query.success} error={query.error} />
      <div className="grid gap-4 md:grid-cols-4"><SmallInfo label="Activation" value={plan.activation_status} /><SmallInfo label="Approval" value={plan.approval_status} /><SmallInfo label="Live members" value={plan.liveMembershipCount ?? 0} /><SmallInfo label="Configured capacity" value={plan.target_business_capacity ?? 0} /></div>
      <WorkspaceSection title="Cluster planning context" description="Targets and requirements are governed plan data; live participation, readiness and documents are maintained by the existing cluster operations workflow.">
        <div className="grid gap-4 md:grid-cols-3">
          <SmallInfo label="Cluster manager" value={plan.manager?.full_name ?? plan.manager?.email ?? "Unassigned"} />
          <SmallInfo label="Latest readiness" value={plan.latestReadiness ? plan.latestReadiness.replace(/_/g, " ") : "No approved assessment yet"} />
          <SmallInfo label="Progress" value={`${plan.progress_percentage}%`} />
          <SmallInfo label="Infrastructure requirements" value={plan.infrastructure_requirements ?? "Not configured"} />
          <SmallInfo label="Facilities requirements" value={plan.facilities_requirements ?? "Not configured"} />
          <SmallInfo label="Readiness gaps" value={plan.readiness_gaps ?? "Derived after assessments"} />
        </div>
      </WorkspaceSection>
      <WorkspaceSection title="Local activities"><ActivityTable rows={activities} /></WorkspaceSection>
      {canOperateThisCluster ? <ActivityForm statePlanId={plan.state_plan_id} lgaPlanId={plan.lga_plan_id} clusterPlanId={plan.id} users={reference.users} redirectTo={`/dashboard/lcdbo/delivery/clusters/${plan.id}`} /> : null}
      {canOperateThisCluster ? <ProgressForm clusterPlanId={plan.id} redirectTo={`/dashboard/lcdbo/delivery/clusters/${plan.id}`} /> : null}
      <WorkspaceSection title="Progress update history"><ProgressUpdateTimeline updates={updates} canManage={access.canManage} reviewAction={reviewDeliveryProgressUpdateAction} redirectTo={`/dashboard/lcdbo/delivery/clusters/${plan.id}`} /></WorkspaceSection>
    </WorkspacePage>
  );
}

function ActivityForm({ statePlanId, lgaPlanId, clusterPlanId, users, redirectTo }: { statePlanId: string; lgaPlanId: string | null; clusterPlanId: string; users: Array<{ id: string; full_name: string | null; email: string | null }>; redirectTo: string }) {
  return <WorkspaceSection title="Create cluster activity"><form action={saveDeliveryActivityAction} className="grid gap-3 md:grid-cols-3"><input type="hidden" name="redirect_to" value={redirectTo} /><input type="hidden" name="state_plan_id" value={statePlanId} />{lgaPlanId ? <input type="hidden" name="lga_plan_id" value={lgaPlanId} /> : null}<input type="hidden" name="cluster_plan_id" value={clusterPlanId} /><label className="text-sm font-bold text-slate-700 md:col-span-2">Title<input required name="title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Owner<select name="owner_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label><label className="text-sm font-bold text-slate-700 md:col-span-3">Expected output<input name="expected_output" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Save activity</button></div></form></WorkspaceSection>;
}

function ProgressForm({ clusterPlanId, redirectTo }: { clusterPlanId: string; redirectTo: string }) {
  return <WorkspaceSection title="Submit progress update"><form action={submitDeliveryProgressUpdateAction} className="grid gap-3 md:grid-cols-3"><input type="hidden" name="redirect_to" value={redirectTo} /><input type="hidden" name="cluster_plan_id" value={clusterPlanId} /><label className="text-sm font-bold text-slate-700">Period start<input required type="date" name="reporting_period_start" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Period end<input required type="date" name="reporting_period_end" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Progress<input type="number" min="0" max="100" name="progress_percentage" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700 md:col-span-3">Summary<textarea required name="progress_summary" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Submit update</button></div></form></WorkspaceSection>;
}
