import Link from "next/link";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateTime, formatNaira, invoicePaymentStatusClasses } from "@/lib/data/invoicing";

function monthKey(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function MsmeRevenuePage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,total_amount,vat_amount,created_at,paid_at")
    .eq("provider_profile_id", workspace.provider.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = invoices ?? [];
  const invoiceIds = rows.map((row) => row.id);

  const { data: payments, error: paymentError } = await supabase
    .from("invoice_payments")
    .select("invoice_id,payment_reference,payment_status,amount,created_at")
    .in("invoice_id", invoiceIds.length ? invoiceIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false })
    .limit(25);

  if (paymentError) throw new Error(paymentError.message);

  const totalInvoiced = rows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const paidTotal = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const pendingTotal = rows.filter((row) => ["issued", "pending_payment", "overdue"].includes(row.status)).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const vatExposure = rows.reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);

  const monthly = new Map<string, { period: string; invoiced: number; paid: number }>();
  for (const row of rows) {
    const key = monthKey(row.created_at);
    const point = monthly.get(key) ?? { period: key, invoiced: 0, paid: 0 };
    point.invoiced += Number(row.total_amount ?? 0);
    if (row.status === "paid") point.paid += Number(row.total_amount ?? 0);
    monthly.set(key, point);
  }

  const trend = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, point]) => point);

  const invoiceMap = new Map(rows.map((row) => [row.id, row]));

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <h2 className="text-xl font-semibold">Revenue overview</h2>
        <p className="text-sm text-slate-600">Paid and pending invoice activity for your provider workspace.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Total invoiced</p><p className="text-2xl font-semibold">{formatNaira(totalInvoiced)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Paid</p><p className="text-2xl font-semibold text-emerald-700">{formatNaira(paidTotal)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Pending</p><p className="text-2xl font-semibold text-amber-700">{formatNaira(pendingTotal)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">VAT exposure</p><p className="text-2xl font-semibold">{formatNaira(vatExposure)}</p></article>
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h3 className="font-semibold">6-month trend</h3>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="px-2 py-2">Period</th><th className="px-2 py-2">Invoiced</th><th className="px-2 py-2">Paid</th></tr></thead>
          <tbody>
            {trend.map((row) => (
              <tr key={row.period} className="border-t"><td className="px-2 py-2">{row.period}</td><td className="px-2 py-2">{formatNaira(row.invoiced)}</td><td className="px-2 py-2">{formatNaira(row.paid)}</td></tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Recent invoice payment activity</h3>
        <div className="mt-3 space-y-2 text-sm">
          {(payments ?? []).length === 0 && <p className="text-slate-500">No invoice payment activity yet.</p>}
          {(payments ?? []).slice(0, 8).map((payment) => {
            const invoice = invoiceMap.get(payment.invoice_id);
            return (
              <div key={payment.payment_reference} className="rounded border p-3">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{invoice?.invoice_number ?? payment.invoice_id.slice(0, 8)}</span>
                  <span className={`rounded-full px-2 py-1 text-xs uppercase ${invoicePaymentStatusClasses(payment.payment_status)}`}>{payment.payment_status}</span>
                </p>
                <p className="text-slate-600">
                  {payment.payment_reference} · {formatNaira(payment.amount)} · {formatDateTime(payment.created_at)}
                </p>
                {invoice && <Link className="text-indigo-700 hover:underline" href={`/dashboard/msme/invoices/${invoice.id}`}>Open invoice</Link>}
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}
