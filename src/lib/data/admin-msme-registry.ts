import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminMsmeRegistryFilters = {
  q?: string;
  state?: string;
  sector?: string;
  verificationStatus?: string;
  reviewStatus?: string;
  complianceStatus?: string;
  digitalIdStatus?: string;
  associationId?: string;
  flagged?: string;
  suspended?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
  selectedId?: string;
  exportAll?: boolean;
};

export type RegistrySourceName =
  | "msmes"
  | "digital_identity_credentials"
  | "credential_events"
  | "msme_compliance_profiles"
  | "msme_compliance_items"
  | "compliance_events"
  | "compliance_documents"
  | "compliance_document_events"
  | "complaints"
  | "complaint_status_history"
  | "associations"
  | "association_members"
  | "association_memberships"
  | "validation_results"
  | "compliance_profiles"
  | "activity_logs"
  | "admin_internal_notes"
  | "invoices"
  | "invoice_events";

export type RegistrySourceState = {
  available: boolean;
  message?: string | null;
};

export type AdminMsmeRegistryRow = {
  id: string;
  msmeId: string;
  businessName: string;
  ownerName: string;
  state: string | null;
  lga: string | null;
  sector: string | null;
  businessType: string | null;
  verificationStatus: string;
  reviewStatus: string;
  complianceStatus: string | null;
  complianceScore: number | null;
  complianceRiskLevel: string | null;
  complianceItemsCount: number | null;
  digitalIdStatus: string | null;
  digitalId: string | null;
  digitalIdIssuedAt: string | null;
  complaintCount: number | null;
  openComplaintCount: number | null;
  associationId: string | null;
  associationName: string | null;
  createdAt: string | null;
  flagged: boolean;
  suspended: boolean;
  enforcementNote: string | null;
  validationStatus: string | null;
  validationConfidence: number | null;
  contactEmailMasked: string | null;
  contactPhoneMasked: string | null;
  cacMasked: string | null;
  tinMasked: string | null;
  reviewRequested: boolean;
  escalated: boolean;
  latestAdminAction: string | null;
  latestAdminActionAt: string | null;
};

export type AdminMsmeRegistryKpis = {
  totalMsmes: number;
  verifiedMsmes: number;
  pendingReview: number;
  flaggedOrSuspended: number;
  activeCredentials: number | null;
  openComplaints: number | null;
};

export type AdminMsmeRegistryOption = {
  value: string;
  label: string;
};

export type AdminMsmeRegistryResult = {
  rows: AdminMsmeRegistryRow[];
  selectedRow: AdminMsmeRegistryRow | null;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: AdminMsmeRegistryKpis;
  options: {
    states: string[];
    sectors: string[];
    verificationStatuses: string[];
    reviewStatuses: string[];
    complianceStatuses: string[];
    digitalIdStatuses: string[];
    associations: AdminMsmeRegistryOption[];
  };
  sources: Record<RegistrySourceName, RegistrySourceState>;
  diagnostics: {
    operation: string;
    filtersUsed: Record<string, string | number | null>;
    rowCount: number;
    supabaseErrorCode?: string | null;
    supabaseErrorMessage?: string | null;
  };
};

export type AdminMsmeTimelineItem = {
  id: string;
  eventType: string;
  date: string | null;
  source: RegistrySourceName;
  summary: string;
};

export type AdminMsmeDetail = {
  row: AdminMsmeRegistryRow & {
    address: string | null;
    profileCompletenessScore: number;
  };
  credential: {
    id: string | null;
    status: string | null;
    ndmiiId: string | null;
    issuedAt: string | null;
    approvedAt: string | null;
    revokedAt: string | null;
    suspendedAt: string | null;
    expiresAt: string | null;
    tokenExists: boolean | null;
    latestEvent: AdminMsmeTimelineItem | null;
  };
  compliance: {
    profileStatus: string | null;
    score: number | null;
    riskLevel: string | null;
    approvedCount: number | null;
    pendingCount: number | null;
    underReviewCount: number | null;
    submittedCount: number | null;
    rejectedCount: number | null;
    changesRequestedCount: number | null;
    expiredCount: number | null;
    expiringSoonCount: number | null;
    evidenceCount: number | null;
    latestEvents: AdminMsmeTimelineItem[];
  };
  complaints: {
    count: number | null;
    openCount: number | null;
    highestSeverity: string | null;
    latestReferences: Array<{ id: string; reference: string; status: string | null; severity: string | null; createdAt: string | null }>;
  };
  association: {
    id: string | null;
    name: string | null;
    membershipStatus: string | null;
    source: string | null;
    memberRecordCount: number | null;
  };
  verification: {
    validationSummaries: Array<{ label: string; value: string | null }>;
    legacyComplianceStatus: string | null;
    legacyComplianceScore: number | null;
    legacyComplianceRiskLevel: string | null;
  };
  timeline: AdminMsmeTimelineItem[];
  internalNotes: Array<{ id: string; authorRole: string | null; noteBody: string; createdAt: string | null }>;
  duplicateSignals: Array<{
    id: string;
    msmeId: string;
    businessName: string;
    confidence: "high" | "medium" | "low";
    reasons: string[];
  }>;
  sources: Record<RegistrySourceName, RegistrySourceState>;
  diagnostics: {
    operation: string;
    msmeId: string;
    sourceAvailability: Record<string, boolean>;
    supabaseErrorCode?: string | null;
    supabaseErrorMessage?: string | null;
  };
};

type TableReadResult<T> = {
  rows: T[];
  source: RegistrySourceState;
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
  association_id?: string | null;
  cac_number?: string | null;
  tin?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  created_at?: string | null;
  flagged?: boolean | null;
  suspended?: boolean | null;
  enforcement_note?: string | null;
  operational_review_requested?: boolean | null;
  operational_escalated?: boolean | null;
  latest_admin_action?: string | null;
  latest_admin_action_at?: string | null;
};

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = new Set([25, 50, 100]);
const REGISTRY_READ_LIMIT = 5000;
const CLOSED_COMPLAINT_STATUSES = new Set(["resolved", "closed", "dismissed"]);

