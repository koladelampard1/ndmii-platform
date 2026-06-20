import type { SupabaseClient } from "@supabase/supabase-js";
import { recordPlatformEvent } from "@/lib/data/platform-foundation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getLcdboProgramme, listLcdboClusters, type LcdboMsmeSummary } from "@/lib/data/lcdbo-enrolment";
import type { ClusterMember, IndustrialCluster, Programme } from "@/types/platform";

type Client = SupabaseClient<any>;
export const PARTICIPATION_STATUSES = ["accepted", "onboarding", "needs_documents", "active", "placed", "inactive"] as const;
export type ParticipationStatus = typeof PARTICIPATION_STATUSES[number];
export const READINESS_LEVELS = ["early_stage", "developing", "ready_for_cluster", "ready_for_investment", "ready_for_export"] as const;
export type ReadinessLevel = typeof READINESS_LEVELS[number];
export const DOCUMENT_TYPES = ["business_registration", "product_photos", "equipment_evidence", "capacity_statement", "financial_summary", "compliance_document", "export_document", "other"] as const;
export type LcdboDocumentType = typeof DOCUMENT_TYPES[number];

export type LcdboOfficer = { id: string; full_name: string | null; email: string | null; role: string | null };
export type LcdboClusterParticipant = ClusterMember & {
  msme: LcdboMsmeSummary | null;
  cluster: IndustrialCluster | null;
  assignedOfficer: LcdboOfficer | null;
};
export type LcdboReadinessAssessment = {
  id: string; cluster_member_id: string; msme_id: string;
  production_capacity: number; equipment_readiness: number; workforce_readiness: number;
  finance_readiness: number; compliance_readiness: number; market_readiness: number;
  export_readiness: number; digital_readiness: number; overall_score: number;
  readiness_level: ReadinessLevel; assessor_id: string; assessment_notes: string | null;
  recommended_support: string[]; metadata: Record<string, unknown>; created_at: string; updated_at: string;
};
export type LcdboDocumentSubmission = {
  id: string; request_id: string; msme_id: string; submitted_by: string; file_url: string | null;
  notes: string | null; submitted_at: string; reviewed_by: string | null; reviewed_at: string | null;
  review_notes: string | null; status: "submitted" | "accepted" | "rejected"; created_at: string; updated_at: string;
};
export type LcdboDocumentRequest = {
  id: string; cluster_member_id: string; requested_by: string; document_type: LcdboDocumentType;
  title: string; description: string | null; due_date: string | null;
  status: "requested" | "submitted" | "accepted" | "rejected" | "waived" | "expired";
  created_at: string; updated_at: string; submissions?: LcdboDocumentSubmission[];
};

export type LcdboDocumentSubmissionReviewTarget = {
  submissionId: string;
  submissionStatus: LcdboDocumentSubmission["status"];
  requestId: string;
  requestStatus: LcdboDocumentRequest["status"];
  clusterMemberId: string;
};

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
async function clientOrService(client?: Client) { return client ?? await createServiceRoleSupabaseClient(); }

export async function getLcdboClusterParticipants(client?: Client): Promise<LcdboClusterParticipant[]> {
  const supabase = await clientOrService(client);
  const clusters = await listLcdboClusters(supabase);
  if (!clusters.length) return [];
  const { data, error } = await supabase
    .from("cluster_members")
    .select("*,msmes(id,msme_id,business_name,owner_name,sector,state,lga,contact_email,contact_phone),industrial_clusters(*),assigned_officer:users!cluster_members_assigned_officer_id_fkey(id,full_name,email,role)")
    .in("cluster_id", clusters.map((cluster) => cluster.id))
    .eq("member_type", "msme")
    .in("status", [...PARTICIPATION_STATUSES])
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, msme: one(row.msmes), cluster: one(row.industrial_clusters), assignedOfficer: one(row.assigned_officer) })) as LcdboClusterParticipant[];
}

export async function getAssignedClusterMembers(officerUserId: string, client?: Client) {
  return (await getLcdboClusterParticipants(client)).filter((member) => member.assigned_officer_id === officerUserId);
}

