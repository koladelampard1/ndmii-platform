import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getLcdboIntelligenceSnapshot, type LcdboIntelligenceSnapshot } from "@/lib/data/lcdbo-intelligence";

type Client = SupabaseClient<any>;
export type SnapshotFrequency = "daily" | "weekly" | "monthly" | "quarterly";
export type KpiDefinition = { id: string; programme_id: string; code: string; name: string; description: string; category: string; calculation_method: string; unit: string; owner: string; reporting_frequency: SnapshotFrequency; active: boolean; metadata: Record<string, unknown> };
export type KpiSnapshot = { id: string; programme_id: string; kpi_definition_id: string; snapshot_date: string; frequency: SnapshotFrequency; value: number; dimensions: Record<string, unknown>; generated_by: string | null; notes: string | null; created_at: string; definition?: KpiDefinition | null };
export type ReportSnapshot = { id: string; programme_id: string; snapshot_date: string; report_type: string; frequency: SnapshotFrequency; metrics_payload: Record<string, any>; generated_by: string | null; notes: string | null; created_at: string };
export type QualityIssue = { code: string; label: string; count: number; severity: "low" | "medium" | "high"; detail: string };
export type DataQualityResult = { score: number; completeness: number; consistency: number; coverage: number; issues: QualityIssue[] };
export type ProgrammeHealthResult = { score: number; participation: number; readiness: number; activity: number; documentCompletion: number; alerts: QualityIssue[] };

export function isGovernanceSchemaUnavailable(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message ?? "") : String(error ?? "");
  return ["42P01", "PGRST200", "PGRST205"].includes(code) || /relation .*lcdbo_(kpi|report)_(definitions|snapshots).* does not exist|could not find .*lcdbo_(kpi|report)_(definitions|snapshots).*schema cache/i.test(message);
}

async function service(client?: Client) { return client ?? await createServiceRoleSupabaseClient(); }
function daysSince(value: string | null | undefined) { if (!value) return 0; return Math.floor((Date.now() - new Date(value).getTime()) / 86400000); }
function percent(numerator: number, denominator: number) { return denominator ? Math.round((numerator / denominator) * 100) : 100; }

export async function getKpiDefinitions(programmeId: string, client?: Client): Promise<KpiDefinition[]> {
  const supabase = await service(client);
  const { data, error } = await supabase.from("lcdbo_kpi_definitions").select("*").eq("programme_id", programmeId).eq("active", true).order("category").order("name");
  if (error && isGovernanceSchemaUnavailable(error)) return [];
  if (error) throw error;
  return (data ?? []) as KpiDefinition[];
}

export function calculateKpi(code: string, snapshot: LcdboIntelligenceSnapshot): number {
  const values: Record<string, number> = {
    total_msmes: snapshot.metrics.totalMsmes,
    active_participants: snapshot.metrics.activeParticipants,
    cluster_interests: snapshot.interests.length,
    active_clusters: snapshot.clusters.filter((cluster) => cluster.status === "active").length,
    readiness_completed: snapshot.metrics.assessmentsCompleted,
    ready_for_investment: snapshot.assessments.filter((item) => item.readiness_level === "ready_for_investment").length,
    ready_for_export: snapshot.assessments.filter((item) => item.readiness_level === "ready_for_export").length,
    documents_reviewed: snapshot.metrics.documentsReviewed,
    states_covered: snapshot.metrics.statesCovered,
    lgas_covered: snapshot.metrics.lgasCovered,
    officers_assigned: snapshot.metrics.officersAssigned,
  };
  if (!(code in values)) throw new Error(`Unsupported LCDBO KPI: ${code}`);
  return values[code];
}

