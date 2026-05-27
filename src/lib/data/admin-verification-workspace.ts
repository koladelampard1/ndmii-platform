import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildVerificationIntelligence,
  type VerificationIntelligence,
} from "@/lib/data/admin-verification-intelligence";

export type VerificationReviewStatus = "pending_review" | "under_review" | "awaiting_documents" | "escalated" | "verified" | "rejected";

export type VerificationWorkspaceSourceName =
  | "msmes"
  | "validation_results"
  | "compliance_profiles"
  | "digital_identity_credentials"
  | "credential_events"
  | "msme_compliance_profiles"
  | "msme_compliance_items"
  | "compliance_events"
  | "compliance_documents"
  | "complaints"
  | "complaint_status_history"
  | "verification_reviews"
  | "verification_review_events"
  | "verification_review_comments"
  | "users";

export type VerificationSourceState = {
  available: boolean;
  message?: string | null;
};

export type VerificationTimelineItem = {
  id: string;
  eventType: string;
  actorRole: string | null;
  date: string | null;
  summary: string;
  source: VerificationWorkspaceSourceName;
};

export type VerificationDocument = {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  previewHref: string;
  downloadHref: string;
};

export type VerificationReview = {
  id: string | null;
  status: VerificationReviewStatus;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  escalationReason: string | null;
  rejectionReason: string | null;
  requestedDocuments: string[];
  internalNotes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  events: VerificationTimelineItem[];
  comments: Array<{ id: string; visibility: string; comment: string; actorRole: string | null; createdAt: string | null }>;
};

export type AdminVerificationWorkspace = {
  msme: {
    id: string;
    businessName: string;
    msmeId: string;
    ownerName: string;
    state: string | null;
    lga: string | null;
    sector: string | null;
    onboardingStatus: string;
    verificationStatus: string;
    reviewStatus: string;
    createdAt: string | null;
    flagged: boolean;
    suspended: boolean;
    attentionLevel: "normal" | "watch" | "elevated" | "critical";
    cacMasked: string | null;
    tinMasked: string | null;
    phoneMasked: string | null;
    emailMasked: string | null;
  };
  kyc: {
    ninStatus: string | null;
    bvnStatus: string | null;
    cacStatus: string | null;
    tinStatus: string | null;
    addressStatus: string | null;
    contactStatus: string | null;
    overallStatus: string;
  };
  credential: {
    status: string | null;
    ndmiiId: string | null;
    issuedAt: string | null;
    lastEvent: VerificationTimelineItem | null;
  };
  compliance: {
    posture: string | null;
    riskLevel: string | null;
    score: number | null;
    failedCount: number | null;
    pendingCount: number | null;
    reviewStatus: string | null;
    missingRequiredItems: string[];
    latestEvents: VerificationTimelineItem[];
  };
  complaints: {
    openCount: number | null;
    highestSeverity: string | null;
    unresolvedDisputes: number | null;
    timeline: VerificationTimelineItem[];
  };
  duplicateSignals: Array<{ id: string; businessName: string; msmeId: string; signals: string[]; confidence: "high" | "medium" | "low" }>;
  intelligence: VerificationIntelligence;
  documents: VerificationDocument[];
  review: VerificationReview;
  reviewers: Array<{ id: string; label: string }>;
  sources: Record<VerificationWorkspaceSourceName, VerificationSourceState>;
};

type TableReadResult<T> = {
  rows: T[];
  source: VerificationSourceState;
};

