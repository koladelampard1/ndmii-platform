import Link from "next/link";
import { getScopedMsmes } from "@/lib/data/authorization-scope";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MsmePage() {
  const [rows, ctx] = await Promise.all([getScopedMsmes(), getCurrentUserContext()]);
  const supabase = await createServerSupabaseClient();

  const ids = rows.map((row) => row.id);
  const [{ data: compliance }, { data: taxes }, { data: vatRules }] = await Promise.all([
    supabase.from("compliance_profiles").select("msme_id,overall_status,nin_status,bvn_status,cac_status").in("msme_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("tax_profiles").select("msme_id,compliance_status,outstanding_amount,tax_category,vat_applicable").in("msme_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("vat_rules").select("category,vat_percent,status").eq("status", "active").order("category"),
  ]);

  const complianceMap = new Map((compliance ?? []).map((item) => [item.msme_id, item]));
  const taxMap = new Map((taxes ?? []).map((item) => [item.msme_id, item]));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{ctx.role === "msme" ? "My MSME Profile" : "MSME Registry"}</h1>
        {ctx.role === "msme" && (
          <Link href="/dashboard/msme/onboarding" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Update onboarding</Link>
        )}
      </div>

      {ctx.role === "msme" && (
        <article className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Active VAT rules from NRS</h2>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {(vatRules ?? []).slice(0, 4).map((rule) => (
              <p key={rule.category} className="rounded border bg-slate-50 px-3 py-2 text-sm">
                {rule.category}: <strong>{Number(rule.vat_percent).toFixed(2)}%</strong>
              </p>
            ))}
          </div>
        </article>
      )}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Sector</th>
              <th className="px-3 py-2">Validation</th>
              <th className="px-3 py-2">Tax / VAT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const complianceState = complianceMap.get(row.id);
              const taxState = taxMap.get(row.id);
              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <p className="font-semibold">{row.business_name}</p>
                    <p className="text-xs text-slate-500">{row.msme_id}</p>
                  </td>
                  <td className="px-3 py-2">{row.state}</td>
                  <td className="px-3 py-2">{row.sector}</td>
                  <td className="px-3 py-2 text-xs">
                    <p className="font-medium uppercase">{complianceState?.overall_status ?? "pending"}</p>
                    <p>NIN {complianceState?.nin_status ?? "pending"} • BVN {complianceState?.bvn_status ?? "pending"} • CAC {complianceState?.cac_status ?? "pending"}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <p>{taxState?.tax_category ?? "not profiled"}</p>
                    <p>{taxState?.vat_applicable ? "VAT applicable" : "VAT not applicable"} • {taxState?.compliance_status ?? "pending"}</p>
                    <p>Outstanding: ₦{Number(taxState?.outstanding_amount ?? 0).toLocaleString()}</p>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>No MSME records are visible for your role scope.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