export async function getLcdboOfficers(client?: Client): Promise<LcdboOfficer[]> {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase);
  const [{ data, error }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabase.from("users").select("id,full_name,email,role").in("role", ["programme_officer", "field_officer", "assessment_officer", "admin", "super_admin"]).order("full_name"),
    programme
      ? supabase.from("role_assignments").select("user_id,users(id,full_name,email,role)").eq("scope_type", "programme").eq("scope_id", programme.id).eq("status", "active").in("role", ["programme_officer", "field_officer", "assessment_officer"])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (error) throw error;
  if (assignmentError) throw assignmentError;
  const rows = new Map<string, LcdboOfficer>((data ?? []).map((officer) => [officer.id, officer as LcdboOfficer]));
  for (const assignment of assignments ?? []) {
    const user = one(assignment.users) as LcdboOfficer | null;
    if (user?.id) rows.set(user.id, user);
  }
  return [...rows.values()].sort((a, b) => String(a.full_name ?? a.email).localeCompare(String(b.full_name ?? b.email)));
}

export async function updateClusterParticipationStatus(input: { clusterMemberId: string; status: ParticipationStatus; actorUserId: string; note?: string | null; client?: Client }) {
  const supabase = await clientOrService(input.client);
  if (!(PARTICIPATION_STATUSES as readonly string[]).includes(input.status)) throw new Error("Unsupported participation status.");
  const { data, error } = await supabase.from("cluster_members").update({ status: input.status, review_note: input.note?.trim() || null, exited_at: input.status === "inactive" ? new Date().toISOString() : null }).eq("id", input.clusterMemberId).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to update participation status.");
  await recordPlatformEvent({ actorUserId: input.actorUserId, eventType: "lcdbo.cluster_member.status_updated", entityType: "cluster_member", entityId: data.id, scopeType: "cluster", scopeId: data.cluster_id, metadata: { msme_id: data.msme_id, status: input.status, note: input.note?.trim() || null }, client: supabase });
  return data as ClusterMember;
}

export async function assignClusterOfficer(input: { clusterMemberId: string; officerUserId?: string | null; actorUserId: string; notes?: string | null; client?: Client }) {
  const supabase = await clientOrService(input.client);
  const { data: current, error: lookupError } = await supabase.from("cluster_members").select("id,cluster_id,msme_id,assigned_officer_id").eq("id", input.clusterMemberId).maybeSingle();
  if (lookupError || !current) throw lookupError ?? new Error("Cluster member not found.");
  const officerId = input.officerUserId?.trim() || null;
  if (officerId && !(await getLcdboOfficers(supabase)).some((officer) => officer.id === officerId)) throw new Error("Select an eligible LCDBO officer.");
  const { data, error } = await supabase.from("cluster_members").update({ assigned_officer_id: officerId, assigned_by: input.actorUserId, assigned_at: officerId ? new Date().toISOString() : null, assignment_notes: input.notes?.trim() || null }).eq("id", current.id).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to assign officer.");
  const eventType = current.assigned_officer_id && officerId ? "lcdbo.cluster_member.reassigned" : "lcdbo.cluster_member.assigned";
  await recordPlatformEvent({ actorUserId: input.actorUserId, eventType, entityType: "cluster_member", entityId: data.id, scopeType: "cluster", scopeId: data.cluster_id, metadata: { msme_id: data.msme_id, previous_officer_id: current.assigned_officer_id, assigned_officer_id: officerId, cleared: !officerId }, client: supabase });
  return data as ClusterMember;
}

function readinessForScore(score: number): ReadinessLevel {
  if (score >= 4.6) return "ready_for_export";
  if (score >= 4) return "ready_for_investment";
  if (score >= 3.2) return "ready_for_cluster";
  if (score >= 2.2) return "developing";
  return "early_stage";
}

