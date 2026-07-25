import { redirect } from "next/navigation";
import { ActivityTable, ClusterPlanTable, LgaPlanTable, ProgressUpdateTimeline, StatePlanTable } from "@/components/lcdbo/lcdbo-delivery-geography-components";
import { ExportLink, SuccessErrorBanner } from "@/components/lcdbo/lcdbo-delivery-components";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { getMyLcdboDeliveryWork, requireLcdboGeographyDeliveryAccess } from "@/lib/data/lcdbo-delivery-geography";
import { reviewDeliveryProgressUpdateAction } from "@/app/dashboard/lcdbo/delivery-geography-actions";

export const dynamic = "force-dynamic";

export default async function LcdboMyWorkPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboGeographyDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const work = await getMyLcdboDeliveryWork({ access }).catch((error) => {
    if (String(error?.message ?? "").includes("does not exist")) return null;
    throw error;
  });
  if (!work) return <WorkspacePage><WorkspaceState type="not-configured" title="My Work is not configured yet" description="Apply the LCDBO Programme Delivery Core Sprint 2 migration to enable assignment-scoped workload views." /></WorkspacePage>;
  const total = work.statePlans.length + work.lgaPlans.length + work.clusterPlans.length + work.activities.length + work.updatesAwaitingReview.length;

  return (
    <WorkspacePage>
      <WorkspacePageHeader eyebrow="Assignment-scoped delivery" title="My Work" description="A role-aware workload derived from actual LCDBO plan ownership, activity assignments and progress updates awaiting review." classification={{ classification: "operational", label: "Personal workload" }} actions={access.canExport ? <ExportLink href="/api/lcdbo/delivery/export/my-work" /> : null} />
      <SuccessErrorBanner success={params.success} error={params.error} />
      {!total ? <WorkspaceState type="empty" title="No assigned LCDBO delivery work" description="This view only shows records explicitly assigned to you or awaiting your review. It does not treat all programme records as personal work." /> : null}
      <WorkspaceSection title="My state plans" description="State plans where you are configured as coordinator."><StatePlanTable rows={work.statePlans} /></WorkspaceSection>
      <WorkspaceSection title="My LGA plans" description="LGA plans where you are configured as delivery lead."><LgaPlanTable rows={work.lgaPlans} /></WorkspaceSection>
      <WorkspaceSection title="My cluster plans" description="Cluster plans where you are configured as cluster manager."><ClusterPlanTable rows={work.clusterPlans} /></WorkspaceSection>
      <WorkspaceSection title="My activities" description={`${work.overdueActivities.length} overdue assigned activit${work.overdueActivities.length === 1 ? "y" : "ies"}.`}><ActivityTable rows={work.activities} /></WorkspaceSection>
      {access.canManage ? (
        <WorkspaceSection title="Updates awaiting review" description="Only updates submitted by someone else can be approved.">
          <ProgressUpdateTimeline updates={work.updatesAwaitingReview} canManage={access.canManage} reviewAction={reviewDeliveryProgressUpdateAction} redirectTo="/dashboard/lcdbo/my-work" />
        </WorkspaceSection>
      ) : null}
    </WorkspacePage>
  );
}
