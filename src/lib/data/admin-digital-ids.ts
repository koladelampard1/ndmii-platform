import type { SupabaseClient } from "@supabase/supabase-js";
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
  | "activity_logs";

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
  publicVerificationReason: string;
  publicVerificationRoute: string | null;
  safeTestHref: string | null;
  expiryState: "valid" | "expiring_soon" | "expired" | "missing" | "unavailable";
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
};

export type AdminDigitalIdKpis = {
  totalCredentials: number;
  pendingCredentials: number;
  activeCredentials: number;
  suspendedCredentials: number;
  revokedCredentials: number;
  expiredCredentials: number;
  missingValidSignatureOrTokenHash: number;
  publicVerificationIssues: number;
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

const READ_LIMIT = 5000;
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = new Set([25, 50, 100]);
const PENDING_AGE_THRESHOLD_DAYS = 14;
const EXPIRING_SOON_DAYS = 30;
const CLOSED_COMPLAINT_STATUSES = new Set(["resolved", "closed", "dismissed"]);

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
    "renewal_requested_at",
    "regeneration_count",
    "last_regenerated_at",
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

function maskTrailing(value: unknown, visible = 4) {
  const normalized = asString(value);
  if (!normalized) return null;
  if (normalized.length <= visible) return "*".repeat(normalized.length);
  return `${"*".repeat(Math.max(3, normalized.length - visible))}${normalized.slice(-visible)}`;
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

function lifecycleState(credential: Row): string {
  const status = normalizeStatus(credential.status, "pending");
  const expiry = expiryState(credential);
  if (status === "active" && expiry === "expired") return "expired";
  if (status === "revoked" || asString(credential.revoked_at)) return "revoked";
  if (status === "suspended" || asString(credential.suspended_at)) return "suspended";
  if (status === "expired") return "expired";
  if (status === "renewal_pending") return "renewal_pending";
  if (status === "active") return "active";
  return status;
}

function safeHref(qrRef: string | null) {
  const value = asString(qrRef);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/verify/c/")) return value;
  return null;
}

function publicReadiness(params: {
  credential: Row;
  msme: Row | undefined;
  tokenReadiness: AdminDigitalIdQueueRow["tokenReadiness"];
  signatureReadiness: AdminDigitalIdQueueRow["signatureReadiness"];
  qrState: AdminDigitalIdQueueRow["qrReadiness"];
  expiry: AdminDigitalIdQueueRow["expiryState"];
}) {
  const status = normalizeStatus(params.credential.status, "pending");
  const msmeReviewStatus = normalizeStatus(params.msme?.review_status, "unavailable");
  const msmeSuspended = Boolean(params.msme?.suspended);
  const failures: string[] = [];

  if (params.tokenReadiness !== "ready") failures.push("token hash missing or unavailable");
  if (params.signatureReadiness !== "ready") failures.push("signature missing or unavailable");
  if (params.qrState === "missing" || params.qrState === "unavailable") failures.push("QR reference missing or unavailable");
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
    if (filters.state && row.state !== filters.state) return false;
    if (filters.sector && row.sector !== filters.sector) return false;
    if (!dateInRange(row.createdAt, filters.createdFrom, filters.createdTo)) return false;
    return true;
  });
}

