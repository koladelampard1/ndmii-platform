import type { SupabaseClient } from "@supabase/supabase-js";

const DEV_MODE = process.env.NODE_ENV !== "production";
const schemaColumnCache = new Map<string, Set<string>>();
const TABLE_COLUMN_PROBE_CANDIDATES: Record<string, string[]> = {
  provider_profiles: [
    "id",
    "msme_id",
    "display_name",
    "description",
    "tagline",
    "contact_email",
    "contact_phone",
    "website",
    "is_verified",
    "is_active",
    "updated_at",
  ],
};

function devLog(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[commercial-ops] ${message}`, payload);
}

export async function getTableColumns(supabase: SupabaseClient<any>, tableName: string) {
  const cacheKey = `public.${tableName}`;
  const cached = schemaColumnCache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);

  if (error) {
    devLog("schema_columns_lookup_error", { tableName, message: error.message, code: error.code ?? null });
    const fallback = await probeTableColumns(supabase, tableName);
    schemaColumnCache.set(cacheKey, fallback);
    return fallback;
  }

  const columns = new Set((data ?? []).map((row) => String(row.column_name)));
  if (columns.size === 0) {
    const fallback = await probeTableColumns(supabase, tableName);
    schemaColumnCache.set(cacheKey, fallback);
    return fallback;
  }
  schemaColumnCache.set(cacheKey, columns);
  return columns;
}

async function probeTableColumns(supabase: SupabaseClient<any>, tableName: string) {
  const candidates = TABLE_COLUMN_PROBE_CANDIDATES[tableName] ?? [];
  if (candidates.length === 0) return new Set<string>();

  const detected = new Set<string>();
  for (const column of candidates) {
    const { error } = await supabase.from(tableName).select(column).limit(1);
    if (!error) {
      detected.add(column);
      continue;
    }

    devLog("schema_columns_probe_error", {
      tableName,
      column,
      message: error.message,
      code: error.code ?? null,
    });
  }

  devLog("schema_columns_probe_result", {
    tableName,
    detectedColumns: Array.from(detected).sort(),
    candidateCount: candidates.length,
  });
  return detected;
}

export function pickExistingColumns(columns: Set<string>, requested: string[]) {
  return requested.filter((column) => columns.has(column));
}

export function filterPayloadByColumns(payload: Record<string, unknown>, columns: Set<string>) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => columns.has(key)));
}

export function normalizeInvoiceStatus(value: string | null | undefined) {
  const status = String(value ?? "draft");
  if (["draft", "issued", "pending_payment", "paid", "overdue", "cancelled"].includes(status)) return status;
  if (status === "sent") return "issued";
  return "draft";
}

export function invoiceStatusLabel(value: string | null | undefined) {
  return normalizeInvoiceStatus(value).replace("_", " ");
}

export async function logInvoiceEvent(
  supabase: SupabaseClient<any>,
  params: { invoiceId: string; eventType: string; actorRole?: string | null; actorId?: string | null; metadata?: Record<string, unknown> }
) {
  const columns = await getTableColumns(supabase, "invoice_events");
  if (!columns.has("invoice_id") || !columns.has("event_type")) return;

  const payload = filterPayloadByColumns(
    {
      invoice_id: params.invoiceId,
      event_type: params.eventType,
      actor_role: params.actorRole ?? null,
      actor_id: params.actorId ?? null,
      metadata: params.metadata ?? {},
      created_at: new Date().toISOString(),
    },
    columns
  );

  const { error } = await supabase.from("invoice_events").insert(payload);
  if (error) devLog("invoice_event_insert_failed", { eventType: params.eventType, invoiceId: params.invoiceId, message: error.message });
}

export async function logActivityEvent(
  supabase: SupabaseClient<any>,
  params: {
    action: string;
    entityType: string;
    entityId?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const columns = await getTableColumns(supabase, "activity_logs");
  if (!columns.has("action") || !columns.has("entity_type")) return;

  const payload = filterPayloadByColumns(
    {
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      actor_user_id: params.actorUserId ?? null,
      metadata: params.metadata ?? {},
      created_at: new Date().toISOString(),
    },
    columns
  );

  const { error } = await supabase.from("activity_logs").insert(payload);
  if (error) devLog("activity_event_insert_failed", { action: params.action, entityType: params.entityType, message: error.message });
}

type RevenueInvoiceRow = {
  id: string;
  provider_profile_id: string | null;
  invoice_number: string;
  status: string;
  total_amount: number;
  vat_amount: number;
  created_at: string;
  paid_at: string | null;
};

type RevenuePaymentRow = {
  invoice_id: string;
  payment_reference: string;
  payment_status: string;
  amount: number;
  created_at: string;
};

export async function loadRevenueSnapshot(supabase: SupabaseClient<any>, providerProfileId?: string) {
  const invoiceColumns = await getTableColumns(supabase, "invoices");
  const invoiceSelectColumns = pickExistingColumns(invoiceColumns, [
    "id",
    "provider_profile_id",
    "invoice_number",
    "status",
    "total_amount",
    "vat_amount",
    "created_at",
    "paid_at",
  ]);

  if (!invoiceSelectColumns.includes("id") || !invoiceSelectColumns.includes("created_at")) {
    return { invoices: [] as RevenueInvoiceRow[], payments: [] as RevenuePaymentRow[] };
  }

  let invoiceQuery = supabase.from("invoices").select(invoiceSelectColumns.join(",")).order("created_at", { ascending: false });
  if (providerProfileId && invoiceColumns.has("provider_profile_id")) {
    invoiceQuery = invoiceQuery.eq("provider_profile_id", providerProfileId);
  }

  const { data: invoiceData, error: invoiceError } = await invoiceQuery;
  if (invoiceError) {
    devLog("revenue_invoices_query_failed", { providerProfileId: providerProfileId ?? null, message: invoiceError.message });
    return { invoices: [] as RevenueInvoiceRow[], payments: [] as RevenuePaymentRow[] };
  }

  const invoices: RevenueInvoiceRow[] = ((invoiceData as any[]) ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    provider_profile_id: row.provider_profile_id ? String(row.provider_profile_id) : null,
    invoice_number: String(row.invoice_number ?? row.id ?? "N/A"),
    status: normalizeInvoiceStatus(String(row.status ?? "draft")),
    total_amount: Number(row.total_amount ?? 0),
    vat_amount: Number(row.vat_amount ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    paid_at: row.paid_at ? String(row.paid_at) : null,
  }));

  const invoiceIds = invoices.map((invoice) => invoice.id).filter(Boolean);
  if (invoiceIds.length === 0) {
    return { invoices, payments: [] as RevenuePaymentRow[] };
  }

  const paymentColumns = await getTableColumns(supabase, "invoice_payments");
  const paymentSelectColumns = pickExistingColumns(paymentColumns, [
    "invoice_id",
    "payment_reference",
    "payment_status",
    "amount",
    "created_at",
  ]);

  if (!paymentSelectColumns.includes("invoice_id")) {
    return { invoices, payments: [] as RevenuePaymentRow[] };
  }

  let paymentQuery = supabase.from("invoice_payments").select(paymentSelectColumns.join(",")).order("created_at", { ascending: false });
  if (paymentColumns.has("invoice_id")) {
    paymentQuery = paymentQuery.in("invoice_id", invoiceIds);
  }

  const { data: paymentData, error: paymentError } = await paymentQuery.limit(50);
  if (paymentError) {
    devLog("revenue_payments_query_failed", { message: paymentError.message });
    return { invoices, payments: [] as RevenuePaymentRow[] };
  }

  const payments: RevenuePaymentRow[] = ((paymentData as any[]) ?? []).map((row: any) => ({
    invoice_id: String(row.invoice_id ?? ""),
    payment_reference: String(row.payment_reference ?? "N/A"),
    payment_status: String(row.payment_status ?? "pending"),
    amount: Number(row.amount ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
  }));

  return { invoices, payments };
}
