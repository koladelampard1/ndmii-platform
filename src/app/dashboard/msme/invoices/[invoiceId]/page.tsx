import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { calculateLineTotal, formatNaira, invoiceStatusClasses, recalculateInvoiceTotals } from "@/lib/data/invoicing";
import { filterPayloadByColumns, getTableColumns, logActivityEvent, logInvoiceEvent, normalizeInvoiceStatus } from "@/lib/data/commercial-ops";

async function loadInvoiceTotalsSnapshot(invoiceId: string) {
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("invoices").select("id,subtotal,vat_amount,total_amount,status").eq("id", invoiceId).maybeSingle();
  return { data, error };
}

async function invoiceMutationAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const nowIso = new Date().toISOString();
  console.info("[invoice-mutation:start]", { action, invoiceId, providerId: workspace.provider.id });

  const { data: invoice, error: loadError } = await supabase
    .from("invoices")
    .select("id,provider_profile_id,status,total_amount")
    .eq("id", invoiceId)
    .eq("provider_profile_id", workspace.provider.id)
    .maybeSingle();

  if (loadError || !invoice) throw new Error("Invoice not found for this provider.");
  console.info("[invoice-mutation:invoice-loaded]", { invoiceId, status: invoice.status, totalAmount: invoice.total_amount });

  if (action === "add_item") {
    const quantity = Number(formData.get("quantity") ?? 1);
    const unitPrice = Number(formData.get("unit_price") ?? 0);
    const lineTotal = calculateLineTotal(quantity, unitPrice);
    const itemColumns = await getTableColumns(supabase, "invoice_items");
    const payload = filterPayloadByColumns(
      {
        invoice_id: invoiceId,
        item_name: String(formData.get("item_name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || null,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        vat_applicable: String(formData.get("vat_applicable") ?? "on") === "on",
      },
      itemColumns
    );
    console.info("[invoice-mutation:add-item:payload]", {
      invoiceId,
      payload,
      quantity,
      unitPrice,
      vatApplicable: String(formData.get("vat_applicable") ?? "on") === "on",
    });
    const { data: beforeTotals } = await loadInvoiceTotalsSnapshot(invoiceId);
    console.info("[invoice-mutation:add-item:totals-before]", beforeTotals);
    const { data: insertedRows, error } = await supabase.from("invoice_items").insert(payload).select("id,invoice_id,item_name,quantity,unit_price,line_total,vat_applicable");
    if (error) throw new Error(error.message);
    console.info("[invoice-mutation:add-item:insert-result]", insertedRows);
  }

  if (action === "update_item") {
    const itemId = String(formData.get("item_id") ?? "");
    const quantity = Number(formData.get("quantity") ?? 1);
    const unitPrice = Number(formData.get("unit_price") ?? 0);
    const lineTotal = calculateLineTotal(quantity, unitPrice);
    const itemColumns = await getTableColumns(supabase, "invoice_items");
    const payload = filterPayloadByColumns(
      {
        item_name: String(formData.get("item_name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || null,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        vat_applicable: String(formData.get("vat_applicable") ?? "") === "on",
      },
      itemColumns
    );
    console.info("[invoice-mutation:update-item:payload]", {
      invoiceId,
      itemId,
      payload,
      quantity,
      unitPrice,
      vatApplicable: String(formData.get("vat_applicable") ?? "") === "on",
    });
    const { data: beforeTotals } = await loadInvoiceTotalsSnapshot(invoiceId);
    console.info("[invoice-mutation:update-item:totals-before]", beforeTotals);
    const { data: updatedRows, error } = await supabase
      .from("invoice_items")
      .update(payload)
      .eq("id", itemId)
      .eq("invoice_id", invoiceId)
      .select("id,invoice_id,item_name,quantity,unit_price,line_total,vat_applicable");
    if (error) throw new Error(error.message);
    console.info("[invoice-mutation:update-item:update-result]", updatedRows);
  }

  if (action === "remove_item") {
    const itemId = String(formData.get("item_id") ?? "");
    const { error } = await supabase.from("invoice_items").delete().eq("id", itemId).eq("invoice_id", invoiceId);
    if (error) throw new Error(error.message);
  }

  if (action === "issue_invoice" || action === "cancel_invoice") {
    const invoiceColumns = await getTableColumns(supabase, "invoices");
    const payload = filterPayloadByColumns(
      {
        status: normalizeInvoiceStatus(action === "issue_invoice" ? "issued" : "cancelled"),
        issued_at: action === "issue_invoice" ? nowIso : undefined,
        updated_at: nowIso,
      },
      invoiceColumns
    );
    console.info("[invoice-mutation:status-update:before]", { invoiceId, currentStatus: invoice.status });
    console.info("[invoice-mutation:status-update:payload]", { invoiceId, action, payload });
    const { data: updatedRows, error } = await supabase
      .from("invoices")
      .update(payload)
      .eq("id", invoiceId)
      .eq("provider_profile_id", workspace.provider.id)
      .select("id,status,issued_at,updated_at");
    if (error) throw new Error(error.message);
    console.info("[invoice-mutation:status-update:result]", updatedRows);
    const { data: resultingInvoice, error: resultingError } = await supabase
      .from("invoices")
      .select("id,status,issued_at,updated_at,subtotal,vat_amount,total_amount")
      .eq("id", invoiceId)
      .maybeSingle();
    console.info("[invoice-mutation:status-update:after]", { resultingInvoice, resultingError: resultingError?.message ?? null });
  }

  if (action === "mark_paid") {
    const paidReference = String(formData.get("payment_reference") ?? "").trim() || `MANUAL-${Date.now()}`;
    const paidDate = String(formData.get("payment_date") ?? "").trim();
    const paidNote = String(formData.get("payment_note") ?? "").trim() || null;
    const paidAtIso = paidDate ? new Date(paidDate).toISOString() : nowIso;

    const paymentColumns = await getTableColumns(supabase, "invoice_payments");
    if (paymentColumns.has("invoice_id")) {
      const paymentPayload = filterPayloadByColumns(
        {
          invoice_id: invoiceId,
          payment_reference: paidReference,
          payment_method: "manual_provider_confirmation",
          payment_status: "success",
          amount: Number(invoice.total_amount ?? 0),
          paid_at: paidAtIso,
          note: paidNote,
          metadata: paidNote ? { note: paidNote } : undefined,
          created_at: nowIso,
        },
        paymentColumns
      );
      const { error: paymentError } = await supabase.from("invoice_payments").insert(paymentPayload);
      if (paymentError) console.info("[invoice-mark-paid:payment-fallback]", paymentError.message);
    }

    const invoiceColumns = await getTableColumns(supabase, "invoices");
    const invoiceUpdate = filterPayloadByColumns(
      {
        status: "paid",
        paid_at: paidAtIso,
        updated_at: nowIso,
      },
      invoiceColumns
    );
    const { error: updateError } = await supabase.from("invoices").update(invoiceUpdate).eq("id", invoiceId).eq("provider_profile_id", workspace.provider.id);
    if (updateError) throw new Error(updateError.message);

    await logInvoiceEvent(supabase, {
      invoiceId,
      eventType: "invoice_marked_paid",
      actorRole: workspace.role,
      actorId: workspace.msme.id,
      metadata: { payment_reference: paidReference, payment_date: paidAtIso, note: paidNote },
    });

    await logActivityEvent(supabase, {
      action: "invoice_marked_paid",
      entityType: "invoice",
      entityId: invoiceId,
      actorUserId: workspace.appUserId,
      metadata: { payment_reference: paidReference },
    });
  }

  const recalculatedTotals = await recalculateInvoiceTotals(invoiceId);
  console.info("[invoice-mutation:totals-recalculated]", { invoiceId, recalculatedTotals });
  const { data: afterTotals, error: afterTotalsError } = await loadInvoiceTotalsSnapshot(invoiceId);
  console.info("[invoice-mutation:totals-after]", { afterTotals, afterTotalsError: afterTotalsError?.message ?? null });

  await logInvoiceEvent(supabase, {
    invoiceId,
    eventType: action,
    actorRole: workspace.role,
    actorId: workspace.msme.id,
    metadata: {},
  });

  revalidatePath(`/dashboard/msme/invoices/${invoiceId}`);
  revalidatePath("/dashboard/msme/invoices");
  revalidatePath("/dashboard/msme/revenue");
  revalidatePath(`/invoice/${invoiceId}`);
  console.info("[invoice-mutation:revalidated]", {
    paths: [
      `/dashboard/msme/invoices/${invoiceId}`,
      "/dashboard/msme/invoices",
      "/dashboard/msme/revenue",
      `/invoice/${invoiceId}`,
    ],
  });
  const notice =
    action === "issue_invoice"
      ? "invoice_issued"
      : action === "cancel_invoice"
        ? "invoice_cancelled"
        : action === "mark_paid"
          ? "invoice_paid"
          : action === "remove_item"
            ? "item_removed"
            : "item_saved";
  redirect(`/dashboard/msme/invoices/${invoiceId}?notice=${notice}`);
}

export default async function MsmeInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { invoiceId } = await params;
  const query = await searchParams;
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

  const publicInvoiceUrl = `/invoice/${invoice.id}`;
  const publicInvoiceAbsoluteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${publicInvoiceUrl}`;
  const emailSubject = encodeURIComponent(`Invoice ${invoice.invoice_number} from ${workspace.provider.display_name}`);
  const emailBody = encodeURIComponent(
    [
      `Hello ${invoice.customer_name},`,
      "",
      `Your invoice ${invoice.invoice_number} is ready.`,
      `View invoice: ${publicInvoiceAbsoluteUrl}`,
      `Amount due: ${formatNaira(invoice.total_amount)}`,
    ].join("\n")
  );
  const phoneDigits = String(invoice.customer_phone ?? "").replace(/\D/g, "");
  const whatsappBody = encodeURIComponent(
    `Hello ${invoice.customer_name}, your invoice ${invoice.invoice_number} is ready: ${publicInvoiceAbsoluteUrl}`
  );
  const whatsappHref = phoneDigits ? `https://wa.me/${phoneDigits}?text=${whatsappBody}` : null;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Invoice</p>
            <h2 className="text-xl font-semibold">{invoice.invoice_number}</h2>
            <p className="text-sm text-slate-600">{invoice.customer_name} · {invoice.customer_email ?? "No email"}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs uppercase ${invoiceStatusClasses(String(invoice.status ?? "draft"))}`}>{invoice.status}</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">Public link: <Link className="text-indigo-700 hover:underline" href={publicInvoiceUrl}>{publicInvoiceUrl}</Link></p>
      </header>
      {query.notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {query.notice === "invoice_issued"
            ? "Invoice issued successfully."
            : query.notice === "invoice_cancelled"
              ? "Invoice cancelled successfully."
              : query.notice === "invoice_paid"
                ? "Invoice marked as paid successfully."
                : query.notice === "item_removed"
                  ? "Invoice item removed and totals refreshed."
                  : "Invoice item saved and totals refreshed."}
        </p>
      ) : null}

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
                <button type="submit" className="rounded border px-2 py-1 text-xs">Save</button>
              </div>
              <p className="text-xs text-slate-500 md:col-span-4">Line total: {formatNaira(item.line_total)}</p>
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
            <button type="submit" className="rounded border px-2 py-1 text-xs md:col-span-5">Add item</button>
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
            <button type="submit" className="w-full rounded bg-indigo-900 px-3 py-2 text-sm text-white">Issue invoice</button>
          </form>
          <form action={invoiceMutationAction} className="space-y-2 rounded border p-2">
            <input type="hidden" name="action" value="mark_paid" />
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <input name="payment_reference" placeholder="Payment reference" className="w-full rounded border px-2 py-1 text-xs" />
            <input name="payment_date" type="date" className="w-full rounded border px-2 py-1 text-xs" />
            <input name="payment_note" placeholder="Optional payment note" className="w-full rounded border px-2 py-1 text-xs" />
            <button className="w-full rounded bg-emerald-700 px-3 py-2 text-sm text-white">Mark invoice paid</button>
          </form>
          <form action={invoiceMutationAction}>
            <input type="hidden" name="action" value="cancel_invoice" />
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <button className="w-full rounded border border-red-300 px-3 py-2 text-sm text-red-700">Cancel invoice</button>
          </form>

          <div className="space-y-2 rounded border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Send invoice</p>
            <a
              href={invoice.customer_email ? `mailto:${invoice.customer_email}?subject=${emailSubject}&body=${emailBody}` : "#"}
              className={`block w-full rounded px-3 py-2 text-center text-sm ${
                invoice.customer_email ? "bg-indigo-900 text-white" : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
              aria-disabled={!invoice.customer_email}
            >
              Send via email
            </a>
            <a
              href={whatsappHref ?? "#"}
              target={whatsappHref ? "_blank" : undefined}
              rel={whatsappHref ? "noreferrer" : undefined}
              className={`block w-full rounded px-3 py-2 text-center text-sm ${
                whatsappHref ? "bg-emerald-700 text-white" : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
              aria-disabled={!whatsappHref}
            >
              Send via WhatsApp
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
