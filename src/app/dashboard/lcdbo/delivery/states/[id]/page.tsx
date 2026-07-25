import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { saveDeliveryActivityAction, submitDeliveryProgressUpdateAction, reviewDeliveryProgressUpdateAction } from "@/app/dashboard/lcdbo/delivery-geography-actions";
import { SuccessErrorBanner } from "@/components/lcdbo/lcdbo-delivery-components";
import { ActivityTable, ClusterPlanTable, LgaPlanTable, ProgressUpdateTimeline, SmallInfo } from "@/components/lcdbo/lcdbo-delivery-geography-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection } from "@/components/workspace/workspace-page";
import { getStateDeliveryPlan, listClusterDeliveryPlans, listDeliveryActivities, listGeographyReference, listLgaDeliveryPlans, listProgressUpdates, requireLcdboGeographyDeliveryAccess } from "@/lib/data/lcdbo-delivery-geography";

export const dynamic = "force-dynamic";

export default async function StateDeliveryPlanDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const access = await requireLcdboGeographyDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const plan = await getStateDeliveryPlan(id, access.programme.id, access.supabase).catch((error) => {
    if (String(error?.message ?? "").includes("does not exist")) return null;
    throw error;
  });
  if (!plan) notFound();
  const [lgas, clusters, activities, updates, reference] = await Promise.all([
    listLgaDeliveryPlans({ programmeId: access.programme.id, statePlanId: plan.id, client: access.supabase }),
    listClusterDeliveryPlans({ programmeId: access.programme.id, statePlanId: plan.id, client: access.supabase }),
    listDeliveryActivities({ programmeId: access.programme.id, statePlanId: plan.id, client: access.supabase }),
    listProgressUpdates({ programmeId: access.programme.id, statePlanId: plan.id, client: access.supabase }),
    access.canManage ? listGeographyReference(access.supabase) : Promise.resolve({ users: [], institutions: [], states: [], lgas: [], clusters: [] }),
  ]);
  const userId = access.ctx.appUserId;
  const canOperateThisState = access.canManage || plan.state_coordinator_id === userId;
  const canViewThisState = canOperateThisState || lgas.some((lga) => lga.lga_delivery_lead_id === userId) || clusters.some((cluster) => cluster.cluster_manager_id === userId);
  if (!canViewThisState) redirect("/access-denied");

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="State Delivery Plan"
        title={plan.title}
        description={`${plan.state?.name ?? "State"} operational delivery plan for LCDBO. State intelligence remains available separately from this delivery plan.`}
        breadcrumbs={[{ label: "State plans", href: "/dashboard/lcdbo/delivery/states" }]}
        classification={{ classification: plan.metadata?.record_classification === "configured_target" ? "target" : "operational", label: plan.metadata?.record_classification === "configured_target" ? "Configured planning data" : "Live operational" }}
        actions={<><Link href={`/dashboard/lcdbo/states/${slugify(plan.state?.name ?? "")}`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700">Open state intelligence</Link><Link href="/dashboard/lcdbo/delivery/lgas" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Open LGA plans</Link></>}
      />
      <SuccessErrorBanner success={query.success} error={query.error} />
      <div className="grid gap-4 md:grid-cols-4">
        <SmallInfo label="Activation" value={plan.activation_status} />
        <SmallInfo label="Approval" value={plan.approval_status} />
        <SmallInfo label="Health" value={plan.delivery_health} />
        <SmallInfo label="Progress" value={`${plan.progress_percentage}%`} />
      </div>
      <WorkspaceSection title="Delivery context" description="Configured targets are planning records. Actual participation is derived from enrolment, cluster and activity records.">
        <div className="grid gap-4 md:grid-cols-3">
          <SmallInfo label="Coordinator" value={plan.coordinator?.full_name ?? plan.coordinator?.email ?? "Unassigned"} />
          <SmallInfo label="Priority sectors" value={plan.priority_sectors.length ? plan.priority_sectors.join(", ") : "Not configured"} />
          <SmallInfo label="Reporting completeness" value={`${plan.reporting_completeness}%`} />
        </div>
      </WorkspaceSection>
      <WorkspaceSection title="Related LGA delivery plans" actions={<Link href="/dashboard/lcdbo/delivery/lgas" className="text-sm font-black text-emerald-700">Open register</Link>}><LgaPlanTable rows={lgas} /></WorkspaceSection>
      <WorkspaceSection title="Related cluster delivery plans" actions={<Link href="/dashboard/lcdbo/delivery/clusters" className="text-sm font-black text-emerald-700">Open register</Link>}><ClusterPlanTable rows={clusters} /></WorkspaceSection>
      <WorkspaceSection title="Local activities"><ActivityTable rows={activities} /></WorkspaceSection>
      {canOperateThisState ? <ActivityForm statePlanId={plan.id} users={reference.users} redirectTo={`/dashboard/lcdbo/delivery/states/${plan.id}`} /> : null}
      {canOperateThisState ? <ProgressForm statePlanId={plan.id} redirectTo={`/dashboard/lcdbo/delivery/states/${plan.id}`} /> : null}
      <WorkspaceSection title="Progress update history" description="Updates are append-only. Approved updates may synchronise current progress, but history remains intact.">
        <ProgressUpdateTimeline updates={updates} canManage={access.canManage} reviewAction={reviewDeliveryProgressUpdateAction} redirectTo={`/dashboard/lcdbo/delivery/states/${plan.id}`} />
      </WorkspaceSection>
    </WorkspacePage>
  );
}

function ActivityForm({ statePlanId, users, redirectTo }: { statePlanId: string; users: Array<{ id: string; full_name: string | null; email: string | null }>; redirectTo: string }) {
  return <WorkspaceSection title="Create state activity" description="Activities track local work beneath delivery plans; they are not milestones."><form action={saveDeliveryActivityAction} className="grid gap-3 md:grid-cols-3"><input type="hidden" name="redirect_to" value={redirectTo} /><input type="hidden" name="state_plan_id" value={statePlanId} /><label className="text-sm font-bold text-slate-700 md:col-span-2">Title<input required name="title" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Owner<select name="owner_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name ?? user.email}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Planned end<input type="date" name="planned_end_date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Progress<input type="number" min="0" max="100" name="progress_percentage" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Location<input name="location_reference" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Save activity</button></div></form></WorkspaceSection>;
}

function ProgressForm({ statePlanId, redirectTo }: { statePlanId: string; redirectTo: string }) {
  return <WorkspaceSection title="Submit progress update" description="Submitted updates preserve history and require review before becoming governed progress."><form action={submitDeliveryProgressUpdateAction} className="grid gap-3 md:grid-cols-3"><input type="hidden" name="redirect_to" value={redirectTo} /><input type="hidden" name="state_plan_id" value={statePlanId} /><label className="text-sm font-bold text-slate-700">Period start<input required type="date" name="reporting_period_start" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Period end<input required type="date" name="reporting_period_end" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">Progress<input type="number" min="0" max="100" name="progress_percentage" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700 md:col-span-3">Summary<textarea required name="progress_summary" rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Submit update</button></div></form></WorkspaceSection>;
}

function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
