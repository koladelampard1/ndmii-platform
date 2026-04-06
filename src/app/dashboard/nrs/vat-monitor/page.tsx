import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/data/invoicing";

export default async function NrsVatMonitorPage() {
  const ctx = await getCurrentUserContext();
  if (!["nrs_officer", "firs_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { data: invoices, error } = await supabase.from("invoices").select("status,vat_amount,total_amount,created_at");
  if (error) throw new Error(error.message);

  const rows = invoices ?? [];
  const taxable = rows.filter((row) => Number(row.vat_amount) > 0);
  const taxableTotal = taxable.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const vatTotal = taxable.reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);
  const vatPaid = taxable.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4"><h1 className="text-2xl font-semibold">VAT Exposure Monitor</h1><p className="text-sm text-slate-600">Track taxable invoices, expected VAT, and paid VAT outcomes.</p></header>
      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Taxable invoices</p><p className="text-2xl font-semibold">{taxable.length}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Taxable value</p><p className="text-2xl font-semibold">{formatNaira(taxableTotal)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">VAT declared</p><p className="text-2xl font-semibold">{formatNaira(vatTotal)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">VAT from paid invoices</p><p className="text-2xl font-semibold text-emerald-700">{formatNaira(vatPaid)}</p></article>
      </div>
    </section>
  );
}
