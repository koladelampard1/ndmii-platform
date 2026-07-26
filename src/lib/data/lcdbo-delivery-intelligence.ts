import type { SupabaseClient } from "@supabase/supabase-js";
import { requireLcdboDeliveryAccess, type LcdboDecision, type LcdboDeliveryItem, type LcdboRaidItem, type LcdboWorkstream } from "@/lib/data/lcdbo-delivery";
import { getLcdboDeliverySnapshot } from "@/lib/data/lcdbo-delivery";
import {
  getLcdboGeographyDeliverySnapshot,
  type ClusterPlan,
  type DeliveryActivity,
  type LgaPlan,
  type ProgressUpdate,
  type StatePlan,
} from "@/lib/data/lcdbo-delivery-geography";
import { calculateDataQuality, generateReportSnapshot, isGovernanceSchemaUnavailable } from "@/lib/data/lcdbo-governance";
import { getLcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";
import { recordTrustedLcdboDeliveryEvent } from "@/lib/data/platform-foundation";
import type { LcdboPdfReportInput } from "@/lib/reports/lcdbo-programme-pdf";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { JsonRecord } from "@/types/platform";

type Client = SupabaseClient<any>;
type Classification = "live_operational" | "configured_target" | "governed_estimate" | "sample_demo" | "reference_data" | "test_uat" | "unavailable";
export type HealthColour = "green" | "amber" | "red" | "grey";

export const LCDBO_DELIVERY_HEALTH_MODEL_VERSION = "lcdbo-delivery-health-v1.0.0";
export const LCDBO_PILOT_READINESS_MODEL_VERSION = "lcdbo-pilot-readiness-v1.0.0";
export const LCDBO_EXECUTIVE_METRIC_VERSION = "lcdbo-executive-metrics-v1.0.0";

export const HEALTH_FACTOR_WEIGHTS = {
  milestoneCompletion: 0.18,
  milestoneTimeliness: 0.14,
  blockedDeliverables: 0.12,
  criticalRiskExposure: 0.16,
  reportingCompleteness: 0.14,
  approvedProgressRecency: 0.1,
  geographicDeliveryProgress: 0.1,
  dataQuality: 0.06,
} as const;

export type ExecutiveMetricLineage = {
  title: string;
  value: number | string;
  classification: Classification;
  source: string;
  calculationBasis: string;
  lastRefreshed: string;
  scope: string;
  reportingPeriod: string;
  drillDownHref: string;
  disclosure: string;
  includedRecords: number;
  excludedRecords: number;
  modelVersion: string;
};

export type HealthFactor = {
  code: keyof typeof HEALTH_FACTOR_WEIGHTS;
  label: string;
  score: number;
  weight: number;
  contribution: number;
  status: HealthColour;
  explanation: string;
  missingDataImpact?: string;
  drillDownHref: string;
};

export type ExplainableHealth = {
  score: number;
  status: HealthColour;
  statusText: string;
  calculatedAt: string;
  modelVersion: string;
  factors: HealthFactor[];
  override?: HealthOverride | null;
  disclosure: string;
};

export type ScopedHealthExplanation = ExplainableHealth & {
  targetType: "programme" | "workstream" | "state_plan" | "lga_plan" | "cluster_plan";
  targetId: string;
  targetTitle: string;
  includedRecords: number;
  excludedRecords: number;
  drillDownHref: string;
};

export type AttentionItem = {
  id: string;
  category: "decision" | "risk" | "milestone" | "deliverable" | "state" | "lga" | "cluster" | "activity" | "progress" | "quality" | "readiness";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  source: string;
  classification: Classification;
  href: string;
  decisionHref?: string;
  dueDate?: string | null;
};

export type HealthOverride = {
  id: string;
  programme_id: string;
  target_type: string;
  target_id: string;
  calculated_health: HealthColour;
  override_health: HealthColour;
  override_reason: string;
  status: "active" | "removed";
  applied_by: string;
  applied_at: string;
};

export type EvidenceLink = {
  id: string;
  programme_id: string;
  related_entity_type: string;
  related_entity_id: string;
  evidence_type: string;
  reference_title: string;
  safe_url: string | null;
  reference_note: string | null;
  status: string;
  data_classification: string;
  submitted_by: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  verification_outcome: string | null;
  verification_note: string | null;
  metadata: JsonRecord;
};

type PilotReadinessPayload = {
  programme_id: string;
  scope_type: "state" | "lga" | "cluster";
  state_plan_id: string | null;
  lga_plan_id: string | null;
  cluster_plan_id: string | null;
  outcome: PilotReadinessAssessment["outcome"];
  readiness_score: number;
  blocking_issue_count: number;
  assessment_status: string;
  override_reason: string | null;
  assessed_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  metadata: JsonRecord;
};

export type PilotReadinessAssessment = {
  id: string;
  programme_id: string;
  scope_type: "state" | "lga" | "cluster";
  state_plan_id: string | null;
  lga_plan_id: string | null;
  cluster_plan_id: string | null;
  outcome: "not_ready" | "conditionally_ready" | "ready_for_controlled_pilot" | "active" | "paused";
  readiness_score: number;
  blocking_issue_count: number;
  assessment_status: string;
  override_reason: string | null;
  assessed_by: string | null;
  assessed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  metadata: JsonRecord;
};

export type DerivedPilotReadiness = {
  key: string;
  scopeType: "state" | "lga" | "cluster";
  title: string;
  href: string;
  classification: Classification;
  outcome: PilotReadinessAssessment["outcome"];
  score: number;
  blockingIssues: number;
  dimensions: Array<{ key: string; requirement: string; met: boolean; blocking: boolean; status: string; evidenceRequired: boolean; explanation: string }>;
  persisted?: PilotReadinessAssessment | null;
};

export type EvidenceTarget = {
  key: string;
  type: "workstream" | "delivery_item" | "raid_item" | "decision" | "state_plan" | "lga_plan" | "cluster_plan" | "activity" | "progress_update" | "pilot_readiness";
  id: string;
  label: string;
  href: string;
  classification: Classification;
  evidenceCount: number;
};

export type Sprint3ReportFamily =
  | "programme-delivery"
  | "workstream-performance"
  | "milestone-deliverable"
  | "risk-issue"
  | "state-delivery"
  | "lga-delivery"
  | "cluster-delivery"
  | "executive-exceptions"
  | "pilot-readiness"
  | "evidence-verification";

export type Sprint3Snapshot = {
  generatedAt: string;
  includeTestData: boolean;
  deliveryUnavailable: boolean;
  geographyUnavailable: boolean;
  metrics: ExecutiveMetricLineage[];
  health: ExplainableHealth;
  attention: AttentionItem[];
  evidence: EvidenceLink[];
  evidenceTargets: EvidenceTarget[];
  readiness: DerivedPilotReadiness[];
  scopedHealth: ScopedHealthExplanation[];
  productionCounts: { included: number; excludedTest: number; configuredTargets: number };
};

async function clientOrService(client?: Client) {
  return client ?? await createServiceRoleSupabaseClient();
}

function metadataOf(row: { metadata?: JsonRecord | null }) {
  return (row.metadata ?? {}) as JsonRecord;
}

export function classifyDeliveryRecord(row: { metadata?: JsonRecord | null; reference?: string | null; title?: string | null; name?: string | null; progress_summary?: string | null }): Classification {
  const metadata = metadataOf(row);
  const recordClassification = String(metadata.record_classification ?? "").trim();
  // Structured metadata is authoritative. Text matching is a defensive fallback
  // for known UAT/audit references and must not exclude ordinary production
  // records merely because a legitimate description contains the word "test".
  if (["test_uat", "uat", "test"].includes(recordClassification)) return "test_uat";
  if (recordClassification === "configured_target") return "configured_target";
  if (recordClassification === "sample_demo" || recordClassification === "demo") return "sample_demo";
  if (recordClassification === "reference_data") return "reference_data";
  if (metadata.uat_reference || metadata.denied_reference || metadata.source === "live_uat") return "test_uat";
  const marker = `${row.reference ?? ""} ${row.title ?? ""} ${row.name ?? ""} ${row.progress_summary ?? ""}`;
  if (/^\s*(TEST|UAT)\s*(—|-|:)/i.test(marker) || /\b(live uat|audit writer|spoof check|denied reference)\b/i.test(marker)) return "test_uat";
  return "live_operational";
}

function includeRecord(row: { metadata?: JsonRecord | null; reference?: string | null; title?: string | null; name?: string | null; progress_summary?: string | null }, includeTestData: boolean) {
  return includeTestData || classifyDeliveryRecord(row) !== "test_uat";
}

function pct(numerator: number, denominator: number, missingAs = 0) {
  if (!denominator) return missingAs;
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function daysSince(value?: string | null) {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function healthFromScore(score: number): HealthColour {
  if (score >= 75) return "green";
  if (score >= 50) return "amber";
  if (score > 0) return "red";
  return "grey";
}

function statusText(status: HealthColour) {
  return { green: "On track", amber: "Requires management attention", red: "Requires executive intervention", grey: "Insufficient governed data" }[status];
}

function factor(code: keyof typeof HEALTH_FACTOR_WEIGHTS, label: string, score: number, explanation: string, drillDownHref: string, missingDataImpact?: string): HealthFactor {
  const weight = HEALTH_FACTOR_WEIGHTS[code];
  return { code, label, score, weight, contribution: Math.round(score * weight), status: healthFromScore(score), explanation, drillDownHref, missingDataImpact };
}

function csvValue(value: unknown) {
  const raw = String(value ?? "");
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
}

function scopedHref(record: { id: string }, type: AttentionItem["category"]) {
  if (type === "decision") return "/dashboard/lcdbo/decisions";
  if (type === "risk") return "/dashboard/lcdbo/raid";
  if (type === "milestone" || type === "deliverable") return "/dashboard/lcdbo/milestones";
  if (type === "state") return `/dashboard/lcdbo/delivery/states/${record.id}`;
  if (type === "lga") return `/dashboard/lcdbo/delivery/lgas/${record.id}`;
  if (type === "cluster") return `/dashboard/lcdbo/delivery/clusters/${record.id}`;
  if (type === "activity" || type === "progress") return "/dashboard/lcdbo/my-work";
  if (type === "quality") return "/dashboard/lcdbo/data-quality";
  return "/dashboard/lcdbo/pilot-readiness";
}

function applyProductionFilter<T extends { metadata?: JsonRecord | null; reference?: string | null; title?: string | null; name?: string | null; progress_summary?: string | null }>(rows: T[], includeTestData: boolean) {
  const included = rows.filter((row) => includeRecord(row, includeTestData));
  return { included, excludedTest: rows.length - included.length, configuredTargets: rows.filter((row) => classifyDeliveryRecord(row) === "configured_target").length };
}

async function listHealthOverrides(programmeId: string, client: Client) {
  const { data, error } = await client.from("lcdbo_delivery_health_overrides").select("*").eq("programme_id", programmeId).eq("status", "active");
  if (error && isGovernanceSchemaUnavailable(error)) return [] as HealthOverride[];
  if (error) return [] as HealthOverride[];
  return (data ?? []) as HealthOverride[];
}

export async function listLcdboDeliveryEvidence(programmeId: string, client?: Client): Promise<EvidenceLink[]> {
  const supabase = await clientOrService(client);
  const { data, error } = await supabase.from("lcdbo_delivery_evidence_links").select("*").eq("programme_id", programmeId).order("created_at", { ascending: false }).limit(100);
  if (error && isGovernanceSchemaUnavailable(error)) return [];
  if (error) return [];
  return (data ?? []) as EvidenceLink[];
}

async function listPersistedReadiness(programmeId: string, client: Client): Promise<PilotReadinessAssessment[]> {
  const { data, error } = await client.from("lcdbo_pilot_readiness_assessments").select("*").eq("programme_id", programmeId).order("updated_at", { ascending: false });
  if (error && isGovernanceSchemaUnavailable(error)) return [];
  if (error) return [];
  return (data ?? []) as PilotReadinessAssessment[];
}

export function calculateExplainableHealth(input: {
  workstreams: LcdboWorkstream[];
  items: LcdboDeliveryItem[];
  raids: LcdboRaidItem[];
  statePlans: StatePlan[];
  lgaPlans: LgaPlan[];
  clusterPlans: ClusterPlan[];
  activities: DeliveryActivity[];
  progressUpdates: ProgressUpdate[];
  dataQualityScore: number;
  override?: HealthOverride | null;
}): ExplainableHealth {
  const now = new Date();
  const activeItems = input.items.filter((item) => !["completed", "cancelled"].includes(item.status));
  const completedItems = input.items.filter((item) => item.status === "completed");
  const overdueItems = activeItems.filter((item) => item.due_date && new Date(item.due_date) < now);
  const blocked = input.items.filter((item) => item.status === "blocked").length;
  const criticalRisks = input.raids.filter((item) => item.severity === "critical" && !["resolved", "closed", "cancelled"].includes(item.status)).length;
  const activePlans = [...input.statePlans, ...input.lgaPlans, ...input.clusterPlans].filter((plan) => !["cancelled"].includes(plan.activation_status));
  const approvedUpdates = input.progressUpdates.filter((update) => update.review_status === "approved");
  const latestApprovedAge = Math.min(...approvedUpdates.map((update) => daysSince(update.reviewed_at ?? update.submitted_at) ?? 9999), 9999);
  const factors = [
    factor("milestoneCompletion", "Milestone completion", pct(completedItems.length, input.items.length, input.items.length ? 0 : 50), `${completedItems.length} of ${input.items.length} milestones and deliverables are complete.`, "/dashboard/lcdbo/milestones", input.items.length ? undefined : "No milestone baseline exists yet; score defaults to partial confidence."),
    factor("milestoneTimeliness", "Milestone timeliness", input.items.length ? Math.max(0, 100 - pct(overdueItems.length, activeItems.length || input.items.length) * 2) : 50, `${overdueItems.length} active milestones or deliverables are overdue.`, "/dashboard/lcdbo/milestones"),
    factor("blockedDeliverables", "Blocked deliverables", Math.max(0, 100 - blocked * 20), `${blocked} deliverables are blocked.`, "/dashboard/lcdbo/milestones"),
    factor("criticalRiskExposure", "Critical-risk exposure", Math.max(0, 100 - criticalRisks * 25), `${criticalRisks} unresolved critical RAID items are open.`, "/dashboard/lcdbo/raid"),
    factor("reportingCompleteness", "Reporting completeness", activePlans.length ? Math.round(activePlans.reduce((sum, plan) => sum + plan.reporting_completeness, 0) / activePlans.length) : 40, `${activePlans.length} non-cancelled geographic plans contribute reporting completeness.`, "/dashboard/lcdbo/delivery/states", activePlans.length ? undefined : "No activated geographic reporting baseline exists."),
    factor("approvedProgressRecency", "Approved progress recency", latestApprovedAge <= 30 ? 100 : latestApprovedAge <= 60 ? 70 : latestApprovedAge <= 90 ? 45 : 20, approvedUpdates.length ? `Latest approved progress is ${latestApprovedAge} day(s) old.` : "No approved progress updates are available.", "/dashboard/lcdbo/my-work", approvedUpdates.length ? undefined : "Missing approved reporting materially reduces confidence."),
    factor("geographicDeliveryProgress", "Geographic delivery progress", activePlans.length ? Math.round(activePlans.reduce((sum, plan) => sum + plan.progress_percentage, 0) / activePlans.length) : 35, `${activePlans.length} geographic plans contribute progress.`, "/dashboard/lcdbo/delivery"),
    factor("dataQuality", "Data quality", input.dataQualityScore, "Data-quality score from existing LCDBO governance checks.", "/dashboard/lcdbo/data-quality"),
  ];
  const calculatedScore = Math.round(factors.reduce((sum, item) => sum + item.contribution, 0));
  const calculatedStatus = healthFromScore(calculatedScore);
  const finalStatus = input.override?.override_health ?? calculatedStatus;
  return {
    score: calculatedScore,
    status: finalStatus,
    statusText: input.override ? `Manual override: ${statusText(finalStatus)}` : statusText(finalStatus),
    calculatedAt: new Date().toISOString(),
    modelVersion: LCDBO_DELIVERY_HEALTH_MODEL_VERSION,
    factors,
    override: input.override ?? null,
    disclosure: "Calculated health excludes UAT/test records by default and treats missing approved reporting as a confidence risk.",
  };
}

function calculateScopedHealth(input: {
  targetType: ScopedHealthExplanation["targetType"];
  targetId: string;
  targetTitle: string;
  href: string;
  workstreams?: LcdboWorkstream[];
  items?: LcdboDeliveryItem[];
  raids?: LcdboRaidItem[];
  statePlans?: StatePlan[];
  lgaPlans?: LgaPlan[];
  clusterPlans?: ClusterPlan[];
  activities?: DeliveryActivity[];
  progressUpdates?: ProgressUpdate[];
  dataQualityScore?: number;
  excludedRecords?: number;
  override?: HealthOverride | null;
}): ScopedHealthExplanation {
  const health = calculateExplainableHealth({
    workstreams: input.workstreams ?? [],
    items: input.items ?? [],
    raids: input.raids ?? [],
    statePlans: input.statePlans ?? [],
    lgaPlans: input.lgaPlans ?? [],
    clusterPlans: input.clusterPlans ?? [],
    activities: input.activities ?? [],
    progressUpdates: input.progressUpdates ?? [],
    dataQualityScore: input.dataQualityScore ?? 70,
    override: input.override,
  });
  const includedRecords = [
    input.workstreams,
    input.items,
    input.raids,
    input.statePlans,
    input.lgaPlans,
    input.clusterPlans,
    input.activities,
    input.progressUpdates,
  ].reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
  return {
    ...health,
    targetType: input.targetType,
    targetId: input.targetId,
    targetTitle: input.targetTitle,
    includedRecords,
    excludedRecords: input.excludedRecords ?? 0,
    drillDownHref: input.href,
  };
}

function buildAttention(input: {
  items: LcdboDeliveryItem[];
  raids: LcdboRaidItem[];
  decisions: LcdboDecision[];
  statePlans: StatePlan[];
  lgaPlans: LgaPlan[];
  clusterPlans: ClusterPlan[];
  activities: DeliveryActivity[];
  progressUpdates: ProgressUpdate[];
  readiness: DerivedPilotReadiness[];
  qualityIssues: Array<{ code: string; label: string; count: number; detail: string; severity: "low" | "medium" | "high" }>;
}): AttentionItem[] {
  const now = new Date();
  const staleCutoffDays = 30;
  const items: AttentionItem[] = [];
  input.decisions.filter((item) => ["pending", "escalated"].includes(item.status)).forEach((item) => items.push({ id: item.id, category: "decision", severity: item.status === "escalated" ? "critical" : "high", title: item.decision_required, detail: item.recommendation ?? item.context ?? "Decision required.", source: "Decision register", classification: classifyDeliveryRecord(item), href: scopedHref(item, "decision"), dueDate: item.due_date }));
  input.raids.filter((item) => item.severity === "critical" && !["resolved", "closed", "cancelled"].includes(item.status)).forEach((item) => items.push({ id: item.id, category: "risk", severity: "critical", title: item.title, detail: item.mitigation_plan ?? item.description, source: "RAID register", classification: classifyDeliveryRecord(item), href: scopedHref(item, "risk"), dueDate: item.target_resolution_date }));
  input.items.filter((item) => item.due_date && new Date(item.due_date) < now && !["completed", "cancelled"].includes(item.status)).forEach((item) => items.push({ id: item.id, category: item.item_type === "milestone" ? "milestone" : "deliverable", severity: item.status === "blocked" ? "critical" : "high", title: item.title, detail: item.blocker_reason ?? "Delivery commitment is overdue.", source: "Milestone and deliverable register", classification: classifyDeliveryRecord(item), href: scopedHref(item, item.item_type === "milestone" ? "milestone" : "deliverable"), dueDate: item.due_date }));
  input.activities.filter((item) => item.planned_end_date && new Date(item.planned_end_date) < now && !["completed", "cancelled"].includes(item.status)).forEach((item) => items.push({ id: item.id, category: "activity", severity: item.status === "blocked" ? "critical" : "medium", title: item.title, detail: item.latest_update ?? "Local delivery activity is overdue.", source: "Delivery activity register", classification: classifyDeliveryRecord(item), href: scopedHref(item, "activity"), dueDate: item.planned_end_date }));
  [...input.statePlans, ...input.lgaPlans, ...input.clusterPlans].filter((plan) => plan.delivery_health === "red" || plan.reporting_completeness < 50).forEach((plan) => {
    const category = "cluster_id" in plan ? "cluster" : "lga_id" in plan ? "lga" : "state";
    items.push({ id: plan.id, category, severity: plan.delivery_health === "red" ? "high" : "medium", title: plan.title, detail: `Health ${plan.delivery_health}; reporting completeness ${plan.reporting_completeness}%.`, source: "Geographic delivery plan", classification: classifyDeliveryRecord(plan), href: scopedHref(plan, category) });
  });
  input.progressUpdates.filter((update) => ["submitted", "under_review"].includes(update.review_status) && (daysSince(update.submitted_at) ?? 0) > staleCutoffDays).forEach((update) => items.push({ id: update.id, category: "progress", severity: "medium", title: "Stale progress update awaiting review", detail: update.progress_summary, source: "Progress update queue", classification: classifyDeliveryRecord(update), href: scopedHref(update, "progress") }));
  input.qualityIssues.filter((issue) => issue.count > 0).forEach((issue) => items.push({ id: issue.code, category: "quality", severity: issue.severity, title: issue.label, detail: `${issue.count} exception(s). ${issue.detail}`, source: "Data quality centre", classification: "governed_estimate", href: "/dashboard/lcdbo/data-quality" }));
  input.readiness.filter((item) => item.blockingIssues > 0 || item.outcome === "not_ready").slice(0, 10).forEach((item) => items.push({ id: item.key, category: "readiness", severity: item.blockingIssues > 2 ? "high" : "medium", title: `${item.title} pilot readiness`, detail: `${item.blockingIssues} blocking readiness dimension(s); outcome ${item.outcome.replaceAll("_", " ")}.`, source: "Pilot-readiness framework", classification: item.classification, href: "/dashboard/lcdbo/pilot-readiness" }));
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 50);
}

function deriveReadinessForPlan(plan: StatePlan | LgaPlan | ClusterPlan, scopeType: "state" | "lga" | "cluster", persisted?: PilotReadinessAssessment | null): DerivedPilotReadiness {
  const classification = classifyDeliveryRecord(plan);
  const ownerId = scopeType === "state" ? (plan as StatePlan).state_coordinator_id : scopeType === "lga" ? (plan as LgaPlan).lga_delivery_lead_id : (plan as ClusterPlan).cluster_manager_id;
  const dimensions = [
    { key: "owner_assigned", requirement: "Delivery owner assigned", met: Boolean(ownerId), blocking: true, status: ownerId ? "met" : "missing", evidenceRequired: false, explanation: ownerId ? "A responsible owner is assigned." : "A responsible owner must be assigned before pilot readiness." },
    { key: "plan_approved", requirement: "Plan approved", met: plan.approval_status === "approved", blocking: true, status: plan.approval_status === "approved" ? "met" : "missing", evidenceRequired: true, explanation: `Current approval status is ${plan.approval_status}.` },
    { key: "activation_controlled", requirement: "Activation status suitable for controlled operations", met: ["approved", "mobilising", "active"].includes(plan.activation_status), blocking: true, status: ["approved", "mobilising", "active"].includes(plan.activation_status) ? "met" : "in_progress", evidenceRequired: false, explanation: `Current activation status is ${plan.activation_status}.` },
    { key: "reporting_cadence", requirement: "Reporting completeness at least 70%", met: plan.reporting_completeness >= 70, blocking: true, status: plan.reporting_completeness >= 70 ? "met" : "in_progress", evidenceRequired: false, explanation: `Reporting completeness is ${plan.reporting_completeness}%.` },
    { key: "progress_baseline", requirement: "Delivery progress baseline established", met: plan.progress_percentage > 0, blocking: false, status: plan.progress_percentage > 0 ? "met" : "in_progress", evidenceRequired: false, explanation: `Progress baseline is ${plan.progress_percentage}%.` },
    { key: "not_test_record", requirement: "Production record classification", met: classification !== "test_uat", blocking: true, status: classification !== "test_uat" ? "met" : "missing", evidenceRequired: false, explanation: classification === "test_uat" ? "Test/UAT records cannot be production pilot-ready." : "Record is not classified as UAT/test." },
  ];
  const blockingIssues = dimensions.filter((item) => item.blocking && !item.met).length;
  const score = pct(dimensions.filter((item) => item.met).length, dimensions.length);
  const outcome = persisted?.outcome ?? (blockingIssues > 0 ? "not_ready" : score >= 90 ? "ready_for_controlled_pilot" : "conditionally_ready");
  return { key: `${scopeType}:${plan.id}`, scopeType, title: plan.title, href: scopedHref(plan, scopeType), classification, outcome, score, blockingIssues, dimensions, persisted };
}

function buildEvidenceTargets(input: {
  workstreams: LcdboWorkstream[];
  items: LcdboDeliveryItem[];
  raids: LcdboRaidItem[];
  decisions: LcdboDecision[];
  statePlans: StatePlan[];
  lgaPlans: LgaPlan[];
  clusterPlans: ClusterPlan[];
  activities: DeliveryActivity[];
  progressUpdates: ProgressUpdate[];
  readiness: DerivedPilotReadiness[];
  evidence: EvidenceLink[];
}): EvidenceTarget[] {
  const evidenceCount = (type: EvidenceTarget["type"], id: string) => input.evidence.filter((item) => item.related_entity_type === type && item.related_entity_id === id).length;
  const target = (type: EvidenceTarget["type"], id: string, label: string, href: string, row: { metadata?: JsonRecord | null; reference?: string | null; title?: string | null; name?: string | null; progress_summary?: string | null }): EvidenceTarget => ({ key: `${type}:${id}`, type, id, label, href, classification: classifyDeliveryRecord(row), evidenceCount: evidenceCount(type, id) });
  return [
    ...input.workstreams.map((item) => target("workstream", item.id, `Workstream: ${item.reference} · ${item.name}`, `/dashboard/lcdbo/workstreams/${item.id}`, item)),
    ...input.items.map((item) => target("delivery_item", item.id, `${item.item_type}: ${item.reference} · ${item.title}`, "/dashboard/lcdbo/milestones", item)),
    ...input.raids.map((item) => target("raid_item", item.id, `RAID: ${item.reference} · ${item.title}`, "/dashboard/lcdbo/raid", item)),
    ...input.decisions.map((item) => target("decision", item.id, `Decision: ${item.reference} · ${item.decision_required}`, "/dashboard/lcdbo/decisions", item)),
    ...input.statePlans.map((item) => target("state_plan", item.id, `State plan: ${item.plan_reference} · ${item.title}`, `/dashboard/lcdbo/delivery/states/${item.id}`, item)),
    ...input.lgaPlans.map((item) => target("lga_plan", item.id, `LGA plan: ${item.plan_reference} · ${item.title}`, `/dashboard/lcdbo/delivery/lgas/${item.id}`, item)),
    ...input.clusterPlans.map((item) => target("cluster_plan", item.id, `Cluster plan: ${item.plan_reference} · ${item.title}`, `/dashboard/lcdbo/delivery/clusters/${item.id}`, item)),
    ...input.activities.map((item) => target("activity", item.id, `Activity: ${item.reference} · ${item.title}`, "/dashboard/lcdbo/my-work", item)),
    ...input.progressUpdates.map((item) => target("progress_update", item.id, `Progress update: ${item.progress_summary.slice(0, 90)}`, "/dashboard/lcdbo/my-work", item)),
    ...input.readiness.map((item) => ({ key: `pilot_readiness:${item.key.split(":")[1]}`, type: "pilot_readiness" as const, id: item.key.split(":")[1], label: `Pilot readiness: ${item.title}`, href: item.href, classification: item.classification, evidenceCount: evidenceCount("pilot_readiness", item.key.split(":")[1]) })),
  ].sort((a, b) => a.label.localeCompare(b.label)).slice(0, 200);
}

function buildScopedHealth(input: {
  workstreams: ReturnType<typeof applyProductionFilter<LcdboWorkstream>>;
  deliveryItems: ReturnType<typeof applyProductionFilter<LcdboDeliveryItem>>;
  raids: ReturnType<typeof applyProductionFilter<LcdboRaidItem>>;
  statePlans: ReturnType<typeof applyProductionFilter<StatePlan>>;
  lgaPlans: ReturnType<typeof applyProductionFilter<LgaPlan>>;
  clusterPlans: ReturnType<typeof applyProductionFilter<ClusterPlan>>;
  activities: ReturnType<typeof applyProductionFilter<DeliveryActivity>>;
  updates: ReturnType<typeof applyProductionFilter<ProgressUpdate>>;
  qualityScore: number;
  overrides: HealthOverride[];
  programmeId: string;
}): ScopedHealthExplanation[] {
  const overrideFor = (targetType: string, targetId: string) => input.overrides.find((item) => item.target_type === targetType && item.target_id === targetId);
  const scoped: ScopedHealthExplanation[] = [
    calculateScopedHealth({
      targetType: "programme",
      targetId: input.programmeId,
      targetTitle: "LCDBO programme",
      href: "/dashboard/lcdbo/executive",
      workstreams: input.workstreams.included,
      items: input.deliveryItems.included,
      raids: input.raids.included,
      statePlans: input.statePlans.included,
      lgaPlans: input.lgaPlans.included,
      clusterPlans: input.clusterPlans.included,
      activities: input.activities.included,
      progressUpdates: input.updates.included,
      dataQualityScore: input.qualityScore,
      excludedRecords: input.workstreams.excludedTest + input.deliveryItems.excludedTest + input.raids.excludedTest + input.statePlans.excludedTest + input.lgaPlans.excludedTest + input.clusterPlans.excludedTest + input.activities.excludedTest + input.updates.excludedTest,
      override: overrideFor("programme", input.programmeId),
    }),
  ];
  input.workstreams.included.slice(0, 20).forEach((workstream) => {
    const items = input.deliveryItems.included.filter((item) => item.workstream_id === workstream.id);
    const raids = input.raids.included.filter((item) => item.workstream_id === workstream.id);
    scoped.push(calculateScopedHealth({ targetType: "workstream", targetId: workstream.id, targetTitle: workstream.name, href: `/dashboard/lcdbo/workstreams/${workstream.id}`, workstreams: [workstream], items, raids, dataQualityScore: input.qualityScore, override: overrideFor("workstream", workstream.id) }));
  });
  input.statePlans.included.slice(0, 20).forEach((plan) => {
    const lgas = input.lgaPlans.included.filter((item) => item.state_plan_id === plan.id);
    const clusters = input.clusterPlans.included.filter((item) => item.state_plan_id === plan.id);
    const activities = input.activities.included.filter((item) => item.state_plan_id === plan.id);
    const updates = input.updates.included.filter((item) => item.state_plan_id === plan.id);
    scoped.push(calculateScopedHealth({ targetType: "state_plan", targetId: plan.id, targetTitle: plan.title, href: `/dashboard/lcdbo/delivery/states/${plan.id}`, statePlans: [plan], lgaPlans: lgas, clusterPlans: clusters, activities, progressUpdates: updates, dataQualityScore: input.qualityScore, override: overrideFor("state_plan", plan.id) }));
  });
  input.lgaPlans.included.slice(0, 20).forEach((plan) => {
    const clusters = input.clusterPlans.included.filter((item) => item.lga_plan_id === plan.id);
    const activities = input.activities.included.filter((item) => item.lga_plan_id === plan.id);
    const updates = input.updates.included.filter((item) => item.lga_plan_id === plan.id);
    scoped.push(calculateScopedHealth({ targetType: "lga_plan", targetId: plan.id, targetTitle: plan.title, href: `/dashboard/lcdbo/delivery/lgas/${plan.id}`, lgaPlans: [plan], clusterPlans: clusters, activities, progressUpdates: updates, dataQualityScore: input.qualityScore, override: overrideFor("lga_plan", plan.id) }));
  });
  input.clusterPlans.included.slice(0, 20).forEach((plan) => {
    const activities = input.activities.included.filter((item) => item.cluster_plan_id === plan.id);
    const updates = input.updates.included.filter((item) => item.cluster_plan_id === plan.id);
    scoped.push(calculateScopedHealth({ targetType: "cluster_plan", targetId: plan.id, targetTitle: plan.title, href: `/dashboard/lcdbo/delivery/clusters/${plan.id}`, clusterPlans: [plan], activities, progressUpdates: updates, dataQualityScore: input.qualityScore, override: overrideFor("cluster_plan", plan.id) }));
  });
  return scoped;
}

export async function getLcdboSprint3Snapshot(input: { client?: Client; includeTestData?: boolean } = {}): Promise<Sprint3Snapshot> {
  const supabase = await clientOrService(input.client);
  const includeTestData = Boolean(input.includeTestData);
  const [delivery, geography, intelligence] = await Promise.all([
    getLcdboDeliverySnapshot(supabase),
    getLcdboGeographyDeliverySnapshot(supabase),
    getLcdboIntelligenceSnapshot(supabase),
  ]);
  const programmeId = delivery.programme?.id ?? geography.programme?.id ?? intelligence.programme.id;
  const [evidence, persistedReadiness, overrides] = await Promise.all([
    listLcdboDeliveryEvidence(programmeId, supabase),
    listPersistedReadiness(programmeId, supabase),
    listHealthOverrides(programmeId, supabase),
  ]);
  const workstreams = applyProductionFilter(delivery.workstreams, includeTestData);
  const deliveryItems = applyProductionFilter(delivery.items, includeTestData);
  const raids = applyProductionFilter(delivery.raids, includeTestData);
  const decisions = applyProductionFilter(delivery.decisions, includeTestData);
  const statePlans = applyProductionFilter(geography.statePlans, includeTestData);
  const lgaPlans = applyProductionFilter(geography.lgaPlans, includeTestData);
  const clusterPlans = applyProductionFilter(geography.clusterPlans, includeTestData);
  const activities = applyProductionFilter(geography.activities, includeTestData);
  const updates = applyProductionFilter(geography.progressUpdates, includeTestData);
  const quality = calculateDataQuality(intelligence);
  const readiness = [
    ...statePlans.included.map((plan) => deriveReadinessForPlan(plan, "state", persistedReadiness.find((item) => item.state_plan_id === plan.id))),
    ...lgaPlans.included.map((plan) => deriveReadinessForPlan(plan, "lga", persistedReadiness.find((item) => item.lga_plan_id === plan.id))),
    ...clusterPlans.included.map((plan) => deriveReadinessForPlan(plan, "cluster", persistedReadiness.find((item) => item.cluster_plan_id === plan.id))),
  ];
  const programmeOverride = overrides.find((item) => item.target_type === "programme");
  const health = calculateExplainableHealth({
    workstreams: workstreams.included,
    items: deliveryItems.included,
    raids: raids.included,
    statePlans: statePlans.included,
    lgaPlans: lgaPlans.included,
    clusterPlans: clusterPlans.included,
    activities: activities.included,
    progressUpdates: updates.included,
    dataQualityScore: quality.score,
    override: programmeOverride,
  });
  const attention = buildAttention({
    items: deliveryItems.included,
    raids: raids.included,
    decisions: decisions.included,
    statePlans: statePlans.included,
    lgaPlans: lgaPlans.included,
    clusterPlans: clusterPlans.included,
    activities: activities.included,
    progressUpdates: updates.included,
    readiness,
    qualityIssues: quality.issues,
  });
  const scopedHealth = buildScopedHealth({ workstreams, deliveryItems, raids, statePlans, lgaPlans, clusterPlans, activities, updates, qualityScore: quality.score, overrides, programmeId });
  const filteredEvidence = includeTestData ? evidence : evidence.filter((item) => classifyDeliveryRecord(item) !== "test_uat");
  const evidenceTargets = buildEvidenceTargets({
    workstreams: workstreams.included,
    items: deliveryItems.included,
    raids: raids.included,
    decisions: decisions.included,
    statePlans: statePlans.included,
    lgaPlans: lgaPlans.included,
    clusterPlans: clusterPlans.included,
    activities: activities.included,
    progressUpdates: updates.included,
    readiness,
    evidence: filteredEvidence,
  });
  const generatedAt = new Date().toISOString();
  const reportingPeriod = "Current operating period";
  const excludedRecords = [workstreams, deliveryItems, raids, decisions, statePlans, lgaPlans, clusterPlans, activities, updates].reduce((sum, item) => sum + item.excludedTest, 0);
  const configuredTargets = [workstreams, deliveryItems, raids, decisions, statePlans, lgaPlans, clusterPlans, activities, updates].reduce((sum, item) => sum + item.configuredTargets, 0);
  const metrics: ExecutiveMetricLineage[] = [
    { title: "Overall programme progress", value: `${health.score}%`, classification: "governed_estimate", source: "Sprint 1/2 delivery records", calculationBasis: "Weighted health model score, not a raw achievement count.", lastRefreshed: generatedAt, scope: "LCDBO programme", reportingPeriod, drillDownHref: "/dashboard/lcdbo/executive", disclosure: health.disclosure, includedRecords: workstreams.included.length + deliveryItems.included.length + statePlans.included.length + lgaPlans.included.length + clusterPlans.included.length, excludedRecords, modelVersion: LCDBO_EXECUTIVE_METRIC_VERSION },
    { title: "Workstreams on track", value: workstreams.included.filter((item) => item.health === "green").length, classification: configuredTargets ? "configured_target" : "live_operational", source: "Workstream register", calculationBasis: "Count of non-test workstreams with green RAG health.", lastRefreshed: generatedAt, scope: "Programme", reportingPeriod, drillDownHref: "/dashboard/lcdbo/workstreams", disclosure: "Configured target workstreams are planning records until live updates replace them.", includedRecords: workstreams.included.length, excludedRecords: workstreams.excludedTest, modelVersion: LCDBO_EXECUTIVE_METRIC_VERSION },
    { title: "Overdue milestones", value: deliveryItems.included.filter((item) => item.due_date && new Date(item.due_date) < new Date() && !["completed", "cancelled"].includes(item.status)).length, classification: "live_operational", source: "Milestone and deliverable register", calculationBasis: "Non-test milestone/deliverable records past due date and not complete/cancelled.", lastRefreshed: generatedAt, scope: "Programme", reportingPeriod, drillDownHref: "/dashboard/lcdbo/milestones", disclosure: "Missing due dates are disclosed through attention lineage but are not treated as overdue.", includedRecords: deliveryItems.included.length, excludedRecords: deliveryItems.excludedTest, modelVersion: LCDBO_EXECUTIVE_METRIC_VERSION },
    { title: "Open critical risks", value: raids.included.filter((item) => item.severity === "critical" && !["resolved", "closed", "cancelled"].includes(item.status)).length, classification: "live_operational", source: "RAID register", calculationBasis: "Critical RAID items not resolved, closed or cancelled.", lastRefreshed: generatedAt, scope: "Programme", reportingPeriod, drillDownHref: "/dashboard/lcdbo/raid", disclosure: "Risk severity is sourced from governed RAID records.", includedRecords: raids.included.length, excludedRecords: raids.excludedTest, modelVersion: LCDBO_EXECUTIVE_METRIC_VERSION },
    { title: "Pending executive decisions", value: decisions.included.filter((item) => ["pending", "escalated"].includes(item.status)).length, classification: "live_operational", source: "Decision register", calculationBasis: "Decision records with pending or escalated status.", lastRefreshed: generatedAt, scope: "Programme", reportingPeriod, drillDownHref: "/dashboard/lcdbo/decisions", disclosure: "No duplicate decisions are created by health calculations.", includedRecords: decisions.included.length, excludedRecords: decisions.excludedTest, modelVersion: LCDBO_EXECUTIVE_METRIC_VERSION },
    { title: "Active states", value: statePlans.included.filter((item) => ["mobilising", "active"].includes(item.activation_status)).length, classification: "live_operational", source: "State delivery plans", calculationBasis: "State plans with mobilising or active activation status.", lastRefreshed: generatedAt, scope: "State delivery", reportingPeriod, drillDownHref: "/dashboard/lcdbo/delivery/states", disclosure: "Reference geography is not counted as active delivery.", includedRecords: statePlans.included.length, excludedRecords: statePlans.excludedTest, modelVersion: LCDBO_EXECUTIVE_METRIC_VERSION },
    { title: "Progress updates awaiting review", value: updates.included.filter((item) => ["submitted", "under_review"].includes(item.review_status)).length, classification: "live_operational", source: "Append-only progress updates", calculationBasis: "Submitted or under-review progress updates excluding UAT/test records.", lastRefreshed: generatedAt, scope: "Programme/geography", reportingPeriod, drillDownHref: "/dashboard/lcdbo/my-work", disclosure: "Coordinators cannot approve their own progress updates.", includedRecords: updates.included.length, excludedRecords: updates.excludedTest, modelVersion: LCDBO_EXECUTIVE_METRIC_VERSION },
    { title: "Pilot-ready geographies/clusters", value: readiness.filter((item) => item.outcome === "ready_for_controlled_pilot" || item.outcome === "active").length, classification: "governed_estimate", source: "Pilot-readiness framework", calculationBasis: "Derived readiness dimensions plus any approved persisted readiness outcome.", lastRefreshed: generatedAt, scope: "State/LGA/cluster plans", reportingPeriod, drillDownHref: "/dashboard/lcdbo/pilot-readiness", disclosure: "Readiness is not inferred from plan existence; blocking dimensions prevent ready status.", includedRecords: readiness.length, excludedRecords: statePlans.excludedTest + lgaPlans.excludedTest + clusterPlans.excludedTest, modelVersion: LCDBO_EXECUTIVE_METRIC_VERSION },
  ];
  return { generatedAt, includeTestData, deliveryUnavailable: delivery.unavailable, geographyUnavailable: geography.unavailable, metrics, health, attention, evidence: filteredEvidence, evidenceTargets, readiness, scopedHealth, productionCounts: { included: metrics.reduce((sum, item) => sum + item.includedRecords, 0), excludedTest: excludedRecords, configuredTargets } };
}

export async function createEvidenceLink(input: { formData: FormData; client?: Client }) {
  const access = await requireLcdboDeliveryAccess("manage", input.client);
  const actorUserId = access.ctx.appUserId!;
  const relatedEntity = String(input.formData.get("related_entity") ?? "").trim();
  const [selectedType, selectedId] = relatedEntity.includes(":") ? relatedEntity.split(":") : [];
  const relatedEntityType = String(input.formData.get("related_entity_type") ?? selectedType ?? "").trim();
  const relatedEntityId = String(input.formData.get("related_entity_id") ?? selectedId ?? "").trim();
  const evidenceType = String(input.formData.get("evidence_type") ?? "reference_note").trim();
  const safeUrl = String(input.formData.get("safe_url") ?? "").trim() || null;
  if (safeUrl) {
    const url = new URL(safeUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Evidence links must use http or https.");
  }
  const payload = {
    programme_id: access.programme.id,
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    evidence_type: evidenceType,
    reference_title: String(input.formData.get("reference_title") ?? "").trim(),
    safe_url: safeUrl,
    reference_note: String(input.formData.get("reference_note") ?? "").trim() || null,
    status: "submitted",
    data_classification: String(input.formData.get("data_classification") ?? "operational"),
    submitted_by: actorUserId,
    metadata: { source: "lcdbo_delivery_core_sprint3", model_version: LCDBO_EXECUTIVE_METRIC_VERSION },
  };
  const { data, error } = await access.supabase.from("lcdbo_delivery_evidence_links").insert(payload).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to link evidence.");
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: "lcdbo.delivery.evidence.linked", entityType: "lcdbo_delivery_evidence_link", entityId: data.id, scopeType: "programme", scopeId: access.programme.id, metadata: { related_entity_type: relatedEntityType, evidence_type: evidenceType, status: "submitted" } });
  return data as EvidenceLink;
}

export async function reviewEvidenceLink(input: { formData: FormData; client?: Client }) {
  const access = await requireLcdboDeliveryAccess("manage", input.client);
  const actorUserId = access.ctx.appUserId!;
  const id = String(input.formData.get("evidence_id") ?? "");
  const status = String(input.formData.get("status") ?? "");
  if (!["under_review", "verified", "rejected", "superseded", "expired"].includes(status)) throw new Error("Invalid evidence review status.");
  const existing = await access.supabase.from("lcdbo_delivery_evidence_links").select("*").eq("id", id).eq("programme_id", access.programme.id).single();
  if (existing.error || !existing.data) throw existing.error ?? new Error("Evidence link not found.");
  if (["verified", "rejected"].includes(status) && existing.data.submitted_by === actorUserId) throw new Error("Submitters cannot verify or reject their own evidence.");
  const { data, error } = await access.supabase.from("lcdbo_delivery_evidence_links").update({ status, reviewed_by: actorUserId, reviewed_at: new Date().toISOString(), verification_outcome: status, verification_note: String(input.formData.get("verification_note") ?? "").trim() || null }).eq("id", id).eq("programme_id", access.programme.id).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to review evidence.");
  const review = await access.supabase.from("lcdbo_delivery_evidence_reviews").insert({ evidence_link_id: id, previous_status: existing.data.status, new_status: status, reviewed_by: actorUserId, review_note: data.verification_note, verification_outcome: status, metadata: { source: "lcdbo_delivery_core_sprint3" } });
  if (review.error) throw review.error;
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: `lcdbo.delivery.evidence.${status}`, entityType: "lcdbo_delivery_evidence_link", entityId: id, scopeType: "programme", scopeId: access.programme.id, metadata: { previous_status: existing.data.status, new_status: status } });
  return data as EvidenceLink;
}

