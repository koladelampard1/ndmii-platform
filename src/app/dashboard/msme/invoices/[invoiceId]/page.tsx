import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarDays, Check, Clipboard, Download, Edit3, Info, Landmark, Mail, Plus, Save, Trash2, User, X } from "lucide-react";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { calculateLineTotal, formatDate, formatNaira, invoiceStatusClasses, recalculateInvoiceTotals } from "@/lib/data/invoicing";
import { filterPayloadByColumns, getTableColumns, logActivityEvent, logInvoiceEvent } from "@/lib/data/commercial-ops";
import { buildInvoiceBankingReadiness, loadMsmeBankingProfile, verificationStatusLabel } from "@/lib/data/msme-banking";
export const runtime = "nodejs";

type InvoiceEmailNotice =
  | "invoice_email_sent"
  | "missing_customer_email"
  | "missing_invoice_items"
  | "invalid_invoice_total"
  | "email_not_configured"
  | "pdf_generation_failed"
  | "email_send_failed";

async function loadInvoiceTotalsSnapshot(invoiceId: string) {
  const supabase = await createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("invoices").select("id,subtotal,vat_amount,total_amount,status").eq("id", invoiceId).maybeSingle();
  return { data, error };
}

function buildInvoiceStatusPayload(action: string, nowIso: string, invoiceColumns: Set<string>, paidAtIso?: string) {
  const status = action === "issue_invoice" ? "issued" : action === "mark_paid" ? "paid" : "cancelled";
  const payload: Record<string, unknown> = { status };

  if (action === "issue_invoice" && invoiceColumns.has("issued_at")) payload.issued_at = nowIso;
  if (action === "mark_paid" && invoiceColumns.has("paid_at")) payload.paid_at = paidAtIso ?? nowIso;
  if (action === "cancel_invoice" && invoiceColumns.has("cancelled_at")) payload.cancelled_at = nowIso;
  if (invoiceColumns.has("updated_at")) payload.updated_at = nowIso;

  return payload;
}

function invoiceStatusSelect(invoiceColumns: Set<string>) {
  const columns = ["id", "status"];
  for (const column of ["issued_at", "paid_at", "cancelled_at", "updated_at"]) {
    if (invoiceColumns.has(column)) columns.push(column);
  }
  return columns.join(",");
}

function redirectWithInvoiceEmailNotice(invoiceId: string, notice: InvoiceEmailNotice): never {
  const key = notice === "invoice_email_sent" ? "notice" : "error";
  redirect(`/dashboard/msme/invoices/${invoiceId}?${key}=${notice}`);
}

function buildAbsoluteUrl(path: string, requestHeaders: Headers) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configuredOrigin) return `${configuredOrigin}${path}`;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  if (!host) return path;
  return `${protocol}://${host}${path}`;
}

