import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const INVOICE_STATUSES = ["draft", "issued", "pending_payment", "paid", "overdue", "cancelled"] as const;
export const INVOICE_PAYMENT_STATUSES = ["initiated", "pending", "success", "failed", "refunded"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export function generateInvoiceNumber(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  const rnd = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `NDMII-${y}${m}${d}-${rnd}`;
}

export function calculateLineTotal(quantity: number, unitPrice: number) {
  return Number((quantity * unitPrice).toFixed(2));
}

export async function recalculateInvoiceTotals(invoiceId: string) {
  const supabase = await createServiceRoleSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase.from("invoices").select("id,vat_rate").eq("id", invoiceId).maybeSingle();

  if (invoiceError) throw new Error(invoiceError.message);
  if (!invoice) throw new Error("Invoice not found.");

  const { data: items, error: itemError } = await supabase.from("invoice_items").select("line_total,vat_applicable").eq("invoice_id", invoiceId);

  if (itemError) throw new Error(itemError.message);

  const subtotal = Number((items ?? []).reduce((sum, item) => sum + Number(item.line_total ?? 0), 0).toFixed(2));
  const vatBase = Number(
    (items ?? [])
      .filter((item) => item.vat_applicable)
      .reduce((sum, item) => sum + Number(item.line_total ?? 0), 0)
      .toFixed(2)
  );
  const vatRate = Number(invoice.vat_rate ?? 0);
  const vatAmount = Number(((vatBase * vatRate) / 100).toFixed(2));
  const totalAmount = Number((subtotal + vatAmount).toFixed(2));

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ subtotal, vat_amount: vatAmount, total_amount: totalAmount, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (updateError) throw new Error(updateError.message);

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
  if (status === "pending_payment") return "bg-amber-100 text-amber-700";
  if (status === "issued") return "bg-blue-100 text-blue-700";
  if (status === "overdue") return "bg-red-100 text-red-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export function invoicePaymentStatusClasses(status: string) {
  if (status === "success") return "bg-emerald-100 text-emerald-700";
  if (status === "pending" || status === "initiated") return "bg-amber-100 text-amber-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  if (status === "refunded") return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-700";
}
