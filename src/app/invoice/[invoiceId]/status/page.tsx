import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateTime, formatNaira, invoicePaymentStatusClasses, invoiceStatusClasses } from "@/lib/data/invoicing";

export default async function PublicInvoiceStatusPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,total_amount,paid_at,updated_at")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return <section className="rounded-xl border bg-white p-8 text-center">Invoice not found.</section>;

  const [{ data: payments, error: paymentsError }, { data: events, error: eventsError }] = await Promise.all([
    supabase
      .from("invoice_payments")
      .select("payment_reference,payment_method,payment_status,amount,paid_at,created_at")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("invoice_events").select("event_type,actor_role,metadata,created_at").eq("invoice_id", invoice.id).order("created_at", { ascending: false }).limit(12),
  ]);

  if (paymentsError) throw new Error(paymentsError.message);
  if (eventsError) throw new Error(eventsError.message);

  return (
    <section className="mx-auto max-w-3xl space-y-4 py-6">
      <header className="rounded-xl border bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">NDMII payment receipt</p>
        <h1 className="text-2xl font-semibold">Invoice payment status</h1>
        <p className="text-sm text-slate-600">{invoice.invoice_number}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs uppercase ${invoiceStatusClasses(invoice.status)}`}>{invoice.status.replace("_", " ")}</span>
          <span className="text-sm">Amount: {formatNaira(invoice.total_amount)}</span>
          <span className="text-sm">Last update: {formatDateTime(invoice.updated_at)}</span>
        </div>
      </header>

      <article className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Payment attempts</h2>
        <div className="mt-3 space-y-2 text-sm">
          {(payments ?? []).length === 0 && <p className="text-slate-500">No payment attempts yet.</p>}
          {(payments ?? []).map((payment) => (
            <div key={payment.payment_reference} className="rounded border p-3">
              <p className="flex items-center justify-between gap-2 font-medium">
                <span>{payment.payment_reference}</span>
                <span className={`rounded-full px-2 py-1 text-xs uppercase ${invoicePaymentStatusClasses(payment.payment_status)}`}>{payment.payment_status}</span>
              </p>
              <p className="mt-1 text-slate-600">
                {payment.payment_method} · {formatNaira(payment.amount)} · Attempted {formatDateTime(payment.created_at)}
              </p>
              {payment.paid_at && <p className="text-slate-600">Paid at: {formatDateTime(payment.paid_at)}</p>}
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Activity log</h2>
        <div className="mt-3 space-y-2 text-sm">
          {(events ?? []).length === 0 && <p className="text-slate-500">No invoice events recorded.</p>}
          {(events ?? []).map((event, idx) => (
            <div key={`${event.event_type}-${idx}`} className="rounded border p-3">
              <p className="font-medium">{event.event_type}</p>
              <p className="text-slate-600">
                {(event.actor_role ?? "system").replace("_", " ")} · {formatDateTime(event.created_at)}
              </p>
            </div>
          ))}
        </div>
      </article>

      <div className="flex gap-2">
        <Link href={`/invoice/${invoice.id}`} className="rounded border px-3 py-2 text-sm">
          Back to invoice
        </Link>
        {invoice.status !== "paid" && (
          <Link href={`/invoice/${invoice.id}/pay`} className="rounded bg-indigo-900 px-3 py-2 text-sm text-white">
            Retry payment
          </Link>
        )}
      </div>
    </section>
  );
}
