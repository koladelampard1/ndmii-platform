import type { SupabaseClient } from "@supabase/supabase-js";
import { csvValue } from "@/lib/data/admin-msme-registry";
import {
  buildVerificationIntelligence,
  verificationAgeDays,
  type VerificationAttentionLevel,
  type VerificationConfidenceCategory,
  type VerificationIntelligence,
  type VerificationQueuePriority,
} from "@/lib/data/admin-verification-intelligence";

export type AdminVerificationFilters = {
  q?: string;
  verificationStatus?: string;
  reviewStatus?: string;
  kycStatus?: string;
  digitalIdStatus?: string;
  state?: string;
  sector?: string;
  attentionLevel?: string;
  confidenceCategory?: string;
  priority?: string;
  complaintLinked?: string;
  duplicateSignal?: string;
  missingCredential?: string;
  staleReview?: string;
  sort?: string;
  flagged?: string;
  suspended?: string;
  updatedFrom?: string;
  updatedTo?: string;
  page?: number;
  pageSize?: number;
  selectedId?: string;
  exportAll?: boolean;
};

export type AdminVerificationSourceName =
  | "msmes"
  | "validation_results"
  | "compliance_profiles"
  | "digital_identity_credentials"
  | "msme_compliance_profiles"
  | "msme_compliance_items"
  | "verification_reviews"
  | "complaints"
  | "activity_logs";

export type AdminVerificationSourceState = {
  available: boolean;
  message?: string | null;
};

export type KycCheckSummary = {
  nin: string | null;
  bvn: string | null;
  cac: string | null;
  tin: string | null;
  overall: string;
};

export type QueueReason = {
  code: string;
  label: string;
  source: AdminVerificationSourceName | "verification_rules";
  severity: "watch" | "elevated" | "critical";
  detectedAt: string | null;
};

export type AdminVerificationQueueRow = {
  id: string;
  businessName: string;
  msmeId: string;
  ownerName: string;
  state: string | null;
  lga: string | null;
  sector: string | null;
  verificationStatus: string;
  reviewStatus: string;
  kyc: KycCheckSummary;
  digitalCredentialStatus: string;
  digitalCredentialId: string | null;
  complaintCount: number | null;
  openComplaintCount: number | null;
  highSeverityComplaintCount: number | null;
  attentionLevel: VerificationAttentionLevel;
  confidenceCategory: VerificationConfidenceCategory;
  queuePriority: VerificationQueuePriority;
  intelligence: VerificationIntelligence;
  oldestPendingAt: string | null;
  oldestPendingAgeDays: number | null;
  queueAgeDays: number | null;
  agingBucket: string;
  overdue: boolean;
  lastUpdatedAt: string | null;
  flagged: boolean;
  suspended: boolean;
  cacMasked: string | null;
  tinMasked: string | null;
  phoneMasked: string | null;
  emailMasked: string | null;
  complianceStatus: string | null;
  complianceScore: number | null;
  complianceRiskLevel: string | null;
  complianceFailedCount: number | null;
  compliancePendingCount: number | null;
  reasons: QueueReason[];
  riskSignals: string[];
  duplicateSignals: string[];
  suggestedNextAction: string;
  latestActivity: string | null;
  latestActivityAt: string | null;
};

export type AdminVerificationKpis = {
  totalQueue: number;
  pendingReview: number;
  failedChecks: number;
  missingCredentials: number;
  flaggedOrSuspended: number;
};

export type AdminVerificationQueueResult = {
  rows: AdminVerificationQueueRow[];
  selectedRow: AdminVerificationQueueRow | null;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: AdminVerificationKpis;
  options: {
    states: string[];
    sectors: string[];
    verificationStatuses: string[];
    reviewStatuses: string[];
    kycStatuses: string[];
    digitalIdStatuses: string[];
    attentionLevels: string[];
    confidenceCategories: string[];
    priorities: string[];
    sortOptions: Array<{ value: string; label: string }>;
  };
  reviewerWorkload: AdminVerificationReviewerWorkload;
  sources: Record<AdminVerificationSourceName, AdminVerificationSourceState>;
  diagnostics: {
    operation: string;
    filtersUsed: Record<string, string | number | null>;
    rowCount: number;
    supabaseErrorCode?: string | null;
    supabaseErrorMessage?: string | null;
  };
};

export type AdminVerificationReviewerWorkload = {
  available: boolean;
  assignedToMe: number | null;
  unassigned: number | null;
  underReview: number | null;
  awaitingDocuments: number | null;
  escalated: number | null;
  averageReviewAgeDays: number | null;
  message: string | null;
};

