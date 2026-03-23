import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

export default async function NrsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; sector?: string; status?: string; vat?: string; arrears?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["firs_officer", "nrs_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("tax_profiles")
    .select("id,msme_id,tax_category,vat_applicable,outstanding_amount,estimated_monthly_obligation,compliance_status,arrears_status,compliance_score,msmes(msme_id,business_name,state,sector)")
    .order("outstanding_amount", { ascending: false });

  let rows = data ?? [];
  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter((row) => {
      const msme = row.msmes as any;
      return msme?.business_name?.toLowerCase().includes(q) || msme?.msme_id?.toLowerCase().includes(q);
    });
  }
  if (params.state) rows = rows.filter((row) => (row.msmes as any)?.state === params.state);
  if (params.sector) rows = rows.filter((row) => (row.msmes as any)?.sector === params.sector);
  if (params.status) rows = rows.filter((row) => row.compliance_status === params.status);
  if (params.vat) rows = rows.filter((row) => row.vat_applicable === (params.vat === "true"));
  if (params.arrears) rows = rows.filter((row) => row.arrears_status === params.arrears);

  const totals = rows.reduce(
    (acc, row) => {
      acc.outstanding += Number(row.outstanding_amount ?? 0);
      if ((row.compliance_status ?? "").includes("overdue")) acc.overdue += 1;
      if ((row.compliance_status ?? "").includes("compliant")) acc.compliant += 1;
      return acc;
    },
    { outstanding: 0, overdue: 0, compliant: 0 }
  );

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border bg-gradient-to-r from-emerald-950 to-emerald-700 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-semibold">NRS Operations Console</h1>
        <p className="mt-1 text-sm text-emerald-100">NRS (Nigeria Revenue Service) revenue operations, notices, and MSME tax posture management.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Tracked MSMEs</p><p className="text-2xl font-semibold">{rows.length}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Outstanding exposure</p><p className="text-2xl font-semibold">₦{totals.outstanding.toLocaleString()}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Overdue / Compliant</p><p className="text-2xl font-semibold">{totals.overdue} / {totals.compliant}</p></article>
      </div>

      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
        <input name="q" defaultValue={params.q} placeholder="business or MSME ID" className="rounded border px-2 py-2 text-sm" />
        <input name="state" defaultValue={params.state} placeholder="state" className="rounded border px-2 py-2 text-sm" />
        <input name="sector" defaultValue={params.sector} placeholder="sector" className="rounded border px-2 py-2 text-sm" />
        <input name="status" defaultValue={params.status} placeholder="compliance status" className="rounded border px-2 py-2 text-sm" />
        <input name="arrears" defaultValue={params.arrears} placeholder="arrears status" className="rounded border px-2 py-2 text-sm" />
        <button className="rounded bg-emerald-800 px-3 py-2 text-sm text-white">Apply filters</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700"><tr><th className="px-3 py-2">MSME</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Monthly obligation</th><th className="px-3 py-2">Outstanding</th><th className="px-3 py-2">Compliance</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No tax records match your filter set.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-3">{(row.msmes as any)?.business_name}<p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id} • {(row.msmes as any)?.state}</p></td>
                <td className="px-3 py-3">{row.tax_category}</td>
                <td className="px-3 py-3">₦{Number(row.estimated_monthly_obligation).toLocaleString()}</td>
                <td className="px-3 py-3">₦{Number(row.outstanding_amount).toLocaleString()}</td>
                <td className="px-3 py-3">{row.compliance_status}<p className="text-xs text-slate-500">arrears: {row.arrears_status} • score {row.compliance_score}</p></td>
                <td className="px-3 py-3"><Link href={`/dashboard/nrs/${(row.msmes as any)?.msme_id}`} className="text-xs text-emerald-700 hover:underline">Open tax profile →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
