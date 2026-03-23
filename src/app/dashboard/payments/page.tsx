import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

async function simulatePayment(formData: FormData) {
  "use server";
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();
  const msmeId = String(formData.get("msme_id"));
  const amount = Number(formData.get("amount") ?? 0);
  const receiptRef = `RCP-${Date.now()}`;

  if (!["admin", "firs_officer", "msme"].includes(ctx.role)) redirect("/access-denied");
  if (ctx.role === "msme" && msmeId !== ctx.linkedMsmeId) redirect("/access-denied");

  await supabase.from("payments").insert({ msme_id: msmeId, amount, tax_type: "VAT_SIM", status: "simulated_paid", receipt_reference: receiptRef });
  await supabase.from("tax_profiles").update({ outstanding_amount: 0, compliance_status: "compliant", arrears_status: "none" }).eq("msme_id", msmeId);
  await supabase.from("activity_logs").insert({ actor_user_id: ctx.appUserId, action: "payment_simulated", entity_type: "payment", metadata: { msmeId, amount, receiptRef } });

  redirect(`/dashboard/payments?receipt=${receiptRef}`);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string; q?: string; status?: string; compliance?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const ctx = await getCurrentUserContext();

  if (!["admin", "firs_officer", "msme"].includes(ctx.role)) redirect("/access-denied");

  let profilesQuery = supabase
    .from("tax_profiles")
    .select("msme_id,tax_category,vat_applicable,estimated_monthly_obligation,outstanding_amount,compliance_status,arrears_status,last_reviewed_at")
    .order("outstanding_amount", { ascending: false });
  let historyQuery = supabase.from("payments").select("id,msme_id,amount,status,tax_type,payment_date,receipt_reference").order("created_at", { ascending: false });

  if (ctx.role === "msme") {
    profilesQuery = profilesQuery.eq("msme_id", ctx.linkedMsmeId ?? "");
    historyQuery = historyQuery.eq("msme_id", ctx.linkedMsmeId ?? "");
  }

  const [{ data: profiles }, { data: history }, { data: msmes }] = await Promise.all([
    profilesQuery,
    historyQuery,
    supabase.from("msmes").select("id,msme_id,business_name,state,sector"),
  ]);

  const msmeMap = new Map((msmes ?? []).map((row) => [row.id, row]));
  let rows = profiles ?? [];

  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter((profile) => {
      const m = msmeMap.get(profile.msme_id);
      return m?.business_name.toLowerCase().includes(q) || m?.msme_id.toLowerCase().includes(q);
    });
  }
  if (params.status) rows = rows.filter((profile) => profile.arrears_status === params.status);
  if (params.compliance) rows = rows.filter((profile) => profile.compliance_status === params.compliance);

  const totalOutstanding = rows.reduce((sum, row) => sum + Number(row.outstanding_amount ?? 0), 0);
  const compliantCount = rows.filter((row) => row.compliance_status === "compliant").length;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">{ctx.role === "msme" ? "My Tax / VAT Simulation" : "Tax / VAT Operations"}</h1>
      {params.receipt && <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Payment successful. Receipt reference: {params.receipt}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Active obligations</p><p className="text-2xl font-semibold">{rows.length}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Outstanding arrears</p><p className="text-2xl font-semibold">₦{totalOutstanding.toLocaleString()}</p></article>
        <article className="rounded-lg border bg-white p-4"><p className="text-xs uppercase text-slate-500">Compliant profiles</p><p className="text-2xl font-semibold">{compliantCount}</p></article>
      </div>

      <form className="grid gap-2 rounded-lg border bg-white p-3 md:grid-cols-4">
        <input name="q" placeholder="Search MSME" className="rounded border px-3 py-2" defaultValue={params.q} />
        <input name="status" placeholder="Arrears status" className="rounded border px-3 py-2" defaultValue={params.status} />
        <input name="compliance" placeholder="Compliance status" className="rounded border px-3 py-2" defaultValue={params.compliance} />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply filters</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((profile: any) => {
          const msme = msmeMap.get(profile.msme_id);
          return (
            <article key={profile.msme_id} className="rounded-xl border bg-white p-4">
              <h2 className="text-lg font-semibold">{msme?.business_name ?? "Unlinked MSME"}</h2>
              <p className="text-xs text-slate-500">{msme?.msme_id ?? profile.msme_id} • {msme?.state ?? "N/A"} • {msme?.sector ?? "N/A"}</p>
              <div className="mt-3 grid gap-1 text-sm">
                <p>Tax Category: {profile.tax_category}</p>
                <p>VAT Applicable: {profile.vat_applicable ? "Yes" : "No"}</p>
                <p>Estimated Obligation: ₦{Number(profile.estimated_monthly_obligation).toLocaleString()}</p>
                <p>Outstanding: ₦{Number(profile.outstanding_amount).toLocaleString()}</p>
                <p>Arrears: {profile.arrears_status}</p>
                <p>Compliance: {profile.compliance_status}</p>
              </div>
              <form action={simulatePayment} className="mt-3 flex gap-2">
                <input type="hidden" name="msme_id" value={profile.msme_id} />
                <input name="amount" className="w-full rounded border px-3 py-2" defaultValue={profile.outstanding_amount} />
                <Button>Pay now</Button>
              </form>
            </article>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">MSME</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Receipt</th></tr></thead>
          <tbody>
            {(history ?? []).map((row: any) => (
              <tr key={row.id} className="border-t"><td className="px-3 py-2">{msmeMap.get(row.msme_id)?.business_name ?? row.msme_id}</td><td className="px-3 py-2">₦{Number(row.amount).toLocaleString()}</td><td className="px-3 py-2">{row.tax_type}</td><td className="px-3 py-2">{row.status}</td><td className="px-3 py-2">{row.receipt_reference ?? "n/a"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
