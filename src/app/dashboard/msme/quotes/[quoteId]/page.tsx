import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProviderWorkspaceContext } from "@/lib/data/provider-operations";
import { calculateLineTotal, generateInvoiceNumber } from "@/lib/data/invoicing";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const DEV_MODE = process.env.NODE_ENV !== "production";
let providerQuoteColumnsCache: Set<string> | null = null;

function devQuoteWorkflowLog(message: string, payload: Record<string, unknown>) {
  if (!DEV_MODE) return;
  console.info(`[provider-quote-workflow] ${message}`, payload);
}

async function getProviderQuoteColumns(supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>) {
  if (providerQuoteColumnsCache) return providerQuoteColumnsCache;

  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "provider_quotes");

  if (error) {
    devQuoteWorkflowLog("provider_quote_columns_lookup_error", {
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
      code: error.code ?? null,
    });
    providerQuoteColumnsCache = new Set();
    return providerQuoteColumnsCache;
  }

  providerQuoteColumnsCache = new Set((data ?? []).map((row) => row.column_name));
  devQuoteWorkflowLog("provider_quote_columns_detected", {
    columns: [...providerQuoteColumnsCache].sort(),
  });
  return providerQuoteColumnsCache;
}

function buildProviderQuoteStatusPayload(params: {
  nextStatus: "in_review" | "quoted" | "declined" | "converted";
  lifecycleColumn?: "reviewed_at" | "accepted_at" | "declined_at";
  nowIso: string;
  columns: Set<string>;
}) {
  const payload: Record<string, unknown> = { status: params.nextStatus };
  const columnsAttempted = ["status"];

  if (params.lifecycleColumn && params.columns.has(params.lifecycleColumn)) {
    payload[params.lifecycleColumn] = params.nowIso;
    columnsAttempted.push(params.lifecycleColumn);
  }
  if (params.columns.has("updated_at")) {
    payload.updated_at = params.nowIso;
    columnsAttempted.push("updated_at");
  }

  return { payload, columnsAttempted };
}

