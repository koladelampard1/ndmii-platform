import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";

async function simulatePayment(formData: FormData) {
  "use server";
  const supabase = await createServerSupabaseClient();
  const { profile } = await getCurrentUserContext();
  const msmeId = String(formData.get("msme_id"));
  const amount = Number(formData.get("amount") ?? 0);
  const receiptRef = `RCP-${Date.now()}`;

  await supabase.from("payments").insert({
    msme_id: msmeId,
    amount,
    tax_type: "VAT_SIM",
    status: "simulated_paid",
    receipt_reference: receiptRef,
  });

  await supabase.from("tax_profiles").update({ outstanding_amount: 0, compliance_status: "compliant" }).eq("msme_id", msmeId);
  await supabase.from("activity_logs").insert({ actor_user_id: profile?.id, action: "payment_simulated", entity_type: "payment", metadata: { msmeId, amount, receiptRef } });

  redirect(`/dashboard/payments?receipt=${receiptRef}`);
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ receipt?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [{ data: profiles }, { data: history }, { data: msmes }] = await Promise.all([
    supabase.from("tax_profiles").select("msme_id,tax_category,vat_applicable,estimated_monthly_obligation,outstanding_amount,compliance_status").order("created_at", { ascending: false }),
    supabase.from("payments").select("id,msme_id,amount,status,tax_type,payment_date,receipt_reference").order("created_at", { ascending: false }),
    supabase.from("msmes").select("id,msme_id,business_name"),
  ]);

  const msmeMap = new Map((msmes ?? []).map((row) => [row.id, row]));

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Tax / VAT Simulation</h1>
      {params.receipt && <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Payment successful. Receipt reference: {params.receipt}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {(profiles ?? []).map((profile) => {
          const msme = msmeMap.get(profile.msme_id);
          return (
            <article key={profile.msme_id} className="rounded-xl border bg-white p-4">
              <h2 className="text-lg font-semibold">{msme?.business_name ?? "Unlinked MSME"}</h2>
              <p className="text-xs text-slate-500">{msme?.msme_id ?? profile.msme_id}</p>
              <div className="mt-3 space-y-1 text-sm">
                <p>Tax Category: {profile.tax_category}</p>
                <p>VAT Applicable: {profile.vat_applicable ? "Yes" : "No"}</p>
                <p>Estimated Monthly Obligation: ₦{Number(profile.estimated_monthly_obligation).toLocaleString()}</p>
                <p>Outstanding Amount: ₦{Number(profile.outstanding_amount).toLocaleString()}</p>
                <p>Compliance Status: {profile.compliance_status}</p>
              </div>
              <form action={simulatePayment} className="mt-3 flex gap-2">
                <input type="hidden" name="msme_id" value={profile.msme_id} />
                <input name="amount" className="w-full rounded border px-3 py-2" defaultValue={profile.outstanding_amount} />
                <Button>Pay now</Button>
              </form>
            </article>
          );
        })}
        {(profiles ?? []).length === 0 && <p className="rounded-lg border bg-white p-6 text-slate-500">No tax profiles available.</p>}
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2">MSME</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Receipt</th></tr></thead>
          <tbody>
            {(history ?? []).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{msmeMap.get(row.msme_id)?.business_name ?? row.msme_id}</td>
                <td className="px-3 py-2">₦{Number(row.amount).toLocaleString()}</td>
                <td className="px-3 py-2">{row.tax_type}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.receipt_reference ?? "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
