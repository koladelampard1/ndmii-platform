import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { isValidEmailAddress, normalizeEmail } from "@/lib/auth/email-validation";

export const ASSOCIATION_MEMBER_STATUSES = [
  "imported",
  "pending_review",
  "approved",
  "rejected",
  "correction_requested",
  "duplicate_review",
  "pending_activation",
  "active",
  "orphaned",
] as const;

export const ASSOCIATION_MEMBER_ACTIVATION_STATES = [
  "imported",
  "invited",
  "invite_opened",
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
  activation?: string;
  invite?: string;
  duplicate?: string;
  lga?: string;
  tradeType?: string;
  reviewer?: string;
  importedFrom?: string;
  importedTo?: string;
  ids?: string;
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
  cac: string | null;
  tin: string | null;
  lga: string | null;
  associationId: string | null;
  associationName: string | null;
  membershipNumber: string | null;
  importSource: string | null;
  status: string | null;
  duplicateSignal: boolean;
  duplicateReasons: string[];
  activationState: string | null;
  inviteStatus: string | null;
  inviteLastDate: string | null;
  inviteExpiry: string | null;
  readiness: AssociationMemberReadiness;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  approvedAt: string | null;
  linkedMsme: string | null;
  createdAt: string | null;
};

export type AdminAssociationMembersWorkspace = {
  associations: Array<{ id: string; name: string; state: string | null; sector: string | null }>;
  reviewers: Array<{ id: string; label: string }>;
  lgas: string[];
  tradeTypes: string[];
  rows: AdminAssociationMemberRow[];
  filters: {
    association: string;
    status: string;
    activation: string;
    invite: string;
    duplicate: string;
    lga: string;
    tradeType: string;
    reviewer: string;
    importedFrom: string;
    importedTo: string;
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
    imported: number | null;
    pendingReview: number | null;
    approved: number | null;
    duplicateReview: number | null;
    correctionRequested: number | null;
    pendingActivation: number | null;
    assignedToMe: number | null;
    unassigned: number | null;
  };
  sources: Record<string, { available: boolean; message?: string }>;
};

export type AssociationMemberReadiness = {
  label: "Ready" | "Needs Attention" | "Blocked";
  blockers: string[];
  attention: string[];
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
const EXPORT_LIMIT = 5000;
export const ASSOCIATION_MEMBER_SELECTED_BULK_LIMIT = 500;
export const ASSOCIATION_MEMBER_FILTERED_BULK_LIMIT = 5000;
export const ASSOCIATION_MEMBER_BULK_CHUNK_SIZE = 250;
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

const SUPPORTED_CSV_DELIMITERS = [",", "\t", ";"] as const;
const INVISIBLE_CSV_FORMAT_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/gu;

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) count += 1;
  }

  return count;
}

export function detectCsvDelimiter(csv: string) {
  const firstLine = csv.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const separatorDirective = firstLine.match(/^sep=(.)$/i);
  if (separatorDirective && SUPPORTED_CSV_DELIMITERS.includes(separatorDirective[1] as (typeof SUPPORTED_CSV_DELIMITERS)[number])) {
    return separatorDirective[1];
  }

  return SUPPORTED_CSV_DELIMITERS.reduce(
    (best, delimiter) => {
      const count = countDelimiter(firstLine, delimiter);
      return count > best.count ? { delimiter, count } : best;
    },
    { delimiter: ",", count: 0 },
  ).delimiter;
}

