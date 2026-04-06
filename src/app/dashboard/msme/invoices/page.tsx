import Link from "next/link";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira, invoiceStatusClasses } from "@/lib/data/invoicing";

export default async function MsmeInvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("invoices")
    .select("id,invoice_number,customer_name,due_date,total_amount,status,issued_at,created_at")
    .eq("provider_profile_id", workspace.provider.id)
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);

  const { data: invoices, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <div>
          <h2 className="text-xl font-semibold">Invoices</h2>
          <p className="text-sm text-slate-600">Create invoices, monitor payment status, and manage customer billing lifecycle.</p>
        </div>
        <Link href="/dashboard/msme/invoices/new" className="rounded-lg bg-indigo-900 px-4 py-2 text-sm font-medium text-white">New invoice</Link>
      </header>

      <form className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <select name="status" defaultValue={params.status ?? ""} className="rounded border px-2 py-2 text-sm">
            <option value="">All statuses</option>
            {['draft', 'issued', 'pending_payment', 'paid', 'overdue', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button className="rounded border px-3 py-2 text-sm">Apply filter</button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).length === 0 && <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={6}>No invoices found.</td></tr>}
            {(invoices ?? []).map((invoice) => (
              <tr key={invoice.id} className="border-t">
                <td className="px-3 py-3">
                  <p className="font-medium">{invoice.invoice_number}</p>
                  <p className="text-xs text-slate-500">Created {new Date(invoice.created_at).toLocaleDateString()}</p>
                </td>
                <td className="px-3 py-3">{invoice.customer_name}</td>
                <td className="px-3 py-3">{invoice.due_date ?? '—'}</td>
                <td className="px-3 py-3 font-medium">{formatNaira(invoice.total_amount)}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs uppercase ${invoiceStatusClasses(invoice.status)}`}>{invoice.status}</span></td>
                <td className="px-3 py-3">
                  <Link href={`/dashboard/msme/invoices/${invoice.id}`} className="text-indigo-700 hover:underline">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