function formatEmailAmount(currency: string | null | undefined, totalAmount: number | string | null | undefined) {
  const amount = Number(totalAmount ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${String(currency ?? "₦")}${amount}`;
}

function resolveBusinessInvoiceName(msmeName?: string | null, providerName?: string | null) {
  return String(msmeName || providerName || "Your Business").trim();
}

function humanizeInvoiceValue(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function buildWhiteLabelFromEmail(businessName: string) {
  return `${businessName.replace(/[<>"]/g, "").trim() || "Your Business"} <onboarding@resend.dev>`;
}

async function sendInvoiceEmailAction(formData: FormData) {
  "use server";
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();
  const invoiceId = String(formData.get("invoice_id") ?? "").trim();

  if (!invoiceId) redirect("/dashboard/msme/invoices?error=missing_invoice");

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,customer_name,customer_email,due_date,total_amount,currency")
    .eq("id", invoiceId)
    .eq("provider_profile_id", workspace.provider.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) redirect("/dashboard/msme/invoices?error=missing_invoice");

  const { data: items, error: itemError } = await supabase
    .from("invoice_items")
    .select("id")
    .eq("invoice_id", invoiceId)
    .limit(1);

  if (itemError) throw new Error(itemError.message);

  const customerEmail = String(invoice.customer_email ?? "").trim();
  if (!customerEmail) redirectWithInvoiceEmailNotice(invoiceId, "missing_customer_email");
  if ((items ?? []).length === 0) redirectWithInvoiceEmailNotice(invoiceId, "missing_invoice_items");
  if (Number(invoice.total_amount ?? 0) <= 0) redirectWithInvoiceEmailNotice(invoiceId, "invalid_invoice_total");

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) redirectWithInvoiceEmailNotice(invoiceId, "email_not_configured");

  const requestHeaders = await headers();
  const pdfPath = `/api/msme/invoices/${invoice.id}/pdf`;
  const pdfDownloadLink = buildAbsoluteUrl(pdfPath, requestHeaders);
  const pdfResponse = await fetch(pdfDownloadLink, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!pdfResponse.ok || !pdfResponse.headers.get("content-type")?.includes("application/pdf")) {
    console.error("[invoice-email:pdf-fetch-failed]", { invoiceId, status: pdfResponse.status, contentType: pdfResponse.headers.get("content-type") });
    redirectWithInvoiceEmailNotice(invoiceId, "pdf_generation_failed");
  }

  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
  const businessName = resolveBusinessInvoiceName(workspace.msme.business_name, workspace.provider.display_name);
  const invoiceNumber = String(invoice.invoice_number ?? invoice.id);
  const subject = `Invoice ${invoiceNumber} from ${businessName}`;
  const body = [
    `Hello ${invoice.customer_name},`,
    "",
    `Please find attached your invoice ${invoiceNumber} from ${businessName}.`,
    "",
    `Amount: ${formatEmailAmount(invoice.currency, invoice.total_amount)}`,
    `Due date: ${formatDate(invoice.due_date)}`,
    "",
    "Thank you,",
    businessName,
  ].join("\n");
  const filename = `${businessName}-invoice-${invoiceNumber}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");
  const fromEmail = buildWhiteLabelFromEmail(businessName);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [customerEmail],
      subject,
      text: body,
      attachments: [{ filename, content: pdfBytes.toString("base64") }],
    }),
  });

  const resendResult = (await resendResponse.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!resendResponse.ok) {
    console.error("[invoice-email:send-failed]", { invoiceId, status: resendResponse.status, response: resendResult });
    redirectWithInvoiceEmailNotice(invoiceId, "email_send_failed");
  }

  await logInvoiceEvent(supabase, {
    invoiceId,
    eventType: "invoice_sent_email",
    actorRole: workspace.role,
    actorId: workspace.msme.id,
    metadata: { customer_email: customerEmail, resend_id: resendResult?.id ?? null, pdf_download_link: pdfDownloadLink },
  });

  revalidatePath(`/dashboard/msme/invoices/${invoiceId}`);
  redirectWithInvoiceEmailNotice(invoiceId, "invoice_email_sent");
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
    if (!invoiceId) throw new Error("Missing invoiceId before adding invoice item");
    const quantity = Number(formData.get("quantity") ?? 1);
    const unitPrice = Number(formData.get("unit_price") ?? 0);
    const lineTotal = calculateLineTotal(quantity, unitPrice);
    const payload = {
      invoice_id: invoiceId,
      item_name: String(formData.get("item_name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      vat_applicable: String(formData.get("vat_applicable") ?? "on") === "on",
    };
    console.info("[invoice-mutation:add-item:invoice-id]", invoiceId);
    console.info("[invoice-mutation:add-item:payload]", payload);
    const { data: beforeTotals } = await loadInvoiceTotalsSnapshot(invoiceId);
    console.info("[invoice-mutation:add-item:totals-before]", beforeTotals);
    const { data: insertedRows, error } = await supabase.from("invoice_items").insert(payload).select("id,invoice_id,item_name,quantity,unit_price,line_total,vat_applicable");
    if (error) throw new Error(error.message);
    console.info("[invoice-mutation:add-item:insert-result]", insertedRows);
    const recalculatedTotals = await recalculateInvoiceTotals(invoiceId);
    console.info("[invoice-mutation:add-item:totals-recalculated]", { invoiceId, recalculatedTotals });
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
    const payload = buildInvoiceStatusPayload(action, nowIso, invoiceColumns);
    const selectColumns = invoiceStatusSelect(invoiceColumns);
    console.info("[invoice-status][action]", action);
    console.info("[invoice-status][invoice-id]", invoiceId);
    console.info("[invoice-status][update-payload]", payload);
    console.info("[invoice-mutation:status-update:before]", { invoiceId, currentStatus: invoice.status });
    console.info("[invoice-mutation:status-update:payload]", { invoiceId, action, payload });
    const { data: updatedRows, error } = await supabase
      .from("invoices")
      .update(payload)
      .eq("id", invoiceId)
      .eq("provider_profile_id", workspace.provider.id)
      .select(selectColumns);
    console.info("[invoice-status][update-result]", { data: updatedRows, error: error?.message ?? null });
    if (error) throw new Error(error.message);
    console.info("[invoice-mutation:status-update:result]", updatedRows);
    const { data: resultingInvoice, error: resultingError } = await supabase
      .from("invoices")
      .select(`${selectColumns},subtotal,vat_amount,total_amount`)
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
    const invoiceUpdate = buildInvoiceStatusPayload(action, nowIso, invoiceColumns, paidAtIso);
    const selectColumns = invoiceStatusSelect(invoiceColumns);
    console.info("[invoice-status][action]", action);
    console.info("[invoice-status][invoice-id]", invoiceId);
    console.info("[invoice-status][update-payload]", invoiceUpdate);
    const { data: updatedRows, error: updateError } = await supabase
      .from("invoices")
      .update(invoiceUpdate)
      .eq("id", invoiceId)
      .eq("provider_profile_id", workspace.provider.id)
      .select(selectColumns);
    console.info("[invoice-status][update-result]", { data: updatedRows, error: updateError?.message ?? null });
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
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { invoiceId } = await params;
  const query = await searchParams;
  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,customer_name,customer_email,customer_phone,status,due_date,issued_at,subtotal,vat_rate,vat_amount,total_amount,currency")
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

  const invoicePdfUrl = `/api/msme/invoices/${invoice.id}/pdf`;
  const bankingReadiness = buildInvoiceBankingReadiness(await loadMsmeBankingProfile(supabase, workspace.msme.id));
  const phoneDigits = String(invoice.customer_phone ?? "").replace(/\D/g, "");
  const businessName = resolveBusinessInvoiceName(workspace.msme.business_name, workspace.provider.display_name);
  const whatsappBody = encodeURIComponent(
    [
      `Hello ${invoice.customer_name}, your invoice ${invoice.invoice_number} from ${businessName} is ready.`,
      "",
      `Amount: ${formatNaira(invoice.total_amount)}`,
      `Due date: ${formatDate(invoice.due_date)}`,
    ].join("\n")
  );
  const whatsappHref = phoneDigits ? `https://wa.me/${phoneDigits}?text=${whatsappBody}` : null;
  const invoiceItems = items ?? [];
  const invoiceStatus = String(invoice.status ?? "draft");
  const invoiceStatusLabel = invoiceStatus.replaceAll("_", " ");
  const invoiceDateLabel = formatDate(invoice.issued_at ?? invoice.due_date);
  const dueDateLabel = formatDate(invoice.due_date);

  return (
    <section className="space-y-6">
      {query.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {query.error === "missing_customer_email"
            ? "Add a customer email before sending this invoice."
            : query.error === "missing_invoice_items"
              ? "Add at least one invoice item before sending this invoice."
              : query.error === "invalid_invoice_total"
                ? "Invoice total must be greater than zero before sending."
                : query.error === "email_not_configured"
                  ? "Email sending is not configured. Set RESEND_API_KEY and try again."
                  : query.error === "pdf_generation_failed"
                    ? "Unable to generate the invoice PDF attachment."
                    : query.error === "email_send_failed"
                      ? "Unable to send invoice email right now."
                      : "Unable to send invoice email."}
        </p>
      ) : null}

      {query.notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {query.notice === "invoice_issued"
            ? "Invoice issued successfully."
            : query.notice === "invoice_email_sent"
              ? "Invoice sent successfully."
              : query.notice === "invoice_cancelled"
                ? "Invoice cancelled successfully."
                : query.notice === "invoice_paid"
                  ? "Invoice marked as paid successfully."
                  : query.notice === "item_removed"
                    ? "Invoice item removed and totals refreshed."
                    : "Invoice item saved and totals refreshed."}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <header className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{businessName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{invoice.invoice_number}</h2>
                  <span className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${invoiceStatusClasses(invoiceStatus)}`}>
                    {invoiceStatusLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_0.75fr_1fr]">
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Customer</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{invoice.customer_name}</p>
                  <p className="mt-1 break-all text-sm font-medium text-slate-600">{invoice.customer_email ?? "No email on file"}</p>
                  <p className="mt-1 text-sm font-medium text-slate-600">{invoice.customer_phone ?? "No customer phone"}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Invoice date</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{invoiceDateLabel}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Due date</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{dueDateLabel}</p>
                  </div>
                </div>
              </div>

            </div>
          </header>

          <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div>
                <h3 className="text-xl font-bold text-slate-950">Invoice items</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">Review line items, VAT treatment, and totals before sending.</p>
              </div>
              <button
                type="button"
                className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                Add item
              </button>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <div className="min-w-[980px] p-5">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid grid-cols-[1.1fr_1.75fr_0.45fr_0.8fr_0.55fr_0.85fr_0.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-500">
                    <span>Item</span>
                    <span>Description</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">Unit price</span>
                    <span className="text-center">VAT</span>
                    <span className="text-right">Line total</span>
                    <span className="text-right">Actions</span>
                  </div>
                  {invoiceItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1.1fr_1.75fr_0.45fr_0.8fr_0.55fr_0.85fr_0.7fr] gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0">
                      <form id={`update-item-${item.id}`} action={invoiceMutationAction} className="contents">
                        <input type="hidden" name="action" value="update_item" />
                        <input type="hidden" name="invoice_id" value={invoice.id} />
                        <input type="hidden" name="item_id" value={item.id} />
                        <input name="item_name" defaultValue={item.item_name} className="h-10 w-full rounded-md border border-transparent bg-transparent px-0 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white focus:px-3 focus:ring-2 focus:ring-emerald-100" />
                        <input name="description" defaultValue={item.description ?? ""} className="h-10 w-full rounded-md border border-transparent bg-transparent px-0 text-sm font-medium text-slate-700 outline-none focus:border-emerald-300 focus:bg-white focus:px-3 focus:ring-2 focus:ring-emerald-100" />
                        <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={item.quantity} className="h-10 w-full rounded-md border border-transparent bg-transparent px-0 text-center text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white focus:px-2 focus:ring-2 focus:ring-emerald-100" />
                        <input name="unit_price" type="number" step={0.01} min={0} defaultValue={item.unit_price} className="h-10 w-full rounded-md border border-transparent bg-transparent px-0 text-right text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white focus:px-2 focus:ring-2 focus:ring-emerald-100" />
                        <label className="inline-flex h-10 items-center justify-center gap-2 text-sm font-bold text-slate-700">
                          <input type="checkbox" name="vat_applicable" defaultChecked={item.vat_applicable} className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">VAT</span>
                        </label>
                        <p className="flex h-10 items-center justify-end text-sm font-bold text-slate-950">{formatNaira(item.line_total)}</p>
                      </form>
                      <div className="flex h-10 items-center justify-end gap-2">
                        <button
                          type="submit"
                          form={`update-item-${item.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50"
                          aria-label="Save invoice item"
                          title="Save invoice item"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <form action={invoiceMutationAction}>
                          <input type="hidden" name="action" value="remove_item" />
                          <input type="hidden" name="invoice_id" value={invoice.id} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 hover:bg-red-50"
                            aria-label="Remove invoice item"
                            title="Remove invoice item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}

                  <form action={invoiceMutationAction} className="grid grid-cols-[1.1fr_1.75fr_0.45fr_0.8fr_0.55fr_0.85fr_0.7fr] gap-4 bg-white px-4 py-4">
                    <input type="hidden" name="action" value="add_item" />
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input required name="item_name" placeholder="Item name" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    <input name="description" placeholder="Description" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={1} className="h-10 rounded-lg border border-slate-200 px-3 text-center text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    <input name="unit_price" type="number" step={0.01} min={0} defaultValue={0} className="h-10 rounded-lg border border-slate-200 px-3 text-right text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    <label className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white text-sm font-bold text-slate-700">
                      <input type="checkbox" name="vat_applicable" defaultChecked className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                      VAT
                    </label>
                    <p className="flex h-10 items-center justify-end text-sm font-bold text-slate-950">₦0.00</p>
                    <div className="flex h-10 items-center justify-end gap-2">
                      <button
                        type="submit"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50"
                        aria-label="Add invoice item"
                        title="Add invoice item"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        type="reset"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        aria-label="Clear invoice item"
                        title="Clear invoice item"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">All amounts in NGN</p>
              </div>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {invoiceItems.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <form id={`mobile-update-item-${item.id}`} action={invoiceMutationAction} className="space-y-3">
                    <input type="hidden" name="action" value="update_item" />
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input type="hidden" name="item_id" value={item.id} />
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Item</label>
                      <input name="item_name" defaultValue={item.item_name} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Description</label>
                      <input name="description" defaultValue={item.description ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Qty</label>
                        <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={item.quantity} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Unit price</label>
                        <input name="unit_price" type="number" step={0.01} min={0} defaultValue={item.unit_price} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                        <input type="checkbox" name="vat_applicable" defaultChecked={item.vat_applicable} className="h-4 w-4 rounded border-slate-300 text-emerald-700" />
                        VAT
                      </label>
                      <span className="text-sm font-bold text-slate-950">{formatNaira(item.line_total)}</span>
                    </div>
                  </form>
                  <div className="mt-3 flex gap-2">
                    <button type="submit" form={`mobile-update-item-${item.id}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                      <Save className="h-4 w-4" />
                      Save item
                    </button>
                    <form action={invoiceMutationAction} className="flex-1">
                      <input type="hidden" name="action" value="remove_item" />
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </form>
                  </div>
                </article>
              ))}

              <form action={invoiceMutationAction} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <input type="hidden" name="action" value="add_item" />
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <input required name="item_name" placeholder="Item name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                <input name="description" placeholder="Description" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                <div className="grid grid-cols-2 gap-3">
                  <input name="quantity" type="number" step={0.01} min={0.01} defaultValue={1} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  <input name="unit_price" type="number" step={0.01} min={0} defaultValue={0} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 rounded-lg bg-white text-sm font-bold text-slate-700">
                    <input type="checkbox" name="vat_applicable" defaultChecked className="h-4 w-4 rounded border-slate-300 text-emerald-700" />
                    VAT
                  </label>
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                    <Save className="h-4 w-4" />
                    Add item
                  </button>
                </div>
              </form>
              <p className="px-1 text-sm font-medium text-slate-500">All amounts in NGN</p>
            </div>
          </article>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-bold text-slate-950">Invoice timeline</h3>
            <div className="mt-5 space-y-0">
              {[
                { icon: Clipboard, title: "Invoice created", body: "Invoice has been created as a draft.", time: invoiceDateLabel },
                { icon: Edit3, title: "Draft saved", body: "Invoice details updated.", time: query.notice ? "Just now" : invoiceDateLabel },
                { icon: Clipboard, title: "Awaiting issuance", body: "When you are ready, issue this invoice to your customer.", time: invoiceStatus === "draft" ? "—" : invoiceStatusLabel },
              ].map((event, index, events) => {
                const Icon = event.icon;
                return (
                  <div key={event.title} className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                          index === 0 ? "bg-emerald-100 text-emerald-700" : index === 1 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {index < events.length - 1 ? <span className="h-9 w-px bg-slate-200" /> : null}
                    </div>
                    <div className="pb-7">
                      <p className="text-sm font-bold text-slate-900">{event.title}</p>
                      <p className="mt-1 text-sm font-medium text-slate-600">{event.body}</p>
                    </div>
                    <p className="hidden whitespace-nowrap text-sm font-medium text-slate-500 sm:block">{event.time}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
            <Check className="mr-2 inline h-4 w-4" />
            Tip: Issue your invoice when you are ready to notify the customer. You can still edit while in draft mode.
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="text-xl font-bold text-slate-950">Summary</h3>
              <div className="mt-5 space-y-4">
                <p className="flex justify-between gap-4 text-base font-semibold text-slate-700">
                  <span>Subtotal</span>
                  <span className="text-right font-bold text-slate-950">{formatNaira(invoice.subtotal)}</span>
                </p>
                <p className="flex justify-between gap-4 text-base font-semibold text-slate-700">
                  <span>VAT ({invoice.vat_rate}%)</span>
                  <span className="text-right font-bold text-slate-950">{formatNaira(invoice.vat_amount)}</span>
                </p>
              </div>
            </div>
            <div className="border-b border-slate-100 p-5">
              <div className="rounded-lg bg-emerald-50/55 px-4 py-4">
                <p className="text-base font-bold text-slate-800">Total amount</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{formatNaira(invoice.total_amount)}</p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-bold text-slate-900">Invoice status</p>
                  <p className="mt-2 text-sm font-medium text-slate-500">Created on {invoiceDateLabel}</p>
                </div>
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${invoiceStatusClasses(invoiceStatus)}`}>{invoiceStatusLabel}</span>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h3 className="text-xl font-bold text-slate-950">Status actions</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">Update lifecycle and payment state.</p>
            </div>
            <a
              href={invoicePdfUrl}
              download
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-center text-sm font-bold text-blue-800 hover:bg-blue-100"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
            <form action={invoiceMutationAction}>
              <input type="hidden" name="action" value="issue_invoice" />
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <button type="submit" className="w-full rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">Issue invoice</button>
            </form>
            <form action={invoiceMutationAction} className="space-y-2">
              <input type="hidden" name="action" value="mark_paid" />
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input name="payment_reference" placeholder="Payment reference" className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <input name="payment_date" type="date" className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <input name="payment_note" placeholder="Optional payment note" className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <button className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50">Mark invoice paid</button>
            </form>
            <form action={invoiceMutationAction}>
              <input type="hidden" name="action" value="cancel_invoice" />
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <button className="w-full rounded-lg border border-red-300 bg-white px-3 py-3 text-sm font-bold text-red-600 hover:bg-red-50">Cancel invoice</button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-xl font-bold text-slate-950">
              <Landmark className="h-5 w-5 text-emerald-700" />
              Payment profile
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between gap-4">
                <span className="font-medium text-slate-500">Bank</span>
                <span className="text-right font-bold text-slate-900">{bankingReadiness.bank_name ?? "Not configured"}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="font-medium text-slate-500">Account name</span>
                <span className="text-right font-bold text-slate-900">{bankingReadiness.account_name ?? "Not configured"}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="font-medium text-slate-500">Account</span>
                <span className="text-right font-bold text-slate-900">{bankingReadiness.account_number_masked ?? "Not configured"}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="font-medium text-slate-500">Currency</span>
                <span className="text-right font-bold text-slate-900">{bankingReadiness.currency}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="font-medium text-slate-500">Payment method</span>
                <span className="text-right font-bold text-slate-900">{humanizeInvoiceValue(bankingReadiness.preferred_payment_method)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="font-medium text-slate-500">Readiness</span>
                <span className="text-right font-bold text-slate-900">{bankingReadiness.configured ? "Configured" : "Not configured"}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="font-medium text-slate-500">Status</span>
                <span className="text-right font-bold text-slate-900">{bankingReadiness.payout_ready ? "Payout ready" : verificationStatusLabel(bankingReadiness.verification_status)}</span>
              </p>
            </div>
            <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
              Invoice workflows consume only safe banking summary fields. Full account numbers are not exposed here.
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="space-y-2 p-5">
              <div>
                <h3 className="text-xl font-bold text-slate-950">Send invoice</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">Share invoice with your customer.</p>
              </div>
              <form action={sendInvoiceEmailAction}>
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-3 text-center text-sm font-bold text-white hover:bg-emerald-800"
                >
                  <Mail className="h-4 w-4" />
                  Send via email
                </button>
              </form>
              <a
                href={whatsappHref ?? "#"}
                target={whatsappHref ? "_blank" : undefined}
                rel={whatsappHref ? "noreferrer" : undefined}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-3 text-center text-sm font-bold ${
                  whatsappHref ? "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                }`}
                aria-disabled={!whatsappHref}
              >
                <Check className="h-4 w-4" />
                Send via WhatsApp
              </a>
            </div>
            <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <p className="text-sm font-medium text-slate-600">Once issued, your customer will be able to view and pay this invoice.</p>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
