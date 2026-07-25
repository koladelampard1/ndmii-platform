import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Flag, GitBranch, ShieldCheck } from "lucide-react";
import { ExecutiveMetricCard, ExecutiveMetricGrid } from "@/components/workspace/workspace-metrics";
import { WorkspaceDataTable, type WorkspaceTableColumn } from "@/components/workspace/workspace-table";
import type {
  LcdboDecision,
  LcdboDeliveryItem,
  LcdboRaidItem,
  LcdboWorkstream,
} from "@/lib/data/lcdbo-delivery";

export function humanize(value: string | null | undefined) {
  return String(value ?? "not set").replace(/_/g, " ");
}

export function statusTone(status: string) {
  if (["completed", "decided", "resolved", "closed", "green", "active"].includes(status)) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (["blocked", "cancelled", "critical", "red"].includes(status)) return "bg-rose-50 text-rose-800 ring-rose-200";
  if (["at_risk", "submitted", "escalated", "high", "amber", "leadership"].includes(status)) return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1 ${statusTone(value)}`}>{label ?? humanize(value)}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="h-2 rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs font-bold text-slate-500">{width}% governed progress</p>
    </div>
  );
}

export function LcdboDeliveryMetricGrid({ metrics }: { metrics: { governedProgress: number; workstreamCount: number; overdueItems: number; criticalRaids: number; pendingDecisions: number; dueSoon: number } }) {
  return (
    <ExecutiveMetricGrid>
      <ExecutiveMetricCard label="Governed progress" value={`${metrics.governedProgress}%`} context="Derived from active milestone and deliverable progress." icon={ShieldCheck} classification={{ classification: "operational", label: "Live operational" }} />
      <ExecutiveMetricCard label="Workstreams" value={metrics.workstreamCount} context="Configured delivery workstreams in the LCDBO programme." icon={GitBranch} classification={{ classification: "operational", label: "Programme records" }} />
      <ExecutiveMetricCard label="Overdue commitments" value={metrics.overdueItems} context={`${metrics.dueSoon} due in the next 30 days.`} icon={CalendarDays} status={metrics.overdueItems ? "critical" : "positive"} classification={{ classification: "operational", label: "Live operational" }} />
      <ExecutiveMetricCard label="Critical governance items" value={metrics.criticalRaids + metrics.pendingDecisions} context={`${metrics.criticalRaids} critical RAID · ${metrics.pendingDecisions} pending decisions.`} icon={AlertTriangle} status={metrics.criticalRaids ? "critical" : metrics.pendingDecisions ? "attention" : "positive"} classification={{ classification: "operational", label: "Live operational" }} />
    </ExecutiveMetricGrid>
  );
}

export function WorkstreamTable({ rows }: { rows: LcdboWorkstream[] }) {
  const columns: WorkspaceTableColumn<LcdboWorkstream>[] = [
    { key: "reference", header: "Reference", render: (row) => <Link href={`/dashboard/lcdbo/workstreams/${row.id}`} className="font-black text-emerald-700 hover:underline">{row.reference}</Link> },
    { key: "name", header: "Workstream", render: (row) => <div><p className="font-black text-slate-900">{row.name}</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{row.description}</p></div> },
    { key: "owner", header: "Accountability", render: (row) => <div><p className="font-bold text-slate-800">{row.accountableOwner?.full_name ?? row.accountableOwner?.email ?? "Unassigned"}</p><p className="mt-1 text-xs text-slate-500">{row.accountableInstitution?.name ?? "No institution assigned"}</p></div> },
    { key: "status", header: "Status", render: (row) => <div className="space-y-2"><StatusBadge value={row.status} /><StatusBadge value={row.health} /></div> },
    { key: "progress", header: "Progress", render: (row) => <ProgressBar value={row.progress_percentage} />, className: "min-w-44" },
    { key: "target", header: "Target", render: (row) => row.target_date ? new Date(row.target_date).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Not set" },
  ];
  return <WorkspaceDataTable rows={rows} columns={columns} getRowKey={(row) => row.id} emptyTitle="No workstreams yet" emptyDescription="Create the first governed LCDBO workstream to begin programme delivery tracking." />;
}

export function DeliveryItemTable({ rows }: { rows: LcdboDeliveryItem[] }) {
  const columns: WorkspaceTableColumn<LcdboDeliveryItem>[] = [
    { key: "reference", header: "Reference", render: (row) => <span className="font-black text-slate-900">{row.reference}</span> },
    { key: "title", header: "Commitment", render: (row) => <div><p className="font-black text-slate-900">{row.title}</p><p className="mt-1 text-xs capitalize text-slate-500">{row.item_type} · {row.workstream?.name ?? "No workstream"}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Scope: {humanize(row.delivery_scope_type ?? "national")}</p></div> },
    { key: "owner", header: "Owner", render: (row) => row.owner?.full_name ?? row.owner?.email ?? "Unassigned" },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "priority", header: "Priority", render: (row) => <StatusBadge value={row.priority} /> },
    { key: "progress", header: "Progress", render: (row) => <ProgressBar value={row.progress_percentage} />, className: "min-w-44" },
    { key: "due", header: "Due", render: (row) => row.due_date ? new Date(row.due_date).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Not set" },
  ];
  return <WorkspaceDataTable rows={rows} columns={columns} getRowKey={(row) => row.id} emptyTitle="No milestones or deliverables" emptyDescription="Governed milestones and deliverables will appear here once configured." />;
}

export function RaidTable({ rows }: { rows: LcdboRaidItem[] }) {
  const columns: WorkspaceTableColumn<LcdboRaidItem>[] = [
    { key: "reference", header: "Reference", render: (row) => <span className="font-black text-slate-900">{row.reference}</span> },
    { key: "title", header: "RAID item", render: (row) => <div><p className="font-black text-slate-900">{row.title}</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{row.description}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Scope: {humanize(row.delivery_scope_type ?? "national")}</p></div> },
    { key: "type", header: "Type", render: (row) => <StatusBadge value={row.raid_type} /> },
    { key: "severity", header: "Severity", render: (row) => <StatusBadge value={row.severity} /> },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "escalation", header: "Escalation", render: (row) => <StatusBadge value={row.escalation_status} /> },
    { key: "review", header: "Review", render: (row) => row.review_date ? new Date(row.review_date).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Not set" },
  ];
  return <WorkspaceDataTable rows={rows} columns={columns} getRowKey={(row) => row.id} emptyTitle="No RAID records" emptyDescription="Risks, issues, assumptions and dependencies requiring governance attention will appear here." />;
}

export function DecisionTable({ rows }: { rows: LcdboDecision[] }) {
  const columns: WorkspaceTableColumn<LcdboDecision>[] = [
    { key: "reference", header: "Reference", render: (row) => <span className="font-black text-slate-900">{row.reference}</span> },
    { key: "decision", header: "Decision required", render: (row) => <div><p className="font-black text-slate-900">{row.decision_required}</p><p className="mt-1 text-xs text-slate-500">{row.workstream?.name ?? "Programme-level decision"}</p></div> },
    { key: "owner", header: "Owner", render: (row) => row.decisionOwner?.full_name ?? row.decisionOwner?.email ?? "Unassigned" },
    { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "due", header: "Due", render: (row) => row.due_date ? new Date(row.due_date).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Not set" },
    { key: "outcome", header: "Outcome", render: (row) => row.decision_outcome ?? "Pending" },
  ];
  return <WorkspaceDataTable rows={rows} columns={columns} getRowKey={(row) => row.id} emptyTitle="No decisions tracked" emptyDescription="Governance decisions requiring formal tracking will appear here." />;
}

export function CalendarAgenda({ items, raids, decisions }: { items: LcdboDeliveryItem[]; raids: LcdboRaidItem[]; decisions: LcdboDecision[] }) {
  const events = [
    ...items.filter((item) => item.due_date).map((item) => ({ date: item.due_date!, title: item.title, type: item.item_type, icon: Flag })),
    ...raids.filter((item) => item.review_date).map((item) => ({ date: item.review_date!, title: item.title, type: `${item.raid_type} review`, icon: AlertTriangle })),
    ...decisions.filter((item) => item.due_date).map((item) => ({ date: item.due_date!, title: item.decision_required, type: "decision deadline", icon: ClipboardCheck })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (!events.length) return <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">No scheduled delivery commitments are configured yet.</p>;
  return (
    <div className="space-y-3">
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <div key={`${event.date}-${event.title}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{new Date(event.date).toLocaleDateString("en-NG", { dateStyle: "full" })}</p>
              <p className="mt-1 font-black text-slate-900">{event.title}</p>
              <p className="mt-1 text-xs capitalize text-slate-500">{event.type}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SuccessErrorBanner({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return <p className={`rounded-2xl border p-3 text-sm font-bold ${success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{success ? humanize(success) : humanize(error)}</p>;
}

export function ExportLink({ href }: { href: string }) {
  return <Link href={href} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700"><CheckCircle2 className="h-4 w-4" />Export CSV</Link>;
}
