import type { LcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { calculateDataQuality, calculateProgrammeHealth } from "@/lib/data/lcdbo-governance";
import type { LcdboPdfReportInput } from "@/lib/reports/lcdbo-programme-pdf";

export type LcdboSnapshotPlan = { reportType: "national" | "state" | "cluster" | "partner" | "readiness" | "participation" | "executive_briefing"; dimensions: Record<string, unknown>; metrics: Record<string, unknown> };

export function buildGovernedMetricsPayload(snapshot: LcdboIntelligenceSnapshot) {
  return { metrics: snapshot.metrics, pipeline: snapshot.pipeline, readiness: snapshot.readiness, estimates: snapshot.estimates, quality: calculateDataQuality(snapshot), health: calculateProgrammeHealth(snapshot) };
}

export function buildLcdboPdfInput(input: { snapshot: LcdboIntelligenceSnapshot; reportType: string; title?: string; subtitle?: string; executiveSummary?: string; opportunities?: string[]; risks?: string[]; recommendations?: string[] }): LcdboPdfReportInput {
  const { snapshot } = input;
  const quality = calculateDataQuality(snapshot);
  const health = calculateProgrammeHealth(snapshot);
  return {
    title: input.title ?? `LCDBO ${humanize(input.reportType)} Report`,
    reportType: input.reportType,
    generatedAt: new Date().toLocaleDateString("en-NG", { dateStyle: "long" }),
    subtitle: input.subtitle,
    kpis: [
      { label: "Total MSMEs", value: snapshot.metrics.totalMsmes.toLocaleString("en-NG") },
      { label: "Active participants", value: snapshot.metrics.activeParticipants.toLocaleString("en-NG") },
      { label: "Active clusters", value: snapshot.clusters.filter((cluster) => cluster.status === "active").length.toLocaleString("en-NG") },
      { label: "Assessments", value: snapshot.metrics.assessmentsCompleted.toLocaleString("en-NG") },
      { label: "Ready for investment", value: snapshot.assessments.filter((item) => item.readiness_level === "ready_for_investment").length.toLocaleString("en-NG") },
      { label: "Ready for export", value: snapshot.assessments.filter((item) => item.readiness_level === "ready_for_export").length.toLocaleString("en-NG") },
      { label: "States covered", value: snapshot.metrics.statesCovered.toLocaleString("en-NG") },
      { label: "Documents reviewed", value: snapshot.metrics.documentsReviewed.toLocaleString("en-NG") },
    ],
    pipeline: snapshot.pipeline,
    readiness: snapshot.readiness,
    topSectors: snapshot.sectors.slice(0, 8),
    topStates: snapshot.states.slice(0, 8),
    qualityScore: quality.score,
    healthScore: health.score,
    estimates: [
      { label: "Jobs supported", value: snapshot.estimates.jobsSupported.toLocaleString("en-NG") },
      { label: "MSMEs enabled", value: snapshot.estimates.msmesEnabled.toLocaleString("en-NG") },
      { label: "Cluster capacity", value: snapshot.estimates.clusterCapacity.toLocaleString("en-NG") },
      { label: "Export ready", value: snapshot.estimates.exportReady.toLocaleString("en-NG") },
      { label: "Investment pipeline", value: `NGN ${compact(snapshot.estimates.investmentPipeline)}` },
    ],
    disclosures: [
      "Programme Estimate values are derived from current LCDBO records and configured cluster targets.",
      "Demonstration records, where present, are synthetic and explicitly marked as sample data.",
      "This report is a programme decision-support artifact and does not represent official government statistics.",
    ],
    executiveSummary: input.executiveSummary,
    opportunities: input.opportunities,
    risks: input.risks ?? health.alerts.filter((alert) => alert.count > 0).slice(0, 3).map((alert) => `${alert.label}: ${alert.count}. ${alert.detail}`),
    recommendations: input.recommendations,
  };
}

export function scopeLcdboSnapshot(snapshot: LcdboIntelligenceSnapshot, scope: { reportType: string; state?: string | null; cluster?: string | null; partner?: string | null }) {
  let clusters = snapshot.clusters;
  if (scope.reportType === "state" && scope.state) clusters = clusters.filter((item) => item.stateName === scope.state);
  if (scope.reportType === "cluster" && scope.cluster) clusters = clusters.filter((item) => item.id === scope.cluster);
  if (scope.reportType === "partner" && scope.partner) {
    const directClusters = clusters.filter((item) => item.owning_institution_id === scope.partner || item.anchor_partner_id === scope.partner);
    clusters = directClusters.length ? directClusters : clusters;
  }
  const clusterIds = new Set(clusters.map((item) => item.id));
  let interests = snapshot.interests;
  if (["state", "cluster", "partner"].includes(scope.reportType) && (scope.state || scope.cluster || scope.partner)) interests = interests.filter((item) => clusterIds.has(item.cluster_id));
  const msmeIds = new Set(interests.map((item) => item.msme_id).filter(Boolean));
  let enrolments = snapshot.enrolments;
  if (scope.reportType === "state" && scope.state) enrolments = enrolments.filter((item) => item.msme?.state === scope.state);
  else if (["cluster", "partner"].includes(scope.reportType) && (scope.cluster || scope.partner)) enrolments = enrolments.filter((item) => Boolean(item.msme_id && msmeIds.has(item.msme_id)));
  const memberIds = new Set(interests.map((item) => item.id));
  const assessments = snapshot.assessments.filter((item) => memberIds.has(item.cluster_member_id));
  const documents = snapshot.documents.filter((item) => memberIds.has(item.cluster_member_id));
  const sectors = countBy(enrolments.map((item) => item.msme?.sector));
  const states = countBy(enrolments.map((item) => item.msme?.state));
  const readiness = countBy(assessments.map((item) => item.readiness_level));
  const sectorByMsme = new Map(enrolments.filter((item) => item.msme).map((item) => [item.msme!.id, item.msme!.sector]));
  const readinessBySector: Record<string, Array<[string, number]>> = {};
  assessments.forEach((assessment) => { const sector = sectorByMsme.get(assessment.msme_id) ?? "Other"; readinessBySector[sector] = countBy([...expandBreakdown(readinessBySector[sector] ?? []), assessment.readiness_level]); });
  const partners = scope.reportType === "partner" && scope.partner ? snapshot.partners.filter((item) => item.id === scope.partner) : snapshot.partners;
  const activeParticipants = interests.filter((item) => ["active", "placed"].includes(item.status)).length;
  const pipeline = [
    { label: "Registered", value: enrolments.length }, { label: "Enrolled", value: enrolments.filter((item) => ["active", "pending_review"].includes(item.status)).length }, { label: "Interested", value: interests.length }, { label: "Assessed", value: assessments.length }, { label: "Documents complete", value: documents.filter((item) => item.status === "accepted").length }, { label: "Placed", value: interests.filter((item) => item.status === "placed").length }, { label: "Active", value: interests.filter((item) => item.status === "active").length },
  ];
  return { ...snapshot, enrolments, interests, clusters, assessments, documents, partners, sectors, states, readiness, readinessBySector, clusterSectors: countBy(clusters.map((item) => item.sector)), clusterStates: countBy(clusters.map((item) => item.stateName)), participationStates: countBy(interests.map((item) => item.msme?.state)), pipeline, metrics: { totalMsmes: enrolments.length, totalClusters: clusters.length, activeParticipants, statesCovered: states.length, lgasCovered: new Set(enrolments.map((item) => item.msme?.lga).filter(Boolean)).size, officersAssigned: new Set(interests.map((item) => item.assigned_officer_id).filter(Boolean)).size, assessmentsCompleted: assessments.length, documentsReviewed: documents.filter((item) => ["accepted", "rejected", "waived"].includes(item.status)).length }, estimates: { jobsSupported: enrolments.reduce((sum, item) => sum + Number(item.msme?.registration_context?.estimated_employees ?? 8), 0), msmesEnabled: enrolments.length, clusterCapacity: clusters.reduce((sum, item) => sum + Number(item.msme_target ?? 0), 0), exportReady: assessments.filter((item) => item.readiness_level === "ready_for_export").length, investmentPipeline: clusters.reduce((sum, item) => sum + Number(item.investment_required ?? 0), 0) } } satisfies LcdboIntelligenceSnapshot;
}

export function buildLcdboSnapshotPlans(snapshot: LcdboIntelligenceSnapshot): LcdboSnapshotPlan[] {
  const scopedMetrics = buildGovernedMetricsPayload;
  const states = snapshot.states.map(([state]) => { const scoped = scopeLcdboSnapshot(snapshot, { reportType: "state", state }); return { state, ...scopedMetrics(scoped) }; });
  const clusters = snapshot.clusters.map((cluster) => { const scoped = scopeLcdboSnapshot(snapshot, { reportType: "cluster", cluster: cluster.id }); return { cluster_id: cluster.id, cluster_name: cluster.name, state: cluster.stateName, ...scopedMetrics(scoped) }; });
  const partners = snapshot.partners.map((partner) => { const scoped = scopeLcdboSnapshot(snapshot, { reportType: "partner", partner: partner.id }); return { partner_id: partner.id, partner_name: partner.name, partner_role: partner.partnerRole, ...scopedMetrics(scoped) }; });
  return [
    { reportType: "national", dimensions: { scope_type: "programme", programme_id: snapshot.programme.id }, metrics: scopedMetrics(snapshot) },
    { reportType: "state", dimensions: { scope_type: "state", scope_count: states.length }, metrics: { scopes: states } },
    { reportType: "cluster", dimensions: { scope_type: "cluster", scope_count: clusters.length }, metrics: { scopes: clusters } },
    { reportType: "partner", dimensions: { scope_type: "partner", scope_count: partners.length }, metrics: { scopes: partners } },
    { reportType: "readiness", dimensions: { scope_type: "programme", programme_id: snapshot.programme.id }, metrics: { readiness: snapshot.readiness, readiness_by_sector: snapshot.readinessBySector, assessments_completed: snapshot.metrics.assessmentsCompleted, ready_for_investment: snapshot.assessments.filter((item) => item.readiness_level === "ready_for_investment").length, ready_for_export: snapshot.assessments.filter((item) => item.readiness_level === "ready_for_export").length } },
    { reportType: "participation", dimensions: { scope_type: "programme", programme_id: snapshot.programme.id }, metrics: { pipeline: snapshot.pipeline, total_msmes: snapshot.metrics.totalMsmes, active_participants: snapshot.metrics.activeParticipants, cluster_interests: snapshot.interests.length } },
    { reportType: "executive_briefing", dimensions: { scope_type: "programme", programme_id: snapshot.programme.id }, metrics: { ...scopedMetrics(snapshot), top_sectors: snapshot.sectors.slice(0, 8), top_states: snapshot.states.slice(0, 8), partners: snapshot.partners.length } },
  ];
}

function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function compact(value: number) { return new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function countBy(values: Array<string | null | undefined>) { const counts = new Map<string, number>(); values.filter(Boolean).forEach((value) => counts.set(String(value), (counts.get(String(value)) ?? 0) + 1)); return [...counts.entries()].sort((a, b) => b[1] - a[1]); }
function expandBreakdown(values: Array<[string, number]>) { return values.flatMap(([label, count]) => Array.from({ length: count }, () => label)); }