export async function generateKpiSnapshot(input: { programmeId: string; frequency: SnapshotFrequency; generatedBy: string | null; snapshotDate?: string; notes?: string; client?: Client }) {
  const supabase = await service(input.client);
  const [definitions, intelligence] = await Promise.all([getKpiDefinitions(input.programmeId, supabase), getLcdboIntelligenceSnapshot(supabase)]);
  const snapshotDate = input.snapshotDate ?? new Date().toISOString().slice(0, 10);
  const rows = definitions.map((definition) => ({ programme_id: input.programmeId, kpi_definition_id: definition.id, snapshot_date: snapshotDate, frequency: input.frequency, value: calculateKpi(definition.code, intelligence), dimensions: { scope_type: "programme", programme_id: input.programmeId }, generated_by: input.generatedBy, notes: input.notes?.trim() || null, metadata: { source: "lcdbo_governance_sprint_c", definition_code: definition.code } }));
  if (!rows.length) throw new Error("LCDBO KPI governance tables are unavailable or no active KPI definitions are configured.");
  const { data, error } = await supabase.from("lcdbo_kpi_snapshots").upsert(rows, { onConflict: "kpi_definition_id,snapshot_date,frequency" }).select("*");
  if (error) throw error;
  return data as KpiSnapshot[];
}

export async function getKpiSnapshots(programmeId: string, limit = 180, client?: Client): Promise<KpiSnapshot[]> {
  const supabase = await service(client);
  const { data, error } = await supabase.from("lcdbo_kpi_snapshots").select("*,definition:lcdbo_kpi_definitions(*)").eq("programme_id", programmeId).order("snapshot_date", { ascending: false }).limit(limit);
  if (error && isGovernanceSchemaUnavailable(error)) return [];
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, definition: Array.isArray(row.definition) ? row.definition[0] ?? null : row.definition })) as KpiSnapshot[];
}

export async function generateReportSnapshot(input: { programmeId: string; reportType: ReportSnapshot["report_type"]; frequency: SnapshotFrequency; generatedBy: string | null; snapshotDate?: string; notes?: string; metrics?: Record<string, unknown>; dimensions?: Record<string, unknown>; exportCapture?: { capturedAt: string; metrics: Record<string, unknown>; dimensions: Record<string, unknown> }; client?: Client }) {
  const supabase = await service(input.client);
  const snapshotDate = input.snapshotDate ?? new Date().toISOString().slice(0, 10);
  const dimensions = input.dimensions ?? { scope_type: "programme", programme_id: input.programmeId };
  let metrics = input.metrics ?? input.exportCapture?.metrics;
  if (!metrics) {
    const intelligence = await getLcdboIntelligenceSnapshot(supabase);
    metrics = { metrics: intelligence.metrics, pipeline: intelligence.pipeline, readiness: intelligence.readiness, estimates: intelligence.estimates, quality: calculateDataQuality(intelligence), health: calculateProgrammeHealth(intelligence) };
  }
  let metricsPayload: Record<string, unknown> = { ...metrics, dimensions };
  const { data: existing, error: existingError } = await supabase.from("lcdbo_report_snapshots").select("metrics_payload").eq("programme_id", input.programmeId).eq("snapshot_date", snapshotDate).eq("report_type", input.reportType).eq("frequency", input.frequency).maybeSingle();
  if (existingError) throw existingError;
  const existingPayload = (existing?.metrics_payload ?? {}) as Record<string, unknown>;
  const existingExports = Array.isArray(existingPayload.exports) ? existingPayload.exports : [];
  if (input.exportCapture) {
    const exportEntry = { captured_at: input.exportCapture.capturedAt, dimensions: input.exportCapture.dimensions, metrics: input.exportCapture.metrics };
    metricsPayload = Object.keys(existingPayload).length ? { ...existingPayload, exports: [...existingExports.slice(-49), exportEntry] } : { ...metricsPayload, exports: [exportEntry] };
  } else if (existingExports.length) {
    metricsPayload = { ...metricsPayload, exports: existingExports };
  }
  const { data, error } = await supabase.from("lcdbo_report_snapshots").upsert({ programme_id: input.programmeId, snapshot_date: snapshotDate, report_type: input.reportType, frequency: input.frequency, metrics_payload: metricsPayload, generated_by: input.generatedBy, notes: input.notes?.trim() || null, metadata: { source: "lcdbo_governance_sprint_c", programme_estimates_disclosed: true, dimensions } }, { onConflict: "programme_id,snapshot_date,report_type,frequency" }).select("*").single();
  if (error) throw error;
  return data as ReportSnapshot;
}