export function parseCsvRows(csv: string, delimiter = detectCsvDelimiter(csv)) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const content = csv.replace(INVISIBLE_CSV_FORMAT_CHARACTERS, "").replace(/^sep=.\r?\n/i, "");

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
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
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseAssociationMemberUploadRows(csv: string) {
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

export function inspectAssociationMemberUpload(csv: string) {
  const delimiter = detectCsvDelimiter(csv);
  const rows = parseCsvRows(csv, delimiter);
  const headers = rows[0]?.map(normalizeHeader) ?? [];
  return { delimiter, headers };
}

export function validateAssociationMemberUploadRow(
  rowNumber: number,
  raw: Record<string, string>,
  detectedHeaders = Object.keys(raw),
): Omit<ProcessedMemberRow, "duplicateReasons"> {
  const fullName = nullableString(raw.full_name);
  const phoneNumber = nullableString(raw.phone_number);
  const phoneNormalized = normalizePhone(phoneNumber);
  const businessName = nullableString(raw.business_name);
  const tradeType = nullableString(raw.trade_type);
  const lga = nullableString(raw.lga);
  const email = nullableString(normalizeEmail(toString(raw.email)));
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
  const emailIsValid = !email || isValidEmailAddress(email);
  console.info("[admin-association-members:email-validation]", {
    rowNumber,
    detectedHeaders,
    normalizedEmailLength: email?.length ?? 0,
    containsAt: email?.includes("@") ?? false,
    validationResult: emailIsValid,
  });
  if (!emailIsValid) errors.push(`email is malformed for row ${rowNumber} (${maskEmail(email) ?? "empty email"}).`);
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
  const parsedRows = parseAssociationMemberUploadRows(params.csvContent);
  const inspection = inspectAssociationMemberUpload(params.csvContent);

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
      metadata: {
        operation: "association_member_operations",
        detected_delimiter: inspection.delimiter,
        detected_headers: inspection.headers,
      },
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
    const validated = validateAssociationMemberUploadRow(parsedRow.rowNumber, parsedRow.raw, inspection.headers);
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

    const memberStatus = "imported";
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
      metadata: {
        operation: "association_member_operations",
        detected_delimiter: inspection.delimiter,
        detected_headers: inspection.headers,
        row_count: parsedRows.length,
        valid_count: Math.max(0, parsedRows.length - errorCount),
        failed_count: errorCount,
        duplicate_count: duplicateCount,
        operational_records_created: createdCount,
      },
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
    activation: toString(filters.activation).trim(),
    invite: toString(filters.invite).trim(),
    duplicate: toString(filters.duplicate).trim(),
    lga: toString(filters.lga).trim(),
    tradeType: toString(filters.tradeType).trim(),
    reviewer: toString(filters.reviewer).trim(),
    importedFrom: toString(filters.importedFrom).trim(),
    importedTo: toString(filters.importedTo).trim(),
    ids: toString(filters.ids).trim(),
    q: toString(filters.q).trim(),
    page,
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(5, requestedPageSize)),
  };
}

export function applyAssociationMemberFilters(query: any, filters: ReturnType<typeof parseAssociationMemberFilters>) {
  let next = query;
  if (filters.association) next = next.eq("association_id", filters.association);
  if (filters.status) next = next.eq("member_status", filters.status);
  if (filters.activation) next = next.eq("activation_state", filters.activation);
  if (filters.invite === "none") next = next.eq("invite_status", "PENDING");
  else if (filters.invite) next = next.eq("invite_status", filters.invite.toUpperCase());
  if (filters.duplicate === "yes") next = next.eq("duplicate_signal", true);
  if (filters.duplicate === "no") next = next.eq("duplicate_signal", false);
  if (filters.lga) next = next.eq("lga", filters.lga);
  if (filters.tradeType) next = next.eq("trade_type", filters.tradeType);
  if (filters.reviewer === "unassigned") next = next.is("assigned_reviewer_id", null);
  else if (filters.reviewer) next = next.eq("assigned_reviewer_id", filters.reviewer);
  if (filters.importedFrom) next = next.gte("created_at", `${filters.importedFrom}T00:00:00.000Z`);
  if (filters.importedTo) next = next.lte("created_at", `${filters.importedTo}T23:59:59.999Z`);
  if (filters.ids) next = next.in("id", filters.ids.split(",").map((value) => value.trim()).filter(Boolean).slice(0, ASSOCIATION_MEMBER_FILTERED_BULK_LIMIT));
  if (filters.q) {
    next = next.or(
      `full_name.ilike.%${filters.q}%,business_name.ilike.%${filters.q}%,phone_normalized.ilike.%${filters.q}%,email.ilike.%${filters.q}%,association_membership_number.ilike.%${filters.q}%`,
    );
  }
  return next;
}

