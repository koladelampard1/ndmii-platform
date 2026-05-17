import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ProviderWorkspaceContext } from "@/lib/data/provider-operations";

export const BOOKKEEPING_BUCKET = "bookkeeping-evidence";
export const BOOKKEEPING_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const BOOKKEEPING_MAX_FILE_SIZE = 10 * 1024 * 1024;

export type BookkeepingEntryType = "income" | "expense";
export type BookkeepingSourceType = "manual" | "invoice" | "payment" | "refund" | "tax";
export type BookkeepingStatus = "draft" | "posted" | "void";
export type BookkeepingPeriodStatus = "open" | "closed";

export type BookkeepingEntry = {
  id: string;
  msme_id: string;
  provider_profile_id: string | null;
  period_id: string | null;
  entry_type: BookkeepingEntryType;
  category: string;
  amount: number;
  currency: string;
  transaction_date: string;
  description: string | null;
  source_type: BookkeepingSourceType;
  source_id: string | null;
  vat_applicable: boolean;
  vat_amount: number;
  status: BookkeepingStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  bookkeeping_attachments?: BookkeepingAttachment[];
};

export type BookkeepingAttachment = {
  id: string;
  entry_id: string;
  msme_id: string;
  provider_profile_id: string | null;
  attachment_type: string;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_by: string | null;
  created_at: string;
};