export async function createClusterReadinessAssessment(input: {
  clusterMemberId: string; msmeId: string; assessorId: string;
  scores: Record<"production_capacity" | "equipment_readiness" | "workforce_readiness" | "finance_readiness" | "compliance_readiness" | "market_readiness" | "export_readiness" | "digital_readiness", number>;
  assessmentNotes?: string | null; recommendedSupport: string[]; client?: Client;
}) {
  const supabase = await clientOrService(input.client);
  const values = Object.values(input.scores);
  if (values.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) throw new Error("Readiness scores must be between 1 and 5.");
  const overallScore = Number((values.reduce((sum, score) => sum + score, 0) / values.length).toFixed(2));
  const { data, error } = await supabase.from("lcdbo_cluster_assessments").insert({ cluster_member_id: input.clusterMemberId, msme_id: input.msmeId, ...input.scores, overall_score: overallScore, readiness_level: readinessForScore(overallScore), assessor_id: input.assessorId, assessment_notes: input.assessmentNotes?.trim() || null, recommended_support: input.recommendedSupport, metadata: { source: "lcdbo_cluster_operations_phase4" } }).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to save readiness assessment.");
  const { data: member } = await supabase.from("cluster_members").select("cluster_id").eq("id", input.clusterMemberId).maybeSingle();
  await recordPlatformEvent({ actorUserId: input.assessorId, eventType: "lcdbo.readiness_assessment.created", entityType: "lcdbo_cluster_assessment", entityId: data.id, scopeType: "cluster", scopeId: member?.cluster_id ?? null, metadata: { cluster_member_id: input.clusterMemberId, msme_id: input.msmeId, overall_score: overallScore, readiness_level: data.readiness_level }, client: supabase });
  return data as LcdboReadinessAssessment;
}

export async function getClusterReadinessAssessment(clusterMemberId: string, client?: Client): Promise<LcdboReadinessAssessment | null> {
  const supabase = await clientOrService(client);
  const { data, error } = await supabase.from("lcdbo_cluster_assessments").select("*").eq("cluster_member_id", clusterMemberId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as LcdboReadinessAssessment | null;
}

export async function getLatestAssessmentsForMembers(memberIds: string[], client?: Client) {
  const supabase = await clientOrService(client);
  if (!memberIds.length) return new Map<string, LcdboReadinessAssessment>();
  const { data, error } = await supabase.from("lcdbo_cluster_assessments").select("*").in("cluster_member_id", memberIds).order("created_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, LcdboReadinessAssessment>();
  for (const row of (data ?? []) as LcdboReadinessAssessment[]) if (!map.has(row.cluster_member_id)) map.set(row.cluster_member_id, row);
  return map;
}

export async function createDocumentRequest(input: { clusterMemberId: string; requestedBy: string; documentType: LcdboDocumentType; title: string; description?: string | null; dueDate?: string | null; client?: Client }) {
  const supabase = await clientOrService(input.client);
  if (!(DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) throw new Error("Unsupported document type.");
  const { data, error } = await supabase.from("lcdbo_document_requests").insert({ cluster_member_id: input.clusterMemberId, requested_by: input.requestedBy, document_type: input.documentType, title: input.title.trim(), description: input.description?.trim() || null, due_date: input.dueDate || null, status: "requested", metadata: { source: "lcdbo_cluster_operations_phase4" } }).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to create document request.");
  const { data: member } = await supabase.from("cluster_members").select("cluster_id,msme_id,status").eq("id", input.clusterMemberId).maybeSingle();
  if (member && ["accepted", "onboarding"].includes(member.status)) {
    await updateClusterParticipationStatus({ clusterMemberId: input.clusterMemberId, status: "needs_documents", actorUserId: input.requestedBy, note: "Participation evidence requested.", client: supabase });
  }
  await recordPlatformEvent({ actorUserId: input.requestedBy, eventType: "lcdbo.document_request.created", entityType: "lcdbo_document_request", entityId: data.id, scopeType: "cluster", scopeId: member?.cluster_id ?? null, metadata: { cluster_member_id: input.clusterMemberId, msme_id: member?.msme_id, document_type: input.documentType }, client: supabase });
  return data as LcdboDocumentRequest;
}

export async function getDocumentRequestsForMsme(msmeId: string, client?: Client): Promise<LcdboDocumentRequest[]> {
  const supabase = await clientOrService(client);
  const { data: memberships, error: memberError } = await supabase.from("cluster_members").select("id").eq("msme_id", msmeId);
  if (memberError) throw memberError;
  const ids = (memberships ?? []).map((row) => row.id);
  if (!ids.length) return [];
  const { data, error } = await supabase.from("lcdbo_document_requests").select("*,lcdbo_document_submissions(*)").in("cluster_member_id", ids).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, submissions: [...(row.lcdbo_document_submissions ?? [])].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at))) })) as LcdboDocumentRequest[];
}

