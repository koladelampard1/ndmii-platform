import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { calculateLineTotal, formatDate, formatNaira, invoiceStatusClasses, recalculateInvoiceTotals } from "@/lib/data/invoicing";
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
      selectedItemColumns: Array.from(itemColumns).sort(),
      quantity,
      unitPrice,
      vatApplicable: String(formData.get("vat_applicable") ?? "on") === "on",
      computedLineTotal: lineTotal,
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
      selectedItemColumns: Array.from(itemColumns).sort(),
      quantity,
      unitPrice,
      vatApplicable: String(formData.get("vat_applicable") ?? "") === "on",
      computedLineTotal: lineTotal,
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
    const { data: beforeTotals } = await loadInvoiceTotalsSnapshot(invoiceId);
    console.info("[invoice-mutation:remove-item:totals-before]", beforeTotals);
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
  const invoiceItems = items ?? [];
  const invoiceStatus = String(invoice.status ?? "draft");
  const invoiceStatusLabel = invoiceStatus.replaceAll("_", " ");
  const dueDateLabel = formatDate(invoice.due_date);

  return (
    <section className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice workspace</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{invoice.invoice_number}</h2>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase ${invoiceStatusClasses(invoiceStatus)}`}>
              {invoiceStatusLabel}
            </span>
          </div>
        </div>
        <div className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{invoice.customer_name}</p>
            <p className="mt-1 break-all text-sm text-slate-600">{invoice.customer_email ?? "No email on file"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{dueDateLabel}</p>
            <p className="mt-1 text-sm text-slate-500">{invoice.customer_phone ?? "No customer phone"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public invoice link</p>
            <Link className="mt-1 block break-all text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline" href={publicInvoiceUrl}>
              {publicInvoiceUrl}
            </Link>
          </div>
        </div>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h3 className="text-lg font-semibold text-slate-950">Invoice items</h3>
            <p className="mt-1 text-sm text-slate-500">Review line items, VAT treatment, and totals before sending.</p>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[1.15fr_1.35fr_0.5fr_0.75fr_0.45fr_0.8fr_0.85fr] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Item</span>
                <span>Description</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span>VAT</span>
                <span className="text-right">Line total</span>
                <span className="text-right">Actions</span>
              </div>
              {invoiceItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[1.15fr_1.35fr_0.5fr_0.75fr_0.45fr_0.8fr_0.85fr] gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0">
                  <form id={`update-item-${item.id}`} action={invoiceMutationAction} className="contents">
                    <input type="hidden" name="action" value="update_item" />
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input type="hidden" name="item_id" value={item.id} />
                    <input name="item_name" defaultValue={item.item_name} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    <input name="description" defaultValue={item.description ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={item.quantity} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    <input name="unit_price" type="number" step={0.01} min={0} defaultValue={item.unit_price} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    <label className="inline-flex h-10 items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" name="vat_applicable" defaultChecked={item.vat_applicable} className="h-4 w-4 rounded border-slate-300 text-emerald-700" />
                      VAT
                    </label>
                    <p className="flex h-10 items-center justify-end font-semibold text-slate-950">{formatNaira(item.line_total)}</p>
                  </form>
                  <div className="flex h-10 items-center justify-end gap-2">
                    <button type="submit" form={`update-item-${item.id}`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                      Save
                    </button>
                    <form action={invoiceMutationAction}>
                      <input type="hidden" name="action" value="remove_item" />
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {invoiceItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 p-3">
                <form id={`mobile-update-item-${item.id}`} action={invoiceMutationAction} className="space-y-3">
                  <input type="hidden" name="action" value="update_item" />
                  <input type="hidden" name="invoice_id" value={invoice.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Item name</label>
                    <input name="item_name" defaultValue={item.item_name} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                    <input name="description" defaultValue={item.description ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</label>
                      <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={item.quantity} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Unit price</label>
                      <input name="unit_price" type="number" step={0.01} min={0} defaultValue={item.unit_price} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" name="vat_applicable" defaultChecked={item.vat_applicable} className="h-4 w-4 rounded border-slate-300 text-emerald-700" />
                      VAT applicable
                    </label>
                    <span className="text-sm font-semibold text-slate-950">{formatNaira(item.line_total)}</span>
                  </div>
                </form>
                <div className="mt-3 flex gap-2">
                  <button type="submit" form={`mobile-update-item-${item.id}`} className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                    Save item
                  </button>
                  <form action={invoiceMutationAction} className="flex-1">
                    <input type="hidden" name="action" value="remove_item" />
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input type="hidden" name="item_id" value={item.id} />
                    <button className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                      Remove
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>

          <form action={invoiceMutationAction} className="grid gap-3 border-t border-dashed border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:grid-cols-[1fr_1.2fr_0.55fr_0.75fr_0.45fr_auto]">
            <input type="hidden" name="action" value="add_item" />
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <input required name="item_name" placeholder="Item name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <input name="description" placeholder="Description" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={1} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <input name="unit_price" type="number" step={0.01} min={0} defaultValue={0} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"><input type="checkbox" name="vat_applicable" defaultChecked className="h-4 w-4 rounded border-slate-300 text-emerald-700" />VAT</label>
            <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Add item</button>
          </form>
        </article>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-950">Totals</h3>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${invoiceStatusClasses(invoiceStatus)}`}>{invoiceStatusLabel}</span>
            </div>
            <div className="mt-4 space-y-3">
              <p className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span className="font-medium text-slate-900">{formatNaira(invoice.subtotal)}</span></p>
              <p className="flex justify-between text-sm text-slate-600"><span>VAT ({invoice.vat_rate}%)</span><span className="font-medium text-slate-900">{formatNaira(invoice.vat_amount)}</span></p>
              <div className="rounded-xl bg-slate-950 px-4 py-3 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Total amount</p>
                <p className="mt-1 text-2xl font-semibold">{formatNaira(invoice.total_amount)}</p>
              </div>
              <p className="flex justify-between text-sm text-slate-600"><span>Due date</span><span className="font-medium text-slate-900">{dueDateLabel}</span></p>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Status actions</h3>
              <p className="mt-1 text-sm text-slate-500">Update lifecycle and payment state.</p>
            </div>
            <form action={invoiceMutationAction}>
              <input type="hidden" name="action" value="issue_invoice" />
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <button type="submit" className="w-full rounded-lg bg-indigo-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800">Issue invoice</button>
            </form>
            <form action={invoiceMutationAction} className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <input type="hidden" name="action" value="mark_paid" />
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input name="payment_reference" placeholder="Payment reference" className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <input name="payment_date" type="date" className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <input name="payment_note" placeholder="Optional payment note" className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <button className="w-full rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Mark invoice paid</button>
            </form>
            <form action={invoiceMutationAction}>
              <input type="hidden" name="action" value="cancel_invoice" />
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <button className="w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">Cancel invoice</button>
            </form>
          </section>

          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Send invoice</h3>
              <p className="mt-1 text-sm text-slate-500">Share the public invoice with the customer.</p>
            </div>
            <a
              href={invoice.customer_email ? `mailto:${invoice.customer_email}?subject=${emailSubject}&body=${emailBody}` : "#"}
              className={`block w-full rounded-lg px-3 py-2.5 text-center text-sm font-semibold ${
                invoice.customer_email ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
              aria-disabled={!invoice.customer_email}
            >
              Send via email
            </a>
            <a
              href={whatsappHref ?? "#"}
              target={whatsappHref ? "_blank" : undefined}
              rel={whatsappHref ? "noreferrer" : undefined}
              className={`block w-full rounded-lg px-3 py-2.5 text-center text-sm font-semibold ${
                whatsappHref ? "bg-emerald-700 text-white hover:bg-emerald-800" : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
              aria-disabled={!whatsappHref}
            >
              Send via WhatsApp
            </a>
          </section>
        </aside>
      </div>
    </section>
  );
}