const TABLE_COLUMNS: Record<RegistrySourceName, string[]> = {
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
    "association_id",
    "cac_number",
    "tin",
    "contact_email",
    "contact_phone",
    "created_at",
    "flagged",
    "suspended",
    "enforcement_note",
    "operational_review_requested",
    "operational_escalated",
    "latest_admin_action",
    "latest_admin_action_at",
  ],
  digital_identity_credentials: ["id", "msme_id", "ndmii_id", "status", "issued_at", "approved_at", "revoked_at", "suspended_at", "token_expires_at", "public_token_hash", "created_at", "updated_at"],
  credential_events: ["id", "credential_id", "action", "actor_role", "metadata", "created_at"],
  msme_compliance_profiles: ["msme_id", "overall_status", "compliance_score", "risk_level", "approved_count", "pending_count", "under_review_count", "changes_requested_count", "rejected_count", "expired_count", "expiring_soon_count", "updated_at"],
  msme_compliance_items: ["id", "msme_id", "status", "expires_at", "updated_at"],
  compliance_events: ["id", "msme_id", "compliance_item_id", "event_type", "from_status", "to_status", "actor_role", "summary", "created_at"],
  compliance_documents: ["id", "msme_id", "is_deleted", "uploaded_at"],
  compliance_document_events: ["id", "msme_id", "compliance_item_id", "event_type", "actor_role", "summary", "created_at"],
  complaints: ["id", "msme_id", "provider_msme_id", "status", "priority", "severity", "complaint_reference", "reference_code", "title", "created_at"],
  complaint_status_history: ["id", "complaint_id", "from_status", "to_status", "changed_by_role", "note", "created_at"],
  associations: ["id", "name"],
  association_members: ["id", "association_id", "msme_id", "member_status", "invite_status", "role", "created_at"],
  association_memberships: ["id", "association_id", "msme_id", "membership_type", "approval_status", "created_at"],
  validation_results: ["msme_id", "confidence_score", "validation_summary", "validated_at", "nin_status", "bvn_status", "cac_status", "tin_status"],
  compliance_profiles: ["msme_id", "overall_status", "score", "risk_level", "nin_status", "bvn_status", "cac_status", "tin_status"],
  activity_logs: ["id", "actor_user_id", "action", "entity_type", "entity_id", "metadata", "created_at"],
  admin_internal_notes: ["id", "msme_id", "author_role", "note_body", "created_at"],
  invoices: ["id", "msme_id", "invoice_number", "status", "created_at"],
  invoice_events: ["id", "invoice_id", "event_type", "actor_role", "metadata", "created_at"],
};

const REQUIRED_TABLE_COLUMNS: Record<RegistrySourceName, string[]> = {
  msmes: ["id", "msme_id", "business_name", "owner_name", "state", "sector", "verification_status", "association_id", "created_at"],
  digital_identity_credentials: ["id", "msme_id", "ndmii_id", "status"],
  credential_events: ["id", "credential_id", "action"],
  msme_compliance_profiles: ["msme_id", "overall_status"],
  msme_compliance_items: ["id", "msme_id", "status"],
  compliance_events: ["id", "msme_id", "event_type"],
  compliance_documents: ["id", "msme_id"],
  compliance_document_events: ["id", "msme_id", "event_type"],
  complaints: ["id", "msme_id", "status"],
  complaint_status_history: ["id", "complaint_id", "to_status"],
  associations: ["id", "name"],
  association_members: ["id", "association_id", "msme_id"],
  association_memberships: ["id", "association_id", "msme_id"],
  validation_results: ["msme_id", "confidence_score"],
  compliance_profiles: ["msme_id", "overall_status"],
  activity_logs: ["id", "action", "entity_type"],
  admin_internal_notes: ["id", "msme_id", "note_body"],
  invoices: ["id", "msme_id"],
  invoice_events: ["id", "invoice_id", "event_type"],
};

