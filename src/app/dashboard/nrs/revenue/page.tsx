import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/data/invoicing";
import { loadRevenueSnapshot } from "@/lib/data/commercial-ops";

function monthKey(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function NrsRevenuePage() {
  const ctx = await getCurrentUserContext();
  if (!["nrs_officer", "firs_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { invoices: rows } = await loadRevenueSnapshot(supabase);

  const total = rows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const paid = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const outstanding = total - paid;

  const providerTotals = new Map<string, number>();
  rows.forEach((row) => providerTotals.set(row.provider_profile_id ?? "unknown", (providerTotals.get(row.provider_profile_id ?? "unknown") ?? 0) + Number(row.total_amount ?? 0)));

  const trend = new Map<string, { invoiced: number; paid: number }>();
  rows.forEach((row) => {
    const key = monthKey(row.created_at);
    const entry = trend.get(key) ?? { invoiced: 0, paid: 0 };
    const amount = Number(row.total_amount ?? 0);
    entry.invoiced += amount;
    if (row.status === "paid") entry.paid += amount;
    trend.set(key, entry);
  });

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4"><h1 className="text-2xl font-semibold">NRS Revenue Monitor</h1><p className="text-sm text-slate-600">Invoiced vs paid trends for national marketplace tax analytics.</p></header>
      <div className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Total invoiced</p><p className="text-2xl font-semibold">{formatNaira(total)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Total paid</p><p className="text-2xl font-semibold text-emerald-700">{formatNaira(paid)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Outstanding</p><p className="text-2xl font-semibold text-amber-700">{formatNaira(outstanding)}</p></article>
        <article className="rounded-xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Collection ratio</p><p className="text-2xl font-semibold">{total > 0 ? Math.round((paid / total) * 100) : 0}%</p></article>
      </div>
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Revenue trend (invoiced vs paid)</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="px-2 py-2">Month</th><th className="px-2 py-2">Invoiced</th><th className="px-2 py-2">Paid</th></tr></thead>
          <tbody>
            {[...trend.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([month, amount]) => (
              <tr key={month} className="border-t"><td className="px-2 py-2">{month}</td><td className="px-2 py-2">{formatNaira(amount.invoiced)}</td><td className="px-2 py-2">{formatNaira(amount.paid)}</td></tr>
            ))}
          </tbody>
        </table>
      </article>
      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Top providers by invoiced value</h2>
        <div className="mt-2 space-y-2 text-sm">
          {[...providerTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([providerId, amount]) => <p key={providerId} className="rounded border px-2 py-1">{providerId.slice(0, 8)}… : {formatNaira(amount)}</p>)}
        </div>
      </article>
    </section>
  );
}
