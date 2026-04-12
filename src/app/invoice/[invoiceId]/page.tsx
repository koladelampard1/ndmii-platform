import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDate, formatNaira, invoiceStatusClasses } from "@/lib/data/invoicing";

export default async function PublicInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,customer_name,customer_email,customer_phone,currency,subtotal,vat_rate,vat_amount,total_amount,status,due_date,issued_at,provider_profiles(display_name,contact_email,contact_phone)"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return <section className="rounded-xl border bg-white p-8 text-center">Invoice not found.</section>;
  console.info("[public-invoice:header-totals]", {
    invoiceId,
    subtotal: Number(invoice.subtotal ?? 0),
    vatRate: Number(invoice.vat_rate ?? 0),
    vatAmount: Number(invoice.vat_amount ?? 0),
    totalAmount: Number(invoice.total_amount ?? 0),
    source: "invoices_table",
  });

  const { data: items, error: itemError } = await supabase
    .from("invoice_items")
    .select("id,item_name,description,quantity,unit_price,line_total,vat_applicable")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if (itemError) throw new Error(itemError.message);
  const itemDerivedSubtotal = Number((items ?? []).reduce((sum, item) => sum + Number(item.line_total ?? 0), 0).toFixed(2));
  console.info("[public-invoice:item-totals]", {
    invoiceId,
    itemCount: (items ?? []).length,
    itemDerivedSubtotal,
    source: "invoice_items_table",
    displayTotalsSource: "invoices_table_columns",
  });

  const provider = invoice.provider_profiles as { display_name?: string; contact_email?: string; contact_phone?: string } | null;

  return (
    <section className="mx-auto max-w-5xl space-y-4 py-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">NDMII trusted billing portal</p>
            <h1 className="text-2xl font-semibold">Invoice {invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-slate-600">Public payment portal for verified Nigerian MSME services.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs uppercase ${invoiceStatusClasses(invoice.status)}`}>{invoice.status.replace("_", " ")}</span>
        </div>
      </header>

      <article className="grid gap-4 lg:grid-cols-[1.3fr_2fr]">
        <aside className="space-y-4 rounded-2xl border bg-white p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Provider identity</p>
            <p className="text-lg font-semibold text-slate-900">{provider?.display_name ?? "Verified provider"}</p>
            <p className="text-sm text-slate-600">{provider?.contact_email ?? "No provider email supplied"}</p>
            <p className="text-sm text-slate-600">{provider?.contact_phone ?? "No provider phone supplied"}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-3 text-sm">
            <p className="flex justify-between"><span className="text-slate-500">Issued date</span><span className="font-medium">{formatDate(invoice.issued_at)}</span></p>
            <p className="mt-2 flex justify-between"><span className="text-slate-500">Due date</span><span className="font-medium">{formatDate(invoice.due_date)}</span></p>
            <p className="mt-2 flex justify-between"><span className="text-slate-500">Currency</span><span className="font-medium">{invoice.currency}</span></p>
          </div>

          <div className="rounded-xl border bg-white p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Billing customer</p>
            <p className="font-medium">{invoice.customer_name}</p>
            <p className="text-slate-600">{invoice.customer_email ?? "No customer email"}</p>
            <p className="text-slate-600">{invoice.customer_phone ?? "No customer phone"}</p>
          </div>
        </aside>

        <div className="space-y-4 rounded-2xl border bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold">Itemized billing</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2">Line total</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((item) => (
                  <tr key={item.id} className="border-t align-top">
                    <td className="px-2 py-2">
                      <p className="font-medium">{item.item_name}</p>
                      <p className="text-xs text-slate-500">{item.description ?? "No description"}</p>
                    </td>
                    <td className="px-2 py-2">{item.quantity}</td>
                    <td className="px-2 py-2">{formatNaira(item.unit_price)}</td>
                    <td className="px-2 py-2 font-medium">{formatNaira(item.line_total)}</td>
                  </tr>
                ))}
                {(items ?? []).length === 0 && (
                  <tr>
                    <td className="px-2 py-6 text-center text-slate-500" colSpan={4}>
                      No invoice line items available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-sm rounded-xl border bg-slate-50 p-4 text-sm">
            <p className="flex justify-between"><span>Subtotal</span><span>{formatNaira(invoice.subtotal)}</span></p>
            <p className="mt-2 flex justify-between"><span>VAT ({invoice.vat_rate}%)</span><span>{formatNaira(invoice.vat_amount)}</span></p>
            <p className="mt-2 flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{formatNaira(invoice.total_amount)}</span></p>
          </div>

          <div className="flex flex-wrap gap-2">
            {invoice.status !== "paid" && (
              <Link href={`/invoice/${invoice.id}/pay`} className="rounded-lg bg-indigo-900 px-4 py-2 text-sm text-white">
                Pay this invoice
              </Link>
            )}
            <Link href={`/invoice/${invoice.id}/status`} className="rounded-lg border px-4 py-2 text-sm">
              Check payment status
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}