function normalizePage(value: unknown) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizePageSize(value: unknown) {
  const parsed = Number(value ?? DEFAULT_PAGE_SIZE);
  return PAGE_SIZES.has(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

export function normalizeRegistryFilters(input: AdminMsmeRegistryFilters): Required<Pick<AdminMsmeRegistryFilters, "page" | "pageSize">> & AdminMsmeRegistryFilters {
  return {
    ...input,
    page: normalizePage(input.page),
    pageSize: normalizePageSize(input.pageSize),
  };
}

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStatus(value: string | null | undefined, fallback: string) {
  const normalized = asString(value).toLowerCase().replace(/\s+/g, "_");
  return normalized || fallback;
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

function maskPhone(value: string | null | undefined) {
  return maskTrailing(value, 4);
}

function sourceUnavailable(error: { code?: string | null; message?: string | null } | null): RegistrySourceState {
  return {
    available: false,
    message: error?.message ?? "Source unavailable",
  };
}

async function readOptionalTable<T extends Record<string, unknown>>(
  supabase: SupabaseClient<any>,
  table: RegistrySourceName,
  columns: string[],
  limit = REGISTRY_READ_LIMIT,
): Promise<TableReadResult<T>> {
  const { data, error } = await supabase
    .from(table)
    .select(columns.join(","))
    .limit(limit);

  if (error) {
    const fallbackColumns = REQUIRED_TABLE_COLUMNS[table];
    if (fallbackColumns.join(",") !== columns.join(",")) {
      const fallback = await supabase.from(table).select(fallbackColumns.join(",")).limit(limit);
      if (!fallback.error) {
        const rows = ((fallback.data ?? []) as unknown as T[]).filter(Boolean);
        console.info("[admin-msme-registry]", {
          operation: "source_read_schema_fallback",
          source: table,
          rowCount: rows.length,
          supabaseErrorCode: error.code ?? null,
          supabaseErrorMessage: error.message ?? null,
        });
        return {
          rows,
          source: {
            available: true,
            message: `Loaded with reduced columns after schema fallback: ${error.message}`,
          },
        };
      }
    }

    console.info("[admin-msme-registry]", {
      operation: "source_read",
      source: table,
      rowCount: 0,
      supabaseErrorCode: error.code ?? null,
      supabaseErrorMessage: error.message ?? null,
    });
    return { rows: [], source: sourceUnavailable(error) };
  }

  const rows = ((data ?? []) as unknown as T[]).filter(Boolean);
  console.info("[admin-msme-registry]", {
    operation: "source_read",
    source: table,
    rowCount: rows.length,
    supabaseErrorCode: null,
    supabaseErrorMessage: null,
  });
  return { rows, source: { available: true, message: null } };
}

function latestByMsme<T extends Record<string, unknown>>(rows: T[], dateColumn: string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const msmeId = asString(row.msme_id);
    if (!msmeId) continue;
    const existing = map.get(msmeId);
    const currentTime = Date.parse(asString(row[dateColumn])) || 0;
    const existingTime = existing ? Date.parse(asString(existing[dateColumn])) || 0 : -1;
    if (!existing || currentTime >= existingTime) map.set(msmeId, row);
  }
  return map;
}

function buildComplaintCounts(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, { total: number; open: number }>();
  for (const row of rows) {
    const ids = [asString(row.msme_id), asString(row.provider_msme_id)].filter(Boolean);
    const status = normalizeStatus(asString(row.status), "submitted");
    for (const id of new Set(ids)) {
      const current = counts.get(id) ?? { total: 0, open: 0 };
      current.total += 1;
      if (!CLOSED_COMPLAINT_STATUSES.has(status)) current.open += 1;
      counts.set(id, current);
    }
  }
  return counts;
}

function buildItemCounts(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const msmeId = asString(row.msme_id);
    if (!msmeId) continue;
    counts.set(msmeId, (counts.get(msmeId) ?? 0) + 1);
  }
  return counts;
}

function countByStatus(rows: Array<Record<string, unknown>>, status: string) {
  return rows.filter((row) => normalizeStatus(asString(row.status), "not_started") === status).length;
}

function severityRank(value: string | null | undefined) {
  const normalized = normalizeStatus(value, "");
  if (["critical", "urgent"].includes(normalized)) return 4;
  if (["high"].includes(normalized)) return 3;
  if (["medium"].includes(normalized)) return 2;
  if (["low"].includes(normalized)) return 1;
  return 0;
}

function safeTimelineSummary(row: Record<string, unknown>, fallback: string) {
  return asString(row.summary) || fallback;
}

function timelineItem(source: RegistrySourceName, row: Record<string, unknown>, eventType: string, fallback: string): AdminMsmeTimelineItem {
  return {
    id: asString(row.id) || `${source}-${eventType}-${asString(row.created_at)}`,
    eventType,
    date: asString(row.created_at) || null,
    source,
    summary: safeTimelineSummary(row, fallback),
  };
}

function sortLatestTimeline(items: AdminMsmeTimelineItem[], limit = 20) {
  return items
    .filter((item) => item.date)
    .sort((a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0))
    .slice(0, limit);
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
  const complete = fields.filter((value) => Boolean(asString(value))).length;
  return Math.round((complete / fields.length) * 100);
}

function detailRowFromSources(params: {
  msme: MsmeRow;
  credential?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
  legacyCompliance?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  complaints: { total: number; open: number } | undefined;
  complianceItemsCount: number | null;
  associationName: string | null;
}) {
  const { msme, credential, compliance, legacyCompliance, validation, complaints, complianceItemsCount, associationName } = params;
  const id = asString(msme.id);
  return {
    id,
    msmeId: asString(msme.msme_id) || "Unassigned MSME ID",
    businessName: asString(msme.business_name) || "Unnamed MSME",
    ownerName: asString(msme.owner_name) || "Owner unavailable",
    state: asString(msme.state) || null,
    lga: asString(msme.lga) || null,
    sector: asString(msme.sector) || null,
    businessType: asString(msme.business_type) || null,
    address: asString(msme.address) || null,
    verificationStatus: normalizeStatus(msme.verification_status, "pending"),
    reviewStatus: normalizeStatus(msme.review_status, normalizeStatus(msme.verification_status, "pending_review")),
    complianceStatus: normalizeStatus(asString(compliance?.overall_status ?? legacyCompliance?.overall_status), "") || null,
    complianceScore: Number.isFinite(Number(compliance?.compliance_score ?? legacyCompliance?.score)) ? Number(compliance?.compliance_score ?? legacyCompliance?.score) : null,
    complianceRiskLevel: asString(compliance?.risk_level ?? legacyCompliance?.risk_level) || null,
    complianceItemsCount,
    digitalIdStatus: normalizeStatus(asString(credential?.status), "") || null,
    digitalId: asString(credential?.ndmii_id) || null,
    digitalIdIssuedAt: asString(credential?.issued_at) || null,
    complaintCount: complaints?.total ?? null,
    openComplaintCount: complaints?.open ?? null,
    associationId: asString(msme.association_id) || null,
    associationName,
    createdAt: asString(msme.created_at) || null,
    flagged: Boolean(msme.flagged),
    suspended: Boolean(msme.suspended),
    enforcementNote: asString(msme.enforcement_note) || null,
    reviewRequested: Boolean(msme.operational_review_requested),
    escalated: Boolean(msme.operational_escalated),
    latestAdminAction: asString(msme.latest_admin_action) || null,
    latestAdminActionAt: asString(msme.latest_admin_action_at) || null,
    validationStatus: asString(validation?.validation_summary) || null,
    validationConfidence: Number.isFinite(Number(validation?.confidence_score)) ? Number(validation?.confidence_score) : null,
    contactEmailMasked: maskEmail(msme.contact_email),
    contactPhoneMasked: maskPhone(msme.contact_phone),
    cacMasked: maskTrailing(msme.cac_number),
    tinMasked: maskTrailing(msme.tin),
    profileCompletenessScore: profileCompletenessScore(msme),
  };
}

function matchesDateRange(createdAt: string | null, from?: string, to?: string) {
  const createdTime = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(createdTime)) return !from && !to;
  if (from) {
    const fromTime = Date.parse(from);
    if (Number.isFinite(fromTime) && createdTime < fromTime) return false;
  }
  if (to) {
    const toTime = Date.parse(`${to}T23:59:59.999`);
    if (Number.isFinite(toTime) && createdTime > toTime) return false;
  }
  return true;
}

