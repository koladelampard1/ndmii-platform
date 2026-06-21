import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getLcdboClusterInterestQueue, getLcdboEnrolmentQueue, getLcdboProgramme, getLcdboRecentActivity, listLcdboClusters, type LcdboClusterInterestQueueItem, type LcdboEnrolmentQueueItem } from "@/lib/data/lcdbo-enrolment";
import type { IndustrialCluster, Institution, PlatformEvent, Programme } from "@/types/platform";

type Client = SupabaseClient<any>;
export type IntelligenceBreakdown = Array<[string, number]>;
export type IntelligenceAssessment = { id: string; cluster_member_id: string; msme_id: string; overall_score: number; readiness_level: string; created_at: string };
export type IntelligenceDocumentRequest = { id: string; cluster_member_id: string; status: string; document_type: string; due_date: string | null; created_at: string; submissions: Array<{ id: string; status: string }> };
export type IntelligenceCluster = IndustrialCluster & { stateName: string; lgaName: string; officerCount: number; memberCount: number };
export type IntelligencePartner = Institution & { partnerRole: string };

export type LcdboIntelligenceSnapshot = {
  programme: Programme;
  enrolments: LcdboEnrolmentQueueItem[];
  interests: LcdboClusterInterestQueueItem[];
  clusters: IntelligenceCluster[];
  assessments: IntelligenceAssessment[];
  documents: IntelligenceDocumentRequest[];
  partners: IntelligencePartner[];
  recentActivity: PlatformEvent[];
  metrics: {
    totalMsmes: number; totalClusters: number; activeParticipants: number; statesCovered: number;
    lgasCovered: number; officersAssigned: number; assessmentsCompleted: number; documentsReviewed: number;
  };
  sectors: IntelligenceBreakdown;
  clusterSectors: IntelligenceBreakdown;
  states: IntelligenceBreakdown;
  clusterStates: IntelligenceBreakdown;
  participationStates: IntelligenceBreakdown;
  readiness: IntelligenceBreakdown;
  readinessBySector: Record<string, IntelligenceBreakdown>;
  pipeline: Array<{ label: string; value: number }>;
  estimates: { jobsSupported: number; msmesEnabled: number; clusterCapacity: number; exportReady: number; investmentPipeline: number };
};

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function countBy(values: Array<string | null | undefined>): IntelligenceBreakdown {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(String(value), (counts.get(String(value)) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export async function getLcdboIntelligenceSnapshot(client?: Client): Promise<LcdboIntelligenceSnapshot> {
  const supabase = client ?? await createServiceRoleSupabaseClient();
  const programme = await getLcdboProgramme(supabase);
  if (!programme) throw new Error("LCDBO programme is not configured.");
  const [enrolments, interests, baseClusters] = await Promise.all([
    getLcdboEnrolmentQueue(supabase), getLcdboClusterInterestQueue(supabase), listLcdboClusters(supabase),
  ]);
  const clusterIds = baseClusters.map((cluster) => cluster.id);
  const memberIds = interests.map((interest) => interest.id);
  const [{ data: clusterRows, error: clusterError }, { data: assessmentRows, error: assessmentError }, { data: documentRows, error: documentError }, { data: partnerRows, error: partnerError }] = await Promise.all([
    clusterIds.length ? supabase.from("industrial_clusters").select("*,states(name),lgas(name)").in("id", clusterIds) : Promise.resolve({ data: [], error: null }),
    memberIds.length ? supabase.from("lcdbo_cluster_assessments").select("id,cluster_member_id,msme_id,overall_score,readiness_level,created_at").in("cluster_member_id", memberIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    memberIds.length ? supabase.from("lcdbo_document_requests").select("id,cluster_member_id,status,document_type,due_date,created_at,lcdbo_document_submissions(id,status)").in("cluster_member_id", memberIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    supabase.from("programme_partners").select("partner_role,institutions!programme_partners_institution_id_fkey(*)").eq("programme_id", programme.id).eq("status", "active"),
  ]);
  if (clusterError) throw clusterError;
  if (assessmentError) throw assessmentError;
  if (documentError) throw documentError;
  if (partnerError) throw partnerError;

  const latestAssessments = new Map<string, IntelligenceAssessment>();
  for (const assessment of (assessmentRows ?? []) as IntelligenceAssessment[]) if (!latestAssessments.has(assessment.cluster_member_id)) latestAssessments.set(assessment.cluster_member_id, assessment);
  const assessments = [...latestAssessments.values()];
  const documents = (documentRows ?? []).map((row: any) => ({ ...row, submissions: row.lcdbo_document_submissions ?? [] })) as IntelligenceDocumentRequest[];
  const membersByCluster = new Map<string, LcdboClusterInterestQueueItem[]>();
  interests.forEach((interest) => membersByCluster.set(interest.cluster_id, [...(membersByCluster.get(interest.cluster_id) ?? []), interest]));
  const clusters = (clusterRows ?? []).map((row: any) => {
    const members = membersByCluster.get(row.id) ?? [];
    return { ...row, stateName: one(row.states)?.name ?? String(row.metadata?.demo_state ?? "Unspecified"), lgaName: one(row.lgas)?.name ?? String(row.metadata?.demo_lga ?? "Multiple LGAs"), officerCount: new Set(members.map((member) => member.assigned_officer_id).filter(Boolean)).size, memberCount: members.length };
  }) as IntelligenceCluster[];
  const partners = (partnerRows ?? []).map((row: any) => ({ ...one(row.institutions), partnerRole: row.partner_role })).filter((row: any) => row.id) as IntelligencePartner[];
  const activity = await getLcdboRecentActivity(programme.id, clusterIds, supabase);
  const sectorByMsme = new Map(enrolments.filter((item) => item.msme).map((item) => [item.msme!.id, item.msme!.sector]));
  const readinessBySector: Record<string, IntelligenceBreakdown> = {};
  for (const assessment of assessments) {
    const sector = sectorByMsme.get(assessment.msme_id) ?? "Other";
    const entries = readinessBySector[sector] ?? [];
    const map = new Map(entries);
    map.set(assessment.readiness_level, (map.get(assessment.readiness_level) ?? 0) + 1);
    readinessBySector[sector] = [...map.entries()].sort((a, b) => b[1] - a[1]);
  }
  const activeStatuses = new Set(["active", "placed"]);
  const documentsReviewed = documents.filter((request) => ["accepted", "rejected", "waived"].includes(request.status)).length;
  const states = countBy(enrolments.map((item) => item.msme?.state));
  const readiness = countBy(assessments.map((assessment) => assessment.readiness_level));
  const estimates = {
    jobsSupported: enrolments.reduce((sum, item) => sum + Number(item.msme?.registration_context?.estimated_employees ?? 8), 0),
    msmesEnabled: enrolments.length,
    clusterCapacity: clusters.reduce((sum, cluster) => sum + Number(cluster.msme_target ?? 0), 0),
    exportReady: assessments.filter((assessment) => assessment.readiness_level === "ready_for_export").length,
    investmentPipeline: clusters.reduce((sum, cluster) => sum + Number(cluster.investment_required ?? 0), 0),
  };
  return {
    programme, enrolments, interests, clusters, assessments, documents, partners, recentActivity: activity,
    metrics: { totalMsmes: enrolments.length, totalClusters: clusters.length, activeParticipants: interests.filter((item) => activeStatuses.has(item.status)).length, statesCovered: states.length, lgasCovered: new Set(enrolments.map((item) => item.msme?.lga).filter(Boolean)).size, officersAssigned: new Set(interests.map((item) => item.assigned_officer_id).filter(Boolean)).size, assessmentsCompleted: assessments.length, documentsReviewed },
    sectors: countBy(enrolments.map((item) => item.msme?.sector)), clusterSectors: countBy(clusters.map((cluster) => cluster.sector)), states, clusterStates: countBy(clusters.map((cluster) => cluster.stateName)), participationStates: countBy(interests.map((item) => item.msme?.state)), readiness, readinessBySector,
    pipeline: [
      { label: "Registered", value: enrolments.length }, { label: "Enrolled", value: enrolments.filter((item) => ["active", "pending_review"].includes(item.status)).length }, { label: "Interested", value: interests.length }, { label: "Assessed", value: assessments.length }, { label: "Documents complete", value: documents.filter((item) => item.status === "accepted").length }, { label: "Placed", value: interests.filter((item) => item.status === "placed").length }, { label: "Active", value: interests.filter((item) => item.status === "active").length },
    ], estimates,
  };
}

export function filterSnapshotByState(snapshot: LcdboIntelligenceSnapshot, state: string) {
  const normalised = state.toLowerCase();
  const enrolments = snapshot.enrolments.filter((item) => item.msme?.state?.toLowerCase() === normalised || (normalised === "fct" && item.msme?.state?.toLowerCase().includes("capital")));
  const msmeIds = new Set(enrolments.map((item) => item.msme?.id).filter(Boolean));
  const interests = snapshot.interests.filter((item) => Boolean(item.msme_id && msmeIds.has(item.msme_id)));
  const memberIds = new Set(interests.map((item) => item.id));
  const assessments = snapshot.assessments.filter((item) => memberIds.has(item.cluster_member_id));
  const documents = snapshot.documents.filter((item) => memberIds.has(item.cluster_member_id));
  const clusters = snapshot.clusters.filter((cluster) => cluster.stateName.toLowerCase() === normalised || (normalised === "fct" && cluster.stateName.toLowerCase().includes("capital")));
  return { enrolments, interests, assessments, documents, clusters, sectors: countBy(enrolments.map((item) => item.msme?.sector)), readiness: countBy(assessments.map((item) => item.readiness_level)), officers: new Set(interests.map((item) => item.assigned_officer_id).filter(Boolean)).size };
}
