import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/data/invoicing";
import { loadRevenueSnapshot } from "@/lib/data/commercial-ops";
import { demoDisclosure, requireNrsWorkspace } from "@/lib/nrs/access";

export default async function NrsVatMonitorPage() {
  const ctx = await getCurrentUserContext();
  requireNrsWorkspace(ctx);

  const supabase = await createServerSupabaseClient();
  const { invoices: rows } = await loadRevenueSnapshot(supabase);

  const taxable = rows.filter((row) => Number(row.vat_amount ?? 0) > 0);
  const taxableTotal = taxable.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const vatTotal = taxable.reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);
  const vatPaid = taxable.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4"><h1 className="text-2xl font-semibold">VAT Exposure Monitor</h1><p className="text-sm text-slate-600">Track taxable DBIN invoices, expected VAT exposure, and paid invoice outcomes. This is not an official VAT remittance ledger.</p><p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{demoDisclosure()}</p></header>
      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Taxable invoices</p><p className="text-2xl font-semibold">{taxable.length}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Taxable value</p><p className="text-2xl font-semibold">{formatNaira(taxableTotal)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">VAT declared</p><p className="text-2xl font-semibold">{formatNaira(vatTotal)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">VAT from paid invoices</p><p className="text-2xl font-semibold text-emerald-700">{formatNaira(vatPaid)}</p></article>
      </div>
    </section>
  );
}
