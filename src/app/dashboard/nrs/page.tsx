import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { demoDisclosure, formatNrsStatus, requireNrsWorkspace } from "@/lib/nrs/access";
import { formatNaira } from "@/lib/data/invoicing";

export default async function NrsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; sector?: string; status?: string; vat?: string; arrears?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  requireNrsWorkspace(ctx);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("tax_profiles")
    .select("id,msme_id,tax_category,vat_applicable,outstanding_amount,estimated_monthly_obligation,compliance_status,arrears_status,compliance_score,msmes!inner(msme_id,business_name,state,lga,sector,verification_status,tin)")
    .order("outstanding_amount", { ascending: false })
    .limit(300);

  if (params.status) query = query.eq("compliance_status", params.status);
  if (params.vat) query = query.eq("vat_applicable", params.vat === "true");
  if (params.arrears) query = query.eq("arrears_status", params.arrears);
  if (params.state) query = query.eq("msmes.state", params.state);
  if (params.sector) query = query.eq("msmes.sector", params.sector);
  if (params.q) {
    const q = params.q.trim().replace(/[%_,]/g, " ");
    if (q) query = (query as any).or(`business_name.ilike.%${q}%,msme_id.ilike.%${q}%`, { foreignTable: "msmes" });
  }
  const { data } = await query;

  const rows = data ?? [];

  const [{ data: vatRules }, { data: recentNotices }, { data: invoices }, { count: complianceQueueCount }] = await Promise.all([
    supabase.from("vat_rules").select("id,category,vat_percent,applies_to,status").order("updated_at", { ascending: false }),
    supabase.from("activity_logs").select("created_at,metadata").eq("action", "nrs_issue_notice").order("created_at", { ascending: false }).limit(5),
    supabase.from("invoices").select("id,status,total_amount,vat_amount"),
    supabase.from("msme_compliance_items").select("id", { count: "exact", head: true }).in("status", ["submitted", "resubmitted", "under_review", "changes_requested"]),
  ]);

  const totals = rows.reduce(
    (acc, row) => {
      const msme = row.msmes as any;
      acc.outstanding += Number(row.outstanding_amount ?? 0);
      if (String(row.compliance_status ?? "").includes("overdue") || String(row.arrears_status ?? "").includes("overdue")) acc.overdue += 1;
      if (String(row.compliance_status ?? "").includes("compliant")) acc.compliant += 1;
      if (msme?.verification_status === "verified") acc.verified += 1;
      if (msme?.tin) acc.tinReady += 1;
      if (msme?.state) acc.states.set(msme.state, (acc.states.get(msme.state) ?? 0) + 1);
      if (msme?.sector) acc.sectors.set(msme.sector, (acc.sectors.get(msme.sector) ?? 0) + 1);
      return acc;
    },
    { outstanding: 0, overdue: 0, compliant: 0, verified: 0, tinReady: 0, states: new Map<string, number>(), sectors: new Map<string, number>() }
  );
  const invoiceValue = (invoices ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const paidInvoiceValue = (invoices ?? []).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const vatExposure = (invoices ?? []).reduce((sum, row) => sum + Number(row.vat_amount ?? 0), 0);
  const topStates = [...totals.states.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topSectors = [...totals.sectors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border bg-gradient-to-r from-emerald-950 via-emerald-800 to-slate-900 p-6 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Nigeria Revenue Service • Executive demonstration</p>
        <h1 className="mt-2 text-2xl font-semibold">NRS Operations Console</h1>
        <p className="mt-1 max-w-3xl text-sm text-emerald-100">Revenue-readiness, taxpayer identity, compliance-review and DBIN-derived VAT exposure across participating MSMEs.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/dashboard/nrs/invoices" className="rounded bg-white/20 px-2 py-1 hover:bg-white/30">Invoice registry</Link>
          <Link href="/dashboard/nrs/vat-monitor" className="rounded bg-white/20 px-2 py-1 hover:bg-white/30">VAT monitor</Link>
          <Link href="/dashboard/nrs/revenue" className="rounded bg-white/20 px-2 py-1 hover:bg-white/30">Revenue monitor</Link>
          <Link href="/dashboard/revenue-guides" className="rounded bg-white/20 px-2 py-1 hover:bg-white/30">Revenue Guides</Link>
        </div>
        <p className="mt-4 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-emerald-50">{demoDisclosure()}</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Businesses tracked", rows.length.toLocaleString("en-NG"), "Demonstration Data"],
          ["DBIN Verified", totals.verified.toLocaleString("en-NG"), "Verified identity records"],
          ["BIN–TIN readiness", totals.tinReady.toLocaleString("en-NG"), "Pending NRS Integration"],
          ["Compliant taxpayers", totals.compliant.toLocaleString("en-NG"), "Evidence-based compliance"],
          ["Overdue obligations", totals.overdue.toLocaleString("en-NG"), "DBIN Derived"],
          ["Outstanding exposure", formatNaira(totals.outstanding), "DBIN Derived"],
          ["Invoice value", formatNaira(invoiceValue), "DBIN Derived"],
          ["Paid invoice value", formatNaira(paidInvoiceValue), "DBIN Derived"],
          ["VAT exposure", formatNaira(vatExposure), "Invoice-derived, not remittance"],
          ["Compliance-review queue", (complianceQueueCount ?? 0).toLocaleString("en-NG"), "Evidence awaiting action"],
          ["Active VAT rules", (vatRules ?? []).filter((r) => r.status === "active").length.toLocaleString("en-NG"), "Demonstration Data"],
        ].map(([label, value, tag]) => (
          <article key={label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-[11px] text-emerald-700">{tag}</p>
          </article>
        ))}
      </div>

      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
        <input name="q" defaultValue={params.q} placeholder="business or MSME ID" className="rounded border px-2 py-2 text-sm" />
        <input name="state" defaultValue={params.state} placeholder="state" className="rounded border px-2 py-2 text-sm" />
        <input name="sector" defaultValue={params.sector} placeholder="sector" className="rounded border px-2 py-2 text-sm" />
        <input name="status" defaultValue={params.status} placeholder="compliance status" className="rounded border px-2 py-2 text-sm" />
        <input name="arrears" defaultValue={params.arrears} placeholder="arrears status" className="rounded border px-2 py-2 text-sm" />
        <button className="rounded bg-emerald-800 px-3 py-2 text-sm text-white">Apply filters</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700"><tr><th className="px-3 py-2">MSME</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Monthly obligation</th><th className="px-3 py-2">Outstanding</th><th className="px-3 py-2">Compliance</th><th className="px-3 py-2">Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No tax records match your filter set.</td></tr>}
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-3">{(row.msmes as any)?.business_name}<p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id} • {(row.msmes as any)?.state}</p></td>
                  <td className="px-3 py-3">{formatNrsStatus(row.tax_category)}</td>
                  <td className="px-3 py-3">₦{Number(row.estimated_monthly_obligation).toLocaleString()}</td>
                  <td className="px-3 py-3">₦{Number(row.outstanding_amount).toLocaleString()}</td>
                  <td className="px-3 py-3 capitalize">{formatNrsStatus(row.compliance_status)}<p className="text-xs text-slate-500">arrears: {formatNrsStatus(row.arrears_status)} • score {row.compliance_score}</p></td>
                  <td className="px-3 py-3"><Link href={`/dashboard/nrs/${(row.msmes as any)?.msme_id}`} className="text-xs text-emerald-700 hover:underline">Open tax profile →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="space-y-4">
          <article className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">State distribution</h2>
            <div className="mt-2 space-y-2 text-sm">
              {topStates.length === 0 && <p className="text-slate-500">Unavailable for current filters.</p>}
              {topStates.map(([state, count]) => <p key={state} className="flex justify-between rounded border px-2 py-1"><span>{state}</span><span>{count}</span></p>)}
            </div>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Sector distribution</h2>
            <div className="mt-2 space-y-2 text-sm">
              {topSectors.length === 0 && <p className="text-slate-500">Unavailable for current filters.</p>}
              {topSectors.map(([sector, count]) => <p key={sector} className="flex justify-between rounded border px-2 py-1"><span>{sector}</span><span>{count}</span></p>)}
            </div>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">VAT category rules</h2>
            <div className="mt-2 space-y-2 text-sm">
              {(vatRules ?? []).slice(0, 6).map((rule) => (
                <p key={rule.id} className="rounded border px-2 py-1">{rule.category}: {Number(rule.vat_percent).toFixed(2)}% ({rule.applies_to})</p>
              ))}
            </div>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Recent notices</h2>
            <div className="mt-2 space-y-2 text-xs text-slate-600">
              {(recentNotices ?? []).map((notice, idx) => (
                <p key={idx} className="rounded border px-2 py-1">{new Date(notice.created_at).toLocaleString()} • {(notice.metadata as any)?.notice_type ?? "notice"}</p>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
