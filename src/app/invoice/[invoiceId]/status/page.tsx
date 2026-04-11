import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateTime, formatNaira, invoicePaymentStatusClasses, invoiceStatusClasses } from "@/lib/data/invoicing";
import { getTableColumns, pickExistingColumns } from "@/lib/data/commercial-ops";

export default async function PublicInvoiceStatusPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createServerSupabaseClient();

  const invoiceColumns = await getTableColumns(supabase, "invoices");
  const invoiceSelect = pickExistingColumns(invoiceColumns, ["id", "invoice_number", "status", "total_amount", "updated_at"]).join(",");
  const { data: invoice, error } = await supabase.from("invoices").select(invoiceSelect || "id").eq("id", invoiceId).maybeSingle();

  if (error) return <section className="rounded-xl border bg-white p-8 text-center">Invoice status is temporarily unavailable.</section>;
  if (!invoice) return <section className="rounded-xl border bg-white p-8 text-center">Invoice not found.</section>;
  const invoiceRow = invoice as any;

  const paymentColumns = await getTableColumns(supabase, "invoice_payments");
  const paymentSelect = pickExistingColumns(paymentColumns, ["payment_reference", "payment_method", "payment_status", "amount", "paid_at", "created_at", "invoice_id"]).join(",");
  const eventColumns = await getTableColumns(supabase, "invoice_events");
  const eventSelect = pickExistingColumns(eventColumns, ["event_type", "actor_role", "metadata", "created_at", "invoice_id"]).join(",");

  const paymentsResult = paymentSelect
    ? await supabase.from("invoice_payments").select(paymentSelect).eq("invoice_id", invoiceRow.id).order("created_at", { ascending: false }).limit(10)
    : { data: [] as any[] };
  const eventsResult = eventSelect
    ? await supabase.from("invoice_events").select(eventSelect).eq("invoice_id", invoiceRow.id).order("created_at", { ascending: false }).limit(12)
    : { data: [] as any[] };

  const payments = (paymentsResult.data as any[]) ?? [];
  const events = (eventsResult.data as any[]) ?? [];

  return (
    <section className="mx-auto max-w-3xl space-y-4 py-6">
      <header className="rounded-xl border bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">NDMII payment receipt</p>
        <h1 className="text-2xl font-semibold">Invoice payment status</h1>
        <p className="text-sm text-slate-600">{invoiceRow.invoice_number}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs uppercase ${invoiceStatusClasses(String(invoiceRow.status ?? "draft"))}`}>{String(invoiceRow.status ?? "draft").replace("_", " ")}</span>
          <span className="text-sm">Amount: {formatNaira(invoiceRow.total_amount)}</span>
          <span className="text-sm">Last update: {formatDateTime(invoiceRow.updated_at)}</span>
        </div>
      </header>

      <article className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Payment attempts</h2>
        <div className="mt-3 space-y-2 text-sm">
          {payments.length === 0 && <p className="text-slate-500">No payment attempts yet.</p>}
          {payments.map((payment) => (
            <div key={payment.payment_reference ?? payment.created_at} className="rounded border p-3">
              <p className="flex items-center justify-between gap-2 font-medium">
                <span>{payment.payment_reference ?? "N/A"}</span>
                <span className={`rounded-full px-2 py-1 text-xs uppercase ${invoicePaymentStatusClasses(String(payment.payment_status ?? "pending"))}`}>{payment.payment_status ?? "pending"}</span>
              </p>
              <p className="mt-1 text-slate-600">
                {payment.payment_method ?? "manual"} · {formatNaira(payment.amount)} · Attempted {formatDateTime(payment.created_at)}
              </p>
              {payment.paid_at && <p className="text-slate-600">Paid at: {formatDateTime(payment.paid_at)}</p>}
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Activity log</h2>
        <div className="mt-3 space-y-2 text-sm">
          {events.length === 0 && <p className="text-slate-500">No invoice events recorded.</p>}
          {events.map((event, idx) => (
            <div key={`${event.event_type}-${idx}`} className="rounded border p-3">
              <p className="font-medium">{event.event_type}</p>
              <p className="text-slate-600">
                {String(event.actor_role ?? "system").replace("_", " ")} · {formatDateTime(event.created_at)}
              </p>
            </div>
          ))}
        </div>
      </article>

      <div className="flex gap-2">
        <Link href={`/invoice/${invoiceRow.id}`} className="rounded border px-3 py-2 text-sm">
          Back to invoice
        </Link>
        {invoiceRow.status !== "paid" && (
          <Link href={`/invoice/${invoiceRow.id}/pay`} className="rounded bg-indigo-900 px-3 py-2 text-sm text-white">
            Retry payment
          </Link>
        )}
      </div>
    </section>
  );
}
