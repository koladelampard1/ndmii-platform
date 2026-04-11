import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { calculateLineTotal, generateInvoiceNumber } from "@/lib/data/invoicing";
import {
  filterPayloadByColumns,
  getTableColumns,
  logActivityEvent,
  logInvoiceEvent,
  pickExistingColumns,
  normalizeInvoiceStatus,
} from "@/lib/data/commercial-ops";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const DEV_MODE = process.env.NODE_ENV !== "production";

function devQuoteLog(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[quote-workflow] ${message}`, payload);
}

async function updateQuoteStatus(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
  quoteId: string,
  providerId: string,
  previousStatus: string,
  nextStatus: "in_review" | "accepted" | "declined" | "converted",
  lifecycleColumn?: "reviewed_at" | "accepted_at" | "declined_at"
) {
  const nowIso = new Date().toISOString();
  const columns = await getTableColumns(supabase, "provider_quotes");
  const lifecycleKey = lifecycleColumn ?? "";
  const payload = filterPayloadByColumns(
    {
      status: nextStatus,
      [lifecycleKey]: lifecycleColumn ? nowIso : undefined,
      updated_at: nowIso,
    },
    columns
  );
  const updateSelect = pickExistingColumns(columns, ["id", "status", "accepted_at", "reviewed_at", "declined_at", "converted_at", "updated_at"]);

  devQuoteLog("update:attempt", {
    quoteId,
    providerId,
    previousStatus,
    nextStatus,
    lifecycleColumn: lifecycleColumn ?? null,
    updatePayload: payload,
  });

  const updateQuery = supabase
    .from("provider_quotes")
    .update(payload)
    .eq("id", quoteId)
    .eq("provider_profile_id", providerId);

  const { data: updatedQuote, error } = updateSelect.length
    ? await updateQuery.select(updateSelect.join(",")).maybeSingle()
    : await updateQuery.select("id,status").maybeSingle();

  if (error) {
    devQuoteLog("update:error", {
      quoteId,
      providerId,
      previousStatus,
      nextStatus,
      code: error.code ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
      message: error.message,
    });
    throw new Error(`Quote status update failed: ${error.message}`);
  }

  devQuoteLog("update:result", {
    quoteId,
    providerId,
    previousStatus,
    nextStatus,
    returnedRow: updatedQuote ?? null,
  });
}

async function quoteWorkflowAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const quoteId = String(formData.get("quote_id") ?? "");
  const action = String(formData.get("action") ?? "");

  const { data: quote, error: quoteLoadError } = await supabase
    .from("provider_quotes")
    .select("id,status,provider_profile_id,request_summary,request_details,requester_name,requester_email,requester_phone,budget_min,budget_max")
    .eq("id", quoteId)
    .eq("provider_profile_id", workspace.provider.id)
    .maybeSingle();

  if (quoteLoadError || !quote) throw new Error("Quote not found for this provider.");

  if (action === "mark_reviewed") {
    await updateQuoteStatus(supabase, quote.id, workspace.provider.id, String(quote.status ?? ""), "in_review", "reviewed_at");
    await logActivityEvent(supabase, {
      action: "quote_reviewed",
      entityType: "provider_quote",
      entityId: quote.id,
      actorUserId: workspace.appUserId,
      metadata: { provider_profile_id: workspace.provider.id },
    });
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "accept") {
    await updateQuoteStatus(supabase, quote.id, workspace.provider.id, String(quote.status ?? ""), "accepted", "accepted_at");
    await logActivityEvent(supabase, {
      action: "quote_accepted",
      entityType: "provider_quote",
      entityId: quote.id,
      actorUserId: workspace.appUserId,
      metadata: { provider_profile_id: workspace.provider.id },
    });
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "decline") {
    await updateQuoteStatus(supabase, quote.id, workspace.provider.id, String(quote.status ?? ""), "declined", "declined_at");
    await logActivityEvent(supabase, {
      action: "quote_declined",
      entityType: "provider_quote",
      entityId: quote.id,
      actorUserId: workspace.appUserId,
      metadata: { provider_profile_id: workspace.provider.id },
    });
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "convert_invoice") {
    if (String(quote.status ?? "").toLowerCase() !== "accepted") {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=quote_not_accepted`);
    }

    const invoiceColumns = await getTableColumns(supabase, "invoices");
    const invoicePayload = filterPayloadByColumns(
      {
        provider_profile_id: workspace.provider.id,
        msme_id: workspace.msme.id,
        invoice_number: generateInvoiceNumber(),
        customer_name: quote.requester_name,
        customer_email: quote.requester_email,
        customer_phone: quote.requester_phone,
        description: quote.request_details,
        notes: quote.request_summary,
        currency: "NGN",
        vat_rate: 7.5,
        status: normalizeInvoiceStatus("draft"),
        updated_at: new Date().toISOString(),
        quote_id: quote.id,
      },
      invoiceColumns
    );

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert(invoicePayload).select("id").single();
    if (invoiceError || !invoice) throw new Error(`Invoice creation from quote failed: ${invoiceError?.message ?? "unknown"}`);

    const itemColumns = await getTableColumns(supabase, "invoice_items");
    const seededAmount = Number(quote.budget_max ?? quote.budget_min ?? 0);
    const itemPayload = filterPayloadByColumns(
      {
        invoice_id: invoice.id,
        item_name: quote.request_summary,
        description: `Auto-created from quote ${quote.id}`,
        quantity: 1,
        unit_price: seededAmount,
        line_total: calculateLineTotal(1, seededAmount),
        vat_applicable: true,
      },
      itemColumns
    );
    if (Object.keys(itemPayload).length > 0) {
      const { error: itemError } = await supabase.from("invoice_items").insert(itemPayload);
      if (itemError) throw new Error(`Invoice item creation from quote failed: ${itemError.message}`);
    }

    const linkColumns = await getTableColumns(supabase, "quote_invoice_links");
    const canLinkQuoteInvoice = linkColumns.has("quote_id") && linkColumns.has("invoice_id");
    if (canLinkQuoteInvoice) {
      await supabase.from("quote_invoice_links").insert({ quote_id: quote.id, invoice_id: invoice.id });
    } else {
      await logActivityEvent(supabase, {
        action: "quote_invoice_link_fallback",
        entityType: "invoice",
        entityId: invoice.id,
        actorUserId: workspace.appUserId,
        metadata: { quote_id: quote.id, link_mode: "metadata_only" },
      });
    }

    await updateQuoteStatus(supabase, quote.id, workspace.provider.id, String(quote.status ?? ""), "converted");

    await logInvoiceEvent(supabase, {
      invoiceId: invoice.id,
      eventType: "invoice_created",
      actorRole: workspace.role,
      actorId: workspace.msme.id,
      metadata: { quote_id: quote.id, source: "quote_conversion" },
    });

    await logActivityEvent(supabase, {
      action: "invoice_created_from_quote",
      entityType: "invoice",
      entityId: invoice.id,
      actorUserId: workspace.appUserId,
      metadata: { quote_id: quote.id, provider_profile_id: workspace.provider.id },
    });

    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    revalidatePath("/dashboard/msme/invoices");
    redirect(`/dashboard/msme/invoices/${invoice.id}`);
  }
}

