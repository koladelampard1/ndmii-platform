import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDigitalIdLifecycleStatus } from "@/lib/data/admin-digital-id-lifecycle";
import { csvValue } from "@/lib/data/admin-msme-registry";

export type AdminDigitalIdFilters = {
  q?: string;
  credentialStatus?: string;
  lifecycleState?: string;
  msmeReviewStatus?: string;
  verificationReviewStatus?: string;
  tokenReadiness?: string;
  signatureReadiness?: string;
  qrReadiness?: string;
  expiryState?: string;
  attentionLevel?: string;
  operationalFilter?: string;
  assignmentFilter?: string;
  slaState?: string;
  publicVerificationPosture?: string;
  trustPosture?: string;
  state?: string;
  sector?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  selectedId?: string;
  exportAll?: boolean;
};

export type AdminDigitalIdSourceName =
  | "digital_identity_credentials"
  | "credential_events"
  | "msmes"
  | "verification_reviews"
  | "validation_results"
  | "compliance_profiles"
  | "msme_compliance_profiles"
  | "complaints"
  | "activity_logs"
  | "users";

export type AdminDigitalIdSourceState = {
  available: boolean;
  message?: string | null;
};

export type AdminDigitalIdEvent = {
  id: string;
  action: string;
  actorRole: string | null;
  createdAt: string | null;
  summary: string;
};

export type AdminDigitalIdAttentionSignal = {
  code: string;
  label: string;
  severity: "watch" | "elevated" | "critical";
};

export type AdminDigitalIdSlaState = "On Track" | "Approaching SLA" | "Breached" | "Unassigned" | "Paused";

export type AdminDigitalIdSlaPosture = {
  category: string;
  state: AdminDigitalIdSlaState;
  startedAt: string | null;
  dueAt: string | null;
  elapsedHours: number | null;
  limitHours: number | null;
  remainingHours: number | null;
  explanation: string;
};

export type AdminDigitalIdAssignment = {
  assignedReviewerId: string | null;
  assignedAdminId: string | null;
  assignedReviewerName: string | null;
  assignedAdminName: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  assignedByName: string | null;
  reassignedCount: number;
  lastReassignmentAt: string | null;
  inactivityHours: number | null;
  isAssignedToCurrentUser: boolean;
  isUnassigned: boolean;
};

export type AdminDigitalIdAnomalySignal = {
  code: string;
  label: string;
  explanation: string;
  severity: "watch" | "elevated" | "critical";
};

export type AdminDigitalIdQueueRow = {
  id: string;
  credentialId: string;
  businessName: string;
  msmeRowId: string | null;
  msmeId: string;
  ndmiiId: string;
  ownerName: string;
  state: string | null;
  sector: string | null;
  credentialStatus: string;
  msmeReviewStatus: string;
  msmeVerificationStatus: string;
  verificationReviewStatus: string;
  lifecycleState: string;
  issuedAt: string | null;
  approvedAt: string | null;
  expiryAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  revokedAt: string | null;
  suspendedAt: string | null;
  tokenReadiness: "ready" | "missing" | "unavailable";
  signatureReadiness: "ready" | "missing" | "unavailable";
  qrReadiness: "absolute" | "relative" | "missing" | "unavailable";
  publicVerificationReadiness: "likely_valid" | "likely_invalid" | "unavailable";
  publicVerificationPosture: "healthy" | "warning" | "invalid" | "publicly_disabled";
  publicVerificationReason: string;
  publicRouteAvailable: boolean;
  routeDuplicateCount: number;
  expiryState: "valid" | "expiring_soon" | "expired" | "missing" | "unavailable";
  expiryPosture: "valid" | "expiring_7_days" | "expiring_30_days" | "expired" | "overdue_renewal" | "expired_active" | "missing" | "unavailable";
  daysUntilExpiry: number | null;
  renewalPendingDays: number | null;
  latestCredentialEvent: string | null;
  latestCredentialEventAt: string | null;
  eventPreview: AdminDigitalIdEvent[];
  eventTimeline: AdminDigitalIdEvent[];
  attentionLevel: "normal" | "watch" | "elevated" | "critical";
  attentionSignals: AdminDigitalIdAttentionSignal[];
  complianceStatus: string | null;
  complianceScore: number | null;
  complaintCount: number | null;
  openComplaintCount: number | null;
  cacMasked: string | null;
  tinMasked: string | null;
  recommendedFocus: string;
  regenerationCount: number;
  lastRegeneratedAt: string | null;
  tokenInvalidatedAt: string | null;
  lifecycleVersion: number;
  trustPosture: "trusted" | "watch" | "restricted" | "revoked_trust";
  trustReasons: string[];
  qrRouteSignals: AdminDigitalIdAttentionSignal[];
  sla: AdminDigitalIdSlaPosture;
  assignment: AdminDigitalIdAssignment;
  anomalySignals: AdminDigitalIdAnomalySignal[];
  lifecycleChangeCount: number;
  currentLifecycleStartedAt: string | null;
  currentLifecycleAgeHours: number | null;
  attentionScore: number;
};

export type AdminDigitalIdKpis = {
  totalCredentials: number;
  pendingCredentials: number;
  activeCredentials: number;
  suspendedCredentials: number;
  revokedCredentials: number;
  expiredCredentials: number;
  renewalPending: number;
  slaBreaches: number;
  unassignedCredentials: number;
  overdueRenewals: number;
  expiringIn7Days: number;
  expiringIn30Days: number;
  regenerationSpikes: number;
  missingValidSignatureOrTokenHash: number;
  publicVerificationIssues: number;
};

export type AdminDigitalIdQueueInsight = {
  label: string;
  value: string;
  detail: string;
  credentialId?: string | null;
};

export type AdminDigitalIdReviewerAnalytics = {
  reviewerId: string;
  reviewerName: string;
  role: string;
  assignedWorkload: number;
  completedActions: number;
  averageResolutionHours: number | null;
  slaBreachCount: number;
  pendingQueueAgeHours: number | null;
  credentialsUnderReview: number;
  renewalsProcessed: number;
  suspensionsHandled: number;
  revocationsHandled: number;
};

export type AdminDigitalIdQueueResult = {
  rows: AdminDigitalIdQueueRow[];
  selectedRow: AdminDigitalIdQueueRow | null;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: AdminDigitalIdKpis;
  lifecycleSummary: Array<{ label: string; value: number }>;
  queueInsights: AdminDigitalIdQueueInsight[];
  reviewerAnalytics: AdminDigitalIdReviewerAnalytics[];
  slaSummary: Array<{ label: AdminDigitalIdSlaState; value: number }>;
  options: {
    credentialStatuses: string[];
    lifecycleStates: string[];
    msmeReviewStatuses: string[];
    verificationReviewStatuses: string[];
    tokenReadiness: string[];
    signatureReadiness: string[];
    qrReadiness: string[];
    expiryStates: string[];
    attentionLevels: string[];
    slaStates: string[];
    assignmentFilters: Array<{ value: string; label: string }>;
    operationalFilters: Array<{ value: string; label: string }>;
    publicVerificationPostures: string[];
    trustPostures: string[];
    states: string[];
    sectors: string[];
    sortOptions: Array<{ value: string; label: string }>;
  };
  sources: Record<AdminDigitalIdSourceName, AdminDigitalIdSourceState>;
};

type TableReadResult<T> = {
  rows: T[];
  source: AdminDigitalIdSourceState;
};

type Row = Record<string, unknown>;
type AdminDigitalIdQueueViewer = { currentUserId?: string | null };

const READ_LIMIT = 5000;
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = new Set([25, 50, 100]);
const PENDING_AGE_THRESHOLD_DAYS = 14;
const EXPIRING_SOON_DAYS = 30;
const CLOSED_COMPLAINT_STATUSES = new Set(["resolved", "closed", "dismissed"]);
const SLA_RULES_HOURS = {
  pending_activation: 48,
  renewal_approval: 72,
  suspended_review: 24,
  revocation_review: 24,
  public_verification_issue: 12,
  unassigned_credential: 8,
  regeneration_anomaly_review: 24,
} as const;
const SLA_APPROACHING_RATIO = 0.75;

