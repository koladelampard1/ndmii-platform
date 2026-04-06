import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/data/invoicing";

function monthKey(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ExecutiveRevenuePage() {
  const ctx = await getCurrentUserContext();
  if (ctx.role !== "admin") redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { data: invoices, error } = await supabase.from("invoices").select("status,total_amount,created_at");
  if (error) throw new Error(error.message);

  const rows = invoices ?? [];
  const monthly = new Map<string, { invoiced: number; paid: number }>();
  for (const row of rows) {
    const key = monthKey(row.created_at);
    const point = monthly.get(key) ?? { invoiced: 0, paid: 0 };
    point.invoiced += Number(row.total_amount ?? 0);
    if (row.status === "paid") point.paid += Number(row.total_amount ?? 0);
    monthly.set(key, point);
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4"><h1 className="text-2xl font-semibold">Executive Revenue Dashboard</h1><p className="text-sm text-slate-600">Platform revenue trends and payment conversion visibility.</p></header>
      <article className="rounded-xl border bg-white p-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="px-2 py-2">Period</th><th className="px-2 py-2">Invoiced</th><th className="px-2 py-2">Paid</th><th className="px-2 py-2">Collection</th></tr></thead>
          <tbody>
            {[...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-10).map(([period, point]) => (
              <tr key={period} className="border-t"><td className="px-2 py-2">{period}</td><td className="px-2 py-2">{formatNaira(point.invoiced)}</td><td className="px-2 py-2">{formatNaira(point.paid)}</td><td className="px-2 py-2">{point.invoiced > 0 ? Math.round((point.paid / point.invoiced) * 100) : 0}%</td></tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
