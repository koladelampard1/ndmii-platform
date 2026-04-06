import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/data/invoicing";

async function simulatePaymentAction(formData: FormData) {
  "use server";
  const supabase = await createServiceRoleSupabaseClient();
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const result = String(formData.get("result") ?? "success");
  const method = String(formData.get("method") ?? "card");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id,total_amount,status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) throw new Error(invoiceError.message);
  if (!invoice) throw new Error("Invoice not found.");

  const paymentReference = `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const paymentStatus = result === "success" ? "success" : result === "pending" ? "pending" : "failed";

  const { error: paymentError } = await supabase.from("invoice_payments").insert({
    invoice_id: invoiceId,
    payment_reference: paymentReference,
    payment_method: method,
    payment_status: paymentStatus,
    amount: invoice.total_amount,
    paid_at: paymentStatus === "success" ? new Date().toISOString() : null,
  });
  if (paymentError) throw new Error(paymentError.message);

  const nextStatus = paymentStatus === "success" ? "paid" : paymentStatus === "pending" ? "pending_payment" : "issued";
  const { error: updateError } = await supabase
    .from("invoices")
    .update({ status: nextStatus, paid_at: paymentStatus === "success" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (updateError) throw new Error(updateError.message);

  await supabase.from("invoice_events").insert({
    invoice_id: invoiceId,
    event_type: "payment_simulated",
    actor_role: "public",
    actor_id: null,
    metadata: { payment_reference: paymentReference, payment_status: paymentStatus, method },
  });

  console.info("[invoice-payment-sim]", { invoiceId, paymentReference, paymentStatus, method });

  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath(`/invoice/${invoiceId}/status`);
  revalidatePath("/dashboard/msme/revenue");
  revalidatePath("/dashboard/nrs/revenue");
  revalidatePath("/dashboard/executive/revenue");

  redirect(`/invoice/${invoiceId}/status`);
}

export default async function PublicInvoicePayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createServiceRoleSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,customer_name,total_amount,status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) return <section className="rounded-xl border bg-white p-8 text-center">Invoice not found.</section>;

  return (
    <section className="mx-auto max-w-2xl space-y-4 py-6">
      <header className="rounded-xl border bg-white p-5">
        <h1 className="text-2xl font-semibold">Payment simulation</h1>
        <p className="text-sm text-slate-600">Invoice {invoice.invoice_number} · {invoice.customer_name}</p>
      </header>
      <form action={simulatePaymentAction} className="space-y-4 rounded-xl border bg-white p-5">
        <input type="hidden" name="invoice_id" value={invoice.id} />
        <p className="text-lg font-semibold">Amount due: {formatNaira(invoice.total_amount)}</p>
        <label className="block text-sm">Payment method
          <select name="method" className="mt-1 w-full rounded border px-2 py-2 text-sm">
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="ussd">USSD</option>
            <option value="wallet">Wallet</option>
          </select>
        </label>
        <label className="block text-sm">Simulated outcome
          <select name="result" className="mt-1 w-full rounded border px-2 py-2 text-sm">
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <button className="w-full rounded-lg bg-indigo-900 px-4 py-2 text-sm text-white">Run payment simulation</button>
      </form>
    </section>
  );
}
