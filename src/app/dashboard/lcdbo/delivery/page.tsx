import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, ClipboardCheck, Factory, GitBranch, MapPinned, Route, ShieldCheck } from "lucide-react";
import { WorkspacePage, WorkspacePageHeader, WorkspaceSection, WorkspaceState } from "@/components/workspace/workspace-page";
import { DeliveryItemTable, LcdboDeliveryMetricGrid, RaidTable, StatusBadge, SuccessErrorBanner, WorkstreamTable } from "@/components/lcdbo/lcdbo-delivery-components";
import { getLcdboDeliverySnapshot, requireLcdboDeliveryAccess } from "@/lib/data/lcdbo-delivery";
import { GeographicDeliveryMetricGrid, StatePlanTable } from "@/components/lcdbo/lcdbo-delivery-geography-components";
import { getLcdboGeographyDeliverySnapshot } from "@/lib/data/lcdbo-delivery-geography";

export const dynamic = "force-dynamic";

export default async function LcdboDeliveryOverviewPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const access = await requireLcdboDeliveryAccess("view").catch(() => null);
  if (!access) redirect("/access-denied");
  const snapshot = await getLcdboDeliverySnapshot(access.supabase);
  const geographic = await getLcdboGeographyDeliverySnapshot(access.supabase);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        eyebrow="Programme Delivery Core"
        title="LCDBO Programme Overview"
        description="A governed operational view of programme structure, workstream health, delivery commitments, RAID exposure and decisions requiring attention."
        classification={{ classification: "operational", label: "Live operational" }}
        disclosure="Configured targets and seeded workstreams are planning records, not achieved national performance. Governed progress is derived from programme delivery records."
        actions={<Link href="/dashboard/lcdbo/workstreams" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">Manage workstreams<ArrowRight className="h-4 w-4" /></Link>}
      />
      <SuccessErrorBanner success={params.success} error={params.error} />
      {snapshot.unavailable ? (
        <WorkspaceState type="not-configured" title="Programme delivery schema is not applied yet" description="Apply the LCDBO Programme Delivery Core Sprint 1 migration to enable workstreams, milestones, RAID items and decisions." />
      ) : (
        <>
          <LcdboDeliveryMetricGrid metrics={snapshot.metrics} />
          {!geographic.unavailable ? <GeographicDeliveryMetricGrid metrics={geographic.metrics} /> : null}
          <WorkspaceSection title="Programme control summary" description="Core delivery facts reused from the existing LCDBO programme definition.">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Programme</p>
                <p className="mt-2 text-lg font-black text-slate-900">{snapshot.programme?.name}</p>
                <p className="mt-1 text-xs text-slate-500">{snapshot.programme?.slug}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Implementation period</p>
                <p className="mt-2 text-lg font-black text-slate-900">{snapshot.programme?.start_date ?? "Start not configured"} → {snapshot.programme?.end_date ?? "Target open"}</p>
                <p className="mt-1 text-xs text-slate-500">Programme dates from the canonical programme record.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Overall status</p>
                <div className="mt-2"><StatusBadge value={snapshot.programme?.status ?? "not_configured"} /></div>
                <p className="mt-2 text-xs text-slate-500">Latest delivery update: {snapshot.metrics.latestUpdate ? new Date(snapshot.metrics.latestUpdate).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "No delivery updates yet"}</p>
              </div>
            </div>
          </WorkspaceSection>
          <WorkspaceSection title="National targets and delivery priorities" description="Configured programme targeting from the canonical LCDBO programme record. These are planning targets, not achieved results.">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">Target sectors</p>
                <p className="mt-2 text-sm font-bold leading-6 text-purple-950">{snapshot.programme?.target_sectors?.length ? snapshot.programme.target_sectors.join(", ") : "Not configured"}</p>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">Target geography</p>
                <p className="mt-2 text-sm font-bold leading-6 text-purple-950">{snapshot.programme?.target_states?.length ?? 0} state target record{(snapshot.programme?.target_states?.length ?? 0) === 1 ? "" : "s"} · {snapshot.programme?.target_lgas?.length ?? 0} LGA target record{(snapshot.programme?.target_lgas?.length ?? 0) === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">Configured goals</p>
                <p className="mt-2 text-sm font-bold leading-6 text-purple-950">{snapshot.programme?.goals?.length ?? 0} governed goal statement{(snapshot.programme?.goals?.length ?? 0) === 1 ? "" : "s"}</p>
              </div>
            </div>
          </WorkspaceSection>
          <WorkspaceSection title="Workstream health" description="Accountability, progress and RAG status across LCDBO delivery workstreams." actions={<Link href="/dashboard/lcdbo/workstreams" className="text-sm font-black text-emerald-700">Open register</Link>}>
            <WorkstreamTable rows={snapshot.workstreams.slice(0, 5)} />
          </WorkspaceSection>
          <div className="grid gap-6 lg:grid-cols-2">
            <WorkspaceSection title="Upcoming milestones and deliverables" description="Commitments requiring action or governance visibility." actions={<Link href="/dashboard/lcdbo/milestones" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700"><CalendarDays className="h-4 w-4" />Open register</Link>}>
              <DeliveryItemTable rows={snapshot.items.slice(0, 5)} />
            </WorkspaceSection>
            <WorkspaceSection title="Critical risks, issues and decisions" description="Programme items requiring attention." actions={<Link href="/dashboard/lcdbo/raid" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700"><ClipboardCheck className="h-4 w-4" />Open RAID</Link>}>
              <RaidTable rows={snapshot.raids.filter((item) => item.severity === "critical" || item.escalation_status !== "none").slice(0, 5)} />
            </WorkspaceSection>
          </div>
          {!geographic.unavailable ? (
            <WorkspaceSection title="Geographic delivery hierarchy" description="State, LGA and cluster plans represent configured LCDBO delivery operations. They do not imply nationwide reference-geography coverage.">
              <StatePlanTable rows={geographic.statePlans.slice(0, 5)} />
            </WorkspaceSection>
          ) : null}
          <WorkspaceSection title="Delivery navigation" description="Operational registers for national and geographic delivery planning.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["State Plans", "/dashboard/lcdbo/delivery/states", MapPinned],
                ["LGA Plans", "/dashboard/lcdbo/delivery/lgas", Route],
                ["Cluster Plans", "/dashboard/lcdbo/delivery/clusters", Factory],
                ["My Work", "/dashboard/lcdbo/my-work", ClipboardCheck],
                ["Workstreams", "/dashboard/lcdbo/workstreams", GitBranch],
                ["Milestones", "/dashboard/lcdbo/milestones", CalendarDays],
                ["Risks & Issues", "/dashboard/lcdbo/raid", ShieldCheck],
                ["Decisions", "/dashboard/lcdbo/decisions", ClipboardCheck],
                ["Calendar", "/dashboard/lcdbo/calendar", CalendarDays],
              ].map(([label, href, Icon]) => (
                <Link key={String(href)} href={String(href)} className="rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
                  <Icon className="h-5 w-5 text-emerald-700" />
                  <p className="mt-3 font-black text-slate-900">{String(label)}</p>
                </Link>
              ))}
            </div>
          </WorkspaceSection>
        </>
      )}
    </WorkspacePage>
  );
}