export async function getReportSnapshots(programmeId: string, reportType?: string, limit = 24, client?: Client): Promise<ReportSnapshot[]> {
  const supabase = await service(client);
  let query = supabase.from("lcdbo_report_snapshots").select("*").eq("programme_id", programmeId).order("snapshot_date", { ascending: false }).limit(limit);
  if (reportType) query = query.eq("report_type", reportType);
  const { data, error } = await query;
  if (error && isGovernanceSchemaUnavailable(error)) return [];
  if (error) throw error;
  return (data ?? []) as ReportSnapshot[];
}

export function calculateDataQuality(snapshot: LcdboIntelligenceSnapshot): DataQualityResult {
  const operational = snapshot.interests.filter((item) => ["accepted", "onboarding", "needs_documents", "placed", "active"].includes(item.status));
  const assessmentMemberIds = new Set(snapshot.assessments.map((item) => item.cluster_member_id));
  const documentMemberIds = new Set(snapshot.documents.map((item) => item.cluster_member_id));
  const interestMsmeIds = new Set(snapshot.interests.map((item) => item.msme_id).filter(Boolean));
  const activeEnrolments = snapshot.enrolments.filter((item) => item.status === "active");
  const missingAssessments = operational.filter((item) => !assessmentMemberIds.has(item.id)).length;
  const missingOfficers = operational.filter((item) => !item.assigned_officer_id).length;
  const missingLocations = snapshot.enrolments.filter((item) => !item.msme?.state || !item.msme?.lga).length + snapshot.clusters.filter((item) => !item.stateName || item.stateName === "Unspecified").length;
  const missingClusterAssignments = activeEnrolments.filter((item) => !item.msme_id || !interestMsmeIds.has(item.msme_id)).length;
  const missingDocuments = operational.filter((item) => item.status === "needs_documents" && !documentMemberIds.has(item.id)).length;
  const duplicateNames = duplicateCount(snapshot.enrolments.map((item) => `${item.msme?.business_name?.trim().toLowerCase()}|${item.msme?.state?.trim().toLowerCase()}`));
  const duplicateMemberships = duplicateCount(snapshot.interests.map((item) => `${item.cluster_id}|${item.msme_id}`));
  const orphaned = snapshot.interests.filter((item) => !item.msme || !item.cluster).length;
  const activeMsmeIds = new Set(activeEnrolments.map((item) => item.msme_id).filter(Boolean));
  const inconsistentStatuses = operational.filter((item) => !item.msme_id || !activeMsmeIds.has(item.msme_id)).length + snapshot.documents.filter((item) => item.status === "accepted" && !item.submissions.some((submission) => submission.status === "accepted")).length;
  const completeness = Math.round((percent(operational.length - missingAssessments, operational.length) + percent(operational.length - missingOfficers, operational.length) + percent(activeEnrolments.length - missingClusterAssignments, activeEnrolments.length) + percent(Math.max(0, snapshot.enrolments.length - missingLocations), snapshot.enrolments.length)) / 4);
  const integrityIssues = duplicateNames + duplicateMemberships + orphaned + inconsistentStatuses;
  const consistency = Math.max(0, 100 - Math.round((integrityIssues / Math.max(snapshot.enrolments.length + snapshot.interests.length, 1)) * 100));
  const coverage = Math.round((percent(snapshot.enrolments.filter((item) => item.msme?.state).length, snapshot.enrolments.length) + percent(snapshot.enrolments.filter((item) => item.msme?.lga).length, snapshot.enrolments.length) + percent(operational.length - missingDocuments, operational.length)) / 3);
  const score = Math.round(completeness * 0.45 + consistency * 0.35 + coverage * 0.2);
  const issues: QualityIssue[] = [
    { code: "missing_assessments", label: "Missing readiness assessments", count: missingAssessments, severity: "high", detail: "Operational participants without a latest readiness assessment." },
    { code: "missing_officers", label: "Missing assigned officers", count: missingOfficers, severity: "high", detail: "Operational participants without a responsible officer." },
    { code: "missing_locations", label: "Missing locations", count: missingLocations, severity: "medium", detail: "MSME or cluster records without complete state/LGA coverage." },
    { code: "missing_cluster_assignments", label: "Missing cluster assignments", count: missingClusterAssignments, severity: "high", detail: "Active enrolments without a cluster participation record." },
    { code: "missing_documents", label: "Missing document requests", count: missingDocuments, severity: "medium", detail: "Participants marked as needing documents without a request." },
    { code: "duplicate_msmes", label: "Potential duplicate MSMEs", count: duplicateNames, severity: "medium", detail: "Normalised business name and state combinations appearing more than once." },
    { code: "duplicate_memberships", label: "Duplicate cluster memberships", count: duplicateMemberships, severity: "high", detail: "Repeated MSME and cluster combinations." },
    { code: "orphaned_records", label: "Orphaned records", count: orphaned, severity: "high", detail: "Participation records without an embedded MSME or cluster." },
    { code: "inconsistent_statuses", label: "Inconsistent statuses", count: inconsistentStatuses, severity: "high", detail: "Operational statuses that conflict with enrolment or document evidence." },
  ];
  return { score, completeness, consistency, coverage, issues };
}