async function findExistingPilotReadiness(client: Client, payload: PilotReadinessPayload) {
  let query = client.from("lcdbo_pilot_readiness_assessments").select("*").eq("programme_id", payload.programme_id).eq("scope_type", payload.scope_type).limit(1);
  if (payload.scope_type === "state") query = query.eq("state_plan_id", payload.state_plan_id);
  if (payload.scope_type === "lga") query = query.eq("lga_plan_id", payload.lga_plan_id);
  if (payload.scope_type === "cluster") query = query.eq("cluster_plan_id", payload.cluster_plan_id);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as PilotReadinessAssessment | null;
}

async function savePilotReadinessPayload(client: Client, payload: PilotReadinessPayload) {
  const existing = await findExistingPilotReadiness(client, payload);
  if (existing) {
    const { data, error } = await client
      .from("lcdbo_pilot_readiness_assessments")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Unable to update pilot readiness.");
    return data as PilotReadinessAssessment;
  }

  const { data, error } = await client.from("lcdbo_pilot_readiness_assessments").insert(payload).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to create pilot readiness.");
  return data as PilotReadinessAssessment;
}

export async function savePilotReadinessAssessment(input: { formData: FormData; client?: Client }) {
  const access = await requireLcdboDeliveryAccess("manage", input.client);
  const actorUserId = access.ctx.appUserId!;
  const scopeType = String(input.formData.get("scope_type") ?? "") as "state" | "lga" | "cluster";
  const score = Math.max(0, Math.min(100, Number(input.formData.get("readiness_score") ?? 0)));
  const blocking = Math.max(0, Number(input.formData.get("blocking_issue_count") ?? 0));
  const requestedOutcome = String(input.formData.get("outcome") ?? "not_ready") as PilotReadinessAssessment["outcome"];
  if ((requestedOutcome === "ready_for_controlled_pilot" || requestedOutcome === "active") && blocking > 0) throw new Error("Blocking readiness dimensions prevent ready or active status.");
  if (!["state", "lga", "cluster"].includes(scopeType)) throw new Error("Invalid pilot readiness scope.");
  const payload: PilotReadinessPayload = {
    programme_id: access.programme.id,
    scope_type: scopeType,
    state_plan_id: String(input.formData.get("state_plan_id") ?? "").trim() || null,
    lga_plan_id: String(input.formData.get("lga_plan_id") ?? "").trim() || null,
    cluster_plan_id: String(input.formData.get("cluster_plan_id") ?? "").trim() || null,
    outcome: requestedOutcome,
    readiness_score: score,
    blocking_issue_count: blocking,
    assessment_status: String(input.formData.get("assessment_status") ?? "under_review"),
    override_reason: String(input.formData.get("override_reason") ?? "").trim() || null,
    assessed_by: actorUserId,
    reviewed_by: ["approved", "rejected"].includes(String(input.formData.get("assessment_status") ?? "")) ? actorUserId : null,
    reviewed_at: ["approved", "rejected"].includes(String(input.formData.get("assessment_status") ?? "")) ? new Date().toISOString() : null,
    metadata: { source: "lcdbo_delivery_core_sprint3", model_version: LCDBO_PILOT_READINESS_MODEL_VERSION },
  };
  if (scopeType === "state" && !payload.state_plan_id) throw new Error("State plan is required for pilot readiness.");
  if (scopeType === "lga" && !payload.lga_plan_id) throw new Error("LGA plan is required for pilot readiness.");
  if (scopeType === "cluster" && !payload.cluster_plan_id) throw new Error("Cluster plan is required for pilot readiness.");
  const data = await savePilotReadinessPayload(access.supabase, payload);
  const eventType = data.override_reason
    ? "lcdbo.delivery.pilot_readiness.override_applied"
    : data.outcome === "paused"
      ? "lcdbo.delivery.pilot_readiness.paused"
      : data.assessment_status === "approved"
        ? "lcdbo.delivery.pilot_readiness.approved"
        : "lcdbo.delivery.pilot_readiness.assessed";
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType, entityType: "lcdbo_pilot_readiness_assessment", entityId: data.id, scopeType: "programme", scopeId: access.programme.id, metadata: { scope_type: scopeType, outcome: data.outcome, readiness_score: data.readiness_score, blocking_issue_count: data.blocking_issue_count } });
  return data as PilotReadinessAssessment;
}

