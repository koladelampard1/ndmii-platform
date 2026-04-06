import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { calculateLineTotal, formatNaira, invoiceStatusClasses, recalculateInvoiceTotals } from "@/lib/data/invoicing";

async function invoiceMutationAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const action = String(formData.get("action") ?? "");

  const { data: invoice, error: loadError } = await supabase
    .from("invoices")
    .select("id,provider_profile_id,status")
    .eq("id", invoiceId)
    .eq("provider_profile_id", workspace.provider.id)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!invoice) throw new Error("Invoice not found for this provider.");

  if (action === "add_item") {
    const quantity = Number(formData.get("quantity") ?? 1);
    const unitPrice = Number(formData.get("unit_price") ?? 0);
    const lineTotal = calculateLineTotal(quantity, unitPrice);
    const { error } = await supabase.from("invoice_items").insert({
      invoice_id: invoiceId,
      item_name: String(formData.get("item_name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      vat_applicable: String(formData.get("vat_applicable") ?? "on") === "on",
    });
    if (error) throw new Error(error.message);
  }

  if (action === "update_item") {
    const itemId = String(formData.get("item_id") ?? "");
    const quantity = Number(formData.get("quantity") ?? 1);
    const unitPrice = Number(formData.get("unit_price") ?? 0);
    const lineTotal = calculateLineTotal(quantity, unitPrice);
    const { error } = await supabase
      .from("invoice_items")
      .update({
        item_name: String(formData.get("item_name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || null,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        vat_applicable: String(formData.get("vat_applicable") ?? "") === "on",
      })
      .eq("id", itemId)
      .eq("invoice_id", invoiceId);
    if (error) throw new Error(error.message);
  }

  if (action === "remove_item") {
    const itemId = String(formData.get("item_id") ?? "");
    const { error } = await supabase.from("invoice_items").delete().eq("id", itemId).eq("invoice_id", invoiceId);
    if (error) throw new Error(error.message);
  }

  if (action === "issue_invoice") {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "issued", issued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("provider_profile_id", workspace.provider.id);
    if (error) throw new Error(error.message);
  }

  if (action === "cancel_invoice") {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("provider_profile_id", workspace.provider.id);
    if (error) throw new Error(error.message);
  }

  await recalculateInvoiceTotals(invoiceId);

  await supabase.from("invoice_events").insert({
    invoice_id: invoiceId,
    event_type: action,
    actor_role: workspace.role,
    actor_id: workspace.msme.id,
    metadata: {},
  });

  revalidatePath(`/dashboard/msme/invoices/${invoiceId}`);
  revalidatePath("/dashboard/msme/invoices");
  revalidatePath("/dashboard/msme/revenue");
  redirect(`/dashboard/msme/invoices/${invoiceId}`);
}

export default async function MsmeInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,customer_name,customer_email,customer_phone,status,due_date,issued_at,subtotal,vat_rate,vat_amount,total_amount")
    .eq("id", invoiceId)
    .eq("provider_profile_id", workspace.provider.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) redirect("/dashboard/msme/invoices");

  const { data: items, error: itemError } = await supabase
    .from("invoice_items")
    .select("id,item_name,description,quantity,unit_price,line_total,vat_applicable")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if (itemError) throw new Error(itemError.message);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Invoice</p>
            <h2 className="text-xl font-semibold">{invoice.invoice_number}</h2>
            <p className="text-sm text-slate-600">{invoice.customer_name} · {invoice.customer_email ?? "No email"}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs uppercase ${invoiceStatusClasses(invoice.status)}`}>{invoice.status}</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">Public link: <Link className="text-indigo-700 hover:underline" href={`/invoice/${invoice.id}`}>/invoice/{invoice.id}</Link></p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-3 rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Invoice items</h3>
          {(items ?? []).map((item) => (
            <form key={item.id} action={invoiceMutationAction} className="grid gap-2 rounded-lg border p-3 md:grid-cols-5">
              <input type="hidden" name="action" value="update_item" />
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input type="hidden" name="item_id" value={item.id} />
              <input name="item_name" defaultValue={item.item_name} className="rounded border px-2 py-1 text-sm" />
              <input name="description" defaultValue={item.description ?? ""} className="rounded border px-2 py-1 text-sm" />
              <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={item.quantity} className="rounded border px-2 py-1 text-sm" />
              <input name="unit_price" type="number" step={0.01} min={0} defaultValue={item.unit_price} className="rounded border px-2 py-1 text-sm" />
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" name="vat_applicable" defaultChecked={item.vat_applicable} />VAT</label>
                <button className="rounded border px-2 py-1 text-xs">Save</button>
              </div>
              <p className="md:col-span-4 text-xs text-slate-500">Line total: {formatNaira(item.line_total)}</p>
            </form>
          ))}

          {(items ?? []).map((item) => (
            <form key={`${item.id}-remove`} action={invoiceMutationAction}>
              <input type="hidden" name="action" value="remove_item" />
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input type="hidden" name="item_id" value={item.id} />
              <button className="text-xs text-red-700 hover:underline">Remove {item.item_name}</button>
            </form>
          ))}

          <form action={invoiceMutationAction} className="grid gap-2 rounded-lg border border-dashed p-3 md:grid-cols-5">
            <input type="hidden" name="action" value="add_item" />
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <input required name="item_name" placeholder="Item name" className="rounded border px-2 py-1 text-sm" />
            <input name="description" placeholder="Description" className="rounded border px-2 py-1 text-sm" />
            <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={1} className="rounded border px-2 py-1 text-sm" />
            <input name="unit_price" type="number" step={0.01} min={0} defaultValue={0} className="rounded border px-2 py-1 text-sm" />
            <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" name="vat_applicable" defaultChecked />VAT</label>
            <button className="rounded border px-2 py-1 text-xs md:col-span-5">Add item</button>
          </form>
        </article>

        <aside className="space-y-3 rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Totals</h3>
          <p className="flex justify-between text-sm"><span>Subtotal</span><span>{formatNaira(invoice.subtotal)}</span></p>
          <p className="flex justify-between text-sm"><span>VAT ({invoice.vat_rate}%)</span><span>{formatNaira(invoice.vat_amount)}</span></p>
          <p className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{formatNaira(invoice.total_amount)}</span></p>
          <p className="text-xs text-slate-500">Due date: {invoice.due_date ?? "Not set"}</p>

          <form action={invoiceMutationAction}>
            <input type="hidden" name="action" value="issue_invoice" />
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <button className="w-full rounded bg-indigo-900 px-3 py-2 text-sm text-white">Issue invoice</button>
          </form>
          <form action={invoiceMutationAction}>
            <input type="hidden" name="action" value="cancel_invoice" />
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <button className="w-full rounded border border-red-300 px-3 py-2 text-sm text-red-700">Cancel invoice</button>
          </form>
        </aside>
      </div>
    </section>
  );
}
