import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const ASSOCIATION_MEMBER_STATUSES = [
  "imported",
  "pending_review",
  "pending_activation",
  "active",
  "rejected",
  "duplicate_review",
  "orphaned",
] as const;

export const ASSOCIATION_MEMBER_ACTIVATION_STATES = [
  "imported",
  "invited",
  "account_created",
  "onboarding_started",
  "onboarding_completed",
  "credential_issued",
] as const;

type SupabaseClient = Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>;
type AnyRow = Record<string, unknown>;

export type AdminAssociationMemberFilters = {
  association?: string;
  status?: string;
  duplicate?: string;
  q?: string;
  page?: string | number;
  pageSize?: string | number;
};

export type AdminAssociationMemberRow = {
  id: string;
  fullName: string | null;
  businessName: string | null;
  tradeType: string | null;
  phone: string | null;
  email: string | null;
  lga: string | null;
  associationId: string | null;
  associationName: string | null;
  importSource: string | null;
  status: string | null;
  duplicateSignal: boolean;
  duplicateReasons: string[];
  activationState: string | null;
  linkedMsme: string | null;
  createdAt: string | null;
};

export type AdminAssociationMembersWorkspace = {
  associations: Array<{ id: string; name: string; state: string | null; sector: string | null }>;
  rows: AdminAssociationMemberRow[];
  filters: {
    association: string;
    status: string;
    duplicate: string;
    q: string;
    page: number;
    pageSize: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number | null;
    totalPages: number | null;
  };
  counts: {
    total: number | null;
    duplicateReview: number | null;
    pendingActivation: number | null;
    active: number | null;
  };
  sources: Record<string, { available: boolean; message?: string }>;
};

type ProcessedMemberRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: {
    fullName: string | null;
    phoneNumber: string | null;
    phoneNormalized: string | null;
    businessName: string | null;
    tradeType: string | null;
    lga: string | null;
    whatsappNumber: string | null;
    email: string | null;
    associationMembershipNumber: string | null;
    positionInAssociation: string | null;
    cacRegistered: boolean;
    cacNumber: string | null;
    tinRegistered: boolean;
    tinNumber: string | null;
    workshopAddress: string | null;
    yearsOfExperience: number | null;
  };
  errors: string[];
  duplicateReasons: string[];
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const EXPORT_LIMIT = 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_HEADERS = ["full_name", "phone_number", "business_name", "trade_type", "lga"];
const OPTIONAL_HEADERS = [
  "whatsapp_number",
  "email",
  "association_membership_number",
  "position_in_association",
  "cac_registered",
  "cac_number",
  "tin_registered",
  "tin_number",
  "workshop_address",
  "years_of_experience",
];

function toString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableString(value: unknown) {
  const stringValue = toString(value).trim();
  return stringValue || null;
}

function toBooleanYes(value: string | null) {
  return ["yes", "true", "1", "y"].includes((value ?? "").trim().toLowerCase());
}

function sourceUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "Source unavailable.";
  return { available: false, message };
}

function sourceAvailable() {
  return { available: true };
}

export function maskEmail(email: string | null) {
  if (!email) return null;
  const [name, domain] = email.split("@");
  if (!name || !domain) return "Masked email";
  const prefix = name.slice(0, Math.min(2, name.length));
  return `${prefix}${"*".repeat(Math.max(2, name.length - prefix.length))}@${domain}`;
}

export function maskPhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "Masked phone";
  return `${phone.slice(0, Math.min(4, phone.length))}****${digits.slice(-3)}`;
}

export function maskIdentifier(value: string | null) {
  if (!value) return null;
  const clean = value.trim();
  if (clean.length <= 4) return "****";
  return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
}

export function normalizePhone(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.length === 13 && digits.startsWith("234")) return `+${digits}`;
  if (digits.length === 10) return `+234${digits}`;
  return digits.length >= 7 ? `+${digits}` : null;
}