export async function getDocumentRequestsForMembers(memberIds: string[], client?: Client): Promise<LcdboDocumentRequest[]> {
  const supabase = await clientOrService(client);
  if (!memberIds.length) return [];
  const { data, error } = await supabase.from("lcdbo_document_requests").select("*,lcdbo_document_submissions(*)").in("cluster_member_id", memberIds).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, submissions: [...(row.lcdbo_document_submissions ?? [])].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at))) })) as LcdboDocumentRequest[];
}

export async function submitDocumentRequest(input: { requestId: string; msmeId: string; submittedBy: string; fileUrl?: string | null; notes?: string | null; client?: Client }) {
  const supabase = await clientOrService(input.client);
  if (!input.fileUrl?.trim() && !input.notes?.trim()) throw new Error("Provide a document link or response note.");
  if (input.fileUrl?.trim()) {
    const url = new URL(input.fileUrl.trim());
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Document links must use HTTP or HTTPS.");
  }

  const { data: request, error: requestError } = await supabase
    .from("lcdbo_document_requests")
    .select("id,status,cluster_member_id,cluster_members!inner(msme_id,cluster_id)")
    .eq("id", input.requestId)
    .maybeSingle();
  if (requestError || !request) throw requestError ?? new Error("Document request not found.");
  const member = one(request.cluster_members) as { msme_id: string; cluster_id: string } | null;
  if (!member || member.msme_id !== input.msmeId) throw new Error("Unauthorized document request submission.");
  if (!["requested", "rejected"].includes(request.status)) {
    throw new Error("This document request is not open for submission.");
  }

  const { data, error } = await supabase.from("lcdbo_document_submissions").insert({ request_id: input.requestId, msme_id: input.msmeId, submitted_by: input.submittedBy, file_url: input.fileUrl?.trim() || null, notes: input.notes?.trim() || null, status: "submitted", metadata: { submission_mode: "metadata_first" } }).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to submit document response.");

  const { data: transitionedRequest, error: transitionError } = await supabase
    .from("lcdbo_document_requests")
    .update({ status: "submitted" })
    .eq("id", input.requestId)
    .in("status", ["requested", "rejected"])
    .select("id")
    .maybeSingle();
  if (transitionError || !transitionedRequest) {
    await supabase.from("lcdbo_document_submissions").delete().eq("id", data.id);
    throw transitionError ?? new Error("This document request is no longer open for submission.");
  }

  await recordPlatformEvent({ actorUserId: input.submittedBy, eventType: "lcdbo.document_submission.created", entityType: "lcdbo_document_submission", entityId: data.id, scopeType: "cluster", scopeId: member.cluster_id, metadata: { request_id: input.requestId, msme_id: input.msmeId }, client: supabase });
  return data as LcdboDocumentSubmission;
}

export async function getDocumentSubmissionReviewTarget(submissionId: string, client?: Client): Promise<LcdboDocumentSubmissionReviewTarget> {
  const supabase = await clientOrService(client);
  const { data, error } = await supabase
    .from("lcdbo_document_submissions")
    .select("id,status,request_id,lcdbo_document_requests!inner(id,status,cluster_member_id)")
    .eq("id", submissionId)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Document submission not found.");
  const request = one(data.lcdbo_document_requests) as Pick<LcdboDocumentRequest, "id" | "status" | "cluster_member_id"> | null;
  if (!request) throw new Error("Document submission request could not be resolved.");
  return {
    submissionId: data.id,
    submissionStatus: data.status as LcdboDocumentSubmission["status"],
    requestId: request.id,
    requestStatus: request.status,
    clusterMemberId: request.cluster_member_id,
  };
}