function searchHaystack(row: AdminMsmeRegistryRow, raw: MsmeRow) {
  return [
    row.businessName,
    row.msmeId,
    row.digitalId,
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
      const reasons: string[] = [];
      let score = 0;
      if (asString(msme.cac_number) && normalizedComparable(msme.cac_number) === normalizedComparable(candidate.cac_number)) {
        score += 45;
        reasons.push("CAC match");
      }
      if (asString(msme.tin) && normalizedComparable(msme.tin) === normalizedComparable(candidate.tin)) {
        score += 45;
        reasons.push("TIN match");
      }
      if (asString(msme.contact_phone) && normalizedComparable(msme.contact_phone) === normalizedComparable(candidate.contact_phone)) {
        score += 30;
        reasons.push("Phone match");
      }
      if (asString(msme.contact_email) && normalizedComparable(msme.contact_email) === normalizedComparable(candidate.contact_email)) {
        score += 30;
        reasons.push("Email match");
      }
      const similarity = nameSimilarity(msme.business_name, candidate.business_name);
      if (similarity >= 0.72) {
        score += Math.round(similarity * 25);
        reasons.push(`Business name similarity ${Math.round(similarity * 100)}%`);
      }
      return {
        id: asString(candidate.id),
        msmeId: asString(candidate.msme_id) || "Unassigned MSME ID",
        businessName: asString(candidate.business_name) || "Unnamed MSME",
        confidence: score >= 60 ? "high" as const : score >= 35 ? "medium" as const : "low" as const,
        reasons,
        score,
      };
    })
    .filter((signal) => signal.score >= 25 && signal.reasons.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((signal) => ({
      id: signal.id,
      msmeId: signal.msmeId,
      businessName: signal.businessName,
      confidence: signal.confidence,
      reasons: signal.reasons,
    }));
}

function applyFilters(rows: Array<{ row: AdminMsmeRegistryRow; raw: MsmeRow }>, filters: AdminMsmeRegistryFilters) {
  const q = asString(filters.q).toLowerCase();
  return rows.filter(({ row, raw }) => {
    if (q && !searchHaystack(row, raw).includes(q)) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.sector && row.sector !== filters.sector) return false;
    if (filters.verificationStatus && row.verificationStatus !== filters.verificationStatus) return false;
    if (filters.reviewStatus && row.reviewStatus !== filters.reviewStatus) return false;
    if (filters.complianceStatus && row.complianceStatus !== filters.complianceStatus) return false;
    if (filters.digitalIdStatus && row.digitalIdStatus !== filters.digitalIdStatus) return false;
    if (filters.associationId && row.associationId !== filters.associationId) return false;
    if (filters.flagged === "true" && !row.flagged) return false;
    if (filters.flagged === "false" && row.flagged) return false;
    if (filters.suspended === "true" && !row.suspended) return false;
    if (filters.suspended === "false" && row.suspended) return false;
    if (!matchesDateRange(row.createdAt, filters.createdFrom, filters.createdTo)) return false;
    return true;
  });
}

function buildKpis(rows: AdminMsmeRegistryRow[]): AdminMsmeRegistryKpis {
  return {
    totalMsmes: rows.length,
    verifiedMsmes: rows.filter((row) => ["verified", "approved", "active"].includes(row.verificationStatus)).length,
    pendingReview: rows.filter((row) => ["pending_review", "submitted", "under_review", "changes_requested"].includes(row.reviewStatus)).length,
    flaggedOrSuspended: rows.filter((row) => row.flagged || row.suspended || row.digitalIdStatus === "suspended").length,
    activeCredentials: rows.filter((row) => row.digitalIdStatus === "active").length,
    openComplaints: rows.reduce((sum, row) => sum + (row.openComplaintCount ?? 0), 0),
  };
}

