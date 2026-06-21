import { notFound } from "next/navigation";
import { Building2, ClipboardCheck, Factory, Gauge, Handshake, Users } from "lucide-react";
import { requireLcdboIntelligenceAccess } from "@/lib/auth/lcdbo-intelligence-access";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { IntelligenceHeader, ReadinessProfile } from "@/components/lcdbo/lcdbo-intelligence-dashboard";
import { LcdboCommandMetricCard } from "@/components/lcdbo/lcdbo-visuals";

export default async function LcdboPartnerDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireLcdboIntelligenceAccess();
  const { id } = await params;
  const snapshot = await getLcdboIntelligenceSnapshot(await createServiceRoleSupabaseClient());
  const partner = snapshot.partners.find((item) => item.id === id || item.slug === id);
  if (!partner) notFound();
  if (ctx.role !== "admin" && ctx.role !== "super_admin" && ctx.role !== "programme_officer" && ctx.role !== "boi_executive" && ctx.role !== "auditor" && ctx.role !== "data_analyst") {
    if (!ctx.appUserId) notFound();
  }
  const directClusters = snapshot.clusters.filter((cluster) => cluster.owning_institution_id === partner.id || cluster.anchor_partner_id === partner.id);
  const clusters = directClusters.length ? directClusters : snapshot.clusters;
  const clusterIds = new Set(clusters.map((cluster) => cluster.id));
  const members = snapshot.interests.filter((item) => clusterIds.has(item.cluster_id));
  const memberIds = new Set(members.map((item) => item.id));
  const assessments = snapshot.assessments.filter((item) => memberIds.has(item.cluster_member_id));
  const readiness = countBy(assessments.map((item) => item.readiness_level));
  const activity = snapshot.recentActivity.filter((event) => event.actor_institution_id === partner.id || Boolean(event.scope_id && clusterIds.has(event.scope_id)));
  return <main className="min-h-screen bg-[#F6F8FB]"><IntelligenceHeader eyebrow="Partner Programme Dashboard" title={partner.name} description={`${partner.partnerRole.replaceAll("_", " ")} within the LCDBO institutional ecosystem. This view summarises relevant clusters, supported MSMEs and programme readiness.`} /><div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6"><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><LcdboCommandMetricCard icon={Handshake} label="Programme role" value={partner.partnerRole.replaceAll("_", " ")} /><LcdboCommandMetricCard icon={Factory} label="Relevant clusters" value={clusters.length} /><LcdboCommandMetricCard icon={Users} label="MSMEs supported" value={members.length} /><LcdboCommandMetricCard icon={ClipboardCheck} label="Assessments" value={assessments.length} /><LcdboCommandMetricCard icon={Gauge} label="Investment-ready" value={assessments.filter((item) => ["ready_for_investment", "ready_for_export"].includes(item.readiness_level)).length} /></section><section className="grid gap-5 lg:grid-cols-2"><ReadinessProfile data={readiness} /><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[#008751]" /><h2 className="text-xl font-black text-[#0B2E59]">Relevant cluster portfolio</h2></div><div className="mt-4 space-y-3">{clusters.slice(0, 8).map((cluster) => <div key={cluster.id} className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-[#0B2E59]">{cluster.name}</p><p className="mt-1 text-xs text-slate-500">{cluster.stateName} · {cluster.sector} · {cluster.memberCount} MSMEs</p></div>)}</div></article></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-[#0B2E59]">Recent partner-relevant activity</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{activity.slice(0, 8).map((event) => <div key={event.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold capitalize">{event.event_type.replace("lcdbo.", "").replaceAll(".", " · ").replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.created_at).toLocaleString("en-NG")}</p></div>)}</div></section></div></main>;
}

function countBy(values: string[]) { const map = new Map<string, number>(); values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1)); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