const TABLE_COLUMNS: Record<AdminDigitalIdSourceName, string[]> = {
  digital_identity_credentials: [
    "id",
    "msme_id",
    "ndmii_id",
    "status",
    "issued_at",
    "approved_at",
    "revoked_at",
    "suspended_at",
    "token_expires_at",
    "qr_code_ref",
    "public_token_hash",
    "public_signature",
    "signature_version",
    "lifecycle_version",
    "assigned_reviewer_id",
    "assigned_admin_id",
    "assigned_at",
    "assigned_by",
    "reassigned_count",
    "last_reassignment_at",
    "renewal_requested_at",
    "regeneration_count",
    "last_regenerated_at",
    "token_invalidated_at",
    "created_at",
    "updated_at",
  ],
  credential_events: ["id", "credential_id", "action", "actor_role", "metadata", "created_at"],
  msmes: [
    "id",
    "msme_id",
    "business_name",
    "owner_name",
    "state",
    "sector",
    "review_status",
    "verification_status",
    "cac_number",
    "tin",
    "suspended",
    "created_at",
    "updated_at",
  ],
  verification_reviews: ["id", "msme_id", "status", "created_at", "updated_at"],
  validation_results: ["msme_id", "cac_status", "tin_status", "validated_at", "updated_at"],
  compliance_profiles: ["msme_id", "overall_status", "score", "risk_level", "last_reviewed_at"],
  msme_compliance_profiles: ["msme_id", "overall_status", "compliance_score", "risk_level", "updated_at"],
  complaints: ["id", "msme_id", "provider_msme_id", "status", "severity", "priority", "created_at", "updated_at"],
  activity_logs: ["id", "action", "entity_type", "entity_id", "metadata", "created_at"],
  users: ["id", "full_name", "email", "role"],
};

const REQUIRED_TABLE_COLUMNS: Record<AdminDigitalIdSourceName, string[]> = {
  digital_identity_credentials: ["id", "msme_id", "ndmii_id", "status", "created_at"],
  credential_events: ["id", "credential_id", "action", "created_at"],
  msmes: ["id", "msme_id", "business_name", "review_status", "verification_status"],
  verification_reviews: ["id", "msme_id", "status", "created_at", "updated_at"],
  validation_results: ["msme_id", "cac_status", "tin_status"],
  compliance_profiles: ["msme_id", "overall_status"],
  msme_compliance_profiles: ["msme_id", "overall_status"],
  complaints: ["id", "msme_id", "status"],
  activity_logs: ["id", "action", "entity_type", "entity_id", "created_at"],
  users: ["id", "role"],
};

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown, fallback = "unavailable") {
  const normalized = asString(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function normalizePage(value: unknown) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizePageSize(value: unknown) {
  const parsed = Number(value ?? DEFAULT_PAGE_SIZE);
  return PAGE_SIZES.has(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

export function normalizeAdminDigitalIdFilters(input: AdminDigitalIdFilters): Required<Pick<AdminDigitalIdFilters, "page" | "pageSize">> & AdminDigitalIdFilters {
  return {
    ...input,
    page: normalizePage(input.page),
    pageSize: normalizePageSize(input.pageSize),
  };
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => asString(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sourceUnavailable(error: { message?: string | null } | null): AdminDigitalIdSourceState {
  return { available: false, message: error?.message ?? "Source unavailable" };
}

async function readOptionalTable<T extends Row>(
  supabase: SupabaseClient<any>,
  table: AdminDigitalIdSourceName,
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
        console.info("[admin-digital-ids]", {
          operation: "source_read_schema_fallback",
          source: table,
          rowCount: rows.length,
          supabaseErrorCode: error.code ?? null,
          supabaseErrorMessage: error.message ?? null,
        });
        return { rows, source: { available: true, message: `Loaded with reduced columns after schema fallback: ${error.message}` } };
      }
    }

    console.info("[admin-digital-ids]", {
      operation: "source_read",
      source: table,
      rowCount: 0,
      supabaseErrorCode: error.code ?? null,
      supabaseErrorMessage: error.message ?? null,
    });
    return { rows: [], source: sourceUnavailable(error) };
  }

  const rows = ((data ?? []) as unknown as T[]).filter(Boolean);
  console.info("[admin-digital-ids]", {
    operation: "source_read",
    source: table,
    rowCount: rows.length,
    supabaseErrorCode: null,
    supabaseErrorMessage: null,
  });
  return { rows, source: { available: true, message: null } };
}

function latestByKey<T extends Row>(rows: T[], key: string, dateColumns: string[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = asString(row[key]);
    if (!id) continue;
    const existing = map.get(id);
    const currentTime = latestTime(row, dateColumns);
    const existingTime = existing ? latestTime(existing, dateColumns) : -1;
    if (!existing || currentTime >= existingTime) map.set(id, row);
  }
  return map;
}

function latestTime(row: Row, columns: string[]) {
  return Math.max(0, ...columns.map((column) => Date.parse(asString(row[column])) || 0));
}

function buildEventsByCredential(rows: Row[]) {
  const map = new Map<string, AdminDigitalIdEvent[]>();
  for (const row of rows) {
    const credentialId = asString(row.credential_id);
    if (!credentialId) continue;
    const action = normalizeStatus(row.action, "event");
    const event: AdminDigitalIdEvent = {
      id: asString(row.id) || `${credentialId}-${action}-${asString(row.created_at)}`,
      action,
      actorRole: asString(row.actor_role) || null,
      createdAt: asString(row.created_at) || null,
      summary: action.replaceAll("_", " "),
    };
    map.set(credentialId, [...(map.get(credentialId) ?? []), event]);
  }
  for (const [credentialId, events] of map.entries()) {
    map.set(
      credentialId,
      [...events].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0)),
    );
  }
  return map;
}

function buildComplaintCounts(rows: Row[]) {
  const counts = new Map<string, { total: number; open: number; latestAt: string | null }>();
  for (const row of rows) {
    const ids = [asString(row.msme_id), asString(row.provider_msme_id)].filter(Boolean);
    const status = normalizeStatus(row.status, "submitted");
    const date = asString(row.updated_at) || asString(row.created_at) || null;
    for (const id of new Set(ids)) {
      const current = counts.get(id) ?? { total: 0, open: 0, latestAt: null };
      current.total += 1;
      if (!CLOSED_COMPLAINT_STATUSES.has(status)) current.open += 1;
      current.latestAt = maxDate(current.latestAt, date);
      counts.set(id, current);
    }
  }
  return counts;
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function buildActivitySignalsByCredential(rows: Row[]) {
  const map = new Map<string, { regenerationCount: number; latestAction: string | null; latestAt: string | null }>();
  for (const row of rows) {
    const action = normalizeStatus(row.action, "");
    const entityType = normalizeStatus(row.entity_type, "");
    const metadata = metadataObject(row.metadata);
    const credentialId = asString(row.entity_id) || asString(metadata.credentialId) || asString(metadata.credential_id);
    if (!credentialId) continue;
    if (entityType && !["credential", "digital_identity_credential", "digital_identity_credentials"].includes(entityType) && !action.includes("credential")) continue;
    const current = map.get(credentialId) ?? { regenerationCount: 0, latestAction: null, latestAt: null };
    if (action.includes("reissue") || action.includes("regenerate")) current.regenerationCount += 1;
    const createdAt = asString(row.created_at) || null;
    if (!current.latestAt || (Date.parse(createdAt ?? "") || 0) > (Date.parse(current.latestAt) || 0)) {
      current.latestAt = createdAt;
      current.latestAction = action || null;
    }
    map.set(credentialId, current);
  }
  return map;
}

function buildUserLookup(rows: Row[]) {
  const users = new Map<string, { name: string; role: string }>();
  for (const row of rows) {
    const id = asString(row.id);
    if (!id) continue;
    users.set(id, {
      name: asString(row.full_name) || maskEmail(row.email) || "Unnamed user",
      role: asString(row.role) || "reviewer",
    });
  }
  return users;
}

function maxDate(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return (Date.parse(right) || 0) > (Date.parse(left) || 0) ? right : left;
}

function ageDays(value: string | null) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function ageHours(value: string | null) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 3_600_000));
}

function addHours(value: string | null, hours: number | null) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time) || hours === null) return null;
  return new Date(time + hours * 3_600_000).toISOString();
}

function safeRatio(elapsed: number | null, limit: number | null) {
  if (elapsed === null || limit === null || limit <= 0) return null;
  return elapsed / limit;
}

function maskTrailing(value: unknown, visible = 4) {
  const normalized = asString(value);
  if (!normalized) return null;
  if (normalized.length <= visible) return "*".repeat(normalized.length);
  return `${"*".repeat(Math.max(3, normalized.length - visible))}${normalized.slice(-visible)}`;
}

