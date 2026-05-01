import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { calculateLineTotal, generateInvoiceNumber, recalculateInvoiceTotals } from "@/lib/data/invoicing";
import { filterPayloadByColumns, getTableColumns, logActivityEvent, logInvoiceEvent, normalizeInvoiceStatus } from "@/lib/data/commercial-ops";

async function createInvoiceAction(formData: FormData) {
  "use server";

  console.info("[invoice-create][step:context:start]");
  const workspace = await getProviderWorkspaceContext();
  console.info("[invoice-create][step:context:resolved]", {
    providerProfileId: workspace.provider.id,
    providerMsmeId: workspace.provider.msme_id ?? null,
    msmeUuid: workspace.msme.id,
    msmePublicId: workspace.msme.msme_id,
    role: workspace.role,
  });

  const supabase = await createServiceRoleSupabaseClient();
  const quoteId = String(formData.get("quote_id") ?? "").trim() || null;

  const invoiceColumns = await getTableColumns(supabase, "invoices");
  const invoicePayload = filterPayloadByColumns({
    provider_profile_id: workspace.provider.id,
    msme_id: workspace.msme.msme_id,
    invoice_number: generateInvoiceNumber(),
    customer_name: String(formData.get("customer_name") ?? "").trim(),
    customer_email: String(formData.get("customer_email") ?? "").trim() || null,
    customer_phone: String(formData.get("customer_phone") ?? "").trim() || null,
    currency: "NGN",
    vat_rate: Number(formData.get("vat_rate") ?? 7.5),
    status: normalizeInvoiceStatus("draft"),
    due_date: String(formData.get("due_date") ?? "") || null,
    updated_at: new Date().toISOString(),
    quote_id: quoteId,
  }, invoiceColumns);

  console.info("[invoice-create][step:invoice:insert:start]", { invoicePayload, quoteId });
  const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert(invoicePayload).select("id").single();
  if (invoiceError) {
    console.error("[invoice-create][step:invoice:insert:error]", {
      message: invoiceError.message,
      code: invoiceError.code ?? null,
      details: invoiceError.details ?? null,
      hint: invoiceError.hint ?? null,
      invoicePayload,
    });
    throw new Error(invoiceError.message);
  }
  console.info("[invoice-create][step:invoice:insert:ok]", { invoiceId: invoice.id });

  const quantity = Number(formData.get("quantity") ?? 1);
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const lineTotal = calculateLineTotal(quantity, unitPrice);

  const itemColumns = await getTableColumns(supabase, "invoice_items");
  const itemPayload = filterPayloadByColumns({
    invoice_id: invoice.id,
    item_name: String(formData.get("item_name") ?? "").trim() || "Service item",
    description: String(formData.get("description") ?? "").trim() || null,
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
    vat_applicable: String(formData.get("vat_applicable") ?? "on") === "on",
  }, itemColumns);
  console.info("[invoice-create][step:invoice_items:insert:start]", { itemPayload });
  const { error: itemError } = await supabase.from("invoice_items").insert(itemPayload);

  if (itemError) {
    console.error("[invoice-create][step:invoice_items:insert:error]", {
      message: itemError.message,
      code: itemError.code ?? null,
      details: itemError.details ?? null,
      hint: itemError.hint ?? null,
      itemPayload,
    });
    throw new Error(itemError.message);
  }
  console.info("[invoice-create][step:invoice_items:insert:ok]", { invoiceId: invoice.id });

  console.info("[invoice-create][step:totals:recalculate:start]", { invoiceId: invoice.id });
  try {
    await recalculateInvoiceTotals(invoice.id);
    console.info("[invoice-create][step:totals:recalculate:ok]", { invoiceId: invoice.id });
  } catch (error) {
    console.error("[invoice-create][step:totals:recalculate:error]", {
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await logInvoiceEvent(supabase, {
    invoiceId: invoice.id,
    eventType: "invoice_created",
    actorRole: workspace.role,
    actorId: workspace.msme.id,
    metadata: { quote_id: quoteId, source: quoteId ? "quote_conversion" : "manual" },
  });

  if (quoteId) {
    const linkColumns = await getTableColumns(supabase, "quote_invoice_links");
    if (linkColumns.has("quote_id") && linkColumns.has("invoice_id")) {
      console.info("[invoice-create][step:quote_invoice_links:insert:start]", { quoteId, invoiceId: invoice.id });
      const { error: quoteInvoiceLinkError } = await supabase.from("quote_invoice_links").insert({ quote_id: quoteId, invoice_id: invoice.id });
      if (quoteInvoiceLinkError) {
        console.error("[invoice-create][step:quote_invoice_links:insert:error]", {
          message: quoteInvoiceLinkError.message,
          code: quoteInvoiceLinkError.code ?? null,
          details: quoteInvoiceLinkError.details ?? null,
          hint: quoteInvoiceLinkError.hint ?? null,
          quoteId,
          invoiceId: invoice.id,
        });
        throw new Error(quoteInvoiceLinkError.message);
      }
      console.info("[invoice-create][step:quote_invoice_links:insert:ok]", { quoteId, invoiceId: invoice.id });
    }
    const quoteColumns = await getTableColumns(supabase, "provider_quotes");
    await supabase.from("provider_quotes").update(filterPayloadByColumns({ status: "converted", updated_at: new Date().toISOString() }, quoteColumns)).eq("id", quoteId).eq("provider_profile_id", workspace.provider.id);
    console.info("[invoice-conversion]", { quoteId, invoiceId: invoice.id, providerId: workspace.provider.id });
  }

  await logActivityEvent(supabase, {
    action: "invoice_created",
    entityType: "invoice",
    entityId: invoice.id,
    actorUserId: workspace.appUserId,
    metadata: { amount: lineTotal, from_quote: Boolean(quoteId) },
  });

  console.info("[invoice-create]", { invoiceId: invoice.id, providerId: workspace.provider.id, amount: lineTotal });

  revalidatePath("/dashboard/msme/invoices");
  const redirectTarget = `/dashboard/msme/invoices/${invoice.id}`;
  console.info("[invoice-create][step:redirect]", { redirectTarget, existsByConvention: true });
  redirect(redirectTarget);
}

export default async function NewMsmeInvoicePage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const { data: quotes, error } = await supabase
    .from("provider_quotes")
    .select("id,requester_name,request_summary,status")
    .eq("provider_profile_id", workspace.provider.id)
    .in("status", ["new", "in_review", "accepted", "quoted"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <h2 className="text-xl font-semibold">Create invoice</h2>
        <p className="text-sm text-slate-600">Manual billing or quote-to-invoice conversion with VAT-ready totals.</p>
      </header>
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
