import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { formatNaira, invoicePaymentStatusClasses, type InvoicePaymentStatus } from "@/lib/data/invoicing";
import { filterPayloadByColumns, getTableColumns, logInvoiceEvent } from "@/lib/data/commercial-ops";

function resolveInvoiceStatusFromPayment(paymentStatus: InvoicePaymentStatus) {
  if (paymentStatus === "success") return "paid";
  if (paymentStatus === "initiated" || paymentStatus === "pending") return "pending_payment";
  return "issued";
}

async function simulatePaymentAction(formData: FormData) {
  "use server";
  const supabase = await createServiceRoleSupabaseClient();
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const result = String(formData.get("result") ?? "success") as InvoicePaymentStatus;
  const method = String(formData.get("method") ?? "card");

  console.info("[invoice-payment-sim:start]", { invoiceId, result, method });

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id,invoice_number,total_amount,status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    console.error("[invoice-payment-sim:error:invoice-load]", invoiceError);
    redirect(`/invoice/${invoiceId}/status`);
  }

  const paymentReference = `SIM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const paymentStatus: InvoicePaymentStatus = result;
  const paidAt = paymentStatus === "success" ? new Date().toISOString() : null;

  const paymentColumns = await getTableColumns(supabase, "invoice_payments");
  if (paymentColumns.has("invoice_id")) {
    const { error: paymentError } = await supabase.from("invoice_payments").insert(filterPayloadByColumns({
      invoice_id: invoiceId,
      payment_reference: paymentReference,
      payment_method: method,
      payment_status: paymentStatus,
      amount: invoice.total_amount,
      paid_at: paidAt,
    }, paymentColumns));

    if (paymentError) console.error("[invoice-payment-sim:error:payment-insert]", paymentError);
  }

  const nextInvoiceStatus = resolveInvoiceStatusFromPayment(paymentStatus);
  const invoiceColumns = await getTableColumns(supabase, "invoices");
  const { error: updateError } = await supabase
    .from("invoices")
    .update(filterPayloadByColumns({
      status: nextInvoiceStatus,
      paid_at: paidAt,
      updated_at: new Date().toISOString(),
    }, invoiceColumns))
    .eq("id", invoiceId);

  if (updateError) console.error("[invoice-payment-sim:error:invoice-update]", updateError);

  await logInvoiceEvent(supabase, {
    invoiceId,
    eventType: paymentStatus === "success" ? "payment_success" : paymentStatus === "failed" ? "payment_failed" : `payment_${paymentStatus}`,
    actorRole: "public",
    actorId: null,
    metadata: {
      payment_reference: paymentReference,
      payment_status: paymentStatus,
      method,
      invoice_number: invoice.invoice_number,
    },
  });

  console.info("[invoice-payment-sim:complete]", {
    invoiceId,
    invoiceNumber: invoice.invoice_number,
    paymentReference,
    paymentStatus,
    invoiceStatus: nextInvoiceStatus,
  });

  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath(`/invoice/${invoiceId}/status`);
  revalidatePath("/dashboard/msme/invoices");
  revalidatePath("/dashboard/msme/revenue");
  revalidatePath("/dashboard/nrs/invoices");
  revalidatePath("/dashboard/nrs/invoice-registry");
  revalidatePath("/dashboard/nrs/vat-monitor");
  revalidatePath("/dashboard/nrs/revenue");
  revalidatePath("/dashboard/executive/revenue");

  redirect(`/invoice/${invoiceId}/status`);
}

export default async function PublicInvoicePayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createServiceRoleSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,customer_name,total_amount,status,provider_profiles(display_name)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return <section className="rounded-xl border bg-white p-8 text-center">Invoice not found.</section>;

  return (
    <section className="mx-auto max-w-3xl space-y-4 py-6">
      <header className="rounded-xl border bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Secure invoice checkout</p>
        <h1 className="text-2xl font-semibold">Payment simulation</h1>
        <p className="text-sm text-slate-600">
          Invoice {invoice.invoice_number} · {invoice.customer_name} · {(invoice.provider_profiles as any)?.display_name ?? "Provider"}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <form action={simulatePaymentAction} className="space-y-4 rounded-xl border bg-white p-5">
          <input type="hidden" name="invoice_id" value={invoice.id} />
          <label className="block text-sm">
            Payment method
            <select name="method" className="mt-1 w-full rounded border px-2 py-2 text-sm">
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="ussd">USSD</option>
              <option value="wallet">Wallet</option>
            </select>
          </label>
          <label className="block text-sm">
            Simulated outcome
            <select name="result" className="mt-1 w-full rounded border px-2 py-2 text-sm" defaultValue="success">
              <option value="initiated">Initiated</option>
              <option value="pending">Pending</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>
          <button className="w-full rounded-lg bg-indigo-900 px-4 py-2 text-sm text-white">Run payment simulation</button>
        </form>

        <aside className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Payment summary</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex justify-between"><span className="text-slate-500">Invoice</span><span>{invoice.invoice_number}</span></p>
            <p className="flex justify-between"><span className="text-slate-500">Current status</span><span className={`rounded-full px-2 py-0.5 text-xs uppercase ${invoicePaymentStatusClasses(invoice.status === "paid" ? "success" : "pending")}`}>{invoice.status.replace("_", " ")}</span></p>
            <p className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total due</span><span>{formatNaira(invoice.total_amount)}</span></p>
          </div>
          <Link href={`/invoice/${invoice.id}`} className="mt-4 inline-block text-sm text-indigo-700 hover:underline">Back to invoice</Link>
        </aside>
      </div>
    </section>
  );
}