export async function loadAdminMsmeRegistry(
  supabase: SupabaseClient<any>,
  inputFilters: AdminMsmeRegistryFilters,
): Promise<AdminMsmeRegistryResult> {
  const filters = normalizeRegistryFilters(inputFilters);
  const sources = Object.fromEntries(
    (Object.keys(TABLE_COLUMNS) as RegistrySourceName[]).map((source) => [source, { available: false, message: "Not loaded" }]),
  ) as Record<RegistrySourceName, RegistrySourceState>;

  const [
    msmesResult,
    credentialsResult,
    complianceProfilesResult,
    complianceItemsResult,
    complaintsResult,
    associationsResult,
    associationMembersResult,
    validationResult,
    legacyComplianceResult,
  ] = await Promise.all([
    readOptionalTable<MsmeRow>(supabase, "msmes", TABLE_COLUMNS.msmes),
    readOptionalTable<Record<string, unknown>>(supabase, "digital_identity_credentials", TABLE_COLUMNS.digital_identity_credentials),
    readOptionalTable<Record<string, unknown>>(supabase, "msme_compliance_profiles", TABLE_COLUMNS.msme_compliance_profiles),
    readOptionalTable<Record<string, unknown>>(supabase, "msme_compliance_items", TABLE_COLUMNS.msme_compliance_items),
    readOptionalTable<Record<string, unknown>>(supabase, "complaints", TABLE_COLUMNS.complaints),
    readOptionalTable<Record<string, unknown>>(supabase, "associations", TABLE_COLUMNS.associations),
    readOptionalTable<Record<string, unknown>>(supabase, "association_members", TABLE_COLUMNS.association_members),
    readOptionalTable<Record<string, unknown>>(supabase, "validation_results", TABLE_COLUMNS.validation_results),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_profiles", TABLE_COLUMNS.compliance_profiles),
  ]);

  sources.msmes = msmesResult.source;
  sources.digital_identity_credentials = credentialsResult.source;
  sources.msme_compliance_profiles = complianceProfilesResult.source;
  sources.msme_compliance_items = complianceItemsResult.source;
  sources.complaints = complaintsResult.source;
  sources.associations = associationsResult.source;
  sources.association_members = associationMembersResult.source;
  sources.validation_results = validationResult.source;
  sources.compliance_profiles = legacyComplianceResult.source;
  sources.activity_logs = { available: false, message: "Not used in Phase 1 list view" };
  sources.credential_events = { available: false, message: "Not used in Phase 1 list view" };
  sources.compliance_events = { available: false, message: "Not used in Phase 1 list view" };
  sources.compliance_documents = { available: false, message: "Not used in Phase 1 list view" };
  sources.compliance_document_events = { available: false, message: "Not used in Phase 1 list view" };
  sources.complaint_status_history = { available: false, message: "Not used in Phase 1 list view" };
  sources.association_memberships = { available: false, message: "Not used in Phase 1 list view" };
  sources.invoices = { available: false, message: "Not used in Phase 1 list view" };
  sources.invoice_events = { available: false, message: "Not used in Phase 1 list view" };
  sources.admin_internal_notes = { available: false, message: "Not used in Phase 1 list view" };

  const credentialsByMsme = latestByMsme(credentialsResult.rows, "updated_at");
  const complianceByMsme = latestByMsme(complianceProfilesResult.rows, "updated_at");
  const validationByMsme = latestByMsme(validationResult.rows, "validated_at");
  const legacyComplianceByMsme = latestByMsme(legacyComplianceResult.rows, "last_reviewed_at");
  const complaintCounts = buildComplaintCounts(complaintsResult.rows);
  const complianceItemCounts = buildItemCounts(complianceItemsResult.rows);
  const associationById = new Map(associationsResult.rows.map((row) => [asString(row.id), asString(row.name)]));

  const decorated = msmesResult.rows
    .filter((row) => asString(row.id))
    .map((raw) => {
      const id = asString(raw.id);
      const credential = credentialsByMsme.get(id);
      const compliance = complianceByMsme.get(id);
      const legacyCompliance = legacyComplianceByMsme.get(id);
      const validation = validationByMsme.get(id);
      const complaints = complaintCounts.get(id);
      const associationId = asString(raw.association_id) || null;
      const row: AdminMsmeRegistryRow = {
        id,
        msmeId: asString(raw.msme_id) || "Unassigned MSME ID",
        businessName: asString(raw.business_name) || "Unnamed MSME",
        ownerName: asString(raw.owner_name) || "Owner unavailable",
        state: asString(raw.state) || null,
        lga: asString(raw.lga) || null,
        sector: asString(raw.sector) || null,
        businessType: asString(raw.business_type) || null,
        verificationStatus: normalizeStatus(raw.verification_status, "pending"),
        reviewStatus: normalizeStatus(raw.review_status, normalizeStatus(raw.verification_status, "pending_review")),
        complianceStatus: normalizeStatus(asString(compliance?.overall_status ?? legacyCompliance?.overall_status), "") || null,
        complianceScore: Number.isFinite(Number(compliance?.compliance_score ?? legacyCompliance?.score)) ? Number(compliance?.compliance_score ?? legacyCompliance?.score) : null,
        complianceRiskLevel: asString(compliance?.risk_level ?? legacyCompliance?.risk_level) || null,
        complianceItemsCount: sources.msme_compliance_items.available ? complianceItemCounts.get(id) ?? 0 : null,
        digitalIdStatus: normalizeStatus(asString(credential?.status), "") || null,
        digitalId: asString(credential?.ndmii_id) || null,
        digitalIdIssuedAt: asString(credential?.issued_at) || null,
        complaintCount: sources.complaints.available ? complaints?.total ?? 0 : null,
        openComplaintCount: sources.complaints.available ? complaints?.open ?? 0 : null,
        associationId,
        associationName: associationId ? associationById.get(associationId) || "Unavailable" : null,
        createdAt: asString(raw.created_at) || null,
        flagged: Boolean(raw.flagged),
        suspended: Boolean(raw.suspended),
        enforcementNote: asString(raw.enforcement_note) || null,
        reviewRequested: Boolean(raw.operational_review_requested),
        escalated: Boolean(raw.operational_escalated),
        latestAdminAction: asString(raw.latest_admin_action) || null,
        latestAdminActionAt: asString(raw.latest_admin_action_at) || null,
        validationStatus: asString(validation?.validation_summary) || null,
        validationConfidence: Number.isFinite(Number(validation?.confidence_score)) ? Number(validation?.confidence_score) : null,
        contactEmailMasked: maskEmail(raw.contact_email),
        contactPhoneMasked: maskPhone(raw.contact_phone),
        cacMasked: maskTrailing(raw.cac_number),
        tinMasked: maskTrailing(raw.tin),
      };
      return { row, raw };
    })
    .sort((a, b) => (Date.parse(b.row.createdAt ?? "") || 0) - (Date.parse(a.row.createdAt ?? "") || 0));

  const filtered = applyFilters(decorated, filters);
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const rows = filters.exportAll ? filtered.map(({ row }) => row) : filtered.slice(start, start + filters.pageSize).map(({ row }) => row);
  const selectedRow = filters.selectedId
    ? decorated.find(({ row }) => row.id === filters.selectedId)?.row ?? null
    : rows[0] ?? null;
  const allRows = decorated.map(({ row }) => row);

  return {
    rows,
    selectedRow,
    totalRows,
    page,
    pageSize: filters.pageSize,
    totalPages,
    kpis: buildKpis(allRows),
    options: {
      states: uniqueSorted(allRows.map((row) => row.state)),
      sectors: uniqueSorted(allRows.map((row) => row.sector)),
      verificationStatuses: uniqueSorted(allRows.map((row) => row.verificationStatus)),
      reviewStatuses: uniqueSorted(allRows.map((row) => row.reviewStatus)),
      complianceStatuses: uniqueSorted(allRows.map((row) => row.complianceStatus)),
      digitalIdStatuses: uniqueSorted(allRows.map((row) => row.digitalIdStatus)),
      associations: associationsResult.rows
        .map((row) => ({ value: asString(row.id), label: asString(row.name) || "Unnamed association" }))
        .filter((row) => row.value)
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
    sources,
    diagnostics: {
      operation: "load_admin_msme_registry",
      filtersUsed: registryFiltersForDiagnostics(filters),
      rowCount: rows.length,
      supabaseErrorCode: null,
      supabaseErrorMessage: null,
    },
  };
}

export async function getAdminMsmeDetail(
  supabase: SupabaseClient<any>,
  msmeId: string,
): Promise<AdminMsmeDetail | null> {
  const normalizedMsmeId = asString(msmeId);
  const sources = Object.fromEntries(
    (Object.keys(TABLE_COLUMNS) as RegistrySourceName[]).map((source) => [source, { available: false, message: "Not loaded" }]),
  ) as Record<RegistrySourceName, RegistrySourceState>;

  const [
    msmesResult,
    credentialsResult,
    credentialEventsResult,
    complianceProfilesResult,
    complianceItemsResult,
    complianceEventsResult,
    complianceDocumentsResult,
    complianceDocumentEventsResult,
    complaintsResult,
    complaintHistoryResult,
    associationsResult,
    associationMembersResult,
    associationMembershipsResult,
    validationResult,
    legacyComplianceResult,
    activityLogsResult,
    internalNotesResult,
    invoicesResult,
    invoiceEventsResult,
  ] = await Promise.all([
    readOptionalTable<MsmeRow>(supabase, "msmes", TABLE_COLUMNS.msmes),
    readOptionalTable<Record<string, unknown>>(supabase, "digital_identity_credentials", TABLE_COLUMNS.digital_identity_credentials),
    readOptionalTable<Record<string, unknown>>(supabase, "credential_events", TABLE_COLUMNS.credential_events, 1000),
    readOptionalTable<Record<string, unknown>>(supabase, "msme_compliance_profiles", TABLE_COLUMNS.msme_compliance_profiles),
    readOptionalTable<Record<string, unknown>>(supabase, "msme_compliance_items", TABLE_COLUMNS.msme_compliance_items),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_events", TABLE_COLUMNS.compliance_events, 2000),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_documents", TABLE_COLUMNS.compliance_documents),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_document_events", TABLE_COLUMNS.compliance_document_events, 2000),
    readOptionalTable<Record<string, unknown>>(supabase, "complaints", TABLE_COLUMNS.complaints),
    readOptionalTable<Record<string, unknown>>(supabase, "complaint_status_history", TABLE_COLUMNS.complaint_status_history, 2000),
    readOptionalTable<Record<string, unknown>>(supabase, "associations", TABLE_COLUMNS.associations),
    readOptionalTable<Record<string, unknown>>(supabase, "association_members", TABLE_COLUMNS.association_members),
    readOptionalTable<Record<string, unknown>>(supabase, "association_memberships", TABLE_COLUMNS.association_memberships),
    readOptionalTable<Record<string, unknown>>(supabase, "validation_results", TABLE_COLUMNS.validation_results),
    readOptionalTable<Record<string, unknown>>(supabase, "compliance_profiles", TABLE_COLUMNS.compliance_profiles),
    readOptionalTable<Record<string, unknown>>(supabase, "activity_logs", TABLE_COLUMNS.activity_logs, 2000),
    readOptionalTable<Record<string, unknown>>(supabase, "admin_internal_notes", TABLE_COLUMNS.admin_internal_notes, 1000),
    readOptionalTable<Record<string, unknown>>(supabase, "invoices", TABLE_COLUMNS.invoices),
    readOptionalTable<Record<string, unknown>>(supabase, "invoice_events", TABLE_COLUMNS.invoice_events, 2000),
  ]);

  sources.msmes = msmesResult.source;
  sources.digital_identity_credentials = credentialsResult.source;
  sources.credential_events = credentialEventsResult.source;
  sources.msme_compliance_profiles = complianceProfilesResult.source;
  sources.msme_compliance_items = complianceItemsResult.source;
  sources.compliance_events = complianceEventsResult.source;
  sources.compliance_documents = complianceDocumentsResult.source;
  sources.compliance_document_events = complianceDocumentEventsResult.source;
  sources.complaints = complaintsResult.source;
  sources.complaint_status_history = complaintHistoryResult.source;
  sources.associations = associationsResult.source;
  sources.association_members = associationMembersResult.source;
  sources.association_memberships = associationMembershipsResult.source;
  sources.validation_results = validationResult.source;
  sources.compliance_profiles = legacyComplianceResult.source;
  sources.activity_logs = activityLogsResult.source;
  sources.admin_internal_notes = internalNotesResult.source;
  sources.invoices = invoicesResult.source;
  sources.invoice_events = invoiceEventsResult.source;

  const msme = msmesResult.rows.find((row) => asString(row.id) === normalizedMsmeId || asString(row.msme_id) === normalizedMsmeId);
  if (!msme?.id) {
    console.info("[admin-msme-registry]", {
      operation: "get_admin_msme_detail",
      msmeId: normalizedMsmeId,
      sourceAvailability: Object.fromEntries(Object.entries(sources).map(([source, state]) => [source, state.available])),
      supabaseErrorCode: null,
      supabaseErrorMessage: null,
    });
    return null;
  }

  const id = asString(msme.id);
  const credentials = credentialsResult.rows
    .filter((row) => asString(row.msme_id) === id)
    .sort((a, b) => (Date.parse(asString(b.updated_at ?? b.created_at)) || 0) - (Date.parse(asString(a.updated_at ?? a.created_at)) || 0));
  const credential = credentials[0];
  const credentialId = asString(credential?.id);
  const credentialEvents = credentialEventsResult.rows.filter((row) => credentialId && asString(row.credential_id) === credentialId);
  const latestCredentialEvent = sortLatestTimeline(
    credentialEvents.map((row) => timelineItem("credential_events", row, asString(row.action) || "credential_event", `Credential ${asString(row.action) || "event"}`)),
    1,
  )[0] ?? null;

  const compliance = latestByMsme(complianceProfilesResult.rows, "updated_at").get(id);
  const legacyCompliance = latestByMsme(legacyComplianceResult.rows, "last_reviewed_at").get(id);
  const validation = latestByMsme(validationResult.rows, "validated_at").get(id);
  const complianceItems = complianceItemsResult.rows.filter((row) => asString(row.msme_id) === id);
  const complianceEvents = complianceEventsResult.rows.filter((row) => asString(row.msme_id) === id);
  const complianceDocumentEvents = complianceDocumentEventsResult.rows.filter((row) => asString(row.msme_id) === id);
  const evidenceRows = complianceDocumentsResult.rows.filter((row) => asString(row.msme_id) === id && row.is_deleted !== true);

  const complaintRows = complaintsResult.rows.filter((row) => [asString(row.msme_id), asString(row.provider_msme_id)].includes(id));
  const complaintIds = new Set(complaintRows.map((row) => asString(row.id)).filter(Boolean));
  const complaintCounts = buildComplaintCounts(complaintRows).get(id);
  const complaintHistory = complaintHistoryResult.rows.filter((row) => complaintIds.has(asString(row.complaint_id)));
  const latestComplaintReferences = complaintRows
    .slice()
    .sort((a, b) => (Date.parse(asString(b.created_at)) || 0) - (Date.parse(asString(a.created_at)) || 0))
    .slice(0, 5)
    .map((row) => ({
      id: asString(row.id),
      reference: asString(row.complaint_reference ?? row.reference_code) || asString(row.id).slice(0, 8),
      status: normalizeStatus(asString(row.status), "submitted"),
      severity: asString(row.severity ?? row.priority) || null,
      createdAt: asString(row.created_at) || null,
    }));

  const associationId = asString(msme.association_id) || null;
  const association = associationId ? associationsResult.rows.find((row) => asString(row.id) === associationId) : null;
  const associationMembers = associationMembersResult.rows.filter((row) => asString(row.msme_id) === id || (associationId && asString(row.association_id) === associationId && asString(row.msme_id) === id));
  const associationMemberships = associationMembershipsResult.rows.filter((row) => asString(row.msme_id) === id || (associationId && asString(row.association_id) === associationId && asString(row.msme_id) === id));
  const associationStatus = asString(associationMemberships[0]?.approval_status ?? associationMembers[0]?.member_status ?? associationMembers[0]?.invite_status) || null;
  const associationSource = associationMemberships.length ? "association_memberships" : associationMembers.length ? "association_members" : associationId ? "msmes.association_id" : null;

  const invoices = invoicesResult.rows.filter((row) => asString(row.msme_id) === id);
  const invoiceIds = new Set(invoices.map((row) => asString(row.id)).filter(Boolean));
  const invoiceEvents = invoiceEventsResult.rows.filter((row) => invoiceIds.has(asString(row.invoice_id)));
  const activityLogs = activityLogsResult.rows.filter((row) => {
    const metadata = row.metadata;
    const metadataMsmeId = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? asString((metadata as Record<string, unknown>).msme_id) : "";
    return asString(row.entity_id) === id || metadataMsmeId === id;
  });
  const internalNotes = internalNotesResult.rows
    .filter((row) => asString(row.msme_id) === id)
    .sort((a, b) => (Date.parse(asString(b.created_at)) || 0) - (Date.parse(asString(a.created_at)) || 0))
    .slice(0, 10)
    .map((row) => ({
      id: asString(row.id),
      authorRole: asString(row.author_role) || null,
      noteBody: asString(row.note_body),
      createdAt: asString(row.created_at) || null,
    }));

  const complianceTimeline = [
    ...complianceEvents.map((row) => timelineItem("compliance_events", row, asString(row.event_type) || "compliance_event", "Compliance event recorded")),
    ...complianceDocumentEvents.map((row) => timelineItem("compliance_document_events", row, asString(row.event_type) || "document_event", "Compliance document event recorded")),
  ];

  const row = detailRowFromSources({
    msme,
    credential,
    compliance,
    legacyCompliance,
    validation,
    complaints: sources.complaints.available ? complaintCounts ?? { total: 0, open: 0 } : undefined,
    complianceItemsCount: sources.msme_compliance_items.available ? complianceItems.length : null,
    associationName: associationId ? asString(association?.name) || "Unavailable" : null,
  });

  const timeline = sortLatestTimeline([
    ...activityLogs.map((item) => timelineItem("activity_logs", item, asString(item.action) || "activity", `Activity: ${asString(item.action) || "recorded"}`)),
    ...internalNotes.map((item) => ({
      id: item.id,
      eventType: "internal_note_added",
      date: item.createdAt,
      source: "admin_internal_notes" as const,
      summary: `Internal note added by ${item.authorRole ?? "admin"}`,
    })),
    ...credentialEvents.map((item) => timelineItem("credential_events", item, asString(item.action) || "credential_event", `Credential ${asString(item.action) || "event"}`)),
    ...complianceTimeline,
    ...complaintHistory.map((item) => timelineItem("complaint_status_history", item, asString(item.to_status) || "complaint_status", `Complaint status changed to ${asString(item.to_status) || "updated"}`)),
    ...invoiceEvents.map((item) => timelineItem("invoice_events", item, asString(item.event_type) || "invoice_event", `Invoice event: ${asString(item.event_type) || "recorded"}`)),
  ]);

  const detail: AdminMsmeDetail = {
    row,
    credential: {
      id: credentialId || null,
      status: normalizeStatus(asString(credential?.status), "") || null,
      ndmiiId: asString(credential?.ndmii_id) || null,
      issuedAt: asString(credential?.issued_at) || null,
      approvedAt: asString(credential?.approved_at) || null,
      revokedAt: asString(credential?.revoked_at) || null,
      suspendedAt: asString(credential?.suspended_at) || null,
      expiresAt: asString(credential?.token_expires_at) || null,
      tokenExists: Object.prototype.hasOwnProperty.call(credential ?? {}, "public_token_hash") ? Boolean(asString(credential?.public_token_hash)) : null,
      latestEvent: latestCredentialEvent,
    },
    compliance: {
      profileStatus: row.complianceStatus,
      score: row.complianceScore,
      riskLevel: row.complianceRiskLevel,
      approvedCount: Number.isFinite(Number(compliance?.approved_count)) ? Number(compliance?.approved_count) : sources.msme_compliance_items.available ? countByStatus(complianceItems, "approved") : null,
      pendingCount: Number.isFinite(Number(compliance?.pending_count)) ? Number(compliance?.pending_count) : sources.msme_compliance_items.available ? countByStatus(complianceItems, "pending") + countByStatus(complianceItems, "not_started") : null,
      underReviewCount: Number.isFinite(Number(compliance?.under_review_count)) ? Number(compliance?.under_review_count) : sources.msme_compliance_items.available ? countByStatus(complianceItems, "under_review") : null,
      submittedCount: sources.msme_compliance_items.available ? countByStatus(complianceItems, "submitted") : null,
      rejectedCount: Number.isFinite(Number(compliance?.rejected_count)) ? Number(compliance?.rejected_count) : sources.msme_compliance_items.available ? countByStatus(complianceItems, "rejected") : null,
      changesRequestedCount: Number.isFinite(Number(compliance?.changes_requested_count)) ? Number(compliance?.changes_requested_count) : sources.msme_compliance_items.available ? countByStatus(complianceItems, "changes_requested") : null,
      expiredCount: Number.isFinite(Number(compliance?.expired_count)) ? Number(compliance?.expired_count) : sources.msme_compliance_items.available ? countByStatus(complianceItems, "expired") : null,
      expiringSoonCount: Number.isFinite(Number(compliance?.expiring_soon_count)) ? Number(compliance?.expiring_soon_count) : sources.msme_compliance_items.available ? countByStatus(complianceItems, "expiring_soon") : null,
      evidenceCount: sources.compliance_documents.available ? evidenceRows.length : null,
      latestEvents: sortLatestTimeline(complianceTimeline, 5),
    },
    complaints: {
      count: sources.complaints.available ? complaintRows.length : null,
      openCount: sources.complaints.available ? complaintRows.filter((item) => !CLOSED_COMPLAINT_STATUSES.has(normalizeStatus(asString(item.status), "submitted"))).length : null,
      highestSeverity: complaintRows
        .map((item) => asString(item.severity ?? item.priority))
        .sort((a, b) => severityRank(b) - severityRank(a))[0] || null,
      latestReferences: latestComplaintReferences,
    },
    association: {
      id: associationId,
      name: associationId ? asString(association?.name) || "Unavailable" : null,
      membershipStatus: associationStatus,
      source: associationSource,
      memberRecordCount: sources.association_members.available || sources.association_memberships.available ? associationMembers.length + associationMemberships.length : null,
    },
    verification: {
      validationSummaries: [
        { label: "NIN adapter", value: asString(validation?.nin_status) || null },
        { label: "BVN adapter", value: asString(validation?.bvn_status) || null },
        { label: "CAC adapter", value: asString(validation?.cac_status) || null },
        { label: "TIN adapter", value: asString(validation?.tin_status) || null },
        { label: "Validation summary", value: asString(validation?.validation_summary) || null },
      ],
      legacyComplianceStatus: asString(legacyCompliance?.overall_status) || null,
      legacyComplianceScore: Number.isFinite(Number(legacyCompliance?.score)) ? Number(legacyCompliance?.score) : null,
      legacyComplianceRiskLevel: asString(legacyCompliance?.risk_level) || null,
    },
    timeline,
    internalNotes,
    duplicateSignals: buildDuplicateSignals(msme, msmesResult.rows),
    sources,
    diagnostics: {
      operation: "get_admin_msme_detail",
      msmeId: id,
      sourceAvailability: Object.fromEntries(Object.entries(sources).map(([source, state]) => [source, state.available])),
      supabaseErrorCode: null,
      supabaseErrorMessage: null,
    },
  };

  console.info("[admin-msme-registry]", detail.diagnostics);
  return detail;
}