async function quoteWorkflowAction(formData: FormData) {
  "use server";

  const workspace = await getProviderWorkspaceContext();
  const supabase = await createServiceRoleSupabaseClient();

  const quoteId = String(formData.get("quote_id") ?? "");
  const action = String(formData.get("action") ?? "");

  const { data: quote, error: quoteLoadError } = await supabase
    .from("provider_quotes")
    .select("id,status,provider_profile_id,request_summary,requester_name,requester_email,requester_phone,budget_min,budget_max")
    .eq("id", quoteId)
    .eq("provider_profile_id", workspace.provider.id)
    .maybeSingle();

  if (quoteLoadError) throw new Error(`Quote load failed: ${quoteLoadError.message}`);
  if (!quote) throw new Error("Quote not found for this provider.");

  if (action === "mark_reviewed") {
    const nowIso = new Date().toISOString();
    const columns = await getProviderQuoteColumns(supabase);
    const { payload, columnsAttempted } = buildProviderQuoteStatusPayload({
      nextStatus: "in_review",
      lifecycleColumn: "reviewed_at",
      nowIso,
      columns,
    });
    devQuoteWorkflowLog("quote_status_update_attempt", {
      action,
      quoteId: quote.id,
      payload,
      columnsAttempted,
    });

    const { error } = await supabase
      .from("provider_quotes")
      .update(payload)
      .eq("id", quote.id)
      .eq("provider_profile_id", workspace.provider.id);

    if (error) {
      devQuoteWorkflowLog("quote_status_update_error", {
        action,
        quoteId: quote.id,
        payload,
        columnsAttempted,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
        code: error.code ?? null,
      });
      throw new Error(`Quote review update failed: ${error.message}`);
    }
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "accept") {
    const nowIso = new Date().toISOString();
    const columns = await getProviderQuoteColumns(supabase);
    const { payload, columnsAttempted } = buildProviderQuoteStatusPayload({
      nextStatus: "quoted",
      lifecycleColumn: "accepted_at",
      nowIso,
      columns,
    });
    devQuoteWorkflowLog("quote_status_update_attempt", {
      action,
      quoteId: quote.id,
      payload,
      columnsAttempted,
    });

    const { error } = await supabase
      .from("provider_quotes")
      .update(payload)
      .eq("id", quote.id)
      .eq("provider_profile_id", workspace.provider.id);

    if (error) {
      devQuoteWorkflowLog("quote_status_update_error", {
        action,
        quoteId: quote.id,
        payload,
        columnsAttempted,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
        code: error.code ?? null,
      });
      throw new Error(`Quote acceptance update failed: ${error.message}`);
    }
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "decline") {
    const nowIso = new Date().toISOString();
    const columns = await getProviderQuoteColumns(supabase);
    const { payload, columnsAttempted } = buildProviderQuoteStatusPayload({
      nextStatus: "declined",
      lifecycleColumn: "declined_at",
      nowIso,
      columns,
    });
    devQuoteWorkflowLog("quote_status_update_attempt", {
      action,
      quoteId: quote.id,
      payload,
      columnsAttempted,
    });

    const { error } = await supabase
      .from("provider_quotes")
      .update(payload)
      .eq("id", quote.id)
      .eq("provider_profile_id", workspace.provider.id);

    if (error) {
      devQuoteWorkflowLog("quote_status_update_error", {
        action,
        quoteId: quote.id,
        payload,
        columnsAttempted,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
        code: error.code ?? null,
      });
      throw new Error(`Quote decline update failed: ${error.message}`);
    }
    revalidatePath(`/dashboard/msme/quotes/${quote.id}`);
    revalidatePath("/dashboard/msme/quotes");
    redirect(`/dashboard/msme/quotes/${quote.id}?saved=1`);
  }

  if (action === "convert_invoice") {
    if (quote.status !== "quoted") {
      redirect(`/dashboard/msme/quotes/${quote.id}?error=quote_not_accepted`);
    }

    const invoiceNumber = generateInvoiceNumber();
    const seededAmount = Number(quote.budget_max ?? quote.budget_min ?? 0);

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        provider_profile_id: workspace.provider.id,
        msme_id: workspace.msme.id,
        invoice_number: invoiceNumber,
        customer_name: quote.requester_name,
        customer_email: quote.requester_email,
        customer_phone: quote.requester_phone,
        currency: "NGN",
        vat_rate: 7.5,
        status: "draft",
      })
      .select("id")
      .single();

    if (invoiceError) throw new Error(`Invoice creation from quote failed: ${invoiceError.message}`);

    const { error: itemError } = await supabase.from("invoice_items").insert({
      invoice_id: invoice.id,
      item_name: quote.request_summary,
      description: `Auto-created from quote ${quote.id}`,
      quantity: 1,
      unit_price: seededAmount,
      line_total: calculateLineTotal(1, seededAmount),
      vat_applicable: true,
    });

    if (itemError) throw new Error(`Invoice item creation from quote failed: ${itemError.message}`);

    const { error: linkError } = await supabase.from("quote_invoice_links").insert({ quote_id: quote.id, invoice_id: invoice.id });
    if (linkError) throw new Error(`Quote/invoice linking failed: ${linkError.message}`);

    const nowIso = new Date().toISOString();
    const columns = await getProviderQuoteColumns(supabase);
    const { payload, columnsAttempted } = buildProviderQuoteStatusPayload({
      nextStatus: "converted",
      nowIso,
      columns,
    });
    devQuoteWorkflowLog("quote_status_update_attempt", {
      action,
      quoteId: quote.id,
      payload,
      columnsAttempted,
    });

    const { error: statusError } = await supabase
      .from("provider_quotes")
      .update(payload)
      .eq("id", quote.id)
      .eq("provider_profile_id", workspace.provider.id);

    if (statusError) {
      devQuoteWorkflowLog("quote_status_update_error", {
        action,
        quoteId: quote.id,
        payload,
        columnsAttempted,
        message: statusError.message ?? null,
        details: statusError.details ?? null,
        hint: statusError.hint ?? null,
        code: statusError.code ?? null,
      });
      throw new Error(`Quote conversion status update failed: ${statusError.message}`);
    }

    devQuoteWorkflowLog("quote_converted_to_invoice", {
      quoteId: quote.id,
      invoiceId: invoice.id,
      providerId: workspace.provider.id,
      seededAmount,
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
    supabase
      .from("quote_invoice_links")
      .select("invoice_id,created_at")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false }),
  ]);

  if (quoteError) throw new Error(quoteError.message);
  if (linkError) throw new Error(linkError.message);
  if (!quote) redirect("/dashboard/msme/quotes");

  return (
    <section className="space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Quote request</p>
        <h2 className="text-xl font-semibold">{quote.request_summary}</h2>
        <p className="text-sm text-slate-600">{quote.requester_name} · {quote.requester_email ?? quote.requester_phone ?? "No contact provided"}</p>
      </header>

      {query.saved && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Quote action saved.</p>}
      {query.error === "quote_not_accepted" && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Only accepted quotes can be converted into invoices.</p>
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
        <form action={quoteWorkflowAction}>
          <input type="hidden" name="quote_id" value={quote.id} />
          <input type="hidden" name="action" value="convert_invoice" />
          <button className="w-full rounded bg-indigo-900 px-3 py-2 text-sm text-white">Convert to invoice</button>
        </form>
      </div>

      <article className="rounded-xl border bg-white p-4">
        <h3 className="font-semibold">Linked invoices</h3>
        <div className="mt-3 space-y-2">
          {(links ?? []).length === 0 && <p className="text-sm text-slate-500">No invoices linked yet.</p>}
          {(links ?? []).map((link) => (
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