export async function applyHealthOverride(input: { formData: FormData; client?: Client }) {
  const access = await requireLcdboDeliveryAccess("manage", input.client);
  const actorUserId = access.ctx.appUserId!;
  const reason = String(input.formData.get("override_reason") ?? "").trim();
  if (!reason) throw new Error("A health override reason is required.");
  const payload = {
    programme_id: access.programme.id,
    target_type: String(input.formData.get("target_type") ?? "programme"),
    target_id: String(input.formData.get("target_id") ?? access.programme.id),
    calculated_health: String(input.formData.get("calculated_health") ?? "grey"),
    override_health: String(input.formData.get("override_health") ?? "amber"),
    override_reason: reason,
    applied_by: actorUserId,
    metadata: { source: "lcdbo_delivery_core_sprint3", model_version: LCDBO_DELIVERY_HEALTH_MODEL_VERSION },
  };
  const { data, error } = await access.supabase.from("lcdbo_delivery_health_overrides").insert(payload).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to apply health override.");
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: "lcdbo.delivery.health_override.applied", entityType: "lcdbo_delivery_health_override", entityId: data.id, scopeType: "programme", scopeId: access.programme.id, metadata: { target_type: payload.target_type, override_health: payload.override_health } });
  return data as HealthOverride;
}

export async function removeHealthOverride(input: { overrideId: string; client?: Client }) {
  const access = await requireLcdboDeliveryAccess("manage", input.client);
  const actorUserId = access.ctx.appUserId!;
  const { data, error } = await access.supabase
    .from("lcdbo_delivery_health_overrides")
    .update({ status: "removed", removed_by: actorUserId, removed_at: new Date().toISOString() })
    .eq("id", input.overrideId)
    .eq("programme_id", access.programme.id)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Unable to remove health override.");
  await recordTrustedLcdboDeliveryEvent({ actorUserId, eventType: "lcdbo.delivery.health_override.removed", entityType: "lcdbo_delivery_health_override", entityId: data.id, scopeType: "programme", scopeId: access.programme.id, metadata: { target_type: data.target_type } });
  return data as HealthOverride;
}