export function associationMemberFilterSnapshot(filters: AdminAssociationMemberFilters) {
  const parsed = parseAssociationMemberFilters(filters);
  return {
    association: parsed.association,
    status: parsed.status,
    activation: parsed.activation,
    invite: parsed.invite,
    duplicate: parsed.duplicate,
    lga: parsed.lga,
    tradeType: parsed.tradeType,
    reviewer: parsed.reviewer,
    importedFrom: parsed.importedFrom,
    importedTo: parsed.importedTo,
    q: parsed.q,
  };
}

export async function resolveAssociationMemberBulkTargetIds(
  supabase: SupabaseClient,
  filtersInput: AdminAssociationMemberFilters,
  limit = ASSOCIATION_MEMBER_FILTERED_BULK_LIMIT,
) {
  const filters = parseAssociationMemberFilters({ ...filtersInput, ids: "", page: 1, pageSize: MAX_PAGE_SIZE });
  const ids: string[] = [];
  for (let from = 0; from <= limit; from += ASSOCIATION_MEMBER_BULK_CHUNK_SIZE) {
    const { data, error } = await applyAssociationMemberFilters(
      supabase.from("association_members").select("id"),
      filters,
    )
      .order("id", { ascending: true })
      .range(from, Math.min(from + ASSOCIATION_MEMBER_BULK_CHUNK_SIZE - 1, limit));
    if (error) throw error;
    const pageIds = ((data ?? []) as AnyRow[]).map((row) => toString(row.id)).filter(Boolean);
    ids.push(...pageIds);
    if (pageIds.length < ASSOCIATION_MEMBER_BULK_CHUNK_SIZE || ids.length > limit) break;
  }
  if (ids.length > limit) throw new Error(`Filtered bulk operations are limited to ${limit.toLocaleString()} members.`);
  return ids;
}

export function computeAssociationMemberReadiness(row: AnyRow): AssociationMemberReadiness {
  const blockers: string[] = [];
  const attention: string[] = [];
  if (!nullableString(row.association_id)) blockers.push("Association is not assigned.");
  if (Boolean(row.duplicate_signal) || nullableString(row.member_status) === "duplicate_review") blockers.push("Duplicate review is unresolved.");
  if (["rejected", "correction_requested"].includes(nullableString(row.member_status) ?? "")) blockers.push(`Member is ${toString(row.member_status).replaceAll("_", " ")}.`);
  if (!nullableString(row.phone_number)) attention.push("Phone is unavailable.");
  if (!nullableString(row.email)) attention.push("Email is unavailable.");
  if (!nullableString(row.business_name)) attention.push("Business name is unavailable.");
  if (!nullableString(row.trade_type)) attention.push("Trade type is unavailable.");
  return { label: blockers.length ? "Blocked" : attention.length ? "Needs Attention" : "Ready", blockers, attention };
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

function logAssociationMemberQueryFailure(params: {
  operation: string;
  rowCount: number;
  importIdCount: number;
  error: unknown;
}) {
  const error = params.error as { code?: string; message?: string } | null;
  console.info("[admin-association-members:query-failed]", {
    operation: params.operation,
    rowCount: params.rowCount,
    importIdCount: params.importIdCount,
    code: error?.code ?? (params.error instanceof Error ? params.error.name : "unknown"),
    message: error?.message ?? (params.error instanceof Error ? params.error.message : "Source unavailable."),
  });
}

async function loadImportFileNames(
  supabase: SupabaseClient,
  rows: AnyRow[],
  operation: string,
) {
  const importIds = [...new Set(rows.map((row) => nullableString(row.source_import_id)).filter((value): value is string => Boolean(value)))];
  if (!importIds.length) return { fileNames: new Map<string, string>(), source: sourceAvailable() };

  try {
    const { data, error } = await supabase
      .from("association_member_imports")
      .select("id,file_name")
      .in("id", importIds);
    if (error) {
      logAssociationMemberQueryFailure({ operation, rowCount: rows.length, importIdCount: importIds.length, error });
      return { fileNames: null, source: sourceUnavailable(new Error(error.message)) };
    }

    return {
      fileNames: new Map(
        ((data ?? []) as AnyRow[])
          .map((row) => [nullableString(row.id), nullableString(row.file_name)] as const)
          .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1])),
      ),
      source: sourceAvailable(),
    };
  } catch (error) {
    logAssociationMemberQueryFailure({ operation, rowCount: rows.length, importIdCount: importIds.length, error });
    return { fileNames: null, source: sourceUnavailable(error) };
  }
}