export function calculateProgrammeHealth(snapshot: LcdboIntelligenceSnapshot): ProgrammeHealthResult {
  const operational = snapshot.interests.filter((item) => ["accepted", "onboarding", "needs_documents", "placed", "active"].includes(item.status));
  const assessmentMemberIds = new Set(snapshot.assessments.map((item) => item.cluster_member_id));
  const participation = percent(snapshot.metrics.activeParticipants, snapshot.metrics.totalMsmes);
  const readiness = percent(operational.filter((item) => assessmentMemberIds.has(item.id)).length, operational.length);
  const activity = snapshot.recentActivity.some((event) => daysSince(event.created_at) <= 30) ? 100 : snapshot.recentActivity.some((event) => daysSince(event.created_at) <= 90) ? 60 : 20;
  const documentCompletion = percent(snapshot.documents.filter((item) => ["accepted", "waived"].includes(item.status)).length, snapshot.documents.length);
  const score = Math.round(participation * 0.3 + readiness * 0.25 + activity * 0.2 + documentCompletion * 0.25);
  const today = new Date().toISOString().slice(0, 10);
  const alerts: QualityIssue[] = [
    { code: "overdue_reviews", label: "Overdue enrolment reviews", count: snapshot.enrolments.filter((item) => item.status === "pending_review" && daysSince(item.enrolled_at) > 14).length, severity: "high", detail: "Pending enrolments older than 14 days." },
    { code: "overdue_assessments", label: "Overdue assessments", count: operational.filter((item) => !assessmentMemberIds.has(item.id) && daysSince(item.joined_at) > 21).length, severity: "high", detail: "Operational participants without assessment after 21 days." },
    { code: "overdue_documents", label: "Overdue document requests", count: snapshot.documents.filter((item) => Boolean(item.due_date && item.due_date < today && ["requested", "submitted"].includes(item.status))).length, severity: "medium", detail: "Open requests beyond their due date." },
    { code: "inactive_clusters", label: "Inactive clusters", count: snapshot.clusters.filter((item) => item.status !== "active").length, severity: "medium", detail: "Configured clusters not currently active." },
    { code: "stalled_enrolments", label: "Stalled enrolments", count: snapshot.enrolments.filter((item) => item.status === "pending_review" && daysSince(item.enrolled_at) > 30).length, severity: "high", detail: "Pending enrolments older than 30 days." },
  ];
  return { score, participation, readiness, activity, documentCompletion, alerts };
}

function duplicateCount(values: string[]) { const map = new Map<string, number>(); values.filter((value) => value && !value.startsWith("undefined")).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1)); return [...map.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0); }
