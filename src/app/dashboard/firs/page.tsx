import Link from "next/link";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/data/operations";
import { supabase } from "@/lib/supabase/client";
import { getCurrentUserContext } from "@/lib/auth/session";

async function firsQuickAction(formData: FormData) {
  "use server";
  const ctx = await getCurrentUserContext();
  if (!["firs_officer", "admin"].includes(ctx.role)) redirect("/access-denied");
  const taxId = String(formData.get("tax_id"));
  const msmeId = String(formData.get("msme_id"));
  const action = String(formData.get("action"));

  if (action === "reminder") {
    await supabase.from("tax_profiles").update({ last_reminder_at: new Date().toISOString() }).eq("id", taxId);
    await logActivity("firs_mark_reminder_sent", "tax_profile", taxId, { msmeId });
  }

  if (action === "under_review") {
    await supabase.from("tax_profiles").update({ compliance_status: "under review", last_reviewed_at: new Date().toISOString() }).eq("id", taxId);
    await logActivity("firs_mark_under_review", "tax_profile", taxId, { msmeId });
  }

  redirect("/dashboard/firs?saved=1");
}

export default async function FirsPage({ searchParams }: { searchParams: Promise<{ state?: string; sector?: string; status?: string; vat?: string; arrears?: string; saved?: string }> }) {
  const params = await searchParams;
  const ctx = await getCurrentUserContext();
  if (!["firs_officer", "admin"].includes(ctx.role)) redirect("/access-denied");

  let query = supabase
    .from("tax_profiles")
    .select("id,msme_id,tax_category,vat_applicable,outstanding_amount,compliance_status,arrears_status,compliance_score,msmes(msme_id,business_name,state,sector)")
    .order("outstanding_amount", { ascending: false });

  if (params.status) query = query.eq("compliance_status", params.status);
  if (params.vat) query = query.eq("vat_applicable", params.vat === "true");
  if (params.arrears) query = query.eq("arrears_status", params.arrears);

  const { data: rows } = await query;
  const filtered = (rows ?? []).filter((row) => (!params.state || (row.msmes as any)?.state === params.state) && (!params.sector || (row.msmes as any)?.sector === params.sector));

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border bg-gradient-to-r from-emerald-900 to-emerald-700 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-semibold">FIRS Compliance & Tax Operations</h1>
        <p className="mt-2 text-sm text-emerald-100">Monitor VAT obligations, arrears, compliance posture, and enforcement notices.</p>
      </header>
      {params.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Tax workflow action completed.</p>}
      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
        <input name="state" defaultValue={params.state} placeholder="state" className="rounded border px-2 py-2 text-sm" />
        <input name="sector" defaultValue={params.sector} placeholder="sector" className="rounded border px-2 py-2 text-sm" />
        <input name="status" defaultValue={params.status} placeholder="compliance status" className="rounded border px-2 py-2 text-sm" />
        <input name="vat" defaultValue={params.vat} placeholder="VAT true/false" className="rounded border px-2 py-2 text-sm" />
        <input name="arrears" defaultValue={params.arrears} placeholder="arrears status" className="rounded border px-2 py-2 text-sm" />
        <button className="rounded bg-emerald-800 px-3 py-2 text-sm text-white">Apply filters</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700"><tr><th className="px-3 py-2">MSME</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">VAT</th><th className="px-3 py-2">Arrears</th><th className="px-3 py-2">Compliance</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No tax records match your filter set.</td></tr>}
            {filtered.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-3">{(row.msmes as any)?.business_name}<p className="text-xs text-slate-500">{(row.msmes as any)?.msme_id} • {(row.msmes as any)?.state}</p></td>
                <td className="px-3 py-3">{row.tax_category}</td>
                <td className="px-3 py-3">{row.vat_applicable ? "Applicable" : "No"}</td>
                <td className="px-3 py-3">{row.arrears_status}</td>
                <td className="px-3 py-3">{row.compliance_status}<p className="text-xs text-slate-500">Score {row.compliance_score}</p></td>
                <td className="space-y-2 px-3 py-3">
                  <form action={firsQuickAction} className="flex gap-2">
                    <input type="hidden" name="tax_id" value={row.id} /><input type="hidden" name="msme_id" value={row.msme_id} /><input type="hidden" name="action" value="reminder" />
                    <button className="rounded border px-2 py-1 text-xs">Mark reminder sent</button>
                  </form>
                  <form action={firsQuickAction} className="flex gap-2">
                    <input type="hidden" name="tax_id" value={row.id} /><input type="hidden" name="msme_id" value={row.msme_id} /><input type="hidden" name="action" value="under_review" />
                    <button className="rounded border px-2 py-1 text-xs">Mark under review</button>
                  </form>
                  <Link href={`/dashboard/firs/${(row.msmes as any)?.msme_id}`} className="text-xs text-emerald-700 hover:underline">Open tax detail →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