export async function reviewDocumentSubmission(input: { submissionId: string; authorizedClusterMemberId: string; status: "accepted" | "rejected"; reviewedBy: string; reviewNotes?: string | null; client?: Client }) {
  const supabase = await clientOrService(input.client);
  const target = await getDocumentSubmissionReviewTarget(input.submissionId, supabase);
  if (target.clusterMemberId !== input.authorizedClusterMemberId) {
    throw new Error("Unauthorized document submission review target.");
  }
  if (target.submissionStatus !== "submitted" || target.requestStatus !== "submitted") {
    throw new Error("Only submitted document responses can be reviewed.");
  }

  const { data, error } = await supabase
    .from("lcdbo_document_submissions")
    .update({ status: input.status, reviewed_by: input.reviewedBy, reviewed_at: new Date().toISOString(), review_notes: input.reviewNotes?.trim() || null })
    .eq("id", input.submissionId)
    .eq("request_id", target.requestId)
    .eq("status", "submitted")
    .select("*")
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Unable to review document submission.");

  const { data: transitionedRequest, error: requestError } = await supabase
    .from("lcdbo_document_requests")
    .update({ status: input.status })
    .eq("id", target.requestId)
    .eq("cluster_member_id", input.authorizedClusterMemberId)
    .eq("status", "submitted")
    .select("cluster_member_id")
    .maybeSingle();
  if (requestError || !transitionedRequest) {
    await supabase.from("lcdbo_document_submissions").update({ status: "submitted", reviewed_by: null, reviewed_at: null, review_notes: null }).eq("id", data.id).eq("reviewed_by", input.reviewedBy);
    throw requestError ?? new Error("Document request review transition is no longer valid.");
  }

  const { data: member } = await supabase.from("cluster_members").select("cluster_id").eq("id", transitionedRequest.cluster_member_id).maybeSingle();
  await recordPlatformEvent({ actorUserId: input.reviewedBy, eventType: `lcdbo.document_submission.${input.status}`, entityType: "lcdbo_document_submission", entityId: data.id, scopeType: "cluster", scopeId: member?.cluster_id ?? null, metadata: { request_id: data.request_id, msme_id: data.msme_id, review_notes: input.reviewNotes?.trim() || null }, client: supabase });
  return data as LcdboDocumentSubmission;
}

export async function getLcdboOperationsMetrics(client?: Client) {
  const supabase = await clientOrService(client);
  const participants = await getLcdboClusterParticipants(supabase);
  const assessments = await getLatestAssessmentsForMembers(participants.map((item) => item.id), supabase);
  const documents = await getDocumentRequestsForMembers(participants.map((item) => item.id), supabase);
  const workload = new Map<string, { officer: LcdboOfficer; count: number }>();
  participants.forEach((item) => { if (item.assignedOfficer) workload.set(item.assignedOfficer.id, { officer: item.assignedOfficer, count: (workload.get(item.assignedOfficer.id)?.count ?? 0) + 1 }); });
  const readiness = new Map<ReadinessLevel, number>();
  assessments.forEach((item) => readiness.set(item.readiness_level, (readiness.get(item.readiness_level) ?? 0) + 1));
  return { participants, assessments, documents, workload: [...workload.values()].sort((a, b) => b.count - a.count), readiness: [...readiness.entries()], active: participants.filter((item) => item.status === "active").length, onboarding: participants.filter((item) => item.status === "onboarding").length, needsDocuments: participants.filter((item) => item.status === "needs_documents").length, placed: participants.filter((item) => item.status === "placed").length };
}

function csvValue(value: unknown) {
  const raw = String(value ?? "");
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}
function csv(rows: unknown[][]) { return rows.map((row) => row.map(csvValue).join(",")).join("\r\n"); }
export type LcdboExportDataset = "enrolments" | "cluster-interests" | "cluster-members" | "readiness" | "documents";