type TableReadResult<T> = {
  rows: T[];
  source: AdminVerificationSourceState;
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

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = new Set([25, 50, 100]);
const READ_LIMIT = 5000;
const REVIEW_QUEUE_STATUSES = new Set(["pending_review", "under_review", "awaiting_documents", "escalated", "submitted", "changes_requested"]);
const CANONICAL_REVIEW_STATUSES = ["pending_review", "under_review", "awaiting_documents", "escalated", "verified", "rejected"] as const;
const VERIFIED_STATUSES = new Set(["verified", "approved", "active"]);
const HEALTHY_CHECK_STATUSES = new Set(["verified", "passed", "matched", "complete", "approved", "valid"]);
const FAILED_CHECK_STATUSES = new Set(["failed", "rejected", "mismatch", "invalid", "error"]);
const PENDING_CHECK_STATUSES = new Set(["pending", "incomplete", "not_started", "unverified", "unknown", ""]);
const CLOSED_COMPLAINT_STATUSES = new Set(["resolved", "closed", "dismissed"]);

const TABLE_COLUMNS: Record<AdminVerificationSourceName, string[]> = {
  msmes: [
    "id",
    "msme_id",
    "business_name",
    "owner_name",
    "state",
    "lga",
    "sector",
    "business_type",
    "address",
    "verification_status",
    "review_status",
    "cac_number",
    "tin",
    "contact_phone",
    "contact_email",
    "flagged",
    "suspended",
    "created_at",
    "updated_at",
  ],
  validation_results: ["msme_id", "nin_status", "bvn_status", "cac_status", "tin_status", "confidence_score", "validation_summary", "validated_at", "updated_at"],
  compliance_profiles: ["msme_id", "overall_status", "score", "risk_level", "nin_status", "bvn_status", "cac_status", "tin_status", "last_reviewed_at"],
  digital_identity_credentials: ["id", "msme_id", "ndmii_id", "status", "issued_at", "approved_at", "revoked_at", "suspended_at", "token_expires_at", "created_at", "updated_at"],
  msme_compliance_profiles: ["msme_id", "overall_status", "compliance_score", "risk_level", "pending_count", "under_review_count", "changes_requested_count", "rejected_count", "expired_count", "suspended_count", "revoked_count", "updated_at"],
  msme_compliance_items: ["id", "msme_id", "status", "created_at", "updated_at", "submitted_at", "rejected_at", "approved_at"],
  verification_reviews: ["id", "msme_id", "status", "assigned_reviewer_id", "created_at", "updated_at"],
  complaints: ["id", "msme_id", "provider_msme_id", "status", "priority", "severity", "created_at", "updated_at"],
  activity_logs: ["id", "action", "entity_type", "entity_id", "metadata", "created_at"],
};

const REQUIRED_TABLE_COLUMNS: Record<AdminVerificationSourceName, string[]> = {
  msmes: ["id", "msme_id", "business_name", "owner_name", "state", "sector", "verification_status", "created_at"],
  validation_results: ["msme_id", "confidence_score"],
  compliance_profiles: ["msme_id", "overall_status"],
  digital_identity_credentials: ["id", "msme_id", "ndmii_id", "status"],
  msme_compliance_profiles: ["msme_id", "overall_status"],
  msme_compliance_items: ["id", "msme_id", "status"],
  verification_reviews: ["id", "msme_id", "status"],
  complaints: ["id", "msme_id", "status"],
  activity_logs: ["id", "action", "entity_type", "entity_id", "created_at"],
};

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStatus(value: string | null | undefined, fallback = "unavailable") {
  const normalized = asString(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function normalizeReviewStatus(value: unknown, fallback = "pending_review") {
  const normalized = normalizeStatus(asString(value), fallback);
  return (CANONICAL_REVIEW_STATUSES as readonly string[]).includes(normalized) ? normalized : fallback;
}

function normalizePage(value: unknown) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizePageSize(value: unknown) {
  const parsed = Number(value ?? DEFAULT_PAGE_SIZE);
  return PAGE_SIZES.has(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

export function normalizeAdminVerificationFilters(input: AdminVerificationFilters): Required<Pick<AdminVerificationFilters, "page" | "pageSize">> & AdminVerificationFilters {
  return {
    ...input,
    page: normalizePage(input.page),
    pageSize: normalizePageSize(input.pageSize),
  };
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => asString(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
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

function sourceUnavailable(error: { message?: string | null } | null): AdminVerificationSourceState {
  return { available: false, message: error?.message ?? "Source unavailable" };
}

async function readOptionalTable<T extends Record<string, unknown>>(
  supabase: SupabaseClient<any>,
  table: AdminVerificationSourceName,
  columns: string[],
  limit = READ_LIMIT,
): Promise<TableReadResult<T>> {
  const { data, error } = await supabase.from(table).select(columns.join(",")).limit(limit);
  if (error) {
    const fallbackColumns = REQUIRED_TABLE_COLUMNS[table];
    if (fallbackColumns.join(",") !== columns.join(",")) {
      const fallback = await supabase.from(table).select(fallbackColumns.join(",")).limit(limit);
      if (!fallback.error) {
        const rows = ((fallback.data ?? []) as unknown as T[]).filter(Boolean);
        console.info("[admin-verifications]", {
          operation: "source_read_schema_fallback",
          source: table,
          rowCount: rows.length,
          supabaseErrorCode: error.code ?? null,
          supabaseErrorMessage: error.message ?? null,
        });
        return { rows, source: { available: true, message: `Loaded with reduced columns after schema fallback: ${error.message}` } };
      }
    }

    console.info("[admin-verifications]", {
      operation: "source_read",
      source: table,
      rowCount: 0,
      supabaseErrorCode: error.code ?? null,
      supabaseErrorMessage: error.message ?? null,
    });
    return { rows: [], source: sourceUnavailable(error) };
  }

  const rows = ((data ?? []) as unknown as T[]).filter(Boolean);
  console.info("[admin-verifications]", {
    operation: "source_read",
    source: table,
    rowCount: rows.length,
    supabaseErrorCode: null,
    supabaseErrorMessage: null,
  });
  return { rows, source: { available: true, message: null } };
}

function latestByMsme<T extends Record<string, unknown>>(rows: T[], dateColumns: string[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const msmeId = asString(row.msme_id);
    if (!msmeId) continue;
    const existing = map.get(msmeId);
    const currentTime = latestTime(row, dateColumns);
    const existingTime = existing ? latestTime(existing, dateColumns) : -1;
    if (!existing || currentTime >= existingTime) map.set(msmeId, row);
  }
  return map;
}

function latestTime(row: Record<string, unknown>, columns: string[]) {
  return Math.max(0, ...columns.map((column) => Date.parse(asString(row[column])) || 0));
}

function buildComplaintCounts(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, { total: number; open: number; highSeverityOpen: number; latestAt: string | null }>();
  for (const row of rows) {
    const ids = [asString(row.msme_id), asString(row.provider_msme_id)].filter(Boolean);
    const status = normalizeStatus(asString(row.status), "submitted");
    const severity = normalizeStatus(asString(row.severity ?? row.priority), "");
    const date = asString(row.updated_at) || asString(row.created_at) || null;
    for (const id of new Set(ids)) {
      const current = counts.get(id) ?? { total: 0, open: 0, highSeverityOpen: 0, latestAt: null };
      current.total += 1;
      if (!CLOSED_COMPLAINT_STATUSES.has(status)) {
        current.open += 1;
        if (["high", "critical", "urgent"].includes(severity)) current.highSeverityOpen += 1;
      }
      current.latestAt = maxDate(current.latestAt, date);
      counts.set(id, current);
    }
  }
  return counts;
}

function buildComplianceItemStats(rows: Array<Record<string, unknown>>) {
  const stats = new Map<string, { failed: number; pending: number; latestAt: string | null; oldestAttentionAt: string | null }>();
  for (const row of rows) {
    const msmeId = asString(row.msme_id);
    if (!msmeId) continue;
    const status = normalizeStatus(asString(row.status), "not_started");
    const current = stats.get(msmeId) ?? { failed: 0, pending: 0, latestAt: null, oldestAttentionAt: null };
    const date = asString(row.updated_at) || asString(row.submitted_at) || asString(row.created_at) || null;
    if (["rejected", "expired", "suspended", "revoked", "failed"].includes(status)) {
      current.failed += 1;
      current.oldestAttentionAt = minDate(current.oldestAttentionAt, date);
    }
    if (["pending", "not_started", "under_review", "submitted", "changes_requested", "expiring_soon"].includes(status)) {
      current.pending += 1;
      current.oldestAttentionAt = minDate(current.oldestAttentionAt, date);
    }
    current.latestAt = maxDate(current.latestAt, date);
    stats.set(msmeId, current);
  }
  return stats;
}

function buildReviewStats(rows: Array<Record<string, unknown>>) {
  const stats = new Map<string, { rejected: number; latestAt: string | null; oldestOpenAt: string | null }>();
  for (const row of rows) {
    const msmeId = asString(row.msme_id);
    if (!msmeId) continue;
    const status = normalizeStatus(asString(row.status), "");
    const date = asString(row.updated_at) || asString(row.created_at) || null;
    const current = stats.get(msmeId) ?? { rejected: 0, latestAt: null, oldestOpenAt: null };
    if (status === "rejected") current.rejected += 1;
    if (REVIEW_QUEUE_STATUSES.has(status)) current.oldestOpenAt = minDate(current.oldestOpenAt, asString(row.created_at) || date);
    current.latestAt = maxDate(current.latestAt, date);
    stats.set(msmeId, current);
  }
  return stats;
}

function buildDuplicateIndex(rows: MsmeRow[]) {
  const byKey = new Map<string, string[]>();
  const labelsById = new Map<string, string[]>();
  const strongById = new Set<string>();
  const keys: Array<{ field: keyof MsmeRow; label: string; strong: boolean }> = [
    { field: "cac_number", label: "Duplicate CAC", strong: true },
    { field: "tin", label: "Duplicate TIN", strong: true },
    { field: "contact_phone", label: "Duplicate phone", strong: false },
    { field: "contact_email", label: "Duplicate email", strong: false },
    { field: "business_name", label: "Duplicate business name", strong: false },
  ];

  for (const row of rows) {
    const id = asString(row.id);
    if (!id) continue;
    for (const key of keys) {
      const value = asString(row[key.field]).toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!value || value.length < 3) continue;
      const mapKey = `${key.field}:${value}`;
      byKey.set(mapKey, [...(byKey.get(mapKey) ?? []), id]);
    }
  }

  for (const [mapKey, ids] of byKey.entries()) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length < 2) continue;
    const field = mapKey.split(":")[0] as keyof MsmeRow;
    const match = keys.find((item) => item.field === field);
    if (!match) continue;
    for (const id of uniqueIds) {
      labelsById.set(id, [...(labelsById.get(id) ?? []), match.label]);
      if (match.strong) strongById.add(id);
    }
  }

  return { labelsById, strongById };
}

function buildActivityByMsme(rows: Array<Record<string, unknown>>) {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const entityType = normalizeStatus(asString(row.entity_type), "");
    if (entityType && !["msme", "msmes", "msme_registry", "verification"].includes(entityType)) continue;
    const entityId = asString(row.entity_id);
    if (!entityId) continue;
    const existing = map.get(entityId);
    if (!existing || (Date.parse(asString(row.created_at)) || 0) > (Date.parse(asString(existing.created_at)) || 0)) map.set(entityId, row);
  }
  return map;
}

function maxDate(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return (Date.parse(right) || 0) > (Date.parse(left) || 0) ? right : left;
}

function minDate(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return (Date.parse(right) || 0) < (Date.parse(left) || 0) ? right : left;
}

function ageDays(value: string | null) {
  return verificationAgeDays(value);
}

function checkStatus(value: string | null | undefined) {
  return normalizeStatus(value, "unavailable");
}

function summarizeKyc(validation: Record<string, unknown> | undefined, legacyCompliance: Record<string, unknown> | undefined, validationAvailable: boolean): KycCheckSummary {
  const nin = asString(validation?.nin_status ?? legacyCompliance?.nin_status) || (validationAvailable ? "incomplete" : null);
  const bvn = asString(validation?.bvn_status ?? legacyCompliance?.bvn_status) || (validationAvailable ? "incomplete" : null);
  const cac = asString(validation?.cac_status ?? legacyCompliance?.cac_status) || (validationAvailable ? "incomplete" : null);
  const tin = asString(validation?.tin_status ?? legacyCompliance?.tin_status) || (validationAvailable ? "incomplete" : null);
  const statuses = [nin, bvn, cac, tin].map(checkStatus);

  let overall = "unavailable";
  if (statuses.some((status) => FAILED_CHECK_STATUSES.has(status))) overall = "failed";
  else if (statuses.some((status) => PENDING_CHECK_STATUSES.has(status))) overall = "pending";
  else if (statuses.every((status) => HEALTHY_CHECK_STATUSES.has(status))) overall = "verified";
  else if (statuses.some((status) => status !== "unavailable")) overall = "incomplete";

  return { nin, bvn, cac, tin, overall };
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

function coreCheckBreakdown(kyc: KycCheckSummary) {
  const entries = [
    ["NIN", kyc.nin],
    ["BVN", kyc.bvn],
    ["CAC", kyc.cac],
    ["TIN", kyc.tin],
  ] as const;
  return {
    failed: entries.filter(([, status]) => FAILED_CHECK_STATUSES.has(checkStatus(status))).map(([label]) => label),
    pending: entries.filter(([, status]) => PENDING_CHECK_STATUSES.has(checkStatus(status))).map(([label]) => label),
  };
}

function attentionFromReasons(reasons: QueueReason[]): AdminVerificationQueueRow["attentionLevel"] {
  if (reasons.some((reason) => reason.severity === "critical")) return "critical";
  if (reasons.some((reason) => reason.severity === "elevated")) return "elevated";
  return "watch";
}

function suggestedNextAction(reasons: QueueReason[]) {
  if (reasons.some((reason) => reason.code === "suspended_msme")) return "Escalate to senior admin for account status review.";
  if (reasons.some((reason) => reason.code === "flagged_msme")) return "Review operational flag context before any verification decision.";
  if (reasons.some((reason) => reason.code === "failed_kyc")) return "Inspect adapter check details and request corrected profile information where required.";
  if (reasons.some((reason) => reason.code === "open_complaints_weak_verification")) return "Review open complaints alongside profile and KYC signals.";
  if (reasons.some((reason) => reason.code === "missing_active_credential")) return "Confirm KYC and compliance readiness before issuing or reactivating a credential.";
  if (reasons.some((reason) => reason.code === "incomplete_profile")) return "Request missing profile fields before completing verification.";
  return "Review queue signals and route to the appropriate verification workflow.";
}

function dateInRange(value: string | null, from?: string, to?: string) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return !from && !to;
  if (from) {
    const fromTime = Date.parse(from);
    if (Number.isFinite(fromTime) && time < fromTime) return false;
  }
  if (to) {
    const toTime = Date.parse(`${to}T23:59:59.999`);
    if (Number.isFinite(toTime) && time > toTime) return false;
  }
  return true;
}

function searchHaystack(row: AdminVerificationQueueRow, raw: MsmeRow) {
  return [
    row.businessName,
    row.msmeId,
    row.ownerName,
    raw.cac_number,
    raw.tin,
    raw.contact_phone,
    raw.contact_email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function applyFilters(rows: Array<{ row: AdminVerificationQueueRow; raw: MsmeRow }>, filters: AdminVerificationFilters) {
  const q = asString(filters.q).toLowerCase();
  return rows.filter(({ row, raw }) => {
    if (q && !searchHaystack(row, raw).includes(q)) return false;
    if (filters.verificationStatus && row.verificationStatus !== filters.verificationStatus) return false;
    if (filters.reviewStatus && row.reviewStatus !== filters.reviewStatus) return false;
    if (filters.kycStatus && row.kyc.overall !== filters.kycStatus) return false;
    if (filters.digitalIdStatus && row.digitalCredentialStatus !== filters.digitalIdStatus) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.sector && row.sector !== filters.sector) return false;
    if (filters.attentionLevel && row.attentionLevel !== filters.attentionLevel) return false;
    if (filters.confidenceCategory && row.confidenceCategory !== filters.confidenceCategory) return false;
    if (filters.priority && row.queuePriority !== filters.priority) return false;
    if (filters.complaintLinked === "true" && !row.intelligence.indicators.complaintLinked) return false;
    if (filters.complaintLinked === "false" && row.intelligence.indicators.complaintLinked) return false;
    if (filters.duplicateSignal === "true" && !row.intelligence.indicators.duplicateSignal) return false;
    if (filters.duplicateSignal === "false" && row.intelligence.indicators.duplicateSignal) return false;
    if (filters.missingCredential === "true" && !row.intelligence.indicators.missingCredential) return false;
    if (filters.missingCredential === "false" && row.intelligence.indicators.missingCredential) return false;
    if (filters.staleReview === "true" && !row.intelligence.indicators.staleReview) return false;
    if (filters.staleReview === "false" && row.intelligence.indicators.staleReview) return false;
    if (filters.flagged === "true" && !row.flagged) return false;
    if (filters.flagged === "false" && row.flagged) return false;
    if (filters.suspended === "true" && !row.suspended) return false;
    if (filters.suspended === "false" && row.suspended) return false;
    if (!dateInRange(row.lastUpdatedAt, filters.updatedFrom, filters.updatedTo)) return false;
    return true;
  });
}

function priorityRank(value: VerificationQueuePriority) {
  return { Low: 1, Medium: 2, High: 3, Urgent: 4 }[value];
}

function attentionRank(value: VerificationAttentionLevel) {
  return { normal: 0, watch: 1, elevated: 2, critical: 3 }[value];
}

function applySort(rows: Array<{ row: AdminVerificationQueueRow; raw: MsmeRow }>, sort = "highest_priority") {
  return [...rows].sort((a, b) => {
    if (sort === "newest") return (Date.parse(b.row.intelligence.queueAging.queueDate ?? b.row.lastUpdatedAt ?? "") || 0) - (Date.parse(a.row.intelligence.queueAging.queueDate ?? a.row.lastUpdatedAt ?? "") || 0);
    if (sort === "oldest") return (Date.parse(a.row.intelligence.queueAging.queueDate ?? a.row.lastUpdatedAt ?? "") || 0) - (Date.parse(b.row.intelligence.queueAging.queueDate ?? b.row.lastUpdatedAt ?? "") || 0);
    if (sort === "attention_level") return attentionRank(b.row.attentionLevel) - attentionRank(a.row.attentionLevel) || priorityRank(b.row.queuePriority) - priorityRank(a.row.queuePriority);
    if (sort === "most_complaints") return (b.row.openComplaintCount ?? -1) - (a.row.openComplaintCount ?? -1) || (b.row.complaintCount ?? -1) - (a.row.complaintCount ?? -1);
    if (sort === "missing_credential_first") return Number(b.row.intelligence.indicators.missingCredential) - Number(a.row.intelligence.indicators.missingCredential) || priorityRank(b.row.queuePriority) - priorityRank(a.row.queuePriority);
    return priorityRank(b.row.queuePriority) - priorityRank(a.row.queuePriority) || attentionRank(b.row.attentionLevel) - attentionRank(a.row.attentionLevel) || (b.row.queueAgeDays ?? -1) - (a.row.queueAgeDays ?? -1);
  });
}

function buildKpis(rows: AdminVerificationQueueRow[]): AdminVerificationKpis {
  return {
    totalQueue: rows.length,
    pendingReview: rows.filter((row) => REVIEW_QUEUE_STATUSES.has(row.reviewStatus)).length,
    failedChecks: rows.filter((row) => row.kyc.overall === "failed" || (row.complianceFailedCount ?? 0) > 0).length,
    missingCredentials: rows.filter((row) => row.digitalCredentialStatus !== "active").length,
    flaggedOrSuspended: rows.filter((row) => row.flagged || row.suspended).length,
  };
}

function buildReviewerWorkload(rows: Array<Record<string, unknown>>, available: boolean, currentUserId?: string | null): AdminVerificationReviewerWorkload {
  if (!available) {
    return {
      available: false,
      assignedToMe: null,
      unassigned: null,
      underReview: null,
      awaitingDocuments: null,
      escalated: null,
      averageReviewAgeDays: null,
      message: "Verification review source unavailable",
    };
  }

  const openRows = rows.filter((row) => REVIEW_QUEUE_STATUSES.has(normalizeReviewStatus(row.status, "pending_review")));
  const ages = openRows.map((row) => ageDays(asString(row.created_at) || asString(row.updated_at) || null)).filter((value): value is number => value !== null);
  return {
    available: true,
    assignedToMe: currentUserId ? openRows.filter((row) => asString(row.assigned_reviewer_id) === currentUserId).length : null,
    unassigned: openRows.filter((row) => !asString(row.assigned_reviewer_id)).length,
    underReview: openRows.filter((row) => normalizeReviewStatus(row.status, "pending_review") === "under_review").length,
    awaitingDocuments: openRows.filter((row) => normalizeReviewStatus(row.status, "pending_review") === "awaiting_documents").length,
    escalated: openRows.filter((row) => normalizeReviewStatus(row.status, "pending_review") === "escalated").length,
    averageReviewAgeDays: ages.length ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length) : null,
    message: currentUserId ? null : "Current reviewer assignment unavailable",
  };
}

export function adminVerificationFiltersForDiagnostics(filters: AdminVerificationFilters) {
  return {
    hasSearch: Boolean(asString(filters.q)) ? "true" : "false",
    verificationStatus: filters.verificationStatus ?? null,
    reviewStatus: filters.reviewStatus ?? null,
    kycStatus: filters.kycStatus ?? null,
    digitalIdStatus: filters.digitalIdStatus ?? null,
    state: filters.state ?? null,
    sector: filters.sector ?? null,
    attentionLevel: filters.attentionLevel ?? null,
    confidenceCategory: filters.confidenceCategory ?? null,
    priority: filters.priority ?? null,
    complaintLinked: filters.complaintLinked ?? null,
    duplicateSignal: filters.duplicateSignal ?? null,
    missingCredential: filters.missingCredential ?? null,
    staleReview: filters.staleReview ?? null,
    sort: filters.sort ?? null,
    flagged: filters.flagged ?? null,
    suspended: filters.suspended ?? null,
    updatedFrom: filters.updatedFrom ?? null,
    updatedTo: filters.updatedTo ?? null,
    page: filters.page ?? null,
    pageSize: filters.pageSize ?? null,
    exportAll: filters.exportAll ? "true" : null,
  };
}

export async function loadAdminVerificationQueue(
  supabase: SupabaseClient<any>,
  inputFilters: AdminVerificationFilters,
  currentUserId?: string | null,
): Promise<AdminVerificationQueueResult> {
  const filters = normalizeAdminVerificationFilters(inputFilters);
  const sources = Object.fromEntries(
    (Object.keys(TABLE_COLUMNS) as AdminVerificationSourceName[]).map((source) => [source, { available: false, message: "Not loaded" }]),
  ) as Record<AdminVerificationSourceName, AdminVerificationSourceState>;

  const [
    msmesResult,
    validationResult,
    legacyComplianceResult,
    credentialsResult,
    complianceProfilesResult,
    complianceItemsResult,
    reviewsResult,
    complaintsResult,
    activityLogsResult,
  ] = await Promise.all([
    readOptionalTable<MsmeRow>(supabase, "msmes", TABLE_COLUMNS.msmes),
    readOptionalTable<Record<string, unknown>>(supabase, "validation_results", TABLE_COLUMNS.validation_results),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_profiles", TABLE_COLUMNS.compliance_profiles),
    readOptionalTable<Record<string, unknown>>(supabase, "digital_identity_credentials", TABLE_COLUMNS.digital_identity_credentials),
    readOptionalTable<Record<string, unknown>>(supabase, "msme_compliance_profiles", TABLE_COLUMNS.msme_compliance_profiles),
    readOptionalTable<Record<string, unknown>>(supabase, "msme_compliance_items", TABLE_COLUMNS.msme_compliance_items),
    readOptionalTable<Record<string, unknown>>(supabase, "verification_reviews", TABLE_COLUMNS.verification_reviews),
    readOptionalTable<Record<string, unknown>>(supabase, "complaints", TABLE_COLUMNS.complaints),
    readOptionalTable<Record<string, unknown>>(supabase, "activity_logs", TABLE_COLUMNS.activity_logs),
  ]);

  sources.msmes = msmesResult.source;
  sources.validation_results = validationResult.source;
  sources.compliance_profiles = legacyComplianceResult.source;
  sources.digital_identity_credentials = credentialsResult.source;
  sources.msme_compliance_profiles = complianceProfilesResult.source;
  sources.msme_compliance_items = complianceItemsResult.source;
  sources.verification_reviews = reviewsResult.source;
  sources.complaints = complaintsResult.source;
  sources.activity_logs = activityLogsResult.source;

  const validationByMsme = latestByMsme(validationResult.rows, ["updated_at", "validated_at"]);
  const legacyComplianceByMsme = latestByMsme(legacyComplianceResult.rows, ["last_reviewed_at"]);
  const credentialsByMsme = latestByMsme(credentialsResult.rows, ["updated_at", "approved_at", "issued_at", "created_at"]);
  const complianceByMsme = latestByMsme(complianceProfilesResult.rows, ["updated_at"]);
  const complianceItemStats = buildComplianceItemStats(complianceItemsResult.rows);
  const reviewByMsme = latestByMsme(reviewsResult.rows, ["updated_at", "created_at"]);
  const reviewStats = buildReviewStats(reviewsResult.rows);
  const complaintCounts = buildComplaintCounts(complaintsResult.rows);
  const duplicateIndex = buildDuplicateIndex(msmesResult.rows);
  const activityByMsme = buildActivityByMsme(activityLogsResult.rows);

  const decorated = msmesResult.rows
    .filter((raw) => asString(raw.id))
    .map((raw) => {
      const id = asString(raw.id);
      const validation = validationByMsme.get(id);
      const legacyCompliance = legacyComplianceByMsme.get(id);
      const credential = credentialsByMsme.get(id);
      const compliance = complianceByMsme.get(id);
      const complianceItems = complianceItemStats.get(id);
      const review = reviewByMsme.get(id);
      const reviews = reviewStats.get(id);
      const complaints = complaintCounts.get(id);
      const duplicateSignals = duplicateIndex.labelsById.get(id) ?? [];
      const latestActivity = activityByMsme.get(id);
      const verificationStatus = normalizeStatus(raw.verification_status, "pending");
      const reviewStatus = sources.verification_reviews.available
        ? normalizeReviewStatus(review?.status, "pending_review")
        : normalizeReviewStatus(raw.review_status, verificationStatus === "verified" ? "verified" : "pending_review");
      const complianceStatus = normalizeStatus(asString(compliance?.overall_status ?? legacyCompliance?.overall_status), "") || null;
      const digitalCredentialStatus = sources.digital_identity_credentials.available
        ? normalizeStatus(asString(credential?.status), "missing")
        : "unavailable";
      const kyc = summarizeKyc(validation, legacyCompliance, sources.validation_results.available || sources.compliance_profiles.available);
      const profileScore = profileCompletenessScore(raw);
      const missingFields = missingProfileFields(raw);
      const coreChecks = coreCheckBreakdown(kyc);
      const lastUpdatedAt = [
        asString(raw.updated_at) || asString(raw.created_at) || null,
        asString(validation?.updated_at) || asString(validation?.validated_at) || null,
        asString(credential?.updated_at) || asString(credential?.issued_at) || null,
        asString(compliance?.updated_at) || asString(legacyCompliance?.last_reviewed_at) || null,
        complianceItems?.latestAt ?? null,
        asString(review?.updated_at) || asString(review?.created_at) || null,
        complaints?.latestAt ?? null,
        asString(latestActivity?.created_at) || null,
      ].reduce<string | null>((latest, value) => maxDate(latest, value), null);

      const reasons: QueueReason[] = [];
      const createdAt = asString(raw.created_at) || null;
      const verificationDate = asString(raw.updated_at) || createdAt;
      const reviewDate = asString(review?.updated_at) || asString(review?.created_at) || verificationDate;
      const queueDate = asString(review?.created_at) || (REVIEW_QUEUE_STATUSES.has(reviewStatus) ? createdAt : null);
      if (REVIEW_QUEUE_STATUSES.has(reviewStatus)) reasons.push({ code: "review_queue_status", label: `Review status is ${reviewStatus.replaceAll("_", " ")}`, source: sources.verification_reviews.available ? "verification_reviews" : "msmes", severity: "watch", detectedAt: reviewDate });
      if (!VERIFIED_STATUSES.has(verificationStatus)) reasons.push({ code: "unverified_status", label: `Verification status is ${verificationStatus.replaceAll("_", " ")}`, source: "msmes", severity: "watch", detectedAt: verificationDate });
      if (complianceStatus && !VERIFIED_STATUSES.has(complianceStatus)) reasons.push({ code: "compliance_not_verified", label: `Compliance profile is ${complianceStatus.replaceAll("_", " ")}`, source: sources.msme_compliance_profiles.available ? "msme_compliance_profiles" : "compliance_profiles", severity: ["rejected", "expired", "suspended", "revoked", "failed"].includes(complianceStatus) ? "elevated" : "watch", detectedAt: asString(compliance?.updated_at) || asString(legacyCompliance?.last_reviewed_at) || createdAt });
      if (kyc.overall === "failed") reasons.push({ code: "failed_kyc", label: "One or more KYC adapter checks failed", source: sources.validation_results.available ? "validation_results" : "compliance_profiles", severity: "elevated", detectedAt: asString(validation?.validated_at) || asString(legacyCompliance?.last_reviewed_at) || createdAt });
      if (kyc.overall === "pending" || kyc.overall === "incomplete") reasons.push({ code: "pending_kyc", label: "KYC adapter checks are pending or incomplete", source: sources.validation_results.available ? "validation_results" : "compliance_profiles", severity: "watch", detectedAt: asString(validation?.validated_at) || createdAt });
      if (sources.digital_identity_credentials.available && digitalCredentialStatus !== "active") reasons.push({ code: "missing_active_credential", label: digitalCredentialStatus === "missing" ? "No active digital credential" : `Digital credential is ${digitalCredentialStatus}`, source: "digital_identity_credentials", severity: ["suspended", "revoked"].includes(digitalCredentialStatus) ? "critical" : "watch", detectedAt: asString(credential?.updated_at) || asString(credential?.created_at) || createdAt });
      if ((complianceItems?.failed ?? 0) > 0) reasons.push({ code: "failed_compliance_items", label: `${complianceItems?.failed} failed compliance item(s)`, source: "msme_compliance_items", severity: "elevated", detectedAt: complianceItems?.oldestAttentionAt ?? createdAt });
      if ((complianceItems?.pending ?? 0) > 0) reasons.push({ code: "pending_compliance_items", label: `${complianceItems?.pending} pending compliance item(s)`, source: "msme_compliance_items", severity: "watch", detectedAt: complianceItems?.oldestAttentionAt ?? createdAt });
      if (Boolean(raw.flagged)) reasons.push({ code: "flagged_msme", label: "MSME is flagged", source: "msmes", severity: "elevated", detectedAt: verificationDate });
      if (Boolean(raw.suspended)) reasons.push({ code: "suspended_msme", label: "MSME is suspended", source: "msmes", severity: "critical", detectedAt: verificationDate });
      if ((complaints?.open ?? 0) > 0 && (!VERIFIED_STATUSES.has(verificationStatus) || kyc.overall !== "verified")) reasons.push({ code: "open_complaints_weak_verification", label: `${complaints?.open} open complaint(s) with weak verification`, source: "complaints", severity: "elevated", detectedAt: complaints?.latestAt ?? createdAt });
      if ((complaints?.highSeverityOpen ?? 0) > 0) reasons.push({ code: "high_severity_complaints", label: `${complaints?.highSeverityOpen} high-severity open complaint(s)`, source: "complaints", severity: "critical", detectedAt: complaints?.latestAt ?? createdAt });
      if (duplicateSignals.length) reasons.push({ code: "duplicate_signals", label: duplicateSignals.slice(0, 3).join(", "), source: "verification_rules", severity: duplicateIndex.strongById.has(id) ? "critical" : "elevated", detectedAt: createdAt });
      if ((reviews?.rejected ?? 0) >= 2) reasons.push({ code: "repeated_rejected_reviews", label: `${reviews?.rejected} rejected verification review(s)`, source: "verification_reviews", severity: "critical", detectedAt: reviews?.latestAt ?? createdAt });
      if (queueDate && (ageDays(queueDate) ?? 0) >= 15) reasons.push({ code: "stale_pending_review", label: `Review has been queued for ${ageDays(queueDate)} days`, source: sources.verification_reviews.available ? "verification_reviews" : "msmes", severity: "elevated", detectedAt: queueDate });
      if (profileScore < 80) reasons.push({ code: "incomplete_profile", label: `Profile completeness is ${profileScore}%`, source: "msmes", severity: "watch", detectedAt: createdAt });

      const intelligence = buildVerificationIntelligence({
        flagged: Boolean(raw.flagged),
        suspended: Boolean(raw.suspended),
        kycOverall: kyc.overall,
        failedCoreChecks: coreChecks.failed,
        pendingCoreChecks: coreChecks.pending,
        credentialStatus: digitalCredentialStatus,
        hasActiveCredential: digitalCredentialStatus === "active",
        openComplaints: sources.complaints.available ? complaints?.open ?? 0 : null,
        highSeverityComplaints: sources.complaints.available ? complaints?.highSeverityOpen ?? 0 : null,
        duplicateSignals,
        strongDuplicateSignals: duplicateIndex.strongById.has(id),
        profileCompleteness: profileScore,
        missingProfileFields: missingFields,
        complianceStatus,
        complianceFailedCount: sources.msme_compliance_items.available ? complianceItems?.failed ?? 0 : null,
        compliancePendingCount: sources.msme_compliance_items.available ? complianceItems?.pending ?? 0 : null,
        repeatedRejectedReviews: reviews?.rejected ?? 0,
        reviewStatus,
        queueDate,
      });

      const oldestPendingAt = queueDate ?? reasons.reduce<string | null>((oldest, reason) => minDate(oldest, reason.detectedAt), null);
      if (!reasons.length) return null;

      const row: AdminVerificationQueueRow = {
        id,
        businessName: asString(raw.business_name) || "Unnamed MSME",
        msmeId: asString(raw.msme_id) || "Unassigned MSME ID",
        ownerName: asString(raw.owner_name) || "Owner unavailable",
        state: asString(raw.state) || null,
        lga: asString(raw.lga) || null,
        sector: asString(raw.sector) || null,
        verificationStatus,
        reviewStatus,
        kyc,
        digitalCredentialStatus,
        digitalCredentialId: asString(credential?.ndmii_id) || null,
        complaintCount: sources.complaints.available ? complaints?.total ?? 0 : null,
        openComplaintCount: sources.complaints.available ? complaints?.open ?? 0 : null,
        highSeverityComplaintCount: sources.complaints.available ? complaints?.highSeverityOpen ?? 0 : null,
        attentionLevel: intelligence.attentionLevel === "normal" ? attentionFromReasons(reasons) : intelligence.attentionLevel,
        confidenceCategory: intelligence.confidenceCategory,
        queuePriority: intelligence.queuePriority,
        intelligence,
        oldestPendingAt,
        oldestPendingAgeDays: ageDays(oldestPendingAt),
        queueAgeDays: intelligence.queueAging.ageDays,
        agingBucket: intelligence.queueAging.bucket,
        overdue: intelligence.queueAging.overdue,
        lastUpdatedAt: lastUpdatedAt ?? createdAt,
        flagged: Boolean(raw.flagged),
        suspended: Boolean(raw.suspended),
        cacMasked: maskTrailing(raw.cac_number),
        tinMasked: maskTrailing(raw.tin),
        phoneMasked: maskTrailing(raw.contact_phone),
        emailMasked: maskEmail(raw.contact_email),
        complianceStatus,
        complianceScore: Number.isFinite(Number(compliance?.compliance_score ?? legacyCompliance?.score)) ? Number(compliance?.compliance_score ?? legacyCompliance?.score) : null,
        complianceRiskLevel: asString(compliance?.risk_level ?? legacyCompliance?.risk_level) || null,
        complianceFailedCount: sources.msme_compliance_items.available ? complianceItems?.failed ?? 0 : null,
        compliancePendingCount: sources.msme_compliance_items.available ? complianceItems?.pending ?? 0 : null,
        reasons,
        riskSignals: intelligence.signals.map((signal) => signal.label),
        duplicateSignals,
        suggestedNextAction: suggestedNextAction(reasons),
        latestActivity: asString(latestActivity?.action) || null,
        latestActivityAt: asString(latestActivity?.created_at) || null,
      };
      return { row, raw };
    })
    .filter((item): item is { row: AdminVerificationQueueRow; raw: MsmeRow } => Boolean(item));

  const filtered = applySort(applyFilters(decorated, filters), filters.sort);
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const rows = filters.exportAll ? filtered.map(({ row }) => row) : filtered.slice(start, start + filters.pageSize).map(({ row }) => row);
  const selectedRow = filters.selectedId ? decorated.find(({ row }) => row.id === filters.selectedId)?.row ?? null : rows[0] ?? null;
  const allQueueRows = decorated.map(({ row }) => row);
  const reviewerWorkload = buildReviewerWorkload(reviewsResult.rows, sources.verification_reviews.available, currentUserId);

  return {
    rows,
    selectedRow,
    totalRows,
    page,
    pageSize: filters.pageSize,
    totalPages,
    kpis: buildKpis(allQueueRows),
    options: {
      states: uniqueSorted(allQueueRows.map((row) => row.state)),
      sectors: uniqueSorted(allQueueRows.map((row) => row.sector)),
      verificationStatuses: uniqueSorted(allQueueRows.map((row) => row.verificationStatus)),
      reviewStatuses: uniqueSorted(allQueueRows.map((row) => row.reviewStatus)),
      kycStatuses: uniqueSorted(allQueueRows.map((row) => row.kyc.overall)),
      digitalIdStatuses: uniqueSorted(allQueueRows.map((row) => row.digitalCredentialStatus)),
      attentionLevels: uniqueSorted(allQueueRows.map((row) => row.attentionLevel)),
      confidenceCategories: uniqueSorted(allQueueRows.map((row) => row.confidenceCategory)),
      priorities: uniqueSorted(allQueueRows.map((row) => row.queuePriority)),
      sortOptions: [
        { value: "newest", label: "Newest" },
        { value: "oldest", label: "Oldest" },
        { value: "highest_priority", label: "Highest priority" },
        { value: "attention_level", label: "Attention level" },
        { value: "most_complaints", label: "Most complaints" },
        { value: "missing_credential_first", label: "Missing credential first" },
      ],
    },
    reviewerWorkload,
    sources,
    diagnostics: {
      operation: "load_admin_verification_queue",
      filtersUsed: adminVerificationFiltersForDiagnostics(filters),
      rowCount: rows.length,
      supabaseErrorCode: null,
      supabaseErrorMessage: null,
    },
  };
}

export function buildAdminVerificationQueueCsv(rows: AdminVerificationQueueRow[]) {
  const header = [
    "Business Name",
    "MSME ID / BIN",
    "Owner Name",
    "State",
    "LGA",
    "Sector",
    "Verification Status",
    "Review Status",
    "NIN Status",
    "BVN Status",
    "CAC Status",
    "TIN Status",
    "Digital Credential Status",
    "Complaint Count",
    "Open Complaints",
    "High Severity Open Complaints",
    "Confidence Category",
    "Attention Level",
    "Queue Priority",
    "Queue Age Days",
    "Aging Bucket",
    "Overdue",
    "Last Updated",
    "Flagged",
    "Suspended",
    "Masked CAC",
    "Masked TIN",
    "Masked Phone",
    "Masked Email",
    "Risk Signals",
    "Duplicate Signals",
    "Queue Reasons",
    "Suggested Next Action",
  ];

  return [
    header.map(csvValue).join(","),
    ...rows.map((row) => [
      row.businessName,
      row.msmeId,
      row.ownerName,
      row.state,
      row.lga,
      row.sector,
      row.verificationStatus,
      row.reviewStatus,
      row.kyc.nin ?? "Unavailable",
      row.kyc.bvn ?? "Unavailable",
      row.kyc.cac ?? "Unavailable",
      row.kyc.tin ?? "Unavailable",
      row.digitalCredentialStatus,
      row.complaintCount ?? "Unavailable",
      row.openComplaintCount ?? "Unavailable",
      row.highSeverityComplaintCount ?? "Unavailable",
      row.confidenceCategory,
      row.attentionLevel,
      row.queuePriority,
      row.queueAgeDays ?? "Unavailable",
      row.agingBucket,
      row.overdue ? "Yes" : "No",
      row.lastUpdatedAt,
      row.flagged ? "Yes" : "No",
      row.suspended ? "Yes" : "No",
      row.cacMasked ?? "",
      row.tinMasked ?? "",
      row.phoneMasked ?? "",
      row.emailMasked ?? "",
      row.riskSignals.join("; "),
      row.duplicateSignals.join("; "),
      row.reasons.map((reason) => reason.label).join("; "),
      row.suggestedNextAction,
    ].map(csvValue).join(",")),
  ].join("\r\n");
}
