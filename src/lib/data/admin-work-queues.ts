import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeComplaintStatus } from "@/lib/data/complaints";

type SupabaseErrorInfo = {
  code?: string;
  message?: string;
};

export type QueueSourceState<T> = {
  records: T[];
  count: number;
  oldestAt: string | null;
  unavailable: boolean;
};

export type PendingDigitalIdApproval = {
  id: string;
  businessName: string;
  msmeId: string;
  submittedAt: string | null;
  credentialStatus: string;
};

export type PendingComplianceReview = {
  id: string;
  businessName: string;
  requirement: string;
  regulator: string;
  submittedAt: string | null;
  evidenceCount: number;
  status: string;
};

export type OpenComplaintQueueItem = {
  id: string;
  complaintReference: string;
  businessName: string;
  severity: string;
  status: string;
  submittedAt: string | null;
};

export type FlaggedMsmeQueueItem = {
  id: string;
  businessName: string;
  msmeId: string;
  reason: string;
  status: string;
  createdAt: string | null;
};

export type SuspendedCredentialQueueItem = {
  id: string;
  businessName: string;
  msmeId: string;
  suspendedAt: string | null;
  reason: string;
  status: string;
};

export type AdminWorkQueues = {
  pendingDigitalIdApprovals: QueueSourceState<PendingDigitalIdApproval>;
  pendingComplianceReviews: QueueSourceState<PendingComplianceReview>;
  openComplaints: QueueSourceState<OpenComplaintQueueItem>;
  flaggedMsmes: QueueSourceState<FlaggedMsmeQueueItem>;
  suspendedCredentials: QueueSourceState<SuspendedCredentialQueueItem>;
};

const CLOSED_COMPLAINT_STATUSES = new Set(["resolved", "closed", "dismissed"]);
const PENDING_COMPLIANCE_STATUSES = ["submitted", "resubmitted", "under_review"];

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function logQueueDiagnostic(params: {
  operation: string;
  queueName: keyof AdminWorkQueues;
  rowCount: number;
  error?: SupabaseErrorInfo | null;
}) {
  console.info("[admin-work-queue]", {
    operation: params.operation,
    queueName: params.queueName,
    rowCount: params.rowCount,
    supabaseErrorCode: params.error?.code ?? null,
    supabaseErrorMessage: params.error?.message ?? null,
  });
}

function unavailableQueue<T>(queueName: keyof AdminWorkQueues, error: SupabaseErrorInfo | null): QueueSourceState<T> {
  logQueueDiagnostic({ operation: "queue_load", queueName, rowCount: 0, error });
  return { records: [], count: 0, oldestAt: null, unavailable: true };
}

function msmeRelationName(msme: { business_name?: string | null } | { business_name?: string | null }[] | null | undefined) {
  return relationOne(msme)?.business_name ?? "Unknown business";
}

function msmeRelationId(msme: { msme_id?: string | null } | { msme_id?: string | null }[] | null | undefined, fallback?: string | null) {
  return relationOne(msme)?.msme_id ?? fallback ?? "Unassigned MSME ID";
}

async function loadPendingDigitalIdApprovals(supabase: SupabaseClient<any>): Promise<AdminWorkQueues["pendingDigitalIdApprovals"]> {
  const queueName = "pendingDigitalIdApprovals";
  const { data, error, count } = await supabase
    .from("digital_identity_credentials")
    .select("id,msme_id,ndmii_id,status,created_at,issued_at,msmes(msme_id,business_name)", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) return unavailableQueue(queueName, error);

  const records = (data ?? []).map((row: any): PendingDigitalIdApproval => ({
    id: row.id,
    businessName: msmeRelationName(row.msmes),
    msmeId: msmeRelationId(row.msmes, row.ndmii_id ?? row.msme_id),
    submittedAt: row.created_at ?? row.issued_at ?? null,
    credentialStatus: row.status ?? "pending",
  }));

  logQueueDiagnostic({ operation: "queue_load", queueName, rowCount: count ?? records.length });
  return { records, count: count ?? records.length, oldestAt: records[0]?.submittedAt ?? null, unavailable: false };
}

async function loadPendingComplianceReviews(supabase: SupabaseClient<any>): Promise<AdminWorkQueues["pendingComplianceReviews"]> {
  const queueName = "pendingComplianceReviews";
  const { data, error, count } = await supabase
    .from("msme_compliance_items")
    .select("id,status,submitted_at,updated_at,msmes(msme_id,business_name),compliance_regulators(code,name),compliance_requirement_definitions(code,title)", { count: "exact" })
    .in("status", PENDING_COMPLIANCE_STATUSES)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(5);

  if (error) return unavailableQueue(queueName, error);

  const rows = data ?? [];
  const itemIds = rows.map((row: any) => row.id).filter(Boolean);
  const evidenceCounts = new Map<string, number>();

  if (itemIds.length) {
    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("compliance_documents")
      .select("id,compliance_item_id")
      .in("compliance_item_id", itemIds)
      .eq("is_deleted", false);

    if (evidenceError) {
      logQueueDiagnostic({ operation: "queue_evidence_load", queueName, rowCount: 0, error: evidenceError });
    } else {
      for (const evidence of evidenceRows ?? []) {
        evidenceCounts.set(evidence.compliance_item_id, (evidenceCounts.get(evidence.compliance_item_id) ?? 0) + 1);
      }
      logQueueDiagnostic({ operation: "queue_evidence_load", queueName, rowCount: evidenceRows?.length ?? 0 });
    }
  }

  const records = rows.map((row: any): PendingComplianceReview => {
    const regulator = relationOne(row.compliance_regulators);
    const requirement = relationOne(row.compliance_requirement_definitions);

    return {
      id: row.id,
      businessName: msmeRelationName(row.msmes),
      requirement: requirement?.title ?? requirement?.code ?? "Compliance requirement",
      regulator: regulator?.code ?? regulator?.name ?? "Regulator",
      submittedAt: row.submitted_at ?? row.updated_at ?? null,
      evidenceCount: evidenceCounts.get(row.id) ?? 0,
      status: row.status ?? "submitted",
    };
  });

  logQueueDiagnostic({ operation: "queue_load", queueName, rowCount: count ?? records.length });
  return { records, count: count ?? records.length, oldestAt: records[0]?.submittedAt ?? null, unavailable: false };
}

