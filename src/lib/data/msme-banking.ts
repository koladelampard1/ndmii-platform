import type { SupabaseClient } from "@supabase/supabase-js";
import { getTableColumns, pickExistingColumns } from "@/lib/data/commercial-ops";

export type BankingVerificationStatus = "pending_review" | "verified" | "changes_requested" | "rejected";
export type PreferredPaymentMethod = "bank_transfer" | "mobile_money" | "card" | "cheque";

export type MsmeBankingProfile = {
  id: string;
  msme_id: string;
  bank_name: string;
  account_name: string;
  account_number_masked: string;
  account_number_last4: string;
  account_type: string | null;
  currency: string;
  swift_code: string | null;
  sort_code: string | null;
  vat_number: string | null;
  preferred_payment_method: PreferredPaymentMethod;
  payout_enabled: boolean;
  verification_status: BankingVerificationStatus;
  created_at: string;
  updated_at: string;
};

export type BankingFormState =
  | { ok: true; profile: MsmeBankingProfile }
  | { ok: false; errors: Record<string, string>; diagnostic?: BankingSaveDiagnostic };

type BankingSaveDiagnostic = {
  operation: "schema_lookup" | "select_existing" | "insert" | "update";
  code: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
  table: "msme_banking_profiles";
  columns: string[];
  resolvedMsmeId: string;
  serviceRoleConfigured: boolean;
  branch?: "insert" | "update" | null;
  existingProfileIdPresent?: boolean;
  readSucceeded?: boolean;
  classification?:
    | "schema_missing"
    | "fk_invalid"
    | "rls_or_permission"
    | "duplicate_constraint"
    | "write_returned_no_row"
    | "unknown";
  errorKey?: "banking_save_failed" | "banking_schema_missing" | "banking_msme_link_invalid";
};

export const BANKING_FIELD_ERROR_MESSAGES = {
  bank_name: "Bank name required",
  account_name: "Account name required",
  account_number: "Invalid account number",
  swift_code: "Invalid SWIFT code",
  sort_code: "Invalid sort code",
  vat_number: "Invalid VAT/TIN",
  preferred_payment_method: "Select a supported payment method",
  currency: "Currency must be a 3-letter code",
  account_type: "Account type contains unsupported characters",
  form: "Banking profile could not be saved. Please try again.",
} as const;

export type BankingFieldErrorKey = keyof typeof BANKING_FIELD_ERROR_MESSAGES;

const BANKING_SELECT_COLUMNS = [
  "id",
  "msme_id",
  "bank_name",
  "account_name",
  "account_number_masked",
  "account_number_last4",
  "account_type",
  "currency",
  "swift_code",
  "sort_code",
  "vat_number",
  "preferred_payment_method",
  "payout_enabled",
  "verification_status",
  "created_at",
  "updated_at",
];
const BANKING_WRITE_SELECT = BANKING_SELECT_COLUMNS.join(",");

