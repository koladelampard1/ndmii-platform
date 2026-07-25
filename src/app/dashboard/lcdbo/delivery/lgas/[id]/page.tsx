import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { saveDeliveryActivityAction, submitDeliveryProgressUpdateAction, reviewDeliveryProgressUpdateAction } from "@/app/dashboard/lcdbo/delivery-geography-actions";
import { SuccessErrorBanner } from "@/components/lcdbo/lcdbo-delivery-components";
import { ActivityTable, ClusterPlanTable, ProgressUpdateTimeline, SmallInfo } from "@/components/lcdbo/lcdbo-delivery-geography-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { getLgaDeliveryPlan, getStateDeliveryPlan, listClusterDeliveryPlans, listDeliveryActivities, listGeographyReference, listProgressUpdates, requireLcdboGeographyDeliveryAccess } from "@/lib/data/lcdbo-delivery-geography";

export const dynamic = "force-dynamic";

export default async function LgaDeliveryPlanDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const access = await requireLcdboGeographyDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const plan = await getLgaDeliveryPlan(id, access.programme.id, access.supabase);
  if (!plan) notFound();
  const [parentState, clusters, activities, updates, reference] = await Promise.all([
    getStateDeliveryPlan(plan.state_plan_id, access.programme.id, access.supabase),
    listClusterDeliveryPlans({ programmeId: access.programme.id, lgaPlanId: plan.id, client: access.supabase }),
    listDeliveryActivities({ programmeId: access.programme.id, lgaPlanId: plan.id, client: access.supabase }),
    listProgressUpdates({ programmeId: access.programme.id, lgaPlanId: plan.id, client: access.supabase }),
    access.canManage ? listGeographyReference(access.supabase) : Promise.resolve({ users: [], institutions: [], states: [], lgas: [], clusters: [] }),
  ]);
  const userId = access.ctx.appUserId;
  const canOperateThisLga = access.canManage || plan.lga_delivery_lead_id === userId;
  const canViewThisLga = canOperateThisLga || parentState?.state_coordinator_id === userId || clusters.some((cluster) => cluster.cluster_manager_id === userId);
  if (!canViewThisLga) redirect("/access-denied");

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="LGA Delivery Plan" title={plan.title} description={`${plan.lga?.name ?? "LGA"} delivery operations under ${plan.state?.name ?? "state"} LCDBO planning.`} breadcrumbs={[{ label: "LGA plans", href: "/dashboard/lcdbo/delivery/lgas" }, { label: plan.statePlan?.plan_reference ?? "State plan", href: `/dashboard/lcdbo/delivery/states/${plan.state_plan_id}` }]} classification={{ classification: plan.metadata?.record_classification === "configured_target" ? "target" : "operational", label: plan.metadata?.record_classification === "configured_target" ? "Configured planning data" : "Live operational" }} actions={<Link href={`/dashboard/lcdbo/delivery/states/${plan.state_plan_id}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700">Parent state plan</Link>} />
      <SuccessErrorBanner success={query.success} error={query.error} />
      <div className="grid gap-4 md:grid-cols-4"><SmallInfo label="Activation" value={plan.activation_status} /><SmallInfo label="Approval" value={plan.approval_status} /><SmallInfo label="Health" value={plan.delivery_health} /><SmallInfo label="Progress" value={`${plan.progress_percentage}%`} /></div>
      <WorkspaceSection title="Delivery context"><div className="grid gap-4 md:grid-cols-3"><SmallInfo label="Delivery lead" value={plan.lead?.full_name ?? plan.lead?.email ?? "Unassigned"} /><SmallInfo label="Target communities" value={plan.target_communities.length ? plan.target_communities.join(", ") : "Not configured"} /><SmallInfo label="Reporting completeness" value={`${plan.reporting_completeness}%`} /></div></WorkspaceSection>
      <WorkspaceSection title="Related cluster delivery plans"><ClusterPlanTable rows={clusters} /></WorkspaceSection>
      <WorkspaceSection title="Local activities"><ActivityTable rows={activities} /></WorkspaceSection>
      {canOperateThisLga ? <ActivityForm statePlanId={plan.state_plan_id} lgaPlanId={plan.id} users={reference.users} redirectTo={`/dashboard/lcdbo/delivery/lgas/${plan.id}`} /> : null}
      {canOperateThisLga ? <ProgressForm lgaPlanId={plan.id} redirectTo={`/dashboard/lcdbo/delivery/lgas/${plan.id}`} /> : null}
      <WorkspaceSection title="Progress update history"><ProgressUpdateTimeline updates={updates} canManage={access.canManage} reviewAction={reviewDeliveryProgressUpdateAction} redirectTo={`/dashboard/lcdbo/delivery/lgas/${plan.id}`} /></WorkspaceSection>
    </WorkspacePage>
  );
}

function ActivityForm({ statePlanId, lgaPlanId, users, redirectTo }: { statePlanId: string; lgaPlanId: string; users: Array<{ id: string; full_name: string | null; email: string | null }>; redirectTo: string }) {
  return <WorkspaceSection title="Create LGA activity"><form action={saveDeliveryActivityAction} className="grid gap-3 md:grid-cols-3"><input type="hidden" name="redirect_to" value={redirectTo} /><input type="hidden" name="state_plan_id" value={statePlanId} /><input type="hidden" name="lga_plan_id" value={lgaPlanId} /><label className="text-sm font-bold text-slate-700 md:col-span-2">Title<input required name="title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Owner<select name="owner_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label><div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Save activity</button></div></form></WorkspaceSection>;
}

function ProgressForm({ lgaPlanId, redirectTo }: { lgaPlanId: string; redirectTo: string }) {
  return <WorkspaceSection title="Submit progress update"><form action={submitDeliveryProgressUpdateAction} className="grid gap-3 md:grid-cols-3"><input type="hidden" name="redirect_to" value={redirectTo} /><input type="hidden" name="lga_plan_id" value={lgaPlanId} /><label className="text-sm font-bold text-slate-700">Period start<input required type="date" name="reporting_period_start" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Period end<input required type="date" name="reporting_period_end" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Progress<input type="number" min="0" max="100" name="progress_percentage" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700 md:col-span-3">Summary<textarea required name="progress_summary" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Submit update</button></div></form></WorkspaceSection>;
}
