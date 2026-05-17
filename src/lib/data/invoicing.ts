import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { filterPayloadByColumns, getTableColumns } from "@/lib/data/commercial-ops";

export const INVOICE_STATUSES = ["draft", "issued", "pending_payment", "paid", "partially_paid", "overdue", "cancelled", "refunded"] as const;
export const INVOICE_PAYMENT_STATUSES = ["initiated", "pending", "success", "failed", "refunded"] as const;
export const INVOICE_PAYMENT_ATTEMPT_STATUSES = ["payment_attempt_created", "pending_payment", "cancelled"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];
export type InvoicePaymentAttemptStatus = (typeof INVOICE_PAYMENT_ATTEMPT_STATUSES)[number];

const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued", "cancelled"],
  issued: ["pending_payment", "paid", "partially_paid", "overdue", "cancelled"],
  pending_payment: ["issued", "paid", "partially_paid", "overdue", "cancelled"],
  partially_paid: ["pending_payment", "paid", "overdue", "refunded"],
  overdue: ["pending_payment", "paid", "partially_paid", "cancelled"],
  paid: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function getInvoicePrefix() {
  return process.env.INVOICE_PREFIX ?? "DBIN";
}

export function generateInvoiceNumber(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  const rnd = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${getInvoicePrefix()}-${y}${m}${d}-${rnd}`;
}

export function generatePublicInvoiceToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function publicInvoiceTokenExpiry(date = new Date()) {
  const expiresAt = new Date(date);
  expiresAt.setDate(expiresAt.getDate() + 90);
  return expiresAt.toISOString();
}

export function normalizeInvoiceLifecycleStatus(value: string | null | undefined): InvoiceStatus {
  const status = String(value ?? "draft");
  if ((INVOICE_STATUSES as readonly string[]).includes(status)) return status as InvoiceStatus;
  if (status === "sent") return "issued";
  return "draft";
}

export function canTransitionInvoiceStatus(fromStatus: string | null | undefined, toStatus: string | null | undefined) {
  const from = normalizeInvoiceLifecycleStatus(fromStatus);
  const to = normalizeInvoiceLifecycleStatus(toStatus);
  if (from === to) return true;
  return INVOICE_TRANSITIONS[from].includes(to);
}

export function invoiceFinancialFieldsLocked(status: string | null | undefined) {
  return normalizeInvoiceLifecycleStatus(status) !== "draft";
}

export function invoiceImmutable(status: string | null | undefined) {
  return ["paid", "refunded", "cancelled"].includes(normalizeInvoiceLifecycleStatus(status));
}

export function assertInvoiceTransition(fromStatus: string | null | undefined, toStatus: string | null | undefined) {
  if (!canTransitionInvoiceStatus(fromStatus, toStatus)) {
    throw new Error(`Invalid invoice status transition: ${normalizeInvoiceLifecycleStatus(fromStatus)} -> ${normalizeInvoiceLifecycleStatus(toStatus)}`);
  }
}

export function calculateLineTotal(quantity: number, unitPrice: number) {
  return Number((quantity * unitPrice).toFixed(2));
}

export async function recalculateInvoiceTotals(invoiceId: string) {
  const supabase = await createServiceRoleSupabaseClient();
  const invoiceColumns = await getTableColumns(supabase, "invoices");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id,vat_rate,subtotal,vat_amount,total_amount")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError || !invoice) {
    console.info("[invoice-totals:invoice-load-failed]", { operation: "invoice_totals_recalculate", invoiceId, message: invoiceError?.message ?? "missing_invoice" });
    throw new Error(invoiceError?.message ?? "Unable to load invoice for totals recalculation.");
  }

  const { data: items, error: itemError } = await supabase
    .from("invoice_items")
    .select("id,quantity,unit_price,line_total,vat_applicable")
    .eq("invoice_id", invoiceId);

  if (itemError) {
    console.info("[invoice-totals:items-load-failed]", { operation: "invoice_totals_recalculate", invoiceId, message: itemError.message });
    throw new Error(itemError.message);
  }

  const normalizedItems = (items ?? []).map((item) => {
    const quantity = Number((item as any).quantity ?? 0);
    const unitPrice = Number((item as any).unit_price ?? 0);
    const recomputedLineTotal = calculateLineTotal(quantity, unitPrice);
    const vatApplicable = Boolean((item as any).vat_applicable ?? true);
    return {
      id: String((item as any).id ?? ""),
      quantity,
      unitPrice,
      storedLineTotal: Number((item as any).line_total ?? 0),
      recomputedLineTotal,
      vatApplicable,
    };
  });

  const subtotal = Number(normalizedItems.reduce((sum, item) => sum + item.recomputedLineTotal, 0).toFixed(2));
  const vatBase = Number(
    normalizedItems
      .filter((item) => item.vatApplicable)
      .reduce((sum, item) => sum + item.recomputedLineTotal, 0)
      .toFixed(2)
  );
  const vatRate = Number((invoice as any).vat_rate ?? 0);
  const vatAmount = Number(((vatBase * vatRate) / 100).toFixed(2));
  const totalAmount = Number((subtotal + vatAmount).toFixed(2));

  const payload: Record<string, unknown> = { subtotal, vat_amount: vatAmount, total_amount: totalAmount, updated_at: new Date().toISOString() };
  if (invoiceColumns.has("amount_due")) payload.amount_due = totalAmount;
  if (invoiceColumns.has("grand_total")) payload.grand_total = totalAmount;

  console.info("[invoice-totals:computed]", { operation: "invoice_totals_recalculate", invoiceId, itemCount: normalizedItems.length });

  if (Object.keys(payload).length > 0) {
    const updatePayload = filterPayloadByColumns(payload, invoiceColumns.size ? invoiceColumns : new Set(Object.keys(payload)));
    const { error: updateError } = await supabase.from("invoices").update(updatePayload).eq("id", invoiceId);
    if (updateError) {
      console.info("[invoice-totals:update-failed]", { operation: "invoice_totals_recalculate", invoiceId, message: updateError.message });
      throw new Error(updateError.message);
    }
    console.info("[invoice-totals:invoice-after-update]", { operation: "invoice_totals_recalculate", invoiceId, status: "updated" });
  }

  return { subtotal, vatAmount, totalAmount };
}

export function formatNaira(value: number | string | null | undefined) {
  return `₦${Number(value ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export function invoiceStatusClasses(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "partially_paid") return "bg-teal-100 text-teal-700";
  if (status === "pending_payment") return "bg-amber-100 text-amber-700";
  if (status === "issued") return "bg-blue-100 text-blue-700";
  if (status === "overdue") return "bg-red-100 text-red-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  if (status === "refunded") return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-700";
}

export function invoicePaymentStatusClasses(status: string) {
  if (status === "success") return "bg-emerald-100 text-emerald-700";
  if (status === "pending" || status === "initiated") return "bg-amber-100 text-amber-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  if (status === "refunded") return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-700";
}