function parsePositiveInteger(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function rowsFromCsv(csv: string) {
  const rows = parseCsvRows(csv);
  const header = rows[0]?.map(normalizeHeader) ?? [];
  const hasCanonicalHeader = REQUIRED_HEADERS.some((field) => header.includes(field));
  const dataRows = hasCanonicalHeader ? rows.slice(1) : rows;
  const fields = hasCanonicalHeader
    ? header
    : ["full_name", "phone_number", "business_name", "trade_type", "lga", ...OPTIONAL_HEADERS];

  return dataRows.map((cols, index) => {
    const raw: Record<string, string> = {};
    fields.forEach((field, fieldIndex) => {
      raw[field] = cols[fieldIndex]?.trim() ?? "";
    });
    return { rowNumber: index + 1, raw };
  });
}

function validateRow(rowNumber: number, raw: Record<string, string>): Omit<ProcessedMemberRow, "duplicateReasons"> {
  const fullName = nullableString(raw.full_name);
  const phoneNumber = nullableString(raw.phone_number);
  const phoneNormalized = normalizePhone(phoneNumber);
  const businessName = nullableString(raw.business_name);
  const tradeType = nullableString(raw.trade_type);
  const lga = nullableString(raw.lga);
  const email = nullableString(raw.email)?.toLowerCase() ?? null;
  const cacRegistered = toBooleanYes(nullableString(raw.cac_registered));
  const tinRegistered = toBooleanYes(nullableString(raw.tin_registered));
  const cacNumber = nullableString(raw.cac_number)?.toUpperCase() ?? null;
  const tinNumber = nullableString(raw.tin_number)?.toUpperCase() ?? null;
  const errors: string[] = [];

  if (!fullName) errors.push("full_name is required.");
  if (!phoneNumber) errors.push("phone_number is required.");
  if (phoneNumber && !phoneNormalized) errors.push("phone_number must be a valid phone number.");
  if (!businessName) errors.push("business_name is required.");
  if (!tradeType) errors.push("trade_type is required.");
  if (!lga) errors.push("lga is required.");
  if (email && !EMAIL_PATTERN.test(email)) errors.push("email format is invalid.");
  if (cacRegistered && !cacNumber) errors.push("cac_number is required when cac_registered is yes.");
  if (tinRegistered && !tinNumber) errors.push("tin_number is required when tin_registered is yes.");

  return {
    rowNumber,
    raw,
    normalized: {
      fullName,
      phoneNumber,
      phoneNormalized,
      businessName,
      tradeType,
      lga,
      whatsappNumber: nullableString(raw.whatsapp_number),
      email,
      associationMembershipNumber: nullableString(raw.association_membership_number),
      positionInAssociation: nullableString(raw.position_in_association),
      cacRegistered,
      cacNumber,
      tinRegistered,
      tinNumber,
      workshopAddress: nullableString(raw.workshop_address),
      yearsOfExperience: parsePositiveInteger(nullableString(raw.years_of_experience)),
    },
    errors,
  };
}

async function duplicateReasonsForRow(supabase: SupabaseClient, row: Omit<ProcessedMemberRow, "duplicateReasons">) {
  const reasons = new Set<string>();
  const normalized = row.normalized;

  const checks: Array<{ reason: string; apply: (query: any) => any; enabled: boolean }> = [
    {
      reason: "phone",
      enabled: Boolean(normalized.phoneNormalized),
      apply: (query) => query.eq("phone_normalized", normalized.phoneNormalized),
    },
    {
      reason: "email",
      enabled: Boolean(normalized.email),
      apply: (query) => query.ilike("email", normalized.email),
    },
    {
      reason: "CAC",
      enabled: Boolean(normalized.cacNumber),
      apply: (query) => query.eq("cac_number", normalized.cacNumber),
    },
    {
      reason: "TIN",
      enabled: Boolean(normalized.tinNumber),
      apply: (query) => query.eq("tin_number", normalized.tinNumber),
    },
    {
      reason: "business_name+lga",
      enabled: Boolean(normalized.businessName && normalized.lga),
      apply: (query) => query.ilike("business_name", normalized.businessName).ilike("lga", normalized.lga),
    },
  ];

  for (const check of checks) {
    if (!check.enabled) continue;
    const { data, error } = await check.apply(supabase.from("association_members").select("id").limit(1));
    if (!error && (data ?? []).length > 0) reasons.add(check.reason);
  }

  return [...reasons];
}

async function writeMemberEvent(
  supabase: SupabaseClient,
  params: {
    associationId: string;
    actorUserId: string | null;
    eventType: string;
    memberId?: string | null;
    importId?: string | null;
    importRowId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const payload = {
    association_id: params.associationId,
    association_member_id: params.memberId ?? null,
    import_id: params.importId ?? null,
    import_row_id: params.importRowId ?? null,
    actor_user_id: params.actorUserId,
    event_type: params.eventType,
    metadata: params.metadata ?? {},
  };

  const { error } = await supabase.from("association_member_events").insert(payload);
  if (error) {
    console.info("[admin-association-members:event-failed]", {
      operation: params.eventType,
      associationId: params.associationId,
      importId: params.importId ?? null,
      code: error.code ?? null,
      message: error.message,
    });
  }
}

export async function processAssociationMemberUpload(params: {
  associationId: string;
  actorUserId: string | null;
  fileName: string;
  csvContent: string;
}) {
  const supabase = await createServiceRoleSupabaseClient();
  const parsedRows = rowsFromCsv(params.csvContent);

  const { data: association, error: associationError } = await supabase
    .from("associations")
    .select("id")
    .eq("id", params.associationId)
    .maybeSingle();

  if (associationError || !association?.id) {
    console.info("[admin-association-members:association-not-found]", {
      operation: "process_upload",
      associationId: params.associationId,
      rowCount: parsedRows.length,
      code: associationError?.code ?? null,
      message: associationError?.message ?? "Association not found.",
    });
    throw new Error("Association not found.");
  }

  const { data: importRecord, error: importError } = await supabase
    .from("association_member_imports")
    .insert({
      association_id: params.associationId,
      uploaded_by: params.actorUserId,
      file_name: params.fileName,
      total_rows: parsedRows.length,
      status: "processing",
      notes: "Phase 2 operational upload. Creates pending member records only; no MSMEs or credentials are issued.",
      metadata: { operation: "association_member_operations" },
    })
    .select("id")
    .maybeSingle();

  if (importError || !importRecord?.id) {
    console.info("[admin-association-members:import-create-failed]", {
      operation: "create_import_job",
      associationId: params.associationId,
      rowCount: parsedRows.length,
      code: importError?.code ?? null,
      message: importError?.message ?? "Import creation returned no row.",
    });
    throw new Error("Unable to create import job.");
  }

  await writeMemberEvent(supabase, {
    associationId: params.associationId,
    actorUserId: params.actorUserId,
    eventType: "import_job_created",
    importId: importRecord.id,
    metadata: { row_count: parsedRows.length },
  });

  let errorCount = 0;
  let duplicateCount = 0;
  let createdCount = 0;
  const updatedCount = 0;

  for (const parsedRow of parsedRows) {
    const validated = validateRow(parsedRow.rowNumber, parsedRow.raw);
    const duplicateReasons = validated.errors.length ? [] : await duplicateReasonsForRow(supabase, validated);
    const processed: ProcessedMemberRow = { ...validated, duplicateReasons };
    const duplicateSignal = processed.duplicateReasons.length > 0;
    const rowStatus = processed.errors.length ? "failed" : duplicateSignal ? "duplicate_review" : "imported";
    if (processed.errors.length) errorCount += 1;
    if (duplicateSignal) duplicateCount += 1;

    const rowPayload = {
      import_id: importRecord.id,
      row_number: processed.rowNumber,
      member_name: processed.normalized.fullName,
      full_name: processed.normalized.fullName,
      email: processed.normalized.email,
      phone: processed.normalized.phoneNumber,
      phone_number: processed.normalized.phoneNumber,
      phone_normalized: processed.normalized.phoneNormalized,
      whatsapp_number: processed.normalized.whatsappNumber,
      business_name: processed.normalized.businessName,
      trade_type: processed.normalized.tradeType,
      state: null,
      lga: processed.normalized.lga,
      sector: processed.normalized.tradeType,
      status: rowStatus,
      error_message: processed.errors.join(" "),
      association_membership_number: processed.normalized.associationMembershipNumber,
      position_in_association: processed.normalized.positionInAssociation,
      cac_registered: processed.normalized.cacRegistered,
      cac_number: processed.normalized.cacNumber,
      tin_registered: processed.normalized.tinRegistered,
      tin_number: processed.normalized.tinNumber,
      workshop_address: processed.normalized.workshopAddress,
      years_of_experience: processed.normalized.yearsOfExperience,
      duplicate_signal: duplicateSignal,
      duplicate_reasons: processed.duplicateReasons,
      raw_payload: processed.raw,
      validated_at: new Date().toISOString(),
    };

    const { data: importRow, error: rowError } = await supabase
      .from("association_member_import_rows")
      .insert(rowPayload)
      .select("id")
      .maybeSingle();

    if (rowError || !importRow?.id) {
      errorCount += processed.errors.length ? 0 : 1;
      console.info("[admin-association-members:row-create-failed]", {
        operation: "create_import_row",
        associationId: params.associationId,
        importId: importRecord.id,
        rowCount: parsedRows.length,
        code: rowError?.code ?? null,
        message: rowError?.message ?? "Import row creation returned no row.",
      });
      continue;
    }

    await writeMemberEvent(supabase, {
      associationId: params.associationId,
      actorUserId: params.actorUserId,
      eventType: "row_validated",
      importId: importRecord.id,
      importRowId: importRow.id,
      metadata: {
        row_number: processed.rowNumber,
        status: rowStatus,
        duplicate_signal: duplicateSignal,
        error_count: processed.errors.length,
      },
    });

    if (processed.errors.length) continue;

    const memberStatus = duplicateSignal ? "duplicate_review" : "pending_activation";
    const memberPayload = {
      association_id: params.associationId,
      msme_id: null,
      full_name: processed.normalized.fullName,
      phone_number: processed.normalized.phoneNumber,
      phone_normalized: processed.normalized.phoneNormalized,
      whatsapp_number: processed.normalized.whatsappNumber,
      email: processed.normalized.email,
      business_name: processed.normalized.businessName,
      trade_type: processed.normalized.tradeType,
      lga: processed.normalized.lga,
      association_membership_number: processed.normalized.associationMembershipNumber,
      position_in_association: processed.normalized.positionInAssociation,
      cac_registered: processed.normalized.cacRegistered,
      cac_number: processed.normalized.cacNumber,
      tin_registered: processed.normalized.tinRegistered,
      tin_number: processed.normalized.tinNumber,
      workshop_address: processed.normalized.workshopAddress,
      years_of_experience: processed.normalized.yearsOfExperience,
      source_import_id: importRecord.id,
      source_import_row_id: importRow.id,
      source_row_number: processed.rowNumber,
      member_status: memberStatus,
      is_verified: false,
      invite_status: "PENDING",
      duplicate_signal: duplicateSignal,
      duplicate_reasons: processed.duplicateReasons,
      activation_state: "imported",
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_admin_id: params.actorUserId,
    };

    const { data: member, error: memberError } = await supabase
      .from("association_members")
      .upsert(memberPayload, { onConflict: "source_import_id,source_row_number" })
      .select("id,created_at")
      .maybeSingle();

    if (memberError || !member?.id) {
      errorCount += 1;
      console.info("[admin-association-members:member-upsert-failed]", {
        operation: "upsert_member_record",
        associationId: params.associationId,
        importId: importRecord.id,
        rowCount: parsedRows.length,
        code: memberError?.code ?? null,
        message: memberError?.message ?? "Member upsert returned no row.",
      });
      continue;
    }

    createdCount += 1;
    await supabase
      .from("association_member_import_rows")
      .update({ association_member_id: member.id, updated_at: new Date().toISOString() })
      .eq("id", importRow.id);

    await writeMemberEvent(supabase, {
      associationId: params.associationId,
      actorUserId: params.actorUserId,
      eventType: "member_record_created",
      memberId: member.id,
      importId: importRecord.id,
      importRowId: importRow.id,
      metadata: { status: memberStatus, activation_state: "imported" },
    });

    if (duplicateSignal) {
      await writeMemberEvent(supabase, {
        associationId: params.associationId,
        actorUserId: params.actorUserId,
        eventType: "duplicate_flagged",
        memberId: member.id,
        importId: importRecord.id,
        importRowId: importRow.id,
        metadata: { duplicate_reasons: processed.duplicateReasons },
      });
    }
  }

  const { error: updateImportError } = await supabase
    .from("association_member_imports")
    .update({
      success_rows: Math.max(0, parsedRows.length - errorCount),
      failed_rows: errorCount,
      duplicate_rows: duplicateCount,
      created_rows: createdCount,
      updated_rows: updatedCount,
      status: "completed",
      notes: `Operational records created: ${createdCount}. Duplicates flagged: ${duplicateCount}. Errors: ${errorCount}. No MSMEs or credentials were issued.`,
    })
    .eq("id", importRecord.id);

  if (updateImportError) {
    console.info("[admin-association-members:import-update-failed]", {
      operation: "complete_import_job",
      associationId: params.associationId,
      importId: importRecord.id,
      rowCount: parsedRows.length,
      createdCount,
      duplicateCount,
      errorCount,
      code: updateImportError.code ?? null,
      message: updateImportError.message,
    });
  }

  return {
    importId: importRecord.id as string,
    rowCount: parsedRows.length,
    createdCount,
    updatedCount,
    duplicateCount,
    errorCount,
  };
}

export function parseAssociationMemberFilters(filters: AdminAssociationMemberFilters) {
  const page = Math.max(1, Number.parseInt(String(filters.page ?? "1"), 10) || 1);
  const requestedPageSize = Number.parseInt(String(filters.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  return {
    association: toString(filters.association).trim(),
    status: toString(filters.status).trim(),
    duplicate: toString(filters.duplicate).trim(),
    q: toString(filters.q).trim(),
    page,
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(5, requestedPageSize)),
  };
}

function applyMemberFilters(query: any, filters: ReturnType<typeof parseAssociationMemberFilters>) {
  let next = query;
  if (filters.association) next = next.eq("association_id", filters.association);
  if (filters.status) next = next.eq("member_status", filters.status);
  if (filters.duplicate === "yes") next = next.eq("duplicate_signal", true);
  if (filters.duplicate === "no") next = next.eq("duplicate_signal", false);
  if (filters.q) {
    next = next.or(
      `full_name.ilike.%${filters.q}%,business_name.ilike.%${filters.q}%,trade_type.ilike.%${filters.q}%,lga.ilike.%${filters.q}%,phone_normalized.ilike.%${filters.q}%,email.ilike.%${filters.q}%`,
    );
  }
  return next;
}

async function safeCount(supabase: SupabaseClient, apply?: (query: any) => any) {
  try {
    let query = supabase.from("association_members").select("id", { count: "exact", head: true });
    if (apply) query = apply(query);
    const { count, error } = await query;
    if (error) return { count: null, source: sourceUnavailable(new Error(error.message)) };
    return { count: count ?? 0, source: sourceAvailable() };
  } catch (error) {
    return { count: null, source: sourceUnavailable(error) };
  }
}

function mapMemberRow(row: AnyRow): AdminAssociationMemberRow {
  const association = row.associations as AnyRow | null | undefined;
  const msme = row.msmes as AnyRow | null | undefined;
  const importRow = row.association_member_imports as AnyRow | null | undefined;
  const duplicateReasons = Array.isArray(row.duplicate_reasons)
    ? row.duplicate_reasons.map((item) => toString(item)).filter(Boolean)
    : [];

  return {
    id: toString(row.id),
    fullName: nullableString(row.full_name),
    businessName: nullableString(row.business_name) ?? nullableString(msme?.business_name),
    tradeType: nullableString(row.trade_type),
    phone: maskPhone(nullableString(row.phone_number)),
    email: maskEmail(nullableString(row.email)),
    lga: nullableString(row.lga),
    associationId: nullableString(row.association_id),
    associationName: nullableString(association?.name),
    importSource: nullableString(importRow?.file_name) ?? nullableString(row.source_import_id),
    status: nullableString(row.member_status),
    duplicateSignal: Boolean(row.duplicate_signal),
    duplicateReasons,
    activationState: nullableString(row.activation_state),
    linkedMsme: nullableString(msme?.msme_id),
    createdAt: nullableString(row.created_at),
  };
}

export async function getAdminAssociationMembersWorkspace(
  filtersInput: AdminAssociationMemberFilters,
): Promise<AdminAssociationMembersWorkspace> {
  const supabase = await createServiceRoleSupabaseClient();
  const filters = parseAssociationMemberFilters(filtersInput);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  const [associationsResult, membersResult, totalCount, duplicateCount, pendingCount, activeCount] = await Promise.all([
    supabase.from("associations").select("id,name,state,sector").order("name", { ascending: true }).limit(500),
    applyMemberFilters(
      supabase
        .from("association_members")
        .select(
          "id,association_id,msme_id,full_name,phone_number,email,business_name,trade_type,lga,member_status,duplicate_signal,duplicate_reasons,activation_state,source_import_id,created_at,associations(name),msmes(msme_id,business_name),association_member_imports:source_import_id(file_name)",
          { count: "exact" },
        ),
      filters,
    )
      .order("created_at", { ascending: false })
      .range(from, to),
    safeCount(supabase),
    safeCount(supabase, (query) => query.eq("duplicate_signal", true)),
    safeCount(supabase, (query) => query.eq("member_status", "pending_activation")),
    safeCount(supabase, (query) => query.eq("member_status", "active")),
  ]);

  const associationsSource = associationsResult.error
    ? sourceUnavailable(new Error(associationsResult.error.message))
    : sourceAvailable();
  const membersSource = membersResult.error
    ? sourceUnavailable(new Error(membersResult.error.message))
    : sourceAvailable();
  const rows = membersResult.error ? [] : ((membersResult.data ?? []) as unknown as AnyRow[]).map(mapMemberRow);
  const total = membersResult.error ? null : membersResult.count ?? 0;

  return {
    associations: ((associationsResult.data ?? []) as AnyRow[]).map((row) => ({
      id: toString(row.id),
      name: toString(row.name) || "Unnamed association",
      state: nullableString(row.state),
      sector: nullableString(row.sector),
    })),
    rows,
    filters,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total == null ? null : Math.max(1, Math.ceil(total / filters.pageSize)),
    },
    counts: {
      total: totalCount.count,
      duplicateReview: duplicateCount.count,
      pendingActivation: pendingCount.count,
      active: activeCount.count,
    },
    sources: {
      associations: associationsSource,
      association_members: membersSource,
      total_count: totalCount.source,
      duplicate_count: duplicateCount.source,
      pending_activation_count: pendingCount.source,
      active_count: activeCount.source,
    },
  };
}

export async function getAssociationMemberExportRows(filtersInput: AdminAssociationMemberFilters) {
  const supabase = await createServiceRoleSupabaseClient();
  const filters = parseAssociationMemberFilters({ ...filtersInput, page: 1, pageSize: EXPORT_LIMIT });
  const query = applyMemberFilters(
    supabase
      .from("association_members")
      .select(
        "id,association_id,msme_id,full_name,phone_number,email,business_name,trade_type,lga,member_status,duplicate_signal,duplicate_reasons,activation_state,source_import_id,created_at,associations(name),msmes(msme_id,business_name),association_member_imports:source_import_id(file_name)",
      ),
    filters,
  )
    .order("created_at", { ascending: false })
    .limit(EXPORT_LIMIT);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as AnyRow[]).map(mapMemberRow);
}

function csvEscape(value: string | null | boolean | string[]) {
  const stringValue = Array.isArray(value) ? value.join("; ") : value == null ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function buildAssociationMembersCsv(rows: AdminAssociationMemberRow[]) {
  const headers = [
    "member_name",
    "business_name",
    "trade_type",
    "phone_masked",
    "email_masked",
    "lga",
    "association",
    "import_source",
    "status",
    "duplicate_signal",
    "duplicate_reasons",
    "activation_state",
    "linked_msme",
    "created_at",
  ];

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.fullName,
        row.businessName,
        row.tradeType,
        row.phone,
        row.email,
        row.lga,
        row.associationName,
        row.importSource,
        row.status,
        row.duplicateSignal,
        row.duplicateReasons,
        row.activationState,
        row.linkedMsme,
        row.createdAt,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\r\n");
}

export function associationMemberFiltersForDiagnostics(filters: AdminAssociationMemberFilters) {
  const parsed = parseAssociationMemberFilters(filters);
  return {
    associationId: parsed.association || null,
    status: parsed.status || null,
    duplicate: parsed.duplicate || null,
    hasSearch: Boolean(parsed.q),
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}
