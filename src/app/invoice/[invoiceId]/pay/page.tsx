import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { assertInvoiceTransition, formatNaira, invoicePaymentStatusClasses } from "@/lib/data/invoicing";
import { filterPayloadByColumns, getTableColumns, logInvoiceEvent } from "@/lib/data/commercial-ops";
import { loadInvoiceByPublicToken } from "@/lib/data/public-invoices";

async function createPaymentAttemptAction(formData: FormData) {
  "use server";
  const supabase = await createServiceRoleSupabaseClient();
  const publicToken = String(formData.get("public_token") ?? "");
  const method = String(formData.get("method") ?? "bank_transfer");

  const invoice = await loadInvoiceByPublicToken(supabase, publicToken);
  if (!invoice) redirect(`/invoice/${publicToken}/status`);

  if (["draft", "paid", "refunded", "cancelled"].includes(String(invoice.status ?? "draft"))) {
    redirect(`/invoice/${publicToken}/status`);
  }

  const paymentReference = `ATTEMPT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const nowIso = new Date().toISOString();

  const attemptColumns = await getTableColumns(supabase, "invoice_payment_attempts");
  let paymentAttemptId: string | null = null;
  if (attemptColumns.has("invoice_id")) {
    const { data: attempt, error: attemptError } = await supabase.from("invoice_payment_attempts").insert(filterPayloadByColumns({
      invoice_id: invoice.id,
      provider_profile_id: invoice.provider_profile_id,
      public_token: publicToken,
      payment_reference: paymentReference,
      payment_method: method,
      status: "payment_attempt_created",
      amount: invoice.total_amount,
      source: "public_payment_recording",
      metadata: {},
      created_at: nowIso,
      updated_at: nowIso,
    }, attemptColumns)).select("id").maybeSingle();

    if (attemptError) {
      console.error("[invoice-payment-attempt:error]", { operation: "payment_attempt_created", invoiceId: invoice.id, providerId: invoice.provider_profile_id, code: attemptError.code ?? null, message: attemptError.message });
    }
    paymentAttemptId = attempt?.id ?? null;
  }

  assertInvoiceTransition(invoice.status, "pending_payment");
  const invoiceColumns = await getTableColumns(supabase, "invoices");
  const { error: updateError } = await supabase
    .from("invoices")
    .update(filterPayloadByColumns({
      status: "pending_payment",
      updated_at: nowIso,
    }, invoiceColumns))
    .eq("id", invoice.id);

  if (updateError) console.error("[invoice-payment-attempt:update-error]", { operation: "pending_payment", invoiceId: invoice.id, providerId: invoice.provider_profile_id, code: updateError.code ?? null, message: updateError.message });

  await logInvoiceEvent(supabase, {
    invoiceId: invoice.id,
    eventType: "payment_attempt_created",
    actorRole: "public",
    actorId: null,
    source: "public_payment_recording",
    fromStatus: String(invoice.status ?? "issued"),
    toStatus: "pending_payment",
    metadata: {
      payment_reference: paymentReference,
      method,
      payment_attempt_id: paymentAttemptId,
    },
  });

  console.info("[invoice-payment-attempt:complete]", { operation: "payment_attempt_created", invoiceId: invoice.id, providerId: invoice.provider_profile_id, paymentAttemptId, status: "pending_payment" });

  revalidatePath(`/invoice/${publicToken}`);
  revalidatePath(`/invoice/${publicToken}/status`);
  revalidatePath("/dashboard/msme/invoices");
  revalidatePath("/dashboard/msme/revenue");
  revalidatePath("/dashboard/nrs/invoices");
  revalidatePath("/dashboard/nrs/invoice-registry");
  revalidatePath("/dashboard/nrs/vat-monitor");
  revalidatePath("/dashboard/nrs/revenue");
  revalidatePath("/dashboard");

  redirect(`/invoice/${publicToken}/status`);
}

export default async function PublicInvoicePayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId: publicToken } = await params;
  const supabase = await createServiceRoleSupabaseClient();
  const invoice = await loadInvoiceByPublicToken(supabase, publicToken);
  if (!invoice) return <section className="rounded-xl border bg-white p-8 text-center">Invoice not found.</section>;
  const msme = Array.isArray(invoice.msmes) ? invoice.msmes[0] : invoice.msmes;
  const provider = Array.isArray(invoice.provider_profiles) ? invoice.provider_profiles[0] : invoice.provider_profiles;
  const businessName = (msme as any)?.business_name || (provider as any)?.display_name || "Your Business";

  return (
    <section className="mx-auto max-w-3xl space-y-4 py-6">
      <header className="rounded-xl border bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Secure invoice payment recording</p>
        <h1 className="text-2xl font-semibold">Payment evidence pending</h1>
        <p className="text-sm text-slate-600">
          Invoice {invoice.invoice_number} · {invoice.customer_name} · {businessName}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <form action={createPaymentAttemptAction} className="space-y-4 rounded-xl border bg-white p-5">
          <input type="hidden" name="public_token" value={publicToken} />
          <label className="block text-sm">
            Payment method
            <select name="method" className="mt-1 w-full rounded border px-2 py-2 text-sm">
              <option value="bank_transfer">Bank transfer</option>
              <option value="manual_transfer">Manual transfer</option>
              <option value="cash_deposit">Cash deposit</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This records a pending payment attempt only. The MSME must confirm receipt manually before the invoice can be marked paid.
          </p>
          <button disabled={["draft", "paid", "refunded", "cancelled"].includes(String(invoice.status ?? "draft"))} className="w-full rounded-lg bg-indigo-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300">Record payment attempt</button>
        </form>

        <aside className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Payment summary</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex justify-between"><span className="text-slate-500">Invoice</span><span>{invoice.invoice_number}</span></p>
            <p className="flex justify-between"><span className="text-slate-500">Current status</span><span className={`rounded-full px-2 py-0.5 text-xs uppercase ${invoicePaymentStatusClasses(invoice.status === "paid" ? "success" : "pending")}`}>{invoice.status.replace("_", " ")}</span></p>
            <p className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total due</span><span>{formatNaira(invoice.total_amount)}</span></p>
          </div>
          <Link href={`/invoice/${publicToken}`} className="mt-4 inline-block text-sm text-indigo-700 hover:underline">Back to invoice</Link>
        </aside>
      </div>
    </section>
  );
}
