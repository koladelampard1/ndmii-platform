import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira, invoiceStatusClasses } from "@/lib/data/invoicing";

export default async function NrsInvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; state?: string; category?: string; provider?: string }> }) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["nrs_officer", "firs_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  let query = supabase.from("invoices").select("id,provider_profile_id,invoice_number,status,total_amount,vat_amount,created_at").order("created_at", { ascending: false }).limit(400);
  if (params.status) query = query.eq("status", params.status);
  const { data: invoices, error } = await query;
  if (error) throw new Error(error.message);

  const providerIds = [...new Set((invoices ?? []).map((row) => row.provider_profile_id))];
  const { data: providers } = await supabase
    .from("provider_profiles")
    .select("id,display_name,provider_categories(category_id),msmes!inner(state),provider_categories(service_categories(name))")
    .in("id", providerIds);

  const providerMap = new Map((providers ?? []).map((p: any) => [p.id, p]));
  let rows = (invoices ?? []).map((invoice) => ({ invoice, provider: providerMap.get(invoice.provider_profile_id) as any }));

  if (params.state) rows = rows.filter((row) => row.provider?.msmes?.state === params.state);
  if (params.provider) rows = rows.filter((row) => (row.provider?.display_name ?? "").toLowerCase().includes((params.provider ?? "").toLowerCase()));
  if (params.category) rows = rows.filter((row) => (row.provider?.provider_categories ?? []).some((entry: any) => (entry.service_categories?.name ?? "") === params.category));

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4"><h1 className="text-2xl font-semibold">NRS Invoice Registry</h1><p className="text-sm text-slate-600">Search invoice activity across providers, states, and sectors for tax exposure monitoring.</p></header>
      <form className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-5">
        <input name="provider" defaultValue={params.provider} placeholder="provider name" className="rounded border px-2 py-2 text-sm" />
        <input name="state" defaultValue={params.state} placeholder="state" className="rounded border px-2 py-2 text-sm" />
        <input name="category" defaultValue={params.category} placeholder="category" className="rounded border px-2 py-2 text-sm" />
        <select name="status" defaultValue={params.status ?? ""} className="rounded border px-2 py-2 text-sm"><option value="">all status</option>{["draft","issued","pending_payment","paid","overdue","cancelled"].map((s)=><option key={s} value={s}>{s}</option>)}</select>
        <button className="rounded bg-emerald-800 px-3 py-2 text-sm text-white">Apply</button>
      </form>
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">VAT</th><th className="px-3 py-2">Status</th></tr></thead><tbody>
          {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No invoices match filters.</td></tr>}
          {rows.map(({ invoice, provider }) => (
            <tr key={invoice.id} className="border-t"><td className="px-3 py-3">{invoice.invoice_number}</td><td className="px-3 py-3">{provider?.display_name ?? "Unknown"}</td><td className="px-3 py-3">{provider?.msmes?.state ?? "—"}</td><td className="px-3 py-3">{formatNaira(invoice.total_amount)}</td><td className="px-3 py-3">{formatNaira(invoice.vat_amount)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs uppercase ${invoiceStatusClasses(invoice.status)}`}>{invoice.status}</span></td></tr>
          ))}
        </tbody></table>
      </div>
    </section>
  );
}