export async function exportLcdboOperationalData(dataset: LcdboExportDataset, actorUserId: string, client?: Client) {
  const supabase = await clientOrService(client);
  const programme = await getLcdboProgramme(supabase) as Programme | null;
  if (!programme) throw new Error("LCDBO programme is not configured.");
  let rows: unknown[][] = [];
  if (dataset === "enrolments") {
    const { data, error } = await supabase.from("programme_enrolments").select("status,enrolled_at,reviewed_at,msmes(msme_id,business_name,sector,state,lga)").eq("programme_id", programme.id).eq("enrolment_type", "msme"); if (error) throw error;
    rows = [["MSME ID", "Business", "Sector", "State", "LGA", "Status", "Enrolled at", "Reviewed at"], ...(data ?? []).map((row: any) => [one(row.msmes)?.msme_id, one(row.msmes)?.business_name, one(row.msmes)?.sector, one(row.msmes)?.state, one(row.msmes)?.lga, row.status, row.enrolled_at, row.reviewed_at])];
  } else if (dataset === "cluster-interests" || dataset === "cluster-members") {
    const clusters = await listLcdboClusters(supabase); const { data, error } = await supabase.from("cluster_members").select("status,joined_at,assigned_at,msmes(msme_id,business_name,sector,state),industrial_clusters(name),assigned_officer:users!cluster_members_assigned_officer_id_fkey(full_name,email)").in("cluster_id", clusters.map((item) => item.id)); if (error) throw error;
    const filtered = dataset === "cluster-interests" ? (data ?? []).filter((row) => ["interested", "under_review", "accepted", "rejected", "waitlisted", "withdrawn"].includes(row.status)) : (data ?? []).filter((row) => (PARTICIPATION_STATUSES as readonly string[]).includes(row.status));
    rows = [["MSME ID", "Business", "Sector", "State", "Cluster", "Status", "Officer", "Joined at", "Assigned at"], ...filtered.map((row: any) => [one(row.msmes)?.msme_id, one(row.msmes)?.business_name, one(row.msmes)?.sector, one(row.msmes)?.state, one(row.industrial_clusters)?.name, row.status, one(row.assigned_officer)?.full_name ?? one(row.assigned_officer)?.email, row.joined_at, row.assigned_at])];
  } else if (dataset === "readiness") {
    const participants = await getLcdboClusterParticipants(supabase); const { data, error } = await supabase.from("lcdbo_cluster_assessments").select("*,msmes(msme_id,business_name)").in("cluster_member_id", participants.map((item) => item.id)); if (error) throw error;
    rows = [["MSME ID", "Business", "Overall score", "Readiness level", "Production", "Equipment", "Workforce", "Finance", "Compliance", "Market", "Export", "Digital", "Assessed at"], ...(data ?? []).map((row: any) => [one(row.msmes)?.msme_id, one(row.msmes)?.business_name, row.overall_score, row.readiness_level, row.production_capacity, row.equipment_readiness, row.workforce_readiness, row.finance_readiness, row.compliance_readiness, row.market_readiness, row.export_readiness, row.digital_readiness, row.created_at])];
  } else {
    const participants = await getLcdboClusterParticipants(supabase); const requests = await getDocumentRequestsForMembers(participants.map((item) => item.id), supabase); const byId = new Map(participants.map((item) => [item.id, item]));
    rows = [["MSME ID", "Business", "Cluster", "Document type", "Title", "Status", "Due date", "Requested at", "Latest submission"], ...requests.map((request) => { const member = byId.get(request.cluster_member_id); return [member?.msme?.msme_id, member?.msme?.business_name, member?.cluster?.name, request.document_type, request.title, request.status, request.due_date, request.created_at, request.submissions?.[0]?.submitted_at]; })];
  }
  await recordPlatformEvent({ actorUserId, eventType: "lcdbo.export.generated", entityType: "lcdbo_export", scopeType: "programme", scopeId: programme.id, metadata: { dataset, row_count: Math.max(0, rows.length - 1) }, client: supabase });
  return { csv: csv(rows), filename: `lcdbo-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`, rowCount: Math.max(0, rows.length - 1) };
}