function maskEmail(value: unknown) {
  const normalized = asString(value);
  if (!normalized || !normalized.includes("@")) return null;
  const [local, domain] = normalized.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function hasOwn(row: Row | undefined, key: string) {
  return Boolean(row && Object.prototype.hasOwnProperty.call(row, key));
}

function boolAvailability(row: Row | undefined, key: string): "ready" | "missing" | "unavailable" {
  if (!hasOwn(row, key)) return "unavailable";
  return asString(row?.[key]) ? "ready" : "missing";
}

function qrReadiness(row: Row | undefined): AdminDigitalIdQueueRow["qrReadiness"] {
  if (!hasOwn(row, "qr_code_ref")) return "unavailable";
  const value = asString(row?.qr_code_ref);
  if (!value) return "missing";
  if (/^https?:\/\//i.test(value)) return "absolute";
  return "relative";
}

function expiryState(row: Row | undefined): AdminDigitalIdQueueRow["expiryState"] {
  if (!hasOwn(row, "token_expires_at")) return "unavailable";
  const value = asString(row?.token_expires_at);
  if (!value) return "missing";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "missing";
  if (time <= Date.now()) return "expired";
  if (time - Date.now() <= EXPIRING_SOON_DAYS * 86_400_000) return "expiring_soon";
  return "valid";
}

function daysUntil(value: string | null) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - Date.now()) / 86_400_000);
}

function expiryPosture(params: {
  expiry: AdminDigitalIdQueueRow["expiryState"];
  expiryAt: string | null;
  credentialStatus: string;
  renewalRequestedAt: string | null;
}): AdminDigitalIdQueueRow["expiryPosture"] {
  if (params.expiry === "unavailable") return "unavailable";
  if (params.expiry === "missing") return "missing";
  const days = daysUntil(params.expiryAt);
  const renewalDays = ageDays(params.renewalRequestedAt);
  if (params.credentialStatus === "active" && params.expiry === "expired") return "expired_active";
  if (params.credentialStatus === "renewal_pending" && renewalDays !== null && renewalDays > 30) return "overdue_renewal";
  if (params.expiry === "expired") return "expired";
  if (days !== null && days <= 7) return "expiring_7_days";
  if (days !== null && days <= 30) return "expiring_30_days";
  return "valid";
}

function lifecycleState(credential: Row): string {
  return normalizeDigitalIdLifecycleStatus(credential.status);
}

function publicReadiness(params: {
  credential: Row;
  msme: Row | undefined;
  tokenReadiness: AdminDigitalIdQueueRow["tokenReadiness"];
  signatureReadiness: AdminDigitalIdQueueRow["signatureReadiness"];
  qrState: AdminDigitalIdQueueRow["qrReadiness"];
  expiry: AdminDigitalIdQueueRow["expiryState"];
  duplicateRoutes: number;
}) {
  const status = normalizeDigitalIdLifecycleStatus(params.credential.status);
  const msmeReviewStatus = normalizeStatus(params.msme?.review_status, "unavailable");
  const msmeSuspended = Boolean(params.msme?.suspended);
  const failures: string[] = [];

  if (params.tokenReadiness !== "ready") failures.push("token hash missing or unavailable");
  if (params.signatureReadiness !== "ready") failures.push("signature missing or unavailable");
  if (params.qrState === "missing" || params.qrState === "unavailable") failures.push("QR reference missing or unavailable");
  if (params.qrState === "relative") failures.push("QR reference is relative-only");
  if (params.duplicateRoutes > 1) failures.push("duplicate public route binding detected");
  if (params.expiry !== "valid" && params.expiry !== "expiring_soon") failures.push(`expiry state is ${params.expiry.replaceAll("_", " ")}`);
  if (status !== "active") failures.push(`credential is ${status}`);
  if (asString(params.credential.revoked_at)) failures.push("credential has revoked timestamp");
  if (asString(params.credential.suspended_at)) failures.push("credential has suspended timestamp");
  if (msmeReviewStatus !== "approved") failures.push(`MSME review is ${msmeReviewStatus}`);
  if (msmeSuspended) failures.push("MSME is suspended");

  return {
    readiness: failures.length ? "likely_invalid" : "likely_valid",
    reason: failures.length ? failures.join("; ") : "Token hash, signature, active status, QR reference, expiry, and MSME approval are aligned.",
  } as const;
}

function publicVerificationPosture(params: {
  credentialStatus: string;
  tokenState: AdminDigitalIdQueueRow["tokenReadiness"];
  signatureState: AdminDigitalIdQueueRow["signatureReadiness"];
  qrState: AdminDigitalIdQueueRow["qrReadiness"];
  expiry: AdminDigitalIdQueueRow["expiryState"];
  duplicateRoutes: number;
}): AdminDigitalIdQueueRow["publicVerificationPosture"] {
  if (["revoked", "suspended"].includes(params.credentialStatus)) return "publicly_disabled";
  if (params.tokenState === "missing" || params.signatureState === "missing" || params.qrState === "missing" || params.expiry === "expired") return "invalid";
  if (params.tokenState === "unavailable" || params.signatureState === "unavailable" || params.qrState === "unavailable") return "warning";
  if (params.qrState === "relative" || params.expiry === "expiring_soon" || params.duplicateRoutes > 1) return "warning";
  return "healthy";
}

function trustPosture(params: {
  credentialStatus: string;
  verificationReviewStatus: string;
  complianceStatus: string | null;
  complaintCount: number | null;
  openComplaintCount: number | null;
  expiry: AdminDigitalIdQueueRow["expiryState"];
  regenerationCount: number;
  msmeSuspended: boolean;
}): Pick<AdminDigitalIdQueueRow, "trustPosture" | "trustReasons"> {
  const reasons: string[] = [];
  if (params.credentialStatus === "revoked") reasons.push("Credential is revoked.");
  if (params.credentialStatus === "suspended" || params.msmeSuspended) reasons.push("Credential or MSME is suspended.");
  if (params.expiry === "expired") reasons.push("Credential verification window has expired.");
  if (params.verificationReviewStatus !== "approved") reasons.push(`Verification review is ${params.verificationReviewStatus}.`);
  if (params.complianceStatus && !["verified", "approved", "compliant", "active"].includes(params.complianceStatus)) reasons.push(`Compliance posture is ${params.complianceStatus.replaceAll("_", " ")}.`);
  if ((params.openComplaintCount ?? 0) > 0) reasons.push(`${params.openComplaintCount} open complaint(s) present.`);
  if ((params.complaintCount ?? 0) > 0 && (params.openComplaintCount ?? 0) === 0) reasons.push("Complaint history exists.");
  if (params.regenerationCount >= 2) reasons.push("Repeated credential regeneration observed.");

  if (params.credentialStatus === "revoked") return { trustPosture: "revoked_trust", trustReasons: reasons };
  if (params.credentialStatus === "suspended" || params.msmeSuspended || params.expiry === "expired") return { trustPosture: "restricted", trustReasons: reasons };
  if (reasons.length) return { trustPosture: "watch", trustReasons: reasons };
  return { trustPosture: "trusted", trustReasons: ["Active credential, approved verification, no open complaints, and current validity window are aligned."] };
}

function attentionRank(value: AdminDigitalIdQueueRow["attentionLevel"]) {
  return { normal: 0, watch: 1, elevated: 2, critical: 3 }[value];
}

function signalRank(value: AdminDigitalIdAttentionSignal["severity"]) {
  return { watch: 1, elevated: 2, critical: 3 }[value];
}

function attentionLevel(signals: AdminDigitalIdAttentionSignal[]): AdminDigitalIdQueueRow["attentionLevel"] {
  const rank = Math.max(0, ...signals.map((signal) => signalRank(signal.severity)));
  if (rank >= 3) return "critical";
  if (rank >= 2) return "elevated";
  if (rank >= 1) return "watch";
  return "normal";
}

function recommendedFocus(row: Pick<AdminDigitalIdQueueRow, "attentionSignals" | "publicVerificationReadiness" | "lifecycleState">) {
  if (row.attentionSignals.some((signal) => signal.code === "expired_active")) return "Resolve active credential expiry before any public verification reliance.";
  if (row.attentionSignals.some((signal) => signal.code === "missing_token_hash" || signal.code === "missing_signature")) return "Prioritize credential trust material remediation.";
  if (row.attentionSignals.some((signal) => signal.code === "active_msme_not_approved")) return "Align MSME approval status with active credential state.";
  if (row.attentionSignals.some((signal) => signal.code === "revoked_qr_present")) return "Review QR/public link exposure for revoked credential.";
  if (row.publicVerificationReadiness === "likely_invalid") return "Review public verification readiness blockers.";
  if (row.lifecycleState === "pending") return "Review pending credential age and latest events.";
  return "Monitor credential lifecycle and public verification health.";
}

function buildLifecycleStartedAt(status: string, credential: Row, events: AdminDigitalIdEvent[]) {
  const matching = events.find((event) => {
    if (status === "active") return ["approved", "activate", "approve_renewal", "reinstate"].some((token) => event.action.includes(token));
    if (status === "suspended") return event.action.includes("suspend");
    if (status === "revoked") return event.action.includes("revoke") || event.action.includes("revoked");
    if (status === "renewal_pending") return event.action.includes("renewal");
    if (status === "expired") return event.action.includes("expired");
    return false;
  });
  if (matching?.createdAt) return matching.createdAt;
  if (status === "active") return asString(credential.approved_at) || asString(credential.updated_at) || asString(credential.created_at) || null;
  if (status === "suspended") return asString(credential.suspended_at) || asString(credential.updated_at) || null;
  if (status === "revoked") return asString(credential.revoked_at) || asString(credential.updated_at) || null;
  if (status === "renewal_pending") return asString(credential.renewal_requested_at) || asString(credential.updated_at) || null;
  return asString(credential.created_at) || null;
}

