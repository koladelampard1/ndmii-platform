import { redirect } from "next/navigation";
import { logActivity } from "@/lib/data/operations";
import { supabase } from "@/lib/supabase/client";

async function updateTaxAction(formData: FormData) {
  "use server";
  const taxId = String(formData.get("tax_id"));
  const msmeId = String(formData.get("msme_id"));
  const kind = String(formData.get("kind"));

  if (kind === "update_category") {
    const taxCategory = String(formData.get("tax_category"));
    await supabase.from("tax_profiles").update({ tax_category: taxCategory }).eq("id", taxId);
    await logActivity("firs_update_tax_category", "tax_profile", taxId, { taxCategory, msmeId });
  }

  if (kind === "adjust_outstanding") {
    const outstandingAmount = Number(formData.get("outstanding_amount") ?? 0);
    await supabase.from("tax_profiles").update({ outstanding_amount: outstandingAmount }).eq("id", taxId);
    await logActivity("firs_adjust_outstanding", "tax_profile", taxId, { outstandingAmount, msmeId });
  }

  if (kind === "compliance_notice") {
    const status = String(formData.get("status") ?? "under review");
    await supabase.from("tax_profiles").update({ compliance_status: status, last_reviewed_at: new Date().toISOString() }).eq("id", taxId);
    await logActivity("firs_simulate_compliance_notice", "tax_profile", taxId, { status, msmeId });
  }

  redirect(`/dashboard/firs/${msmeId}?saved=1`);
}

export default async function FirsTaxDetailPage({ params, searchParams }: { params: Promise<{ msmeId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { msmeId } = await params;
  const query = await searchParams;

  const { data: msme } = await supabase.from("msmes").select("id,msme_id,business_name,state,sector").eq("msme_id", msmeId).maybeSingle();
  if (!msme) return <div className="rounded border bg-white p-6">MSME tax record not found.</div>;

  const [{ data: tax }, { data: payments }, { data: logs }] = await Promise.all([
    supabase.from("tax_profiles").select("id,tax_category,vat_applicable,estimated_monthly_obligation,outstanding_amount,compliance_score,compliance_status,arrears_status").eq("msme_id", msme.id).maybeSingle(),
    supabase.from("payments").select("amount,tax_type,status,payment_date,receipt_reference").eq("msme_id", msme.id).order("payment_date", { ascending: false }),
    supabase.from("activity_logs").select("action,created_at,metadata").eq("entity_type", "tax_profile").order("created_at", { ascending: false }).limit(8),
  ]);

  if (!tax) return <div className="rounded border bg-white p-6">No tax profile has been generated for this MSME.</div>;

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">FIRS MSME Tax Detail</h1>
      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">Tax action saved and logged.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 md:col-span-2">
          <h2 className="font-semibold">{msme.business_name}</h2>
          <p className="text-xs text-slate-500">{msme.msme_id} • {msme.state} • {msme.sector}</p>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <p><strong>Tax category:</strong> {tax.tax_category}</p>
            <p><strong>VAT status:</strong> {tax.vat_applicable ? "Applicable" : "Not applicable"}</p>
            <p><strong>Estimated obligation:</strong> ₦{Number(tax.estimated_monthly_obligation).toLocaleString()}</p>
            <p><strong>Outstanding balance:</strong> ₦{Number(tax.outstanding_amount).toLocaleString()}</p>
            <p><strong>Compliance status:</strong> {tax.compliance_status}</p>
            <p><strong>Compliance score:</strong> {tax.compliance_score}</p>
          </div>
        </article>
        <article className="rounded-xl border bg-white p-4 text-sm">
          <h2 className="font-semibold">Compliance Tags</h2>
          <p className="mt-2">Current: {tax.compliance_status}</p>
          <p>Available tags: compliant, partially compliant, overdue, under review</p>
        </article>
      </div>

      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
        <form action={updateTaxAction} className="space-y-2 rounded border p-3">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="update_category" />
          <p className="text-xs font-medium">Update tax category</p>
          <input name="tax_category" defaultValue={tax.tax_category} className="w-full rounded border px-2 py-1 text-xs" />
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Save category</button>
        </form>
        <form action={updateTaxAction} className="space-y-2 rounded border p-3">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="adjust_outstanding" />
          <p className="text-xs font-medium">Adjust outstanding amount</p>
          <input name="outstanding_amount" type="number" step="0.01" defaultValue={tax.outstanding_amount} className="w-full rounded border px-2 py-1 text-xs" />
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Apply adjustment</button>
        </form>
        <form action={updateTaxAction} className="space-y-2 rounded border p-3">
          <input type="hidden" name="tax_id" value={tax.id} /><input type="hidden" name="msme_id" value={msme.msme_id} /><input type="hidden" name="kind" value="compliance_notice" />
          <p className="text-xs font-medium">Simulate compliance notice</p>
          <select name="status" className="w-full rounded border px-2 py-1 text-xs"><option>compliant</option><option>partially compliant</option><option>overdue</option><option>under review</option></select>
          <button className="w-full rounded bg-emerald-800 px-2 py-1 text-xs text-white">Issue notice</button>
        </form>
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Payment history & receipts</h2>
        <div className="mt-2 space-y-2 text-sm">
          {(payments ?? []).length === 0 && <p className="text-slate-500">No payment receipts recorded.</p>}
          {(payments ?? []).map((payment, idx) => (
            <div key={idx} className="rounded border p-2">{payment.payment_date}: ₦{Number(payment.amount).toLocaleString()} • {payment.tax_type} • {payment.status} • Receipt {payment.receipt_reference ?? "N/A"}</div>
          ))}
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Audit trail</h2>
        <div className="mt-2 space-y-2 text-sm">{(logs ?? []).map((log, idx) => <div key={idx} className="rounded border p-2">{log.action} • {new Date(log.created_at).toLocaleString()}</div>)}</div>
      </article>
    </section>
  );
}