export default async function MsmeQuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { quoteId } = await params;
  const query = await searchParams;

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const [{ data: quote, error: quoteError }, { data: links, error: linkError }] = await Promise.all([
    supabase
      .from("provider_quotes")
      .select("id,requester_name,requester_email,requester_phone,request_summary,request_details,budget_min,budget_max,status,created_at")
      .eq("id", quoteId)
      .eq("provider_profile_id", workspace.provider.id)
      .maybeSingle(),
    supabase.from("quote_invoice_links").select("invoice_id,created_at").eq("quote_id", quoteId).order("created_at", { ascending: false }),
  ]);

  if (quoteError) throw new Error(quoteError.message);
  if (linkError) {
    console.info("[quote-invoice-links:fallback]", linkError.message);
  }
  if (!quote) redirect("/dashboard/msme/quotes");

  const normalizedStatus = String(quote.status ?? "").toLowerCase();
  const linkedInvoiceCount = (links ?? []).length;
  const isConverted = normalizedStatus === "converted";
  const isAccepted = normalizedStatus === "accepted";
  const isDeclined = normalizedStatus === "declined";
  const isPendingReview = ["new", "submitted", "pending_reviewed", "in_review"].includes(normalizedStatus);
  const uiBranch = isConverted ? "converted" : isAccepted ? "accepted" : isDeclined ? "declined" : isPendingReview ? "pending" : "other";
  const showNotAcceptedWarning = query.error === "quote_not_accepted" && !isAccepted && !isConverted;

  console.info("[quote-detail:ui-state]", {
    quoteId: quote.id,
    status: quote.status,
    linkedInvoiceCount,
    uiBranch,
  });

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Quote request</p>
        <h2 className="text-xl font-semibold">{quote.request_summary}</h2>
        <p className="text-sm text-slate-600">{quote.requester_name} · {quote.requester_email ?? quote.requester_phone ?? "No contact provided"}</p>
      </header>

      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Quote action saved.</p>}
      {showNotAcceptedWarning && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Only accepted quotes can be converted into invoices.</p>
      )}
      {isConverted && (
        <p className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">This quote has already been converted into an invoice.</p>
      )}

      <article className="rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <p className="text-sm"><span className="font-semibold">Status:</span> {quote.status}</p>
          <p className="text-sm"><span className="font-semibold">Submitted:</span> {new Date(quote.created_at).toLocaleString("en-NG")}</p>
          <p className="text-sm"><span className="font-semibold">Budget minimum:</span> ₦{Number(quote.budget_min ?? 0).toLocaleString()}</p>
          <p className="text-sm"><span className="font-semibold">Budget maximum:</span> ₦{Number(quote.budget_max ?? 0).toLocaleString()}</p>
        </div>
        <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">{quote.request_details ?? "No detailed request provided."}</div>
      </article>

      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        {isPendingReview && (
          <>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="mark_reviewed" />
              <button className="w-full rounded border px-3 py-2 text-sm">Mark reviewed</button>
            </form>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="accept" />
              <button className="w-full rounded bg-emerald-700 px-3 py-2 text-sm text-white">Accept quote</button>
            </form>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="decline" />
              <button className="w-full rounded border border-rose-300 px-3 py-2 text-sm text-rose-700">Decline quote</button>
            </form>
          </>
        )}

        {isAccepted && (
          <>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="decline" />
              <button className="w-full rounded border border-rose-300 px-3 py-2 text-sm text-rose-700">Decline quote</button>
            </form>
            <form action={quoteWorkflowAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="action" value="convert_invoice" />
              <button className="w-full rounded bg-indigo-900 px-3 py-2 text-sm text-white">Convert to invoice</button>
            </form>
          </>
        )}

        {(isConverted || isDeclined) && (
          <p className="text-sm text-slate-600 md:col-span-4">
            {isConverted
              ? "No further quote actions are available because this quote is already converted."
              : "No further quote actions are available because this quote has been declined."}
          </p>
        )}
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Linked invoices</h3>
        <div className="mt-3 space-y-2">
          {(links ?? []).length === 0 && <p className="text-sm text-slate-500">No invoices linked yet.</p>}
          {(links ?? []).map((link: { invoice_id: string; created_at: string }) => (
            <p key={`${link.invoice_id}-${link.created_at}`} className="text-sm">
              <Link className="text-indigo-700 hover:underline" href={`/dashboard/msme/invoices/${link.invoice_id}`}>
                Invoice {link.invoice_id}
              </Link>{" "}
              linked on {new Date(link.created_at).toLocaleString("en-NG")}
            </p>
          ))}
        </div>
      </article>
    </section>
  );
}