type Sprint3SnapshotReportType = "executive_delivery" | "executive_exceptions" | "pilot_readiness" | "evidence_verification" | "programme_delivery" | "workstream_performance" | "milestone_deliverable" | "risk_issue" | "state_delivery" | "lga_delivery" | "cluster_delivery";

export async function generateSprint3ReportSnapshot(input: { reportType: Sprint3SnapshotReportType; generatedBy: string | null; client?: Client; includeTestData?: boolean }) {
  const supabase = await clientOrService(input.client);
  const snapshot = await getLcdboSprint3Snapshot({ client: supabase, includeTestData: input.includeTestData });
  const programmeId = snapshot.metrics[0]?.scope ? (await getLcdboDeliverySnapshot(supabase)).programme?.id : null;
  if (!programmeId) throw new Error("LCDBO programme is not configured.");
  const report = await generateReportSnapshot({ programmeId, reportType: input.reportType, frequency: "daily", generatedBy: input.generatedBy, metrics: { sprint3: snapshot, calculation_version: LCDBO_EXECUTIVE_METRIC_VERSION }, dimensions: { scope_type: "programme", include_test_data: Boolean(input.includeTestData), sprint: "delivery_core_sprint3" }, client: supabase });
  if (input.generatedBy) await recordTrustedLcdboDeliveryEvent({ actorUserId: input.generatedBy, eventType: "lcdbo.delivery.snapshot.generated", entityType: "lcdbo_report_snapshot", entityId: report.id, scopeType: "programme", scopeId: programmeId, metadata: { report_type: input.reportType, include_test_data: Boolean(input.includeTestData) } });
  return report;
}

