import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { calculateLineTotal, generateInvoiceNumber, recalculateInvoiceTotals } from "@/lib/data/invoicing";
import { filterPayloadByColumns, getTableColumns, logActivityEvent, logInvoiceEvent, normalizeInvoiceStatus } from "@/lib/data/commercial-ops";

async function createInvoiceAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const quoteId = String(formData.get("quote_id") ?? "").trim() || null;
  const quantity = Number(formData.get("quantity") ?? 1);
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const lineTotal = calculateLineTotal(quantity, unitPrice);
  const vatRate = Number(formData.get("vat_rate") ?? 7.5);
  const vatApplies = String(formData.get("vat_applicable") ?? "on") === "on";
  const vatAmount = vatApplies ? Number((lineTotal * (vatRate / 100)).toFixed(2)) : 0;
  const totalAmount = Number((lineTotal + vatAmount).toFixed(2));

  if (quoteId) {
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      redirect("/dashboard/msme/invoices/new?error=invalid_invoice_total");
    }
    const { data: sourceQuote, error: sourceQuoteError } = await supabase
      .from("provider_quotes")
      .select("id,status")
      .eq("id", quoteId)
      .eq("provider_profile_id", workspace.provider.id)
      .maybeSingle();

    if (sourceQuoteError) throw new Error(sourceQuoteError.message);
    if (!sourceQuote || String(sourceQuote.status ?? "").toLowerCase() !== "accepted") {
      redirect("/dashboard/msme/invoices/new?error=quote_not_accepted");
    }
  }

  const invoicePayload = {
    provider_profile_id: workspace.provider.id,
    msme_id: workspace.msme.id,
    invoice_number: generateInvoiceNumber(),
    customer_name: String(formData.get("customer_name") ?? "").trim(),
    customer_email: String(formData.get("customer_email") ?? "").trim() || null,
    customer_phone: String(formData.get("customer_phone") ?? "").trim() || null,
    due_date: String(formData.get("due_date") ?? "") || null,
    currency: "NGN",
    vat_rate: vatRate,
    status: normalizeInvoiceStatus("draft"),
    subtotal: lineTotal,
    vat_amount: vatAmount,
    total_amount: totalAmount,
  };

  const { data: invoice, error: invoiceError } = await supabase
  .from("invoices")
  .insert(invoicePayload)
  .select()
  .single();

  if (invoiceError) throw new Error(invoiceError.message);
  const invoiceId = invoice?.id;
  console.info("[invoice-create]", { operation: "invoice_create", invoiceId, providerId: workspace.provider.id });
  if (!invoiceId) {
    throw new Error("Invoice insert succeeded but invoiceId missing before inserting invoice_items");
  }

  const itemPayload = {
    invoice_id: invoiceId,
    item_name: String(formData.get("item_name") ?? "").trim() || "Service item",
    description: String(formData.get("description") ?? "").trim() || null,
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
    vat_applicable: vatApplies,
  };

  const { error: itemError } = await supabase.from("invoice_items").insert(itemPayload);

  if (itemError) throw new Error(itemError.message);

  await recalculateInvoiceTotals(invoiceId);

  await logInvoiceEvent(supabase, {
    invoiceId,
    eventType: "invoice_created",
    actorRole: workspace.role,
    actorId: workspace.msme.id,
    metadata: { quote_id: quoteId, source: quoteId ? "quote_conversion" : "manual" },
  });

  if (quoteId) {
    const linkColumns = await getTableColumns(supabase, "quote_invoice_links");
    if (linkColumns.has("quote_id") && linkColumns.has("invoice_id")) {
      await supabase.from("quote_invoice_links").insert({ quote_id: quoteId, invoice_id: invoiceId });
    }
    const quoteColumns = await getTableColumns(supabase, "provider_quotes");
    await supabase.from("provider_quotes").update(filterPayloadByColumns({ status: "converted", updated_at: new Date().toISOString() }, quoteColumns)).eq("id", quoteId).eq("provider_profile_id", workspace.provider.id);
    const historyColumns = await getTableColumns(supabase, "quote_status_history");
    if (historyColumns.has("quote_id") && historyColumns.has("to_status")) {
      await supabase.from("quote_status_history").insert(
        filterPayloadByColumns(
          {
            quote_id: quoteId,
            from_status: "accepted",
            to_status: "converted",
            changed_by: workspace.appUserId,
            changed_by_role: workspace.role,
            note: "Accepted quote converted from invoice workspace.",
            created_at: new Date().toISOString(),
          },
          historyColumns
        )
      );
    }
    console.info("[invoice-conversion]", { operation: "quote_convert_invoice", quoteId, invoiceId, providerId: workspace.provider.id, status: "converted" });
  }

  await logActivityEvent(supabase, {
    action: "invoice_created",
    entityType: "invoice",
    entityId: invoiceId,
    actorUserId: workspace.appUserId,
    metadata: { amount: lineTotal, from_quote: Boolean(quoteId) },
  });

  revalidatePath("/dashboard/msme/invoices");
  redirect(`/dashboard/msme/invoices/${invoiceId}`);
}

export default async function NewMsmeInvoicePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const { data: quotes, error } = await supabase
    .from("provider_quotes")
    .select("id,requester_name,request_summary,status")
    .eq("provider_profile_id", workspace.provider.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
  console.error("[invoice-new][quotes:error]", { operation: "invoice_quote_lookup", code: error.code ?? null, message: error.message });
}


  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <h2 className="text-xl font-semibold">Create invoice</h2>
        <p className="text-sm text-slate-600">Manual billing or quote-to-invoice conversion with VAT-ready totals.</p>
      </header>
      {params.error === "quote_not_accepted" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Only accepted quotes can be converted into invoices.</p>
      )}
      {params.error === "invalid_invoice_total" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Quote conversion requires a positive invoice total.</p>
      )}
      <form action={createInvoiceAction} className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-2">
        <label className="text-sm">Source quote
          <select name="quote_id" className="mt-1 w-full rounded border px-2 py-2 text-sm">
            <option value="">Manual invoice</option>
            {(quotes ?? []).map((quote) => (
              <option key={quote.id} value={quote.id}>{quote.requester_name} · {quote.request_summary} ({quote.status})</option>
            ))}
          </select>
        </label>
        <label className="text-sm">Due date<input required name="due_date" type="date" className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>
        <label className="text-sm">Customer name<input required name="customer_name" className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>
        <label className="text-sm">Customer email<input name="customer_email" type="email" className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>
        <label className="text-sm">Customer phone<input name="customer_phone" className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>
        <label className="text-sm">VAT rate (%)<input name="vat_rate" defaultValue={7.5} type="number" min={0} step={0.1} className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>

        <div className="md:col-span-2"><h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">Initial line item</h3></div>
        <label className="text-sm">Item name<input required name="item_name" className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>
        <label className="text-sm">Description<input name="description" className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>
        <label className="text-sm">Quantity<input name="quantity" type="number" min={0.01} step={0.01} defaultValue={1} className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>
        <label className="text-sm">Unit price (₦)<input name="unit_price" type="number" min={0} step={0.01} defaultValue={0} className="mt-1 w-full rounded border px-2 py-2 text-sm" /></label>
        <label className="inline-flex items-center gap-2 text-sm md:col-span-2"><input name="vat_applicable" type="checkbox" defaultChecked /> VAT applies to this line item</label>

        <div className="md:col-span-2">
          <button className="rounded-lg bg-indigo-900 px-4 py-2 text-sm font-medium text-white">Create invoice</button>
        </div>
      </form>
    </section>
  );
}
