import { notFound } from "next/navigation";
import { BriefcaseBusiness, ClipboardCheck, Factory, FileCheck2, Gauge, MapPinned, UserRoundCheck, Users } from "lucide-react";
import { requireLcdboIntelligenceAccess } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { IntelligenceBarChart, IntelligenceHeader, ReadinessProfile } from "@/components/lcdbo/lcdbo-intelligence-dashboard";
import { LcdboCommandMetricCard } from "@/components/lcdbo/lcdbo-visuals";

export default async function LcdboClusterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireLcdboIntelligenceAccess();
  const { id } = await params;
  const snapshot = await getLcdboIntelligenceSnapshot(await createServiceRoleSupabaseClient());
  const cluster = snapshot.clusters.find((item) => item.id === id);
  if (!cluster) notFound();
  const members = snapshot.interests.filter((item) => item.cluster_id === id);
  const memberIds = new Set(members.map((item) => item.id));
  const assessments = snapshot.assessments.filter((item) => memberIds.has(item.cluster_member_id));
  const documents = snapshot.documents.filter((item) => memberIds.has(item.cluster_member_id));
  const readiness = countBy(assessments.map((item) => item.readiness_level));
  const statuses = countBy(members.map((item) => item.status));
  const reviewedDocs = documents.filter((item) => ["accepted", "rejected", "waived"].includes(item.status)).length;
  const activity = snapshot.recentActivity.filter((event) => event.scope_id === id);
  return <main className="min-h-screen bg-[#F6F8FB]"><IntelligenceHeader eyebrow="Cluster Intelligence Profile" title={cluster.name} description={`${cluster.sector} cluster in ${cluster.lgaName}, ${cluster.stateName}. ${cluster.description ?? "Programme cluster profile."}`} /><div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6"><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><LcdboCommandMetricCard icon={Users} label="MSMEs" value={members.length} /><LcdboCommandMetricCard icon={UserRoundCheck} label="Officers" value={cluster.officerCount} /><LcdboCommandMetricCard icon={ClipboardCheck} label="Assessments" value={assessments.length} /><LcdboCommandMetricCard icon={FileCheck2} label="Documents reviewed" value={reviewedDocs} /><LcdboCommandMetricCard icon={Gauge} label="MSME target" value={cluster.msme_target ?? "—"} /><LcdboCommandMetricCard icon={BriefcaseBusiness} label="Jobs target" value={cluster.jobs_target ?? "—"} /><LcdboCommandMetricCard icon={Factory} label="Status" value={cluster.status.replaceAll("_", " ")} /><LcdboCommandMetricCard icon={MapPinned} label="Location" value={cluster.stateName} /></section><section className="grid gap-5 lg:grid-cols-2"><ReadinessProfile data={readiness} /><IntelligenceBarChart title="Participation status" data={statuses} /></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-[#0B2E59]">Recent cluster activity</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{activity.map((event) => <div key={event.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold capitalize">{event.event_type.replace("lcdbo.", "").replaceAll("_", " ").replaceAll(".", " · ")}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.created_at).toLocaleString("en-NG")}</p></div>)}{!activity.length && <p className="text-sm text-slate-500">No recent activity is recorded for this cluster.</p>}</div></section></div></main>;
}

function countBy(values: string[]) { const map = new Map<string, number>(); values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1)); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