export function registryFiltersForDiagnostics(filters: AdminMsmeRegistryFilters) {
  return {
    hasSearch: asString(filters.q) ? "true" : "false",
    state: filters.state || null,
    sector: filters.sector || null,
    verificationStatus: filters.verificationStatus || null,
    reviewStatus: filters.reviewStatus || null,
    complianceStatus: filters.complianceStatus || null,
    digitalIdStatus: filters.digitalIdStatus || null,
    associationId: filters.associationId || null,
    flagged: filters.flagged || null,
    suspended: filters.suspended || null,
    createdFrom: filters.createdFrom || null,
    createdTo: filters.createdTo || null,
    page: filters.page ?? null,
    pageSize: filters.pageSize ?? null,
    exportAll: filters.exportAll ? "true" : null,
  };
}

export function csvValue(value: unknown) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildAdminMsmeRegistryCsv(rows: AdminMsmeRegistryRow[]) {
  const header = [
    "Business Name",
    "MSME ID / BIN",
    "Owner Name",
    "State",
    "LGA",
    "Sector",
    "Business Type",
    "Verification Status",
    "Review Status",
    "Compliance Status",
    "Digital ID Status",
    "Digital ID",
    "Complaint Count",
    "Open Complaints",
    "Association",
    "Created At",
    "Flagged",
    "Suspended",
    "Review Requested",
    "Escalated",
    "Last Operational Action",
    "Contact Email",
    "Contact Phone",
    "CAC",
    "TIN",
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
      row.businessType,
      row.verificationStatus,
      row.reviewStatus,
      row.complianceStatus ?? "Unavailable",
      row.digitalIdStatus ?? "Unavailable",
      row.digitalId ?? "Unavailable",
      row.complaintCount ?? "Unavailable",
      row.openComplaintCount ?? "Unavailable",
      row.associationName ?? "Not linked",
      row.createdAt,
      row.flagged ? "Yes" : "No",
      row.suspended ? "Yes" : "No",
      row.reviewRequested ? "Yes" : "No",
      row.escalated ? "Yes" : "No",
      row.latestAdminAction ?? "",
      row.contactEmailMasked ?? "",
      row.contactPhoneMasked ?? "",
      row.cacMasked ?? "",
      row.tinMasked ?? "",
    ].map(csvValue).join(",")),
  ].join("\r\n");
}