type MsmeRow = {
  id: string;
  msme_id?: string | null;
  business_name?: string | null;
  owner_name?: string | null;
  state?: string | null;
  lga?: string | null;
  sector?: string | null;
  business_type?: string | null;
  address?: string | null;
  verification_status?: string | null;
  review_status?: string | null;
  cac_number?: string | null;
  tin?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  flagged?: boolean | null;
  suspended?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const READ_LIMIT = 5000;
const CLOSED_COMPLAINT_STATUSES = new Set(["resolved", "closed", "dismissed"]);
const HEALTHY_STATUSES = new Set(["verified", "passed", "matched", "complete", "approved", "valid"]);
const FAILED_STATUSES = new Set(["failed", "rejected", "mismatch", "invalid", "error"]);
const PENDING_STATUSES = new Set(["pending", "incomplete", "not_started", "unverified", "unknown", ""]);
const CANONICAL_REVIEW_STATUSES = ["pending_review", "under_review", "awaiting_documents", "escalated", "verified", "rejected"] as const;

const TABLE_COLUMNS: Record<VerificationWorkspaceSourceName, string[]> = {
  msmes: ["id", "msme_id", "business_name", "owner_name", "state", "lga", "sector", "business_type", "address", "verification_status", "review_status", "cac_number", "tin", "contact_phone", "contact_email", "flagged", "suspended", "created_at", "updated_at"],
  validation_results: ["msme_id", "nin_status", "bvn_status", "cac_status", "tin_status", "confidence_score", "validation_summary", "validated_at", "updated_at"],
  compliance_profiles: ["msme_id", "overall_status", "score", "risk_level", "nin_status", "bvn_status", "cac_status", "tin_status", "last_reviewed_at"],
  digital_identity_credentials: ["id", "msme_id", "ndmii_id", "status", "issued_at", "approved_at", "revoked_at", "suspended_at", "created_at", "updated_at"],
  credential_events: ["id", "credential_id", "action", "actor_role", "metadata", "created_at"],
  msme_compliance_profiles: ["msme_id", "overall_status", "compliance_score", "risk_level", "pending_count", "under_review_count", "changes_requested_count", "rejected_count", "expired_count", "suspended_count", "revoked_count", "updated_at"],
  msme_compliance_items: ["id", "msme_id", "status", "requirement_code", "created_at", "updated_at", "submitted_at", "rejected_at", "approved_at"],
  compliance_events: ["id", "msme_id", "compliance_item_id", "event_type", "from_status", "to_status", "actor_role", "summary", "created_at"],
  compliance_documents: ["id", "msme_id", "document_type", "original_filename", "mime_type", "file_size_bytes", "uploaded_at", "is_deleted"],
  complaints: ["id", "msme_id", "provider_msme_id", "status", "priority", "severity", "complaint_reference", "reference_code", "title", "created_at", "updated_at"],
  complaint_status_history: ["id", "complaint_id", "from_status", "to_status", "changed_by_role", "note", "created_at"],
  verification_reviews: ["id", "msme_id", "status", "assigned_reviewer_id", "assigned_at", "started_at", "completed_at", "escalation_reason", "rejection_reason", "requested_documents", "internal_notes", "created_at", "updated_at"],
  verification_review_events: ["id", "verification_review_id", "event_type", "actor_role", "previous_status", "new_status", "metadata", "created_at"],
  verification_review_comments: ["id", "verification_review_id", "visibility", "comment", "actor_role", "created_at"],
  users: ["id", "full_name", "email", "role"],
};

const REQUIRED_TABLE_COLUMNS: Record<VerificationWorkspaceSourceName, string[]> = {
  msmes: ["id", "msme_id", "business_name", "verification_status", "review_status", "created_at"],
  validation_results: ["msme_id", "nin_status", "bvn_status", "cac_status", "tin_status"],
  compliance_profiles: ["msme_id", "overall_status"],
  digital_identity_credentials: ["id", "msme_id", "status"],
  credential_events: ["id", "credential_id", "action", "created_at"],
  msme_compliance_profiles: ["msme_id", "overall_status"],
  msme_compliance_items: ["id", "msme_id", "status"],
  compliance_events: ["id", "msme_id", "event_type", "created_at"],
  compliance_documents: ["id", "msme_id", "uploaded_at"],
  complaints: ["id", "msme_id", "status"],
  complaint_status_history: ["id", "complaint_id", "to_status"],
  verification_reviews: ["id", "msme_id", "status"],
  verification_review_events: ["id", "verification_review_id", "event_type", "created_at"],
  verification_review_comments: ["id", "verification_review_id", "comment", "created_at"],
  users: ["id", "full_name", "email", "role"],
};

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown, fallback = "unavailable") {
  const normalized = asString(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function maskTrailing(value: string | null | undefined, visible = 4) {
  const normalized = asString(value);
  if (!normalized) return null;
  if (normalized.length <= visible) return "*".repeat(normalized.length);
  return `${"*".repeat(Math.max(3, normalized.length - visible))}${normalized.slice(-visible)}`;
}

function maskEmail(value: string | null | undefined) {
  const normalized = asString(value).toLowerCase();
  if (!normalized || !normalized.includes("@")) return normalized ? "Unavailable" : null;
  const [name, domain] = normalized.split("@");
  const safeName = name.length <= 2 ? `${name.charAt(0)}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

async function readOptionalTable<T extends Record<string, unknown>>(
  supabase: SupabaseClient<any>,
  table: VerificationWorkspaceSourceName,
  columns: string[],
  limit = READ_LIMIT,
): Promise<TableReadResult<T>> {
  const { data, error } = await supabase.from(table).select(columns.join(",")).limit(limit);
  if (error) {
    const fallbackColumns = REQUIRED_TABLE_COLUMNS[table];
    if (fallbackColumns.join(",") !== columns.join(",")) {
      const fallback = await supabase.from(table).select(fallbackColumns.join(",")).limit(limit);
      if (!fallback.error) return { rows: ((fallback.data ?? []) as unknown as T[]).filter(Boolean), source: { available: true, message: `Loaded with reduced columns: ${error.message}` } };
    }
    console.info("[admin-verification-workspace]", { operation: "source_read", source: table, rowCount: 0, supabaseErrorCode: error.code ?? null, supabaseErrorMessage: error.message ?? null });
    return { rows: [], source: { available: false, message: error.message ?? "Source unavailable" } };
  }
  return { rows: ((data ?? []) as unknown as T[]).filter(Boolean), source: { available: true, message: null } };
}

function latestByMsme<T extends Record<string, unknown>>(rows: T[], dateColumns: string[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const msmeId = asString(row.msme_id);
    if (!msmeId) continue;
    const currentTime = Math.max(0, ...dateColumns.map((column) => Date.parse(asString(row[column])) || 0));
    const existing = map.get(msmeId);
    const existingTime = existing ? Math.max(0, ...dateColumns.map((column) => Date.parse(asString(existing[column])) || 0)) : -1;
    if (!existing || currentTime >= existingTime) map.set(msmeId, row);
  }
  return map;
}

function requestedDocuments(value: unknown) {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(asString).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function timelineItem(source: VerificationWorkspaceSourceName, row: Record<string, unknown>, eventType: string, summary: string): VerificationTimelineItem {
  return {
    id: asString(row.id) || `${source}-${eventType}-${asString(row.created_at)}`,
    eventType,
    actorRole: asString(row.actor_role ?? row.changed_by_role) || null,
    date: asString(row.created_at) || null,
    source,
    summary: asString(row.summary ?? row.note) || summary,
  };
}

function sortTimeline(items: VerificationTimelineItem[], limit = 8) {
  return items
    .filter((item) => item.date)
    .sort((a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0))
    .slice(0, limit);
}

function summarizeKyc(validation: Record<string, unknown> | undefined, legacyCompliance: Record<string, unknown> | undefined, msme: MsmeRow, sourceAvailable: boolean) {
  const ninStatus = asString(validation?.nin_status ?? legacyCompliance?.nin_status) || (sourceAvailable ? "incomplete" : null);
  const bvnStatus = asString(validation?.bvn_status ?? legacyCompliance?.bvn_status) || (sourceAvailable ? "incomplete" : null);
  const cacStatus = asString(validation?.cac_status ?? legacyCompliance?.cac_status) || (sourceAvailable ? "incomplete" : null);
  const tinStatus = asString(validation?.tin_status ?? legacyCompliance?.tin_status) || (sourceAvailable ? "incomplete" : null);
  const addressStatus = asString(msme.address) ? "provided" : "missing";
  const contactStatus = asString(msme.contact_phone) && asString(msme.contact_email) ? "provided" : "missing";
  const statuses = [ninStatus, bvnStatus, cacStatus, tinStatus].map((status) => normalizeStatus(status, "unavailable"));
  let overallStatus = "unavailable";
  if (statuses.some((status) => FAILED_STATUSES.has(status))) overallStatus = "failed";
  else if (statuses.some((status) => PENDING_STATUSES.has(status))) overallStatus = "pending";
  else if (statuses.every((status) => HEALTHY_STATUSES.has(status))) overallStatus = "verified";
  else if (statuses.some((status) => status !== "unavailable")) overallStatus = "incomplete";
  return { ninStatus, bvnStatus, cacStatus, tinStatus, addressStatus, contactStatus, overallStatus };
}

function profileCompletenessScore(msme: MsmeRow) {
  const fields = [
    msme.business_name,
    msme.owner_name,
    msme.contact_email,
    msme.contact_phone,
    msme.state,
    msme.lga,
    msme.sector,
    msme.business_type,
    msme.address,
    msme.cac_number,
    msme.tin,
  ];
  return Math.round((fields.filter((value) => Boolean(asString(value))).length / fields.length) * 100);
}

function missingProfileFields(msme: MsmeRow): string[] {
  return [
    ["Business name", msme.business_name],
    ["Owner name", msme.owner_name],
    ["Email", msme.contact_email],
    ["Phone", msme.contact_phone],
    ["State", msme.state],
    ["LGA", msme.lga],
    ["Sector", msme.sector],
    ["Business type", msme.business_type],
    ["Address", msme.address],
    ["CAC", msme.cac_number],
    ["TIN", msme.tin],
  ].filter(([, value]) => !asString(value)).map(([label]) => String(label));
}

function coreCheckBreakdown(kyc: AdminVerificationWorkspace["kyc"]) {
  const entries = [
    ["NIN", kyc.ninStatus],
    ["BVN", kyc.bvnStatus],
    ["CAC", kyc.cacStatus],
    ["TIN", kyc.tinStatus],
  ] as const;
  return {
    failed: entries.filter(([, status]) => FAILED_STATUSES.has(normalizeStatus(status, ""))).map(([label]) => label),
    pending: entries.filter(([, status]) => PENDING_STATUSES.has(normalizeStatus(status, ""))).map(([label]) => label),
  };
}

function normalizedComparable(value: string | null | undefined) {
  return asString(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function bigrams(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 2) return new Set(compact ? [compact] : []);
  const grams = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) grams.add(compact.slice(index, index + 2));
  return grams;
}

function nameSimilarity(a: string | null | undefined, b: string | null | undefined) {
  const left = bigrams(normalizedComparable(a));
  const right = bigrams(normalizedComparable(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const gram of left) if (right.has(gram)) overlap += 1;
  return (2 * overlap) / (left.size + right.size);
}

function buildDuplicateSignals(msme: MsmeRow, allMsmes: MsmeRow[]) {
  return allMsmes
    .filter((candidate) => asString(candidate.id) && asString(candidate.id) !== asString(msme.id))
    .map((candidate) => {
      const signals: string[] = [];
      let score = 0;
      if (asString(msme.cac_number) && normalizedComparable(msme.cac_number) === normalizedComparable(candidate.cac_number)) {
        score += 45;
        signals.push("Possible duplicate CAC");
      }
      if (asString(msme.tin) && normalizedComparable(msme.tin) === normalizedComparable(candidate.tin)) {
        score += 45;
        signals.push("Duplicate TIN");
      }
      if (asString(msme.contact_phone) && normalizedComparable(msme.contact_phone) === normalizedComparable(candidate.contact_phone)) {
        score += 30;
        signals.push("Duplicate phone");
      }
      if (asString(msme.contact_email) && normalizedComparable(msme.contact_email) === normalizedComparable(candidate.contact_email)) {
        score += 30;
        signals.push("Duplicate email");
      }
      const similarity = nameSimilarity(msme.business_name, candidate.business_name);
      if (similarity >= 0.72) {
        score += Math.round(similarity * 25);
        signals.push(`Suspicious business-name similarity ${Math.round(similarity * 100)}%`);
      }
      return {
        id: asString(candidate.id),
        businessName: asString(candidate.business_name) || "Unnamed MSME",
        msmeId: asString(candidate.msme_id) || "Unassigned MSME ID",
        signals,
        confidence: score >= 60 ? "high" as const : score >= 35 ? "medium" as const : "low" as const,
        score,
      };
    })
    .filter((signal) => signal.score >= 25 && signal.signals.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((signal) => ({
      id: signal.id,
      businessName: signal.businessName,
      msmeId: signal.msmeId,
      signals: signal.signals,
      confidence: signal.confidence,
    }));
}

function attentionLevel(params: { flagged: boolean; suspended: boolean; kycOverall: string; failedCompliance: number | null; openComplaints: number | null; duplicates: number }) {
  if (params.suspended) return "critical";
  if (params.flagged || params.kycOverall === "failed" || (params.failedCompliance ?? 0) > 0) return "elevated";
  if ((params.openComplaints ?? 0) > 0 || params.duplicates > 0 || params.kycOverall === "pending") return "watch";
  return "normal";
}

export async function getAdminVerificationWorkspace(supabase: SupabaseClient<any>, msmeId: string): Promise<AdminVerificationWorkspace | null> {
  const sources = Object.fromEntries((Object.keys(TABLE_COLUMNS) as VerificationWorkspaceSourceName[]).map((source) => [source, { available: false, message: "Not loaded" }])) as Record<VerificationWorkspaceSourceName, VerificationSourceState>;
  const [
    msmesResult,
    validationResult,
    legacyComplianceResult,
    credentialsResult,
    credentialEventsResult,
    complianceProfilesResult,
    complianceItemsResult,
    complianceEventsResult,
    documentsResult,
    complaintsResult,
    complaintHistoryResult,
    reviewsResult,
    reviewEventsResult,
    reviewCommentsResult,
    usersResult,
  ] = await Promise.all([
    readOptionalTable<MsmeRow>(supabase, "msmes", TABLE_COLUMNS.msmes),
    readOptionalTable<Record<string, unknown>>(supabase, "validation_results", TABLE_COLUMNS.validation_results),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_profiles", TABLE_COLUMNS.compliance_profiles),
    readOptionalTable<Record<string, unknown>>(supabase, "digital_identity_credentials", TABLE_COLUMNS.digital_identity_credentials),
    readOptionalTable<Record<string, unknown>>(supabase, "credential_events", TABLE_COLUMNS.credential_events),
    readOptionalTable<Record<string, unknown>>(supabase, "msme_compliance_profiles", TABLE_COLUMNS.msme_compliance_profiles),
    readOptionalTable<Record<string, unknown>>(supabase, "msme_compliance_items", TABLE_COLUMNS.msme_compliance_items),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_events", TABLE_COLUMNS.compliance_events),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_documents", TABLE_COLUMNS.compliance_documents),
    readOptionalTable<Record<string, unknown>>(supabase, "complaints", TABLE_COLUMNS.complaints),
    readOptionalTable<Record<string, unknown>>(supabase, "complaint_status_history", TABLE_COLUMNS.complaint_status_history),
    readOptionalTable<Record<string, unknown>>(supabase, "verification_reviews", TABLE_COLUMNS.verification_reviews),
    readOptionalTable<Record<string, unknown>>(supabase, "verification_review_events", TABLE_COLUMNS.verification_review_events),
    readOptionalTable<Record<string, unknown>>(supabase, "verification_review_comments", TABLE_COLUMNS.verification_review_comments),
    readOptionalTable<Record<string, unknown>>(supabase, "users", TABLE_COLUMNS.users),
  ]);

  Object.assign(sources, {
    msmes: msmesResult.source,
    validation_results: validationResult.source,
    compliance_profiles: legacyComplianceResult.source,
    digital_identity_credentials: credentialsResult.source,
    credential_events: credentialEventsResult.source,
    msme_compliance_profiles: complianceProfilesResult.source,
    msme_compliance_items: complianceItemsResult.source,
    compliance_events: complianceEventsResult.source,
    compliance_documents: documentsResult.source,
    complaints: complaintsResult.source,
    complaint_status_history: complaintHistoryResult.source,
    verification_reviews: reviewsResult.source,
    verification_review_events: reviewEventsResult.source,
    verification_review_comments: reviewCommentsResult.source,
    users: usersResult.source,
  });

  const msme = msmesResult.rows.find((row) => asString(row.id) === msmeId);
  if (!msme) return null;

  const validation = latestByMsme(validationResult.rows, ["updated_at", "validated_at"]).get(msmeId);
  const legacyCompliance = latestByMsme(legacyComplianceResult.rows, ["last_reviewed_at"]).get(msmeId);
  const complianceProfile = latestByMsme(complianceProfilesResult.rows, ["updated_at"]).get(msmeId);
  const credential = latestByMsme(credentialsResult.rows, ["updated_at", "approved_at", "issued_at", "created_at"]).get(msmeId);
  const credentialEvents = credentialEventsResult.rows.filter((row) => asString(row.credential_id) === asString(credential?.id));
  const complianceItems = complianceItemsResult.rows.filter((row) => asString(row.msme_id) === msmeId);
  const complianceEvents = complianceEventsResult.rows.filter((row) => asString(row.msme_id) === msmeId);
  const documents = documentsResult.rows.filter((row) => asString(row.msme_id) === msmeId && !Boolean(row.is_deleted));
  const complaints = complaintsResult.rows.filter((row) => asString(row.msme_id) === msmeId || asString(row.provider_msme_id) === msmeId);
  const complaintIds = new Set(complaints.map((row) => asString(row.id)));
  const complaintHistory = complaintHistoryResult.rows.filter((row) => complaintIds.has(asString(row.complaint_id)));
  const reviewRows = reviewsResult.rows.filter((row) => asString(row.msme_id) === msmeId).sort((a, b) => (Date.parse(asString(b.updated_at ?? b.created_at)) || 0) - (Date.parse(asString(a.updated_at ?? a.created_at)) || 0));
  const reviewRow = reviewRows[0];
  const reviewId = asString(reviewRow?.id) || null;
  const canonicalReviewStatus = normalizeVerificationReviewStatus(reviewRow?.status);
  const reviewEvents = reviewEventsResult.rows.filter((row) => asString(row.verification_review_id) === reviewId);
  const reviewComments = reviewCommentsResult.rows.filter((row) => asString(row.verification_review_id) === reviewId);
  const usersById = new Map(usersResult.rows.map((row) => [asString(row.id), row]));
  const assignedReviewer = usersById.get(asString(reviewRow?.assigned_reviewer_id));
  const reviewers = usersResult.rows
    .filter((row) => ["admin", "reviewer"].includes(normalizeStatus(row.role, "")))
    .map((row) => ({ id: asString(row.id), label: asString(row.full_name) || asString(row.email) || "Unnamed reviewer" }))
    .filter((row) => row.id);

  const kyc = summarizeKyc(validation, legacyCompliance, msme, sources.validation_results.available || sources.compliance_profiles.available);
  const failedCount = sources.msme_compliance_items.available ? complianceItems.filter((row) => ["rejected", "expired", "suspended", "revoked", "failed"].includes(normalizeStatus(row.status, ""))).length : null;
  const pendingCount = sources.msme_compliance_items.available ? complianceItems.filter((row) => ["pending", "not_started", "under_review", "submitted", "changes_requested", "expiring_soon"].includes(normalizeStatus(row.status, ""))).length : null;
  const openComplaints = sources.complaints.available ? complaints.filter((row) => !CLOSED_COMPLAINT_STATUSES.has(normalizeStatus(row.status, "submitted"))).length : null;
  const highSeverityOpenComplaints = sources.complaints.available ? complaints.filter((row) => !CLOSED_COMPLAINT_STATUSES.has(normalizeStatus(row.status, "submitted")) && ["high", "critical", "urgent"].includes(normalizeStatus(row.severity ?? row.priority, ""))).length : null;
  const highestSeverity = complaints.map((row) => normalizeStatus(row.severity ?? row.priority, "")).sort((a, b) => severityRank(b) - severityRank(a))[0] || null;
  const duplicateSignals = buildDuplicateSignals(msme, msmesResult.rows);
  const flattenedDuplicateSignals = duplicateSignals.flatMap((signal) => signal.signals);
  const strongDuplicateSignals = duplicateSignals.some((signal) => signal.confidence === "high");
  const missingRequiredItems = complianceItems
    .filter((row) => ["pending", "not_started", "rejected", "changes_requested", "expired"].includes(normalizeStatus(row.status, "")))
    .map((row) => asString(row.requirement_code) || `Compliance item ${asString(row.id).slice(0, 8)}`)
    .slice(0, 8);
  const coreChecks = coreCheckBreakdown(kyc);
  const credentialStatus = sources.digital_identity_credentials.available ? normalizeStatus(credential?.status, "missing") : null;
  const repeatedRejectedReviews = reviewRows.filter((row) => normalizeVerificationReviewStatus(row.status) === "rejected").length;
  const queueDate = asString(reviewRow?.created_at) || (["pending_review", "under_review", "awaiting_documents", "escalated", "submitted", "changes_requested"].includes(canonicalReviewStatus) ? asString(msme.created_at) || null : null);
  const compliancePosture = normalizeStatus(complianceProfile?.overall_status ?? legacyCompliance?.overall_status, "") || null;
  const intelligence = buildVerificationIntelligence({
    flagged: Boolean(msme.flagged),
    suspended: Boolean(msme.suspended),
    kycOverall: kyc.overallStatus,
    failedCoreChecks: coreChecks.failed,
    pendingCoreChecks: coreChecks.pending,
    credentialStatus,
    hasActiveCredential: credentialStatus === "active",
    openComplaints,
    highSeverityComplaints: highSeverityOpenComplaints,
    duplicateSignals: flattenedDuplicateSignals,
    strongDuplicateSignals,
    profileCompleteness: profileCompletenessScore(msme),
    missingProfileFields: missingProfileFields(msme),
    complianceStatus: compliancePosture,
    complianceFailedCount: failedCount,
    compliancePendingCount: pendingCount,
    repeatedRejectedReviews,
    reviewStatus: canonicalReviewStatus,
    queueDate,
  });

  return {
    msme: {
      id: msmeId,
      businessName: asString(msme.business_name) || "Unnamed MSME",
      msmeId: asString(msme.msme_id) || "Unassigned MSME ID",
      ownerName: asString(msme.owner_name) || "Owner unavailable",
      state: asString(msme.state) || null,
      lga: asString(msme.lga) || null,
      sector: asString(msme.sector) || null,
      onboardingStatus: canonicalReviewStatus,
      verificationStatus: normalizeStatus(msme.verification_status, "pending"),
      reviewStatus: canonicalReviewStatus,
      createdAt: asString(msme.created_at) || null,
      flagged: Boolean(msme.flagged),
      suspended: Boolean(msme.suspended),
      attentionLevel: attentionLevel({ flagged: Boolean(msme.flagged), suspended: Boolean(msme.suspended), kycOverall: kyc.overallStatus, failedCompliance: failedCount, openComplaints, duplicates: duplicateSignals.length }),
      cacMasked: maskTrailing(msme.cac_number),
      tinMasked: maskTrailing(msme.tin),
      phoneMasked: maskTrailing(msme.contact_phone),
      emailMasked: maskEmail(msme.contact_email),
    },
    kyc,
    credential: {
      status: credentialStatus,
      ndmiiId: asString(credential?.ndmii_id) || null,
      issuedAt: asString(credential?.issued_at ?? credential?.approved_at) || null,
      lastEvent: sortTimeline(credentialEvents.map((row) => timelineItem("credential_events", row, asString(row.action) || "credential_event", `Credential ${asString(row.action) || "event"}`)), 1)[0] ?? null,
    },
    compliance: {
      posture: compliancePosture,
      riskLevel: asString(complianceProfile?.risk_level ?? legacyCompliance?.risk_level) || null,
      score: Number.isFinite(Number(complianceProfile?.compliance_score ?? legacyCompliance?.score)) ? Number(complianceProfile?.compliance_score ?? legacyCompliance?.score) : null,
      failedCount,
      pendingCount,
      reviewStatus: pendingCount === null && failedCount === null ? null : failedCount ? "attention_required" : pendingCount ? "pending_items" : "clear",
      missingRequiredItems,
      latestEvents: sortTimeline(complianceEvents.map((row) => timelineItem("compliance_events", row, asString(row.event_type) || "compliance_event", "Compliance event recorded")), 5),
    },
    complaints: {
      openCount: openComplaints,
      highestSeverity,
      unresolvedDisputes: openComplaints,
      timeline: sortTimeline([
        ...complaints.map((row) => timelineItem("complaints", row, normalizeStatus(row.status, "complaint"), asString(row.title) || "Complaint recorded")),
        ...complaintHistory.map((row) => timelineItem("complaint_status_history", row, normalizeStatus(row.to_status, "complaint_update"), "Complaint status updated")),
      ], 5),
    },
    duplicateSignals,
    intelligence,
    documents: documents.map((document) => ({
      id: asString(document.id),
      documentType: asString(document.document_type) || "verification_file",
      fileName: asString(document.original_filename) || "Uploaded verification file",
      mimeType: asString(document.mime_type) || null,
      fileSizeBytes: Number.isFinite(Number(document.file_size_bytes)) ? Number(document.file_size_bytes) : null,
      uploadedAt: asString(document.uploaded_at) || null,
      previewHref: `/api/msme/compliance/evidence/${encodeURIComponent(asString(document.id))}?disposition=inline`,
      downloadHref: `/api/msme/compliance/evidence/${encodeURIComponent(asString(document.id))}?disposition=attachment`,
    })),
    review: {
      id: reviewId,
      status: canonicalReviewStatus,
      assignedReviewerId: asString(reviewRow?.assigned_reviewer_id) || null,
      assignedReviewerName: asString(assignedReviewer?.full_name) || asString(assignedReviewer?.email) || null,
      assignedAt: asString(reviewRow?.assigned_at) || null,
      startedAt: asString(reviewRow?.started_at) || null,
      completedAt: asString(reviewRow?.completed_at) || null,
      escalationReason: asString(reviewRow?.escalation_reason) || null,
      rejectionReason: asString(reviewRow?.rejection_reason) || null,
      requestedDocuments: requestedDocuments(reviewRow?.requested_documents),
      internalNotes: asString(reviewRow?.internal_notes) || null,
      createdAt: asString(reviewRow?.created_at) || null,
      updatedAt: asString(reviewRow?.updated_at) || null,
      events: sortTimeline(reviewEvents.map((row) => timelineItem("verification_review_events", row, asString(row.event_type) || "review_event", `Review ${asString(row.event_type) || "event"}`)), 12),
      comments: reviewComments
        .sort((a, b) => (Date.parse(asString(b.created_at)) || 0) - (Date.parse(asString(a.created_at)) || 0))
        .slice(0, 10)
        .map((row) => ({ id: asString(row.id), visibility: asString(row.visibility) || "internal", comment: asString(row.comment), actorRole: asString(row.actor_role) || null, createdAt: asString(row.created_at) || null })),
    },
    reviewers,
    sources,
  };
}

function normalizeVerificationReviewStatus(value: unknown): VerificationReviewStatus {
  const normalized = normalizeStatus(value, "pending_review");
  if ((CANONICAL_REVIEW_STATUSES as readonly string[]).includes(normalized)) return normalized as VerificationReviewStatus;
  return "pending_review";
}

function severityRank(value: string | null | undefined) {
  const normalized = normalizeStatus(value, "");
  if (["critical", "urgent"].includes(normalized)) return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;
  return 0;
}
