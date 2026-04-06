import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { calculateLineTotal, generateInvoiceNumber, recalculateInvoiceTotals } from "@/lib/data/invoicing";

async function createInvoiceAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const quoteId = String(formData.get("quote_id") ?? "").trim() || null;

  const invoicePayload = {
    provider_profile_id: workspace.provider.id,
    msme_id: workspace.msme.id,
    invoice_number: generateInvoiceNumber(),
    customer_name: String(formData.get("customer_name") ?? "").trim(),
    customer_email: String(formData.get("customer_email") ?? "").trim() || null,
    customer_phone: String(formData.get("customer_phone") ?? "").trim() || null,
    currency: "NGN",
    vat_rate: Number(formData.get("vat_rate") ?? 7.5),
    status: "draft",
    due_date: String(formData.get("due_date") ?? "") || null,
  };

  const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert(invoicePayload).select("id").single();
  if (invoiceError) throw new Error(invoiceError.message);

  const quantity = Number(formData.get("quantity") ?? 1);
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const lineTotal = calculateLineTotal(quantity, unitPrice);

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    item_name: String(formData.get("item_name") ?? "").trim() || "Service item",
    description: String(formData.get("description") ?? "").trim() || null,
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
    vat_applicable: String(formData.get("vat_applicable") ?? "on") === "on",
  });

  if (itemError) throw new Error(itemError.message);

  await recalculateInvoiceTotals(invoice.id);

  await supabase.from("invoice_events").insert({
    invoice_id: invoice.id,
    event_type: "invoice_created",
    actor_role: workspace.role,
    actor_id: workspace.msme.id,
    metadata: { quote_id: quoteId, source: quoteId ? "quote_conversion" : "manual" },
  });

  if (quoteId) {
    const { error: linkError } = await supabase.from("quote_invoice_links").insert({ quote_id: quoteId, invoice_id: invoice.id });
    if (linkError) throw new Error(linkError.message);
    await supabase.from("provider_quotes").update({ status: "converted" }).eq("id", quoteId).eq("provider_profile_id", workspace.provider.id);
    console.info("[invoice-conversion]", { quoteId, invoiceId: invoice.id, providerId: workspace.provider.id });
  }

  console.info("[invoice-create]", { invoiceId: invoice.id, providerId: workspace.provider.id, amount: lineTotal });

  revalidatePath("/dashboard/msme/invoices");
  redirect(`/dashboard/msme/invoices/${invoice.id}`);
}

export default async function NewMsmeInvoicePage() {
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const { data: quotes, error } = await supabase
    .from("provider_quotes")
    .select("id,requester_name,request_summary,status")
    .eq("provider_profile_id", workspace.provider.id)
    .in("status", ["new", "in_review", "quoted"])
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
