import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira, invoiceStatusClasses } from "@/lib/data/invoicing";

export default async function PublicInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,customer_name,customer_email,currency,subtotal,vat_rate,vat_amount,total_amount,status,due_date,provider_profiles(display_name,contact_email,contact_phone)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return <section className="rounded-xl border bg-white p-8 text-center">Invoice not found.</section>;

  const { data: items } = await supabase
    .from("invoice_items")
    .select("id,item_name,description,quantity,unit_price,line_total,vat_applicable")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  return (
    <section className="mx-auto max-w-4xl space-y-4 py-6">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">NDMII Verified Invoice</p>
            <h1 className="text-2xl font-semibold">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-slate-600">Issued by {(invoice.provider_profiles as any)?.display_name}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs uppercase ${invoiceStatusClasses(invoice.status)}`}>{invoice.status}</span>
        </div>
      </header>

      <article className="rounded-2xl border bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div><p className="text-xs uppercase text-slate-500">Billed to</p><p className="font-medium">{invoice.customer_name}</p><p className="text-sm text-slate-600">{invoice.customer_email ?? "No email"}</p></div>
          <div><p className="text-xs uppercase text-slate-500">Due date</p><p className="font-medium">{invoice.due_date ?? "Not specified"}</p></div>
        </div>

        <table className="mt-4 w-full text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="px-2 py-2">Item</th><th className="px-2 py-2">Qty</th><th className="px-2 py-2">Unit</th><th className="px-2 py-2">Line total</th></tr></thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id} className="border-t"><td className="px-2 py-2">{item.item_name}<p className="text-xs text-slate-500">{item.description}</p></td><td className="px-2 py-2">{item.quantity}</td><td className="px-2 py-2">{formatNaira(item.unit_price)}</td><td className="px-2 py-2">{formatNaira(item.line_total)}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-sm space-y-2 text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>{formatNaira(invoice.subtotal)}</span></p>
          <p className="flex justify-between"><span>VAT ({invoice.vat_rate}%)</span><span>{formatNaira(invoice.vat_amount)}</span></p>
          <p className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{formatNaira(invoice.total_amount)}</span></p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/invoice/${invoice.id}/pay`} className="rounded-lg bg-indigo-900 px-4 py-2 text-sm text-white">Proceed to payment</Link>
          <Link href={`/invoice/${invoice.id}/status`} className="rounded-lg border px-4 py-2 text-sm">View payment status</Link>
        </div>
      </article>
    </section>
  );
}
