import Link from "next/link";
import { Activity, Building2, Factory, MapPinned, Route, ShieldCheck } from "lucide-react";
import { ExecutiveMetricCard, ExecutiveMetricGrid } from "@/components/workspace/workspace-metrics";
import { WorkspaceDataTable, type WorkspaceTableColumn } from "@/components/workspace/workspace-table";
import { ProgressBar, StatusBadge, humanize } from "@/components/lcdbo/lcdbo-delivery-components";
import type {
  ClusterPlan,
  DeliveryActivity,
  LgaPlan,
  ProgressUpdate,
  StatePlan,
} from "@/lib/data/lcdbo-delivery-geography";

export function GeographicDeliveryMetricGrid({ metrics }: { metrics: { geographicProgress: number; reportingCompleteness: number; statePlans: number; activeStatePlans: number; lgaPlans: number; activeLgaPlans: number; clusterPlans: number; activeClusterPlans: number; activities: number; overdueActivities: number; pendingUpdates: number } }) {
  return (
    <ExecutiveMetricGrid>
      <ExecutiveMetricCard label="Geographic progress" value={`${metrics.geographicProgress}%`} context="Average governed progress across active state, LGA and cluster plans." icon={ShieldCheck} classification={{ classification: "operational", label: "Calculated progress" }} />
      <ExecutiveMetricCard label="State plans" value={metrics.statePlans} context={`${metrics.activeStatePlans} active or mobilising operations. Reference geography remains separate.`} icon={MapPinned} classification={{ classification: "operational", label: "Delivery records" }} />
      <ExecutiveMetricCard label="LGA plans" value={metrics.lgaPlans} context={`${metrics.activeLgaPlans} active or mobilising LGA operations.`} icon={Route} classification={{ classification: "operational", label: "Delivery records" }} />
      <ExecutiveMetricCard label="Cluster plans" value={metrics.clusterPlans} context={`${metrics.activeClusterPlans} active or mobilising cluster operations.`} icon={Factory} classification={{ classification: "operational", label: "Delivery records" }} />
      <ExecutiveMetricCard label="Activities" value={metrics.activities} context={`${metrics.overdueActivities} overdue · ${metrics.pendingUpdates} updates awaiting review.`} icon={Activity} status={metrics.overdueActivities ? "critical" : metrics.pendingUpdates ? "attention" : "positive"} classification={{ classification: "operational", label: "Live operational" }} />
      <ExecutiveMetricCard label="Reporting completeness" value={`${metrics.reportingCompleteness}%`} context="Average reporting completeness configured on delivery plans." icon={Building2} classification={{ classification: "operational", label: "Governance quality" }} />
    </ExecutiveMetricGrid>
  );
}

export function StatePlanTable({ rows }: { rows: StatePlan[] }) {
  const columns: WorkspaceTableColumn<StatePlan>[] = [
    { key: "reference", header: "Reference", render: (row) => <Link href={`/dashboard/lcdbo/delivery/states/${row.id}`} className="font-black text-emerald-700 hover:underline">{row.plan_reference}</Link> },
    { key: "state", header: "State plan", render: (row) => <div><p className="font-black text-slate-900">{row.state?.name ?? row.title}</p><p className="mt-1 text-xs text-slate-500">{row.title}</p></div> },
    { key: "status", header: "Lifecycle", render: (row) => <div className="space-y-2"><StatusBadge value={row.activation_status} /><StatusBadge value={row.approval_status} /></div> },
    { key: "accountability", header: "Coordinator", render: (row) => <div><p className="font-bold text-slate-800">{row.coordinator?.full_name ?? row.coordinator?.email ?? "Unassigned"}</p><p className="mt-1 text-xs text-slate-500">{row.accountableInstitution?.name ?? "No institution assigned"}</p></div> },
    { key: "progress", header: "Progress", render: (row) => <ProgressBar value={row.progress_percentage} />, className: "min-w-44" },
    { key: "health", header: "Health", render: (row) => <StatusBadge value={row.delivery_health} /> },
  ];
  return <WorkspaceDataTable rows={rows} columns={columns} getRowKey={(row) => row.id} emptyTitle="No state delivery plans" emptyDescription="State delivery plans are created deliberately; reference geography alone is not operational coverage." />;
}

export function LgaPlanTable({ rows }: { rows: LgaPlan[] }) {
  const columns: WorkspaceTableColumn<LgaPlan>[] = [
    { key: "reference", header: "Reference", render: (row) => <Link href={`/dashboard/lcdbo/delivery/lgas/${row.id}`} className="font-black text-emerald-700 hover:underline">{row.plan_reference}</Link> },
    { key: "lga", header: "LGA plan", render: (row) => <div><p className="font-black text-slate-900">{row.lga?.name ?? row.title}</p><p className="mt-1 text-xs text-slate-500">{row.state?.name} · {row.statePlan?.plan_reference}</p></div> },
    { key: "status", header: "Lifecycle", render: (row) => <div className="space-y-2"><StatusBadge value={row.activation_status} /><StatusBadge value={row.approval_status} /></div> },
    { key: "lead", header: "Lead", render: (row) => row.lead?.full_name ?? row.lead?.email ?? "Unassigned" },
    { key: "progress", header: "Progress", render: (row) => <ProgressBar value={row.progress_percentage} />, className: "min-w-44" },
    { key: "health", header: "Health", render: (row) => <StatusBadge value={row.delivery_health} /> },
  ];
  return <WorkspaceDataTable rows={rows} columns={columns} getRowKey={(row) => row.id} emptyTitle="No LGA delivery plans" emptyDescription="Only approved or planned LGA operations appear here; national LGA reference coverage remains separate." />;
}