function applySort(rows: Array<{ row: AdminDigitalIdQueueRow; msme?: Row }>, sort = "attention") {
  return [...rows].sort((a, b) => {
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
    expiredCredentials: rows.filter((row) => row.expiryState === "expired" || row.lifecycleState === "expired" || row.credentialStatus === "expired").length,
    missingValidSignatureOrTokenHash: rows.filter((row) => row.tokenReadiness !== "ready" || row.signatureReadiness !== "ready").length,
    publicVerificationIssues: rows.filter((row) => row.publicVerificationReadiness === "likely_invalid" || row.qrReadiness === "missing").length,
  };
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

  const msmeById = new Map(msmesResult.rows.map((row) => [asString(row.id), row]));
  const reviewByMsme = latestByKey(reviewsResult.rows, "msme_id", ["updated_at", "created_at"]);
  const validationByMsme = latestByKey(validationResult.rows, "msme_id", ["updated_at", "validated_at"]);
  const legacyComplianceByMsme = latestByKey(legacyComplianceResult.rows, "msme_id", ["last_reviewed_at"]);
  const complianceByMsme = latestByKey(complianceProfilesResult.rows, "msme_id", ["updated_at"]);
  const complaintCounts = buildComplaintCounts(complaintsResult.rows);
  const eventsByCredential = buildEventsByCredential(eventsResult.rows);
  const activityByCredential = buildActivitySignalsByCredential(activityLogsResult.rows);

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
      const credentialStatus = normalizeStatus(credential.status, "pending");
      const lifecycle = lifecycleState(credential);
      const tokenState = boolAvailability(credential, "public_token_hash");
      const signatureState = boolAvailability(credential, "public_signature");
      const qrState = qrReadiness(credential);
      const expiry = expiryState(credential);
      const publicStatus = publicReadiness({ credential, msme, tokenReadiness: tokenState, signatureReadiness: signatureState, qrState, expiry });
      const regenerationCount = Math.max(Number(credential.regeneration_count ?? 0), events.filter((event) => event.action === "reissued").length, activity?.regenerationCount ?? 0);
      const msmeReviewStatus = normalizeStatus(msme?.review_status, sources.msmes.available ? "pending" : "unavailable");
      const msmeVerificationStatus = normalizeStatus(msme?.verification_status, sources.msmes.available ? "pending" : "unavailable");
      const verificationReviewStatus = sources.verification_reviews.available ? normalizeStatus(review?.status, "missing") : "unavailable";
      const issuedAt = asString(credential.issued_at) || null;
      const createdAt = asString(credential.created_at) || issuedAt;
      const approvedAt = asString(credential.approved_at) || null;
      const expiryAt = asString(credential.token_expires_at) || null;
      const qrRef = asString(credential.qr_code_ref) || null;
      const signals: AdminDigitalIdAttentionSignal[] = [];

      if (tokenState === "missing") signals.push({ code: "missing_token_hash", label: "Missing token hash", severity: "critical" });
      if (signatureState === "missing") signals.push({ code: "missing_signature", label: "Missing public signature", severity: "critical" });
      if (credentialStatus === "active" && expiry === "expired") signals.push({ code: "expired_active", label: "Expired credential requires renewal state", severity: "critical" });
      if (credentialStatus === "renewal_pending") signals.push({ code: "renewal_pending", label: "Renewal pending", severity: "watch" });
      if (credentialStatus === "expired" || lifecycle === "expired") signals.push({ code: "expired_credential", label: "Expired credential", severity: "elevated" });
      if (credentialStatus === "revoked" && qrState !== "missing" && qrState !== "unavailable") signals.push({ code: "revoked_qr_present", label: "Revoked but QR reference still present", severity: "elevated" });
      if (Boolean(msme?.suspended) && credentialStatus === "active") signals.push({ code: "suspended_msme_active_credential", label: "Suspended MSME has active credential", severity: "critical" });
      if (credentialStatus === "active" && msmeReviewStatus !== "approved") signals.push({ code: "active_msme_not_approved", label: "Active credential but MSME not approved", severity: "critical" });
      if (credentialStatus === "pending" && (ageDays(createdAt) ?? 0) >= PENDING_AGE_THRESHOLD_DAYS) signals.push({ code: "stale_pending_credential", label: `Pending credential older than ${PENDING_AGE_THRESHOLD_DAYS} days`, severity: "elevated" });
      if (qrState === "missing") signals.push({ code: "missing_public_route", label: "Public verification URL missing", severity: "elevated" });
      if (qrState === "relative") signals.push({ code: "relative_public_route", label: "Public verification URL is relative-only", severity: "watch" });
      if (!events.length && sources.credential_events.available) signals.push({ code: "no_event_history", label: "Credential has no event history", severity: "watch" });
      if (regenerationCount >= 2) signals.push({ code: "repeated_token_regeneration", label: `${regenerationCount} token reissue events`, severity: "elevated" });
      if (publicStatus.readiness === "likely_invalid") signals.push({ code: "public_verification_issue", label: "Public verification likely invalid", severity: "elevated" });

      const attention = attentionLevel(signals);
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
        publicVerificationReason: publicStatus.reason,
        publicVerificationRoute: qrRef,
        safeTestHref: safeHref(qrRef),
        expiryState: expiry,
        latestCredentialEvent: events[0]?.action ?? null,
        latestCredentialEventAt: events[0]?.createdAt ?? null,
        eventPreview: events.slice(0, 5),
        eventTimeline: events.slice(0, 20),
        attentionLevel: attention,
        attentionSignals: signals,
        complianceStatus: normalizeStatus(compliance?.overall_status ?? legacyCompliance?.overall_status, "") || null,
        complianceScore: Number.isFinite(Number(compliance?.compliance_score ?? legacyCompliance?.score)) ? Number(compliance?.compliance_score ?? legacyCompliance?.score) : null,
        complaintCount: sources.complaints.available ? complaints?.total ?? 0 : null,
        openComplaintCount: sources.complaints.available ? complaints?.open ?? 0 : null,
        cacMasked: maskTrailing(msme?.cac_number ?? validation?.cac_number),
        tinMasked: maskTrailing(msme?.tin ?? validation?.tin),
        recommendedFocus: recommendedFocus(partialRow),
        regenerationCount,
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
      states: uniqueSorted(allRows.map((row) => row.state)),
      sectors: uniqueSorted(allRows.map((row) => row.sector)),
      sortOptions: [
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
    "Token Hash Readiness",
    "Signature Readiness",
    "QR Readiness",
    "Public Verification Readiness",
    "Public Verification Reason",
    "Latest Credential Event",
    "Latest Credential Event Date",
    "Attention Level",
    "Attention Signals",
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
      row.tokenReadiness,
      row.signatureReadiness,
      row.qrReadiness,
      row.publicVerificationReadiness,
      row.publicVerificationReason,
      row.latestCredentialEvent,
      row.latestCredentialEventAt,
      row.attentionLevel,
      row.attentionSignals.map((signal) => signal.label).join("; "),
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