export type Sprint3ExportDataset = "executive-metrics" | "executive-attention" | "pilot-readiness" | "evidence" | Sprint3ReportFamily;

const REPORT_FAMILY_TITLES: Record<Sprint3ReportFamily, string> = {
  "programme-delivery": "Programme Delivery Report",
  "workstream-performance": "Workstream Performance Report",
  "milestone-deliverable": "Milestone and Deliverable Performance Report",
  "risk-issue": "Risk and Issue Register Report",
  "state-delivery": "State Delivery Report",
  "lga-delivery": "LGA Delivery Report",
  "cluster-delivery": "Cluster Delivery Report",
  "executive-exceptions": "Executive Exceptions Report",
  "pilot-readiness": "Pilot-Readiness Report",
  "evidence-verification": "Evidence Verification Report",
};

function reportFamilyRows(dataset: Sprint3ReportFamily, snapshot: Sprint3Snapshot): unknown[][] {
  const disclosure = `UAT/test records excluded by default: ${!snapshot.includeTestData}. Excluded records: ${snapshot.productionCounts.excludedTest}.`;
  if (dataset === "programme-delivery") return [["Metric", "Value", "Classification", "Basis", "Disclosure"], ...snapshot.metrics.map((item) => [item.title, item.value, item.classification, item.calculationBasis, item.disclosure])];
  if (dataset === "workstream-performance") return [["Scope", "Score", "Status", "Included records", "Excluded test records", "Version"], ...snapshot.scopedHealth.filter((item) => item.targetType === "workstream").map((item) => [item.targetTitle, item.score, item.statusText, item.includedRecords, item.excludedRecords, item.modelVersion])];
  if (dataset === "milestone-deliverable") return [["Exception", "Severity", "Detail", "Source", "Disclosure"], ...snapshot.attention.filter((item) => ["milestone", "deliverable"].includes(item.category)).map((item) => [item.title, item.severity, item.detail, item.source, disclosure])];
  if (dataset === "risk-issue") return [["Risk/Issue", "Severity", "Detail", "Source", "Disclosure"], ...snapshot.attention.filter((item) => item.category === "risk").map((item) => [item.title, item.severity, item.detail, item.source, disclosure])];
  if (dataset === "state-delivery") return [["State plan", "Score", "Status", "Included records", "Drill down", "Disclosure"], ...snapshot.scopedHealth.filter((item) => item.targetType === "state_plan").map((item) => [item.targetTitle, item.score, item.statusText, item.includedRecords, item.drillDownHref, disclosure])];
  if (dataset === "lga-delivery") return [["LGA plan", "Score", "Status", "Included records", "Drill down", "Disclosure"], ...snapshot.scopedHealth.filter((item) => item.targetType === "lga_plan").map((item) => [item.targetTitle, item.score, item.statusText, item.includedRecords, item.drillDownHref, disclosure])];
  if (dataset === "cluster-delivery") return [["Cluster plan", "Score", "Status", "Included records", "Drill down", "Disclosure"], ...snapshot.scopedHealth.filter((item) => item.targetType === "cluster_plan").map((item) => [item.targetTitle, item.score, item.statusText, item.includedRecords, item.drillDownHref, disclosure])];
  if (dataset === "executive-exceptions") return [["Severity", "Category", "Title", "Source", "Detail", "Classification"], ...snapshot.attention.map((item) => [item.severity, item.category, item.title, item.source, item.detail, item.classification])];
  if (dataset === "pilot-readiness") return [["Scope", "Title", "Outcome", "Score", "Blocking issues", "Readiness model", "Classification"], ...snapshot.readiness.map((item) => [item.scopeType, item.title, item.outcome, item.score, item.blockingIssues, LCDBO_PILOT_READINESS_MODEL_VERSION, item.classification])];
  return [["Title", "Related record", "Type", "Status", "Classification", "Submitted", "Reviewed"], ...snapshot.evidence.map((item) => [item.reference_title, `${item.related_entity_type}:${item.related_entity_id}`, item.evidence_type, item.status, item.data_classification, item.submitted_at, item.reviewed_at])];
}