async function loadOpenComplaints(supabase: SupabaseClient<any>): Promise<AdminWorkQueues["openComplaints"]> {
  const queueName = "openComplaints";
  const { data, error, count } = await supabase
    .from("complaints")
    .select("id,complaint_reference,status,severity,priority,created_at,provider_business_name,msmes(business_name)", { count: "exact" })
    .not("status", "in", "(resolved,closed,dismissed)")
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) return unavailableQueue(queueName, error);

  const openRows = (data ?? []).filter((row: any) => !CLOSED_COMPLAINT_STATUSES.has(normalizeComplaintStatus(row.status)));
  const records = openRows.map((row: any): OpenComplaintQueueItem => ({
    id: row.id,
    complaintReference: row.complaint_reference ?? `CMP-${String(row.id).slice(0, 8).toUpperCase()}`,
    businessName: msmeRelationName(row.msmes) !== "Unknown business" ? msmeRelationName(row.msmes) : row.provider_business_name ?? "Unknown business",
    severity: row.severity ?? row.priority ?? "medium",
    status: normalizeComplaintStatus(row.status),
    submittedAt: row.created_at ?? null,
  }));

  logQueueDiagnostic({ operation: "queue_load", queueName, rowCount: count ?? records.length });
  return { records, count: count ?? records.length, oldestAt: records[0]?.submittedAt ?? null, unavailable: false };
}

async function loadFlaggedMsmes(supabase: SupabaseClient<any>): Promise<AdminWorkQueues["flaggedMsmes"]> {
  const queueName = "flaggedMsmes";
  const { data, error, count } = await supabase
    .from("msmes")
    .select("id,msme_id,business_name,verification_status,review_status,enforcement_note,created_at", { count: "exact" })
    .eq("flagged", true)
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) return unavailableQueue(queueName, error);

  const records = (data ?? []).map((row: any): FlaggedMsmeQueueItem => ({
    id: row.id,
    businessName: row.business_name ?? "Unknown business",
    msmeId: row.msme_id ?? "Unassigned MSME ID",
    reason: row.enforcement_note ?? "Flagged record",
    status: row.review_status ?? row.verification_status ?? "flagged",
    createdAt: row.created_at ?? null,
  }));

  logQueueDiagnostic({ operation: "queue_load", queueName, rowCount: count ?? records.length });
  return { records, count: count ?? records.length, oldestAt: records[0]?.createdAt ?? null, unavailable: false };
}

async function loadSuspendedCredentials(supabase: SupabaseClient<any>): Promise<AdminWorkQueues["suspendedCredentials"]> {
  const queueName = "suspendedCredentials";
  const { data, error, count } = await supabase
    .from("digital_identity_credentials")
    .select("id,msme_id,ndmii_id,status,suspended_at,revocation_reason,created_at,msmes(msme_id,business_name)", { count: "exact" })
    .or("status.eq.suspended,suspended_at.not.is.null")
    .order("suspended_at", { ascending: true, nullsFirst: false })
    .limit(5);

  if (error) return unavailableQueue(queueName, error);

  const records = (data ?? []).map((row: any): SuspendedCredentialQueueItem => ({
    id: row.id,
    businessName: msmeRelationName(row.msmes),
    msmeId: msmeRelationId(row.msmes, row.ndmii_id ?? row.msme_id),
    suspendedAt: row.suspended_at ?? row.created_at ?? null,
    reason: row.revocation_reason ?? "Suspension reason not recorded",
    status: row.status ?? "suspended",
  }));

  logQueueDiagnostic({ operation: "queue_load", queueName, rowCount: count ?? records.length });
  return { records, count: count ?? records.length, oldestAt: records[0]?.suspendedAt ?? null, unavailable: false };
}

export async function loadAdminWorkQueues(supabase: SupabaseClient<any>): Promise<AdminWorkQueues> {
  const [
    pendingDigitalIdApprovals,
    pendingComplianceReviews,
    openComplaints,
    flaggedMsmes,
    suspendedCredentials,
  ] = await Promise.all([
    loadPendingDigitalIdApprovals(supabase),
    loadPendingComplianceReviews(supabase),
    loadOpenComplaints(supabase),
    loadFlaggedMsmes(supabase),
    loadSuspendedCredentials(supabase),
  ]);

  return {
    pendingDigitalIdApprovals,
    pendingComplianceReviews,
    openComplaints,
    flaggedMsmes,
    suspendedCredentials,
  };
}