function buildAnomalySignals(params: {
  credentialStatus: string;
  publicVerificationReadiness: AdminDigitalIdQueueRow["publicVerificationReadiness"];
  regenerationCount: number;
  reassignedCount: number;
  events: AdminDigitalIdEvent[];
  latestActivityAt: string | null;
  createdAt: string | null;
}): AdminDigitalIdAnomalySignal[] {
  const events = params.events.map((event) => event.action);
  const suspendCount = events.filter((action) => action.includes("suspend")).length;
  const activateCount = events.filter((action) => action.includes("approved") || action.includes("activate") || action.includes("reinstate")).length;
  const renewalCount = events.filter((action) => action.includes("renewal")).length;
  const revokeCount = events.filter((action) => action.includes("revoke") || action.includes("revoked")).length;
  const signals: AdminDigitalIdAnomalySignal[] = [];

  if (params.regenerationCount >= 3) signals.push({ code: "excessive_regeneration_frequency", label: "Excessive regeneration frequency", explanation: `${params.regenerationCount} credential regenerations are recorded.`, severity: "elevated" });
  if (suspendCount >= 2 && activateCount >= 2) signals.push({ code: "repeated_suspend_reactivate_cycle", label: "Repeated suspend/reactivate cycle", explanation: `${suspendCount} suspension event(s) and ${activateCount} activation event(s) are present.`, severity: "elevated" });
  if (renewalCount >= 2) signals.push({ code: "repeated_renewal_attempts", label: "Repeated renewal attempts", explanation: `${renewalCount} renewal event(s) are present.`, severity: "watch" });
  if (revokeCount >= 2 && params.regenerationCount >= 2) signals.push({ code: "revoked_then_recreated_repeatedly", label: "Revoked then recreated repeatedly", explanation: "Revocation and regeneration activity both repeat on this credential.", severity: "critical" });
  if (params.reassignedCount >= 3) signals.push({ code: "repeated_assignment_changes", label: "Repeated assignment changes", explanation: `${params.reassignedCount} reassignment(s) are recorded.`, severity: "watch" });
  if ((ageHours(params.latestActivityAt ?? params.createdAt) ?? 0) >= 168) signals.push({ code: "stale_credential_without_activity", label: "Stale credential without activity", explanation: "No credential activity has been recorded in the last 7 days.", severity: "watch" });
  if (params.publicVerificationReadiness === "likely_invalid") signals.push({ code: "public_verification_repeatedly_failing", label: "Public verification failing", explanation: "Current readiness checks indicate public verification is likely invalid.", severity: "elevated" });

  return signals;
}