export type BookkeepingPeriod = {
  id: string;
  msme_id: string;
  provider_profile_id: string | null;
  period_month: string;
  status: BookkeepingPeriodStatus;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BookkeepingEvent = {
  id: string;
  entry_id: string | null;
  msme_id: string | null;
  action: string;
  actor_role: string | null;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BookkeepingSummary = {
  revenue: number;
  expenses: number;
  net: number;
  missingEvidence: number;
  vatTotal: number;
};

type SafeLogPayload = {
  operation: string;
  msmeId?: string | null;
  providerId?: string | null;
  entryId?: string | null;
  sourceType?: string | null;
  code?: string | null;
  message?: string | null;
};

export function logBookkeepingDiagnostic(payload: SafeLogPayload) {
  console.info("[bookkeeping]", payload);
}

export function monthStart(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`;
}

export function parsePeriodParam(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return monthStart();
  return `${value}-01`;
}

export function periodParamFromDate(value: string) {
  return value.slice(0, 7);
}

export function formatNairaCompact(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function safeMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

export function getVatAmount(amount: number, vatApplicable: boolean, vatAmountValue: unknown) {
  const explicitVat = safeMoney(vatAmountValue);
  if (explicitVat > 0) return explicitVat;
  return vatApplicable ? Number((amount * 0.075).toFixed(2)) : 0;
}

export async function ensureBookkeepingPeriod(
  supabase: SupabaseClient<any>,
  workspace: Pick<ProviderWorkspaceContext, "msme" | "provider" | "appUserId">,
  periodMonth: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("bookkeeping_periods")
    .select("id,msme_id,provider_profile_id,period_month,status,closed_by,closed_at,created_at,updated_at")
    .eq("msme_id", workspace.msme.id)
    .eq("period_month", periodMonth)
    .maybeSingle();

  if (existingError) {
    logBookkeepingDiagnostic({
      operation: "period_lookup_failed",
      msmeId: workspace.msme.id,
      providerId: workspace.provider.id,
      code: existingError.code ?? null,
      message: existingError.message,
    });
    throw new Error("Unable to load bookkeeping period.");
  }

  if (existing) return existing as BookkeepingPeriod;

  const { data, error } = await supabase
    .from("bookkeeping_periods")
    .insert({
      msme_id: workspace.msme.id,
      provider_profile_id: workspace.provider.id,
      period_month: periodMonth,
      status: "open",
    })
    .select("id,msme_id,provider_profile_id,period_month,status,closed_by,closed_at,created_at,updated_at")
    .single();

  if (error) {
    logBookkeepingDiagnostic({
      operation: "period_create_failed",
      msmeId: workspace.msme.id,
      providerId: workspace.provider.id,
      code: error.code ?? null,
      message: error.message,
    });
    throw new Error("Unable to create bookkeeping period.");
  }

  return data as BookkeepingPeriod;
}

export async function assertOpenBookkeepingPeriod(
  supabase: SupabaseClient<any>,
  workspace: Pick<ProviderWorkspaceContext, "msme" | "provider" | "appUserId">,
  transactionDate: string,
) {
  const period = await ensureBookkeepingPeriod(supabase, workspace, monthStart(new Date(`${transactionDate}T00:00:00`)));
  if (period.status !== "open") {
    throw new Error("This bookkeeping period is closed.");
  }
  return period;
}

export async function logBookkeepingEvent(
  supabase: SupabaseClient<any>,
  params: {
    entryId?: string | null;
    msmeId: string;
    action: string;
    actorRole?: string | null;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("bookkeeping_events").insert({
    entry_id: params.entryId ?? null,
    msme_id: params.msmeId,
    action: params.action,
    actor_role: params.actorRole ?? null,
    actor_id: params.actorId ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    logBookkeepingDiagnostic({
      operation: "event_insert_failed",
      msmeId: params.msmeId,
      entryId: params.entryId ?? null,
      code: error.code ?? null,
      message: error.message,
    });
  }
}

export async function loadBookkeepingDashboard(params: {
  supabase: SupabaseClient<any>;
  workspace: ProviderWorkspaceContext;
  periodMonth: string;
}) {
  const period = await ensureBookkeepingPeriod(params.supabase, params.workspace, params.periodMonth);

  const { data, error } = await params.supabase
    .from("bookkeeping_entries")
    .select("id,msme_id,provider_profile_id,period_id,entry_type,category,amount,currency,transaction_date,description,source_type,source_id,vat_applicable,vat_amount,status,created_by,created_at,updated_at,bookkeeping_attachments(id,entry_id,msme_id,provider_profile_id,attachment_type,bucket_id,storage_path,file_name,mime_type,file_size,created_by,created_at)")
    .eq("msme_id", params.workspace.msme.id)
    .eq("period_id", period.id)
    .neq("status", "void")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    logBookkeepingDiagnostic({
      operation: "entries_load_failed",
      msmeId: params.workspace.msme.id,
      providerId: params.workspace.provider.id,
      code: error.code ?? null,
      message: error.message,
    });
    throw new Error("Unable to load bookkeeping entries.");
  }

  const entries = ((data ?? []) as BookkeepingEntry[]).map((entry) => ({
    ...entry,
    amount: Number(entry.amount ?? 0),
    vat_amount: Number(entry.vat_amount ?? 0),
    bookkeeping_attachments: entry.bookkeeping_attachments ?? [],
  }));

  const summary = summarizeBookkeeping(entries);
  return { period, entries, summary };
}

export function summarizeBookkeeping(entries: BookkeepingEntry[]): BookkeepingSummary {
  const active = entries.filter((entry) => entry.status !== "void");
  const revenue = active.filter((entry) => entry.entry_type === "income").reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const expenses = active.filter((entry) => entry.entry_type === "expense").reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const missingEvidence = active.filter((entry) => (entry.bookkeeping_attachments ?? []).length === 0).length;
  const vatTotal = active.reduce((sum, entry) => sum + Number(entry.vat_amount ?? 0), 0);
  return { revenue, expenses, net: revenue - expenses, missingEvidence, vatTotal };
}

export async function loadBookkeepingEntry(params: {
  supabase: SupabaseClient<any>;
  workspace: ProviderWorkspaceContext;
  entryId: string;
}) {
  const { data, error } = await params.supabase
    .from("bookkeeping_entries")
    .select("id,msme_id,provider_profile_id,period_id,entry_type,category,amount,currency,transaction_date,description,source_type,source_id,vat_applicable,vat_amount,status,created_by,created_at,updated_at,bookkeeping_attachments(id,entry_id,msme_id,provider_profile_id,attachment_type,bucket_id,storage_path,file_name,mime_type,file_size,created_by,created_at)")
    .eq("id", params.entryId)
    .eq("msme_id", params.workspace.msme.id)
    .maybeSingle();

  if (error) {
    logBookkeepingDiagnostic({
      operation: "entry_load_failed",
      msmeId: params.workspace.msme.id,
      providerId: params.workspace.provider.id,
      entryId: params.entryId,
      code: error.code ?? null,
      message: error.message,
    });
    throw new Error("Unable to load bookkeeping entry.");
  }

  if (!data) redirect("/dashboard/msme/bookkeeping");
  return data as BookkeepingEntry;
}

export async function getSignedAttachmentUrl(supabase: SupabaseClient<any>, attachment: BookkeepingAttachment) {
  const { data, error } = await supabase.storage.from(attachment.bucket_id).createSignedUrl(attachment.storage_path, 60 * 5);
  if (error) {
    logBookkeepingDiagnostic({
      operation: "attachment_signed_url_failed",
      msmeId: attachment.msme_id,
      entryId: attachment.entry_id,
      code: error.name,
      message: error.message,
    });
    return null;
  }
  return data.signedUrl;
}

export function validateBookkeepingFile(file: File | null) {
  if (!file || file.size === 0) return null;
  if (!BOOKKEEPING_FILE_TYPES.has(file.type)) {
    throw new Error("Evidence must be a PDF, JPG, PNG, or WebP file.");
  }
  if (file.size > BOOKKEEPING_MAX_FILE_SIZE) {
    throw new Error("Evidence file must be 10MB or smaller.");
  }
  return file;
}

export async function uploadBookkeepingAttachment(params: {
  supabase: SupabaseClient<any>;
  workspace: ProviderWorkspaceContext;
  entryId: string;
  file: File;
  attachmentType?: string;
}) {
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "evidence";
  const storagePath = `${params.workspace.msme.id}/${params.entryId}/${Date.now()}-${safeName}`;
  const bytes = Buffer.from(await params.file.arrayBuffer());
  const { error: uploadError } = await params.supabase.storage
    .from(BOOKKEEPING_BUCKET)
    .upload(storagePath, bytes, {
      contentType: params.file.type,
      upsert: false,
    });

  if (uploadError) {
    logBookkeepingDiagnostic({
      operation: "attachment_upload_failed",
      msmeId: params.workspace.msme.id,
      providerId: params.workspace.provider.id,
      entryId: params.entryId,
      code: uploadError.name,
      message: uploadError.message,
    });
    throw new Error("Unable to upload evidence file.");
  }

  const { data, error } = await params.supabase
    .from("bookkeeping_attachments")
    .insert({
      entry_id: params.entryId,
      msme_id: params.workspace.msme.id,
      provider_profile_id: params.workspace.provider.id,
      attachment_type: params.attachmentType ?? "receipt",
      bucket_id: BOOKKEEPING_BUCKET,
      storage_path: storagePath,
      file_name: safeName,
      mime_type: params.file.type,
      file_size: params.file.size,
      created_by: params.workspace.appUserId,
    })
    .select("id")
    .single();

  if (error) {
    logBookkeepingDiagnostic({
      operation: "attachment_metadata_insert_failed",
      msmeId: params.workspace.msme.id,
      providerId: params.workspace.provider.id,
      entryId: params.entryId,
      code: error.code ?? null,
      message: error.message,
    });
    throw new Error("Unable to save evidence metadata.");
  }

  await logBookkeepingEvent(params.supabase, {
    entryId: params.entryId,
    msmeId: params.workspace.msme.id,
    action: "attachment_created",
    actorRole: params.workspace.role,
    actorId: params.workspace.appUserId,
    metadata: { attachment_id: data.id, attachment_type: params.attachmentType ?? "receipt" },
  });
}

export async function syncPaidInvoiceToBookkeeping(params: {
  invoiceId: string;
  paymentId?: string | null;
  actorRole?: string | null;
  actorId?: string | null;
}) {
  const supabase = await createServiceRoleSupabaseClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,msme_id,provider_profile_id,invoice_number,total_amount,vat_amount,paid_at,created_at,status")
    .eq("id", params.invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    logBookkeepingDiagnostic({
      operation: "invoice_sync_load_failed",
      entryId: null,
      sourceType: "payment",
      code: error?.code ?? null,
      message: error?.message ?? "invoice_not_found",
    });
    return;
  }

  const msmeId = String(invoice.msme_id ?? "");
  const providerId = String(invoice.provider_profile_id ?? "");
  const transactionDate = String(invoice.paid_at ?? invoice.created_at ?? new Date().toISOString()).slice(0, 10);
  const periodMonth = monthStart(new Date(`${transactionDate}T00:00:00`));

  const { data: period, error: periodError } = await supabase
    .from("bookkeeping_periods")
    .upsert(
      {
        msme_id: msmeId,
        provider_profile_id: providerId,
        period_month: periodMonth,
        status: "open",
      },
      { onConflict: "msme_id,period_month" },
    )
    .select("id,status")
    .single();

  if (periodError || !period || period.status !== "open") {
    logBookkeepingDiagnostic({
      operation: "invoice_sync_period_unavailable",
      msmeId,
      providerId,
      sourceType: "payment",
      code: periodError?.code ?? null,
      message: periodError?.message ?? "period_closed_or_missing",
    });
    return;
  }

  const sourceId = params.paymentId ?? params.invoiceId;
  const { data: existing } = await supabase
    .from("bookkeeping_entries")
    .select("id")
    .eq("msme_id", msmeId)
    .eq("source_type", "payment")
    .eq("source_id", sourceId)
    .maybeSingle();

  const payload = {
    msme_id: msmeId,
    provider_profile_id: providerId,
    period_id: period.id,
    entry_type: "income",
    category: "Invoice payment",
    amount: Number(invoice.total_amount ?? 0),
    currency: "NGN",
    transaction_date: transactionDate,
    description: `Invoice ${invoice.invoice_number ?? invoice.id} payment`,
    source_type: "payment",
    source_id: sourceId,
    vat_applicable: Number(invoice.vat_amount ?? 0) > 0,
    vat_amount: Number(invoice.vat_amount ?? 0),
    status: "posted",
    created_by: params.actorId ?? null,
  };

  const result = existing?.id
    ? await supabase.from("bookkeeping_entries").update(payload).eq("id", existing.id).select("id").single()
    : await supabase.from("bookkeeping_entries").insert(payload).select("id").single();

  if (result.error) {
    logBookkeepingDiagnostic({
      operation: "invoice_payment_entry_sync_failed",
      msmeId,
      providerId,
      sourceType: "payment",
      code: result.error.code ?? null,
      message: result.error.message,
    });
    return;
  }

  await logBookkeepingEvent(supabase, {
    entryId: result.data.id,
    msmeId,
    action: existing?.id ? "entry_synced_from_payment_updated" : "entry_synced_from_payment_created",
    actorRole: params.actorRole,
    actorId: params.actorId,
    metadata: { source_type: "payment", source_id: sourceId, invoice_id: params.invoiceId },
  });
}

export async function syncRefundInvoiceToBookkeeping(params: {
  invoiceId: string;
  actorRole?: string | null;
  actorId?: string | null;
}) {
  const supabase = await createServiceRoleSupabaseClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,msme_id,provider_profile_id,invoice_number,total_amount,vat_amount,refunded_at,updated_at,created_at")
    .eq("id", params.invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    logBookkeepingDiagnostic({
      operation: "refund_sync_load_failed",
      sourceType: "refund",
      code: error?.code ?? null,
      message: error?.message ?? "invoice_not_found",
    });
    return;
  }

  const msmeId = String(invoice.msme_id ?? "");
  const providerId = String(invoice.provider_profile_id ?? "");
  const transactionDate = String(invoice.refunded_at ?? invoice.updated_at ?? invoice.created_at ?? new Date().toISOString()).slice(0, 10);
  const periodMonth = monthStart(new Date(`${transactionDate}T00:00:00`));

  const { data: period } = await supabase
    .from("bookkeeping_periods")
    .upsert(
      { msme_id: msmeId, provider_profile_id: providerId, period_month: periodMonth, status: "open" },
      { onConflict: "msme_id,period_month" },
    )
    .select("id,status")
    .single();

  if (!period || period.status !== "open") return;

  const { data: existing } = await supabase
    .from("bookkeeping_entries")
    .select("id")
    .eq("msme_id", msmeId)
    .eq("source_type", "refund")
    .eq("source_id", params.invoiceId)
    .maybeSingle();

  const payload = {
    msme_id: msmeId,
    provider_profile_id: providerId,
    period_id: period.id,
    entry_type: "expense",
    category: "Refund adjustment",
    amount: Number(invoice.total_amount ?? 0),
    currency: "NGN",
    transaction_date: transactionDate,
    description: `Invoice ${invoice.invoice_number ?? invoice.id} refund adjustment`,
    source_type: "refund",
    source_id: params.invoiceId,
    vat_applicable: Number(invoice.vat_amount ?? 0) > 0,
    vat_amount: Number(invoice.vat_amount ?? 0),
    status: "posted",
    created_by: params.actorId ?? null,
  };

  const result = existing?.id
    ? await supabase.from("bookkeeping_entries").update(payload).eq("id", existing.id).select("id").single()
    : await supabase.from("bookkeeping_entries").insert(payload).select("id").single();

  if (result.error) {
    logBookkeepingDiagnostic({
      operation: "refund_entry_sync_failed",
      msmeId,
      providerId,
      sourceType: "refund",
      code: result.error.code ?? null,
      message: result.error.message,
    });
    return;
  }

  await logBookkeepingEvent(supabase, {
    entryId: result.data.id,
    msmeId,
    action: existing?.id ? "entry_synced_from_refund_updated" : "entry_synced_from_refund_created",
    actorRole: params.actorRole,
    actorId: params.actorId,
    metadata: { source_type: "refund", source_id: params.invoiceId },
  });
}