export function buildSprint3PdfInput(snapshot: Sprint3Snapshot, reportFamily: Sprint3ReportFamily): LcdboPdfReportInput {
  const rows = reportFamilyRows(reportFamily, snapshot);
  const exceptions = snapshot.attention.slice(0, 5).map((item) => `${item.severity.toUpperCase()}: ${item.title} - ${item.detail}`);
  const readiness = countRows(snapshot.readiness.map((item) => item.outcome));
  const healthRows = snapshot.scopedHealth.filter((item) => reportFamily.includes("state") ? item.targetType === "state_plan" : reportFamily.includes("lga") ? item.targetType === "lga_plan" : reportFamily.includes("cluster") ? item.targetType === "cluster_plan" : true);
  return {
    title: REPORT_FAMILY_TITLES[reportFamily],
    reportType: reportFamily,
    generatedAt: new Date().toLocaleDateString("en-NG", { dateStyle: "long" }),
    subtitle: "LCDBO Programme Delivery Core governed report",
    kpis: [
      { label: "Health score", value: String(snapshot.health.score) },
      { label: "Attention items", value: String(snapshot.attention.length) },
      { label: "Pilot-ready", value: String(snapshot.readiness.filter((item) => ["ready_for_controlled_pilot", "active"].includes(item.outcome)).length) },
      { label: "Evidence links", value: String(snapshot.evidence.length) },
      { label: "Included records", value: String(snapshot.productionCounts.included) },
      { label: "Excluded UAT/test", value: String(snapshot.productionCounts.excludedTest) },
      { label: "Health scopes", value: String(healthRows.length) },
      { label: "Report rows", value: String(Math.max(0, rows.length - 1)) },
    ],
    pipeline: snapshot.metrics.slice(0, 7).map((item) => ({ label: item.title, value: Number.parseInt(String(item.value).replace(/\D/g, ""), 10) || 0 })),
    readiness,
    topSectors: healthRows.slice(0, 8).map((item) => [item.targetTitle, item.score] as [string, number]),
    topStates: snapshot.readiness.slice(0, 8).map((item) => [item.title, item.score] as [string, number]),
    qualityScore: snapshot.health.factors.find((item) => item.code === "dataQuality")?.score ?? 0,
    healthScore: snapshot.health.score,
    estimates: [
      { label: "Health model", value: LCDBO_DELIVERY_HEALTH_MODEL_VERSION },
      { label: "Readiness model", value: LCDBO_PILOT_READINESS_MODEL_VERSION },
      { label: "Classification", value: "Governed delivery report" },
      { label: "Test data included", value: snapshot.includeTestData ? "Yes" : "No" },
      { label: "Generated records", value: String(Math.max(0, rows.length - 1)) },
    ],
    disclosures: [
      "UAT/test records are excluded by default and inclusion requires explicit authorized diagnostic mode.",
      "Configured targets, reference geography and governed estimates are not presented as live operational achievements.",
      `Health model: ${LCDBO_DELIVERY_HEALTH_MODEL_VERSION}. Readiness model: ${LCDBO_PILOT_READINESS_MODEL_VERSION}.`,
    ],
    executiveSummary: `${REPORT_FAMILY_TITLES[reportFamily]} generated for current LCDBO delivery records. Report period: current operating period. Generated timestamp: ${snapshot.generatedAt}.`,
    opportunities: snapshot.metrics.slice(0, 3).map((item) => `${item.title}: ${item.value}. ${item.calculationBasis}`),
    risks: exceptions.length ? exceptions : ["No executive attention exceptions were detected in the current filtered dataset."],
    recommendations: [
      "Review high-severity attention items before approving controlled-pilot readiness.",
      "Link evidence to records used in executive decisions and preserve verification history.",
      "Refresh governed snapshots after material delivery updates.",
    ],
  };
}