function buildSlaPosture(params: {
  credentialStatus: string;
  createdAt: string | null;
  renewalRequestedAt: string | null;
  suspendedAt: string | null;
  revokedAt: string | null;
  publicVerificationPosture: AdminDigitalIdQueueRow["publicVerificationPosture"];
  publicVerificationReadiness: AdminDigitalIdQueueRow["publicVerificationReadiness"];
  latestIssueAt: string | null;
  regenerationCount: number;
  lastRegeneratedAt: string | null;
  isUnassigned: boolean;
  anomalySignals: AdminDigitalIdAnomalySignal[];
}): AdminDigitalIdSlaPosture {
  let category = "No active SLA";
  let startedAt: string | null = null;
  let limitHours: number | null = null;

  if (params.isUnassigned) {
    category = "assignment inactivity";
    startedAt = params.createdAt;
    limitHours = SLA_RULES_HOURS.unassigned_credential;
  } else if (params.credentialStatus === "pending") {
    category = "pending activation";
    startedAt = params.createdAt;
    limitHours = SLA_RULES_HOURS.pending_activation;
  } else if (params.credentialStatus === "renewal_pending") {
    category = "renewal approval";
    startedAt = params.renewalRequestedAt ?? params.latestIssueAt ?? params.createdAt;
    limitHours = SLA_RULES_HOURS.renewal_approval;
  } else if (params.credentialStatus === "suspended") {
    category = "suspended credential review";
    startedAt = params.suspendedAt ?? params.latestIssueAt ?? params.createdAt;
    limitHours = SLA_RULES_HOURS.suspended_review;
  } else if (params.credentialStatus === "revoked") {
    category = "revocation review";
    startedAt = params.revokedAt ?? params.latestIssueAt ?? params.createdAt;
    limitHours = SLA_RULES_HOURS.revocation_review;
  } else if (params.publicVerificationPosture === "warning" || params.publicVerificationPosture === "invalid" || params.publicVerificationReadiness === "likely_invalid") {
    category = "public verification issue resolution";
    startedAt = params.latestIssueAt ?? params.createdAt;
    limitHours = SLA_RULES_HOURS.public_verification_issue;
  } else if (params.anomalySignals.some((signal) => signal.code.includes("regeneration")) || params.regenerationCount >= 2) {
    category = "regeneration review";
    startedAt = params.lastRegeneratedAt ?? params.latestIssueAt ?? params.createdAt;
    limitHours = SLA_RULES_HOURS.regeneration_anomaly_review;
  }

  if (!startedAt || limitHours === null) {
    return {
      category,
      state: "Paused",
      startedAt: null,
      dueAt: null,
      elapsedHours: null,
      limitHours,
      remainingHours: null,
      explanation: "No active operational SLA is running for the current credential posture.",
    };
  }

  const elapsedHours = ageHours(startedAt);
  const dueAt = addHours(startedAt, limitHours);
  const remainingHours = elapsedHours === null ? null : limitHours - elapsedHours;
  const ratio = safeRatio(elapsedHours, limitHours);
  const state: AdminDigitalIdSlaState = params.isUnassigned
    ? "Unassigned"
    : ratio !== null && ratio >= 1
      ? "Breached"
      : ratio !== null && ratio >= SLA_APPROACHING_RATIO
        ? "Approaching SLA"
        : "On Track";
  return {
    category,
    state,
    startedAt,
    dueAt,
    elapsedHours,
    limitHours,
    remainingHours,
    explanation: `${category} SLA started at ${startedAt}; ${limitHours} hour limit; ${elapsedHours ?? "unavailable"} hour(s) elapsed.`,
  };
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

function searchHaystack(row: AdminDigitalIdQueueRow, msme: Row | undefined) {
  return [
    row.businessName,
    row.msmeId,
    row.ndmiiId,
    row.ownerName,
    msme?.cac_number,
    msme?.tin,
    row.cacMasked,
    row.tinMasked,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function applyFilters(rows: Array<{ row: AdminDigitalIdQueueRow; msme?: Row }>, filters: AdminDigitalIdFilters) {
  const q = asString(filters.q).toLowerCase();
  return rows.filter(({ row, msme }) => {
    if (q && !searchHaystack(row, msme).includes(q)) return false;
    if (filters.credentialStatus && row.credentialStatus !== filters.credentialStatus) return false;
    if (filters.lifecycleState && row.lifecycleState !== filters.lifecycleState) return false;
    if (filters.msmeReviewStatus && row.msmeReviewStatus !== filters.msmeReviewStatus) return false;
    if (filters.verificationReviewStatus && row.verificationReviewStatus !== filters.verificationReviewStatus) return false;
    if (filters.tokenReadiness && row.tokenReadiness !== filters.tokenReadiness) return false;
    if (filters.signatureReadiness && row.signatureReadiness !== filters.signatureReadiness) return false;
    if (filters.qrReadiness && row.qrReadiness !== filters.qrReadiness) return false;
    if (filters.expiryState && row.expiryState !== filters.expiryState) return false;
    if (filters.attentionLevel && row.attentionLevel !== filters.attentionLevel) return false;
    if (filters.slaState && row.sla.state !== filters.slaState) return false;
    if (filters.assignmentFilter === "assigned_to_me" && !row.assignment.isAssignedToCurrentUser) return false;
    if (filters.assignmentFilter === "unassigned" && !row.assignment.isUnassigned) return false;
    if (filters.operationalFilter === "assigned_to_me" && !row.assignment.isAssignedToCurrentUser) return false;
    if (filters.operationalFilter === "unassigned" && !row.assignment.isUnassigned) return false;
    if (filters.publicVerificationPosture && row.publicVerificationPosture !== filters.publicVerificationPosture) return false;
    if (filters.trustPosture && row.trustPosture !== filters.trustPosture) return false;
    if (filters.operationalFilter === "expiring_soon" && !["expiring_7_days", "expiring_30_days"].includes(row.expiryPosture)) return false;
    if (filters.operationalFilter === "revoked" && row.credentialStatus !== "revoked") return false;
    if (filters.operationalFilter === "suspended" && row.credentialStatus !== "suspended") return false;
    if (filters.operationalFilter === "renewal_pending" && row.credentialStatus !== "renewal_pending") return false;
    if (filters.operationalFilter === "public_verification_issue" && !["warning", "invalid"].includes(row.publicVerificationPosture)) return false;
    if (filters.operationalFilter === "missing_qr" && row.qrReadiness !== "missing") return false;
    if (filters.operationalFilter === "repeated_regeneration" && row.regenerationCount < 2) return false;
    if (filters.operationalFilter === "overdue_renewal" && row.expiryPosture !== "overdue_renewal") return false;
    if (filters.operationalFilter === "sla_breached" && row.sla.state !== "Breached") return false;
    if (filters.operationalFilter === "sla_approaching" && row.sla.state !== "Approaching SLA") return false;
    if (filters.operationalFilter === "high_regeneration_activity" && !row.anomalySignals.some((signal) => signal.code.includes("regeneration"))) return false;
    if (filters.operationalFilter === "no_recent_activity" && !row.anomalySignals.some((signal) => signal.code === "stale_credential_without_activity")) return false;
    if (filters.operationalFilter === "repeated_lifecycle_changes" && row.lifecycleChangeCount < 4) return false;
    if (filters.operationalFilter === "inactive_reviewer_assignment" && (row.assignment.inactivityHours ?? 0) < SLA_RULES_HOURS.unassigned_credential) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.sector && row.sector !== filters.sector) return false;
    if (!dateInRange(row.createdAt, filters.createdFrom, filters.createdTo)) return false;
    return true;
  });
}

function applySort(rows: Array<{ row: AdminDigitalIdQueueRow; msme?: Row }>, sort = "attention") {
  return [...rows].sort((a, b) => {
    if (sort === "oldest_sla") return (Date.parse(a.row.sla.startedAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b.row.sla.startedAt ?? "") || Number.MAX_SAFE_INTEGER);
    if (sort === "highest_attention") return b.row.attentionScore - a.row.attentionScore;
    if (sort === "most_regenerated") return b.row.regenerationCount - a.row.regenerationCount;
    if (sort === "oldest_pending") return Number(b.row.credentialStatus === "pending") - Number(a.row.credentialStatus === "pending") || (Date.parse(a.row.createdAt ?? "") || 0) - (Date.parse(b.row.createdAt ?? "") || 0);
    if (sort === "newest_issued") return (Date.parse(b.row.issuedAt ?? "") || 0) - (Date.parse(a.row.issuedAt ?? "") || 0);
    if (sort === "most_lifecycle_changes") return b.row.lifecycleChangeCount - a.row.lifecycleChangeCount;
    if (sort === "nearest_expiry") return (Date.parse(a.row.expiryAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b.row.expiryAt ?? "") || Number.MAX_SAFE_INTEGER);
    if (sort === "newest") return (Date.parse(b.row.createdAt ?? "") || 0) - (Date.parse(a.row.createdAt ?? "") || 0);
    if (sort === "oldest") return (Date.parse(a.row.createdAt ?? "") || 0) - (Date.parse(b.row.createdAt ?? "") || 0);
    if (sort === "expiry") return (Date.parse(a.row.expiryAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b.row.expiryAt ?? "") || Number.MAX_SAFE_INTEGER);
    if (sort === "public_issues") return Number(b.row.publicVerificationReadiness === "likely_invalid") - Number(a.row.publicVerificationReadiness === "likely_invalid") || attentionRank(b.row.attentionLevel) - attentionRank(a.row.attentionLevel);
    return attentionRank(b.row.attentionLevel) - attentionRank(a.row.attentionLevel) || (Date.parse(b.row.updatedAt ?? "") || 0) - (Date.parse(a.row.updatedAt ?? "") || 0);
  });
}

function buildKpis(rows: AdminDigitalIdQueueRow[]): AdminDigitalIdKpis {
  return {
    totalCredentials: rows.length,
    pendingCredentials: rows.filter((row) => row.credentialStatus === "pending").length,
    activeCredentials: rows.filter((row) => row.credentialStatus === "active").length,
    suspendedCredentials: rows.filter((row) => row.credentialStatus === "suspended").length,
    revokedCredentials: rows.filter((row) => row.credentialStatus === "revoked").length,
    expiredCredentials: rows.filter((row) => row.credentialStatus === "expired").length,
    renewalPending: rows.filter((row) => row.credentialStatus === "renewal_pending").length,
    slaBreaches: rows.filter((row) => row.sla.state === "Breached" || row.sla.state === "Unassigned").length,
    unassignedCredentials: rows.filter((row) => row.assignment.isUnassigned).length,
    overdueRenewals: rows.filter((row) => row.expiryPosture === "overdue_renewal").length,
    expiringIn7Days: rows.filter((row) => (row.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER) >= 0 && (row.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER) <= 7).length,
    expiringIn30Days: rows.filter((row) => (row.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER) > 7 && (row.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER) <= 30).length,
    regenerationSpikes: rows.filter((row) => row.anomalySignals.some((signal) => signal.code.includes("regeneration"))).length,
    missingValidSignatureOrTokenHash: rows.filter((row) => row.tokenReadiness !== "ready" || row.signatureReadiness !== "ready").length,
    publicVerificationIssues: rows.filter((row) => row.publicVerificationReadiness === "likely_invalid" || row.qrReadiness === "missing").length,
  };
}

function oldestRow(rows: AdminDigitalIdQueueRow[], predicate: (row: AdminDigitalIdQueueRow) => boolean, dateValue: (row: AdminDigitalIdQueueRow) => string | null) {
  return rows.filter(predicate).sort((a, b) => (Date.parse(dateValue(a) ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(dateValue(b) ?? "") || Number.MAX_SAFE_INTEGER))[0] ?? null;
}

function buildQueueInsights(rows: AdminDigitalIdQueueRow[]): AdminDigitalIdQueueInsight[] {
  const oldestPending = oldestRow(rows, (row) => row.credentialStatus === "pending", (row) => row.createdAt);
  const oldestRenewal = oldestRow(rows, (row) => row.credentialStatus === "renewal_pending", (row) => row.sla.startedAt);
  const mostRegenerated = [...rows].sort((a, b) => b.regenerationCount - a.regenerationCount)[0] ?? null;
  const repeatedLifecycle = rows.filter((row) => row.lifecycleChangeCount >= 4).length;
  const noActivity = rows.filter((row) => row.anomalySignals.some((signal) => signal.code === "stale_credential_without_activity")).length;
  const stuckPending = rows.filter((row) => row.credentialStatus === "pending" && row.sla.state === "Breached").length;
  const missingPublicReadiness = rows.filter((row) => row.publicVerificationReadiness === "likely_invalid").length;

  return [
    { label: "Oldest pending credential", value: oldestPending?.businessName ?? "Unavailable", detail: oldestPending ? `${oldestPending.sla.elapsedHours ?? "Unavailable"} hour(s) pending` : "No pending credential found", credentialId: oldestPending?.credentialId ?? null },
    { label: "Oldest renewal pending", value: oldestRenewal?.businessName ?? "Unavailable", detail: oldestRenewal ? `${oldestRenewal.sla.elapsedHours ?? "Unavailable"} hour(s) in renewal` : "No renewal backlog found", credentialId: oldestRenewal?.credentialId ?? null },
    { label: "Most regenerated credential", value: mostRegenerated?.businessName ?? "Unavailable", detail: mostRegenerated ? `${mostRegenerated.regenerationCount} regeneration(s)` : "No credential rows available", credentialId: mostRegenerated?.credentialId ?? null },
    { label: "Repeated lifecycle changes", value: repeatedLifecycle.toLocaleString(), detail: "Credentials with four or more lifecycle events" },
    { label: "No recent activity", value: noActivity.toLocaleString(), detail: "Credentials without activity in the last 7 days" },
    { label: "Stuck in pending", value: stuckPending.toLocaleString(), detail: "Pending credentials with breached SLA" },
    { label: "Missing public readiness", value: missingPublicReadiness.toLocaleString(), detail: "Credentials likely invalid for public verification" },
  ];
}

function buildReviewerAnalytics(rows: AdminDigitalIdQueueRow[], users: Map<string, { name: string; role: string }>): AdminDigitalIdReviewerAnalytics[] {
  return Array.from(users.entries())
    .filter(([, user]) => ["reviewer", "admin", "super_admin"].includes(user.role))
    .map(([reviewerId, user]) => {
      const assignedRows = rows.filter((row) => row.assignment.assignedReviewerId === reviewerId || row.assignment.assignedAdminId === reviewerId);
      const eventRows = rows.flatMap((row) => row.eventTimeline.filter((event) => event.actorRole === user.role));
      const completedRows = rows.filter((row) => row.eventTimeline.some((event) => event.actorRole === user.role && ["approved", "revoked", "suspended", "renewal_requested", "reissued"].includes(event.action)));
      const resolutionHours = completedRows
        .map((row) => {
          const start = Date.parse(row.createdAt ?? "");
          const end = Date.parse(row.latestCredentialEventAt ?? "");
          return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.floor((end - start) / 3_600_000) : null;
        })
        .filter((value): value is number => value !== null);
      const pendingAges = assignedRows.filter((row) => ["pending", "renewal_pending", "suspended"].includes(row.credentialStatus)).map((row) => row.sla.elapsedHours).filter((value): value is number => value !== null);
      return {
        reviewerId,
        reviewerName: user.name,
        role: user.role,
        assignedWorkload: assignedRows.length,
        completedActions: eventRows.length,
        averageResolutionHours: resolutionHours.length ? Math.round(resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length) : null,
        slaBreachCount: assignedRows.filter((row) => row.sla.state === "Breached" || row.sla.state === "Unassigned").length,
        pendingQueueAgeHours: pendingAges.length ? Math.max(...pendingAges) : null,
        credentialsUnderReview: assignedRows.filter((row) => ["pending", "renewal_pending", "suspended"].includes(row.credentialStatus)).length,
        renewalsProcessed: assignedRows.filter((row) => row.eventTimeline.some((event) => event.action.includes("renewal"))).length,
        suspensionsHandled: assignedRows.filter((row) => row.eventTimeline.some((event) => event.action.includes("suspend"))).length,
        revocationsHandled: assignedRows.filter((row) => row.eventTimeline.some((event) => event.action.includes("revoke"))).length,
      };
    })
    .filter((row) => row.assignedWorkload > 0 || row.completedActions > 0);
}

export function adminDigitalIdFiltersForDiagnostics(filters: AdminDigitalIdFilters) {
  return {
    hasSearch: Boolean(asString(filters.q)) ? "true" : "false",
    credentialStatus: filters.credentialStatus ?? null,
    lifecycleState: filters.lifecycleState ?? null,
    msmeReviewStatus: filters.msmeReviewStatus ?? null,
    verificationReviewStatus: filters.verificationReviewStatus ?? null,
    tokenReadiness: filters.tokenReadiness ?? null,
    signatureReadiness: filters.signatureReadiness ?? null,
    qrReadiness: filters.qrReadiness ?? null,
    expiryState: filters.expiryState ?? null,
    attentionLevel: filters.attentionLevel ?? null,
    operationalFilter: filters.operationalFilter ?? null,
    assignmentFilter: filters.assignmentFilter ?? null,
    slaState: filters.slaState ?? null,
    publicVerificationPosture: filters.publicVerificationPosture ?? null,
    trustPosture: filters.trustPosture ?? null,
    state: filters.state ?? null,
    sector: filters.sector ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    sort: filters.sort ?? null,
    page: filters.page ?? null,
    pageSize: filters.pageSize ?? null,
    exportAll: filters.exportAll ? "true" : null,
  };
}

export async function loadAdminDigitalIdQueue(
  supabase: SupabaseClient<any>,
  inputFilters: AdminDigitalIdFilters,
  viewer: AdminDigitalIdQueueViewer = {},
): Promise<AdminDigitalIdQueueResult> {
  const filters = normalizeAdminDigitalIdFilters(inputFilters);
  const sources = Object.fromEntries(
    (Object.keys(TABLE_COLUMNS) as AdminDigitalIdSourceName[]).map((source) => [source, { available: false, message: "Not loaded" }]),
  ) as Record<AdminDigitalIdSourceName, AdminDigitalIdSourceState>;

  const [
    credentialsResult,
    eventsResult,
    msmesResult,
    reviewsResult,
    validationResult,
    legacyComplianceResult,
    complianceProfilesResult,
    complaintsResult,
    activityLogsResult,
    usersResult,
  ] = await Promise.all([
    readOptionalTable<Row>(supabase, "digital_identity_credentials", TABLE_COLUMNS.digital_identity_credentials),
    readOptionalTable<Row>(supabase, "credential_events", TABLE_COLUMNS.credential_events),
    readOptionalTable<Row>(supabase, "msmes", TABLE_COLUMNS.msmes),
    readOptionalTable<Row>(supabase, "verification_reviews", TABLE_COLUMNS.verification_reviews),
    readOptionalTable<Row>(supabase, "validation_results", TABLE_COLUMNS.validation_results),
    readOptionalTable<Row>(supabase, "compliance_profiles", TABLE_COLUMNS.compliance_profiles),
    readOptionalTable<Row>(supabase, "msme_compliance_profiles", TABLE_COLUMNS.msme_compliance_profiles),
    readOptionalTable<Row>(supabase, "complaints", TABLE_COLUMNS.complaints),
    readOptionalTable<Row>(supabase, "activity_logs", TABLE_COLUMNS.activity_logs),
    readOptionalTable<Row>(supabase, "users", TABLE_COLUMNS.users),
  ]);

  sources.digital_identity_credentials = credentialsResult.source;
  sources.credential_events = eventsResult.source;
  sources.msmes = msmesResult.source;
  sources.verification_reviews = reviewsResult.source;
  sources.validation_results = validationResult.source;
  sources.compliance_profiles = legacyComplianceResult.source;
  sources.msme_compliance_profiles = complianceProfilesResult.source;
  sources.complaints = complaintsResult.source;
  sources.activity_logs = activityLogsResult.source;
  sources.users = usersResult.source;

  const msmeById = new Map(msmesResult.rows.map((row) => [asString(row.id), row]));
  const reviewByMsme = latestByKey(reviewsResult.rows, "msme_id", ["updated_at", "created_at"]);
  const validationByMsme = latestByKey(validationResult.rows, "msme_id", ["updated_at", "validated_at"]);
  const legacyComplianceByMsme = latestByKey(legacyComplianceResult.rows, "msme_id", ["last_reviewed_at"]);
  const complianceByMsme = latestByKey(complianceProfilesResult.rows, "msme_id", ["updated_at"]);
  const complaintCounts = buildComplaintCounts(complaintsResult.rows);
  const eventsByCredential = buildEventsByCredential(eventsResult.rows);
  const activityByCredential = buildActivitySignalsByCredential(activityLogsResult.rows);
  const usersById = buildUserLookup(usersResult.rows);
  const publicRouteCounts = new Map<string, number>();
  for (const credential of credentialsResult.rows) {
    const route = asString(credential.qr_code_ref);
    if (!route) continue;
    publicRouteCounts.set(route, (publicRouteCounts.get(route) ?? 0) + 1);
  }

  const decorated = credentialsResult.rows
    .filter((credential) => asString(credential.id))
    .map((credential) => {
      const id = asString(credential.id);
      const msmeId = asString(credential.msme_id);
      const msme = msmeById.get(msmeId);
      const review = reviewByMsme.get(msmeId);
      const validation = validationByMsme.get(msmeId);
      const legacyCompliance = legacyComplianceByMsme.get(msmeId);
      const compliance = complianceByMsme.get(msmeId);
      const complaints = complaintCounts.get(msmeId);
      const events = eventsByCredential.get(id) ?? [];
      const activity = activityByCredential.get(id);
      const credentialStatus = normalizeDigitalIdLifecycleStatus(credential.status);
      const lifecycle = lifecycleState(credential);
      const tokenState = boolAvailability(credential, "public_token_hash");
      const signatureState = boolAvailability(credential, "public_signature");
      const qrState = qrReadiness(credential);
      const expiry = expiryState(credential);
      const issuedAt = asString(credential.issued_at) || null;
      const createdAt = asString(credential.created_at) || issuedAt;
      const approvedAt = asString(credential.approved_at) || null;
      const expiryAt = asString(credential.token_expires_at) || null;
      const qrRef = asString(credential.qr_code_ref) || null;
      const duplicateRoutes = qrRef ? publicRouteCounts.get(qrRef) ?? 0 : 0;
      const publicStatus = publicReadiness({ credential, msme, tokenReadiness: tokenState, signatureReadiness: signatureState, qrState, expiry, duplicateRoutes });
      const publicPosture = publicVerificationPosture({ credentialStatus, tokenState, signatureState, qrState, expiry, duplicateRoutes });
      const regenerationCount = Math.max(Number(credential.regeneration_count ?? 0), events.filter((event) => event.action === "reissued").length, activity?.regenerationCount ?? 0);
      const msmeReviewStatus = normalizeStatus(msme?.review_status, sources.msmes.available ? "pending" : "unavailable");
      const msmeVerificationStatus = normalizeStatus(msme?.verification_status, sources.msmes.available ? "pending" : "unavailable");
      const verificationReviewStatus = sources.verification_reviews.available ? normalizeStatus(review?.status, "missing") : "unavailable";
      const renewalRequestedAt = asString(credential.renewal_requested_at) || null;
      const expiryPostureValue = expiryPosture({ expiry, expiryAt, credentialStatus, renewalRequestedAt });
      const assignedReviewerId = asString(credential.assigned_reviewer_id) || null;
      const assignedAdminId = asString(credential.assigned_admin_id) || null;
      const assignedAt = asString(credential.assigned_at) || null;
      const assignedBy = asString(credential.assigned_by) || null;
      const reassignedCount = Number(credential.reassigned_count ?? 0);
      const lastReassignmentAt = asString(credential.last_reassignment_at) || null;
      const isUnassigned = !assignedReviewerId && !assignedAdminId;
      const latestActivityAt = activity?.latestAt ?? events[0]?.createdAt ?? asString(credential.updated_at) ?? createdAt;
      const lifecycleChangeCount = events.filter((event) => ["approved", "suspended", "revoked", "expired", "renewal_requested", "reissued"].includes(event.action)).length;
      const currentLifecycleStartedAt = buildLifecycleStartedAt(credentialStatus, credential, events);
      const anomalySignals = buildAnomalySignals({
        credentialStatus,
        publicVerificationReadiness: publicStatus.readiness,
        regenerationCount,
        reassignedCount,
        events,
        latestActivityAt,
        createdAt,
      });
      const assignment: AdminDigitalIdAssignment = {
        assignedReviewerId,
        assignedAdminId,
        assignedReviewerName: usersById.get(assignedReviewerId ?? "")?.name ?? null,
        assignedAdminName: usersById.get(assignedAdminId ?? "")?.name ?? null,
        assignedAt,
        assignedBy,
        assignedByName: usersById.get(assignedBy ?? "")?.name ?? null,
        reassignedCount,
        lastReassignmentAt,
        inactivityHours: ageHours(latestActivityAt),
        isAssignedToCurrentUser: Boolean(viewer.currentUserId && [assignedReviewerId, assignedAdminId].includes(viewer.currentUserId)),
        isUnassigned,
      };
      const sla = buildSlaPosture({
        credentialStatus,
        createdAt,
        renewalRequestedAt,
        suspendedAt: asString(credential.suspended_at) || null,
        revokedAt: asString(credential.revoked_at) || null,
        publicVerificationPosture: publicPosture,
        publicVerificationReadiness: publicStatus.readiness,
        latestIssueAt: latestActivityAt,
        regenerationCount,
        lastRegeneratedAt: asString(credential.last_regenerated_at) || null,
        isUnassigned,
        anomalySignals,
      });
      const signals: AdminDigitalIdAttentionSignal[] = [];
      const qrRouteSignals: AdminDigitalIdAttentionSignal[] = [];

      if (tokenState === "missing") signals.push({ code: "missing_token_hash", label: "Missing token hash", severity: "critical" });
      if (signatureState === "missing") signals.push({ code: "missing_signature", label: "Missing public signature", severity: "critical" });
      if (credentialStatus === "active" && expiry === "expired") signals.push({ code: "expired_active", label: "Active credential token is expired", severity: "critical" });
      if (credentialStatus === "renewal_pending") signals.push({ code: "renewal_pending", label: "Renewal pending", severity: "watch" });
      if (credentialStatus === "expired" || lifecycle === "expired") signals.push({ code: "expired_credential", label: "Expired credential", severity: "elevated" });
      if (credentialStatus === "revoked" && qrState !== "missing" && qrState !== "unavailable") signals.push({ code: "revoked_qr_present", label: "Revoked but QR reference still present", severity: "elevated" });
      if (Boolean(msme?.suspended) && credentialStatus === "active") signals.push({ code: "suspended_msme_active_credential", label: "Suspended MSME has active credential", severity: "critical" });
      if (credentialStatus === "active" && msmeReviewStatus !== "approved") signals.push({ code: "active_msme_not_approved", label: "Active credential but MSME not approved", severity: "critical" });
      if (credentialStatus === "pending" && (ageDays(createdAt) ?? 0) >= PENDING_AGE_THRESHOLD_DAYS) signals.push({ code: "stale_pending_credential", label: `Pending credential older than ${PENDING_AGE_THRESHOLD_DAYS} days`, severity: "elevated" });
      if (qrState === "missing") qrRouteSignals.push({ code: "qr_missing", label: "QR missing", severity: "elevated" });
      if (qrState === "relative") qrRouteSignals.push({ code: "relative_public_route", label: "Relative-only route", severity: "watch" });
      if (duplicateRoutes > 1) qrRouteSignals.push({ code: "duplicate_public_route", label: "Duplicate public route", severity: "critical" });
      if (["revoked", "suspended"].includes(credentialStatus) && qrState !== "missing" && qrState !== "unavailable") qrRouteSignals.push({ code: `${credentialStatus}_publicly_reachable`, label: `${credentialStatus.replaceAll("_", " ")} but route present`, severity: "critical" });
      if (credentialStatus === "active" && expiry === "expired" && qrState !== "missing") qrRouteSignals.push({ code: "expired_reachable", label: "Expired credential still reachable", severity: "critical" });
      if (regenerationCount >= 2) qrRouteSignals.push({ code: "frequent_regeneration", label: "Regenerated frequently", severity: "elevated" });
      signals.push(...qrRouteSignals);
      if (!events.length && sources.credential_events.available) signals.push({ code: "no_event_history", label: "Credential has no event history", severity: "watch" });
      if (regenerationCount >= 2) signals.push({ code: "repeated_token_regeneration", label: `${regenerationCount} token reissue events`, severity: "elevated" });
      if (publicStatus.readiness === "likely_invalid") signals.push({ code: "public_verification_issue", label: "Public verification likely invalid", severity: "elevated" });

      if (sla.state === "Breached" || sla.state === "Unassigned") signals.push({ code: "sla_breached", label: `${sla.category} SLA ${sla.state.toLowerCase()}`, severity: "critical" });
      if (sla.state === "Approaching SLA") signals.push({ code: "sla_approaching", label: `${sla.category} approaching SLA`, severity: "elevated" });
      for (const signal of anomalySignals) signals.push({ code: signal.code, label: signal.label, severity: signal.severity });

      const attention = attentionLevel(signals);
      const attentionScore = attentionRank(attention) * 100 + signals.length * 5 + regenerationCount + lifecycleChangeCount + (sla.state === "Breached" || sla.state === "Unassigned" ? 50 : 0);
      const complianceStatus = normalizeStatus(compliance?.overall_status ?? legacyCompliance?.overall_status, "") || null;
      const complaintCount = sources.complaints.available ? complaints?.total ?? 0 : null;
      const openComplaintCount = sources.complaints.available ? complaints?.open ?? 0 : null;
      const trust = trustPosture({
        credentialStatus,
        verificationReviewStatus,
        complianceStatus,
        complaintCount,
        openComplaintCount,
        expiry,
        regenerationCount,
        msmeSuspended: Boolean(msme?.suspended),
      });
      const partialRow = {
        attentionSignals: signals,
        publicVerificationReadiness: publicStatus.readiness,
        lifecycleState: lifecycle,
      };

      const row: AdminDigitalIdQueueRow = {
        id,
        credentialId: id,
        businessName: asString(msme?.business_name) || "Unknown business",
        msmeRowId: msmeId || null,
        msmeId: asString(msme?.msme_id) || msmeId || "Unassigned BIN",
        ndmiiId: asString(credential.ndmii_id) || "Unassigned NDMII ID",
        ownerName: asString(msme?.owner_name) || "Owner unavailable",
        state: asString(msme?.state) || null,
        sector: asString(msme?.sector) || null,
        credentialStatus,
        msmeReviewStatus,
        msmeVerificationStatus,
        verificationReviewStatus,
        lifecycleState: lifecycle,
        issuedAt,
        approvedAt,
        expiryAt,
        createdAt,
        updatedAt: asString(credential.updated_at) || createdAt,
        revokedAt: asString(credential.revoked_at) || null,
        suspendedAt: asString(credential.suspended_at) || null,
        tokenReadiness: tokenState,
        signatureReadiness: signatureState,
        qrReadiness: qrState,
        publicVerificationReadiness: publicStatus.readiness,
        publicVerificationPosture: publicPosture,
        publicVerificationReason: publicStatus.reason,
        publicRouteAvailable: Boolean(qrRef),
        routeDuplicateCount: duplicateRoutes,
        expiryState: expiry,
        expiryPosture: expiryPostureValue,
        daysUntilExpiry: daysUntil(expiryAt),
        renewalPendingDays: ageDays(renewalRequestedAt),
        latestCredentialEvent: events[0]?.action ?? null,
        latestCredentialEventAt: events[0]?.createdAt ?? null,
        eventPreview: events.slice(0, 5),
        eventTimeline: events.slice(0, 20),
        attentionLevel: attention,
        attentionSignals: signals,
        complianceStatus,
        complianceScore: Number.isFinite(Number(compliance?.compliance_score ?? legacyCompliance?.score)) ? Number(compliance?.compliance_score ?? legacyCompliance?.score) : null,
        complaintCount,
        openComplaintCount,
        cacMasked: maskTrailing(msme?.cac_number ?? validation?.cac_number),
        tinMasked: maskTrailing(msme?.tin ?? validation?.tin),
        recommendedFocus: recommendedFocus(partialRow),
        regenerationCount,
        lastRegeneratedAt: asString(credential.last_regenerated_at) || null,
        tokenInvalidatedAt: asString(credential.token_invalidated_at) || null,
        lifecycleVersion: Number(credential.lifecycle_version ?? 0),
        trustPosture: trust.trustPosture,
        trustReasons: trust.trustReasons,
        qrRouteSignals,
        sla,
        assignment,
        anomalySignals,
        lifecycleChangeCount,
        currentLifecycleStartedAt,
        currentLifecycleAgeHours: ageHours(currentLifecycleStartedAt),
        attentionScore,
      };
      return { row, msme };
    });

  const filtered = applySort(applyFilters(decorated, filters), filters.sort);
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const rows = filters.exportAll ? filtered.map(({ row }) => row) : filtered.slice(start, start + filters.pageSize).map(({ row }) => row);
  const allRows = decorated.map(({ row }) => row);
  const selectedRow = filters.selectedId ? allRows.find((row) => row.id === filters.selectedId) ?? null : rows[0] ?? null;
  const kpis = buildKpis(allRows);
  const queueInsights = buildQueueInsights(allRows);
  const reviewerAnalytics = buildReviewerAnalytics(allRows, usersById);

  return {
    rows,
    selectedRow,
    totalRows,
    page,
    pageSize: filters.pageSize,
    totalPages,
    kpis,
    lifecycleSummary: uniqueSorted(allRows.map((row) => row.lifecycleState)).map((state) => ({
      label: state,
      value: allRows.filter((row) => row.lifecycleState === state).length,
    })),
    queueInsights,
    reviewerAnalytics,
    slaSummary: (["Breached", "Unassigned", "Approaching SLA", "On Track", "Paused"] as AdminDigitalIdSlaState[]).map((state) => ({
      label: state,
      value: allRows.filter((row) => row.sla.state === state).length,
    })),
    options: {
      credentialStatuses: uniqueSorted(allRows.map((row) => row.credentialStatus)),
      lifecycleStates: uniqueSorted(allRows.map((row) => row.lifecycleState)),
      msmeReviewStatuses: uniqueSorted(allRows.map((row) => row.msmeReviewStatus)),
      verificationReviewStatuses: uniqueSorted(allRows.map((row) => row.verificationReviewStatus)),
      tokenReadiness: uniqueSorted(allRows.map((row) => row.tokenReadiness)),
      signatureReadiness: uniqueSorted(allRows.map((row) => row.signatureReadiness)),
      qrReadiness: uniqueSorted(allRows.map((row) => row.qrReadiness)),
      expiryStates: uniqueSorted(allRows.map((row) => row.expiryState)),
      attentionLevels: uniqueSorted(allRows.map((row) => row.attentionLevel)),
      slaStates: uniqueSorted(allRows.map((row) => row.sla.state)),
      assignmentFilters: [
        { value: "assigned_to_me", label: "Assigned to me" },
        { value: "unassigned", label: "Unassigned" },
      ],
      operationalFilters: [
        { value: "assigned_to_me", label: "Assigned to me" },
        { value: "unassigned", label: "Unassigned" },
        { value: "sla_breached", label: "SLA breached" },
        { value: "sla_approaching", label: "SLA approaching" },
        { value: "expiring_soon", label: "Expiring soon" },
        { value: "revoked", label: "Revoked" },
        { value: "suspended", label: "Suspended" },
        { value: "renewal_pending", label: "Renewal pending" },
        { value: "public_verification_issue", label: "Public verification issue" },
        { value: "missing_qr", label: "Missing QR" },
        { value: "repeated_regeneration", label: "Repeated regeneration" },
        { value: "overdue_renewal", label: "Overdue renewal" },
        { value: "high_regeneration_activity", label: "High regeneration activity" },
        { value: "no_recent_activity", label: "No recent activity" },
        { value: "repeated_lifecycle_changes", label: "Repeated lifecycle changes" },
        { value: "inactive_reviewer_assignment", label: "Inactive reviewer assignment" },
      ],
      publicVerificationPostures: uniqueSorted(allRows.map((row) => row.publicVerificationPosture)),
      trustPostures: uniqueSorted(allRows.map((row) => row.trustPosture)),
      states: uniqueSorted(allRows.map((row) => row.state)),
      sectors: uniqueSorted(allRows.map((row) => row.sector)),
      sortOptions: [
        { value: "oldest_sla", label: "Oldest SLA" },
        { value: "highest_attention", label: "Highest attention" },
        { value: "most_regenerated", label: "Most regenerated" },
        { value: "oldest_pending", label: "Oldest pending" },
        { value: "newest_issued", label: "Newest issued" },
        { value: "most_lifecycle_changes", label: "Most lifecycle changes" },
        { value: "nearest_expiry", label: "Nearest expiry" },
        { value: "attention", label: "Attention first" },
        { value: "public_issues", label: "Public issues first" },
        { value: "expiry", label: "Expiry date" },
        { value: "newest", label: "Newest created" },
        { value: "oldest", label: "Oldest created" },
      ],
    },
    sources,
  };
}

export function buildAdminDigitalIdQueueCsv(rows: AdminDigitalIdQueueRow[]) {
  const header = [
    "Business Name",
    "MSME ID / BIN",
    "NDMII ID",
    "Owner Name",
    "State",
    "Sector",
    "Credential Status",
    "MSME Review Status",
    "Verification Review Status",
    "Lifecycle State",
    "Issued Date",
    "Approved Date",
    "Expiry Date",
    "Expiry State",
    "Expiry Posture",
    "Token Hash Readiness",
    "Signature Readiness",
    "QR Readiness",
    "Public Verification Readiness",
    "Public Verification Posture",
    "Public Verification Reason",
    "SLA Category",
    "SLA State",
    "SLA Due At",
    "Assigned Reviewer",
    "Assigned Admin",
    "Assignment Inactivity Hours",
    "Trust Posture",
    "Trust Reasons",
    "Regeneration Count",
    "Latest Credential Event",
    "Latest Credential Event Date",
    "Attention Level",
    "Attention Signals",
    "Anomaly Signals",
    "Lifecycle Change Count",
    "Complaint Count",
    "Open Complaint Count",
    "Compliance Status",
    "Compliance Score",
    "Masked CAC",
    "Masked TIN",
    "Recommended Operational Focus",
  ];

  return [
    header.map(csvValue).join(","),
    ...rows.map((row) => [
      row.businessName,
      row.msmeId,
      row.ndmiiId,
      row.ownerName,
      row.state,
      row.sector,
      row.credentialStatus,
      row.msmeReviewStatus,
      row.verificationReviewStatus,
      row.lifecycleState,
      row.issuedAt,
      row.approvedAt,
      row.expiryAt,
      row.expiryState,
      row.expiryPosture,
      row.tokenReadiness,
      row.signatureReadiness,
      row.qrReadiness,
      row.publicVerificationReadiness,
      row.publicVerificationPosture,
      row.publicVerificationReason,
      row.sla.category,
      row.sla.state,
      row.sla.dueAt,
      row.assignment.assignedReviewerName ?? "Unassigned",
      row.assignment.assignedAdminName ?? "Unassigned",
      row.assignment.inactivityHours ?? "Unavailable",
      row.trustPosture,
      row.trustReasons.join("; "),
      row.regenerationCount,
      row.latestCredentialEvent,
      row.latestCredentialEventAt,
      row.attentionLevel,
      row.attentionSignals.map((signal) => signal.label).join("; "),
      row.anomalySignals.map((signal) => signal.label).join("; "),
      row.lifecycleChangeCount,
      row.complaintCount ?? "Unavailable",
      row.openComplaintCount ?? "Unavailable",
      row.complianceStatus ?? "Unavailable",
      row.complianceScore ?? "Unavailable",
      row.cacMasked ?? "",
      row.tinMasked ?? "",
      row.recommendedFocus,
    ].map(csvValue).join(",")),
  ].join("\r\n");
}
