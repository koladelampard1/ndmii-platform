import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira, invoiceStatusClasses } from "@/lib/data/invoicing";

export default async function ExecutiveInvoicesPage() {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,total_amount,vat_amount,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4"><h1 className="text-2xl font-semibold">Executive Invoice Activity</h1><p className="text-sm text-slate-600">Platform-wide transaction monitoring with recent invoice activity.</p></header>
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Invoice count</p><p className="text-2xl font-semibold">{(invoices ?? []).length}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Paid total</p><p className="text-2xl font-semibold text-emerald-700">{formatNaira((invoices ?? []).filter((i) => i.status === "paid").reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0))}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Unpaid total</p><p className="text-2xl font-semibold text-amber-700">{formatNaira((invoices ?? []).filter((i) => i.status !== "paid").reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0))}</p></article>
      </div>
      <article className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">VAT</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th></tr></thead><tbody>{(invoices ?? []).map((invoice) => <tr key={invoice.id} className="border-t"><td className="px-3 py-2">{invoice.invoice_number}</td><td className="px-3 py-2">{formatNaira(invoice.total_amount)}</td><td className="px-3 py-2">{formatNaira(invoice.vat_amount)}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs uppercase ${invoiceStatusClasses(invoice.status)}`}>{invoice.status}</span></td><td className="px-3 py-2">{new Date(invoice.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>
      </article>
    </section>
  );
}
