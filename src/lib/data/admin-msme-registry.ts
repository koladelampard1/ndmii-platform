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
  | "msme_compliance_profiles"
  | "msme_compliance_items"
  | "complaints"
  | "associations"
  | "association_members"
  | "validation_results"
  | "compliance_profiles"
  | "activity_logs";

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
  ],
  digital_identity_credentials: ["id", "msme_id", "ndmii_id", "status", "issued_at", "approved_at", "suspended_at", "created_at"],
  msme_compliance_profiles: ["msme_id", "overall_status", "compliance_score", "risk_level", "updated_at"],
  msme_compliance_items: ["id", "msme_id", "status"],
  complaints: ["id", "msme_id", "provider_msme_id", "status"],
  associations: ["id", "name"],
  association_members: ["id", "association_id", "msme_id"],
  validation_results: ["msme_id", "confidence_score", "validation_summary", "validated_at", "nin_status", "bvn_status", "cac_status", "tin_status"],
  compliance_profiles: ["msme_id", "overall_status", "score", "risk_level", "nin_status", "bvn_status", "cac_status", "tin_status"],
  activity_logs: ["id", "actor_user_id", "action", "entity_type", "entity_id", "metadata", "created_at"],
};

const REQUIRED_TABLE_COLUMNS: Record<RegistrySourceName, string[]> = {
  msmes: ["id", "msme_id", "business_name", "owner_name", "state", "sector", "verification_status", "association_id", "created_at"],
  digital_identity_credentials: ["id", "msme_id", "ndmii_id", "status"],
  msme_compliance_profiles: ["msme_id", "overall_status"],
  msme_compliance_items: ["id", "msme_id", "status"],
  complaints: ["id", "msme_id", "status"],
  associations: ["id", "name"],
  association_members: ["id", "association_id", "msme_id"],
  validation_results: ["msme_id", "confidence_score"],
  compliance_profiles: ["msme_id", "overall_status"],
  activity_logs: ["id", "action", "entity_type"],
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
      row.contactEmailMasked ?? "",
      row.contactPhoneMasked ?? "",
      row.cacMasked ?? "",
      row.tinMasked ?? "",
    ].map(csvValue).join(",")),
  ].join("\r\n");
}