const TEXT_PATTERN = /^[A-Za-z0-9 .,'&()/-]+$/;
const CODE_PATTERN = /^[A-Za-z0-9-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_METHODS = new Set(["bank_transfer", "mobile_money", "card", "cheque"]);
const SENSITIVE_DIAGNOSTIC_TERMS = ["account", "bank", "vat", "tin", "email", "phone", "address", "payload", "form"];

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function safeDbText(value: string | null | undefined) {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (SENSITIVE_DIAGNOSTIC_TERMS.some((term) => lower.includes(term))) return null;
  return value;
}

function classifyBankingFailure(error: { code?: string | null; message?: string | null } | null | undefined, dataMissing = false): BankingSaveDiagnostic["classification"] {
  if (error?.code === "42P01" || error?.code === "42703") return "schema_missing";
  if (error?.code === "23503") return "fk_invalid";
  if (error?.code === "42501") return "rls_or_permission";
  if (error?.code === "23505") return "duplicate_constraint";
  if (dataMissing) return "write_returned_no_row";
  return "unknown";
}

function bankingErrorKeyForClassification(classification: BankingSaveDiagnostic["classification"]): NonNullable<BankingSaveDiagnostic["errorKey"]> {
  if (classification === "schema_missing") return "banking_schema_missing";
  if (classification === "fk_invalid") return "banking_msme_link_invalid";
  return "banking_save_failed";
}

function logBankingDiagnostic(diagnostic: BankingSaveDiagnostic) {
  console.error("[msme-banking][save-failed]", diagnostic);
}

function bankingSaveFailure(diagnostic: BankingSaveDiagnostic): BankingFormState {
  logBankingDiagnostic(diagnostic);
  return {
    ok: false,
    errors: { form: BANKING_FIELD_ERROR_MESSAGES.form },
    diagnostic,
  };
}

export function maskAccountNumber(accountNumber: string) {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `******${digits.slice(-4)}`;
}

export function verificationStatusLabel(value: string | null | undefined) {
  const normalized = String(value ?? "pending_review").replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function bankingProfileConfigured(profile: MsmeBankingProfile | null) {
  return Boolean(profile?.bank_name && profile.account_name && profile.account_number_last4 && profile.currency);
}

export async function loadMsmeBankingProfile(supabase: SupabaseClient<any>, canonicalMsmeId: string): Promise<MsmeBankingProfile | null> {
  const normalizedMsmeId = canonicalMsmeId.trim();
  if (!UUID_PATTERN.test(normalizedMsmeId)) return null;

  const columns = await getTableColumns(supabase, "msme_banking_profiles");
  const select = pickExistingColumns(columns, BANKING_SELECT_COLUMNS);
  if (!select.includes("msme_id") || !select.includes("bank_name")) return null;

  let query = supabase
    .from("msme_banking_profiles")
    .select(select.join(","))
    .eq("msme_id", normalizedMsmeId)
    .limit(1);
  if (select.includes("updated_at")) {
    query = query.order("updated_at", { ascending: false });
  }
  const { data, error } = await query;

  if (error) return null;
  return (data?.[0] ?? null) as unknown as MsmeBankingProfile | null;
}

export async function saveMsmeBankingProfile(params: {
  supabase: SupabaseClient<any>;
  msmeId: string;
  formData: FormData;
  existingProfile?: MsmeBankingProfile | null;
}): Promise<BankingFormState> {
  const errors: Record<string, string> = {};
  const bankName = textValue(params.formData, "bank_name");
  const accountName = textValue(params.formData, "account_name");
  const accountNumber = textValue(params.formData, "account_number").replace(/\s+/g, "");
  const accountType = optionalText(params.formData, "account_type");
  const swiftCode = optionalText(params.formData, "swift_code")?.toUpperCase() ?? null;
  const sortCode = optionalText(params.formData, "sort_code");
  const vatNumber = optionalText(params.formData, "vat_number")?.toUpperCase() ?? null;
  const currency = (textValue(params.formData, "currency") || "NGN").toUpperCase();
  const preferredPaymentMethod = textValue(params.formData, "preferred_payment_method") || "bank_transfer";

  if (!bankName) errors.bank_name = BANKING_FIELD_ERROR_MESSAGES.bank_name;
  if (!accountName) errors.account_name = BANKING_FIELD_ERROR_MESSAGES.account_name;
  if (!params.existingProfile && !accountNumber) errors.account_number = BANKING_FIELD_ERROR_MESSAGES.account_number;
  if (bankName && !TEXT_PATTERN.test(bankName)) errors.bank_name = BANKING_FIELD_ERROR_MESSAGES.bank_name;
  if (accountName && !TEXT_PATTERN.test(accountName)) errors.account_name = BANKING_FIELD_ERROR_MESSAGES.account_name;
  if (accountNumber && !/^[0-9]{10}$/.test(accountNumber)) errors.account_number = BANKING_FIELD_ERROR_MESSAGES.account_number;
  if (accountType && !TEXT_PATTERN.test(accountType)) errors.account_type = "Account type contains unsupported characters.";
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Currency must be a 3-letter code.";
  if (swiftCode && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swiftCode)) errors.swift_code = BANKING_FIELD_ERROR_MESSAGES.swift_code;
  if (sortCode && !/^[0-9-]{3,12}$/.test(sortCode)) errors.sort_code = BANKING_FIELD_ERROR_MESSAGES.sort_code;
  if (vatNumber && (!CODE_PATTERN.test(vatNumber) || vatNumber.length < 5 || vatNumber.length > 20)) {
    errors.vat_number = BANKING_FIELD_ERROR_MESSAGES.vat_number;
  }
  if (!PAYMENT_METHODS.has(preferredPaymentMethod)) errors.preferred_payment_method = BANKING_FIELD_ERROR_MESSAGES.preferred_payment_method;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const nextMasked = accountNumber ? maskAccountNumber(accountNumber) : params.existingProfile?.account_number_masked ?? "";
  const nextLast4 = accountNumber ? accountNumber.slice(-4) : params.existingProfile?.account_number_last4 ?? "";
  if (!nextMasked || !nextLast4) return { ok: false, errors: { account_number: BANKING_FIELD_ERROR_MESSAGES.account_number } };

  const nowIso = new Date().toISOString();
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const rawPayload = {
    msme_id: params.msmeId,
    bank_name: bankName,
    account_name: accountName,
    account_number_masked: nextMasked,
    account_number_last4: nextLast4,
    account_type: accountType,
    currency,
    swift_code: swiftCode,
    sort_code: sortCode,
    vat_number: vatNumber,
    preferred_payment_method: preferredPaymentMethod,
    updated_at: nowIso,
    created_at: params.existingProfile ? undefined : nowIso,
  };
  const payload = Object.fromEntries(Object.entries(rawPayload).filter(([, value]) => value !== undefined));

  const writeOperation = params.existingProfile?.id ? "update" : "insert";
  const writeResult = params.existingProfile?.id
    ? await params.supabase
        .from("msme_banking_profiles")
        .update(payload)
        .eq("id", params.existingProfile.id)
        .eq("msme_id", params.msmeId)
        .select(BANKING_WRITE_SELECT)
        .maybeSingle()
    : await params.supabase
        .from("msme_banking_profiles")
        .insert(payload)
        .select(BANKING_WRITE_SELECT)
        .maybeSingle();

  const { data, error } = writeResult;

  if (error || !data) {
    const classification = classifyBankingFailure(error, !data);
    return bankingSaveFailure({
      operation: writeOperation,
      code: error?.code ?? null,
      message: error?.message ?? "msme_banking_profiles write returned no row",
      details: safeDbText(error?.details),
      hint: safeDbText(error?.hint),
      table: "msme_banking_profiles",
      columns: Object.keys(payload).sort(),
      resolvedMsmeId: params.msmeId,
      serviceRoleConfigured,
      branch: writeOperation,
      existingProfileIdPresent: Boolean(params.existingProfile?.id),
      classification,
      errorKey: bankingErrorKeyForClassification(classification),
    });
  }

  return { ok: true, profile: data as unknown as MsmeBankingProfile };
}

export function buildInvoiceBankingReadiness(profile: MsmeBankingProfile | null) {
  return {
    account_name: profile?.account_name ?? null,
    bank_name: profile?.bank_name ?? null,
    account_number_masked: profile?.account_number_masked ?? null,
    currency: profile?.currency ?? "NGN",
    preferred_payment_method: profile?.preferred_payment_method ?? "bank_transfer",
    configured: bankingProfileConfigured(profile),
    payout_ready: Boolean(profile?.payout_enabled && profile.verification_status === "verified"),
    verification_status: profile?.verification_status ?? "pending_review",
  };
}