function countRows(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export async function exportLcdboSprint3Data(dataset: Sprint3ExportDataset, accessClient?: Client, includeTestData = false) {
  const access = await requireLcdboDeliveryAccess("export", accessClient);
  const snapshot = await getLcdboSprint3Snapshot({ client: access.supabase, includeTestData });
  let rows: unknown[][] = [];
  if (dataset in REPORT_FAMILY_TITLES) rows = reportFamilyRows(dataset as Sprint3ReportFamily, snapshot);
  else if (dataset === "executive-metrics") rows = [["Metric", "Value", "Classification", "Source", "Calculation basis", "Drill down", "Excluded test records"], ...snapshot.metrics.map((item) => [item.title, item.value, item.classification, item.source, item.calculationBasis, item.drillDownHref, item.excludedRecords])];
  else if (dataset === "executive-attention") rows = [["Severity", "Category", "Title", "Source", "Detail", "Classification", "Link"], ...snapshot.attention.map((item) => [item.severity, item.category, item.title, item.source, item.detail, item.classification, item.href])];
  else if (dataset === "pilot-readiness") rows = [["Scope", "Title", "Outcome", "Score", "Blocking issues", "Classification"], ...snapshot.readiness.map((item) => [item.scopeType, item.title, item.outcome, item.score, item.blockingIssues, item.classification])];
  else rows = [["Title", "Related record", "Type", "Status", "Classification", "Submitted", "Reviewed"], ...snapshot.evidence.map((item) => [item.reference_title, `${item.related_entity_type}:${item.related_entity_id}`, item.evidence_type, item.status, item.data_classification, item.submitted_at, item.reviewed_at])];
  await recordTrustedLcdboDeliveryEvent({ actorUserId: access.ctx.appUserId!, eventType: "lcdbo.delivery.executive_report.generated", entityType: "lcdbo_delivery_sprint3_export", scopeType: "programme", scopeId: access.programme.id, metadata: { dataset, row_count: Math.max(0, rows.length - 1), include_test_data: includeTestData } });
  return { csv: csv(rows), filename: `lcdbo-sprint3-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`, rowCount: Math.max(0, rows.length - 1) };
}