function mergeImportFileNames(rows: AnyRow[], fileNames: Map<string, string> | null): AnyRow[] {
  return rows.map((row) => {
    const importId = nullableString(row.source_import_id);
    return {
      ...row,
      import_file_name: importId ? fileNames?.get(importId) ?? "Import source unavailable" : null,
    };
  });
}

function mapMemberRow(row: AnyRow): AdminAssociationMemberRow {
  const association = row.associations as AnyRow | null | undefined;
  const msme = row.msmes as AnyRow | null | undefined;
  const reviewer = row.users as AnyRow | null | undefined;
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
    cac: maskIdentifier(nullableString(row.cac_number)),
    tin: maskIdentifier(nullableString(row.tin_number)),
    lga: nullableString(row.lga),
    associationId: nullableString(row.association_id),
    associationName: nullableString(association?.name),
    membershipNumber: nullableString(row.association_membership_number),
    importSource: nullableString(row.import_file_name),
    status: nullableString(row.member_status),
    duplicateSignal: Boolean(row.duplicate_signal),
    duplicateReasons,
    activationState: nullableString(row.activation_state),
    inviteStatus: nullableString(row.latest_invite_status) ?? nullableString(row.invite_status),
    inviteLastDate: nullableString(row.latest_invite_created_at),
    inviteExpiry: nullableString(row.latest_invite_expires_at),
    readiness: computeAssociationMemberReadiness(row),
    assignedReviewerId: nullableString(row.assigned_reviewer_id),
    assignedReviewerName: nullableString(reviewer?.full_name) ?? nullableString(reviewer?.email),
    approvedAt: nullableString(row.approved_at),
    linkedMsme: nullableString(msme?.msme_id),
    createdAt: nullableString(row.created_at),
  };
}

async function loadLatestInvitations(supabase: SupabaseClient, memberIds: string[]) {
  if (!memberIds.length) return new Map<string, AnyRow>();
  const { data, error } = await supabase
    .from("association_member_invitations")
    .select("association_member_id,status,token_expires_at,created_at")
    .in("association_member_id", memberIds)
    .order("created_at", { ascending: false });
  if (error) return new Map<string, AnyRow>();
  const latest = new Map<string, AnyRow>();
  for (const row of (data ?? []) as AnyRow[]) {
    const memberId = nullableString(row.association_member_id);
    if (memberId && !latest.has(memberId)) latest.set(memberId, row);
  }
  return latest;
}

function mergeLatestInvitations(rows: AnyRow[], invitations: Map<string, AnyRow>) {
  return rows.map((row) => {
    const invite = invitations.get(toString(row.id));
    return {
      ...row,
      latest_invite_status: invite?.status ?? null,
      latest_invite_created_at: invite?.created_at ?? null,
      latest_invite_expires_at: invite?.token_expires_at ?? null,
    };
  });
}