export function ClusterPlanTable({ rows }: { rows: ClusterPlan[] }) {
  const columns: WorkspaceTableColumn<ClusterPlan>[] = [
    { key: "reference", header: "Reference", render: (row) => <Link href={`/dashboard/lcdbo/delivery/clusters/${row.id}`} className="font-black text-emerald-700 hover:underline">{row.plan_reference}</Link> },
    { key: "cluster", header: "Cluster plan", render: (row) => <div><p className="font-black text-slate-900">{row.cluster?.name ?? row.title}</p><p className="mt-1 text-xs text-slate-500">{row.state?.name}{row.lga?.name ? ` · ${row.lga.name}` : ""} · {row.cluster?.sector ?? "Industrial cluster"}</p></div> },
    { key: "status", header: "Lifecycle", render: (row) => <div className="space-y-2"><StatusBadge value={row.activation_status} /><StatusBadge value={row.approval_status} /></div> },
    { key: "capacity", header: "Capacity", render: (row) => <div><p className="font-black text-slate-900">{row.liveMembershipCount ?? 0} live members</p><p className="mt-1 text-xs text-slate-500">{row.target_business_capacity ?? 0} configured capacity target</p></div> },
    { key: "progress", header: "Progress", render: (row) => <ProgressBar value={row.progress_percentage} />, className: "min-w-44" },
    { key: "health", header: "Health", render: (row) => <StatusBadge value={row.delivery_health} /> },
  ];
  return <WorkspaceDataTable rows={rows} columns={columns} getRowKey={(row) => row.id} emptyTitle="No cluster delivery plans" emptyDescription="Cluster plans must reference existing industrial clusters and do not duplicate live participation records." />;
}

export function ActivityTable({ rows }: { rows: DeliveryActivity[] }) {
  const columns: WorkspaceTableColumn<DeliveryActivity>[] = [
    { key: "reference", header: "Reference", render: (row) => <span className="font-black text-slate-900">{row.reference}</span> },
    { key: "activity", header: "Activity", render: (row) => <div><p className="font-black text-slate-900">{row.title}</p><p className="mt-1 text-xs text-slate-500">{humanize(row.activity_type)} · {row.clusterPlan?.title ?? row.lgaPlan?.title ?? row.statePlan?.title ?? "Delivery scope"}</p></div> },
    { key: "owner", header: "Owner", render: (row) => row.owner?.full_name ?? row.owner?.email ?? "Unassigned" },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "priority", header: "Priority", render: (row) => <StatusBadge value={row.priority} /> },
    { key: "progress", header: "Progress", render: (row) => <ProgressBar value={row.progress_percentage} />, className: "min-w-44" },
    { key: "end", header: "Planned end", render: (row) => row.planned_end_date ? new Date(row.planned_end_date).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Not set" },
  ];
  return <WorkspaceDataTable rows={rows} columns={columns} getRowKey={(row) => row.id} emptyTitle="No local activities" emptyDescription="Local delivery activities will appear here once assigned under a state, LGA or cluster plan." />;
}

export function ProgressUpdateTimeline({ updates, canManage, reviewAction, redirectTo }: { updates: ProgressUpdate[]; canManage: boolean; reviewAction: (formData: FormData) => void; redirectTo: string }) {
  if (!updates.length) return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">No progress updates have been submitted for this scope yet.</p>;
  return (
    <div className="space-y-3">
      {updates.map((update) => (
        <article key={update.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{update.reporting_period_start} → {update.reporting_period_end}</p>
              <h3 className="mt-1 font-black text-slate-900">{update.progress_summary}</h3>
              <p className="mt-1 text-xs text-slate-500">Submitted by {update.submitter?.full_name ?? update.submitter?.email ?? "Unknown"} · {new Date(update.submitted_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <div className="flex gap-2"><StatusBadge value={update.review_status} /><StatusBadge value={update.updated_health} /></div>
          </div>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <p><span className="font-black text-slate-700">Achievements:</span> {update.achievements ?? "Not specified"}</p>
            <p><span className="font-black text-slate-700">Support required:</span> {update.support_required ?? "Not specified"}</p>
          </div>
          {canManage && ["submitted", "under_review"].includes(update.review_status) ? (
            <form action={reviewAction} className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="redirect_to" value={redirectTo} />
              <input type="hidden" name="update_id" value={update.id} />
              <input name="review_notes" placeholder="Review notes" className="min-w-56 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <button name="review_status" value="approved" className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white">Approve</button>
              <button name="review_status" value="rejected" className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-black text-rose-700">Reject</button>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function SmallInfo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 font-black text-slate-900">{value ?? "Not configured"}</p></div>;
}