export async function getAdminAssociationMembersWorkspace(
  filtersInput: AdminAssociationMemberFilters,
  currentUserId?: string | null,
): Promise<AdminAssociationMembersWorkspace> {
  const supabase = await createServiceRoleSupabaseClient();
  const filters = parseAssociationMemberFilters(filtersInput);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  const [associationsResult, reviewersResult, facetsResult, membersResult, totalCount, importedCount, pendingReviewCount, approvedCount, duplicateCount, correctionCount, pendingCount, assignedToMeCount, unassignedCount] = await Promise.all([
    supabase.from("associations").select("id,name,state,sector").order("name", { ascending: true }).limit(500),
    supabase.from("users").select("id,full_name,email").in("role", ["admin", "reviewer"]).order("full_name").limit(500),
    supabase.from("association_members").select("lga,trade_type").limit(2000),
    applyAssociationMemberFilters(
      supabase
        .from("association_members")
        .select(
          "id,association_id,msme_id,full_name,phone_number,email,cac_number,tin_number,business_name,trade_type,lga,association_membership_number,member_status,duplicate_signal,duplicate_reasons,activation_state,assigned_reviewer_id,approved_at,source_import_id,created_at,associations(name),msmes(msme_id,business_name),users:assigned_reviewer_id(full_name,email)",
          { count: "exact" },
        ),
      filters,
    )
      .order("created_at", { ascending: false })
      .range(from, to),
    safeCount(supabase),
    safeCount(supabase, (query) => query.eq("member_status", "imported")),
    safeCount(supabase, (query) => query.eq("member_status", "pending_review")),
    safeCount(supabase, (query) => query.eq("member_status", "approved")),
    safeCount(supabase, (query) => query.eq("duplicate_signal", true)),
    safeCount(supabase, (query) => query.eq("member_status", "correction_requested")),
    safeCount(supabase, (query) => query.eq("member_status", "pending_activation")),
    currentUserId ? safeCount(supabase, (query) => query.eq("assigned_reviewer_id", currentUserId)) : Promise.resolve({ count: 0, source: sourceAvailable() }),
    safeCount(supabase, (query) => query.is("assigned_reviewer_id", null)),
  ]);

  const associationsSource = associationsResult.error
    ? sourceUnavailable(new Error(associationsResult.error.message))
    : sourceAvailable();
  const membersSource = membersResult.error
    ? sourceUnavailable(new Error(membersResult.error.message))
    : sourceAvailable();
  if (membersResult.error) {
    logAssociationMemberQueryFailure({ operation: "load_member_queue", rowCount: 0, importIdCount: 0, error: membersResult.error });
  }
  const rawRows = membersResult.error ? [] : (membersResult.data ?? []) as unknown as AnyRow[];
  const importSourcesResult = await loadImportFileNames(supabase, rawRows, "load_member_queue_import_sources");
  const invitations = await loadLatestInvitations(supabase, rawRows.map((row) => toString(row.id)));
  const rows = mergeLatestInvitations(mergeImportFileNames(rawRows, importSourcesResult.fileNames), invitations).map(mapMemberRow);
  const total = membersResult.error ? null : membersResult.count ?? 0;

  return {
    associations: ((associationsResult.data ?? []) as AnyRow[]).map((row) => ({
      id: toString(row.id),
      name: toString(row.name) || "Unnamed association",
      state: nullableString(row.state),
      sector: nullableString(row.sector),
    })),
    reviewers: ((reviewersResult.data ?? []) as AnyRow[]).map((row) => ({ id: toString(row.id), label: nullableString(row.full_name) ?? nullableString(row.email) ?? "Unnamed reviewer" })),
    lgas: [...new Set(((facetsResult.data ?? []) as AnyRow[]).map((row) => nullableString(row.lga)).filter((value): value is string => Boolean(value)))].sort(),
    tradeTypes: [...new Set(((facetsResult.data ?? []) as AnyRow[]).map((row) => nullableString(row.trade_type)).filter((value): value is string => Boolean(value)))].sort(),
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
      imported: importedCount.count,
      pendingReview: pendingReviewCount.count,
      approved: approvedCount.count,
      duplicateReview: duplicateCount.count,
      correctionRequested: correctionCount.count,
      pendingActivation: pendingCount.count,
      assignedToMe: assignedToMeCount.count,
      unassigned: unassignedCount.count,
    },
    sources: {
      associations: associationsSource,
      association_members: membersSource,
      association_member_imports: importSourcesResult.source,
      total_count: totalCount.source,
      duplicate_count: duplicateCount.source,
      pending_activation_count: pendingCount.source,
      assigned_to_me_count: assignedToMeCount.source,
      unassigned_count: unassignedCount.source,
    },
  };
}

export type AdminAssociationMemberDetail = {
  member: AdminAssociationMemberRow & {
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    position: string | null;
    cac: string | null;
    tin: string | null;
    workshopAddress: string | null;
    yearsOfExperience: number | null;
    internalNotes: string | null;
    latestReviewReason: string | null;
  };
  reviewers: Array<{ id: string; label: string }>;
  validationResults: string[];
  events: Array<{ id: string; eventType: string; actorRole: string | null; reason: string | null; createdAt: string | null }>;
  invitation: { status: string | null; lastInvite: string | null; expiry: string | null; sentChannel: string | null; sentToMasked: string | null } | null;
};

export async function getAdminAssociationMemberDetail(memberId: string): Promise<AdminAssociationMemberDetail | null> {
  const supabase = await createServiceRoleSupabaseClient();
  const [memberResult, reviewersResult, eventsResult, invitationResult] = await Promise.all([
    supabase
      .from("association_members")
      .select("*,associations(name),msmes(msme_id,business_name),users:assigned_reviewer_id(full_name,email)")
      .eq("id", memberId)
      .maybeSingle(),
    supabase.from("users").select("id,full_name,email").in("role", ["admin", "reviewer"]).order("full_name").limit(500),
    supabase.from("association_member_events").select("id,event_type,actor_role,metadata,created_at").eq("association_member_id", memberId).order("created_at", { ascending: false }).limit(100),
    supabase.from("association_member_invitations").select("status,token_expires_at,sent_channel,sent_to_masked,created_at").eq("association_member_id", memberId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (memberResult.error) throw new Error(memberResult.error.message);
  if (!memberResult.data) return null;
  const importSourcesResult = await loadImportFileNames(supabase, [memberResult.data as AnyRow], "load_member_detail_import_source");
  const [raw] = mergeImportFileNames([memberResult.data as AnyRow], importSourcesResult.fileNames);
  const mapped = mapMemberRow(raw);
  const validationResults = [
    nullableString(raw.phone_number) ? "Phone available" : "Phone unavailable",
    nullableString(raw.email) ? "Email available" : "Email unavailable",
    nullableString(raw.business_name) ? "Business name available" : "Business name unavailable",
    nullableString(raw.trade_type) ? "Trade type available" : "Trade type unavailable",
    nullableString(raw.association_id) ? "Association assigned" : "Association unavailable",
  ];
  return {
    member: {
      ...mapped,
      phone: maskPhone(nullableString(raw.phone_number)),
      email: maskEmail(nullableString(raw.email)),
      whatsapp: maskPhone(nullableString(raw.whatsapp_number)),
      position: nullableString(raw.position_in_association),
      cac: maskIdentifier(nullableString(raw.cac_number)),
      tin: maskIdentifier(nullableString(raw.tin_number)),
      workshopAddress: nullableString(raw.workshop_address),
      yearsOfExperience: typeof raw.years_of_experience === "number" ? raw.years_of_experience : null,
      internalNotes: nullableString(raw.internal_notes),
      latestReviewReason: nullableString(raw.latest_review_reason),
    },
    reviewers: ((reviewersResult.data ?? []) as AnyRow[]).map((row) => ({ id: toString(row.id), label: nullableString(row.full_name) ?? nullableString(row.email) ?? "Unnamed reviewer" })),
    validationResults,
    events: ((eventsResult.data ?? []) as AnyRow[]).map((row) => {
      const metadata = (row.metadata ?? {}) as AnyRow;
      return { id: toString(row.id), eventType: toString(row.event_type), actorRole: nullableString(row.actor_role), reason: nullableString(metadata.reason), createdAt: nullableString(row.created_at) };
    }),
    invitation: invitationResult.data ? {
      status: nullableString(invitationResult.data.status),
      lastInvite: nullableString(invitationResult.data.created_at),
      expiry: nullableString(invitationResult.data.token_expires_at),
      sentChannel: nullableString(invitationResult.data.sent_channel),
      sentToMasked: nullableString(invitationResult.data.sent_to_masked),
    } : null,
  };
}

export async function getAssociationMemberExportRows(filtersInput: AdminAssociationMemberFilters) {
  const supabase = await createServiceRoleSupabaseClient();
  const filters = parseAssociationMemberFilters({ ...filtersInput, page: 1, pageSize: EXPORT_LIMIT });
  const rawRows: AnyRow[] = [];
  for (let from = 0; from < EXPORT_LIMIT; from += ASSOCIATION_MEMBER_BULK_CHUNK_SIZE) {
    const { data, error } = await applyAssociationMemberFilters(
      supabase
        .from("association_members")
        .select(
          "id,association_id,msme_id,full_name,phone_number,email,cac_number,tin_number,business_name,trade_type,lga,association_membership_number,member_status,duplicate_signal,duplicate_reasons,activation_state,assigned_reviewer_id,approved_at,source_import_id,created_at,associations(name),msmes(msme_id,business_name),users:assigned_reviewer_id(full_name,email)",
        ),
      filters,
    )
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + ASSOCIATION_MEMBER_BULK_CHUNK_SIZE - 1);
    if (error) throw new Error(error.message);
    const pageRows = (data ?? []) as unknown as AnyRow[];
    rawRows.push(...pageRows);
    if (pageRows.length < ASSOCIATION_MEMBER_BULK_CHUNK_SIZE) break;
  }
  const importSourcesResult = await loadImportFileNames(supabase, rawRows, "load_member_export_import_sources");
  const invitations = await loadLatestInvitations(supabase, rawRows.map((row) => toString(row.id)));
  return mergeLatestInvitations(mergeImportFileNames(rawRows, importSourcesResult.fileNames), invitations).map(mapMemberRow);
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
    "cac_masked",
    "tin_masked",
    "lga",
    "association",
    "import_source",
    "status",
    "activation_readiness",
    "duplicate_signal",
    "duplicate_reasons",
    "activation_state",
    "invite_status",
    "last_invite_date",
    "invite_expiry",
    "onboarding_status",
    "reviewer",
    "approval_date",
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
        row.cac,
        row.tin,
        row.lga,
        row.associationName,
        row.importSource,
        row.status,
        row.readiness.label,
        row.duplicateSignal,
        row.duplicateReasons,
        row.activationState,
        row.inviteStatus,
        row.inviteLastDate,
        row.inviteExpiry,
        row.activationState,
        row.assignedReviewerName,
        row.approvedAt,
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
    activation: parsed.activation || null,
    invite: parsed.invite || null,
    duplicate: parsed.duplicate || null,
    lga: parsed.lga || null,
    tradeType: parsed.tradeType || null,
    reviewer: parsed.reviewer || null,
    importedFrom: parsed.importedFrom || null,
    importedTo: parsed.importedTo || null,
    selectedIds: parsed.ids ? parsed.ids.split(",").filter(Boolean).length : 0,
    hasSearch: Boolean(parsed.q),
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}
